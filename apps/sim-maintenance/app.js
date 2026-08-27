/**
 * SimpleGallery WebOS - Sim Maintenance Application (SimMaintenanceApp)
 * Professional Aviation Form Engine (PF, 1W, C1, C2, C3, D1-1, D1-2, D2-1, D2-2, SF)
 * Full iPad & Safari iOS Compatibility (No ES2020 operators, Touch Optimized Canvas, Real-Time Telemetry).
 */

(function (window) {
    'use strict';

    class SimMaintenanceApp {
        constructor() {
            this.winId = 'sim-maintenance-window';
            this.appId = 'sim-maintenance';
            this.container = null;
            this.win = null;
            // Telemetry Controls State
            this.telCount = 120;
            this.telOffset = 0;
            this.telLinearize = 1;
            this.telLinlen = 10;
            this.telStep = 60;

            // Live Telemetry Cache
            this.telemetryData = {
                temperature: 23.0,
                humidity: 74.0,
                time: '08:30:00 AM',
                date: new Date().toISOString().split('T')[0],
                isoDate: new Date().toISOString().split('T')[0],
                mcc: '1588',
                main: '51018'
            };

            this.currentChecklistType = 'pf';
            this.activeSheets = [
                { id: 'sheet_1', type: 'pf' }
            ];
            this.activeTab = 'checklists';

            // Subsystems Real-Time Streaming & Polling State
            this.telemetryPollingIntervalMs = 500;
            this.isTelemetryPaused = false;
            this.subsystemsPacketCount = 0;
            this.lastFrameLatencyMs = 0;
            this.fastTelemetryInterval = null;

            // Technicians state
            this.technicians = ["SHEKH V. LECOQ", "V. LECOQ", "SHEKH", "D. FUKUDA", "AHJ TECH"];
            this.selectedTechnician = "SHEKH V. LECOQ";

            // Signature pad states
            this.isDrawing = false;
            this.sigCanvas = null;
            this.sigCtx = null;

            // Bind methods for system event listeners
            this.onLocaleChanged = this.onLocaleChanged.bind(this);
            this.onThemeChanged = this.onThemeChanged.bind(this);

            // Listen to system WebOS events
            if (window.EventBus) {
                window.EventBus.on('locale:changed', this.onLocaleChanged);
                window.EventBus.on('theme:changed', this.onThemeChanged);
            }
        }

        getApiUrl(action, params) {
            var isStandalone = window.location.pathname.indexOf('/apps/sim-maintenance') !== -1;
            var base = isStandalone ? 'api.php' : 'apps/sim-maintenance/api.php';
            var url = base + '?action=' + encodeURIComponent(action);
            if (params) {
                for (var k in params) {
                    if (params.hasOwnProperty(k) && params[k] !== undefined && params[k] !== null) {
                        url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
                    }
                }
            }
            return url;
        }

        async loadLocalLocale(lang) {
            lang = lang || this.getCurrentLocale();
            this.localesCache = this.localesCache || {};
            if (this.localesCache[lang]) return this.localesCache[lang];

            try {
                var isStandalone = window.location.pathname.indexOf('/apps/sim-maintenance') !== -1;
                var basePath = isStandalone ? 'locales/' : 'apps/sim-maintenance/locales/';
                var res = await fetch(basePath + lang + '.json');
                if (res.ok) {
                    var data = await res.json();
                    this.localesCache[lang] = data;
                    return data;
                }
            } catch (err) {
                console.warn('[SimMaintenance] Could not load private locale file:', lang, err);
            }
            return null;
        }

        t(key, fallback) {
            fallback = fallback || '';
            var loc = this.getCurrentLocale();

            // 1. Chercher dans les locales privées de sim-maintenance
            if (this.localesCache && this.localesCache[loc] && this.localesCache[loc][key]) {
                return this.localesCache[loc][key];
            }

            // 2. Chercher dans les moteurs globaux
            if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
                var res = window.sys.i18n.t(key);
                if (res && res !== key) return res;
            }
            if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
                var res2 = window.I18nEngine.t(key);
                if (res2 && res2 !== key) return res2;
            }
            if (window.desktop && typeof window.desktop.t === 'function') {
                var res3 = window.desktop.t(key);
                if (res3 && res3 !== key) return res3;
            }

            return fallback || key;
        }

        async onLocaleChanged() {
            var loc = this.getCurrentLocale();
            await this.loadLocalLocale(loc);
            if (this.win && typeof this.win.setTitle === 'function') {
                this.win.setTitle('🛠️ ' + this.t('apps.sim-maintenance.title', 'Sim Maintenance') + ' — EC135 FFS');
            }
            if (this.container) {
                this.renderLayout();
                if (this.activeTab === 'checklists') {
                    this.loadActiveChecklist();
                } else if (this.activeTab === 'telemetry') {
                    this.loadTelemetry();
                    this.loadTelemetryHistory();
                } else if (this.activeTab === 'archives') {
                    this.loadArchives();
                }
            }
        }

        onThemeChanged() {
            if (this.container) {
                this.renderLayout();
                if (this.activeTab === 'checklists') {
                    this.loadActiveChecklist();
                } else if (this.activeTab === 'telemetry') {
                    this.loadTelemetry();
                    this.loadTelemetryHistory();
                } else if (this.activeTab === 'archives') {
                    this.loadArchives();
                }
            }
        }

        open(fileOrParams, params) {
            params = params || ((typeof fileOrParams === 'object' && fileOrParams && !fileOrParams.name) ? fileOrParams : {});

            if (window.WindowManager && window.WindowManager.windows && window.WindowManager.windows.has(this.winId)) {
                var existingWin = window.WindowManager.windows.get(this.winId);
                if (existingWin) {
                    if (typeof existingWin.restore === 'function' && existingWin.isMinimized) {
                        existingWin.restore();
                    }
                    if (typeof existingWin.focus === 'function') {
                        existingWin.focus();
                    }
                    return existingWin;
                }
            }

            var wrapper = document.createElement('div');
            wrapper.className = 'sim-maint-container';
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';

            if (!window.WindowManager) {
                console.error('[SimMaintenance] WindowManager is not available');
                return null;
            }

            var winTitle = '🛠️ ' + this.t('apps.sim-maintenance.title', 'Sim Maintenance') + ' — EC135 FFS';
            this.win = window.WindowManager.createWindow({
                id: this.winId,
                appId: 'sim-maintenance',
                appName: 'Sim Maintenance',
                title: winTitle,
                icon: '🛠️',
                width: 1140,
                height: 750,
                minWidth: 720,
                minHeight: 480,
                content: wrapper,
                onClose: () => {
                    this.destroy();
                    this.container = null;
                    this.win = null;
                }
            });

            this.init(wrapper, params);
            return this.win;
        }

        async init(container, launchArgs) {
            this.container = container;

            if (launchArgs && launchArgs.tab) {
                this.activeTab = launchArgs.tab;
            }

            await this.loadLocalLocale();
            await this.loadTechnicians();
            await this.loadTelemetry();

            this.renderLayout();
            this.loadActiveChecklist();
            this.loadTelemetryHistory();
            this.loadArchives();

            // Periodic telemetry polling
            if (this.telemetryInterval) clearInterval(this.telemetryInterval);
            var pollCounter = 0;
            this.telemetryInterval = setInterval(() => {
                this.loadTelemetry();
                pollCounter++;
                // Refresh live charts every 30 seconds if on telemetry tab and in live mode (offset == 0)
                if (pollCounter % 3 === 0 && this.activeTab === 'telemetry' && this.telOffset === 0) {
                    this.loadTelemetryHistory();
                }
            }, 10000);
        }

        destroy() {
            if (this.telemetryInterval) {
                clearInterval(this.telemetryInterval);
                this.telemetryInterval = null;
            }
            if (this.fastTelemetryInterval) {
                clearInterval(this.fastTelemetryInterval);
                this.fastTelemetryInterval = null;
            }
        }

        async loadTechnicians() {
            try {
                var res = await fetch(this.getApiUrl('get_technicians'));
                var data = await res.json();
                if (data && data.success && Array.isArray(data.technicians) && data.technicians.length > 0) {
                    this.technicians = data.technicians;
                    if (this.technicians.indexOf(this.selectedTechnician) === -1) {
                        this.selectedTechnician = this.technicians[0];
                    }
                }
            } catch (err) {
                console.error("Error loading technicians", err);
            }
        }

        getCurrentLocale() {
            if (window.sys && window.sys.i18n && window.sys.i18n.currentLocale) {
                return window.sys.i18n.currentLocale;
            }
            if (window.I18nEngine && window.I18nEngine.currentLocale) {
                return window.I18nEngine.currentLocale;
            }
            return localStorage.getItem('sg_locale') || 'fr';
        }

        renderLayout() {
            var title = this.t('apps.sim-maintenance.title', 'Sim Maintenance');
            var subtitle = this.t('apps.sim-maintenance.subtitle', 'Technical Checklists, Environmental Telemetry & Compliance');
            var curLang = this.getCurrentLocale();

            var techOptions = this.technicians.map(function (tech) {
                var isSel = (tech === this.selectedTechnician) ? 'selected' : '';
                return '<option value="' + tech + '" ' + isSel + '>' + tech + '</option>';
            }.bind(this)).join('');

            this.container.innerHTML = `
                <div class="sim-maint-header">
                    <div class="sim-maint-brand">
                        <span class="sim-maint-icon">🛠️</span>
                        <div>
                            <div class="sim-maint-title">${title} — EC135 FFS</div>
                            <div class="sim-maint-subtitle">${subtitle}</div>
                        </div>
                    </div>

                    <div class="sim-header-right-zone">
                        <div class="sim-tabs-nav">
                            <button class="sim-tab-btn ${this.activeTab === 'checklists' ? 'active' : ''}" data-tab="checklists">
                                📋 ${this.t('sim_maint.tab_checklists', 'Periodic Checklists')}
                            </button>
                            <button class="sim-tab-btn ${this.activeTab === 'climate' ? 'active' : ''}" data-tab="climate">
                                🌡️ ${this.t('sim_maint.tab_climate', 'Room Climate & Weather')}
                            </button>
                            <button class="sim-tab-btn ${this.activeTab === 'subsystems' ? 'active' : ''}" data-tab="subsystems">
                                📡 ${this.t('sim_maint.tab_subsystems', 'FFS Telemetry & Systems')}
                            </button>
                            <button class="sim-tab-btn ${this.activeTab === 'archives' ? 'active' : ''}" data-tab="archives">
                                📁 ${this.t('sim_maint.tab_archives', 'Certified Archives')}
                            </button>
                        </div>

                        <div class="sim-lang-switcher" title="Language / Langue">
                            <button type="button" class="sim-lang-pill ${curLang === 'fr' ? 'active' : ''}" data-lang="fr">🇫🇷 FR</button>
                            <button type="button" class="sim-lang-pill ${curLang === 'en' ? 'active' : ''}" data-lang="en">🇬🇧 EN</button>
                            <button type="button" class="sim-lang-pill ${curLang === 'ja' ? 'active' : ''}" data-lang="ja">🇯🇵 JA</button>
                        </div>
                    </div>
                </div>

                <div class="sim-maint-content">
                    <!-- Tab 1: Checklists (A4 Pro Paper View) -->
                    <div class="sim-tab-view ${this.activeTab === 'checklists' ? 'active' : ''}" id="sim-view-checklists">
                        <div class="paper-workspace">
                            <!-- Top Sticky Action Bar (Fully Internationalized) -->
                            <div class="paper-sticky-bar">
                                <div class="paper-bar-section">
                                    <span class="paper-bar-label">${this.t('sim_maint.select_inspection', 'Inspection :')}</span>
                                    <select class="paper-select" id="paper-select-type">
                                        <option value="pf">${this.t('sim_maint.form_pf', 'Pre-Flight (PF) — Daily Check Sheet')}</option>
                                        <option value="1w">${this.t('sim_maint.form_1w', '1-Week Periodic (1W)')}</option>
                                        <option value="c1">${this.t('sim_maint.form_c1', 'Monthly (C1)')}</option>
                                        <option value="c2">${this.t('sim_maint.form_c2', 'Monthly (C2)')}</option>
                                        <option value="c3">${this.t('sim_maint.form_c3', 'Monthly (C3)')}</option>
                                        <option value="d1-1">${this.t('sim_maint.form_d1_1', 'D1 Check (Page 1/2)')}</option>
                                        <option value="d1-2">${this.t('sim_maint.form_d1_2', 'D1 Check (Page 2/2)')}</option>
                                        <option value="d2-1">${this.t('sim_maint.form_d2_1', 'D2 Check (Page 1/2)')}</option>
                                        <option value="d2-2">${this.t('sim_maint.form_d2_2', 'D2 Check (Page 2/2)')}</option>
                                        <option value="sf">${this.t('sim_maint.form_sf', 'Test Flight (模擬飛行装置点検表)')}</option>
                                    </select>
                                    <div class="add-sheet-dropdown-container">
                                        <button type="button" class="btn-add-sheet" id="paper-btn-add-menu" title="${this.t('sim_maint.add_sheet_tooltip', 'Ajouter un formulaire à la suite (liasse)')}">
                                             <span>➕ ${this.t('sim_maint.add_btn', 'Ajouter')} ▾</span>
                                        </button>
                                        <div class="add-sheet-menu-popover" id="add-sheet-popover" style="display: none;">
                                            <div class="add-sheet-menu-header">📋 ${this.t('sim_maint.add_form_to_batch', 'Ajouter à la suite :')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="pf"><span class="menu-sheet-badge">PF</span> ${this.t('sim_maint.form_pf', 'Pre-Flight (PF) — Daily Check Sheet')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="1w"><span class="menu-sheet-badge">1W</span> ${this.t('sim_maint.form_1w', '1-Week Periodic (1W)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="c1"><span class="menu-sheet-badge">C1</span> ${this.t('sim_maint.form_c1', 'Monthly (C1)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="c2"><span class="menu-sheet-badge">C2</span> ${this.t('sim_maint.form_c2', 'Monthly (C2)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="c3"><span class="menu-sheet-badge">C3</span> ${this.t('sim_maint.form_c3', 'Monthly (C3)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="d1-1"><span class="menu-sheet-badge">D1-1</span> ${this.t('sim_maint.form_d1_1', 'D1 Check (Page 1/2)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="d1-2"><span class="menu-sheet-badge">D1-2</span> ${this.t('sim_maint.form_d1_2', 'D1 Check (Page 2/2)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="d2-1"><span class="menu-sheet-badge">D2-1</span> ${this.t('sim_maint.form_d2_1', 'D2 Check (Page 1/2)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="d2-2"><span class="menu-sheet-badge">D2-2</span> ${this.t('sim_maint.form_d2_2', 'D2 Check (Page 2/2)')}</div>
                                            <div class="add-sheet-menu-item" data-add-type="sf"><span class="menu-sheet-badge">SF</span> ${this.t('sim_maint.form_sf', 'Test Flight (模擬飛行装置点検表)')}</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="paper-bar-section">
                                    <span class="paper-bar-label">${this.t('sim_maint.inspector', 'Technician :')}</span>
                                    <select class="paper-select" id="paper-select-technician">
                                        ${techOptions}
                                    </select>
                                    <button class="sim-tab-btn" id="paper-btn-manage-techs" title="${this.t('sim_maint.manage_techs', 'Manage Technicians')}" style="padding: 5px 8px; font-size: 13px;">⚙️</button>
                                </div>

                                <div class="paper-bar-section" style="margin-left: auto;">
                                    <button class="sim-tab-btn" id="paper-btn-toggle-all" style="font-size: 11px;">${this.t('sim_maint.toggle_all', '✓ Toggle All Checks')}</button>
                                    <button class="sim-tab-btn" id="paper-btn-print" style="font-size: 11px;">${this.t('sim_maint.print_a4', '🖨️ Print A4')}</button>
                                    <button class="sim-btn-submit" id="paper-btn-save-main" style="background: var(--accent-primary, #f59e0b); color: #111827; height: 34px; padding: 0 16px; font-size: 12px;">
                                        <span>💾 <strong>${this.t('sim_maint.save_archive_btn', 'SEND & ARCHIVE')}</strong></span>
                                    </button>
                                </div>
                            </div>

                            <!-- Authentic A4 Paper Sheets Container -->
                            <div id="paper-sheets-container" style="width: 100%; display: flex; flex-direction: column; align-items: center;"></div>
                        </div>
                    </div>

                    <!-- Tab 2: Climate & Room Sensors (Dedicated Environmental Page) -->
                    <div class="sim-tab-view ${this.activeTab === 'climate' ? 'active' : ''}" id="sim-view-climate">
                        <div class="telemetry-dashboard">
                            <!-- Hero Live Climate Grid -->
                            <div class="tel-hero-grid">
                                <!-- Temperature Card -->
                                <div class="tel-hero-card temp-card">
                                    <div class="tel-card-top">
                                        <span class="tel-card-label">🌡️ ${this.t('sim_maint.temperature', 'Control Room Temperature')}</span>
                                        <span class="tel-live-pill status-optimal" id="maint-temp-pill">
                                            <span class="tel-live-dot"></span> <span id="maint-temp-status-text">${this.t('sim_maint.status_optimal', 'OPTIMAL')}</span>
                                        </span>
                                    </div>
                                    <div class="tel-value-row">
                                        <span class="tel-hero-num" id="maint-temp-val-big">${this.telemetryData.temperature.toFixed(1)}</span>
                                        <span class="tel-hero-unit">°C</span>
                                    </div>
                                    <div class="tel-range-bar-container">
                                        <div class="tel-range-track">
                                            <div class="tel-range-fill" id="tel-temp-bar-fill" style="width: 58%; background: linear-gradient(90deg, #10b981, #f59e0b);"></div>
                                        </div>
                                        <div class="tel-range-labels">
                                            <span>Min 15°C</span>
                                            <span style="color:#10b981;">${this.t('sim_maint.nominal_temp', 'Opt: 18°C ~ 24°C')}</span>
                                            <span>Max 27°C</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Humidity Card -->
                                <div class="tel-hero-card hum-card">
                                    <div class="tel-card-top">
                                        <span class="tel-card-label">💧 ${this.t('sim_maint.humidity', 'Control Room Humidity')}</span>
                                        <span class="tel-live-pill status-warning" id="maint-hum-pill">
                                            <span class="tel-live-dot" style="background:#f59e0b; box-shadow:0 0 8px #f59e0b;"></span> <span id="maint-hum-status-text">${this.t('sim_maint.status_warning', 'WARNING')}</span>
                                        </span>
                                    </div>
                                    <div class="tel-value-row">
                                        <span class="tel-hero-num" id="maint-hum-val-big">${this.telemetryData.humidity.toFixed(1)}</span>
                                        <span class="tel-hero-unit">% RH</span>
                                    </div>
                                    <div class="tel-range-bar-container">
                                        <div class="tel-range-track">
                                            <div class="tel-range-fill" id="tel-hum-bar-fill" style="width: 79%; background: linear-gradient(90deg, #06b6d4, #f59e0b);"></div>
                                        </div>
                                        <div class="tel-range-labels">
                                            <span>Min 20%</span>
                                            <span style="color:#06b6d4;">${this.t('sim_maint.nominal_hum', 'Opt: 40% ~ 60%')}</span>
                                            <span>Max 80%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Futuristic Controls Panel -->
                            <div class="tel-control-panel">
                                <div class="tel-group">
                                    <span class="tel-group-label">⚡ ${this.t('sim_maint.smoothing', 'Smoothing:')}</span>
                                    <select class="tel-select-styled" id="tel-select-linlen">
                                        <option value="10" ${this.telLinlen == 10 ? 'selected' : ''}>${this.t('sim_maint.avg_10m', '10 min avg')}</option>
                                        <option value="30" ${this.telLinlen == 30 ? 'selected' : ''}>${this.t('sim_maint.avg_30m', '30 min avg')}</option>
                                        <option value="60" ${this.telLinlen == 60 ? 'selected' : ''}>${this.t('sim_maint.avg_1h', '1 hour avg')}</option>
                                        <option value="480" ${this.telLinlen == 480 ? 'selected' : ''}>${this.t('sim_maint.avg_8h', '8 hours avg')}</option>
                                    </select>
                                </div>

                                <div class="tel-group">
                                    <span class="tel-group-label">⏱️ ${this.t('sim_maint.range', 'Range:')}</span>
                                    <button type="button" class="tel-btn-segmented ${this.telCount == 60 ? 'active' : ''}" data-count="60">1H</button>
                                    <button type="button" class="tel-btn-segmented ${this.telCount == 120 ? 'active' : ''}" data-count="120">2H</button>
                                    <button type="button" class="tel-btn-segmented ${this.telCount == 240 ? 'active' : ''}" data-count="240">4H</button>
                                    <button type="button" class="tel-btn-segmented ${this.telCount == 480 ? 'active' : ''}" data-count="480">8H</button>
                                    <button type="button" class="tel-btn-segmented ${this.telCount == 960 ? 'active' : ''}" data-count="960">16H</button>
                                    <button type="button" class="tel-btn-segmented ${this.telCount == 1440 ? 'active' : ''}" data-count="1440">1D</button>
                                    <button type="button" class="tel-btn-segmented ${this.telCount == 10080 ? 'active' : ''}" data-count="10080">1W</button>
                                </div>

                                <div class="tel-group">
                                    <span class="tel-group-label">🧭 ${this.t('sim_maint.navigation', 'Navigation:')}</span>
                                    <select class="tel-select-styled" id="tel-select-step" style="width:70px;">
                                        <option value="60" ${this.telStep == 60 ? 'selected' : ''}>1h</option>
                                        <option value="120" ${this.telStep == 120 ? 'selected' : ''}>2h</option>
                                        <option value="240" ${this.telStep == 240 ? 'selected' : ''}>4h</option>
                                        <option value="480" ${this.telStep == 480 ? 'selected' : ''}>8h</option>
                                        <option value="1440" ${this.telStep == 1440 ? 'selected' : ''}>24h</option>
                                    </select>
                                    <div class="tel-nav-pill">
                                        <button type="button" class="tel-nav-btn" id="tel-btn-step-prev" title="${this.t('sim_maint.step_back', 'Step Back in Time')}">◀ ◀</button>
                                        <button type="button" class="tel-nav-btn" id="tel-btn-step-now" title="${this.t('sim_maint.live_now', 'Real Time (Live)')}">LIVE</button>
                                        <button type="button" class="tel-nav-btn" id="tel-btn-step-next" title="${this.t('sim_maint.step_forward', 'Step Forward')}">▶ ▶</button>
                                    </div>
                                    <span id="tel-offset-indicator" class="tel-offset-badge"></span>
                                </div>
                            </div>

                            <!-- Summary: Table & Annual Metrics -->
                            <div class="tel-summary-grid">
                                <div class="tel-glass-card">
                                    <div class="tel-card-header-title">
                                        <span>📅 ${this.t('sim_maint.checkpoints_title', 'Sample Daily Checkpoints')}</span>
                                        <span style="font-size:10px; color:#94a3b8; font-weight:normal;">${this.t('sim_maint.checkpoints_sub', 'Fixed-shift sample measurements')}</span>
                                    </div>
                                    <table class="tel-cherrypick-table">
                                        <thead>
                                            <tr>
                                                <th>${this.t('sim_maint.th_timestamp', 'TIMESTAMP')}</th>
                                                <th>${this.t('sim_maint.th_humidity', 'HUMIDITY')}</th>
                                                <th>${this.t('sim_maint.th_temp', 'TEMPERATURE')}</th>
                                            </tr>
                                        </thead>
                                        <tbody id="tel-cherrypick-tbody">
                                            <tr><td>--</td><td>--</td><td>--</td></tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div class="tel-glass-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                                    <div>
                                        <div class="tel-card-header-title">
                                            <span>📊 ${this.t('sim_maint.stats_annual_title', 'Annual Statistical Averages')}</span>
                                            <span style="font-size:10px; color:#94a3b8; font-weight:normal;">${this.t('sim_maint.stats_1y_sub', '1-Year Rolling Average')}</span>
                                        </div>
                                        <div class="tel-stat-metric">
                                            <span style="font-weight:700; color:#cbd5e1;">🌡️ ${this.t('sim_maint.stat_1y_temp', '1Y AVERAGE TEMPERATURE')}</span>
                                            <span class="tel-stat-val-box" style="color:#f59e0b;"><span id="tel-stat-1y-temp">--</span> °C</span>
                                        </div>
                                        <div class="tel-stat-metric">
                                            <span style="font-weight:700; color:#cbd5e1;">💧 ${this.t('sim_maint.stat_1y_hum', '1Y AVERAGE HUMIDITY')}</span>
                                            <span class="tel-stat-val-box" style="color:#38bdf8;"><span id="tel-stat-1y-hum">--</span> %</span>
                                        </div>
                                    </div>
                                    <div>
                                        <a href="${this.getApiUrl('export_telemetry_csv')}" target="_blank" class="tel-btn-download-csv">
                                            <span>📥</span>
                                            <span>${this.t('sim_maint.download_csv', 'Download Complete Sensor Log (CSV)')}</span>
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <!-- Chart 1: Temperature Measurements -->
                            <div class="tel-chart-card">
                                <div class="tel-chart-header">
                                    <span class="tel-chart-headline">🌡️ ${this.t('sim_maint.chart_temp_title', 'Control Room Temperature Measurements')}</span>
                                    <span style="font-size:11px; font-weight:700; color:#94a3b8;">${this.t('sim_maint.chart_temp_bands', 'Threshold Bands (15°C ~ 27°C)')}</span>
                                </div>
                                <div class="tel-chart-canvas-box">
                                    <canvas id="tel-temp-canvas" width="1000" height="290"></canvas>
                                </div>
                            </div>

                            <!-- Chart 2: Humidity Measurements -->
                            <div class="tel-chart-card">
                                <div class="tel-chart-header">
                                    <span class="tel-chart-headline">💧 ${this.t('sim_maint.chart_hum_title', 'Control Room Humidity Measurements')}</span>
                                    <span style="font-size:11px; font-weight:700; color:#94a3b8;">${this.t('sim_maint.chart_hum_bands', 'Threshold Bands (20% ~ 80%)')}</span>
                                </div>
                                <div class="tel-chart-canvas-box">
                                    <canvas id="tel-hum-canvas" width="1000" height="290"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 3: Indra EC135 Real-Time Telemetry (Pure st_OUT ICD) -->
                    <div class="sim-tab-view ${this.activeTab === 'subsystems' ? 'active' : ''}" id="sim-view-subsystems">
                        <div class="telemetry-dashboard">
                            <!-- Real-Time Mission-Control Streaming Toolbar -->
                            <div class="subsys-stream-toolbar">
                                <div class="stream-toolbar-left">
                                    <div class="stream-pulse-dot" id="subsys-stream-dot"></div>
                                    <div>
                                        <div class="stream-title">${this.t('sim_maint.stream_title', 'INDRA FFS REAL-TIME TELEMETRY BUS (UDP 50 Hz)')}</div>
                                        <div class="stream-sub">Host: <span id="tel-host-ip">172.120.1.3:3032</span> • Port: 3035 • ICD: <strong>st_OUT (HH_ICDSes.h)</strong></div>
                                    </div>
                                </div>

                                <div class="stream-toolbar-right">
                                    <div class="stream-metrics-pill">
                                        <span>Frames: <strong id="subsys-pkt-count">#0</strong></span>
                                        <span>•</span>
                                        <span>Latency: <strong id="subsys-latency-val">-- ms</strong></span>
                                    </div>

                                    <div class="stream-rate-selector">
                                        <label for="subsys-rate-select">⚡ ${this.t('sim_maint.stream_rate', 'Rate:')}</label>
                                        <select id="subsys-rate-select" class="tel-select-styled">
                                            <option value="50" ${this.telemetryPollingIntervalMs === 50 ? 'selected' : ''}>${this.t('sim_maint.rate_50ms', '50 ms (20 Hz - Ultra)')}</option>
                                            <option value="100" ${this.telemetryPollingIntervalMs === 100 ? 'selected' : ''}>${this.t('sim_maint.rate_100ms', '100 ms (10 Hz - Fast)')}</option>
                                            <option value="250" ${this.telemetryPollingIntervalMs === 250 ? 'selected' : ''}>${this.t('sim_maint.rate_250ms', '250 ms (4 Hz - Smooth)')}</option>
                                            <option value="500" ${this.telemetryPollingIntervalMs === 500 ? 'selected' : ''}>${this.t('sim_maint.rate_500ms', '500 ms (2 Hz - Default)')}</option>
                                            <option value="1000" ${this.telemetryPollingIntervalMs === 1000 ? 'selected' : ''}>${this.t('sim_maint.rate_1s', '1000 ms (1 Hz)')}</option>
                                            <option value="2000" ${this.telemetryPollingIntervalMs === 2000 ? 'selected' : ''}>${this.t('sim_maint.rate_2s', '2000 ms (0.5 Hz)')}</option>
                                        </select>
                                    </div>

                                    <button type="button" class="stream-btn-pause ${this.isTelemetryPaused ? 'paused' : ''}" id="subsys-btn-pause">
                                        <span id="subsys-pause-icon">${this.isTelemetryPaused ? '▶ ' + this.t('sim_maint.live_btn', 'LIVE') : '⏸ ' + this.t('sim_maint.pause_btn', 'PAUSE')}</span>
                                    </button>
                                </div>
                            </div>

                            <!-- 1. Analog Cockpit 4-Pack (Airspeed, Horizon, Altimeter, Rotor/N2 Tachometer) -->
                            <div class="tel-section-header" style="margin-top: 16px;">
                                <div class="tel-section-title">
                                    <span>🚁 ${this.t('sim_maint.flight_title', 'Instruments de Vol Analogiques (Cockpit 4-Pack)')}</span>
                                    <span class="tel-section-badge" style="background:#475569; color:#fff;" id="tel-flight-phase-badge">DISCONNECTED</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.flight_sub', 'Badin ASI, Horizon Artificiel ADI, Altimètre ALT et Tachymètre Rotor/N2 issus du flux UDP st_OUT')}</div>
                            </div>

                            <div class="ec135-flight-cockpit-bay">
                                <!-- 1. Airspeed Indicator (ASI) -->
                                <div class="ec135-gauge-case">
                                    <div class="cwp-screw top-left" style="top:6px; left:6px;"></div>
                                    <div class="cwp-screw top-right" style="top:6px; right:6px;"></div>
                                    <div class="cwp-screw bottom-left" style="bottom:6px; left:6px;"></div>
                                    <div class="cwp-screw bottom-right" style="bottom:6px; right:6px;"></div>
                                    <div class="gauge-tab-marker bottom-left">◀ 0.00 / 0.500 ▶</div>

                                    <div class="ec135-gauge-face">
                                        <svg viewBox="0 0 200 200" class="gauge-svg" style="width:100%; height:100%;">
                                            <!-- Dial Face Background -->
                                            <circle cx="100" cy="100" r="92" fill="#0c0e12"/>
                                            <circle cx="100" cy="100" r="86" fill="#111419"/>

                                            <!-- Operating Arcs -->
                                            <!-- Yellow Arc (10 to 30 kts) -->
                                            <path d="M 124 24 A 78 78 0 0 1 174 74" fill="none" stroke="#ffeb3b" stroke-width="6"/>
                                            <!-- Green Arc (30 to 140 kts) -->
                                            <path d="M 174 74 A 78 78 0 1 1 24 100" fill="none" stroke="#00e640" stroke-width="6"/>
                                            <!-- Red Vne Line at 140 kts -->
                                            <line x1="20" y1="92" x2="34" y2="94" stroke="#ff0000" stroke-width="4.5"/>
                                            <!-- Barber Pole Striped Line at 70 kts -->
                                            <line x1="56" y1="168" x2="65" y2="154" stroke="#ff0000" stroke-width="4" stroke-dasharray="3,2"/>

                                            <!-- Radial Numbers -->
                                            <text x="136" y="44" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">20</text>
                                            <text x="162" y="80" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">40</text>
                                            <text x="162" y="130" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">60</text>
                                            <text x="135" y="165" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">80</text>
                                            <text x="92" y="176" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">100</text>
                                            <text x="48" y="160" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">120</text>
                                            <text x="36" y="115" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">140</text>
                                            <text x="46" y="70" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">160</text>
                                            <text x="82" y="44" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="12" font-weight="900">180</text>

                                            <!-- Dial Center Titles -->
                                            <text x="100" y="82" fill="#ffffff" font-family="'Inter', sans-serif" font-size="9.5" font-weight="800" letter-spacing="1" text-anchor="middle">AIRSPEED</text>
                                            <text x="100" y="125" fill="#cbd5e1" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" letter-spacing="1" text-anchor="middle">KNOTS</text>

                                            <!-- Needle -->
                                            <g id="gauge-needle-asi" style="transform-origin: 100px 100px; transform: rotate(0deg); transition: transform 0.12s ease-out;">
                                                <polygon points="97,100 103,100 101,22 99,22" fill="#ffffff"/>
                                                <polygon points="98,100 102,100 100,122" fill="#94a3b8"/>
                                                <circle cx="100" cy="100" r="10" fill="#1e2329" stroke="#475569" stroke-width="2"/>
                                                <circle cx="100" cy="100" r="4" fill="#0a0c0f"/>
                                            </g>
                                        </svg>
                                    </div>
                                    <div class="analog-gauge-caption" style="color:#e2e8f0; font-size:12px; margin-top:8px; font-weight:700;">AIRSPEED: <strong id="tel-gauge-spd-val" style="color:#00e640;">--</strong> kts</div>
                                </div>

                                <!-- 2. Attitude Indicator / Artificial Horizon (ADI) -->
                                <div class="ec135-gauge-case">
                                    <div class="cwp-screw top-left" style="top:6px; left:6px;"></div>
                                    <div class="cwp-screw top-right" style="top:6px; right:6px;"></div>
                                    <div class="cwp-screw bottom-left" style="bottom:6px; left:6px;"></div>
                                    <div class="cwp-screw bottom-right" style="bottom:6px; right:6px;"></div>

                                    <div class="ec135-gauge-face">
                                        <svg viewBox="0 0 200 200" class="gauge-svg" style="width:100%; height:100%;">
                                            <defs>
                                                <clipPath id="adi-circle-clip-v2">
                                                    <circle cx="100" cy="100" r="76"/>
                                                </clipPath>
                                            </defs>
                                            <circle cx="100" cy="100" r="92" fill="#0c0e12"/>
                                            <circle cx="100" cy="100" r="86" fill="#111419"/>

                                            <!-- Dynamic Horizon Ball -->
                                            <g clip-path="url(#adi-circle-clip-v2)">
                                                <g id="gauge-adi-sphere" style="transform-origin: 100px 100px; transform: translateY(0px) rotate(0deg); transition: transform 0.12s ease-out;">
                                                    <rect x="-100" y="-120" width="400" height="220" fill="#6bb5d8"/>
                                                    <rect x="-100" y="100" width="400" height="220" fill="#6e2c0e"/>
                                                    <line x1="-100" y1="100" x2="300" y2="100" stroke="#ffffff" stroke-width="3"/>

                                                    <!-- Pitch Ladder Lines Nose Up (Sky) -->
                                                    <line x1="80" y1="58" x2="120" y2="58" stroke="#ffffff" stroke-width="2"/>
                                                    <text x="74" y="61" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold" text-anchor="end">20</text>
                                                    <text x="126" y="61" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold">20</text>

                                                    <line x1="86" y1="79" x2="114" y2="79" stroke="#ffffff" stroke-width="2"/>
                                                    <text x="80" y="82" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold" text-anchor="end">10</text>
                                                    <text x="120" y="82" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold">10</text>

                                                    <!-- Pitch Ladder Lines Nose Down (Ground) -->
                                                    <line x1="86" y1="121" x2="114" y2="121" stroke="#ffffff" stroke-width="2"/>
                                                    <text x="80" y="124" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold" text-anchor="end">10</text>
                                                    <text x="120" y="124" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold">10</text>

                                                    <line x1="80" y1="142" x2="120" y2="142" stroke="#ffffff" stroke-width="2"/>
                                                    <text x="74" y="145" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold" text-anchor="end">20</text>
                                                    <text x="126" y="145" fill="#ffffff" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="bold">20</text>
                                                </g>
                                            </g>

                                            <!-- Roll Angle Scale Graduations on Fixed Bezel -->
                                            <polygon points="100,16 94,26 106,26" fill="#ffffff"/>
                                            <line x1="78" y1="22" x2="82" y2="30" stroke="#ffffff" stroke-width="2"/>
                                            <line x1="58" y1="30" x2="64" y2="36" stroke="#ffffff" stroke-width="2"/>
                                            <line x1="122" y1="22" x2="118" y2="30" stroke="#ffffff" stroke-width="2"/>
                                            <line x1="142" y1="30" x2="136" y2="36" stroke="#ffffff" stroke-width="2"/>

                                            <!-- Fixed Aircraft Symbol -->
                                            <path d="M 36 100 L 78 100 L 78 108 L 36 108 Z" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
                                            <path d="M 122 100 L 164 100 L 164 108 L 122 108 Z" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
                                            <circle cx="100" cy="100" r="5" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
                                            <polygon points="100,66 93,80 107,80" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>
                                        </svg>

                                        <!-- 3D PULL TO CAGE Knob -->
                                        <div class="adi-cage-knob-hw">
                                            <span>PULL<br>TO<br>CAGE</span>
                                        </div>
                                    </div>
                                    <div class="analog-gauge-caption" style="color:#e2e8f0; font-size:12px; margin-top:8px; font-weight:700;">PITCH: <strong id="tel-gauge-pitch-val" style="color:#00e640;">--°</strong> • ROLL: <strong id="tel-gauge-roll-val" style="color:#00e640;">--°</strong></div>
                                </div>

                                <!-- 3. Altimeter (ALT) -->
                                <div class="ec135-gauge-case">
                                    <div class="cwp-screw top-left" style="top:6px; left:6px;"></div>
                                    <div class="cwp-screw top-right" style="top:6px; right:6px;"></div>
                                    <div class="cwp-screw bottom-left" style="bottom:6px; left:6px;"></div>
                                    <div class="cwp-screw bottom-right" style="bottom:6px; right:6px;"></div>
                                    <div class="gauge-tab-marker bottom-right">◀ 0.00 / 1.000 ▶</div>

                                    <div class="ec135-gauge-face">
                                        <svg viewBox="0 0 200 200" class="gauge-svg" style="width:100%; height:100%;">
                                            <circle cx="100" cy="100" r="92" fill="#0c0e12"/>
                                            <circle cx="100" cy="100" r="86" fill="#111419"/>

                                            <!-- Numbers 0 to 9 -->
                                            <text x="93" y="38" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">0</text>
                                            <text x="142" y="52" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">1</text>
                                            <text x="168" y="96" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">2</text>
                                            <text x="168" y="142" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">3</text>
                                            <text x="135" y="174" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">4</text>
                                            <text x="94" y="186" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">5</text>
                                            <text x="56" y="174" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">6</text>
                                            <text x="24" y="142" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">7</text>
                                            <text x="24" y="96" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">8</text>
                                            <text x="48" y="52" fill="#ffffff" font-family="'Inter', Arial, sans-serif" font-size="17" font-weight="900">9</text>

                                            <!-- Center Title -->
                                            <text x="100" y="125" fill="#ffffff" font-family="'Inter', sans-serif" font-size="13" font-weight="900" letter-spacing="2" text-anchor="middle">ALT</text>

                                            <!-- Needle -->
                                            <g id="gauge-needle-alt" style="transform-origin: 100px 100px; transform: rotate(0deg); transition: transform 0.12s ease-out;">
                                                <polygon points="97,100 103,100 100.5,18 99.5,18" fill="#ffffff"/>
                                                <polygon points="98,100 102,100 100,122" fill="#94a3b8"/>
                                                <circle cx="100" cy="100" r="10" fill="#1e2329" stroke="#475569" stroke-width="2"/>
                                                <circle cx="100" cy="100" r="4" fill="#0a0c0f"/>
                                            </g>
                                        </svg>

                                        <!-- Mechanical Upper Drum Counter Window -->
                                        <div class="alt-drum-window">
                                            <div class="alt-drum-barberpole" id="alt-drum-flag"></div>
                                            <div class="alt-drum-digits" id="gauge-alt-drum-digits">0000</div>
                                        </div>

                                        <!-- Lower Dual Barometric Subscale Windows -->
                                        <div class="alt-baro-subscales">
                                            <div class="alt-baro-box">
                                                <span class="alt-baro-lbl">inHg</span>
                                                <div class="alt-baro-val-window" id="gauge-alt-baro-inhg">3003</div>
                                            </div>
                                            <div class="alt-baro-box">
                                                <span class="alt-baro-lbl">mb/hPa</span>
                                                <div class="alt-baro-val-window" id="gauge-alt-baro-hpa">1017</div>
                                            </div>
                                        </div>

                                        <!-- Hardware Setting Knob -->
                                        <div class="alt-baro-knob-hw"></div>
                                    </div>
                                    <div class="analog-gauge-caption" style="color:#e2e8f0; font-size:12px; margin-top:8px; font-weight:700;">ALT: <strong id="tel-flight-alt" style="color:#00e640;">--</strong> ft MSL</div>
                                </div>

                                <!-- 4. Rotor & Dual Engine N2 Tachometer (ROTOR / ENG N2) -->
                                <div class="ec135-gauge-case">
                                    <div class="cwp-screw top-left" style="top:6px; left:6px;"></div>
                                    <div class="cwp-screw top-right" style="top:6px; right:6px;"></div>
                                    <div class="cwp-screw bottom-left" style="bottom:6px; left:6px;"></div>
                                    <div class="cwp-screw bottom-right" style="bottom:6px; right:6px;"></div>
                                    <div class="gauge-tab-marker top-right">▲ 0.00 / 0.500 ▼</div>
                                    <div class="gauge-tab-marker bottom-right">◀ 0.00 / 0.500 ▶</div>

                                    <div class="ec135-gauge-face">
                                        <svg viewBox="0 0 200 200" class="gauge-svg" style="width:100%; height:100%;">
                                            <circle cx="100" cy="100" r="92" fill="#0c0e12"/>
                                            <circle cx="100" cy="100" r="86" fill="#111419"/>

                                            <!-- Operating Arcs -->
                                            <!-- Green Arc (78% to 105% Nr) -->
                                            <path d="M 82 176 A 78 78 0 0 1 24 100" fill="none" stroke="#00e640" stroke-width="7"/>
                                            <!-- Yellow Arc (105% to 112% Nr) -->
                                            <path d="M 24 100 A 78 78 0 0 1 42 62" fill="none" stroke="#ffeb3b" stroke-width="7"/>
                                            <!-- Red Lines & Dots -->
                                            <line x1="82" y1="172" x2="82" y2="186" stroke="#ff0000" stroke-width="5"/>
                                            <line x1="36" y1="52" x2="46" y2="60" stroke="#ff0000" stroke-width="5"/>
                                            <circle cx="48" cy="46" r="3.5" fill="#ff0000"/>
                                            <circle cx="68" cy="178" r="3.5" fill="#ff0000"/>

                                            <!-- Text & Numbers -->
                                            <text x="144" y="34" fill="#cbd5e1" font-family="'Inter', sans-serif" font-size="9.5" font-weight="800">ENG</text>
                                            <text x="144" y="46" fill="#cbd5e1" font-family="'Inter', sans-serif" font-size="9.5" font-weight="800">N2</text>
                                            <text x="100" y="44" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900" text-anchor="middle">120</text>
                                            <text x="56" y="60" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">110</text>
                                            <text x="32" y="105" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">100</text>
                                            <text x="44" y="150" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">90</text>
                                            <text x="82" y="180" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">80</text>
                                            <text x="122" y="180" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">70</text>
                                            <text x="156" y="150" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">60</text>
                                            <text x="168" y="105" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">50</text>
                                            <text x="148" y="60" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900">0</text>

                                            <!-- Center Titles -->
                                            <text x="100" y="86" fill="#ffffff" font-family="'Inter', sans-serif" font-size="12" font-weight="900" letter-spacing="1" text-anchor="middle">ROTOR</text>
                                            <text x="100" y="125" fill="#cbd5e1" font-family="'Inter', sans-serif" font-size="10" font-weight="800" letter-spacing="1" text-anchor="middle">RPM</text>

                                            <!-- Triple Needles: Rotor (R), Engine 1 (1), Engine 2 (2) -->
                                            <!-- Engine 1 Pointer (1) -->
                                            <g id="gauge-needle-n2-1" style="transform-origin: 100px 100px; transform: rotate(-270deg); transition: transform 0.12s ease-out;">
                                                <polygon points="98,100 102,100 100.5,30 99.5,30" fill="#cbd5e1"/>
                                                <circle cx="100" cy="45" r="4" fill="#0f172a" stroke="#cbd5e1" stroke-width="1"/>
                                                <text x="100" y="47.5" fill="#ffffff" font-size="6" font-weight="bold" text-anchor="middle">1</text>
                                            </g>
                                            <!-- Engine 2 Pointer (2) -->
                                            <g id="gauge-needle-n2-2" style="transform-origin: 100px 100px; transform: rotate(-270deg); transition: transform 0.12s ease-out;">
                                                <polygon points="98,100 102,100 100.5,30 99.5,30" fill="#94a3b8"/>
                                                <circle cx="100" cy="45" r="4" fill="#0f172a" stroke="#94a3b8" stroke-width="1"/>
                                                <text x="100" y="47.5" fill="#ffffff" font-size="6" font-weight="bold" text-anchor="middle">2</text>
                                            </g>
                                            <!-- Main Rotor Pointer (R) -->
                                            <g id="gauge-needle-rotor" style="transform-origin: 100px 100px; transform: rotate(-270deg); transition: transform 0.12s ease-out;">
                                                <polygon points="96,100 104,100 101,20 99,20" fill="#ffffff"/>
                                                <text x="100" y="58" style="font-size:9.5px; font-weight:900; fill:#000000; text-anchor:middle;" transform="rotate(90 100 58)">R</text>
                                                <circle cx="100" cy="100" r="10" fill="#1e2329" stroke="#475569" stroke-width="2"/>
                                                <circle cx="100" cy="100" r="4" fill="#0a0c0f"/>
                                            </g>
                                        </svg>
                                    </div>
                                    <div class="analog-gauge-caption" style="color:#e2e8f0; font-size:12px; margin-top:8px; font-weight:700;">ROTOR: <strong id="tel-gauge-rotor-val" style="color:#00e640;">--</strong>% NR (<strong id="tel-gauge-rotor-rpm" style="color:#00e640;">-- RPM</strong>)</div>
                                </div>
                            </div>

                            <!-- 2. Digital Telemetry Cards (Only st_OUT decoded fields) -->
                            <div class="tel-section-header" style="margin-top: 24px;">
                                <div class="tel-section-title">
                                    <span>📊 ${this.t('sim_maint.digital_telemetry_title', 'Télémétrie Numérique Directe (st_OUT)')}</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.digital_telemetry_sub', 'Paramètres de vol et régime turbines extraits en temps réel à 50 Hz')}</div>
                            </div>

                            <div class="tel-powerplant-grid">
                                <div class="tel-flight-card">
                                    <div class="flight-card-label">🧭 ${this.t('sim_maint.heading_label', 'Cap Compas (Heading)')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-hdg">--</span>
                                        <span class="flight-hero-unit">° MAG</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>COMP_H2I: <strong id="tel-flight-hdg-cardinal">--</strong></span>
                                    </div>
                                </div>

                                <div class="tel-flight-card">
                                    <div class="flight-card-label">💨 ${this.t('sim_maint.speed_label', 'Vitesse Badin (IAS)')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-spd">--</span>
                                        <span class="flight-hero-unit">kts</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>ASI_H2I.speed</span>
                                    </div>
                                </div>

                                <div class="tel-flight-card">
                                    <div class="flight-card-label">⛰️ ${this.t('sim_maint.alt_label', 'Altitude Barométrique')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-alt-num">--</span>
                                        <span class="flight-hero-unit">ft MSL</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>BAROALT_H2I.altitude</span>
                                    </div>
                                </div>

                                <div class="tel-flight-card">
                                    <div class="flight-card-label">🔄 ${this.t('sim_maint.rotor_speed', 'Rotor Principal (Nr)')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-rotor">--</span>
                                        <span class="flight-hero-unit">% NR</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>${this.t('sim_maint.speed_unit', 'Vitesse')}: <strong id="tel-flight-rotor-rpm">-- RPM</strong></span>
                                    </div>
                                </div>

                                <div class="tel-flight-card">
                                    <div class="flight-card-label">🔥 ${this.t('sim_maint.eng1_n2_title', 'Turbine Libre ENG 1 (N2)')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-n2-eng1">--</span>
                                        <span class="flight-hero-unit">% N2</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>TAC_H2I.n2engine1</span>
                                    </div>
                                </div>

                                <div class="tel-flight-card">
                                    <div class="flight-card-label">🔥 ${this.t('sim_maint.eng2_n2_title', 'Turbine Libre ENG 2 (N2)')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-n2-eng2">--</span>
                                        <span class="flight-hero-unit">% N2</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>TAC_H2I.n2engine2</span>
                                    </div>
                                </div>

                                <div class="tel-flight-card">
                                    <div class="flight-card-label">📐 ${this.t('sim_maint.attitude_label', 'Assiette & Roulis (ADI)')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-pitch">--</span>
                                        <span class="flight-hero-unit">° Pitch</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>${this.t('sim_maint.roll_label', 'Roulis')}: <strong id="tel-flight-roll">--°</strong></span>
                                    </div>
                                </div>

                                <div class="tel-flight-card">
                                    <div class="flight-card-label">🚦 ${this.t('sim_maint.flight_phase_label', 'État Détecté Simulateur')}</div>
                                    <div class="flight-val-row">
                                        <span class="flight-hero-num" id="tel-flight-phase-txt" style="font-size: 20px;">DISCONNECTED</span>
                                    </div>
                                    <div class="flight-sub-row">
                                        <span>${this.t('sim_maint.flight_status_monitor', 'Surveillance statut vol')}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 3. Central Warning Panel (CWP) Authentic Airbus EC135 Annunciator Unit -->
                            <div class="tel-section-header" style="margin-top: 24px;">
                                <div class="tel-section-title">
                                    <span>🚨 ${this.t('sim_maint.cwp_annunciator', 'Panneau d\'Alarmes Cockpit CWP (Airbus EC135 Glareshield Unit)')}</span>
                                    <span class="tel-section-badge" style="background:#0f172a; border: 1px solid #334155; color:#94a3b8;" id="tel-cwp-status-badge">STANDBY</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.cwp_sub', 'Restitution photoréaliste des 18 voyants d\'alarmes CWP pilotés directement par la structure st_cwp_H2I')}</div>
                            </div>

                            <div class="ec135-cwp-cockpit-bay">
                                <!-- Main Horizontal Annunciator Unit -->
                                <div class="ec135-cwp-main-bezel">
                                    <div class="cwp-screw top-left"></div>
                                    <div class="cwp-screw bottom-left"></div>
                                    <div class="cwp-screw top-right"></div>
                                    <div class="cwp-screw bottom-right"></div>

                                    <!-- Left Pod: FIRE 1 & EMER OFF SW 1 -->
                                    <div class="ec135-cwp-pod">
                                        <div class="cwp-fire-pod">
                                            <div class="cwp-fire-guard">
                                                <div class="cwp-fire-btn" id="cwp-fire1">
                                                    <span class="cwp-fire-txt">FIRE</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="cwp-emer-box">
                                            <div class="cwp-emer-title">EMER<br>OFF<br>SW 1</div>
                                            <div class="cwp-emer-active-lbl" id="cwp-emerg-off1-active">ACTIVE</div>
                                        </div>
                                    </div>

                                    <!-- Center Matrix: 2 Rows x 5 Columns -->
                                    <div class="ec135-cwp-center-matrix">
                                        <!-- Row 1 -->
                                        <div class="cwp-tile state-amber" id="cwp-low-fuel1">
                                            <span class="cwp-tile-line">LOW</span>
                                            <span class="cwp-tile-line">FUEL 1</span>
                                        </div>
                                        <div class="cwp-tile state-red" id="cwp-active-warn1">
                                            <div class="cwp-tile-cross"></div>
                                        </div>
                                        <div class="cwp-tile state-red" id="cwp-rotor-rpm-warn">
                                            <span class="cwp-tile-line">ROTOR</span>
                                            <span class="cwp-tile-line">RPM</span>
                                        </div>
                                        <div class="cwp-tile state-red" id="cwp-active-warn2">
                                            <div class="cwp-tile-cross"></div>
                                        </div>
                                        <div class="cwp-tile state-amber" id="cwp-low-fuel2">
                                            <span class="cwp-tile-line">LOW</span>
                                            <span class="cwp-tile-line">FUEL 2</span>
                                        </div>

                                        <!-- Row 2 -->
                                        <div class="cwp-tile state-amber" id="cwp-bat-temp-warn">
                                            <span class="cwp-tile-line">BAT</span>
                                            <span class="cwp-tile-line">TEMP</span>
                                        </div>
                                        <div class="cwp-tile state-amber" id="cwp-bat-disch-warn">
                                            <span class="cwp-tile-line">BAT</span>
                                            <span class="cwp-tile-line">DISCH</span>
                                        </div>
                                        <div class="cwp-tile state-red" id="cwp-xmsn-oil-p-warn">
                                            <span class="cwp-tile-line">XMSN</span>
                                            <span class="cwp-tile-line">OIL P</span>
                                        </div>
                                        <div class="cwp-tile state-amber" id="cwp-ap-trim-warn">
                                            <span class="cwp-tile-line">AP</span>
                                            <span class="cwp-tile-line">A.TRIM</span>
                                        </div>
                                        <div class="cwp-tile state-red" id="cwp-cargo-smoke1">
                                            <span class="cwp-tile-line">CARGO</span>
                                            <span class="cwp-tile-line">SMOKE</span>
                                        </div>
                                    </div>

                                    <!-- Right Pod: EMER OFF SW 2 & FIRE 2 -->
                                    <div class="ec135-cwp-pod">
                                        <div class="cwp-emer-box">
                                            <div class="cwp-emer-title">EMER<br>OFF<br>SW 2</div>
                                            <div class="cwp-emer-active-lbl" id="cwp-emerg-off2-active">ACTIVE</div>
                                        </div>
                                        <div class="cwp-fire-pod">
                                            <div class="cwp-fire-guard">
                                                <div class="cwp-fire-btn" id="cwp-fire2">
                                                    <span class="cwp-fire-txt">FIRE</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Separate Vertical Unit (High Nr & Master Caution) -->
                                <div class="ec135-cwp-side-bezel">
                                    <div class="cwp-screw top-left" style="top:3px; left:3px;"></div>
                                    <div class="cwp-screw top-right" style="top:3px; right:3px;"></div>
                                    <div class="cwp-screw bottom-left" style="bottom:3px; left:3px;"></div>
                                    <div class="cwp-screw bottom-right" style="bottom:3px; right:3px;"></div>

                                    <div class="cwp-side-btn high-nr" id="cwp-high-nr-cata">
                                        <span class="cwp-btn-txt">HIGH NR</span>
                                    </div>
                                    <div class="cwp-side-btn master-caution" id="cwp-master-caution">
                                        <span class="cwp-btn-txt">MASTER<br>CAUTION</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 4. Autopilot Control Console (APC) & Modes -->
                            <div class="tel-section-header" style="margin-top: 24px;">
                                <div class="tel-section-title">
                                    <span>🎛️ ${this.t('sim_maint.apc_title', 'Console Pilote Automatique (APC) & Modes')}</span>
                                    <span class="tel-section-badge" id="tel-apc-badge" style="background:#0f172a; border: 1px solid #334155; color:#94a3b8;">AP OFF</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.apc_sub', 'État des voyants et modes d\'engagement du pilote automatique EC135')}</div>
                            </div>

                            <div class="avionics-subpanel-grid">
                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">🕹️ ${this.t('sim_maint.card_ap_safety', 'Engagement & Sécurité AP')}</span>
                                    </div>
                                    <div class="avionics-btn-matrix">
                                        <div class="avionics-lamp-btn" id="apc-ap-off"><span class="avionics-lamp-lbl">AP OFF</span></div>
                                        <div class="avionics-lamp-btn" id="apc-trim-off"><span class="avionics-lamp-lbl">TRIM OFF</span></div>
                                        <div class="avionics-lamp-btn" id="apc-test-on"><span class="avionics-lamp-lbl">TEST ON</span></div>
                                        <div class="avionics-lamp-btn" id="apc-vs-on"><span class="avionics-lamp-lbl">V/S ON</span></div>
                                        <div class="avionics-lamp-btn" id="apc-ias"><span class="avionics-lamp-lbl">IAS</span></div>
                                        <div class="avionics-lamp-btn" id="apc-alt"><span class="avionics-lamp-lbl">ALT</span></div>
                                    </div>
                                </div>

                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">🧭 ${this.t('sim_maint.card_fd_modes', 'Modes Latéraux & Approche FD')}</span>
                                    </div>
                                    <div class="avionics-btn-matrix">
                                        <div class="avionics-lamp-btn" id="apc-hdg"><span class="avionics-lamp-lbl">HDG ▶</span></div>
                                        <div class="avionics-lamp-btn" id="apc-nav-a"><span class="avionics-lamp-lbl">NAV A</span></div>
                                        <div class="avionics-lamp-btn" id="apc-nav-c"><span class="avionics-lamp-lbl">NAV C</span></div>
                                        <div class="avionics-lamp-btn" id="apc-app-a"><span class="avionics-lamp-lbl">APP A</span></div>
                                        <div class="avionics-lamp-btn" id="apc-app-c"><span class="avionics-lamp-lbl">APP C</span></div>
                                        <div class="avionics-lamp-btn" id="apc-alt-a"><span class="avionics-lamp-lbl">ALT.A ▶</span></div>
                                        <div class="avionics-lamp-btn" id="apc-bc-a"><span class="avionics-lamp-lbl">BC A</span></div>
                                        <div class="avionics-lamp-btn" id="apc-bc-c"><span class="avionics-lamp-lbl">BC C</span></div>
                                        <div class="avionics-lamp-btn" id="apc-gs-a"><span class="avionics-lamp-lbl">GS A</span></div>
                                        <div class="avionics-lamp-btn" id="apc-gs-c"><span class="avionics-lamp-lbl">GS C</span></div>
                                    </div>
                                </div>
                            </div>

                            <!-- 5. Radionavigation & Balises (DME, GPS, MBR) -->
                            <div class="tel-section-header" style="margin-top: 24px;">
                                <div class="tel-section-title">
                                    <span>🛰️ ${this.t('sim_maint.radionav_title', 'Radionavigation & Balises (DME, GPS, MBR)')}</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.radionav_sub', 'Annonciateurs GPS, récepteur DME et balises d\'approche')}</div>
                            </div>

                            <div class="avionics-subpanel-grid">
                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">📡 ${this.t('sim_maint.card_dme_annunciators', 'Annonciateurs DME')}</span>
                                    </div>
                                    <div class="avionics-btn-matrix">
                                        <div class="avionics-lamp-btn" id="dme-dme1"><span class="avionics-lamp-lbl">DME 1</span></div>
                                        <div class="avionics-lamp-btn" id="dme-dme2"><span class="avionics-lamp-lbl">DME 2</span></div>
                                        <div class="avionics-lamp-btn" id="dme-hold1"><span class="avionics-lamp-lbl">HOLD 1</span></div>
                                        <div class="avionics-lamp-btn" id="dme-hold2"><span class="avionics-lamp-lbl">HOLD 2</span></div>
                                        <div class="avionics-lamp-btn" id="dme-gnd1"><span class="avionics-lamp-lbl">GND 1</span></div>
                                        <div class="avionics-lamp-btn" id="dme-gnd2"><span class="avionics-lamp-lbl">GND 2</span></div>
                                        <div class="avionics-lamp-btn" id="dme-call"><span class="avionics-lamp-lbl">CALL</span></div>
                                        <div class="avionics-lamp-btn" id="dme-high-nr"><span class="avionics-lamp-lbl">HIGH NR</span></div>
                                    </div>
                                </div>

                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">🗺️ ${this.t('sim_maint.card_gps_mbr', 'GPS 430 & Balises (MBR)')}</span>
                                        <span class="tel-section-badge" id="gps-coords-badge" style="background:#0f172a; border: 1px solid #334155; color:#38bdf8; font-family:'JetBrains Mono',monospace; font-size:10px;">GPS: --, --</span>
                                    </div>
                                    <div class="avionics-btn-matrix">
                                        <div class="avionics-lamp-btn" id="gps-msg"><span class="avionics-lamp-lbl">MSG</span></div>
                                        <div class="avionics-lamp-btn" id="gps-wpt"><span class="avionics-lamp-lbl">WPT</span></div>
                                        <div class="avionics-lamp-btn" id="gps-term"><span class="avionics-lamp-lbl">TERM</span></div>
                                        <div class="avionics-lamp-btn" id="gps-apr"><span class="avionics-lamp-lbl">APR</span></div>
                                        <div class="avionics-lamp-btn" id="gps-intg"><span class="avionics-lamp-lbl">INTG</span></div>
                                        <div class="avionics-lamp-btn" id="gps-obs"><span class="avionics-lamp-lbl">OBS</span></div>
                                        <div class="avionics-lamp-btn" id="mbr-airway"><span class="avionics-lamp-lbl">MBR [A]</span></div>
                                        <div class="avionics-lamp-btn" id="mbr-outer"><span class="avionics-lamp-lbl">MBR [O]</span></div>
                                        <div class="avionics-lamp-btn" id="mbr-middle"><span class="avionics-lamp-lbl">MBR [M]</span></div>
                                    </div>
                                    <div class="avionics-metric-row" style="margin-top: 6px;">
                                        <span class="avionics-metric-title">💨 Air Data (OAT / Wind / TAS)</span>
                                        <span class="avionics-metric-val" id="gps-airdata-txt" style="min-width: 160px; font-size: 11px;">--</span>
                                    </div>
                                    <div class="avionics-metric-row">
                                        <span class="avionics-metric-title">⛽ Fuel Flow (ENG 1 / ENG 2)</span>
                                        <span class="avionics-metric-val" id="gps-fuelflow-txt" style="min-width: 160px; font-size: 11px;">--</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 6. Audio Selector Panels & Intercoms (ICS) -->
                            <div class="tel-section-header" style="margin-top: 24px;">
                                <div class="tel-section-title">
                                    <span>🎧 ${this.t('sim_maint.audio_title', 'Panneaux Sélecteurs Audio & Intercoms (ICS)')}</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.audio_sub', 'Voies VHF, NAV, ATC et interphone Pilote & Copilote')}</div>
                            </div>

                            <div class="avionics-subpanel-grid">
                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">👨‍✈️ ${this.t('sim_maint.card_plt_audio', 'Sélecteur Audio Pilote (PLT)')}</span>
                                    </div>
                                    <div class="avionics-btn-matrix avionics-grid-9">
                                        <div class="avionics-lamp-btn" id="audio-plt-vhf1"><span class="avionics-lamp-lbl">VHF 1</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-vhf2"><span class="avionics-lamp-lbl">VHF 2</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-nav1"><span class="avionics-lamp-lbl">NAV 1</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-nav2"><span class="avionics-lamp-lbl">NAV 2</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-dme1"><span class="avionics-lamp-lbl">DME 1</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-dme2"><span class="avionics-lamp-lbl">DME 2</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-mkr"><span class="avionics-lamp-lbl">MKR</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-atc"><span class="avionics-lamp-lbl">ATC</span></div>
                                        <div class="avionics-lamp-btn" id="audio-plt-emer"><span class="avionics-lamp-lbl">EMER</span></div>
                                    </div>
                                </div>

                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">🧑‍✈️ ${this.t('sim_maint.card_cplt_audio', 'Sélecteur Audio Copilote (CPLT)')}</span>
                                    </div>
                                    <div class="avionics-btn-matrix avionics-grid-9">
                                        <div class="avionics-lamp-btn" id="audio-cplt-vhf1"><span class="avionics-lamp-lbl">VHF 1</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-vhf2"><span class="avionics-lamp-lbl">VHF 2</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-nav1"><span class="avionics-lamp-lbl">NAV 1</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-nav2"><span class="avionics-lamp-lbl">NAV 2</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-dme1"><span class="avionics-lamp-lbl">DME 1</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-dme2"><span class="avionics-lamp-lbl">DME 2</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-mkr"><span class="avionics-lamp-lbl">MKR</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-atc"><span class="avionics-lamp-lbl">ATC</span></div>
                                        <div class="avionics-lamp-btn" id="audio-cplt-emer"><span class="avionics-lamp-lbl">EMER</span></div>
                                    </div>
                                </div>
                            </div>

                            <!-- 7. Écrans Numériques, Électro-optique & Éclairage -->
                            <div class="tel-section-header" style="margin-top: 24px;">
                                <div class="tel-section-title">
                                    <span>🖥️ ${this.t('sim_maint.displays_lighting_title', 'Écrans Numériques, Électro-optique & Éclairage')}</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.displays_lighting_sub', 'Contrôle luminosité CAD, VEMD, PFD/ND et sélecteur Jour/Nuit/NVG')}</div>
                            </div>

                            <div class="avionics-subpanel-grid">
                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">📟 ${this.t('sim_maint.card_cad_vemd', 'Écrans CAD & VEMD')}</span>
                                        <span class="tel-section-badge" id="disp-lighting-mode-badge" style="background:#0f172a; border: 1px solid #334155; color:#94a3b8;">MODE: DAY</span>
                                    </div>
                                    <div class="avionics-metric-row">
                                        <span class="avionics-metric-title">${this.t('sim_maint.cad_screen', 'CAD Screen')}</span>
                                        <div class="avionics-metric-bar-bg"><div class="avionics-metric-bar-fill" id="cad-brt-bar" style="width: 0%;"></div></div>
                                        <span class="avionics-metric-val" id="cad-brt-txt">--%</span>
                                    </div>
                                    <div class="avionics-metric-row">
                                        <span class="avionics-metric-title">${this.t('sim_maint.vemd_screens', 'VEMD Dual Screens')}</span>
                                        <div class="avionics-metric-bar-bg"><div class="avionics-metric-bar-fill" id="vemd-brt-bar" style="width: 0%;"></div></div>
                                        <span class="avionics-metric-val" id="vemd-brt-txt">--%</span>
                                    </div>
                                    <div class="avionics-metric-row">
                                        <span class="avionics-metric-title">${this.t('sim_maint.euronav_contrast', 'Euronav SMD68 Contrast')}</span>
                                        <div class="avionics-metric-bar-bg"><div class="avionics-metric-bar-fill" id="euronav-crt-bar" style="width: 0%;"></div></div>
                                        <span class="avionics-metric-val" id="euronav-crt-txt">--%</span>
                                    </div>
                                    <div class="avionics-metric-row">
                                        <span class="avionics-metric-title">${this.t('sim_maint.pfd_nd_backlight', 'PFD / ND Backlight')}</span>
                                        <div class="avionics-metric-bar-bg"><div class="avionics-metric-bar-fill" id="pfd-crt-bar" style="width: 0%;"></div></div>
                                        <span class="avionics-metric-val" id="pfd-crt-txt">--%</span>
                                    </div>
                                </div>

                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">💡 ${this.t('sim_maint.card_lighting', 'Éclairage Cockpit & Veilleuse')}</span>
                                    </div>
                                    <div class="avionics-btn-matrix avionics-grid-4">
                                        <div class="avionics-lamp-btn" id="light-cockpit"><span class="avionics-lamp-lbl">COCKPIT LT</span></div>
                                        <div class="avionics-lamp-btn" id="light-map"><span class="avionics-lamp-lbl">MAP HOLDER</span></div>
                                        <div class="avionics-lamp-btn" id="light-bg"><span class="avionics-lamp-lbl">BACKGROUND</span></div>
                                        <div class="avionics-lamp-btn" id="elt-test-btn"><span class="avionics-lamp-lbl">ELT TEST</span></div>
                                    </div>
                                    <div class="avionics-metric-row" style="margin-top: 6px;">
                                        <span class="avionics-metric-title">${this.t('sim_maint.inst_dimmable', 'Instruments Dimmable')}</span>
                                        <div class="avionics-metric-bar-bg"><div class="avionics-metric-bar-fill" id="light-inst-bar" style="width: 0%;"></div></div>
                                        <span class="avionics-metric-val" id="light-inst-txt">--%</span>
                                    </div>
                                    <div class="avionics-metric-row">
                                        <span class="avionics-metric-title">${this.t('sim_maint.stby_hor_light', 'Standby Horizon Light')}</span>
                                        <div class="avionics-metric-bar-bg"><div class="avionics-metric-bar-fill" id="light-stby-bar" style="width: 0%;"></div></div>
                                        <span class="avionics-metric-val" id="light-stby-txt">--%</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 8. Alimentations Électriques & Supervision Simulateur -->
                            <div class="tel-section-header" style="margin-top: 24px;">
                                <div class="tel-section-title">
                                    <span>⚡ ${this.t('sim_maint.power_sim_title', 'Alimentations Électriques & Supervision Simulateur')}</span>
                                </div>
                                <div class="tel-section-subtitle">${this.t('sim_maint.power_sim_sub', 'Bus avioniques, balise ELT, vérins de mouvement et cycles hôte')}</div>
                            </div>

                            <div class="avionics-subpanel-grid">
                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">🔋 ${this.t('sim_maint.card_power_buses', 'Bus & Alimentations Avioniques')}</span>
                                    </div>
                                    <div class="avionics-btn-matrix avionics-grid-8">
                                        <div class="avionics-lamp-btn" id="pwr-euronav"><span class="avionics-lamp-lbl">EURONAV</span></div>
                                        <div class="avionics-lamp-btn" id="pwr-cad"><span class="avionics-lamp-lbl">CAD</span></div>
                                        <div class="avionics-lamp-btn" id="pwr-vemd"><span class="avionics-lamp-lbl">VEMD</span></div>
                                        <div class="avionics-lamp-btn" id="pwr-fcds"><span class="avionics-lamp-lbl">PLT FCDS</span></div>
                                        <div class="avionics-lamp-btn" id="pwr-xpdr"><span class="avionics-lamp-lbl">XPDR</span></div>
                                        <div class="avionics-lamp-btn" id="pwr-wp"><span class="avionics-lamp-lbl">WP</span></div>
                                        <div class="avionics-lamp-btn" id="pwr-ics-plt"><span class="avionics-lamp-lbl">ICS PLT</span></div>
                                        <div class="avionics-lamp-btn" id="pwr-ics-cplt"><span class="avionics-lamp-lbl">ICS CPLT</span></div>
                                    </div>
                                </div>

                                <div class="avionics-card">
                                    <div class="avionics-card-header">
                                        <span class="avionics-card-title">🦾 ${this.t('sim_maint.card_sim_status', 'Statut Plateforme & Hôte')}</span>
                                        <span class="tel-section-badge" id="host-cycles-badge" style="background:#0f172a; border: 1px solid #334155; color:#94a3b8;">CYCLES: 0</span>
                                    </div>
                                    <div class="avionics-btn-matrix avionics-grid-5">
                                        <div class="avionics-lamp-btn" id="sim-session-init"><span class="avionics-lamp-lbl">SESS INIT</span></div>
                                        <div class="avionics-lamp-btn" id="sim-oper"><span class="avionics-lamp-lbl">SIM OPER</span></div>
                                        <div class="avionics-lamp-btn" id="sim-stop"><span class="avionics-lamp-lbl">SIM STOP</span></div>
                                        <div class="avionics-lamp-btn" id="sim-motion-ready"><span class="avionics-lamp-lbl">MOT READY</span></div>
                                        <div class="avionics-lamp-btn" id="sim-motion-on"><span class="avionics-lamp-lbl">MOTION ON</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 4: Certified Archives -->
                    <div class="sim-tab-view ${this.activeTab === 'archives' ? 'active' : ''}" id="sim-view-archives">
                        <div class="archives-tree" id="maint-archives-tree">
                            <div style="color: var(--text-muted, #9ca3af); text-align: center; padding: 24px;">${this.t('sim_maint.loading_archives', 'Loading archived reports...')}</div>
                        </div>
                    </div>
                </div>

                <!-- Technicians Modal Overlay -->
                <div class="sim-modal-overlay" id="sim-techs-modal" style="display: none;">
                    <div class="sim-modal-card">
                        <div class="sim-modal-title">
                            <span>👥 ${this.t('sim_maint.manage_techs', 'Manage Technicians (Workers)')}</span>
                            <button class="btn-icon" id="sim-close-techs-modal">✕</button>
                        </div>
                        <div class="tech-list-box" id="sim-tech-list-box"></div>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" class="sim-input" id="sim-new-tech-input" placeholder="${this.t('sim_maint.add_tech_placeholder', 'Add Technician Name (e.g. D. FUKUDA)')}">
                            <button class="sim-tool-btn" id="sim-add-tech-btn" style="white-space: nowrap;">${this.t('sim_maint.add_tech_btn', '➕ Add')}</button>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
        }

        bindEvents() {
            var langBtns = this.container.querySelectorAll('.sim-lang-pill[data-lang]');
            for (var l = 0; l < langBtns.length; l++) {
                (function (btn, self) {
                    btn.addEventListener('click', function () {
                        var code = btn.getAttribute('data-lang');
                        try { localStorage.setItem('sg_locale', code); } catch (e) {}
                        if (window.sys && window.sys.i18n && typeof window.sys.i18n.setLocale === 'function') {
                            window.sys.i18n.setLocale(code);
                        } else if (window.desktop && typeof window.desktop.setLocale === 'function') {
                            window.desktop.setLocale(code);
                        }
                        self.onLocaleChanged();
                    });
                })(langBtns[l], this);
            }

            var tabBtns = this.container.querySelectorAll('.sim-tab-btn[data-tab]');
            for (var i = 0; i < tabBtns.length; i++) {
                (function (btn, self) {
                    btn.addEventListener('click', function () {
                        self.switchTab(btn.getAttribute('data-tab'));
                    });
                })(tabBtns[i], this);
            }

            // Telemetry Toolbar Controls
            var linlenSel = this.container.querySelector('#tel-select-linlen');
            if (linlenSel) {
                linlenSel.value = this.telLinlen;
                linlenSel.addEventListener('change', function (e) {
                    this.telLinlen = parseInt(e.target.value, 10);
                    this.loadTelemetryHistory();
                }.bind(this));
            }

            var countBtns = this.container.querySelectorAll('.tel-btn-segmented[data-count]');
            for (var c = 0; c < countBtns.length; c++) {
                (function (btn, self) {
                    btn.addEventListener('click', function () {
                        var allC = self.container.querySelectorAll('.tel-btn-segmented[data-count]');
                        for (var k = 0; k < allC.length; k++) allC[k].classList.remove('active');
                        btn.classList.add('active');
                        self.telCount = parseInt(btn.getAttribute('data-count'), 10);
                        self.loadTelemetryHistory();
                    });
                })(countBtns[c], this);
            }

            var stepSel = this.container.querySelector('#tel-select-step');
            if (stepSel) {
                stepSel.value = this.telStep;
                stepSel.addEventListener('change', function (e) {
                    this.telStep = parseInt(e.target.value, 10);
                }.bind(this));
            }

            var stepPrevBtn = this.container.querySelector('#tel-btn-step-prev');
            if (stepPrevBtn) {
                stepPrevBtn.addEventListener('click', function () {
                    this.telOffset += this.telStep;
                    this.loadTelemetryHistory();
                }.bind(this));
            }

            var stepNowBtn = this.container.querySelector('#tel-btn-step-now');
            if (stepNowBtn) {
                stepNowBtn.addEventListener('click', function () {
                    this.telOffset = 0;
                    this.loadTelemetryHistory();
                }.bind(this));
            }

            var stepNextBtn = this.container.querySelector('#tel-btn-step-next');
            if (stepNextBtn) {
                stepNextBtn.addEventListener('click', function () {
                    this.telOffset = Math.max(0, this.telOffset - this.telStep);
                    this.loadTelemetryHistory();
                }.bind(this));
            }

            // Real-Time Subsystems Stream Rate & Pause Controls
            var rateSel = this.container.querySelector('#subsys-rate-select');
            if (rateSel) {
                rateSel.value = this.telemetryPollingIntervalMs;
                rateSel.addEventListener('change', function (e) {
                    this.telemetryPollingIntervalMs = parseInt(e.target.value, 10);
                    this.startFastTelemetryPolling();
                }.bind(this));
            }

            var pauseBtn = this.container.querySelector('#subsys-btn-pause');
            if (pauseBtn) {
                pauseBtn.addEventListener('click', function () {
                    this.isTelemetryPaused = !this.isTelemetryPaused;
                    pauseBtn.classList.toggle('paused', this.isTelemetryPaused);
                    var pauseIcon = this.container.querySelector('#subsys-pause-icon');
                    if (pauseIcon) {
                        pauseIcon.textContent = this.isTelemetryPaused ? '▶ LIVE' : '⏸ PAUSE';
                    }
                    this.startFastTelemetryPolling();
                    if (!this.isTelemetryPaused) {
                        this.loadTelemetry();
                    }
                }.bind(this));
            }

            var typeSelect = this.container.querySelector('#paper-select-type');
            if (typeSelect) {
                typeSelect.value = this.currentChecklistType;
                typeSelect.addEventListener('change', function (e) {
                    this.currentChecklistType = e.target.value;
                    // Choix direct du formulaire principal
                    this.activeSheets = [{ id: 'sheet_1', type: e.target.value }];
                    this.loadActiveChecklist();
                }.bind(this));
            }

            var addMenuBtn = this.container.querySelector('#paper-btn-add-menu');
            var addPopover = this.container.querySelector('#add-sheet-popover');
            if (addMenuBtn && addPopover) {
                addMenuBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var isVisible = addPopover.style.display === 'block';
                    addPopover.style.display = isVisible ? 'none' : 'block';
                });

                var menuItems = addPopover.querySelectorAll('.add-sheet-menu-item[data-add-type]');
                for (var m = 0; m < menuItems.length; m++) {
                    (function (item, app) {
                        item.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var addType = item.getAttribute('data-add-type');
                            app.addSheet(addType);
                            addPopover.style.display = 'none';
                        });
                    })(menuItems[m], this);
                }

                // Fermer le popover si clic extérieur
                document.addEventListener('click', function (e) {
                    if (!e.target.closest('.add-sheet-dropdown-container')) {
                        addPopover.style.display = 'none';
                    }
                });
            }

            var techSelect = this.container.querySelector('#paper-select-technician');
            if (techSelect) {
                techSelect.addEventListener('change', function (e) {
                    this.selectedTechnician = e.target.value;
                    this.updateTechInputs();
                }.bind(this));
            }

            var toggleBtn = this.container.querySelector('#paper-btn-toggle-all');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function () {
                    this.toggleAllChecks();
                }.bind(this));
            }

            var printBtn = this.container.querySelector('#paper-btn-print');
            if (printBtn) {
                printBtn.addEventListener('click', function () {
                    this.printCurrentSheet();
                }.bind(this));
            }

            var saveBtn = this.container.querySelector('#paper-btn-save-main');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    this.submitPaperChecklist();
                }.bind(this));
            }

            var manageTechBtn = this.container.querySelector('#paper-btn-manage-techs');
            var techModal = this.container.querySelector('#sim-techs-modal');
            var closeTechModal = this.container.querySelector('#sim-close-techs-modal');
            var addTechBtn = this.container.querySelector('#sim-add-tech-btn');

            if (manageTechBtn && techModal) {
                manageTechBtn.addEventListener('click', function () {
                    this.renderTechniciansList();
                    techModal.style.display = 'flex';
                }.bind(this));
            }

            if (closeTechModal && techModal) {
                closeTechModal.addEventListener('click', function () {
                    techModal.style.display = 'none';
                });
            }

            if (addTechBtn) {
                addTechBtn.addEventListener('click', function () {
                    this.addTechnician();
                }.bind(this));
            }
        }

        isSignatureCanvasEmpty(canvas) {
            if (!canvas) return true;
            if (canvas._hasDrawn === false) return true;
            if (canvas._hasDrawn === true) return false;
            try {
                var ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return true;
                var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var data = imgData.data;
                for (var i = 3; i < data.length; i += 4) {
                    if (data[i] > 15) {
                        return false;
                    }
                }
            } catch (e) {
                return false;
            }
            return true;
        }

        async submitPaperChecklist() {
            var container = this.container.querySelector('#paper-sheets-container');
            if (!container) return;

            var sheetCards = container.querySelectorAll('.paper-sheet-card');
            if (!sheetCards || sheetCards.length === 0) return;

            var self = this;
            var saveBtn = this.container.querySelector('#paper-btn-save-main');

            // 1. Vérification consécutive stricte de la signature sur chaque formulaire de la liasse
            for (var i = 0; i < sheetCards.length; i++) {
                var card = sheetCards[i];
                var sheetType = card.getAttribute('data-sheet-type') || 'pf';
                var sigCanvas = card.querySelector('#paper-sig-canvas, .paper-sig-box');

                if (sigCanvas && this.isSignatureCanvasEmpty(sigCanvas)) {
                    var sheetTitle = this.getFormTitle(sheetType);
                    var msg = this.t('sim_maint.sign_sheet_required', 'Signature obligatoire manquante sur la feuille #{n} ({name}) ! Veuillez signer avant d\'archiver.')
                        .replace('{n}', i + 1)
                        .replace('{name}', sheetTitle);

                    alert('⚠️ ' + msg);
                    sigCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    sigCanvas.style.outline = '3px solid #ef4444';
                    sigCanvas.style.boxShadow = '0 0 14px rgba(239, 68, 68, 0.5)';
                    setTimeout(function () {
                        sigCanvas.style.outline = 'none';
                        sigCanvas.style.boxShadow = 'none';
                    }, 3500);
                    return;
                }
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span>⏳ <strong>' + this.t('sim_maint.saving', 'SAVING...') + '</strong></span>';
            }

            try {
                var savePromises = [];
                var workedDateDefault = this.telemetryData.date || new Date().toISOString().split('T')[0];

                // 2. Traitement et envoi individuel de chaque feuille A4
                sheetCards.forEach(function (card, idx) {
                    var sheetType = card.getAttribute('data-sheet-type') || 'pf';
                    var sheetBody = card.querySelector('.paper-sheet');
                    if (!sheetBody) return;

                    var workedDate = workedDateDefault;
                    var checkedDate = workedDateDefault;
                    var inspector = self.selectedTechnician || 'SHEKH V. LECOQ';

                    var workedDateInput = sheetBody.querySelector('#paper-worked-date, #pf-input-date');
                    var checkedDateInput = sheetBody.querySelector('#paper-checked-date, #pf-input-date');
                    if (workedDateInput && workedDateInput.value) workedDate = workedDateInput.value;
                    if (checkedDateInput && checkedDateInput.value) checkedDate = checkedDateInput.value;

                    var inspectorInput = sheetBody.querySelector('#paper-worked-textarea, #sf-copilot, #sf-captain-name');
                    if (inspectorInput && inspectorInput.value.trim()) inspector = inspectorInput.value.trim();

                    var sigCanvas = sheetBody.querySelector('#paper-sig-canvas, .paper-sig-box');
                    var sigData = (sigCanvas && !self.isSignatureCanvasEmpty(sigCanvas)) ? sigCanvas.toDataURL('image/png') : '';

                    var clone = sheetBody.cloneNode(true);
                    var cloneCanvas = clone.querySelector('#paper-sig-canvas, .paper-sig-box');
                    if (cloneCanvas && sigData) {
                        var img = document.createElement('img');
                        img.src = sigData;
                        img.className = 'sig-img';
                        img.style.maxHeight = '65px';
                        img.style.maxWidth = '240px';
                        img.style.display = 'block';
                        img.style.margin = '0 auto';
                        cloneCanvas.parentNode.replaceChild(img, cloneCanvas);
                    }
                    var clearBtn = clone.querySelector('#paper-clear-sig-btn');
                    if (clearBtn) clearBtn.remove();

                    // Fige les valeurs des inputs et textareas
                    var originalInputs = sheetBody.querySelectorAll('input, textarea');
                    var cloneInputs = clone.querySelectorAll('input, textarea');
                    for (var k = 0; k < originalInputs.length; k++) {
                        if (cloneInputs[k]) {
                            if (cloneInputs[k].tagName === 'TEXTAREA') {
                                cloneInputs[k].innerHTML = originalInputs[k].value;
                            } else {
                                cloneInputs[k].setAttribute('value', originalInputs[k].value);
                            }
                        }
                    }

                    // Enveloppe la feuille A4 pour l'archive HTML
                    var pageWrapper = document.createElement('div');
                    pageWrapper.className = 'paper-sheet-card';
                    pageWrapper.appendChild(clone);

                    var formData = new FormData();
                    formData.append('action', 'save_checklist');
                    formData.append('type', sheetType);
                    formData.append('inspector', inspector);
                    formData.append('date', workedDate);
                    formData.append('checked_date', checkedDate);
                    formData.append('has_sig_field', sigCanvas ? '1' : '0');
                    formData.append('signature', sigData);
                    formData.append('html_sheet', pageWrapper.outerHTML);

                    savePromises.push(
                        fetch(self.getApiUrl('save_checklist'), {
                            method: 'POST',
                            body: formData
                        }).then(function (r) { return r.json(); })
                    );
                });

                var results = await Promise.all(savePromises);
                var allSuccess = results.length > 0 && results.every(function (res) { return res && res.success; });

                if (allSuccess) {
                    var countSaved = results.length;
                    var msg = (countSaved > 1)
                        ? countSaved + ' ' + this.t('sim_maint.reports_saved_plural', 'checklist reports saved and archived separately.')
                        : this.t('sim_maint.save_archive', 'Checklist report saved and archived successfully.');
                    alert('✅ ' + msg);
                    this.switchTab('archives');
                    this.loadArchives();
                } else {
                    var errs = results.filter(function (r) { return !r || !r.success; }).map(function (r) { return r ? r.error : 'Unknown error'; }).join(', ');
                    alert('❌ Error saving checklist(s): ' + (errs || 'Unknown error'));
                }
            } catch (err) {
                console.error("Submit checklist error", err);
                alert('❌ Network or server error while saving report.');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<span>💾 <strong>' + this.t('sim_maint.save_archive_btn', 'SEND & ARCHIVE') + '</strong></span>';
                }
            }
        }

        renderTechniciansList() {
            var listEl = this.container.querySelector('#sim-tech-list-box');
            if (!listEl) return;

            var self = this;
            listEl.innerHTML = this.technicians.map(function (t, idx) {
                var delBtn = (self.technicians.length > 1) ? '<button class="btn-icon" style="color:#f87171;" data-del-tech="' + idx + '">🗑️</button>' : '';
                return '<div class="tech-item-row"><span>' + t + '</span>' + delBtn + '</div>';
            }).join('');

            var delBtns = listEl.querySelectorAll('button[data-del-tech]');
            for (var i = 0; i < delBtns.length; i++) {
                (function (btn, app) {
                    btn.addEventListener('click', function () {
                        var index = parseInt(btn.getAttribute('data-del-tech'), 10);
                        app.deleteTechnician(index);
                    });
                })(delBtns[i], this);
            }
        }

        async addTechnician() {
            var input = this.container.querySelector('#sim-new-tech-input');
            if (!input || !input.value.trim()) return;

            var name = input.value.trim().toUpperCase();
            if (this.technicians.indexOf(name) === -1) {
                this.technicians.push(name);
                await this.saveTechnicians();
                input.value = '';
                this.renderTechniciansList();
                this.updateTechDropdown();
            }
        }

        async deleteTechnician(idx) {
            if (this.technicians.length <= 1) return;
            this.technicians.splice(idx, 1);
            if (this.technicians.indexOf(this.selectedTechnician) === -1) {
                this.selectedTechnician = this.technicians[0];
            }
            await this.saveTechnicians();
            this.renderTechniciansList();
            this.updateTechDropdown();
        }

        async saveTechnicians() {
            var formData = new FormData();
            formData.append('technicians', JSON.stringify(this.technicians));
            try {
                await fetch('apps/sim-maintenance/api.php?action=save_technicians', {
                    method: 'POST',
                    body: formData
                });
            } catch (err) {
                console.error("Save techs error", err);
            }
        }

        updateTechInputs() {
            var workedInput = this.container.querySelector('#paper-worked-name');
            if (workedInput) {
                if (workedInput.tagName === 'INPUT' || workedInput.tagName === 'TEXTAREA') {
                    workedInput.value = this.selectedTechnician;
                } else {
                    workedInput.textContent = this.selectedTechnician;
                }
            }
            var workedTa = this.container.querySelector('#paper-worked-textarea');
            if (workedTa) workedTa.value = this.selectedTechnician;

            var sfCopilot = this.container.querySelector('#sf-copilot');
            if (sfCopilot) sfCopilot.value = this.selectedTechnician;
        }

        updateTechDropdown() {
            var sel = this.container.querySelector('#paper-select-technician');
            if (sel) {
                sel.innerHTML = this.technicians.map(function (tech) {
                    var isSel = (tech === this.selectedTechnician) ? 'selected' : '';
                    return '<option value="' + tech + '" ' + isSel + '>' + tech + '</option>';
                }.bind(this)).join('');
            }
            this.updateTechInputs();
        }

        startFastTelemetryPolling() {
            if (this.fastTelemetryInterval) {
                clearInterval(this.fastTelemetryInterval);
                this.fastTelemetryInterval = null;
            }
            if (this.isTelemetryPaused || !this.telemetryPollingIntervalMs || this.telemetryPollingIntervalMs <= 0) return;

            this.fastTelemetryInterval = setInterval(() => {
                if (this.activeTab === 'subsystems' && !this.isTelemetryPaused) {
                    this.loadTelemetry();
                }
            }, this.telemetryPollingIntervalMs);
        }

        switchTab(tabName) {
            this.activeTab = tabName;
            var btns = this.container.querySelectorAll('.sim-tab-btn[data-tab]');
            for (var i = 0; i < btns.length; i++) {
                btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === tabName);
            }
            var views = this.container.querySelectorAll('.sim-tab-view');
            for (var j = 0; j < views.length; j++) {
                views[j].classList.toggle('active', views[j].id === 'sim-view-' + tabName);
            }

            if (tabName !== 'subsystems' && this.fastTelemetryInterval) {
                clearInterval(this.fastTelemetryInterval);
                this.fastTelemetryInterval = null;
            }

            if (tabName === 'climate') {
                this.loadTelemetry();
                this.loadTelemetryHistory();
            } else if (tabName === 'subsystems') {
                this.loadTelemetry();
                this.startFastTelemetryPolling();
            } else if (tabName === 'archives') {
                this.loadArchives();
            } else if (tabName === 'checklists') {
                this.loadActiveChecklist();
            }
        }

        getFormTitle(type) {
            var t = (type || 'pf').toLowerCase();
            if (t === 'pf') return this.t('sim_maint.form_pf', 'Pre-Flight (PF) — Daily Check Sheet');
            if (t === '1w') return this.t('sim_maint.form_1w', '1-Week Periodic (1W)');
            if (t === 'c1') return this.t('sim_maint.form_c1', 'Monthly (C1)');
            if (t === 'c2') return this.t('sim_maint.form_c2', 'Monthly (C2)');
            if (t === 'c3') return this.t('sim_maint.form_c3', 'Monthly (C3)');
            if (t === 'd1-1') return this.t('sim_maint.form_d1_1', 'D1 Check (Page 1/2)');
            if (t === 'd1-2') return this.t('sim_maint.form_d1_2', 'D1 Check (Page 2/2)');
            if (t === 'd2-1') return this.t('sim_maint.form_d2_1', 'D2 Check (Page 1/2)');
            if (t === 'd2-2') return this.t('sim_maint.form_d2_2', 'D2 Check (Page 2/2)');
            if (t === 'sf') return this.t('sim_maint.form_sf', 'Test Flight (模擬飛行装置点検表)');
            return (type || 'REPORT').toUpperCase();
        }

        renderSheetByType(type, target) {
            var t = (type || 'pf').toLowerCase();
            if (t === 'pf') {
                this.renderPreflightSheet(target);
            } else if (t === '1w') {
                this.render1WSheet(target);
            } else if (t === 'c1' || t === 'c2' || t === 'c3') {
                this.renderMonthlyCSheet(target, t.toUpperCase());
            } else if (t === 'd1-1' || t === 'd1-2') {
                this.renderD1Sheet(target, t.toUpperCase());
            } else if (t === 'd2-1' || t === 'd2-2') {
                this.renderD2Sheet(target, t.toUpperCase());
            } else if (t === 'sf') {
                this.renderTestFlightSheet(target);
            }
        }

        loadActiveChecklist() {
            var container = this.container.querySelector('#paper-sheets-container');
            if (!container) return;

            if (!this.activeSheets || this.activeSheets.length === 0) {
                this.activeSheets = [{ id: 'sheet_1', type: this.currentChecklistType || 'pf' }];
            }

            container.innerHTML = '';
            var self = this;

            this.activeSheets.forEach(function (sheetItem, idx) {
                var card = document.createElement('div');
                card.className = 'paper-sheet-card';
                card.setAttribute('data-sheet-id', sheetItem.id);
                card.setAttribute('data-sheet-type', sheetItem.type);

                var total = self.activeSheets.length;
                var sheetTitle = self.getFormTitle(sheetItem.type);
                var sheetNumberText = self.t('sim_maint.sheet_number', 'Sheet {n} of {total}: {name}')
                    .replace('{n}', idx + 1)
                    .replace('{total}', total)
                    .replace('{name}', sheetTitle);

                var removeBtnHtml = total > 1
                    ? '<button type="button" class="btn-remove-sheet" data-remove-id="' + sheetItem.id + '" title="' + self.t('sim_maint.remove_sheet', 'Remove Form') + '">✕ ' + self.t('sim_maint.remove_sheet', 'Remove') + '</button>'
                    : '';

                card.innerHTML =
                    '<div class="paper-sheet-topbar notprint">' +
                        '<span class="paper-sheet-badge">📄 ' + sheetNumberText + '</span>' +
                        removeBtnHtml +
                    '</div>' +
                    '<div class="paper-sheet" id="sheet-body-' + sheetItem.id + '"></div>';

                container.appendChild(card);

                var sheetBody = card.querySelector('#sheet-body-' + sheetItem.id);
                if (sheetBody) {
                    self.renderSheetByType(sheetItem.type, sheetBody);
                }
            });

            // Écouteurs sur les boutons de suppression de feuille
            var removeBtns = container.querySelectorAll('.btn-remove-sheet');
            removeBtns.forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    var id = e.currentTarget.getAttribute('data-remove-id');
                    self.removeSheet(id);
                });
            });

            this.initPaperSignaturePad();
        }

        addSheet(type) {
            var newId = 'sheet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            var formType = type || '1w';
            this.activeSheets.push({ id: newId, type: formType });
            this.loadActiveChecklist();

            setTimeout(function () {
                var newCard = document.querySelector('[data-sheet-id="' + newId + '"]');
                if (newCard) {
                    newCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 60);
        }

        removeSheet(sheetId) {
            if (this.activeSheets.length <= 1) return;
            this.activeSheets = this.activeSheets.filter(function (s) { return s.id !== sheetId; });
            this.loadActiveChecklist();
        }

        initPaperSignaturePad() {
            var container = this.container.querySelector('#paper-sheets-container') || this.container;
            var canvases = container.querySelectorAll('#paper-sig-canvas, .paper-sig-box');
            if (!canvases || canvases.length === 0) return;

            canvases.forEach(function (canvas) {
                if (canvas._sigBound) return;
                canvas._sigBound = true;
                canvas._hasDrawn = false;

                var ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;

                ctx.lineWidth = 1.8;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#0f172a';

                var isDrawing = false;
                var lastX = 0;
                var lastY = 0;

                function getCoords(e) {
                    var rect = canvas.getBoundingClientRect();
                    var clientX = e.clientX;
                    var clientY = e.clientY;
                    if (e.touches && e.touches.length > 0) {
                        clientX = e.touches[0].clientX;
                        clientY = e.touches[0].clientY;
                    }
                    var scaleX = canvas.width / rect.width;
                    var scaleY = canvas.height / rect.height;
                    return {
                        x: (clientX - rect.left) * scaleX,
                        y: (clientY - rect.top) * scaleY
                    };
                }

                function startDrawing(e) {
                    isDrawing = true;
                    canvas._hasDrawn = true;
                    var pos = getCoords(e);
                    lastX = pos.x;
                    lastY = pos.y;
                    ctx.beginPath();
                    ctx.moveTo(lastX, lastY);
                    if (e.type && e.type.startsWith('touch')) {
                        e.preventDefault();
                    }
                }

                function draw(e) {
                    if (!isDrawing) return;
                    canvas._hasDrawn = true;
                    var pos = getCoords(e);
                    ctx.beginPath();
                    ctx.moveTo(lastX, lastY);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    lastX = pos.x;
                    lastY = pos.y;
                    if (e.type && e.type.startsWith('touch')) {
                        e.preventDefault();
                    }
                }

                function stopDrawing() {
                    isDrawing = false;
                }

                canvas.addEventListener('mousedown', startDrawing);
                canvas.addEventListener('mousemove', draw);
                window.addEventListener('mouseup', stopDrawing);

                canvas.addEventListener('touchstart', startDrawing, { passive: false });
                canvas.addEventListener('touchmove', draw, { passive: false });
                window.addEventListener('touchend', stopDrawing);

                var parentCell = canvas.closest('td, div, .sheet-a4-wrapper') || canvas.parentElement;
                var clearBtn = parentCell ? parentCell.querySelector('#paper-clear-sig-btn') : null;
                if (clearBtn) {
                    clearBtn.addEventListener('click', function () {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        canvas._hasDrawn = false;
                    });
                }
            });
        }

        renderPreflightSheet(target) {
            var tel = this.telemetryData;

            target.innerHTML = `
                <div class="sheet-a4-wrapper">
                    <div class="sheet-a4-body">
                        <div class="pf-header-box">
                            <div class="pf-title-left" onclick="window.simMaintenanceApp.toggleAllChecks()" title="Click to toggle all checkmarks">
                                <div class="pf-main-title">Indra EC-135FFS</div>
                                <div class="pf-sub-title">PRE-FLIGHT CHECK SHEET</div>
                            </div>
                            <div class="pf-meta-grid">
                                <div class="pf-meta-label">LOG TIME</div>
                                <div class="pf-meta-val">: <input type="text" class="paper-input" value="${tel.time}" style="width: 84px; font-weight: bold;"></div>
                                <div class="pf-meta-label">DATE</div>
                                <div class="pf-meta-val">: <input type="date" class="paper-input" id="pf-input-date" value="${this.getISODate(tel.date)}" style="width: 125px; font-weight: bold; font-size: 11px;"></div>

                                <div class="pf-meta-label">MCC</div>
                                <div class="pf-meta-val">: <input type="number" class="paper-input" id="pf-input-mcc" value="" placeholder="H" style="width: 60px; font-weight: bold;"> H</div>
                                <div class="pf-meta-label">MAIN</div>
                                <div class="pf-meta-val">: <input type="number" class="paper-input" id="pf-input-main" value="" placeholder="H" style="width: 60px; font-weight: bold;"> H</div>

                                <div class="pf-meta-label">Humidity</div>
                                <div class="pf-meta-val">: ${tel.humidity.toFixed(0)} %</div>
                                <div class="pf-meta-label">Temperature</div>
                                <div class="pf-meta-val">: ${tel.temperature.toFixed(1)} °C</div>
                            </div>
                        </div>

                        <div class="pf-columns-grid">
                            <!-- Left Column (Sections 1 to 6) -->
                            <div class="pf-column">
                                <div class="pf-section-header">1 Control Room:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">1-1</div>
                                    <div class="pf-content-col">
                                        <span>Air cond</span>
                                        <div class="paper-toggle-group">
                                            <button type="button" class="pf-toggle-btn active" onclick="window.simMaintenanceApp.toggleBtn(this)">PAC-1-14-1</button>
                                            <button type="button" class="pf-toggle-btn" onclick="window.simMaintenanceApp.toggleBtn(this)">PAC-1-15-1</button>
                                        </div>
                                    </div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">2 Simulator Room:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-1</div>
                                    <div class="pf-content-col"><span>Simulator Exterior</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-2</div>
                                    <div class="pf-content-col"><span>Fire Alarm Panel</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-3</div>
                                    <div class="pf-content-col">
                                        <span>Motion Control Cabinet</span>
                                        <div class="paper-toggle-group">
                                            <button type="button" class="pf-toggle-btn active" onclick="window.simMaintenanceApp.toggleBtn(this)">ON</button>
                                            <button type="button" class="pf-toggle-btn" onclick="window.simMaintenanceApp.toggleBtn(this)">OFF</button>
                                        </div>
                                    </div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-4</div>
                                    <div class="pf-content-col"><span>Cooling Fans</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-5</div>
                                    <div class="pf-content-col">
                                        <span>ASSU</span>
                                        <div class="paper-toggle-group">
                                            <button type="button" class="pf-toggle-btn active" onclick="window.simMaintenanceApp.toggleBtn(this)">ON</button>
                                            <button type="button" class="pf-toggle-btn" onclick="window.simMaintenanceApp.toggleBtn(this)">OFF</button>
                                        </div>
                                    </div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-6</div>
                                    <div class="pf-content-col">
                                        <span>Air cond</span>
                                        <div class="paper-toggle-group">
                                            <button type="button" class="pf-toggle-btn" onclick="window.simMaintenanceApp.toggleBtn(this)">PAC-1-12-1</button>
                                            <button type="button" class="pf-toggle-btn active" onclick="window.simMaintenanceApp.toggleBtn(this)">PAC-1-13-1</button>
                                        </div>
                                    </div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-7</div>
                                    <div class="pf-content-col"><span>Pneumatic Tanks</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-8</div>
                                    <div class="pf-content-col"><span>Drawbridge (RAMP)</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-9</div>
                                    <div class="pf-content-col"><span>Motion Actuators (#1 - #6)</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">2-10</div>
                                    <div class="pf-content-col"><span>Air Center Oil (Kaeser)</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">3 Control Room Racks:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">3-1</div>
                                    <div class="pf-content-col"><span>PC Racks</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">3-2</div>
                                    <div class="pf-content-col"><span>Cooling Fans</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">4 Spacer:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">4-1</div>
                                    <div class="pf-content-col"><span>Cooling Fans</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">4-2</div>
                                    <div class="pf-content-col"><span>Fluorescent</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">4-3</div>
                                    <div class="pf-content-col"><span>VP Pneumatic Cabinet</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">4-4</div>
                                    <div class="pf-content-col">
                                        <span>AIR PRESSURE (Z-AXIS) <small style="color:#64748b;">(4-5)</small></span>
                                        <span><input type="number" step="0.1" class="paper-input" value="4.8" style="width: 40px; text-align: center;"> Bar</span>
                                    </div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">5 Roof:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">5-1</div>
                                    <div class="pf-content-col"><span>Fan (EX)</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">6 Dome:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">6-1</div>
                                    <div class="pf-content-col"><span>Projectors</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">6-2</div>
                                    <div class="pf-content-col"><span>Projectors fans</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">6-3</div>
                                    <div class="pf-content-col"><span>Vibration mech.</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">6-4</div>
                                    <div class="pf-content-col"><span>Dome screen</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                            </div>

                            <!-- Right Column (Sections 7 to 12) -->
                            <div class="pf-column">
                                <div class="pf-section-header">7 AFT Cabin:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">7-1</div>
                                    <div class="pf-content-col"><span>IOS seat/OBS seat</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">7-2</div>
                                    <div class="pf-content-col"><span>Session start</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">7-3</div>
                                    <div class="pf-content-col"><span>IOS operation</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">7-4</div>
                                    <div class="pf-content-col"><span>System Status</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">7-5</div>
                                    <div class="pf-content-col"><span>Motion</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">7-6</div>
                                    <div class="pf-content-col"><span>Fluorescent</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">8 Check Visual:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">8-1</div>
                                    <div class="pf-content-col"><span>Geometry, Blending and Color</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">9 Cockpit Check:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">9-1</div>
                                    <div class="pf-content-col"><span>Cockpit Structure</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">9-2</div>
                                    <div class="pf-content-col"><span>Equipments</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">9-3</div>
                                    <div class="pf-content-col"><span>Do EC-135 Normal check List</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">9-4</div>
                                    <div class="pf-content-col"><span>Check lighting</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">9-5</div>
                                    <div class="pf-content-col"><span>Communication</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">10 Flight Check:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">10-1</div>
                                    <div class="pf-content-col"><span>Flight Control</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">10-2</div>
                                    <div class="pf-content-col"><span>Instruments</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">10-3</div>
                                    <div class="pf-content-col"><span>PFD, ND</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">10-4</div>
                                    <div class="pf-content-col"><span>AP test</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">11 Setup:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">11-1</div>
                                    <div class="pf-content-col"><span>Clean Cockpit and IOS as needed</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">11-2</div>
                                    <div class="pf-content-col"><span>System Status</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>

                                <div class="pf-section-header" style="margin-top: 3px;">12 Debriefing Room:</div>
                                <div class="pf-row">
                                    <div class="pf-num-col">12-1</div>
                                    <div class="pf-content-col"><span>Debriefing</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                                <div class="pf-row">
                                    <div class="pf-num-col">12-2</div>
                                    <div class="pf-content-col"><span>Clean Screens</span></div>
                                    <div class="pf-check-col" onclick="window.simMaintenanceApp.togglePfCheck(this)"><span class="paper-check-green" style="display: none;">✓</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Spacer block that stretches across remaining A4 page to push bottom box to bottom -->
                    <div class="sheet-a4-spacer"></div>

                    <!-- Bottom Box -->
                    <div class="pf-bottom-box">
                        <div class="pf-bottom-col">
                            <div class="pf-bottom-title">REMARKS</div>
                            <textarea class="paper-input" id="pf-remarks" style="width: 100%; height: 60px; resize: none; font-size: 10.5px; padding: 2px 4px; box-sizing: border-box;"></textarea>
                        </div>

                        <div class="pf-bottom-col" style="font-size: 10.5px; line-height: 1.35;">
                            <div class="pf-bottom-title">PNEUMATIC TANKS Pressure</div>
                            <table style="border: none; width: 100%; font-size: 10px; line-height: 1.35;">
                                <tr style="border: none;"><td style="border: none; padding: 1px 0;">Air Center</td><td style="border: none; padding: 1px 0;">: <input type="number" step="0.1" class="paper-input" value="9.5" style="width: 42px; text-align: center; padding: 1px 2px;"> Bar</td></tr>
                                <tr style="border: none;"><td style="border: none; padding: 1px 0;">#1</td><td style="border: none; padding: 1px 0;">: <input type="number" step="0.1" class="paper-input" value="9.5" style="width: 42px; text-align: center; padding: 1px 2px;"> Bar</td></tr>
                                <tr style="border: none;"><td style="border: none; padding: 1px 0;">#2</td><td style="border: none; padding: 1px 0;">: <input type="number" step="0.1" class="paper-input" value="9.5" style="width: 42px; text-align: center; padding: 1px 2px;"> Bar</td></tr>
                                <tr style="border: none;"><td style="border: none; padding: 1px 0;">#3</td><td style="border: none; padding: 1px 0;">: <input type="number" step="0.1" class="paper-input" value="9.5" style="width: 42px; text-align: center; padding: 1px 2px;"> Bar</td></tr>
                                <tr style="border: none;"><td style="border: none; padding: 1px 0;">BABY CON</td><td style="border: none; padding: 1px 0;">: L <input type="number" step="10" class="paper-input" value="110" style="width: 36px; text-align: center; padding: 1px 2px;"> Mpa, R <input type="number" step="10" class="paper-input" value="90" style="width: 36px; text-align: center; padding: 1px 2px;"> Mpa</td></tr>
                            </table>
                        </div>

                        <div class="pf-bottom-col">
                            <div class="pf-bottom-title">WORK LOG</div>
                            <textarea class="paper-input" id="paper-worked-textarea" style="width: 100%; height: 38px; resize: none; font-size: 10.5px; padding: 2px 4px; box-sizing: border-box;">${this.selectedTechnician}</textarea>
                            <div style="margin-top: 3px; font-size: 10.5px;">
                                <input type="text" class="paper-input" value="0.5" id="pf-duration" style="width: 42px; text-align: center; padding: 1px 2px;"> M/H
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        toggleBtn(btn) {
            var group = btn.closest ? btn.closest('.paper-toggle-group') : btn.parentNode;
            if (group) {
                var btns = group.querySelectorAll('.pf-toggle-btn');
                for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
                btn.classList.add('active');
            }
        }

        togglePfCheck(cell) {
            var mark = cell.querySelector('.pf-check-mark, .paper-check-green');
            if (mark) {
                var isHidden = mark.style.display === 'none' || mark.style.visibility === 'hidden';
                mark.style.display = isHidden ? 'inline-flex' : 'none';
                mark.style.visibility = isHidden ? 'visible' : 'hidden';
            } else {
                var hasCheck = cell.textContent.trim().length > 0;
                cell.innerHTML = hasCheck ? '' : '<span class="paper-check-green">✓</span>';
            }
        }

        togglePaperCheck(cell) {
            var mark = cell.querySelector('.paper-check-green, .pf-check-mark');
            if (mark) {
                var isHidden = mark.style.display === 'none' || mark.style.visibility === 'hidden';
                mark.style.display = isHidden ? 'inline-flex' : 'none';
                mark.style.visibility = isHidden ? 'visible' : 'hidden';
            } else {
                var hasCheck = cell.textContent.trim().length > 0;
                cell.innerHTML = hasCheck ? '' : '<span class="paper-check-green">✓</span>';
            }
        }

        toggleAllChecks() {
            var container = this.container.querySelector('#paper-sheets-container, #paper-sheet-target');
            if (!container) return;

            var allMarks = container.querySelectorAll('.paper-check-green, .pf-check-mark');
            if (allMarks.length > 0) {
                var anyUnchecked = false;
                allMarks.forEach(function (m) {
                    if (m.style.display === 'none' || m.style.visibility === 'hidden') {
                        anyUnchecked = true;
                    }
                });
                allMarks.forEach(function (m) {
                    m.style.display = anyUnchecked ? 'inline-flex' : 'none';
                    m.style.visibility = anyUnchecked ? 'visible' : 'hidden';
                });
            }
        }

        renderCommonHeader(systemHtml, sheetCode) {
            return `
                <table class="paper-table" style="border: none; border-bottom: 2px solid #000000; width: 100%;">
                    <tr>
                        <td style="width: 18%; vertical-align: middle; border: none; border-right: 2px solid #000000; font-size: 13.5px; line-height: 1.25; padding: 6px 8px;">
                            <strong>SYSTEM:</strong><br>${systemHtml}
                        </td>
                        <td style="width: 66%; text-align: center; vertical-align: middle; border: none; border-right: 2px solid #000000; padding: 8px;">
                            <span style="font-size: 31px; font-weight: bold; cursor: pointer; letter-spacing: 0.5px;" onclick="window.simMaintenanceApp.toggleAllChecks()" title="Click to toggle all checkmarks">EC-135 FFS</span>
                        </td>
                        <td style="width: 16%; text-align: center; vertical-align: middle; border: none; padding: 6px 8px;">
                            <span style="font-size: 31px; font-weight: bold; cursor: pointer;" onclick="window.simMaintenanceApp.toggleAllChecks()" title="Click to toggle all checkmarks">${sheetCode}</span>
                        </td>
                    </tr>
                </table>
            `;
        }

        getISODate(d) {
            if (!d) return new Date().toISOString().split('T')[0];
            if (typeof d === 'string') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
                var frMatch = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (frMatch) {
                    var day = frMatch[1].padStart(2, '0');
                    var month = frMatch[2].padStart(2, '0');
                    var year = frMatch[3];
                    return `${year}-${month}-${day}`;
                }
                var parsed = new Date(d);
                if (!isNaN(parsed.getTime())) {
                    var y = parsed.getFullYear();
                    var m = String(parsed.getMonth() + 1).padStart(2, '0');
                    var dayStr = String(parsed.getDate()).padStart(2, '0');
                    return `${y}-${m}-${dayStr}`;
                }
            }
            return new Date().toISOString().split('T')[0];
        }

        renderCommonFooter(options) {
            var mh = (options && options.mh) ? options.mh : '0.5';
            var workedDate = this.getISODate(this.telemetryData && this.telemetryData.date);
            var checkedDate = this.getISODate();

            return `
                <table class="paper-table" style="border: none; border-top: 2px solid #000000; width: 100%; page-break-inside: avoid !important; break-inside: avoid !important;">
                    <tr>
                        <!-- Left: REMARKS Column -->
                        <td style="width: 40%; vertical-align: top; border: none; border-right: 2px solid #000000; padding: 0;">
                            <div style="background: #d9d9d9; border-bottom: 1px solid #000000; font-weight: bold; font-size: 13.5px; padding: 2px 5px; text-transform: uppercase;">
                                REMARKS
                            </div>
                            <div style="padding: 3px;">
                                <textarea class="paper-input" id="paper-remarks" style="width: 100%; height: 70px; resize: none; border: 1px solid #999; font-family: inherit; font-size: 12.5px; padding: 3px; box-sizing: border-box;"></textarea>
                            </div>
                        </td>

                        <!-- Right: M/H, WORKED, CHEKED + Signature -->
                        <td style="width: 60%; vertical-align: top; border: none; padding: 0;">
                            <!-- M/H Box -->
                            <div>
                                <div style="background: #d9d9d9; border-bottom: 1px solid #000000; font-weight: bold; font-size: 13.5px; padding: 2px 5px; text-transform: uppercase;">
                                    M/H
                                </div>
                                <div style="padding: 2px 5px; border-bottom: 1px solid #000000;">
                                    <input type="text" class="paper-input" id="paper-mh-input" value="${mh}" style="width: 52px; font-weight: bold; font-size: 12.5px; padding: 1px 3px; border: 1px solid #999;">
                                </div>
                            </div>

                            <!-- WORKED & DATE Row -->
                            <div style="display: grid; grid-template-columns: 1fr 130px; border-bottom: 1px solid #000000;">
                                <div style="border-right: 1px solid #000000;">
                                    <div style="background: #d9d9d9; border-bottom: 1px solid #000000; font-weight: bold; font-size: 13.5px; padding: 2px 5px;">
                                        WORKED
                                    </div>
                                    <div style="padding: 3px 5px;">
                                        <textarea class="paper-input" id="paper-worked-textarea" style="width: 100%; height: 24px; resize: none; font-weight: bold; font-size: 12.5px; border: 1px solid #999; padding: 1px 3px; box-sizing: border-box;">${this.selectedTechnician || 'SHEKH V. LECOQ'}</textarea>
                                    </div>
                                </div>
                                <div>
                                    <div style="background: #d9d9d9; border-bottom: 1px solid #000000; font-weight: bold; font-size: 13.5px; padding: 2px 5px;">
                                        DATE
                                    </div>
                                    <div style="padding: 3px 5px;">
                                        <input type="date" class="paper-input" id="paper-worked-date" value="${workedDate}" style="width: 100%; font-weight: bold; font-size: 12.5px; border: 1px solid #999; box-sizing: border-box;">
                                    </div>
                                </div>
                            </div>

                            <!-- CHEKED & DATE Row with Touch Signature Canvas -->
                            <div style="display: grid; grid-template-columns: 1fr 130px;">
                                <div style="border-right: 1px solid #000000; position: relative;">
                                    <div style="background: #d9d9d9; border-bottom: 1px solid #000000; font-weight: bold; font-size: 13.5px; padding: 2px 5px;">
                                        CHEKED
                                    </div>
                                    <div style="padding: 2px 5px; position: relative; min-height: 65px; background: #ffffff;">
                                        <canvas id="paper-sig-canvas" class="paper-sig-box" width="240" height="65" style="border: 1px dashed #cbd5e1; width: 100%; height: 65px; cursor: crosshair; background: #ffffff; touch-action: none;"></canvas>
                                        <button type="button" id="paper-clear-sig-btn" style="position: absolute; right: 4px; bottom: 3px; font-size: 10px; padding: 1px 4px; cursor: pointer; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px;">Clear</button>
                                    </div>
                                </div>
                                <div>
                                    <div style="background: #d9d9d9; border-bottom: 1px solid #000000; font-weight: bold; font-size: 13.5px; padding: 2px 5px;">
                                        DATE
                                    </div>
                                    <div style="padding: 3px 5px;">
                                        <input type="date" class="paper-input" id="paper-checked-date" value="${checkedDate}" style="width: 100%; font-weight: bold; font-size: 12.5px; border: 1px solid #999; box-sizing: border-box;">
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>
            `;
        }

        render1WSheet(target) {
            target.innerHTML = `
                <div class="sheet-a4-wrapper">
                    <div class="sheet-a4-body">
                        ${this.renderCommonHeader('&nbsp;&nbsp;Visual', '1W')}

                        <!-- Items Checklist Table -->
                        <table class="paper-table" style="border: none; width: 100%;">
                            <thead>
                                <tr>
                                    <th class="paper-grey-hdr" style="width: 42px; text-align: center;">No.</th>
                                    <th class="paper-grey-hdr" style="width: 48px; text-align: center;">LOC</th>
                                    <th class="paper-grey-hdr" style="text-align: left; padding-left: 8px;">TITLE</th>
                                    <th class="paper-grey-hdr" style="width: 70px; text-align: center;">ACTION</th>
                                    <th class="paper-grey-hdr" style="width: 60px; text-align: center;">CHECK</th>
                                    <th class="paper-grey-hdr" style="width: 85px; text-align: center;">REMARK</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="text-align: center; font-size: 12px;">28</td>
                                    <td style="text-align: center; font-size: 12px;">A05</td>
                                    <td style="font-size: 12px; font-weight: 500;">Contrast/Brightness Adjustments.</td>
                                    <td></td>
                                    <td class="paper-check-cell" onclick="window.simMaintenanceApp.togglePaperCheck(this)" style="text-align: center; cursor: pointer;">
                                        <span class="paper-check-green" style="display: none;">✓</span>
                                    </td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="text-align: center; font-size: 12px;">29</td>
                                    <td style="text-align: center; font-size: 12px;">A05</td>
                                    <td style="font-size: 12px; font-weight: 500;">Geometry/Edge Blending Adjustments.</td>
                                    <td></td>
                                    <td class="paper-check-cell" onclick="window.simMaintenanceApp.togglePaperCheck(this)" style="text-align: center; cursor: pointer;">
                                        <span class="paper-check-green" style="display: none;">✓</span>
                                    </td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td style="text-align: center; font-size: 12px;"></td>
                                    <td style="text-align: center; font-size: 12px;"></td>
                                    <td style="font-size: 12px; font-weight: 500;">Switch Main Bay and Control Room AC Units.</td>
                                    <td></td>
                                    <td class="paper-check-cell" onclick="window.simMaintenanceApp.togglePaperCheck(this)" style="text-align: center; cursor: pointer;">
                                        <span class="paper-check-green" style="display: none;">✓</span>
                                    </td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td style="font-size: 11px; line-height: 1.45; padding: 6px 8px; vertical-align: top;">
                                        Color<br>
                                        Edge Blending<br>
                                        Brightness<br>
                                        Contrast<br>
                                        Geometry<br>
                                        Focus (*1)<br>
                                        *1: Release focus ring before focus adjustment except ch #3<br>
                                        (Remove lock seal from the focus ring)<br>
                                        <strong>AUTOMATIC ALIGNEMENT操作</strong><br>
                                        <strong>CHANNEL #1-10</strong><br>
                                        調整後の評価基準について、<br>
                                        回転翼の訓練形態、<br>
                                        要求を満足することが求められる。
                                    </td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Spacer block that stretches across remaining A4 page to push footer to the bottom -->
                    <div class="sheet-a4-spacer"></div>

                    ${this.renderCommonFooter({ mh: '0.5' })}
                </div>
            `;
        }

        renderMonthlyCSheet(target, checkCode) {
            var commonItems = [
                { no: '30', loc: 'A04006', title: 'MINIRACK #3 (Control Loading System)', act: 'CLN' },
                { no: '31', loc: 'B01', title: 'PROCESS RACK #1', act: 'CLN' },
                { no: '32', loc: 'B02', title: 'VISUAL RACK #1', act: 'CLN' },
                { no: '33', loc: 'B03', title: 'VISUAL RACK #2', act: 'CLN' },
                { no: '34', loc: 'B04', title: 'DBF RACK #1', act: 'CLN' },
                { no: '35', loc: 'A04005', title: 'Digital Audio & Communications System (MINIRACK #2)', act: 'CLN' },
                { no: '36', loc: 'A04004', title: 'Real Time IO System (MINIRACK #1)', act: 'CLN' },
                { no: '37', loc: 'A02001', title: 'PROJECTOR #1', act: 'CLN' },
                { no: '38', loc: 'A02002', title: 'PROJECTOR #2', act: 'CLN' },
                { no: '39', loc: 'A02003', title: 'PROJECTOR #3', act: 'CLN' },
                { no: '40', loc: 'A02004', title: 'PROJECTOR #4', act: 'CLN' },
                { no: '41', loc: 'A02005', title: 'PROJECTOR #5', act: 'CLN' },
                { no: '42', loc: 'A03001', title: 'PROJECTOR #6', act: 'CLN' },
                { no: '43', loc: 'A03002', title: 'PROJECTOR #7', act: 'CLN' },
                { no: '44', loc: 'A03003', title: 'PROJECTOR #8', act: 'CLN' },
                { no: '45', loc: 'A03004', title: 'PROJECTOR #9', act: 'CLN' },
                { no: '46', loc: 'A03005', title: 'PROJECTOR #10', act: 'CLN' }
            ];

            var specificItems = [];
            var systemText = '';
            var codeUpper = (checkCode || 'C1').toUpperCase();

            if (codeUpper === 'C1') {
                systemText = '&nbsp;&nbsp;CLS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Visual<br>&nbsp;&nbsp;Computer&nbsp;&nbsp;COCKPIT<br>&nbsp;&nbsp;DACS<br>&nbsp;&nbsp;RTIOS';
                specificItems = [
                    { no: '47', loc: 'A05001', title: 'COCKPIT ELEMENTS', act: 'CLN' }
                ];
            } else if (codeUpper === 'C2') {
                systemText = '&nbsp;&nbsp;CLS&nbsp;&nbsp;&nbsp;Visual<br>&nbsp;&nbsp;Computer<br>&nbsp;&nbsp;DACS<br>&nbsp;&nbsp;RTIOS';
                specificItems = [
                    { no: '47', loc: 'A05001', title: 'COCKPIT ELEMENTS', act: 'CLN' },
                    { no: '48', loc: 'B01004', title: 'LCD CONSOLE + KVM SWITCH (PROCESS RACK#1)', act: 'CLN' },
                    { no: '49', loc: 'B02009', title: 'LCD CONSOLE + KVM SWITCH (VISUAL RACK #1)', act: 'CLN' },
                    { no: '50', loc: 'B04006', title: 'LCD CONSOLE + KVM SWITCH (DBF RACK #1)', act: 'CLN' }
                ];
            } else if (codeUpper === 'C3') {
                systemText = '&nbsp;&nbsp;CLS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Visual<br>&nbsp;&nbsp;Computer&nbsp;Vibration<br>&nbsp;&nbsp;DACS<br>&nbsp;&nbsp;RTIOS';
                specificItems = [
                    { no: '51', loc: 'A03010', title: 'VIBRATION PLATFORM ASSEMBLY', act: 'VIS INSP' }
                ];
            }

            target.innerHTML = `
                <div class="sheet-a4-wrapper">
                    <div class="sheet-a4-body">
                        ${this.renderCommonHeader(systemText, codeUpper)}

                        <table class="paper-table" style="border: none; width: 100%;">
                            <thead>
                                <tr>
                                    <th class="paper-grey-hdr" style="width: 35px; text-align: center;">No.</th>
                                    <th class="paper-grey-hdr" style="width: 55px; text-align: center;">LOC</th>
                                    <th class="paper-grey-hdr" style="text-align: left; padding-left: 8px;">TITLE</th>
                                    <th class="paper-grey-hdr" style="width: 65px; text-align: center;">ACTION</th>
                                    <th class="paper-grey-hdr" style="width: 55px; text-align: center;">CHECK</th>
                                    <th class="paper-grey-hdr" style="width: 70px; text-align: center;">REMARK</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${commonItems.map(function (it) {
                                    return '<tr>' +
                                        '<td style="text-align: center;">' + it.no + '</td><td style="text-align: center;">' + it.loc + '</td><td>' + it.title + '</td><td style="text-align: center;">' + it.act + '</td>' +
                                        '<td class="paper-check-cell" onclick="window.simMaintenanceApp.togglePaperCheck(this)" style="text-align: center; cursor: pointer;"><span class="paper-check-green" style="display: none;">✓</span></td>' +
                                        '<td></td>' +
                                    '</tr>';
                                }).join('')}

                                <!-- Separator row from original PHP -->
                                <tr>
                                    <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
                                </tr>

                                ${specificItems.map(function (it) {
                                    return '<tr>' +
                                        '<td style="text-align: center;">' + it.no + '</td><td style="text-align: center;">' + it.loc + '</td><td>' + it.title + '</td><td style="text-align: center;">' + it.act + '</td>' +
                                        '<td class="paper-check-cell" onclick="window.simMaintenanceApp.togglePaperCheck(this)" style="text-align: center; cursor: pointer;"><span class="paper-check-green" style="display: none;">✓</span></td>' +
                                        '<td></td>' +
                                    '</tr>';
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Spacer block that stretches across remaining A4 page to push footer to the bottom -->
                    <div class="sheet-a4-spacer"></div>

                    ${this.renderCommonFooter({ mh: '0.5' })}
                </div>
            `;
        }

        renderD1Sheet(target, pageCode) {
            var items = [];
            var isPage1 = (pageCode === 'D1-1' || pageCode.endsWith('-1'));
            var systemText = isPage1
                ? '&nbsp;&nbsp;Cockpit<br>&nbsp;&nbsp;Computer<br>&nbsp;&nbsp;Dome<br>&nbsp;&nbsp;Vibration'
                : '&nbsp;&nbsp;CLS&nbsp;Visual<br>&nbsp;&nbsp;Computer&nbsp;COCKPIT<br>&nbsp;&nbsp;DACS<br>&nbsp;&nbsp;RTIOS';

            if (isPage1) {
                items = [
                    { no: '30', loc: 'A04006', title: 'MINIRACK #3 (Control Loading System)', act: 'CLN' },
                    { no: '53', loc: 'B01001', title: 'HOST PC (PROCESS RACK#1)', act: 'CLN' },
                    { no: '54', loc: 'B01005', title: 'IOS PC (PROCESS RACK#1)', act: 'CLN' },
                    { no: '55', loc: 'B01006', title: 'RTIO PC (PROCESS RACK#1)', act: 'CLN' },
                    { no: '56', loc: 'B01007', title: 'SOUNDS/COMMS PC (PROCESS RACK#1)', act: 'CLN' },
                    { no: '57', loc: 'B01008', title: 'MAINTENANCE PC (PROCESS RACK#1)', act: 'CLN' },
                    { no: '58', loc: 'B02002', title: 'VIS ALIGN PC (VISUAL RACK#1)', act: 'CLN' },
                    { no: '59', loc: 'B02003', title: 'MSS SERVER (VISUAL RACK#1)', act: 'CLN' },
                    { no: '60', loc: 'B02004', title: 'MSS STORAGE (VISUAL RACK#1)', act: 'CLN' },
                    { no: '61', loc: 'B02005', title: 'VIS IG1 PC (VISUAL RACK#1)', act: 'CLN' },
                    { no: '62', loc: 'B02006', title: 'VIS IG2 PC (VISUAL RACK#1)', act: 'CLN' },
                    { no: '63', loc: 'B02007', title: 'VIS IG3 PC (VISUAL RACK#1)', act: 'CLN' },
                    { no: '64', loc: 'B02008', title: 'VIS IG4 PC (VISUAL RACK#1)', act: 'CLN' },
                    { no: '65', loc: 'B03001', title: 'VIS IG5 PC (VISUAL RACK#2)', act: 'CLN' },
                    { no: '66', loc: 'B03002', title: 'VIS IG6 PC (VISUAL RACK#2)', act: 'CLN' },
                    { no: '67', loc: 'B03003', title: 'VIS IG7 PC (VISUAL RACK#2)', act: 'CLN' },
                    { no: '68', loc: 'B03004', title: 'VIS IG8 PC (VISUAL RACK#2)', act: 'CLN' },
                    { no: '69', loc: 'B03005', title: 'VIS IG9 PC (VISUAL RACK#2)', act: 'CLN' },
                    { no: '70', loc: 'B03006', title: 'VISUAL MASTER PC (VISUAL RACK#1)', act: 'CLN' },
                    { no: '71', loc: 'B03006', title: 'VIS IG10 PC (VISUAL RACK#2)', act: 'CLN' },
                    { no: '72', loc: 'B04001', title: 'DRS PC (DBF RACK#1)', act: 'CLN' },
                    { no: '73', loc: 'B04002', title: 'DPS PC (DBF RACK#1)', act: 'CLN' },
                    { no: '74', loc: 'B04003', title: 'DCC PC (DBF RACK#1)', act: 'CLN' },
                    { no: '75', loc: 'B04004', title: 'STEALTH VIEW PC (DBF RACK#1)', act: 'CLN' },
                    { no: '76', loc: 'B04005', title: 'DBF SOUNDS/COMMS PC (DBF RACK#1)', act: 'CLN' }
                ];
            } else {
                items = [
                    { no: '52', loc: 'A05002', title: 'CABIN WINDOWS', act: 'CLN' },
                    { no: '77', loc: 'A03', title: 'Projection Screen Dome Cleaning-Up', act: 'CLN' },
                    { no: '78', loc: 'A03010', title: 'VIBRATION PLATFORM ASSEMBLY', act: 'VIS INSP' },
                    { no: '94', loc: 'A06', title: 'RAMP<br><span style="font-size:10px;">ASG 5 grease (=DIVINOL LITHOGREASE G421).<br>Avoid over-lubricating</span>', act: 'LUB' }
                ];
            }

            target.innerHTML = `
                <div class="sheet-a4-wrapper">
                    <div class="sheet-a4-body">
                        ${this.renderCommonHeader(systemText, pageCode)}

                        <table class="paper-table" style="border: none; width: 100%;">
                            <thead>
                                <tr>
                                    <th class="paper-grey-hdr" style="width: 35px; text-align: center;">No.</th>
                                    <th class="paper-grey-hdr" style="width: 55px; text-align: center;">LOC</th>
                                    <th class="paper-grey-hdr" style="text-align: left; padding-left: 8px;">TITLE</th>
                                    <th class="paper-grey-hdr" style="width: 65px; text-align: center;">ACTION</th>
                                    <th class="paper-grey-hdr" style="width: 55px; text-align: center;">CHECK</th>
                                    <th class="paper-grey-hdr" style="width: 70px; text-align: center;">REMARK</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(function (it) {
                                    return '<tr>' +
                                        '<td style="text-align: center;">' + it.no + '</td><td style="text-align: center;">' + it.loc + '</td><td>' + it.title + '</td><td style="text-align: center;">' + it.act + '</td>' +
                                        '<td class="paper-check-cell" onclick="window.simMaintenanceApp.togglePaperCheck(this)" style="text-align: center; cursor: pointer;"><span class="paper-check-green" style="display: none;">✓</span></td>' +
                                        '<td></td>' +
                                    '</tr>';
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Spacer block that stretches across remaining A4 page to push footer to the bottom -->
                    <div class="sheet-a4-spacer"></div>

                    ${this.renderCommonFooter({ mh: '0.5' })}
                </div>
            `;
        }

        renderD2Sheet(target, pageCode) {
            var items = [];
            var isPage1 = (pageCode === 'D2-1' || pageCode.endsWith('-1'));
            var systemText = isPage1
                ? '&nbsp;&nbsp;Cockpit&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Projector<br>&nbsp;&nbsp;AFT&nbsp;CABIN<br>&nbsp;&nbsp;Control&nbsp;Loading&nbsp;(CLS)<br>&nbsp;&nbsp;Rmap<br>&nbsp;&nbsp;DACS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RTIOS'
                : '&nbsp;&nbsp;CLS&nbsp;Visual<br>&nbsp;&nbsp;Computer&nbsp;COCKPIT<br>&nbsp;&nbsp;DACS<br>&nbsp;&nbsp;RTIOS';

            if (isPage1) {
                items = [
                    { no: '80', loc: 'A02001', title: 'PROJECTOR #1', act: 'ADJ' },
                    { no: '81', loc: 'A02002', title: 'PROJECTOR #2', act: 'ADJ' },
                    { no: '82', loc: 'A02003', title: 'PROJECTOR #3', act: 'ADJ' },
                    { no: '83', loc: 'A02004', title: 'PROJECTOR #4', act: 'ADJ' },
                    { no: '84', loc: 'A02005', title: 'PROJECTOR #5', act: 'ADJ' },
                    { no: '85', loc: 'A03001', title: 'PROJECTOR #6', act: 'ADJ' },
                    { no: '86', loc: 'A03002', title: 'PROJECTOR #7', act: 'ADJ' },
                    { no: '87', loc: 'A03003', title: 'PROJECTOR #8', act: 'ADJ' },
                    { no: '88', loc: 'A03004', title: 'PROJECTOR #9', act: 'ADJ' },
                    { no: '89', loc: 'A03005', title: 'PROJECTOR #10', act: 'ADJ' },
                    { no: '90', loc: 'A04004', title: 'MINIRACK #3 (Control Loading System)', act: 'CLN' },
                    { no: '91', loc: 'A04005', title: 'Digital Audio & Communications System (MINIRACK #2)', act: 'CLN' },
                    { no: '92', loc: 'A04004', title: 'Real Time IO System (MINIRACK #1)', act: 'CLN' },
                    { no: '93', loc: 'A06002', title: 'ENTRANCE DOOR', act: 'LUB' },
                    { isSep: true },
                    { no: '95', loc: 'A04005', title: 'MINIRACK #3 (Control Loading System)', act: 'CHECK' },
                    { no: '96', loc: 'A05003', title: 'COCKPIT STRUCTURE', act: 'VIS INSP' }
                ];
            } else {
                items = [
                    { no: '97', loc: 'B01009', title: 'PROCESS RACK#1 TEMP. PROBE.', act: 'CHECK' },
                    { no: '98', loc: 'B02010', title: 'VISUAL RACK#1 TEMP. PROBE.', act: 'CHECK' },
                    { no: '99', loc: 'B03007', title: 'VISUAL RACK#2 TEMP. PROBE.', act: 'CHECK' },
                    { no: '100', loc: 'B04007', title: 'DBF RACK#1 TEMP. PROBE.', act: 'CHECK' },
                    { no: '101', loc: 'A04005', title: 'Digital Audio & Communications System (MINIRACK #2)', act: 'CHECK' },
                    { no: '102', loc: 'A01005', title: 'AFTER CABIN SMOKE DETECTOR.', act: 'CHECK' },
                    { no: '103', loc: 'A02006', title: 'UP PROJECTORES SMOKE DETECTOR', act: 'CHECK' },
                    { no: '104', loc: 'A03008', title: 'DOWN PROJECTORS SMOKE DETECTORS', act: 'CHECK' },
                    { no: '105', loc: 'A03009', title: 'DOWN PROJECTORS TEMP. PROBE.', act: 'CHECK' },
                    { no: '106', loc: 'A04004x', title: 'MINIRACK #1 SMOKE DETECTOR.', act: 'CHECK' },
                    { no: '107', loc: 'A04005x', title: 'MINIRACK #2 SMOKE DETECTOR.', act: 'CHECK' },
                    { no: '108', loc: 'A04006x', title: 'MINIRACK #3 SMOKE DETECTOR.', act: 'CHECK' },
                    { no: '109', loc: 'B01010', title: 'PROCESS RACK#1 SMOKE DETECTOR.', act: 'CHECK' },
                    { no: '110', loc: 'B02011', title: 'VISUAL RACK#1 SMOKE DETECTOR', act: 'CHECK' },
                    { no: '111', loc: 'B03008', title: 'VISUAL RACK#2 SMOKE DETECTOR.', act: 'CHECK' },
                    { no: '112', loc: 'B04008', title: 'DBF RACK#1 SMOKE DETECTOR.', act: 'CHECK' },
                    { no: '113', loc: 'A01003', title: 'INTERLOCKS (After Cabin)', act: 'CHECK' },
                    { no: '114', loc: 'A04008', title: 'INTERLOCK (Spacer)', act: 'CHECK' },
                    { no: '115', loc: 'A06004', title: 'INTERLOCK(OUT SIM)', act: 'CHECK' },
                    { no: '116', loc: 'A02007', title: 'UP PROJECTORS TEMPERATURE PROBE.', act: 'CHECK' },
                    { no: '117', loc: 'A04004', title: 'Real Time IO System TEMP PROBE (MINIRACK #1)', act: 'CHECK' },
                    { no: '118', loc: 'A03010', title: 'VIBRATION PLATFORM ASSEMBLY', act: 'VIS INSP' },
                    { no: '182', loc: '', title: 'Joints (Upper/lower Actuators)', act: 'Lub' },
                    { no: '183', loc: '', title: 'Electric actuators(#1-#6)', act: 'Lub' }
                ];
            }

            target.innerHTML = `
                <div class="sheet-a4-wrapper">
                    <div class="sheet-a4-body">
                        ${this.renderCommonHeader(systemText, pageCode)}

                        <table class="paper-table" style="border: none; width: 100%;">
                            <thead>
                                <tr>
                                    <th class="paper-grey-hdr" style="width: 35px; text-align: center;">No.</th>
                                    <th class="paper-grey-hdr" style="width: 55px; text-align: center;">LOC</th>
                                    <th class="paper-grey-hdr" style="text-align: left; padding-left: 8px;">TITLE</th>
                                    <th class="paper-grey-hdr" style="width: 65px; text-align: center;">ACTION</th>
                                    <th class="paper-grey-hdr" style="width: 55px; text-align: center;">CHECK</th>
                                    <th class="paper-grey-hdr" style="width: 70px; text-align: center;">REMARK</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(function (it) {
                                    if (it.isSep) {
                                        return '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';
                                    }
                                    return '<tr>' +
                                        '<td style="text-align: center;">' + it.no + '</td><td style="text-align: center;">' + it.loc + '</td><td>' + it.title + '</td><td style="text-align: center;">' + it.act + '</td>' +
                                        '<td class="paper-check-cell" onclick="window.simMaintenanceApp.togglePaperCheck(this)" style="text-align: center; cursor: pointer;"><span class="paper-check-green" style="display: none;">✓</span></td>' +
                                        '<td></td>' +
                                    '</tr>';
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Spacer block that stretches across remaining A4 page to push footer to the bottom -->
                    <div class="sheet-a4-spacer"></div>

                    ${this.renderCommonFooter({ mh: '0.5' })}
                </div>
            `;
        }

        renderTestFlightSheet(target) {
            var dateVal = this.getISODate(this.telemetryData && this.telemetryData.date);

            target.innerHTML = `
                <div class="sheet-a4-wrapper" style="padding: 20px;">
                    <div class="sheet-a4-body">
                        <div style="text-align: center; margin-bottom: 24px; padding-top: 5px;">
                            <h2 style="font-size: 20px; font-weight: bold; margin: 0; cursor: pointer;" onclick="window.simMaintenanceApp.toggleAllChecks()" title="Click to toggle all checkmarks">
                                模擬飛行装置 (Test Flight) 点検表
                            </h2>
                        </div>

                        <table style="width: 100%; font-size: 13px; line-height: 2.2; border-collapse: separate; border-spacing: 0 8px;">
                            <tr>
                                <td style="width: 35%; font-weight: bold;">1　登録記号</td>
                                <td>EC135FFS SN001</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold;">2　模擬飛行装置</td>
                                <td>型式 インドラ式EC135型</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold;">3　点検実施日</td>
                                <td><input type="date" class="paper-input" id="paper-worked-date" value="${dateVal}" style="width: 140px; font-weight: bold; font-size: 12px;"></td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold;">4　実施場所</td>
                                <td>エアバス・ヘリコプターズ・ジャパン</td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold; vertical-align: top;">5　機長名 (署名)</td>
                                <td>
                                    <div style="font-size: 12px; margin-bottom: 4px;">機長名: <input type="text" class="paper-input" id="sf-captain-name" value="" placeholder="Nom du commandant de bord" style="width: 220px; font-weight: bold; font-size: 13px;"></div>
                                    <div style="position: relative; width: 280px;">
                                        <canvas id="paper-sig-canvas" class="paper-sig-box" width="280" height="105" style="border: 1px dashed #cbd5e1; width: 280px; height: 105px; cursor: crosshair; background: #ffffff; touch-action: none;"></canvas>
                                        <button type="button" id="paper-clear-sig-btn" style="position: absolute; right: 4px; bottom: 4px; font-size: 9px; padding: 1px 4px; cursor: pointer; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px;">クリア</button>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold;">6　同乗者名</td>
                                <td><input type="text" class="paper-input" id="sf-copilot" value="${this.selectedTechnician || 'SHEKH V. LECOQ'}" style="width: 260px; font-size: 13px; font-weight: bold;"></td>
                            </tr>
                            <tr>
                                <td style="font-weight: bold; vertical-align: top;">7　所見等</td>
                                <td><textarea class="paper-input" id="paper-remarks" style="width: 100%; max-width: 400px; height: 60px; resize: vertical; font-size: 13px;" placeholder="所見等 / Observations..."></textarea></td>
                            </tr>
                        </table>
                    </div>

                    <!-- Spacer block that stretches across remaining A4 page to push footer to the bottom -->
                    <div class="sheet-a4-spacer"></div>

                    <div style="margin-top: 25px; font-size: 12px; color: #333; border-top: 1px solid #ddd; padding-top: 8px;">
                        ＊注意　搭乗人員は必要最小数とすること。
                    </div>
                </div>
            `;
        }

        async loadTelemetry() {
            var tStart = performance.now();
            try {
                var res = await fetch(this.getApiUrl('get_telemetry'));
                var data = await res.json();
                var tEnd = performance.now();
                console.log('[Telemetry fetch]', data);
                if (data && (data.success || data.is_live || data.flight)) {
                    this.subsystemsPacketCount++;
                    this.telemetryData.temperature = (data.temperature !== undefined) ? data.temperature : 21.4;
                    this.telemetryData.humidity = (data.humidity !== undefined) ? data.humidity : 48.5;
                    this.telemetryData.time = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    this.telemetryData.date = new Date().toISOString().split('T')[0];
                    this.telemetryData.isoDate = this.telemetryData.date;

                    // Stream Toolbar Metrics
                    var pktEl = this.container.querySelector('#subsys-pkt-count');
                    var latEl = this.container.querySelector('#subsys-latency-val');
                    if (pktEl) pktEl.textContent = '#' + this.subsystemsPacketCount.toLocaleString('en-US');
                    if (latEl) latEl.textContent = this.lastFrameLatencyMs + ' ms';

                    // Climate View Hero
                    var tempBig = this.container.querySelector('#maint-temp-val-big');
                    var humBig  = this.container.querySelector('#maint-hum-val-big');
                    if (tempBig) tempBig.textContent = data.temperature.toFixed(1);
                    if (humBig)  humBig.textContent  = data.humidity.toFixed(1);

                    var tempFill = this.container.querySelector('#tel-temp-bar-fill');
                    var humFill  = this.container.querySelector('#tel-hum-bar-fill');
                    if (tempFill) {
                        var tPct = Math.max(5, Math.min(100, ((data.temperature - 14) / (28 - 14)) * 100));
                        tempFill.style.width = tPct + '%';
                    }
                    if (humFill) {
                        var hPct = Math.max(5, Math.min(100, ((data.humidity - 20) / (100 - 20)) * 100));
                        humFill.style.width = hPct + '%';
                    }

                    var tempStatusText = this.container.querySelector('#maint-temp-status-text');
                    var humStatusText  = this.container.querySelector('#maint-hum-status-text');
                    if (tempStatusText) tempStatusText.textContent = data.temp_status.toUpperCase();
                    if (humStatusText) humStatusText.textContent = data.hum_status.toUpperCase();

                    var tempPill = this.container.querySelector('#maint-temp-pill');
                    var humPill  = this.container.querySelector('#maint-hum-pill');
                    if (tempPill) tempPill.className = 'tel-live-pill status-' + data.temp_status;
                    if (humPill) humPill.className = 'tel-live-pill status-' + data.hum_status;

                    var self = this;
                    var root = (self && self.container) ? self.container : (this && this.container ? this.container : document);

                    console.log('[Indra Telemetry] Raw packet received:', data);

                    // 1. Host & Stream Status
                    var isLive = (data.is_live === true);
                    var streamDot = root.querySelector('#subsys-stream-dot');
                    var hostIpEl = root.querySelector('#tel-host-ip');
                    if (hostIpEl) {
                        if (data.debug) {
                            if (isLive) {
                                hostIpEl.textContent = (data.host?.ip || '172.120.1.7:3033') + ' [LIVE ' + (data.debug.bytes_received || 88) + 'B from ' + (data.debug.peer_sender || 'HOST') + ']';
                            } else {
                                hostIpEl.textContent = (data.host?.ip || '172.120.1.7:3033') + ' [' + (data.debug.bind_status || 'WAITING') + ' • 0 bytes]';
                            }
                        } else if (data.host && data.host.ip) {
                            hostIpEl.textContent = data.host.ip;
                        }
                    }
                    if (streamDot) {
                        streamDot.className = 'stream-pulse-dot ' + (isLive ? 'active' : 'idle');
                    }

                    // 2. Hydrate Flight Parameters & Cockpit 4-Pack Gauges (st_OUT)
                    if (data.flight) {
                        var f = data.flight;
                        var hasLiveFlight = (isLive && f.altitude !== null && f.altitude !== undefined);

                        var spdVal = (f.airspeed_ias !== null && f.airspeed_ias !== undefined) ? f.airspeed_ias.toFixed(1) : '--';
                        var altVal = (f.altitude !== null && f.altitude !== undefined) ? Math.round(f.altitude) : '--';
                        var pitchVal = (f.pitch !== null && f.pitch !== undefined) ? ((f.pitch >= 0 ? '+' : '') + f.pitch.toFixed(1) + '°') : '--°';
                        var rollVal = (f.roll !== null && f.roll !== undefined) ? ((f.roll >= 0 ? '+' : '') + f.roll.toFixed(1) + '°') : '--°';
                        var hdgVal = (f.heading_mag !== null && f.heading_mag !== undefined) ? f.heading_mag.toFixed(1) : '--';

                        var spdEl = root.querySelector('#tel-flight-spd');
                        var spdGaugeEl = root.querySelector('#tel-gauge-spd-val');
                        var altEl = root.querySelector('#tel-flight-alt');
                        var altNumEl = root.querySelector('#tel-flight-alt-num');
                        var altDrum = root.querySelector('#gauge-alt-drum');
                        var pitchEl = root.querySelector('#tel-flight-pitch');
                        var pitchGaugeEl = root.querySelector('#tel-gauge-pitch-val');
                        var rollEl = root.querySelector('#tel-flight-roll');
                        var rollGaugeEl = root.querySelector('#tel-gauge-roll-val');
                        var hdgEl = root.querySelector('#tel-flight-hdg');
                        var hdgCardEl = root.querySelector('#tel-flight-hdg-cardinal');
                        var phaseBadge = root.querySelector('#tel-flight-phase-badge');
                        var phaseTxt = root.querySelector('#tel-flight-phase-txt');

                        if (spdEl) spdEl.textContent = spdVal;
                        if (spdGaugeEl) spdGaugeEl.textContent = spdVal;
                        if (altEl) altEl.textContent = altVal;
                        if (altNumEl) altNumEl.textContent = altVal;

                        // Altimeter Mechanical Drum Digits & Barber-pole Flag
                        var altDrumDigits = root.querySelector('#gauge-alt-drum-digits');
                        var altDrumFlag = root.querySelector('#alt-drum-flag');
                        if (altDrumDigits) {
                            if (f.altitude !== null && f.altitude !== undefined) {
                                var absAlt = Math.max(0, Math.round(f.altitude));
                                altDrumDigits.textContent = absAlt.toString().padStart(4, '0');
                                if (altDrumFlag) {
                                    altDrumFlag.style.display = (absAlt < 10000) ? 'block' : 'none';
                                }
                            } else {
                                altDrumDigits.textContent = '0000';
                            }
                        }

                        if (pitchEl) pitchEl.textContent = (f.pitch !== null && f.pitch !== undefined) ? f.pitch.toFixed(1) : '--';
                        if (pitchGaugeEl) pitchGaugeEl.textContent = pitchVal;
                        if (rollEl) rollEl.textContent = rollVal;
                        if (rollGaugeEl) rollGaugeEl.textContent = rollVal;
                        if (hdgEl) hdgEl.textContent = hdgVal;

                        if (hdgCardEl) {
                            if (f.heading_mag !== null && f.heading_mag !== undefined) {
                                var cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
                                var idx = Math.round(f.heading_mag / 22.5) % 16;
                                hdgCardEl.textContent = (cardinals[idx] || 'HDG') + ' (' + f.heading_mag.toFixed(0) + '°)';
                            } else {
                                hdgCardEl.textContent = '--';
                            }
                        }

                        if (phaseBadge) {
                            phaseBadge.textContent = f.flight_phase || 'DISCONNECTED';
                            phaseBadge.style.background = isLive ? '#0284c7' : '#475569';
                        }
                        if (phaseTxt) phaseTxt.textContent = f.flight_phase || 'DISCONNECTED';

                        // 1. Animate ASI Needle (Non-linear aircraft scale)
                        var asiNeedle = root.querySelector('#gauge-needle-asi');
                        if (asiNeedle) {
                            if (f.airspeed_ias !== null && f.airspeed_ias !== undefined) {
                                var sp = Math.max(0, Math.min(200, f.airspeed_ias));
                                var asiDeg = (sp <= 20) ? (sp * 1.9) : (38 + (sp - 20) * (312.0 / 160.0));
                                asiNeedle.style.transform = 'rotate(' + asiDeg.toFixed(1) + 'deg)';
                            } else {
                                asiNeedle.style.transform = 'rotate(0deg)';
                            }
                        }

                        // 2. Animate ADI Horizon Sphere (Pitch translation + Roll rotation)
                        var adiSphere = root.querySelector('#gauge-adi-sphere');
                        if (adiSphere) {
                            if (f.pitch !== null && f.pitch !== undefined && f.roll !== null && f.roll !== undefined) {
                                var pitchOffsetPx = Math.max(-42, Math.min(42, f.pitch * 2.1));
                                adiSphere.style.transform = 'translateY(' + (pitchOffsetPx.toFixed(1)) + 'px) rotate(' + (-f.roll.toFixed(1)) + 'deg)';
                            } else {
                                adiSphere.style.transform = 'translateY(0px) rotate(0deg)';
                            }
                        }

                        // 3. Animate Altimeter Needle (360° per 1000 ft)
                        var altNeedle = root.querySelector('#gauge-needle-alt');
                        if (altNeedle) {
                            if (hasLiveFlight) {
                                var hundredsDeg = ((f.altitude % 1000) / 1000.0) * 360.0;
                                altNeedle.style.transform = 'rotate(' + hundredsDeg.toFixed(1) + 'deg)';
                            } else {
                                altNeedle.style.transform = 'rotate(0deg)';
                            }
                        }
                    }

                    // 3. Hydrate Powerplant (Triple Coaxial Tachometer: Rotor R, Engine 1, Engine 2)
                    if (data.powerplant) {
                        var pwr = data.powerplant;
                        var nrTxt = (pwr.rotor_nr !== null && pwr.rotor_nr !== undefined) ? pwr.rotor_nr.toFixed(1) : '--';
                        var rpmTxt = (pwr.rotor_rpm !== null && pwr.rotor_rpm !== undefined) ? (pwr.rotor_rpm + ' RPM') : '-- RPM';
                        var n2Eng1Txt = (pwr.n2_eng1 !== null && pwr.n2_eng1 !== undefined) ? pwr.n2_eng1.toFixed(1) : '--';
                        var n2Eng2Txt = (pwr.n2_eng2 !== null && pwr.n2_eng2 !== undefined) ? pwr.n2_eng2.toFixed(1) : '--';

                        var rotorEl = root.querySelector('#tel-flight-rotor');
                        var rpmEl = root.querySelector('#tel-flight-rpm');
                        var rotorValEl = root.querySelector('#tel-gauge-rotor-val');
                        var n2Eng1El = root.querySelector('#tel-flight-n2-eng1');
                        var n2Eng2El = root.querySelector('#tel-flight-n2-eng2');
                        var n2Gauge1El = root.querySelector('#tel-gauge-n2-eng1-val');
                        var n2Gauge2El = root.querySelector('#tel-gauge-n2-eng2-val');

                        if (rotorEl) rotorEl.textContent = nrTxt;
                        if (rpmEl) rpmEl.textContent = rpmTxt;
                        if (rotorValEl) rotorValEl.textContent = nrTxt;
                        if (n2Eng1El) n2Eng1El.textContent = n2Eng1Txt;
                        if (n2Eng2El) n2Eng2El.textContent = n2Eng2Txt;
                        if (n2Gauge1El) n2Gauge1El.textContent = n2Eng1Txt;
                        if (n2Gauge2El) n2Gauge2El.textContent = n2Eng2Txt;

                        // Calculation function for Tachometer Needle Angle (-190° at 50% to +140° at 120%)
                        var calcTachoDeg = function(val) {
                            if (val === null || val === undefined || isNaN(val)) return -190;
                            var clamped = Math.max(0, Math.min(130, val));
                            if (clamped < 50.0) {
                                return -190 - (50.0 - clamped) * 1.5;
                            } else {
                                return -190 + ((clamped - 50.0) / 70.0) * 190.0;
                            }
                        };

                        // Animate Rotor (R) Needle
                        var rotorNeedle = root.querySelector('#gauge-needle-rotor');
                        if (rotorNeedle) {
                            var rDeg = calcTachoDeg(pwr.rotor_nr);
                            rotorNeedle.style.transform = 'rotate(' + rDeg.toFixed(1) + 'deg)';
                        }

                        // Animate Engine 1 (1) Needle
                        var n2Eng1Needle = root.querySelector('#gauge-needle-n2-1');
                        if (n2Eng1Needle) {
                            var e1Deg = calcTachoDeg(pwr.n2_eng1);
                            n2Eng1Needle.style.transform = 'rotate(' + e1Deg.toFixed(1) + 'deg)';
                        }

                        // Animate Engine 2 (2) Needle
                        var n2Eng2Needle = root.querySelector('#gauge-needle-n2-2');
                        if (n2Eng2Needle) {
                            var e2Deg = calcTachoDeg(pwr.n2_eng2);
                            n2Eng2Needle.style.transform = 'rotate(' + e2Deg.toFixed(1) + 'deg)';
                        }
                    }

                    // 4. Hydrate CWP Annunciator Panel (18 Annunciators st_cwp_H2I)
                    if (data.cwp) {
                        var cwp = data.cwp;
                        var setCwpState = function(id, isActive) {
                            var el = root.querySelector('#' + id);
                            if (el) {
                                el.classList.toggle('active', !!isActive);
                            }
                        };

                        // Guarded Fire Pushbuttons
                        setCwpState('cwp-fire1', cwp.fire1);
                        setCwpState('cwp-fire2', cwp.fire2);

                        // Emergency Off Active Indicators (Green)
                        setCwpState('cwp-emerg-off1-active', cwp.emerg_off1);
                        setCwpState('cwp-emerg-off2-active', cwp.emerg_off2);

                        // Center 2x5 Matrix Tiles
                        setCwpState('cwp-low-fuel1', cwp.low_fuel1);
                        setCwpState('cwp-active-warn1', cwp.active_warn1 || cwp.spare_warn1);
                        setCwpState('cwp-rotor-rpm-warn', cwp.rotor_rpm_warn);
                        setCwpState('cwp-active-warn2', cwp.active_warn2 || cwp.spare_warn2);
                        setCwpState('cwp-low-fuel2', cwp.low_fuel2);

                        setCwpState('cwp-bat-temp-warn', cwp.bat_temp_warn);
                        setCwpState('cwp-bat-disch-warn', cwp.bat_disch_warn);
                        setCwpState('cwp-xmsn-oil-p-warn', cwp.xmsn_oil_p_warn);
                        setCwpState('cwp-ap-trim-warn', cwp.ap_trim_warn);
                        setCwpState('cwp-cargo-smoke1', cwp.cargo_smoke1);

                        // Separate Right Pushbuttons (High Nr & Master Caution)
                        setCwpState('cwp-high-nr-cata', cwp.high_nr_cata);
                        setCwpState('cwp-master-caution', cwp.master_caution);

                        var hasAnyAlarm = cwp.master_warning || cwp.master_caution || cwp.fire1 || cwp.fire2 || cwp.emerg_off1 || cwp.emerg_off2 || cwp.xmsn_oil_p_warn || cwp.low_fuel1 || cwp.low_fuel2 || cwp.rotor_rpm_warn;
                        var cwpBadge = root.querySelector('#tel-cwp-status-badge');
                        if (cwpBadge) {
                            if (!isLive) {
                                cwpBadge.textContent = 'STANDBY';
                                cwpBadge.style.background = '#0f172a';
                                cwpBadge.style.color = '#94a3b8';
                            } else if (hasAnyAlarm) {
                                cwpBadge.textContent = cwp.master_warning ? 'MASTER WARNING' : 'CAUTION ACTIVE';
                                cwpBadge.style.background = cwp.master_warning ? '#ef4444' : '#f59e0b';
                                cwpBadge.style.color = '#fff';
                            } else {
                                cwpBadge.textContent = 'ALL CLEAR';
                                cwpBadge.style.background = '#10b981';
                                cwpBadge.style.color = '#fff';
                            }
                        }
                    }

                    // 5. Hydrate Autopilot Console (APC)
                    if (data.autopilot) {
                        var apc = data.autopilot;
                        var setApcBtn = function(id, isActive, isAmber) {
                            var el = root.querySelector('#' + id);
                            if (el) {
                                el.classList.toggle(isAmber ? 'active-amber' : 'active-green', !!isActive);
                            }
                        };
                        setApcBtn('apc-ap-off', apc.ap_off, true);
                        setApcBtn('apc-trim-off', apc.trim_off, true);
                        setApcBtn('apc-test-on', apc.test_on, false);
                        setApcBtn('apc-vs-on', apc.vs_on, false);
                        setApcBtn('apc-ias', apc.ias, false);
                        setApcBtn('apc-alt', apc.alt, false);
                        setApcBtn('apc-hdg', apc.hdg, false);
                        setApcBtn('apc-nav-a', apc.nav_a, false);
                        setApcBtn('apc-nav-c', apc.nav_c, true);
                        setApcBtn('apc-app-a', apc.app_a, false);
                        setApcBtn('apc-app-c', apc.app_c, true);
                        setApcBtn('apc-alt-a', apc.alt_a, false);
                        setApcBtn('apc-bc-a', apc.bc_a, false);
                        setApcBtn('apc-bc-c', apc.bc_c, true);
                        setApcBtn('apc-gs-a', apc.gs_a, false);
                        setApcBtn('apc-gs-c', apc.gs_c, true);

                        var apcBadge = root.querySelector('#tel-apc-badge');
                        if (apcBadge) {
                            if (!isLive) {
                                apcBadge.textContent = 'STANDBY';
                                apcBadge.style.background = '#0f172a';
                                apcBadge.style.color = '#94a3b8';
                            } else if (apc.ap_off) {
                                apcBadge.textContent = 'AP OFF';
                                apcBadge.style.background = '#e11d48';
                                apcBadge.style.color = '#fff';
                            } else {
                                apcBadge.textContent = 'AP ENGAGED';
                                apcBadge.style.background = '#10b981';
                                apcBadge.style.color = '#fff';
                            }
                        }
                    }

                    // 6. Hydrate Radionavigation & Marker Beacons
                    if (data.radionav) {
                        var rn = data.radionav;
                        var setLampBtn = function(id, isActive, activeClass) {
                            var el = root.querySelector('#' + id);
                            if (el) {
                                el.classList.toggle(activeClass || 'active-green', !!isActive);
                            }
                        };
                        if (rn.dme) {
                            setLampBtn('dme-dme1', rn.dme.dme1);
                            setLampBtn('dme-dme2', rn.dme.dme2);
                            setLampBtn('dme-hold1', rn.dme.dme1_hold, 'active-amber');
                            setLampBtn('dme-hold2', rn.dme.dme2_hold, 'active-amber');
                            setLampBtn('dme-gnd1', rn.dme.gnd1);
                            setLampBtn('dme-gnd2', rn.dme.gnd2);
                            setLampBtn('dme-call', rn.dme.call, 'active-amber');
                            setLampBtn('dme-high-nr', rn.dme.high_nr);
                        }
                        if (rn.gps) {
                            setLampBtn('gps-msg', rn.gps.msg, 'active-amber');
                            setLampBtn('gps-wpt', rn.gps.wpt);
                            setLampBtn('gps-term', rn.gps.term);
                            setLampBtn('gps-apr', rn.gps.apr);
                            setLampBtn('gps-intg', rn.gps.intg, 'active-amber');
                            setLampBtn('gps-obs', rn.gps.obs);

                            var gpsBadge = root.querySelector('#gps-coords-badge');
                            if (gpsBadge) {
                                if (rn.gps.latitude || rn.gps.longitude) {
                                    gpsBadge.textContent = 'GPS: ' + rn.gps.latitude.toFixed(4) + '°, ' + rn.gps.longitude.toFixed(4) + '°';
                                    gpsBadge.style.color = '#38bdf8';
                                } else {
                                    gpsBadge.textContent = 'GPS: STANDBY';
                                    gpsBadge.style.color = '#94a3b8';
                                }
                            }

                            var adEl = root.querySelector('#gps-airdata-txt');
                            if (adEl && rn.gps.airdata) {
                                var ad = rn.gps.airdata;
                                var windTxt = (ad.wind_speed > 0 || ad.wind_dir > 0) ? (ad.wind_dir + '°/' + ad.wind_speed + 'kt') : 'CALM';
                                var oatTxt = (ad.oat !== 0) ? ((ad.oat > 0 ? '+' : '') + ad.oat.toFixed(0) + '°C') : '--°C';
                                var tasTxt = (ad.tas > 0) ? (ad.tas.toFixed(0) + ' kts') : '--';
                                adEl.textContent = 'OAT: ' + oatTxt + ' • WND: ' + windTxt + ' • TAS: ' + tasTxt;
                            }

                            var ffEl = root.querySelector('#gps-fuelflow-txt');
                            if (ffEl && rn.gps.fuel) {
                                var ff = rn.gps.fuel;
                                ffEl.textContent = 'E1: ' + (ff.flow_eng1 > 0 ? ff.flow_eng1.toFixed(0) + ' kg/h' : '--') + ' • E2: ' + (ff.flow_eng2 > 0 ? ff.flow_eng2.toFixed(0) + ' kg/h' : '--');
                            }
                        }
                        if (rn.mbr) {
                            setLampBtn('mbr-airway', rn.mbr.airway_a, 'active-cyan');
                            setLampBtn('mbr-outer', rn.mbr.outer_o, 'active-cyan');
                            setLampBtn('mbr-middle', rn.mbr.middle_m, 'active-amber');
                        }
                    }

                    // 7. Hydrate Audio Selector Panels (ICS)
                    if (data.audio_comms) {
                        var setAudioBtn = function(id, isActive) {
                            var el = root.querySelector('#' + id);
                            if (el) el.classList.toggle('active-green', !!isActive);
                        };
                        if (data.audio_comms.pilot) {
                            var p = data.audio_comms.pilot;
                            setAudioBtn('audio-plt-vhf1', p.vhf1);
                            setAudioBtn('audio-plt-vhf2', p.vhf2);
                            setAudioBtn('audio-plt-nav1', p.nav1);
                            setAudioBtn('audio-plt-nav2', p.nav2);
                            setAudioBtn('audio-plt-dme1', p.dme1);
                            setAudioBtn('audio-plt-dme2', p.dme2);
                            setAudioBtn('audio-plt-mkr', p.mkr);
                            setAudioBtn('audio-plt-atc', p.atc);
                            setAudioBtn('audio-plt-emer', p.emer);
                        }
                        if (data.audio_comms.copilot) {
                            var cp = data.audio_comms.copilot;
                            setAudioBtn('audio-cplt-vhf1', cp.vhf1);
                            setAudioBtn('audio-cplt-vhf2', cp.vhf2);
                            setAudioBtn('audio-cplt-nav1', cp.nav1);
                            setAudioBtn('audio-cplt-nav2', cp.nav2);
                            setAudioBtn('audio-cplt-dme1', cp.dme1);
                            setAudioBtn('audio-cplt-dme2', cp.dme2);
                            setAudioBtn('audio-cplt-mkr', cp.mkr);
                            setAudioBtn('audio-cplt-atc', cp.atc);
                            setAudioBtn('audio-cplt-emer', cp.emer);
                        }
                    }

                    // 8. Hydrate Displays & Lighting Metrics
                    if (data.displays) {
                        var d = data.displays;
                        var cadBar = root.querySelector('#cad-brt-bar');
                        var cadTxt = root.querySelector('#cad-brt-txt');
                        if (cadBar) cadBar.style.width = Math.max(0, Math.min(100, d.cad_brt)) + '%';
                        if (cadTxt) cadTxt.textContent = d.cad_brt.toFixed(0) + '% ' + (d.cad_on ? '[ON]' : '[OFF]');

                        var vemdBar = root.querySelector('#vemd-brt-bar');
                        var vemdTxt = root.querySelector('#vemd-brt-txt');
                        if (vemdBar) vemdBar.style.width = Math.max(0, Math.min(100, d.vemd_brt)) + '%';
                        if (vemdTxt) vemdTxt.textContent = d.vemd_brt.toFixed(0) + '% ' + ((d.vemd1_on && d.vemd2_on) ? '[DUAL ON]' : (d.vemd1_on ? '[VEMD 1]' : '[OFF]'));

                        var euroBar = root.querySelector('#euronav-crt-bar');
                        var euroTxt = root.querySelector('#euronav-crt-txt');
                        if (euroBar) euroBar.style.width = Math.max(0, Math.min(100, d.euronav_contrast)) + '%';
                        if (euroTxt) euroTxt.textContent = d.euronav_contrast.toFixed(0) + '%';

                        var pfdBar = root.querySelector('#pfd-crt-bar');
                        var pfdTxt = root.querySelector('#pfd-crt-txt');
                        if (pfdBar) pfdBar.style.width = Math.max(0, Math.min(100, d.pfd_crt)) + '%';
                        if (pfdTxt) pfdTxt.textContent = 'PFD: ' + d.pfd_crt.toFixed(0) + '% • ND: ' + d.nd_crt.toFixed(0) + '%';
                    }

                    if (data.lighting) {
                        var l = data.lighting;
                        var modeBadge = root.querySelector('#disp-lighting-mode-badge');
                        if (modeBadge) {
                            modeBadge.textContent = 'MODE: ' + (l.mode || 'DAY');
                            modeBadge.style.background = (l.mode === 'NVG') ? '#065f46' : (l.mode === 'NIGHT' ? '#1e1b4b' : '#0f172a');
                            modeBadge.style.color = '#fff';
                        }
                        var instBar = root.querySelector('#light-inst-bar');
                        var instTxt = root.querySelector('#light-inst-txt');
                        if (instBar) instBar.style.width = Math.max(0, Math.min(100, l.instruments_pct)) + '%';
                        if (instTxt) instTxt.textContent = l.instruments_pct.toFixed(0) + '%';

                        var stbyBar = root.querySelector('#light-stby-bar');
                        var stbyTxt = root.querySelector('#light-stby-txt');
                        if (stbyBar) stbyBar.style.width = Math.max(0, Math.min(100, l.stby_hor_pct)) + '%';
                        if (stbyTxt) stbyTxt.textContent = l.stby_hor_pct.toFixed(0) + '%';

                        var setLightBtn = function(id, isOn) {
                            var el = root.querySelector('#' + id);
                            if (el) el.classList.toggle('active-green', !!isOn);
                        };
                        setLightBtn('light-cockpit', l.cockpit_light);
                        setLightBtn('light-map', l.map_holder);
                        setLightBtn('light-bg', l.bg_light);
                    }

                    // 9. Hydrate Power Supply & Sim Platform Status
                    if (data.power_supply) {
                        var ps = data.power_supply;
                        var setPwrBtn = function(id, isOn) {
                            var el = root.querySelector('#' + id);
                            if (el) el.classList.toggle('active-green', !!isOn);
                        };
                        setPwrBtn('pwr-euronav', ps.euronav);
                        setPwrBtn('pwr-cad', ps.cad);
                        setPwrBtn('pwr-vemd', ps.vemd);
                        setPwrBtn('pwr-fcds', ps.plt_fcds);
                        setPwrBtn('pwr-xpdr', ps.transponder);
                        setPwrBtn('pwr-wp', ps.wp);
                        setPwrBtn('pwr-ics-plt', ps.ics_plt);
                        setPwrBtn('pwr-ics-cplt', ps.ics_cplt);
                    }

                    if (data.sim_status) {
                        var ss = data.sim_status;
                        var setSimBtn = function(id, isOn, isAmber) {
                            var el = root.querySelector('#' + id);
                            if (el) el.classList.toggle(isAmber ? 'active-amber' : 'active-green', !!isOn);
                        };
                        setSimBtn('sim-session-init', ss.session_init);
                        setSimBtn('sim-oper', ss.sim_oper);
                        setSimBtn('sim-stop', ss.sim_stop, true);
                        setSimBtn('sim-motion-ready', ss.motion_ready);
                        setSimBtn('sim-motion-on', ss.motion_on);
                        setSimBtn('elt-test-btn', ss.elt_test, true);

                        var cyclesBadge = root.querySelector('#host-cycles-badge');
                        if (cyclesBadge && ss.cycles !== undefined) {
                            cyclesBadge.textContent = 'CYCLES: ' + ss.cycles.toLocaleString('en-US');
                        }
                    }
                }
            } catch (err) {
                console.error("Telemetry load error", err);
            }
        }

        async loadTelemetryHistory() {
            var offsetIndicator = this.container.querySelector('#tel-offset-indicator');
            if (offsetIndicator) {
                offsetIndicator.textContent = (this.telOffset > 0) ? '[-' + (this.telOffset / 60).toFixed(1) + 'h in past]' : '[LIVE / NOW]';
            }

            try {
                var url = this.getApiUrl('get_telemetry_history', {
                    count: this.telCount,
                    offset: this.telOffset,
                    linearize: this.telLinearize,
                    linlen: this.telLinlen
                });

                var res = await fetch(url);
                var data = await res.json();
                if (data && data.success) {
                    // Update Stats
                    if (data.stats) {
                        var statTemp = this.container.querySelector('#tel-stat-1y-temp');
                        var statHum  = this.container.querySelector('#tel-stat-1y-hum');
                        if (statTemp) statTemp.textContent = data.stats.avg_1y_temp;
                        if (statHum)  statHum.textContent  = data.stats.avg_1y_hum;
                    }

                    // Update Cherrypick Table
                    if (data.cherrypick && data.cherrypick.length > 0) {
                        var tbody = this.container.querySelector('#tel-cherrypick-tbody');
                        if (tbody) {
                            tbody.innerHTML = data.cherrypick.map(function (cp) {
                                return '<tr>' +
                                    '<td>' + cp.hour + '</td>' +
                                    '<td>' + cp.humidity + ' %</td>' +
                                    '<td>' + cp.temperature + ' C</td>' +
                                '</tr>';
                            }).join('');
                        }
                    }

                    // Draw Dual Charts
                    if (data.points && data.points.length > 0) {
                        this.drawTemperatureChart(data.points, data.thresholds.temp);
                        this.drawHumidityChart(data.points, data.thresholds.hum);
                    }
                }
            } catch (err) {
                console.error("Chart history load error", err);
            }
        }

        isThemeLight() {
            var theme = document.body.getAttribute('data-theme') || (document.documentElement ? document.documentElement.getAttribute('data-theme') : '');
            if (theme && (theme.indexOf('light') !== -1 || theme.indexOf('retro') !== -1 || theme.indexOf('paper') !== -1)) return true;
            if (theme && (theme.indexOf('dark') !== -1 || theme.indexOf('cyber') !== -1 || theme.indexOf('midnight') !== -1)) return false;
            // Fallback to media query
            return window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        drawTemperatureChart(points, th, hoverIndex) {
            this.lastTempPoints = points;
            this.lastTempTh = th;
            var canvas = this.container.querySelector('#tel-temp-canvas');
            if (!canvas) return;
            var ctx = canvas.getContext('2d');
            var w = canvas.width;
            var h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            var isLight = this.isThemeLight();

            // Background canvas
            if (isLight) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
            } else {
                var bgGrad = ctx.createLinearGradient(0, 0, 0, h);
                bgGrad.addColorStop(0, '#090d16');
                bgGrad.addColorStop(1, '#0c1322');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, w, h);
            }

            var padL = 48, padR = 25, padT = 36, padB = 68;
            var plotW = w - padL - padR;
            var plotH = h - padT - padB;

            var yMin = 14, yMax = 28;
            var getY = function (val) {
                return padT + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
            };
            var getX = function (idx) {
                return padL + (idx / (points.length - 1)) * plotW;
            };

            // Optimum Safe Zone Soft Band (18°C ~ 24°C)
            var optYTop = getY(th.opt_max);
            var optYBot = getY(th.opt_min);
            ctx.fillStyle = isLight ? 'rgba(22, 163, 74, 0.07)' : 'rgba(34, 197, 94, 0.06)';
            ctx.fillRect(padL, optYTop, plotW, optYBot - optYTop);

            // Horizontal Grid Lines & Y Axis Labels
            ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';

            for (var deg = yMin; deg <= yMax; deg += 2) {
                var yPos = getY(deg);
                ctx.beginPath();
                ctx.moveTo(padL, yPos);
                ctx.lineTo(w - padR, yPos);
                ctx.stroke();
                ctx.fillText(deg.toString() + '°C', padL - 8, yPos);
            }

            // Threshold Lines:
            // 1. Critical Max (27°C) - Red solid
            ctx.strokeStyle = isLight ? '#dc2626' : '#ef4444';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.crit_max));
            ctx.lineTo(w - padR, getY(th.crit_max));
            ctx.stroke();

            // 2. Critical Min (15°C) - Red solid
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.crit_min));
            ctx.lineTo(w - padR, getY(th.crit_min));
            ctx.stroke();

            // 3. Optimum Max (24°C) - Orange dashed
            ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.opt_max));
            ctx.lineTo(w - padR, getY(th.opt_max));
            ctx.stroke();

            // 4. Optimum Min (18°C) - Orange dashed
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.opt_min));
            ctx.lineTo(w - padR, getY(th.opt_min));
            ctx.stroke();
            ctx.setLineDash([]); // reset dash

            // 5. Area Fill Gradient under Curve
            var fillGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
            if (isLight) {
                fillGrad.addColorStop(0, 'rgba(22, 163, 74, 0.18)');
                fillGrad.addColorStop(1, 'rgba(22, 163, 74, 0.0)');
            } else {
                fillGrad.addColorStop(0, 'rgba(34, 197, 94, 0.28)');
                fillGrad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');
            }
            ctx.fillStyle = fillGrad;
            ctx.beginPath();
            ctx.moveTo(getX(0), getY(points[0].temp));
            for (var k = 1; k < points.length; k++) {
                ctx.lineTo(getX(k), getY(points[k].temp));
            }
            ctx.lineTo(getX(points.length - 1), padT + plotH);
            ctx.lineTo(getX(0), padT + plotH);
            ctx.closePath();
            ctx.fill();

            // 6. Temperature Data Curve
            ctx.strokeStyle = isLight ? '#16a34a' : '#22c55e';
            ctx.lineWidth = 2.6;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (var i = 0; i < points.length; i++) {
                var x = getX(i);
                var y = getY(points[i].temp);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // X Axis Labels (Angled 45 deg)
            ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            var stepX = Math.max(1, Math.floor(points.length / 20));
            for (var j = 0; j < points.length; j += stepX) {
                var xDate = getX(j);
                var dStr = points[j].date || '';
                ctx.save();
                ctx.translate(xDate, padT + plotH + 8);
                ctx.rotate(-Math.PI / 3.8);
                ctx.fillText(dStr, 0, 0);
                ctx.restore();
            }

            // Top Header Legend
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '10px -apple-system, sans-serif';

            var legX = padL + 6;
            // Optimum Min
            ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = isLight ? '#475569' : '#94a3b8'; ctx.fillText('Optimum Min (' + th.opt_min + '°C)', legX + 20, 16);
            legX += 165;

            // Optimum Max
            ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = isLight ? '#475569' : '#94a3b8'; ctx.fillText('Optimum Max (' + th.opt_max + '°C)', legX + 20, 16);
            legX += 165;

            // Temp Min Crit
            ctx.strokeStyle = isLight ? '#dc2626' : '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke();
            ctx.fillStyle = isLight ? '#dc2626' : '#f87171'; ctx.fillText('Min Limit (' + th.crit_min + '°C)', legX + 20, 16);
            legX += 140;

            // Temp Max Crit
            ctx.strokeStyle = isLight ? '#dc2626' : '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke();
            ctx.fillStyle = isLight ? '#dc2626' : '#f87171'; ctx.fillText('Max Limit (' + th.crit_max + '°C)', legX + 20, 16);
            legX += 140;

            // Live Temp Data
            ctx.strokeStyle = isLight ? '#16a34a' : '#22c55e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke();
            ctx.fillStyle = isLight ? '#15803d' : '#4ade80'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('Live Temperature', legX + 20, 16);

            // Hover Cursor & Tooltip
            if (typeof hoverIndex === 'number' && hoverIndex >= 0 && hoverIndex < points.length) {
                var p = points[hoverIndex];
                var hX = getX(hoverIndex);
                var hY = getY(p.temp);

                // Vertical Crosshair
                ctx.strokeStyle = isLight ? 'rgba(37, 99, 235, 0.6)' : 'rgba(56, 189, 248, 0.7)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(hX, padT);
                ctx.lineTo(hX, padT + plotH);
                ctx.stroke();
                ctx.setLineDash([]);

                // Glowing Active Dot
                ctx.fillStyle = isLight ? '#16a34a' : '#22c55e';
                ctx.beginPath();
                ctx.arc(hX, hY, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.2;
                ctx.stroke();

                // Tooltip Card
                var tipText1 = p.date || '';
                var tipText2 = 'TEMP: ' + p.temp.toFixed(2) + ' °C';
                ctx.font = 'bold 11px monospace';
                var tw1 = ctx.measureText(tipText1).width;
                var tw2 = ctx.measureText(tipText2).width;
                var boxW = Math.max(tw1, tw2) + 20;
                var boxH = 46;

                var boxX = hX + 14;
                if (boxX + boxW > w - 10) boxX = hX - boxW - 14;
                var boxY = Math.max(padT + 5, hY - boxH / 2);

                // Tooltip background
                ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.92)';
                ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.15)' : '#38bdf8';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 8) : ctx.rect(boxX, boxY, boxW, boxH);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(tipText1, boxX + 10, boxY + 18);

                ctx.fillStyle = isLight ? '#15803d' : '#4ade80';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(tipText2, boxX + 10, boxY + 35);
            }

            this.bindChartHover(canvas, points, th, 'temp');
        }

        drawHumidityChart(points, th, hoverIndex) {
            this.lastHumPoints = points;
            this.lastHumTh = th;
            var canvas = this.container.querySelector('#tel-hum-canvas');
            if (!canvas) return;
            var ctx = canvas.getContext('2d');
            var w = canvas.width;
            var h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            var isLight = this.isThemeLight();

            // Background canvas
            if (isLight) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
            } else {
                var bgGrad = ctx.createLinearGradient(0, 0, 0, h);
                bgGrad.addColorStop(0, '#090d16');
                bgGrad.addColorStop(1, '#0c1322');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, w, h);
            }

            var padL = 48, padR = 25, padT = 36, padB = 68;
            var plotW = w - padL - padR;
            var plotH = h - padT - padB;

            var yMin = 20, yMax = 100;
            var getY = function (val) {
                return padT + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
            };
            var getX = function (idx) {
                return padL + (idx / (points.length - 1)) * plotW;
            };

            // Optimum Safe Zone Soft Band (40% ~ 60%)
            var optYTop = getY(th.opt_max);
            var optYBot = getY(th.opt_min);
            ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.07)' : 'rgba(6, 182, 212, 0.06)';
            ctx.fillRect(padL, optYTop, plotW, optYBot - optYTop);

            // Horizontal Grid Lines & Y Axis Labels
            ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';

            for (var hum = yMin; hum <= yMax; hum += 10) {
                var yPos = getY(hum);
                ctx.beginPath();
                ctx.moveTo(padL, yPos);
                ctx.lineTo(w - padR, yPos);
                ctx.stroke();
                ctx.fillText(hum.toString() + '%', padL - 8, yPos);
            }

            // Threshold Lines:
            // 1. Critical Max (80%) - Red solid
            ctx.strokeStyle = isLight ? '#dc2626' : '#ef4444';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.crit_max));
            ctx.lineTo(w - padR, getY(th.crit_max));
            ctx.stroke();

            // 2. Critical Min (20%) - Red solid
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.crit_min));
            ctx.lineTo(w - padR, getY(th.crit_min));
            ctx.stroke();

            // 3. Optimum Max (60%) - Orange dashed
            ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.opt_max));
            ctx.lineTo(w - padR, getY(th.opt_max));
            ctx.stroke();

            // 4. Optimum Min (40%) - Orange dashed
            ctx.beginPath();
            ctx.moveTo(padL, getY(th.opt_min));
            ctx.lineTo(w - padR, getY(th.opt_min));
            ctx.stroke();
            ctx.setLineDash([]); // reset dash

            // 5. Area Fill Gradient under Curve
            var fillGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
            if (isLight) {
                fillGrad.addColorStop(0, 'rgba(2, 132, 199, 0.18)');
                fillGrad.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
            } else {
                fillGrad.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
                fillGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
            }
            ctx.fillStyle = fillGrad;
            ctx.beginPath();
            ctx.moveTo(getX(0), getY(points[0].hum));
            for (var k = 1; k < points.length; k++) {
                ctx.lineTo(getX(k), getY(points[k].hum));
            }
            ctx.lineTo(getX(points.length - 1), padT + plotH);
            ctx.lineTo(getX(0), padT + plotH);
            ctx.closePath();
            ctx.fill();

            // 6. Humidity Data Curve
            ctx.strokeStyle = isLight ? '#0284c7' : '#06b6d4';
            ctx.lineWidth = 2.6;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (var i = 0; i < points.length; i++) {
                var x = getX(i);
                var y = getY(points[i].hum);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // X Axis Labels (Angled 45 deg)
            ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            var stepX = Math.max(1, Math.floor(points.length / 20));
            for (var j = 0; j < points.length; j += stepX) {
                var xDate = getX(j);
                var dStr = points[j].date || '';
                ctx.save();
                ctx.translate(xDate, padT + plotH + 8);
                ctx.rotate(-Math.PI / 3.8);
                ctx.fillText(dStr, 0, 0);
                ctx.restore();
            }

            // Top Header Legend
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '10px -apple-system, sans-serif';

            var legX = padL + 6;
            // Optimum Min
            ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = isLight ? '#475569' : '#94a3b8'; ctx.fillText('Optimum Min (' + th.opt_min + '%)', legX + 20, 16);
            legX += 165;

            // Optimum Max
            ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = isLight ? '#475569' : '#94a3b8'; ctx.fillText('Optimum Max (' + th.opt_max + '%)', legX + 20, 16);
            legX += 165;

            // Hum Min Crit
            ctx.strokeStyle = isLight ? '#dc2626' : '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke();
            ctx.fillStyle = isLight ? '#dc2626' : '#f87171'; ctx.fillText('Min Limit (' + th.crit_min + '%)', legX + 20, 16);
            legX += 140;

            // Hum Max Crit
            ctx.strokeStyle = isLight ? '#dc2626' : '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke();
            ctx.fillStyle = isLight ? '#dc2626' : '#f87171'; ctx.fillText('Max Limit (' + th.crit_max + '%)', legX + 20, 16);
            legX += 140;

            // Live Hum Data
            ctx.strokeStyle = isLight ? '#0284c7' : '#06b6d4'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(legX, 16); ctx.lineTo(legX + 16, 16); ctx.stroke();
            ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('Live Humidity', legX + 20, 16);

            // Hover Cursor & Tooltip
            if (typeof hoverIndex === 'number' && hoverIndex >= 0 && hoverIndex < points.length) {
                var p = points[hoverIndex];
                var hX = getX(hoverIndex);
                var hY = getY(p.hum);

                // Vertical Crosshair
                ctx.strokeStyle = isLight ? 'rgba(37, 99, 235, 0.6)' : 'rgba(56, 189, 248, 0.7)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(hX, padT);
                ctx.lineTo(hX, padT + plotH);
                ctx.stroke();
                ctx.setLineDash([]);

                // Glowing Active Dot
                ctx.fillStyle = isLight ? '#0284c7' : '#06b6d4';
                ctx.beginPath();
                ctx.arc(hX, hY, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.2;
                ctx.stroke();

                // Tooltip Card
                var tipText1 = p.date || '';
                var tipText2 = 'HUMIDITY: ' + p.hum.toFixed(2) + ' %';
                ctx.font = 'bold 11px monospace';
                var tw1 = ctx.measureText(tipText1).width;
                var tw2 = ctx.measureText(tipText2).width;
                var boxW = Math.max(tw1, tw2) + 20;
                var boxH = 46;

                var boxX = hX + 14;
                if (boxX + boxW > w - 10) boxX = hX - boxW - 14;
                var boxY = Math.max(padT + 5, hY - boxH / 2);

                // Tooltip background
                ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.92)';
                ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.15)' : '#38bdf8';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 8) : ctx.rect(boxX, boxY, boxW, boxH);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(tipText1, boxX + 10, boxY + 18);

                ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(tipText2, boxX + 10, boxY + 35);
            }

            this.bindChartHover(canvas, points, th, 'hum');
        }

        bindChartHover(canvas, points, th, type) {
            if (canvas._hasHoverBound) return;
            canvas._hasHoverBound = true;

            var self = this;
            var handleMove = function (e) {
                var rect = canvas.getBoundingClientRect();
                var clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
                var relX = (clientX - rect.left) * (canvas.width / rect.width);
                var padL = 40, padR = 25;
                var plotW = canvas.width - padL - padR;

                if (relX < padL || relX > canvas.width - padR || !points || points.length < 2) {
                    if (type === 'temp') self.drawTemperatureChart(points, th, -1);
                    else self.drawHumidityChart(points, th, -1);
                    return;
                }

                var ratio = (relX - padL) / plotW;
                var idx = Math.round(ratio * (points.length - 1));
                idx = Math.max(0, Math.min(points.length - 1, idx));

                if (type === 'temp') self.drawTemperatureChart(points, th, idx);
                else self.drawHumidityChart(points, th, idx);
            };

            var handleLeave = function () {
                if (type === 'temp') self.drawTemperatureChart(points, th, -1);
                else self.drawHumidityChart(points, th, -1);
            };

            canvas.addEventListener('mousemove', handleMove);
            canvas.addEventListener('mouseleave', handleLeave);
            canvas.addEventListener('touchmove', handleMove, { passive: true });
            canvas.addEventListener('touchend', handleLeave, { passive: true });
        }

        printCurrentSheet() {
            var container = this.container.querySelector('#paper-sheets-container');
            var sheetCards = container ? container.querySelectorAll('.paper-sheet-card') : [];
            if (!sheetCards || sheetCards.length === 0) {
                window.print();
                return;
            }

            var self = this;
            var batchClones = [];

            sheetCards.forEach(function (card) {
                var sheetBody = card.querySelector('.paper-sheet');
                if (!sheetBody) return;

                var sigCanvas = sheetBody.querySelector('#paper-sig-canvas, .paper-sig-box');
                var signatureData = (sigCanvas && !self.isSignatureCanvasEmpty(sigCanvas)) ? sigCanvas.toDataURL('image/png') : '';

                var clone = sheetBody.cloneNode(true);
                var cloneCanvas = clone.querySelector('#paper-sig-canvas, .paper-sig-box');
                if (cloneCanvas && signatureData) {
                    var img = document.createElement('img');
                    img.src = signatureData;
                    img.className = 'sig-img';
                    img.style.maxHeight = '95px';
                    img.style.maxWidth = '260px';
                    img.style.display = 'block';
                    img.style.margin = '0 auto';
                    cloneCanvas.parentNode.replaceChild(img, cloneCanvas);
                }
                var clearBtn = clone.querySelector('#paper-clear-sig-btn');
                if (clearBtn) clearBtn.remove();

                var originalInputs = sheetBody.querySelectorAll('input, textarea');
                var cloneInputs = clone.querySelectorAll('input, textarea');
                for (var i = 0; i < originalInputs.length; i++) {
                    if (cloneInputs[i]) {
                        if (cloneInputs[i].tagName === 'TEXTAREA') {
                            cloneInputs[i].innerHTML = originalInputs[i].value;
                        } else {
                            cloneInputs[i].setAttribute('value', originalInputs[i].value);
                        }
                    }
                }

                var pageWrapper = document.createElement('div');
                pageWrapper.className = 'paper-sheet-card';
                pageWrapper.appendChild(clone);
                batchClones.push(pageWrapper.outerHTML);
            });

            var isStandalone = window.location.pathname.indexOf('/apps/sim-maintenance') !== -1;
            var styleHref = isStandalone ? 'style.css' : 'apps/sim-maintenance/style.css';

            var printWin = window.open('', '_blank', 'width=920,height=1150');
            if (!printWin) {
                window.print();
                return;
            }

            var reportType = this.activeSheets.length > 1
                ? 'BATCH_' + this.activeSheets.map(function (s) { return s.type.toUpperCase(); }).join('_')
                : (this.activeSheets[0] ? this.activeSheets[0].type.toUpperCase() : 'REPORT');

            var docTitle = reportType + '_Check_' + (this.telemetryData.date || new Date().toISOString().split('T')[0]);
            var printDoc = printWin.document;
            printDoc.open();
            printDoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + docTitle + '</title>' +
                '<link rel="stylesheet" href="' + styleHref + '">' +
                '<style>' +
                '@page { size: A4 portrait; margin: 5mm 8mm; }' +
                '* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }' +
                'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #fff; color: #000; margin: 0; padding: 0; }' +
                '.paper-sheet-card { page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; break-inside: avoid !important; margin: 0 !important; padding: 0 !important; width: 100% !important; height: calc(297mm - 10mm) !important; min-height: calc(297mm - 10mm) !important; max-height: calc(297mm - 10mm) !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; overflow: hidden !important; }' +
                '.paper-sheet-card:last-child { page-break-after: auto !important; break-after: auto !important; }' +
                '.paper-sheet { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; height: 100% !important; min-height: 100% !important; max-height: 100% !important; border: none !important; box-shadow: none !important; page-break-inside: avoid !important; break-inside: avoid !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; box-sizing: border-box !important; }' +
                '.sheet-a4-wrapper { display: flex !important; flex-direction: column !important; justify-content: space-between !important; width: 100% !important; height: 100% !important; min-height: 100% !important; max-height: 100% !important; margin: 0; border: 1.5px solid #000; box-shadow: none !important; page-break-inside: avoid !important; break-inside: avoid !important; overflow: hidden !important; }' +
                '.sheet-a4-body { flex: 0 0 auto; }' +
                '.sheet-a4-spacer { flex: 1 1 auto; min-height: 4px; }' +
                '.pf-bottom-box, .sig-footer-table { margin-top: auto !important; flex-shrink: 0 !important; page-break-inside: avoid !important; break-inside: avoid !important; }' +
                'table, tr, tbody, .paper-table { page-break-inside: avoid !important; break-inside: avoid !important; }' +
                'table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 12.5px; color: #000; }' +
                'table th, table td { border: 1px solid #000; padding: 2.5px 5px; vertical-align: middle; }' +
                '.paper-blue-hdr { background-color: #548dd4 !important; color: #000; font-weight: bold; font-size: 13.5px; }' +
                '.paper-grey-hdr { background-color: lightgrey !important; color: #000; font-weight: bold; font-size: 12.5px; }' +
                '.paper-check-mark, .paper-check-green { color: #10b981 !important; font-weight: 900 !important; font-size: 13.5px !important; line-height: 1 !important; height: 13.5px !important; display: inline-flex !important; align-items: center; justify-content: center; }' +
                '.sig-img { max-width: 240px; max-height: 65px; display: block; margin: 0 auto; }' +
                '</style></head><body>' +
                batchClones.join('\n') +
                '<script>window.onload = function() { setTimeout(function() { window.focus(); window.print(); }, 350); };</script>' +
                '</body></html>');
            printDoc.close();
        }

        async deleteArchive(month, file) {
            var promptMsg = this.t('sim_maint.delete_confirm', 'Are you sure you want to permanently delete the report "{file}"?').replace('{file}', file);
            if (!window.confirm(promptMsg)) {
                return;
            }

            try {
                var formData = new FormData();
                formData.append('action', 'delete_archive');
                formData.append('month', month);
                formData.append('file', file);

                var res = await fetch(this.getApiUrl('delete_archive'), {
                    method: 'POST',
                    body: formData
                });
                var data = await res.json();
                if (data && data.success) {
                    this.loadArchives();
                } else {
                    alert('❌ ' + (data && data.error ? data.error : 'Failed to delete report.'));
                }
            } catch (err) {
                console.error("Error deleting archive", err);
                alert('❌ Network or server error while deleting report.');
            }
        }

        async loadArchives() {
            var tree = this.container.querySelector('#maint-archives-tree');
            if (!tree) return;

            try {
                var res = await fetch(this.getApiUrl('get_archives'));
                var data = await res.json();
                if (data && data.success && data.archives) {
                    if (data.archives.length === 0) {
                        tree.innerHTML = '<div style="color: var(--text-muted, #9ca3af); text-align: center; padding: 30px;">' + this.t('sim_maint.no_archives', 'No certified reports archived yet.') + '</div>';
                        return;
                    }

                    var now = new Date();
                    var curYear = now.getFullYear();
                    var curMon = String(now.getMonth() + 1);
                    if (curMon.length === 1) curMon = '0' + curMon;
                    var currentMonthStr = curYear + '-' + curMon;

                    var self = this;
                    var getTypeBadge = function (fileName) {
                        var u = fileName.toUpperCase();
                        if (u.indexOf('PREFLIGHT') !== -1 || u.indexOf('PF') !== -1) return { label: 'Pre-Flight', cls: 'type-pf' };
                        if (u.indexOf('1W') !== -1) return { label: '1W Periodic', cls: 'type-1w' };
                        if (u.indexOf('C1') !== -1) return { label: 'C1 Monthly', cls: 'type-c1' };
                        if (u.indexOf('C2') !== -1) return { label: 'C2 Monthly', cls: 'type-c2' };
                        if (u.indexOf('C3') !== -1) return { label: 'C3 Monthly', cls: 'type-c3' };
                        if (u.indexOf('D1') !== -1) return { label: 'D1 Check', cls: 'type-d1' };
                        if (u.indexOf('D2') !== -1) return { label: 'D2 Check', cls: 'type-d2' };
                        if (u.indexOf('SF') !== -1) return { label: 'SF Flight', cls: 'type-sf' };
                        return { label: 'Report', cls: 'type-pf' };
                    };

                    tree.innerHTML = data.archives.map(function (arch, idx) {
                        var isCurrent = (arch.month === currentMonthStr || idx === 0);
                        var folderClass = isCurrent ? 'month-folder' : 'month-folder collapsed';

                        var filesHtml = arch.files.map(function (f) {
                            var badge = getTypeBadge(f.name);
                            var icon = (f.ext === 'pdf') ? '📄' : '🖨️';
                            var url = self.getApiUrl('view_archive', { month: arch.month, file: f.name });
                            var sizeKb = Math.round(f.size / 1024);

                            // Nettoie le nom affiché : masque _Check.html, _Check.pdf, _Check.json
                            var cleanName = f.name
                                .replace(/_Check\.(html|pdf|json)$/i, '')
                                .replace(/\.(html|pdf|json)$/i, '');

                            return '<div class="file-row">' +
                                '<div class="file-info-group">' +
                                    '<span class="file-badge-type ' + badge.cls + '">' + badge.label + '</span>' +
                                    '<span class="file-icon-badge">' + icon + '</span>' +
                                    '<div style="overflow: hidden;">' +
                                        '<div class="file-name-text" title="' + f.name + '">' + cleanName + '</div>' +
                                        '<div class="file-meta-sub">' + f.date + ' • ' + sizeKb + ' KB</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="file-actions-group">' +
                                    '<button class="btn-file-view" onclick="window.open(\'' + url + '\', \'_blank\')">' +
                                        self.t('sim_maint.view_pdf_btn', '👁️ View / Export PDF') +
                                    '</button>' +
                                    '<button class="btn-file-delete" data-del-month="' + arch.month + '" data-del-file="' + f.name + '" title="' + self.t('sim_maint.delete_report', 'Delete') + '">' +
                                        '🗑️ ' + self.t('sim_maint.delete_report', 'Delete') +
                                    '</button>' +
                                '</div>' +
                            '</div>';
                        }).join('');

                        var reportsCountText = self.t('sim_maint.reports_count', '{n} Report(s)').replace('{n}', arch.count);
                        var printMonthUrl = arch.print_month_url ? (window.location.pathname.indexOf('/apps/sim-maintenance') !== -1 ? arch.print_month_url.replace('apps/sim-maintenance/', '') : arch.print_month_url) : '';

                        return '<div class="' + folderClass + '" data-month-id="' + arch.month + '">' +
                            '<div class="month-header" data-toggle-month="' + arch.month + '">' +
                                '<div class="month-title-group">' +
                                    '<span class="month-chevron">▼</span>' +
                                    '<span style="font-size: 14px; font-weight: 700; color: var(--text-main, #0f172a);">📁 ' + arch.month + '</span>' +
                                    '<span class="month-count-badge">' + reportsCountText + '</span>' +
                                '</div>' +
                                '<div class="month-actions">' +
                                    '<button type="button" class="btn-print-month" data-print-url="' + printMonthUrl + '">' +
                                        self.t('sim_maint.print_month_pdf', '🖨️ Print Entire Month (PDF)') +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="files-list">' + filesHtml + '</div>' +
                        '</div>';
                    }).join('');

                    // Bind Accordion Header Toggles
                    var headers = tree.querySelectorAll('.month-header[data-toggle-month]');
                    for (var h = 0; h < headers.length; h++) {
                        (function (hdr) {
                            hdr.addEventListener('click', function (e) {
                                // If click was on print button or inside actions, do not toggle folder
                                if (e.target.closest('.month-actions')) return;
                                var folder = hdr.closest('.month-folder');
                                if (folder) {
                                    folder.classList.toggle('collapsed');
                                }
                            });
                        })(headers[h]);
                    }

                    // Bind Print Month Buttons
                    var printBtns = tree.querySelectorAll('.btn-print-month[data-print-url]');
                    for (var p = 0; p < printBtns.length; p++) {
                        (function (btn) {
                            btn.addEventListener('click', function (e) {
                                e.stopPropagation();
                                var url = btn.getAttribute('data-print-url');
                                if (url) {
                                    window.open(url, '_blank');
                                }
                            });
                        })(printBtns[p]);
                    }

                    // Bind Delete Buttons
                    var delBtns = tree.querySelectorAll('.btn-file-delete[data-del-month]');
                    for (var d = 0; d < delBtns.length; d++) {
                        (function (btn) {
                            btn.addEventListener('click', function (e) {
                                e.stopPropagation();
                                var m = btn.getAttribute('data-del-month');
                                var f = btn.getAttribute('data-del-file');
                                if (m && f) {
                                    self.deleteArchive(m, f);
                                }
                            });
                        })(delBtns[d]);
                    }
                }
            } catch (err) {
                console.error("Error loading archives", err);
                tree.innerHTML = '<div style="color: #f87171; padding: 20px;">Failed to load archives.</div>';
            }
        }
    }

    // Initialize Singleton & Register in AppManager
    var instance = new SimMaintenanceApp();
    window.SimMaintenanceApp = instance;
    window.simMaintenanceApp = instance;

    if (window.sys && window.sys.appManager) {
        window.sys.appManager.registerInstance('sim-maintenance', instance);
    }
    if (window.AppManager) {
        window.AppManager.registerInstance('sim-maintenance', instance);
    }
})(window);
