/**
 * WebOSApp - Standard Base Classes for WebOS Applications
 * SimpleGallery WebOS Userland Core: WebOSApp, WebOSMediaApp, WebOSGameApp
 */
(function (window, document) {
  'use strict';

  /**
   * Base Application Class
   */
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
      this._state = config.state || {};

      // Event Bus Subscriptions
      this.eventUnsubscribers = [];
      if (window.EventBus || (window.sys && window.sys.events)) {
        const bus = window.EventBus || window.sys.events;
        this.eventUnsubscribers.push(bus.on('locale:changed', (data) => this._handleLocaleChange(data)));
        this.eventUnsubscribers.push(bus.on('theme:changed', (data) => this.onThemeChanged(data?.theme || data)));
      }

      // Defer onInit so derived class constructor finishes execution first
      queueMicrotask(() => this.onInit());
    }

    get state() {
      return this._state;
    }

    set state(val) {
      this._state = val;
    }

    /**
     * Subscribe to EventBus event with automatic cleanup on window close (Point 3)
     * @param {string} event 
     * @param {Function} callback 
     * @returns {Function} Unsubscribe callback
     */
    subscribe(event, callback) {
      const bus = window.EventBus || (window.sys && window.sys.events);
      if (bus && typeof bus.on === 'function') {
        const unsub = bus.on(event, callback);
        if (typeof unsub === 'function') {
          this.eventUnsubscribers.push(unsub);
        }
        return unsub;
      }
      return () => {};
    }

    /**
     * Namespaced per-app storage engine (Point 4)
     */
    get storage() {
      if (window.sys && window.sys.storage && typeof window.sys.storage.forApp === 'function') {
        return window.sys.storage.forApp(this.id);
      }
      const self = this;
      return {
        get: (k, d = null) => {
          try {
            const raw = localStorage.getItem(`webos_app_${self.id}_${k}`);
            return raw !== null ? JSON.parse(raw) : d;
          } catch(e) { return d; }
        },
        set: (k, v) => {
          try {
            localStorage.setItem(`webos_app_${self.id}_${k}`, JSON.stringify(v));
            return true;
          } catch(e) { return false; }
        },
        remove: (k) => {
          try { localStorage.removeItem(`webos_app_${self.id}_${k}`); } catch(e) {}
        }
      };
    }

    /**
     * Check if current user has administrator privileges
     * @returns {boolean}
     */
    get isAdmin() {
      return (window.desktop && window.desktop.state && window.desktop.state.isAdmin) || window.IS_ADMIN || false;
    }

    /**
     * API Client Helper (window.sys.api wrapper)
     */
    get api() {
      if (window.sys && window.sys.api) {
        return window.sys.api;
      }
      return {
        get: (action, params = {}) => {
          const query = new URLSearchParams({ action, ...params }).toString();
          return fetch(`system/endpoints/api.php?${query}`)
            .then(r => r.text())
            .then(text => {
              try { return JSON.parse(text); } catch (e) { return { success: false, error: text || 'Invalid JSON' }; }
            })
            .catch(err => ({ success: false, error: err.message }));
        },
        post: (action, payload = {}) => {
          const csrf = window.CSRF_TOKEN || (window.desktop && window.desktop.state && window.desktop.state.csrfToken) || '';
          return fetch('system/endpoints/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({ action, csrf_token: csrf, ...payload })
          })
            .then(r => r.text())
            .then(text => {
              try { return JSON.parse(text); } catch (e) { return { success: false, error: text || 'Invalid JSON' }; }
            })
            .catch(err => ({ success: false, error: err.message }));
        }
      };
    }

    /**
     * Toast notifications helper
     */
    get toast() {
      if (window.sys && window.sys.toast) return window.sys.toast;
      if (window.sys && window.sys.ui && window.sys.ui.toast) return window.sys.ui.toast;
      return {
        info: (msg) => console.log('[Toast Info]', msg),
        success: (msg) => console.log('[Toast Success]', msg),
        warning: (msg) => console.warn('[Toast Warning]', msg),
        error: (msg) => console.error('[Toast Error]', msg)
      };
    }

    /**
     * Modal dialog helper (alert, confirm, prompt)
     */
    get dialog() {
      if (window.sys && window.sys.dialog) return window.sys.dialog;
      if (window.sys && window.sys.ui) {
        return {
          alert: (opts) => typeof opts === 'object' ? window.sys.ui.alertDialog(opts) : window.sys.ui.alertDialog({ message: opts }),
          confirm: (opts) => {
            if (typeof opts === 'object') {
              return window.sys.ui.confirmDialog(opts).then(confirmed => {
                if (confirmed && typeof opts.onConfirm === 'function') opts.onConfirm();
                if (!confirmed && typeof opts.onCancel === 'function') opts.onCancel();
                return confirmed;
              });
            }
            return window.sys.ui.confirmDialog({ message: opts });
          },
          prompt: (opts) => typeof opts === 'object' ? window.sys.ui.promptDialog(opts) : window.sys.ui.promptDialog({ message: opts })
        };
      }
      return {
        alert: (opts) => window.alert(typeof opts === 'object' ? (opts.message || opts.title) : opts),
        confirm: (opts) => {
          const res = window.confirm(typeof opts === 'object' ? (opts.message || opts.title) : opts);
          if (res && typeof opts?.onConfirm === 'function') opts.onConfirm();
          if (!res && typeof opts?.onCancel === 'function') opts.onCancel();
          return Promise.resolve(res);
        },
        prompt: (opts) => Promise.resolve(window.prompt(typeof opts === 'object' ? opts.message : opts))
      };
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
    open(params) {
      const tab = (params && typeof params === 'string') ? params : (params?.tab);
      if (tab && typeof tab === 'string' && this.tabs.some(t => t.id === tab)) {
        this.currentTab = tab;
      }

      if (this.window && window.WindowManager && window.WindowManager.windows.has(this.window.id)) {
        window.WindowManager.focusWindow(this.window.id);
        if (tab && typeof tab === 'string') this.switchTab(tab);
        this.onOpen(params);
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
        content: this.renderShell(),
        onFocus: () => this.onFocus(),
        onBlur: () => this.onBlur(),
        onClose: () => {
          if (!this._isClosing) {
            return this.close();
          }
        }
      });

      this.bindShellEvents();
      this.registerMenuBar();
      this.onOpen(params);
      this.render();
    }

    /**
     * Close application window
     */
    close() {
      if (this._isClosing) return true;
      this._isClosing = true;

      const winId = this.window ? this.window.id : null;
      this.window = null;

      if (winId && window.WindowManager && window.WindowManager.windows.has(winId)) {
        window.WindowManager.closeWindow(winId);
      }

      this.eventUnsubscribers.forEach(unsub => typeof unsub === 'function' && unsub());
      this.onClose();
      this._isClosing = false;
      return true;
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

    _handleLocaleChange() {
      if (this.window && window.WindowManager) {
        window.WindowManager.setTitle(this.window.id, this.title);
      }
      this.onLocaleChanged();
      this.render();
    }

    // Subclass Lifecycle Hooks
    onInit() {}
    onOpen(params) {}
    onClose() {}
    onFocus() {}
    onBlur() {}
    bindEvents(container) {}
    onRender(container) {}
    onLocaleChanged() {}
    onThemeChanged(themeName) {}
    renderTab(tabId) { return ''; }
    renderContent() { return ''; }
  }

  /**
   * Base Class for Media & Document Applications (Filesystem-driven apps)
   */
  class WebOSMediaApp extends WebOSApp {
    constructor(config = {}) {
      super(config);
      this.filePath = null;
      this.fileName = '';
      this.isDirty = false;
    }

    get title() {
      const baseTitle = super.title;
      if (this.fileName) {
        return `${this.fileName}${this.isDirty ? ' *' : ''} - ${baseTitle}`;
      }
      return baseTitle;
    }

    open(params) {
      if (typeof params === 'string') {
        this.filePath = params;
        this.fileName = params.split('/').pop() || params;
      } else if (params && params.file) {
        this.filePath = params.file;
        this.fileName = params.file.split('/').pop() || params.file;
      }
      super.open(params);
      if (this.filePath) {
        this.onFileOpened(this.filePath);
      }
    }

    setDirty(dirty = true) {
      this.isDirty = !!dirty;
      if (this.window && window.WindowManager) {
        window.WindowManager.setTitle(this.window.id, this.title);
      }
    }

    close() {
      if (this.isDirty) {
        const confirmMsg = this.t('dialog.unsaved_changes_confirm', 'Modifications non enregistrées. Fermer tout de même ?');
        if (window.sys && window.sys.dialog) {
          window.sys.dialog.confirm(confirmMsg, this.t('dialog.warning'), true).then(confirmed => {
            if (confirmed) {
              this.isDirty = false;
              super.close();
            }
          });
          return false;
        }
      }
      return super.close();
    }

    saveContent(content) {
      if (!this.filePath) return Promise.reject(new Error('No file path set'));
      if (window.sys && window.sys.fs) {
        return window.sys.fs.saveTextFile(this.filePath, content).then(res => {
          if (res && res.success) {
            this.setDirty(false);
            this.toast.success(this.t('doc.saved_success', 'Fichier enregistré avec succès'));
          } else {
            this.toast.error(res?.error || this.t('doc.save_error', 'Erreur de sauvegarde'));
          }
          return res;
        });
      }
      return Promise.reject(new Error('Filesystem service not available'));
    }

    onFileOpened(filePath) {}
  }

  /**
   * Base Class for Arcade Games (Canvas / Loop-driven apps)
   */
  class WebOSGameApp extends WebOSApp {
    constructor(config = {}) {
      super(config);
      this.sound = (window.sys && window.sys.audio) || null;
      this.score = 0;
      this.highScore = this.loadHighScore();
      this.isRunning = false;
      this.isPaused = false;
      this.animFrameId = null;
    }

    loadHighScore() {
      return (window.sys && window.sys.storage) ? window.sys.storage.get(this.id, 'high_score', 0) : 0;
    }

    saveHighScore(val) {
      if (val > this.highScore) {
        this.highScore = val;
        if (window.sys && window.sys.storage) {
          window.sys.storage.set(this.id, 'high_score', val);
        }
      }
    }

    startGame() {
      this.isRunning = true;
      this.isPaused = false;
      this.onGameStart();
    }

    pauseGame() {
      if (!this.isRunning || this.isPaused) return;
      this.isPaused = true;
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.onGamePause();
    }

    resumeGame() {
      if (!this.isRunning || !this.isPaused) return;
      this.isPaused = false;
      this.onGameResume();
    }

    stopGame() {
      this.isRunning = false;
      this.isPaused = false;
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.onGameStop();
    }

    onBlur() {
      if (this.isRunning && !this.isPaused) {
        this.pauseGame();
      }
    }

    onClose() {
      this.stopGame();
    }

    onGameStart() {}
    onGamePause() {}
    onGameResume() {}
    onGameStop() {}
  }

  window.WebOSApp = WebOSApp;
  window.WebOSMediaApp = WebOSMediaApp;
  window.WebOSGameApp = WebOSGameApp;

  window.sys = window.sys || {};
  window.sys.App = WebOSApp;
  window.sys.MediaApp = WebOSMediaApp;
  window.sys.GameApp = WebOSGameApp;
})(window, document);
