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
     * Registers a contextual menu renderer or menu definition list for an application
     * @param {string} appId - Identifier (e.g. 'explorer', 'template-app')
     * @param {Function|Array} menuDef - Function(container, contextData) or array of menu definitions
     */
    registerAppMenu(appId, menuDef) {
      this.registeredMenus.set(appId, menuDef);
      if (this.activeAppId === appId) {
        this.renderMenu(appId);
      }
    }

    registerAppMenus(appId, menuDef) {
      this.registerAppMenu(appId, menuDef);
    }

    registerMenu(appId, menuDef) {
      this.registerAppMenu(appId, menuDef);
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

      const menuDef = this.registeredMenus.get(appId) || this.defaultMenuRenderer;
      if (!menuDef) return;

      if (typeof menuDef === 'function') {
        const result = menuDef(this.container, contextData);
        if (typeof result === 'string') {
          this.container.innerHTML = result;
        }
        return;
      }

      // Declarative array of menus
      if (Array.isArray(menuDef)) {
        const nav = document.createElement('nav');
        nav.className = 'webos-menubar-nav';
        nav.style.cssText = 'display:flex; align-items:center; gap:4px; height:100%;';

        menuDef.forEach((menu) => {
          const menuWrapper = document.createElement('div');
          menuWrapper.className = 'webos-menu-item-wrapper';
          menuWrapper.style.cssText = 'position:relative;';

          const btn = document.createElement('button');
          btn.className = 'webos-menubar-btn';
          btn.textContent = menu.label || menu.id;
          btn.style.cssText = 'background:none; border:none; color:inherit; font-size:0.85rem; font-weight:500; padding:4px 10px; border-radius:6px; cursor:pointer; transition:background 0.15s;';
          btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.1)');
          btn.addEventListener('mouseleave', () => { if (!menuWrapper.classList.contains('open')) btn.style.background = 'none'; });

          const dropdown = document.createElement('div');
          dropdown.className = 'webos-menubar-dropdown';
          dropdown.style.cssText = 'display:none; position:absolute; top:calc(100% + 4px); left:0; min-width:180px; background:var(--bg-panel, #1e293b); border:1px solid rgba(255,255,255,0.1); border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.4); padding:6px; z-index:10000; flex-direction:column; gap:2px;';

          if (Array.isArray(menu.items)) {
            menu.items.forEach((item) => {
              if (item.separator) {
                const sep = document.createElement('div');
                sep.style.cssText = 'height:1px; background:rgba(255,255,255,0.1); margin:4px 0;';
                dropdown.appendChild(sep);
              } else {
                const itemBtn = document.createElement('button');
                itemBtn.className = 'webos-dropdown-item';
                itemBtn.textContent = item.label || item.id;
                itemBtn.style.cssText = 'display:flex; align-items:center; width:100%; text-align:left; background:none; border:none; color:inherit; font-size:0.82rem; padding:6px 10px; border-radius:5px; cursor:pointer;';
                itemBtn.addEventListener('mouseenter', () => itemBtn.style.background = 'rgba(255,255,255,0.1)');
                itemBtn.addEventListener('mouseleave', () => itemBtn.style.background = 'none');
                itemBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  dropdown.style.display = 'none';
                  menuWrapper.classList.remove('open');
                  btn.style.background = 'none';
                  if (typeof item.action === 'function') item.action();
                });
                dropdown.appendChild(itemBtn);
              }
            });
          }

          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display === 'flex';
            document.querySelectorAll('.webos-menubar-dropdown').forEach(d => d.style.display = 'none');
            document.querySelectorAll('.webos-menu-item-wrapper').forEach(w => w.classList.remove('open'));
            if (!isOpen) {
              dropdown.style.display = 'flex';
              menuWrapper.classList.add('open');
              btn.style.background = 'rgba(255,255,255,0.15)';
            }
          });

          menuWrapper.appendChild(btn);
          menuWrapper.appendChild(dropdown);
          nav.appendChild(menuWrapper);
        });

        document.addEventListener('click', () => {
          document.querySelectorAll('.webos-menubar-dropdown').forEach(d => d.style.display = 'none');
          document.querySelectorAll('.webos-menu-item-wrapper').forEach(w => w.classList.remove('open'));
        }, { once: false });

        this.container.appendChild(nav);
      }
    }
  }

  window.MenuBarManager = new MenuBarManager();
  window.sys = window.sys || {};
  window.sys.menuBar = window.MenuBarManager;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.MenuBarManager.init('appHeaderZone'));
  } else {
    window.MenuBarManager.init('appHeaderZone');
  }
})(window);
