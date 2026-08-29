/**
 * SimpleGallery 2026 - System Monitor & Task Manager (SystemMonitorApp)
 * Real-time WebOS process telemetry, PHP host diagnostics, storage visualizer & cache cleaner.
 * Refactored using WebOSApp Base Class & WebOSToolkit Declarative Components.
 */
(function(window) {
  'use strict';

  const WebOSApp = (window.sys && window.sys.App) || window.WebOSApp;

  class SystemMonitorApp extends WebOSApp {
    constructor() {
      super({
        id: 'system-monitor',
        title: 'apps.system-monitor.title',
        icon: '📊',
        width: 880,
        height: 620,
        tabs: [
          { id: 'processes', label: 'sysmon.tab_processes', icon: '🪟' },
          { id: 'server', label: 'sysmon.tab_server', icon: '🖥️' },
          { id: 'storage', label: 'sysmon.tab_storage', icon: '💾' },
          { id: 'browser', label: 'sysmon.tab_browser', icon: '🌐' }
        ]
      });

      this.refreshInterval = null;
      this.autoRefreshEnabled = true;
      this.serverData = null;

      // Real-time telemetry & charts history (last 30 data points)
      this.historyLength = 30;
      this.fpsHistory = [];
      this.memHistory = [];
      this.cpuLoadHistory = [];

      // Telemetry metrics
      this.fps = 60;
      this.lastFrameTime = performance.now();
      this.frameCount = 0;
      this.eventLoopLag = 0;
      this.cpuLoadEstimate = 0;
      this.cpuPressureState = 'nominal';
      this.longTaskCount = 0;
      this.storageEstimate = null;

      // Start FPS and EventLoop lag measurement loops
      this.startFpsLoop();
      this.startLagMonitor();
      this.initPerformanceObservers();
      this.fetchStorageEstimate();

      // Listen to system events
      if (window.EventBus) {
        window.EventBus.on('locale:changed', () => this.onLocaleChanged());
        window.EventBus.on('theme:changed', (data) => this.onThemeChanged(data?.theme || data));
      }
    }

    onOpen() {
      this.fetchServerInfo();
      this.startAutoRefresh();
    }

    onClose() {
      this.stopAutoRefresh();
    }

    renderHeaderExtra() {
      return `
        <div style="display:flex; align-items:center; gap:10px;">
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; color:var(--text-muted, #94a3b8); user-select:none;">
            <input type="checkbox" id="sysmonAutoRefreshToggle" ${this.autoRefreshEnabled ? 'checked' : ''}>
            <span>${this.escapeHtml(this.t('sysmon.auto_refresh'))}</span>
          </label>
          <button type="button" id="sysmonRefreshBtn" class="sysmon-action-btn" style="padding:4px 10px;">
            🔄 ${this.escapeHtml(this.t('sysmon.refresh_btn'))}
          </button>
        </div>
      `;
    }

    bindEvents(container) {
      if (!container || !window.sys || !window.sys.ui || !window.sys.ui.bindActions) return;

      window.sys.ui.bindActions(container, {
        'change #sysmonAutoRefreshToggle': (el) => {
          this.autoRefreshEnabled = el.checked;
          if (this.autoRefreshEnabled) this.startAutoRefresh();
          else this.stopAutoRefresh();
        },
        'click #sysmonRefreshBtn': () => this.refresh(),
        'click #sysmonClearCacheBtn': () => this.clearCaches(),
        'click #sysmonPingBtn': () => this.pingApi(),
        'click #sysmonRunTestsBtn': () => this.runUnitTests(),
        'click .sysmon-btn-focus': (btn) => {
          const winId = btn.dataset.winId;
          if (window.WindowManager) window.WindowManager.focusWindow(winId);
          this.render();
        },
        'click .sysmon-btn-min': (btn) => {
          const winId = btn.dataset.winId;
          if (window.WindowManager) window.WindowManager.toggleMinimize(winId);
          this.render();
        },
        'click .sysmon-btn-close': (btn) => {
          const winId = btn.dataset.winId;
          if (window.WindowManager) window.WindowManager.closeWindow(winId);
          if (window.sys && window.sys.ui && window.sys.ui.toast) {
            window.sys.ui.toast.info(this.t('sysmon.proc_closed_toast', { id: winId }));
          }
          this.render();
        }
      });
    }

    startFpsLoop() {
      const calcFps = () => {
        const now = performance.now();
        this.frameCount++;
        if (now - this.lastFrameTime >= 1000) {
          this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
          this.frameCount = 0;
          this.lastFrameTime = now;
          this.recordHistory();
          this.updateGaugesDisplay();
        }
        requestAnimationFrame(calcFps);
      };
      requestAnimationFrame(calcFps);
    }

    startLagMonitor() {
      let lastTick = performance.now();
      setInterval(() => {
        const now = performance.now();
        const delta = now - lastTick - 1000;
        lastTick = now;
        this.eventLoopLag = Math.max(0, Math.round(delta));
        this.cpuLoadEstimate = Math.min(100, Math.max(0, Math.round((this.eventLoopLag / 150) * 100)));
      }, 1000);
    }

    initPerformanceObservers() {
      try {
        if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
          const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.longTaskCount++;
            }
          });
          obs.observe({ entryTypes: ['longtask'] });
        }
      } catch (e) {}

      try {
        if ('PressureObserver' in window) {
          const pressureObs = new window.PressureObserver((records) => {
            for (const record of records) {
              if (record && record.state) {
                this.cpuPressureState = record.state;
              }
            }
          });
          pressureObs.observe('cpu', { sampleInterval: 1000 });
        }
      } catch (e) {}
    }

    async fetchStorageEstimate() {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          this.storageEstimate = await navigator.storage.estimate();
        }
      } catch (e) {}
    }

    recordHistory() {
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.historyLength) this.fpsHistory.shift();

      const usedMB = (window.performance && window.performance.memory)
        ? Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))
        : 15;
      this.memHistory.push(usedMB);
      if (this.memHistory.length > this.historyLength) this.memHistory.shift();

      this.cpuLoadHistory.push(this.cpuLoadEstimate);
      if (this.cpuLoadHistory.length > this.historyLength) this.cpuLoadHistory.shift();

      if (this.currentTab === 'processes') {
        this.drawAllCharts();
      }
    }

    updateGaugesDisplay() {
      const fpsEl = document.getElementById('sysmonFpsVal');
      if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;

      const cpuEl = document.getElementById('sysmonCpuLoadVal');
      if (cpuEl) cpuEl.textContent = `${this.cpuLoadEstimate}%`;

      const memEl = document.getElementById('sysmonMemVal');
      if (memEl && window.performance && window.performance.memory) {
        memEl.textContent = `${Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))} MB`;
      }
    }

    registerMenuBar() {
      if (window.MenuBarManager) {
        window.MenuBarManager.registerAppMenu('system-monitor', (container) => {
          container.innerHTML = `
            <div class="app-menu-left">
              <span class="app-menu-pill active" style="font-weight:600;">📊 ${this.escapeHtml(this.t('apps.system-monitor.title'))}</span>
              <button type="button" class="app-menu-pill" id="menuSysmonRefreshBtn">🔄 ${this.escapeHtml(this.t('sysmon.refresh_btn'))}</button>
              <button type="button" class="app-menu-pill" id="menuSysmonPingBtn">⚡ ${this.escapeHtml(this.t('sysmon.ping_btn'))}</button>
              <button type="button" class="app-menu-pill" id="menuSysmonTestsBtn">🧪 ${this.escapeHtml(this.t('sysmon.run_tests_btn'))}</button>
            </div>
          `;
          const rBtn = container.querySelector('#menuSysmonRefreshBtn');
          const pBtn = container.querySelector('#menuSysmonPingBtn');
          const tBtn = container.querySelector('#menuSysmonTestsBtn');
          if (rBtn) rBtn.onclick = () => this.refresh();
          if (pBtn) pBtn.onclick = () => this.pingApi();
          if (tBtn) tBtn.onclick = () => this.runUnitTests();
        });
        window.MenuBarManager.setActiveApp('system-monitor');
      }
    }

    startAutoRefresh() {
      this.stopAutoRefresh();
      if (!this.autoRefreshEnabled) return;
      this.refreshInterval = setInterval(() => {
        this.fetchServerInfo(false);
        this.render();
      }, 2000);
    }

    stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }

    async fetchServerInfo(renderAfter = true) {
      try {
        const json = await window.sys.api.get('get_system_info');

        if (json.success && json.system_info) {
          this.serverData = json.system_info;
          if (renderAfter) this.render();
        }
      } catch (e) {
        console.warn('[SystemMonitor] Failed to fetch server info:', e);
      }
    }

    refresh() {
      this.fetchServerInfo(true);
      this.fetchStorageEstimate();
      this.render();
    }

    renderTab(tabId) {
      switch (tabId) {
        case 'processes':
          return this.renderProcessesTab();
        case 'server':
          return this.renderServerTab();
        case 'storage':
          return this.renderStorageTab();
        case 'browser':
          return this.renderBrowserTab();
        default:
          return '';
      }
    }

    onRender(container) {
      if (this.currentTab === 'processes') {
        this.drawAllCharts();
        this.bindProcessesEvents();
      } else if (this.currentTab === 'storage') {
        this.bindStorageEvents();
      }
    }

    // TAB 1: PROCESSES & REAL-TIME CHARTS
    renderProcessesTab() {
      const windows = window.WindowManager ? Array.from(window.WindowManager.windows.values()) : [];
      const activeWinId = window.WindowManager ? window.WindowManager.activeWindowId : null;

      const jsHeap = (window.performance && window.performance.memory) 
        ? `${Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))} MB / ${Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024))} MB`
        : 'N/A';

      const cores = navigator.hardwareConcurrency || 'N/A';
      const devRam = navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : 'N/A';

      return `
        ${window.sys.ui.chart.grid([
          {
            title: 'sysmon.chart_fps',
            icon: '⚡',
            canvasId: 'sysmonFpsCanvas',
            valueId: 'sysmonFpsVal',
            value: `${this.fps} FPS`,
            valueColor: this.fps < 30 ? '#ef4444' : '#22c55e',
            footerLeft: 'Min: 0',
            footerRight: 'Target: 60 FPS'
          },
          {
            title: 'sysmon.chart_cpu',
            icon: '⚙️',
            canvasId: 'sysmonCpuCanvas',
            valueId: 'sysmonCpuLoadVal',
            value: `${this.cpuLoadEstimate}%`,
            valueColor: this.cpuLoadEstimate > 60 ? '#f59e0b' : '#22c55e',
            footerLeft: `Lag: ${this.eventLoopLag}ms`,
            footerRight: `Pressure: ${this.cpuPressureState}`
          },
          {
            title: 'sysmon.chart_mem',
            icon: '🧠',
            canvasId: 'sysmonMemCanvas',
            valueId: 'sysmonMemVal',
            value: jsHeap.split('/')[0] || 'N/A',
            valueColor: '#a855f7',
            footerLeft: `RAM: ${devRam}`,
            footerRight: `Max: ${jsHeap.split('/')[1]?.trim() || 'N/A'}`
          }
        ])}

        ${window.sys.ui.chipList([
          { label: `${this.t('sysmon.cpu_cores')}: ${cores} threads`, icon: '⚙️' },
          { label: `${this.t('sysmon.device_ram')}: ${devRam}`, icon: '🧠' },
          { label: `${this.t('sysmon.cpu_pressure')}: ${this.cpuPressureState}`, enabled: this.cpuPressureState === 'nominal', disabled: this.cpuPressureState !== 'nominal', icon: '🌡️' },
          { label: `${this.t('sysmon.long_tasks')}: ${this.longTaskCount}`, icon: '⏱️' }
        ])}

        <div class="sysmon-card" style="margin-top: 14px;">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">🪟 ${this.escapeHtml(this.t('sysmon.processes_running', { count: windows.length }))}</h4>
          </div>

          <div class="sysmon-table-wrapper">
            <table class="sysmon-table">
              <thead>
                <tr>
                  <th>${this.escapeHtml(this.t('sysmon.proc_id'))}</th>
                  <th>${this.escapeHtml(this.t('sysmon.proc_app'))}</th>
                  <th>${this.escapeHtml(this.t('sysmon.proc_title'))}</th>
                  <th>${this.escapeHtml(this.t('sysmon.proc_state'))}</th>
                  <th style="text-align: right;">${this.escapeHtml(this.t('sysmon.proc_actions'))}</th>
                </tr>
              </thead>
              <tbody>
                ${windows.length === 0 ? `
                  <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                      ${this.escapeHtml(this.t('sysmon.no_processes'))}
                    </td>
                  </tr>
                ` : windows.map((w, index) => {
                  const isActive = (w.id === activeWinId);
                  const isMin = w.isMinimized;
                  return `
                    <tr class="${isActive ? 'active-process' : ''}">
                      <td style="font-family: monospace; font-size: 0.75rem; color: var(--accent-primary);">PID-${index + 1} (${this.escapeHtml(w.id)})</td>
                      <td>
                        <strong style="display: flex; align-items: center; gap: 6px;">
                          <span>${this.escapeHtml(w.icon || '📱')}</span>
                          <span>${this.escapeHtml(w.appName || w.appId || 'App')}</span>
                        </strong>
                      </td>
                      <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${this.escapeHtml(w.title || w.fileName || w.appName)}
                      </td>
                      <td>
                        ${isMin ? `<span class="sysmon-badge minimized">${this.escapeHtml(this.t('sysmon.state_minimized'))}</span>` : (isActive ? `<span class="sysmon-badge active">● ${this.escapeHtml(this.t('sysmon.state_foreground'))}</span>` : `<span class="sysmon-badge system">${this.escapeHtml(this.t('sysmon.state_background'))}</span>`)}
                      </td>
                      <td style="text-align: right;">
                        <div class="sysmon-actions-bar">
                          <button type="button" class="sysmon-action-btn sysmon-btn-focus" data-win-id="${this.escapeHtml(w.id)}" title="${this.escapeHtml(this.t('sysmon.proc_focus'))}">👁️</button>
                          <button type="button" class="sysmon-action-btn sysmon-btn-min" data-win-id="${this.escapeHtml(w.id)}" title="${this.escapeHtml(isMin ? this.t('sysmon.proc_restore') : this.t('sysmon.proc_minimize'))}">${isMin ? '⬆️' : '➖'}</button>
                          <button type="button" class="sysmon-action-btn kill sysmon-btn-close" data-win-id="${this.escapeHtml(w.id)}" title="${this.escapeHtml(this.t('sysmon.proc_close'))}">✕</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    drawAllCharts() {
      this.drawSparkline('sysmonFpsCanvas', this.fpsHistory, '#22c55e', 'rgba(34, 197, 94, 0.25)', 0, 75);
      this.drawSparkline('sysmonCpuCanvas', this.cpuLoadHistory, '#f59e0b', 'rgba(245, 158, 11, 0.25)', 0, 100);

      const maxMem = (window.performance && window.performance.memory)
        ? Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024))
        : 200;
      this.drawSparkline('sysmonMemCanvas', this.memHistory, '#a855f7', 'rgba(168, 85, 247, 0.25)', 0, maxMem * 1.15);
    }

    drawSparkline(canvasId, data, strokeColor, fillColor, minVal = 0, maxVal = 100) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      if (window.sys && window.sys.ui && window.sys.ui.chart && window.sys.ui.chart.sparkline) {
        window.sys.ui.chart.sparkline(canvas, {
          data,
          color: strokeColor,
          fillColor,
          min: minVal,
          max: maxVal,
          glow: true,
          grid: true,
          dot: true
        });
      }
    }



    // TAB 2: SERVER & PHP TELEMETRY
    renderServerTab() {
      const s = this.serverData || {};

      return `
        <div class="sysmon-gauges-grid">
          ${window.sys.ui.gauge({
            icon: '💾',
            label: this.t('sysmon.disk_used_label'),
            value: `${s.disk_used_percent || 0}%`,
            percent: s.disk_used_percent || 0,
            detail: this.t('sysmon.disk_detail', { used: s.disk_used_fmt || '0 B', total: s.disk_total_fmt || '0 B', free: s.disk_free_fmt || '0 B' })
          })}

          ${window.sys.ui.gauge({
            icon: '🧠',
            label: this.t('sysmon.memory_allocated'),
            value: s.memory_current_fmt || 'N/A',
            percent: 35,
            detail: this.t('sysmon.memory_detail', { peak: s.memory_peak_fmt || 'N/A', limit: s.memory_limit || 'N/A' })
          })}
        </div>

        ${window.sys.ui.card({
          title: this.t('sysmon.server_title'),
          icon: '🖥️',
          content: window.sys.ui.infoGrid([
            { label: 'sysmon.server_os', value: s.php_os || 'PHP_OS' },
            { label: 'sysmon.php_version', value: s.php_version || 'PHP' },
            { label: 'sysmon.php_sapi', value: s.php_sapi || 'CLI' },
            { label: 'sysmon.zend_engine', value: s.zend_version || 'Zend' },
            { label: 'sysmon.server_web', value: s.server_software || 'PHP Built-in' },
            { label: 'sysmon.upload_max', value: s.upload_max_filesize || 'N/A' },
            { label: 'sysmon.post_max', value: s.post_max_size || 'N/A' },
            { label: 'sysmon.memory_limit', value: s.memory_limit || 'N/A' }
          ])
        })}

        ${window.sys.ui.card({
          title: this.t('sysmon.extensions_title'),
          icon: '🧩',
          content: window.sys.ui.chipList([
            { label: 'GD Library', enabled: s.gd_available, icon: s.gd_available ? '✓' : '✗' },
            { label: 'WebP Support', enabled: s.gd_webp, icon: s.gd_webp ? '✓' : '✗' },
            { label: 'AVIF Support', enabled: s.gd_avif, icon: s.gd_avif ? '✓' : '✗' },
            { label: 'EXIF Parser', enabled: s.exif_available, icon: s.exif_available ? '✓' : '✗' },
            { label: 'ZipArchive', enabled: s.zip_available, icon: s.zip_available ? '✓' : '✗' },
            { label: 'Intl (i18n)', enabled: s.intl_available, icon: s.intl_available ? '✓' : '✗' },
            { label: 'PDO', enabled: s.pdo_available, icon: s.pdo_available ? '✓' : '✗' },
            { label: 'SQLite3', enabled: s.sqlite_available, icon: s.sqlite_available ? '✓' : '✗' },
            { label: 'cURL', enabled: s.curl_available, icon: s.curl_available ? '✓' : '✗' },
            { label: 'mbstring', enabled: s.mbstring_available, icon: s.mbstring_available ? '✓' : '✗' },
            { label: 'OPcache', enabled: s.opcache_available, icon: s.opcache_available ? '✓' : '✗' },
            { label: 'FFMPEG CLI', enabled: s.ffmpeg_available, icon: s.ffmpeg_available ? '✓' : '✗' }
          ])
        })}
      `;
    }

    // TAB 3: STORAGE & CACHE MANAGEMENT
    renderStorageTab() {
      const s = this.serverData || {};

      const clearBtnHtml = `
        <button type="button" id="sysmonClearCacheBtn" class="sysmon-action-btn kill sysmon-btn danger" title="${this.escapeHtml(this.t('sysmon.clear_cache_btn'))}">
          🗑️ ${this.escapeHtml(this.t('sysmon.clear_cache_btn'))}
        </button>
      `;

      const gaugesHtml = `
        <div class="sysmon-gauges-grid">
          ${window.sys.ui.gauge({
            icon: '📁',
            label: this.t('sysmon.cache_folders'),
            value: s.cache_count || 0,
            detail: `${this.t('sysmon.total_size')} : <strong>${s.cache_size_fmt || '0 B'}</strong>`
          })}

          ${window.sys.ui.gauge({
            icon: '🖼️',
            label: this.t('sysmon.cache_thumbs'),
            value: s.thumbs_count || 0,
            detail: `${this.t('sysmon.total_size')} : <strong>${s.thumbs_size_fmt || '0 B'}</strong>`
          })}
        </div>
      `;

      const testsHtml = `
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="sysmonPingBtn" class="sysmon-action-btn sysmon-btn">
            ⚡ ${this.escapeHtml(this.t('sysmon.ping_btn'))}
          </button>
          <span id="sysmonPingResult" style="font-size: 0.85rem; font-weight: 600; color: var(--accent-primary);"></span>
        </div>

        <div style="margin-top: 8px;">
          <button type="button" id="sysmonRunTestsBtn" class="sysmon-action-btn sysmon-btn" style="background: var(--accent-primary, #6366f1); color: #fff;">
            🧪 ${this.escapeHtml(this.t('sysmon.run_tests_btn'))}
          </button>
        </div>
      `;

      return `
        ${window.sys.ui.card({
          title: this.t('sysmon.cache_title'),
          icon: '💾',
          headerAction: clearBtnHtml,
          content: gaugesHtml
        })}

        ${window.sys.ui.card({
          title: this.t('sysmon.tests_title'),
          icon: '⚡',
          content: testsHtml
        })}
      `;
    }



    async clearCaches() {
      const confirmMsg = this.t('sysmon.clear_cache_confirm');
      let confirmed = false;
      if (window.sys && window.sys.ui && window.sys.ui.dialog) {
        confirmed = await window.sys.ui.dialog.confirm({
          title: this.t('sysmon.cache_title'),
          icon: "🗑️",
          message: confirmMsg,
          danger: true
        });
      } else {
        confirmed = confirm(confirmMsg);
      }
      if (!confirmed) return;

      try {
        const json = await window.sys.api.post('clear_all_caches');

        if (json.success) {
          const msg = this.t('sysmon.clear_cache_success', { count: json.deleted_count, freed: json.freed_fmt });
          if (window.sys && window.sys.ui && window.sys.ui.toast) {
            window.sys.ui.toast.success(msg);
          } else {
            alert(msg);
          }
          this.refresh();
        } else {
          const errMsg = this.t('sysmon.clear_cache_error', { error: json.error || '' });
          if (window.sys && window.sys.ui && window.sys.ui.toast) {
            window.sys.ui.toast.error(errMsg);
          } else {
            alert(errMsg);
          }
        }
      } catch (e) {
        const errMsg = this.t('sysmon.clear_cache_error', { error: e.message });
        if (window.sys && window.sys.ui && window.sys.ui.toast) {
          window.sys.ui.toast.error(errMsg);
        } else {
          alert(errMsg);
        }
      }
    }

    async pingApi() {
      const resultEl = document.getElementById('sysmonPingResult');
      if (resultEl) resultEl.textContent = this.t('sysmon.ping_measuring');

      const t0 = performance.now();
      try {
        await window.sys.api.get('get_system_info', { _t: Date.now() });
        const t1 = performance.now();
        const ms = Math.round(t1 - t0);
        const text = this.t('sysmon.ping_result', { ms });
        if (resultEl) resultEl.textContent = text;
      } catch (e) {
        if (resultEl) resultEl.textContent = '⚠️ ' + this.t('sysmon.ping_error');
      }
    }

    runUnitTests() {
      if (window.SettingsApp && typeof window.SettingsApp.runTests === 'function') {
        window.SettingsApp.open();
        window.SettingsApp.switchTab('system');
        window.SettingsApp.runTests();
      } else {
        window.location.href = 'tests/run_tests.php';
      }
    }

    // TAB 4: BROWSER & CLIENT ENVIRONMENT
    renderBrowserTab() {
      const nav = window.navigator || {};
      const screen = window.screen || {};

      let storageUsage = 'N/A';
      try {
        let total = 0;
        for (let x in localStorage) {
          if (localStorage.hasOwnProperty(x)) {
            total += ((localStorage[x].length + x.length) * 2);
          }
        }
        storageUsage = `${(total / 1024).toFixed(2)} KB`;
      } catch (e) {}

      let quotaText = 'N/A';
      if (this.storageEstimate && this.storageEstimate.quota) {
        const usedMB = ((this.storageEstimate.usage || 0) / (1024 * 1024)).toFixed(1);
        const quotaGB = (this.storageEstimate.quota / (1024 * 1024 * 1024)).toFixed(1);
        quotaText = `${usedMB} MB / ${quotaGB} GB`;
      }

      return `
        ${window.sys.ui.card({
          title: this.t('sysmon.browser_title'),
          icon: '🌐',
          content: window.sys.ui.infoGrid([
            { label: 'User-Agent', value: nav.userAgent || 'Unknown' },
            { label: 'sysmon.client_platform', value: nav.platform || 'Web' },
            { label: 'sysmon.cpu_cores', value: nav.hardwareConcurrency || 'N/A' },
            { label: 'sysmon.device_ram', value: nav.deviceMemory ? `~${nav.deviceMemory} GB` : 'N/A' },
            { label: 'sysmon.browser_lang', value: nav.language || 'fr' },
            { label: 'sysmon.client_screen', value: `${screen.width || 0} × ${screen.height || 0} px` },
            { label: 'sysmon.client_dpr', value: `${window.devicePixelRatio || 1}x` },
            { label: 'sysmon.client_color_depth', value: `${screen.colorDepth || 24} bits` },
            { label: 'sysmon.client_status', value: nav.onLine ? `● ${this.t('sysmon.client_online')}` : `○ ${this.t('sysmon.client_offline')}`, style: `color: ${nav.onLine ? '#22c55e' : '#ef4444'};` },
            { label: 'sysmon.storage_estimate', value: quotaText },
            { label: 'sysmon.client_storage', value: storageUsage },
            { label: 'sysmon.cpu_pressure', value: this.cpuPressureState, style: `color: ${this.cpuPressureState === 'nominal' ? '#22c55e' : '#f59e0b'};` }
          ])
        })}

        ${window.sys.ui.card({
          title: this.t('sysmon.html5_title'),
          icon: '🚀',
          content: window.sys.ui.chipList([
            { label: 'IndexedDB', enabled: !!window.indexedDB, icon: window.indexedDB ? '✓' : '✗' },
            { label: 'Service Worker', enabled: !!window.ServiceWorker, icon: window.ServiceWorker ? '✓' : '✗' },
            { label: 'WebSocket', enabled: !!window.WebSocket, icon: window.WebSocket ? '✓' : '✗' },
            { label: 'WebAssembly (Wasm)', enabled: !!window.WebAssembly, icon: window.WebAssembly ? '✓' : '✗' },
            { label: 'Gamepad API', enabled: !!window.navigator.getGamepads, icon: window.navigator.getGamepads ? '✓' : '✗' },
            { label: 'Web Audio API', enabled: !!(window.AudioContext || window.webkitAudioContext), icon: (window.AudioContext || window.webkitAudioContext) ? '✓' : '✗' },
            { label: 'Performance Observer', enabled: !!window.PerformanceObserver, icon: window.PerformanceObserver ? '✓' : '✗' }
          ])
        })}
      `;
    }

    onLocaleChanged() {
      if (this.window) {
        this.window.setTitle(`📊 ${this.t('apps.system-monitor.title')}`);
        this.render();
      }
    }

    onThemeChanged() {
      if (this.window && this.currentTab === 'processes') {
        this.drawAllCharts();
      }
    }
  }

  // Instantiate & export
  window.SystemMonitorApp = new SystemMonitorApp();
})(window);
