/**
 * SimpleGallery 2026 - System Monitor & Task Manager (SystemMonitorApp)
 * Real-time WebOS process telemetry, PHP host diagnostics, storage visualizer & cache cleaner.
 * Features smoothed 2D Canvas real-time sparkline graphs for FPS, JS Heap, and Event Loop CPU Load.
 */
(function(window) {
  'use strict';

  class SystemMonitorApp {
    constructor() {
      this.winId = 'system-monitor-window';
      this.currentTab = 'processes'; // 'processes' | 'server' | 'storage' | 'browser'
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

    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
      // 1. Long Tasks Observer
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

      // 2. Compute Pressure Observer (W3C Standard for CPU load)
      try {
        if ('PressureObserver' in window) {
          const pressureObs = new window.PressureObserver((records) => {
            for (const record of records) {
              if (record && record.state) {
                this.cpuPressureState = record.state; // 'nominal', 'fair', 'serious', 'critical'
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
      // Record FPS
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.historyLength) this.fpsHistory.shift();

      // Record Memory (MB)
      const usedMB = (window.performance && window.performance.memory)
        ? Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))
        : 15;
      this.memHistory.push(usedMB);
      if (this.memHistory.length > this.historyLength) this.memHistory.shift();

      // Record CPU Load (%)
      this.cpuLoadHistory.push(this.cpuLoadEstimate);
      if (this.cpuLoadHistory.length > this.historyLength) this.cpuLoadHistory.shift();

      // Redraw charts if visible
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

    open() {
      if (!window.WindowManager) return;

      const title = this.t('apps.system-monitor.title') || "Moniteur Système";
      let win = window.WindowManager.windows.get(this.winId);

      if (win) {
        window.WindowManager.focusWindow(this.winId);
        this.refresh();
        return;
      }

      const defaultW = Math.min(880, Math.max(560, Math.round(window.innerWidth * 0.75)));
      const defaultH = Math.min(620, Math.max(460, Math.round(window.innerHeight * 0.75)));

      win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'system-monitor',
        appName: title,
        title: `📊 ${title}`,
        icon: '📊',
        width: defaultW,
        height: defaultH,
        content: this.buildAppShell(),
        onClose: () => {
          this.stopAutoRefresh();
        },
        onFocus: () => {
          this.registerMenuBar();
        }
      });

      this.initEvents();
      this.fetchServerInfo();
      this.startAutoRefresh();
      this.render();
    }

    registerMenuBar() {
      if (window.MenuBarManager) {
        window.MenuBarManager.registerAppMenu('system-monitor', (container) => {
          container.innerHTML = `
            <div class="app-menu-left">
              <span class="app-menu-pill active" style="font-weight:600;">📊 ${this.escapeHtml(this.t('apps.system-monitor.title') || 'Moniteur Système')}</span>
              <button type="button" class="app-menu-pill" id="menuSysmonRefreshBtn">🔄 ${this.escapeHtml(this.t('sysmon.refresh_btn') || 'Actualiser')}</button>
              <button type="button" class="app-menu-pill" id="menuSysmonPingBtn">⚡ ${this.escapeHtml(this.t('sysmon.ping_btn') || 'Ping API')}</button>
              <button type="button" class="app-menu-pill" id="menuSysmonTestsBtn">🧪 ${this.escapeHtml(this.t('sysmon.run_tests_btn') || 'Tests')}</button>
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

    buildAppShell() {
      return `
        <div class="sysmon-app" id="sysmonAppContainer">
          <!-- Header & Navigation -->
          <div class="sysmon-header">
            <div class="sysmon-tabs">
              <button type="button" class="sysmon-tab-btn ${this.currentTab === 'processes' ? 'active' : ''}" data-tab="processes">
                🪟 ${this.escapeHtml(this.t('sysmon.tab_processes') || 'Processus & Fenêtres')}
              </button>
              <button type="button" class="sysmon-tab-btn ${this.currentTab === 'server' ? 'active' : ''}" data-tab="server">
                🖥️ ${this.escapeHtml(this.t('sysmon.tab_server') || 'Serveur & PHP')}
              </button>
              <button type="button" class="sysmon-tab-btn ${this.currentTab === 'storage' ? 'active' : ''}" data-tab="storage">
                💾 ${this.escapeHtml(this.t('sysmon.tab_storage') || 'Stockage & Caches')}
              </button>
              <button type="button" class="sysmon-tab-btn ${this.currentTab === 'browser' ? 'active' : ''}" data-tab="browser">
                🌐 ${this.escapeHtml(this.t('sysmon.tab_browser') || 'Navigateur & Client')}
              </button>
            </div>

            <div class="sysmon-toolbar-actions">
              <label class="sysmon-toggle-label" title="Rafraîchissement automatique toutes les 2 secondes">
                <input type="checkbox" id="sysmonAutoRefreshToggle" ${this.autoRefreshEnabled ? 'checked' : ''} />
                <span>${this.escapeHtml(this.t('sysmon.auto_refresh') || 'Auto (2s)')}</span>
              </label>
              <button type="button" id="sysmonRefreshBtn" class="sysmon-btn" title="Actualiser maintenant">
                🔄 ${this.escapeHtml(this.t('sysmon.refresh_btn') || 'Actualiser')}
              </button>
            </div>
          </div>

          <!-- Main Body Content -->
          <div class="sysmon-body" id="sysmonBodyContent">
            <!-- Dynamically populated by render() -->
          </div>
        </div>
      `;
    }

    initEvents() {
      const container = document.getElementById('sysmonAppContainer');
      if (!container) return;

      // Tab Buttons
      const tabBtns = container.querySelectorAll('.sysmon-tab-btn');
      tabBtns.forEach(btn => {
        btn.onclick = () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentTab = btn.dataset.tab;
          this.render();
        };
      });

      // Refresh Button
      const refreshBtn = document.getElementById('sysmonRefreshBtn');
      if (refreshBtn) {
        refreshBtn.onclick = () => this.refresh();
      }

      // Auto Refresh Toggle
      const autoToggle = document.getElementById('sysmonAutoRefreshToggle');
      if (autoToggle) {
        autoToggle.onchange = (e) => {
          this.autoRefreshEnabled = e.target.checked;
          if (this.autoRefreshEnabled) {
            this.startAutoRefresh();
          } else {
            this.stopAutoRefresh();
          }
        };
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
        const res = await fetch('api.php?action=get_system_info');
        const json = await res.json();
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

    render() {
      const bodyEl = document.getElementById('sysmonBodyContent');
      if (!bodyEl) return;

      switch (this.currentTab) {
        case 'processes':
          bodyEl.innerHTML = this.renderProcessesTab();
          this.bindProcessesEvents();
          setTimeout(() => this.drawAllCharts(), 30);
          break;
        case 'server':
          bodyEl.innerHTML = this.renderServerTab();
          break;
        case 'storage':
          bodyEl.innerHTML = this.renderStorageTab();
          this.bindStorageEvents();
          break;
        case 'browser':
          bodyEl.innerHTML = this.renderBrowserTab();
          this.bindBrowserEvents();
          break;
      }
    }

    // -------------------------------------------------------------
    // TAB 1: PROCESSES & REAL-TIME CHARTS
    // -------------------------------------------------------------
    renderProcessesTab() {
      const windows = window.WindowManager ? Array.from(window.WindowManager.windows.values()) : [];
      const activeWinId = window.WindowManager ? window.WindowManager.activeWindowId : null;

      const jsHeap = (window.performance && window.performance.memory) 
        ? `${Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))} MB / ${Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024))} MB`
        : 'N/A';

      const cores = navigator.hardwareConcurrency || 'N/A';
      const devRam = navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : 'N/A';

      return `
        <!-- Real-Time Telemetry Sparkline Charts Grid -->
        <div class="sysmon-charts-grid">
          <!-- 1. FPS Chart -->
          <div class="sysmon-chart-card">
            <div class="sysmon-chart-header">
              <span class="sysmon-chart-title">⚡ ${this.escapeHtml(this.t('sysmon.chart_fps') || 'Fluidité de Rendu (FPS)')}</span>
              <span class="sysmon-chart-val" id="sysmonFpsVal" style="color: ${this.fps < 30 ? '#ef4444' : '#22c55e'};">${this.fps} FPS</span>
            </div>
            <div class="sysmon-canvas-wrapper">
              <canvas id="sysmonFpsCanvas" class="sysmon-chart-canvas"></canvas>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted);">
              <span>Min: 0</span>
              <span>Target: 60 FPS</span>
            </div>
          </div>

          <!-- 2. CPU / Event Loop Load Chart -->
          <div class="sysmon-chart-card">
            <div class="sysmon-chart-header">
              <span class="sysmon-chart-title">⚙️ ${this.escapeHtml(this.t('sysmon.chart_cpu') || 'Charge Thread Principal (CPU %)')}</span>
              <span class="sysmon-chart-val" id="sysmonCpuLoadVal" style="color: ${this.cpuLoadEstimate > 50 ? '#ef4444' : '#38bdf8'};">${this.cpuLoadEstimate}%</span>
            </div>
            <div class="sysmon-canvas-wrapper">
              <canvas id="sysmonCpuCanvas" class="sysmon-chart-canvas"></canvas>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted);">
              <span>Lag: ${this.eventLoopLag} ms</span>
              <span>${cores} Cœurs CPU</span>
            </div>
          </div>

          <!-- 3. JS Heap Memory Chart -->
          <div class="sysmon-chart-card">
            <div class="sysmon-chart-header">
              <span class="sysmon-chart-title">🧠 ${this.escapeHtml(this.t('sysmon.chart_mem') || 'Mémoire Tas JS (Heap MB)')}</span>
              <span class="sysmon-chart-val" id="sysmonMemVal" style="color: #a855f7;">${jsHeap.split('/')[0].trim()}</span>
            </div>
            <div class="sysmon-canvas-wrapper">
              <canvas id="sysmonMemCanvas" class="sysmon-chart-canvas"></canvas>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted);">
              <span>RAM: ${devRam}</span>
              <span>Max: ${jsHeap.split('/')[1]?.trim() || 'N/A'}</span>
            </div>
          </div>
        </div>

        <!-- Hardware & Client Telemetry Pills -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <span class="sysmon-chip" style="font-size: 0.75rem;">
            ⚙️ <strong>Cœurs CPU :</strong> ${cores} threads
          </span>
          <span class="sysmon-chip" style="font-size: 0.75rem;">
            🧠 <strong>RAM Machine :</strong> ${devRam}
          </span>
          <span class="sysmon-chip ${this.cpuPressureState === 'nominal' ? 'enabled' : 'disabled'}" style="font-size: 0.75rem;">
            🌡️ <strong>Pression CPU :</strong> ${this.escapeHtml(this.cpuPressureState)}
          </span>
          <span class="sysmon-chip" style="font-size: 0.75rem;">
            ⏱️ <strong>Tâches Bloquantes (>50ms) :</strong> ${this.longTaskCount}
          </span>
        </div>

        <!-- Processes / Windows Table -->
        <div class="sysmon-card">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">🪟 Processus &amp; Applications en Cours d'Exécution (${windows.length})</h4>
          </div>

          <div class="sysmon-table-wrapper">
            <table class="sysmon-table">
              <thead>
                <tr>
                  <th>${this.escapeHtml(this.t('sysmon.proc_id') || 'ID / PID')}</th>
                  <th>${this.escapeHtml(this.t('sysmon.proc_app') || 'Application')}</th>
                  <th>${this.escapeHtml(this.t('sysmon.proc_title') || 'Titre de la Fenêtre')}</th>
                  <th>${this.escapeHtml(this.t('sysmon.proc_state') || 'État')}</th>
                  <th style="text-align: right;">${this.escapeHtml(this.t('sysmon.proc_actions') || 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${windows.length === 0 ? `
                  <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                      ${this.escapeHtml(this.t('sysmon.no_processes') || 'Aucune fenêtre active')}
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
                        ${isMin ? `<span class="sysmon-badge minimized">Minimisée</span>` : (isActive ? `<span class="sysmon-badge active">● Au Premier Plan</span>` : `<span class="sysmon-badge system">En arrière-plan</span>`)}
                      </td>
                      <td style="text-align: right;">
                        <div class="sysmon-actions-bar">
                          <button type="button" class="sysmon-action-btn sysmon-btn-focus" data-win-id="${this.escapeHtml(w.id)}" title="Mettre au premier plan">👁️</button>
                          <button type="button" class="sysmon-action-btn sysmon-btn-min" data-win-id="${this.escapeHtml(w.id)}" title="${isMin ? 'Restaurer' : 'Minimiser'}">${isMin ? '⬆️' : '➖'}</button>
                          <button type="button" class="sysmon-action-btn kill sysmon-btn-close" data-win-id="${this.escapeHtml(w.id)}" title="Fermer la fenêtre">✕</button>
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

    // -------------------------------------------------------------
    // SMOOTH CANVAS 2D SPARKLINE CHARTS
    // -------------------------------------------------------------
    drawAllCharts() {
      // 1. FPS Sparkline
      this.drawSparkline('sysmonFpsCanvas', this.fpsHistory, '#22c55e', 'rgba(34, 197, 94, 0.25)', 0, 75);

      // 2. CPU Load Sparkline
      this.drawSparkline('sysmonCpuCanvas', this.cpuLoadHistory, '#38bdf8', 'rgba(56, 189, 248, 0.25)', 0, 100);

      // 3. Memory Heap Sparkline
      const maxMem = Math.max(60, ...this.memHistory);
      this.drawSparkline('sysmonMemCanvas', this.memHistory, '#a855f7', 'rgba(168, 85, 247, 0.25)', 0, maxMem * 1.15);
    }

    drawSparkline(canvasId, data, strokeColor, fillColor, minVal = 0, maxVal = 100) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width || 240;
      const height = rect.height || 80;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Draw subtle background grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.33);
      ctx.lineTo(width, height * 0.33);
      ctx.moveTo(0, height * 0.66);
      ctx.lineTo(width, height * 0.66);
      ctx.stroke();

      if (!data || data.length < 2) {
        ctx.restore();
        return;
      }

      const step = width / (this.historyLength - 1);
      const range = maxVal - minVal || 1;

      const points = data.map((val, idx) => {
        const x = (this.historyLength - data.length + idx) * step;
        const normalized = (val - minVal) / range;
        const y = height - (normalized * (height - 12)) - 6;
        return { x, y: Math.max(4, Math.min(height - 4, y)) };
      });

      // 1. Create Smooth Area Path for Gradient Fill
      ctx.beginPath();
      ctx.moveTo(points[0].x, height);
      ctx.lineTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(points[points.length - 1].x, height);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 2. Stroke Smooth Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // 3. Current Value Highlighting Dot
      const last = points[points.length - 1];
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    bindProcessesEvents() {
      const container = document.getElementById('sysmonBodyContent');
      if (!container) return;

      container.querySelectorAll('.sysmon-btn-focus').forEach(btn => {
        btn.onclick = () => {
          const winId = btn.dataset.winId;
          if (window.WindowManager) window.WindowManager.focusWindow(winId);
          this.render();
        };
      });

      container.querySelectorAll('.sysmon-btn-min').forEach(btn => {
        btn.onclick = () => {
          const winId = btn.dataset.winId;
          if (window.WindowManager) window.WindowManager.toggleMinimize(winId);
          this.render();
        };
      });

      container.querySelectorAll('.sysmon-btn-close').forEach(btn => {
        btn.onclick = () => {
          const winId = btn.dataset.winId;
          if (window.WindowManager) window.WindowManager.closeWindow(winId);
          this.render();
        };
      });
    }

    // -------------------------------------------------------------
    // TAB 2: SERVER & PHP TELEMETRY
    // -------------------------------------------------------------
    renderServerTab() {
      const s = this.serverData || {};

      return `
        <!-- Server Storage & Memory Overview -->
        <div class="sysmon-gauges-grid">
          <div class="sysmon-gauge-card">
            <div class="sysmon-gauge-top">
              <span class="sysmon-gauge-label">💾 Espace Disque Utilisé</span>
              <span class="sysmon-gauge-val">${s.disk_used_percent || 0}%</span>
            </div>
            <div class="sysmon-progress-bar">
              <div class="sysmon-progress-fill ${(s.disk_used_percent || 0) > 85 ? 'danger' : ((s.disk_used_percent || 0) > 65 ? 'warning' : '')}" style="width: ${s.disk_used_percent || 0}%;"></div>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${s.disk_used_fmt || '0 B'} utilisé / ${s.disk_total_fmt || '0 B'} (${s.disk_free_fmt || '0 B'} libre)</span>
          </div>

          <div class="sysmon-gauge-card">
            <div class="sysmon-gauge-top">
              <span class="sysmon-gauge-label">🧠 Mémoire RAM PHP Allouée</span>
              <span class="sysmon-gauge-val">${s.memory_current_fmt || 'N/A'}</span>
            </div>
            <div class="sysmon-progress-bar">
              <div class="sysmon-progress-fill" style="width: 35%;"></div>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Pic : ${s.memory_peak_fmt || 'N/A'} • Limite : ${s.memory_limit || 'N/A'}</span>
          </div>
        </div>

        <!-- Host System & PHP Environment -->
        <div class="sysmon-card">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">🖥️ Environnement PHP &amp; Système Hôte</h4>
          </div>

          <div class="sysmon-info-grid">
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Système d'Exploitation Hôte</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.php_os || 'PHP_OS')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Version PHP</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.php_version || 'PHP')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Interface SAPI</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.php_sapi || 'CLI')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Moteur Zend</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.zend_version || 'Zend')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Serveur Web Hôte</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.server_software || 'PHP Built-in')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Taille Max Upload (upload_max_filesize)</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.upload_max_filesize || 'N/A')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Taille Max Post (post_max_size)</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.post_max_size || 'N/A')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Limite Mémoire PHP (memory_limit)</span>
              <span class="sysmon-info-val">${this.escapeHtml(s.memory_limit || 'N/A')}</span>
            </div>
          </div>
        </div>

        <!-- PHP Extensions Diagnostic -->
        <div class="sysmon-card">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">🧩 Extensions &amp; Modules PHP</h4>
          </div>

          <div class="sysmon-chips-grid">
            <span class="sysmon-chip ${s.gd_available ? 'enabled' : 'disabled'}">${s.gd_available ? '✓' : '✗'} GD Library</span>
            <span class="sysmon-chip ${s.gd_webp ? 'enabled' : 'disabled'}">${s.gd_webp ? '✓' : '✗'} WebP Support</span>
            <span class="sysmon-chip ${s.gd_avif ? 'enabled' : 'disabled'}">${s.gd_avif ? '✓' : '✗'} AVIF Support</span>
            <span class="sysmon-chip ${s.exif_available ? 'enabled' : 'disabled'}">${s.exif_available ? '✓' : '✗'} EXIF Parser</span>
            <span class="sysmon-chip ${s.zip_available ? 'enabled' : 'disabled'}">${s.zip_available ? '✓' : '✗'} ZipArchive</span>
            <span class="sysmon-chip ${s.intl_available ? 'enabled' : 'disabled'}">${s.intl_available ? '✓' : '✗'} Intl (i18n)</span>
            <span class="sysmon-chip ${s.pdo_available ? 'enabled' : 'disabled'}">${s.pdo_available ? '✓' : '✗'} PDO</span>
            <span class="sysmon-chip ${s.sqlite_available ? 'enabled' : 'disabled'}">${s.sqlite_available ? '✓' : '✗'} SQLite3</span>
            <span class="sysmon-chip ${s.curl_available ? 'enabled' : 'disabled'}">${s.curl_available ? '✓' : '✗'} cURL</span>
            <span class="sysmon-chip ${s.mbstring_available ? 'enabled' : 'disabled'}">${s.mbstring_available ? '✓' : '✗'} mbstring</span>
            <span class="sysmon-chip ${s.opcache_available ? 'enabled' : 'disabled'}">${s.opcache_available ? '✓' : '✗'} OPcache</span>
            <span class="sysmon-chip ${s.ffmpeg_available ? 'enabled' : 'disabled'}">${s.ffmpeg_available ? '✓' : '✗'} FFMPEG CLI</span>
          </div>
        </div>
      `;
    }

    // -------------------------------------------------------------
    // TAB 3: STORAGE & CACHE MANAGEMENT
    // -------------------------------------------------------------
    renderStorageTab() {
      const s = this.serverData || {};

      return `
        <div class="sysmon-card">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">💾 État des Caches &amp; Stockage Dérivé</h4>
            <button type="button" id="sysmonClearCacheBtn" class="sysmon-btn danger" title="Supprime le cache des dossiers et les miniatures">
              🗑️ ${this.escapeHtml(this.t('sysmon.clear_cache_btn') || 'Vider tous les caches')}
            </button>
          </div>

          <div class="sysmon-gauges-grid">
            <div class="sysmon-gauge-card">
              <div class="sysmon-gauge-top">
                <span class="sysmon-gauge-label">📁 Cache JSON des Dossiers</span>
                <span class="sysmon-gauge-val">${s.cache_count || 0}</span>
              </div>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Taille totale : <strong>${s.cache_size_fmt || '0 B'}</strong></span>
            </div>

            <div class="sysmon-gauge-card">
              <div class="sysmon-gauge-top">
                <span class="sysmon-gauge-label">🖼️ Miniatures Générées (WebP/JPG)</span>
                <span class="sysmon-gauge-val">${s.thumbs_count || 0}</span>
              </div>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Taille totale : <strong>${s.thumbs_size_fmt || '0 B'}</strong></span>
            </div>
          </div>
        </div>

        <div class="sysmon-card">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">⚡ Tests &amp; Diagnostics de Performance</h4>
          </div>

          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <button type="button" id="sysmonPingBtn" class="sysmon-btn">
              ⚡ ${this.escapeHtml(this.t('sysmon.ping_btn') || 'Tester la Latence API (Ping)')}
            </button>
            <span id="sysmonPingResult" style="font-size: 0.85rem; font-weight: 600; color: var(--accent-primary);"></span>
          </div>

          <div style="margin-top: 8px;">
            <button type="button" id="sysmonRunTestsBtn" class="sysmon-btn" style="background: var(--accent-primary, #6366f1); color: #fff;">
              🧪 ${this.escapeHtml(this.t('sysmon.run_tests_btn') || 'Lancer la Suite de Tests Unitaires (220 tests)')}
            </button>
          </div>
        </div>
      `;
    }

    bindStorageEvents() {
      const clearBtn = document.getElementById('sysmonClearCacheBtn');
      if (clearBtn) {
        clearBtn.onclick = () => this.clearCaches();
      }

      const pingBtn = document.getElementById('sysmonPingBtn');
      if (pingBtn) {
        pingBtn.onclick = () => this.pingApi();
      }

      const testsBtn = document.getElementById('sysmonRunTestsBtn');
      if (testsBtn) {
        testsBtn.onclick = () => this.runUnitTests();
      }
    }

    async clearCaches() {
      const confirmMsg = this.t('sysmon.clear_cache_confirm') || "Êtes-vous sûr de vouloir vider le cache et les miniatures ?";
      if (!confirm(confirmMsg)) return;

      try {
        const csrf = window.CSRF_TOKEN || (window.sys && window.sys.csrf) || '';
        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify({ action: 'clear_all_caches', csrf_token: csrf })
        });
        const json = await res.json();
        if (json.success) {
          const msg = this.t('sysmon.clear_cache_success', { count: json.deleted_count, freed: json.freed_fmt }) || `Cache vidé avec succès (${json.deleted_count} fichiers, ${json.freed_fmt} libérés).`;
          if (window.sys && window.sys.showToast) window.sys.showToast(msg, 'success');
          else alert(msg);
          this.refresh();
        } else {
          alert("Erreur : " + (json.error || "Échec de la purge du cache."));
        }
      } catch (e) {
        alert("Erreur réseau lors de la purge du cache : " + e.message);
      }
    }

    async pingApi() {
      const resultEl = document.getElementById('sysmonPingResult');
      if (resultEl) resultEl.textContent = 'Mesure en cours...';

      const t0 = performance.now();
      try {
        const res = await fetch('api.php?action=get_system_info&_t=' + Date.now());
        await res.json();
        const t1 = performance.now();
        const ms = Math.round(t1 - t0);
        const text = this.t('sysmon.ping_result', { ms }) || `Latence API : ${ms} ms`;
        if (resultEl) resultEl.textContent = text;
      } catch (e) {
        if (resultEl) resultEl.textContent = '⚠️ Erreur Ping';
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

    // -------------------------------------------------------------
    // TAB 4: BROWSER & CLIENT ENVIRONMENT
    // -------------------------------------------------------------
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
        <div class="sysmon-card">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">🌐 Navigateur Web &amp; Matériel Client</h4>
          </div>

          <div class="sysmon-info-grid">
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">User-Agent</span>
              <span class="sysmon-info-val" style="font-size: 0.72rem; word-break: break-all;">${this.escapeHtml(nav.userAgent || 'Unknown')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Plateforme Client</span>
              <span class="sysmon-info-val">${this.escapeHtml(nav.platform || 'Web')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Cœurs CPU (Threads Logiques)</span>
              <span class="sysmon-info-val">${nav.hardwareConcurrency || 'N/A'}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Mémoire RAM Machine Estimée</span>
              <span class="sysmon-info-val">${nav.deviceMemory ? `~${nav.deviceMemory} GB` : 'N/A'}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Langue du Navigateur</span>
              <span class="sysmon-info-val">${this.escapeHtml(nav.language || 'fr')}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Résolution d'Écran</span>
              <span class="sysmon-info-val">${screen.width || 0} × ${screen.height || 0} px</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Densité de Pixels (DPR)</span>
              <span class="sysmon-info-val">${window.devicePixelRatio || 1}x</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Profondeur de Couleurs</span>
              <span class="sysmon-info-val">${screen.colorDepth || 24} bits</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Statut de Connectivité</span>
              <span class="sysmon-info-val" style="color: ${nav.onLine ? '#22c55e' : '#ef4444'};">
                ${nav.onLine ? '● En Ligne' : '○ Hors Ligne'}
              </span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Quota Persistant (Storage Estimate)</span>
              <span class="sysmon-info-val">${quotaText}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">Stockage Local (localStorage)</span>
              <span class="sysmon-info-val">${storageUsage}</span>
            </div>
            <div class="sysmon-info-row">
              <span class="sysmon-info-label">État Pression CPU (Compute Pressure)</span>
              <span class="sysmon-info-val" style="color: ${this.cpuPressureState === 'nominal' ? '#22c55e' : '#f59e0b'};">${this.escapeHtml(this.cpuPressureState)}</span>
            </div>
          </div>
        </div>

        <div class="sysmon-card">
          <div class="sysmon-card-header">
            <h4 class="sysmon-card-title">🚀 Capacités HTML5 &amp; APIs Modernes</h4>
          </div>

          <div class="sysmon-chips-grid">
            <span class="sysmon-chip ${window.indexedDB ? 'enabled' : 'disabled'}">${window.indexedDB ? '✓' : '✗'} IndexedDB</span>
            <span class="sysmon-chip ${window.ServiceWorker ? 'enabled' : 'disabled'}">${window.ServiceWorker ? '✓' : '✗'} Service Worker</span>
            <span class="sysmon-chip ${window.WebSocket ? 'enabled' : 'disabled'}">${window.WebSocket ? '✓' : '✗'} WebSocket</span>
            <span class="sysmon-chip ${window.WebAssembly ? 'enabled' : 'disabled'}">${window.WebAssembly ? '✓' : '✗'} WebAssembly (Wasm)</span>
            <span class="sysmon-chip ${window.navigator.getGamepads ? 'enabled' : 'disabled'}">${window.navigator.getGamepads ? '✓' : '✗'} Gamepad API</span>
            <span class="sysmon-chip ${window.AudioContext || window.webkitAudioContext ? 'enabled' : 'disabled'}">${window.AudioContext || window.webkitAudioContext ? '✓' : '✗'} Web Audio API</span>
            <span class="sysmon-chip ${window.PerformanceObserver ? 'enabled' : 'disabled'}">${window.PerformanceObserver ? '✓' : '✗'} Performance Observer</span>
            <span class="sysmon-chip ${'PressureObserver' in window ? 'enabled' : 'disabled'}">${'PressureObserver' in window ? '✓' : '✗'} Compute Pressure API</span>
            <span class="sysmon-chip ${window.IntersectionObserver ? 'enabled' : 'disabled'}">${window.IntersectionObserver ? '✓' : '✗'} Intersection Observer</span>
            <span class="sysmon-chip ${window.ResizeObserver ? 'enabled' : 'disabled'}">${window.ResizeObserver ? '✓' : '✗'} Resize Observer</span>
          </div>
        </div>
      `;
    }

    bindBrowserEvents() {
      // Browser tab specific events if needed
    }

    onLocaleChanged() {
      if (window.WindowManager && window.WindowManager.windows.has(this.winId)) {
        const title = this.t('apps.system-monitor.title') || "Moniteur Système";
        const win = window.WindowManager.windows.get(this.winId);
        if (win) {
          win.setTitle(`📊 ${title}`);
        }
        this.render();
      }
    }

    onThemeChanged(themeId) {
      // Re-renders any dynamic gauge colors or styles and redraws charts
      this.render();
      setTimeout(() => this.drawAllCharts(), 50);
    }
  }

  // Initialize Singleton & Register in AppManager
  const instance = new SystemMonitorApp();
  window.SystemMonitorApp = instance;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('system-monitor', instance);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.sys && window.sys.appManager) {
        window.sys.appManager.registerInstance('system-monitor', instance);
      }
    });
  }

})(window);
