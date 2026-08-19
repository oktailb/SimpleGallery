/**
 * SimpleGallery 2026 - Central Gallery View Registry
 * Modular architecture for pluggable gallery layouts (Polaroid, Grid, Mosaic, List, etc.)
 */
(function(window) {
  'use strict';

  class GalleryViewRegistryClass {
    constructor() {
      this.views = new Map();
      this.defaultViewId = 'polaroid';
      this.loadedStyles = new Set();
    }

    register(plugin) {
      if (!plugin || !plugin.id) {
        console.error('Invalid GalleryViewPlugin: Missing id property', plugin);
        return;
      }
      this.views.set(plugin.id, plugin);
      this.loadPluginStyles(plugin);
    }

    loadPluginStyles(plugin) {
      if (!plugin || !plugin.id) return;
      const styleId = `view-plugin-style-${plugin.id}`;

      if (this.loadedStyles.has(styleId) || document.getElementById(styleId)) {
        return;
      }

      if (plugin.cssPath) {
        const link = document.createElement('link');
        link.id = styleId;
        link.rel = 'stylesheet';
        link.href = plugin.cssPath;
        document.head.appendChild(link);
        this.loadedStyles.add(styleId);
      } else if (plugin.css) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = plugin.css;
        document.head.appendChild(style);
        this.loadedStyles.add(styleId);
      }
    }

    get(id) {
      const plugin = this.views.get(id) || this.views.get(this.defaultViewId) || null;
      if (plugin) {
        this.loadPluginStyles(plugin);
      }
      return plugin;
    }

    has(id) {
      return this.views.has(id);
    }

    getAll() {
      return Array.from(this.views.values());
    }

    setDefaultViewId(id) {
      if (this.has(id)) {
        this.defaultViewId = id;
      }
    }
  }

  window.GalleryViewRegistry = new GalleryViewRegistryClass();

})(window);
