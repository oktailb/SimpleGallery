/**
 * SimpleGallery - Explorer Modals Manager (apps/explorer/scripts/explorer-modals.js)
 * Manages Folder Creation, Deletion Confirmation, Password Unlock, and Metadata Editing dialogs.
 */
(function(window) {
  'use strict';

  class ExplorerModalsManager {
    constructor(instance) {
      this.inst = instance;
    }

    // -------------------------------------------------------------
    // FOLDER CREATION MODAL
    // -------------------------------------------------------------
    openCreateFolderModal() {
      if (!this.inst.el.createFolderModal) return;
      if (this.inst.el.createFolderNameInput) {
        this.inst.el.createFolderNameInput.value = '';
      }
      this.inst.el.createFolderModal.style.display = 'flex';
      setTimeout(() => {
        if (this.inst.el.createFolderNameInput) this.inst.el.createFolderNameInput.focus();
      }, 50);
    }

    closeCreateFolderModal() {
      if (this.inst.el.createFolderModal) {
        this.inst.el.createFolderModal.style.display = 'none';
      }
    }

    async createFolder() {
      const name = (this.inst.el.createFolderNameInput?.value || '').trim();
      if (!name) return;

      const targetPath = (this.inst.state.currentPath ? `${this.inst.state.currentPath}/` : '') + name;
      try {
        const res = await window.sys.api.post('create_folder', {
          target: targetPath,
          csrf_token: this.inst.state.csrfToken || window.CSRF_TOKEN || ''
        });

        if (res && res.success) {
          this.closeCreateFolderModal();
          this.inst.showToast('Dossier créé avec succès', 'success');
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'create_folder', dir: this.inst.state.currentPath });
          } else {
            await this.inst.loadDirectory(this.inst.state.currentPath);
          }
        } else {
          this.inst.showToast((res && res.error) || 'Erreur lors de la création du dossier', 'error');
        }
      } catch (err) {
        this.inst.showToast(err.message, 'error');
      }
    }

    // -------------------------------------------------------------
    // DELETE CONFIRMATION MODAL
    // -------------------------------------------------------------
    openDeleteConfirmModal(path, name, type = 'file') {
      this.pendingDelete = { path, name, type };
      if (!this.inst.el.deleteConfirmModal) {
        if (confirm(`Confirmer la suppression de "${name}" ?`)) {
          this.confirmDeleteItem();
        }
        return;
      }
      if (this.inst.el.deleteConfirmText) {
        this.inst.el.deleteConfirmText.textContent = `Êtes-vous sûr de vouloir supprimer ${type === 'folder' ? 'le dossier' : 'le fichier'} "${name}" ?`;
      }
      this.inst.el.deleteConfirmModal.style.display = 'flex';
    }

    closeDeleteConfirmModal() {
      this.pendingDelete = null;
      if (this.inst.el.deleteConfirmModal) {
        this.inst.el.deleteConfirmModal.style.display = 'none';
      }
    }

    async confirmDeleteItem() {
      if (!this.pendingDelete) return;
      const { path } = this.pendingDelete;
      this.closeDeleteConfirmModal();

      try {
        let res;
        if (window.sys.api && window.sys.api.fs && typeof window.sys.api.fs.deleteItem === 'function') {
          res = await window.sys.api.fs.deleteItem(path);
        } else {
          res = await window.sys.api.post('delete_item', {
            target: path,
            csrf_token: this.inst.state.csrfToken || window.CSRF_TOKEN || ''
          });
        }

        if (res && res.success) {
          this.inst.showToast('Élément supprimé avec succès', 'info');
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'delete', dir: this.inst.state.currentPath });
          } else {
            await this.inst.loadDirectory(this.inst.state.currentPath);
          }
        } else {
          this.inst.showToast((res && res.error) || 'Erreur de suppression', 'error');
        }
      } catch (err) {
        this.inst.showToast(err.message, 'error');
      }
    }

    async deleteSelection() {
      const count = this.inst.state.selectedPaths.size;
      if (count === 0) return;

      if (!confirm(`Supprimer définitivement les ${count} éléments sélectionnés ?`)) return;

      this.inst.showLoading(true);
      const paths = Array.from(this.inst.state.selectedPaths);
      let successCount = 0;
      let lastError = null;

      for (const p of paths) {
        try {
          let res;
          if (window.sys.api && window.sys.api.fs && typeof window.sys.api.fs.deleteItem === 'function') {
            res = await window.sys.api.fs.deleteItem(p);
          } else {
            res = await window.sys.api.post('delete_item', { target: p, csrf_token: this.inst.state.csrfToken || window.CSRF_TOKEN || '' });
          }
          if (res && res.success) successCount++;
          else if (res && res.error) lastError = res.error;
        } catch (e) {
          lastError = e.message;
        }
      }

      this.inst.showLoading(false);
      this.inst.clearSelection();

      if (successCount > 0) {
        this.inst.showToast(`${successCount} élément(s) supprimé(s)`, 'info');
        if (window.EventBus) {
          window.EventBus.emit('fs:changed', { action: 'delete', dir: this.inst.state.currentPath });
        } else {
          await this.inst.loadDirectory(this.inst.state.currentPath);
        }
      } else if (lastError) {
        this.inst.showToast(`Erreur : ${lastError}`, 'error');
      }
    }

    // -------------------------------------------------------------
    // FOLDER UNLOCK MODAL
    // -------------------------------------------------------------
    openFolderUnlockModal(dirPath) {
      this.pendingUnlockPath = dirPath;
      if (!this.inst.el.folderUnlockModal) return;
      if (this.inst.el.folderUnlockPasswordInput) {
        this.inst.el.folderUnlockPasswordInput.value = '';
      }
      this.inst.el.folderUnlockModal.style.display = 'flex';
      setTimeout(() => {
        if (this.inst.el.folderUnlockPasswordInput) this.inst.el.folderUnlockPasswordInput.focus();
      }, 50);
    }

    closeFolderUnlockModal() {
      this.pendingUnlockPath = null;
      if (this.inst.el.folderUnlockModal) {
        this.inst.el.folderUnlockModal.style.display = 'none';
      }
    }

    async unlockFolder() {
      const dir = this.pendingUnlockPath || this.inst.state.currentPath;
      const pwd = this.inst.el.folderUnlockPasswordInput?.value || '';
      if (!pwd) return;

      try {
        const res = await window.sys.api.post('verify_folder_password', {
          dir: dir,
          password: pwd,
          csrf_token: this.inst.state.csrfToken || window.CSRF_TOKEN || ''
        });

        if (res && res.success) {
          this.closeFolderUnlockModal();
          this.inst.showToast('Dossier déverrouillé', 'success');
          await this.inst.loadDirectory(dir);
        } else {
          this.inst.showToast((res && res.error) || 'Mot de passe incorrect', 'error');
        }
      } catch (e) {
        this.inst.showToast(e.message, 'error');
      }
    }

    // -------------------------------------------------------------
    // MEDIA COMMENT MODAL
    // -------------------------------------------------------------
    openMediaCommentModal(filename, comment = '') {
      this.pendingCommentFile = filename;
      if (!this.inst.el.mediaCommentModal) {
        const newComm = prompt('Modifier la légende / description :', comment);
        if (newComm !== null) {
          this.saveMediaComment(newComm);
        }
        return;
      }
      if (this.inst.el.mediaCommentInput) {
        this.inst.el.mediaCommentInput.value = comment;
      }
      this.inst.el.mediaCommentModal.style.display = 'flex';
      setTimeout(() => {
        if (this.inst.el.mediaCommentInput) this.inst.el.mediaCommentInput.focus();
      }, 50);
    }

    closeMediaCommentModal() {
      this.pendingCommentFile = null;
      if (this.inst.el.mediaCommentModal) {
        this.inst.el.mediaCommentModal.style.display = 'none';
      }
    }

    async saveMediaComment(explicitComment = null) {
      const filename = this.pendingCommentFile;
      if (!filename) return;

      const comment = (explicitComment !== null) ? explicitComment : (this.inst.el.mediaCommentInput?.value || '');
      this.closeMediaCommentModal();

      try {
        const res = await window.sys.api.post('set_comment', {
          dir: this.inst.state.currentPath,
          file: filename,
          comment: comment,
          csrf_token: this.inst.state.csrfToken || window.CSRF_TOKEN || ''
        });

        if (res && res.success) {
          this.inst.showToast('Légende enregistrée', 'success');
          await this.inst.loadDirectory(this.inst.state.currentPath);
        } else {
          this.inst.showToast((res && res.error) || 'Erreur lors de l\'enregistrement', 'error');
        }
      } catch (err) {
        this.inst.showToast(err.message, 'error');
      }
    }
  }

  window.ExplorerModalsManager = ExplorerModalsManager;

})(window);
