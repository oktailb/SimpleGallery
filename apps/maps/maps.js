/**
 * SimpleGallery 2026 - Maps & GPS Route Explorer App (Multi-Instance)
 * Modular WebOS Map Application with Leaflet, Multi-layer Tiles, Chronological Trajectory & Smart Timeline AI Deduction.
 * Supports concurrent multi-instances to compare trajectories from multiple folders side-by-side.
 */
(function(window) {
  'use strict';

  class MapsInstance {
    constructor(app, id, options = {}) {
      this.app = app;
      this.id = id;
      this.winId = `maps-${id}`;
      this.options = options;

      this.currentFiles = Array.isArray(options.files) ? [...options.files] : [];
      this.currentPath = options.currentPath || '';
      this.focusPath = options.focusPath || (options.file ? options.file.path : null);
      this.mode = (options.singleItem === true || (!!options.file && !options.files)) ? 'single' : 'folder';
      this.singleFile = options.file || (this.focusPath ? this.currentFiles.find(f => f.path === this.focusPath) : null);

      this.isSmartGpsEnabled = true;
      this.isRouteVisible = true;
      this.currentLayer = 'streets';
      this.leafletMap = null;
      this.markersLayer = null;
      this.routeLayer = null;
      this.tileLayers = {};
      this.win = null;

      this.initWindow();
    }

    t(key, replacements = {}) {
      return this.app.t(key, replacements);
    }

    escapeHtml(str) {
      return this.app.escapeHtml(str);
    }

    initWindow() {
      const baseAppTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('maps')
        : (this.t('map.title') || "Exploration Cartographique & Trajet GPS");

      let displayTitle = baseAppTitle;
      if (this.mode === 'single' && this.singleFile) {
        displayTitle = `${baseAppTitle} : ${this.singleFile.name}`;
      } else if (this.currentPath) {
        const folderName = this.currentPath.split('/').filter(Boolean).pop() || this.currentPath;
        displayTitle = `${baseAppTitle} : ${folderName}`;
      } else if (this.id > 1) {
        displayTitle = `${baseAppTitle} #${this.id}`;
      }

      const fileName = (this.mode === 'single' && this.singleFile) ? this.singleFile.name : '';
      const defaultW = Math.min(1080, Math.max(540, Math.round(window.innerWidth * 0.85)));
      const defaultH = Math.min(740, Math.max(400, Math.round(window.innerHeight * 0.80)));

      const bodyHtml = `
        <div class="webos-map-window" id="mapWin-${this.id}">
          <div class="map-toolbar-inner">
            <div class="map-title-group">
              <div class="map-title-text" id="mapsWinTitleText-${this.id}">🗺️ ${this.escapeHtml(displayTitle)}</div>
              <span id="mapsWinCountBadge-${this.id}" class="map-count-badge">Calcul en cours...</span>
            </div>
            <div class="map-controls-group" id="mapsWinControlsGroup-${this.id}">
              <div class="map-layer-selector">
                <button type="button" class="map-layer-btn active" data-layer="streets" title="${this.escapeHtml(this.t('map.layer_streets') || 'Plan de rues')}">🗺️ Rues</button>
                <button type="button" class="map-layer-btn" data-layer="dark" title="${this.escapeHtml(this.t('map.layer_dark') || 'Fond sombre')}">🌙 Sombre</button>
                <button type="button" class="map-layer-btn" data-layer="satellite" title="${this.escapeHtml(this.t('map.layer_satellite') || 'Vue Satellite')}">🛰️ Satellite</button>
              </div>
              <button type="button" id="mapsWinSmartGpsBtn-${this.id}" class="map-ctrl-btn active" style="${this.mode === 'single' ? 'display:none;' : ''}" title="${this.escapeHtml(this.t('map.smart_deduction') || 'Déduction GPS intelligente')}">
                <span>${this.escapeHtml(this.t('map.smart_deduction') || '✨ Déduction auto')}</span> (<span id="mapsWinSmartCount-${this.id}">0</span>)
              </button>
              <button type="button" id="mapsWinRouteBtn-${this.id}" class="map-ctrl-btn active" style="${this.mode === 'single' ? 'display:none;' : ''}" title="${this.escapeHtml(this.t('map.route') || 'Tracé du parcours')}">
                〰️ ${this.escapeHtml(this.t('map.route') || 'Trajet')}
              </button>
              <button type="button" id="mapsWinShowAllBtn-${this.id}" class="map-ctrl-btn" style="${this.mode === 'single' && this.currentFiles.length > 1 ? '' : 'display:none;'}" title="Afficher l'ensemble des photos géolocalisées du dossier">
                📁 Voir tout le dossier
              </button>
              <button type="button" id="mapsWinRecenterBtn-${this.id}" class="map-ctrl-btn" title="${this.escapeHtml(this.t('map.recenter') || 'Recentrer la carte')}">
                🎯 ${this.escapeHtml(this.t('map.recenter') || 'Recentrer')}
              </button>
            </div>
          </div>
          <div id="webosLeafletCanvas-${this.id}" class="map-canvas-container" style="width:100%;height:100%;flex:1;position:relative;background:#0f172a;"></div>
        </div>
      `;

      if (!window.WindowManager) return;

      this.win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'maps',
        appName: baseAppTitle,
        fileName: fileName,
        title: displayTitle,
        icon: '🗺️',
        width: defaultW,
        height: defaultH,
        content: bodyHtml,
        onFocus: () => {
          this.app.setActiveInstance(this);
          if (this.leafletMap) {
            setTimeout(() => this.leafletMap.invalidateSize(), 50);
          }
        },
        onResize: () => {
          if (this.leafletMap) this.leafletMap.invalidateSize();
        },
        onMaximize: () => {
          if (this.leafletMap) setTimeout(() => this.leafletMap.invalidateSize(), 150);
        },
        onClose: () => {
          this.destroy();
        }
      });

      // If no files passed (e.g. launched from Desktop), load gallery files asynchronously
      if (this.currentFiles.length === 0 && !this.singleFile) {
        this.loadGalleryFiles();
      } else {
        setTimeout(() => {
          this.initMapCanvas();
          this.renderMapContent();
          this.bindWindowControls();
        }, 60);
      }
    }

    async loadGalleryFiles() {
      try {
        const res = await fetch(`api.php?dir=${encodeURIComponent(this.currentPath)}&_t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.files)) {
            this.currentFiles = json.files;
          }
        }
      } catch (e) {
        console.error('[MapsInstance] Failed to load files:', e);
      }
      setTimeout(() => {
        this.initMapCanvas();
        this.renderMapContent();
        this.bindWindowControls();
      }, 60);
    }

    destroy() {
      if (this.leafletMap) {
        this.leafletMap.remove();
        this.leafletMap = null;
      }
      this.app.instances.delete(this.id);
      if (this.app.activeInstance === this) {
        this.app.activeInstance = null;
        const remaining = Array.from(this.app.instances.values());
        if (remaining.length > 0) {
          this.app.setActiveInstance(remaining[remaining.length - 1]);
        }
      }
    }

    switchToFolderMode() {
      this.mode = 'folder';
      this.focusPath = null;
      this.singleFile = null;

      const baseAppTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('maps')
        : (this.t('map.title') || "Exploration Cartographique & Trajet GPS");

      let displayTitle = baseAppTitle;
      if (this.currentPath) {
        const folderName = this.currentPath.split('/').filter(Boolean).pop() || this.currentPath;
        displayTitle = `${baseAppTitle} : ${folderName}`;
      } else if (this.id > 1) {
        displayTitle = `${baseAppTitle} #${this.id}`;
      }

      window.WindowManager.setTitle(this.winId, displayTitle);
      const titleTextEl = document.getElementById(`mapsWinTitleText-${this.id}`);
      if (titleTextEl) titleTextEl.textContent = `🗺️ ${displayTitle}`;

      const smartBtn = document.getElementById(`mapsWinSmartGpsBtn-${this.id}`);
      const routeBtn = document.getElementById(`mapsWinRouteBtn-${this.id}`);
      const showAllBtn = document.getElementById(`mapsWinShowAllBtn-${this.id}`);
      if (smartBtn) smartBtn.style.display = '';
      if (routeBtn) routeBtn.style.display = '';
      if (showAllBtn) showAllBtn.style.display = 'none';

      this.renderMapContent();
      this.app.updateMenuBarForActiveInstance();
    }

    initMapCanvas() {
      const container = document.getElementById(`webosLeafletCanvas-${this.id}`);
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
        center: [46.603354, 1.888334],
        zoom: 5,
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

      const root = this.win ? this.win.element : document;
      if (root) {
        root.querySelectorAll('.map-layer-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.layer === layerName);
        });
      }
    }

    toggleSmartGps() {
      this.isSmartGpsEnabled = !this.isSmartGpsEnabled;
      const btn = document.getElementById(`mapsWinSmartGpsBtn-${this.id}`);
      if (btn) btn.classList.toggle('active', this.isSmartGpsEnabled);
      this.renderMapContent();
      this.app.updateMenuBarForActiveInstance();
    }

    toggleRoute() {
      this.isRouteVisible = !this.isRouteVisible;
      const btn = document.getElementById(`mapsWinRouteBtn-${this.id}`);
      if (btn) btn.classList.toggle('active', this.isRouteVisible);
      if (this.routeLayer && this.leafletMap) {
        if (this.isRouteVisible) {
          this.routeLayer.addTo(this.leafletMap);
        } else {
          this.leafletMap.removeLayer(this.routeLayer);
        }
      }
      this.app.updateMenuBarForActiveInstance();
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

      const allMapped = this.app.computeSmartGpsLocations(this.currentFiles, this.isSmartGpsEnabled);
      let mapped = allMapped;

      // In Single Item Mode, filter down to the single photo
      if (this.mode === 'single' && this.focusPath) {
        mapped = allMapped.filter(i => i.file.path === this.focusPath);
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

      const badgeEl = document.getElementById(`mapsWinCountBadge-${this.id}`);
      if (badgeEl) {
        if (this.mode === 'single') {
          badgeEl.textContent = magicCount > 0 ? '✨ 1 photo (position estimée)' : '📍 1 photo géolocalisée';
        } else {
          const extra = magicCount > 0 ? ` + ${magicCount} estimée(s)` : '';
          badgeEl.textContent = `${nativeCount}${extra} photo(s) géolocalisée(s)`;
        }
      }

      const smartCountEl = document.getElementById(`mapsWinSmartCount-${this.id}`);
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

        const isFocused = this.focusPath === file.path;
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
            <img src="${file.thumb_url || file.file_url}" class="map-popup-thumb" id="popupThumb-${this.id}-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}" alt="${this.escapeHtml(file.name)}" />
            <div class="map-popup-body">
              ${badgeHtml}
              <div class="map-popup-title" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
              <div class="map-popup-meta">📅 ${this.escapeHtml(dateStr)} • ${file.size_formatted}</div>
              <button type="button" class="map-popup-btn" id="popupOpenBtn-${this.id}-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}">
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
          const openBtn = document.getElementById(`popupOpenBtn-${this.id}-${cleanId}`);
          const thumbEl = document.getElementById(`popupThumb-${this.id}-${cleanId}`);
          const openAction = () => {
            if (window.MediaViewerRegistry) {
              const ctx = {
                state: {
                  filteredFiles: this.currentFiles.length > 0 ? this.currentFiles : [file],
                  files: this.currentFiles.length > 0 ? this.currentFiles : [file],
                  isAdmin: !!window.IS_ADMIN,
                  userRights: {}
                },
                t: (k, p) => this.t(k, p),
                escapeHtml: (s) => this.escapeHtml(s)
              };
              window.MediaViewerRegistry.open(file, {}, ctx);
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
      } else {
        this.leafletMap.setView([46.603354, 1.888334], 5);
      }

      setTimeout(() => { if (this.leafletMap) this.leafletMap.invalidateSize(); }, 100);
      setTimeout(() => { if (this.leafletMap) this.leafletMap.invalidateSize(); }, 350);
    }

    bindWindowControls() {
      const root = this.win ? this.win.element : document;
      if (!root) return;

      // Layer buttons
      root.querySelectorAll('.map-layer-btn').forEach(btn => {
        btn.onclick = () => this.setTileLayer(btn.dataset.layer);
      });

      // Smart GPS Toggle
      const smartBtn = root.querySelector(`#mapsWinSmartGpsBtn-${this.id}`);
      if (smartBtn) smartBtn.onclick = () => this.toggleSmartGps();

      // Route Toggle
      const routeBtn = root.querySelector(`#mapsWinRouteBtn-${this.id}`);
      if (routeBtn) routeBtn.onclick = () => this.toggleRoute();

      // Show All Button (Single Item Mode -> Folder Mode)
      const showAllBtn = root.querySelector(`#mapsWinShowAllBtn-${this.id}`);
      if (showAllBtn) showAllBtn.onclick = () => this.switchToFolderMode();

      // Recenter
      const recenterBtn = root.querySelector(`#mapsWinRecenterBtn-${this.id}`);
      if (recenterBtn) recenterBtn.onclick = () => this.recenterMap();
    }
  }

  const WebOSApp = (window.sys && window.sys.App) || window.WebOSApp || Object;

  class WebOSMapsApp extends WebOSApp {
    constructor() {
      super({
        id: 'maps',
        title: 'map.title',
        icon: '🗺️'
      });
      this.instances = new Map();
      this.instanceCounter = 0;
      this.activeInstance = null;

      this.initMapsGlobalHandlers();
    }

    initMapsGlobalHandlers() {
      window.sys = window.sys || {};
      window.sys.openMaps = (options) => this.open(options);
      window.sys.computeSmartGpsLocations = (files, enabled) => this.computeSmartGpsLocations(files, enabled);
    }

    onLocaleChanged() {
      this.instances.forEach(inst => {
        if (inst.leafletMap) {
          inst.renderMapContent();
        }
      });
      this.updateMenuBarForActiveInstance();
    }

    setActiveInstance(instance) {
      this.activeInstance = instance;
      this.bindMenuBar();
    }

    getActiveInstance() {
      return this.activeInstance || Array.from(this.instances.values()).pop() || null;
    }

    updateMenuBarForActiveInstance() {
      this.bindMenuBar();
    }

    bindMenuBar() {
      if (!window.MenuBarManager) return;
      const active = this.getActiveInstance();
      if (!active) return;

      window.MenuBarManager.registerAppMenu('maps', (container) => {
        const isSingle = active.mode === 'single';
        const activeItemTitle = (isSingle && active.singleFile) ? active.singleFile.name : (this.t('map.title') || 'Carte GPS');

        container.innerHTML = `
          <div class="app-menu-left">
            <span class="app-menu-pill active" style="font-weight:600;">🗺️ ${this.escapeHtml(activeItemTitle)}</span>
            <button type="button" class="app-menu-pill" id="menuMapsLayerDark">🌙 Sombre</button>
            <button type="button" class="app-menu-pill" id="menuMapsLayerStreets">🗺️ Rues</button>
            <button type="button" class="app-menu-pill" id="menuMapsLayerSat">🛰️ Satellite</button>
            ${!isSingle ? `
              <button type="button" class="app-menu-pill ${active.isSmartGpsEnabled ? 'active' : ''}" id="menuMapsToggleSmart">${this.escapeHtml(this.t('map.smart_deduction') || '✨ Déduction auto')}</button>
              <button type="button" class="app-menu-pill ${active.isRouteVisible ? 'active' : ''}" id="menuMapsToggleRoute">〰️ ${this.escapeHtml(this.t('map.route') || 'Trajet')}</button>
            ` : (active.currentFiles.length > 1 ? `
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

        if (btnDark) btnDark.onclick = () => active.setTileLayer('dark');
        if (btnStreets) btnStreets.onclick = () => active.setTileLayer('streets');
        if (btnSat) btnSat.onclick = () => active.setTileLayer('satellite');
        if (btnSmart) btnSmart.onclick = () => active.toggleSmartGps();
        if (btnRoute) btnRoute.onclick = () => active.toggleRoute();
        if (btnShowAll) btnShowAll.onclick = () => active.switchToFolderMode();
        if (btnRecenter) btnRecenter.onclick = () => active.recenterMap();
        if (btnFs) btnFs.onclick = () => window.WindowManager.toggleMaximize(active.winId);
      });
      window.MenuBarManager.setActiveApp('maps');
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

        if (!enableSmart) return;

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
     * Opens or focuses a Maps application window instance
     */
    open(options = {}) {
      // If an existing instance with same folder path exists, focus it (unless explicit newWindow)
      if (options.currentPath && !options.newWindow) {
        for (const inst of this.instances.values()) {
          if (inst.currentPath === options.currentPath) {
            if (inst.win && inst.win.state === 'minimized') {
              window.WindowManager.restoreWindow(inst.winId);
            }
            window.WindowManager.focusWindow(inst.winId);
            return inst;
          }
        }
      }

      this.instanceCounter++;
      const id = this.instanceCounter;
      const instance = new MapsInstance(this, id, options);
      this.instances.set(id, instance);
      this.setActiveInstance(instance);
      return instance;
    }
  }

  // Instantiate and mount Maps App
  const mapsApp = new WebOSMapsApp();
  window.MapsApp = mapsApp;
  window.mapsApp = mapsApp;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('maps', mapsApp);
  }
})(window);
