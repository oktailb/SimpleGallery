/**
 * SimpleGallery - Explorer Drag & Drop Manager (apps/explorer/scripts/explorer-dragdrop.js)
 * Handles internal cross-window moving and external file uploads via native drag-and-drop.
 */
(function(window) {
  'use strict';

  class ExplorerDragDropManager {
    constructor(instance) {
      this.inst = instance;
    }

    init() {
      const container = this.inst.containerEl;
      if (!container) return;

      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const hasExternalFiles = e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files');
        const hasInternalItems = !!window.SG_DRAGGING_PATHS;

        if (hasInternalItems) {
          e.dataTransfer.dropEffect = 'move';
        } else if (hasExternalFiles) {
          e.dataTransfer.dropEffect = 'copy';
          if (this.inst.el.dropZoneOverlay) {
            this.inst.el.dropZoneOverlay.classList.add('active');
          }
        }
      });

      container.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null || !container.contains(e.relatedTarget)) {
          if (this.inst.el.dropZoneOverlay) {
            this.inst.el.dropZoneOverlay.classList.remove('active');
          }
        }
      });

      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (this.inst.el.dropZoneOverlay) {
          this.inst.el.dropZoneOverlay.classList.remove('active');
        }

        // 1. External files dropped from local OS
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          await this.handleExternalFileUpload(e.dataTransfer.files);
          return;
        }

        // 2. Internal items dropped onto container background
        if (window.SG_DRAGGING_PATHS && Array.isArray(window.SG_DRAGGING_PATHS)) {
          const paths = window.SG_DRAGGING_PATHS;
          window.SG_DRAGGING_PATHS = null;
          await this.inst.moveItems(paths, this.inst.state.currentPath);
        }
      });
    }

    bindFolderDropTarget(folderEl, folderPath) {
      folderEl.addEventListener('dragover', (e) => {
        if (window.SG_DRAGGING_PATHS) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          folderEl.classList.add('drag-over');
        }
      });

      folderEl.addEventListener('dragleave', () => {
        folderEl.classList.remove('drag-over');
      });

      folderEl.addEventListener('drop', async (e) => {
        if (window.SG_DRAGGING_PATHS) {
          e.preventDefault();
          e.stopPropagation();
          folderEl.classList.remove('drag-over');
          const paths = window.SG_DRAGGING_PATHS;
          window.SG_DRAGGING_PATHS = null;
          await this.inst.moveItems(paths, folderPath);
        }
      });
    }

    async handleExternalFileUpload(files) {
      const canUpload = this.inst.state.isAdmin || (this.inst.state.userRights && this.inst.state.userRights.can_upload);
      if (!canUpload) {
        this.inst.showToast('Permission refusée : téléversement non autorisé', 'error');
        return;
      }

      this.inst.showLoading(true);
      const targetDir = this.inst.state.currentPath;
      let successCount = 0;
      let lastError = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('target_dir', targetDir);
        formData.append('file', file);
        formData.append('csrf_token', this.inst.state.csrfToken || window.CSRF_TOKEN || '');

        try {
          const res = await window.sys.api.postFormData('upload_file', formData);
          if (res && res.success) {
            successCount++;
          } else {
            lastError = (res && res.error) || 'Erreur inconnue';
          }
        } catch (err) {
          lastError = err.message;
        }
      }

      this.inst.showLoading(false);

      if (successCount > 0) {
        this.inst.showToast(`${successCount} fichier(s) téléversé(s) avec succès`, 'success');
        if (window.EventBus) {
          window.EventBus.emit('fs:changed', { action: 'upload', dir: targetDir });
        } else {
          await this.inst.loadDirectory(this.inst.state.currentPath);
        }
      } else if (lastError) {
        this.inst.showToast(`Échec du téléversement : ${lastError}`, 'error');
      }
    }
  }

  window.ExplorerDragDropManager = ExplorerDragDropManager;

})(window);
