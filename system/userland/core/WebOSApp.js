/**
 * WebOSApp - Standard Base Class for WebOS Applications
 * SimpleGallery WebOS Userland Core
 */
(function (window, document) {
  'use strict';

  class WebOSApp {
    /**
     * @param {Object} config
     * @param {string} config.id Unique application identifier
     * @param {string} config.title Title or i18n key (e.g. 'apps.my_app.title')
     * @param {string} [config.icon] App icon emoji or image URL
     * @param {number} [config.width] Default window width (default: 840)
     * @param {number} [config.height] Default window height (default: 600)
     * @param {boolean} [config.resizable] Whether window can be resized (default: true)
     * @param {Array<{id: string, label: string, icon?: string}>} [config.tabs] List of tabs
     */
    constructor(config = {}) {
      if (!config.id) throw new Error('[WebOSApp] Application ID is required');

      this.id = config.id;
      this.rawTitle = config.title || config.id;
      this.icon = config.icon || '📱';
      this.width = config.width || 840;
      this.height = config.height || 600;
      this.resizable = config.resizable !== false;
      this.tabs = config.tabs || [];
      this.currentTab = (this.tabs.length > 0) ? this.tabs[0].id : null;
      this.window = null;

      this.onInit();
    }

    /**
     * Translation helper with automatic fallback to key
     */
    t(key, replacements) {
      const i18n = (window.sys && window.sys.i18n) || window.I18nEngine;
      if (i18n && typeof i18n.t === 'function') {
        return i18n.t(key, replacements);
      }
      return key;
    }

    /**
     * HTML Escaping Helper
     */
    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /**
     * Resolved window title string
     */
    get title() {
      if (typeof this.rawTitle === 'string' && this.rawTitle.includes('.')) {
        return this.t(this.rawTitle);
      }
      return this.rawTitle;
    }

    /**
     * Open or focus application window
     */
    open() {
      if (this.window && window.WindowManager && window.WindowManager.windows.has(this.window.id)) {
        window.WindowManager.focusWindow(this.window.id);
        return;
      }

      if (!window.WindowManager) {
        console.error('[WebOSApp] WindowManager not available');
        return;
      }

      this.window = window.WindowManager.createWindow({
        appId: this.id,
        title: this.title,
        icon: this.icon,
        width: this.width,
        height: this.height,
        resizable: this.resizable,
        content: this.renderShell()
      });

      this.bindShellEvents();
      this.registerMenuBar();
      this.onOpen();
      this.render();
    }

    /**
     * Close application window
     */
    close() {
      if (this.window && window.WindowManager) {
        window.WindowManager.closeWindow(this.window.id);
      }
      this.window = null;
      this.onClose();
    }

    /**
     * Register app in global top MenuBar
     */
    registerMenuBar() {
      if (window.MenuBarManager) {
        window.MenuBarManager.setActiveApp(this.id);
      }
    }

    /**
     * Render the application shell (Header with tabs + Body container)
     */
    renderShell() {
      const tabsHtml = (this.tabs.length > 0) ? `
        <div class="webos-tabs-nav" id="${this.id}TabNav" style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:8px;">
            ${this.tabs.map(t => `
              <button type="button" class="webos-tab-item ${t.id === this.currentTab ? 'active' : ''}" data-tab="${t.id}">
                ${t.icon ? `<span>${t.icon}</span>` : ''}
                <span>${this.escapeHtml(this.t(t.label))}</span>
              </button>
            `).join('')}
          </div>
          ${this.renderHeaderExtra() || ''}
        </div>
      ` : '';

      return `
        <div class="webos-app-shell" id="${this.id}AppContainer" style="display:flex; flex-direction:column; height:100%; padding:16px; box-sizing:border-box; overflow:hidden;">
          ${tabsHtml}
          <div class="webos-app-body" id="${this.id}BodyContent" style="flex:1; overflow-y:auto;"></div>
        </div>
      `;
    }

    renderHeaderExtra() {
      return '';
    }

    /**
     * Bind shell tab events
     */
    bindShellEvents() {
      const container = document.getElementById(`${this.id}AppContainer`);
      if (!container) return;

      if (window.sys && window.sys.ui && window.sys.ui.bindActions) {
        window.sys.ui.bindActions(container, {
          'click [data-tab]': (btn) => {
            const tabId = btn.dataset.tab;
            if (tabId) this.switchTab(tabId);
          }
        });
      }
    }

    /**
     * Switch active tab
     */
    switchTab(tabId) {
      this.currentTab = tabId;
      const nav = document.getElementById(`${this.id}TabNav`);
      if (nav) {
        nav.querySelectorAll('.webos-tab-item').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
      }
      this.render();
    }

    /**
     * Render main content
     */
    render() {
      const container = document.getElementById(`${this.id}AppContainer`);
      const bodyEl = document.getElementById(`${this.id}BodyContent`);
      if (!bodyEl) return;

      if (this.currentTab) {
        bodyEl.innerHTML = this.renderTab(this.currentTab) || '';
      } else {
        bodyEl.innerHTML = this.renderContent() || '';
      }

      const scope = container || bodyEl;
      this.bindEvents(scope);
      this.onRender(scope);
    }

    // Subclass Lifecycle Hooks
    onInit() {}
    onOpen() {}
    onClose() {}
    bindEvents(container) {}
    onRender(container) {}
    renderTab(tabId) { return ''; }
    renderContent() { return ''; }
  }

  window.WebOSApp = WebOSApp;
  window.sys = window.sys || {};
  window.sys.App = WebOSApp;
})(window, document);
