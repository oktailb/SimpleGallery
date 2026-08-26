/**
 * SimpleGallery WebOS - Sim Logbook Application (SimLogbookApp)
 * Dedicated to EC135 FFS Simulator Operation Logbook for Instructors & Pilots.
 * Designed for fast touch interaction on iPad & desktop, with private i18n and zero latency.
 */

(function (window) {
    'use strict';

    class SimLogbookApp {
        constructor() {
            this.winId = 'sim-logbook-window';
            this.appId = 'sim-logbook';
            this.currentDate = this.formatDateLocal(new Date());
            this.records = [];
            this.instructors = [];
            this.trainees = [];
            this.editingId = null;
            this.currentNews = '';
            this.container = null;
            this.win = null;
            this.localesCache = {};

            // Listen to system WebOS events
            if (window.EventBus) {
                window.EventBus.on('locale:changed', () => this.onLocaleChanged());
                window.EventBus.on('theme:changed', () => this.onThemeChanged());
            }
        }

        formatDateLocal(d) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
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

        parseNewsLines(raw) {
            if (!raw) return [];
            if (/<li/i.test(raw)) {
                const temp = document.createElement('div');
                temp.innerHTML = raw;
                const lis = Array.from(temp.querySelectorAll('li')).map(el => el.textContent.trim()).filter(Boolean);
                if (lis.length > 0) return lis;
            }
            return raw.split(/\r?\n/).map(l => l.replace(/^[\s•\-\*●]+/u, '').trim()).filter(Boolean);
        }

        getApiUrl(action, params) {
            const isStandalone = window.location.pathname.indexOf('/apps/sim-logbook') !== -1;
            const base = isStandalone ? 'api.php' : 'apps/sim-logbook/api.php';
            let url = `${base}?action=${encodeURIComponent(action)}`;
            if (params) {
                for (const k in params) {
                    if (params.hasOwnProperty(k) && params[k] !== undefined && params[k] !== null) {
                        url += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
                    }
                }
            }
            return url;
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

        async loadLocalLocale(lang) {
            lang = lang || this.getCurrentLocale();
            this.localesCache = this.localesCache || {};
            if (this.localesCache[lang]) return this.localesCache[lang];

            try {
                const isStandalone = window.location.pathname.indexOf('/apps/sim-logbook') !== -1;
                const basePath = isStandalone ? 'locales/' : 'apps/sim-logbook/locales/';
                const res = await fetch(basePath + lang + '.json');
                if (res.ok) {
                    const data = await res.json();
                    this.localesCache[lang] = data;
                    return data;
                }
            } catch (err) {
                console.warn('[SimLogbook] Could not load locale file:', lang, err);
            }
            return null;
        }

        t(key, fallback = '') {
            const loc = this.getCurrentLocale();
            if (this.localesCache && this.localesCache[loc] && this.localesCache[loc][key]) {
                return this.localesCache[loc][key];
            }
            if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
                const res = window.sys.i18n.t(key);
                if (res && res !== key) return res;
            }
            if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
                const res2 = window.I18nEngine.t(key);
                if (res2 && res2 !== key) return res2;
            }
            return fallback || key;
        }

        async onLocaleChanged() {
            await this.loadLocalLocale();
            if (this.win && typeof this.win.setTitle === 'function') {
                this.win.setTitle(`🚁 ${this.t('apps.sim-logbook.title', 'Sim Logbook')} — EC135 FFS`);
            }
            if (this.container) {
                this.renderLayout();
                this.loadRecords();
                this.loadNews();
            }
        }

        onThemeChanged() {
            if (this.container) {
                this.renderLayout();
                this.loadRecords();
            }
        }

        open(fileOrParams, params) {
            params = params || (typeof fileOrParams === 'object' && !fileOrParams.name ? fileOrParams : {});

            if (window.WindowManager && window.WindowManager.windows && window.WindowManager.windows.has(this.winId)) {
                const existingWin = window.WindowManager.windows.get(this.winId);
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

            const wrapper = document.createElement('div');
            wrapper.className = 'sim-logbook-container';
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';

            if (!window.WindowManager) {
                console.error('[SimLogbook] WindowManager is not available');
                return null;
            }

            const winTitle = `🚁 ${this.t('apps.sim-logbook.title', 'Sim Logbook')} — EC135 FFS`;
            this.win = window.WindowManager.createWindow({
                id: this.winId,
                appId: 'sim-logbook',
                appName: 'Sim Logbook',
                title: winTitle,
                icon: '🚁',
                width: 1060,
                height: 720,
                minWidth: 720,
                minHeight: 480,
                content: wrapper,
                onClose: () => {
                    this.container = null;
                    this.win = null;
                }
            });

            this.init(wrapper, params);
            return this.win;
        }

        async init(container, launchArgs) {
            this.container = container;
            if (launchArgs && launchArgs.date) {
                this.currentDate = launchArgs.date;
            }

            await this.loadLocalLocale();
            this.renderLayout();
            this.loadAutocomplete();
            this.loadRecords();
            this.loadNews();
        }

        getWeekdayString(dateStr) {
            try {
                const d = new Date(dateStr + 'T00:00:00');
                const jpDays = ['日', '月', '火', '水', '木', '金', '土'];
                const enDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const idx = d.getDay();
                return `${jpDays[idx]} - ${enDays[idx]}`;
            } catch (e) {
                return 'TUE';
            }
        }

        formatDateHeader(dateStr) {
            try {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    return `${parts[1]}/${parts[2]}/${parts[0]}`;
                }
            } catch (e) {}
            return dateStr;
        }

        renderLayout() {
            const curLang = this.getCurrentLocale();
            const weekdayStr = this.getWeekdayString(this.currentDate);
            const logoUrl = this.getApiUrl('get_logo');

            this.container.innerHTML = `
                <!-- Top Brand & Tools Header -->
                <div class="sim-logbook-header">
                    <div class="sim-logbook-brand">
                        <img src="${logoUrl}" alt="AIRBUS" style="height:22px; width:auto; display:inline-block; vertical-align:middle;">
                        <span class="sim-brand-sub" style="font-family:'Times New Roman', serif; font-size:16px; font-weight:bold;">Helicopters</span>
                        <span class="sim-logbook-title-tag">${this.t('sim_logbook.header_title', 'EC135 FFS SIMULATOR OPERATION LOG')}</span>
                    </div>

                    <div class="sim-header-actions">
                        <button type="button" class="sim-tool-icon-btn" id="sim-btn-stats" title="${this.t('sim_logbook.stats_title', 'Monthly Statistics')}">
                            <span style="font-size: 18px; font-weight: 900;">Σ</span>
                            <span>${this.t('sim_logbook.stats_title', 'Totals')}</span>
                        </button>
                        <button type="button" class="sim-tool-icon-btn" id="sim-btn-print" title="${this.t('sim_logbook.print_pdf', 'Print / PDF')}">
                            <span>🖨️ ${this.t('sim_logbook.print_pdf', 'Print')}</span>
                        </button>

                        <div class="sim-lang-switcher">
                            <button type="button" class="sim-lang-btn ${curLang === 'fr' ? 'active' : ''}" data-lang="fr">🇫🇷 FR</button>
                            <button type="button" class="sim-lang-btn ${curLang === 'en' ? 'active' : ''}" data-lang="en">🇬🇧 EN</button>
                            <button type="button" class="sim-lang-btn ${curLang === 'ja' ? 'active' : ''}" data-lang="ja">🇯🇵 JA</button>
                        </div>
                    </div>
                </div>

                <!-- Date & Fast Navigator Bar -->
                <div class="sim-date-bar">
                    <div class="sim-date-display-zone">
                        <span>DATE:</span>
                        <input type="date" class="sim-date-picker-input" id="sim-date-picker" value="${this.currentDate}">
                        <span class="sim-weekday-badge" id="sim-weekday-label">( ${weekdayStr} )</span>
                    </div>

                    <div class="sim-nav-btn-group">
                        <button type="button" class="sim-nav-action-btn" id="sim-btn-prev-month" title="${this.t('sim_logbook.prev_month', 'Previous Month')}">${this.t('sim_logbook.prev_month_btn', '⏪ Prev Month')}</button>
                        <button type="button" class="sim-nav-action-btn" id="sim-btn-prev-day" title="${this.t('sim_logbook.prev_day', 'Previous Day')}">${this.t('sim_logbook.prev_day_btn', '◀ Prev Day')}</button>
                        <button type="button" class="sim-nav-action-btn today-btn" id="sim-btn-today" title="${this.t('sim_logbook.today', 'Today')}">${this.t('sim_logbook.today_btn', '◆ Today')}</button>
                        <button type="button" class="sim-nav-action-btn" id="sim-btn-next-day" title="${this.t('sim_logbook.next_day', 'Next Day')}">${this.t('sim_logbook.next_day_btn', 'Next Day ▶')}</button>
                        <button type="button" class="sim-nav-action-btn" id="sim-btn-next-month" title="${this.t('sim_logbook.next_month', 'Next Month')}">${this.t('sim_logbook.next_month_btn', 'Next Month ⏩')}</button>
                    </div>
                </div>

                <!-- Body Content -->
                <div class="sim-logbook-body">
                    <!-- Sessions Table -->
                    <div class="sim-table-wrapper">
                        <table class="sim-operation-table">
                            <thead>
                                <tr>
                                    <th>${this.t('sim_logbook.instructor', 'ORGANIZATION<br>INSTRUCTOR')}</th>
                                    <th>${this.t('sim_logbook.trainee', 'ORGANIZATION<br>TRAINEE')}</th>
                                    <th>${this.t('sim_logbook.time_slot', 'TIME')}</th>
                                    <th>${this.t('sim_logbook.type', 'TYPE')}</th>
                                    <th>${this.t('sim_logbook.downtime', 'DOWN<br>TIME')}</th>
                                    <th>${this.t('sim_logbook.duration', 'DURATION')}</th>
                                    <th>${this.t('sim_logbook.memo', 'MEMO')}</th>
                                    <th>${this.t('sim_logbook.motion', 'MOTION')}</th>
                                    <th>${this.t('sim_logbook.feedback', 'FEEDBACK')}</th>
                                    <th>${this.t('sim_logbook.actions', 'ACTIONS')}</th>
                                </tr>
                            </thead>
                            <tbody id="sim-records-tbody">
                                <tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--sim-text-muted);">${this.t('sim_logbook.loading', 'Loading training sessions...')}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Fast Add / Edit Form Card -->
                    <div class="sim-form-card" id="sim-form-panel">
                        <div class="sim-form-header-bar" id="sim-form-header-title">
                            <span>${this.t('sim_logbook.add_title', 'Add a new training record:')}</span>
                            <span id="sim-form-mode-badge" style="display:none; background:#0284c7; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px;">EDIT MODE</span>
                        </div>

                        <datalist id="sim-instructors-list"></datalist>
                        <datalist id="sim-trainees-list"></datalist>

                        <form id="sim-record-form">
                            <div class="sim-form-grid">
                                <!-- Instructor -->
                                <div class="sim-field-row">
                                    <span class="sim-field-label">${this.t('sim_logbook.instructor_label', 'Organization/Instructor :')}</span>
                                    <input type="text" class="sim-input-text" id="sim-form-instructor" list="sim-instructors-list" placeholder="${this.t('sim_logbook.instructor_ph', 'e.g. AHJ/HIRATA')}" required>
                                </div>

                                <!-- Trainee -->
                                <div class="sim-field-row">
                                    <span class="sim-field-label">${this.t('sim_logbook.trainee_label', 'Organization/Trainee :')}</span>
                                    <input type="text" class="sim-input-text" id="sim-form-trainee" list="sim-trainees-list" placeholder="${this.t('sim_logbook.trainee_ph', 'e.g. Tokushima PD / Mech')}" required>
                                </div>

                                <!-- Time Selectors & Auto Duration -->
                                <div class="sim-field-row">
                                    <span class="sim-field-label">${this.t('sim_logbook.from_label', 'From :')}</span>
                                    <div class="sim-time-selector-group">
                                        <select class="sim-select-styled" id="sim-start-hour"></select>
                                        <span>:</span>
                                        <select class="sim-select-styled" id="sim-start-minute"></select>
                                        <span style="font-weight: 800; margin: 0 4px;">${this.t('sim_logbook.to_label', 'To :')}</span>
                                        <select class="sim-select-styled" id="sim-end-hour"></select>
                                        <span>:</span>
                                        <select class="sim-select-styled" id="sim-end-minute"></select>
                                        <span style="font-weight: 800; margin: 0 4px;">${this.t('sim_logbook.duration_label', '⇒ Duration :')}</span>
                                        <span class="sim-duration-pill" id="sim-form-duration-display">01:00</span>
                                    </div>
                                </div>

                                <!-- Category & Type -->
                                <div class="sim-field-row">
                                    <span class="sim-field-label">${this.t('sim_logbook.type_label', 'Type :')}</span>
                                    <div style="display:flex; gap:8px; flex:1;">
                                        <select class="sim-select-styled" id="sim-form-category" style="min-width: 100px;">
                                            <option value="FFS C">FFS C</option>
                                            <option value="FTD 5">FTD 5</option>
                                        </select>
                                        <select class="sim-select-styled" id="sim-form-type" style="flex:1;">
                                            <option value="WET">WET</option>
                                            <option value="DRY">DRY</option>
                                            <option value="INTERNAL">INTERNAL</option>
                                            <option value="MAINTENANCE">MAINTENANCE</option>
                                            <option value="OTHER">OTHER</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Downtime -->
                                <div class="sim-field-row">
                                    <span class="sim-field-label">${this.t('sim_logbook.downtime_label', 'Downtime :')}</span>
                                    <div class="sim-time-selector-group">
                                        <select class="sim-select-styled" id="sim-down-hour"></select>
                                        <span>:</span>
                                        <select class="sim-select-styled" id="sim-down-minute"></select>
                                    </div>
                                </div>

                                <!-- Motion & Feedback -->
                                <div class="sim-field-row">
                                    <span class="sim-field-label">${this.t('sim_logbook.feedback_label', 'Feedback :')}</span>
                                    <div style="display:flex; align-items:center; gap:16px; flex:1;">
                                        <select class="sim-select-styled" id="sim-form-feedback" style="min-width:120px;">
                                            <option value="GOOD">GOOD</option>
                                            <option value="BAD">BAD</option>
                                        </select>
                                        <label style="display:flex; align-items:center; gap:6px; font-weight:800; cursor:pointer; font-size:13px;">
                                            <input type="checkbox" id="sim-form-motion" checked style="width:18px; height:18px; accent-color:#0284c7;"> ${this.t('sim_logbook.motion_label', 'Motion')}
                                        </label>
                                    </div>
                                </div>

                                <!-- Memo -->
                                <div class="sim-field-row" style="grid-column: 1 / -1;">
                                    <span class="sim-field-label">${this.t('sim_logbook.memo_label', 'Memo :')}</span>
                                    <input type="text" class="sim-input-text" id="sim-form-memo" placeholder="${this.t('sim_logbook.memo_ph', 'Flight remarks, maneuvers, defects...')}" style="flex:1;">
                                </div>
                            </div>

                            <div class="sim-form-action-row">
                                <button type="button" class="sim-cancel-edit-btn" id="sim-btn-cancel-edit" style="display:none;">
                                    ${this.t('sim_logbook.cancel_btn', 'Cancel')}
                                </button>
                                <button type="submit" class="sim-submit-btn" id="sim-btn-submit-record">
                                    <span style="font-size:18px;">➤</span>
                                    <span id="sim-submit-label">${this.t('sim_logbook.record_btn', 'RECORD SESSION')}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- News & Maintenance Alert Banner (Interactive & Editable) -->
                    <div class="sim-news-banner" id="sim-news-box">
                        <div class="sim-news-text-zone" id="sim-news-click-zone" title="${this.t('sim_logbook.edit_maint_log', 'Click to edit maintenance log')}">
                            <span class="sim-news-blink">⚠️ ${this.t('sim_logbook.maint_log_header', 'MAINTENANCE Log:')}</span>
                            <span id="sim-news-content" style="font-weight: 600;">Loading maintenance notifications...</span>
                        </div>
                        <button type="button" class="sim-news-edit-btn" id="sim-news-edit-btn" title="${this.t('sim_logbook.edit_maint_log', 'Edit Maintenance Log')}">
                            <span>✏️</span>
                            <span>${this.t('sim_logbook.edit', 'Edit')}</span>
                        </button>
                    </div>
                </div>

                <!-- Stats & Edit Modal Container -->
                <div id="sim-stats-modal-container"></div>
            `;

            this.populateTimeSelectors();
            this.bindEvents();
        }

        populateTimeSelectors() {
            const startHour = this.container.querySelector('#sim-start-hour');
            const endHour = this.container.querySelector('#sim-end-hour');
            const downHour = this.container.querySelector('#sim-down-hour');

            const startMin = this.container.querySelector('#sim-start-minute');
            const endMin = this.container.querySelector('#sim-end-minute');
            const downMin = this.container.querySelector('#sim-down-minute');

            // Flight operation hours: strictly 08:00 to 18:00
            let flightHoursHtml = '';
            for (let h = 8; h <= 18; h++) {
                const val = String(h).padStart(2, '0');
                flightHoursHtml += `<option value="${val}">${val}</option>`;
            }
            startHour.innerHTML = flightHoursHtml;
            endHour.innerHTML = flightHoursHtml;

            // Downtime duration hours: 00 to 12 hours
            let downHoursHtml = '';
            for (let h = 0; h <= 12; h++) {
                const val = String(h).padStart(2, '0');
                downHoursHtml += `<option value="${val}">${val}</option>`;
            }
            downHour.innerHTML = downHoursHtml;

            let minsHtml = '';
            for (let m = 0; m < 60; m += 5) {
                const val = String(m).padStart(2, '0');
                minsHtml += `<option value="${val}">${val}</option>`;
            }
            startMin.innerHTML = minsHtml;
            endMin.innerHTML = minsHtml;
            downMin.innerHTML = minsHtml;

            // Default values (09:00 to 10:00)
            startHour.value = '09';
            startMin.value = '00';
            endHour.value = '10';
            endMin.value = '00';
            downHour.value = '00';
            downMin.value = '00';

            this.recomputeFormDuration();
        }

        recomputeFormDuration() {
            const sh = parseInt(this.container.querySelector('#sim-start-hour').value || 0, 10);
            const sm = parseInt(this.container.querySelector('#sim-start-minute').value || 0, 10);
            const eh = parseInt(this.container.querySelector('#sim-end-hour').value || 0, 10);
            const em = parseInt(this.container.querySelector('#sim-end-minute').value || 0, 10);

            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            let diff = endMin - startMin;
            if (diff < 0) diff += 24 * 60;

            const h = Math.floor(diff / 60);
            const m = diff % 60;
            const durText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const durDisplay = this.container.querySelector('#sim-form-duration-display');
            if (durDisplay) durDisplay.textContent = durText;
        }

        bindEvents() {
            const langBtns = this.container.querySelectorAll('.sim-lang-btn[data-lang]');
            langBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const code = btn.getAttribute('data-lang');
                    localStorage.setItem('sg_locale', code);
                    if (window.sys && window.sys.i18n && typeof window.sys.i18n.setLocale === 'function') {
                        window.sys.i18n.setLocale(code);
                    } else if (window.desktop && typeof window.desktop.setLocale === 'function') {
                        window.desktop.setLocale(code);
                    }
                    this.onLocaleChanged();
                });
            });

            const datePicker = this.container.querySelector('#sim-date-picker');
            datePicker.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                this.updateDateHeader();
                this.loadRecords();
            });

            this.container.querySelector('#sim-btn-today').addEventListener('click', () => {
                this.currentDate = this.formatDateLocal(new Date());
                datePicker.value = this.currentDate;
                this.updateDateHeader();
                this.loadRecords();
            });

            this.container.querySelector('#sim-btn-prev-day').addEventListener('click', () => this.shiftDate(-1, 'day'));
            this.container.querySelector('#sim-btn-next-day').addEventListener('click', () => this.shiftDate(1, 'day'));
            this.container.querySelector('#sim-btn-prev-month').addEventListener('click', () => this.shiftDate(-1, 'month'));
            this.container.querySelector('#sim-btn-next-month').addEventListener('click', () => this.shiftDate(1, 'month'));

            // Duration listeners
            ['#sim-start-hour', '#sim-start-minute', '#sim-end-hour', '#sim-end-minute'].forEach(sel => {
                this.container.querySelector(sel).addEventListener('change', () => this.recomputeFormDuration());
            });

            // Form Submit
            this.container.querySelector('#sim-record-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitRecordForm();
            });

            // Cancel Edit
            this.container.querySelector('#sim-btn-cancel-edit').addEventListener('click', () => {
                this.resetForm();
            });

            // Stats Modal (Σ)
            this.container.querySelector('#sim-btn-stats').addEventListener('click', () => {
                this.showStatsModal();
            });

            // Print
            this.container.querySelector('#sim-btn-print').addEventListener('click', () => {
                const month = this.currentDate.substring(0, 7);
                window.open(this.getApiUrl('view_print', { date: month }), '_blank');
            });

            // Maintenance Log (News) Edit Listeners
            const editNewsHandler = () => this.showEditNewsModal();
            const newsClickZone = this.container.querySelector('#sim-news-click-zone');
            if (newsClickZone) newsClickZone.addEventListener('click', editNewsHandler);
            const newsEditBtn = this.container.querySelector('#sim-news-edit-btn');
            if (newsEditBtn) newsEditBtn.addEventListener('click', editNewsHandler);
        }

        updateDateHeader() {
            const lbl = this.container.querySelector('#sim-weekday-label');
            if (lbl) {
                lbl.textContent = `( ${this.getWeekdayString(this.currentDate)} )`;
            }
        }

        shiftDate(amount, unit) {
            const parts = this.currentDate.split('-').map(Number);
            // Midday local time avoids any DST or timezone UTC shift
            const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
            if (unit === 'day') {
                d.setDate(d.getDate() + amount);
            } else if (unit === 'month') {
                d.setMonth(d.getMonth() + amount);
            }
            this.currentDate = this.formatDateLocal(d);
            const picker = this.container.querySelector('#sim-date-picker');
            if (picker) picker.value = this.currentDate;
            this.updateDateHeader();
            this.loadRecords();
        }

        async loadNews() {
            try {
                const res = await fetch(this.getApiUrl('get_news'));
                const data = await res.json();
                const content = this.container.querySelector('#sim-news-content');
                if (content && data.news !== undefined) {
                    this.currentNews = data.news;
                    const lines = this.parseNewsLines(data.news);
                    if (lines.length === 0) {
                        content.innerHTML = `<span style="color:#64748b; font-weight:normal;">(No active maintenance directives)</span>`;
                    } else {
                        content.innerHTML = `
                            <div class="sim-news-content-list">
                                ${lines.map(line => `
                                    <span class="sim-news-bullet-item">
                                        <span class="sim-bullet-dot">●</span>
                                        <span>${this.escapeHtml(line)}</span>
                                    </span>
                                `).join('')}
                            </div>
                        `;
                    }
                }
            } catch (e) {}
        }

        showEditNewsModal() {
            const modalContainer = this.container.querySelector('#sim-stats-modal-container');
            if (!modalContainer) return;

            const lines = this.parseNewsLines(this.currentNews || '');
            const cleanCurrent = lines.join('\n');

            modalContainer.innerHTML = `
                <div class="sim-modal-overlay" id="sim-news-modal-overlay">
                    <div class="sim-modal-card" style="max-width: 600px; width: 95%;">
                        <div class="sim-modal-header" style="background:#991b1b;">
                            <span>⚠️ ${this.t('sim_logbook.edit_maint_log', 'Edit Maintenance Log')}</span>
                            <button type="button" id="sim-news-modal-close-btn" style="background:transparent; border:none; color:#fff; font-size:20px; cursor:pointer;">✖</button>
                        </div>
                        <div class="sim-modal-body" style="padding: 16px;">
                            <label style="display:block; font-size:13px; font-weight:800; color:#334155; margin-bottom:8px;">
                                ${this.t('sim_logbook.maint_log_header', 'MAINTENANCE Log / Simulator Technical Directives:')}
                            </label>
                            <textarea id="sim-news-textarea" class="sim-textarea-styled" style="width:100%; min-height:140px; font-size:14px; font-weight:600; line-height:1.6; padding:10px;" placeholder="${this.t('sim_logbook.maint_log_ph', 'Enter maintenance notes, inoperative instruments, status... (1 line = 1 bullet)')}">${this.escapeHtml(cleanCurrent)}</textarea>
                            <div style="font-size:12px; color:#475569; margin-top:8px; display:flex; align-items:center; gap:6px;">
                                <span>💡</span>
                                <span><strong>Formatage automatique :</strong> chaque saut de ligne créera automatiquement une puce distincte (bullet item).</span>
                            </div>
                        </div>
                        <div class="sim-modal-footer" style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="sim-cancel-edit-btn" id="sim-news-modal-cancel-btn">${this.t('sim_logbook.cancel_btn', 'Cancel')}</button>
                            <button type="button" class="sim-submit-btn" id="sim-news-modal-save-btn" style="background:#991b1b;">
                                💾 ${this.t('sim_logbook.save_maint_log', 'Save Maintenance Log')}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const close = () => { modalContainer.innerHTML = ''; };
            modalContainer.querySelector('#sim-news-modal-close-btn').addEventListener('click', close);
            modalContainer.querySelector('#sim-news-modal-cancel-btn').addEventListener('click', close);

            const textarea = modalContainer.querySelector('#sim-news-textarea');
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }

            modalContainer.querySelector('#sim-news-modal-save-btn').addEventListener('click', async () => {
                const newText = textarea ? textarea.value.trim() : '';
                const saveBtn = modalContainer.querySelector('#sim-news-modal-save-btn');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                }

                try {
                    const formData = new FormData();
                    formData.append('news', newText);
                    const res = await fetch(this.getApiUrl('save_news'), {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.currentNews = data.news || newText;
                        this.loadNews();
                        close();
                    } else {
                        alert('Error: ' + (data.error || 'Failed to save maintenance log.'));
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.textContent = `💾 ${this.t('sim_logbook.save_maint_log', 'Save Maintenance Log')}`;
                        }
                    }
                } catch (err) {
                    alert('Network error: ' + err.message);
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = `💾 ${this.t('sim_logbook.save_maint_log', 'Save Maintenance Log')}`;
                    }
                }
            });
        }

        async loadAutocomplete() {
            try {
                const res = await fetch(this.getApiUrl('get_autocomplete'));
                const data = await res.json();
                if (data.success) {
                    this.instructors = data.instructors || [];
                    this.trainees = data.trainees || [];

                    const instDl = this.container.querySelector('#sim-instructors-list');
                    if (instDl) instDl.innerHTML = this.instructors.map(i => `<option value="${i}">`).join('');

                    const traineeDl = this.container.querySelector('#sim-trainees-list');
                    if (traineeDl) traineeDl.innerHTML = this.trainees.map(t => `<option value="${t}">`).join('');
                }
            } catch (err) {
                console.error("Autocomplete error", err);
            }
        }

        async loadRecords() {
            const tbody = this.container.querySelector('#sim-records-tbody');
            if (!tbody) return;
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--sim-text-muted);">${this.t('sim_logbook.loading', 'Loading training sessions...')}</td></tr>`;

            try {
                const res = await fetch(this.getApiUrl('get_trainings', { date: this.currentDate }));
                const data = await res.json();

                if (!data.success) {
                    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--sim-danger);">⚠️ ${data.error || 'Failed to load records.'}</td></tr>`;
                    return;
                }

                this.records = data.records || [];
                if (this.records.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--sim-text-muted);">${this.t('sim_logbook.no_records', 'No trainings recorded yet. Use the form below to add a new entry.')}</td></tr>`;
                    return;
                }

                tbody.innerHTML = this.records.map(rec => {
                    const isDel = parseInt(rec.deleted, 10) === 1;
                    const typeUpper = (rec.type || 'WET').toUpperCase();
                    let badgeClass = 'badge-other';
                    if (typeUpper === 'WET') badgeClass = 'badge-wet';
                    else if (typeUpper === 'DRY') badgeClass = 'badge-dry';
                    else if (typeUpper === 'INTERNAL') badgeClass = 'badge-internal';
                    else if (typeUpper === 'MAINTENANCE') badgeClass = 'badge-maint';

                    const fbUpper = (rec.feedback || 'GOOD').toUpperCase();
                    const fbClass = fbUpper === 'GOOD' ? 'badge-good' : 'badge-bad';
                    const hasMotion = parseInt(rec.motion, 10) === 1;

                    return `
                        <tr class="${isDel ? 'row-cancelled' : ''}" id="sim-rec-row-${rec.id}">
                            <td style="font-weight: 700;">${rec.instructor}</td>
                            <td style="font-weight: 600;">${rec.trainee}</td>
                            <td style="font-family: monospace; font-weight: 700; text-align: center;">${rec.startTime} <b>~</b> ${rec.endTime}</td>
                            <td style="text-align: center;">
                                <span class="sim-badge ${badgeClass}">${rec.category} / ${rec.type}</span>
                            </td>
                            <td style="font-family: monospace; text-align: center; color: var(--sim-text-muted);">${rec.downTime || '00:00'}</td>
                            <td style="font-family: monospace; font-weight: 800; text-align: center; color: #0284c7;">${rec.duration}</td>
                            <td style="color: #334155;">${rec.memo || ''}</td>
                            <td style="text-align: center;">${hasMotion ? '<span class="sim-motion-icon">✔</span>' : '<span style="color:#cbd5e1;">—</span>'}</td>
                            <td style="text-align: center;"><span class="sim-badge ${fbClass}">${rec.feedback}</span></td>
                            <td class="col-actions" style="text-align: center; white-space: nowrap;">
                                ${!isDel ? `
                                    <button type="button" class="sim-row-action-btn" title="${this.t('sim_logbook.edit', 'Edit')}" onclick="window.simLogbookApp.editRecord(${rec.id})">✏️</button>
                                    <button type="button" class="sim-row-action-btn delete-btn" title="${this.t('sim_logbook.cancel_strike', 'Cancel / Strike')}" onclick="window.simLogbookApp.strokeRecord(${rec.id}, 1)">❌</button>
                                ` : `
                                    <button type="button" class="sim-row-action-btn" title="${this.t('sim_logbook.restore', 'Restore')}" onclick="window.simLogbookApp.strokeRecord(${rec.id}, 0)">↩️</button>
                                    <button type="button" class="sim-row-action-btn delete-btn" title="${this.t('sim_logbook.delete', 'Delete Permanently')}" onclick="window.simLogbookApp.deleteRecord(${rec.id})">🗑️</button>
                                `}
                            </td>
                        </tr>
                    `;
                }).join('');

            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--sim-danger);">⚠️ Network error: ${err.message}</td></tr>`;
            }
        }

        editRecord(id) {
            const rec = this.records.find(r => parseInt(r.id, 10) === parseInt(id, 10));
            if (!rec) return;

            this.editingId = rec.id;
            this.container.querySelector('#sim-form-instructor').value = rec.instructor || '';
            this.container.querySelector('#sim-form-trainee').value = rec.trainee || '';
            this.container.querySelector('#sim-form-category').value = rec.category || 'FFS C';
            this.container.querySelector('#sim-form-type').value = rec.type || 'WET';
            this.container.querySelector('#sim-form-feedback').value = rec.feedback || 'GOOD';
            this.container.querySelector('#sim-form-motion').checked = parseInt(rec.motion, 10) === 1;
            this.container.querySelector('#sim-form-memo').value = rec.memo || '';

            // Split start and end time
            if (rec.startTime) {
                const sParts = rec.startTime.split(':');
                if (sParts.length >= 2) {
                    const sh = sParts[0].padStart(2, '0');
                    const startSel = this.container.querySelector('#sim-start-hour');
                    if (!startSel.querySelector(`option[value="${sh}"]`)) {
                        startSel.innerHTML += `<option value="${sh}">${sh}</option>`;
                    }
                    startSel.value = sh;
                    this.container.querySelector('#sim-start-minute').value = sParts[1].padStart(2, '0');
                }
            }
            if (rec.endTime) {
                const eParts = rec.endTime.split(':');
                if (eParts.length >= 2) {
                    const eh = eParts[0].padStart(2, '0');
                    const endSel = this.container.querySelector('#sim-end-hour');
                    if (!endSel.querySelector(`option[value="${eh}"]`)) {
                        endSel.innerHTML += `<option value="${eh}">${eh}</option>`;
                    }
                    endSel.value = eh;
                    this.container.querySelector('#sim-end-minute').value = eParts[1].padStart(2, '0');
                }
            }
            if (rec.downTime) {
                const dParts = rec.downTime.split(':');
                if (dParts.length >= 2) {
                    const dh = dParts[0].padStart(2, '0');
                    const downSel = this.container.querySelector('#sim-down-hour');
                    if (!downSel.querySelector(`option[value="${dh}"]`)) {
                        downSel.innerHTML += `<option value="${dh}">${dh}</option>`;
                    }
                    downSel.value = dh;
                    this.container.querySelector('#sim-down-minute').value = dParts[1].padStart(2, '0');
                }
            }

            this.recomputeFormDuration();

            // Toggle Edit mode visuals
            this.container.querySelector('#sim-form-header-title span:first-child').textContent = this.t('sim_logbook.edit_title', 'Edit training record:');
            this.container.querySelector('#sim-form-mode-badge').style.display = 'inline-block';
            this.container.querySelector('#sim-submit-label').textContent = this.t('sim_logbook.update_btn', 'UPDATE SESSION');
            this.container.querySelector('#sim-btn-cancel-edit').style.display = 'inline-block';

            // Scroll into form view
            const panel = this.container.querySelector('#sim-form-panel');
            if (panel) panel.scrollIntoView({ behavior: 'smooth' });
        }

        resetForm() {
            this.editingId = null;
            this.container.querySelector('#sim-record-form').reset();
            this.container.querySelector('#sim-form-header-title span:first-child').textContent = this.t('sim_logbook.add_title', 'Add a new training record:');
            this.container.querySelector('#sim-form-mode-badge').style.display = 'none';
            this.container.querySelector('#sim-submit-label').textContent = this.t('sim_logbook.record_btn', 'RECORD SESSION');
            this.container.querySelector('#sim-btn-cancel-edit').style.display = 'none';
            this.populateTimeSelectors();
        }

        async submitRecordForm() {
            const isEdit = this.editingId !== null;
            const action = isEdit ? 'update_training' : 'add_training';

            const sh = this.container.querySelector('#sim-start-hour').value;
            const sm = this.container.querySelector('#sim-start-minute').value;
            const eh = this.container.querySelector('#sim-end-hour').value;
            const em = this.container.querySelector('#sim-end-minute').value;
            const dh = this.container.querySelector('#sim-down-hour').value;
            const dm = this.container.querySelector('#sim-down-minute').value;

            const formData = new FormData();
            if (isEdit) formData.append('id', this.editingId);
            formData.append('date', this.currentDate);
            formData.append('instructor', this.container.querySelector('#sim-form-instructor').value);
            formData.append('trainee', this.container.querySelector('#sim-form-trainee').value);
            formData.append('startTime', `${sh}:${sm}`);
            formData.append('endTime', `${eh}:${em}`);
            formData.append('downTime', `${dh}:${dm}`);
            formData.append('category', this.container.querySelector('#sim-form-category').value);
            formData.append('type', this.container.querySelector('#sim-form-type').value);
            formData.append('feedback', this.container.querySelector('#sim-form-feedback').value);
            formData.append('motion', this.container.querySelector('#sim-form-motion').checked ? '1' : '0');
            formData.append('memo', this.container.querySelector('#sim-form-memo').value);

            try {
                const res = await fetch(this.getApiUrl(action), {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    this.resetForm();
                    this.loadRecords();
                    this.loadAutocomplete();
                } else {
                    alert('Error: ' + (data.error || 'Failed to submit record.'));
                }
            } catch (err) {
                alert('Network error: ' + err.message);
            }
        }

        async strokeRecord(id, state) {
            const formData = new FormData();
            formData.append('id', id);
            formData.append('deleted', state);

            try {
                const res = await fetch(this.getApiUrl('stroke_training'), {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    this.loadRecords();
                }
            } catch (err) {
                alert('Error updating record status.');
            }
        }

        async deleteRecord(id) {
            if (!confirm(this.t('sim_logbook.delete_confirm', 'Are you sure you want to permanently delete this training record?'))) return;

            const formData = new FormData();
            formData.append('id', id);

            try {
                const res = await fetch(this.getApiUrl('delete_training'), {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    this.loadRecords();
                }
            } catch (err) {
                alert('Error deleting record.');
            }
        }

        async showStatsModal() {
            const month = this.currentDate.substring(0, 7);
            const modalContainer = this.container.querySelector('#sim-stats-modal-container');
            if (!modalContainer) return;

            modalContainer.innerHTML = `
                <div class="sim-modal-overlay" id="sim-stats-overlay">
                    <div class="sim-modal-card" style="max-width: 820px; width: 95%;">
                        <div class="sim-modal-header">
                            <span>📊 ${this.t('sim_logbook.stats_title', 'Monthly Statistics & Totals')} (${month})</span>
                            <button type="button" id="sim-modal-close-btn" style="background:transparent; border:none; color:#fff; font-size:20px; cursor:pointer;">✖</button>
                        </div>
                        <div class="sim-modal-body" id="sim-stats-body">
                            <div style="text-align:center; padding:20px; color:var(--sim-text-muted);">${this.t('sim_logbook.loading', 'Computing operation statistics...')}</div>
                        </div>
                        <div class="sim-modal-footer" style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                            <button type="button" class="sim-submit-btn" id="sim-modal-export-summary-csv">
                                📊 ${this.t('sim_logbook.export_summary_csv', 'Export Monthly CSV')}
                            </button>
                            <button type="button" class="sim-cancel-edit-btn" id="sim-modal-ok-btn">${this.t('sim_logbook.cancel_btn', 'Close')}</button>
                        </div>
                    </div>
                </div>
            `;

            const close = () => { modalContainer.innerHTML = ''; };
            modalContainer.querySelector('#sim-modal-close-btn').addEventListener('click', close);
            modalContainer.querySelector('#sim-modal-ok-btn').addEventListener('click', close);
            modalContainer.querySelector('#sim-modal-export-summary-csv').addEventListener('click', () => {
                window.open(this.getApiUrl('export_csv', { date: month, mode: 'summary' }), '_blank');
            });

            try {
                const res = await fetch(this.getApiUrl('get_stats', { month: month }));
                const data = await res.json();
                if (data.success) {
                    const stats = data.stats;
                    const f = data.formatted;
                    const sum = data.summary || {};
                    const totals = sum.totals || {};
                    const metrics = sum.metrics || {};
                    const motionPct = stats.total_sessions > 0 ? Math.round((stats.motion_count / stats.total_sessions) * 100) : 0;
                    const goodPct = stats.total_sessions > 0 ? Math.round((stats.good_feedback_count / stats.total_sessions) * 100) : 0;

                    modalContainer.querySelector('#sim-stats-body').innerHTML = `
                        <div class="sim-stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
                            <div class="sim-stat-box" style="border-left: 4px solid #f59e0b; background:#fefce8;">
                                <span class="sim-stat-label">Customer TRNG</span>
                                <span class="sim-stat-value" style="color:#b45309;">${totals.customer_str || f.customer_wet}</span>
                            </div>
                            <div class="sim-stat-box" style="border-left: 4px solid #eab308; background:#fef9c3;">
                                <span class="sim-stat-label">Internal TRNG</span>
                                <span class="sim-stat-value" style="color:#854d0e;">${totals.internal_str || f.internal}</span>
                            </div>
                            <div class="sim-stat-box" style="border-left: 4px solid #0284c7; background:#f0f9ff;">
                                <span class="sim-stat-label">TOTAL Combined</span>
                                <span class="sim-stat-value" style="color:#0369a1;">${totals.customer_plus_internal_str || f.flight_time}</span>
                            </div>
                            <div class="sim-stat-box" style="border-left: 4px solid #38bdf8;">
                                <span class="sim-stat-label">OTHER</span>
                                <span class="sim-stat-value">${totals.other_str || f.other}</span>
                            </div>
                            <div class="sim-stat-box" style="border-left: 4px solid #10b981; background:#f0fdf4;">
                                <span class="sim-stat-label">MAINT</span>
                                <span class="sim-stat-value" style="color:#15803d;">${totals.maint_str || f.maintenance}</span>
                            </div>
                            <div class="sim-stat-box" style="border-left: 4px solid #ef4444; background:#fef2f2;">
                                <span class="sim-stat-label">DOWN TIME</span>
                                <span class="sim-stat-value" style="color:#b91c1c;">${totals.down_str || f.downtime}</span>
                            </div>
                            <div class="sim-stat-box" style="border-left: 4px solid #f97316;">
                                <span class="sim-stat-label">DRY TOTAL</span>
                                <span class="sim-stat-value" style="color:#c2410c;">${totals.dry_str || f.customer_dry}</span>
                            </div>
                            <div class="sim-stat-box" style="border-left: 4px solid #8b5cf6;">
                                <span class="sim-stat-label">AVAIL (AVG)</span>
                                <span class="sim-stat-value" style="color:#6d28d9;">${metrics.avail_avg || '100.00%'}</span>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:14px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <div>
                                <span style="font-size:11px; font-weight:800; color:#475569;">MTBF :</span>
                                <div style="font-size:16px; font-weight:900; color:#0f172a;">${metrics.mtbf_str || '14:30'}</div>
                            </div>
                            <div>
                                <span style="font-size:11px; font-weight:800; color:#475569;">MTTR :</span>
                                <div style="font-size:16px; font-weight:900; color:#0f172a;">${metrics.mttr_str || '0:00'}</div>
                            </div>
                            <div>
                                <span style="font-size:11px; font-weight:800; color:#475569;">AVAIL (MAX / MIN) :</span>
                                <div style="font-size:16px; font-weight:900; color:#0284c7;">${metrics.avail_max || '100%'} / ${metrics.avail_min || '100%'}</div>
                            </div>
                            <div>
                                <span style="font-size:11px; font-weight:800; color:#475569;">${this.t('sim_logbook.motion_rate', 'Motion Rate')} :</span>
                                <div style="font-size:16px; font-weight:900; color:#16a34a;">${motionPct}% (${stats.motion_count}/${stats.total_sessions})</div>
                            </div>
                        </div>
                    `;
                }
            } catch (err) {
                modalContainer.querySelector('#sim-stats-body').innerHTML = `<div style="color:var(--sim-danger); text-align:center;">Failed to compute stats.</div>`;
            }
        }
    }

    // Initialize Singleton & Register in AppManager
    const instance = new SimLogbookApp();
    window.SimLogbookApp = instance;
    window.simLogbookApp = instance;

    if (window.sys && window.sys.appManager) {
        window.sys.appManager.registerInstance('sim-logbook', instance);
    }
    if (window.AppManager) {
        window.AppManager.registerInstance('sim-logbook', instance);
    }
})(window);
