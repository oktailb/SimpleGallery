/**
 * SimpleGallery 2026 - Settings & Control Panel Application (apps/settings/settings.js)
 * Modernized Control Panel inheriting from WebOSApp (window.sys.App)
 */
(function(window) {
  'use strict';

  const WALLPAPER_PRESETS = [
    {
      id: 'nebula',
      nameKey: 'settings.wallpaper_nebula',
      style: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #0f172a 100%)'
    },
    {
      id: 'ocean',
      nameKey: 'settings.wallpaper_ocean',
      style: 'linear-gradient(135deg, #030712 0%, #0c4a6e 50%, #0f172a 100%)'
    },
    {
      id: 'sunset',
      nameKey: 'settings.wallpaper_sunset',
      style: 'linear-gradient(135deg, #18052e 0%, #4c1d95 50%, #0f172a 100%)'
    },
    {
      id: 'aurora',
      nameKey: 'settings.wallpaper_aurora',
      style: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #020617 100%)'
    },
    {
      id: 'cyberpunk',
      nameKey: 'settings.wallpaper_cyberpunk',
      style: 'linear-gradient(135deg, #0d0221 0%, #310842 50%, #020005 100%)'
    },
    {
      id: 'slate',
      nameKey: 'settings.wallpaper_slate',
      style: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
    }
  ];

  const THEMES = [
    {
      id: 'dark-glass',
      name: 'Dark Glassmorphism',
      bg_main: '#090d16',
      window_bg: 'rgba(12, 17, 29, 0.96)',
      header_bg: 'rgba(24, 32, 50, 0.9)',
      menu_bar_bg: 'rgba(9, 13, 22, 0.85)',
      sidebar_bg: 'rgba(0, 0, 0, 0.3)',
      polaroid_bg: '#182032',
      polaroid_text: '#f1f5f9',
      polaroid_sub: '#94a3b8',
      accent: '#8b5cf6',
      card_bg: 'rgba(255, 255, 255, 0.04)',
      border_color: 'rgba(255, 255, 255, 0.08)',
      border_color_hover: 'rgba(139, 92, 246, 0.4)',
      text_main: '#f8fafc',
      text_muted: '#94a3b8',
      mockupBg: '#090d16',
      mockupCard: '#182032',
      mockupAccent: '#8b5cf6'
    },
    {
      id: 'polaroid-classic',
      name: 'Polaroid Classic',
      bg_main: '#0f141c',
      window_bg: 'rgba(15, 20, 28, 0.96)',
      header_bg: 'rgba(30, 41, 59, 0.9)',
      menu_bar_bg: 'rgba(15, 23, 42, 0.85)',
      sidebar_bg: 'rgba(0, 0, 0, 0.25)',
      polaroid_bg: '#fcfaf5',
      polaroid_text: '#1e293b',
      polaroid_sub: '#64748b',
      accent: '#6366f1',
      card_bg: 'rgba(255, 255, 255, 0.05)',
      border_color: 'rgba(255, 255, 255, 0.08)',
      border_color_hover: 'rgba(99, 102, 241, 0.4)',
      text_main: '#f8fafc',
      text_muted: '#94a3b8',
      mockupBg: '#0f141c',
      mockupCard: '#fcfaf5',
      mockupAccent: '#6366f1'
    },
    {
      id: 'light-minimal',
      name: 'Light Minimal',
      bg_main: '#f1f5f9',
      window_bg: 'rgba(255, 255, 255, 0.98)',
      header_bg: '#f8fafc',
      menu_bar_bg: 'rgba(255, 255, 255, 0.94)',
      sidebar_bg: 'rgba(241, 245, 249, 0.95)',
      polaroid_bg: '#ffffff',
      polaroid_text: '#0f172a',
      polaroid_sub: '#64748b',
      accent: '#2563eb',
      card_bg: '#ffffff',
      border_color: 'rgba(0, 0, 0, 0.12)',
      border_color_hover: 'rgba(37, 99, 235, 0.4)',
      text_main: '#0f172a',
      text_muted: '#475569',
      mockupBg: '#f1f5f9',
      mockupCard: '#ffffff',
      mockupAccent: '#2563eb'
    },
    {
      id: 'cyberpunk',
      name: 'Cyberpunk Neon',
      bg_main: '#0d0221',
      window_bg: 'rgba(18, 5, 38, 0.96)',
      header_bg: 'rgba(36, 12, 65, 0.9)',
      menu_bar_bg: 'rgba(13, 2, 33, 0.9)',
      sidebar_bg: 'rgba(255, 0, 127, 0.08)',
      polaroid_bg: '#1d1135',
      polaroid_text: '#00f5d4',
      polaroid_sub: '#a855f7',
      accent: '#ff007f',
      card_bg: 'rgba(255, 0, 127, 0.08)',
      border_color: 'rgba(255, 0, 127, 0.25)',
      border_color_hover: 'rgba(0, 245, 212, 0.6)',
      text_main: '#00f5d4',
      text_muted: '#d946ef',
      mockupBg: '#0d0221',
      mockupCard: '#1d1135',
      mockupAccent: '#ff007f'
    }
  ];

  const PERMISSION_KEYS = [
    { key: 'can_upload', labelKey: 'admin.perm_upload' },
    { key: 'can_delete', labelKey: 'admin.perm_delete' },
    { key: 'can_move', labelKey: 'admin.perm_move' },
    { key: 'can_comment', labelKey: 'admin.perm_comment' },
    { key: 'can_create_folder', labelKey: 'admin.perm_create_folder' },
    { key: 'can_download_archive', labelKey: 'admin.perm_download_archive' },
    { key: 'can_download_item', labelKey: 'admin.perm_download_item' }
  ];

  class SettingsApp extends window.sys.App {
    constructor() {
      super({
        id: 'settings',
        title: 'settings.app_title',
        icon: '⚙️',
        width: 880,
        height: 620,
        minWidth: 540,
        minHeight: 440,
        resizable: true,
        tabs: [
          { id: 'security', label: 'settings.tab_security', icon: '🛡️' },
          { id: 'appearance', label: 'settings.tab_appearance', icon: '🎨' },
          { id: 'autostart', label: 'settings.tab_autostart', icon: '🚀' },
          { id: 'system', label: 'settings.tab_system', icon: '⚙️' },
          { id: 'privacy', label: 'settings.tab_privacy', icon: '🍪' },
          { id: 'plugins', label: 'settings.tab_plugins', icon: '🧩' }
        ],
        state: {
          permissions: {},
          systemInfo: null,
          testResults: null,
          isTesting: false,
          activeWallpaper: localStorage.getItem('sg_desktop_wallpaper') || 'nebula',
          activeTheme: localStorage.getItem('sg_active_theme') || 'dark-glass'
        }
      });

      this.customSections = [];
    }

    onInit() {
      if (window.EventBus) {
        window.EventBus.on('settings:register_section', (section) => this.registerSection(section));
        window.EventBus.on('locale:changed', () => this.render());
        window.EventBus.on('theme:changed', ({ themeId }) => {
          this.state.activeTheme = themeId;
          this.render();
        });
      }
      this.applySavedWallpaper();
      this.applySavedTheme();
    }

    onOpen() {
      this.loadPermissions();
      this.loadSystemInfo();
      this.loadAutostartConfig();
    }

    registerSection(section) {
      if (!section || !section.id || typeof section.render !== 'function') return;
      const existingIdx = this.customSections.findIndex(s => s.id === section.id);
      if (existingIdx >= 0) {
        this.customSections[existingIdx] = section;
      } else {
        this.customSections.push(section);
        this.tabs.push({ id: section.id, label: section.title, icon: section.icon || '🔌' });
      }
      this.render();
    }

    renderTab(tabId) {
      switch (tabId) {
        case 'security': return this.renderSecurityTab();
        case 'appearance': return this.renderAppearanceTab();
        case 'autostart': return this.renderAutostartTab();
        case 'system': return this.renderSystemTab();
        case 'privacy': return this.renderPrivacyTab();
        case 'plugins': return this.renderPluginsTab();
        default: {
          const custom = this.customSections.find(s => s.id === tabId);
          if (custom) {
            return `<div id="settingsCustomSection_${custom.id}"></div>`;
          }
          return this.renderSecurityTab();
        }
      }
    }

    bindEvents(container) {
      if (!container || !window.sys || !window.sys.ui || !window.sys.ui.bindActions) return;

      window.sys.ui.bindActions(container, {
        'click #settingsAuthActionBtn': () => this.handleAuthAction(),
        'click #settingsSavePermsBtn': () => this.savePermissions(container),
        'submit #settingsChangePassForm': (form, e) => { e.preventDefault(); this.changePassword(container); },
        'click [data-wallpaper-id]': (tile) => {
          const wId = tile.dataset.wallpaperId;
          this.setWallpaper(wId);
          container.querySelectorAll('[data-wallpaper-id]').forEach(t => t.classList.toggle('active', t === tile));
        },
        'click #applyCustomWallpaperBtn': () => {
          const input = container.querySelector('#customWallpaperInput');
          if (input && input.value.trim()) {
            this.setCustomWallpaper(input.value.trim());
            container.querySelectorAll('[data-wallpaper-id]').forEach(t => t.classList.remove('active'));
          }
        },
        'click [data-theme-id]': (card) => {
          const tId = card.dataset.themeId;
          this.setTheme(tId);
          container.querySelectorAll('[data-theme-id]').forEach(c => c.classList.toggle('active', c === card));
        },
        'click #settingsSaveAutostartBtn': () => this.saveAutostartConfig(container),
        'change #settingsLangListBox': (select) => {
          const lang = select.value;
          if (window.desktop && typeof window.desktop.setLocale === 'function') {
            window.desktop.setLocale(lang);
          } else if (window.I18nEngine) {
            window.I18nEngine.setLocale(lang);
          }
        },
        'click #settingsRunTestsBtn': () => this.runUnitTests(container),
        'click #setCookieSaveBtn': () => this.saveCookiePreferences(container),
        'click #settingsResetStorageBtn': () => this.resetLocalStorage(),
        'change .app-enable-toggle': (chk) => {
          const aId = chk.dataset.appId;
          const enabled = chk.checked;
          if (window.sys && window.sys.appManager) {
            window.sys.appManager.setAppEnabled(aId, enabled);
            const appName = window.sys.appManager.getAppTitle(aId);
            this.toast.success(enabled ? this.t('settings.app_enabled_msg', { name: appName }) : this.t('settings.app_disabled_msg', { name: appName }));
            this.render();
          }
        },
        'click [data-launch-app]': (btn) => {
          const aId = btn.dataset.launchApp;
          if (window.sys && window.sys.appManager) {
            window.sys.appManager.launchApp(aId);
          }
        }
      });

      // Bind custom plugin sections if active
      const custom = this.customSections.find(s => s.id === this.currentTab);
      if (custom) {
        const customArea = container.querySelector(`#settingsCustomSection_${custom.id}`);
        if (customArea && typeof custom.render === 'function') {
          custom.render(customArea, this);
        }
      }

      this.bindAutostartEvents(container);
    }

    // -------------------------------------------------------------
    // TAB 1: SECURITY & GUEST PERMISSIONS MATRIX
    // -------------------------------------------------------------
    renderSecurityTab() {
      const authContent = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">
              ${this.isAdmin ? this.t('admin.status_connected') : '🔒 ' + this.t('admin.login_title')}
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted);">
              ${this.isAdmin ? this.t('admin.active_notice') : this.t('settings.admin_required_notice')}
            </div>
          </div>
          <button type="button" id="settingsAuthActionBtn" class="sysmon-action-btn ${this.isAdmin ? '' : 'kill'}" style="padding:6px 14px; font-size:0.85rem;">
            ${this.isAdmin ? '🚪 ' + this.t('admin.logout_btn') : '🔑 ' + this.t('admin.login_btn')}
          </button>
        </div>
      `;

      const permsContent = `
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">
          ${this.t('admin.manage_settings_hint')}
        </p>
        <div class="permissions-grid-container" id="settingsPermsGrid">
          ${PERMISSION_KEYS.map(p => `
            <label class="permission-toggle-row" for="set_perm_${p.key}">
              <span class="permission-toggle-label">${this.t(p.labelKey)}</span>
              <input type="checkbox" id="set_perm_${p.key}" ${this.state.permissions[p.key] ? 'checked' : ''} ${this.isAdmin ? '' : 'disabled'} />
            </label>
          `).join('')}
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; align-items:center;">
          <button type="button" id="settingsSavePermsBtn" class="sysmon-action-btn" style="flex:1; justify-content:center; padding:10px; background:var(--accent-primary, #6366f1); color:#fff;" ${this.isAdmin ? '' : 'disabled'}>
            💾 ${this.t('admin.perm_save_btn')}
          </button>
        </div>
        <div id="settingsPermsMsg" class="admin-success-msg" style="display:none; margin-top:10px;"></div>
      `;

      const changePassContent = this.isAdmin ? `
        <form id="settingsChangePassForm" style="display:flex; gap:10px; flex-wrap:wrap;">
          <input type="password" id="settingsNewPassInput" class="admin-input" style="flex:1; min-width:200px;" placeholder="${this.t('admin.new_password_placeholder')}" required minlength="4" />
          <button type="submit" class="sysmon-action-btn" style="padding:8px 16px; background:var(--accent-primary, #6366f1); color:#fff;">
            ${this.t('admin.save_new_password')}
          </button>
        </form>
        <div id="settingsPassMsg" style="margin-top:10px;"></div>
      ` : '';

      return `
        ${window.sys.ui.card({
          title: 'admin.login_title',
          icon: '🔐',
          content: authContent
        })}

        ${window.sys.ui.card({
          title: 'admin.perms_title',
          icon: '🛡️',
          content: permsContent
        })}

        ${this.isAdmin ? window.sys.ui.card({
          title: 'admin.change_password',
          icon: '🔑',
          content: changePassContent
        }) : ''}
      `;
    }

    handleAuthAction() {
      if (this.isAdmin) {
        if (window.desktop && typeof window.desktop.logoutAdmin === 'function') {
          window.desktop.logoutAdmin().then(() => this.render());
        }
      } else {
        if (window.desktop && typeof window.desktop.openAdminModal === 'function') {
          window.desktop.openAdminModal();
        }
      }
    }

    async savePermissions(container) {
      const updatedPerms = {};

      PERMISSION_KEYS.forEach(p => {
        const chk = container.querySelector(`#set_perm_${p.key}`);
        if (chk) updatedPerms[p.key] = chk.checked;
      });

      try {
        const json = await this.api.post('save_permissions', { permissions: JSON.stringify(updatedPerms) });

        const msgEl = container.querySelector('#settingsPermsMsg');
        if (json.success) {
          this.state.permissions = updatedPerms;
          if (msgEl) {
            msgEl.textContent = '✅ ' + this.t('admin.perm_save_success');
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
          }
          this.toast.success(this.t('admin.perm_save_success'));
        } else {
          alert(json.error || this.t('admin.perm_save_error'));
        }
      } catch (err) {
        alert(this.t('admin.perm_save_error') + ': ' + err.message);
      }
    }

    async changePassword(container) {
      const input = container.querySelector('#settingsNewPassInput');
      const msgEl = container.querySelector('#settingsPassMsg');
      if (!input || !input.value) return;

      try {
        const json = await this.api.post('change_password', { new_password: input.value });

        if (json.success) {
          input.value = '';
          if (msgEl) {
            msgEl.innerHTML = '<div class="admin-success-msg">✅ ' + (json.message || this.t('admin.password_changed_success')) + '</div>';
            setTimeout(() => { msgEl.innerHTML = ''; }, 4000);
          }
        } else {
          if (msgEl) {
            msgEl.innerHTML = '<div class="admin-error-msg">❌ ' + (json.error || this.t('admin.password_change_error')) + '</div>';
          }
        }
      } catch (err) {
        if (msgEl) {
          msgEl.innerHTML = `<div class="admin-error-msg">❌ ${this.t('admin.password_change_error')}: ${err.message}</div>`;
        }
      }
    }

    // -------------------------------------------------------------
    // TAB 2: APPEARANCE & DESKTOP WALLPAPER & THEMES
    // -------------------------------------------------------------
    renderAppearanceTab() {
      const wallpaperContent = `
        <div class="settings-card-title">${this.t('settings.wallpaper_presets')}</div>
        <div class="wallpaper-presets-grid" id="wallpaperPresetsGrid">
          ${WALLPAPER_PRESETS.map(w => `
            <div class="wallpaper-tile ${this.state.activeWallpaper === w.id ? 'active' : ''}" data-wallpaper-id="${w.id}" style="background: ${w.style};">
              <span class="wallpaper-tile-name">${this.t(w.nameKey)}</span>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:1.25rem;">
          <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.4rem;">
            ${this.t('settings.wallpaper_custom_label')}
          </label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="customWallpaperInput" class="admin-input" placeholder="${this.t('settings.wallpaper_custom_placeholder')}" style="flex:1;" />
            <button type="button" id="applyCustomWallpaperBtn" class="sysmon-action-btn" style="padding:6px 14px; background:var(--accent-primary, #6366f1); color:#fff;">
              ${this.t('settings.wallpaper_apply')}
            </button>
          </div>
        </div>
      `;

      const themeContent = `
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">
          ${this.t('settings.theme_desc')}
        </p>
        <div class="themes-selection-grid">
          ${THEMES.map(theme => `
            <div class="theme-card-preview ${this.state.activeTheme === theme.id ? 'active' : ''}" data-theme-id="${theme.id}">
              <div class="theme-mockup-window" style="background: ${theme.mockupBg};">
                <div class="theme-mockup-header">
                  <div class="theme-mockup-dots">
                    <span style="background:#ef4444;"></span>
                    <span style="background:#f59e0b;"></span>
                    <span style="background:#10b981;"></span>
                  </div>
                  <span style="font-size:0.6rem; color:${theme.text_muted}; margin-left:4px;">${theme.name}</span>
                </div>
                <div class="theme-mockup-body">
                  <span class="theme-mockup-chip" style="background:${theme.mockupCard}; color:${theme.text_main}; border:1px solid rgba(255,255,255,0.1);">UI Window</span>
                  <span class="theme-mockup-chip" style="background:${theme.mockupAccent}; color:#ffffff;">Button</span>
                </div>
              </div>
              <div class="theme-palette-bar">
                <span style="background:${theme.bg_main};"></span>
                <span style="background:${theme.polaroid_bg};"></span>
                <span style="background:${theme.accent};"></span>
                <span style="background:${theme.text_main};"></span>
              </div>
              <span class="theme-card-name">${theme.name}</span>
            </div>
          `).join('')}
        </div>
      `;

      return `
        ${window.sys.ui.card({
          title: 'settings.wallpaper_title',
          icon: '🖼️',
          content: wallpaperContent
        })}

        ${window.sys.ui.card({
          title: 'settings.theme_title',
          icon: '🎭',
          content: themeContent
        })}
      `;
    }

    // -------------------------------------------------------------
    // TAB 3: SYSTEM & APP AUTOSTART CONFIGURATION
    // -------------------------------------------------------------
    async loadAutostartConfig() {
      try {
        const json = await this.api.get('get_autostart_settings');
        if (json && json.success && json.config) {
          this.state.autostartConfig = json.config;
          window.SG_AUTOSTART_CONFIG = json.config;
        }
      } catch (e) {}
    }

    renderAutostartTab() {
      const discoveredApps = (window.sys && window.sys.appManager && typeof window.sys.appManager.getDiscoveredApps === 'function')
        ? window.sys.appManager.getDiscoveredApps()
        : [
            { id: 'explorer', name: this.t('apps.explorer.title'), icon: '🗂️', description: this.t('apps.explorer.description') },
            { id: 'tribune', name: this.t('apps.tribune.title'), icon: '🦆', description: this.t('apps.tribune.description') },
            { id: 'system-monitor', name: this.t('sysmon.app_title'), icon: '📊', description: this.t('sysmon.header_sub') },
            { id: 'audio-player', name: this.t('apps.audio-player.title'), icon: '🎵', description: this.t('apps.audio-player.description') },
            { id: 'video-player', name: this.t('apps.video-player.title'), icon: '🎥', description: this.t('apps.video-player.description') },
            { id: 'doc-viewer', name: this.t('apps.doc-viewer.title'), icon: '📄', description: this.t('apps.doc-viewer.description') },
            { id: 'image-viewer', name: this.t('apps.image-viewer.title'), icon: '🖼️', description: this.t('apps.image-viewer.description') },
            { id: 'archive-manager', name: this.t('apps.archive-manager.title'), icon: '📦', description: this.t('apps.archive-manager.description') },
            { id: 'maps', name: this.t('apps.maps.title'), icon: '🗺️', description: this.t('apps.maps.description') },
            { id: 'settings', name: this.t('settings.app_title'), icon: '⚙️', description: this.t('settings.extensible_desc') }
          ];

      const autostartCfg = this.state.autostartConfig || (window.SG_AUTOSTART_CONFIG || { enabled: true, apps: [{ appId: 'explorer', state: 'normal', enabled: true }] });
      const masterEnabled = autostartCfg.enabled !== false;
      const appsList = autostartCfg.apps || [];

      const getAppCfg = (appId) => {
        const item = appsList.find(a => a.appId === appId);
        if (item) return item;
        if (appId === 'explorer') return { appId: 'explorer', state: 'normal', enabled: true };
        return { appId: appId, state: 'normal', enabled: false };
      };

      const sortedApps = [...discoveredApps].sort((a, b) => {
        const idxA = appsList.findIndex(item => item.appId === a.id);
        const idxB = appsList.findIndex(item => item.appId === b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });

      const masterContent = `
        <label class="permission-toggle-row" for="autostart_master_toggle">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.4rem;">🚀</span>
            <div>
              <div style="font-weight:600; color:var(--text-main);">${this.t('autostart.master_toggle')}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${this.t('autostart.master_hint')}</div>
            </div>
          </div>
          <input type="checkbox" id="autostart_master_toggle" ${masterEnabled ? 'checked' : ''} ${this.isAdmin ? '' : 'disabled'} />
        </label>
      `;

      const appsContent = `
        <div class="autostart-apps-table-container">
          ${sortedApps.map(app => {
            const cfg = getAppCfg(app.id);
            return `
              <div class="autostart-app-row" data-app-id="${app.id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--border-color, rgba(255,255,255,0.06)); gap:12px;">
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                  <button type="button" class="sysmon-action-btn autostart-move-up" data-app-id="${app.id}" title="${this.t('autostart.move_up')}" ${this.isAdmin ? '' : 'disabled'} style="padding:4px 8px; font-size:0.75rem;">▲</button>
                  <button type="button" class="sysmon-action-btn autostart-move-down" data-app-id="${app.id}" title="${this.t('autostart.move_down')}" ${this.isAdmin ? '' : 'disabled'} style="padding:4px 8px; font-size:0.75rem;">▼</button>
                </div>

                <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                  <span style="font-size:1.4rem; flex-shrink:0;">${app.icon || '🗔'}</span>
                  <div style="min-width:0;">
                    <div style="font-weight:600; color:var(--text-main); font-size:0.9rem;">${this.escapeHtml(app.name || app.id)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(app.description || '')}</div>
                  </div>
                </div>

                <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                  <select class="sort-select autostart-state-select" data-app-id="${app.id}" ${cfg.enabled ? '' : 'disabled'} ${this.isAdmin ? '' : 'disabled'} style="font-size:0.8rem; padding:6px 10px;">
                    <option value="maximized" ${cfg.state === 'maximized' ? 'selected' : ''}>${this.t('autostart.state_maximized')}</option>
                    <option value="normal" ${(cfg.state === 'normal' || cfg.state === 'floating') ? 'selected' : ''}>${this.t('autostart.state_normal')}</option>
                    <option value="minimized" ${cfg.state === 'minimized' ? 'selected' : ''}>${this.t('autostart.state_minimized')}</option>
                  </select>

                  <label class="permission-toggle-row" style="margin:0; padding:0; border:none;">
                    <input type="checkbox" class="autostart-app-enable-toggle" data-app-id="${app.id}" ${cfg.enabled ? 'checked' : ''} ${this.isAdmin ? '' : 'disabled'} />
                  </label>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; align-items:center;">
          <button type="button" id="settingsSaveAutostartBtn" class="sysmon-action-btn" style="flex:1; justify-content:center; padding:10px; background:var(--accent-primary, #6366f1); color:#fff;" ${this.isAdmin ? '' : 'disabled'}>
            💾 ${this.t('autostart.save_btn')}
          </button>
        </div>
        <div id="settingsAutostartMsg" class="admin-success-msg" style="display:none; margin-top:10px;"></div>
      `;

      return `
        ${window.sys.ui.card({
          title: 'autostart.global_title',
          icon: '⚡',
          content: masterContent
        })}

        ${window.sys.ui.card({
          title: 'autostart.apps_title',
          icon: '🗔',
          content: appsContent
        })}
      `;
    }

    bindAutostartEvents(container) {
      const updateMoveButtonStates = () => {
        const rows = container.querySelectorAll('.autostart-app-row');
        rows.forEach((r, idx) => {
          const upBtn = r.querySelector('.autostart-move-up');
          const downBtn = r.querySelector('.autostart-move-down');
          if (upBtn) upBtn.disabled = !this.isAdmin || idx === 0;
          if (downBtn) downBtn.disabled = !this.isAdmin || idx === rows.length - 1;
        });
      };

      container.querySelectorAll('.autostart-move-up').forEach(btn => {
        btn.onclick = (e) => {
          if (!this.isAdmin) return;
          const row = e.target.closest('.autostart-app-row');
          if (row && row.previousElementSibling && row.previousElementSibling.classList.contains('autostart-app-row')) {
            row.parentNode.insertBefore(row, row.previousElementSibling);
            updateMoveButtonStates();
          }
        };
      });

      container.querySelectorAll('.autostart-move-down').forEach(btn => {
        btn.onclick = (e) => {
          if (!this.isAdmin) return;
          const row = e.target.closest('.autostart-app-row');
          if (row && row.nextElementSibling && row.nextElementSibling.classList.contains('autostart-app-row')) {
            row.parentNode.insertBefore(row.nextElementSibling, row);
            updateMoveButtonStates();
          }
        };
      });

      updateMoveButtonStates();

      container.querySelectorAll('.autostart-app-enable-toggle').forEach(chk => {
        chk.onchange = (e) => {
          const appId = e.target.dataset.appId;
          const sel = container.querySelector(`.autostart-state-select[data-app-id="${appId}"]`);
          if (sel) sel.disabled = !e.target.checked || !this.isAdmin;
        };
      });
    }

    async saveAutostartConfig(container) {
      if (!this.isAdmin) {
        alert(this.t('autostart.admin_only_desc'));
        return;
      }

      const msgEl = container.querySelector('#settingsAutostartMsg');
      const masterToggle = container.querySelector('#autostart_master_toggle');
      const isMasterEnabled = masterToggle ? masterToggle.checked : true;

      const appRows = container.querySelectorAll('.autostart-app-row');
      const apps = [];

      appRows.forEach(row => {
        const appId = row.dataset.appId;
        const chk = row.querySelector('.autostart-app-enable-toggle');
        const sel = row.querySelector('.autostart-state-select');
        if (appId) {
          apps.push({
            appId: appId,
            enabled: chk ? chk.checked : false,
            state: sel ? sel.value : 'normal'
          });
        }
      });

      const configData = { enabled: isMasterEnabled, apps };
      this.state.autostartConfig = configData;
      window.SG_AUTOSTART_CONFIG = configData;

      try {
        const json = await this.api.post('save_autostart_settings', { config: JSON.stringify(configData) });

        if (json && json.success) {
          if (msgEl) {
            msgEl.textContent = '✅ ' + this.t('autostart.save_success');
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
          }
          this.toast.success(this.t('autostart.save_success'));
        } else {
          alert(json.error || this.t('autostart.save_error'));
        }
      } catch (err) {
        alert(this.t('autostart.save_error') + ': ' + err.message);
      }
    }

    // -------------------------------------------------------------
    // TAB 4: SYSTEM & ENVIRONMENT DIAGNOSTICS & UNIT TESTS
    // -------------------------------------------------------------
    renderSystemTab() {
      const diag = this.state.systemInfo || {};
      const currentLocale = (window.desktop && window.desktop.state && window.desktop.state.currentLocale) || 'fr';

      const userAgent = navigator.userAgent || '';
      let browserName = 'Browser';
      if (userAgent.includes('Firefox')) browserName = 'Firefox';
      else if (userAgent.includes('Edg/')) browserName = 'Edge';
      else if (userAgent.includes('Chrome')) browserName = 'Chrome / Chromium';
      else if (userAgent.includes('Safari')) browserName = 'Safari';

      let osName = 'OS';
      if (userAgent.includes('Win')) osName = 'Windows';
      else if (userAgent.includes('Mac')) osName = 'macOS';
      else if (userAgent.includes('Linux')) osName = 'Linux';
      else if (userAgent.includes('Android')) osName = 'Android';
      else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) osName = 'iOS';

      const screenRes = `${window.screen.width} × ${window.screen.height} (${window.devicePixelRatio || 1}x)`;

      const langContent = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="font-weight:600; font-size:0.9rem;">${this.t('nav.switch_lang')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${this.t('settings.lang_selector_desc')}</div>
          </div>
          <select id="settingsLangListBox" class="settings-lang-select" style="font-size:0.85rem; padding:6px 12px;">
            <option value="fr" ${currentLocale === 'fr' ? 'selected' : ''}>🇫🇷 Français (FR)</option>
            <option value="en" ${currentLocale === 'en' ? 'selected' : ''}>🇬🇧 English (EN)</option>
            <option value="ja" ${currentLocale === 'ja' ? 'selected' : ''}>🇯🇵 日本語 (JA)</option>
          </select>
        </div>
      `;

      const serverDiagGrid = window.sys.ui.infoGrid([
        { label: 'Version PHP', value: diag.php_version || 'PHP 8+' },
        { label: 'Serveur Web', value: diag.server_software ? diag.server_software.split(' ')[0] : 'Web Server' },
        { label: 'Extension GD', value: diag.gd_available !== false ? '✅ Active' : '❌ Missing' },
        { label: 'Extension EXIF', value: diag.exif_available !== false ? '✅ Active' : '❌ Missing' },
        { label: 'ZipArchive', value: diag.zip_available !== false ? '✅ Active' : '❌ Missing' },
        { label: 'FFmpeg CLI', value: diag.ffmpeg_available ? ('✅ ' + this.t('settings.status_detected')) : ('⚠️ ' + this.t('settings.status_optional')) }
      ]);

      const clientDiagGrid = window.sys.ui.infoGrid([
        { label: 'settings.browser_name', value: browserName },
        { label: 'settings.browser_os', value: osName },
        { label: 'settings.browser_resolution', value: screenRes },
        { label: 'Moteur WebGL', value: window.WebGLRenderingContext ? ('✅ ' + this.t('settings.webgl_accelerated')) : ('⚠️ ' + this.t('settings.webgl_software')) }
      ]);

      const testsContent = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
          <div>
            <div style="font-weight:600; font-size:0.9rem;">${this.t('settings.tests_title')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${this.t('settings.tests_desc')}</div>
          </div>
          <button type="button" id="settingsRunTestsBtn" class="sysmon-action-btn" style="padding:6px 14px; background:var(--accent-primary, #6366f1); color:#fff;">
            ${this.state.isTesting ? '⏳ ' + this.t('settings.tests_running') : '🧪 ' + this.t('settings.tests_run_btn')}
          </button>
        </div>
        <div id="settingsTestReportContainer" class="test-runner-container" style="${this.state.testResults ? 'display:block;' : 'display:none;'}">
          ${this.renderTestReportHTML(this.state.testResults)}
        </div>
      `;

      return `
        ${window.sys.ui.card({
          title: 'settings.lang_selector_title',
          icon: '🌐',
          content: langContent
        })}

        ${window.sys.ui.card({
          title: 'settings.system_diagnostics',
          icon: '📊',
          content: serverDiagGrid
        })}

        ${window.sys.ui.card({
          title: 'settings.browser_info_title',
          icon: '💻',
          content: clientDiagGrid
        })}

        ${window.sys.ui.card({
          title: 'settings.tests_title',
          icon: '🧪',
          content: testsContent
        })}
      `;
    }

    async runUnitTests(container) {
      this.state.isTesting = true;
      const runBtn = container.querySelector('#settingsRunTestsBtn');
      const reportContainer = container.querySelector('#settingsTestReportContainer');

      if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = '⏳ ' + this.t('settings.tests_running');
      }

      if (reportContainer) {
        reportContainer.style.display = 'block';
        reportContainer.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted);">⏳ ${this.t('settings.tests_running')}</div>`;
      }

      try {
        const json = await this.api.get('run_unit_tests');

        this.state.testResults = json;

        if (reportContainer) {
          reportContainer.innerHTML = this.renderTestReportHTML(json);
        }
      } catch (err) {
        if (reportContainer) {
          reportContainer.innerHTML = `<div class="admin-error-msg">❌ ${this.t('settings.tests_error')}: ${err.message}</div>`;
        }
      } finally {
        this.state.isTesting = false;
        if (runBtn) {
          runBtn.disabled = false;
          runBtn.textContent = '🧪 ' + this.t('settings.tests_run_btn');
        }
      }
    }

    renderTestReportHTML(data) {
      if (!data || !data.summary) return '';

      const s = data.summary;
      const suites = data.suites || [];

      return `
        <div class="test-summary-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.4rem;">${s.all_passed ? '🎉' : '⚠️'}</span>
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:${s.all_passed ? '#22c55e' : '#ef4444'};">
                ${s.all_passed ? this.t('settings.tests_all_passed') : this.t('settings.tests_failed_count', { count: s.failed })}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${this.t('settings.tests_summary')} • ${s.total} tests</div>
            </div>
          </div>
          <div class="test-summary-stats">
            <span class="test-stat-badge test-stat-pass">✅ ${s.passed} ${this.t('settings.tests_passed_short')}</span>
            ${s.failed > 0 ? `<span class="test-stat-badge test-stat-fail">❌ ${this.t('settings.tests_failed_count', { count: s.failed })}</span>` : ''}
            <span class="test-stat-badge test-stat-time">⚡ ${s.duration_ms} ms</span>
          </div>
        </div>

        ${suites.map(suite => `
          <details class="test-suite-accordion" open>
            <summary>
              <span>${suite.name} (${suite.passed}/${suite.total})</span>
              <span class="test-stat-badge ${suite.failed === 0 ? 'test-stat-pass' : 'test-stat-fail'}" style="font-size:0.75rem;">
                ${suite.failed === 0 ? '100%' : this.t('settings.tests_failed_short', { count: suite.failed })}
              </span>
            </summary>
            <div class="test-suite-body">
              ${(suite.tests || []).map(t => `
                <div class="test-case-row ${t.status === 'PASS' ? 'pass' : 'fail'}">
                  <span>${t.status === 'PASS' ? '✅' : '❌'} ${t.name}</span>
                  ${t.details ? `<span style="font-size:0.75rem; color:#ef4444;">${t.details}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </details>
        `).join('')}
      `;
    }

    // -------------------------------------------------------------
    // TAB 5: PRIVACY & EMBEDDED COOKIES MANAGER
    // -------------------------------------------------------------
    renderPrivacyTab() {
      let cookieConsent = { necessary: true, preferences: true, cdn: true };
      try {
        const stored = localStorage.getItem('sg_cookie_consent');
        if (stored) cookieConsent = { ...cookieConsent, ...JSON.parse(stored) };
      } catch (e) {}

      const privacyContent = `
        <div class="cookie-options-embedded-list">
          <div class="cookie-option-embedded-card">
            <div class="cookie-option-text">
              <h4>
                <span>${this.t('cookie.opt_necessary_title')}</span>
                <span class="cookie-option-badge cookie-badge-req">${this.t('cookie.opt_necessary_badge')}</span>
              </h4>
              <p>${this.t('cookie.opt_necessary_desc')}</p>
            </div>
            <div>
              <input type="checkbox" id="setCookieOptNecessary" checked disabled style="width:18px; height:18px;" />
            </div>
          </div>

          <div class="cookie-option-embedded-card">
            <div class="cookie-option-text">
              <h4>
                <span>${this.t('cookie.opt_pref_title')}</span>
                <span class="cookie-option-badge cookie-badge-opt">${this.t('cookie.opt_pref_badge')}</span>
              </h4>
              <p>${this.t('cookie.opt_pref_desc')}</p>
            </div>
            <div>
              <input type="checkbox" id="setCookieOptPreferences" ${cookieConsent.preferences ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;" />
            </div>
          </div>

          <div class="cookie-option-embedded-card">
            <div class="cookie-option-text">
              <h4>
                <span>${this.t('cookie.opt_cdn_title')}</span>
                <span class="cookie-option-badge cookie-badge-opt">${this.t('cookie.opt_cdn_badge')}</span>
              </h4>
              <p>${this.t('cookie.opt_cdn_desc')}</p>
            </div>
            <div>
              <input type="checkbox" id="setCookieOptCdn" ${cookieConsent.cdn ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;" />
            </div>
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:14px;">
          <button type="button" id="setCookieSaveBtn" class="sysmon-action-btn" style="flex:1; justify-content:center; padding:10px; background:var(--accent-primary, #6366f1); color:#fff;">
            💾 ${this.t('cookie.save_preferences')}
          </button>
        </div>
        <div id="setCookieSuccessMsg" class="admin-success-msg" style="display:none; margin-top:10px;"></div>
      `;

      const resetContent = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="font-weight:600; font-size:0.9rem;">${this.t('settings.reset_cache_title')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${this.t('settings.reset_cache_desc')}</div>
          </div>
          <button type="button" id="settingsResetStorageBtn" class="sysmon-action-btn kill" style="padding:6px 14px;">
            🗑️ ${this.t('settings.reset_cache_btn')}
          </button>
        </div>
      `;

      return `
        ${window.sys.ui.card({
          title: 'cookie.modal_title',
          icon: '🛡️',
          content: privacyContent
        })}

        ${window.sys.ui.card({
          title: 'settings.reset_defaults',
          icon: '🗑️',
          content: resetContent
        })}
      `;
    }

    saveCookiePreferences(container) {
      const pref = container.querySelector('#setCookieOptPreferences');
      const cdn = container.querySelector('#setCookieOptCdn');
      const payload = {
        necessary: true,
        preferences: pref ? pref.checked : true,
        cdn: cdn ? cdn.checked : true,
        timestamp: Date.now()
      };
      localStorage.setItem('sg_cookie_consent', JSON.stringify(payload));

      const banner = document.getElementById('cookieConsentBanner');
      if (banner) banner.style.display = 'none';

      const msgEl = container.querySelector('#setCookieSuccessMsg');
      if (msgEl) {
        msgEl.textContent = '✅ ' + this.t('settings.cookie_saved');
        msgEl.style.display = 'block';
        setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
      }
      if (window.sys && window.sys.ui && window.sys.ui.toast) {
        window.sys.ui.toast.success(this.t('settings.cookie_saved'));
      }
    }

    resetLocalStorage() {
      if (confirm(this.t('settings.privacy_reset_prompt'))) {
        localStorage.removeItem('sg_desktop_wallpaper');
        localStorage.removeItem('sg_active_theme');
        localStorage.removeItem('sg_favorites');
        localStorage.removeItem('sg_view_mode');
        localStorage.removeItem('sg_cookie_consent');
        window.location.reload();
      }
    }

    // -------------------------------------------------------------
    // TAB 6: PLUGINS & APPLICATION MODULES (Extensible)
    // -------------------------------------------------------------
    renderPluginsTab() {
      const apps = (window.sys && window.sys.appManager) ? window.sys.appManager.getAllApps(true) : [];

      const appsContent = `
        <div class="settings-apps-list">
          ${apps.map(app => `
            <div class="settings-app-item" style="display:flex; align-items:center; justify-content:space-between; padding:12px; border-bottom:1px solid var(--border-color, rgba(255,255,255,0.06)); gap:12px;">
              <div class="settings-app-left" style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                <span class="settings-app-icon" style="font-size:1.6rem; flex-shrink:0;">${app.icon || '🗔'}</span>
                <div style="min-width:0;">
                  <div class="settings-app-name" style="font-weight:600; font-size:0.9rem;">
                    ${this.escapeHtml(app.name)} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${app.id})</span>
                  </div>
                  <div class="settings-app-desc" style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${this.escapeHtml(app.description || this.t('settings.extensible_desc'))}
                  </div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:14px; flex-shrink:0;">
                <label class="permission-toggle-row" style="margin:0; padding:0; border:none; display:flex; align-items:center; gap:6px;">
                  <span style="font-size:0.8rem; color:${app.enabled ? 'var(--accent-primary, #6366f1)' : 'var(--text-muted)'}; font-weight:600;">
                    ${app.enabled ? this.t('settings.app_enabled') : this.t('settings.app_disabled')}
                  </span>
                  <input type="checkbox" class="app-enable-toggle" data-app-id="${app.id}" ${app.enabled ? 'checked' : ''} ${this.isAdmin ? '' : 'disabled'} />
                </label>
                <button type="button" class="sysmon-action-btn" data-launch-app="${app.id}" ${app.enabled ? '' : 'disabled'} style="padding:6px 14px;">
                  ▶ ${this.t('settings.launch_app')}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      return window.sys.ui.card({
        title: 'settings.tab_plugins',
        icon: '🧩',
        content: appsContent
      });
    }

    // -------------------------------------------------------------
    // ACTIONS & DATA HELPERS
    // -------------------------------------------------------------
    async loadPermissions() {
      try {
        const json = await this.api.get('get_permissions');
        if (json.success && json.permissions) {
          this.state.permissions = json.permissions;
          if (this.currentTab === 'security') this.render();
        }
      } catch (err) {
        console.error('[SettingsApp] Error loading permissions:', err);
      }
    }

    async loadSystemInfo() {
      try {
        const json = await this.api.get('get_system_info');
        if (json.success && json.system_info) {
          this.state.systemInfo = json.system_info;
          if (this.currentTab === 'system') this.render();
        }
      } catch (err) {
        console.error('[SettingsApp] Error loading system info:', err);
      }
    }

    setWallpaper(wallpaperId) {
      const preset = WALLPAPER_PRESETS.find(w => w.id === wallpaperId);
      if (!preset) return;

      this.state.activeWallpaper = wallpaperId;
      localStorage.setItem('sg_desktop_wallpaper', wallpaperId);

      const surface = document.getElementById('desktopSurface') || document.getElementById('webosDesktop');
      if (surface) {
        surface.style.background = preset.style;
        surface.style.backgroundImage = preset.style;
      }

      if (window.EventBus) {
        window.EventBus.emit('wallpaper:changed', { wallpaperId, style: preset.style });
      }
    }

    setCustomWallpaper(customStyle) {
      this.state.activeWallpaper = 'custom';
      localStorage.setItem('sg_desktop_wallpaper', `custom:${customStyle}`);

      const surface = document.getElementById('desktopSurface') || document.getElementById('webosDesktop');
      if (surface) {
        if (customStyle.startsWith('http://') || customStyle.startsWith('https://') || customStyle.includes('/')) {
          surface.style.background = `url("${customStyle}") center center / cover no-repeat fixed`;
        } else {
          surface.style.background = customStyle;
        }
      }

      if (window.EventBus) {
        window.EventBus.emit('wallpaper:changed', { wallpaperId: 'custom', style: customStyle });
      }
    }

    applySavedWallpaper() {
      const saved = localStorage.getItem('sg_desktop_wallpaper') || 'nebula';
      if (saved.startsWith('custom:')) {
        const custom = saved.replace('custom:', '');
        this.setCustomWallpaper(custom);
      } else {
        this.setWallpaper(saved);
      }
    }

    setTheme(themeId) {
      const theme = THEMES.find(t => t.id === themeId);
      if (!theme) return;

      this.state.activeTheme = themeId;
      localStorage.setItem('sg_active_theme', themeId);
      document.cookie = `sg_theme=${encodeURIComponent(themeId)};path=/;max-age=31536000;SameSite=Lax`;

      document.documentElement.setAttribute('data-theme', themeId);
      document.body.setAttribute('data-theme', themeId);
      document.querySelectorAll('.webos-window').forEach(win => win.setAttribute('data-theme', themeId));

      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--bg-main', theme.bg_main);
      rootStyle.setProperty('--window-bg', theme.window_bg || theme.bg_main);
      rootStyle.setProperty('--header-bg', theme.header_bg || theme.card_bg);
      rootStyle.setProperty('--menu-bar-bg', theme.menu_bar_bg || theme.bg_main);
      rootStyle.setProperty('--sidebar-bg', theme.sidebar_bg || 'rgba(0,0,0,0.25)');
      rootStyle.setProperty('--polaroid-bg', theme.polaroid_bg);
      rootStyle.setProperty('--polaroid-text', theme.polaroid_text);
      rootStyle.setProperty('--polaroid-sub', theme.polaroid_sub);
      rootStyle.setProperty('--accent-primary', theme.accent);
      rootStyle.setProperty('--accent', theme.accent);
      rootStyle.setProperty('--bg-card', theme.card_bg);
      rootStyle.setProperty('--card-bg', theme.card_bg);
      rootStyle.setProperty('--border-color', theme.border_color || 'rgba(255,255,255,0.08)');
      rootStyle.setProperty('--border-color-hover', theme.border_color_hover || 'rgba(99,102,241,0.4)');
      rootStyle.setProperty('--text-main', theme.text_main);
      rootStyle.setProperty('--text-muted', theme.text_muted);

      const dynamicStyle = document.getElementById('dynamic-theme-vars');
      if (dynamicStyle) {
        dynamicStyle.textContent = `
          :root, :root[data-theme="${themeId}"], body[data-theme="${themeId}"] {
            --bg-main: ${theme.bg_main};
            --window-bg: ${theme.window_bg || theme.bg_main};
            --header-bg: ${theme.header_bg || theme.card_bg};
            --menu-bar-bg: ${theme.menu_bar_bg || theme.bg_main};
            --sidebar-bg: ${theme.sidebar_bg || 'rgba(0,0,0,0.25)'};
            --polaroid-bg: ${theme.polaroid_bg};
            --polaroid-text: ${theme.polaroid_text};
            --polaroid-sub: ${theme.polaroid_sub};
            --accent-primary: ${theme.accent};
            --accent: ${theme.accent};
            --bg-card: ${theme.card_bg};
            --card-bg: ${theme.card_bg};
            --border-color: ${theme.border_color || 'rgba(255,255,255,0.08)'};
            --border-color-hover: ${theme.border_color_hover || 'rgba(99,102,241,0.4)'};
            --text-main: ${theme.text_main};
            --text-muted: ${theme.text_muted};
          }
        `;
      }

      this.toast.info(this.t('settings.theme_applied', { name: theme.name }));

      if (window.EventBus) {
        window.EventBus.emit('theme:changed', { themeId });
      }
    }

    applySavedTheme() {
      const saved = localStorage.getItem('sg_active_theme');
      if (saved) {
        this.setTheme(saved);
      }
    }
  }

  // Instantiate & export
  window.SettingsApp = new SettingsApp();
})(window);
