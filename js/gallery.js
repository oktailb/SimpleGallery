/**
 * SimpleGallery 2026 - Vanilla JS Client Application
 * Includes Interactive Image Explorer Engine (Zoom, Pan/Drag, Rotation, Touch & Shortcuts)
 */

class SimpleGallery {
  constructor() {
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const cookieConsentMeta = document.querySelector('meta[name="cookie-consent-enabled"]');
    const isConsentEnabled = cookieConsentMeta ? cookieConsentMeta.content === '1' : true;

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
      isSlideshowPlaying: false,
      slideshowInterval: null,
      slideshowDelay: 3000,
      showFavoritesOnly: false,
      isSearchActive: false,
      overrides: null,
      isAdmin: false,
      adminEnabled: false,
      csrfToken: csrfMeta ? csrfMeta.content : '',
      isCookieConsentEnabled: isConsentEnabled,
      cookieConsent: this.getCookieConsent(),
      draggingItemPath: null,
      targetItemToDelete: null,
      favorites: JSON.parse(localStorage.getItem('sg_favorites') || '[]'),
      userRights: {
        is_admin: false,
        can_upload: false,
        can_delete: false,
        can_move: false,
        can_comment: true,
        can_create_folder: false,
        can_download_archive: true,
        can_download_item: true
      },
      availableArchives: {}
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

    // Touch Swipe & Pinch-to-Zoom State for Mobile
    this.touchState = {
      startX: 0,
      startY: 0,
      startTime: 0,
      pinchDist: 0,
      pinchScale: 1,
      isPinching: false
    };

    // Multi-Selection State (Ctrl, Shift, Rectangular Marquee)
    this.state.selectedPaths = new Set();
    this.state.lastSelectedIndex = null;
    this.state.draggingPaths = null;

    this.emptyDragImage = new Image();
    this.emptyDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    this.isSmartGpsEnabled = true;

    this.initElements();
    this.bindEvents();
    this.initPipPlayer();
    this.initAdvancedSearch();
    this.initCookieConsent();
    this.initImageEditor();
    this.updateFavoritesCountUI();
    this.handleUrlChange();
  }

  initElements() {
    this.el = {
      breadcrumbs: document.getElementById('breadcrumbs'),
      folderSection: document.getElementById('folderSection'),
      foldersGrid: document.getElementById('foldersGrid'),
      mediaGrid: document.getElementById('mediaGrid'),
      searchInput: document.getElementById('searchInput'),
      searchClearBtn: document.getElementById('searchClearBtn'),
      searchResultsBanner: document.getElementById('searchResultsBanner'),
      searchResultsCountText: document.getElementById('searchResultsCountText'),
      exitSearchBtn: document.getElementById('exitSearchBtn'),
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
      lightboxFavBtn: document.getElementById('lightboxFavBtn'),
      lightboxExifBtn: document.getElementById('lightboxExifBtn'),
      lightboxEditImageBtn: document.getElementById('lightboxEditImageBtn'),
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
      deleteConfirmMessage: document.getElementById('deleteConfirmMessage'),

      // Feature Controls
      toggleFavoritesBtn: document.getElementById('toggleFavoritesBtn'),
      downloadArchiveBtn: document.getElementById('downloadArchiveBtn'),
      archiveMenu: document.getElementById('archiveMenu'),
      advancedSearchBtn: document.getElementById('advancedSearchBtn'),
      searchModal: document.getElementById('searchModal'),
      searchModalCloseBtn: document.getElementById('searchModalCloseBtn'),
      searchAdvancedForm: document.getElementById('searchAdvancedForm'),
      advSearchResetBtn: document.getElementById('advSearchResetBtn'),
      pipWidget: document.getElementById('pip-player-widget'),
      pipTitle: document.getElementById('pipTitle'),
      pipMediaContainer: document.getElementById('pipMediaContainer'),
      pipHeader: document.getElementById('pipHeader'),
      pipMinimizeBtn: document.getElementById('pipMinimizeBtn'),
      pipCloseBtn: document.getElementById('pipCloseBtn'),

      // Interactive Leaflet Map Elements
      mapModal: document.getElementById('mapModal'),
      mapModalCloseBtn: document.getElementById('mapModalCloseBtn'),
      mapModalCountBadge: document.getElementById('mapModalCountBadge'),
      mapToggleSmartGpsBtn: document.getElementById('mapToggleSmartGpsBtn'),
      mapSmartGpsCount: document.getElementById('mapSmartGpsCount'),
      mapToggleRouteBtn: document.getElementById('mapToggleRouteBtn'),
      mapFitBoundsBtn: document.getElementById('mapFitBoundsBtn'),

      // Multi-Selection Action Toolbar
      selectionToolbar: document.getElementById('selectionToolbar'),
      selectionToolbarCount: document.getElementById('selectionToolbarCount'),
      selectionSelectAllBtn: document.getElementById('selectionSelectAllBtn'),
      selectionClearBtn: document.getElementById('selectionClearBtn'),

      // Cookie Consent Elements
      cookieConsentBanner: document.getElementById('cookieConsentBanner'),
      cookieAcceptAllBtn: document.getElementById('cookieAcceptAllBtn'),
      cookieRejectNonEssentialBtn: document.getElementById('cookieRejectNonEssentialBtn'),
      cookieCustomizeBtn: document.getElementById('cookieCustomizeBtn'),
      cookieSettingsModal: document.getElementById('cookieSettingsModal'),
      cookieSettingsCloseBtn: document.getElementById('cookieSettingsCloseBtn'),
      cookieOptNecessary: document.getElementById('cookieOptNecessary'),
      cookieOptPreferences: document.getElementById('cookieOptPreferences'),
      cookieOptCdn: document.getElementById('cookieOptCdn'),
      cookieSaveCustomBtn: document.getElementById('cookieSaveCustomBtn'),
      cookieModalAcceptAllBtn: document.getElementById('cookieModalAcceptAllBtn'),
      openCookieSettingsBtn: document.getElementById('openCookieSettingsBtn'),

      // Admin Image Editor Elements
      imageEditorModal: document.getElementById('imageEditorModal'),
      imageEditorCloseBtn: document.getElementById('imageEditorCloseBtn'),
      editorResetAllBtn: document.getElementById('editorResetAllBtn'),
      editorOpenSaveChoiceBtn: document.getElementById('editorOpenSaveChoiceBtn'),
      editorCanvas: document.getElementById('editorCanvas'),
      editorCanvasWrapper: document.getElementById('editorCanvasWrapper'),
      editorCropBox: document.getElementById('editorCropBox'),
      editorToggleCropBtn: document.getElementById('editorToggleCropBtn'),
      editorApplyCropBtn: document.getElementById('editorApplyCropBtn'),
      editorRotateCcwBtn: document.getElementById('editorRotateCcwBtn'),
      editorRotateCwBtn: document.getElementById('editorRotateCwBtn'),
      editorFlipHBtn: document.getElementById('editorFlipHBtn'),
      editorFlipVBtn: document.getElementById('editorFlipVBtn'),
      editorBrightnessSlider: document.getElementById('editorBrightnessSlider'),
      editorBrightnessVal: document.getElementById('editorBrightnessVal'),
      editorContrastSlider: document.getElementById('editorContrastSlider'),
      editorContrastVal: document.getElementById('editorContrastVal'),
      editorSaturationSlider: document.getElementById('editorSaturationSlider'),
      editorSaturationVal: document.getElementById('editorSaturationVal'),
      editorImageNameBadge: document.getElementById('editorImageNameBadge'),
      editorImageDimBadge: document.getElementById('editorImageDimBadge'),
      imageSaveChoiceModal: document.getElementById('imageSaveChoiceModal'),
      saveChoiceCloseBtn: document.getElementById('saveChoiceCloseBtn'),
      saveChoiceCancelBtn: document.getElementById('saveChoiceCancelBtn'),
      saveChoiceConfirmBtn: document.getElementById('saveChoiceConfirmBtn'),
      saveChoiceCopyNamePreview: document.getElementById('saveChoiceCopyNamePreview')
    };
  }

