/**
 * SimpleGallery 2026 - WebOS Contextual Menu Bar Manager (MenuBarManager.js)
 * Manages the top contextual action/menu bar under the breadcrumbs, inspired by macOS.
 * Allows whichever application is active/focused to colonize the top menu with its tools.
 */
(function(window) {
  'use strict';

  class MenuBarManager {
    constructor() {
      this.container = null;
      this.activeAppId = null;
      this.registeredMenus = new Map(); // appId -> renderFn or DOM template
      this.defaultMenuRenderer = null;
    }

    init(containerId = 'appHeaderZone') {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = containerId;
        this.container.className = 'app-header-zone';
        const header = document.querySelector('.header-container');
        if (header) {
          header.appendChild(this.container);
        } else {
          document.body.insertBefore(this.container, document.body.firstChild);
        }
      }

      // Listen to window focus events from the EventBus
      if (window.EventBus) {
        window.EventBus.on('window:focus', (data) => {
          if (data && data.appId) {
            this.setActiveApp(data.appId, data);
          }
        });
        window.EventBus.on('window:close', (data) => {
          if (data && data.appId === this.activeAppId) {
            this.restoreDefaultMenu();
          }
        });
      }
    }

    /**
     * Registers a contextual menu renderer for an application
     * @param {string} appId - Identifier (e.g. 'explorer', 'image-viewer', 'video-player')
     * @param {Function} renderFn - Function(container, contextData) that renders or returns HTML
     */
    registerAppMenu(appId, renderFn) {
      this.registeredMenus.set(appId, renderFn);
      if (this.activeAppId === appId) {
        this.renderMenu(appId);
      }
    }

    /**
     * Sets the default fallback menu renderer (e.g. Explorer)
     */
    setDefaultMenu(renderFn) {
      this.defaultMenuRenderer = renderFn;
      if (!this.activeAppId) {
        this.restoreDefaultMenu();
      }
    }

    /**
     * Switches the active application colonizing the menu bar
     */
    setActiveApp(appId, contextData = {}) {
      this.activeAppId = appId;
      this.renderMenu(appId, contextData);
    }

    /**
     * Restores default menu (Empty clean desktop bar when no windows are open)
     */
    restoreDefaultMenu() {
      this.activeAppId = null;
      if (this.container) {
        this.container.innerHTML = '';
        if (typeof this.defaultMenuRenderer === 'function') {
          this.defaultMenuRenderer(this.container);
        }
      }
    }

    /**
     * Renders the menu bar for the active application
     */
    renderMenu(appId, contextData = {}) {
      if (!this.container) this.init('appHeaderZone');
      if (!this.container) return;
      this.container.innerHTML = '';

      const renderer = this.registeredMenus.get(appId) || this.defaultMenuRenderer;
      if (typeof renderer === 'function') {
        const result = renderer(this.container, contextData);
        if (typeof result === 'string') {
          this.container.innerHTML = result;
        }
      }
    }
  }

  window.MenuBarManager = new MenuBarManager();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.MenuBarManager.init('appHeaderZone'));
  } else {
    window.MenuBarManager.init('appHeaderZone');
  }
})(window);
