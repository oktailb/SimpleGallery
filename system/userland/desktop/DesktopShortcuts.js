/**
 * SimpleGallery WebOS - Desktop Shortcuts Manager
 * Handles desktop icons grid, drag-and-drop creation, context menus, and persistence.
 */

(function (window, document) {
  'use strict';

  class DesktopShortcutsManager {
    constructor() {
      this.container = null;
      this.surface = null;
    }

    init() {
      this.container = document.getElementById('desktopShortcuts');
      this.surface = document.getElementById('desktopSurface');

      try {
        const local = localStorage.getItem('sg_desktop_shortcuts');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            window.SG_DESKTOP_CONFIG = window.SG_DESKTOP_CONFIG || {};
            window.SG_DESKTOP_CONFIG.shortcuts = parsed;
          }
        }
      } catch (e) {}

      this.render();
      this.initDropZone();
      this.initContextMenu();
    }

    render() {
      if (!this.container) this.container = document.getElementById('desktopShortcuts');
      if (!this.container) return;

      const config = window.SG_DESKTOP_CONFIG || {};
      const shortcuts = (config.shortcuts || []).filter(s => s.enabled !== false);

      if (shortcuts.length === 0) {
        this.container.innerHTML = '';
        return;
      }

      const appMgr = window.sys && window.sys.appManager;

      this.container.innerHTML = shortcuts.map(shortcut => {
        const type = shortcut.type || 'app';
        let label = shortcut.name || shortcut.defaultName || shortcut.appId || 'Raccourci';

        if (shortcut.nameKey && window.sys && window.sys.i18n) {
          const trans = window.sys.i18n.t(shortcut.nameKey);
          if (trans && trans !== shortcut.nameKey) label = trans;
        } else if (type === 'app' && appMgr && shortcut.appId) {
          label = appMgr.getAppTitle(shortcut.appId);
        }

        let iconContent = '';
        if (type === 'folder') {
          if (shortcut.cover_url) {
            iconContent = `<img src="${this.escapeHtml(shortcut.cover_url)}" class="desktop-shortcut-thumb" alt="${this.escapeHtml(label)}" /><span class="desktop-shortcut-badge">📁</span>`;
          } else {
            iconContent = shortcut.icon || '📁';
          }
        } else if (type === 'file') {
          if (shortcut.thumb_url) {
            iconContent = `<img src="${this.escapeHtml(shortcut.thumb_url)}" class="desktop-shortcut-thumb" alt="${this.escapeHtml(label)}" />`;
          } else {
            const fallbackIcon = window.IconHelper ? window.IconHelper.getFileIcon(shortcut) : '📄';
            iconContent = shortcut.icon || fallbackIcon;
          }
        } else {
          iconContent = shortcut.icon || (appMgr && appMgr.getAppIcon ? appMgr.getAppIcon(shortcut.appId) : '🗔');
        }

        return `
          <div class="desktop-shortcut-card" data-shortcut-id="${this.escapeHtml(shortcut.id)}" tabindex="0" title="${this.escapeHtml(label)}">
            <div class="desktop-shortcut-icon">${iconContent}</div>
            <div class="desktop-shortcut-label">${this.escapeHtml(label)}</div>
          </div>
        `;
      }).join('');

      this.container.querySelectorAll('.desktop-shortcut-card').forEach(card => {
        const id = card.dataset.shortcutId;
        const shortcut = shortcuts.find(s => s.id === id);
        if (!shortcut) return;

        card.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.launch(shortcut);
        });

        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            this.launch(shortcut);
          }
        });
      });
    }

    launch(shortcut) {
      if (!shortcut) return;
      const type = shortcut.type || 'app';

      if (type === 'app') {
        const appMgr = window.sys && window.sys.appManager;
        if (appMgr && typeof appMgr.launchApp === 'function') {
          appMgr.launchApp(shortcut.appId);
        }
      } else if (type === 'folder') {
        if (window.explorerApp && typeof window.explorerApp.open === 'function') {
          window.explorerApp.open({ initialPath: shortcut.path });
        }
      } else if (type === 'file') {
        const ext = '.' + (shortcut.extension || shortcut.path.split('.').pop() || '').toLowerCase();
        const cat = shortcut.category || (window.IconHelper ? window.IconHelper.getFileCategory(shortcut.name || shortcut.path) : 'other');

        if (cat === 'image' || cat === 'video' || cat === 'audio') {
          const appMgr = window.sys && window.sys.appManager;
          const targetApp = (cat === 'image') ? 'image-viewer' : (cat === 'video' ? 'video-player' : 'audio-player');
          if (appMgr && appMgr.isAppRegistered(targetApp)) {
            appMgr.launchApp(targetApp, { file: shortcut });
            return;
          }
        }

        if (window.explorerApp && typeof window.explorerApp.open === 'function') {
          window.explorerApp.open({ initialPath: shortcut.path });
        }
      }
    }

    initDropZone() {
      const dropZones = [document.getElementById('desktopSurface'), document.getElementById('webosDesktop')].filter(Boolean);

      dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
          if (e.dataTransfer.types.includes('application/sg-item') || e.dataTransfer.types.includes('application/json')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        });

        zone.addEventListener('drop', async (e) => {
          e.preventDefault();
          let itemData = window.SG_DRAGGING_ITEM_DATA;

          if (!itemData) {
            try {
              const raw = e.dataTransfer.getData('application/sg-item') || e.dataTransfer.getData('application/json');
              if (raw) itemData = JSON.parse(raw);
            } catch (err) {}
          }

          if (!itemData) return;

          window.SG_DESKTOP_CONFIG = window.SG_DESKTOP_CONFIG || {};
          window.SG_DESKTOP_CONFIG.shortcuts = window.SG_DESKTOP_CONFIG.shortcuts || [];

          if (itemData.type === 'app') {
            const exists = window.SG_DESKTOP_CONFIG.shortcuts.some(s => (s.type === 'app' || s.appId) && s.appId === itemData.appId);
            if (exists) {
              if (window.sys && window.sys.toast) window.sys.toast.info("Ce raccourci d'application existe déjà sur le bureau");
              return;
            }

            const newShortcut = {
              id: `sc_app_${itemData.appId}_${Date.now()}`,
              type: 'app',
              appId: itemData.appId,
              name: itemData.name,
              defaultName: itemData.defaultName || itemData.name,
              icon: itemData.icon || '🗔',
              enabled: true
            };

            window.SG_DESKTOP_CONFIG.shortcuts.push(newShortcut);
            this.render();
            await this.save();
            if (window.sys && window.sys.toast) window.sys.toast.success(`Raccourci ajouté : « ${newShortcut.name} »`);
            return;
          }

          const exists = window.SG_DESKTOP_CONFIG.shortcuts.some(s => s.path === itemData.path);
          if (exists) {
            if (window.sys && window.sys.toast) window.sys.toast.info('Ce raccourci existe déjà sur le bureau');
            return;
          }

          const newShortcut = {
            id: `sc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: itemData.type || 'file',
            path: itemData.path,
            name: itemData.name || itemData.path.split('/').pop(),
            defaultName: itemData.name || itemData.path.split('/').pop(),
            icon: itemData.icon || (itemData.type === 'folder' ? '📁' : '📄'),
            thumb_url: itemData.thumb_url || null,
            cover_url: itemData.cover_url || null,
            category: itemData.category || null,
            extension: itemData.extension || null,
            enabled: true
          };

          window.SG_DESKTOP_CONFIG.shortcuts.push(newShortcut);
          this.render();
          await this.save();
          if (window.sys && window.sys.toast) window.sys.toast.success(`Raccourci créé : « ${newShortcut.name} »`);
        });
      });
    }

    async save() {
      const csrfToken = window.CSRF_TOKEN || window.SG_CSRF_TOKEN || '';
      const shortcuts = (window.SG_DESKTOP_CONFIG && window.SG_DESKTOP_CONFIG.shortcuts) || [];

      try {
        localStorage.setItem('sg_desktop_shortcuts', JSON.stringify(shortcuts));
      } catch (e) {}

      try {
        const api = (window.sys && window.sys.api) || window.SyscallClient;
        if (api && typeof api.post === 'function') {
          const json = await api.post('save_desktop_shortcuts', { shortcuts });
          if (json && json.success && Array.isArray(json.shortcuts)) {
            window.SG_DESKTOP_CONFIG.shortcuts = json.shortcuts;
          }
        }
      } catch (e) {
        console.error('[DesktopShortcuts] Failed to save shortcuts:', e);
      }
    }

    initContextMenu() {
      if (!this.container) this.container = document.getElementById('desktopShortcuts');
      if (!this.container) return;

      this.container.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.desktop-shortcut-card');
        if (!card) return;

        e.preventDefault();
        e.stopPropagation();

        const shortcutId = card.dataset.shortcutId;
        const config = window.SG_DESKTOP_CONFIG || {};
        const shortcut = (config.shortcuts || []).find(s => s.id === shortcutId);
        if (!shortcut) return;

        const oldMenu = document.getElementById('desktopContextMenu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'desktopContextMenu';
        menu.className = 'custom-context-menu';
        menu.style.position = 'fixed';
        menu.style.zIndex = '999999';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 150)}px`;
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.minWidth = '180px';

        const icon = shortcut.icon || (shortcut.type === 'folder' ? '📁' : '📄');
        menu.innerHTML = `
          <div class="context-menu-header">
            <span>${icon}</span> <span>${this.escapeHtml(shortcut.name || shortcut.defaultName || shortcut.appId)}</span>
          </div>
          <button type="button" class="context-menu-item" id="desktopCtxOpen">
            <span>▶️</span> <span>Ouvrir</span>
          </button>
          <div class="context-menu-divider"></div>
          <button type="button" class="context-menu-item danger" id="desktopCtxDelete">
            <span>🗑️</span> <span>Supprimer le raccourci</span>
          </button>
        `;

        document.body.appendChild(menu);

        const closeMenu = () => {
          menu.remove();
          document.removeEventListener('click', closeMenu);
          document.removeEventListener('contextmenu', closeMenu);
        };

        setTimeout(() => document.addEventListener('click', closeMenu), 50);

        const openBtn = menu.querySelector('#desktopCtxOpen');
        if (openBtn) {
          openBtn.onclick = () => {
            closeMenu();
            this.launch(shortcut);
          };
        }

        const deleteBtn = menu.querySelector('#desktopCtxDelete');
        if (deleteBtn) {
          deleteBtn.onclick = async () => {
            closeMenu();
            window.SG_DESKTOP_CONFIG.shortcuts = (window.SG_DESKTOP_CONFIG.shortcuts || []).filter(s => s.id !== shortcutId);
            this.render();
            await this.save();
            if (window.sys && window.sys.toast) window.sys.toast.info('Raccourci supprimé du bureau');
          };
        }
      });
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  window.sys = window.sys || {};
  window.sys.desktopShortcuts = new DesktopShortcutsManager();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.sys.desktopShortcuts.init());
  } else {
    window.sys.desktopShortcuts.init();
  }

})(window, document);
