/**
 * SimpleGallery WebOS - Tribune Libre / Bouchot Client (`apps/tribune`)
 * Multi-board support, Horloges tracking, Totoz engine, Trollometer, BAK archive & Identity Auth Manager
 */

(function (window) {
  'use strict';

  class TribuneApp {
    constructor() {
      this.winId = 'win-tribune';
      this.boards = this.loadBoards();
      this.currentBoard = localStorage.getItem('tribune_current_board') || 'local';
      if (!this.boards[this.currentBoard]) {
        this.currentBoard = Object.keys(this.boards)[0] || 'local';
      }
      this.boardAuth = this.loadBoardAuth();
      this.posts = [];
      this.boardPosts = {};
      this.bakLogins = new Set(this.loadBAKLogins());
      this.bakEnabled = localStorage.getItem('tribune_bak_enabled') !== 'false';
      this.nsfwEnabled = localStorage.getItem('tribune_nsfw_enabled') === 'true';
      this.soundEnabled = true;
      this.pollInterval = null;
      this.commonTotoz = ['totoz', 'pan', 'deja-vu', 'mouais', 'lol', 'gnan', 'tagada', 'duck', 'paf', 'hop'];
      this.totozCache = this.loadTotozCache();
      this.readCalls = this.loadReadCalls();
      this.urlPreviewCache = {};
      this.urlPreviewPending = new Set();
      this.activeHoverUrl = null;
      this.activeTotozQuery = null;
      this.totozImageCache = new Set();
      this.activeTelemetryMetric = 'posts';
      this.container = null;

      // Detect initial pseudo from WebOS environment or localStorage
      this.userLogin = this.detectUserIdentity();

      // EventBus listeners for i18n & theme propagation
      if (window.EventBus) {
        window.EventBus.on('locale:changed', () => this.onLocaleChanged());
        window.EventBus.on('theme:changed', (data) => this.onThemeChanged(data?.themeId || data?.theme || data));
      }

      // Listen for OAuth2 callback postMessage
      if (!window._tribuneOauthListenerBound) {
        window.addEventListener('message', (event) => {
          let data = event.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (e) {
              return;
            }
          }
          if (data && typeof data === 'object' && data.type === 'tribune_oauth_success' && data.board_id) {
            const targetBoard = data.board_id;
            this.boardAuth[targetBoard] = this.boardAuth[targetBoard] || {};
            if (data.access_token) {
              this.boardAuth[targetBoard].cookie = data.access_token;
            }
            if (data.login) {
              this.userLogin = data.login;
              localStorage.setItem('tribune_user_login', data.login);
            }
            this.saveBoardAuth();
            if (this.currentBoard === targetBoard && this.container) {
              const cookieInput = this.container.querySelector('#identityCookieInput');
              const pseudoInput = this.container.querySelector('#identityPseudoInput');
              if (cookieInput && data.access_token) cookieInput.value = data.access_token;
              if (pseudoInput && data.login) pseudoInput.value = data.login;
              const oauthStatus = this.container.querySelector('#identityOAuthStatus');
              if (oauthStatus) {
                oauthStatus.innerHTML = '✓ ' + (this.t('tribune.oauth_connected') || 'Token API / OAuth Actif');
                oauthStatus.style.color = '#34d399';
              }
            }
            alert('Connexion OAuth2 réussie avec ' + (this.boards[targetBoard]?.name || targetBoard) + ' ! 🔑');
          }
        });
        window._tribuneOauthListenerBound = true;
      }
    }

    t(key, replacements = {}) {
      if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
        return window.sys.i18n.t(key, replacements);
      }
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, replacements);
      }
      if (window.desktop && typeof window.desktop.t === 'function') {
        return window.desktop.t(key, replacements);
      }
      return key;
    }

    detectUserIdentity() {
      const saved = localStorage.getItem('tribune_user_login');
      if (saved && saved.trim() !== '') return saved.trim();

      if (window.SG_CURRENT_USER && window.SG_CURRENT_USER.login) {
        return window.SG_CURRENT_USER.login;
      }

      const metaUser = document.querySelector('meta[name="user-login"]')?.content;
      if (metaUser && metaUser.trim() !== '') {
        return metaUser.trim();
      }

      return 'Coincoin';
    }

    loadTotozCache() {
      try {
        const raw = localStorage.getItem('tribune_totoz_cache');
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    saveTotozCache() {
      try {
        localStorage.setItem('tribune_totoz_cache', JSON.stringify(this.totozCache));
      } catch (e) {}
    }

    loadReadCalls() {
      try {
        const raw = localStorage.getItem('tribune_read_calls');
        return new Set(raw ? JSON.parse(raw) : []);
      } catch (e) {
        return new Set();
      }
    }

    saveReadCalls() {
      try {
        localStorage.setItem('tribune_read_calls', JSON.stringify(Array.from(this.readCalls)));
      } catch (e) {}
    }

    updateWindowTitle(unreadCount = 0) {
      const title = this.t('tribune.title') || "Tribune Libre";
      const fullTitle = unreadCount > 0 ? `🔔 (${unreadCount}) 🦆 ${title}` : `🦆 ${title}`;

      if (this.window && typeof this.window.setTitle === 'function') {
        this.window.setTitle(fullTitle);
      } else if (window.WindowManager && typeof window.WindowManager.setTitle === 'function') {
        window.WindowManager.setTitle(this.winId, fullTitle);
      }
    }

    open(params = {}) {
      if (!window.WindowManager) return;

      const title = this.t('tribune.title') || "Tribune Libre";
      let win = window.WindowManager.windows.get(this.winId);

      if (win) {
        window.WindowManager.focusWindow(this.winId);
        this.fetchPosts(false, true);
        return win;
      }

      const defaultW = Math.min(920, Math.max(540, Math.round(window.innerWidth * 0.72)));
      const defaultH = Math.min(660, Math.max(460, Math.round(window.innerHeight * 0.72)));

      const wrapper = document.createElement('div');
      wrapper.className = 'tribune-window-wrapper';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';

      win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'tribune',
        appName: title,
        title: `🦆 ${title}`,
        icon: '🦆',
        width: defaultW,
        height: defaultH,
        content: wrapper,
        onClose: () => {
          this.stopSSE();
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.pollInterval = null;
          this.container = null;
          this.window = null;
        }
      });

      this.init(wrapper, win);
      return win;
    }

    async init(container, win) {
      this.container = container;
      this.window = win;

      if (!this.boardsLoaded) {
        await this.loadBoardsAsync();
        this.boardsLoaded = true;
      }

      this.renderUI();
      this.bindEvents();
      this.startSSE();
      this.fetchPosts(this.currentBoard, false, true);
      this.refreshScheduledList();

      // Auto-poll remote tribunes every 10s asynchronously; SSE streams local board instantly
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(() => {
        if (!this.container) return;
        const bKeys = Object.keys(this.boards).filter(k => k !== 'local' || !this.sseSource);
        Promise.allSettled(bKeys.map(bKey => this.fetchPosts(bKey, true, false)));
      }, 10000);
    }

    startSSE() {
      if (!window.EventSource || this.sseSource || !this.container) return;

      try {
        this.sseSource = new EventSource('api.php?action=tribune_stream');
        this.sseSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.success && Array.isArray(data.messages)) {
              this.boardPosts['local'] = data.messages;
              if (this.currentBoard === 'local') {
                this.posts = data.messages;
                this.renderPosts(false);
              }
            }
          } catch (e) {}
        };
        this.sseSource.onerror = () => {};
      } catch (e) {}
    }

    stopSSE() {
      if (this.sseSource) {
        try {
          this.sseSource.close();
        } catch (e) {}
        this.sseSource = null;
      }
    }

    parseLocalDateTime(val) {
      if (!val) return null;
      const parts = val.split('T');
      if (parts.length !== 2) {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      const [dPart, tPart] = parts;
      const [year, month, day] = dPart.split('-').map(Number);
      const [hours, minutes, seconds] = tPart.split(':').map(Number);
      if (!year || !month || !day) {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
    }

    updateScheduleTimezonePreview() {
      if (!this.container) return;
      const dtInput = this.container.querySelector('#tribuneScheduleDatetime');
      const userTimeElem = this.container.querySelector('#tzUserTime');
      const parisTimeElem = this.container.querySelector('#tzParisTime');
      if (!dtInput || !userTimeElem || !parisTimeElem) return;

      const val = dtInput.value;
      if (!val) {
        userTimeElem.textContent = '--:--:--';
        parisTimeElem.textContent = '--:--:--';
        return;
      }

      const dt = this.parseLocalDateTime(val);
      if (!dt || isNaN(dt.getTime())) {
        userTimeElem.textContent = 'Invalide';
        parisTimeElem.textContent = 'Invalide';
        return;
      }

      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
      userTimeElem.textContent = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ` (${userTz})`;

      try {
        const parisStr = new Intl.DateTimeFormat('fr-FR', {
          timeZone: 'Europe/Paris',
          dateStyle: 'short',
          timeStyle: 'medium'
        }).format(dt);
        parisTimeElem.textContent = parisStr + ' (Paris)';
      } catch (e) {
        parisTimeElem.textContent = dt.toLocaleTimeString() + ' (Paris)';
      }
    }

    async refreshScheduledList() {
      if (!this.container) return;
      const badge = this.container.querySelector('#tribuneScheduleBadgeCount');
      const listView = this.container.querySelector('#tribuneScheduleListView');

      try {
        const res = await fetch('api.php?action=tribune_scheduled_list');
        const data = await res.json();
        if (data && data.success && Array.isArray(data.scheduled)) {
          const count = data.scheduled.length;
          if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
          }

          if (listView && listView.style.display !== 'none') {
            if (count === 0) {
              listView.innerHTML = `<div style="color:var(--text-muted, #94a3b8); font-size:0.75rem; text-align:center; padding:8px;">${this.t('tribune.scheduled_empty') || 'Aucun message programmé en attente.'}</div>`;
            } else {
              listView.innerHTML = data.scheduled.map(item => {
                const dt = new Date((item.scheduled_at || 0) * 1000);
                const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return `
                  <div class="scheduled-item-card">
                    <div class="scheduled-item-text">
                      <strong>[${this.escapeHtml(item.board || 'local')}]</strong> ${this.escapeHtml(item.message)}
                      <div style="font-size:0.7rem; color:#c084fc;">⏰ ${timeStr}</div>
                    </div>
                    <button type="button" class="scheduled-cancel-btn" data-id="${item.id}" title="${this.t('tribune.cancel') || 'Annuler'}">✖</button>
                  </div>
                `;
              }).join('');
            }
          }
        }
      } catch (e) {}
    }

    onLocaleChanged() {
      this.updateWindowTitle(0);
      if (this.container) {
        this.renderUI();
        this.bindEvents();
        this.renderPosts(false);
      }
    }

    onThemeChanged() {
      if (this.container) {
        this.renderUI();
        this.bindEvents();
        this.renderPosts(false);
      }
    }

    loadBAKLogins() {
      try {
        const raw = localStorage.getItem('tribune_bak_logins');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    saveBAKLogins() {
      try {
        localStorage.setItem('tribune_bak_logins', JSON.stringify(Array.from(this.bakLogins)));
      } catch (e) {}
    }

    toggleBAKLogin(login) {
      if (!login) return;
      const lower = login.trim().toLowerCase();
      if (this.bakLogins.has(lower)) {
        this.bakLogins.delete(lower);
      } else {
        this.bakLogins.add(lower);
      }
      this.saveBAKLogins();
      if (this.container) {
        this.renderUI();
        this.bindEvents();
        this.renderPosts(false);
      }
    }

    renderBAKList() {
      if (!this.bakLogins || this.bakLogins.size === 0) {
        return `<div style="color:var(--text-muted, #94a3b8); font-size:0.78rem; text-align:center; padding:12px;">${this.t('tribune.bak_empty') || 'Aucun login bloqué dans la Boîte à Con (BAK). Saisissez un pseudo ci-dessus pour le bloquer.'}</div>`;
      }

      return Array.from(this.bakLogins).map(login => `
        <div class="bak-login-chip" style="display:inline-flex; align-items:center; gap:6px; background:rgba(239, 68, 68, 0.15); border:1px solid rgba(239, 68, 68, 0.3); padding:3px 8px; border-radius:6px; margin:2px; font-size:0.8rem; color:#ef4444;">
          <span>🚫 ${this.escapeHtml(login)}</span>
          <button class="bak-chip-remove-btn" data-login="${this.escapeHtml(login)}" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:0.8rem; padding:0 2px;" title="Débloquer ${this.escapeHtml(login)}">✖</button>
        </div>
      `).join('');
    }

    async loadBoardsAsync() {
      const defaultBoards = {
        local: { name: 'Tribune Locale', type: 'local', auth_type: 'none', url: '', icon: '🏠', cookie_help: 'Session locale SimpleGallery.' },
        linuxfr: {
          name: 'LinuxFR',
          type: 'remote_xml',
          auth_type: 'oauth2',
          url: 'https://linuxfr.org/board/index.xml',
          post_url: 'https://linuxfr.org/api/v1/board',
          post_param: 'message',
          extra_params: {},
          extract_csrf: false,
          oauth: {
            authorize_url: 'https://linuxfr.org/api/oauth/authorize',
            token_url: 'https://linuxfr.org/api/oauth/token',
            scope: 'account board',
            client_id: '',
            client_secret: ''
          },
          icon: '🐧',
          cookie_help: "Connectez-vous via OAuth2 ou collez un Jeton d'accès API (Bearer token)."
        }
      };

      try {
        const res = await fetch(`api.php?action=tribune_boards_get&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.boards && typeof data.boards === 'object') {
            this.boards = { ...defaultBoards, ...data.boards };
            if (this.container) {
              this.renderUI();
              this.bindEvents();
              this.renderPosts(false);
            }
            return;
          }
        }
      } catch (e) {}

      try {
        const raw = localStorage.getItem('tribune_boards');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'object' && parsed !== null) {
            this.boards = { ...defaultBoards, ...parsed };
            return;
          }
        }
      } catch (e) {}

      this.boards = defaultBoards;
    }

    loadBoards() {
      const defaultBoards = {
        local: { name: 'Tribune Locale', type: 'local', auth_type: 'none', url: '', icon: '🏠', cookie_help: 'Session locale SimpleGallery.' },
        linuxfr: {
          name: 'LinuxFR',
          type: 'remote_xml',
          auth_type: 'oauth2',
          url: 'https://linuxfr.org/board/index.xml',
          post_url: 'https://linuxfr.org/api/v1/board',
          post_param: 'message',
          extra_params: {},
          extract_csrf: false,
          oauth: {
            authorize_url: 'https://linuxfr.org/api/oauth/authorize',
            token_url: 'https://linuxfr.org/api/oauth/token',
            scope: 'account board',
            client_id: '',
            client_secret: ''
          },
          icon: '🐧',
          cookie_help: "Connectez-vous via OAuth2 ou collez un Jeton d'accès API (Bearer token)."
        }
      };

      try {
        const raw = localStorage.getItem('tribune_boards');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'object' && parsed !== null) {
            return { ...defaultBoards, ...parsed };
          }
        }
      } catch (e) {}

      return defaultBoards;
    }

    async saveBoards() {
      try {
        localStorage.setItem('tribune_boards', JSON.stringify(this.boards));
      } catch (e) {}

      try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || window.SG_CSRF_TOKEN || '';
        await fetch('api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            action: 'tribune_boards_save',
            boards: this.boards
          })
        });
      } catch (e) {}
    }

    loadBoardAuth() {
      try {
        return JSON.parse(localStorage.getItem('tribune_board_auth')) || {};
      } catch (e) {
        return {};
      }
    }

    saveBoardAuth() {
      try {
        localStorage.setItem('tribune_board_auth', JSON.stringify(this.boardAuth));
      } catch (e) {}
    }

    renderUI() {
      if (!this.container) return;

      this.lastPostsSig = null;

      const userLogin = this.userLogin || 'Coincoin';
      const auth = this.boardAuth[this.currentBoard] || {};
      const currentUa = auth.user_agent || navigator.userAgent || 'Mozilla/5.0 (SimpleGallery Tribune)';
      const currentCookie = auth.cookie || '';
      const currentBoardConfig = this.boards[this.currentBoard] || {};
      const cookieHelpText = currentBoardConfig.cookie_help || (this.currentBoard === 'local' ? (this.t('tribune.session_local') || 'Session locale SimpleGallery.') : (this.t('tribune.cookie_help') || 'Collez le cookie de la tribune.'));

      const renderBoardTabs = () => {
        return Object.keys(this.boards).map(key => {
          const board = this.boards[key];
          const isActive = this.currentBoard === key;
          const icon = board.icon || (key === 'local' ? '🏠' : '🌐');
          const displayName = (key === 'local' ? this.t('tribune.board_local') : (key === 'linuxfr' ? this.t('tribune.board_linuxfr') : '')) || board.name;

          return `<button class="tribune-tab-btn ${isActive ? 'active' : ''}" data-board="${this.escapeHtml(key)}">${icon} ${this.escapeHtml(displayName)}</button>`;
        }).join('');
      };

      this.container.innerHTML = `
        <div class="tribune-app-container">
          <!-- Top Header & Tabs -->
          <div class="tribune-header">
            <div class="tribune-header-title">
              <span>🦆</span>
              <span>${this.t('tribune.title') || 'Tribune Libre'}</span>
            </div>
            <div class="tribune-board-tabs" id="tribuneBoardTabs">
              ${renderBoardTabs()}
            </div>
            <div class="tribune-actions-group">
              <button class="tribune-icon-btn ${this.bakEnabled ? 'active' : ''}" id="tribuneBakToggle" title="Filtrage BAK (Boîte à Con) : ${this.bakEnabled ? 'Activé (posts masqués)' : 'Désactivé (posts visibles)'}" style="font-size:0.8rem; width:auto; padding:0 8px; font-weight:700;">🚫 BAK ${this.bakEnabled ? 'ON' : 'OFF'}</button>
              <button class="tribune-icon-btn ${this.nsfwEnabled ? 'active' : ''}" id="tribuneNsfwToggle" title="${this.t('tribune.nsfw_toggle') || 'Mode 🔞 NSFW'}">🔞</button>
              <button class="tribune-icon-btn ${this.soundEnabled ? 'active' : ''}" id="tribuneSoundToggle" title="${this.t('tribune.sound_toggle') || 'Audio Coincoin'}">🔊</button>
              <button class="tribune-icon-btn" id="tribuneAddBoardBtn" title="${this.t('tribune.add_board') || 'Ajouter une Tribune'}">➕</button>
              <button class="tribune-icon-btn" id="tribuneRefreshBtn" title="${this.t('tribune.refresh') || 'Rafraîchir'}">🔄</button>
            </div>
          </div>

          <!-- Main Timeline & Side Panel -->
          <div class="tribune-body">
            <div class="tribune-feed" id="tribuneFeed">
              <div class="tribune-loading-wrapper">
                <div class="tribune-spinner"></div>
                <div>Chargement de la tribune...</div>
              </div>
            </div>

            <!-- Side Panel (Identity, Auth, Trollometer & BAK) -->
            <div class="tribune-side-panel">
              <!-- Inline Identity & Auth Card -->
              <div class="tribune-panel-card">
                <div class="tribune-panel-title">
                  <span>👤 ${this.t('tribune.identity_title') || 'Identité & Bouchot Auth'}</span>
                </div>
                <div class="identity-info-box">
                  <div class="identity-field-group">
                    <span class="identity-field-label">${this.t('tribune.pseudo') || 'Pseudo'} :</span>
                    <input type="text" class="identity-input-field" id="identityPseudoInput" value="${this.escapeHtml(userLogin)}" placeholder="${this.t('tribune.pseudo') || 'Pseudo'}..." />
                  </div>
                  <div class="identity-field-group">
                    <span class="identity-field-label">${this.t('tribune.user_agent') || 'User-Agent Éditable'} :</span>
                    <input type="text" class="identity-input-field" id="identityUaInput" value="${this.escapeHtml(currentUa)}" placeholder="Mozilla/5.0..." />
                  </div>
                  ${(currentBoardConfig.auth_type === 'cookie') ? `
                    <div class="identity-field-group">
                      <span class="identity-field-label">${this.t('tribune.cookie') || 'Cookie Bouchot'} :</span>
                      <input type="text" class="identity-input-field" id="identityCookieInput" value="${this.escapeHtml(currentCookie)}" placeholder="remember_account_token=xyz..." />
                      <span style="font-size:0.7rem; color:#64748b; margin-top:2px;">
                        ${cookieHelpText}
                      </span>
                    </div>
                    <button class="identity-auto-cookie-btn" id="identityAutoCookieBtn" title="Détecter automatiquement le cookie WebOS local (127.0.0.1)">
                      ⚡ ${this.t('tribune.load_local_cookie') || 'Charger Cookie WebOS Local'}
                    </button>
                  ` : ''}
                  ${(currentBoardConfig.oauth || currentBoardConfig.auth_type === 'oauth2') ? `
                    <div class="identity-oauth-box" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                      <button class="identity-oauth-btn" id="identityOAuthBtn" style="width:100%; padding:8px 12px; font-weight:600; border-radius:6px; background:linear-gradient(135deg, #3b82f6, #2563eb); color:#ffffff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s ease;">
                        🔑 <span>${this.t('tribune.oauth_login_btn') || ('Se connecter avec ' + (currentBoardConfig.name || 'OAuth2'))}</span>
                      </button>
                      <div id="identityOAuthStatus" style="font-size:0.75rem; margin-top:4px; text-align:center; color:${currentCookie ? '#34d399' : '#94a3b8'}; font-weight:600;">
                        ${currentCookie ? '✓ ' + (this.t('tribune.oauth_connected') || 'Token API / OAuth Actif') : '❌ ' + (this.t('tribune.oauth_disconnected') || 'Non connecté via OAuth')}
                      </div>
                      <div class="identity-field-group" style="margin-top:8px;">
                        <span class="identity-field-label">Jeton d'accès API (Bearer token) :</span>
                        <input type="text" class="identity-input-field" id="identityCookieInput" value="${this.escapeHtml(currentCookie)}" placeholder="Coller un token API ou Bearer..." />
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- 24h Telemetry & Analytics Dashboard (System-Monitor Inspired) -->
              <div class="tribune-panel-card">
                <div class="tribune-panel-title" style="display:flex; justify-content:space-between; align-items:center;">
                  <span>📊 ${this.t('tribune.stats_title') || 'Télémétrie & Stats 24h'}</span>
                  <select class="tribune-stat-metric-select" id="tribuneMetricSelect" style="font-size:0.75rem; background:rgba(255,255,255,0.08); color:var(--text-main, #f8fafc); border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:2px 6px; cursor:pointer;">
                    <option value="posts" ${this.activeTelemetryMetric === 'posts' ? 'selected' : ''}>${this.t('tribune.metric_posts') || '📊 Posts / h'}</option>
                    <option value="logins" ${this.activeTelemetryMetric === 'logins' ? 'selected' : ''}>${this.t('tribune.metric_logins') || '👥 Logins / h'}</option>
                    <option value="totoz" ${this.activeTelemetryMetric === 'totoz' ? 'selected' : ''}>${this.t('tribune.metric_totoz') || '🎭 Totoz / h'}</option>
                    <option value="troll" ${this.activeTelemetryMetric === 'troll' ? 'selected' : ''}>${this.t('tribune.metric_troll') || '💥 Indice Troll %'}</option>
                  </select>
                </div>
                <div class="tribune-telemetry-summary" id="tribuneTelemetrySummary"></div>
                <div class="tribune-graph-container" id="tribuneGraphContainer">
                  <svg class="tribune-stat-svg" id="tribuneStatSvg" viewBox="0 0 320 80" preserveAspectRatio="none"></svg>
                  <div class="tribune-stat-tooltip" id="tribuneStatTooltip"></div>
                </div>
                <div class="sysmon-chart-footer" id="tribuneStatFooter" style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted, #94a3b8); margin-top:6px; font-weight:600;"></div>
              </div>

              <!-- BAK (Boîte à Con) Panel -->
              <div class="tribune-panel-card" style="flex:1; display:flex; flex-direction:column;">
                <div class="tribune-panel-title">
                  <span>🚫 ${this.t('tribune.bak') || 'Boîte à Con (BAK)'}</span>
                  <span style="font-size:0.75rem; color:#64748b;" id="bakCountBadge">(${this.bakLogins.size})</span>
                </div>
                <div class="bak-add-box" style="display:flex; gap:6px; margin-bottom:8px;">
                  <input type="text" class="identity-input-field" id="bakAddInput" placeholder="${this.t('tribune.bak_add_placeholder') || 'Bloquer un login...'}" style="font-size:0.8rem; flex:1;" />
                  <button class="identity-auto-cookie-btn" id="bakAddBtn" style="padding:4px 10px; font-size:0.8rem; width:auto; margin-top:0;">+ ${this.t('tribune.bak_block_btn') || 'Bloquer'}</button>
                </div>
                <div class="bak-item-list" id="bakItemList" style="flex:1; overflow-y:auto;">
                  ${this.renderBAKList()}
                </div>
              </div>
            </div>
          </div>

          <!-- Floating Clock & URL Preview Popovers & New Posts Badge -->
          <div class="clock-preview-popover" id="clockPreviewPopover" style="display: none;"></div>
          <div class="url-preview-popover" id="urlPreviewPopover" style="display: none;"></div>
          <button class="tribune-new-posts-badge" id="tribuneNewPostsBadge" style="display: none;">
            ${this.t('tribune.new_posts') || 'Nouveaux messages ⬇️'}
          </button>

          <!-- Totoz Autocomplete Popover -->
          <div class="totoz-popover" id="totozPopover" style="display: none;"></div>

          <!-- Bottom Post Input Area -->
          <div class="tribune-footer">
            <div class="tribune-input-row">
              <input type="text" class="tribune-login-input" id="tribuneLoginInput" placeholder="${this.t('tribune.pseudo') || 'Pseudo'}" value="${this.escapeHtml(userLogin)}" />
              <input type="text" class="tribune-message-input" id="tribuneMsgInput" placeholder="${this.t('tribune.post_placeholder') || this.t('tribune.placeholder') || 'Entrez votre message... (ex: [:totoz], horloges 14:25:30)'}" autocomplete="off" />
              <input type="file" id="tribuneFileInput" style="display: none;" />
              <button type="button" class="tribune-upload-btn" id="tribuneUploadBtn" title="${this.t('tribune.upload_file') || 'Joindre un fichier (upload temporaire)'}">
                <span>📎</span>
              </button>
              <button type="button" class="tribune-schedule-btn" id="tribuneScheduleBtn" title="${this.t('tribune.schedule_btn') || 'Programmer l\'envoi...'}">
                <span>⏰</span>
                <span class="schedule-badge-count" id="tribuneScheduleBadgeCount" style="display:none;">0</span>
              </button>
              <button class="tribune-send-btn" id="tribuneSendBtn">
                <span>🦆</span>
                <span>${this.t('tribune.send') || 'Coincoin !'}</span>
              </button>
            </div>

            <!-- Schedule Popover -->
            <div class="schedule-popover" id="tribuneSchedulePopover" style="display: none;">
              <div class="schedule-popover-title">
                <span>⏰ ${this.t('tribune.schedule_title') || 'Action Programmée'}</span>
                <button type="button" id="schedulePopoverClose" style="background:none; border:none; color:inherit; cursor:pointer; font-size:1rem;">✖</button>
              </div>
              <input type="datetime-local" class="schedule-datetime-input" id="tribuneScheduleDatetime" step="1" />
              <div class="schedule-tz-box" id="tribuneScheduleTzBox">
                <div class="schedule-tz-row">
                  <span>🏠 ${this.t('tribune.your_time') || 'Votre heure (Locale)'} :</span>
                  <b id="tzUserTime">--:--:--</b>
                </div>
                <div class="schedule-tz-row">
                  <span>🥐 ${this.t('tribune.paris_time') || 'Heure de France (Paris)'} :</span>
                  <b id="tzParisTime">--:--:--</b>
                </div>
              </div>
              <div class="schedule-actions-row">
                <button type="button" class="schedule-confirm-btn" id="tribuneScheduleConfirmBtn">⏰ ${this.t('tribune.schedule_confirm') || 'Programmer l\'envoi'}</button>
                <button type="button" class="schedule-list-toggle-btn" id="tribuneScheduleListBtn">📋</button>
              </div>
              <div id="tribuneScheduleListView" style="display:none; margin-top:10px; max-height:150px; overflow-y:auto;"></div>
            </div>
          </div>
        </div>
      `;
    }

    bindEvents() {
      if (!this.container) return;

      const feed = this.container.querySelector('#tribuneFeed');
      const msgInput = this.container.querySelector('#tribuneMsgInput');
      const loginInput = this.container.querySelector('#tribuneLoginInput');
      const sendBtn = this.container.querySelector('#tribuneSendBtn');
      const uploadBtn = this.container.querySelector('#tribuneUploadBtn');
      const fileInput = this.container.querySelector('#tribuneFileInput');
      const tabs = this.container.querySelector('#tribuneBoardTabs');
      const soundBtn = this.container.querySelector('#tribuneSoundToggle');
      const nsfwBtn = this.container.querySelector('#tribuneNsfwToggle');
      const refreshBtn = this.container.querySelector('#tribuneRefreshBtn');
      const addBoardBtn = this.container.querySelector('#tribuneAddBoardBtn');

      const pseudoInput = this.container.querySelector('#identityPseudoInput');
      const uaInput = this.container.querySelector('#identityUaInput');
      const cookieInput = this.container.querySelector('#identityCookieInput');
      const autoCookieBtn = this.container.querySelector('#identityAutoCookieBtn');

      if (tabs) {
        tabs.addEventListener('click', (e) => {
          const btn = e.target.closest('.tribune-tab-btn');
          if (!btn) return;
          const boardKey = btn.dataset.board;
          if (boardKey && this.boards[boardKey] && boardKey !== this.currentBoard) {
            tabs.querySelectorAll('.tribune-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.switchBoard(boardKey);
          }
        });
      }

      // Synchronize pseudo across bottom & side input
      const updatePseudo = (val) => {
        val = val.trim() || 'Coincoin';
        this.userLogin = val;
        localStorage.setItem('tribune_user_login', val);
        if (loginInput && loginInput.value !== val) loginInput.value = val;
        if (pseudoInput && pseudoInput.value !== val) pseudoInput.value = val;
        this.renderPosts();
      };

      if (loginInput) {
        loginInput.addEventListener('input', () => updatePseudo(loginInput.value));
        loginInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (msgInput) msgInput.focus();
          }
        });
      }

      if (pseudoInput) {
        pseudoInput.addEventListener('input', () => updatePseudo(pseudoInput.value));
      }

      // Synchronize User-Agent & Cookie inputs
      if (uaInput) {
        uaInput.addEventListener('input', () => {
          this.boardAuth[this.currentBoard] = this.boardAuth[this.currentBoard] || {};
          this.boardAuth[this.currentBoard].user_agent = uaInput.value.trim();
          this.saveBoardAuth();
        });
      }

      if (cookieInput) {
        cookieInput.addEventListener('input', () => {
          this.boardAuth[this.currentBoard] = this.boardAuth[this.currentBoard] || {};
          this.boardAuth[this.currentBoard].cookie = cookieInput.value.trim();
          this.saveBoardAuth();
        });
      }

      if (autoCookieBtn) {
        autoCookieBtn.addEventListener('click', () => {
          const cookies = document.cookie || '';
          if (cookies) {
            this.boardAuth[this.currentBoard] = this.boardAuth[this.currentBoard] || {};
            this.boardAuth[this.currentBoard].cookie = cookies;
            this.saveBoardAuth();
            if (cookieInput) cookieInput.value = cookies;
          } else {
            alert('Aucun cookie de navigateur trouvé sur cette origine.');
          }
        });
      }

      const oauthBtn = this.container.querySelector('#identityOAuthBtn');
      if (oauthBtn) {
        oauthBtn.addEventListener('click', () => {
          const popupW = 600, popupH = 700;
          const left = (window.innerWidth - popupW) / 2 + window.screenX;
          const top = (window.innerHeight - popupH) / 2 + window.screenY;
          const authUrl = `api.php?action=tribune_oauth_authorize&board_id=${encodeURIComponent(this.currentBoard)}`;
          window.open(authUrl, `oauth_${this.currentBoard}`, `width=${popupW},height=${popupH},top=${top},left=${left},scrollbars=yes,status=yes`);
        });
      }

      // 1. NSFW Toggle re-renders posts immediately
      if (nsfwBtn) {
        nsfwBtn.addEventListener('click', () => {
          this.nsfwEnabled = !this.nsfwEnabled;
          localStorage.setItem('tribune_nsfw_enabled', this.nsfwEnabled ? 'true' : 'false');
          nsfwBtn.classList.toggle('active', this.nsfwEnabled);
          this.renderPosts(false); // Re-render posts immediately to reload/unblur NSFW totoz
        });
      }

      if (soundBtn) {
        soundBtn.addEventListener('click', () => {
          this.soundEnabled = !this.soundEnabled;
          soundBtn.classList.toggle('active', this.soundEnabled);
        });
      }

      const bakToggleBtn = this.container.querySelector('#tribuneBakToggle');
      if (bakToggleBtn) {
        bakToggleBtn.addEventListener('click', () => {
          this.bakEnabled = !this.bakEnabled;
          localStorage.setItem('tribune_bak_enabled', this.bakEnabled ? 'true' : 'false');
          bakToggleBtn.classList.toggle('active', this.bakEnabled);
          bakToggleBtn.innerHTML = `🚫 BAK ${this.bakEnabled ? 'ON' : 'OFF'}`;
          bakToggleBtn.title = `Filtrage BAK (Boîte à Con) : ${this.bakEnabled ? 'Activé (posts masqués)' : 'Désactivé (posts visibles)'}`;
          this.renderPosts(false);
        });
      }

      const bakAddBtn = this.container.querySelector('#bakAddBtn');
      const bakAddInput = this.container.querySelector('#bakAddInput');
      const handleAddBak = () => {
        if (!bakAddInput) return;
        const val = bakAddInput.value.trim();
        if (val) {
          this.toggleBAKLogin(val);
          bakAddInput.value = '';
        }
      };
      if (bakAddBtn) bakAddBtn.addEventListener('click', handleAddBak);
      if (bakAddInput) {
        bakAddInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddBak();
          }
        });
      }

      const bakItemList = this.container.querySelector('#bakItemList');
      if (bakItemList) {
        bakItemList.addEventListener('click', (e) => {
          const removeBtn = e.target.closest('.bak-chip-remove-btn');
          if (removeBtn) {
            const login = removeBtn.dataset.login;
            if (login) this.toggleBAKLogin(login);
          }
        });
      }

      const metricSelect = this.container.querySelector('#tribuneMetricSelect');
      if (metricSelect) {
        metricSelect.addEventListener('change', (e) => {
          this.activeTelemetryMetric = e.target.value;
          this.renderTelemetryUI();
        });
      }

      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => this.fetchPosts(false, false));
      }

      if (addBoardBtn) {
        addBoardBtn.addEventListener('click', () => {
          const url = prompt('URL du backend distant (XML/JSON/TSV) :');
          if (url && url.startsWith('http')) {
            const name = prompt('Nom de la tribune :', 'Tribune Distante') || 'Tribune';
            const key = 'custom_' + Date.now();
            this.boards[key] = { name, type: 'remote_xml', url };
            this.saveBoards();
            this.switchBoard(key);
          }
        });
      }

      const doSend = () => {
        if (!msgInput) return;
        const msg = msgInput.value.trim();
        const login = this.userLogin || (loginInput ? loginInput.value.trim() : 'Coincoin');
        updatePseudo(login);
        if (!msg) return;

        // Construct preemptive optimistic post
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const clock = `${hours}:${minutes}:${seconds}`;

        const pendingPost = {
          id: 'pending_' + Date.now(),
          time: `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${hours}${minutes}${seconds}`,
          clock: clock,
          login: login,
          info: 'Envoi...',
          message: msg,
          is_admin: false,
          pending: true,
          board: this.currentBoard
        };

        this.posts.push(pendingPost);
        this.renderPosts(true);

        msgInput.value = '';
        this.hideTotozPopover();

        this.postMessage(msg, login).then((success) => {
          if (success) {
            setTimeout(() => this.fetchPosts(true, false), 1000);
          } else {
            this.posts = this.posts.filter(p => p.id !== pendingPost.id);
            this.renderPosts(false);
          }
        });
      };

      if (sendBtn) sendBtn.addEventListener('click', doSend);

      if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => {
          fileInput.click();
        });

        fileInput.addEventListener('change', async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;

          const origHtml = uploadBtn.innerHTML;
          uploadBtn.disabled = true;
          uploadBtn.innerHTML = '<span>⏳</span>';

          try {
            const formData = new FormData();
            formData.append('action', 'tribune_file_upload');
            formData.append('file', file);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || window.SG_CSRF_TOKEN || window.CSRF_TOKEN || '';
            if (csrfToken) {
              formData.append('csrf_token', csrfToken);
            }

            const headers = {};
            if (csrfToken) {
              headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await fetch('api.php', {
              method: 'POST',
              headers: headers,
              body: formData
            });

            const resData = await response.json();
            if (resData && resData.success && resData.url) {
              const fullUrl = new URL(resData.url, window.location.href).href;
              if (msgInput) {
                const curVal = msgInput.value;
                msgInput.value = curVal ? (curVal.trimEnd() + ' ' + fullUrl) : fullUrl;
                msgInput.focus();
              }
            } else {
              alert(resData?.error || (this.t('tribune.upload_error') || 'Erreur lors du téléversement du fichier.'));
            }
          } catch (err) {
            alert(this.t('tribune.upload_error') || 'Erreur lors du téléversement du fichier.');
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = origHtml;
            fileInput.value = '';
          }
        });
      }

      // Scheduling Event Handlers
      const scheduleBtn = this.container.querySelector('#tribuneScheduleBtn');
      const schedulePopover = this.container.querySelector('#tribuneSchedulePopover');
      const scheduleCloseBtn = this.container.querySelector('#schedulePopoverClose');
      const scheduleDatetime = this.container.querySelector('#tribuneScheduleDatetime');
      const scheduleConfirmBtn = this.container.querySelector('#tribuneScheduleConfirmBtn');
      const scheduleListBtn = this.container.querySelector('#tribuneScheduleListBtn');
      const scheduleListView = this.container.querySelector('#tribuneScheduleListView');

      if (scheduleBtn && schedulePopover) {
        scheduleBtn.addEventListener('click', () => {
          const isVisible = schedulePopover.style.display !== 'none';
          schedulePopover.style.display = isVisible ? 'none' : 'block';

          if (!isVisible) {
            const now = new Date(Date.now() + 5 * 60 * 1000);
            now.setSeconds(0, 0);
            const tzOffset = now.getTimezoneOffset() * 60000;
            const localIso = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 19);
            if (scheduleDatetime) {
              scheduleDatetime.value = localIso;
            }
            this.updateScheduleTimezonePreview();
            this.refreshScheduledList();
          }
        });
      }

      if (scheduleCloseBtn && schedulePopover) {
        scheduleCloseBtn.addEventListener('click', () => {
          schedulePopover.style.display = 'none';
        });
      }

      if (scheduleDatetime) {
        scheduleDatetime.addEventListener('input', () => this.updateScheduleTimezonePreview());
        scheduleDatetime.addEventListener('change', () => this.updateScheduleTimezonePreview());
      }

      if (scheduleConfirmBtn && scheduleDatetime && msgInput) {
        scheduleConfirmBtn.addEventListener('click', async () => {
          const msg = msgInput.value.trim();
          if (!msg) {
            alert('Veuillez d\'abord saisir un message à programmer.');
            msgInput.focus();
            return;
          }

          const val = scheduleDatetime.value;
          if (!val) {
            alert('Veuillez sélectionner une date et une heure de programmation.');
            return;
          }

          const dt = this.parseLocalDateTime(val);
          const unixTs = dt ? Math.floor(dt.getTime() / 1000) : 0;
          if (isNaN(unixTs) || unixTs <= Math.floor(Date.now() / 1000)) {
            alert('L\'heure programmée doit être située dans le futur.');
            return;
          }

          const login = this.userLogin || (loginInput ? loginInput.value.trim() : 'Coincoin');
          const boardCfg = this.boards[this.currentBoard] || {};

          const formData = new FormData();
          formData.append('action', 'tribune_schedule_post');
          formData.append('message', msg);
          formData.append('login', login);
          formData.append('info', 'SimpleGallery Client');
          formData.append('board', this.currentBoard);
          formData.append('scheduled_at', unixTs);

          const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || window.SG_CSRF_TOKEN || window.CSRF_TOKEN || '';
          if (csrfToken) formData.append('csrf_token', csrfToken);

          if (this.currentBoard !== 'local' && boardCfg.url) {
            formData.append('target_url', boardCfg.url);
            if (boardCfg.post_field) formData.append('post_field', boardCfg.post_field);
            if (boardCfg.cookie) formData.append('cookie', boardCfg.cookie);
            if (boardCfg.user_agent) formData.append('user_agent', boardCfg.user_agent);
          }

          try {
            const res = await fetch('api.php', {
              method: 'POST',
              body: formData,
              headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
            });
            const data = await res.json();
            if (data && data.success) {
              msgInput.value = '';
              schedulePopover.style.display = 'none';
              this.refreshScheduledList();
            } else {
              alert(data.error || (this.t('tribune.schedule_error') || 'Erreur lors de la programmation.'));
            }
          } catch (e) {
            alert(this.t('tribune.schedule_error') || 'Erreur réseau lors de la programmation.');
          }
        });
      }

      if (scheduleListBtn && scheduleListView) {
        scheduleListBtn.addEventListener('click', () => {
          const isVis = scheduleListView.style.display !== 'none';
          scheduleListView.style.display = isVis ? 'none' : 'block';
          if (!isVis) {
            this.refreshScheduledList();
          }
        });
      }

      if (scheduleListView) {
        scheduleListView.addEventListener('click', async (e) => {
          const cancelBtn = e.target.closest('.scheduled-cancel-btn');
          if (cancelBtn) {
            const id = cancelBtn.dataset.id;
            if (id) {
              const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || window.SG_CSRF_TOKEN || window.CSRF_TOKEN || '';
              const formData = new FormData();
              formData.append('action', 'tribune_schedule_cancel');
              formData.append('id', id);
              if (csrfToken) formData.append('csrf_token', csrfToken);

              try {
                await fetch('api.php', {
                  method: 'POST',
                  body: formData,
                  headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
                });
                this.refreshScheduledList();
              } catch (e) {}
            }
          }
        });
      }

      // Validate post via Enter key & handle Esc key to close popover
      if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doSend();
          } else if (e.key === 'Escape') {
            this.hideTotozPopover();
          }
        });

        let totozDebounce = null;
        msgInput.addEventListener('input', () => {
          const val = msgInput.value;
          const match = val.match(/\[:([a-zA-Z0-9_\.: -]*)$/);
          if (match) {
            const query = match[1].toLowerCase();
            if (totozDebounce) clearTimeout(totozDebounce);
            totozDebounce = setTimeout(() => this.showTotozPopover(query), 150);
          } else {
            this.hideTotozPopover();
          }
        });
      }

      // Close popover on click outside
      if (this.container) {
        this.container.addEventListener('click', (e) => {
          if (!e.target.closest('#totozPopover') && !e.target.closest('#tribuneMsgInput')) {
            this.hideTotozPopover();
          }
        });
      }

      const clockPopover = this.container ? this.container.querySelector('#clockPreviewPopover') : null;
      const urlPreviewPopover = this.container ? this.container.querySelector('#urlPreviewPopover') : null;
      const newPostsBadge = this.container ? this.container.querySelector('#tribuneNewPostsBadge') : null;
      this.urlPreviewCache = this.urlPreviewCache || {};

      if (newPostsBadge && feed) {
        newPostsBadge.addEventListener('click', () => {
          feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
          newPostsBadge.style.display = 'none';
        });
      }

      if (feed) {
        let urlHoverTimeout = null;

        // Scroll listener to hide new posts badge when user reaches bottom
        feed.addEventListener('scroll', () => {
          const distanceFromBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
          if (distanceFromBottom < 30 && newPostsBadge) {
            newPostsBadge.style.display = 'none';
          }
        });

        feed.addEventListener('click', (e) => {
          // 1. Click on .clock-ref (embedded in post message) -> Scroll to referenced post & flash at vertical center!
          const clockRef = e.target.closest('.clock-ref');
          if (clockRef) {
            e.stopPropagation();
            const clockTime = clockRef.dataset.clock || clockRef.textContent.trim().replace(/^#/, '');
            const baseClock = clockRef.dataset.baseClock || clockTime;
            if (clockTime) {
              const targetRow = feed.querySelector(`.tribune-post-row[data-clock="${clockTime}"]`) ||
                                feed.querySelector(`.tribune-post-row[data-clock="${baseClock}"]`) ||
                                Array.from(feed.querySelectorAll('.tribune-post-row')).find(row => {
                                  const c = row.dataset.clock || '';
                                  const tid = row.dataset.timeId || '';
                                  return c === clockTime || c === baseClock || c.startsWith(baseClock) || tid.includes(clockTime) || c.includes(clockTime);
                                });
              if (targetRow) {
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                targetRow.classList.remove('clock-target-flash');
                void targetRow.offsetWidth;
                targetRow.classList.add('clock-target-flash');
              }
            }
            return;
          }

          // 2. Click on .tribune-clock -> Insert clock timestamp into message input
          const clockElem = e.target.closest('.tribune-clock');
          if (clockElem && msgInput) {
            const clockTime = clockElem.dataset.clock || clockElem.textContent.trim();
            if (clockTime) {
              const textToInsert = clockTime + ' ';
              const start = msgInput.selectionStart ?? msgInput.value.length;
              const end = msgInput.selectionEnd ?? msgInput.value.length;
              const currentVal = msgInput.value;

              msgInput.value = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
              const newPos = start + textToInsert.length;
              msgInput.selectionStart = newPos;
              msgInput.selectionEnd = newPos;
              msgInput.focus();
            }
          }

          // 3. Click on .tribune-login -> Insert login< into message input at cursor position
          const loginElem = e.target.closest('.tribune-login');
          if (loginElem && !e.target.closest('.clock-ref') && msgInput) {
            const loginName = loginElem.textContent.replace(/:$/, '').trim();
            if (loginName) {
              const textToInsert = loginName + '<';
              const start = msgInput.selectionStart ?? msgInput.value.length;
              const end = msgInput.selectionEnd ?? msgInput.value.length;
              const currentVal = msgInput.value;

              msgInput.value = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
              const newPos = start + textToInsert.length;
              msgInput.selectionStart = newPos;
              msgInput.selectionEnd = newPos;
              msgInput.focus();
            }
          }

          // Mark unread call as read when clicking on post or call badge
          const unreadRow = e.target.closest('.tribune-post-row.has-unread-call');
          if (unreadRow) {
            const postId = String(unreadRow.dataset.id);
            if (postId) {
              this.readCalls.add(postId);
              this.saveReadCalls();
              unreadRow.classList.remove('has-unread-call');

              const remainingUnread = feed.querySelectorAll('.tribune-post-row.has-unread-call').length;
              this.updateWindowTitle(remainingUnread);
            }
          }
        });

        feed.addEventListener('mouseover', (e) => {
          // Horloge hover
          const clockElem = e.target.closest('.tribune-clock, .clock-ref');
          if (clockElem) {
            const clockTime = clockElem.dataset.clock || clockElem.textContent.trim().replace(/^#/, '');
            if (clockTime) {
              if (clockElem.classList.contains('tribune-clock')) {
                // Hovering a post's timestamp -> Highlight all posts responding to it (future)
                this.highlightClocks(clockTime, true, 'responses');
              } else if (clockElem.classList.contains('clock-ref')) {
                // Hovering an embedded clock reference -> Highlight target post (past) + show preview popover
                this.highlightClocks(clockTime, true, 'target');

                if (clockPopover) {
                  const foundPost = this.posts.find(p => p.clock === clockTime || p.time?.includes(clockTime) || p.clock?.substring(0,5) === clockTime.substring(0,5));
                  if (foundPost) {
                    const formatted = this.formatMessageText(foundPost.message);
                    clockPopover.innerHTML = `
                      <span class="preview-clock">🕒 ${this.escapeHtml(foundPost.clock)}</span>
                      <strong class="preview-login">${this.escapeHtml(foundPost.login)} :</strong>
                      <span class="preview-msg">${formatted}</span>
                    `;
                    clockPopover.style.display = 'block';
                  }
                }
              }
            }
          }

          // URL Link hover preview
          const link = e.target.closest('a.tribune-link');
          if (link && urlPreviewPopover && this.container) {
            const href = link.getAttribute('href');
            if (!href) return;

            // Mark this specific URL as the active target
            this.activeHoverUrl = href;

            const rect = link.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();

            urlPreviewPopover.style.left = `${Math.min(containerRect.width - 330, Math.max(10, rect.left - containerRect.left))}px`;
            urlPreviewPopover.style.top = `${Math.max(10, rect.top - containerRect.top - 180)}px`;

            if (this.urlPreviewCache[href]) {
              if (this.activeHoverUrl === href && link.matches(':hover')) {
                this.renderUrlPreviewPopover(urlPreviewPopover, this.urlPreviewCache[href]);
              }
            } else {
              urlPreviewPopover.innerHTML = `<div class="url-preview-loading">🔍 Chargement de l'aperçu...</div>`;
              urlPreviewPopover.style.display = 'flex';

              if (urlHoverTimeout) clearTimeout(urlHoverTimeout);
              urlHoverTimeout = setTimeout(async () => {
                // Verify mouse is still hovering this exact link before fetching/rendering
                if (this.activeHoverUrl !== href || !link.matches(':hover')) {
                  urlPreviewPopover.style.display = 'none';
                  return;
                }

                try {
                  const res = await fetch(`api.php?action=url_preview&url=${encodeURIComponent(href)}`);
                  const data = await res.json();
                  // Guard check: verify active hover URL still matches this link
                  if (this.activeHoverUrl === href && link.matches(':hover')) {
                    if (data && data.success && data.preview) {
                      this.urlPreviewCache[href] = data.preview;
                      this.renderUrlPreviewPopover(urlPreviewPopover, data.preview);
                    } else {
                      urlPreviewPopover.style.display = 'none';
                    }
                  }
                } catch (err) {
                  if (this.activeHoverUrl === href) {
                    urlPreviewPopover.style.display = 'none';
                  }
                }
              }, 200);
            }
          }
        });

        feed.addEventListener('mouseout', (e) => {
          const clockElem = e.target.closest('.tribune-clock, .clock-ref');
          if (clockElem) {
            this.highlightClocks(null, false);
            if (clockPopover) clockPopover.style.display = 'none';
          }

          const link = e.target.closest('a.tribune-link');
          if (link) {
            if (this.activeHoverUrl === link.getAttribute('href')) {
              this.activeHoverUrl = null;
            }
            if (urlHoverTimeout) clearTimeout(urlHoverTimeout);
            if (urlPreviewPopover) urlPreviewPopover.style.display = 'none';
          }
        });
      }
    }

    renderUrlPreviewPopover(popover, data) {
      if (!popover || !data) return;

      const title = this.escapeHtml(data.title || data.url);
      const siteName = this.escapeHtml(data.site_name || '');
      const desc = this.escapeHtml(data.description || '');
      const img = data.image ? `<img src="${this.escapeHtml(data.image)}" class="url-preview-img" alt="" onerror="this.style.display='none'" />` : '';

      popover.innerHTML = `
        ${img}
        <div class="url-preview-body">
          <div class="url-preview-site">🌐 ${siteName}</div>
          <div class="url-preview-title">${title}</div>
          ${desc ? `<div class="url-preview-desc">${desc}</div>` : ''}
        </div>
      `;
      popover.style.display = 'flex';
    }

    switchBoard(boardKey) {
      if (!this.boards[boardKey]) return;
      this.currentBoard = boardKey;
      localStorage.setItem('tribune_current_board', boardKey);
      this.lastPostsSig = null;

      // Preserve posts per board in memory
      this.posts = this.boardPosts[boardKey] || [];

      if (!this.container) return;

      this.renderUI();
      this.bindEvents();

      // Clear unread badge on active tab
      const activeTab = this.container.querySelector(`.tribune-tab-btn[data-board="${boardKey}"]`);
      if (activeTab) {
        const dot = activeTab.querySelector('.tab-unread-dot');
        if (dot) dot.remove();
      }

      if (this.posts.length > 0) {
        this.renderPosts(true);
        this.fetchPosts(boardKey, true, false);
      } else {
        const feed = this.container.querySelector('#tribuneFeed');
        if (feed) {
          feed.innerHTML = `
            <div class="tribune-loading-wrapper">
              <div class="tribune-spinner"></div>
              <div>Chargement de ${this.escapeHtml(this.boards[boardKey]?.name || 'la tribune')}...</div>
            </div>
          `;
        }
        this.fetchPosts(boardKey, false, true);
      }
    }

    toSuperscript(num) {
      const superMap = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
      return String(num).split('').map(c => superMap[c] || c).join('');
    }

    fromSuperscript(str) {
      const reverseMap = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
      return String(str).split('').map(c => reverseMap[c] !== undefined ? reverseMap[c] : c).join('');
    }

    parseClockRef(clockStr) {
      if (!clockStr) return { baseClock: '', index: 1, raw: '' };
      const str = String(clockStr).trim();

      const match = str.match(/^([0-2]?[0-9]:[0-5][0-9](?::[0-5][0-9])?)(?:([¹²³⁴⁵⁶⁷⁸⁹⁰]+)|[:#^\.](\d+))?$/);
      if (!match) return { baseClock: str, index: 1, raw: str };

      const baseClock = match[1];
      let index = 1;
      if (match[2]) {
        index = parseInt(this.fromSuperscript(match[2]), 10) || 1;
      } else if (match[3]) {
        index = parseInt(match[3], 10) || 1;
      }

      return { baseClock, index, raw: str };
    }

    highlightClocks(clockTime, enable, mode = 'both') {
      if (!this.container) return;
      const rows = this.container.querySelectorAll('.tribune-post-row');
      const parsedTarget = this.parseClockRef(clockTime);

      rows.forEach(row => {
        if (!enable) {
          row.classList.remove('clock-highlight', 'clock-response-highlight');
          return;
        }

        if (!clockTime) return;

        if (mode === 'target' || mode === 'both') {
          const rowClock = row.dataset.clock || '';
          const rowCleanClock = row.dataset.cleanClock || this.parseClockRef(rowClock).baseClock;
          const rowClockIndex = parseInt(row.dataset.clockIndex || '1', 10);

          let isTarget = false;
          if (rowCleanClock === parsedTarget.baseClock || rowClock.includes(parsedTarget.baseClock)) {
            if (parsedTarget.raw.match(/[¹²³⁴⁵⁶⁷⁸⁹⁰]|[:#^\.]\d+/)) {
              isTarget = (rowClockIndex === parsedTarget.index);
            } else {
              isTarget = true;
            }
          }

          if (isTarget) {
            row.classList.add('clock-highlight');
          }
        }

        if (mode === 'responses' || mode === 'both') {
          const refs = row.querySelectorAll('.clock-ref');
          let isResponse = false;
          refs.forEach(ref => {
            const refClock = ref.dataset.clock || ref.textContent.trim().replace(/^#/, '');
            const parsedRef = this.parseClockRef(refClock);

            if (parsedRef.baseClock === parsedTarget.baseClock) {
              if (parsedTarget.raw.match(/[¹²³⁴⁵⁶⁷⁸⁹⁰]|[:#^\.]\d+/)) {
                if (parsedRef.index === parsedTarget.index) isResponse = true;
              } else {
                isResponse = true;
              }
            }
          });

          if (isResponse) {
            row.classList.add('clock-response-highlight');
          }
        }
      });
    }

    async showTotozPopover(query) {
      if (!this.container) return;
      const popover = this.container.querySelector('#totozPopover');
      if (!popover) return;

      const msgInput = this.container.querySelector('#tribuneMsgInput');
      if (!msgInput) {
        this.hideTotozPopover();
        return;
      }

      const currentMatch = msgInput.value.match(/\[:([a-zA-Z0-9_\.: -]*)$/);
      if (!currentMatch || currentMatch[1].toLowerCase() !== query) {
        this.hideTotozPopover();
        return;
      }

      this.activeTotozQuery = query;

      let totozList = this.commonTotoz
        .filter(t => t.toLowerCase().includes(query))
        .map(name => ({ name, nsfw: false }));

      // Fetch live totoz suggestions from totoz.eu via backend proxy with memory & localStorage caching
      if (query.length >= 2) {
        if (this.totozCache[query]) {
          totozList = this.totozCache[query];
        } else {
          try {
            const res = await fetch(`api.php?action=totoz_search&q=${encodeURIComponent(query)}`);
            const data = await res.json();

            // Guard 1: Verify user is still typing this exact query and popover wasn't closed
            if (this.activeTotozQuery !== query) return;
            const activeMatch = msgInput.value.match(/\[:([a-zA-Z0-9_\.: -]*)$/);
            if (!activeMatch || activeMatch[1].toLowerCase() !== query) return;

            if (data && data.success && Array.isArray(data.totoz)) {
              totozList = data.totoz;
              this.totozCache[query] = totozList;
              this.saveTotozCache();
            }
          } catch (e) {
            if (this.activeTotozQuery !== query) return;
          }
        }
      }

      // Guard 2: Verify active query hasn't changed before DOM mutation
      if (this.activeTotozQuery !== query) return;
      const finalMatch = msgInput.value.match(/\[:([a-zA-Z0-9_\.: -]*)$/);
      if (!finalMatch || finalMatch[1].toLowerCase() !== query) {
        this.hideTotozPopover();
        return;
      }

      if (!totozList.length) {
        popover.style.display = 'none';
        return;
      }

      const displayList = totozList.slice(0, 24);

      // Preload images into memory cache for instant rendering
      displayList.forEach(item => {
        const imgUrl = `api.php?action=totoz_proxy&name=${encodeURIComponent(item.name)}`;
        if (!this.totozImageCache.has(imgUrl)) {
          this.totozImageCache.add(imgUrl);
          const img = new Image();
          img.src = imgUrl;
        }
      });

      popover.innerHTML = `
        <div class="totoz-popover-header">
          <span>Suggestions Totoz (${displayList.length})</span>
          <button class="totoz-popover-close" title="Fermer (Esc)">✕</button>
        </div>
        <div class="totoz-popover-grid">
          ${displayList.map(item => {
            const name = item.name;
            const isNsfw = item.nsfw || name.toLowerCase().includes('nsfw');
            const imgUrl = `api.php?action=totoz_proxy&name=${encodeURIComponent(name)}`;
            const blurClass = (isNsfw && !this.nsfwEnabled) ? 'nsfw-blurred' : '';

            return `
              <div class="totoz-item-preview" data-totoz="${this.escapeHtml(name)}" title="[:${this.escapeHtml(name)}]">
                <img class="${blurClass}" src="${imgUrl}" alt="[:${this.escapeHtml(name)}]" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'><circle cx=\'12\' cy=\'12\' r=\'10\'/><path d=\'M8 14s1.5 2 4 2 4-2 4-2\'/><line x1=\'9\' y1=\'9\' x2=\'9.01\' y2=\'9\'/><line x1=\'15\' y1=\'9\' x2=\'15.01\' y2=\'9\'/></svg>'" />
                <span>${this.escapeHtml(name)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;

      popover.style.display = 'flex';

      const closeBtn = popover.querySelector('.totoz-popover-header button');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideTotozPopover();
        });
      }

      popover.querySelectorAll('.totoz-item-preview').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = item.dataset.totoz;
          const msgInputElem = this.container.querySelector('#tribuneMsgInput');
          if (msgInputElem) {
            msgInputElem.value = msgInputElem.value.replace(/\[:([a-zA-Z0-9_\.: -]*)$/, `[:${name}] `);
            msgInputElem.focus();
          }
          this.hideTotozPopover();
        });
      });
    }

    hideTotozPopover() {
      this.activeTotozQuery = null;
      if (!this.container) return;
      const popover = this.container.querySelector('#totozPopover');
      if (popover) popover.style.display = 'none';
    }

    async fetchPosts(targetBoardKey = null, silent = false, forceScrollBottom = false) {
      if (!this.container) return;

      if (typeof targetBoardKey === 'boolean') {
        forceScrollBottom = silent;
        silent = targetBoardKey;
        targetBoardKey = this.currentBoard;
      }
      const boardKey = targetBoardKey || this.currentBoard;
      const boardConfig = this.boards[boardKey];
      if (!boardConfig) return;

      try {
        let fetchedPosts = [];
        const auth = this.boardAuth[boardKey] || {};

        if (boardConfig.type === 'local') {
          const res = await fetch(`api.php?action=tribune_get&_t=${Date.now()}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data && data.success && data.messages) {
            fetchedPosts = data.messages;
          }
        } else if (boardConfig.type === 'remote_tsv' || boardConfig.type === 'remote_xml') {
          const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || window.SG_CSRF_TOKEN || '';
          const res = await fetch('api.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
              action: 'tribune_proxy_fetch',
              url: boardConfig.url,
              cookie: auth.cookie || '',
              user_agent: auth.user_agent || ''
            })
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data && data.success && data.content) {
            fetchedPosts = boardConfig.type === 'remote_tsv' ? this.parseRemoteTSV(data.content) : this.parseRemoteXML(data.content);
          }
        }

        const existingBoardPosts = this.boardPosts[boardKey] || [];
        const prevCount = existingBoardPosts.length;

        // Preserve recent pending posts (< 15s old) if not yet returned by server
        const pendingPosts = existingBoardPosts.filter(p => p.pending && (Date.now() - parseInt(p.id.replace('pending_', ''), 10)) < 15000);
        const filteredPending = pendingPosts.filter(p => !fetchedPosts.some(fp => fp.message === p.message && fp.login === p.login));

        const newPostsList = [...fetchedPosts, ...filteredPending];
        this.boardPosts[boardKey] = newPostsList;

        // STRICT GUARD: ONLY UPDATE DOM & RENDER IF THIS BOARD IS CURRENTLY ACTIVE
        if (this.currentBoard === boardKey) {
          this.posts = newPostsList;

          const feed = this.container ? this.container.querySelector('#tribuneFeed') : null;
          const wasAtBottom = feed ? ((feed.scrollHeight - feed.scrollTop - feed.clientHeight) < 40) : true;

          this.renderPosts(forceScrollBottom);
          this.updateTrollometer();

          if (silent && prevCount > 0 && newPostsList.length > prevCount) {
            if (this.soundEnabled) this.playCoincoinSound();
            if (!wasAtBottom && this.container) {
              const newPostsBadge = this.container.querySelector('#tribuneNewPostsBadge');
              if (newPostsBadge) newPostsBadge.style.display = 'flex';
            }
          }
        } else {
          // Board is in background: update unread tab badge if new posts arrived
          if (prevCount > 0 && newPostsList.length > prevCount && this.container) {
            const tabBtn = this.container.querySelector(`.tribune-tab-btn[data-board="${boardKey}"]`);
            if (tabBtn) {
              let badge = tabBtn.querySelector('.tab-unread-dot');
              if (!badge) {
                badge = document.createElement('span');
                badge.className = 'tab-unread-dot';
                badge.style.cssText = 'width:7px; height:7px; border-radius:50%; background:#ef4444; display:inline-block; margin-left:4px; vertical-align:middle;';
                tabBtn.appendChild(badge);
              }
            }
          }
        }
      } catch (err) {
        if (!silent && this.currentBoard === boardKey && this.container) {
          const feed = this.container.querySelector('#tribuneFeed');
          if (feed) feed.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center;">Erreur de connexion à la tribune ${this.escapeHtml(boardConfig.name || boardKey)}.</div>`;
        }
      }
    }

    parseRemoteTSV(tsvText) {
      if (!tsvText) return [];
      const lines = tsvText.split(/\r?\n/);
      const parsed = [];
      lines.forEach((line, idx) => {
        if (!line.trim()) return;
        const parts = line.split('\t');
        if (parts.length >= 5) {
          const id = parts[0] || idx + 1;
          const timeAttr = parts[1] || '';
          const info = parts[2] || '';
          const login = parts[3] || 'Anonyme';
          const message = parts.slice(4).join('\t') || '';

          let clock = '00:00:00';
          if (timeAttr.length >= 14) {
            clock = `${timeAttr.substring(8,10)}:${timeAttr.substring(10,12)}:${timeAttr.substring(12,14)}`;
          } else if (timeAttr.length >= 6 && timeAttr.includes(':')) {
            clock = timeAttr;
          }

          parsed.push({
            id: String(id),
            time: timeAttr,
            clock: clock,
            login: login,
            info: info,
            message: message,
            board: this.currentBoard
          });
        }
      });
      return parsed;
    }

    parseRemoteXML(xmlText) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const postNodes = doc.querySelectorAll('post');
      const parsed = [];

      postNodes.forEach((node, idx) => {
        const id = node.getAttribute('id') || idx + 1;
        const timeAttr = node.getAttribute('time') || '';
        const login = node.querySelector('login')?.textContent || 'Anonyme';
        const info = node.querySelector('info')?.textContent || '';
        const message = node.querySelector('message')?.textContent || '';

        let clock = '00:00:00';
        if (timeAttr.length >= 14) {
          clock = `${timeAttr.substring(8,10)}:${timeAttr.substring(10,12)}:${timeAttr.substring(12,14)}`;
        } else if (timeAttr.length >= 12) {
          clock = `${timeAttr.substring(8,10)}:${timeAttr.substring(10,12)}:00`;
        } else if (timeAttr.includes(':')) {
          const parts = timeAttr.split(':');
          if (parts.length === 2) clock = `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
          else if (parts.length === 3) clock = `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:${parts[2].padStart(2,'0')}`;
        }

        parsed.push({
          id,
          time: timeAttr,
          clock,
          login,
          info,
          message,
          is_admin: false,
          board: this.currentBoard
        });
      });

      return parsed.reverse();
    }

    async postMessage(message, login) {
      try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || window.SG_CSRF_TOKEN || '';
        const boardConfig = this.boards[this.currentBoard] || {};
        const auth = this.boardAuth[this.currentBoard] || {};

        let bodyData = {};
        if (this.currentBoard === 'local' || boardConfig?.type === 'local') {
          bodyData = {
            action: 'tribune_post',
            csrf_token: csrfToken,
            message: message,
            login: login
          };
        } else {
          bodyData = {
            action: 'tribune_proxy_post',
            csrf_token: csrfToken,
            board_id: this.currentBoard,
            url: boardConfig.url || '',
            post_url: boardConfig.post_url || '',
            message: message,
            login: login,
            cookie: auth.cookie || '',
            user_agent: auth.user_agent || ''
          };
        }

        const res = await fetch('api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify(bodyData)
        });

        const data = await res.json();

        if (data && data.success) {
          if (this.soundEnabled) this.playCoincoinSound();
          return true;
        } else {
          alert('Erreur lors du post: ' + (data.error || 'Impossible de poster.'));
          return false;
        }
      } catch (err) {
        alert('Erreur de connexion au serveur lors du post: ' + err.message);
        return false;
      }
    }

    renderPosts(forceScrollBottom = false) {
      if (!this.container) return;
      const feed = this.container.querySelector('#tribuneFeed');
      if (!feed) return;

      if (!this.posts.length) {
        if (this.lastPostsSig !== 'empty') {
          feed.innerHTML = `<div style="color:#94a3b8; text-align:center; padding:40px;">Aucun message dans cette tribune. Soyez le premier à poster ! 🦆</div>`;
          this.lastPostsSig = 'empty';
        }
        return;
      }

      const myLogin = (this.userLogin || '').trim().toLowerCase();

      // Get exact full HH:MM:SS clock from post's time (YYYYMMDDHHMMSS) or clock
      const getFullClock = (p) => {
        if (p && p.time && String(p.time).length >= 14) {
          const t = String(p.time);
          return `${t.substring(8,10)}:${t.substring(10,12)}:${t.substring(12,14)}`;
        }
        if (p && p.clock) {
          let raw = String(p.clock).trim().replace(/([¹²³⁴⁵⁶⁷⁸⁹⁰]+|[:#^\.]\d+)$/, '');
          const parts = raw.split(':');
          if (parts.length === 3) return raw;
          if (parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
        }
        return '00:00:00';
      };

      // Count posts occurring at the exact same full timestamp (same date, hour, minute, second)
      const sameSecondCounts = {};
      this.posts.forEach(p => {
        const cleanClock = getFullClock(p);
        const fullKey = p.time ? String(p.time) : cleanClock;
        sameSecondCounts[fullKey] = (sameSecondCounts[fullKey] || 0) + 1;
      });

      const sameSecondIndexMap = {};
      const enrichedPosts = this.posts.map(p => {
        const cleanClock = getFullClock(p);
        const fullKey = p.time ? String(p.time) : cleanClock;
        sameSecondIndexMap[fullKey] = (sameSecondIndexMap[fullKey] || 0) + 1;
        const subIndex = sameSecondIndexMap[fullKey];
        const totalInSameSecond = sameSecondCounts[fullKey];

        // Append superscript ONLY if there are multiple posts at the EXACT SAME FULL TIMESTAMP
        const clockDisplay = totalInSameSecond > 1 ? `${cleanClock}${this.toSuperscript(subIndex)}` : cleanClock;

        return {
          ...p,
          cleanClock: cleanClock,
          subIndex: subIndex,
          clockDisplay: clockDisplay
        };
      });

      // Collect timestamps of all posts written by current user
      const myClocks = new Set();
      if (myLogin) {
        enrichedPosts.forEach(p => {
          if ((p.login || '').trim().toLowerCase() === myLogin) {
            if (p.clockDisplay) myClocks.add(p.clockDisplay);
            if (p.baseClock) myClocks.add(p.baseClock);
            if (p.clock) myClocks.add(p.clock);
          }
        });
      }

      // Check if a post replies to current user via horloge reference or direct handle mention
      const isPostReplyingToMe = (p) => {
        if (!myLogin) return false;
        const msgLower = (p.message || '').toLowerCase();

        if (msgLower.includes(myLogin)) {
          return true;
        }

        if (myClocks.size > 0) {
          const clockMatches = p.message.match(/([0-2]?[0-9]:[0-5][0-9](?::[0-5][0-9])?)(?:([¹²³⁴⁵⁶⁷⁸⁹⁰]+)|[:#^\.](\d+))?/g);
          if (clockMatches) {
            for (const rawClk of clockMatches) {
              const parsedClk = this.parseClockRef(rawClk);
              if (myClocks.has(parsedClk.raw) || myClocks.has(parsedClk.baseClock) || myClocks.has(parsedClk.baseClock.substring(0, 5))) {
                return true;
              }
            }
          }
        }
        return false;
      };

      // 1. Signature check: include BAK toggle & BAK set size in signature
      const bakSig = Array.from(this.bakLogins).sort().join(',');
      const newPostsSig = `${myLogin}|${this.bakEnabled ? 1 : 0}|${bakSig}|` + enrichedPosts.map(p => `${p.id}:${p.clockDisplay}:${p.pending ? '1' : '0'}:${p.message}`).join('|');
      if (!forceScrollBottom && this.lastPostsSig === newPostsSig) {
        return;
      }

      // 2. Measure scroll position before updating HTML
      const oldScrollTop = feed.scrollTop;
      const oldScrollHeight = feed.scrollHeight;
      const distanceFromBottom = oldScrollHeight - oldScrollTop - feed.clientHeight;
      const wasAtBottom = distanceFromBottom < 40;

      let unreadCallsCount = 0;

      // 3. Build HTML string
      const newHtml = enrichedPosts.map(p => {
        const formattedMsg = this.formatMessageText(p.message);
        const isPending = !!p.pending;

        const postLogin = (p.login || '').trim().toLowerCase();
        const isMe = myLogin !== '' && postLogin === myLogin;
        const isReplyToMe = !isMe && isPostReplyingToMe(p);

        // BAK Killfile check
        const isBakLogin = this.bakLogins.has(postLogin);
        const isBakHidden = isBakLogin && this.bakEnabled;
        const isBakVisible = isBakLogin && !this.bakEnabled;

        // Detect Call / Ping for current user (login< or moules<)
        let isCallTargetingMe = false;
        if (!isMe && !isBakHidden) {
          const callRegex = /\b([a-zA-Z0-9_-]+)</g;
          let m;
          while ((m = callRegex.exec(p.message)) !== null) {
            const h = m[1].toLowerCase();
            if (h === 'moules' || (myLogin && h === myLogin)) {
              isCallTargetingMe = true;
              break;
            }
          }
        }

        const isUnreadCall = isCallTargetingMe && !this.readCalls.has(String(p.id));
        if (isUnreadCall) {
          unreadCallsCount++;
        }

        const rowClasses = [
          'tribune-post-row',
          isPending ? 'pending-post' : '',
          isMe ? 'is-current-user' : '',
          isReplyToMe ? 'is-reply-to-me' : '',
          isUnreadCall ? 'has-unread-call' : '',
          isBakHidden ? 'bak-filtered-hidden' : '',
          isBakVisible ? 'bak-filtered-visible' : ''
        ].filter(Boolean).join(' ');

        return `
          <div class="${rowClasses}" data-id="${p.id}" data-clock="${p.clockDisplay}" data-clean-clock="${p.cleanClock}" data-clock-index="${p.subIndex}" data-time-id="${p.time}">
            <span class="tribune-clock" data-clock="${p.clockDisplay}" data-clean-clock="${p.cleanClock}" data-clock-index="${p.subIndex}">${p.clockDisplay}</span>
            <span class="tribune-login ${p.is_admin ? 'is-admin' : ''} ${isMe ? 'my-pseudo' : ''}" title="${this.t('tribune.login_tooltip') || 'Cliquer pour interpeller (bigorno)'}">${this.escapeHtml(p.login)} :</span>
            ${isBakVisible ? '<span class="bak-indicator" title="Utilisateur dans la Boîte à Con (BAK)">🚫 [BAK]</span>' : ''}
            <div class="tribune-message">${formattedMsg}</div>
            ${isPending ? '<span class="tribune-pending-spinner" title="Envoi en cours...">⏳</span>' : ''}
          </div>
        `;
      }).join('');

      feed.innerHTML = newHtml;
      this.lastPostsSig = newPostsSig;
      this.updateWindowTitle(unreadCallsCount);

      // 4. Restore scroll position cleanly
      if (forceScrollBottom || wasAtBottom) {
        feed.scrollTop = feed.scrollHeight;
      } else {
        const newScrollHeight = feed.scrollHeight;
        feed.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
      }

      // 5. Silently prefetch URL link previews in background
      this.prefetchUrlPreviews();
    }

    prefetchUrlPreviews() {
      if (!this.container) return;
      const links = Array.from(this.container.querySelectorAll('#tribuneFeed a.tribune-link'));
      const urlsToFetch = [];

      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && !this.urlPreviewCache[href] && !this.urlPreviewPending.has(href)) {
          this.urlPreviewPending.add(href);
          urlsToFetch.push(href);
        }
      }

      if (urlsToFetch.length === 0) return;

      const prefetchNext = async (index) => {
        if (index >= urlsToFetch.length) return;
        const href = urlsToFetch[index];
        try {
          const res = await fetch(`api.php?action=url_preview&url=${encodeURIComponent(href)}`);
          const data = await res.json();
          if (data && data.success && data.preview) {
            this.urlPreviewCache[href] = data.preview;
          }
        } catch (e) {
        } finally {
          this.urlPreviewPending.delete(href);
        }

        if (window.requestIdleCallback) {
          window.requestIdleCallback(() => prefetchNext(index + 1));
        } else {
          setTimeout(() => prefetchNext(index + 1), 150);
        }
      };

      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => prefetchNext(0));
      } else {
        setTimeout(() => prefetchNext(0), 100);
      }
    }

    formatMessageText(text) {
      if (!text) return '';

      // 1. Decode pre-escaped entities if needed
      const decoded = this.decodeEntities(text);

      // 2. DOM-based HTML Sanitizer & URL Transformer
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${decoded}</body>`, 'text/html');
      const body = doc.body;

      const allowedTags = new Set(['B', 'I', 'S', 'U', 'CODE', 'PRE', 'EM', 'STRONG', 'STRIKE', 'SUB', 'SUP', 'TT', 'A', 'SPAN', 'IMG', 'BR']);

      const processNode = (node) => {
        const children = Array.from(node.childNodes);
        children.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toUpperCase();

            // Completely remove malicious tags (<script>, <iframe>, <object>, <embed>, <style>, etc.)
            if (!allowedTags.has(tagName)) {
              if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SVG', 'CANVAS'].includes(tagName)) {
                child.remove();
                return;
              } else {
                const textNode = doc.createTextNode(child.textContent);
                child.replaceWith(textNode);
                return;
              }
            }

            // Remove inline event handlers (on*) and unsafe protocols (javascript:, vbscript:, data:text/html)
            const attrs = Array.from(child.attributes);
            attrs.forEach(attr => {
              const name = attr.name.toLowerCase();
              const val = attr.value.toLowerCase();

              if (name.startsWith('on') || val.includes('javascript:') || val.includes('vbscript:') || (name === 'href' && val.startsWith('data:'))) {
                child.removeAttribute(attr.name);
              }
            });

            if (tagName === 'A') {
              const href = child.getAttribute('href') || '';
              child.setAttribute('target', '_blank');
              child.setAttribute('rel', 'noopener noreferrer');
              child.classList.add('tribune-link');
              if (href) {
                child.setAttribute('title', href);
                const currentText = child.textContent.trim().toLowerCase();
                if (currentText === '[url]' || currentText === 'url' || currentText === 'link' || currentText === '[link]' || currentText.startsWith('http://') || currentText.startsWith('https://') || currentText.startsWith('www.')) {
                  child.textContent = this.shortenUrl(href);
                }
              }
            } else {
              processNode(child);
            }
          } else if (child.nodeType === Node.TEXT_NODE && child.parentNode?.tagName !== 'A') {
            // Process raw URLs in text nodes outside <a> tags
            const textContent = child.nodeValue;
            const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

            if (urlRegex.test(textContent)) {
              const fragment = doc.createDocumentFragment();
              let lastIndex = 0;
              urlRegex.lastIndex = 0;
              let match;

              while ((match = urlRegex.exec(textContent)) !== null) {
                const url = match[0];
                const matchIndex = match.index;

                if (matchIndex > lastIndex) {
                  fragment.appendChild(doc.createTextNode(textContent.substring(lastIndex, matchIndex)));
                }

                const href = url.startsWith('www.') ? 'http://' + url : url;
                const a = doc.createElement('a');
                a.setAttribute('href', href);
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
                a.classList.add('tribune-link');
                a.setAttribute('title', href);
                a.textContent = this.shortenUrl(url);

                fragment.appendChild(a);
                lastIndex = matchIndex + url.length;
              }

              if (lastIndex < textContent.length) {
                fragment.appendChild(doc.createTextNode(textContent.substring(lastIndex)));
              }

              child.replaceWith(fragment);
            }
          }
        });
      };

      processNode(body);
      let html = body.innerHTML;

      // 3. Convert Horloges (HH:MM:SS or HH:MM with optional superscript ¹ ² ³ or prefix :1 #2 ^3 .4) to clickable ref
      html = html.replace(/([0-2]?[0-9]:[0-5][0-9](?::[0-5][0-9])?)(?:([¹²³⁴⁵⁶⁷⁸⁹⁰]+)|[:#^\.](\d+))?/g, (match, base, superDigits, numDigits) => {
        let index = 1;
        if (superDigits) {
          index = parseInt(this.fromSuperscript(superDigits), 10) || 1;
        } else if (numDigits) {
          index = parseInt(numDigits, 10) || 1;
        }
        const canonicalClock = `${base}${index > 1 ? this.toSuperscript(index) : (superDigits || '')}`;
        return `<span class="clock-ref" data-clock="${this.escapeHtml(canonicalClock)}" data-base-clock="${this.escapeHtml(base)}" data-clock-index="${index}">${this.escapeHtml(match)}</span>`;
      });

      // 4. Convert Totoz [:totoz_name] to img via same-origin backend proxy
      html = html.replace(/\[:([a-zA-Z0-9_\.: -]+)\]/g, (match, totozName) => {
        const isNsfw = totozName.toLowerCase().includes('nsfw');
        const blurClass = (isNsfw && !this.nsfwEnabled) ? 'nsfw-blurred' : '';
        const proxyUrl = `api.php?action=totoz_proxy&name=${encodeURIComponent(totozName)}`;
        return `<img class="totoz-img ${blurClass}" src="${proxyUrl}" alt="[:${this.escapeHtml(totozName)}]" title="[:${this.escapeHtml(totozName)}]" />`;
      });

      // 5. Convert Calls/Pings handle< (e.g. oktail<, moules<) to badge
      html = html.replace(/\b([a-zA-Z0-9_-]+)&lt;/gi, (match, handle) => {
        const handleLower = handle.toLowerCase();
        const myLower = (this.userLogin || '').trim().toLowerCase();
        const isMeCall = (handleLower === 'moules') || (myLower !== '' && handleLower === myLower);

        return `<span class="tribune-call ${isMeCall ? 'call-for-me' : ''}" data-call="${this.escapeHtml(handle)}">${this.escapeHtml(handle)}&lt;</span>`;
      });

      return html;
    }

    decodeEntities(text) {
      if (!text) return '';
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    }

    shortenUrl(url) {
      try {
        const parsed = new URL(url.startsWith('www.') ? 'http://' + url : url);
        let host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        let path = parsed.pathname + parsed.search;

        if (host.includes('youtube.com') || host.includes('youtu.be')) {
          return '🎥 YouTube';
        }
        if (host.includes('linuxfr.org')) {
          return '🐧 LinuxFR';
        }
        if (host.includes('github.com')) {
          const parts = path.split('/').filter(Boolean);
          const repo = parts.slice(0, 2).join('/');
          return repo ? `🐙 GitHub (${repo})` : '🐙 GitHub';
        }
        if (host.includes('twitter.com') || host === 'x.com') {
          return '𝕏 X (Twitter)';
        }
        if (host.includes('wikipedia.org')) {
          return '🌐 Wikipedia';
        }
        if (host.includes('reddit.com') || host.includes('redd.it')) {
          return '🤖 Reddit';
        }
        if (host.includes('gitlab.com')) {
          return '🦊 GitLab';
        }
        if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path)) {
          return '🖼️ Image';
        }

        // Default domain label
        if (path.length > 20) {
          path = path.substring(0, 18) + '…';
        }
        return `🌐 ${host}${path === '/' ? '' : path}`;
      } catch (e) {
        return url.length > 30 ? `🌐 ${url.substring(0, 27)}…` : `🌐 ${url}`;
      }
    }

    parsePostDate(p) {
      if (!p) return null;
      const rawTime = p.time || p.timestamp || p.datetime;

      if (rawTime) {
        if (typeof rawTime === 'number') {
          return new Date(rawTime < 1e11 ? rawTime * 1000 : rawTime);
        }
        const strTime = String(rawTime).trim();

        // 1. YYYYMMDDHHMMSS (14 digits) e.g. "20260822070000"
        if (/^\d{14}$/.test(strTime)) {
          const y = parseInt(strTime.substring(0, 4), 10);
          const m = parseInt(strTime.substring(4, 6), 10) - 1;
          const d = parseInt(strTime.substring(6, 8), 10);
          const hh = parseInt(strTime.substring(8, 10), 10);
          const mm = parseInt(strTime.substring(10, 12), 10);
          const ss = parseInt(strTime.substring(12, 14), 10);
          return new Date(y, m, d, hh, mm, ss);
        }

        // 2. YYYY-MM-DD HH:MM:SS or ISO string
        const isoDate = new Date(strTime.includes('T') ? strTime : strTime.replace(' ', 'T'));
        if (!isNaN(isoDate.getTime())) {
          return isoDate;
        }

        // 3. Pure numeric timestamp string
        if (/^\d+$/.test(strTime)) {
          const num = parseInt(strTime, 10);
          return new Date(num < 1e11 ? num * 1000 : num);
        }
      }

      // 4. Fallback to clock HH:MM:SS
      if (p.clock) {
        const parts = p.clock.split(':').map(Number);
        if (parts.length >= 2) {
          const now = new Date();
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0], parts[1], parts[2] || 0);
          if (d.getTime() > now.getTime()) {
            d.setTime(d.getTime() - 24 * 3600 * 1000);
          }
          return d;
        }
      }

      return null;
    }

    computeTelemetry24h() {
      const nowMs = Date.now();
      const numPoints = 48; // 48 sample points over 24h (one every 30 minutes)
      const windowSpanMs = 24 * 3600 * 1000;
      const stepMs = windowSpanMs / (numPoints - 1);
      const slidingWindowMs = 3600 * 1000; // 1-hour moving window

      const buckets = [];

      // Parse and cache post dates once
      const parsedPosts = (this.posts || []).map(p => ({
        post: p,
        date: this.parsePostDate(p),
        login: p.login ? p.login.trim().toLowerCase() : '',
        totozCount: ((p.message || '').match(/\[:([a-zA-Z0-9_\.: -]+)\]/g) || []).length,
        trollCount: ((p.message || '').toLowerCase().match(/\b(linux|windows|php|rust|systemd|emacs|vim|troll|fail|caca|suicide|mac|débat|drama|bouchot)\b/g) || []).length
      })).filter(item => item.date && !isNaN(item.date.getTime()));

      for (let i = 0; i < numPoints; i++) {
        const sampleTimeMs = (nowMs - windowSpanMs) + i * stepMs;
        const windowStartMs = sampleTimeMs - slidingWindowMs;
        const windowEndMs = sampleTimeMs;

        const sampleDate = new Date(sampleTimeMs);
        const hh = String(sampleDate.getHours()).padStart(2, '0');
        const mm = String(sampleDate.getMinutes()).padStart(2, '0');
        const timeLabel = `${hh}:${mm}`;

        const minutesAgo = Math.round((nowMs - sampleTimeMs) / 60000);
        let timeAgoStr = 'Maintenant';
        if (minutesAgo >= 60) {
          timeAgoStr = `-${(minutesAgo / 60).toFixed(1)}h`;
        } else if (minutesAgo > 1) {
          timeAgoStr = `-${minutesAgo}m`;
        }

        const windowPosts = parsedPosts.filter(item => {
          const t = item.date.getTime();
          return t >= windowStartMs && t <= windowEndMs;
        });

        const postsCount = windowPosts.length;
        const logins = new Set(windowPosts.map(item => item.login).filter(Boolean));
        const totozCount = windowPosts.reduce((acc, item) => acc + item.totozCount, 0);
        const trollKeywordsCount = windowPosts.reduce((acc, item) => acc + item.trollCount, 0);

        let trollIndex = 0;
        if (postsCount > 0) {
          const kpp = trollKeywordsCount / postsCount;
          const keywordScore = Math.min(80, kpp * 40);
          const rapidFireBonus = Math.min(20, Math.max(0, postsCount - 8) * 1.5);
          trollIndex = Math.min(100, Math.round(keywordScore + rapidFireBonus));
        }

        buckets.push({
          sampleTimeMs,
          timeLabel,
          timeAgoStr,
          postsCount,
          logins,
          totozCount,
          trollKeywordsCount,
          trollIndex
        });
      }

      return buckets;
    }

    renderTelemetryUI() {
      if (!this.container) return;
      const summaryElem = this.container.querySelector('#tribuneTelemetrySummary');
      const svgElem = this.container.querySelector('#tribuneStatSvg');
      const tooltipElem = this.container.querySelector('#tribuneStatTooltip');
      const footerElem = this.container.querySelector('#tribuneStatFooter');
      if (!summaryElem || !svgElem) return;

      const nowMs = Date.now();
      const windowStart24h = nowMs - 24 * 3600 * 1000;

      // 24h Totals for top KPI cards
      const posts24h = (this.posts || []).filter(p => {
        const d = this.parsePostDate(p);
        return d && d.getTime() >= windowStart24h && d.getTime() <= nowMs;
      });

      const totalPosts24h = posts24h.length;
      const allLogins24h = new Set(posts24h.map(p => p.login ? p.login.trim().toLowerCase() : '').filter(Boolean));
      const totalTotoz24h = posts24h.reduce((acc, p) => acc + (((p.message || '').match(/\[:([a-zA-Z0-9_\.: -]+)\]/g) || []).length), 0);

      const buckets = this.computeTelemetry24h();
      let maxTroll24h = 0;
      buckets.forEach(b => {
        if (b.trollIndex > maxTroll24h) maxTroll24h = b.trollIndex;
      });

      const trollColor = maxTroll24h > 55 ? '#ef4444' : (maxTroll24h > 25 ? '#eab308' : '#22c55e');

      summaryElem.innerHTML = `
        <div class="telemetry-kpi-card">
          <div class="telemetry-kpi-val" style="color:#38bdf8;">${totalPosts24h}</div>
          <div class="telemetry-kpi-lbl">Posts</div>
        </div>
        <div class="telemetry-kpi-card">
          <div class="telemetry-kpi-val" style="color:#10b981;">${allLogins24h.size}</div>
          <div class="telemetry-kpi-lbl">Logins</div>
        </div>
        <div class="telemetry-kpi-card">
          <div class="telemetry-kpi-val" style="color:#f59e0b;">${totalTotoz24h}</div>
          <div class="telemetry-kpi-lbl">Totoz</div>
        </div>
        <div class="telemetry-kpi-card">
          <div class="telemetry-kpi-val" style="color:${trollColor};">${maxTroll24h}%</div>
          <div class="telemetry-kpi-lbl">Troll Max</div>
        </div>
      `;

      const metric = this.activeTelemetryMetric || 'posts';
      let metricColor = '#38bdf8';
      let gradientId = 'gradPosts';

      if (metric === 'logins') {
        metricColor = '#10b981';
        gradientId = 'gradLogins';
      } else if (metric === 'totoz') {
        metricColor = '#f59e0b';
        gradientId = 'gradTotoz';
      } else if (metric === 'troll') {
        metricColor = '#a855f7';
        gradientId = 'gradTroll';
      }

      const values = buckets.map(b => {
        if (metric === 'posts') return b.postsCount;
        if (metric === 'logins') return b.logins.size;
        if (metric === 'totoz') return b.totozCount;
        if (metric === 'troll') return b.trollIndex;
        return b.postsCount;
      });

      const currentVal = values[values.length - 1] || 0;
      const minVal = Math.min(...values);
      const peakVal = Math.max(...values);

      if (footerElem) {
        footerElem.innerHTML = `
          <span>Min: ${minVal}</span>
          <span>Actuel: ${currentVal}</span>
          <span>Pic: ${peakVal}${metric === 'troll' ? '%' : ''}</span>
        `;
      }

      const maxVal = metric === 'troll' ? 100 : Math.max(1, peakVal);
      const numPoints = buckets.length;

      const points = values.map((val, i) => {
        const x = (10 + (i / (numPoints - 1)) * 300).toFixed(1);
        const y = (70 - (val / maxVal) * 60).toFixed(1);
        return { x: parseFloat(x), y: parseFloat(y), val, bucket: buckets[i] };
      });

      const dPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const dFill = `${dPath} L 310 75 L 10 75 Z`;

      const zoneWidth = (300 / numPoints).toFixed(1);

      svgElem.innerHTML = `
        <defs>
          <linearGradient id="gradPosts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0"/>
          </linearGradient>
          <linearGradient id="gradLogins" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
          </linearGradient>
          <linearGradient id="gradTotoz" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
          </linearGradient>
          <linearGradient id="gradTroll" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#a855f7" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#a855f7" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- System-Monitor style gridlines -->
        <line x1="10" y1="10" x2="310" y2="10" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2"/>
        <line x1="10" y1="40" x2="310" y2="40" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2,2"/>
        <line x1="10" y1="75" x2="310" y2="75" stroke="rgba(255,255,255,0.1)"/>

        <!-- Filled area & Smooth line -->
        <path d="${dFill}" fill="url(#${gradientId})" />
        <path d="${dPath}" fill="none" stroke="${metricColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" filter="drop-shadow(0px 2px 4px ${metricColor}66)"/>

        <!-- Hover target zones -->
        ${points.map((p, i) => `
          <rect class="stat-hover-zone" data-idx="${i}" x="${p.x - zoneWidth / 2}" y="0" width="${zoneWidth}" height="80" fill="transparent" style="cursor:pointer;" />
        `).join('')}
        
        <!-- Active highlight point (hidden by default) -->
        <circle id="statActiveDot" cx="0" cy="0" r="4.5" fill="${metricColor}" stroke="#ffffff" stroke-width="2" style="display:none; pointer-events:none; transition:all 0.1s ease;" />
      `;

      const hoverZones = svgElem.querySelectorAll('.stat-hover-zone');
      const activeDot = svgElem.querySelector('#statActiveDot');
      const graphContainer = this.container.querySelector('#tribuneGraphContainer');

      hoverZones.forEach(zone => {
        zone.addEventListener('mouseenter', () => {
          const idx = parseInt(zone.dataset.idx, 10);
          const p = points[idx];
          if (!p || !tooltipElem || !graphContainer || !activeDot) return;

          activeDot.setAttribute('cx', p.x);
          activeDot.setAttribute('cy', p.y);
          activeDot.style.display = 'block';

          const rect = graphContainer.getBoundingClientRect();
          const pct = p.x / 320;
          let transformX = '-50%';
          if (pct > 0.60) {
            transformX = '-95%';
          } else if (pct < 0.40) {
            transformX = '-5%';
          }

          const left = (p.x / 320) * rect.width;
          const top = (p.y / 80) * rect.height;

          tooltipElem.innerHTML = `
            <div style="font-weight:700; color:${metricColor}; margin-bottom:2px;">🕒 ${p.bucket.timeLabel} (${p.bucket.timeAgoStr})</div>
            <div>📊 ${p.bucket.postsCount} posts / h | 👥 ${p.bucket.logins.size} logins</div>
            <div>🎭 ${p.bucket.totozCount} totoz | 💥 Troll: ${p.bucket.trollIndex}%</div>
          `;
          tooltipElem.style.left = `${left}px`;
          tooltipElem.style.top = `${top}px`;
          tooltipElem.style.transform = `translate(${transformX}, -100%)`;
          tooltipElem.style.display = 'block';
        });

        zone.addEventListener('mouseleave', () => {
          if (activeDot) activeDot.style.display = 'none';
          if (tooltipElem) tooltipElem.style.display = 'none';
        });
      });
    }

    updateTrollometer() {
      this.renderTelemetryUI();
    }

    playCoincoinSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch (e) {}
    }

    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Initialize Singleton & Register in AppManager
  const instance = new TribuneApp();
  window.TribuneApp = instance;
  window.tribuneApp = instance;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('tribune', instance);
  }
  if (window.AppManager) {
    window.AppManager.registerInstance('tribune', instance);
  }
})(window);
