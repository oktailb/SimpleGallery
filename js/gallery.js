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
      const initialConfig = window.SG_I18N_CONFIG || {};
      this.state.availableLocales = initialConfig.locales || {};
      this.state.currentLocale = initialConfig.default || 'fr';
      this.state.translations = initialConfig.translations || {};
      this.state.translationsCache[this.state.currentLocale] = this.state.translations;

      let storedLocale = null;
      try {
        storedLocale = localStorage.getItem('sg_locale');
      } catch (e) {}

      if (storedLocale && this.state.availableLocales[storedLocale] && storedLocale !== this.state.currentLocale) {
        this.setLocale(storedLocale);
      } else {
        this.applyTranslations();
      }

      if (this.el.langSelectorBtn) {
        this.el.langSelectorBtn.onclick = (e) => {
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
        if (this.el.langSelectorContainer && !this.el.langSelectorContainer.contains(e.target)) {
          this.closeLangDropdown();
        }
      });
    }

    toggleLangDropdown() {
      if (!this.el.langDropdownMenu) return;
      const isVisible = this.el.langDropdownMenu.style.display === 'flex';
      this.el.langDropdownMenu.style.display = isVisible ? 'none' : 'flex';
    }

    closeLangDropdown() {
      if (this.el.langDropdownMenu) this.el.langDropdownMenu.style.display = 'none';
    }

    t(key, replacements = {}) {
      if (window.I18nEngine) return window.I18nEngine.t(key, replacements);
      let str = (this.state && this.state.translations && this.state.translations[key]) ? this.state.translations[key] : key;
      if (typeof str === 'string' && replacements && typeof replacements === 'object') {
        Object.entries(replacements).forEach(([k, val]) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), val);
        });
      }
      return str;
    }

    async setLocale(code) {
      if (!this.state.availableLocales[code]) return;
      this.state.currentLocale = code;

      if (this.state.translationsCache[code]) {
        this.state.translations = this.state.translationsCache[code];
        this.finishLocaleChange(code);
      } else {
        try {
          const res = await fetch(`locales/${encodeURIComponent(code)}.json?t=${Date.now()}`);
          if (res.ok) {
            const json = await res.json();
            this.state.translations = json.translations || {};
            this.state.translationsCache[code] = this.state.translations;
          }
        } catch (e) {}
        this.finishLocaleChange(code);
      }
    }

    finishLocaleChange(code) {
      try {
        localStorage.setItem('sg_locale', code);
      } catch (e) {}

      document.documentElement.lang = code;

      const meta = this.state.availableLocales[code];
      if (meta) {
        if (this.el.currentLangFlag) this.el.currentLangFlag.innerHTML = meta.flag || '🌐';
        if (this.el.currentLangCode) this.el.currentLangCode.textContent = (meta.code || code).toUpperCase();
      }

      document.querySelectorAll('.lang-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === code);
      });

      this.applyTranslations();

      // Notify running apps of locale change
      if (window.explorerApp && typeof window.explorerApp.bindMenuBar === 'function') {
        window.explorerApp.bindMenuBar();
        window.explorerApp.applyFilterAndRender();
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
      if (this.el.adminBtn) {
        this.el.adminBtn.onclick = () => this.openAdminModal();
      }
      if (this.el.adminModalCloseBtn) {
        this.el.adminModalCloseBtn.onclick = () => this.closeAdminModal();
      }
      if (this.el.adminModal) {
        this.el.adminModal.onclick = (e) => {
          if (e.target === this.el.adminModal) this.closeAdminModal();
        };
      }
      if (this.el.adminLoginForm) {
        this.el.adminLoginForm.onsubmit = (e) => {
          e.preventDefault();
          this.loginAdmin();
        };
      }
      if (this.el.adminLogoutBtn) {
        this.el.adminLogoutBtn.onclick = () => this.logoutAdmin();
      }
      if (this.el.changePasswordForm) {
        this.el.changePasswordForm.onsubmit = (e) => {
          e.preventDefault();
          this.changeAdminPassword();
        };
      }
    }

    openAdminModal() {
      if (!this.el.adminModal) return;
      this.el.adminModal.style.display = 'block';
      this.el.adminModal.classList.add('open');
      if (this.el.adminPasswordInput) {
        this.el.adminPasswordInput.value = '';
        setTimeout(() => this.el.adminPasswordInput.focus(), 50);
      }
    }

    closeAdminModal() {
      if (!this.el.adminModal) return;
      this.el.adminModal.style.display = 'none';
      this.el.adminModal.classList.remove('open');
    }

    async loginAdmin() {
      if (!this.el.adminPasswordInput) return;
      const password = this.el.adminPasswordInput.value;
      try {
        const formData = new FormData();
        formData.append('action', 'admin_login');
        formData.append('password', password);

        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          this.state.isAdmin = true;
          this.closeAdminModal();
          this.showToast(this.t('admin.login_success') || 'Connexion administrateur réussie', 'success');
          if (window.explorerApp) {
            window.explorerApp.loadDirectory(window.explorerApp.state.currentPath);
          }
        } else {
          if (this.el.adminLoginError) {
            this.el.adminLoginError.textContent = json.error || 'Mot de passe incorrect';
            this.el.adminLoginError.style.display = 'block';
          }
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    async logoutAdmin() {
      try {
        const formData = new FormData();
        formData.append('action', 'admin_logout');
        await fetch('api.php', { method: 'POST', body: formData });
        this.state.isAdmin = false;
        this.closeAdminModal();
        this.showToast('Déconnexion réussie', 'info');
        if (window.explorerApp) {
          window.explorerApp.loadDirectory(window.explorerApp.state.currentPath);
        }
      } catch (err) {}
    }

    async changeAdminPassword() {
      if (!this.el.newAdminPasswordInput) return;
      const newPassword = this.el.newAdminPasswordInput.value;
      if (!newPassword) return;

      try {
        const formData = new FormData();
        formData.append('action', 'change_password');
        formData.append('new_password', newPassword);

        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          this.el.newAdminPasswordInput.value = '';
          if (this.el.adminChangePassMsg) {
            this.el.adminChangePassMsg.textContent = '✅ ' + (json.message || 'Mot de passe modifié');
            this.el.adminChangePassMsg.style.display = 'block';
          }
        } else {
          this.showToast(json.error || 'Erreur lors du changement de mot de passe', 'error');
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