  bindEvents() {
    window.addEventListener('popstate', () => this.handleUrlChange());

    this.el.searchInput.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.toLowerCase();
      if (this.el.searchClearBtn) {
        this.el.searchClearBtn.style.display = e.target.value ? 'flex' : 'none';
      }
      this.applyFilterAndRender();
    });

    if (this.el.searchClearBtn) {
      this.el.searchClearBtn.addEventListener('click', () => {
        this.exitSearch();
      });
    }

    if (this.el.exitSearchBtn) {
      this.el.exitSearchBtn.addEventListener('click', () => {
        this.exitSearch();
      });
    }

    this.el.sortSelect.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      if (['date', 'exif_date', 'size'].includes(e.target.value)) {
        this.state.sortOrder = 'desc';
      } else {
        this.state.sortOrder = 'asc';
      }
      this.saveFolderSort(this.state.currentPath, this.state.sortBy, this.state.sortOrder);
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

    if (this.el.folderMapBtn) {
      this.el.folderMapBtn.addEventListener('click', () => this.openMapModal());
    }

    // Protection anti-clic droit "Enregistrer sous" et glisser-déposer quand la permission de téléchargement direct est désactivée
    document.addEventListener('contextmenu', (e) => {
      const canDownloadItem = this.state.isAdmin || (this.state.userRights ? this.state.userRights.can_download_item !== false : true);
      if (!canDownloadItem) {
        const target = e.target;
        if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'AUDIO' || target.closest('.polaroid-card, .grid-card, .lightbox-content')) {
          e.preventDefault();
          return false;
        }
      }
    }, true);

    document.addEventListener('dragstart', (e) => {
      const canDownloadItem = this.state.isAdmin || (this.state.userRights ? this.state.userRights.can_download_item !== false : true);
      if (!canDownloadItem) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') {
          e.preventDefault();
          return false;
        }
      }
    }, true);

    if (this.el.mapModalCloseBtn) {
      this.el.mapModalCloseBtn.addEventListener('click', () => this.closeMapModal());
    }

    if (this.el.mapModal) {
      this.el.mapModal.addEventListener('click', (e) => {
        if (e.target === this.el.mapModal) this.closeMapModal();
      });
    }

    if (this.el.mapToggleSmartGpsBtn) {
      this.el.mapToggleSmartGpsBtn.addEventListener('click', () => this.toggleSmartGps());
    }

    if (this.el.mapToggleRouteBtn) {
      this.el.mapToggleRouteBtn.addEventListener('click', () => this.toggleMapRoute());
    }

    if (this.el.mapFitBoundsBtn) {
      this.el.mapFitBoundsBtn.addEventListener('click', () => this.fitMapBounds());
    }

    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.map-layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setMapTileLayer(btn.dataset.layer);
      });
    });

    if (this.el.toggleFavoritesBtn) {
      this.el.toggleFavoritesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.showFavoritesOnly = !this.state.showFavoritesOnly;
        this.updateFavoritesCountUI();
        this.applyFilterAndRender();
      });
    }

    if (this.el.downloadArchiveBtn && this.el.archiveMenu) {
      this.el.downloadArchiveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.el.archiveMenu.classList.toggle('open');
      });
      window.addEventListener('click', () => {
        if (this.el.archiveMenu) this.el.archiveMenu.classList.remove('open');
      });
    }

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
    if (this.el.lightboxFavBtn) {
      this.el.lightboxFavBtn.addEventListener('click', () => {
        if (this.state.lightboxIndex !== null) {
          const file = this.state.filteredFiles[this.state.lightboxIndex];
          if (file) this.toggleFavorite(file.path);
        }
      });
    }

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

    // Touch Drag, Swipe & Pinch-to-Zoom Events for Mobile
    this.el.lightboxContent.addEventListener('touchstart', (e) => this.startTouchDrag(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.doTouchDrag(e), { passive: false });
    window.addEventListener('touchend', (e) => this.endDrag(e));

    // Mobile Hardware "Back" Button / History Popstate Listener
    window.addEventListener('popstate', (e) => {
      if (this.el.lightbox && this.el.lightbox.classList.contains('open')) {
        this.closeLightbox(false);
      }
    });

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
        (this.el.folderUnlockModal && this.el.folderUnlockModal.classList.contains('open')) ||
        (this.el.searchModal && this.el.searchModal.classList.contains('open')) ||
        (this.el.mapModal && this.el.mapModal.classList.contains('open')) ||
        (this.el.cookieSettingsModal && this.el.cookieSettingsModal.classList.contains('open')) ||
        (this.el.imageEditorModal && this.el.imageEditorModal.classList.contains('open')) ||
        (this.el.imageSaveChoiceModal && this.el.imageSaveChoiceModal.classList.contains('open'));

      if (isInputFocused || isModalOpen) {
        if (e.key === 'Escape') {
          if (this.el.imageSaveChoiceModal && this.el.imageSaveChoiceModal.classList.contains('open')) {
            this.closeSaveChoiceModal();
          } else if (this.el.imageEditorModal && this.el.imageEditorModal.classList.contains('open')) {
            this.closeImageEditor();
          } else if (this.el.mediaCommentModal && this.el.mediaCommentModal.classList.contains('open')) {
            this.closeMediaCommentModal();
          } else if (this.el.folderSettingsModal && this.el.folderSettingsModal.classList.contains('open')) {
            this.closeFolderSettingsModal();
          } else if (this.el.adminModal && this.el.adminModal.classList.contains('open')) {
            this.closeAdminModal();
          } else if (this.el.folderUnlockModal && this.el.folderUnlockModal.classList.contains('open')) {
            this.closeFolderUnlockModal();
          } else if (this.el.searchModal && this.el.searchModal.classList.contains('open')) {
            this.closeSearchModal();
          } else if (this.el.mapModal && this.el.mapModal.classList.contains('open')) {
            this.closeMapModal();
          } else if (this.el.cookieSettingsModal && this.el.cookieSettingsModal.classList.contains('open')) {
            this.closeCookieSettings();
          }
        }
        return;
      }

      if (!this.el.lightbox.classList.contains('open')) {
        if (e.key === 'Escape') {
          if (this.state.selectedPaths.size > 0) {
            this.clearSelection();
            return;
          }
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
          e.preventDefault();
          this.selectAll();
          return;
        }
        return;
      }

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

    window.addEventListener('dragover', (e) => {
      if (this.state.draggingItemPath || this.state.draggingPaths) {
        this.updateDragFollowerPos(e.clientX, e.clientY);
      }
    });

    window.addEventListener('dragend', () => {
      this.hideDragFollower();
    });

    window.addEventListener('drop', () => {
      this.hideDragFollower();
    });

    if (this.el.selectionSelectAllBtn) {
      this.el.selectionSelectAllBtn.addEventListener('click', () => this.selectAll());
    }
    if (this.el.selectionClearBtn) {
      this.el.selectionClearBtn.addEventListener('click', () => this.clearSelection());
    }

    this.initMarqueeSelection();

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
          this.renderPrivateState(json.error || 'Accès refusé');
        }
        this.showLoading(false);
        return;
      }

      this.state.isSearchActive = false;
      if (this.el.searchResultsBanner) {
        this.el.searchResultsBanner.style.display = 'none';
      }
      if (this.el.searchInput && !this.state.searchQuery) {
        this.el.searchInput.value = '';
        if (this.el.searchClearBtn) this.el.searchClearBtn.style.display = 'none';
      }

      this.state.directories = json.directories;
      this.state.files = json.files;
      this.state.overrides = json.overrides || {};
      this.state.isAdmin = !!json.is_admin;
      this.state.adminEnabled = !!json.admin_enabled;
      this.state.userPermissions = json.user_permissions || {};
      if (json.user_rights) this.state.userRights = json.user_rights;
      if (json.available_archives) this.state.availableArchives = json.available_archives;
      if (json.csrf_token) this.state.csrfToken = json.csrf_token;

      this.updateAdminUI();
      this.updateRightsUI();
      this.updateArchiveMenuUI();

      // Restore per-folder persistent sort order
      const savedSort = this.getFolderSort(dirPath);
      if (savedSort && savedSort.sortBy) {
        this.state.sortBy = savedSort.sortBy;
        this.state.sortOrder = savedSort.sortOrder || 'asc';
      } else {
        this.state.sortBy = 'name';
        this.state.sortOrder = 'asc';
      }
      if (this.el.sortSelect) {
        this.el.sortSelect.value = this.state.sortBy;
      }
      this.updateSortOrderUI();

      this.applyDotfileOverrides(this.state.overrides);
      this.renderBreadcrumbs(json.breadcrumbs);
      this.renderFolders(json.directories);
      this.updateFavoritesCountUI();
      this.applyFilterAndRender();

    } catch (err) {
      console.error('Error fetching gallery directory:', err);
    } finally {
      this.showLoading(false);
    }
  }

  applyDotfileOverrides(overrides) {
    if (overrides.background) {
      const isImg = overrides.background.startsWith('thumb.php') ||
                    overrides.background.includes('/') ||
                    /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(overrides.background) ||
                    /^https?:\/\//i.test(overrides.background);

      if (isImg && !overrides.background.includes('linear-gradient') && !overrides.background.startsWith('#') && !overrides.background.startsWith('rgb')) {
        document.body.style.backgroundImage = `url("${overrides.background}")`;
        document.body.style.backgroundSize = '100% 100%';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
      } else {
        document.body.style.backgroundImage = '';
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
    if (this.isPreferencesStorageAllowed()) {
      localStorage.setItem('gallery_view_mode', mode);
    }
    this.el.viewPolaroidBtn.classList.toggle('active', mode === 'polaroid');
    this.el.viewGridBtn.classList.toggle('active', mode === 'grid');
    this.renderMedia();
  }

  toggleSortOrder() {
    this.state.sortOrder = (this.state.sortOrder === 'asc') ? 'desc' : 'asc';
    this.saveFolderSort(this.state.currentPath, this.state.sortBy, this.state.sortOrder);
    this.updateSortOrderUI();
    this.applyFilterAndRender();
  }

  saveFolderSort(dirPath, sortBy, sortOrder) {
    if (!this.isPreferencesStorageAllowed()) return;
    try {
      const sorts = JSON.parse(localStorage.getItem('sg_folder_sorts') || '{}');
      const key = dirPath || '__root__';
      sorts[key] = { sortBy, sortOrder };
      localStorage.setItem('sg_folder_sorts', JSON.stringify(sorts));
    } catch (e) {
      console.warn('Could not save folder sort preference:', e);
    }
  }

  getFolderSort(dirPath) {
    try {
      const sorts = JSON.parse(localStorage.getItem('sg_folder_sorts') || '{}');
      const key = dirPath || '__root__';
      return sorts[key] || null;
    } catch (e) {
      return null;
    }
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

          let data = null;
          try {
            data = JSON.parse(e.dataTransfer.getData('text/plain'));
          } catch(err) {}

          const pathsToMove = (data && data.paths && data.paths.length > 0) ? data.paths : (this.state.draggingPaths || [this.state.draggingItemPath]);
          this.moveItems(pathsToMove, crumbPath);
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
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'internal_item', path: folderPath }));

          if (e.dataTransfer && e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(this.emptyDragImage, 0, 0);
          }
          this.showDragFollower(card, 1);
          this.updateDragFollowerPos(e.clientX, e.clientY);

          setTimeout(() => {
            card.classList.add('dragging');
          }, 0);
        });

        card.addEventListener('dragend', () => {
          this.hideDragFollower();
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

          let data = null;
          try {
            data = JSON.parse(e.dataTransfer.getData('text/plain'));
          } catch(err) {}

          const pathsToMove = (data && data.paths && data.paths.length > 0) ? data.paths : (this.state.draggingPaths || [this.state.draggingItemPath]);
          this.moveItems(pathsToMove, folderPath);
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

    if (this.state.showFavoritesOnly) {
      list = list.filter(f => this.state.favorites.includes(f.path));
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

    const mapped = this.computeSmartGpsLocations(this.state.filteredFiles);
    const nativeCount = mapped.filter(i => i.gps_source === 'native').length;
    const magicCount = mapped.filter(i => i.gps_source !== 'native').length;

    if (mapped.length === 0) {
      this.el.folderMapBtn.style.display = 'none';
      return;
    }

    const label = magicCount > 0 ? `🗺️ Carte GPS (${nativeCount}+${magicCount}✨)` : `🗺️ Carte GPS (${nativeCount})`;
    this.el.folderMapBtn.innerHTML = label;
    this.el.folderMapBtn.style.display = 'inline-flex';
  }

  renderProtectedState(dirPath) {
    if (!this.el.emptyState) return;
    this.el.mediaGrid.style.display = 'none';
    this.el.emptyState.style.display = 'block';
    this.el.emptyState.innerHTML = `
      <div class="empty-state-icon">🔒</div>
      <h3>Protected Folder</h3>
      <p>This folder is password protected. Enter the password to explore its contents.</p>
      <button class="pill-btn active" style="margin-top: 1rem;" onclick="window.galleryApp.openFolderUnlockModal('${encodeURIComponent(dirPath)}')">
        Unlock Folder
      </button>
    `;
  }

  renderPrivateState(msg) {
    if (!this.el.emptyState) return;
    this.el.mediaGrid.style.display = 'none';
    this.el.emptyState.style.display = 'block';
    const isCustomError = !!msg && msg !== 'Accès refusé';
    this.el.emptyState.innerHTML = `
      <div class="empty-state-icon">${isCustomError ? '⚠️' : '👁️‍🗨️'}</div>
      <h3>${this.escapeHtml(isCustomError ? 'Erreur d\'accès' : 'Dossier Privé')}</h3>
      <p>${this.escapeHtml(msg || 'Ce dossier est masqué et réservé à l\'administrateur.')}</p>
    `;
  }

  renderRestrictedState(msg) {
    this.renderPrivateState(msg);
  }

  renderMedia() {
    const list = this.state.filteredFiles;

    if (list.length === 0) {
      if (this.state.showFavoritesOnly) {
        this.el.emptyState.style.display = 'block';
        this.el.mediaGrid.style.display = 'none';
        this.el.emptyState.innerHTML = `
          <div class="empty-state-icon">🤍</div>
          <h3>Aucun favori dans ce dossier</h3>
          <p>Cliquez sur l'icône cœur 🤍 d'un média pour l'ajouter à vos favoris.</p>
        `;
        return;
      }
      if (this.state.directories.length === 0) {
        this.el.emptyState.style.display = 'block';
        this.el.mediaGrid.style.display = 'none';
        this.el.emptyState.innerHTML = `
          <div class="empty-state-icon">📂</div>
          <h3>No media files found</h3>
          <p>Copy photos, videos, or audio into this folder to get started!</p>
        `;
        return;
      }
    }

    this.el.emptyState.style.display = 'none';
    this.el.mediaGrid.style.display = 'grid';

    const isDraggable = this.state.isAdmin ? 'true' : 'false';
    const handleClass = this.state.isAdmin ? 'drag-handle' : '';

    const smartLocationsMap = new Map();
    if (this.isSmartGpsEnabled) {
      const smartLocations = this.computeSmartGpsLocations(list);
      smartLocations.forEach(item => {
        smartLocationsMap.set(item.file.path, item);
      });
    }

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

        let gpsBadge = '';
        if (file.exif && file.exif.gps) {
          gpsBadge = `<button type="button" class="gps-badge" data-path="${this.escapeHtml(file.path)}" title="Localiser sur la carte interactive">📍 GPS</button>`;
        } else if (smartLocationsMap.has(file.path)) {
          gpsBadge = `<button type="button" class="gps-badge magic-badge" data-path="${this.escapeHtml(file.path)}" title="Localiser sur la carte interactive (Position déduite)">✨ GPS</button>`;
        }

        const canDelete = this.state.userRights ? this.state.userRights.can_delete : this.state.isAdmin;
        const canComment = this.state.userRights ? this.state.userRights.can_comment : this.state.isAdmin;
        const isFav = this.state.favorites.includes(file.path);

        const deleteBtnHtml = canDelete ? `<button class="delete-item-btn" data-path="${file.path}" data-name="${this.escapeHtml(file.name)}" data-type="file" title="Supprimer le fichier">🗑️</button>` : '';
        const favBtnHtml = `<button class="favorite-btn ${isFav ? 'is-favorite' : ''}" data-path="${file.path}" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}" onclick="event.stopPropagation()">${isFav ? '❤️' : '🤍'}</button>`;
        const pipCardBtn = ['video', 'audio'].includes(file.category) ? `<button class="pip-card-btn" data-index="${idx}" title="Mode Flottant PiP" onclick="event.stopPropagation()">🗗</button>` : '';

        let mediaPreviewHtml = `<img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" draggable="false" />`;

        return `
          <div class="${frameClass} ${handleClass}" data-index="${idx}" draggable="${isDraggable}">
            ${deleteBtnHtml}
            <div class="polaroid-img-wrapper">
              ${mediaPreviewHtml}
              ${favBtnHtml}
              ${pipCardBtn}
              ${overlayHtml}
            </div>
            <div class="polaroid-caption">
              <span>${this.escapeHtml(file.comment || file.name)}</span>
              ${canComment ? `<button class="edit-media-comment-btn" data-filename="${this.escapeHtml(file.name)}" data-comment="${this.escapeHtml(file.comment || '')}" title="Edit legend (.comment)">✏️</button>` : ''}
            </div>
            <div class="polaroid-subcaption">
              <span>${file.size_formatted}</span>
              ${gpsBadge}
            </div>
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

        let gpsBadge = '';
        if (file.exif && file.exif.gps) {
          gpsBadge = `<button type="button" class="gps-badge" data-path="${this.escapeHtml(file.path)}" title="Localiser sur la carte interactive">📍 GPS</button>`;
        } else if (smartLocationsMap.has(file.path)) {
          gpsBadge = `<button type="button" class="gps-badge magic-badge" data-path="${this.escapeHtml(file.path)}" title="Localiser sur la carte interactive (Position déduite)">✨ GPS</button>`;
        }

        const canDelete = this.state.userRights ? this.state.userRights.can_delete : this.state.isAdmin;
        const canComment = this.state.userRights ? this.state.userRights.can_comment : this.state.isAdmin;
        const isFav = this.state.favorites.includes(file.path);

        const deleteBtnHtml = canDelete ? `<button class="delete-item-btn" data-path="${file.path}" data-name="${this.escapeHtml(file.name)}" data-type="file" title="Supprimer le fichier">🗑️</button>` : '';
        const favBtnHtml = `<button class="favorite-btn ${isFav ? 'is-favorite' : ''}" data-path="${file.path}" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}" onclick="event.stopPropagation()">${isFav ? '❤️' : '🤍'}</button>`;
        const pipCardBtn = ['video', 'audio'].includes(file.category) ? `<button class="pip-card-btn" data-index="${idx}" title="Mode Flottant PiP" onclick="event.stopPropagation()">🗗</button>` : '';

        let gridMediaPreviewHtml = `<img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" draggable="false" />`;

        return `
          <div class="${gridFrameClass} ${handleClass}" data-index="${idx}" draggable="${isDraggable}">
            ${deleteBtnHtml}
            <div class="grid-img-wrapper">
              ${gridMediaPreviewHtml}
              ${favBtnHtml}
              ${pipCardBtn}
              ${overlayHtml}
            </div>
            <div class="grid-info">
              <div class="grid-title">
                <span>${this.escapeHtml(file.comment || file.name)}</span>
                ${this.state.isAdmin ? `<button class="edit-media-comment-btn" data-filename="${this.escapeHtml(file.name)}" data-comment="${this.escapeHtml(file.comment || '')}" title="Edit legend (.comment)">✏️</button>` : ''}
              </div>
              <div class="grid-subinfo">
                <span>${file.extension.toUpperCase()} • ${file.size_formatted}</span>
                ${gpsBadge}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    this.el.mediaGrid.querySelectorAll('.gps-badge[data-path]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openMapModal(btn.dataset.path);
      });
    });

    this.el.mediaGrid.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDeleteConfirmModal(btn.dataset.path, btn.dataset.name, 'file');
      });
    });

    this.el.mediaGrid.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const filePath = btn.getAttribute('data-path');
        if (filePath) this.toggleFavorite(filePath);
      });
    });

    this.el.mediaGrid.querySelectorAll('.pip-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        const file = this.state.filteredFiles[idx];
        if (file) this.openPipPlayer(file);
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

      if (file && this.state.selectedPaths.has(file.path)) {
        card.classList.add('selected');
      }

      if (this.state.isAdmin && file) {
        card.addEventListener('dragstart', (e) => {
          if (e.target.closest('button, input, a, .edit-media-comment-btn, .gps-badge, .favorite-btn, .pip-card-btn, .delete-item-btn')) {
            e.preventDefault();
            return;
          }

          let pathsToMove = [];
          if (this.state.selectedPaths.has(file.path) && this.state.selectedPaths.size > 1) {
            pathsToMove = Array.from(this.state.selectedPaths);
          } else {
            pathsToMove = [file.path];
            this.state.selectedPaths.clear();
            this.state.selectedPaths.add(file.path);
            this.updateSelectionUI();
          }

          this.state.draggingPaths = pathsToMove;
          this.state.draggingItemPath = file.path;

          e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'internal_items',
            paths: pathsToMove,
            primaryPath: file.path
          }));

          if (e.dataTransfer && e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(this.emptyDragImage, 0, 0);
          }
          this.showDragFollower(card, pathsToMove.length);
          this.updateDragFollowerPos(e.clientX, e.clientY);

          setTimeout(() => {
            card.classList.add('dragging');
            pathsToMove.forEach(p => {
              const el = Array.from(this.el.mediaGrid.querySelectorAll('[data-index]')).find(c => {
                const idx = parseInt(c.dataset.index, 10);
                return list[idx]?.path === p;
              });
              if (el) el.classList.add('dragging');
            });
          }, 0);
        });

        card.addEventListener('dragend', () => {
          this.hideDragFollower();
          this.el.mediaGrid.querySelectorAll('.dragging').forEach(el => {
            el.classList.remove('dragging');
          });
          this.state.draggingPaths = null;
          this.state.draggingItemPath = null;
        });
      }

      card.addEventListener('click', (e) => {
        if (e.target.closest('button, input, a, .edit-media-comment-btn, .gps-badge, .favorite-btn, .pip-card-btn, .delete-item-btn')) {
          return;
        }

        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          if (this.state.selectedPaths.has(file.path)) {
            this.state.selectedPaths.delete(file.path);
          } else {
            this.state.selectedPaths.add(file.path);
          }
          this.state.lastSelectedIndex = index;
          this.updateSelectionUI();
          return;
        }

        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const start = this.state.lastSelectedIndex !== null ? Math.min(this.state.lastSelectedIndex, index) : 0;
          const end = this.state.lastSelectedIndex !== null ? Math.max(this.state.lastSelectedIndex, index) : index;
          for (let i = start; i <= end; i++) {
            const item = this.state.filteredFiles[i];
            if (item) this.state.selectedPaths.add(item.path);
          }
          this.state.lastSelectedIndex = index;
          this.updateSelectionUI();
          return;
        }

        if (this.state.selectedPaths.size > 0) {
          if (!this.state.selectedPaths.has(file.path)) {
            this.clearSelection();
            if (file && file.category === 'audio') {
              this.openPipPlayer(file);
            } else {
              this.openLightbox(index);
            }
          }
          return;
        }

        if (file && file.category === 'audio') {
          this.openPipPlayer(file);
        } else {
          this.openLightbox(index);
        }
      });
    });
  }

  openLightbox(index) {
    if (index < 0 || index >= this.state.filteredFiles.length) return;
    this.state.lightboxIndex = index;
    const file = this.state.filteredFiles[index];

    // Push history state so mobile "Back" button closes Lightbox instead of exiting page
    if (!this.state.isLightboxHistoryPushed) {
      history.pushState({ lightbox: true }, '');
      this.state.isLightboxHistoryPushed = true;
    }

    this.el.lightboxTitle.textContent = file.name;
    this.el.lightboxMeta.textContent = `${file.size_formatted} • ${new Date(file.mtime * 1000).toLocaleDateString()}`;
    const canDownloadItem = this.state.isAdmin || (this.state.userRights ? this.state.userRights.can_download_item : true);
    this.el.lightboxDownloadBtn.href = file.file_url;
    this.el.lightboxDownloadBtn.setAttribute('download', file.name);
    if (this.el.lightboxDownloadBtn) {
      this.el.lightboxDownloadBtn.style.display = canDownloadItem ? 'inline-flex' : 'none';
    }

    if (this.el.lightboxDeleteBtn) {
      this.el.lightboxDeleteBtn.style.display = this.state.isAdmin ? 'inline-flex' : 'none';
    }

    this.updateLightboxFavBtn(file.path);

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

    const isEditableImage = this.state.isAdmin && file.category === 'image' && file.extension !== 'svg';
    if (this.el.lightboxEditImageBtn) {
      this.el.lightboxEditImageBtn.style.display = isEditableImage ? 'inline-flex' : 'none';
    }

    if (file.category === 'image') {
      this.el.imageExplorerControls.style.display = 'flex';
    } else {
      this.el.imageExplorerControls.style.display = 'none';
    }

    const controlsListAttr = canDownloadItem ? '' : 'controlsList="nodownload"';

    let html = '';
    if (file.category === 'image') {
      html = `<img id="lightboxExplorerImg" src="${file.file_url}" alt="${this.escapeHtml(file.name)}" class="explorer-img" draggable="false" />`;
    } else if (file.category === 'video') {
      html = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%;">
          <video controls ${controlsListAttr} autoplay name="media" style="max-width:100%; max-height:75vh;">
            <source src="${file.file_url}" type="video/${file.extension === 'mov' ? 'mp4' : file.extension}">
            Your browser does not support playing this video.
          </video>
          <button id="lightboxPipTransferBtn" class="pill-btn active" style="margin-top:12px; background:#6366f1; color:#fff; border:none; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:8px;">
            🗗 Passer en lecteur flottant PiP (Continuer la navigation)
          </button>
        </div>
      `;
    } else if (file.category === 'audio') {
      this.openPipPlayer(file);
      html = `
        <div class="lightbox-audio-card" style="display:flex; flex-direction:column; align-items:center;">
          <div style="font-size:4rem;">🎵</div>
          <h3>${this.escapeHtml(file.name)}</h3>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">Lecture démarrée en lecteur flottant PiP 🎵</p>
          <button id="lightboxPipTransferBtn" class="pill-btn active" style="margin-top:16px; background:#6366f1; color:#fff; border:none; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:8px;">
            🗗 Relancer le lecteur flottant PiP
          </button>
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

    const pipTransferBtn = document.getElementById('lightboxPipTransferBtn');
    if (pipTransferBtn) {
      pipTransferBtn.addEventListener('click', () => {
        this.openPipPlayer(file);
        this.closeLightbox();
      });
    }

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

    if (exif.artist || exif.software || exif.description) {
      html += `
        <div class="exif-group">
          <div class="exif-label">Auteur & Software</div>
          <div class="exif-value" style="font-size:0.85rem; line-height:1.4;">
            ${exif.artist ? `<div>👤 <strong>Auteur :</strong> ${this.escapeHtml(exif.artist)}</div>` : ''}
            ${exif.software ? `<div>💻 <strong>Logiciel :</strong> ${this.escapeHtml(exif.software)}</div>` : ''}
            ${exif.description ? `<div>📝 <strong>Description :</strong> ${this.escapeHtml(exif.description)}</div>` : ''}
          </div>
        </div>
      `;
    }

    if (exif.gps) {
      const currentFilePath = this.state.filteredFiles[this.state.lightboxIndex]?.path;
      html += `
        <div class="exif-group" style="margin-top:0.5rem;">
          <div class="exif-label">Géolocalisation GPS</div>
          <div class="exif-value" style="font-size:0.85rem;color:var(--text-muted); margin-bottom:6px;">
            Lat: ${exif.gps.lat}°, Lng: ${exif.gps.lng}°
          </div>
          <div id="exifMiniMap" class="exif-mini-map"></div>
          <button type="button" class="btn-toggle" style="width:100%; justify-content:center; margin-top:6px;" onclick="window.galleryApp.openMapModal('${this.escapeHtml(currentFilePath || '')}')">
            🗺️ Explorer sur la grande carte
          </button>
        </div>
      `;
    }

    this.el.exifPanelBody.innerHTML = html || '<p style="color:var(--text-muted);font-style:italic;">Aucune métadonnée EXIF disponible.</p>';

    if (exif && exif.gps && typeof L !== 'undefined') {
      setTimeout(() => {
        const miniContainer = document.getElementById('exifMiniMap');
        if (!miniContainer) return;
        miniContainer.innerHTML = '';
        const miniMap = L.map('exifMiniMap', {
          center: [exif.gps.lat, exif.gps.lng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          touchZoom: false
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(miniMap);
        L.marker([exif.gps.lat, exif.gps.lng]).addTo(miniMap);
      }, 50);
    }
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
    if (e.touches.length === 2 && this.isCurrentMediaImage()) {
      e.preventDefault();
      this.touchState.isPinching = true;
      this.zoomState.isDragging = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.touchState.pinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      this.touchState.pinchScale = this.zoomState.scale;
      return;
    }

    if (e.touches.length === 1) {
      this.touchState.isPinching = false;
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
    if (e.touches.length === 2 && this.touchState.isPinching && this.isCurrentMediaImage()) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      if (this.touchState.pinchDist > 0) {
        const factor = currentDist / this.touchState.pinchDist;
        let newScale = this.touchState.pinchScale * factor;
        newScale = Math.min(Math.max(newScale, 1), 5);
        this.zoomState.scale = newScale;
        if (newScale === 1) {
          this.zoomState.translateX = 0;
          this.zoomState.translateY = 0;
        }
        this.clampTranslate();
        this.updateExplorerTransform(false);
      }
      return;
    }

    if (this.isCurrentMediaImage() && this.zoomState.scale > 1 && this.zoomState.isDragging && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      this.zoomState.translateX = touch.clientX - this.zoomState.startX;
      this.zoomState.translateY = touch.clientY - this.zoomState.startY;
      this.clampTranslate();
      this.updateExplorerTransform(false);
    }
  }

  endDrag(e) {
    if (this.touchState.isPinching) {
      if (!e.touches || e.touches.length < 2) {
        this.touchState.isPinching = false;
        this.touchState.pinchDist = 0;
      }
      return;
    }

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

  closeLightbox(shouldPopHistory = true) {
    this.el.lightbox.classList.remove('open');
    this.el.lightboxContent.innerHTML = '';
    this.state.lightboxIndex = null;
    this.resetZoom();

    if (this.state.isLightboxHistoryPushed) {
      this.state.isLightboxHistoryPushed = false;
      if (shouldPopHistory && history.state && history.state.lightbox) {
        history.back();
      }
    }
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
      if (this.el.lightboxEditImageBtn) {
        const curFile = this.state.lightboxIndex !== null ? this.state.filteredFiles[this.state.lightboxIndex] : null;
        this.el.lightboxEditImageBtn.style.display = (curFile && curFile.category === 'image' && curFile.extension !== 'svg') ? 'inline-flex' : 'none';
      }
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
      if (this.el.lightboxEditImageBtn) this.el.lightboxEditImageBtn.style.display = 'none';
    }
  }

  openAdminModal() {
    if (!this.el.adminModal) return;
    this.updateAdminUI();
    if (this.state.isAdmin) {
      this.renderPermissionsMatrixUI();
    }
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

  showDragFollower(card, count = 1) {
    let follower = document.getElementById('customDragFollower');
    if (!follower) {
      follower = document.createElement('div');
      follower.id = 'customDragFollower';
      follower.className = 'custom-drag-follower';
      document.body.appendChild(follower);
    }

    const img = card.querySelector('img');
    let contentHtml = '';
    if (img && img.src) {
      contentHtml = `<img src="${img.src}" style="width:100px; height:100px; object-fit:cover; border-radius:10px; display:block;" />`;
    } else {
      contentHtml = `<div style="width:100px; height:100px; background:#0f172a; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:2.5rem;">📁</div>`;
    }

    if (count > 1) {
      contentHtml += `<div class="drag-follower-badge">${count} fichiers</div>`;
    }

    follower.innerHTML = contentHtml;
    follower.style.display = 'block';
  }

  updateDragFollowerPos(x, y) {
    const follower = document.getElementById('customDragFollower');
    if (follower && follower.style.display !== 'none' && x > 0 && y > 0) {
      follower.style.left = `${x}px`;
      follower.style.top = `${y}px`;
    }
  }

  hideDragFollower() {
    const follower = document.getElementById('customDragFollower');
    if (follower) {
      follower.style.display = 'none';
      follower.innerHTML = '';
    }
  }

  updateSelectionUI() {
    if (!this.el.mediaGrid) return;
    const cards = this.el.mediaGrid.querySelectorAll('[data-index]');
    cards.forEach(card => {
      const idx = parseInt(card.dataset.index, 10);
      const file = this.state.filteredFiles[idx];
      if (file) {
        const isSelected = this.state.selectedPaths.has(file.path);
        card.classList.toggle('selected', isSelected);
      }
    });

    const count = this.state.selectedPaths.size;
    if (this.el.selectionToolbar) {
      if (count > 0) {
        this.el.selectionToolbar.style.display = 'flex';
        if (this.el.selectionToolbarCount) {
          this.el.selectionToolbarCount.textContent = `${count} élément${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`;
        }
      } else {
        this.el.selectionToolbar.style.display = 'none';
      }
    }
  }

  clearSelection() {
    this.state.selectedPaths.clear();
    this.state.lastSelectedIndex = null;
    this.updateSelectionUI();
  }

  selectAll() {
    this.state.filteredFiles.forEach(file => this.state.selectedPaths.add(file.path));
    this.updateSelectionUI();
  }

  initMarqueeSelection() {
    let marquee = document.getElementById('selectionMarquee');
    if (!marquee) {
      marquee = document.createElement('div');
      marquee.id = 'selectionMarquee';
      marquee.className = 'selection-marquee';
      marquee.style.display = 'none';
      document.body.appendChild(marquee);
    }

    let isSelecting = false;
    let startX = 0, startY = 0;

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.polaroid-card, .grid-card, .folder-card, button, input, select, textarea, a, .admin-modal, .lightbox-modal, .search-modal-card, .selection-toolbar')) {
        return;
      }

      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        this.clearSelection();
      }

      marquee.style.left = `${startX}px`;
      marquee.style.top = `${startY}px`;
      marquee.style.width = '0px';
      marquee.style.height = '0px';
      marquee.style.display = 'block';
    };

    const onMouseMove = (e) => {
      if (!isSelecting) return;
      e.preventDefault();

      const currentX = e.clientX;
      const currentY = e.clientY;

      const rectLeft = Math.min(startX, currentX);
      const rectTop = Math.min(startY, currentY);
      const rectWidth = Math.abs(currentX - startX);
      const rectHeight = Math.abs(currentY - startY);

      marquee.style.left = `${rectLeft}px`;
      marquee.style.top = `${rectTop}px`;
      marquee.style.width = `${rectWidth}px`;
      marquee.style.height = `${rectHeight}px`;

      const marqueeBox = {
        left: rectLeft,
        top: rectTop,
        right: rectLeft + rectWidth,
        bottom: rectTop + rectHeight
      };

      const cards = this.el.mediaGrid.querySelectorAll('[data-index]');
      cards.forEach(card => {
        const idx = parseInt(card.dataset.index, 10);
        const file = this.state.filteredFiles[idx];
        if (!file) return;

        const cardRect = card.getBoundingClientRect();
        const isIntersecting = !(
          cardRect.right < marqueeBox.left ||
          cardRect.left > marqueeBox.right ||
          cardRect.bottom < marqueeBox.top ||
          cardRect.top > marqueeBox.bottom
        );

        if (isIntersecting) {
          this.state.selectedPaths.add(file.path);
        }
      });

      this.updateSelectionUI();
    };

    const onMouseUp = () => {
      if (isSelecting) {
        isSelecting = false;
        marquee.style.display = 'none';
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  async moveItems(sourcePaths, targetDir) {
    if (!this.state.isAdmin || !sourcePaths || sourcePaths.length === 0) return;

    this.showLoading(true);
    try {
      const res = await fetch('api.php?action=move_item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify({
          action: 'move_item',
          source_paths: sourcePaths,
          target_dir: targetDir,
          csrf_token: this.state.csrfToken
        })
      });
      const data = await res.json();
      if (data.success) {
        this.clearSelection();
        this.loadDirectory(this.state.currentPath);
      } else {
        alert(data.error || 'Erreur lors du déplacement des éléments.');
      }
    } catch (err) {
      alert('Erreur réseau lors du déplacement.');
    } finally {
      this.showLoading(false);
    }
  }

  async moveItem(sourcePath, targetDir) {
    return this.moveItems([sourcePath], targetDir);
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

    this.el.deleteConfirmModal.style.display = 'flex';
    setTimeout(() => this.el.deleteConfirmModal.classList.add('open'), 10);
  }

  closeDeleteConfirmModal() {
    if (!this.el.deleteConfirmModal) return;
    this.el.deleteConfirmModal.classList.remove('open');
    setTimeout(() => {
      if (this.el.deleteConfirmModal) this.el.deleteConfirmModal.style.display = 'none';
    }, 250);
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
    if (this.el.dotfileBgInput) this.el.dotfileBgInput.value = (overrides.raw_background !== undefined) ? overrides.raw_background : (overrides.background || '');
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

  toggleFavorite(filepath) {
    const idx = this.state.favorites.indexOf(filepath);
    if (idx >= 0) {
      this.state.favorites.splice(idx, 1);
    } else {
      this.state.favorites.push(filepath);
    }
    if (this.isPreferencesStorageAllowed()) {
      localStorage.setItem('sg_favorites', JSON.stringify(this.state.favorites));
    }
    this.updateFavoritesCountUI();
    if (this.state.lightboxIndex !== null && this.state.filteredFiles[this.state.lightboxIndex]) {
      this.updateLightboxFavBtn(this.state.filteredFiles[this.state.lightboxIndex].path);
    }
    this.applyFilterAndRender();
  }

  updateLightboxFavBtn(filepath) {
    if (!this.el.lightboxFavBtn) return;
    const isFav = this.state.favorites.includes(filepath);
    this.el.lightboxFavBtn.textContent = isFav ? '❤️' : '🤍';
    this.el.lightboxFavBtn.title = isFav ? 'Retirer des favoris' : 'Ajouter aux favoris';
  }

  updateFavoritesCountUI() {
    const badge = document.getElementById('favCountBadge');
    const folderFavs = (this.state.files || []).filter(f => this.state.favorites.includes(f.path));
    const totalCount = this.state.favorites.length;
    const folderCount = folderFavs.length;
    const favIcon = this.el.toggleFavoritesBtn ? this.el.toggleFavoritesBtn.querySelector('span:first-child') : null;
    if (favIcon) {
      favIcon.textContent = (this.state.showFavoritesOnly || totalCount > 0) ? '❤️' : '🤍';
    }
    if (badge) {
      badge.innerText = folderCount > 0 ? `${folderCount}` : `${totalCount}`;
      badge.style.display = totalCount > 0 ? 'inline-block' : 'none';
    }
    if (this.el.toggleFavoritesBtn) {
      this.el.toggleFavoritesBtn.classList.toggle('active', this.state.showFavoritesOnly);
    }
  }

  updateArchiveMenuUI() {
    if (!this.el.archiveMenu) return;
    const archives = this.state.availableArchives || {};
    const keys = Object.keys(archives);
    if (keys.length === 0) {
      this.el.archiveMenu.innerHTML = '<div class="archive-option-item" style="opacity:0.6;">Aucun format d\'archive disponible</div>';
      return;
    }
    this.el.archiveMenu.innerHTML = keys.map(fmt => `
      <div class="archive-option-item" data-format="${fmt}">
        <span>📦</span> Télécharger .${fmt.toUpperCase()} (${archives[fmt]})
      </div>
    `).join('');

    this.el.archiveMenu.querySelectorAll('.archive-option-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = item.getAttribute('data-format');
        if (format) {
          window.location.href = `api.php?action=download_archive&dir=${encodeURIComponent(this.state.currentPath)}&format=${format}`;
        }
      });
    });
  }

  updateRightsUI() {
    const rights = this.state.userRights || { is_admin: false, can_upload: false, can_delete: false, can_move: false, can_comment: true, can_create_folder: false, can_download_archive: true, can_download_item: true };
    const canDownloadItem = this.state.isAdmin || (rights.can_download_item !== false);
    document.body.classList.toggle('no-direct-download', !canDownloadItem);

    if (this.el.uploadMediaBtn) this.el.uploadMediaBtn.style.display = rights.can_upload ? '' : 'none';
    if (this.el.createFolderBtn) this.el.createFolderBtn.style.display = rights.can_create_folder ? '' : 'none';
    if (this.el.folderSettingsBtn) this.el.folderSettingsBtn.style.display = this.state.isAdmin ? '' : 'none';
    if (this.el.downloadArchiveBtn) this.el.downloadArchiveBtn.style.display = rights.can_download_archive ? '' : 'none';
    if (this.el.lightboxDownloadBtn) this.el.lightboxDownloadBtn.style.display = canDownloadItem ? '' : 'none';
  }

  initPipPlayer() {
    if (this.el.pipMinimizeBtn && this.el.pipWidget) {
      this.el.pipMinimizeBtn.addEventListener('click', () => {
        this.el.pipWidget.classList.toggle('minimized');
      });
    }
    if (this.el.pipCloseBtn) {
      this.el.pipCloseBtn.addEventListener('click', () => {
        this.closePipPlayer();
      });
    }

    if (this.el.pipHeader && this.el.pipWidget) {
      let isDraggingPip = false;
      let startX, startY, startLeft, startTop;
      this.el.pipHeader.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDraggingPip = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = this.el.pipWidget.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        this.el.pipWidget.style.right = 'auto';
        this.el.pipWidget.style.bottom = 'auto';
        this.el.pipWidget.style.left = `${startLeft}px`;
        this.el.pipWidget.style.top = `${startTop}px`;
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDraggingPip) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        this.el.pipWidget.style.left = `${startLeft + dx}px`;
        this.el.pipWidget.style.top = `${startTop + dy}px`;
      });
      window.addEventListener('mouseup', () => { isDraggingPip = false; });
    }
  }

  openPipPlayer(file) {
    if (!this.el.pipWidget || !this.el.pipMediaContainer) return;
    if (this.el.pipTitle) this.el.pipTitle.innerText = file.comment || file.name;
    this.el.pipWidget.style.display = 'flex';
    this.el.pipWidget.classList.remove('minimized');

    const canDownloadItem = this.state.isAdmin || (this.state.userRights ? this.state.userRights.can_download_item !== false : true);
    const controlsListAttr = canDownloadItem ? '' : 'controlsList="nodownload"';

    if (file.category === 'video') {
      this.el.pipMediaContainer.innerHTML = `<video src="${file.file_url}" controls ${controlsListAttr} autoplay style="width:100%;max-height:200px;"></video>`;
    } else if (file.category === 'audio') {
      this.el.pipMediaContainer.innerHTML = `<div style="padding:16px; width:100%; text-align:center;"><div style="font-size:2rem;margin-bottom:8px;">🎵</div><audio src="${file.file_url}" controls ${controlsListAttr} autoplay style="width:100%;"></audio></div>`;
    }
  }

  closePipPlayer() {
    if (!this.el.pipWidget) return;
    this.el.pipWidget.style.display = 'none';
    if (this.el.pipMediaContainer) this.el.pipMediaContainer.innerHTML = '';
  }

  openSearchModal() {
    if (!this.el.searchModal) {
      this.el.searchModal = document.getElementById('searchModal');
    }
    if (!this.el.searchModal) return;
    this.el.searchModal.style.display = 'flex';
    requestAnimationFrame(() => {
      this.el.searchModal.classList.add('open');
    });
    const firstInput = document.getElementById('advSearchName') || document.getElementById('advSearchWords');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  closeSearchModal() {
    if (!this.el.searchModal) {
      this.el.searchModal = document.getElementById('searchModal');
    }
    if (!this.el.searchModal) return;
    this.el.searchModal.classList.remove('open');
    setTimeout(() => {
      this.el.searchModal.style.display = 'none';
    }, 200);
  }

  initAdvancedSearch() {
    if (this.el.advancedSearchBtn) {
      this.el.advancedSearchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openSearchModal();
      });
    }
    if (this.el.searchModalCloseBtn) {
      this.el.searchModalCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSearchModal();
      });
    }
    if (this.el.searchModal) {
      this.el.searchModal.addEventListener('click', (e) => {
        if (e.target === this.el.searchModal) this.closeSearchModal();
      });
    }

    const timingSelect = document.getElementById('advSearchTiming');
    const customDateRow = document.getElementById('advSearchCustomDateRow');
    if (timingSelect && customDateRow) {
      timingSelect.addEventListener('change', (e) => {
        customDateRow.style.display = (e.target.value === 'custom') ? 'grid' : 'none';
      });
    }

    if (this.el.advSearchResetBtn && this.el.searchAdvancedForm) {
      this.el.advSearchResetBtn.addEventListener('click', () => {
        this.el.searchAdvancedForm.reset();
        if (customDateRow) customDateRow.style.display = 'none';
      });
    }

    if (this.el.searchAdvancedForm) {
      this.el.searchAdvancedForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const category = document.getElementById('advSearchCategory')?.value || 'all';
        const name = document.getElementById('advSearchName')?.value || '';
        const words = document.getElementById('advSearchWords')?.value || '';
        const location = document.getElementById('advSearchLocation')?.value || 'everywhere';
        const timing = document.getElementById('advSearchTiming')?.value || 'all';
        const date_from = document.getElementById('advSearchDateFrom')?.value || '';
        const date_to = document.getElementById('advSearchDateTo')?.value || '';
        const size_range = document.getElementById('advSearchSize')?.value || 'all';
        const gps_only = !!document.getElementById('advSearchGpsOnly')?.checked;
        const fav_only = !!document.getElementById('advSearchFavOnly')?.checked;

        this.showLoading(true);
        this.closeSearchModal();

        try {
          const searchDir = (location === 'current') ? this.state.currentPath : '';
          const res = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.state.csrfToken },
            body: JSON.stringify({
              action: 'search',
              dir: searchDir,
              name,
              words,
              category,
              timing,
              date_from,
              date_to,
              size_range,
              gps_only,
              recursive: (location === 'everywhere')
            })
          });
          const json = await res.json();
          if (json.success) {
            let results = json.results || [];
            if (fav_only) {
              results = results.filter(f => this.state.favorites.includes(f.path));
            }
            this.state.isSearchActive = true;
            this.state.files = results;
            this.state.filteredFiles = results;
            this.renderFolders([]);
            this.renderMedia();
            this.updateFolderMapButton();

            if (this.el.searchResultsBanner) {
              this.el.searchResultsBanner.style.display = 'flex';
            }
            if (this.el.searchResultsCountText) {
              const term = name || words;
              const queryDesc = term ? ` pour « ${this.escapeHtml(term)} »` : '';
              this.el.searchResultsCountText.innerHTML = `<strong>${results.length}</strong> média(s) trouvé(s)${queryDesc}`;
            }
            if (this.el.searchClearBtn) {
              this.el.searchClearBtn.style.display = 'flex';
            }
            if (this.el.galleryStats) {
              this.el.galleryStats.textContent = `🔍 ${results.length} résultat(s) de recherche`;
            }
          }
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          this.showLoading(false);
        }
      });
    }
  }

  exitSearch() {
    this.state.isSearchActive = false;
    if (this.el.searchResultsBanner) {
      this.el.searchResultsBanner.style.display = 'none';
    }
    if (this.el.searchInput) {
      this.el.searchInput.value = '';
      this.state.searchQuery = '';
    }
    if (this.el.searchClearBtn) {
      this.el.searchClearBtn.style.display = 'none';
    }
    this.loadDirectory(this.state.currentPath);
  }

  renderPermissionsMatrixUI() {
    const container = document.getElementById('adminPermissionsContainer');
    if (!container) return;
    const perms = this.state.userPermissions || {};

    container.innerHTML = `
      <h4 style="margin:16px 0 8px 0; color:var(--text-main); font-size:0.95rem;">🛡️ Matrice de Droits Invités</h4>
      <form id="adminPermissionsForm">
        <div class="permissions-matrix-grid">
          <label class="perm-checkbox-card">
            <input type="checkbox" name="can_upload" ${perms.can_upload ? 'checked' : ''} />
            <span>📤 Upload de fichiers</span>
          </label>
          <label class="perm-checkbox-card">
            <input type="checkbox" name="can_delete" ${perms.can_delete ? 'checked' : ''} />
            <span>🗑️ Suppression d'éléments</span>
          </label>
          <label class="perm-checkbox-card">
            <input type="checkbox" name="can_move" ${perms.can_move ? 'checked' : ''} />
            <span>🖐️ Déplacement d'éléments</span>
          </label>
          <label class="perm-checkbox-card">
            <input type="checkbox" name="can_comment" ${perms.can_comment ? 'checked' : ''} />
            <span>✏️ Édition des légendes</span>
          </label>
          <label class="perm-checkbox-card">
            <input type="checkbox" name="can_create_folder" ${perms.can_create_folder ? 'checked' : ''} />
            <span>📁+ Création de dossiers</span>
          </label>
          <label class="perm-checkbox-card">
            <input type="checkbox" name="can_download_archive" ${perms.can_download_archive ? 'checked' : ''} />
            <span>📦 Téléchargement d'archives</span>
          </label>
          <label class="perm-checkbox-card">
            <input type="checkbox" name="can_download_item" ${perms.can_download_item !== false ? 'checked' : ''} />
            <span>⬇️ Téléchargement direct des médias seuls</span>
          </label>
        </div>
        <div id="adminPermSaveMsg" class="admin-error-msg" style="display:none; margin-top:8px;"></div>
        <button type="submit" class="pill-btn active" style="margin-top:12px; width:100%; justify-content:center; background:#6366f1; color:white;">
          💾 Enregistrer la matrice de droits
        </button>
      </form>
    `;

    const permForm = document.getElementById('adminPermissionsForm');
    if (permForm) {
      permForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updatedPerms = {
          can_upload: permForm.querySelector('[name="can_upload"]').checked,
          can_delete: permForm.querySelector('[name="can_delete"]').checked,
          can_move: permForm.querySelector('[name="can_move"]').checked,
          can_comment: permForm.querySelector('[name="can_comment"]').checked,
          can_create_folder: permForm.querySelector('[name="can_create_folder"]').checked,
          can_download_archive: permForm.querySelector('[name="can_download_archive"]').checked,
          can_download_item: permForm.querySelector('[name="can_download_item"]').checked
        };

        try {
          const res = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.state.csrfToken },
            body: JSON.stringify({ action: 'save_permissions', permissions: updatedPerms })
          });
          const json = await res.json();
          const msgEl = document.getElementById('adminPermSaveMsg');
          if (json.success) {
            this.state.userPermissions = json.permissions;
            if (msgEl) {
              msgEl.style.display = 'block';
              msgEl.style.color = '#4ade80';
              msgEl.innerText = 'Matrice de droits mise à jour avec succès !';
            }
            this.loadDirectory(this.state.currentPath);
          }
        } catch (err) {
          console.error('Error saving permissions:', err);
        }
      });
    }
  }

  // =============================================================
  // LEAFLET INTERACTIVE MAP & GPS TRAIL ENGINE
  // =============================================================

  initLeafletMap() {
    if (this.leafletMap || typeof L === 'undefined') return;

    this.leafletTileLayers = {
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
      }),
      streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri &mdash; Earthstar Geographics'
      })
    };

    this.currentMapTileLayer = 'streets';
    this.leafletMap = L.map('galleryLeafletMap', {
      layers: [this.leafletTileLayers.streets],
      zoomControl: true
    });

    this.mapMarkersGroup = typeof L.markerClusterGroup === 'function' ? L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false
    }) : L.featureGroup();

    this.leafletMap.addLayer(this.mapMarkersGroup);
    this.isMapRouteVisible = true;
  }

  setMapTileLayer(layerName) {
    if (!this.leafletMap || !this.leafletTileLayers[layerName]) return;
    Object.values(this.leafletTileLayers).forEach(layer => {
      if (this.leafletMap.hasLayer(layer)) this.leafletMap.removeLayer(layer);
    });
    this.leafletTileLayers[layerName].addTo(this.leafletMap);
    this.currentMapTileLayer = layerName;
  }

  computeSmartGpsLocations(files) {
    if (!files || files.length === 0) return [];

    // Filter image/video files with timestamps
    const sorted = [...files]
      .filter(f => ['image', 'video'].includes(f.category))
      .sort((a, b) => (a.effective_mtime || a.mtime) - (b.effective_mtime || b.mtime));

    // Identify native GPS items
    const nativeGpsItems = [];
    sorted.forEach((f, idx) => {
      if (f.exif?.gps?.lat && f.exif?.gps?.lng) {
        nativeGpsItems.push({ file: f, index: idx, time: f.effective_mtime || f.mtime });
      }
    });

    if (nativeGpsItems.length === 0) return [];

    const result = [];
    const maxInterpolationGapSec = 7200; // 2 hours max gap between anchors
    const maxInterpolationDistKm = 50;   // 50 km max distance for linear interpolation
    const maxSpeedKmH = 130;             // 130 km/h max speed threshold
    const maxExtrapolationGapSec = 3600; // 60 minutes max to attach to nearest anchor

    // Haversine distance calculation in kilometers
    const haversineKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    sorted.forEach((file) => {
      const time = file.effective_mtime || file.mtime;

      // 1. Native GPS
      if (file.exif?.gps?.lat && file.exif?.gps?.lng) {
        result.push({
          file,
          gps_source: 'native',
          lat: file.exif.gps.lat,
          lng: file.exif.gps.lng,
          time
        });
        return;
      }

      // If smart GPS deduction is disabled, skip non-native
      if (!this.isSmartGpsEnabled) return;

      // 2. Find closest preceding anchor A and succeeding anchor B
      let prevAnchor = null;
      let nextAnchor = null;

      for (let i = 0; i < nativeGpsItems.length; i++) {
        const item = nativeGpsItems[i];
        if (item.time <= time) {
          prevAnchor = item;
        }
        if (item.time >= time && !nextAnchor) {
          nextAnchor = item;
        }
      }

      // Case A: Linear Interpolation between A and B
      if (prevAnchor && nextAnchor && prevAnchor !== nextAnchor) {
        const deltaT = nextAnchor.time - prevAnchor.time;
        if (deltaT > 0 && deltaT <= maxInterpolationGapSec) {
          const distKm = haversineKm(
            prevAnchor.file.exif.gps.lat, prevAnchor.file.exif.gps.lng,
            nextAnchor.file.exif.gps.lat, nextAnchor.file.exif.gps.lng
          );
          const speedKmH = (distKm / (deltaT / 3600));

          // Only perform linear interpolation if distance and speed are realistic for local movement
          if (distKm <= maxInterpolationDistKm && speedKmH <= maxSpeedKmH) {
            const ratio = (time - prevAnchor.time) / deltaT;
            const lat = prevAnchor.file.exif.gps.lat + ratio * (nextAnchor.file.exif.gps.lat - prevAnchor.file.exif.gps.lat);
            const lng = prevAnchor.file.exif.gps.lng + ratio * (nextAnchor.file.exif.gps.lng - prevAnchor.file.exif.gps.lng);
            const deltaMinA = Math.round((time - prevAnchor.time) / 60);

            result.push({
              file,
              gps_source: 'interpolated',
              lat,
              lng,
              time,
              anchor_a: prevAnchor.file.name,
              anchor_b: nextAnchor.file.name,
              delta_min_a: deltaMinA
            });
            return;
          }
        }
      }

      // Case B: Fallback - Proximity attachment to nearest anchor in time
      const gapPrev = prevAnchor ? (time - prevAnchor.time) : Infinity;
      const gapNext = nextAnchor ? (nextAnchor.time - time) : Infinity;

      let closestAnchor = null;
      let minGapSec = Infinity;

      if (gapPrev <= gapNext) {
        closestAnchor = prevAnchor;
        minGapSec = gapPrev;
      } else {
        closestAnchor = nextAnchor;
        minGapSec = gapNext;
      }

      if (closestAnchor && minGapSec <= maxExtrapolationGapSec) {
        result.push({
          file,
          gps_source: 'extrapolated',
          lat: closestAnchor.file.exif.gps.lat,
          lng: closestAnchor.file.exif.gps.lng,
          time,
          anchor_name: closestAnchor.file.name,
          delta_min: Math.round(minGapSec / 60)
        });
      }
    });

    return result;
  }

  toggleSmartGps() {
    this.isSmartGpsEnabled = !this.isSmartGpsEnabled;
    if (this.el.mapToggleSmartGpsBtn) {
      this.el.mapToggleSmartGpsBtn.classList.toggle('active', this.isSmartGpsEnabled);
    }
    this.openMapModal();
  }

  openMapModal(focusPath = null) {
    if (!this.el.mapModal) {
      this.el.mapModal = document.getElementById('mapModal');
    }
    if (!this.el.mapModal || typeof L === 'undefined') return;

    this.el.mapModal.style.display = 'flex';
    requestAnimationFrame(() => {
      this.el.mapModal.classList.add('open');
    });

    this.initLeafletMap();

    const mappedItems = this.computeSmartGpsLocations(this.state.filteredFiles);
    const nativeCount = mappedItems.filter(i => i.gps_source === 'native').length;
    const magicCount = mappedItems.filter(i => i.gps_source !== 'native').length;

    if (this.el.mapSmartGpsCount) {
      this.el.mapSmartGpsCount.textContent = magicCount;
    }

    if (this.el.mapModalCountBadge) {
      const extraLabel = magicCount > 0 ? ` + <strong>${magicCount}</strong> estimée(s)` : '';
      this.el.mapModalCountBadge.innerHTML = `${nativeCount}${extraLabel} photo(s)`;
    }

    this.mapMarkersGroup.clearLayers();
    if (this.mapRouteLine) {
      this.leafletMap.removeLayer(this.mapRouteLine);
      this.mapRouteLine = null;
    }

    if (mappedItems.length === 0) return;

    const markersMap = new Map();
    const latLngs = [];

    mappedItems.forEach((item) => {
      const file = item.file;
      const lat = item.lat;
      const lng = item.lng;
      latLngs.push([lat, lng]);

      const isFocused = focusPath === file.path;
      const isMagic = item.gps_source !== 'native';

      let markerClasses = `marker-bubble ${isFocused ? 'highlight' : ''} ${isMagic ? 'magic' : ''}`;
      let sparkleHtml = isMagic ? '<div class="marker-magic-sparkle" title="Position déduite par horodatage">✨</div>' : '';
      let pointerClass = isMagic ? 'marker-pointer magic-pointer' : 'marker-pointer';

      const markerIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `
          <div class="${markerClasses}">
            <img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" />
            ${sparkleHtml}
          </div>
          <div class="${pointerClass}"></div>
        `,
        iconSize: [44, 52],
        iconAnchor: [22, 50],
        popupAnchor: [0, -48]
      });

      const marker = L.marker([lat, lng], { icon: markerIcon });

      let sourceBadgeHtml = '';
      if (item.gps_source === 'interpolated') {
        sourceBadgeHtml = `<div class="map-popup-magic-badge">✨ Position estimée (+${item.delta_min_a} min après « ${this.escapeHtml(item.anchor_a)} »)</div>`;
      } else if (item.gps_source === 'extrapolated') {
        sourceBadgeHtml = `<div class="map-popup-magic-badge">✨ Position estimée (proche de « ${this.escapeHtml(item.anchor_name)} »)</div>`;
      } else {
        sourceBadgeHtml = `<div class="map-popup-date" style="color:#4ade80; font-weight:600; font-size:0.75rem; margin-bottom:2px;">📍 Coordonnées GPS réelles</div>`;
      }

      const popupContent = `
        <div class="map-popup-card">
          <div class="map-popup-img-wrap" onclick="window.galleryApp.openLightboxByPath('${this.escapeHtml(file.path)}')">
            <img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" />
            <div class="map-popup-play-overlay">🔍 Voir</div>
          </div>
          <div class="map-popup-info">
            ${sourceBadgeHtml}
            <div class="map-popup-title" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
            ${file.exif?.datetime ? `<div class="map-popup-date">📅 ${this.escapeHtml(file.exif.datetime)}</div>` : ''}
            ${file.comment ? `<div class="map-popup-comment">💬 ${this.escapeHtml(file.comment)}</div>` : ''}
            <button type="button" class="map-popup-btn" onclick="window.galleryApp.openLightboxByPath('${this.escapeHtml(file.path)}')">
              🖼️ Ouvrir dans la visionneuse
            </button>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 270, className: 'sg-leaflet-popup' });
      this.mapMarkersGroup.addLayer(marker);
      markersMap.set(file.path, marker);
    });

    if (latLngs.length > 1) {
      this.mapRouteLine = L.polyline(latLngs, {
        color: '#818cf8',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round',
        lineJoin: 'round'
      });
      if (this.isMapRouteVisible) {
        this.mapRouteLine.addTo(this.leafletMap);
      }
    }

    setTimeout(() => {
      this.leafletMap.invalidateSize();
      if (focusPath && markersMap.has(focusPath)) {
        const targetMarker = markersMap.get(focusPath);
        if (typeof this.mapMarkersGroup.zoomToShowLayer === 'function') {
          this.mapMarkersGroup.zoomToShowLayer(targetMarker, () => {
            this.leafletMap.setView(targetMarker.getLatLng(), Math.max(this.leafletMap.getZoom(), 16));
            targetMarker.openPopup();
          });
        } else {
          this.leafletMap.setView(targetMarker.getLatLng(), 16);
          targetMarker.openPopup();
        }
      } else if (latLngs.length > 0) {
        this.fitMapBounds();
      }
    }, 250);
  }

  closeMapModal() {
    if (!this.el.mapModal) {
      this.el.mapModal = document.getElementById('mapModal');
    }
    if (!this.el.mapModal) return;
    this.el.mapModal.classList.remove('open');
    setTimeout(() => {
      this.el.mapModal.style.display = 'none';
    }, 250);
  }

  toggleMapRoute() {
    if (!this.leafletMap || !this.mapRouteLine) return;
    this.isMapRouteVisible = !this.isMapRouteVisible;
    if (this.isMapRouteVisible) {
      this.mapRouteLine.addTo(this.leafletMap);
      if (this.el.mapToggleRouteBtn) this.el.mapToggleRouteBtn.classList.add('active');
    } else {
      this.leafletMap.removeLayer(this.mapRouteLine);
      if (this.el.mapToggleRouteBtn) this.el.mapToggleRouteBtn.classList.remove('active');
    }
  }

  fitMapBounds() {
    if (!this.leafletMap || !this.mapMarkersGroup) return;
    const bounds = this.mapMarkersGroup.getBounds();
    if (bounds.isValid()) {
      this.leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }

  openLightboxByPath(filePath) {
    this.closeMapModal();
    const idx = this.state.filteredFiles.findIndex(f => f.path === filePath);
    if (idx !== -1) {
      this.openLightbox(idx);
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

  // =============================================================
  // 15. RGPD / ePrivacy COOKIE CONSENT & STORAGE MANAGEMENT
  // =============================================================

  getCookieConsent() {
    try {
      const stored = localStorage.getItem('sg_cookie_consent');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Unable to read sg_cookie_consent from localStorage:', e);
    }
    return null;
  }

  setCookieConsent(consent) {
    const fullConsent = {
      necessary: true,
      preferences: !!(consent && consent.preferences),
      cdn: !!(consent && consent.cdn),
      timestamp: Date.now()
    };
    this.state.cookieConsent = fullConsent;
    try {
      localStorage.setItem('sg_cookie_consent', JSON.stringify(fullConsent));
      if (!fullConsent.preferences) {
        // If user revoked preferences, clean non-essential localStorage keys
        localStorage.removeItem('sg_favorites');
        localStorage.removeItem('gallery_view_mode');
        localStorage.removeItem('sg_folder_sorts');
      } else {
        // Persist current state if permitted
        localStorage.setItem('gallery_view_mode', this.state.viewMode);
        localStorage.setItem('sg_favorites', JSON.stringify(this.state.favorites));
      }
    } catch (e) {
      console.warn('Unable to save sg_cookie_consent to localStorage:', e);
    }

    if (this.el.cookieConsentBanner) {
      this.el.cookieConsentBanner.style.display = 'none';
    }
  }

  isPreferencesStorageAllowed() {
    if (!this.state.isCookieConsentEnabled) return true;
    if (!this.state.cookieConsent) return true; // Default allowed until explicitly rejected
    return !!this.state.cookieConsent.preferences;
  }

  initCookieConsent() {
    if (!this.state.isCookieConsentEnabled) {
      if (this.el.cookieConsentBanner) this.el.cookieConsentBanner.style.display = 'none';
      if (this.el.openCookieSettingsBtn) this.el.openCookieSettingsBtn.style.display = 'none';
      return;
    }

    // Show floating banner if user hasn't made a choice yet
    if (!this.state.cookieConsent) {
      setTimeout(() => {
        if (this.el.cookieConsentBanner) {
          this.el.cookieConsentBanner.style.display = 'block';
        }
      }, 400);
    }

    // Bind banner actions
    if (this.el.cookieAcceptAllBtn) {
      this.el.cookieAcceptAllBtn.addEventListener('click', () => {
        this.setCookieConsent({ necessary: true, preferences: true, cdn: true });
      });
    }

    if (this.el.cookieRejectNonEssentialBtn) {
      this.el.cookieRejectNonEssentialBtn.addEventListener('click', () => {
        this.setCookieConsent({ necessary: true, preferences: false, cdn: false });
      });
    }

    if (this.el.cookieCustomizeBtn) {
      this.el.cookieCustomizeBtn.addEventListener('click', () => {
        this.openCookieSettings();
      });
    }

    // Bind footer trigger
    if (this.el.openCookieSettingsBtn) {
      this.el.openCookieSettingsBtn.addEventListener('click', () => {
        this.openCookieSettings();
      });
    }

    // Bind modal actions
    if (this.el.cookieSettingsCloseBtn) {
      this.el.cookieSettingsCloseBtn.addEventListener('click', () => {
        this.closeCookieSettings();
      });
    }

    if (this.el.cookieSettingsModal) {
      this.el.cookieSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.el.cookieSettingsModal) {
          this.closeCookieSettings();
        }
      });
    }

    if (this.el.cookieSaveCustomBtn) {
      this.el.cookieSaveCustomBtn.addEventListener('click', () => {
        const prefVal = this.el.cookieOptPreferences ? this.el.cookieOptPreferences.checked : true;
        const cdnVal = this.el.cookieOptCdn ? this.el.cookieOptCdn.checked : true;
        this.setCookieConsent({ necessary: true, preferences: prefVal, cdn: cdnVal });
        this.closeCookieSettings();
      });
    }

    if (this.el.cookieModalAcceptAllBtn) {
      this.el.cookieModalAcceptAllBtn.addEventListener('click', () => {
        this.setCookieConsent({ necessary: true, preferences: true, cdn: true });
        this.closeCookieSettings();
      });
    }
  }

  openCookieSettings() {
    if (!this.el.cookieSettingsModal) return;
    const consent = this.state.cookieConsent || { necessary: true, preferences: true, cdn: true };
    if (this.el.cookieOptPreferences) {
      this.el.cookieOptPreferences.checked = consent.preferences !== false;
    }
    if (this.el.cookieOptCdn) {
      this.el.cookieOptCdn.checked = consent.cdn !== false;
    }
    this.el.cookieSettingsModal.style.display = 'flex';
    setTimeout(() => this.el.cookieSettingsModal.classList.add('open'), 10);
  }

  closeCookieSettings() {
    if (!this.el.cookieSettingsModal) return;
    this.el.cookieSettingsModal.classList.remove('open');
    setTimeout(() => {
      this.el.cookieSettingsModal.style.display = 'none';
    }, 250);
  }

  // =============================================================
  // 16. ADMIN IMAGE EDITOR ENGINE (Canvas, Crop, Rotate, Adjust)
  // =============================================================

  initImageEditor() {
    this.editorState = {
      imageObj: null,
      sourceCanvas: document.createElement('canvas'),
      file: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      filter: 'none',
      isCropping: false,
      cropRatio: 'free',
      cropBox: { x: 0, y: 0, w: 0, h: 0 },
      isDraggingCrop: false,
      activeCropHandle: null,
      cropDragStart: { x: 0, y: 0 },
      cropBoxStart: null
    };

    if (this.el.lightboxEditImageBtn) {
      this.el.lightboxEditImageBtn.addEventListener('click', () => {
        if (this.state.lightboxIndex !== null) {
          const file = this.state.filteredFiles[this.state.lightboxIndex];
          if (file) this.openImageEditor(file);
        }
      });
    }

    if (this.el.imageEditorCloseBtn) {
      this.el.imageEditorCloseBtn.addEventListener('click', () => this.closeImageEditor());
    }

    if (this.el.editorResetAllBtn) {
      this.el.editorResetAllBtn.addEventListener('click', () => this.resetImageEditor());
    }

    // Transformations
    if (this.el.editorRotateCcwBtn) {
      this.el.editorRotateCcwBtn.addEventListener('click', () => this.rotateEditor(-90));
    }
    if (this.el.editorRotateCwBtn) {
      this.el.editorRotateCwBtn.addEventListener('click', () => this.rotateEditor(90));
    }
    if (this.el.editorFlipHBtn) {
      this.el.editorFlipHBtn.addEventListener('click', () => this.flipEditor('h'));
    }
    if (this.el.editorFlipVBtn) {
      this.el.editorFlipVBtn.addEventListener('click', () => this.flipEditor('v'));
    }

    // Crop Toggle & Apply
    if (this.el.editorToggleCropBtn) {
      this.el.editorToggleCropBtn.addEventListener('click', () => this.toggleCrop());
    }
    if (this.el.editorApplyCropBtn) {
      this.el.editorApplyCropBtn.addEventListener('click', () => this.applyCrop());
    }

    // Crop Ratios
    const ratioBtns = document.querySelectorAll('.crop-ratio-btn');
    ratioBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        ratioBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.editorState.cropRatio = btn.dataset.ratio || 'free';
        if (!this.editorState.isCropping) {
          this.toggleCrop(true);
        } else {
          this.initDefaultCropBox();
          this.updateCropBoxDOM();
        }
      });
    });

    // Sliders (Brightness, Contrast, Saturation)
    if (this.el.editorBrightnessSlider) {
      this.el.editorBrightnessSlider.addEventListener('input', (e) => {
        this.editorState.brightness = parseInt(e.target.value, 10);
        if (this.el.editorBrightnessVal) this.el.editorBrightnessVal.textContent = `${this.editorState.brightness}%`;
        this.renderEditorCanvas();
      });
    }

    if (this.el.editorContrastSlider) {
      this.el.editorContrastSlider.addEventListener('input', (e) => {
        this.editorState.contrast = parseInt(e.target.value, 10);
        if (this.el.editorContrastVal) this.el.editorContrastVal.textContent = `${this.editorState.contrast}%`;
        this.renderEditorCanvas();
      });
    }

    if (this.el.editorSaturationSlider) {
      this.el.editorSaturationSlider.addEventListener('input', (e) => {
        this.editorState.saturation = parseInt(e.target.value, 10);
        if (this.el.editorSaturationVal) this.el.editorSaturationVal.textContent = `${this.editorState.saturation}%`;
        this.renderEditorCanvas();
      });
    }

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.editor-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.editorState.filter = btn.dataset.filter || 'none';
        this.renderEditorCanvas();
      });
    });

    // Save Choice Modal triggers
    if (this.el.editorOpenSaveChoiceBtn) {
      this.el.editorOpenSaveChoiceBtn.addEventListener('click', () => this.openSaveChoiceModal());
    }
    if (this.el.saveChoiceCloseBtn) {
      this.el.saveChoiceCloseBtn.addEventListener('click', () => this.closeSaveChoiceModal());
    }
    if (this.el.saveChoiceCancelBtn) {
      this.el.saveChoiceCancelBtn.addEventListener('click', () => this.closeSaveChoiceModal());
    }
    if (this.el.imageSaveChoiceModal) {
      this.el.imageSaveChoiceModal.addEventListener('click', (e) => {
        if (e.target === this.el.imageSaveChoiceModal) {
          this.closeSaveChoiceModal();
        }
      });
    }
    if (this.el.saveChoiceConfirmBtn) {
      this.el.saveChoiceConfirmBtn.addEventListener('click', () => {
        const radio = document.querySelector('input[name="saveImageModeRadio"]:checked');
        const saveMode = radio ? radio.value : 'copy';
        this.saveEditedImage(saveMode);
      });
    }

    // Crop Drag & Resize Interactions
    this.initCropInteractions();
  }

  openImageEditor(file) {
    if (!this.el.imageEditorModal) return;
    this.editorState.file = file;

    if (this.el.editorImageNameBadge) {
      this.el.editorImageNameBadge.textContent = file.name;
    }

    this.showLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.showLoading(false);
      this.editorState.imageObj = img;
      
      // Initialize source canvas with original image
      const srcCanvas = this.editorState.sourceCanvas;
      srcCanvas.width = img.naturalWidth;
      srcCanvas.height = img.naturalHeight;
      const ctx = srcCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      this.resetImageEditorState();
      this.el.imageEditorModal.style.display = 'flex';
      setTimeout(() => {
        this.el.imageEditorModal.classList.add('open');
        this.renderEditorCanvas();
      }, 20);
    };

    img.onerror = () => {
      this.showLoading(false);
      alert("⚠️ Impossible de charger l'image pour l'édition.");
    };

    img.src = file.file_url + (file.file_url.includes('?') ? '&' : '?') + 't=' + Date.now();
  }

  closeImageEditor() {
    if (!this.el.imageEditorModal) return;
    this.el.imageEditorModal.classList.remove('open');
    setTimeout(() => {
      this.el.imageEditorModal.style.display = 'none';
      this.closeSaveChoiceModal();
    }, 250);
  }

  resetImageEditorState() {
    this.editorState.rotation = 0;
    this.editorState.flipH = false;
    this.editorState.flipV = false;
    this.editorState.brightness = 0;
    this.editorState.contrast = 0;
    this.editorState.saturation = 0;
    this.editorState.filter = 'none';
    this.editorState.isCropping = false;
    this.editorState.cropRatio = 'free';

    if (this.el.editorBrightnessSlider) this.el.editorBrightnessSlider.value = '0';
    if (this.el.editorBrightnessVal) this.el.editorBrightnessVal.textContent = '0%';
    if (this.el.editorContrastSlider) this.el.editorContrastSlider.value = '0';
    if (this.el.editorContrastVal) this.el.editorContrastVal.textContent = '0%';
    if (this.el.editorSaturationSlider) this.el.editorSaturationSlider.value = '0';
    if (this.el.editorSaturationVal) this.el.editorSaturationVal.textContent = '0%';

    document.querySelectorAll('.editor-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
    document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === 'free'));

    if (this.el.editorCropBox) this.el.editorCropBox.style.display = 'none';
    if (this.el.editorToggleCropBtn) this.el.editorToggleCropBtn.classList.remove('active');
  }

  resetImageEditor() {
    if (!this.editorState.imageObj) return;
    const srcCanvas = this.editorState.sourceCanvas;
    srcCanvas.width = this.editorState.imageObj.naturalWidth;
    srcCanvas.height = this.editorState.imageObj.naturalHeight;
    const ctx = srcCanvas.getContext('2d');
    ctx.drawImage(this.editorState.imageObj, 0, 0);

    this.resetImageEditorState();
    this.renderEditorCanvas();
  }

  rotateEditor(degrees) {
    this.editorState.rotation = (this.editorState.rotation + degrees + 360) % 360;
    this.renderEditorCanvas();
    if (this.editorState.isCropping) {
      this.initDefaultCropBox();
      this.updateCropBoxDOM();
    }
  }

  flipEditor(axis) {
    if (axis === 'h') this.editorState.flipH = !this.editorState.flipH;
    if (axis === 'v') this.editorState.flipV = !this.editorState.flipV;
    this.renderEditorCanvas();
  }

  toggleCrop(forceState) {
    const nextState = (forceState !== undefined) ? forceState : !this.editorState.isCropping;
    this.editorState.isCropping = nextState;
    if (this.el.editorToggleCropBtn) {
      this.el.editorToggleCropBtn.classList.toggle('active', nextState);
    }
    if (this.el.editorCropBox) {
      this.el.editorCropBox.style.display = nextState ? 'block' : 'none';
    }
    if (nextState) {
      this.initDefaultCropBox();
      this.updateCropBoxDOM();
    }
  }

  initDefaultCropBox() {
    const canvas = this.el.editorCanvas;
    if (!canvas) return;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w <= 0 || h <= 0) return;

    let cropW = w * 0.8;
    let cropH = h * 0.8;

    if (this.editorState.cropRatio !== 'free') {
      const parts = this.editorState.cropRatio.split(':').map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        const targetAspect = parts[0] / parts[1];
        if (cropW / cropH > targetAspect) {
          cropW = cropH * targetAspect;
        } else {
          cropH = cropW / targetAspect;
        }
      }
    }

    this.editorState.cropBox = {
      x: (w - cropW) / 2,
      y: (h - cropH) / 2,
      w: cropW,
      h: cropH
    };
  }

  updateCropBoxDOM() {
    if (!this.el.editorCropBox || !this.editorState.isCropping) return;
    const box = this.editorState.cropBox;
    this.el.editorCropBox.style.left = `${box.x}px`;
    this.el.editorCropBox.style.top = `${box.y}px`;
    this.el.editorCropBox.style.width = `${box.w}px`;
    this.el.editorCropBox.style.height = `${box.h}px`;
  }

  initCropInteractions() {
    const cropBox = this.el.editorCropBox;
    if (!cropBox) return;

    const onPointerDown = (clientX, clientY, target) => {
      if (!this.editorState.isCropping) return;
      this.editorState.isDraggingCrop = true;
      this.editorState.activeCropHandle = target.dataset.handle || null;
      this.editorState.cropDragStart = { x: clientX, y: clientY };
      this.editorState.cropBoxStart = { ...this.editorState.cropBox };
    };

    cropBox.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPointerDown(e.clientX, e.clientY, e.target);
    });

    cropBox.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target);
      }
    }, { passive: false });

    const onPointerMove = (clientX, clientY) => {
      if (!this.editorState.isDraggingCrop || !this.editorState.isCropping) return;
      const canvas = this.el.editorCanvas;
      if (!canvas) return;

      const maxW = canvas.offsetWidth;
      const maxH = canvas.offsetHeight;
      const dx = clientX - this.editorState.cropDragStart.x;
      const dy = clientY - this.editorState.cropDragStart.y;
      const start = this.editorState.cropBoxStart;
      const handle = this.editorState.activeCropHandle;
      const minSize = 30;

      let newBox = { ...start };

      if (!handle) {
        // Dragging entire crop box
        newBox.x = Math.max(0, Math.min(maxW - start.w, start.x + dx));
        newBox.y = Math.max(0, Math.min(maxH - start.h, start.y + dy));
      } else {
        // Resizing via handles
        if (handle.includes('e')) newBox.w = Math.max(minSize, Math.min(maxW - start.x, start.w + dx));
        if (handle.includes('s')) newBox.h = Math.max(minSize, Math.min(maxH - start.y, start.h + dy));
        if (handle.includes('w')) {
          const adjDx = Math.min(dx, start.w - minSize);
          newBox.x = Math.max(0, start.x + adjDx);
          newBox.w = start.w - (newBox.x - start.x);
        }
        if (handle.includes('n')) {
          const adjDy = Math.min(dy, start.h - minSize);
          newBox.y = Math.max(0, start.y + adjDy);
          newBox.h = start.h - (newBox.y - start.y);
        }

        // Apply aspect ratio constraint if set
        if (this.editorState.cropRatio !== 'free') {
          const parts = this.editorState.cropRatio.split(':').map(Number);
          if (parts.length === 2) {
            const aspect = parts[0] / parts[1];
            if (handle === 'e' || handle === 'w' || handle.includes('e') || handle.includes('w')) {
              newBox.h = newBox.w / aspect;
            } else {
              newBox.w = newBox.h * aspect;
            }
          }
        }
      }

      this.editorState.cropBox = newBox;
      this.updateCropBoxDOM();
    };

    window.addEventListener('mousemove', (e) => {
      if (this.editorState.isDraggingCrop) {
        e.preventDefault();
        onPointerMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (this.editorState.isDraggingCrop && e.touches.length === 1) {
        e.preventDefault();
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    const onPointerUp = () => {
      this.editorState.isDraggingCrop = false;
      this.editorState.activeCropHandle = null;
    };

    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
  }

  applyCrop() {
    if (!this.editorState.isCropping) return;
    const canvas = this.el.editorCanvas;
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return;

    const displayW = canvas.offsetWidth;
    const displayH = canvas.offsetHeight;
    if (displayW <= 0 || displayH <= 0) return;

    const scaleX = canvas.width / displayW;
    const scaleY = canvas.height / displayH;

    const box = this.editorState.cropBox;
    const sx = Math.max(0, Math.floor(box.x * scaleX));
    const sy = Math.max(0, Math.floor(box.y * scaleY));
    const sw = Math.min(canvas.width - sx, Math.floor(box.w * scaleX));
    const sh = Math.min(canvas.height - sy, Math.floor(box.h * scaleY));

    if (sw <= 10 || sh <= 10) return;

    // Create cropped canvas
    const cropped = document.createElement('canvas');
    cropped.width = sw;
    cropped.height = sh;
    const ctx = cropped.getContext('2d');
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    // Update source canvas
    this.editorState.sourceCanvas = cropped;
    this.editorState.rotation = 0;
    this.editorState.flipH = false;
    this.editorState.flipV = false;
    this.toggleCrop(false);
    this.renderEditorCanvas();
  }

  renderEditorCanvas() {
    const canvas = this.el.editorCanvas;
    const src = this.editorState.sourceCanvas;
    if (!canvas || !src || src.width <= 0 || src.height <= 0) return;

    const rot = this.editorState.rotation;
    const isRotated90 = (rot === 90 || rot === 270);
    const destW = isRotated90 ? src.height : src.width;
    const destH = isRotated90 ? src.width : src.height;

    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, destW, destH);

    ctx.save();
    ctx.translate(destW / 2, destH / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(this.editorState.flipH ? -1 : 1, this.editorState.flipV ? -1 : 1);

    // Build CSS filter string for canvas draw
    const b = 100 + this.editorState.brightness;
    const c = 100 + this.editorState.contrast;
    const s = 100 + this.editorState.saturation;
    let filterStr = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

    if (this.editorState.filter === 'grayscale') filterStr += ' grayscale(100%)';
    if (this.editorState.filter === 'sepia') filterStr += ' sepia(85%)';
    if (this.editorState.filter === 'warm') filterStr += ' sepia(35%) saturate(140%)';
    if (this.editorState.filter === 'invert') filterStr += ' invert(100%)';

    ctx.filter = filterStr;
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    ctx.restore();

    if (this.el.editorImageDimBadge) {
      this.el.editorImageDimBadge.textContent = `${destW} × ${destH} px`;
    }
  }

  openSaveChoiceModal() {
    if (!this.el.imageSaveChoiceModal) return;
    const file = this.editorState.file;
    if (file && this.el.saveChoiceCopyNamePreview) {
      const parts = file.name.split('.');
      const ext = parts.length > 1 ? '.' + parts.pop() : '';
      const base = parts.join('.');
      const cleanBase = base.replace(/_edited(_\d+)?$/i, '');
      this.el.saveChoiceCopyNamePreview.textContent = `${cleanBase}_edited${ext}`;
    }
    this.el.imageSaveChoiceModal.style.display = 'flex';
    setTimeout(() => this.el.imageSaveChoiceModal.classList.add('open'), 10);
  }

  closeSaveChoiceModal() {
    if (!this.el.imageSaveChoiceModal) return;
    this.el.imageSaveChoiceModal.classList.remove('open');
    setTimeout(() => {
      this.el.imageSaveChoiceModal.style.display = 'none';
    }, 250);
  }

  async saveEditedImage(saveMode) {
    const canvas = this.el.editorCanvas;
    const file = this.editorState.file;
    if (!canvas || !file) return;

    this.showLoading(true);

    try {
      // Export canvas to high quality Data URL
      const ext = (file.extension || 'jpg').toLowerCase();
      const mime = (ext === 'png') ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
      const quality = (mime === 'image/png') ? undefined : 0.92;
      const dataUrl = canvas.toDataURL(mime, quality);

      const payload = {
        action: 'edit_image',
        target_path: file.path,
        save_mode: saveMode, // 'overwrite' or 'copy'
        image_data: dataUrl,
        csrf_token: this.state.csrfToken
      };

      const res = await fetch('api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      this.showLoading(false);

      if (json.success) {
        this.closeSaveChoiceModal();
        this.closeImageEditor();

        // Reload gallery directory to display new/updated image
        await this.loadDirectory(this.state.currentPath);

        // If lightbox is open, refresh preview
        if (this.state.lightboxIndex !== null) {
          if (saveMode === 'overwrite') {
            this.openLightbox(this.state.lightboxIndex);
          } else {
            // Find index of newly created copy
            const copyIdx = this.state.filteredFiles.findIndex(f => f.name === json.file_name);
            if (copyIdx !== -1) {
              this.openLightbox(copyIdx);
            }
          }
        }
      } else {
        alert('⚠️ ' + (json.error || 'Erreur lors de la sauvegarde de l\'image.'));
      }
    } catch (err) {
      this.showLoading(false);
      alert('⚠️ Erreur réseau lors de la sauvegarde : ' + err.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.galleryApp = new SimpleGallery();
});
