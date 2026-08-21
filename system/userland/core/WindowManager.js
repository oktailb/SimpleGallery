/**
 * SimpleGallery 2026 - WebOS Window Manager (WindowManager.js)
 * Universal, high-performance window manager with multi-window stacking,
 * snappy hardware-accelerated dragging, 8-direction resizing, and taskbar docking.
 */
(function(window) {
  'use strict';

  class WebOSWindowManager {
    constructor() {
      this.windows = new Map(); // id -> WindowInstance
      this.activeWindowId = null;
      this.baseZIndex = 100;
      this.topZIndex = 100;
      this.desktop = null;
      this.taskbar = null;
    }

    init() {
      this.desktop = document.getElementById('webosDesktop') || document.body;
      this.taskbar = document.getElementById('webosTaskbar');

      if (!this.taskbar) {
        this.taskbar = document.createElement('div');
        this.taskbar.id = 'webosTaskbar';
        this.taskbar.className = 'webos-taskbar';
        document.body.appendChild(this.taskbar);
      }

      // Close on Escape or click outside handlers
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.activeWindowId) {
          const win = this.windows.get(this.activeWindowId);
          if (win && win.isModal) {
            this.closeWindow(win.id);
          }
        }
      });

      if (window.sys && window.sys.events) {
        window.sys.events.on('locale:changed', ({ code }) => this.onLocaleChanged(code));
        window.sys.events.on('theme:changed', ({ themeId }) => this.onThemeChanged(themeId));
      }
      if (window.EventBus) {
        window.EventBus.on('theme:changed', ({ themeId }) => this.onThemeChanged(themeId));
      }
    }

    onThemeChanged(themeId) {
      this.windows.forEach(win => {
        if (win.element) {
          win.element.setAttribute('data-theme', themeId);
        }
      });
    }

    /**
     * Creates or retrieves a window
     * @param {Object} config - Window configuration
     */
    createWindow(config) {
      const id = config.id || `win-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      // If window already exists, bring it to focus
      if (this.windows.has(id)) {
        const existing = this.windows.get(id);
        if (existing.state === 'minimized') {
          this.restoreWindow(id);
        }
        this.focusWindow(id);
        return existing;
      }

      const defaultW = Math.min(window.innerWidth * 0.85, config.width || 880);
      const defaultH = Math.min(window.innerHeight * 0.80, config.height || 580);
      const defaultX = Math.max(20, (window.innerWidth - defaultW) / 2 + (this.windows.size * 25) % 150);
      const defaultY = Math.max(60, (window.innerHeight - defaultH) / 2 + (this.windows.size * 25) % 150);

      const win = {
        id: id,
        appId: config.appId || 'app',
        appName: config.appName || 'Application',
        fileName: config.fileName || '',
        title: config.title || `${config.appName || 'Application'}${config.fileName ? ` : ${config.fileName}` : ''}`,
        icon: config.icon || '🗔',
        state: config.state || (config.isMaximized ? 'maximized' : 'floating'), // 'floating' | 'maximized' | 'minimized' | 'fullscreen'
        x: defaultX,
        y: defaultY,
        width: defaultW,
        height: defaultH,
        prevBounds: { x: defaultX, y: defaultY, width: defaultW, height: defaultH },
        minWidth: config.minWidth || 320,
        minHeight: config.minHeight || 220,
        isModal: !!config.isModal,
        isClosable: config.isClosable !== false,
        isMinimizable: config.isMinimizable !== false,
        isMaximizable: config.isMaximizable !== false,
        isDraggable: config.isDraggable !== false,
        isResizable: config.isResizable !== false,
        zIndex: ++this.topZIndex,
        element: null,
        headerEl: null,
        bodyEl: null,
        taskbarEl: null,
        onClose: config.onClose || null,
        onResize: config.onResize || null,
        onFocus: config.onFocus || null
      };

      this.windows.set(id, win);
      this.renderWindowDOM(win, config);
      this.updateTaskbar();
      this.focusWindow(id);

      if (win.state === 'maximized') {
        this.applyMaximized(win);
      } else {
        this.applyBounds(win);
      }

      if (window.EventBus) {
        window.EventBus.emit('window:create', { windowId: id, appId: win.appId, win });
      }

      return win;
    }

    renderWindowDOM(win, config) {
      const el = document.createElement('div');
      el.id = `window-${win.id}`;
      el.className = `webos-window app-${win.appId} ${win.state === 'maximized' ? 'is-maximized' : ''}`;
      el.style.zIndex = win.zIndex;
      
      const curTheme = document.documentElement.getAttribute('data-theme') || (window.localStorage && window.localStorage.getItem('sg_active_theme')) || 'dark-glass';
      el.setAttribute('data-theme', curTheme);

      el.innerHTML = `
        <div class="window-header">
          <div class="window-traffic-lights">
            ${win.isClosable ? `<button type="button" class="win-btn win-close" title="Fermer (✕)">✕</button>` : ''}
            ${win.isMinimizable ? `<button type="button" class="win-btn win-minimize" title="Minimiser (🗕)">−</button>` : ''}
            ${win.isMaximizable ? `<button type="button" class="win-btn win-maximize" title="Maximiser / Restaurer (🗖)">🗖</button>` : ''}
          </div>
          <div class="window-title-group">
            <span class="window-icon">${win.icon}</span>
            <span class="window-title-text">${this.escapeHtml(win.title)}</span>
          </div>
          <div class="window-header-actions" id="win-actions-${win.id}"></div>
        </div>
        <div class="window-body" id="win-body-${win.id}"></div>
        ${win.isResizable ? `
          <div class="win-resize-handle res-n" data-handle="n"></div>
          <div class="win-resize-handle res-s" data-handle="s"></div>
          <div class="win-resize-handle res-e" data-handle="e"></div>
          <div class="win-resize-handle res-w" data-handle="w"></div>
          <div class="win-resize-handle res-ne" data-handle="ne"></div>
          <div class="win-resize-handle res-nw" data-handle="nw"></div>
          <div class="win-resize-handle res-se" data-handle="se"></div>
          <div class="win-resize-handle res-sw" data-handle="sw"></div>
        ` : ''}
      `;

      if (!this.desktop) this.init();
      const mountPoint = this.desktop || document.getElementById('webosDesktop') || document.body;
      mountPoint.appendChild(el);

      win.element = el;
      win.headerEl = el.querySelector('.window-header');
      win.bodyEl = el.querySelector('.window-body');
      win.actionsEl = el.querySelector('.window-header-actions');

      // Populate content if provided
      if (config.content) {
        if (typeof config.content === 'string') {
          win.bodyEl.innerHTML = config.content;
        } else if (config.content instanceof HTMLElement) {
          win.bodyEl.appendChild(config.content);
        }
      }

      // Bind Window Controls
      const closeBtn = el.querySelector('.win-close');
      const minBtn = el.querySelector('.win-minimize');
      const maxBtn = el.querySelector('.win-maximize');

      if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); this.closeWindow(win.id); };
      if (minBtn) minBtn.onclick = (e) => { e.stopPropagation(); this.minimizeWindow(win.id); };
      if (maxBtn) maxBtn.onclick = (e) => { e.stopPropagation(); this.toggleMaximize(win.id); };

      // Focus on mousedown / touchstart
      el.addEventListener('pointerdown', () => this.focusWindow(win.id), { passive: true });

      // Double click header to toggle maximize
      if (win.isMaximizable && win.headerEl) {
        win.headerEl.addEventListener('dblclick', (e) => {
          if (e.target.closest('button, input, a, .window-header-actions')) return;
          this.toggleMaximize(win.id);
        });
      }

      // Snappy Hardware-Accelerated Dragging
      if (win.isDraggable && win.headerEl) {
        this.bindWindowDragging(win);
      }

      // 8-Direction Resizing
      if (win.isResizable) {
        this.bindWindowResizing(win);
      }
    }

    /**
     * Snappy 60fps Hardware-Accelerated Dragging
     */
    bindWindowDragging(win) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialWinX = 0;
      let initialWinY = 0;
      let currentTransformX = 0;
      let currentTransformY = 0;
      let rafId = null;

      const header = win.headerEl;

      const onPointerDown = (e) => {
        if (win.state === 'maximized' || win.state === 'fullscreen') return;
        if (e.target.closest('button, input, a, select, textarea, .window-header-actions')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialWinX = win.x;
        initialWinY = win.y;
        currentTransformX = 0;
        currentTransformY = 0;

        win.element.classList.add('is-dragging');
        header.setPointerCapture?.(e.pointerId);
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        currentTransformX = dx;
        currentTransformY = dy;

        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            if (isDragging) {
              win.element.style.transform = `translate3d(${currentTransformX}px, ${currentTransformY}px, 0)`;
            }
            rafId = null;
          });
        }
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;

        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        win.element.classList.remove('is-dragging');
        header.releasePointerCapture?.(e.pointerId);

        // Commit final coordinates
        const newX = Math.max(-win.width + 100, Math.min(window.innerWidth - 100, initialWinX + currentTransformX));
        const newY = Math.max(40, Math.min(window.innerHeight - 80, initialWinY + currentTransformY));

        win.x = newX;
        win.y = newY;
        win.element.style.transform = 'none';
        win.element.style.left = `${win.x}px`;
        win.element.style.top = `${win.y}px`;
      };

      header.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }

    /**
     * 8-Direction Resizing Engine
     */
    bindWindowResizing(win) {
      let isResizing = false;
      let activeHandle = null;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;
      let startPosX = 0;
      let startPosY = 0;

      const handles = win.element.querySelectorAll('.win-resize-handle');
      handles.forEach(handle => {
        handle.addEventListener('pointerdown', (e) => {
          if (win.state === 'maximized' || win.state === 'fullscreen') return;
          e.stopPropagation();
          e.preventDefault();

          isResizing = true;
          activeHandle = handle.dataset.handle;
          startX = e.clientX;
          startY = e.clientY;
          startW = win.width;
          startH = win.height;
          startPosX = win.x;
          startPosY = win.y;

          win.element.classList.add('is-resizing');
          handle.setPointerCapture?.(e.pointerId);
        });
      });

      window.addEventListener('pointermove', (e) => {
        if (!isResizing || !activeHandle) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW = startW;
        let newH = startH;
        let newX = startPosX;
        let newY = startPosY;

        if (activeHandle.includes('e')) newW = Math.max(win.minWidth, startW + dx);
        if (activeHandle.includes('s')) newH = Math.max(win.minHeight, startH + dy);
        if (activeHandle.includes('w')) {
          const adjW = Math.max(win.minWidth, startW - dx);
          newX = startPosX + (startW - adjW);
          newW = adjW;
        }
        if (activeHandle.includes('n')) {
          const adjH = Math.max(win.minHeight, startH - dy);
          newY = startPosY + (startH - adjH);
          newH = adjH;
        }

        win.x = newX;
        win.y = newY;
        win.width = newW;
        win.height = newH;
        this.applyBounds(win);
      });

      const onResizeEnd = (e) => {
        if (!isResizing) return;
        isResizing = false;
        activeHandle = null;
        win.element.classList.remove('is-resizing');
      };

      window.addEventListener('pointerup', onResizeEnd);
      window.addEventListener('pointercancel', onResizeEnd);
    }

    applyBounds(win) {
      if (!win.element) return;
      win.element.style.left = `${win.x}px`;
      win.element.style.top = `${win.y}px`;
      win.element.style.width = `${win.width}px`;
      win.element.style.height = `${win.height}px`;
      win.element.style.transform = 'none';
    }

    applyMaximized(win) {
      if (!win.element) return;
      win.element.classList.add('is-maximized');
      win.element.style.left = '0px';
      win.element.style.top = '52px';
      win.element.style.width = '100vw';
      win.element.style.height = 'calc(100vh - 94px)'; // Leave room for top bar (52px) and taskbar (42px)
      win.element.style.transform = 'none';

      const maxBtn = win.element.querySelector('.win-maximize');
      if (maxBtn) {
        maxBtn.title = 'Restaurer (🗗)';
      }
    }

    focusWindow(id) {
      const win = this.windows.get(id);
      if (!win || !win.element) return;

      const wasAlreadyActive = (this.activeWindowId === id);

      this.activeWindowId = id;
      win.zIndex = ++this.topZIndex;
      win.element.style.zIndex = win.zIndex;

      // Update active styling
      this.windows.forEach(w => {
        if (w.element) {
          w.element.classList.toggle('is-active', w.id === id);
        }
      });

      this.updateTaskbar();

      if (!wasAlreadyActive) {
        // Emit focus event to MenuBarManager and EventBus
        if (window.EventBus) {
          window.EventBus.emit('window:focus', { windowId: id, appId: win.appId, win });
        }

        if (typeof win.onFocus === 'function') {
          win.onFocus(win);
        }
      }
    }

    minimizeWindow(id) {
      const win = this.windows.get(id);
      if (!win || !win.element) return;

      win.state = 'minimized';
      win.element.classList.add('is-minimized');
      win.element.style.display = 'none';

      this.updateTaskbar();

      // Focus next top window
      const remaining = Array.from(this.windows.values())
        .filter(w => w.state !== 'minimized')
        .sort((a, b) => b.zIndex - a.zIndex);

      if (remaining.length > 0) {
        this.focusWindow(remaining[0].id);
      } else {
        this.activeWindowId = null;
        if (window.MenuBarManager) {
          window.MenuBarManager.restoreDefaultMenu();
        }
      }
    }

    restoreWindow(id) {
      const win = this.windows.get(id);
      if (!win || !win.element) return;

      win.element.style.display = 'flex';
      win.element.classList.remove('is-minimized');

      if (win.state === 'maximized') {
        this.applyMaximized(win);
      } else {
        win.state = 'floating';
        this.applyBounds(win);
      }

      this.focusWindow(id);
    }

    toggleMaximize(id) {
      const win = this.windows.get(id);
      if (!win || !win.element) return;

      if (win.state === 'maximized') {
        win.state = 'floating';
        win.element.classList.remove('is-maximized');

        const fallbackW = Math.min(880, Math.max(480, Math.round(window.innerWidth * 0.75)));
        const fallbackH = Math.min(580, Math.max(360, Math.round(window.innerHeight * 0.70)));
        const fallbackX = Math.max(20, Math.round((window.innerWidth - fallbackW) / 2));
        const fallbackY = Math.max(60, Math.round((window.innerHeight - fallbackH) / 2));

        const hasValidPrev = win.prevBounds &&
                             win.prevBounds.width > 200 &&
                             win.prevBounds.height > 150 &&
                             win.prevBounds.width < (window.innerWidth - 40);

        win.x = hasValidPrev ? win.prevBounds.x : fallbackX;
        win.y = hasValidPrev ? win.prevBounds.y : fallbackY;
        win.width = hasValidPrev ? win.prevBounds.width : fallbackW;
        win.height = hasValidPrev ? win.prevBounds.height : fallbackH;

        this.applyBounds(win);

        const maxBtn = win.element.querySelector('.win-maximize');
        if (maxBtn) {
          maxBtn.title = 'Maximiser (🗖)';
        }
      } else {
        win.prevBounds = { x: win.x, y: win.y, width: win.width, height: win.height };
        win.state = 'maximized';
        this.applyMaximized(win);
      }

      this.updateTaskbar();
    }

    closeWindow(id) {
      const win = this.windows.get(id);
      if (!win) return;

      if (typeof win.onClose === 'function') {
        win.onClose(win);
      }

      if (win.element && win.element.parentNode) {
        win.element.parentNode.removeChild(win.element);
      }

      this.windows.delete(id);
      this.updateTaskbar();

      if (window.EventBus) {
        window.EventBus.emit('window:close', { windowId: id, appId: win.appId });
      }

      // Focus next top window
      const remaining = Array.from(this.windows.values())
        .filter(w => w.state !== 'minimized')
        .sort((a, b) => b.zIndex - a.zIndex);

      if (remaining.length > 0) {
        this.focusWindow(remaining[0].id);
      } else {
        this.activeWindowId = null;
        if (window.MenuBarManager) {
          window.MenuBarManager.restoreDefaultMenu();
        }
      }
    }

    updateTaskbar() {
      if (!this.taskbar) return;
      this.taskbar.innerHTML = '';

      this.windows.forEach(win => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `taskbar-item ${this.activeWindowId === win.id ? 'active' : ''} ${win.state === 'minimized' ? 'minimized' : ''}`;
        item.title = win.title;
        item.innerHTML = `
          <span class="taskbar-icon">${win.icon}</span>
          <span class="taskbar-label">${this.escapeHtml(win.title)}</span>
        `;

        item.onclick = () => {
          if (win.state === 'minimized') {
            this.restoreWindow(win.id);
          } else if (this.activeWindowId === win.id) {
            this.minimizeWindow(win.id);
          } else {
            this.focusWindow(win.id);
          }
        };

        this.taskbar.appendChild(item);
      });
    }

    setTitle(id, title) {
      const win = this.windows.get(id);
      if (!win) return;
      win.title = title;
      const titleEl = win.element?.querySelector('.window-title-text');
      if (titleEl) titleEl.textContent = title;
      this.updateTaskbar();
    }

    onLocaleChanged(code) {
      this.windows.forEach(win => {
        const appTitle = (window.sys && window.sys.appManager)
          ? window.sys.appManager.getAppTitle(win.appId)
          : win.appName;

        win.appName = appTitle;
        win.title = `${appTitle}${win.fileName ? ` : ${win.fileName}` : ''}`;

        if (win.element) {
          const titleEl = win.element.querySelector('.window-title-text');
          if (titleEl) {
            titleEl.textContent = win.title;
          }
        }

        if (typeof win.onLocaleChanged === 'function') {
          try {
            win.onLocaleChanged(code);
          } catch (e) {
            console.error('[WindowManager] Error in win.onLocaleChanged', e);
          }
        }
      });

      this.updateTaskbar();

      // Re-trigger onFocus on active window to update the active top contextual menubar
      if (this.activeWindowId && this.windows.has(this.activeWindowId)) {
        const activeWin = this.windows.get(this.activeWindowId);
        if (typeof activeWin.onFocus === 'function') {
          try {
            activeWin.onFocus();
          } catch (e) {
            console.error('[WindowManager] Error refreshing active window onFocus', e);
          }
        }
      }
    }

    escapeHtml(str) {
      if (typeof str !== 'string') return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  window.WindowManager = new WebOSWindowManager();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.WindowManager.init());
  } else {
    window.WindowManager.init();
  }
})(window);
