/**
 * SimpleGallery 2026 - Vanilla JS Client Application
 * Includes Interactive Image Explorer Engine (Zoom, Pan/Drag, Rotation, Touch & Shortcuts)
 */

class SimpleGallery {
  constructor() {
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    this.state = {
      currentPath: '',
      viewMode: localStorage.getItem('gallery_view_mode') || 'polaroid',
      filterCategory: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
      searchQuery: '',
      directories: [],
      files: [],
      filteredFiles: [],
      lightboxIndex: null,
      overrides: null,
      isAdmin: false,
      adminEnabled: false,
      csrfToken: csrfMeta ? csrfMeta.content : '',
      draggingItemPath: null,
      targetItemToDelete: null
    };

    // Zoom, Pan & Rotate Explorer State
    this.zoomState = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
      isDragging: false,
      startX: 0,
      startY: 0
    };

    // Touch Swipe State for Mobile
    this.touchState = {
      startX: 0,
      startY: 0,
      startTime: 0
    };

    this.initElements();
    this.bindEvents();
    this.handleUrlChange();
  }

  initElements() {
    this.el = {
      breadcrumbs: document.getElementById('breadcrumbs'),
      folderSection: document.getElementById('folderSection'),
      foldersGrid: document.getElementById('foldersGrid'),
      mediaGrid: document.getElementById('mediaGrid'),
      searchInput: document.getElementById('searchInput'),
      sortSelect: document.getElementById('sortSelect'),
      sortOrderBtn: document.getElementById('sortOrderBtn'),
      sortOrderIcon: document.getElementById('sortOrderIcon'),
      viewPolaroidBtn: document.getElementById('viewPolaroidBtn'),
      viewGridBtn: document.getElementById('viewGridBtn'),
      filterPills: document.getElementById('filterPills'),
      galleryStats: document.getElementById('galleryStats'),
      loadingState: document.getElementById('loadingState'),
      emptyState: document.getElementById('emptyState'),
      folderDescBanner: document.getElementById('folderDescBanner'),

      // Lightbox elements
      lightbox: document.getElementById('lightbox'),
      lightboxTitle: document.getElementById('lightboxTitle'),
      lightboxMeta: document.getElementById('lightboxMeta'),
      lightboxComment: document.getElementById('lightboxComment'),
      lightboxContent: document.getElementById('lightboxContent'),
      lightboxCloseBtn: document.getElementById('lightboxCloseBtn'),
      lightboxFullscreenBtn: document.getElementById('lightboxFullscreenBtn'),
      lightboxPrevBtn: document.getElementById('lightboxPrevBtn'),
      lightboxNextBtn: document.getElementById('lightboxNextBtn'),
      lightboxDownloadBtn: document.getElementById('lightboxDownloadBtn'),
      lightboxExifBtn: document.getElementById('lightboxExifBtn'),
      lightboxExifPanel: document.getElementById('lightboxExifPanel'),
      closeExifPanelBtn: document.getElementById('closeExifPanelBtn'),
      exifPanelBody: document.getElementById('exifPanelBody'),

      // Image Explorer Controls
      imageExplorerControls: document.getElementById('imageExplorerControls'),
      lightboxZoomInBtn: document.getElementById('lightboxZoomInBtn'),
      lightboxZoomOutBtn: document.getElementById('lightboxZoomOutBtn'),
      lightboxResetZoomBtn: document.getElementById('lightboxResetZoomBtn'),
      lightboxRotateBtn: document.getElementById('lightboxRotateBtn'),
      zoomBadge: document.getElementById('zoomBadge'),

      // Admin Modal & Controls
      adminBtn: document.getElementById('adminBtn'),
      adminBtnIcon: document.getElementById('adminBtnIcon'),
      adminBtnText: document.getElementById('adminBtnText'),
      adminModal: document.getElementById('adminModal'),
      adminModalCloseBtn: document.getElementById('adminModalCloseBtn'),
      adminLoginState: document.getElementById('adminLoginState'),
      adminActiveState: document.getElementById('adminActiveState'),
      adminLoginForm: document.getElementById('adminLoginForm'),
      adminPasswordInput: document.getElementById('adminPasswordInput'),
      adminLoginError: document.getElementById('adminLoginError'),
      changePasswordForm: document.getElementById('changePasswordForm'),
      newAdminPasswordInput: document.getElementById('newAdminPasswordInput'),
      adminChangePassMsg: document.getElementById('adminChangePassMsg'),
      adminLogoutBtn: document.getElementById('adminLogoutBtn'),

      // Folder Settings & Dotfile Modals
      folderSettingsBtn: document.getElementById('folderSettingsBtn'),
      folderSettingsModal: document.getElementById('folderSettingsModal'),
      folderSettingsCloseBtn: document.getElementById('folderSettingsCloseBtn'),
      folderSettingsForm: document.getElementById('folderSettingsForm'),
      dotfileTitleInput: document.getElementById('dotfileTitleInput'),
      dotfileDescInput: document.getElementById('dotfileDescInput'),
      dotfileBgInput: document.getElementById('dotfileBgInput'),
      dotfileThemeSelect: document.getElementById('dotfileThemeSelect'),
      dotfileAccessModeSelect: document.getElementById('dotfileAccessModeSelect'),
      folderPasswordGroup: document.getElementById('folderPasswordGroup'),
      dotfileFolderPasswordInput: document.getElementById('dotfileFolderPasswordInput'),

      // Media Comment Modal
      lightboxEditCommentBtn: document.getElementById('lightboxEditCommentBtn'),
      mediaCommentModal: document.getElementById('mediaCommentModal'),
      mediaCommentCloseBtn: document.getElementById('mediaCommentCloseBtn'),
      mediaCommentForm: document.getElementById('mediaCommentForm'),
      mediaCommentFilename: document.getElementById('mediaCommentFilename'),
      mediaCommentFilenameLabel: document.getElementById('mediaCommentFilenameLabel'),
      mediaCommentInput: document.getElementById('mediaCommentInput'),

      // Visitor Folder Unlock Modal
      folderUnlockModal: document.getElementById('folderUnlockModal'),
      folderUnlockCloseBtn: document.getElementById('folderUnlockCloseBtn'),
      folderUnlockForm: document.getElementById('folderUnlockForm'),
      folderUnlockPath: document.getElementById('folderUnlockPath'),
      folderUnlockPasswordInput: document.getElementById('folderUnlockPasswordInput'),
      folderUnlockError: document.getElementById('folderUnlockError'),

      // Folder GPS Route Map Button
      folderMapBtn: document.getElementById('folderMapBtn'),

      // Drag & Drop Upload Elements
      uploadMediaBtn: document.getElementById('uploadMediaBtn'),
      uploadFileInput: document.getElementById('uploadFileInput'),
      dropZoneOverlay: document.getElementById('dropZoneOverlay'),
      uploadProgressModal: document.getElementById('uploadProgressModal'),
      uploadProgressBar: document.getElementById('uploadProgressBar'),
      uploadProgressStatus: document.getElementById('uploadProgressStatus'),
      uploadResultMessages: document.getElementById('uploadResultMessages'),

      // Create Folder Elements
      createFolderBtn: document.getElementById('createFolderBtn'),
      createFolderModal: document.getElementById('createFolderModal'),
      createFolderCloseBtn: document.getElementById('createFolderCloseBtn'),
      createFolderForm: document.getElementById('createFolderForm'),
      createFolderNameInput: document.getElementById('createFolderNameInput'),
      createFolderError: document.getElementById('createFolderError'),

      // Delete Confirm Elements
      lightboxDeleteBtn: document.getElementById('lightboxDeleteBtn'),
      deleteConfirmModal: document.getElementById('deleteConfirmModal'),
      deleteConfirmCloseBtn: document.getElementById('deleteConfirmCloseBtn'),
      deleteCancelBtn: document.getElementById('deleteCancelBtn'),
      deleteConfirmActionBtn: document.getElementById('deleteConfirmActionBtn'),
      deleteConfirmMessage: document.getElementById('deleteConfirmMessage')
    };
  }

  bindEvents() {
    window.addEventListener('popstate', () => this.handleUrlChange());

    this.el.searchInput.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.toLowerCase();
      this.applyFilterAndRender();
    });

    this.el.sortSelect.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      if (['date', 'exif_date', 'size'].includes(e.target.value)) {
        this.state.sortOrder = 'desc';
      } else {
        this.state.sortOrder = 'asc';
      }
      this.updateSortOrderUI();
      this.applyFilterAndRender();
    });

    if (this.el.sortOrderBtn) {
      this.el.sortOrderBtn.addEventListener('click', () => this.toggleSortOrder());
    }

    this.el.viewPolaroidBtn.addEventListener('click', () => this.setViewMode('polaroid'));
    this.el.viewGridBtn.addEventListener('click', () => this.setViewMode('grid'));

    this.el.filterPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn');
      if (pill) {
        this.el.filterPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
        this.state.filterCategory = pill.dataset.category;
        this.applyFilterAndRender();
      }
    });

    // Upload Controls & Global Drag & Drop (Admin Only)
    if (this.el.uploadMediaBtn && this.el.uploadFileInput) {
      this.el.uploadMediaBtn.addEventListener('click', () => {
        this.el.uploadFileInput.click();
      });
      this.el.uploadFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleUploadFiles(e.target.files);
          this.el.uploadFileInput.value = '';
        }
      });
    }

    // Global Desktop File Drag & Drop (Admin Only)
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (!this.state.isAdmin || this.state.draggingItemPath) return;
      dragCounter++;
      if (this.el.dropZoneOverlay) this.el.dropZoneOverlay.style.display = 'flex';
    });
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!this.state.isAdmin || this.state.draggingItemPath) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (this.el.dropZoneOverlay) this.el.dropZoneOverlay.style.display = 'none';
      }
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      if (this.el.dropZoneOverlay) this.el.dropZoneOverlay.style.display = 'none';

      if (!this.state.isAdmin || this.state.draggingItemPath) return;

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleUploadFiles(e.dataTransfer.files);
      }
    });



    // Admin Create Folder Controls
    if (this.el.createFolderBtn) {
      this.el.createFolderBtn.addEventListener('click', () => this.openCreateFolderModal());
    }
    if (this.el.createFolderCloseBtn) {
      this.el.createFolderCloseBtn.addEventListener('click', () => this.closeCreateFolderModal());
    }
    if (this.el.createFolderModal) {
      this.el.createFolderModal.addEventListener('click', (e) => {
        if (e.target === this.el.createFolderModal) this.closeCreateFolderModal();
      });
    }
    if (this.el.createFolderForm) {
      this.el.createFolderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createFolder();
      });
    }

    // Admin Delete Confirm Controls
    if (this.el.deleteConfirmCloseBtn) {
      this.el.deleteConfirmCloseBtn.addEventListener('click', () => this.closeDeleteConfirmModal());
    }
    if (this.el.deleteCancelBtn) {
      this.el.deleteCancelBtn.addEventListener('click', () => this.closeDeleteConfirmModal());
    }
    if (this.el.deleteConfirmModal) {
      this.el.deleteConfirmModal.addEventListener('click', (e) => {
        if (e.target === this.el.deleteConfirmModal) this.closeDeleteConfirmModal();
      });
    }
    if (this.el.deleteConfirmActionBtn) {
      this.el.deleteConfirmActionBtn.addEventListener('click', () => this.confirmDeleteItem());
    }
    if (this.el.lightboxDeleteBtn) {
      this.el.lightboxDeleteBtn.addEventListener('click', () => {
        if (this.state.lightboxIndex !== null && this.state.filteredFiles[this.state.lightboxIndex]) {
          const file = this.state.filteredFiles[this.state.lightboxIndex];
          this.openDeleteConfirmModal(file.path, file.name, 'file', true);
        }
      });
    }

    // Admin Controls
    if (this.el.adminBtn) {
      this.el.adminBtn.addEventListener('click', () => this.openAdminModal());
    }
    if (this.el.adminModalCloseBtn) {
      this.el.adminModalCloseBtn.addEventListener('click', () => this.closeAdminModal());
    }
    if (this.el.adminModal) {
      this.el.adminModal.addEventListener('click', (e) => {
        if (e.target === this.el.adminModal) this.closeAdminModal();
      });
    }
    if (this.el.adminLoginForm) {
      this.el.adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.loginAdmin();
      });
    }
    if (this.el.adminLogoutBtn) {
      this.el.adminLogoutBtn.addEventListener('click', () => this.logoutAdmin());
    }
    if (this.el.changePasswordForm) {
      this.el.changePasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.changeAdminPassword();
      });
    }

    // Folder Settings Modal
    if (this.el.folderSettingsBtn) {
      this.el.folderSettingsBtn.addEventListener('click', () => this.openFolderSettingsModal());
    }
    if (this.el.folderSettingsCloseBtn) {
      this.el.folderSettingsCloseBtn.addEventListener('click', () => this.closeFolderSettingsModal());
    }
    if (this.el.folderSettingsModal) {
      this.el.folderSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.el.folderSettingsModal) this.closeFolderSettingsModal();
      });
    }
    if (this.el.dotfileAccessModeSelect) {
      this.el.dotfileAccessModeSelect.addEventListener('change', (e) => {
        if (this.el.folderPasswordGroup) {
          this.el.folderPasswordGroup.style.display = (e.target.value === 'password') ? 'block' : 'none';
        }
      });
    }
    if (this.el.folderSettingsForm) {
      this.el.folderSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveFolderSettings();
      });
    }

    // Visitor Folder Unlock Modal
    if (this.el.folderUnlockCloseBtn) {
      this.el.folderUnlockCloseBtn.addEventListener('click', () => this.closeFolderUnlockModal());
    }
    if (this.el.folderUnlockModal) {
      this.el.folderUnlockModal.addEventListener('click', (e) => {
        if (e.target === this.el.folderUnlockModal) this.closeFolderUnlockModal();
      });
    }
    if (this.el.folderUnlockForm) {
      this.el.folderUnlockForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.unlockFolder();
      });
    }

    // Media Comment Modal & Lightbox Edit Legend Button
    if (this.el.lightboxEditCommentBtn) {
      this.el.lightboxEditCommentBtn.addEventListener('click', () => {
        if (this.state.lightboxIndex !== null) {
          const file = this.state.filteredFiles[this.state.lightboxIndex];
          if (file) this.openMediaCommentModal(file.name, file.comment || '');
        }
      });
    }
    if (this.el.mediaCommentCloseBtn) {
      this.el.mediaCommentCloseBtn.addEventListener('click', () => this.closeMediaCommentModal());
    }
    if (this.el.mediaCommentModal) {
      this.el.mediaCommentModal.addEventListener('click', (e) => {
        if (e.target === this.el.mediaCommentModal) this.closeMediaCommentModal();
      });
    }
    if (this.el.mediaCommentForm) {
      this.el.mediaCommentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveMediaComment();
      });
    }

    // Lightbox Modal Controls
    this.el.lightboxCloseBtn.addEventListener('click', () => this.closeLightbox());
    if (this.el.lightboxFullscreenBtn) {
      this.el.lightboxFullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }
    if (this.el.lightboxExifBtn) {
      this.el.lightboxExifBtn.addEventListener('click', () => this.toggleExifPanel());
    }
    if (this.el.closeExifPanelBtn) {
      this.el.closeExifPanelBtn.addEventListener('click', () => this.toggleExifPanel(false));
    }
    this.el.lightboxPrevBtn.addEventListener('click', () => this.navigateLightbox(-1));
    this.el.lightboxNextBtn.addEventListener('click', () => this.navigateLightbox(1));

    // Image Explorer Toolbar Buttons
    this.el.lightboxZoomInBtn.addEventListener('click', () => this.adjustZoom(0.3));
    this.el.lightboxZoomOutBtn.addEventListener('click', () => this.adjustZoom(-0.3));
    this.el.lightboxResetZoomBtn.addEventListener('click', () => this.resetZoom());
    this.el.lightboxRotateBtn.addEventListener('click', () => this.rotateImage());

    // Mouse Wheel Zoom on Lightbox Media
    this.el.lightboxContent.addEventListener('wheel', (e) => {
      if (!this.isCurrentMediaImage()) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      this.adjustZoom(delta);
    }, { passive: false });

    // Mouse Drag / Pan Events
    this.el.lightboxContent.addEventListener('mousedown', (e) => this.startDrag(e));
    window.addEventListener('mousemove', (e) => this.doDrag(e));
    window.addEventListener('mouseup', (e) => this.endDrag(e));

    // Touch Drag & Swipe Events for Mobile
    this.el.lightboxContent.addEventListener('touchstart', (e) => this.startTouchDrag(e), { passive: true });
    window.addEventListener('touchmove', (e) => this.doTouchDrag(e), { passive: false });
    window.addEventListener('touchend', (e) => this.endDrag(e));

    // Double Click to Toggle Zoom (1x <-> 2.5x)
    this.el.lightboxContent.addEventListener('dblclick', (e) => {
      if (!this.isCurrentMediaImage()) return;
      e.preventDefault();
      if (this.zoomState.scale > 1) {
        this.resetZoom();
      } else {
        this.adjustZoom(1.5);
      }
    });

    // Keyboard Shortcuts for Lightbox & Explorer
    window.addEventListener('keydown', (e) => {
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const isModalOpen = (this.el.mediaCommentModal && this.el.mediaCommentModal.classList.contains('open')) ||
                          (this.el.folderSettingsModal && this.el.folderSettingsModal.classList.contains('open')) ||
                          (this.el.adminModal && this.el.adminModal.classList.contains('open')) ||
                          (this.el.folderUnlockModal && this.el.folderUnlockModal.classList.contains('open'));

      if (isInputFocused || isModalOpen) {
        if (e.key === 'Escape') {
          if (this.el.mediaCommentModal && this.el.mediaCommentModal.classList.contains('open')) {
            this.closeMediaCommentModal();
          } else if (this.el.folderSettingsModal && this.el.folderSettingsModal.classList.contains('open')) {
            this.closeFolderSettingsModal();
          } else if (this.el.adminModal && this.el.adminModal.classList.contains('open')) {
            this.closeAdminModal();
          } else if (this.el.folderUnlockModal && this.el.folderUnlockModal.classList.contains('open')) {
            this.closeFolderUnlockModal();
          }
        }
        return;
      }

      if (!this.el.lightbox.classList.contains('open')) return;

      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
      if (e.key === 'ArrowRight') this.navigateLightbox(1);
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.toggleFullscreen(); }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); this.toggleExifPanel(); }

      if (this.isCurrentMediaImage()) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); this.adjustZoom(0.3); }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); this.adjustZoom(-0.3); }
        if (e.key === '0') { e.preventDefault(); this.resetZoom(); }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); this.rotateImage(); }
      }
    });

    // Close lightbox on backdrop click
    this.el.lightbox.addEventListener('click', (e) => {
      if (e.target === this.el.lightbox || e.target.classList.contains('lightbox-body')) {
        this.closeLightbox();
      }
    });
  }

  handleUrlChange() {
    const params = new URLSearchParams(window.location.search);
    const dir = params.get('dir') || '';
    this.loadDirectory(dir);
  }

  navigateTo(dirPath) {
    const url = new URL(window.location);
    if (dirPath) {
      url.searchParams.set('dir', dirPath);
    } else {
      url.searchParams.delete('dir');
    }
    window.history.pushState({}, '', url);
    this.loadDirectory(dirPath);
  }

  async loadDirectory(dirPath) {
    this.showLoading(true);
    this.state.currentPath = dirPath;

    try {
      const res = await fetch(`api.php?dir=${encodeURIComponent(dirPath)}`);
      const json = await res.json();

      if (!json.success) {
        this.state.directories = [];
        this.state.files = [];
        this.state.filteredFiles = [];
        this.renderFolders([]);
        this.updateStats();

        if (json.is_protected) {
          this.openFolderUnlockModal(dirPath);
          this.renderProtectedState(dirPath);
        } else {
          this.renderRestrictedState(json.error || 'Accès refusé');
        }
        this.showLoading(false);
        return;
      }

      this.state.directories = json.directories;
      this.state.files = json.files;
      this.state.overrides = json.overrides || {};
      this.state.isAdmin = !!json.is_admin;
      this.state.adminEnabled = !!json.admin_enabled;
      if (json.csrf_token) this.state.csrfToken = json.csrf_token;

      this.updateAdminUI();
      this.updateSortOrderUI();
      this.applyDotfileOverrides(this.state.overrides);
      this.renderBreadcrumbs(json.breadcrumbs);
      this.renderFolders(json.directories);
      this.applyFilterAndRender();

    } catch (err) {
      console.error('Error fetching gallery directory:', err);
    } finally {
      this.showLoading(false);
    }
  }

  applyDotfileOverrides(overrides) {
    if (overrides.background) {
      if (overrides.background.startsWith('thumb.php') || overrides.background.includes('/')) {
        document.body.style.backgroundImage = `url("${overrides.background}")`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
      } else {
        document.body.style.background = overrides.background;
      }
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.background = '';
    }

    const isProtectedUnlocked = overrides.is_protected && overrides.is_unlocked && !this.state.isAdmin;

    if (overrides.description || this.state.isAdmin || isProtectedUnlocked) {
      if (!this.el.folderDescBanner) {
        this.el.folderDescBanner = document.createElement('div');
        this.el.folderDescBanner.id = 'folderDescBanner';
        this.el.folderDescBanner.className = 'folder-desc-banner';
        const container = document.querySelector('.gallery-container');
        if (container) container.insertBefore(this.el.folderDescBanner, container.firstChild);
      }

      let bannerHtml = '';
      if (overrides.description) {
        bannerHtml = `💬 <span style="flex:1;">${this.escapeHtml(overrides.description)}</span>`;
      } else if (this.state.isAdmin) {
        bannerHtml = `💬 <span style="flex:1;color:var(--text-muted);font-style:italic;">No description banner set (.desc)</span>`;
      } else if (isProtectedUnlocked) {
        bannerHtml = `🔓 <span style="flex:1;color:var(--text-muted);">Session ouverte (Dossier protégé)</span>`;
      }

      if (this.state.isAdmin) {
        bannerHtml += ` <button class="edit-dotfile-btn edit-banner-btn" title="Edit description (.desc)">✏️ Edit Banner</button>`;
      }
      if (isProtectedUnlocked) {
        bannerHtml += ` <button class="edit-dotfile-btn relock-btn" title="Re-lock this folder for the session">🔒 Lock Folder</button>`;
      }

      this.el.folderDescBanner.innerHTML = bannerHtml;
      this.el.folderDescBanner.style.display = 'flex';

      const editBtn = this.el.folderDescBanner.querySelector('.edit-banner-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openFolderSettingsModal();
        });
      }

      const relockBtn = this.el.folderDescBanner.querySelector('.relock-btn');
      if (relockBtn) {
        relockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.lockFolder(this.state.currentPath);
        });
      }
    } else if (this.el.folderDescBanner) {
      this.el.folderDescBanner.style.display = 'none';
    }

    // Reset directory-level theme CSS variables to allow clean folder navigation
    const themeCssVars = [
      '--bg-main', '--polaroid-bg', '--polaroid-text', '--polaroid-sub',
      '--accent-primary', '--bg-card', '--text-main', '--text-muted'
    ];
    themeCssVars.forEach(varName => document.documentElement.style.removeProperty(varName));

    if (overrides.theme) {
      if (typeof overrides.theme === 'object') {
        const keyMap = {
          'bg_main': '--bg-main',
          'polaroid_bg': '--polaroid-bg',
          'polaroid_text': '--polaroid-text',
          'polaroid_sub': '--polaroid-sub',
          'accent': '--accent-primary',
          'card_bg': '--bg-card',
          'text_main': '--text-main',
          'text_muted': '--text-muted'
        };
        Object.entries(overrides.theme).forEach(([key, val]) => {
          const cssVar = keyMap[key] || (key.startsWith('--') ? key : `--${key.replace('_', '-')}`);
          document.documentElement.style.setProperty(cssVar, val);
        });
      }
    }
  }

  setViewMode(mode) {
    this.state.viewMode = mode;
    localStorage.setItem('gallery_view_mode', mode);
    this.el.viewPolaroidBtn.classList.toggle('active', mode === 'polaroid');
    this.el.viewGridBtn.classList.toggle('active', mode === 'grid');
    this.renderMedia();
  }

  toggleSortOrder() {
    this.state.sortOrder = (this.state.sortOrder === 'asc') ? 'desc' : 'asc';
    this.updateSortOrderUI();
    this.applyFilterAndRender();
  }

  updateSortOrderUI() {
    if (!this.el.sortOrderBtn || !this.el.sortOrderIcon) return;
    if (this.state.sortOrder === 'asc') {
      this.el.sortOrderIcon.textContent = '⇧';
      this.el.sortOrderBtn.title = 'Ordre : Croissant (A-Z, Plus ancien d\'abord, Plus petit d\'abord)';
      this.el.sortOrderBtn.classList.add('active');
    } else {
      this.el.sortOrderIcon.textContent = '⇩';
      this.el.sortOrderBtn.title = 'Ordre : Décroissant (Z-A, Plus récent d\'abord, Plus grand d\'abord)';
      this.el.sortOrderBtn.classList.remove('active');
    }
  }

  renderBreadcrumbs(crumbs) {
    this.el.breadcrumbs.innerHTML = crumbs.map((crumb, idx) => {
      const isLast = idx === crumbs.length - 1;
      if (isLast) {
        return `<span class="crumb-item crumb-active">${this.escapeHtml(crumb.name)}</span>`;
      }
      return `
        <a href="?dir=${encodeURIComponent(crumb.path)}" class="crumb-item" data-path="${crumb.path}">
          ${this.escapeHtml(crumb.name)}
        </a>
        <span class="crumb-separator">/</span>
      `;
    }).join('');

    this.el.breadcrumbs.querySelectorAll('a[data-path]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(a.dataset.path);
      });
    });

    if (this.state.isAdmin) {
      this.el.breadcrumbs.querySelectorAll('.crumb-item[data-path]').forEach(crumb => {
        const crumbPath = crumb.dataset.path;

        crumb.addEventListener('dragover', (e) => {
          if (!this.state.draggingItemPath || this.state.draggingItemPath === crumbPath) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          crumb.classList.add('drop-hover');
        });

        crumb.addEventListener('dragleave', () => {
          crumb.classList.remove('drop-hover');
        });

        crumb.addEventListener('drop', (e) => {
          if (!this.state.draggingItemPath || this.state.draggingItemPath === crumbPath) return;
          e.preventDefault();
          e.stopPropagation();
          crumb.classList.remove('drop-hover');
          const sourcePath = this.state.draggingItemPath;
          this.moveItem(sourcePath, crumbPath);
        });
      });
    }
  }

  renderFolders(folders) {
    if (folders.length === 0) {
      this.el.folderSection.style.display = 'none';
      return;
    }

    this.el.folderSection.style.display = 'block';
    this.el.foldersGrid.innerHTML = folders.map(folder => {
      let badge = '';
      if (folder.is_private) {
        badge = '<span class="folder-badge private-badge" title="Folder is hidden from public (.private)">👁️‍🗨️ Private</span>';
      } else if (folder.is_protected) {
        badge = folder.is_unlocked
          ? '<span class="folder-badge unlocked-badge" title="Password protection unlocked">🔓 Unlocked</span>'
          : '<span class="folder-badge protected-badge" title="Password protected folder (.password)">🔒 Protected</span>';
      }

      const isDraggable = this.state.isAdmin ? 'true' : 'false';
      const handleClass = this.state.isAdmin ? 'drag-handle' : '';
      const deleteBtnHtml = this.state.isAdmin ? `<button class="delete-item-btn" data-path="${folder.path}" data-name="${this.escapeHtml(folder.name)}" data-type="folder" title="Supprimer le dossier">🗑️</button>` : '';

      return `
        <a href="?dir=${encodeURIComponent(folder.path)}" class="folder-card ${handleClass} ${folder.is_protected && !folder.is_unlocked && !this.state.isAdmin ? 'protected-card' : ''}" data-path="${folder.path}" data-protected="${folder.is_protected ? '1' : '0'}" data-unlocked="${folder.is_unlocked ? '1' : '0'}" draggable="${isDraggable}">
          ${deleteBtnHtml}
          ${badge}
          <div class="folder-icon-wrapper">
            ${folder.is_protected && !folder.is_unlocked && !this.state.isAdmin ? '<div class="folder-lock-icon">🔒</div>' : (folder.cover ? `<img src="${folder.cover}" alt="${this.escapeHtml(folder.name)}" class="folder-cover-img" loading="lazy" draggable="false" />` : '📁')}
          </div>
          <div class="folder-name">${this.escapeHtml(folder.name)}</div>
          <div class="folder-meta">
            <span>${folder.item_count} ${folder.item_count === 1 ? 'item' : 'items'}</span>
          </div>
          ${folder.comment ? `<div class="folder-comment">💬 ${this.escapeHtml(folder.comment)}</div>` : ''}
        </a>
      `;
    }).join('');

    this.el.foldersGrid.querySelectorAll('.folder-card').forEach(card => {
      const folderPath = card.dataset.path;

      if (this.state.isAdmin) {
        card.addEventListener('dragstart', (e) => {
          this.state.draggingItemPath = folderPath;
          card.classList.add('dragging');
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'internal_item', path: folderPath }));
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          this.state.draggingItemPath = null;
        });

        card.addEventListener('dragover', (e) => {
          if (!this.state.draggingItemPath || this.state.draggingItemPath === folderPath) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          card.classList.add('drop-hover');
        });

        card.addEventListener('dragleave', () => {
          card.classList.remove('drop-hover');
        });

        card.addEventListener('drop', (e) => {
          if (!this.state.draggingItemPath || this.state.draggingItemPath === folderPath) return;
          e.preventDefault();
          e.stopPropagation();
          card.classList.remove('drop-hover');
          const sourcePath = this.state.draggingItemPath;
          this.moveItem(sourcePath, folderPath);
        });
      }

      card.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openDeleteConfirmModal(btn.dataset.path, btn.dataset.name, 'folder');
        });
      });

      card.addEventListener('click', (e) => {
        e.preventDefault();
        const isProtected = card.dataset.protected === '1';
        const isUnlocked = card.dataset.unlocked === '1';
        if (isProtected && !isUnlocked && !this.state.isAdmin) {
          this.openFolderUnlockModal(folderPath);
        } else {
          this.navigateTo(folderPath);
        }
      });
    });

    this.el.foldersGrid.querySelectorAll('.folder-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const isProtected = card.dataset.protected === '1';
        const isUnlocked = card.dataset.unlocked === '1';
        const path = card.dataset.path;

        if (isProtected && !isUnlocked && !this.state.isAdmin) {
          this.openFolderUnlockModal(path);
        } else {
          this.navigateTo(path);
        }
      });
    });
  }

  applyFilterAndRender() {
    let list = [...this.state.files];

    if (this.state.filterCategory !== 'all') {
      list = list.filter(f => f.category === this.state.filterCategory);
    }

    if (this.state.searchQuery) {
      list = list.filter(f => 
        f.name.toLowerCase().includes(this.state.searchQuery) ||
        (f.comment && f.comment.toLowerCase().includes(this.state.searchQuery))
      );
    }

    list.sort((a, b) => {
      let res = 0;
      if (this.state.sortBy === 'name') {
        res = a.name.localeCompare(b.name, undefined, { numeric: true });
      } else if (this.state.sortBy === 'exif_date') {
        res = (a.effective_mtime || a.mtime) - (b.effective_mtime || b.mtime);
      } else if (this.state.sortBy === 'date') {
        res = a.mtime - b.mtime;
      } else if (this.state.sortBy === 'size') {
        res = a.size - b.size;
      }
      return (this.state.sortOrder === 'asc') ? res : -res;
    });

    this.state.filteredFiles = list;
    this.updateStats();
    this.updateFolderMapButton();
    this.renderMedia();
  }

  updateStats() {
    const fileCount = this.state.filteredFiles.length;
    const folderCount = this.state.directories.length;
    this.el.galleryStats.textContent = `${folderCount} folders, ${fileCount} files`;
  }

  updateFolderMapButton() {
    if (!this.el.folderMapBtn) return;

    const gpsFiles = this.state.files.filter(f => f.exif && f.exif.gps && f.exif.gps.lat && f.exif.gps.lng);

    if (gpsFiles.length === 0) {
      this.el.folderMapBtn.style.display = 'none';
      return;
    }

    // Sort chronologically by EXIF timestamp or file mtime
    gpsFiles.sort((a, b) => (a.effective_mtime || a.mtime) - (b.effective_mtime || b.mtime));

    // Deduplicate close GPS coordinates (same lat/lng to 4 decimal places)
    const uniquePoints = [];
    const seen = new Set();
    for (const f of gpsFiles) {
      const key = `${f.exif.gps.lat.toFixed(4)},${f.exif.gps.lng.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePoints.push(f.exif.gps);
      }
    }

    let mapUrl = '';
    let btnText = '';

    if (uniquePoints.length === 1) {
      const pt = uniquePoints[0];
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lng}`;
      btnText = `📍 Localisation (1 point GPS)`;
    } else if (uniquePoints.length === 2) {
      const p1 = uniquePoints[0];
      const p2 = uniquePoints[1];
      mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${p1.lat},${p1.lng}&destination=${p2.lat},${p2.lng}`;
      btnText = `🗺️ Trajet GPS (2 étapes)`;
    } else {
      const first = uniquePoints[0];
      const last = uniquePoints[uniquePoints.length - 1];

      const intermediates = uniquePoints.slice(1, uniquePoints.length - 1);
      let selectedWaypoints = intermediates;
      if (intermediates.length > 8) {
        selectedWaypoints = [];
        const step = (intermediates.length - 1) / 7;
        for (let i = 0; i < 8; i++) {
          const idx = Math.min(Math.round(i * step), intermediates.length - 1);
          selectedWaypoints.push(intermediates[idx]);
        }
      }

      const waypointsStr = selectedWaypoints.map(pt => `${pt.lat},${pt.lng}`).join('|');
      mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${first.lat},${first.lng}&destination=${last.lat},${last.lng}&waypoints=${encodeURIComponent(waypointsStr)}`;
      btnText = `🗺️ Trajet GPS (${uniquePoints.length} étapes)`;
    }

    this.el.folderMapBtn.href = mapUrl;
    this.el.folderMapBtn.textContent = btnText;
    this.el.folderMapBtn.style.display = 'inline-flex';
  }

  renderProtectedState(dirPath) {
    if (!this.el.emptyState) return;
    this.el.emptyState.style.display = 'block';
    this.el.mediaGrid.style.display = 'none';
    this.el.emptyState.innerHTML = `
      <div class="empty-state-icon">🔒</div>
      <h3>Dossier Protégé par Mot de Passe</h3>
      <p>Saisissez le mot de passe du dossier pour afficher son contenu.</p>
      <button class="pill-btn active" style="margin-top: 1rem;" onclick="galleryApp.openFolderUnlockModal('${this.escapeHtml(dirPath)}')">
        🔑 Déverrouiller le Dossier
      </button>
    `;
  }

  renderRestrictedState(msg) {
    if (!this.el.emptyState) return;
    this.el.emptyState.style.display = 'block';
    this.el.mediaGrid.style.display = 'none';
    this.el.emptyState.innerHTML = `
      <div class="empty-state-icon">👁️‍🗨️</div>
      <h3>Dossier Privé</h3>
      <p>${this.escapeHtml(msg || 'Ce dossier est masqué et réservé à l\'administrateur.')}</p>
    `;
  }

  renderMedia() {
    const list = this.state.filteredFiles;

    if (list.length === 0 && this.state.directories.length === 0) {
      this.el.emptyState.style.display = 'block';
      this.el.mediaGrid.style.display = 'none';
      this.el.emptyState.innerHTML = `
        <div class="empty-state-icon">📂</div>
        <h3>No media files found</h3>
        <p>Copy photos, videos, or audio into this folder to get started!</p>
      `;
      return;
    }

    this.el.emptyState.style.display = 'none';
    this.el.mediaGrid.style.display = 'grid';

    const isDraggable = this.state.isAdmin ? 'true' : 'false';
    const handleClass = this.state.isAdmin ? 'drag-handle' : '';

    if (this.state.viewMode === 'polaroid') {
      this.el.mediaGrid.className = 'polaroid-grid';
      this.el.mediaGrid.innerHTML = list.map((file, idx) => {
        let frameClass = 'polaroid-card';
        if (file.category === 'video') frameClass += ' film-strip-card';
        if (file.category === 'audio') frameClass += ' audio-cassette-card';
        if (['doc', 'archive', 'other'].includes(file.category)) frameClass += ' doc-file-card';

        let overlayHtml = '';
        if (file.category === 'video') {
          overlayHtml = '<div class="video-play-overlay">▶</div>';
        } else if (file.category === 'audio') {
          overlayHtml = '<div class="audio-play-overlay">🎵</div>';
        }

        let badgeHtml = '';
        if (['doc', 'archive', 'other'].includes(file.category)) {
          badgeHtml = `<span class="doc-extension-badge badge-${file.category}">${file.extension.toUpperCase()}</span>`;
        } else {
          badgeHtml = `<span class="polaroid-badge">${file.extension.toUpperCase()}</span>`;
        }

        let gpsBadge = '';
        if (file.exif && file.exif.gps) {
          gpsBadge = `<a href="${file.exif.gps.maps_url}" target="_blank" class="gps-badge" title="Géolocalisation GPS - Voir sur Google Maps" onclick="event.stopPropagation()">📍 Maps</a>`;
        }

        const deleteBtnHtml = this.state.isAdmin ? `<button class="delete-item-btn" data-path="${file.path}" data-name="${this.escapeHtml(file.name)}" data-type="file" title="Supprimer le fichier">🗑️</button>` : '';

        let mediaPreviewHtml = `<img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" draggable="false" />`;
        if (file.category === 'video') {
          mediaPreviewHtml = `<video src="${file.file_url}#t=0.5" poster="${file.thumb_url}" preload="metadata" muted playsinline style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>`;
        }

        return `
          <div class="${frameClass} ${handleClass}" data-index="${idx}" draggable="${isDraggable}">
            ${deleteBtnHtml}
            <div class="polaroid-img-wrapper">
              ${mediaPreviewHtml}
              ${overlayHtml}
              ${badgeHtml}
              ${gpsBadge}
            </div>
            <div class="polaroid-caption">
              <span>${this.escapeHtml(file.comment || file.name)}</span>
              ${this.state.isAdmin ? `<button class="edit-media-comment-btn" data-filename="${this.escapeHtml(file.name)}" data-comment="${this.escapeHtml(file.comment || '')}" title="Edit legend (.comment)">✏️</button>` : ''}
            </div>
            <div class="polaroid-subcaption">${file.size_formatted}</div>
          </div>
        `;
      }).join('');
    } else {
      this.el.mediaGrid.className = 'modern-grid';
      this.el.mediaGrid.innerHTML = list.map((file, idx) => {
        let gridFrameClass = 'grid-card';
        if (file.category === 'video') gridFrameClass += ' film-strip-grid-card';
        if (file.category === 'audio') gridFrameClass += ' audio-cassette-grid-card';
        if (['doc', 'archive', 'other'].includes(file.category)) gridFrameClass += ' doc-file-grid-card';

        let overlayHtml = '';
        if (file.category === 'video') {
          overlayHtml = '<div class="video-play-overlay">▶</div>';
        } else if (file.category === 'audio') {
          overlayHtml = '<div class="audio-play-overlay">🎵</div>';
        }

        let badgeHtml = '';
        if (['doc', 'archive', 'other'].includes(file.category)) {
          badgeHtml = `<span class="doc-extension-badge badge-${file.category}">${file.extension.toUpperCase()}</span>`;
        }

        let gpsBadge = '';
        if (file.exif && file.exif.gps) {
          gpsBadge = `<a href="${file.exif.gps.maps_url}" target="_blank" class="gps-badge" title="Géolocalisation GPS - Voir sur Google Maps" onclick="event.stopPropagation()">📍 Maps</a>`;
        }
        
        const deleteBtnHtml = this.state.isAdmin ? `<button class="delete-item-btn" data-path="${file.path}" data-name="${this.escapeHtml(file.name)}" data-type="file" title="Supprimer le fichier">🗑️</button>` : '';

        let gridMediaPreviewHtml = `<img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" draggable="false" />`;
        if (file.category === 'video') {
          gridMediaPreviewHtml = `<video src="${file.file_url}#t=0.5" poster="${file.thumb_url}" preload="metadata" muted playsinline style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>`;
        }

        return `
          <div class="${gridFrameClass} ${handleClass}" data-index="${idx}" draggable="${isDraggable}">
            ${deleteBtnHtml}
            <div class="grid-img-wrapper">
              ${gridMediaPreviewHtml}
              ${overlayHtml}
              ${badgeHtml}
              ${gpsBadge}
            </div>
            <div class="grid-info">
              <div class="grid-title">
                <span>${this.escapeHtml(file.comment || file.name)}</span>
                ${this.state.isAdmin ? `<button class="edit-media-comment-btn" data-filename="${this.escapeHtml(file.name)}" data-comment="${this.escapeHtml(file.comment || '')}" title="Edit legend (.comment)">✏️</button>` : ''}
              </div>
              <div class="grid-subinfo">
                <span>${file.extension.toUpperCase()}</span>
                <span>${file.size_formatted}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    this.el.mediaGrid.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDeleteConfirmModal(btn.dataset.path, btn.dataset.name, 'file');
      });
    });

    this.el.mediaGrid.querySelectorAll('.edit-media-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const filename = btn.dataset.filename;
        const comment = btn.dataset.comment;
        this.openMediaCommentModal(filename, comment);
      });
    });

    this.el.mediaGrid.querySelectorAll('[data-index]').forEach(card => {
      const index = parseInt(card.dataset.index, 10);
      const file = this.state.filteredFiles[index];

      if (this.state.isAdmin && file) {
        card.addEventListener('dragstart', (e) => {
          this.state.draggingItemPath = file.path;
          card.classList.add('dragging');
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'internal_item', path: file.path }));
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          this.state.draggingItemPath = null;
        });
      }

      card.addEventListener('click', () => {
        this.openLightbox(index);
      });
    });
  }

  openLightbox(index) {
    if (index < 0 || index >= this.state.filteredFiles.length) return;
    this.state.lightboxIndex = index;
    const file = this.state.filteredFiles[index];

    this.el.lightboxTitle.textContent = file.name;
    this.el.lightboxMeta.textContent = `${file.size_formatted} • ${new Date(file.mtime * 1000).toLocaleDateString()}`;
    this.el.lightboxDownloadBtn.href = file.file_url;
    this.el.lightboxDownloadBtn.setAttribute('download', file.name);

    if (this.el.lightboxDeleteBtn) {
      this.el.lightboxDeleteBtn.style.display = this.state.isAdmin ? 'inline-flex' : 'none';
    }

    if (this.el.lightboxComment) {
      if (file.comment) {
        this.el.lightboxComment.textContent = `💬 ${file.comment}`;
        this.el.lightboxComment.style.display = 'block';
      } else {
        this.el.lightboxComment.style.display = 'none';
      }
    }

    this.resetZoom();

    if (file.exif) {
      if (this.el.lightboxExifBtn) this.el.lightboxExifBtn.style.display = 'inline-flex';
      this.renderExifData(file.exif);
    } else {
      if (this.el.lightboxExifBtn) this.el.lightboxExifBtn.style.display = 'none';
      this.toggleExifPanel(false);
    }

    if (file.category === 'image') {
      this.el.imageExplorerControls.style.display = 'flex';
    } else {
      this.el.imageExplorerControls.style.display = 'none';
    }

    let html = '';
    if (file.category === 'image') {
      html = `<img id="lightboxExplorerImg" src="${file.file_url}" alt="${this.escapeHtml(file.name)}" class="explorer-img" draggable="false" />`;
    } else if (file.category === 'video') {
      html = `
        <video controls autoplay name="media">
          <source src="${file.file_url}" type="video/${file.extension === 'mov' ? 'mp4' : file.extension}">
          Your browser does not support playing this video.
        </video>
      `;
    } else if (file.category === 'audio') {
      html = `
        <div class="lightbox-audio-card">
          <div style="font-size:4rem;">🎵</div>
          <h3>${this.escapeHtml(file.name)}</h3>
          <audio controls autoplay src="${file.file_url}"></audio>
        </div>
      `;
    } else {
      html = `
        <div class="lightbox-audio-card">
          <div style="font-size:4rem;">📄</div>
          <h3>${this.escapeHtml(file.name)}</h3>
          <p>${file.size_formatted}</p>
          <a href="${file.file_url}" target="_blank" class="pill-btn active" style="margin-top:1rem;display:inline-block;text-decoration:none;">Open File</a>
        </div>
      `;
    }

    this.el.lightboxContent.innerHTML = html;
    this.el.lightbox.classList.add('open');
  }

  toggleExifPanel(show) {
    if (!this.el.lightboxExifPanel) return;
    const isVisible = this.el.lightboxExifPanel.style.display === 'block';
    const targetState = show !== undefined ? show : !isVisible;
    this.el.lightboxExifPanel.style.display = targetState ? 'block' : 'none';
  }

  renderExifData(exif) {
    if (!this.el.exifPanelBody) return;
    if (!exif) {
      this.el.exifPanelBody.innerHTML = '<p style="color:var(--text-muted);font-style:italic;">Aucune métadonnée EXIF trouvée.</p>';
      return;
    }

    let html = '';

    if (exif.camera) {
      html += `
        <div class="exif-group">
          <div class="exif-label">Appareil Photo</div>
          <div class="exif-camera-box">📷 ${this.escapeHtml(exif.camera)}</div>
        </div>
      `;
    }

    if (exif.datetime) {
      html += `
        <div class="exif-group">
          <div class="exif-label">Date & Heure de Prise de Vue</div>
          <div class="exif-value">📅 ${this.escapeHtml(exif.datetime)}</div>
        </div>
      `;
    }

    if (exif.fnumber || exif.shutter_speed || exif.iso || exif.focal) {
      html += `
        <div class="exif-group">
          <div class="exif-label">Paramètres d'Exposition</div>
          <div class="exif-grid">
            ${exif.fnumber ? `<div><span class="exif-label">Ouverture</span><div class="exif-value">${this.escapeHtml(exif.fnumber)}</div></div>` : ''}
            ${exif.shutter_speed ? `<div><span class="exif-label">Vitesse</span><div class="exif-value">${this.escapeHtml(exif.shutter_speed)}</div></div>` : ''}
            ${exif.iso ? `<div><span class="exif-label">ISO</span><div class="exif-value">${this.escapeHtml(exif.iso)}</div></div>` : ''}
            ${exif.focal ? `<div><span class="exif-label">Focale</span><div class="exif-value">${this.escapeHtml(exif.focal)}</div></div>` : ''}
          </div>
        </div>
      `;
    }

    if (exif.gps) {
      html += `
        <div class="exif-group" style="margin-top:0.5rem;">
          <div class="exif-label">Géolocalisation GPS</div>
          <div class="exif-value" style="font-size:0.85rem;color:var(--text-muted);">
            Lat: ${exif.gps.lat}°, Lng: ${exif.gps.lng}°
          </div>
          <a href="${exif.gps.maps_url}" target="_blank" class="exif-maps-btn">
            📍 Ouvrir dans Google Maps
          </a>
        </div>
      `;
    }

    this.el.exifPanelBody.innerHTML = html || '<p style="color:var(--text-muted);font-style:italic;">Aucune métadonnée EXIF disponible.</p>';
  }

  // =============================================================
  // INTERACTIVE IMAGE EXPLORER ENGINE (Zoom, Pan, Rotate)
  // =============================================================

  isCurrentMediaImage() {
    if (this.state.lightboxIndex === null) return false;
    const file = this.state.filteredFiles[this.state.lightboxIndex];
    return file && file.category === 'image';
  }

  resetZoom() {
    this.zoomState = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
      isDragging: false,
      startX: 0,
      startY: 0
    };
    this.updateExplorerTransform(true);
  }

  clampTranslate() {
    const img = document.getElementById('lightboxExplorerImg');
    if (!img) return;

    const { scale, rotation } = this.zoomState;
    if (scale <= 1) {
      this.zoomState.translateX = 0;
      this.zoomState.translateY = 0;
      return;
    }

    const container = this.el.lightboxContent || img.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth || window.innerWidth;
    const containerHeight = container.clientHeight || window.innerHeight;

    const currentScale = scale || 1;
    const rect = img.getBoundingClientRect();
    const unscaledW = (rect.width > 0) ? (rect.width / currentScale) : (img.offsetWidth || containerWidth);
    const unscaledH = (rect.height > 0) ? (rect.height / currentScale) : (img.offsetHeight || containerHeight);

    const isRotated = (rotation % 180 !== 0);
    const effUnscaledW = isRotated ? unscaledH : unscaledW;
    const effUnscaledH = isRotated ? unscaledW : unscaledH;

    const scaledW = effUnscaledW * scale;
    const scaledH = effUnscaledH * scale;

    const maxPanX = Math.max(0, (scaledW - containerWidth) / 2);
    const maxPanY = Math.max(0, (scaledH - containerHeight) / 2);

    this.zoomState.translateX = Math.min(maxPanX, Math.max(-maxPanX, this.zoomState.translateX));
    this.zoomState.translateY = Math.min(maxPanY, Math.max(-maxPanY, this.zoomState.translateY));
  }

  adjustZoom(delta) {
    if (!this.isCurrentMediaImage()) return;
    let newScale = Math.min(Math.max(1, this.zoomState.scale + delta), 5);
    newScale = Math.round(newScale * 100) / 100;

    if (newScale === 1) {
      this.zoomState.translateX = 0;
      this.zoomState.translateY = 0;
    }

    this.zoomState.scale = newScale;
    this.clampTranslate();
    this.updateExplorerTransform(true);
  }

  rotateImage() {
    if (!this.isCurrentMediaImage()) return;
    this.zoomState.rotation = (this.zoomState.rotation + 90) % 360;
    this.clampTranslate();
    this.updateExplorerTransform(true);
  }

  startDrag(e) {
    if (!this.isCurrentMediaImage() || this.zoomState.scale <= 1) return;
    e.preventDefault();
    this.zoomState.isDragging = true;
    this.zoomState.startX = e.clientX - this.zoomState.translateX;
    this.zoomState.startY = e.clientY - this.zoomState.translateY;

    const img = document.getElementById('lightboxExplorerImg');
    if (img) img.classList.add('dragging');
  }

  startTouchDrag(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.touchState.startX = touch.clientX;
    this.touchState.startY = touch.clientY;
    this.touchState.startTime = Date.now();

    if (this.isCurrentMediaImage() && this.zoomState.scale > 1) {
      this.zoomState.isDragging = true;
      this.zoomState.startX = touch.clientX - this.zoomState.translateX;
      this.zoomState.startY = touch.clientY - this.zoomState.translateY;
    }
  }

  doDrag(e) {
    if (!this.zoomState.isDragging || !this.isCurrentMediaImage() || this.zoomState.scale <= 1) return;
    e.preventDefault();
    this.zoomState.translateX = e.clientX - this.zoomState.startX;
    this.zoomState.translateY = e.clientY - this.zoomState.startY;
    this.clampTranslate();
    this.updateExplorerTransform(false);
  }

  doTouchDrag(e) {
    if (this.isCurrentMediaImage() && this.zoomState.scale > 1 && this.zoomState.isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      this.zoomState.translateX = touch.clientX - this.zoomState.startX;
      this.zoomState.translateY = touch.clientY - this.zoomState.startY;
      this.clampTranslate();
      this.updateExplorerTransform(false);
    }
  }

  endDrag(e) {
    // Check horizontal touch swipe gesture for Lightbox navigation
    if (this.touchState.startTime > 0) {
      const elapsed = Date.now() - this.touchState.startTime;
      this.touchState.startTime = 0;

      if (!this.isCurrentMediaImage() || this.zoomState.scale === 1) {
        let endX = null;
        let endY = null;
        if (e && e.changedTouches && e.changedTouches.length > 0) {
          endX = e.changedTouches[0].clientX;
          endY = e.changedTouches[0].clientY;
        }

        if (endX !== null && endY !== null) {
          const deltaX = endX - this.touchState.startX;
          const deltaY = endY - this.touchState.startY;

          if (elapsed < 500 && Math.abs(deltaX) > 50 && Math.abs(deltaY) < 70) {
            if (deltaX < -50) {
              this.navigateLightbox(1);  // Swipe left -> Next
            } else if (deltaX > 50) {
              this.navigateLightbox(-1); // Swipe right -> Previous
            }
          }
        }
      }
    }

    this.zoomState.isDragging = false;
    const img = document.getElementById('lightboxExplorerImg');
    if (img) img.classList.remove('dragging');
  }

  updateExplorerTransform(withTransition = true) {
    const img = document.getElementById('lightboxExplorerImg');
    if (!img) return;

    this.clampTranslate();

    if (withTransition) {
      img.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)';
    } else {
      img.style.transition = 'none';
    }

    const { scale, translateX, translateY, rotation } = this.zoomState;
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;

    if (this.el.zoomBadge) {
      this.el.zoomBadge.textContent = `${Math.round(scale * 100)}%`;
      this.el.zoomBadge.classList.toggle('zoomed', scale > 1);
    }

    if (scale > 1) {
      img.style.cursor = this.zoomState.isDragging ? 'grabbing' : 'grab';
    } else {
      img.style.cursor = 'zoom-in';
    }
  }

  closeLightbox() {
    this.el.lightbox.classList.remove('open');
    this.el.lightboxContent.innerHTML = '';
    this.state.lightboxIndex = null;
    this.resetZoom();
  }

  navigateLightbox(direction) {
    if (this.state.lightboxIndex === null) return;
    let newIdx = this.state.lightboxIndex + direction;
    if (newIdx < 0) newIdx = this.state.filteredFiles.length - 1;
    if (newIdx >= this.state.filteredFiles.length) newIdx = 0;
    this.openLightbox(newIdx);
  }

  showLoading(show) {
    this.el.loadingState.style.display = show ? 'flex' : 'none';
  }

  toggleFullscreen() {
    const target = this.el.lightbox;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  // =============================================================
  // ADMIN AUTHENTICATION & UI MANAGEMENT
  // =============================================================

  updateAdminUI() {
    if (!this.el.adminBtn) return;

    if (this.state.isAdmin) {
      this.el.adminBtn.classList.add('admin-active');
      if (this.el.adminBtnIcon) this.el.adminBtnIcon.textContent = '🛡️';
      if (this.el.adminBtnText) this.el.adminBtnText.textContent = 'Admin Active';
      if (this.el.adminLoginState) this.el.adminLoginState.style.display = 'none';
      if (this.el.adminActiveState) this.el.adminActiveState.style.display = 'block';
      if (this.el.folderSettingsBtn) this.el.folderSettingsBtn.style.display = 'inline-flex';
      if (this.el.createFolderBtn) this.el.createFolderBtn.style.display = 'inline-flex';
      if (this.el.uploadMediaBtn) this.el.uploadMediaBtn.style.display = 'inline-flex';
      if (this.el.lightboxEditCommentBtn) this.el.lightboxEditCommentBtn.style.display = 'inline-flex';
      if (this.el.lightboxDeleteBtn) this.el.lightboxDeleteBtn.style.display = 'inline-flex';
    } else {
      this.el.adminBtn.classList.remove('admin-active');
      if (this.el.adminBtnIcon) this.el.adminBtnIcon.textContent = '🔑';
      if (this.el.adminBtnText) this.el.adminBtnText.textContent = 'Admin';
      if (this.el.adminLoginState) this.el.adminLoginState.style.display = 'block';
      if (this.el.adminActiveState) this.el.adminActiveState.style.display = 'none';
      if (this.el.folderSettingsBtn) this.el.folderSettingsBtn.style.display = 'none';
      if (this.el.createFolderBtn) this.el.createFolderBtn.style.display = 'none';
      if (this.el.uploadMediaBtn) this.el.uploadMediaBtn.style.display = 'none';
      if (this.el.lightboxEditCommentBtn) this.el.lightboxEditCommentBtn.style.display = 'none';
      if (this.el.lightboxDeleteBtn) this.el.lightboxDeleteBtn.style.display = 'none';
    }
  }

  openAdminModal() {
    if (!this.el.adminModal) return;
    this.updateAdminUI();
    this.el.adminModal.style.display = 'flex';
    setTimeout(() => this.el.adminModal.classList.add('open'), 10);
    if (!this.state.isAdmin && this.el.adminPasswordInput) {
      this.el.adminPasswordInput.focus();
    }
  }

  closeAdminModal() {
    if (!this.el.adminModal) return;
    this.el.adminModal.classList.remove('open');
    setTimeout(() => {
      this.el.adminModal.style.display = 'none';
    }, 250);
    if (this.el.adminLoginError) this.el.adminLoginError.style.display = 'none';
    if (this.el.adminChangePassMsg) this.el.adminChangePassMsg.style.display = 'none';
  }

  async loginAdmin() {
    const password = this.el.adminPasswordInput.value;
    if (!password) return;

    try {
      const res = await fetch('api.php?action=login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({ action: 'login', password, csrf_token: this.state.csrfToken })
      });
      const json = await res.json();
      if (json.csrf_token) this.state.csrfToken = json.csrf_token;

      if (json.success) {
        this.state.isAdmin = true;
        this.el.adminPasswordInput.value = '';
        if (this.el.adminLoginError) this.el.adminLoginError.style.display = 'none';
        this.updateAdminUI();
        this.closeAdminModal();
        this.loadDirectory(this.state.currentPath);
      } else {
        if (this.el.adminLoginError) {
          this.el.adminLoginError.textContent = json.error || 'Login failed';
          this.el.adminLoginError.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Login request failed:', err);
    }
  }

  async logoutAdmin() {
    try {
      const res = await fetch('api.php?action=logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({ action: 'logout', csrf_token: this.state.csrfToken })
      });
      const json = await res.json();
      if (json.success) {
        this.state.isAdmin = false;
        this.updateAdminUI();
        this.closeAdminModal();
        this.loadDirectory(this.state.currentPath);
      }
    } catch (err) {

      console.error('Logout request failed:', err);
    }
  }

  async handleUploadFiles(fileList) {


    if (!this.state.isAdmin || !fileList || fileList.length === 0) return;

    const allFiles = Array.from(fileList);
    const BATCH_SIZE = 10;
    const totalFiles = allFiles.length;
    const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);

    if (this.el.uploadProgressModal) {
      this.el.uploadProgressModal.style.display = 'block';
      this.el.uploadProgressModal.classList.add('open');
    }
    if (this.el.uploadProgressBar) {
      this.el.uploadProgressBar.style.width = '0%';
      this.el.uploadProgressBar.textContent = '0%';
    }
    if (this.el.uploadProgressStatus) {
      this.el.uploadProgressStatus.textContent = `Préparation du téléversement de ${totalFiles} fichier(s)...`;
    }
    if (this.el.uploadResultMessages) {
      this.el.uploadResultMessages.style.display = 'none';
      this.el.uploadResultMessages.innerHTML = '';
    }

    const allUploaded = [];
    const allErrors = [];

    for (let b = 0; b < totalBatches; b++) {
      const batchFiles = allFiles.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      const batchNum = b + 1;

      if (this.el.uploadProgressStatus) {
        this.el.uploadProgressStatus.textContent = totalBatches > 1
          ? `Téléversement du lot ${batchNum}/${totalBatches} (${batchFiles.length} fichier(s))...`
          : `Téléversement de ${batchFiles.length} fichier(s)...`;
      }

      try {
        const result = await this.uploadBatch(batchFiles, (loaded, total) => {
          if (this.el.uploadProgressBar && total > 0) {
            const batchProgress = loaded / total;
            const overallPercent = Math.min(100, Math.round(((b + batchProgress) / totalBatches) * 100));
            this.el.uploadProgressBar.style.width = `${overallPercent}%`;
            this.el.uploadProgressBar.textContent = `${overallPercent}%`;
          }
        });

        if (result.uploaded && result.uploaded.length > 0) {
          allUploaded.push(...result.uploaded);
        }
        if (result.errors && result.errors.length > 0) {
          allErrors.push(...result.errors);
        }
        if (!result.success && result.error && (!result.errors || result.errors.length === 0)) {
          allErrors.push(result.error);
        }
      } catch (err) {
        allErrors.push(`Erreur réseau sur le lot ${batchNum} : ${err.message || 'Échec du transfert'}`);
      }
    }

    if (this.el.uploadProgressBar) {
      this.el.uploadProgressBar.style.width = '100%';
      this.el.uploadProgressBar.textContent = '100%';
    }

    if (this.el.uploadProgressStatus) {
      this.el.uploadProgressStatus.textContent = allErrors.length === 0
        ? `Téléversement terminé (${allUploaded.length}/${totalFiles} fichiers téléversé(s)) !`
        : `Téléversement terminé avec des erreurs.`;
    }

    if (this.el.uploadResultMessages) {
      let msgHtml = '';
      if (allUploaded.length > 0) {
        msgHtml += `<div style="color:#4ade80;margin-bottom:0.4rem;">✔ ${allUploaded.length} fichier(s) téléversé(s) avec succès.</div>`;
        allUploaded.forEach(item => {
          if (item.renamed) {
            msgHtml += `<div style="color:#facc15;font-size:0.8rem;margin-left:1rem;">ℹ ${this.escapeHtml(item.original_name)} ➔ ${this.escapeHtml(item.saved_name)} (Renommé)</div>`;
          }
        });
      }
      if (allErrors.length > 0) {
        msgHtml += `<div style="color:#f87171;margin-top:0.4rem;">❌ Échecs / Rejets :</div>`;
        allErrors.forEach(err => {
          msgHtml += `<div style="color:#f87171;font-size:0.8rem;margin-left:1rem;">• ${this.escapeHtml(err)}</div>`;
        });
      }
      this.el.uploadResultMessages.innerHTML = msgHtml;
      this.el.uploadResultMessages.style.display = 'block';
    }

    setTimeout(() => {
      if (this.el.uploadProgressModal) {
        this.el.uploadProgressModal.style.display = 'none';
        this.el.uploadProgressModal.classList.remove('open');
      }
      this.loadDirectory(this.state.currentPath);
    }, allErrors.length > 0 ? 3500 : 1200);
  }

  uploadBatch(batchFiles, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('action', 'upload_file');
      formData.append('dir', this.state.currentPath);
      if (this.state.csrfToken) {
        formData.append('csrf_token', this.state.csrfToken);
      }

      batchFiles.forEach(f => {
        formData.append('files[]', f);
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'api.php', true);
      if (this.state.csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', this.state.csrfToken);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(e.loaded, e.total);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch (err) {
          resolve({ success: false, error: 'Réponse serveur invalide.' });
        }
      };

      xhr.onerror = () => {
        reject(new Error('Erreur réseau lors du transfert.'));
      };

      xhr.send(formData);
    });
  }


  async moveItem(sourcePath, targetDir) {
    if (!this.state.isAdmin || !sourcePath) return;

    try {
      const res = await fetch('api.php?action=move_item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({
          action: 'move_item',
          source_path: sourcePath,
          target_dir: targetDir,
          csrf_token: this.state.csrfToken
        })
      });
      const json = await res.json();
      if (json.success) {
        this.loadDirectory(this.state.currentPath);
      } else {
        alert(json.error || 'Échec du déplacement de l\'élément.');
      }
    } catch (err) {
      console.error('Move item request failed:', err);
    }
  }

  openCreateFolderModal() {
    if (!this.state.isAdmin || !this.el.createFolderModal) return;
    if (this.el.createFolderNameInput) this.el.createFolderNameInput.value = '';
    if (this.el.createFolderError) this.el.createFolderError.style.display = 'none';
    this.el.createFolderModal.style.display = 'block';
    this.el.createFolderModal.classList.add('open');
    if (this.el.createFolderNameInput) this.el.createFolderNameInput.focus();
  }

  closeCreateFolderModal() {
    if (!this.el.createFolderModal) return;
    this.el.createFolderModal.style.display = 'none';
    this.el.createFolderModal.classList.remove('open');
  }

  async createFolder() {
    if (!this.state.isAdmin || !this.el.createFolderNameInput) return;
    const folderName = this.el.createFolderNameInput.value.trim();
    if (!folderName) return;

    if (this.el.createFolderError) this.el.createFolderError.style.display = 'none';

    try {
      const res = await fetch('api.php?action=create_folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({
          action: 'create_folder',
          dir: this.state.currentPath,
          folder_name: folderName,
          csrf_token: this.state.csrfToken
        })
      });
      const json = await res.json();
      if (json.success) {
        this.closeCreateFolderModal();
        this.loadDirectory(this.state.currentPath);
      } else {
        if (this.el.createFolderError) {
          this.el.createFolderError.textContent = json.error || 'Échec de la création du dossier.';
          this.el.createFolderError.style.display = 'block';
        }
      }
    } catch (err) {
      if (this.el.createFolderError) {
        this.el.createFolderError.textContent = 'Erreur réseau lors de la création du dossier.';
        this.el.createFolderError.style.display = 'block';
      }
    }
  }

  openDeleteConfirmModal(targetPath, itemName, itemType, isFromLightbox = false) {
    if (!this.state.isAdmin || !this.el.deleteConfirmModal) return;
    this.state.targetItemToDelete = { path: targetPath, name: itemName, type: itemType, isFromLightbox };

    if (this.el.deleteConfirmMessage) {
      if (itemType === 'folder') {
        this.el.deleteConfirmMessage.innerHTML = `Êtes-vous sûr de vouloir supprimer le dossier <strong>"${this.escapeHtml(itemName)}"</strong> ?<br/><br/><span style="color:#ef4444;font-weight:600;">⚠️ Attention : Ce dossier et tout son contenu seront définitivement supprimés !</span>`;
      } else {
        this.el.deleteConfirmMessage.innerHTML = `Êtes-vous sûr de vouloir supprimer définitivement le fichier <strong>"${this.escapeHtml(itemName)}"</strong> ?`;
      }
    }

    this.el.deleteConfirmModal.style.display = 'block';
    this.el.deleteConfirmModal.classList.add('open');
  }

  closeDeleteConfirmModal() {
    if (!this.el.deleteConfirmModal) return;
    this.el.deleteConfirmModal.style.display = 'none';
    this.el.deleteConfirmModal.classList.remove('open');
    this.state.targetItemToDelete = null;
  }

  async confirmDeleteItem() {
    if (!this.state.isAdmin || !this.state.targetItemToDelete) return;
    const { path: targetPath, isFromLightbox } = this.state.targetItemToDelete;

    try {
      const res = await fetch('api.php?action=delete_item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({
          action: 'delete_item',
          target_path: targetPath,
          csrf_token: this.state.csrfToken
        })
      });
      const json = await res.json();
      if (json.success) {
        this.closeDeleteConfirmModal();
        if (isFromLightbox) {
          this.closeLightbox();
        }
        this.loadDirectory(this.state.currentPath);
      } else {
        alert(json.error || 'Échec de la suppression.');
      }
    } catch (err) {
      console.error('Delete request failed:', err);
      alert('Erreur réseau lors de la suppression.');
    }
  }

  async changeAdminPassword() {
    const new_password = this.el.newAdminPasswordInput.value;
    if (!new_password) return;

    try {
      const res = await fetch('api.php?action=change_password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({ action: 'change_password', new_password, csrf_token: this.state.csrfToken })
      });
      const json = await res.json();

      if (json.success) {
        this.el.newAdminPasswordInput.value = '';
        if (this.el.adminChangePassMsg) {
          this.el.adminChangePassMsg.textContent = '✅ ' + json.message;
          this.el.adminChangePassMsg.style.display = 'block';
        }
      } else {
        alert(json.error || 'Failed to change password');
      }
    } catch (err) {
      console.error('Change password failed:', err);
    }
  }

  // =============================================================
  // DOTFILE CUSTOMIZATION & EDITING (ADMIN MODE)
  // =============================================================

  async updateDotfile(type, value, filename = '', folderPassword = '') {
    try {
      const res = await fetch('api.php?action=update_dotfile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({
          action: 'update_dotfile',
          dir: this.state.currentPath,
          type,
          value,
          filename,
          folder_password: folderPassword,
          csrf_token: this.state.csrfToken
        })
      });
      return await res.json();
    } catch (err) {
      console.error(`Failed to update dotfile ${type}:`, err);
      return { success: false, error: err.message };
    }
  }

  openFolderSettingsModal() {
    if (!this.el.folderSettingsModal) return;
    const overrides = this.state.overrides || {};
    if (this.el.dotfileTitleInput) this.el.dotfileTitleInput.value = overrides.title || '';
    if (this.el.dotfileDescInput) this.el.dotfileDescInput.value = overrides.description || '';
    if (this.el.dotfileBgInput) this.el.dotfileBgInput.value = overrides.background || '';
    if (this.el.dotfileThemeSelect) {
      this.el.dotfileThemeSelect.value = overrides.theme_name || (typeof overrides.theme === 'string' ? overrides.theme : '');
    }
    if (this.el.dotfileAccessModeSelect) {
      this.el.dotfileAccessModeSelect.value = overrides.access_mode || 'public';
    }
    if (this.el.folderPasswordGroup) {
      this.el.folderPasswordGroup.style.display = (overrides.access_mode === 'password') ? 'block' : 'none';
    }
    if (this.el.dotfileFolderPasswordInput) {
      this.el.dotfileFolderPasswordInput.value = '';
    }
    this.el.folderSettingsModal.style.display = 'flex';
    setTimeout(() => this.el.folderSettingsModal.classList.add('open'), 10);
  }

  closeFolderSettingsModal() {
    if (!this.el.folderSettingsModal) return;
    this.el.folderSettingsModal.classList.remove('open');
    setTimeout(() => {
      this.el.folderSettingsModal.style.display = 'none';
    }, 250);
  }

  async saveFolderSettings() {
    const titleVal = this.el.dotfileTitleInput ? this.el.dotfileTitleInput.value.trim() : '';
    const descVal = this.el.dotfileDescInput ? this.el.dotfileDescInput.value.trim() : '';
    const bgVal = this.el.dotfileBgInput ? this.el.dotfileBgInput.value.trim() : '';
    const themeVal = this.el.dotfileThemeSelect ? this.el.dotfileThemeSelect.value : '';
    const accessModeVal = this.el.dotfileAccessModeSelect ? this.el.dotfileAccessModeSelect.value : 'public';
    const folderPasswordVal = this.el.dotfileFolderPasswordInput ? this.el.dotfileFolderPasswordInput.value.trim() : '';

    this.showLoading(true);
    const results = await Promise.all([
      this.updateDotfile('title', titleVal),
      this.updateDotfile('description', descVal),
      this.updateDotfile('bg', bgVal),
      this.updateDotfile('theme', themeVal),
      this.updateDotfile('access_mode', accessModeVal, '', folderPasswordVal)
    ]);

    const failed = results.find(r => r && !r.success);
    if (failed) {
      this.showLoading(false);
      alert('⚠️ ' + (failed.error || 'Permission denied: Cannot write dotfile in this folder.'));
      return;
    }

    this.closeFolderSettingsModal();
    await this.loadDirectory(this.state.currentPath);
  }

  async lockFolder(dirPath) {
    this.showLoading(true);
    try {
      const res = await fetch('api.php?action=lock_folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({ action: 'lock_folder', dir: dirPath, csrf_token: this.state.csrfToken })
      });
      const json = await res.json();
      if (json.success) {
        await this.loadDirectory(dirPath);
      }
    } catch (err) {
      console.error('Lock folder failed:', err);
    } finally {
      this.showLoading(false);
    }
  }

  openFolderUnlockModal(dirPath) {
    if (!this.el.folderUnlockModal) return;
    if (this.el.folderUnlockPath) this.el.folderUnlockPath.value = dirPath;
    if (this.el.folderUnlockPasswordInput) this.el.folderUnlockPasswordInput.value = '';
    if (this.el.folderUnlockError) this.el.folderUnlockError.style.display = 'none';
    this.el.folderUnlockModal.style.display = 'flex';
    setTimeout(() => this.el.folderUnlockModal.classList.add('open'), 10);
    if (this.el.folderUnlockPasswordInput) this.el.folderUnlockPasswordInput.focus();
  }

  closeFolderUnlockModal() {
    if (!this.el.folderUnlockModal) return;
    this.el.folderUnlockModal.classList.remove('open');
    setTimeout(() => {
      this.el.folderUnlockModal.style.display = 'none';
    }, 250);
  }

  async unlockFolder() {
    const dirPath = this.el.folderUnlockPath ? this.el.folderUnlockPath.value : '';
    const password = this.el.folderUnlockPasswordInput ? this.el.folderUnlockPasswordInput.value : '';

    if (!dirPath || !password) return;

    try {
      const res = await fetch('api.php?action=unlock_folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({ action: 'unlock_folder', dir: dirPath, password, csrf_token: this.state.csrfToken })
      });
      const json = await res.json();

      if (json.success) {
        this.closeFolderUnlockModal();
        this.navigateTo(dirPath);
      } else {
        if (this.el.folderUnlockError) {
          this.el.folderUnlockError.textContent = json.error || 'Mot de passe incorrect';
          this.el.folderUnlockError.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Folder unlock failed:', err);
    }
  }

  openMediaCommentModal(filename, currentComment) {
    if (!this.el.mediaCommentModal) return;
    if (this.el.mediaCommentFilename) this.el.mediaCommentFilename.value = filename;
    if (this.el.mediaCommentFilenameLabel) this.el.mediaCommentFilenameLabel.textContent = `Fichier : ${filename}`;
    if (this.el.mediaCommentInput) this.el.mediaCommentInput.value = currentComment || '';
    this.el.mediaCommentModal.style.display = 'flex';
    setTimeout(() => this.el.mediaCommentModal.classList.add('open'), 10);
    if (this.el.mediaCommentInput) this.el.mediaCommentInput.focus();
  }

  closeMediaCommentModal() {
    if (!this.el.mediaCommentModal) return;
    this.el.mediaCommentModal.classList.remove('open');
    setTimeout(() => {
      this.el.mediaCommentModal.style.display = 'none';
    }, 250);
  }

  async saveMediaComment() {
    const filename = this.el.mediaCommentFilename ? this.el.mediaCommentFilename.value : '';
    const commentVal = this.el.mediaCommentInput ? this.el.mediaCommentInput.value.trim() : '';

    if (!filename) return;

    this.showLoading(true);
    const res = await this.updateDotfile('comment', commentVal, filename);

    if (!res || !res.success) {
      this.showLoading(false);
      alert('⚠️ ' + (res.error || 'Permission denied: Cannot write .comment in this folder.'));
      return;
    }

    this.closeMediaCommentModal();
    await this.loadDirectory(this.state.currentPath);

    // If lightbox is currently open on this file, update its comment immediately
    if (this.state.lightboxIndex !== null) {
      const file = this.state.filteredFiles[this.state.lightboxIndex];
      if (file && file.name === filename) {
        file.comment = commentVal;
        if (this.el.lightboxComment) {
          if (commentVal) {
            this.el.lightboxComment.textContent = `💬 ${commentVal}`;
            this.el.lightboxComment.style.display = 'block';
          } else {
            this.el.lightboxComment.style.display = 'none';
          }
        }
      }
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;')
      .replace(/\//g, '&#47;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.galleryApp = new SimpleGallery();
});
