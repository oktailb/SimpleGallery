/**
 * SimpleGallery 2026 - Maps & GPS Route Explorer App
 * Modular WebOS Map Application with Leaflet, Multi-layer Tiles, Chronological Trajectory & Smart Timeline AI Deduction.
 * Supports both Folder Mode (entire folder with trajectory) and Single Item Mode (single photo centered with open billboard).
 */
(function(window) {
  'use strict';

  class WebOSMapsApp {
    constructor() {
      this.isSmartGpsEnabled = true;
      this.isRouteVisible = true;
      this.currentLayer = 'streets';
      this.leafletMap = null;
      this.markersLayer = null;
      this.routeLayer = null;
      this.tileLayers = {};
      this.currentFiles = [];
      this.currentFocusPath = null;
      this.mode = 'folder'; // 'folder' | 'single'
      this.singleFile = null;
      this.windowId = 'webos-maps-window';

      this.init();
    }

    t(key, replacements = {}) {
      if (window.desktop && typeof window.desktop.t === 'function') {
        return window.desktop.t(key, replacements);
      }
      if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
        return window.sys.i18n.t(key, replacements);
      }
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, replacements);
      }
      return key;
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    init() {
      // Expose globally to system and window
      window.sys = window.sys || {};
      window.sys.openMaps = (options) => this.open(options);
      window.sys.computeSmartGpsLocations = (files, enabled) => this.computeSmartGpsLocations(files, enabled);

      if (window.sys && window.sys.events) {
        window.sys.events.on('locale:changed', () => {
          if (this.leafletMap) {
            this.renderMapContent();
            this.bindMenuBar();
          }
        });
      }
    }

    /**
     * Smart GPS Deduction & Timeline Interpolation Algorithm
     */
    computeSmartGpsLocations(files, enableSmart = true) {
      if (!files || files.length === 0) return [];

      const sorted = [...files]
        .filter(f => ['image', 'video'].includes(f.category || 'image'))
        .sort((a, b) => (a.effective_mtime || a.mtime || 0) - (b.effective_mtime || b.mtime || 0));

      const nativeGpsItems = [];
      sorted.forEach((f, idx) => {
        const lat = f.exif?.gps?.lat;
        const lng = f.exif?.gps?.lng;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          nativeGpsItems.push({ file: f, index: idx, time: (f.effective_mtime || f.mtime || 0) * 1000, lat, lng });
        }
      });

      if (nativeGpsItems.length === 0) return [];

      const result = [];
      const maxInterpolationGapMs = 2 * 3600 * 1000; // 2 hours
      const maxInterpolationDistKm = 50;              // 50 km
      const maxSpeedKmH = 130;                        // 130 km/h
      const maxExtrapolationGapMs = 1 * 3600 * 1000; // 1 hour

      const haversineKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      sorted.forEach((file) => {
        const lat = file.exif?.gps?.lat;
        const lng = file.exif?.gps?.lng;
        const time = (file.effective_mtime || file.mtime || 0) * 1000;

        // 1. Native GPS
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          result.push({
            file,
            gps_source: 'native',
            lat,
            lng,
            time
          });
          return;
        }

        if (!enableSmart || !this.isSmartGpsEnabled) return;

        // 2. Linear Interpolation between two temporal anchors
        let prevAnchor = null;
        let nextAnchor = null;

        for (let i = 0; i < nativeGpsItems.length; i++) {
          if (nativeGpsItems[i].time <= time) {
            prevAnchor = nativeGpsItems[i];
          }
          if (nativeGpsItems[i].time >= time) {
            nextAnchor = nativeGpsItems[i];
            break;
          }
        }

        if (prevAnchor && nextAnchor && prevAnchor !== nextAnchor) {
          const timeDiff = nextAnchor.time - prevAnchor.time;
          if (timeDiff > 0 && timeDiff <= maxInterpolationGapMs) {
            const distKm = haversineKm(prevAnchor.lat, prevAnchor.lng, nextAnchor.lat, nextAnchor.lng);
            const speedKmH = distKm / (timeDiff / 3600000);

            if (distKm <= maxInterpolationDistKm && speedKmH <= maxSpeedKmH) {
              const progress = (time - prevAnchor.time) / timeDiff;
              const interpolatedLat = prevAnchor.lat + progress * (nextAnchor.lat - prevAnchor.lat);
              const interpolatedLng = prevAnchor.lng + progress * (nextAnchor.lng - prevAnchor.lng);

              result.push({
                file,
                gps_source: 'interpolated',
                lat: interpolatedLat,
                lng: interpolatedLng,
                time,
                anchor_prev: prevAnchor.file.name,
                anchor_next: nextAnchor.file.name,
                delta_min: Math.round((time - prevAnchor.time) / 60000)
              });
              return;
            }
          }
        }

        // 3. Extrapolation to closest single anchor
        let closestAnchor = null;
        let minGapMs = Infinity;

        nativeGpsItems.forEach(anchor => {
          const gap = Math.abs(anchor.time - time);
          if (gap < minGapMs) {
            minGapMs = gap;
            closestAnchor = anchor;
          }
        });

        if (closestAnchor && minGapMs <= maxExtrapolationGapMs) {
          result.push({
            file,
            gps_source: 'extrapolated',
            lat: closestAnchor.lat,
            lng: closestAnchor.lng,
            time,
            anchor_name: closestAnchor.file.name,
            delta_min: Math.round(minGapMs / 60000)
          });
        }
      });

      return result;
    }

    /**
     * Opens or focuses the Maps application window
     */
    open(options = {}) {
      const files = options.files || (window.explorerApp && window.explorerApp.state && window.explorerApp.state.filteredFiles) || [];
      const focusPath = options.focusPath || (options.file ? options.file.path : null);
      const isSingleItem = options.singleItem === true || (!!options.file && !options.files) || (!!focusPath && options.singleItem !== false);

      this.currentFiles = files;
      this.currentFocusPath = focusPath;
      this.mode = isSingleItem ? 'single' : 'folder';
      this.singleFile = options.file || (focusPath ? files.find(f => f.path === focusPath) : null);

      if (!window.WindowManager) return;

      const baseAppTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('maps')
        : (this.t('map.title') || "Exploration Cartographique & Trajet GPS");

      const appTitle = (this.mode === 'single' && this.singleFile)
        ? `${baseAppTitle} : ${this.singleFile.name}`
        : baseAppTitle;

      const fileName = (this.mode === 'single' && this.singleFile) ? this.singleFile.name : '';

      const defaultW = Math.min(1080, Math.max(540, Math.round(window.innerWidth * 0.85)));
      const defaultH = Math.min(740, Math.max(400, Math.round(window.innerHeight * 0.80)));

      const bodyHtml = `
        <div class="webos-map-window">
          <div class="map-toolbar-inner">
            <div class="map-title-group">
              <div class="map-title-text" id="mapsWinTitleText">🗺️ ${this.escapeHtml(appTitle)}</div>
              <span id="mapsWinCountBadge" class="map-count-badge">Calcul en cours...</span>
            </div>
            <div class="map-controls-group" id="mapsWinControlsGroup">
              <div class="map-layer-selector">
                <button type="button" class="map-layer-btn ${this.currentLayer === 'dark' ? 'active' : ''}" data-layer="dark" title="${this.escapeHtml(this.t('map.layer_dark') || 'Fond sombre')}">🌙 Sombre</button>
                <button type="button" class="map-layer-btn ${this.currentLayer === 'streets' ? 'active' : ''}" data-layer="streets" title="${this.escapeHtml(this.t('map.layer_streets') || 'Plan de rues')}">🗺️ Rues</button>
                <button type="button" class="map-layer-btn ${this.currentLayer === 'satellite' ? 'active' : ''}" data-layer="satellite" title="${this.escapeHtml(this.t('map.layer_satellite') || 'Vue Satellite')}">🛰️ Satellite</button>
              </div>
              <button type="button" id="mapsWinSmartGpsBtn" class="map-ctrl-btn ${this.isSmartGpsEnabled ? 'active' : ''}" style="${this.mode === 'single' ? 'display:none;' : ''}" title="${this.escapeHtml(this.t('map.smart_deduction') || 'Déduction GPS intelligente')}">
                <span>${this.escapeHtml(this.t('map.smart_deduction') || '✨ Déduction auto')}</span> (<span id="mapsWinSmartCount">0</span>)
              </button>
              <button type="button" id="mapsWinRouteBtn" class="map-ctrl-btn ${this.isRouteVisible ? 'active' : ''}" style="${this.mode === 'single' ? 'display:none;' : ''}" title="${this.escapeHtml(this.t('map.route') || 'Tracé du parcours')}">
                〰️ ${this.escapeHtml(this.t('map.route') || 'Trajet')}
              </button>
              <button type="button" id="mapsWinShowAllBtn" class="map-ctrl-btn" style="${this.mode === 'single' && this.currentFiles.length > 1 ? '' : 'display:none;'}" title="Afficher l'ensemble des photos géolocalisées du dossier">
                📁 Voir tout le dossier
              </button>
              <button type="button" id="mapsWinRecenterBtn" class="map-ctrl-btn" title="${this.escapeHtml(this.t('map.recenter') || 'Recentrer la carte')}">
                🎯 ${this.escapeHtml(this.t('map.recenter') || 'Recentrer')}
              </button>
            </div>
          </div>
          <div id="webosLeafletCanvas" class="map-canvas-container"></div>
        </div>
      `;

      const win = window.WindowManager.createWindow({
        id: this.windowId,
        appId: 'maps',
        appName: baseAppTitle,
        fileName: fileName,
        title: appTitle,
        icon: '🗺️',
        width: defaultW,
        height: defaultH,
        content: bodyHtml,
        onFocus: () => {
          this.bindMenuBar();
          if (this.leafletMap) {
            setTimeout(() => this.leafletMap.invalidateSize(), 50);
          }
        },
        onResize: () => {
          if (this.leafletMap) this.leafletMap.invalidateSize();
        },
        onMaximize: () => {
          if (this.leafletMap) setTimeout(() => this.leafletMap.invalidateSize(), 150);
        }
      });

      // Update window title if already exists
      if (win) {
        window.WindowManager.setTitle(this.windowId, appTitle);
      }

      setTimeout(() => {
        this.initMapCanvas();
        this.renderMapContent();
        this.bindWindowControls();
      }, 60);
    }

    switchToFolderMode() {
      this.mode = 'folder';
      this.currentFocusPath = null;
      this.singleFile = null;

      const baseAppTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('maps')
        : (this.t('map.title') || "Exploration Cartographique & Trajet GPS");

      window.WindowManager.setTitle(this.windowId, baseAppTitle);
      const titleTextEl = document.getElementById('mapsWinTitleText');
      if (titleTextEl) titleTextEl.textContent = `🗺️ ${baseAppTitle}`;

      const smartBtn = document.getElementById('mapsWinSmartGpsBtn');
      const routeBtn = document.getElementById('mapsWinRouteBtn');
      const showAllBtn = document.getElementById('mapsWinShowAllBtn');
      if (smartBtn) smartBtn.style.display = '';
      if (routeBtn) routeBtn.style.display = '';
      if (showAllBtn) showAllBtn.style.display = 'none';

      this.renderMapContent();
      this.bindMenuBar();
    }

    bindMenuBar() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenu('maps', (container) => {
        const isSingle = this.mode === 'single';
        const activeItemTitle = (isSingle && this.singleFile) ? this.singleFile.name : (this.t('map.title') || 'Carte GPS');

        container.innerHTML = `
          <div class="app-menu-left">
            <span class="app-menu-pill active" style="font-weight:600;">🗺️ ${this.escapeHtml(activeItemTitle)}</span>
            <button type="button" class="app-menu-pill" id="menuMapsLayerDark">🌙 Sombre</button>
            <button type="button" class="app-menu-pill" id="menuMapsLayerStreets">🗺️ Rues</button>
            <button type="button" class="app-menu-pill" id="menuMapsLayerSat">🛰️ Satellite</button>
            ${!isSingle ? `
              <button type="button" class="app-menu-pill ${this.isSmartGpsEnabled ? 'active' : ''}" id="menuMapsToggleSmart">${this.escapeHtml(this.t('map.smart_deduction') || '✨ Déduction auto')}</button>
              <button type="button" class="app-menu-pill ${this.isRouteVisible ? 'active' : ''}" id="menuMapsToggleRoute">〰️ ${this.escapeHtml(this.t('map.route') || 'Trajet')}</button>
            ` : (this.currentFiles.length > 1 ? `
              <button type="button" class="app-menu-pill" id="menuMapsShowAllBtn">📁 Voir tout le dossier</button>
            ` : '')}
          </div>
          <div class="app-menu-right">
            <button type="button" class="app-menu-pill" id="menuMapsRecenter">🎯 ${this.escapeHtml(this.t('map.recenter') || 'Recentrer')}</button>
            <button type="button" class="app-menu-pill" id="menuMapsFsBtn">⛶ ${this.escapeHtml(this.t('lightbox.fullscreen') || 'Plein Écran')}</button>
          </div>
        `;

        const btnDark = container.querySelector('#menuMapsLayerDark');
        const btnStreets = container.querySelector('#menuMapsLayerStreets');
        const btnSat = container.querySelector('#menuMapsLayerSat');
        const btnSmart = container.querySelector('#menuMapsToggleSmart');
        const btnRoute = container.querySelector('#menuMapsToggleRoute');
        const btnShowAll = container.querySelector('#menuMapsShowAllBtn');
        const btnRecenter = container.querySelector('#menuMapsRecenter');
        const btnFs = container.querySelector('#menuMapsFsBtn');

        if (btnDark) btnDark.onclick = () => this.setTileLayer('dark');
        if (btnStreets) btnStreets.onclick = () => this.setTileLayer('streets');
        if (btnSat) btnSat.onclick = () => this.setTileLayer('satellite');
        if (btnSmart) btnSmart.onclick = () => this.toggleSmartGps();
        if (btnRoute) btnRoute.onclick = () => this.toggleRoute();
        if (btnShowAll) btnShowAll.onclick = () => this.switchToFolderMode();
        if (btnRecenter) btnRecenter.onclick = () => this.recenterMap();
        if (btnFs) btnFs.onclick = () => window.WindowManager.toggleMaximize(this.windowId);
      });
      window.MenuBarManager.setActiveApp('maps');
    }

    initMapCanvas() {
      const container = document.getElementById('webosLeafletCanvas');
      if (!container || !window.L) return;

      if (this.leafletMap) {
        this.leafletMap.remove();
        this.leafletMap = null;
      }

      this.tileLayers = {
        streets: window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }),
        dark: window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; CARTO &copy; OpenStreetMap'
        }),
        satellite: window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: '&copy; Esri World Imagery'
        })
      };

      const initialLayer = this.tileLayers[this.currentLayer] || this.tileLayers.streets;

      this.leafletMap = window.L.map(container, {
        layers: [initialLayer],
        zoomControl: true
      });

      this.markersLayer = (typeof window.L.markerClusterGroup === 'function')
        ? window.L.markerClusterGroup({
            maxClusterRadius: 40,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
          })
        : window.L.featureGroup();

      this.leafletMap.addLayer(this.markersLayer);
    }

    setTileLayer(layerName) {
      if (!this.leafletMap || !this.tileLayers[layerName]) return;
      Object.values(this.tileLayers).forEach(layer => {
        if (this.leafletMap.hasLayer(layer)) this.leafletMap.removeLayer(layer);
      });
      this.tileLayers[layerName].addTo(this.leafletMap);
      this.currentLayer = layerName;

      document.querySelectorAll('.map-layer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layer === layerName);
      });
    }

    toggleSmartGps() {
      this.isSmartGpsEnabled = !this.isSmartGpsEnabled;
      const btn = document.getElementById('mapsWinSmartGpsBtn');
      if (btn) btn.classList.toggle('active', this.isSmartGpsEnabled);
      this.renderMapContent();
      this.bindMenuBar();
    }

    toggleRoute() {
      this.isRouteVisible = !this.isRouteVisible;
      const btn = document.getElementById('mapsWinRouteBtn');
      if (btn) btn.classList.toggle('active', this.isRouteVisible);
      if (this.routeLayer && this.leafletMap) {
        if (this.isRouteVisible) {
          this.routeLayer.addTo(this.leafletMap);
        } else {
          this.leafletMap.removeLayer(this.routeLayer);
        }
      }
      this.bindMenuBar();
    }

    recenterMap() {
      if (!this.leafletMap || !this.markersLayer) return;
      const bounds = this.markersLayer.getBounds();
      if (bounds && bounds.isValid()) {
        this.leafletMap.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    renderMapContent() {
      if (!this.leafletMap || !this.markersLayer) return;

      const allMapped = this.computeSmartGpsLocations(this.currentFiles, this.isSmartGpsEnabled);
      let mapped = allMapped;

      // In Single Item Mode, filter down to the single photo
      if (this.mode === 'single' && this.currentFocusPath) {
        mapped = allMapped.filter(i => i.file.path === this.currentFocusPath);
        // Fallback: If not in allMapped but singleFile has direct GPS coordinates
        if (mapped.length === 0 && this.singleFile && this.singleFile.exif?.gps?.lat && this.singleFile.exif?.gps?.lng) {
          mapped = [{
            file: this.singleFile,
            gps_source: 'native',
            lat: this.singleFile.exif.gps.lat,
            lng: this.singleFile.exif.gps.lng,
            time: (this.singleFile.effective_mtime || this.singleFile.mtime || 0) * 1000
          }];
        }
      }

      const nativeCount = mapped.filter(i => i.gps_source === 'native').length;
      const magicCount = mapped.filter(i => i.gps_source !== 'native').length;

      const badgeEl = document.getElementById('mapsWinCountBadge');
      if (badgeEl) {
        if (this.mode === 'single') {
          badgeEl.textContent = magicCount > 0 ? '✨ 1 photo (position estimée)' : '📍 1 photo géolocalisée';
        } else {
          const extra = magicCount > 0 ? ` + ${magicCount} estimée(s)` : '';
          badgeEl.textContent = `${nativeCount}${extra} photo(s) géolocalisée(s)`;
        }
      }

      const smartCountEl = document.getElementById('mapsWinSmartCount');
      if (smartCountEl) smartCountEl.textContent = magicCount;

      this.markersLayer.clearLayers();
      if (this.routeLayer && this.leafletMap) {
        this.leafletMap.removeLayer(this.routeLayer);
        this.routeLayer = null;
      }

      if (mapped.length === 0) return;

      const latLngs = [];
      let focusMarker = null;

      mapped.forEach(item => {
        const file = item.file;
        const lat = item.lat;
        const lng = item.lng;
        latLngs.push([lat, lng]);

        const isFocused = this.currentFocusPath === file.path;
        const isMagic = item.gps_source !== 'native';

        const markerClass = `marker-bubble ${(isFocused || this.mode === 'single') ? 'highlight' : ''} ${isMagic ? 'magic' : ''}`;
        const sparkle = isMagic ? `<div class="marker-magic-sparkle" title="Position déduite par horodatage">✨</div>` : '';
        const pointer = isMagic ? `marker-pointer magic-pointer` : `marker-pointer`;

        const markerIcon = window.L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div class="${markerClass}">
              <img src="${file.thumb_url || file.file_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" />
              ${sparkle}
            </div>
            <div class="${pointer}"></div>
          `,
          iconSize: [44, 52],
          iconAnchor: [22, 50],
          popupAnchor: [0, -48]
        });

        const marker = window.L.marker([lat, lng], { icon: markerIcon });

        let badgeHtml = '';
        if (item.gps_source === 'interpolated') {
          badgeHtml = `<div class="map-popup-magic-badge">✨ Position estimée (+${item.delta_min}m)</div>`;
        } else if (item.gps_source === 'extrapolated') {
          badgeHtml = `<div class="map-popup-magic-badge">✨ Position estimée (${item.delta_min}m de « ${this.escapeHtml(item.anchor_name || '')} »)</div>`;
        } else {
          badgeHtml = `<div style="font-size:0.75rem;color:#4ade80;margin-bottom:4px;font-weight:600;">📍 Coordonnées GPS réelles</div>`;
        }

        const dateStr = file.exif?.datetime || new Date((file.effective_mtime || file.mtime) * 1000).toLocaleString();

        const popupHtml = `
          <div class="map-popup-card">
            <img src="${file.thumb_url || file.file_url}" class="map-popup-thumb" id="popupThumb-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}" alt="${this.escapeHtml(file.name)}" />
            <div class="map-popup-body">
              ${badgeHtml}
              <div class="map-popup-title" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
              <div class="map-popup-meta">📅 ${this.escapeHtml(dateStr)} • ${file.size_formatted}</div>
              <button type="button" class="map-popup-btn" id="popupOpenBtn-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}">
                🖼️ Ouvrir dans la visionneuse
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, {
          className: 'sg-leaflet-popup',
          maxWidth: 240,
          autoClose: false,
          closeOnClick: false
        });

        marker.on('popupopen', () => {
          const cleanId = file.path.replace(/[^a-zA-Z0-9]/g, '_');
          const openBtn = document.getElementById(`popupOpenBtn-${cleanId}`);
          const thumbEl = document.getElementById(`popupThumb-${cleanId}`);
          const openAction = () => {
            if (window.MediaViewerRegistry) {
              window.MediaViewerRegistry.open(file);
            }
          };
          if (openBtn) openBtn.onclick = openAction;
          if (thumbEl) thumbEl.onclick = openAction;
        });

        this.markersLayer.addLayer(marker);

        if (isFocused || this.mode === 'single') {
          focusMarker = marker;
        }
      });

      // Render Chronological Route Line only in Folder Mode with > 1 photo
      if (this.mode === 'folder' && latLngs.length > 1) {
        this.routeLayer = window.L.polyline(latLngs, {
          color: '#6366f1',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
          lineCap: 'round',
          lineJoin: 'round'
        });

        if (this.isRouteVisible) {
          this.routeLayer.addTo(this.leafletMap);
        }
      }

      // Center view and automatically open billboard/popup
      if (focusMarker) {
        this.leafletMap.setView(focusMarker.getLatLng(), 16);
        setTimeout(() => {
          focusMarker.openPopup();
        }, 150);
      } else if (latLngs.length > 0) {
        this.recenterMap();
      }

      setTimeout(() => { if (this.leafletMap) this.leafletMap.invalidateSize(); }, 200);
    }

    bindWindowControls() {
      // Layer buttons
      document.querySelectorAll('.map-layer-btn').forEach(btn => {
        btn.onclick = () => this.setTileLayer(btn.dataset.layer);
      });

      // Smart GPS Toggle
      const smartBtn = document.getElementById('mapsWinSmartGpsBtn');
      if (smartBtn) smartBtn.onclick = () => this.toggleSmartGps();

      // Route Toggle
      const routeBtn = document.getElementById('mapsWinRouteBtn');
      if (routeBtn) routeBtn.onclick = () => this.toggleRoute();

      // Show All Button (Single Item Mode -> Folder Mode)
      const showAllBtn = document.getElementById('mapsWinShowAllBtn');
      if (showAllBtn) showAllBtn.onclick = () => this.switchToFolderMode();

      // Recenter
      const recenterBtn = document.getElementById('mapsWinRecenterBtn');
      if (recenterBtn) recenterBtn.onclick = () => this.recenterMap();
    }
  }

  // Instantiate and mount Maps App
  window.MapsApp = new WebOSMapsApp();

})(window);
