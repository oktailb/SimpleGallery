/**
 * SimpleGallery 2026 - Central Media Viewer Registry
 * Modular architecture for file viewers (Images, Videos, Audios, Docs, Archives, 3D, etc.)
 * Supports auto-loading plugin stylesheets, MIME-type & extension resolution, and lifecycle hooks.
 */
(function(window) {
  'use strict';

  class MediaViewerRegistryClass {
    constructor() {
      this.viewers = new Map();
      this.defaultViewerId = 'generic-doc';
      this.loadedStyles = new Set();
    }

    /**
     * Registers a new media viewer plugin
     * @param {Object} plugin
     */
    register(plugin) {
      if (!plugin || !plugin.id) {
        console.error('Invalid MediaViewerPlugin: Missing id property', plugin);
        return;
      }
      this.viewers.set(plugin.id, plugin);

      // Auto-load plugin stylesheet
      this.loadPluginStyles(plugin);
    }

    /**
     * Dynamically loads a plugin's external CSS file or inline stylesheet
     * @param {Object} plugin
     */
    loadPluginStyles(plugin) {
      if (!plugin || !plugin.id) return;
      const styleId = `viewer-plugin-style-${plugin.id}`;

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

    /**
     * Finds the best matching viewer for a given file
     * Priority: Exact extension > MIME-type / Category > Fallback default
     * @param {Object} file
     * @returns {Object|null}
     */
    findViewer(file) {
      if (!file) return null;
      const ext = (file.extension || (file.name ? file.name.split('.').pop() : '')).toLowerCase();
      const cat = file.category || '';
      const mime = file.mime || '';

      const all = Array.from(this.viewers.values());

      // 1. Check exact extension match
      if (ext) {
        const byExt = all.find(v => Array.isArray(v.extensions) && v.extensions.map(e => e.toLowerCase()).includes(ext));
        if (byExt) {
          this.loadPluginStyles(byExt);
          return byExt;
        }
      }

      // 2. Check exact MIME type or wildcard match
      if (mime) {
        const byMime = all.find(v => {
          if (!Array.isArray(v.mimeTypes)) return false;
          return v.mimeTypes.some(m => {
            if (m === mime) return true;
            if (m.endsWith('/*') && mime.startsWith(m.replace('/*', '/'))) return true;
            return false;
          });
        });
        if (byMime) {
          this.loadPluginStyles(byMime);
          return byMime;
        }
      }

      // 3. Check category match
      if (cat) {
        const byCat = all.find(v => Array.isArray(v.categories) && v.categories.includes(cat));
        if (byCat) {
          this.loadPluginStyles(byCat);
          return byCat;
        }
      }

      // 4. Default fallback
      const fallback = this.viewers.get(this.defaultViewerId) || all[0] || null;
      if (fallback) this.loadPluginStyles(fallback);
      return fallback;
    }

    /**
     * Opens a file using the resolved viewer plugin
     * @param {Object} file
     * @param {Object} options (index, target, etc.)
     * @param {Object} context (gallery instance, UI elements, helpers)
     * @returns {boolean}
     */
    open(file, options = {}, context = {}) {
      const viewer = this.findViewer(file);
      if (!viewer) {
        console.warn('No media viewer plugin found for file:', file);
        return false;
      }

      if (typeof viewer.open === 'function') {
        return viewer.open(file, options, context);
      }
      return false;
    }

    /**
     * Retrieves a registered viewer plugin by ID
     * @param {string} id
     * @returns {Object|null}
     */
    get(id) {
      return this.viewers.get(id) || null;
    }

    /**
     * Returns all registered viewer plugins
     * @returns {Array<Object>}
     */
    getAll() {
      return Array.from(this.viewers.values());
    }
  }

  window.MediaViewerRegistry = new MediaViewerRegistryClass();
})(window);
