/**
 * SimpleGallery - Explorer Map & Smart GPS Manager (apps/explorer/scripts/explorer-map.js)
 * Coordinates Leaflet interactive map modal, tile providers, route tracing and timeline GPS interpolation.
 */
(function(window) {
  'use strict';

  class ExplorerMapManager {
    constructor(instance) {
      this.inst = instance;
    }

    computeSmartGpsLocations(files, isSmartGpsEnabled = true) {
      if (!files || files.length === 0) return [];
      if (window.sys && typeof window.sys.computeSmartGpsLocations === 'function') {
        return window.sys.computeSmartGpsLocations(files, isSmartGpsEnabled);
      }

      const result = [];
      files.forEach(f => {
        if (f.exif && f.exif.gps && typeof f.exif.gps.lat === 'number' && typeof f.exif.gps.lng === 'number') {
          result.push({
            file: f,
            lat: f.exif.gps.lat,
            lng: f.exif.gps.lng,
            gps_source: 'native',
            time: (f.effective_mtime || f.mtime) * 1000
          });
        }
      });
      return result;
    }

    openMapModal(focusPath = null) {
      if (!this.inst.el.mapModal) return;
      this.inst.el.mapModal.style.display = 'flex';
      this.initLeafletMap(focusPath);
    }

    closeMapModal() {
      if (this.inst.el.mapModal) {
        this.inst.el.mapModal.style.display = 'none';
      }
    }

    initLeafletMap(focusPath = null) {
      if (!this.inst.el.galleryLeafletMap || typeof L === 'undefined') return;

      const locations = this.computeSmartGpsLocations(this.inst.state.filteredFiles, this.inst.isSmartGpsEnabled);
      if (locations.length === 0) return;

      if (!this.inst.leafletMap) {
        this.inst.leafletMap = L.map(this.inst.el.galleryLeafletMap, {
          zoomControl: true,
          attributionControl: false
        });

        this.inst.leafletTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(this.inst.leafletMap);

        this.inst.leafletMarkersLayer = L.layerGroup().addTo(this.inst.leafletMap);
        this.inst.leafletRouteLayer = L.layerGroup().addTo(this.inst.leafletMap);
      } else {
        this.inst.leafletMarkersLayer.clearLayers();
        this.inst.leafletRouteLayer.clearLayers();
      }

      const bounds = L.latLngBounds([]);
      const routePoints = [];
      let focusMarker = null;

      locations.forEach(loc => {
        const latLng = [loc.lat, loc.lng];
        bounds.extend(latLng);
        routePoints.push(latLng);

        const isFocus = (focusPath && loc.file.path === focusPath);
        const iconColor = (loc.gps_source === 'native') ? '#4f46e5' : '#10b981';
        const marker = L.circleMarker(latLng, {
          radius: isFocus ? 10 : 7,
          fillColor: iconColor,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

        const thumbUrl = loc.file.thumb_url || `system/endpoints/thumb.php?file=${encodeURIComponent(loc.file.path)}`;
        const popupHtml = `
          <div style="font-family:sans-serif;font-size:0.85rem;text-align:center;min-width:140px;">
            <img src="${thumbUrl}" style="width:100%;max-height:100px;object-fit:cover;border-radius:4px;margin-bottom:4px;" alt="">
            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.inst.escapeHtml(loc.file.name)}</div>
            <div style="font-size:0.75rem;color:#64748b;">${loc.gps_source === 'native' ? '📍 GPS Natif' : '✨ GPS Déduit'}</div>
          </div>
        `;
        marker.bindPopup(popupHtml);

        marker.on('click', () => {
          if (this.inst.el.mediaGrid) {
            const card = this.inst.el.mediaGrid.querySelector(`[data-path="${CSS.escape(loc.file.path)}"]`);
            if (card) {
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card.classList.add('selected');
            }
          }
        });

        marker.addTo(this.inst.leafletMarkersLayer);
        if (isFocus) focusMarker = marker;
      });

      if (this.inst.isRouteVisible && routePoints.length > 1) {
        L.polyline(routePoints, {
          color: '#6366f1',
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 8'
        }).addTo(this.inst.leafletRouteLayer);
      }

      setTimeout(() => {
        if (!this.inst.leafletMap) return;
        this.inst.leafletMap.invalidateSize();
        if (focusMarker) {
          this.inst.leafletMap.setView(focusMarker.getLatLng(), 15);
          focusMarker.openPopup();
        } else if (bounds.isValid()) {
          this.inst.leafletMap.fitBounds(bounds, { padding: [30, 30] });
        }
      }, 100);
    }
  }

  window.ExplorerMapManager = ExplorerMapManager;

})(window);
