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
    }

    initElements() {
      this.el = {
        webosDesktop: document.getElementById('webosDesktop'),
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
        if (typeof window.explorerApp.bindMenuBar === 'function') {
          window.explorerApp.bindMenuBar();
        }
        if (typeof window.explorerApp.applyFilterAndRender === 'function') {
          window.explorerApp.applyFilterAndRender();
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

          this.loadAdminPermissions();

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
      const settingsModal = document.getElementById('cookieSettingsModal');
      const openSettingsBtn = document.getElementById('openCookieSettingsBtn');
      const acceptAllBtn = document.getElementById('cookieAcceptAllBtn');
      const refuseBtn = document.getElementById('cookieRefuseBtn');
      const customizeBtn = document.getElementById('cookieCustomizeBtn');
      const closeSettingsBtn = document.getElementById('cookieSettingsCloseBtn');
      const saveSettingsBtn = document.getElementById('cookieSettingsSaveBtn');

      const isConsentGiven = localStorage.getItem('sg_cookie_consent');
      if (!isConsentGiven && banner) {
        banner.style.display = 'flex';
      }

      if (openSettingsBtn && settingsModal) {
        openSettingsBtn.onclick = () => { settingsModal.style.display = 'block'; };
      }
      if (closeSettingsBtn && settingsModal) {
        closeSettingsBtn.onclick = () => { settingsModal.style.display = 'none'; };
      }
      if (acceptAllBtn && banner) {
        acceptAllBtn.onclick = () => {
          localStorage.setItem('sg_cookie_consent', 'all');
          banner.style.display = 'none';
        };
      }
      if (refuseBtn && banner) {
        refuseBtn.onclick = () => {
          localStorage.setItem('sg_cookie_consent', 'essential');
          banner.style.display = 'none';
        };
      }
      if (customizeBtn && settingsModal) {
        customizeBtn.onclick = () => {
          if (banner) banner.style.display = 'none';
          settingsModal.style.display = 'block';
        };
      }
      if (saveSettingsBtn && settingsModal) {
        saveSettingsBtn.onclick = () => {
          localStorage.setItem('sg_cookie_consent', 'custom');
          settingsModal.style.display = 'none';
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

      // Background override
      if (this.el.webosDesktop && overrides.background) {
        if (overrides.background.startsWith('#') || overrides.background.startsWith('rgb')) {
          this.el.webosDesktop.style.backgroundColor = overrides.background;
          this.el.webosDesktop.style.backgroundImage = 'none';
        } else {
          this.el.webosDesktop.style.backgroundImage = `url(${overrides.background})`;
          this.el.webosDesktop.style.backgroundSize = 'cover';
          this.el.webosDesktop.style.backgroundPosition = 'center';
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
