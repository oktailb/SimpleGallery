/**
 * SimpleGallery WebOS - Central Wallpaper Manager
 * Handles desktop background customization, presets, solid/gradient fills, and image wallpapers.
 */

(function (window, document) {
  'use strict';

  class WallpaperManager {
    constructor() {
      this.currentWallpaper = null;
    }

    init() {
      this.restoreSavedWallpaper();

      if (window.EventBus) {
        window.EventBus.on('wallpaper:change', (data) => {
          this.setWallpaper(data.wallpaper || data);
        });
      }
    }

    restoreSavedWallpaper() {
      try {
        const saved = localStorage.getItem('sg_desktop_wallpaper');
        if (saved) {
          this.apply(saved);
        }
      } catch (e) {}
    }

    setWallpaper(val, save = true) {
      if (!val) return;
      this.apply(val);
      if (save) {
        try {
          localStorage.setItem('sg_desktop_wallpaper', val);
        } catch (e) {}
      }
    }

    apply(val) {
      this.currentWallpaper = val;
      const desktopSurface = document.getElementById('desktopSurface') || document.getElementById('webosDesktop') || document.body;
      if (!desktopSurface) return;

      if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('system/') || val.startsWith('data:') || val.includes('.jpg') || val.includes('.png') || val.includes('.webp')) {
        desktopSurface.style.backgroundImage = `url("${val}")`;
        desktopSurface.style.backgroundSize = 'cover';
        desktopSurface.style.backgroundPosition = 'center';
        desktopSurface.style.backgroundRepeat = 'no-repeat';
      } else if (val.includes('gradient') || val.includes('#') || val.startsWith('rgb')) {
        desktopSurface.style.backgroundImage = val.includes('gradient') ? val : 'none';
        desktopSurface.style.backgroundColor = val.includes('gradient') ? '' : val;
        desktopSurface.style.backgroundSize = '';
        desktopSurface.style.backgroundPosition = '';
      } else {
        desktopSurface.style.backgroundImage = val;
      }
    }

    getPresets() {
      return [
        { id: 'dark_mesh', name: 'Dark Aurora', value: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.25) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.2) 0px, transparent 50%), #0b0f19' },
        { id: 'deep_ocean', name: 'Deep Ocean', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' },
        { id: 'cyber_grid', name: 'Neon Cyber', value: 'linear-gradient(180deg, #05050a 0%, #110e24 100%)' },
        { id: 'minimal_slate', name: 'Clean Slate', value: '#0f172a' }
      ];
    }
  }

  window.sys = window.sys || {};
  window.sys.wallpaper = new WallpaperManager();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.sys.wallpaper.init());
  } else {
    window.sys.wallpaper.init();
  }

})(window, document);
