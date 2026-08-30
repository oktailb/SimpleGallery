/**
 * SimpleGallery WebOS - Unified File & Folder Picker Service
 * Provides modal browsing and selection dialog for applications (`window.sys.pickFile`, `window.sys.pickFolder`).
 */

(function (window, document) {
  'use strict';

  window.sys = window.sys || {};

  class FilePickerService {
    constructor() {
      this.activeDialog = null;
    }

    /**
     * Pick one or multiple files from the gallery storage
     * @param {Object} options { title, initialPath, accept, multiple }
     * @returns {Promise<Object|Array<Object>|null>} Selected file(s) or null if cancelled
     */
    pickFile(options = {}) {
      return this._openDialog({
        ...options,
        selectFolder: false,
        title: options.title || 'Sélectionner un fichier'
      });
    }

    /**
     * Pick a folder from the gallery storage
     * @param {Object} options { title, initialPath }
     * @returns {Promise<Object|null>} Selected folder or null if cancelled
     */
    pickFolder(options = {}) {
      return this._openDialog({
        ...options,
        selectFolder: true,
        multiple: false,
        title: options.title || 'Sélectionner un dossier'
      });
    }

    /**
     * Modal compatibility method supporting onSelect / onCancel callbacks
     * @param {Object} options { title, initialPath, accept, allowMultiple, onSelect, onCancel }
     */
    openModal(options = {}) {
      const opts = {
        title: options.title || 'Sélectionner un fichier',
        initialPath: options.initialPath || '',
        accept: options.accept || '*/*',
        multiple: Boolean(options.allowMultiple || options.multiple),
        selectFolder: Boolean(options.selectFolder)
      };

      return this._openDialog(opts).then((result) => {
        if (result && typeof options.onSelect === 'function') {
          options.onSelect(result);
        }
        if (!result && typeof options.onCancel === 'function') {
          options.onCancel();
        }
        return result;
      });
    }

    open(options = {}) {
      return this.openModal(options);
    }

    _openDialog(options) {
      return new Promise((resolve) => {
        if (this.activeDialog) {
          this.activeDialog.close(null);
        }

        const isFolderMode = Boolean(options.selectFolder);
        const isMultiple = Boolean(options.multiple);
        const acceptFilter = options.accept || '*/*';
        let currentPath = options.initialPath || '';
        let selectedItems = new Map();

        // Create Modal Overlay
        const overlay = document.createElement('div');
        overlay.className = 'webos-file-picker-overlay';
        overlay.style.cssText = `
          position: fixed; inset: 0; z-index: 100000;
          background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px; animation: pickerFadeIn 0.2s ease-out;
        `;

        // Create Dialog Window
        const dialog = document.createElement('div');
        dialog.className = 'webos-file-picker-dialog';
        dialog.style.cssText = `
          width: 820px; max-width: 96vw; height: 600px; max-height: 90vh;
          background: var(--bg-card, #1e293b); color: var(--text-main, #f8fafc);
          border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          display: flex; flex-direction: column; overflow: hidden;
        `;

        dialog.innerHTML = `
          <div class="picker-header" style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2);">
            <div style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px;">
              <span>${isFolderMode ? '📁' : '📄'}</span>
              <span>${options.title}</span>
            </div>
            <button type="button" class="picker-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 6px;">&times;</button>
          </div>

          <div class="picker-toolbar" style="padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.1);">
            <button type="button" class="picker-up-btn" style="padding: 6px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #cbd5e1; cursor: pointer; font-size: 13px;">⬆ Dossier parent</button>
            <div class="picker-breadcrumbs" style="flex: 1; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #94a3b8; overflow-x: auto; white-space: nowrap;"></div>
            <input type="text" class="picker-search-input" placeholder="Filtrer..." style="width: 160px; padding: 6px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px;">
          </div>

          <div class="picker-content" style="flex: 1; overflow-y: auto; padding: 16px 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); grid-auto-rows: max-content; gap: 14px;">
            <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 40px;">Chargement des fichiers...</div>
          </div>

          <div class="picker-footer" style="padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2);">
            <div class="picker-selection-info" style="font-size: 13px; color: #94a3b8;">Aucun élément sélectionné</div>
            <div style="display: flex; gap: 10px;">
              <button type="button" class="picker-cancel-btn" style="padding: 8px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #cbd5e1; cursor: pointer; font-size: 13px;">Annuler</button>
              <button type="button" class="picker-confirm-btn" style="padding: 8px 18px; background: #3b82f6; border: none; border-radius: 6px; color: #fff; font-weight: 500; cursor: pointer; font-size: 13px; opacity: 0.5;" disabled>Sélectionner</button>
            </div>
          </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const contentEl = dialog.querySelector('.picker-content');
        const breadcrumbsEl = dialog.querySelector('.picker-breadcrumbs');
        const searchInput = dialog.querySelector('.picker-search-input');
        const upBtn = dialog.querySelector('.picker-up-btn');
        const closeBtn = dialog.querySelector('.picker-close-btn');
        const cancelBtn = dialog.querySelector('.picker-cancel-btn');
        const confirmBtn = dialog.querySelector('.picker-confirm-btn');
        const selectionInfo = dialog.querySelector('.picker-selection-info');

        const closeDialog = (result) => {
          overlay.remove();
          this.activeDialog = null;
          resolve(result);
        };

        this.activeDialog = { close: closeDialog };

        const updateSelectionUI = () => {
          const count = selectedItems.size;
          if (count === 0) {
            selectionInfo.textContent = 'Aucun élément sélectionné';
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
          } else {
            const first = Array.from(selectedItems.values())[0];
            selectionInfo.textContent = (count === 1) ? `Sélectionné : « ${first.name} »` : `${count} éléments sélectionnés`;
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
          }
        };

        const isItemAccepted = (file) => {
          if (!acceptFilter || acceptFilter === '*/*') return true;
          const ext = '.' + (file.extension || '').toLowerCase();
          const category = (file.category || '').toLowerCase();

          if (acceptFilter === 'image/*' && category === 'image') return true;
          if (acceptFilter === 'video/*' && category === 'video') return true;
          if (acceptFilter === 'audio/*' && category === 'audio') return true;

          const filters = acceptFilter.split(',').map(f => f.trim().toLowerCase());
          return filters.some(f => f === ext || f === file.extension || f === category);
        };

        const loadDirectory = async (dirPath) => {
          currentPath = dirPath;
          contentEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 40px;">Chargement...</div>`;

          try {
            const api = (window.sys && window.sys.api) || window.SyscallClient;
            const res = await fetch(`system/endpoints/api.php?action=get_gallery&dir=${encodeURIComponent(dirPath)}`);
            const data = await res.json();

            if (!data || !data.success) {
              contentEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 40px;">Erreur de chargement du dossier.</div>`;
              return;
            }

            // Render Breadcrumbs
            breadcrumbsEl.innerHTML = '';
            const bc = data.breadcrumbs || [{ name: 'Stockage', path: '' }];
            bc.forEach((b, i) => {
              const span = document.createElement('span');
              span.textContent = b.name;
              span.style.cursor = 'pointer';
              span.style.color = (i === bc.length - 1) ? '#f8fafc' : '#38bdf8';
              span.addEventListener('click', () => loadDirectory(b.path));
              breadcrumbsEl.appendChild(span);
              if (i < bc.length - 1) {
                const sep = document.createElement('span');
                sep.textContent = ' / ';
                breadcrumbsEl.appendChild(sep);
              }
            });

            upBtn.disabled = !data.parent_path && data.current_path === '';
            upBtn.style.opacity = upBtn.disabled ? '0.4' : '1';

            // Filter items
            const dirs = data.directories || [];
            let files = data.files || [];
            if (!isFolderMode) {
              files = files.filter(isItemAccepted);
            }

            contentEl.innerHTML = '';

            if (dirs.length === 0 && files.length === 0) {
              contentEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 40px;">Ce dossier est vide.</div>`;
              return;
            }

            // Render Folders
            dirs.forEach(dir => {
              const card = document.createElement('div');
              card.className = 'picker-item picker-folder';
              card.dataset.path = dir.path;
              card.style.cssText = `
                padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08); text-align: center; cursor: pointer;
                display: flex; flex-direction: column; align-items: center; gap: 6px; user-select: none;
                transition: background 0.15s, border-color 0.15s;
              `;

              card.innerHTML = `
                <div style="font-size: 34px; line-height: 1;">📁</div>
                <div style="font-size: 12px; font-weight: 500; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${dir.name}</div>
                <div style="font-size: 10px; color: #94a3b8;">${dir.item_count || 0} éléments</div>
              `;

              card.addEventListener('mouseenter', () => card.style.background = 'rgba(255,255,255,0.08)');
              card.addEventListener('mouseleave', () => {
                if (!selectedItems.has(dir.path)) card.style.background = 'rgba(255,255,255,0.03)';
              });

              if (isFolderMode) {
                card.addEventListener('click', () => {
                  selectedItems.clear();
                  selectedItems.set(dir.path, dir);
                  contentEl.querySelectorAll('.picker-item').forEach(el => {
                    el.style.background = 'rgba(255,255,255,0.03)';
                    el.style.borderColor = 'rgba(255,255,255,0.08)';
                  });
                  card.style.background = 'rgba(59, 130, 246, 0.2)';
                  card.style.borderColor = '#3b82f6';
                  updateSelectionUI();
                });
                card.addEventListener('dblclick', () => loadDirectory(dir.path));
              } else {
                card.addEventListener('click', () => loadDirectory(dir.path));
              }

              contentEl.appendChild(card);
            });

            // Render Files
            if (!isFolderMode) {
              files.forEach(file => {
                const card = document.createElement('div');
                card.className = 'picker-item picker-file';
                card.dataset.path = file.path;
                card.style.cssText = `
                  padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.03);
                  border: 1px solid rgba(255,255,255,0.08); text-align: center; cursor: pointer;
                  display: flex; flex-direction: column; align-items: center; gap: 6px; user-select: none;
                  transition: background 0.15s, border-color 0.15s;
                `;

                const thumbUrl = file.thumb_url || `system/endpoints/thumb.php?file=${encodeURIComponent(file.path)}`;
                const isImg = file.category === 'image' || file.category === 'video';

                card.innerHTML = `
                  <div style="width: 100%; height: 72px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                    ${isImg
                      ? `<img src="${thumbUrl}" alt="${file.name}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">`
                      : `<span style="font-size: 28px;">📄</span>`
                    }
                  </div>
                  <div style="font-size: 11px; font-weight: 500; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;" title="${file.name}">${file.name}</div>
                  <div style="font-size: 10px; color: #94a3b8;">${file.size_formatted || ''}</div>
                `;

                card.addEventListener('mouseenter', () => {
                  if (!selectedItems.has(file.path)) card.style.background = 'rgba(255,255,255,0.08)';
                });
                card.addEventListener('mouseleave', () => {
                  if (!selectedItems.has(file.path)) card.style.background = 'rgba(255,255,255,0.03)';
                });

                card.addEventListener('click', () => {
                  if (!isMultiple) {
                    selectedItems.clear();
                    contentEl.querySelectorAll('.picker-item').forEach(el => {
                      el.style.background = 'rgba(255,255,255,0.03)';
                      el.style.borderColor = 'rgba(255,255,255,0.08)';
                    });
                  }

                  if (selectedItems.has(file.path)) {
                    selectedItems.delete(file.path);
                    card.style.background = 'rgba(255,255,255,0.03)';
                    card.style.borderColor = 'rgba(255,255,255,0.08)';
                  } else {
                    selectedItems.set(file.path, file);
                    card.style.background = 'rgba(59, 130, 246, 0.2)';
                    card.style.borderColor = '#3b82f6';
                  }

                  updateSelectionUI();
                });

                card.addEventListener('dblclick', () => {
                  selectedItems.clear();
                  selectedItems.set(file.path, file);
                  closeDialog(isMultiple ? [file] : file);
                });

                contentEl.appendChild(card);
              });
            }

          } catch (err) {
            contentEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 40px;">Erreur : ${err.message}</div>`;
          }
        };

        // Up Button
        upBtn.addEventListener('click', () => {
          if (currentPath === '') return;
          const parts = currentPath.split('/');
          parts.pop();
          loadDirectory(parts.join('/'));
        });

        // Search Filter
        searchInput.addEventListener('input', (e) => {
          const query = (e.target.value || '').toLowerCase();
          contentEl.querySelectorAll('.picker-item').forEach(item => {
            const name = (item.querySelector('div:nth-child(2)')?.textContent || '').toLowerCase();
            item.style.display = name.includes(query) ? 'flex' : 'none';
          });
        });

        // Button events
        closeBtn.addEventListener('click', () => closeDialog(null));
        cancelBtn.addEventListener('click', () => closeDialog(null));
        confirmBtn.addEventListener('click', () => {
          const items = Array.from(selectedItems.values());
          if (items.length === 0) return;
          closeDialog(isMultiple ? items : items[0]);
        });

        // Keyboard navigation
        const keyHandler = (e) => {
          if (e.key === 'Escape') {
            document.removeEventListener('keydown', keyHandler);
            closeDialog(null);
          } else if (e.key === 'Enter' && selectedItems.size > 0) {
            document.removeEventListener('keydown', keyHandler);
            const items = Array.from(selectedItems.values());
            closeDialog(isMultiple ? items : items[0]);
          }
        };
        document.addEventListener('keydown', keyHandler);

        // Initial Load
        loadDirectory(currentPath);
      });
    }
  }

  const pickerInstance = new FilePickerService();
  window.sys.pickFile = (opts) => pickerInstance.pickFile(opts);
  window.sys.pickFolder = (opts) => pickerInstance.pickFolder(opts);
  window.sys.filePicker = pickerInstance;

})(window, document);
