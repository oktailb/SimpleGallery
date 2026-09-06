/**
 * SimpleGallery WebOS - Central Taskbar Service (TaskbarService.js)
 * Provides registration, lifecycle management, and event relay for the active Taskbar Provider.
 * Allows the default taskbar app (apps/taskbar) to be replaced by custom docks or alternate panels.
 */
(function (window) {
  'use strict';

  class TaskbarService {
    constructor() {
      this.activeProvider = null;
      this.listeners = new Set();
    }

    /**
     * Registers an active taskbar provider
     * @param {Object} provider - Provider object implementing updateWindows, unmount, etc.
     */
    registerProvider(provider) {
      if (!provider) return;

      if (this.activeProvider && this.activeProvider !== provider) {
        try {
          if (typeof this.activeProvider.unmount === 'function') {
            this.activeProvider.unmount();
          }
        } catch (e) {
          console.warn('[TaskbarService] Error unmounting previous provider:', e);
        }
      }

      this.activeProvider = provider;

      if (window.WindowManager && typeof window.WindowManager.registerTaskbarProvider === 'function') {
        window.WindowManager.registerTaskbarProvider(provider);
      }

      if (typeof provider.init === 'function') {
        try {
          provider.init(window.WindowManager);
        } catch (e) {
          console.error('[TaskbarService] Error initializing provider:', e);
        }
      }

      if (window.EventBus) {
        window.EventBus.emit('taskbar:registered', { provider });
      }
    }

    /**
     * Unregisters the current taskbar provider
     * @param {Object} [provider] - Specific provider to unregister (or active if omitted)
     */
    unregisterProvider(provider) {
      if (!provider || this.activeProvider === provider) {
        if (this.activeProvider && typeof this.activeProvider.unmount === 'function') {
          try {
            this.activeProvider.unmount();
          } catch (e) {
            console.warn('[TaskbarService] Error unmounting provider:', e);
          }
        }
        this.activeProvider = null;

        if (window.WindowManager && typeof window.WindowManager.registerTaskbarProvider === 'function') {
          window.WindowManager.registerTaskbarProvider(null);
        }

        if (window.EventBus) {
          window.EventBus.emit('taskbar:unregistered');
        }
      }
    }

    /**
     * Returns the active taskbar provider instance
     * @returns {Object|null}
     */
    getProvider() {
      return this.activeProvider;
    }

    /**
     * Checks if a taskbar provider is currently registered and active
     * @returns {boolean}
     */
    isActive() {
      return !!this.activeProvider;
    }

    /**
     * Notifies active provider that window manager states have changed
     * @param {Map|Array} windows
     * @param {string|null} activeWindowId
     */
    notifyWindowsChanged(windows, activeWindowId) {
      if (this.activeProvider && typeof this.activeProvider.updateWindows === 'function') {
        try {
          this.activeProvider.updateWindows(windows, activeWindowId);
        } catch (e) {
          console.error('[TaskbarService] Error in provider.updateWindows:', e);
        }
      }
    }
  }

  window.sys = window.sys || {};
  window.sys.taskbar = new TaskbarService();

  // Wire with EventBus when ready
  if (window.EventBus) {
    window.EventBus.on('windows:change', (data) => {
      if (window.sys.taskbar) {
        window.sys.taskbar.notifyWindowsChanged(data?.windows, data?.activeWindowId);
      }
    });
  }
})(window);
