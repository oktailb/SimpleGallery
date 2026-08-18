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
    }

    /**
     * Registers a new view plugin
     * @param {Object} plugin
     */
    register(plugin) {
      if (!plugin || !plugin.id) {
        console.error('Invalid GalleryViewPlugin: Missing id property', plugin);
        return;
      }
      this.views.set(plugin.id, plugin);
    }

    /**
     * Retrieves a registered view plugin by ID
     * @param {string} id
     * @returns {Object|null}
     */
    get(id) {
      return this.views.get(id) || this.views.get(this.defaultViewId) || null;
    }

    /**
     * Checks if a view plugin exists
     * @param {string} id
     * @returns {boolean}
     */
    has(id) {
      return this.views.has(id);
    }

    /**
     * Returns all registered view plugins in order
     * @returns {Array<Object>}
     */
    getAll() {
      return Array.from(this.views.values());
    }

    /**
     * Sets the default view ID
     * @param {string} id
     */
    setDefaultViewId(id) {
      if (this.has(id)) {
        this.defaultViewId = id;
      }
    }
  }

  window.GalleryViewRegistry = new GalleryViewRegistryClass();
})(window);
