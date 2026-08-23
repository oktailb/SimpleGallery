/**
 * SimpleGallery 2026 - Settings & Control Panel Application (apps/settings/settings.js)
 * Standalone WebOS Control Panel Window with Tabbed Architecture, Unit Test Runner,
 * Embedded Privacy Manager, Dynamic Theme Engine, and Extensibility System
 */
(function(window) {
  'use strict';

  const WALLPAPER_PRESETS = [
    {
      id: 'nebula',
      nameKey: 'settings.wallpaper_nebula',
      defaultName: 'Nébuleuse Sombre',
      style: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #0f172a 100%)'
    },
    {
      id: 'ocean',
      nameKey: 'settings.wallpaper_ocean',
      defaultName: 'Océan Profond',
      style: 'linear-gradient(135deg, #030712 0%, #0c4a6e 50%, #0f172a 100%)'
    },
    {
      id: 'sunset',
      nameKey: 'settings.wallpaper_sunset',
      defaultName: 'Crépuscule Violet',
      style: 'linear-gradient(135deg, #18052e 0%, #4c1d95 50%, #0f172a 100%)'
    },
    {
      id: 'aurora',
      nameKey: 'settings.wallpaper_aurora',
      defaultName: 'Aurore Boréale',
      style: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #020617 100%)'
    },
    {
      id: 'cyberpunk',
      nameKey: 'settings.wallpaper_cyberpunk',
      defaultName: 'Cyber Neon',
      style: 'linear-gradient(135deg, #0d0221 0%, #310842 50%, #020005 100%)'
    },
    {
      id: 'slate',
      nameKey: 'settings.wallpaper_slate',
      defaultName: 'Ardoise Minimal',
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
    { key: 'can_upload', labelKey: 'admin.perm_upload', defaultText: '📤 Upload de fichiers' },
    { key: 'can_delete', labelKey: 'admin.perm_delete', defaultText: '🗑️ Suppression d\'éléments' },
    { key: 'can_move', labelKey: 'admin.perm_move', defaultText: '🖐️ Déplacement d\'éléments' },
    { key: 'can_comment', labelKey: 'admin.perm_comment', defaultText: '✏️ Édition des légendes' },
    { key: 'can_create_folder', labelKey: 'admin.perm_create_folder', defaultText: '📁+ Création de dossiers' },
    { key: 'can_download_archive', labelKey: 'admin.perm_download_archive', defaultText: '📦 Téléchargement d\'archives' },
    { key: 'can_download_item', labelKey: 'admin.perm_download_item', defaultText: '⬇️ Téléchargement direct des médias seuls' }
  ];

  const SettingsApp = {
    id: 'settings',
    name: 'Control Panel',
    icon: '⚙️',
    windowId: 'win-control-panel-settings',
    activeTab: 'security',
    customSections: [],
    state: {
      permissions: {},
      systemInfo: null,
      testResults: null,
      isTesting: false,
      activeWallpaper: localStorage.getItem('sg_desktop_wallpaper') || 'nebula',
      activeTheme: localStorage.getItem('sg_active_theme') || 'dark-glass'
    },

    init() {
      if (window.sys && window.sys.appManager) {
        window.sys.appManager.registerInstance(this.id, this);
      }

      // Listen for custom sections registered via EventBus
      if (window.EventBus) {
        window.EventBus.on('settings:register_section', (section) => {
          this.registerSection(section);
        });
        window.EventBus.on('locale:changed', () => {
          this.onLocaleChanged();
        });
        window.EventBus.on('theme:changed', ({ themeId }) => {
          this.onThemeChanged(themeId);
        });
      }

      // Apply initial saved wallpaper and theme
      this.applySavedWallpaper();
      this.applySavedTheme();
    },

    onThemeChanged(themeId) {
      this.state.activeTheme = themeId;
      const container = document.getElementById('settingsWindowBody');
      if (container) {
        this.renderTabContent(container);
      }
    },

    registerSection(section) {
      if (!section || !section.id || typeof section.render !== 'function') return;
      const existingIdx = this.customSections.findIndex(s => s.id === section.id);
      if (existingIdx >= 0) {
        this.customSections[existingIdx] = section;
      } else {
        this.customSections.push(section);
      }
      this.customSections.sort((a, b) => (a.order || 50) - (b.order || 50));

      const win = window.WindowManager ? window.WindowManager.windows.get(this.windowId) : null;
      if (win && win.bodyEl) {
        this.renderWindowContent(win.bodyEl);
      }
    },

    t(key, fallback = '') {
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        const res = window.I18nEngine.t(key);
        if (res && res !== key) return res;
      }
      if (window.desktop && typeof window.desktop.t === 'function') {
        const res = window.desktop.t(key);
        if (res && res !== key) return res;
      }
      return fallback || key;
    },

    onLocaleChanged() {
      const win = window.WindowManager ? window.WindowManager.windows.get(this.windowId) : null;
      if (win && win.bodyEl) {
        this.renderWindowContent(win.bodyEl);
      }
    },

    open(initialTab = null) {
      if (initialTab && typeof initialTab === 'string') {
        this.activeTab = initialTab;
      }

      if (!window.WindowManager) {
        console.warn('[SettingsApp] WindowManager not available.');
        return;
      }

      if (window.WindowManager.windows.has(this.windowId)) {
        const existingWin = window.WindowManager.windows.get(this.windowId);
        if (existingWin.state === 'minimized') {
          window.WindowManager.restoreWindow(this.windowId);
        }
        window.WindowManager.focusWindow(this.windowId);
        if (initialTab && existingWin.bodyEl) {
          this.switchTab(initialTab, existingWin.bodyEl);
        }
        return;
      }

      const win = window.WindowManager.createWindow({
        id: this.windowId,
        appId: 'settings',
        appName: this.t('settings.app_title', 'Panneau de Configuration'),
        icon: '⚙️',
        width: 880,
        height: 620,
        minWidth: 540,
        minHeight: 440,
        isResizable: true,
        isMaximizable: true,
        isMinimizable: true
      });

      if (!win || !win.bodyEl) return;

      this.renderWindowContent(win.bodyEl);
      this.loadPermissions();
      this.loadSystemInfo();
      this.loadAutostartConfig();

      if (window.EventBus) {
        window.EventBus.emit('app:launch', { appId: 'settings', tab: this.activeTab });
      }
    },

    renderWindowContent(container) {
      container.innerHTML = '';
      container.style.padding = '0';
      container.style.overflow = 'hidden';

      const layout = document.createElement('div');
      layout.className = 'settings-window-container';

      // 1. Sidebar Navigation
      const sidebar = document.createElement('div');
      sidebar.className = 'settings-sidebar';
      sidebar.innerHTML = `<div class="settings-sidebar-header">${this.t('settings.app_title', 'PARAMÈTRES')}</div>`;

      const standardTabs = [
        { id: 'security', icon: '🛡️', titleKey: 'settings.tab_security', defaultTitle: 'Sécurité & Droits' },
        { id: 'appearance', icon: '🎨', titleKey: 'settings.tab_appearance', defaultTitle: 'Bureau & Apparence' },
        { id: 'autostart', icon: '🚀', titleKey: 'settings.tab_autostart', defaultTitle: 'Démarrage' },
        { id: 'system', icon: '⚙️', titleKey: 'settings.tab_system', defaultTitle: 'Système & Diagnostic' },
        { id: 'privacy', icon: '🍪', titleKey: 'settings.tab_privacy', defaultTitle: 'Confidentialité & Cookies' },
        { id: 'plugins', icon: '🧩', titleKey: 'settings.tab_plugins', defaultTitle: 'Applications & Modules' }
      ];

      standardTabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `settings-nav-btn ${this.activeTab === tab.id ? 'active' : ''}`;
        btn.dataset.tab = tab.id;
        btn.innerHTML = `<span class="nav-icon">${tab.icon}</span> <span>${this.t(tab.titleKey, tab.defaultTitle)}</span>`;
        btn.onclick = () => this.switchTab(tab.id, container);
        sidebar.appendChild(btn);
      });

      // Custom app sections
      if (this.customSections.length > 0) {
        const extHeader = document.createElement('div');
        extHeader.className = 'settings-sidebar-header';
        extHeader.style.marginTop = '0.75rem';
        extHeader.textContent = 'EXTENSIONS';
        sidebar.appendChild(extHeader);

        this.customSections.forEach(section => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `settings-nav-btn ${this.activeTab === section.id ? 'active' : ''}`;
          btn.dataset.tab = section.id;
          btn.innerHTML = `<span class="nav-icon">${section.icon || '🔌'}</span> <span>${section.title}</span>`;
          btn.onclick = () => this.switchTab(section.id, container);
          sidebar.appendChild(btn);
        });
      }

      // 2. Content Area
      const contentArea = document.createElement('div');
      contentArea.className = 'settings-content-area';
      contentArea.id = 'settingsContentArea';

      layout.appendChild(sidebar);
      layout.appendChild(contentArea);
      container.appendChild(layout);

      this.renderTabContent(this.activeTab, contentArea);
    },

    switchTab(tabId, rootContainer) {
      this.activeTab = tabId;

      const buttons = rootContainer.querySelectorAll('.settings-nav-btn');
      buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });

      const contentArea = rootContainer.querySelector('#settingsContentArea');
      if (contentArea) {
        this.renderTabContent(tabId, contentArea);
      }
    },

    renderTabContent(tabId, container) {
      container.innerHTML = '';

      switch (tabId) {
        case 'security':
          this.renderSecurityTab(container);
          break;
        case 'appearance':
          this.renderAppearanceTab(container);
          break;
        case 'autostart':
          this.renderAutostartTab(container);
          break;
        case 'system':
          this.renderSystemTab(container);
          break;
        case 'privacy':
          this.renderPrivacyTab(container);
          break;
        case 'plugins':
          this.renderPluginsTab(container);
          break;
        default: {
          const custom = this.customSections.find(s => s.id === tabId);
          if (custom && typeof custom.render === 'function') {
            custom.render(container, this);
          } else {
            this.renderSecurityTab(container);
          }
          break;
        }
      }
    },

    // -------------------------------------------------------------
    // TAB 1: SECURITY & GUEST PERMISSIONS MATRIX
    // -------------------------------------------------------------
    renderSecurityTab(container) {
      const isAdmin = (window.desktop && window.desktop.state && window.desktop.state.isAdmin) || window.IS_ADMIN || false;

      let html = `
        <div class="settings-panel-header">
          <h2>🛡️ ${this.t('settings.tab_security', 'Sécurité & Droits d\'Accès')}</h2>
          <p>${this.t('admin.manage_settings_hint', 'Configurez les autorisations accordées aux invités et la sécurité administrative.')}</p>
        </div>

        <div class="settings-group">
          <div class="settings-group-title">🔐 ${this.t('admin.login_title', 'Statut Administrateur')}</div>
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">${isAdmin ? this.t('admin.status_connected', '✅ Session Administrateur Active') : '🔒 ' + this.t('admin.login_title', 'Mode Invité / Consultation')}</div>
                <p class="settings-card-desc">${isAdmin ? this.t('admin.active_notice', 'Vous disposez des droits complets de gestion.') : this.t('settings.admin_required_notice', 'Connectez-vous pour modifier la matrice de droits et les fichiers.')}</p>
              </div>
              <button type="button" id="settingsAuthActionBtn" class="pill-btn ${isAdmin ? '' : 'active'}" style="font-size:0.85rem;">
                ${isAdmin ? '🚪 ' + this.t('admin.logout_btn', 'Déconnexion') : '🔑 ' + this.t('admin.login_btn', 'Connexion Admin')}
              </button>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-group-title">🛡️ ${this.t('admin.perms_title', 'Matrice des Droits Invités')}</div>
          <div class="settings-card">
            <p class="settings-card-desc" style="margin-bottom:0.75rem;">
              ${this.t('admin.manage_settings_hint', 'Ces permissions définissent les actions autorisées pour les visiteurs lorsque le mode administrateur n\'est pas actif.')}
            </p>
            <div class="permissions-grid-container" id="settingsPermsGrid">
              ${PERMISSION_KEYS.map(p => `
                <label class="permission-toggle-row" for="set_perm_${p.key}">
                  <span class="permission-toggle-label">${this.t(p.labelKey, p.defaultText)}</span>
                  <input type="checkbox" id="set_perm_${p.key}" ${this.state.permissions[p.key] ? 'checked' : ''} ${isAdmin ? '' : 'disabled'} />
                </label>
              `).join('')}
            </div>

            <div style="display:flex;gap:10px;margin-top:1rem;align-items:center;">
              <button type="button" id="settingsSavePermsBtn" class="pill-btn active" style="flex:1;justify-content:center;padding:0.75rem;" ${isAdmin ? '' : 'disabled'}>
                💾 ${this.t('admin.perm_save_btn', 'Enregistrer la matrice de droits')}
              </button>
            </div>
            <div id="settingsPermsMsg" class="admin-success-msg" style="display:none;margin-top:0.75rem;"></div>
          </div>
        </div>

        ${isAdmin ? `
        <div class="settings-group">
          <div class="settings-group-title">🔑 ${this.t('admin.change_password', 'Changer le mot de passe Administrateur')}</div>
          <div class="settings-card">
            <form id="settingsChangePassForm" style="display:flex;gap:10px;flex-wrap:wrap;">
              <input type="password" id="settingsNewPassInput" class="admin-input" style="flex:1;min-width:200px;" placeholder="${this.t('admin.new_password_placeholder', 'Nouveau mot de passe...')}" required minlength="4" />
              <button type="submit" class="pill-btn active" style="padding:0.75rem 1.2rem;">
                ${this.t('admin.save_new_password', 'Mettre à jour')}
              </button>
            </form>
            <div id="settingsPassMsg" style="margin-top:0.75rem;"></div>
          </div>
        </div>
        ` : ''}
      `;

      container.innerHTML = html;

      // Bind Auth Action
      const authBtn = container.querySelector('#settingsAuthActionBtn');
      if (authBtn) {
        authBtn.onclick = () => {
          if (isAdmin) {
            if (window.desktop && typeof window.desktop.logoutAdmin === 'function') {
              window.desktop.logoutAdmin().then(() => this.renderSecurityTab(container));
            }
          } else {
            if (window.desktop && typeof window.desktop.openAdminModal === 'function') {
              window.desktop.openAdminModal();
            }
          }
        };
      }

      // Bind Save Permissions
      const savePermsBtn = container.querySelector('#settingsSavePermsBtn');
      if (savePermsBtn && isAdmin) {
        savePermsBtn.onclick = () => this.savePermissions(container);
      }

      // Bind Change Password
      const passForm = container.querySelector('#settingsChangePassForm');
      if (passForm && isAdmin) {
        passForm.onsubmit = (e) => {
          e.preventDefault();
          this.changePassword(container);
        };
      }
    },

    // -------------------------------------------------------------
    // TAB 2: APPEARANCE & DESKTOP WALLPAPER & THEMES
    // -------------------------------------------------------------
    renderAppearanceTab(container) {
      let html = `
        <div class="settings-panel-header">
          <h2>🎨 ${this.t('settings.tab_appearance', 'Bureau & Apparence')}</h2>
          <p>${this.t('settings.wallpaper_desc', 'Personnalisez le fond d\'écran du bureau et le thème visuel du système.')}</p>
        </div>

        <div class="settings-group">
          <div class="settings-group-title">🖼️ ${this.t('settings.wallpaper_title', 'Fond d\'Écran du Bureau')}</div>
          <div class="settings-card">
            <div class="settings-card-title">${this.t('settings.wallpaper_presets', 'Fonds d\'écran recommandés')}</div>
            <div class="wallpaper-presets-grid" id="wallpaperPresetsGrid">
              ${WALLPAPER_PRESETS.map(w => `
                <div class="wallpaper-tile ${this.state.activeWallpaper === w.id ? 'active' : ''}" data-wallpaper-id="${w.id}" style="background: ${w.style};">
                  <span class="wallpaper-tile-name">${this.t(w.nameKey, w.defaultName)}</span>
                </div>
              `).join('')}
            </div>

            <div style="margin-top:1.25rem;">
              <label style="display:block;font-size:0.85rem;color:#94a3b8;margin-bottom:0.4rem;">
                ${this.t('settings.wallpaper_custom_label', 'Image ou couleur personnalisée')}
              </label>
              <div style="display:flex;gap:8px;">
                <input type="text" id="customWallpaperInput" class="admin-input" placeholder="${this.t('settings.wallpaper_custom_placeholder', 'URL / Chemin d\'image ou code CSS (ex: #0f172a, linear-gradient(...))')}" />
                <button type="button" id="applyCustomWallpaperBtn" class="pill-btn active" style="white-space:nowrap;padding:0.7rem 1.2rem;">
                  ${this.t('settings.wallpaper_apply', 'Appliquer')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-group-title">🎭 ${this.t('settings.theme_title', 'Thème Visuel Global')}</div>
          <div class="settings-card">
            <p class="settings-card-desc" style="margin-bottom:0.85rem;">
              ${this.t('settings.theme_desc', 'Sélectionnez le thème d\'interface appliqué aux fenêtres et composants.')}
            </p>
            <div class="themes-selection-grid">
              ${THEMES.map(theme => `
                <div class="theme-card-preview ${this.state.activeTheme === theme.id ? 'active' : ''}" data-theme-id="${theme.id}">
                  <!-- Mini window mockup -->
                  <div class="theme-mockup-window" style="background: ${theme.mockupBg};">
                    <div class="theme-mockup-header">
                      <div class="theme-mockup-dots">
                        <span style="background:#ef4444;"></span>
                        <span style="background:#f59e0b;"></span>
                        <span style="background:#10b981;"></span>
                      </div>
                      <span style="font-size:0.6rem;color:${theme.text_muted};margin-left:4px;">${theme.name}</span>
                    </div>
                    <div class="theme-mockup-body">
                      <span class="theme-mockup-chip" style="background:${theme.mockupCard};color:${theme.text_main};border:1px solid rgba(255,255,255,0.1);">UI Window</span>
                      <span class="theme-mockup-chip" style="background:${theme.mockupAccent};color:#ffffff;">Button</span>
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
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Bind Wallpaper Presets
      const tiles = container.querySelectorAll('.wallpaper-tile');
      tiles.forEach(tile => {
        tile.onclick = () => {
          const wId = tile.dataset.wallpaperId;
          this.setWallpaper(wId);
          tiles.forEach(t => t.classList.toggle('active', t === tile));
        };
      });

      // Bind Custom Wallpaper
      const applyBtn = container.querySelector('#applyCustomWallpaperBtn');
      const customInput = container.querySelector('#customWallpaperInput');
      if (applyBtn && customInput) {
        applyBtn.onclick = () => {
          const val = customInput.value.trim();
          if (val) {
            this.setCustomWallpaper(val);
            tiles.forEach(t => t.classList.remove('active'));
          }
        };
      }

      // Bind Themes
      const themeCards = container.querySelectorAll('.theme-card-preview');
      themeCards.forEach(card => {
        card.onclick = () => {
          const tId = card.dataset.themeId;
          this.setTheme(tId);
          themeCards.forEach(c => c.classList.toggle('active', c === card));
        };
      });
    },

    // -------------------------------------------------------------
    // TAB 3: SYSTEM & APP AUTOSTART CONFIGURATION
    // -------------------------------------------------------------
    async loadAutostartConfig() {
      try {
        const res = await fetch('api.php?action=get_autostart_settings');
        const data = await res.json();
        if (data && data.success && data.config) {
          this.state.autostartConfig = data.config;
          window.SG_AUTOSTART_CONFIG = data.config;
        }
      } catch (e) {}
    },

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    renderAutostartTab(container) {
      const isAdmin = (window.desktop && window.desktop.state && window.desktop.state.isAdmin) || window.IS_ADMIN || false;
      const discoveredApps = (window.sys && window.sys.appManager && typeof window.sys.appManager.getDiscoveredApps === 'function')
        ? window.sys.appManager.getDiscoveredApps()
        : [
            { id: 'explorer', name: 'Explorateur de Média', icon: '🗂️', description: 'Explorateur multi-vues (Polaroid, Grille, Mosaïque, Liste)' },
            { id: 'tribune', name: 'Tribune Libre', icon: '🦆', description: 'Messagerie instantanée & client bouchot' },
            { id: 'system-monitor', name: 'Moniteur Système', icon: '📊', description: 'Surveillance télémétrique et diagnostic serveur' },
            { id: 'audio-player', name: 'Lecteur Audio', icon: '🎵', description: 'Lecteur audio et visualiseur' },
            { id: 'video-player', name: 'Lecteur Vidéo', icon: '🎥', description: 'Lecteur vidéo flottant PiP' },
            { id: 'doc-viewer', name: 'Visualiseur de Document', icon: '📄', description: 'Éditeur et visualiseur Markdown' },
            { id: 'image-viewer', name: 'Visionneuse d\'Image', icon: '🖼️', description: 'Visionneuse et studio retouche photo' },
            { id: 'archive-manager', name: 'Gestionnaire d\'Archive', icon: '📦', description: 'Inspecteur d\'archives ZIP / TAR' },
            { id: 'maps', name: 'Cartographie GPS', icon: '🗺️', description: 'Carte interactive et trajets photo' },
            { id: 'settings', name: 'Panneau de Configuration', icon: '⚙️', description: 'Réglages système et préférences' }
          ];

      const autostartCfg = this.state.autostartConfig || (window.SG_AUTOSTART_CONFIG || { enabled: true, apps: [{ appId: 'explorer', state: 'maximized', enabled: true }] });
      const masterEnabled = autostartCfg.enabled !== false;
      const appsList = autostartCfg.apps || [];

      const getAppCfg = (appId) => {
        const item = appsList.find(a => a.appId === appId);
        if (item) return item;
        if (appId === 'explorer') return { appId: 'explorer', state: 'normal', enabled: true };
        return { appId: appId, state: 'normal', enabled: false };
      };

      // Order discoveredApps according to saved autostartConfig apps sequence
      const sortedApps = [...discoveredApps].sort((a, b) => {
        const idxA = appsList.findIndex(item => item.appId === a.id);
        const idxB = appsList.findIndex(item => item.appId === b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });

      let html = `
        <div class="settings-panel-header">
          <h2>🚀 ${this.t('autostart.title', 'Démarrage du Système & Applications')}</h2>
          <p>${this.t('autostart.desc', 'Configurez les applications lancées au démarrage du WebOS, leur état initial (plein écran, fenêtré, réduit) et leur ordre de superposition (z-index).')}</p>
        </div>

        ${isAdmin ? '' : `
          <div class="admin-notice-bar" style="background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.3);color:#facc15;padding:12px 16px;border-radius:8px;margin-bottom:1.2rem;font-size:0.85rem;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">🔒</span>
            <div>
              <strong>${this.t('autostart.admin_only_title', 'Accès Administrateur requis')}</strong> — ${this.t('autostart.admin_only_desc', 'Seul l\'administrateur système peut modifier et enregistrer la configuration de démarrage.')}
            </div>
          </div>
        `}

        <div class="settings-group">
          <div class="settings-group-title">⚡ ${this.t('autostart.global_title', 'Option Globale de Démarrage')}</div>
          <div class="settings-card">
            <label class="permission-toggle-row" for="autostart_master_toggle">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.4rem;">🚀</span>
                <div>
                  <div style="font-weight:600;color:var(--text-main);">${this.t('autostart.master_toggle', 'Activer les applications au démarrage de WebOS')}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted);">${this.t('autostart.master_hint', 'Décochez cette option pour démarrer sur un bureau complètement vierge.')}</div>
                </div>
              </div>
              <input type="checkbox" id="autostart_master_toggle" ${masterEnabled ? 'checked' : ''} ${isAdmin ? '' : 'disabled'} />
            </label>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-group-title">🗔 ${this.t('autostart.apps_title', 'Configuration & Ordre de Superposition (Priorité Z-Index)')}</div>
          <div class="settings-card">
            <div class="autostart-apps-table-container">
              ${sortedApps.map(app => {
                const cfg = getAppCfg(app.id);
                return `
                  <div class="autostart-app-row" data-app-id="${app.id}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border-color, rgba(255,255,255,0.06));gap:12px;">
                    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                      <button type="button" class="btn-toggle autostart-move-btn autostart-move-up" data-app-id="${app.id}" title="${this.t('autostart.move_up', 'Monter (priorité z-index)')}" ${isAdmin ? '' : 'disabled'} style="padding:4px 8px;font-size:0.75rem;line-height:1;">▲</button>
                      <button type="button" class="btn-toggle autostart-move-btn autostart-move-down" data-app-id="${app.id}" title="${this.t('autostart.move_down', 'Descendre (priorité z-index)')}" ${isAdmin ? '' : 'disabled'} style="padding:4px 8px;font-size:0.75rem;line-height:1;">▼</button>
                    </div>

                    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                      <span style="font-size:1.4rem;flex-shrink:0;">${app.icon || '🗔'}</span>
                      <div style="min-width:0;">
                        <div style="font-weight:600;color:var(--text-main);font-size:0.9rem;">${this.escapeHtml(app.name || app.id)}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(app.description || '')}</div>
                      </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                      <select class="sort-select autostart-state-select" data-app-id="${app.id}" ${cfg.enabled ? '' : 'disabled'} ${isAdmin ? '' : 'disabled'} style="font-size:0.8rem;padding:6px 10px;">
                        <option value="maximized" ${cfg.state === 'maximized' ? 'selected' : ''}>${this.t('autostart.state_maximized', '🗖 Plein écran (Maximisé)')}</option>
                        <option value="normal" ${(cfg.state === 'normal' || cfg.state === 'floating') ? 'selected' : ''}>${this.t('autostart.state_normal', '🗔 Fenêtré (Normal)')}</option>
                        <option value="minimized" ${cfg.state === 'minimized' ? 'selected' : ''}>${this.t('autostart.state_minimized', '🗕 Réduit (Barre des tâches)')}</option>
                      </select>

                      <label class="permission-toggle-row" style="margin:0;padding:0;border:none;">
                        <input type="checkbox" class="autostart-app-enable-toggle" data-app-id="${app.id}" ${cfg.enabled ? 'checked' : ''} ${isAdmin ? '' : 'disabled'} />
                      </label>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div style="display:flex;gap:10px;margin-top:1rem;align-items:center;">
              <button type="button" id="settingsSaveAutostartBtn" class="pill-btn active" style="flex:1;justify-content:center;padding:0.75rem;" ${isAdmin ? '' : 'disabled'}>
                💾 ${this.t('autostart.save_btn', 'Enregistrer la configuration de démarrage')}
              </button>
            </div>
            <div id="settingsAutostartMsg" class="admin-success-msg" style="display:none;margin-top:0.75rem;"></div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      const updateMoveButtonStates = () => {
        const rows = container.querySelectorAll('.autostart-app-row');
        rows.forEach((r, idx) => {
          const upBtn = r.querySelector('.autostart-move-up');
          const downBtn = r.querySelector('.autostart-move-down');
          if (upBtn) upBtn.disabled = !isAdmin || idx === 0;
          if (downBtn) downBtn.disabled = !isAdmin || idx === rows.length - 1;
        });
      };

      container.querySelectorAll('.autostart-move-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (!isAdmin) return;
          const row = e.target.closest('.autostart-app-row');
          if (row && row.previousElementSibling && row.previousElementSibling.classList.contains('autostart-app-row')) {
            row.parentNode.insertBefore(row, row.previousElementSibling);
            updateMoveButtonStates();
          }
        });
      });

      container.querySelectorAll('.autostart-move-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (!isAdmin) return;
          const row = e.target.closest('.autostart-app-row');
          if (row && row.nextElementSibling && row.nextElementSibling.classList.contains('autostart-app-row')) {
            row.parentNode.insertBefore(row.nextElementSibling, row);
            updateMoveButtonStates();
          }
        });
      });

      updateMoveButtonStates();

      container.querySelectorAll('.autostart-app-enable-toggle').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const appId = e.target.dataset.appId;
          const sel = container.querySelector(`.autostart-state-select[data-app-id="${appId}"]`);
          if (sel) sel.disabled = !e.target.checked || !isAdmin;
        });
      });

      const saveBtn = container.querySelector('#settingsSaveAutostartBtn');
      if (saveBtn && isAdmin) {
        saveBtn.onclick = () => this.saveAutostartConfig(container);
      }
    },

    async saveAutostartConfig(container) {
      const isAdmin = (window.desktop && window.desktop.state && window.desktop.state.isAdmin) || window.IS_ADMIN || false;
      if (!isAdmin) {
        alert(this.t('autostart.admin_only_desc', 'Action réservée à l\'administrateur.'));
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

      const configData = {
        enabled: isMasterEnabled,
        apps: apps
      };

      this.state.autostartConfig = configData;
      window.SG_AUTOSTART_CONFIG = configData;

      try {
        const formData = new FormData();
        formData.append('action', 'save_autostart_settings');
        formData.append('config', JSON.stringify(configData));
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || window.SG_CSRF_TOKEN || window.CSRF_TOKEN || '';
        if (csrfToken) formData.append('csrf_token', csrfToken);

        const res = await fetch('api.php', {
          method: 'POST',
          body: formData,
          headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
        });

        const data = await res.json();
        if (data && data.success) {
          if (msgEl) {
            msgEl.textContent = '✅ ' + (this.t('autostart.save_success') || 'Configuration de démarrage enregistrée avec succès !');
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
          }
        } else {
          alert(data.error || 'Erreur lors de l\'enregistrement de la configuration de démarrage.');
        }
      } catch (err) {
        alert('Erreur réseau lors de la sauvegarde du démarrage.');
      }
    },

    // -------------------------------------------------------------
    // TAB 4: SYSTEM & ENVIRONMENT DIAGNOSTICS & UNIT TESTS
    // -------------------------------------------------------------
    renderSystemTab(container) {
      const diag = this.state.systemInfo || {};
      const currentLocale = (window.desktop && window.desktop.state && window.desktop.state.currentLocale) || 'fr';

      // Browser Environment detection
      const userAgent = navigator.userAgent || '';
      let browserName = 'Navigateur Web';
      if (userAgent.includes('Firefox')) browserName = 'Mozilla Firefox';
      else if (userAgent.includes('Edg/')) browserName = 'Microsoft Edge';
      else if (userAgent.includes('Chrome')) browserName = 'Google Chrome / Chromium';
      else if (userAgent.includes('Safari')) browserName = 'Apple Safari';
      else if (userAgent.includes('OPR') || userAgent.includes('Opera')) browserName = 'Opera';

      let osName = 'Système d\'Exploitation';
      if (userAgent.includes('Win')) osName = 'Windows';
      else if (userAgent.includes('Mac')) osName = 'macOS';
      else if (userAgent.includes('Linux')) osName = 'Linux';
      else if (userAgent.includes('Android')) osName = 'Android';
      else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) osName = 'iOS';

      const screenRes = `${window.screen.width} × ${window.screen.height} (${window.devicePixelRatio || 1}x)`;
      const colorScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Mode Sombre 🌙' : 'Mode Clair ☀️';

      const hasWebGL = (() => {
        try {
          const c = document.createElement('canvas');
          return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
        } catch (e) { return false; }
      })();

      let html = `
        <div class="settings-panel-header">
          <h2>⚙️ ${this.t('settings.tab_system', 'Système & Diagnostics')}</h2>
          <p>${this.t('settings.system_diagnostics_desc', 'Informations techniques sur l\'environnement serveur, le navigateur et la suite de tests.')}</p>
        </div>

        <!-- 1. System Language Selector (ListBox Dropdown with Flags) -->
        <div class="settings-group">
          <div class="settings-group-title">🌐 ${this.t('settings.lang_selector_title', 'Langue du Système (i18n)')}</div>
          <div class="settings-card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="settings-card-title">${this.t('nav.switch_lang', 'Changer la langue')}</div>
              <p class="settings-card-desc">${this.t('settings.lang_selector_desc', 'Basculement réactif instantané sans rechargement de page.')}</p>
            </div>
            <div class="settings-lang-select-wrap">
              <select id="settingsLangListBox" class="settings-lang-select">
                <option value="fr" ${currentLocale === 'fr' ? 'selected' : ''}>🇫🇷 Français (FR)</option>
                <option value="en" ${currentLocale === 'en' ? 'selected' : ''}>🇬🇧 English (EN)</option>
                <option value="ja" ${currentLocale === 'ja' ? 'selected' : ''}>🇯🇵 日本語 (JA)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 2. Server Diagnostics -->
        <div class="settings-group">
          <div class="settings-group-title">📊 ${this.t('settings.system_diagnostics', 'Diagnostics du Serveur')}</div>
          <div class="diagnostics-grid">
            <div class="diagnostic-badge-card">
              <span class="diag-title">Version PHP</span>
              <span class="diag-value">🐘 ${diag.php_version || 'PHP 8+'}</span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">Serveur Web</span>
              <span class="diag-value" style="font-size:0.85rem;color:#f8fafc;">${diag.server_software ? diag.server_software.split(' ')[0] : 'Web Server'}</span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">Extension GD (Images)</span>
              <span class="diag-value" style="color:${diag.gd_available !== false ? '#4ade80' : '#f87171'};">
                ${diag.gd_available !== false ? '✅ Active (WebP/AVIF)' : '❌ Manquante'}
              </span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">Extension EXIF</span>
              <span class="diag-value" style="color:${diag.exif_available !== false ? '#4ade80' : '#f87171'};">
                ${diag.exif_available !== false ? '✅ Active (GPS)' : '❌ Manquante'}
              </span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">Archives ZIP</span>
              <span class="diag-value" style="color:${diag.zip_available !== false ? '#4ade80' : '#f87171'};">
                ${diag.zip_available !== false ? '✅ Support ZipArchive' : '❌ Non disponible'}
              </span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">FFmpeg (Vignettes Vidéo)</span>
              <span class="diag-value" style="color:${diag.ffmpeg_available ? '#4ade80' : '#fbbf24'};">
                ${diag.ffmpeg_available ? '✅ Détecté' : '⚠️ Optionnel'}
              </span>
            </div>
          </div>
        </div>

        <!-- 3. Client & Browser Diagnostics -->
        <div class="settings-group">
          <div class="settings-group-title">💻 ${this.t('settings.browser_info_title', 'Navigateur & Environnement Client')}</div>
          <div class="diagnostics-grid">
            <div class="diagnostic-badge-card">
              <span class="diag-title">${this.t('settings.browser_name', 'Navigateur')}</span>
              <span class="diag-value" style="font-size:0.88rem;color:#f8fafc;">🌐 ${browserName}</span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">${this.t('settings.browser_os', 'Système d\'Exploitation')}</span>
              <span class="diag-value" style="font-size:0.88rem;color:#f8fafc;">💻 ${osName}</span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">${this.t('settings.browser_resolution', 'Résolution Écran')}</span>
              <span class="diag-value" style="font-size:0.88rem;color:#f8fafc;">📐 ${screenRes}</span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">${this.t('settings.browser_color_scheme', 'Thème Système')}</span>
              <span class="diag-value" style="font-size:0.88rem;color:#38bdf8;">${colorScheme}</span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">Moteur Graphique WebGL</span>
              <span class="diag-value" style="color:${hasWebGL ? '#4ade80' : '#fbbf24'};">
                ${hasWebGL ? '✅ Accéléré 3D' : '⚠️ Logiciel'}
              </span>
            </div>
            <div class="diagnostic-badge-card">
              <span class="diag-title">Stockage Local</span>
              <span class="diag-value" style="color:#4ade80;">
                ✅ LocalStorage Pris en charge
              </span>
            </div>
          </div>
        </div>

        <!-- 4. Unit Test Suite Runner -->
        <div class="settings-group">
          <div class="settings-group-title">🧪 ${this.t('settings.tests_title', 'Suite de Tests Automatisés')}</div>
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">${this.t('settings.tests_title', 'Tests Unitaires & Sécurité')}</div>
                <p class="settings-card-desc">${this.t('settings.tests_desc', 'Exécutez la suite complète de tests unitaires (Sécurité et Fonctionnalités Générales).')}</p>
              </div>
              <button type="button" id="settingsRunTestsBtn" class="pill-btn active" style="font-size:0.88rem;padding:0.65rem 1.1rem;">
                ${this.state.isTesting ? '⏳ ' + this.t('settings.tests_running', 'Exécution...') : this.t('settings.tests_run_btn', '▶ Lancer les Tests Unitaires')}
              </button>
            </div>

            <div id="settingsTestReportContainer" class="test-runner-container" style="${this.state.testResults ? 'display:block;' : 'display:none;'}">
              ${this.renderTestReportHTML(this.state.testResults)}
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Bind Language Listbox
      const langSelect = container.querySelector('#settingsLangListBox');
      if (langSelect) {
        langSelect.onchange = () => {
          const lang = langSelect.value;
          if (window.desktop && typeof window.desktop.setLocale === 'function') {
            window.desktop.setLocale(lang);
          } else if (window.I18nEngine) {
            window.I18nEngine.setLocale(lang);
          }
        };
      }

      // Bind Run Unit Tests
      const runTestsBtn = container.querySelector('#settingsRunTestsBtn');
      if (runTestsBtn) {
        runTestsBtn.onclick = () => this.runUnitTests(container);
      }
    },

    async runUnitTests(container) {
      this.state.isTesting = true;
      const runBtn = container.querySelector('#settingsRunTestsBtn');
      const reportContainer = container.querySelector('#settingsTestReportContainer');
      
      if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = '⏳ ' + this.t('settings.tests_running', 'Exécution des tests en cours...');
      }

      if (reportContainer) {
        reportContainer.style.display = 'block';
        reportContainer.innerHTML = '<div style="padding:1rem;text-align:center;color:#94a3b8;">⏳ Exécution des suites de tests (Sécurité et Fonctionnel)...</div>';
      }

      try {
        const res = await fetch('api.php?action=run_unit_tests');
        const json = await res.json();
        this.state.testResults = json;

        if (reportContainer) {
          reportContainer.innerHTML = this.renderTestReportHTML(json);
        }
      } catch (err) {
        if (reportContainer) {
          reportContainer.innerHTML = `<div class="admin-error-msg">❌ Erreur lors de l'exécution des tests: ${err.message}</div>`;
        }
      } finally {
        this.state.isTesting = false;
        if (runBtn) {
          runBtn.disabled = false;
          runBtn.textContent = this.t('settings.tests_run_btn', '▶ Lancer les Tests Unitaires');
        }
      }
    },

    renderTestReportHTML(data) {
      if (!data || !data.summary) return '';

      const s = data.summary;
      const suites = data.suites || [];

      return `
        <div class="test-summary-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">${s.all_passed ? '🎉' : '⚠️'}</span>
            <div>
              <div style="font-weight:700;font-size:0.95rem;color:${s.all_passed ? '#4ade80' : '#f87171'};">
                ${s.all_passed ? this.t('settings.tests_all_passed', 'Tous les tests ont réussi !') : `${s.failed} test(s) échoué(s)`}
              </div>
              <div style="font-size:0.8rem;color:#94a3b8;">${this.t('settings.tests_summary', 'Rapport d\'exécution')} • ${s.total} tests exécutés</div>
            </div>
          </div>
          <div class="test-summary-stats">
            <span class="test-stat-badge test-stat-pass">✅ ${s.passed} réussis</span>
            ${s.failed > 0 ? `<span class="test-stat-badge test-stat-fail">❌ ${s.failed} échoués</span>` : ''}
            <span class="test-stat-badge test-stat-time">⚡ ${s.duration_ms} ms</span>
          </div>
        </div>

        ${suites.map(suite => `
          <details class="test-suite-accordion" open>
            <summary>
              <span>${suite.name} (${suite.passed}/${suite.total})</span>
              <span class="test-stat-badge ${suite.failed === 0 ? 'test-stat-pass' : 'test-stat-fail'}" style="font-size:0.75rem;">
                ${suite.failed === 0 ? '100% Succès' : `${suite.failed} échec(s)`}
              </span>
            </summary>
            <div class="test-suite-body">
              ${(suite.tests || []).map(t => `
                <div class="test-case-row ${t.status === 'PASS' ? 'pass' : 'fail'}">
                  <span>${t.status === 'PASS' ? '✅' : '❌'} ${t.name}</span>
                  ${t.details ? `<span style="font-size:0.75rem;color:#fca5a5;">${t.details}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </details>
        `).join('')}
      `;
    },

    // -------------------------------------------------------------
    // TAB 4: PRIVACY & EMBEDDED COOKIES MANAGER
    // -------------------------------------------------------------
    renderPrivacyTab(container) {
      let cookieConsent = { necessary: true, preferences: true, cdn: true };
      try {
        const stored = localStorage.getItem('sg_cookie_consent');
        if (stored) cookieConsent = { ...cookieConsent, ...JSON.parse(stored) };
      } catch (e) {}

      let html = `
        <div class="settings-panel-header">
          <h2>🍪 ${this.t('settings.tab_privacy', 'Confidentialité & Cookies')}</h2>
          <p>${this.t('settings.privacy_desc', 'Gérez vos préférences relatives aux cookies et au stockage local du navigateur.')}</p>
        </div>

        <div class="settings-group">
          <div class="settings-group-title">🛡️ ${this.t('cookie.modal_title', 'Gestion des Préférences & Cookies')}</div>
          
          <div class="cookie-options-embedded-list">
            <!-- 1. Strictly Necessary -->
            <div class="cookie-option-embedded-card">
              <div class="cookie-option-text">
                <h4>
                  <span>${this.t('cookie.opt_necessary_title', '1. Cookies Strictement Nécessaires')}</span>
                  <span class="cookie-option-badge cookie-badge-req">${this.t('cookie.opt_necessary_badge', 'Toujours actif')}</span>
                </h4>
                <p>${this.t('cookie.opt_necessary_desc', 'Indispensables au fonctionnement sécurisé de la galerie : maintien de la session d\'administration, protection contre les attaques CSRF et accès aux dossiers protégés par mot de passe.')}</p>
              </div>
              <div>
                <input type="checkbox" id="setCookieOptNecessary" checked disabled style="width:18px;height:18px;accent-color:var(--accent-primary,#6366f1);" />
              </div>
            </div>

            <!-- 2. Local Preferences -->
            <div class="cookie-option-embedded-card">
              <div class="cookie-option-text">
                <h4>
                  <span>${this.t('cookie.opt_pref_title', '2. Préférences d\'Affichage & Favoris')}</span>
                  <span class="cookie-option-badge cookie-badge-opt">${this.t('cookie.opt_pref_badge', 'Optionnel')}</span>
                </h4>
                <p>${this.t('cookie.opt_pref_desc', 'Permet à votre navigateur d\'enregistrer localement vos favoris ❤️, vos fonds d\'écran et votre thème visuel préféré.')}</p>
              </div>
              <div>
                <input type="checkbox" id="setCookieOptPreferences" ${cookieConsent.preferences ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent-primary,#6366f1);cursor:pointer;" />
              </div>
            </div>

            <!-- 3. CDN Resources -->
            <div class="cookie-option-embedded-card">
              <div class="cookie-option-text">
                <h4>
                  <span>${this.t('cookie.opt_cdn_title', '3. Typographies & Cartographie (CDN)')}</span>
                  <span class="cookie-option-badge cookie-badge-opt">${this.t('cookie.opt_cdn_badge', 'Optionnel')}</span>
                </h4>
                <p>${this.t('cookie.opt_cdn_desc', 'Chargement des polices stylisées Google Fonts et des cartes interactives OpenStreetMap / Leaflet sans pistage publicitaire.')}</p>
              </div>
              <div>
                <input type="checkbox" id="setCookieOptCdn" ${cookieConsent.cdn ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent-primary,#6366f1);cursor:pointer;" />
              </div>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:1rem;">
            <button type="button" id="setCookieSaveBtn" class="pill-btn active" style="flex:1;justify-content:center;padding:0.75rem;">
              💾 ${this.t('cookie.save_preferences', 'Enregistrer mes choix')}
            </button>
          </div>
          <div id="setCookieSuccessMsg" class="admin-success-msg" style="display:none;margin-top:0.75rem;"></div>
        </div>

        <div class="settings-group">
          <div class="settings-group-title">🗑️ ${this.t('settings.reset_defaults', 'Réinitialisation des Données Locales')}</div>
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Cache & Raccourcis du Bureau</div>
                <p class="settings-card-desc">Réinitialisez l'agencement du bureau, les thèmes mémorisés et les favoris locaux.</p>
              </div>
              <button type="button" id="settingsResetStorageBtn" class="pill-btn" style="color:#f87171;border-color:rgba(239,68,68,0.3);">
                🗑️ Réinitialiser le cache local
              </button>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Bind Save Cookie Preferences
      const saveCookieBtn = container.querySelector('#setCookieSaveBtn');
      if (saveCookieBtn) {
        saveCookieBtn.onclick = () => {
          const pref = container.querySelector('#setCookieOptPreferences');
          const cdn = container.querySelector('#setCookieOptCdn');
          const payload = {
            necessary: true,
            preferences: pref ? pref.checked : true,
            cdn: cdn ? cdn.checked : true,
            timestamp: Date.now()
          };
          localStorage.setItem('sg_cookie_consent', JSON.stringify(payload));
          
          // Hide floating cookie banner if present
          const banner = document.getElementById('cookieConsentBanner');
          if (banner) banner.style.display = 'none';

          const msgEl = container.querySelector('#setCookieSuccessMsg');
          if (msgEl) {
            msgEl.textContent = '✅ ' + this.t('settings.cookie_saved', 'Préférences de confidentialité enregistrées avec succès !');
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
          }
          if (window.desktop && typeof window.desktop.showToast === 'function') {
            window.desktop.showToast(this.t('settings.cookie_saved', 'Préférences cookies enregistrées !'), 'success');
          }
        };
      }

      // Bind Reset Storage
      const resetBtn = container.querySelector('#settingsResetStorageBtn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          if (confirm(this.t('settings.privacy_reset_prompt', 'Réinitialiser les préférences locales et recharger la page ?'))) {
            localStorage.removeItem('sg_desktop_wallpaper');
            localStorage.removeItem('sg_active_theme');
            localStorage.removeItem('sg_favorites');
            localStorage.removeItem('sg_view_mode');
            localStorage.removeItem('sg_cookie_consent');
            window.location.reload();
          }
        };
      }
    },

    // -------------------------------------------------------------
    // TAB 5: PLUGINS & APPLICATION MODULES (Extensible)
    // -------------------------------------------------------------
    renderPluginsTab(container) {
      const apps = (window.sys && window.sys.appManager) ? window.sys.appManager.getAllApps() : [];

      let html = `
        <div class="settings-panel-header">
          <h2>🧩 ${this.t('settings.tab_plugins', 'Applications & Modules')}</h2>
          <p>${this.t('settings.extensible_desc', 'Applications modulaires découvertes et enregistrées dans le système WebOS.')}</p>
        </div>

        <div class="settings-group">
          <div class="settings-apps-list">
            ${apps.map(app => `
              <div class="settings-app-item">
                <div class="settings-app-left">
                  <span class="settings-app-icon">${app.icon || '🗔'}</span>
                  <div>
                    <div class="settings-app-name">${app.name} <span style="font-size:0.75rem;color:#64748b;font-weight:normal;">(${app.id})</span></div>
                    <div class="settings-app-desc">${app.description || 'Module applicatif WebOS'}</div>
                  </div>
                </div>
                <button type="button" class="settings-app-launch-btn" data-launch-app="${app.id}">
                  ▶ Lancer
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      container.innerHTML = html;

      const launchBtns = container.querySelectorAll('[data-launch-app]');
      launchBtns.forEach(btn => {
        btn.onclick = () => {
          const aId = btn.dataset.launchApp;
          if (window.sys && window.sys.appManager) {
            window.sys.appManager.launchApp(aId);
          }
        };
      });
    },

    // -------------------------------------------------------------
    // ACTIONS & DATA HELPERS
    // -------------------------------------------------------------
    async loadPermissions() {
      try {
        const res = await fetch('api.php?action=get_permissions');
        const json = await res.json();
        if (json.success && json.permissions) {
          this.state.permissions = json.permissions;
          if (this.activeTab === 'security') {
            const container = document.querySelector('#settingsContentArea');
            if (container) this.renderSecurityTab(container);
          }
        }
      } catch (err) {
        console.error('[SettingsApp] Error loading permissions:', err);
      }
    },

    async savePermissions(container) {
      const csrfToken = window.CSRF_TOKEN || (window.desktop && window.desktop.state && window.desktop.state.csrfToken) || '';
      const updatedPerms = {};

      PERMISSION_KEYS.forEach(p => {
        const chk = container.querySelector(`#set_perm_${p.key}`);
        if (chk) updatedPerms[p.key] = chk.checked;
      });

      try {
        const formData = new FormData();
        formData.append('action', 'save_permissions');
        formData.append('csrf_token', csrfToken);
        formData.append('permissions', JSON.stringify(updatedPerms));

        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          body: formData
        });
        const json = await res.json();

        const msgEl = container.querySelector('#settingsPermsMsg');
        if (json.success) {
          this.state.permissions = updatedPerms;
          if (msgEl) {
            msgEl.textContent = '✅ ' + this.t('admin.perm_save_success', 'Matrice de droits mise à jour avec succès !');
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
          }
          if (window.desktop && typeof window.desktop.showToast === 'function') {
            window.desktop.showToast(this.t('admin.perm_save_success', 'Matrice de droits enregistrée !'), 'success');
          }
        } else {
          alert(json.error || 'Erreur lors de l\'enregistrement des permissions');
        }
      } catch (err) {
        alert(`Erreur: ${err.message}`);
      }
    },

    async changePassword(container) {
      const input = container.querySelector('#settingsNewPassInput');
      const msgEl = container.querySelector('#settingsPassMsg');
      if (!input || !input.value) return;

      const csrfToken = window.CSRF_TOKEN || (window.desktop && window.desktop.state && window.desktop.state.csrfToken) || '';

      try {
        const formData = new FormData();
        formData.append('action', 'change_password');
        formData.append('csrf_token', csrfToken);
        formData.append('new_password', input.value);

        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          body: formData
        });
        const json = await res.json();

        if (json.success) {
          input.value = '';
          if (msgEl) {
            msgEl.innerHTML = '<div class="admin-success-msg">✅ ' + (json.message || 'Mot de passe modifié avec succès') + '</div>';
            setTimeout(() => { msgEl.innerHTML = ''; }, 4000);
          }
        } else {
          if (msgEl) {
            msgEl.innerHTML = '<div class="admin-error-msg">❌ ' + (json.error || 'Erreur lors du changement de mot de passe') + '</div>';
          }
        }
      } catch (err) {
        if (msgEl) {
          msgEl.innerHTML = `<div class="admin-error-msg">❌ Erreur: ${err.message}</div>`;
        }
      }
    },

    async loadSystemInfo() {
      try {
        const res = await fetch('api.php?action=get_system_info');
        const json = await res.json();
        if (json.success && json.system_info) {
          this.state.systemInfo = json.system_info;
          if (this.activeTab === 'system') {
            const container = document.querySelector('#settingsContentArea');
            if (container) this.renderSystemTab(container);
          }
        }
      } catch (err) {
        console.error('[SettingsApp] Error loading system info:', err);
      }
    },

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
    },

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
    },

    applySavedWallpaper() {
      const saved = localStorage.getItem('sg_desktop_wallpaper') || 'nebula';
      if (saved.startsWith('custom:')) {
        const custom = saved.replace('custom:', '');
        this.setCustomWallpaper(custom);
      } else {
        this.setWallpaper(saved);
      }
    },

    setTheme(themeId) {
      const theme = THEMES.find(t => t.id === themeId);
      if (!theme) return;

      this.state.activeTheme = themeId;
      localStorage.setItem('sg_active_theme', themeId);
      document.cookie = `sg_theme=${encodeURIComponent(themeId)};path=/;max-age=31536000;SameSite=Lax`;

      // 1. Update data-theme attributes on html, body, and all active windows
      document.documentElement.setAttribute('data-theme', themeId);
      document.body.setAttribute('data-theme', themeId);
      document.querySelectorAll('.webos-window').forEach(win => win.setAttribute('data-theme', themeId));

      // 2. Update dynamic CSS variables directly in root document style
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

      // 3. Update style element
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

      // 4. Update stylesheet link if present
      const link = document.getElementById('activeThemeStylesheet');
      if (link) {
        link.href = `themes/${themeId}/theme.css?v=${Date.now()}`;
      }

      if (window.desktop && typeof window.desktop.showToast === 'function') {
        window.desktop.showToast(`Thème « ${theme.name} » appliqué`, 'info');
      }

      if (window.EventBus) {
        window.EventBus.emit('theme:changed', { themeId });
      }
    },

    applySavedTheme() {
      const saved = localStorage.getItem('sg_active_theme');
      if (saved) {
        this.setTheme(saved);
      }
    }
  };

  // Auto-register and expose
  window.SettingsApp = SettingsApp;

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SettingsApp.init());
  } else {
    SettingsApp.init();
  }

})(window);
