/**
 * SimpleGallery WebOS - Taskbar Application (apps/taskbar/app.js)
 * Modular taskbar application:
 * - Always-on-top, frameless, fixed bottom window manager companion
 * - Colonizes the top bar with the Applications Menu launcher
 * - Renders dynamic taskbar pills for running windows with hover peeking
 * - Drives the live system clock, interactive calendar, and telemetry shortcut
 * - Can be disabled, replaced, or swapped via window.sys.taskbar APIs
 */
(function (window, document) {
  'use strict';

  class TaskbarApp extends (window.WebOSApp || Object) {
    constructor() {
      super({
        id: 'taskbar',
        title: 'apps.taskbar.title',
        icon: '📌',
        resizable: false
      });

      this.taskbarEl = null;
      this.appsContainerEl = null;
      this.trayContainerEl = null;
      this.clockTimer = null;
      this.hoverTimer = null;
      this._previouslyOpen = null;
      this._isHoveringPreview = false;

      // Register immediately with the Central Taskbar Service
      if (window.sys && window.sys.taskbar) {
        window.sys.taskbar.registerProvider(this);
      }
    }

    onInit() {
      this.initTaskbar();
    }

    /**
     * Called when TaskbarApp opens or boots
     */
    open() {
      this.initTaskbar();
    }

    init(windowManager) {
      this.wm = windowManager || window.WindowManager;
      this.initTaskbar();
    }

    initTaskbar() {
      this.taskbarEl = document.getElementById('webosTaskbar');
      if (!this.taskbarEl) return;

      this.appsContainerEl = document.getElementById('taskbarAppsContainer');
      this.trayContainerEl = document.getElementById('taskbarTrayContainer');

      this.bindSystemTray();
      this.startClock();
      this.colonizeTopMenuBar();

      if (window.WindowManager) {
        this.updateWindows(window.WindowManager.windows, window.WindowManager.activeWindowId);
      }
    }

    /**
     * Colonizes the top bar: binds the Application Launcher menu in the top bar
     */
    colonizeTopMenuBar() {
      const btn = document.getElementById('appLauncherBtn');
      const menu = document.getElementById('appLauncherMenu');
      if (!btn || !menu) return;

      if (!btn._taskbarBound) {
        btn._taskbarBound = true;
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

      // Also register with MenuBarManager if available
      if (window.MenuBarManager && typeof window.MenuBarManager.setDefaultMenu === 'function') {
        window.MenuBarManager.setDefaultMenu((container) => {
          // Default clean context bar
          container.innerHTML = '';
        });
      }
    }

    closeAppLauncher() {
      const menu = document.getElementById('appLauncherMenu');
      const btn = document.getElementById('appLauncherBtn');
      const flyout = document.getElementById('appLauncherFlyoutSubmenu');
      if (flyout && flyout.parentNode) {
        flyout.parentNode.removeChild(flyout);
      }
      if (menu) menu.style.display = 'none';
      if (btn) btn.classList.remove('active');
    }

    renderAppLauncherMenu() {
      const menuEl = document.getElementById('appLauncherMenu');
      const listEl = document.getElementById('appLauncherList');
      if (!menuEl || !listEl) return;

      const appMgr = window.sys && window.sys.appManager;
      const allApps = appMgr ? appMgr.getAllApps() : [];

      if (!allApps || allApps.length === 0) {
        listEl.innerHTML = `<div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">Aucune application enregistrée</div>`;
        return;
      }

      // Re-use desktop launcher rendering if available, or populate categories
      if (window.desktop && typeof window.desktop.renderAppLauncherMenu === 'function') {
        window.desktop.renderAppLauncherMenu();
      }
    }

    /**
     * Binds bottom right system tray buttons: System Monitor, Clock/Calendar, Show Desktop
     */
    bindSystemTray() {
      if (!this.taskbarEl) return;

      const sysmonBtn = this.taskbarEl.querySelector('#taskbarSysmonBtn');
      if (sysmonBtn && !sysmonBtn._bound) {
        sysmonBtn._bound = true;
        sysmonBtn.onclick = () => {
          if (window.SystemMonitorApp && typeof window.SystemMonitorApp.open === 'function') {
            window.SystemMonitorApp.open();
          } else if (window.sys && window.sys.appManager) {
            window.sys.appManager.launchApp('system-monitor');
          }
        };
      }

      const calBtn = this.taskbarEl.querySelector('#taskbarCalendarBtn');
      if (calBtn && !calBtn._bound) {
        calBtn._bound = true;
        calBtn.onclick = (e) => {
          e.stopPropagation();
          this.toggleCalendar();
        };
      }

      const showDesktopBtn = this.taskbarEl.querySelector('#taskbarShowDesktopBtn');
      if (showDesktopBtn && !showDesktopBtn._bound) {
        showDesktopBtn._bound = true;
        showDesktopBtn.onclick = () => this.toggleShowDesktop();
      }

      // Document click to close popovers
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#taskbarCalendarBtn') && !e.target.closest('#taskbarCalendarPopover')) {
          this.hideCalendar();
        }
      });
    }

    startClock() {
      if (this.clockTimer) clearInterval(this.clockTimer);

      const update = () => {
        const now = new Date();
        const timeEl = document.getElementById('taskbarClockTime');
        const dateEl = document.getElementById('taskbarClockDate');
        if (timeEl) {
          const h = String(now.getHours()).padStart(2, '0');
          const m = String(now.getMinutes()).padStart(2, '0');
          timeEl.textContent = `${h}:${m}`;
        }
        if (dateEl) {
          const d = String(now.getDate()).padStart(2, '0');
          const mo = String(now.getMonth() + 1).padStart(2, '0');
          dateEl.textContent = `${d}/${mo}`;
        }
      };

      update();
      this.clockTimer = setInterval(update, 1000);
    }

    /**
     * Renders or updates window pills in the taskbar
     * @param {Map|Array} windows
     * @param {string|null} activeWindowId
     */
    updateWindows(windows, activeWindowId) {
      const container = document.getElementById('taskbarAppsContainer');
      if (!container) return;

      container.innerHTML = '';
      if (!windows) return;

      const winList = (windows instanceof Map) ? Array.from(windows.values()) : Array.from(windows);

      winList.forEach(win => {
        const item = document.createElement('button');
        item.type = 'button';
        const isActive = (activeWindowId === win.id && win.state !== 'minimized');
        const isMin = (win.state === 'minimized');

        item.className = `taskbar-item ${isActive ? 'active' : ''} ${isMin ? 'minimized' : ''}`;
        item.title = win.title || '';
        item.innerHTML = `
          <span class="taskbar-icon">${win.icon || '📱'}</span>
          <span class="taskbar-label">${this.escapeHtml(win.title || '')}</span>
          <span class="taskbar-indicator"></span>
        `;

        // Click Handling
        item.onclick = () => {
          this.hidePreview();
          const wm = window.WindowManager;
          if (!wm) return;

          if (win.state === 'minimized') {
            wm.restoreWindow(win.id);
          } else if (wm.activeWindowId === win.id) {
            wm.minimizeWindow(win.id);
          } else {
            wm.focusWindow(win.id);
          }
        };

        // Hover Peeking Preview
        item.onmouseenter = () => {
          if (this.hoverTimer) clearTimeout(this.hoverTimer);
          this.hoverTimer = setTimeout(() => {
            this.showPreview(win, item);
          }, 150);
        };

        item.onmouseleave = () => {
          if (this.hoverTimer) clearTimeout(this.hoverTimer);
          setTimeout(() => {
            if (!this._isHoveringPreview) {
              this.hidePreview();
            }
          }, 120);
        };

        container.appendChild(item);
      });
    }

    showPreview(win, itemElement) {
      const preview = document.getElementById('taskbarPreviewCard');
      if (!preview || !win) return;

      const rect = itemElement.getBoundingClientRect();
      const wm = window.WindowManager;

      preview.innerHTML = `
        <div class="taskbar-preview-header">
          <span class="preview-icon">${win.icon || '📱'}</span>
          <span class="preview-title">${this.escapeHtml(win.title || '')}</span>
          <button type="button" class="preview-close-btn" title="Fermer (✕)">✕</button>
        </div>
        <div class="taskbar-preview-content">
          <div class="preview-thumbnail">
            <span class="preview-big-icon">${win.icon || '📱'}</span>
            <span class="preview-app-name">${this.escapeHtml(win.appName || win.appId || 'App')}</span>
          </div>
        </div>
      `;

      preview.onmouseenter = () => { this._isHoveringPreview = true; };
      preview.onmouseleave = () => {
        this._isHoveringPreview = false;
        this.hidePreview();
      };

      const closeBtn = preview.querySelector('.preview-close-btn');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          this.hidePreview();
          if (wm) wm.closeWindow(win.id);
        };
      }

      preview.style.display = 'block';
      const previewWidth = preview.offsetWidth || 230;
      const leftPos = Math.max(10, Math.min(window.innerWidth - previewWidth - 10, rect.left + (rect.width / 2) - (previewWidth / 2)));
      preview.style.left = `${leftPos}px`;
      preview.style.bottom = `${Math.max(48, window.innerHeight - rect.top + 8)}px`;
    }

    hidePreview() {
      const preview = document.getElementById('taskbarPreviewCard');
      if (preview) preview.style.display = 'none';
    }

    toggleShowDesktop() {
      const wm = window.WindowManager;
      if (!wm) return;

      const windows = Array.from(wm.windows.values());
      if (windows.length === 0) return;

      const nonMin = windows.filter(w => w.state !== 'minimized');
      if (nonMin.length > 0) {
        this._previouslyOpen = nonMin.map(w => w.id);
        windows.forEach(w => wm.minimizeWindow(w.id));
      } else if (this._previouslyOpen && this._previouslyOpen.length > 0) {
        this._previouslyOpen.forEach(id => wm.restoreWindow(id));
        this._previouslyOpen = null;
      } else {
        windows.forEach(w => wm.restoreWindow(w.id));
      }
    }

    toggleCalendar() {
      const popover = document.getElementById('taskbarCalendarPopover');
      if (!popover) return;

      if (popover.style.display !== 'none') {
        this.hideCalendar();
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const today = now.getDate();

      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const dayNames = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

      const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      let daysHtml = dayNames.map(d => `<span class="calendar-day-header">${d}</span>`).join('');

      for (let i = 0; i < firstDay; i++) {
        daysHtml += `<span class="calendar-day empty"></span>`;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (d === today);
        daysHtml += `<span class="calendar-day ${isToday ? 'today active' : ''}">${d}</span>`;
      }

      popover.innerHTML = `
        <div class="calendar-header">
          <span class="calendar-title">${monthNames[month]} ${year}</span>
          <span class="calendar-clock">${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}</span>
        </div>
        <div class="calendar-grid">
          ${daysHtml}
        </div>
      `;

      popover.style.display = 'block';
    }

    hideCalendar() {
      const popover = document.getElementById('taskbarCalendarPopover');
      if (popover) popover.style.display = 'none';
    }

    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /**
     * Clean unmount when replaced or disabled
     */
    unmount() {
      if (this.clockTimer) {
        clearInterval(this.clockTimer);
        this.clockTimer = null;
      }
      this.hidePreview();
      this.hideCalendar();
      if (this.taskbarEl) {
        this.taskbarEl.style.display = 'none';
      }
    }
  }

  // Register with WebOS App Runtime
  const taskbarAppInstance = new TaskbarApp();

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.register(taskbarAppInstance);
  }

  window.TaskbarApp = taskbarAppInstance;

  // Auto-mount on DOMContentLoaded or immediate
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => taskbarAppInstance.initTaskbar());
  } else {
    taskbarAppInstance.initTaskbar();
  }
})(window, document);
