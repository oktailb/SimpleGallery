/**
 * SimpleGallery 2026 - WebOS Desktop Host Kernel (js/gallery.js)
 * Minimal desktop shell responsible for system runtime initialization:
 * - WindowManager, MenuBarManager, AppManager, SyscallClient, I18nEngine.
 * - System Tray controls (Language switcher, Admin authentication, Cookie settings).
 * - Global wallpaper, themes and toast notification infrastructure.
 * - Mounting and orchestrating semi-autonomous applications (apps/explorer, apps/video-player, etc.).
 */
(function(window) {
  'use strict';

  // Automatically keep browser address bar URL clean (hide ?dir= and query parameters)
  try {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  } catch (e) {}

  class WebOSDesktop {
    constructor() {
      this.state = {
        currentLocale: 'fr',
        availableLocales: {},
        translations: {},
        translationsCache: {},
        isAdmin: false,
        csrfToken: ''
      };

      if (window.WindowManager) window.WindowManager.init();
      if (window.MenuBarManager) window.MenuBarManager.init('appHeaderZone');

      this.initElements();
      this.initI18n();
      this.initAdmin();
      this.initCookieConsent();
      this.initAppLauncher();
      this.initDesktopShortcuts();
      this.initAutostartApps();
    }

    initAutostartApps() {
      const cfg = window.SG_AUTOSTART_CONFIG || { enabled: true, apps: [{ appId: 'explorer', state: 'maximized', enabled: true }] };
      if (cfg.enabled === false) return;
      const apps = cfg.apps || [];

      apps.forEach((item, index) => {
        if (!item.enabled) return;
        const targetState = item.state || 'normal';
        setTimeout(() => {
          if (item.appId === 'explorer') {
            if (window.explorerApp && typeof window.explorerApp.open === 'function') {
              window.explorerApp.open({ state: targetState });
            }
          } else {
            if (window.sys && window.sys.appManager && typeof window.sys.appManager.launchApp === 'function') {
              window.sys.appManager.launchApp(item.appId, { state: targetState });
            }
          }
        }, 50 + (index * 60));
      });
    }

    initElements() {
      this.el = {
        webosDesktop: document.getElementById('webosDesktop'),
        appLauncherBtn: document.getElementById('appLauncherBtn'),
        appLauncherMenu: document.getElementById('appLauncherMenu'),
        appLauncherList: document.getElementById('appLauncherList'),
        desktopSurface: document.getElementById('desktopSurface'),
        desktopShortcuts: document.getElementById('desktopShortcuts'),
        langSelectorContainer: document.getElementById('langSelectorContainer'),
        langSelectorBtn: document.getElementById('langSelectorBtn'),
        langDropdownMenu: document.getElementById('langDropdownMenu'),
        currentLangFlag: document.getElementById('currentLangFlag'),
        currentLangCode: document.getElementById('currentLangCode'),
        adminBtn: document.getElementById('adminBtn'),
        adminModal: document.getElementById('adminModal'),
        adminModalCloseBtn: document.getElementById('adminModalCloseBtn'),
        adminLoginForm: document.getElementById('adminLoginForm'),
        adminPasswordInput: document.getElementById('adminPasswordInput'),
        adminLoginError: document.getElementById('adminLoginError'),
        adminLoginState: document.getElementById('adminLoginState'),
        adminActiveState: document.getElementById('adminActiveState'),
        adminLogoutBtn: document.getElementById('adminLogoutBtn'),
        changePasswordForm: document.getElementById('changePasswordForm'),
        newAdminPasswordInput: document.getElementById('newAdminPasswordInput'),
        adminChangePassMsg: document.getElementById('adminChangePassMsg'),
        folderDescBanner: document.getElementById('folderDescBanner'),
        loadingState: document.getElementById('loadingState'),
        toastContainer: document.getElementById('toastContainer')
      };
    }

    // -------------------------------------------------------------
    // I18N / LOCALIZATION ENGINE & SYSTEM TRAY
    // -------------------------------------------------------------
    initI18n() {
      let initialConfig = window.SG_I18N_CONFIG;
      if (!initialConfig) {
        const payloadEl = document.getElementById('initialLocalesConfig');
        if (payloadEl && payloadEl.textContent) {
          try {
            initialConfig = JSON.parse(payloadEl.textContent);
          } catch (e) {}
        }
      }
      if (!initialConfig) initialConfig = {};

      this.state.availableLocales = initialConfig.locales || {
        fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
        en: { code: 'en', name: 'English', flag: '🇬🇧' },
        ja: { code: 'ja', name: '日本語', flag: '🇯🇵' }
      };
      this.state.currentLocale = initialConfig.default || document.documentElement.lang || 'fr';
      this.state.translations = initialConfig.translations || {};
      this.state.translationsCache[this.state.currentLocale] = this.state.translations;

      if (window.I18nEngine) {
        window.I18nEngine.setTranslations(this.state.currentLocale, this.state.translations);
      }

      let storedLocale = null;
      try {
        storedLocale = localStorage.getItem('sg_locale');
      } catch (e) {}

      if (storedLocale && storedLocale !== this.state.currentLocale) {
        this.setLocale(storedLocale);
      } else {
        this.finishLocaleChange(this.state.currentLocale);
      }

      const langBtn = document.getElementById('langSelectorBtn') || this.el.langSelectorBtn;
      if (langBtn) {
        langBtn.onclick = (e) => {
          e.stopPropagation();
          this.toggleLangDropdown();
        };
      }

      document.querySelectorAll('.lang-option-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const targetLang = btn.dataset.lang;
          if (targetLang) {
            this.setLocale(targetLang);
            this.closeLangDropdown();
          }
        };
      });

      document.addEventListener('click', (e) => {
        const container = document.getElementById('langSelectorContainer') || this.el.langSelectorContainer;
        if (container && !container.contains(e.target)) {
          this.closeLangDropdown();
        }
      });
    }

    toggleLangDropdown() {
      const menu = document.getElementById('langDropdownMenu') || this.el.langDropdownMenu;
      if (!menu) return;
      const isVisible = menu.style.display === 'flex';
      menu.style.display = isVisible ? 'none' : 'flex';
    }

    closeLangDropdown() {
      const menu = document.getElementById('langDropdownMenu') || this.el.langDropdownMenu;
      if (menu) menu.style.display = 'none';
    }

    t(key, replacements = {}) {
      let str = (this.state && this.state.translations && this.state.translations[key]) 
        ? this.state.translations[key] 
        : (window.I18nEngine && window.I18nEngine.translations && window.I18nEngine.translations[key])
        ? window.I18nEngine.translations[key]
        : key;

      if (typeof str === 'string' && replacements && typeof replacements === 'object') {
        Object.entries(replacements).forEach(([k, val]) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), val);
        });
      }
      return str;
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    async setLocale(code) {
      if (!code) return;
      this.state.currentLocale = code;

      if (this.state.translationsCache[code]) {
        this.state.translations = this.state.translationsCache[code];
        if (window.I18nEngine) {
          window.I18nEngine.setTranslations(code, this.state.translations);
        }
        this.finishLocaleChange(code);
      } else {
        try {
          const res = await fetch(`api.php?action=get_locale&code=${encodeURIComponent(code)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.translations) {
              this.state.translations = json.translations;
              this.state.translationsCache[code] = this.state.translations;
            }
          } else {
            const directRes = await fetch(`locales/${encodeURIComponent(code)}.json?t=${Date.now()}`);
            if (directRes.ok) {
              const directJson = await directRes.json();
              this.state.translations = directJson.translations || directJson;
              this.state.translationsCache[code] = this.state.translations;
            }
          }
        } catch (e) {
          console.error('[i18n] Failed to load locale:', code, e);
        }

        if (window.I18nEngine) {
          window.I18nEngine.setTranslations(code, this.state.translations);
        }
        this.finishLocaleChange(code);
      }
    }

    finishLocaleChange(code) {
      try {
        localStorage.setItem('sg_locale', code);
      } catch (e) {}

      document.documentElement.lang = code;

      const meta = this.state.availableLocales[code];
      const flagEl = document.getElementById('currentLangFlag');
      const codeEl = document.getElementById('currentLangCode');

      if (meta) {
        if (flagEl) flagEl.innerHTML = meta.flag_svg || meta.flag || '🌐';
        if (codeEl) codeEl.textContent = (meta.code || code).toUpperCase();
      } else {
        if (codeEl) codeEl.textContent = code.toUpperCase();
      }

      document.querySelectorAll('.lang-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === code);
      });

      this.applyTranslations();

      // Emit global locale:changed event across userland event bus
      if (window.sys && window.sys.events) {
        window.sys.events.emit('locale:changed', { code, translations: this.state.translations });
      }

      // Notify WindowManager to refresh all open windows and taskbar labels
      if (window.WindowManager && typeof window.WindowManager.onLocaleChanged === 'function') {
        window.WindowManager.onLocaleChanged(code);
      }

      // Notify running apps of locale change
      if (window.explorerApp) {
        if (typeof window.explorerApp.updateMenuBarForActiveInstance === 'function') {
          window.explorerApp.updateMenuBarForActiveInstance();
        }
        if (window.explorerApp.instances) {
          window.explorerApp.instances.forEach(inst => {
            if (typeof inst.applyFilterAndRender === 'function') {
              inst.applyFilterAndRender();
            }
          });
        }
      }
    }

    applyTranslations() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const trans = this.t(key);
        if (trans && trans !== key) {
          if (trans.includes('<') && trans.includes('>')) {
            el.innerHTML = trans;
          } else {
            el.textContent = trans;
          }
        }
      });

      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        const trans = this.t(key);
        if (trans && trans !== key) el.setAttribute('title', trans);
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const trans = this.t(key);
        if (trans && trans !== key) el.setAttribute('placeholder', trans);
      });

      this.renderDesktopShortcuts();
    }

    // -------------------------------------------------------------
    // APPLICATION LAUNCHER MENU & DESKTOP ICONS
    // -------------------------------------------------------------
    initAppLauncher() {
      const btn = this.el.appLauncherBtn || document.getElementById('appLauncherBtn');
      const menu = this.el.appLauncherMenu || document.getElementById('appLauncherMenu');
      if (!btn || !menu) return;

      btn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display !== 'none';
        if (isOpen) {
          this.closeAppLauncher();
        } else {
          this.renderAppLauncherMenu();
          menu.style.display = 'flex';
          btn.classList.add('active');
        }
      };

      document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
          this.closeAppLauncher();
        }
      });
    }

    closeAppLauncher() {
      const menu = this.el.appLauncherMenu || document.getElementById('appLauncherMenu');
      const btn = this.el.appLauncherBtn || document.getElementById('appLauncherBtn');
      this.closeFlyoutSubmenu();
      if (menu) menu.style.display = 'none';
      if (btn) btn.classList.remove('active');
    }

    closeFlyoutSubmenu() {
      const flyout = document.getElementById('appLauncherFlyoutSubmenu');
      if (flyout && flyout.parentNode) {
        flyout.parentNode.removeChild(flyout);
      }
      const activeRows = document.querySelectorAll('.app-launcher-cat-row.active');
      activeRows.forEach(r => r.classList.remove('active'));
    }

    renderAppLauncherMenu() {
      const menuEl = this.el.appLauncherMenu || document.getElementById('appLauncherMenu');
      const listEl = this.el.appLauncherList || document.getElementById('appLauncherList');
      if (!menuEl || !listEl) return;

      const appMgr = window.sys && window.sys.appManager;
      const allApps = appMgr ? appMgr.getAllApps() : [];

      if (!allApps || allApps.length === 0) {
        listEl.innerHTML = `<div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">Aucune application enregistrée</div>`;
        return;
      }

      // Add search input if not present
      let searchBox = menuEl.querySelector('.app-launcher-search-box');
      if (!searchBox) {
        searchBox = document.createElement('div');
        searchBox.className = 'app-launcher-search-box';
        searchBox.innerHTML = `
          <span class="app-launcher-search-icon">🔍</span>
          <input type="text" class="app-launcher-search-input" placeholder="${this.escapeHtml(this.t('nav.search_apps') || 'Rechercher une application...')}" />
        `;
        menuEl.insertBefore(searchBox, listEl);

        const input = searchBox.querySelector('.app-launcher-search-input');
        input.oninput = (e) => {
          this.filterAppLauncher(e.target.value.trim().toLowerCase());
        };
        input.onclick = (e) => e.stopPropagation();
      }

      this._allLauncherApps = allApps;
      this.populateAppLauncherCategories(allApps, listEl, appMgr, false);
    }

    filterAppLauncher(query) {
      const listEl = this.el.appLauncherList || document.getElementById('appLauncherList');
      const appMgr = window.sys && window.sys.appManager;
      if (!listEl || !this._allLauncherApps) return;

      this.closeFlyoutSubmenu();

      if (!query) {
        this.populateAppLauncherCategories(this._allLauncherApps, listEl, appMgr, false);
        return;
      }

      const filtered = this._allLauncherApps.filter(a => 
        (a.name || '').toLowerCase().includes(query) || 
        (a.description || '').toLowerCase().includes(query) || 
        (a.id || '').toLowerCase().includes(query) || 
        (a.category || '').toLowerCase().includes(query)
      );

      this.populateAppLauncherCategories(filtered, listEl, appMgr, true);
    }

    getCategoryDisplayInfo(catKey) {
      if (!catKey) {
        return {
          id: '',
          icon: '📁',
          label: this.t('categories.root') || this.t('nav.apps_menu') || 'Applications'
        };
      }

      const transKey = `categories.${catKey}`;
      let trans = this.t(transKey);
      if (!trans || trans === transKey) {
        const altKey = catKey.endsWith('s') ? catKey.slice(0, -1) : `${catKey}s`;
        const altTrans = this.t(`categories.${altKey}`);
        if (altTrans && altTrans !== `categories.${altKey}`) {
          trans = altTrans;
        }
      }

      const iconMap = {
        games: '🎮',
        game: '🎮',
        system: '⚙️',
        media: '🎬',
        viewer: '🖼️',
        player: '🎵',
        utility: '🛠️',
        utilities: '🛠️',
        tools: '🛠️',
        productivity: '📂',
        communication: '💬',
        office: '📑',
        view: '👁️'
      };

      const defaultIcon = iconMap[catKey.toLowerCase()] || '📁';

      if (trans && trans !== transKey) {
        const emojiMatch = trans.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEF6])\s*/u);
        if (emojiMatch) {
          const icon = emojiMatch[1];
          const label = trans.slice(emojiMatch[0].length);
          return { id: catKey, icon, label };
        }
        return { id: catKey, icon: defaultIcon, label: trans };
      }

      const formattedName = catKey.charAt(0).toUpperCase() + catKey.slice(1);
      return {
        id: catKey,
        icon: defaultIcon,
        label: formattedName
      };
    }

    populateAppLauncherCategories(apps, listEl, appMgr, isFiltered) {
      if (!apps || apps.length === 0) {
        listEl.innerHTML = `<div style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted); text-align: center;">Aucun résultat trouvé</div>`;
        return;
      }

      // If filtered via search, show flat list of matching items with category tag
      if (isFiltered) {
        listEl.innerHTML = apps.map(app => `
          <button type="button" class="app-launcher-item" data-app-id="${this.escapeHtml(app.id)}" draggable="true">
            <span class="app-launcher-icon">${app.icon || '🗔'}</span>
            <div class="app-launcher-info">
              <span class="app-launcher-name">${this.escapeHtml(app.name)}</span>
              <span class="app-launcher-desc">${this.escapeHtml(app.description || '')}</span>
            </div>
            ${app.category ? `<span class="app-launcher-cat-count">${this.escapeHtml(app.category)}</span>` : ''}
          </button>
        `).join('');

        this.bindAppLauncherItemEvents(listEl, apps, appMgr);
        return;
      }

      // Group apps by category
      const groups = new Map();
      apps.forEach(app => {
        const cat = (app.category || '').trim();
        if (!groups.has(cat)) {
          groups.set(cat, []);
        }
        groups.get(cat).push(app);
      });

      // Distinct named categories vs root
      const namedCatKeys = Array.from(groups.keys()).filter(k => k !== '').sort();
      const rootApps = groups.get('') || [];

      let html = '';

      // 1. Render Category Rows with Flyout Submenus
      namedCatKeys.forEach(catKey => {
        const catApps = groups.get(catKey);
        const catInfo = this.getCategoryDisplayInfo(catKey);
        html += `
          <button type="button" class="app-launcher-cat-row" data-category="${this.escapeHtml(catKey)}">
            <div class="app-launcher-cat-left">
              <span style="font-size: 1.15rem;">${catInfo.icon || '📁'}</span>
              <span class="app-launcher-cat-name">${this.escapeHtml(catInfo.label)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="app-launcher-cat-count">${catApps.length}</span>
              <span class="app-launcher-cat-arrow">›</span>
            </div>
          </button>
        `;
      });

      // 2. Render Direct Root Apps if any
      if (rootApps.length > 0) {
        if (namedCatKeys.length > 0) {
          html += `<div style="height: 1px; background: rgba(255,255,255,0.08); margin: 0.3rem 0.2rem;"></div>`;
        }
        rootApps.forEach(app => {
          html += `
            <button type="button" class="app-launcher-item" data-app-id="${this.escapeHtml(app.id)}" draggable="true">
              <span class="app-launcher-icon">${app.icon || '🗔'}</span>
              <div class="app-launcher-info">
                <span class="app-launcher-name">${this.escapeHtml(app.name)}</span>
                <span class="app-launcher-desc">${this.escapeHtml(app.description || '')}</span>
              </div>
            </button>
          `;
        });
      }

      listEl.innerHTML = html;

      // Bind Category Row Hover / Click to Flyout Submenu
      listEl.querySelectorAll('.app-launcher-cat-row').forEach(row => {
        const catKey = row.dataset.category;
        const catApps = groups.get(catKey) || [];
        const catInfo = this.getCategoryDisplayInfo(catKey);

        let flyoutTimer = null;
        row.onmouseenter = () => {
          flyoutTimer = setTimeout(() => {
            this.openFlyoutSubmenu(row, catInfo, catApps, appMgr);
          }, 80);
        };

        row.onmouseleave = (e) => {
          if (flyoutTimer) clearTimeout(flyoutTimer);
          const flyout = document.getElementById('appLauncherFlyoutSubmenu');
          if (flyout && !flyout.contains(e.relatedTarget)) {
            setTimeout(() => {
              if (!this._isHoveringFlyout) this.closeFlyoutSubmenu();
            }, 100);
          }
        };

        row.onclick = (e) => {
          e.stopPropagation();
          this.openFlyoutSubmenu(row, catInfo, catApps, appMgr);
        };
      });

      // Bind Root Items
      this.bindAppLauncherItemEvents(listEl, rootApps, appMgr);
    }

    openFlyoutSubmenu(triggerRow, catInfo, catApps, appMgr) {
      this.closeFlyoutSubmenu();
      triggerRow.classList.add('active');

      const menuEl = this.el.appLauncherMenu || document.getElementById('appLauncherMenu');
      if (!menuEl) return;

      const flyout = document.createElement('div');
      flyout.id = 'appLauncherFlyoutSubmenu';
      flyout.className = 'app-launcher-flyout-submenu';

      const rowRect = triggerRow.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();

      flyout.innerHTML = `
        <div class="app-launcher-flyout-header">${this.escapeHtml(catInfo.label)}</div>
        <div class="app-launcher-flyout-list" style="display: flex; flex-direction: column; gap: 0.2rem;">
          ${catApps.map(app => `
            <button type="button" class="app-launcher-item" data-app-id="${this.escapeHtml(app.id)}" draggable="true">
              <span class="app-launcher-icon">${app.icon || '🗔'}</span>
              <div class="app-launcher-info">
                <span class="app-launcher-name">${this.escapeHtml(app.name)}</span>
                <span class="app-launcher-desc">${this.escapeHtml(app.description || '')}</span>
              </div>
            </button>
          `).join('')}
        </div>
      `;

      // Set vertical positioning relative to category row
      const topOffset = Math.max(0, rowRect.top - menuRect.top - 8);
      flyout.style.top = `${topOffset}px`;

      flyout.onmouseenter = () => {
        this._isHoveringFlyout = true;
      };

      flyout.onmouseleave = () => {
        this._isHoveringFlyout = false;
        this.closeFlyoutSubmenu();
      };

      menuEl.appendChild(flyout);
      this.bindAppLauncherItemEvents(flyout, catApps, appMgr);
    }

    bindAppLauncherItemEvents(containerEl, apps, appMgr) {
      containerEl.querySelectorAll('.app-launcher-item').forEach(item => {
        const appId = item.dataset.appId;
        const app = apps.find(a => a.id === appId) || { id: appId, name: appId, icon: '🗔' };

        item.onclick = (e) => {
          e.stopPropagation();
          this.closeAppLauncher();
          if (appMgr && typeof appMgr.launchApp === 'function') {
            appMgr.launchApp(appId);
          }
        };

        item.ondragstart = (e) => {
          const appData = {
            type: 'app',
            appId: app.id,
            name: app.name,
            defaultName: app.name,
            icon: app.icon || '🗔'
          };
          window.SG_DRAGGING_ITEM_DATA = appData;
          e.dataTransfer.setData('text/plain', JSON.stringify({ appId: app.id }));
          e.dataTransfer.setData('application/json', JSON.stringify({ appId: app.id }));
          e.dataTransfer.setData('application/sg-item', JSON.stringify(appData));
          e.dataTransfer.effectAllowed = 'copy';
          item.classList.add('is-dragging');
        };

        item.ondragend = () => {
          window.SG_DRAGGING_ITEM_DATA = null;
          item.classList.remove('is-dragging');
          this.closeAppLauncher();
        };
      });
    }

    initDesktopShortcuts() {
      try {
        const local = localStorage.getItem('sg_desktop_shortcuts');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            window.SG_DESKTOP_CONFIG = window.SG_DESKTOP_CONFIG || {};
            window.SG_DESKTOP_CONFIG.shortcuts = parsed;
          }
        }
      } catch (e) {}

      this.renderDesktopShortcuts();
      this.initDesktopDropZone();
      this.initDesktopContextMenu();
    }

    renderDesktopShortcuts() {
      const container = this.el.desktopShortcuts || document.getElementById('desktopShortcuts');
      if (!container) return;

      const config = window.SG_DESKTOP_CONFIG || {};
      const shortcuts = (config.shortcuts || []).filter(s => s.enabled !== false);

      if (shortcuts.length === 0) {
        container.innerHTML = '';
        return;
      }

      const appMgr = window.sys && window.sys.appManager;

      container.innerHTML = shortcuts.map(shortcut => {
        const type = shortcut.type || 'app';
        let label = shortcut.name || shortcut.defaultName || shortcut.appId || 'Raccourci';
        if (shortcut.nameKey) {
          const trans = this.t(shortcut.nameKey);
          if (trans && trans !== shortcut.nameKey) label = trans;
        } else if (type === 'app' && appMgr && shortcut.appId) {
          label = appMgr.getAppTitle(shortcut.appId);
        }

        let iconContent = '';
        if (type === 'folder') {
          if (shortcut.cover_url) {
            iconContent = `<img src="${this.escapeHtml(shortcut.cover_url)}" class="desktop-shortcut-thumb" alt="${this.escapeHtml(label)}" /><span class="desktop-shortcut-badge">📁</span>`;
          } else {
            iconContent = shortcut.icon || '📁';
          }
        } else if (type === 'file') {
          if (shortcut.thumb_url) {
            iconContent = `<img src="${this.escapeHtml(shortcut.thumb_url)}" class="desktop-shortcut-thumb" alt="${this.escapeHtml(label)}" />`;
          } else {
            const fallbackIcon = window.IconHelper ? window.IconHelper.getFileIcon(shortcut) : '📄';
            iconContent = shortcut.icon || fallbackIcon;
          }
        } else {
          // App
          iconContent = shortcut.icon || (appMgr && appMgr.getAppIcon ? appMgr.getAppIcon(shortcut.appId) : '🗔');
        }

        return `
          <button type="button" class="desktop-shortcut-card" data-shortcut-id="${this.escapeHtml(shortcut.id)}" data-shortcut-type="${this.escapeHtml(type)}" title="${this.escapeHtml(label)}">
            <div class="desktop-shortcut-icon">${iconContent}</div>
            <span class="desktop-shortcut-label">${this.escapeHtml(label)}</span>
          </button>
        `;
      }).join('');

      container.querySelectorAll('.desktop-shortcut-card').forEach(card => {
        const shortcutId = card.dataset.shortcutId;
        const shortcut = shortcuts.find(s => s.id === shortcutId);
        if (!shortcut) return;

        card.onclick = (e) => {
          e.stopPropagation();
          this.launchDesktopShortcut(shortcut);
        };
      });
    }

    launchDesktopShortcut(shortcut) {
      if (!shortcut) return;
      const type = shortcut.type || 'app';

      if (type === 'folder') {
        if (window.explorerApp && typeof window.explorerApp.open === 'function') {
          window.explorerApp.open({ dir: shortcut.path });
        } else if (window.sys && window.sys.appManager) {
          window.sys.appManager.launchApp('explorer', { dir: shortcut.path });
        }
      } else if (type === 'file') {
        const fileExt = (shortcut.extension || (shortcut.name ? shortcut.name.split('.').pop() : shortcut.path.split('.').pop() || '')).toLowerCase();
        const fileCat = shortcut.category || (window.IconHelper ? window.IconHelper.getCategory({ extension: fileExt }) : '');
        const fileUrl = shortcut.file_url && !shortcut.file_url.includes('api.php?action=view_file')
          ? shortcut.file_url
          : (`thumb.php?file=${encodeURIComponent(shortcut.path)}&raw=1`);
        const thumbUrl = shortcut.thumb_url || (`thumb.php?file=${encodeURIComponent(shortcut.path)}`);

        if (window.MediaViewerRegistry) {
          window.MediaViewerRegistry.open({
            path: shortcut.path,
            name: shortcut.name || shortcut.path.split('/').pop(),
            category: fileCat,
            extension: fileExt,
            thumb_url: thumbUrl,
            file_url: fileUrl,
            size_formatted: shortcut.size_formatted || ''
          });
        }
      } else {
        // App
        const appMgr = window.sys && window.sys.appManager;
        if (appMgr && typeof appMgr.launchApp === 'function') {
          appMgr.launchApp(shortcut.appId);
        }
      }
    }

    initDesktopDropZone() {
      const dropTargets = [
        document.getElementById('desktopSurface'),
        document.getElementById('desktopShortcuts')
      ].filter(Boolean);

      dropTargets.forEach(target => {
        target.addEventListener('dragover', (e) => {
          // Ignore if drag is over a window or taskbar
          if (e.target && (e.target.closest('.webos-window') || e.target.closest('.webos-taskbar'))) {
            return;
          }

          if (e.dataTransfer.types.includes('application/sg-item') || window.SG_DRAGGING_ITEM_DATA || e.dataTransfer.types.includes('application/json')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            const grid = document.getElementById('desktopShortcuts');
            if (grid) grid.classList.add('drag-active');
          }
        });

        target.addEventListener('dragleave', (e) => {
          if (!target.contains(e.relatedTarget)) {
            const grid = document.getElementById('desktopShortcuts');
            if (grid) grid.classList.remove('drag-active');
          }
        });

        target.addEventListener('drop', async (e) => {
          const grid = document.getElementById('desktopShortcuts');
          if (grid) grid.classList.remove('drag-active');

          // Strict isolation: if drop was inside a window, taskbar, or already handled, ignore it
          if (e.defaultPrevented || (e.target && (e.target.closest('.webos-window') || e.target.closest('.webos-taskbar')))) {
            return;
          }

          let rawData = e.dataTransfer.getData('application/sg-item');
          let itemData = null;

          if (rawData) {
            try { itemData = JSON.parse(rawData); } catch (err) {}
          }
          if (!itemData && window.SG_DRAGGING_ITEM_DATA) {
            itemData = window.SG_DRAGGING_ITEM_DATA;
          }

          if (!itemData) {
            // Check fallback JSON paths
            const jsonText = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
            if (jsonText) {
              try {
                const paths = JSON.parse(jsonText);
                if (Array.isArray(paths) && paths.length > 0) {
                  const p = paths[0];
                  itemData = {
                    type: p.includes('.') ? 'file' : 'folder',
                    path: p,
                    name: p.split('/').pop()
                  };
                }
              } catch (err) {}
            }
          }

          if (!itemData || (!itemData.path && !itemData.appId)) return;
          e.preventDefault();
          e.stopPropagation();

          window.SG_DESKTOP_CONFIG = window.SG_DESKTOP_CONFIG || { shortcuts: [] };
          window.SG_DESKTOP_CONFIG.shortcuts = window.SG_DESKTOP_CONFIG.shortcuts || [];

          if (itemData.type === 'app') {
            const exists = window.SG_DESKTOP_CONFIG.shortcuts.some(s => (s.type === 'app' || s.appId) && s.appId === itemData.appId);
            if (exists) {
              this.showToast("Ce raccourci d'application existe déjà sur le bureau", 'info');
              return;
            }

            const newShortcut = {
              id: `sc_app_${itemData.appId}_${Date.now()}`,
              type: 'app',
              appId: itemData.appId,
              name: itemData.name,
              defaultName: itemData.defaultName || itemData.name,
              icon: itemData.icon || '🗔',
              enabled: true
            };

            window.SG_DESKTOP_CONFIG.shortcuts.push(newShortcut);
            this.renderDesktopShortcuts();
            await this.saveDesktopShortcuts();
            this.showToast(`Raccourci d'application ajouté : « ${newShortcut.name} »`, 'success');
            return;
          }

          // Check if folder or file shortcut already exists
          const exists = window.SG_DESKTOP_CONFIG.shortcuts.some(s => s.path === itemData.path);
          if (exists) {
            this.showToast('Ce raccourci existe déjà sur le bureau', 'info');
            return;
          }

          const newShortcut = {
            id: `sc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: itemData.type || 'file',
            path: itemData.path,
            name: itemData.name || itemData.path.split('/').pop(),
            defaultName: itemData.name || itemData.path.split('/').pop(),
            icon: itemData.icon || (itemData.type === 'folder' ? '📁' : (window.IconHelper ? window.IconHelper.getFileIcon(itemData) : '📄')),
            thumb_url: itemData.thumb_url || null,
            cover_url: itemData.cover_url || null,
            category: itemData.category || null,
            extension: itemData.extension || null,
            enabled: true
          };

          window.SG_DESKTOP_CONFIG.shortcuts.push(newShortcut);
          this.renderDesktopShortcuts();
          await this.saveDesktopShortcuts();
          this.showToast(`Raccourci créé : « ${newShortcut.name} »`, 'success');
        });
      });
    }

    async saveDesktopShortcuts() {
      const csrfToken = window.CSRF_TOKEN || window.SG_CSRF_TOKEN || '';
      const shortcuts = (window.SG_DESKTOP_CONFIG && window.SG_DESKTOP_CONFIG.shortcuts) || [];

      try {
        localStorage.setItem('sg_desktop_shortcuts', JSON.stringify(shortcuts));
      } catch (e) {}

      try {
        const res = await fetch('api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            action: 'save_desktop_shortcuts',
            csrf_token: csrfToken,
            shortcuts: shortcuts
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.shortcuts)) {
            window.SG_DESKTOP_CONFIG.shortcuts = json.shortcuts;
          }
        }
      } catch (e) {
        console.error('[WebOSDesktop] Failed to save desktop shortcuts:', e);
      }
    }

    initDesktopContextMenu() {
      const container = this.el.desktopShortcuts || document.getElementById('desktopShortcuts');
      if (!container) return;

      container.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.desktop-shortcut-card');
        if (!card) return;

        e.preventDefault();
        e.stopPropagation();

        const shortcutId = card.dataset.shortcutId;
        const config = window.SG_DESKTOP_CONFIG || {};
        const shortcut = (config.shortcuts || []).find(s => s.id === shortcutId);
        if (!shortcut) return;

        // Remove any existing desktop context menu
        const oldMenu = document.getElementById('desktopContextMenu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'desktopContextMenu';
        menu.className = 'custom-context-menu';
        menu.style.position = 'fixed';
        menu.style.zIndex = '999999';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 150)}px`;
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.minWidth = '180px';

        const icon = shortcut.icon || (shortcut.type === 'folder' ? '📁' : '📄');
        menu.innerHTML = `
          <div class="context-menu-header">
            <span>${icon}</span> <span>${this.escapeHtml(shortcut.name || shortcut.defaultName || shortcut.appId)}</span>
          </div>
          <button type="button" class="context-menu-item" id="desktopCtxOpen">
            <span>▶️</span> <span data-i18n="desktop.open">${this.escapeHtml(this.t('desktop.open'))}</span>
          </button>
          <div class="context-menu-divider"></div>
          <button type="button" class="context-menu-item danger" id="desktopCtxDelete">
            <span>🗑️</span> <span data-i18n="desktop.delete_shortcut">${this.escapeHtml(this.t('desktop.delete_shortcut'))}</span>
          </button>
        `;

        document.body.appendChild(menu);

        const closeMenu = () => {
          menu.remove();
          document.removeEventListener('click', closeMenu);
          document.removeEventListener('contextmenu', closeMenu);
        };

        setTimeout(() => {
          document.addEventListener('click', closeMenu);
        }, 50);

        const openBtn = menu.querySelector('#desktopCtxOpen');
        if (openBtn) {
          openBtn.onclick = () => {
            closeMenu();
            this.launchDesktopShortcut(shortcut);
          };
        }

        const deleteBtn = menu.querySelector('#desktopCtxDelete');
        if (deleteBtn) {
          deleteBtn.onclick = async () => {
            closeMenu();
            window.SG_DESKTOP_CONFIG.shortcuts = (window.SG_DESKTOP_CONFIG.shortcuts || []).filter(s => s.id !== shortcutId);
            this.renderDesktopShortcuts();
            await this.saveDesktopShortcuts();
            this.showToast('Raccourci supprimé du bureau', 'info');
          };
        }
      });
    }

    // -------------------------------------------------------------
    // ADMIN AUTHENTICATION (SYSTEM TRAY MODAL)
    // -------------------------------------------------------------
    initAdmin() {
      const adminBtn = document.getElementById('adminBtn') || this.el.adminBtn;
      if (adminBtn) {
        adminBtn.onclick = (e) => {
          e.preventDefault();
          this.openAdminModal();
        };
      }
      const closeBtn = document.getElementById('adminModalCloseBtn') || this.el.adminModalCloseBtn;
      if (closeBtn) {
        closeBtn.onclick = () => this.closeAdminModal();
      }
      const adminModal = document.getElementById('adminModal') || this.el.adminModal;
      if (adminModal) {
        adminModal.onclick = (e) => {
          if (e.target === adminModal) this.closeAdminModal();
        };
      }
      const loginForm = document.getElementById('adminLoginForm') || this.el.adminLoginForm;
      if (loginForm) {
        loginForm.onsubmit = (e) => {
          e.preventDefault();
          this.loginAdmin();
        };
      }
      const logoutBtn = document.getElementById('adminLogoutBtn') || this.el.adminLogoutBtn;
      if (logoutBtn) {
        logoutBtn.onclick = () => this.logoutAdmin();
      }
      const openSettingsBtn = document.getElementById('adminOpenControlPanelBtn');
      if (openSettingsBtn) {
        openSettingsBtn.onclick = () => {
          this.closeAdminModal();
          if (window.SettingsApp && typeof window.SettingsApp.open === 'function') {
            window.SettingsApp.open('security');
          } else if (window.sys && window.sys.appManager) {
            window.sys.appManager.launchApp('settings');
          }
        };
      }
      const changePassForm = document.getElementById('changePasswordForm') || this.el.changePasswordForm;
      if (changePassForm) {
        changePassForm.onsubmit = (e) => {
          e.preventDefault();
          this.changeAdminPassword();
        };
      }

      this.state.csrfToken = window.CSRF_TOKEN || '';
      this.state.isAdmin = window.IS_ADMIN || false;
      if (this.state.isAdmin && adminBtn) {
        adminBtn.classList.add('active');
      }

      // Apply saved desktop wallpaper if SettingsApp is present
      if (window.SettingsApp && typeof window.SettingsApp.applySavedWallpaper === 'function') {
        window.SettingsApp.applySavedWallpaper();
      }
    }

    openMetadataModal(file) {
      if (window.sys && window.sys.showMetadata) {
        window.sys.showMetadata(file);
      } else if (window.MetadataInspector) {
        window.MetadataInspector.open(file);
      }
    }

    openMapModal(focusPath) {
      if (window.sys && window.sys.openMaps) {
        const files = (window.explorerApp && window.explorerApp.state && window.explorerApp.state.filteredFiles) || [];
        const currentPath = (window.explorerApp && window.explorerApp.state && window.explorerApp.state.currentPath) || '';
        window.sys.openMaps({ files, currentPath, focusPath });
      }
    }

    openAdminModal() {
      const modal = document.getElementById('adminModal') || this.el.adminModal;
      if (!modal) return;
      this.el.adminModal = modal;

      const isAdmin = (window.explorerApp && window.explorerApp.state && window.explorerApp.state.isAdmin) || this.state.isAdmin || window.IS_ADMIN;
      this.state.isAdmin = isAdmin;

      const loginState = document.getElementById('adminLoginState');
      const activeState = document.getElementById('adminActiveState');
      const loginError = document.getElementById('adminLoginError');
      const passInput = document.getElementById('adminPasswordInput');
      const changePassMsg = document.getElementById('adminChangePassMsg');

      if (loginState) loginState.style.display = isAdmin ? 'none' : 'block';
      if (activeState) activeState.style.display = isAdmin ? 'block' : 'none';
      if (loginError) {
        loginError.style.display = 'none';
        loginError.textContent = '';
      }
      if (changePassMsg) {
        changePassMsg.style.display = 'none';
        changePassMsg.textContent = '';
      }

      modal.style.display = 'flex';
      void modal.offsetWidth;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');

      if (isAdmin) {
        this.loadAdminPermissions();
      } else if (passInput) {
        passInput.value = '';
        setTimeout(() => passInput.focus(), 60);
      }
    }

    closeAdminModal() {
      const modal = document.getElementById('adminModal') || this.el.adminModal;
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        if (!modal.classList.contains('open')) {
          modal.style.display = 'none';
        }
      }, 200);
    }

    async loginAdmin() {
      const passInput = document.getElementById('adminPasswordInput') || this.el.adminPasswordInput;
      if (!passInput) return;
      const password = passInput.value;
      const loginError = document.getElementById('adminLoginError') || this.el.adminLoginError;

      try {
        const formData = new FormData();
        formData.append('action', 'login');
        formData.append('csrf_token', this.state.csrfToken || window.CSRF_TOKEN || '');
        formData.append('password', password);

        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'X-CSRF-Token': this.state.csrfToken || window.CSRF_TOKEN || '' },
          body: formData
        });
        const json = await res.json();
        if (json.success) {
          this.state.isAdmin = true;
          window.IS_ADMIN = true;
          if (json.csrf_token) {
            this.state.csrfToken = json.csrf_token;
            window.CSRF_TOKEN = json.csrf_token;
          }

          this.showToast(this.t('admin.login_success') || 'Connexion administrateur réussie', 'success');
          
          const adminBtn = document.getElementById('adminBtn');
          if (adminBtn) adminBtn.classList.add('active');

          const loginState = document.getElementById('adminLoginState');
          const activeState = document.getElementById('adminActiveState');
          if (loginState) loginState.style.display = 'none';
          if (activeState) activeState.style.display = 'block';

          if (window.SettingsApp && typeof window.SettingsApp.loadPermissions === 'function') {
            window.SettingsApp.loadPermissions();
          }

          if (window.explorerApp) {
            window.explorerApp.state.isAdmin = true;
            window.explorerApp.loadDirectory(window.explorerApp.state.currentPath);
          }
        } else {
          if (loginError) {
            loginError.textContent = json.error || 'Mot de passe incorrect';
            loginError.style.display = 'block';
          }
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    async logoutAdmin() {
      try {
        const formData = new FormData();
        formData.append('action', 'logout');
        formData.append('csrf_token', this.state.csrfToken || window.CSRF_TOKEN || '');
        await fetch('api.php', {
          method: 'POST',
          headers: { 'X-CSRF-Token': this.state.csrfToken || window.CSRF_TOKEN || '' },
          body: formData
        });
        this.state.isAdmin = false;
        window.IS_ADMIN = false;
        this.closeAdminModal();
        this.showToast('Déconnexion réussie', 'info');

        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) adminBtn.classList.remove('active');

        if (window.SettingsApp && typeof window.SettingsApp.loadPermissions === 'function') {
          window.SettingsApp.loadPermissions();
        }

        if (window.explorerApp) {
          window.explorerApp.state.isAdmin = false;
          window.explorerApp.loadDirectory(window.explorerApp.state.currentPath);
        }
      } catch (err) {}
    }

    async changeAdminPassword() {
      const input = document.getElementById('newAdminPasswordInput') || this.el.newAdminPasswordInput;
      if (!input) return;
      const newPassword = input.value;
      if (!newPassword) return;

      try {
        const formData = new FormData();
        formData.append('action', 'change_password');
        formData.append('csrf_token', this.state.csrfToken || window.CSRF_TOKEN || '');
        formData.append('new_password', newPassword);

        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'X-CSRF-Token': this.state.csrfToken || window.CSRF_TOKEN || '' },
          body: formData
        });
        const json = await res.json();
        if (json.success) {
          input.value = '';
          const msg = document.getElementById('adminChangePassMsg') || this.el.adminChangePassMsg;
          if (msg) {
            msg.textContent = '✅ ' + (json.message || 'Mot de passe modifié avec succès');
            msg.style.display = 'block';
          }
        } else {
          this.showToast(json.error || 'Erreur lors du changement de mot de passe', 'error');
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    async loadAdminPermissions() {
      const matrixDefs = ['can_upload', 'can_delete', 'can_move', 'can_comment', 'can_create_folder', 'can_download_archive', 'can_download_item'];

      const saveBtn = document.getElementById('savePermissionsBtn');
      if (saveBtn) {
        saveBtn.onclick = () => this.saveAdminPermissions(matrixDefs);
      }

      try {
        const res = await fetch('api.php?action=get_permissions');
        const json = await res.json();
        if (!json.success || !json.permissions) return;

        const p = json.permissions;
        matrixDefs.forEach(key => {
          const chk = document.getElementById(`perm_${key}`);
          if (chk) {
            chk.checked = !!p[key];
          }
        });
      } catch (err) {
        console.error('[Admin] Error loading permissions:', err);
      }
    }

    async saveAdminPermissions(matrixDefs) {
      const perms = {};
      matrixDefs.forEach(key => {
        const chk = document.getElementById(`perm_${key}`);
        if (chk) perms[key] = chk.checked;
      });

      try {
        const formData = new FormData();
        formData.append('action', 'save_permissions');
        formData.append('csrf_token', this.state.csrfToken || window.CSRF_TOKEN || '');
        formData.append('permissions', JSON.stringify(perms));

        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'X-CSRF-Token': this.state.csrfToken || window.CSRF_TOKEN || '' },
          body: formData
        });
        const json = await res.json();
        if (json.success) {
          this.showToast(this.t('admin.permissions_saved') || 'Permissions matrix saved successfully', 'success');
          if (window.explorerApp) {
            window.explorerApp.loadDirectory(window.explorerApp.state.currentPath);
          }
        } else {
          this.showToast(json.error || 'Erreur lors de la sauvegarde des droits', 'error');
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    // -------------------------------------------------------------
    // COOKIE & PRIVACY PREFERENCES
    // -------------------------------------------------------------
    initCookieConsent() {
      const banner = document.getElementById('cookieConsentBanner');
      const openSettingsBtn = document.getElementById('openCookieSettingsBtn');
      const acceptAllBtn = document.getElementById('cookieAcceptAllBtn');
      const refuseBtn = document.getElementById('cookieRefuseBtn') || document.getElementById('cookieRejectNonEssentialBtn');
      const customizeBtn = document.getElementById('cookieCustomizeBtn');

      const isConsentGiven = localStorage.getItem('sg_cookie_consent');
      if (!isConsentGiven && banner) {
        banner.style.display = 'flex';
      }

      const openPrivacyTab = () => {
        if (banner) banner.style.display = 'none';
        if (window.SettingsApp && typeof window.SettingsApp.open === 'function') {
          window.SettingsApp.open('privacy');
        } else if (window.sys && window.sys.appManager) {
          window.sys.appManager.launchApp('settings', { tab: 'privacy' });
        }
      };

      if (openSettingsBtn) {
        openSettingsBtn.onclick = (e) => {
          e.preventDefault();
          openPrivacyTab();
        };
      }
      if (customizeBtn) {
        customizeBtn.onclick = (e) => {
          e.preventDefault();
          openPrivacyTab();
        };
      }
      if (acceptAllBtn && banner) {
        acceptAllBtn.onclick = () => {
          localStorage.setItem('sg_cookie_consent', JSON.stringify({
            necessary: true,
            preferences: true,
            cdn: true,
            timestamp: Date.now()
          }));
          banner.style.display = 'none';
          this.showToast(this.t('settings.cookie_saved', 'Préférences cookies enregistrées !'), 'success');
        };
      }
      if (refuseBtn && banner) {
        refuseBtn.onclick = () => {
          localStorage.setItem('sg_cookie_consent', JSON.stringify({
            necessary: true,
            preferences: false,
            cdn: false,
            timestamp: Date.now()
          }));
          banner.style.display = 'none';
          this.showToast(this.t('settings.cookie_saved', 'Cookies essentiels uniquement activés'), 'info');
        };
      }
    }

    // -------------------------------------------------------------
    // THEMES & WALLPAPER OVERRIDES
    // -------------------------------------------------------------
    applyDotfileOverrides(overrides) {
      if (!overrides) return;

      // Description banner
      if (this.el.folderDescBanner) {
        if (overrides.description) {
          this.el.folderDescBanner.innerHTML = overrides.description;
          this.el.folderDescBanner.style.display = 'block';
        } else {
          this.el.folderDescBanner.style.display = 'none';
        }
      }
    }

    // -------------------------------------------------------------
    // TOAST NOTIFICATIONS
    // -------------------------------------------------------------
    showToast(message, type = 'info') {
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast-pill toast-${type}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  // Bootstrap WebOS Desktop Kernel on load
  document.addEventListener('DOMContentLoaded', () => {
    window.desktop = new WebOSDesktop();
    window.galleryApp = window.explorerApp;
  });

})(window);
