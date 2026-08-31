/**
 * SimpleGallery WebOS - Global Keyboard Shortcut Manager (`sys.shortcuts`)
 * Centralized keybinding registry for desktop navigation, window management, and file operations.
 */

(function(window, document) {
  'use strict';

  class ShortcutManager {
    constructor() {
      this.shortcuts = new Map(); // key: "scope:combo", value: { handler, options }
      this.enabled = true;
      this.activeScope = 'global';

      this._bindGlobalListener();
      this._registerDefaultSystemShortcuts();
    }

    /**
     * Register a keyboard shortcut
     * @param {string} combo - e.g. "ctrl+c", "alt+w", "delete", "f2", "ctrl+alt+t"
     * @param {Function} handler - callback(event)
     * @param {object} [options={}] - { scope, description, preventDefault, forceInInputs }
     */
    register(combo, handler, options = {}) {
      const normCombo = this._normalizeCombo(combo);
      const scope = options.scope || 'global';
      const key = `${scope}:${normCombo}`;

      this.shortcuts.set(key, {
        combo: normCombo,
        scope,
        handler,
        options: {
          preventDefault: options.preventDefault !== false,
          forceInInputs: !!options.forceInInputs,
          description: options.description || '',
          ...options
        }
      });
    }

    /**
     * Unregister a keyboard shortcut
     */
    unregister(combo, scope = 'global') {
      const normCombo = this._normalizeCombo(combo);
      this.shortcuts.delete(`${scope}:${normCombo}`);
    }

    /**
     * Set active scope (e.g. 'explorer', 'desktop', 'global')
     */
    setScope(scope) {
      this.activeScope = scope || 'global';
    }

    _normalizeCombo(combo) {
      return combo
        .toLowerCase()
        .replace(/\s+/g, '')
        .split('+')
        .sort((a, b) => {
          const order = { ctrl: 1, alt: 2, shift: 3, meta: 4, cmd: 4 };
          return (order[a] || 99) - (order[b] || 99);
        })
        .join('+');
    }

    _getEventCombo(e) {
      const parts = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      if (e.metaKey) parts.push('meta');

      let key = e.key.toLowerCase();
      if (key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') {
        return ''; // Modifier-only press
      }

      if (key === ' ') key = 'space';
      if (key === 'esc') key = 'escape';
      if (key === 'del') key = 'delete';

      parts.push(key);
      return this._normalizeCombo(parts.join('+'));
    }

    _isEditableElement(el) {
      if (!el) return false;
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el.isContentEditable ||
        el.getAttribute('contenteditable') === 'true'
      );
    }

    _bindGlobalListener() {
      window.addEventListener('keydown', (e) => {
        if (!this.enabled) return;

        const combo = this._getEventCombo(e);
        if (!combo) return;

        const isEditing = this._isEditableElement(document.activeElement);

        // 1. Try active scope first, then fallback to 'global'
        const scopedKey = `${this.activeScope}:${combo}`;
        const globalKey = `global:${combo}`;

        const entry = this.shortcuts.get(scopedKey) || this.shortcuts.get(globalKey);
        if (!entry) return;

        // If editing in input/textarea and shortcut is not explicitly allowed in inputs, do not intercept
        if (isEditing && !entry.options.forceInInputs) {
          return;
        }

        if (entry.options.preventDefault) {
          e.preventDefault();
        }

        try {
          entry.handler(e);
        } catch (err) {
          console.error(`[ShortcutManager] Error executing "${combo}":`, err);
        }
      });
    }

    _registerDefaultSystemShortcuts() {
      // 1. Window Management
      this.register('alt+w', () => {
        if (window.WindowManager && window.WindowManager.activeWindowId) {
          window.WindowManager.closeWindow(window.WindowManager.activeWindowId);
        }
      }, { description: 'Fermer la fenêtre active', forceInInputs: true });

      this.register('alt+m', () => {
        if (window.WindowManager && window.WindowManager.activeWindowId) {
          if (typeof window.WindowManager.toggleMaximize === 'function') {
            window.WindowManager.toggleMaximize(window.WindowManager.activeWindowId);
          } else if (typeof window.WindowManager.maximizeWindow === 'function') {
            window.WindowManager.maximizeWindow(window.WindowManager.activeWindowId);
          }
        }
      }, { description: 'Agrandir / Restaurer la fenêtre active', forceInInputs: true });

      this.register('alt+h', () => {
        if (window.WindowManager && typeof window.WindowManager.toggleShowDesktop === 'function') {
          window.WindowManager.toggleShowDesktop();
        } else if (window.WindowManager) {
          window.WindowManager.minimizeAll();
        }
      }, { description: 'Afficher le bureau', forceInInputs: true });

      this.register('ctrl+alt+d', () => {
        if (window.WindowManager && typeof window.WindowManager.toggleShowDesktop === 'function') {
          window.WindowManager.toggleShowDesktop();
        } else if (window.WindowManager) {
          window.WindowManager.minimizeAll();
        }
      }, { description: 'Afficher le bureau', forceInInputs: true });

      // 2. Global App Launchers
      this.register('ctrl+alt+t', () => {
        if (window.sys && window.sys.appManager) {
          window.sys.appManager.launchApp('system-monitor');
        }
      }, { description: 'Ouvrir le Moniteur Système', forceInInputs: true });

      this.register('ctrl+alt+e', () => {
        if (window.sys && window.sys.appManager) {
          window.sys.appManager.launchApp('explorer');
        }
      }, { description: 'Ouvrir l\'Explorateur de Fichiers', forceInInputs: true });

      this.register('ctrl+alt+s', () => {
        if (window.sys && window.sys.appManager) {
          window.sys.appManager.launchApp('settings');
        }
      }, { description: 'Ouvrir le Panneau de Configuration', forceInInputs: true });

      this.register('ctrl+alt+b', () => {
        if (window.sys && window.sys.appManager) {
          window.sys.appManager.launchApp('tribune');
        }
      }, { description: 'Ouvrir la Tribune Libre', forceInInputs: true });

      // 3. Close modal on Escape
      this.register('escape', () => {
        if (window.WindowManager && window.WindowManager.activeWindowId) {
          const win = window.WindowManager.windows.get(window.WindowManager.activeWindowId);
          if (win && win.isModal) {
            window.WindowManager.closeWindow(win.id);
          }
        }
      }, { description: 'Fermer dialogue modal', forceInInputs: true, preventDefault: false });
    }
  }

  window.sys = window.sys || {};
  window.sys.shortcuts = new ShortcutManager();
  window.ShortcutManager = window.sys.shortcuts;

})(window, document);
