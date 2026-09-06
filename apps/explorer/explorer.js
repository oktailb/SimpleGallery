/**
 * SimpleGallery 2026 - Explorer Application (apps/explorer/explorer.js)
 * Fully modular, autonomous, multi-instance Gallery Explorer with Cross-Window Drag & Drop.
 */
(function (window) {
  'use strict';

  // -------------------------------------------------------------
  // EXPLORER INDIVIDUAL WINDOW INSTANCE CLASS
  // -------------------------------------------------------------
  class ExplorerInstance {
    constructor(manager, instanceId, options = {}) {
      this.manager = manager;
      this.id = instanceId;
      this.winId = `explorer-${instanceId}`;

      this.state = {
        currentPath: options.dir !== undefined ? options.dir : '',
        directories: [],
        files: [],
        filteredFiles: [],
        overrides: {},
        sortBy: 'name',
        sortOrder: 'asc',
        filterCategory: 'all',
        searchQuery: '',
        isSearchActive: false,
        showFavoritesOnly: false,
        favorites: [],
        selectedPaths: new Set(),
        lastSelectedIndex: null,
        draggingItemPath: null,
        draggingPaths: null,
        currentBreadcrumbs: null,
        isAdmin: false,
        adminEnabled: false,
        csrfToken: (typeof window !== 'undefined' && (window.CSRF_TOKEN || window.SG_CSRF_TOKEN)) || '',
        userRights: {},
        availableArchives: [],
        viewMode: 'polaroid',
        galleryTitle: 'SimpleGallery'
      };

      this.isSmartGpsEnabled = true;
      this.leafletMap = null;
      this.leafletMarkersLayer = null;
      this.leafletRouteLayer = null;
      this.leafletTileLayer = null;
      this.isRouteVisible = true;
      this.currentTileLayerName = 'streets';

      this.emptyDragImage = new Image();

      this.initContainer();
      this.initElements();
      this.initWindow(options);
      this.loadSavedPreferences();
      this.bindEvents();
      this.initMarqueeSelection();
      this.loadDirectory(this.state.currentPath);
    }

    initContainer() {
      const template = document.getElementById('explorerAppTemplate');
      if (template && template.content && template.content.firstElementChild) {
        this.containerEl = template.content.cloneNode(true).firstElementChild;
      } else {
        const existing = document.getElementById('explorerAppContainer');
        if (existing) {
          this.containerEl = existing.cloneNode(true);
        } else {
          console.error('[Explorer] Template #explorerAppTemplate not found in DOM! Ensure apps/explorer/template.php is rendered by the Kernel.');
          this.containerEl = document.createElement('div');
          this.containerEl.className = 'webos-explorer-container';
          this.containerEl.innerHTML = `
            <div style="padding: 2.5rem 1.5rem; text-align: center; color: var(--text-main, #e2e8f0); font-family: system-ui, sans-serif;">
              <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">⚠️</div>
              <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">Template de l'Explorateur introuvable</h3>
              <p style="color: var(--text-muted, #94a3b8); font-size: 0.9rem; max-width: 480px; margin: 0 auto 1.5rem auto;">
                L'élément &lt;template id="explorerAppTemplate"&gt; est absent du DOM. Vérifiez la syntaxe de apps/explorer/template.php.
              </p>
              <button type="button" onclick="location.reload()" style="padding: 0.5rem 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(99,102,241,0.2); color: #fff; cursor: pointer;">
                Rafraîchir la page
              </button>
            </div>
          `;
        }
      }
      this.containerEl.id = `explorer-container-${this.id}`;
    }

    initWindow(options = {}) {
      if (!window.WindowManager) return;

      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('explorer')
        : (this.t('apps.explorer.title'));

      const isFirst = (this.manager.instances.size === 0);
      const offset = ((this.id - 1) * 32) % 160;
      const defaultW = Math.min(960, Math.max(520, Math.round(window.innerWidth * 0.76)));
      const defaultH = Math.min(660, Math.max(420, Math.round(window.innerHeight * 0.72)));
      const defaultX = Math.max(20, Math.round((window.innerWidth - defaultW) / 2) + offset);
      const defaultY = Math.max(50, Math.round((window.innerHeight - defaultH) / 2) + offset);
      const targetWindowState = options.state || ((isFirst && !options.dir) ? 'maximized' : 'floating');

      this.win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'explorer',
        appName: appTitle,
        title: this.state.galleryTitle,
        icon: '🗂️',
        x: defaultX,
        y: defaultY,
        width: defaultW,
        height: defaultH,
        isMaximized: targetWindowState === 'maximized',
        state: targetWindowState,
        content: this.containerEl,
        onFocus: () => {
          this.manager.setActiveInstance(this);
        },
        onClose: () => {
          this.destroy();
        }
      });
    }

    destroy() {
      if (this.containerEl && this.containerEl.parentNode) {
        this.containerEl.parentNode.removeChild(this.containerEl);
      }
      this.win = null;
      this.manager.removeInstance(this.id);
    }

    initElements() {
      const root = this.containerEl;
      this.el = {
        breadcrumbs: root.querySelector('.breadcrumbs'),
        folderSection: root.querySelector('.folder-section'),
        foldersGrid: root.querySelector('.folders-grid'),
        mediaSection: root.querySelector('.media-section'),
        mediaGrid: root.querySelector('.media-grid'),
        loadingState: root.querySelector('.loading-spinner'),
        emptyState: root.querySelector('.empty-state'),
        filterPills: root.querySelector('.filter-pills'),
        galleryStats: root.querySelector('.gallery-stats'),
        folderMapBtn: root.querySelector('.folder-map-btn'),
        folderSettingsBtn: root.querySelector('.explorer-folder-settings-btn'),
        searchResultsBanner: root.querySelector('.search-results-banner'),
        searchResultsCountText: root.querySelector('.search-results-count-text'),
        exitSearchBtn: root.querySelector('.exit-search-btn'),
        dropZoneOverlay: root.querySelector('.drop-zone-overlay'),
        selectionToolbar: root.querySelector('.selection-toolbar'),
        selectionToolbarCount: root.querySelector('.selection-toolbar-count'),
        selectionCopyBtn: root.querySelector('.selection-copy-btn'),
        selectionCutBtn: root.querySelector('.selection-cut-btn'),
        selectionDeleteBtn: root.querySelector('.selection-delete-btn'),
        selectionInfoBtn: root.querySelector('.selection-info-btn'),
        selectionSelectAllBtn: root.querySelector('.selection-select-all-btn'),
        selectionClearBtn: root.querySelector('.selection-clear-btn'),
        // Modals within instance
        mapModal: root.querySelector('.map-modal'),
        mapModalCloseBtn: root.querySelector('.map-modal-close-btn'),
        mapModalCountBadge: root.querySelector('.map-modal-count-badge'),
        mapSmartGpsCount: root.querySelector('.map-smart-gps-count'),
        mapToggleSmartGpsBtn: root.querySelector('.map-toggle-smart-gps-btn'),
        mapToggleRouteBtn: root.querySelector('.map-toggle-route-btn'),
        mapFitBoundsBtn: root.querySelector('.map-fit-bounds-btn'),
        galleryLeafletMap: root.querySelector('.gallery-leaflet-map'),
        searchModal: root.querySelector('.search-modal'),
        searchModalCloseBtn: root.querySelector('.search-modal-close-btn'),
        searchAdvancedForm: root.querySelector('.search-advanced-form'),
        advSearchTiming: root.querySelector('.adv-search-timing'),
        advSearchCustomDateRow: root.querySelector('.adv-search-custom-date-row'),
        advSearchResetBtn: root.querySelector('.adv-search-reset-btn'),
        advSearchCategory: root.querySelector('.adv-search-category'),
        advSearchName: root.querySelector('.adv-search-name'),
        advSearchWords: root.querySelector('.adv-search-words'),
        advSearchLocation: root.querySelector('.adv-search-location'),
        advSearchDateFrom: root.querySelector('.adv-search-date-from'),
        advSearchDateTo: root.querySelector('.adv-search-date-to'),
        advSearchSize: root.querySelector('.adv-search-size'),
        advSearchGpsOnly: root.querySelector('.adv-search-gps-only'),
        advSearchFavOnly: root.querySelector('.adv-search-fav-only'),
        // Global / shared modals
        createFolderModal: document.getElementById('createFolderModal'),
        createFolderCloseBtn: document.getElementById('createFolderCloseBtn'),
        createFolderForm: document.getElementById('createFolderForm'),
        newFolderNameInput: document.getElementById('createFolderNameInput') || document.getElementById('newFolderNameInput'),
        createFolderError: document.getElementById('createFolderError'),
        deleteConfirmModal: document.getElementById('deleteConfirmModal'),
        deleteConfirmCloseBtn: document.getElementById('deleteConfirmCloseBtn'),
        deleteCancelBtn: document.getElementById('deleteCancelBtn'),
        deleteConfirmActionBtn: document.getElementById('deleteConfirmActionBtn'),
        deleteConfirmMessage: document.getElementById('deleteConfirmMessage'),
        deleteConfirmItemName: document.getElementById('deleteConfirmItemName'),
        deleteConfirmItemType: document.getElementById('deleteConfirmItemType'),
        mediaCommentModal: document.getElementById('mediaCommentModal'),
        mediaCommentCloseBtn: document.getElementById('mediaCommentCloseBtn'),
        mediaCommentForm: document.getElementById('mediaCommentForm'),
        mediaCommentInput: document.getElementById('mediaCommentInput'),
        mediaCommentFilenameBadge: document.getElementById('mediaCommentFilenameBadge'),
        folderUnlockModal: document.getElementById('folderUnlockModal'),
        folderUnlockCloseBtn: document.getElementById('folderUnlockCloseBtn'),
        folderUnlockForm: document.getElementById('folderUnlockForm'),
        folderPasswordInput: document.getElementById('folderPasswordInput'),
        folderUnlockError: document.getElementById('folderUnlockError'),
        folderSettingsModal: document.getElementById('folderSettingsModal'),
        folderSettingsCloseBtn: document.getElementById('folderSettingsCloseBtn'),
        folderSettingsForm: document.getElementById('folderSettingsForm'),
        dotfileTitleInput: document.getElementById('dotfileTitleInput'),
        dotfileDescInput: document.getElementById('dotfileDescInput'),
        dotfileBgInput: document.getElementById('dotfileBgInput'),
        dotfileAccessModeSelect: document.getElementById('dotfileAccessModeSelect'),
        folderPasswordGroup: document.getElementById('folderPasswordGroup'),
        dotfilePasswordInput: document.getElementById('dotfilePasswordInput'),
        folderDescBanner: document.getElementById('folderDescBanner'),
        // Multimodal Autorun Banner & Editor
        autorunBanner: root.querySelector('.explorer-autorun-banner'),
        autorunTitle: root.querySelector('.autorun-title'),
        autorunDescription: root.querySelector('.autorun-description'),
        autorunPlayBtn: root.querySelector('.autorun-play-btn'),
        autorunEditBtn: root.querySelector('.autorun-edit-btn'),
        autorunEditorModal: root.querySelector('.autorun-editor-modal'),
        autorunEditorCloseBtn: root.querySelector('.autorun-editor-close-btn'),
        autorunEditorCancelBtn: root.querySelector('.autorun-editor-cancel-btn'),
        autorunEditorSaveBtn: root.querySelector('.autorun-editor-save-btn'),
        autorunEditorDeleteBtn: root.querySelector('.autorun-editor-delete-btn'),
        autorunEditorForm: root.querySelector('.autorun-editor-form'),
        autorunEditTitle: root.querySelector('.autorun-edit-title'),
        autorunEditDesc: root.querySelector('.autorun-edit-desc'),
        autorunEditLayout: root.querySelector('.autorun-edit-layout'),
        autorunEditJson: root.querySelector('.autorun-edit-json'),
        // Quick Live Search & View Switcher
        quickSearchInput: root.querySelector('.explorer-quick-search-input'),
        quickSearchClearBtn: root.querySelector('.explorer-quick-search-clear'),
        viewModeBtns: root.querySelectorAll('.view-mode-btn'),
        // Inspector Drawer
        inspectorToggleBtn: root.querySelector('.explorer-inspector-toggle-btn'),
        inspectorDrawer: root.querySelector('.explorer-inspector-drawer'),
        inspectorCloseBtn: root.querySelector('.inspector-close-btn'),
        inspectorEmptyState: root.querySelector('.inspector-empty-state'),
        inspectorDetails: root.querySelector('.inspector-details'),
        inspectorPreviewImg: root.querySelector('.inspector-preview-img'),
        inspectorPreviewIcon: root.querySelector('.inspector-preview-icon'),
        inspectorFilenameBadge: root.querySelector('.inspector-filename-badge'),
        inspectorOpenBtn: root.querySelector('.inspector-open-btn'),
        inspectorQuicklookBtn: root.querySelector('.inspector-quicklook-btn'),
        inspectorMetaName: root.querySelector('.inspector-meta-name'),
        inspectorMetaSize: root.querySelector('.inspector-meta-size'),
        inspectorMetaDim: root.querySelector('.inspector-meta-dim'),
        inspectorMetaDate: root.querySelector('.inspector-meta-date'),
        inspectorMetaComment: root.querySelector('.inspector-meta-comment'),
        inspectorMetaCamera: root.querySelector('.inspector-meta-camera'),
        inspectorMetaGps: root.querySelector('.inspector-meta-gps')
      };
    }

    loadSavedPreferences() {
      try {
        const savedView = localStorage.getItem('gallery_view_mode');
        if (savedView) this.state.viewMode = savedView;
        const savedFavs = JSON.parse(localStorage.getItem('sg_favorites') || '[]');
        this.state.favorites = Array.isArray(savedFavs) ? savedFavs : [];
      } catch (e) { }
    }

    t(key, params = {}) {
      if (window.desktop && typeof window.desktop.t === 'function') {
        return window.desktop.t(key, params);
      }
      if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
        return window.sys.i18n.t(key, params);
      }
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, params);
      }
      return key;
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    showLoading(show) {
      if (this.el.loadingState) {
        this.el.loadingState.style.display = show ? 'flex' : 'none';
      }
    }

    showToast(msg, type = 'info') {
      if (window.desktop && typeof window.desktop.showToast === 'function') {
        window.desktop.showToast(msg, type);
      }
    }

    // -------------------------------------------------------------
    // NAVIGATION & DIRECTORY LOADING
    // -------------------------------------------------------------
    navigateTo(dirPath) {
      const cleanPath = (dirPath === '.' || !dirPath) ? '' : String(dirPath).trim();
      this.loadDirectory(cleanPath);
    }

    async loadDirectory(dirPath) {
      const cleanPath = (dirPath === '.' || !dirPath) ? '' : String(dirPath).trim();
      this.showLoading(true);
      this.state.currentPath = cleanPath;

      try {
        const json = await window.sys.api.get('get_gallery', { dir: cleanPath, _t: Date.now() });

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
        if (this.el.searchResultsBanner) this.el.searchResultsBanner.style.display = 'none';

        const normalizeThumbUrl = (url) => {
          if (!url) return url;
          if (typeof url === 'string' && url.startsWith('thumb.php?')) {
            return 'system/endpoints/' + url;
          }
          return url;
        };

        this.state.directories = (json.directories || []).map(d => ({
          ...d,
          cover: normalizeThumbUrl(d.cover)
        }));
        this.state.files = (json.files || []).map(f => ({
          ...f,
          thumb_url: normalizeThumbUrl(f.thumb_url),
          file_url: normalizeThumbUrl(f.file_url)
        }));
        this.state.overrides = json.overrides || {};
        if (this.state.overrides.background) {
          this.state.overrides.background = normalizeThumbUrl(this.state.overrides.background);
        }

        this.state.isAdmin = !!json.is_admin;
        this.state.adminEnabled = !!json.admin_enabled;
        this.state.userRights = json.user_rights || {};
        if (json.csrf_token) {
          this.state.csrfToken = json.csrf_token;
          window.CSRF_TOKEN = json.csrf_token;
          window.SG_CSRF_TOKEN = json.csrf_token;
        }
        if (json.available_archives) this.state.availableArchives = json.available_archives;

        // Apply folder theme / background overrides directly to explorer instance window
        this.applyFolderOverrides(this.state.overrides);

        // Restore per-folder persistent sort
        const savedSort = this.getFolderSort(dirPath);
        if (savedSort && savedSort.sortBy) {
          this.state.sortBy = savedSort.sortBy;
          this.state.sortOrder = savedSort.sortOrder || 'asc';
        } else {
          this.state.sortBy = 'name';
          this.state.sortOrder = 'asc';
        }

        this.manager.updateMenuBarForActiveInstance();

        this.renderBreadcrumbs(json.breadcrumbs || []);
        this.renderFolders(json.directories || []);

        // Reset category filter on navigation
        this.state.filterCategory = 'all';
        this.updateFilterPillsUI();
        this.applyFilterAndRender();

      } catch (err) {
        console.error('[Explorer] Error fetching directory:', err);
      } finally {
        this.showLoading(false);
      }
    }

    applyFolderOverrides(overrides) {
      if (!this.containerEl) return;
      if (overrides && overrides.background) {
        const bg = overrides.background;
        if (bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl') || bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) {
          this.containerEl.style.backgroundColor = bg;
          this.containerEl.style.backgroundImage = 'none';
        } else {
          const url = bg.startsWith('url(') ? bg : `url("${bg}")`;
          this.containerEl.style.backgroundImage = url;
          this.containerEl.style.backgroundSize = 'cover';
          this.containerEl.style.backgroundPosition = 'center';
          this.containerEl.style.backgroundRepeat = 'no-repeat';
        }
      } else {
        this.containerEl.style.backgroundImage = '';
        this.containerEl.style.backgroundColor = '';
        this.containerEl.style.backgroundSize = '';
        this.containerEl.style.backgroundPosition = '';
        this.containerEl.style.backgroundRepeat = '';
      }

      if (this.el.folderDescBanner) {
        if (overrides && overrides.description) {
          this.el.folderDescBanner.innerHTML = overrides.description;
          this.el.folderDescBanner.style.display = 'block';
        } else {
          this.el.folderDescBanner.style.display = 'none';
        }
      }

      // Handle Autorun / VLog Presentation Banner
      if (this.el.autorunBanner) {
        if (overrides && overrides.has_autorun && overrides.autorun) {
          const ar = overrides.autorun;
          if (this.el.autorunTitle) {
            this.el.autorunTitle.textContent = ar.title || this.t('autorun.badge');
          }
          if (this.el.autorunDescription) {
            this.el.autorunDescription.textContent = ar.description || '';
          }
          if (this.el.autorunPlayBtn) {
            this.el.autorunPlayBtn.onclick = (e) => {
              e.preventDefault();
              this.launchAutorun(ar);
            };
          }
          if (this.el.autorunEditBtn) {
            const canEdit = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_edit);
            this.el.autorunEditBtn.style.display = canEdit ? 'inline-flex' : 'none';
            this.el.autorunEditBtn.onclick = (e) => {
              e.preventDefault();
              this.openAutorunEditorModal(ar);
            };
          }
          this.el.autorunBanner.style.display = 'block';
        } else {
          this.el.autorunBanner.style.display = 'none';
        }
      }

      if (this.el.folderSettingsBtn) {
        this.el.folderSettingsBtn.style.display = this.state.isAdmin ? 'inline-flex' : 'none';
      }
    }

    renderBreadcrumbs(crumbs) {
      this.state.currentBreadcrumbs = crumbs;
      const nav = this.el.breadcrumbs;
      if (!nav) return;

      const rootLabel = this.t('nav.root');

      nav.innerHTML = crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        const isRoot = idx === 0 || crumb.path === '' || crumb.path === '.';
        const contentHtml = isRoot
          ? `<span class="crumb-root-icon" aria-hidden="true">💾</span> <span class="crumb-root-name" data-i18n="nav.root">${this.escapeHtml(rootLabel)}</span>`
          : `<span>${this.escapeHtml(crumb.name)}</span>`;
        const titleAttr = isRoot ? `data-i18n-title="nav.root" title="${this.escapeHtml(rootLabel)}"` : `title="${this.escapeHtml(crumb.name)}"`;

        if (isLast) {
          return `<span class="crumb-item crumb-active ${isRoot ? 'crumb-root-item' : ''}" ${titleAttr}>${contentHtml}</span>`;
        }
        const targetPath = (crumb.path === undefined || crumb.path === null || crumb.path === '.') ? '' : crumb.path;
        return `
          <button type="button" class="crumb-item crumb-btn ${isRoot ? 'crumb-root-item' : ''}" data-path="${targetPath}" ${titleAttr}>
            ${contentHtml}
          </button>
          <span class="crumb-separator">/</span>
        `;
      }).join('');

      nav.onclick = (e) => {
        const btn = e.target.closest('.crumb-item');
        if (!btn || btn.classList.contains('crumb-active')) return;
        e.preventDefault();
        e.stopPropagation();
        const destPath = btn.getAttribute('data-path') !== null ? btn.getAttribute('data-path') : '';
        this.navigateTo(destPath);
      };

      nav.querySelectorAll('.crumb-btn').forEach(btn => {
        const destPath = btn.getAttribute('data-path') !== null ? btn.getAttribute('data-path') : '';

        // Direct Click Navigation
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.navigateTo(destPath);
        };

        // Breadcrumb as Drop Target (Cross-window & local)
        btn.ondragover = (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        };
        btn.ondragenter = (e) => {
          e.preventDefault();
          btn.classList.add('drag-over');
        };
        btn.ondragleave = (e) => {
          if (!btn.contains(e.relatedTarget)) btn.classList.remove('drag-over');
        };
        btn.ondrop = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          btn.classList.remove('drag-over');
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0 && !window.SG_DRAGGING_PATHS) {
            this.handleUploadFiles(e.dataTransfer.files, destPath);
            return;
          }
          let paths = this.state.draggingPaths || window.SG_DRAGGING_PATHS;
          if (!paths) {
            try {
              const text = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
              if (text) paths = JSON.parse(text);
            } catch (err) { }
          }
          if (paths) {
            const arr = Array.isArray(paths) ? paths : [paths];
            if (arr.length > 0) {
              await this.moveItems(arr, destPath);
            }
          }
        };
      });

      // Update Explorer Window Title
      if (window.WindowManager) {
        const lastCrumb = (crumbs && crumbs.length) ? crumbs[crumbs.length - 1] : null;
        const isRootLast = (!crumbs || crumbs.length <= 1);
        const folderName = isRootLast ? rootLabel : (lastCrumb ? lastCrumb.name : rootLabel);
        const fullTitle = isRootLast ? `${this.state.galleryTitle} : ${rootLabel}` : `${this.state.galleryTitle} : ${folderName}`;
        window.WindowManager.setTitle(this.winId, fullTitle);
      }
    }

    renderFolders(folders) {
      if (!this.el.folderSection || !this.el.foldersGrid) return;

      if (!folders || folders.length === 0) {
        this.el.folderSection.style.display = 'none';
        this.el.foldersGrid.innerHTML = '';
        return;
      }

      const canMove = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_move);

      this.el.folderSection.style.display = 'block';
      this.el.foldersGrid.innerHTML = folders.map(folder => {
        const badge = folder.is_protected ? '<span class="folder-badge lock-badge">🔒</span>' : '';
        const handleClass = canMove ? 'drag-handle' : '';
        const deleteBtnHtml = this.state.isAdmin ? `<button class="delete-item-btn" data-path="${folder.path}" data-name="${this.escapeHtml(folder.name)}" data-type="folder" title="${this.escapeHtml(this.t('folder.delete_title'))}">🗑️</button>` : '';
        const settingsBtnHtml = this.state.isAdmin ? `<button type="button" class="folder-settings-btn" data-path="${folder.path}" data-name="${this.escapeHtml(folder.name)}" title="${this.escapeHtml(this.t('nav.folder_settings'))}">⚙️</button>` : '';

        return `
          <div class="folder-card ${handleClass} ${folder.is_protected && !folder.is_unlocked && !this.state.isAdmin ? 'protected-card' : ''}" data-path="${folder.path}" data-protected="${folder.is_protected ? '1' : '0'}" data-unlocked="${folder.is_unlocked ? '1' : '0'}" draggable="true" role="button" tabindex="0">
            ${deleteBtnHtml}
            ${settingsBtnHtml}
            ${badge}
            <div class="folder-icon-wrapper">
              ${folder.is_protected && !folder.is_unlocked && !this.state.isAdmin ? '<div class="folder-lock-icon">🔒</div>' : (folder.cover ? `<img src="${folder.cover}" alt="${this.escapeHtml(folder.name)}" class="folder-cover-img" loading="lazy" draggable="false" />` : '📁')}
            </div>
            <div class="folder-name">${this.escapeHtml(folder.name)}</div>
            <div class="folder-meta">
              <span>${this.escapeHtml(this.t('folder.items_count', { count: folder.item_count }))}</span>
            </div>
            ${folder.comment ? `<div class="folder-comment">💬 ${this.escapeHtml(folder.comment)}</div>` : ''}
          </div>
        `;
      }).join('');

      this.el.foldersGrid.querySelectorAll('.folder-card').forEach(card => {
        const folderPath = card.dataset.path;
        const folderObj = (folders && folders.find(fd => fd.path === folderPath)) || {};
        const folderName = folderObj.name || card.querySelector('.folder-name')?.textContent || folderPath.split('/').pop();
        const folderCover = folderObj.cover || folderObj.cover_url || '';

        card.onclick = (e) => {
          if (e.target.closest('.delete-item-btn, .folder-settings-btn')) return;
          e.preventDefault();
          const isProtected = card.dataset.protected === '1';
          const isUnlocked = card.dataset.unlocked === '1';
          if (isProtected && !isUnlocked && !this.state.isAdmin) {
            this.openFolderUnlockModal(folderPath);
          } else {
            this.navigateTo(folderPath);
          }
        };

        const delBtn = card.querySelector('.delete-item-btn');
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openDeleteConfirmModal(delBtn.dataset.path, delBtn.dataset.name, 'folder');
          };
        }

        const settingsBtn = card.querySelector('.folder-settings-btn');
        if (settingsBtn) {
          settingsBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openFolderSettingsModal(folderPath);
          };
        }

        // Folder as Drag Source
        card.ondragstart = (e) => {
          this.state.draggingPaths = [folderPath];
          this.state.draggingItemPath = folderPath;
          window.SG_DRAGGING_PATHS = [folderPath];
          window.SG_DRAG_SOURCE_INSTANCE = this.id;

          const folderData = {
            type: 'folder',
            path: folderPath,
            name: folderName,
            icon: folderObj.icon || '📁',
            cover_url: folderCover
          };
          window.SG_DRAGGING_ITEM_DATA = folderData;

          e.dataTransfer.setData('text/plain', JSON.stringify([folderPath]));
          e.dataTransfer.setData('application/json', JSON.stringify([folderPath]));
          e.dataTransfer.setData('application/sg-item', JSON.stringify(folderData));
          e.dataTransfer.effectAllowed = 'copyMove';
          card.classList.add('is-dragging');
        };

        card.ondragend = () => {
          this.state.draggingPaths = null;
          this.state.draggingItemPath = null;
          setTimeout(() => {
            window.SG_DRAGGING_PATHS = null;
            window.SG_DRAG_SOURCE_INSTANCE = null;
            window.SG_DRAGGING_ITEM_DATA = null;
          }, 300);
          document.querySelectorAll('.is-dragging').forEach(c => c.classList.remove('is-dragging'));
          document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
        };

        // Folder as Drop Target (Cross-window & local)
        card.ondragover = (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        };
        card.ondragenter = (e) => {
          e.preventDefault();
          card.classList.add('drag-over');
        };
        card.ondragleave = (e) => {
          if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
        };
        card.ondrop = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          card.classList.remove('drag-over');

          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0 && !window.SG_DRAGGING_PATHS) {
            this.handleUploadFiles(e.dataTransfer.files, folderPath);
            return;
          }

          let pathsToMove = this.state.draggingPaths || window.SG_DRAGGING_PATHS;
          if (!pathsToMove) {
            try {
              const data = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
              if (data) pathsToMove = JSON.parse(data);
            } catch (err) { }
          }

          if (pathsToMove) {
            const arr = Array.isArray(pathsToMove) ? pathsToMove : [pathsToMove];
            if (arr.length > 0) {
              await this.moveItems(arr, folderPath);
            }
          }
        };
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

    renderMedia() {
      if (!this.el.mediaGrid) return;
      const list = this.state.filteredFiles;

      if (list.length === 0) {
        if (this.state.showFavoritesOnly) {
          this.el.emptyState.style.display = 'block';
          this.el.mediaGrid.style.display = 'none';
          this.el.emptyState.innerHTML = `
            <div class="empty-state-icon">🤍</div>
            <h3>${this.escapeHtml(this.t('stats.no_favorites_title'))}</h3>
            <p>${this.escapeHtml(this.t('stats.no_favorites_desc'))}</p>
          `;
          return;
        }
        if (this.state.filterCategory !== 'all' && this.state.files.length > 0) {
          this.el.emptyState.style.display = 'block';
          this.el.mediaGrid.style.display = 'none';
          this.el.emptyState.innerHTML = `
            <div class="empty-state-icon">🔍</div>
            <h3>${this.escapeHtml(this.t('view.no_filter_results'))}</h3>
            <p>${this.escapeHtml(this.t('view.no_filter_results_desc'))}</p>
            <button type="button" class="pill-btn active" style="margin-top: 1rem;">
              ${this.escapeHtml(this.t('view.filter_all'))}
            </button>
          `;
          const btn = this.el.emptyState.querySelector('button');
          if (btn) btn.onclick = () => this.setFilterCategory('all');
          return;
        }
        if (this.state.directories.length === 0) {
          this.el.emptyState.style.display = 'block';
          this.el.mediaGrid.style.display = 'none';
          this.el.emptyState.innerHTML = `
            <div class="empty-state-icon">📂</div>
            <h3>${this.escapeHtml(this.t('stats.empty'))}</h3>
            <p>${this.escapeHtml(this.t('stats.drag_drop_hint'))}</p>
          `;
          return;
        }
        this.el.emptyState.style.display = 'none';
        this.el.mediaGrid.style.display = 'none';
        this.el.mediaGrid.innerHTML = '';
        return;
      }

      this.el.emptyState.style.display = 'none';
      this.el.mediaGrid.style.display = '';

      const smartLocationsMap = new Map();
      if (this.isSmartGpsEnabled) {
        const smartLocations = this.computeSmartGpsLocations(list);
        smartLocations.forEach(item => smartLocationsMap.set(item.file.path, item));
      }

      const canMove = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_move);
      const context = {
        t: this.t.bind(this),
        escapeHtml: this.escapeHtml.bind(this),
        isAdmin: this.state.isAdmin,
        userRights: this.state.userRights,
        favorites: this.state.favorites,
        smartLocationsMap: smartLocationsMap,
        isDraggable: canMove ? 'true' : 'false',
        handleClass: canMove ? 'drag-handle' : ''
      };

      const viewPlugin = (window.GalleryViewRegistry && window.GalleryViewRegistry.get(this.state.viewMode))
        || (window.GalleryViewRegistry && window.GalleryViewRegistry.get('polaroid'))
        || (window.GalleryViewRegistry && window.GalleryViewRegistry.getAll()[0]);

      if (viewPlugin) {
        this.el.mediaGrid.className = `media-grid ${viewPlugin.containerClass || 'polaroid-grid'}`;
        if (typeof viewPlugin.renderContainer === 'function') {
          this.el.mediaGrid.innerHTML = viewPlugin.renderContainer(list, context);
        } else if (typeof viewPlugin.renderItem === 'function') {
          this.el.mediaGrid.innerHTML = list.map((file, idx) => viewPlugin.renderItem(file, idx, context)).join('');
        }
      }

      this.bindMediaCardEvents();
    }

    setViewMode(mode) {
      if (!mode) return;
      this.state.viewMode = mode;
      try {
        localStorage.setItem('sg_explorer_view_mode', mode);
      } catch (e) { }

      this.renderMedia();

      if (window.explorerApp && typeof window.explorerApp.updateViewModeUI === 'function') {
        window.explorerApp.updateViewModeUI();
      }
    }

    bindMediaCardEvents() {
      if (!this.el.mediaGrid) return;
      const canMove = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_move);

      this.el.mediaGrid.querySelectorAll('.gps-badge[data-path]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.openMapModal(btn.dataset.path);
        };
      });

      this.el.mediaGrid.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.openDeleteConfirmModal(btn.dataset.path, btn.dataset.name, 'file');
        };
      });

      this.el.mediaGrid.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.toggleFavorite(btn.dataset.path);
        };
      });

      this.el.mediaGrid.querySelectorAll('.edit-media-comment-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.openMediaCommentModal(btn.dataset.filename, btn.dataset.comment);
        };
      });

      this.el.mediaGrid.querySelectorAll('[data-index]').forEach(card => {
        const index = parseInt(card.dataset.index, 10);
        const file = this.state.filteredFiles[index];
        if (!file) return;

        if (this.state.selectedPaths.has(file.path)) {
          card.classList.add('selected');
        }

        // Drag & Drop Source (Cross-window)
        if (canMove) {
          card.ondragstart = (e) => {
            let pathsToMove = [];
            if (this.state.selectedPaths.has(file.path)) {
              pathsToMove = Array.from(this.state.selectedPaths);
            } else {
              pathsToMove = [file.path];
              this.state.selectedPaths.clear();
              this.state.selectedPaths.add(file.path);
              this.updateSelectionUI();
            }

            this.state.draggingPaths = pathsToMove;
            this.state.draggingItemPath = file.path;
            window.SG_DRAGGING_PATHS = pathsToMove;
            window.SG_DRAG_SOURCE_INSTANCE = this.id;

            const fileIcon = window.IconHelper ? window.IconHelper.getFileIcon(file) : '📄';
            const fileUrl = file.file_url || (`system/endpoints/thumb.php?file=${encodeURIComponent(file.path)}&raw=1`);
            const thumbUrl = file.thumb_url || (`system/endpoints/thumb.php?file=${encodeURIComponent(file.path)}`);
            const fileData = {
              type: 'file',
              path: file.path,
              name: file.name,
              category: file.category || '',
              extension: file.extension || (file.name.split('.').pop() || '').toLowerCase(),
              thumb_url: thumbUrl,
              file_url: fileUrl,
              size_formatted: file.size_formatted || '',
              icon: fileIcon
            };
            window.SG_DRAGGING_ITEM_DATA = fileData;

            e.dataTransfer.setData('text/plain', JSON.stringify(pathsToMove));
            e.dataTransfer.setData('application/json', JSON.stringify(pathsToMove));
            e.dataTransfer.setData('application/sg-item', JSON.stringify(fileData));
            e.dataTransfer.effectAllowed = 'copyMove';

            card.classList.add('is-dragging');
            document.querySelectorAll('.media-card.selected, .polaroid-card.selected, .grid-card.selected, .list-row.selected').forEach(c => {
              c.classList.add('is-dragging');
            });
          };

          card.ondragend = () => {
            this.state.draggingPaths = null;
            this.state.draggingItemPath = null;
            setTimeout(() => {
              window.SG_DRAGGING_PATHS = null;
              window.SG_DRAG_SOURCE_INSTANCE = null;
              window.SG_DRAGGING_ITEM_DATA = null;
            }, 300);
            document.querySelectorAll('.is-dragging').forEach(c => c.classList.remove('is-dragging'));
            document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
          };
        }

        card.onclick = (e) => {
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
              this.openMedia(file, index);
            }
            return;
          }

          this.openMedia(file, index);
        };
      });
    }

    async moveItems(sourcePaths, targetDir) {
      const paths = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
      const validPaths = paths.filter(p => typeof p === 'string' && p.trim().length > 0);
      if (validPaths.length === 0) return;
      if (typeof targetDir !== 'string') return;

      const canMove = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_move);
      if (!canMove) {
        this.showToast('⚠️ Droits de déplacement manquants', 'error');
        return;
      }

      const cleanTarget = (targetDir === '.' || !targetDir) ? '' : String(targetDir).replace(/\/+$/, '').trim();

      // Don't attempt to move items into their current folder
      const itemsToMove = validPaths.filter(p => {
        const cleanP = String(p).replace(/\/+$/, '').trim();
        const parts = cleanP.split('/');
        parts.pop();
        const parentDir = parts.join('/');
        return parentDir !== cleanTarget;
      });

      if (itemsToMove.length === 0) {
        return;
      }

      try {
        let success = false;
        let errMsg = null;
        let movedCount = itemsToMove.length;

        // If single item, send as single string for universal backend compatibility
        if (itemsToMove.length === 1) {
          const json = await window.sys.api.fs.moveItem(itemsToMove[0], cleanTarget);
          if (json && json.success) {
            success = true;
          } else {
            errMsg = json ? json.error : null;
          }
        } else {
          // Try batch move first
          const json = await window.sys.api.fs.moveItem(itemsToMove, cleanTarget);
          if (json && json.success) {
            success = true;
            movedCount = json.moved_count || itemsToMove.length;
          } else {
            // Fallback: move item-by-item
            let count = 0;
            for (const item of itemsToMove) {
              try {
                const res = await window.sys.api.fs.moveItem(item, cleanTarget);
                if (res && res.success) count++;
                else if (res && res.error) errMsg = res.error;
              } catch (e) {
                errMsg = e.message;
              }
            }
            if (count > 0) {
              success = true;
              movedCount = count;
            }
          }
        }

        if (success) {
          this.clearSelection();
          const targetName = cleanTarget ? cleanTarget.split('/').pop() : this.t('nav.root');
          this.showToast(this.t('clipboard.items_pasted', { count: movedCount }), 'success');

          // Notify all open instances (source, destination and others) in real time
          if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('fs:changed', { action: 'move', sourcePaths: itemsToMove, targetDir: cleanTarget });
          } else {
            if (this.manager && this.manager.instances) {
              this.manager.instances.forEach(inst => {
                inst.loadDirectory(inst.state.currentPath);
              });
            }
          }
        } else {
          this.showToast('⚠️ ' + (errMsg || this.t('api.err_save_failed')), 'error');
        }
      } catch (err) {
        this.showToast(`⚠️ Erreur réseau : ${err.message}`, 'error');
      }
    }

    openMedia(file, index) {
      if (!file) return;
      if (window.MediaViewerRegistry) {
        window.MediaViewerRegistry.open(file, { index }, this);
      }
    }

    // -------------------------------------------------------------
    // SORT & FAVORITES ENGINE
    // -------------------------------------------------------------
    toggleSortOrder() {
      this.state.sortOrder = (this.state.sortOrder === 'asc') ? 'desc' : 'asc';
      this.saveFolderSort(this.state.currentPath, this.state.sortBy, this.state.sortOrder);
      this.manager.updateMenuBarForActiveInstance();
      this.applyFilterAndRender();
    }

    saveFolderSort(dirPath, sortBy, sortOrder) {
      try {
        const sorts = JSON.parse(localStorage.getItem('sg_folder_sorts') || '{}');
        sorts[dirPath || '__root__'] = { sortBy, sortOrder };
        localStorage.setItem('sg_folder_sorts', JSON.stringify(sorts));
      } catch (e) { }
    }

    getFolderSort(dirPath) {
      try {
        const sorts = JSON.parse(localStorage.getItem('sg_folder_sorts') || '{}');
        return sorts[dirPath || '__root__'] || null;
      } catch (e) {
        return null;
      }
    }

    toggleFavorite(filePath) {
      const idx = this.state.favorites.indexOf(filePath);
      if (idx !== -1) {
        this.state.favorites.splice(idx, 1);
        this.showToast(this.t('lightbox.favorite_removed'), 'info');
      } else {
        this.state.favorites.push(filePath);
        this.showToast(this.t('lightbox.favorite_added'), 'success');
      }
      try {
        localStorage.setItem('sg_favorites', JSON.stringify(this.state.favorites));
      } catch (e) { }

      this.manager.updateMenuBarForActiveInstance();
      this.applyFilterAndRender();
    }

    toggleFavoritesFilter() {
      this.state.showFavoritesOnly = !this.state.showFavoritesOnly;
      this.manager.updateMenuBarForActiveInstance();
      this.applyFilterAndRender();
    }

    // -------------------------------------------------------------
    // FILTER PILLS & STATS
    // -------------------------------------------------------------
    setFilterCategory(category) {
      this.state.filterCategory = category || 'all';
      this.updateFilterPillsUI();
      this.applyFilterAndRender();
    }

    updateFilterPillsUI() {
      if (!this.el.filterPills) return;
      this.el.filterPills.querySelectorAll('.pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === this.state.filterCategory);
      });
    }

    updateStats() {
      if (this.el.galleryStats) {
        this.el.galleryStats.textContent = this.t('stats.summary', {
          folders: this.state.directories.length,
          files: this.state.filteredFiles.length
        });
      }
      this.updateFolderMapButton();
    }

    // -------------------------------------------------------------
    // SELECTION & MARQUEE
    // -------------------------------------------------------------
    clearSelection() {
      this.state.selectedPaths.clear();
      this.state.lastSelectedIndex = null;
      this.updateSelectionUI();
    }

    selectAll() {
      this.state.filteredFiles.forEach(f => this.state.selectedPaths.add(f.path));
      this.updateSelectionUI();
    }

    updateSelectionUI() {
      const count = this.state.selectedPaths.size;
      if (this.el.selectionToolbar) {
        this.el.selectionToolbar.style.display = count > 0 ? 'flex' : 'none';
      }
      if (this.el.selectionToolbarCount) {
        this.el.selectionToolbarCount.dataset.i18n = 'selection.selected_count';
        this.el.selectionToolbarCount.dataset.i18nCount = count;
        this.el.selectionToolbarCount.textContent = this.t('selection.selected_count', { count });
      }
      if (this.el.mediaGrid) {
        this.el.mediaGrid.querySelectorAll('[data-index]').forEach(card => {
          const idx = parseInt(card.dataset.index, 10);
          const file = this.state.filteredFiles[idx];
          if (file) {
            card.classList.toggle('selected', this.state.selectedPaths.has(file.path));
          }
        });
      }
      this.updateInspectorUI();
    }

    initMarqueeSelection() {
      if (this.el.selectionSelectAllBtn) {
        this.el.selectionSelectAllBtn.onclick = () => this.selectAll();
      }
      if (this.el.selectionClearBtn) {
        this.el.selectionClearBtn.onclick = () => this.clearSelection();
      }
      if (this.el.selectionInfoBtn) {
        this.el.selectionInfoBtn.onclick = () => {
          if (this.state.selectedPaths.size > 0) {
            const firstPath = Array.from(this.state.selectedPaths)[0];
            const file = this.state.filteredFiles.find(f => f.path === firstPath);
            if (file && window.sys && window.sys.showMetadata) {
              window.sys.showMetadata(file);
            }
          }
        };
      }

      let isSelecting = false;
      let startX = 0, startY = 0;
      let marqueeEl = null;
      let initialSelectedPaths = new Set();

      this.containerEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button, input, a, select, .explorer-header-bar, .admin-modal, .selection-toolbar, .folder-card, .polaroid-card, .grid-card, .list-table-row, .mosaic-card, [data-index], .media-card, .sidebar, .menubar')) {
          return;
        }
        if (!this.el.mediaGrid) return;

        const hasModifier = e.shiftKey || e.ctrlKey || e.metaKey;
        if (!hasModifier) {
          this.clearSelection();
          initialSelectedPaths = new Set();
        } else {
          initialSelectedPaths = new Set(this.state.selectedPaths);
        }

        isSelecting = true;
        startX = e.pageX;
        startY = e.pageY;

        if (!marqueeEl) {
          marqueeEl = document.createElement('div');
          marqueeEl.className = 'selection-marquee';
          marqueeEl.style.display = 'none';
          document.body.appendChild(marqueeEl);
        }
      });

      document.addEventListener('dragstart', () => {
        isSelecting = false;
        if (marqueeEl) marqueeEl.style.display = 'none';
      });

      document.addEventListener('mousemove', (e) => {
        if (!isSelecting || !marqueeEl) return;

        const currentX = e.pageX;
        const currentY = e.pageY;
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        if (width > 6 || height > 6) {
          marqueeEl.style.display = 'block';
          marqueeEl.style.left = `${Math.min(startX, currentX)}px`;
          marqueeEl.style.top = `${Math.min(startY, currentY)}px`;
          marqueeEl.style.width = `${width}px`;
          marqueeEl.style.height = `${height}px`;

          const marqueeRect = marqueeEl.getBoundingClientRect();
          const currentSelection = new Set(initialSelectedPaths);

          this.el.mediaGrid.querySelectorAll('[data-index]').forEach(card => {
            const cardRect = card.getBoundingClientRect();
            const intersects = !(
              marqueeRect.right < cardRect.left ||
              marqueeRect.left > cardRect.right ||
              marqueeRect.bottom < cardRect.top ||
              marqueeRect.top > cardRect.bottom
            );

            const idx = parseInt(card.dataset.index, 10);
            const file = this.state.filteredFiles[idx];
            if (file && intersects) {
              currentSelection.add(file.path);
            }
          });

          this.state.selectedPaths = currentSelection;
          this.updateSelectionUI();
        }
      });

      document.addEventListener('mouseup', () => {
        if (isSelecting) {
          isSelecting = false;
          if (marqueeEl) marqueeEl.style.display = 'none';
        }
      });
    }

    // -------------------------------------------------------------
    // GPS MAP & SMART TIMELINE GPS
    // -------------------------------------------------------------
    computeSmartGpsLocations(files) {
      if (!files || files.length === 0) return [];
      if (window.sys && typeof window.sys.computeSmartGpsLocations === 'function') {
        return window.sys.computeSmartGpsLocations(files, this.isSmartGpsEnabled);
      }
      const result = [];
      files.forEach(f => {
        if (f.exif && f.exif.gps && typeof f.exif.gps.lat === 'number' && typeof f.exif.gps.lng === 'number') {
          result.push({
            file: f,
            lat: f.exif.gps.lat,
            lng: f.exif.gps.lng,
            gps_source: 'native',
            time: (f.effective_mtime || f.mtime) * 1000
          });
        }
      });
      return result;
    }

    updateFolderMapButton() {
      const mapped = this.computeSmartGpsLocations(this.state.filteredFiles);
      const count = mapped.length;

      if (this.el.folderMapBtn) {
        if (count === 0) {
          this.el.folderMapBtn.style.display = 'none';
        } else {
          this.el.folderMapBtn.innerHTML = `🗺️ ${this.escapeHtml(this.t('nav.map'))} (${count})`;
          this.el.folderMapBtn.style.display = 'inline-flex';
        }
      }

      const menuMapBtn = document.getElementById('menuFolderMapBtn');
      if (menuMapBtn && this.manager.getActiveInstance() === this) {
        menuMapBtn.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    }

    openMapModal(focusPath = null) {
      if (window.sys && typeof window.sys.openMaps === 'function') {
        window.sys.openMaps({
          files: this.state.filteredFiles,
          currentPath: this.state.currentPath,
          focusPath: focusPath,
          singleItem: !!focusPath
        });
        return;
      }
      if (!this.el.mapModal) return;
      this.el.mapModal.style.display = 'flex';
      this.initLeafletMap(focusPath);
    }

    closeMapModal() {
      if (this.el.mapModal) this.el.mapModal.style.display = 'none';
    }

    initLeafletMap(focusPath = null) {
      if (!window.L || !this.el.galleryLeafletMap) return;

      const locations = this.computeSmartGpsLocations(this.state.filteredFiles);
      if (this.el.mapModalCountBadge) {
        this.el.mapModalCountBadge.textContent = `${locations.length} photos géolocalisées`;
      }

      if (!this.leafletMap) {
        this.leafletMap = window.L.map(this.el.galleryLeafletMap, { zoomControl: true });
        this.leafletTileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(this.leafletMap);
        this.leafletMarkersLayer = (window.L.markerClusterGroup ? window.L.markerClusterGroup() : window.L.layerGroup()).addTo(this.leafletMap);
      } else {
        this.leafletMarkersLayer.clearLayers();
      }

      if (locations.length === 0) return;

      const bounds = [];
      locations.forEach(item => {
        const marker = window.L.marker([item.lat, item.lng]);
        marker.bindPopup(`
          <div style="text-align:center;font-size:0.85rem;">
            <img src="${item.file.thumb_url}" style="width:120px;height:80px;object-fit:cover;border-radius:4px;margin-bottom:4px;" />
            <div style="font-weight:600;">${this.escapeHtml(item.file.name)}</div>
          </div>
        `);
        this.leafletMarkersLayer.addLayer(marker);
        bounds.push([item.lat, item.lng]);
      });

      if (bounds.length > 0) {
        this.leafletMap.fitBounds(bounds, { padding: [40, 40] });
      }

      setTimeout(() => { if (this.leafletMap) this.leafletMap.invalidateSize(); }, 300);
    }

    // -------------------------------------------------------------
    // ADVANCED SEARCH MODAL
    // -------------------------------------------------------------
    openSearchModal() {
      if (!this.el.searchModal) return;
      this.el.searchModal.style.display = 'flex';
      this.el.searchModal.classList.add('open');
    }

    closeSearchModal() {
      if (!this.el.searchModal) return;
      this.el.searchModal.style.display = 'none';
      this.el.searchModal.classList.remove('open');
    }

    exitSearch() {
      this.state.searchQuery = '';
      this.state.isSearchActive = false;
      const searchInput = document.getElementById('searchInput');
      const searchClearBtn = document.getElementById('searchClearBtn');
      if (searchInput) searchInput.value = '';
      if (searchClearBtn) searchClearBtn.style.display = 'none';
      if (this.el.searchResultsBanner) this.el.searchResultsBanner.style.display = 'none';
      this.loadDirectory(this.state.currentPath);
    }

    // -------------------------------------------------------------
    // ADMIN EXPLORER MODALS
    // -------------------------------------------------------------
    openCreateFolderModal() {
      const canCreate = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_create_folder);
      if (!canCreate) return;

      if (window.sys && window.sys.dialog && typeof window.sys.dialog.prompt === 'function') {
        window.sys.dialog.prompt(
          this.t('folder.new_name_placeholder'),
          this.t('nav.create_folder'),
          ''
        ).then(async name => {
          if (name && name.trim()) {
            try {
              const json = await window.sys.api.fs.createFolder(this.state.currentPath, name.trim());
              if (json.success) {
                this.showToast(this.t('folder.create_success'), 'success');
                if (window.EventBus) {
                  window.EventBus.emit('fs:changed', { action: 'create_folder', dir: this.state.currentPath });
                } else {
                  await this.loadDirectory(this.state.currentPath);
                }
              } else {
                this.showToast('⚠️ ' + (json.error || this.t('api.err_save_failed')), 'error');
              }
            } catch (err) {
              this.showToast(`⚠️ Erreur: ${err.message}`, 'error');
            }
          }
        });
        return;
      }

      this.manager.activeModalInstance = this;
      const modal = this.el.createFolderModal || document.getElementById('createFolderModal');
      if (!modal) return;
      this.el.createFolderModal = modal;
      this.el.newFolderNameInput = this.el.newFolderNameInput || document.getElementById('createFolderNameInput') || document.getElementById('newFolderNameInput');
      this.el.createFolderError = this.el.createFolderError || document.getElementById('createFolderError');

      if (this.el.createFolderError) this.el.createFolderError.style.display = 'none';
      modal.style.display = 'flex';
      modal.classList.add('open');
      if (this.el.newFolderNameInput) {
        this.el.newFolderNameInput.value = '';
        setTimeout(() => this.el.newFolderNameInput.focus(), 50);
      }
    }

    closeCreateFolderModal() {
      const modal = this.el.createFolderModal || document.getElementById('createFolderModal');
      if (!modal) return;
      modal.style.display = 'none';
      modal.classList.remove('open');
    }

    async createFolder() {
      if (!this.el.newFolderNameInput) return;
      const name = this.el.newFolderNameInput.value.trim();
      if (!name) return;

      try {
        const json = await window.sys.api.fs.createFolder(this.state.currentPath, name);
        if (json.success) {
          this.closeCreateFolderModal();
          this.showToast(this.t('folder.create_success'), 'success');
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'create_folder', dir: this.state.currentPath });
          } else {
            await this.loadDirectory(this.state.currentPath);
          }
        } else {
          this.showToast('⚠️ ' + (json.error || 'Erreur lors de la création'), 'error');
        }
      } catch (err) {
        this.showToast(`⚠️ Erreur: ${err.message}`, 'error');
      }
    }

    openDeleteConfirmModal(path, name, type = 'file') {
      const message = (type === 'folder')
        ? this.t('delete_confirm.prompt_folder', { name })
        : this.t('delete_confirm.prompt_file', { name });
      const title = this.t('delete_confirm.title');

      if (window.sys && window.sys.dialog && typeof window.sys.dialog.confirm === 'function') {
        window.sys.dialog.confirm(
          message,
          title,
          true
        ).then(async confirmed => {
          if (confirmed) {
            this.pendingDeletePath = path;
            await this.confirmDeleteItem();
          }
        });
        return;
      }

      this.manager.activeModalInstance = this;
      this.pendingDeletePath = path;
      this.pendingDeleteType = type;
      if (!this.el.deleteConfirmModal) return;
      if (this.el.deleteConfirmMessage) {
        this.el.deleteConfirmMessage.innerHTML = this.escapeHtml(message);
      }
      if (this.el.deleteConfirmItemName) this.el.deleteConfirmItemName.textContent = name;
      if (this.el.deleteConfirmItemType) this.el.deleteConfirmItemType.textContent = (type === 'folder' ? 'dossier' : 'fichier');
      this.el.deleteConfirmModal.style.display = 'flex';
      this.el.deleteConfirmModal.classList.add('open');
    }

    closeDeleteConfirmModal() {
      if (!this.el.deleteConfirmModal) return;
      this.el.deleteConfirmModal.style.display = 'none';
      this.el.deleteConfirmModal.classList.remove('open');
      this.pendingDeletePath = null;
    }

    async confirmDeleteItem() {
      if (!this.pendingDeletePath) return;
      const path = this.pendingDeletePath;

      try {
        const json = await window.sys.api.fs.deleteItem(path);
        if (json.success) {
          this.closeDeleteConfirmModal();
          this.showToast(json.message || this.t('api.success_deleted'), 'success');
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'delete_item', target_path: path });
          } else {
            await this.loadDirectory(this.state.currentPath);
          }
        } else {
          this.showToast('⚠️ ' + (json.error || 'Erreur lors de la suppression'), 'error');
        }
      } catch (err) {
        this.showToast(`⚠️ Erreur: ${err.message}`, 'error');
      }
    }

    deleteSelection() {
      if (!this.state.selectedPaths || this.state.selectedPaths.size === 0) return;
      const canDelete = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_delete);
      if (!canDelete) {
        this.showToast('⚠️ Action non autorisée', 'error');
        return;
      }

      const selected = Array.from(this.state.selectedPaths);
      if (selected.length === 1) {
        const first = selected[0];
        const name = first.split('/').pop();
        const folders = this.state.directories || this.state.folders || [];
        const isFolder = folders.some(f => f.path === first);
        this.openDeleteConfirmModal(first, name, isFolder ? 'folder' : 'file');
      } else {
        if (window.sys && window.sys.dialog && typeof window.sys.dialog.confirm === 'function') {
          const message = this.t('delete_confirm.prompt_multiple', { count: selected.length });
          const title = this.t('delete_confirm.title');
          window.sys.dialog.confirm(
            message,
            title,
            true
          ).then(async confirmed => {
            if (confirmed) {
              let deletedCount = 0;
              for (const p of selected) {
                try {
                  const res = await window.sys.api.fs.deleteItem(p);
                  if (res && res.success) deletedCount++;
                } catch (err) {}
              }
              this.state.selectedPaths.clear();
              this.updateSelectionToolbar();
              this.showToast(`${deletedCount} élément(s) supprimé(s)`, 'success');
              if (window.EventBus) {
                window.EventBus.emit('fs:changed', { action: 'delete_item', dir: this.state.currentPath });
              } else {
                await this.loadDirectory(this.state.currentPath);
              }
            }
          });
        }
      }
    }

    openMediaCommentModal(filename, comment = '') {
      this.manager.activeModalInstance = this;
      if (!this.el.mediaCommentModal) return;
      this.pendingCommentFilename = filename;
      if (this.el.mediaCommentFilenameBadge) this.el.mediaCommentFilenameBadge.textContent = filename;
      if (this.el.mediaCommentInput) this.el.mediaCommentInput.value = comment;
      this.el.mediaCommentModal.style.display = 'block';
      this.el.mediaCommentModal.classList.add('open');
    }

    closeMediaCommentModal() {
      if (!this.el.mediaCommentModal) return;
      this.el.mediaCommentModal.style.display = 'none';
      this.el.mediaCommentModal.classList.remove('open');
      this.pendingCommentFilename = null;
    }

    async saveMediaComment() {
      if (!this.pendingCommentFilename || !this.el.mediaCommentInput) return;
      const comment = this.el.mediaCommentInput.value.trim();

      try {
        const json = await window.sys.api.fs.saveComment(this.state.currentPath, this.pendingCommentFilename, comment);
        if (json.success) {
          this.closeMediaCommentModal();
          this.showToast('Légende enregistrée', 'success');
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'save_comment', dir: this.state.currentPath });
          } else {
            await this.loadDirectory(this.state.currentPath);
          }
        } else {
          this.showToast('⚠️ ' + (json.error || 'Erreur d\'enregistrement'), 'error');
        }
      } catch (err) {
        this.showToast(`⚠️ Erreur: ${err.message}`, 'error');
      }
    }

    openFolderUnlockModal(dirPath) {
      this.manager.activeModalInstance = this;
      if (!this.el.folderUnlockModal) return;
      this.pendingUnlockDirPath = dirPath;
      if (this.el.folderPasswordInput) this.el.folderPasswordInput.value = '';
      if (this.el.folderUnlockError) this.el.folderUnlockError.style.display = 'none';
      this.el.folderUnlockModal.style.display = 'flex';
      this.el.folderUnlockModal.classList.add('open');
      if (this.el.folderPasswordInput) {
        setTimeout(() => this.el.folderPasswordInput.focus(), 50);
      }
    }

    closeFolderUnlockModal() {
      if (!this.el.folderUnlockModal) return;
      this.el.folderUnlockModal.style.display = 'none';
      this.el.folderUnlockModal.classList.remove('open');
      this.pendingUnlockDirPath = null;
    }

    async unlockFolder() {
      if (!this.pendingUnlockDirPath || !this.el.folderPasswordInput) return;
      const password = this.el.folderPasswordInput.value;

      try {
        const json = await window.sys.api.fs.unlockFolder(this.pendingUnlockDirPath, password);
        if (json.success) {
          const unlockedPath = this.pendingUnlockDirPath;
          this.closeFolderUnlockModal();
          this.showToast('Dossier déverrouillé', 'success');
          await this.navigateTo(unlockedPath);
        } else {
          if (this.el.folderUnlockError) {
            this.el.folderUnlockError.textContent = json.error || 'Mot de passe incorrect';
            this.el.folderUnlockError.style.display = 'block';
          }
        }
      } catch (err) {
        this.showToast(`⚠️ Erreur: ${err.message}`, 'error');
      }
    }

    async openFolderSettingsModal(targetDir = null) {
      this.manager.activeModalInstance = this;
      const modal = this.el.folderSettingsModal || document.getElementById('folderSettingsModal');
      if (!this.state.isAdmin || !modal) return;
      this.el.folderSettingsModal = modal;

      this.el.dotfileTitleInput = this.el.dotfileTitleInput || document.getElementById('dotfileTitleInput');
      this.el.dotfileDescInput = this.el.dotfileDescInput || document.getElementById('dotfileDescInput');
      this.el.dotfileBgInput = this.el.dotfileBgInput || document.getElementById('dotfileBgInput');
      this.el.dotfileAccessModeSelect = this.el.dotfileAccessModeSelect || document.getElementById('dotfileAccessModeSelect');
      this.el.folderPasswordGroup = this.el.folderPasswordGroup || document.getElementById('folderPasswordGroup');
      this.el.dotfilePasswordInput = this.el.dotfilePasswordInput || document.getElementById('dotfilePasswordInput');

      const target = (typeof targetDir === 'string') ? targetDir : (this.state.currentPath || '');
      this.modalFolderSettingsDir = target;

      let overrides = this.state.overrides || {};
      if (target !== (this.state.currentPath || '')) {
        try {
          const res = await window.sys.api.get('get_gallery', { dir: target, _t: Date.now() });
          if (res && res.success && res.overrides) {
            overrides = res.overrides;
          }
        } catch (e) {
          console.warn('[Explorer] Could not fetch overrides for folder:', target, e);
        }
      }

      if (this.el.dotfileTitleInput) this.el.dotfileTitleInput.value = overrides.title || '';
      if (this.el.dotfileDescInput) this.el.dotfileDescInput.value = overrides.description || '';
      if (this.el.dotfileBgInput) this.el.dotfileBgInput.value = overrides.background || '';
      if (this.el.dotfileAccessModeSelect) {
        this.el.dotfileAccessModeSelect.value = overrides.access_mode || 'public';
        this.el.dotfileAccessModeSelect.onchange = () => {
          if (this.el.folderPasswordGroup) {
            this.el.folderPasswordGroup.style.display = (this.el.dotfileAccessModeSelect.value === 'password') ? 'block' : 'none';
          }
        };
      }
      if (this.el.dotfilePasswordInput) this.el.dotfilePasswordInput.value = '';
      if (this.el.folderPasswordGroup) {
        this.el.folderPasswordGroup.style.display = (overrides.access_mode === 'password') ? 'block' : 'none';
      }
      modal.style.display = 'flex';
      modal.classList.add('open');
    }

    closeFolderSettingsModal() {
      const modal = this.el.folderSettingsModal || document.getElementById('folderSettingsModal');
      if (!modal) return;
      modal.style.display = 'none';
      modal.classList.remove('open');
    }

    async saveFolderSettings() {
      try {
        const targetDir = (this.modalFolderSettingsDir !== undefined && this.modalFolderSettingsDir !== null)
          ? this.modalFolderSettingsDir
          : (this.state.currentPath || '');

        const json = await window.sys.api.fs.saveFolderSettings({
          dir: targetDir,
          title: this.el.dotfileTitleInput ? this.el.dotfileTitleInput.value.trim() : '',
          description: this.el.dotfileDescInput ? this.el.dotfileDescInput.value.trim() : '',
          background: this.el.dotfileBgInput ? this.el.dotfileBgInput.value.trim() : '',
          access_mode: this.el.dotfileAccessModeSelect ? this.el.dotfileAccessModeSelect.value : 'public',
          password: this.el.dotfilePasswordInput ? this.el.dotfilePasswordInput.value : ''
        });
        if (json.success) {
          this.closeFolderSettingsModal();
          this.showToast(json.message || this.t('api.msg_folder_settings_saved'), 'success');
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'save_folder_settings', dir: targetDir });
          } else {
            await this.loadDirectory(this.state.currentPath);
          }
        } else {
          this.showToast('⚠️ ' + (json.error || this.t('api.err_save_failed')), 'error');
        }
      } catch (err) {
        this.showToast(`⚠️ Erreur: ${err.message}`, 'error');
      }
    }

    async handleUploadFiles(files, targetDir = null) {
      if (!files || files.length === 0) return;
      const destination = (targetDir !== null && typeof targetDir === 'string') ? targetDir : this.state.currentPath;

      const formData = new FormData();
      formData.append('dir', destination);
      for (let i = 0; i < files.length; i++) {
        formData.append('files[]', files[i]);
      }

      const progressModal = document.getElementById('uploadProgressModal');
      const progressBar = document.getElementById('uploadProgressBar');
      const progressStatus = document.getElementById('uploadProgressStatus');

      if (progressModal) {
        if (progressBar) {
          progressBar.style.width = '0%';
          progressBar.textContent = '0%';
        }
        if (progressStatus) {
          progressStatus.textContent = `Téléversement de ${files.length} fichier(s)...`;
        }
        progressModal.style.display = 'flex';
        progressModal.classList.add('open');
      } else {
        this.showToast(`Téléversement de ${files.length} fichier(s)...`, 'info');
      }

      const json = await window.sys.api.upload('upload_file', formData, (percent) => {
        if (progressBar) {
          progressBar.style.width = `${percent}%`;
          progressBar.textContent = `${percent}%`;
        }
      });

      if (progressModal) {
        progressModal.style.display = 'none';
        progressModal.classList.remove('open');
      }

      if (json.success) {
        this.showToast(json.message || 'Fichiers téléversés avec succès', 'success');
        if (window.EventBus) {
          window.EventBus.emit('fs:changed', { action: 'upload', dir: destination });
        } else {
          await this.loadDirectory(this.state.currentPath);
        }
      } else {
        this.showToast('⚠️ ' + (json.error || 'Erreur lors du téléversement'), 'error');
      }
    }

    renderProtectedState(dirPath) {
      if (!this.el.emptyState) return;
      if (this.el.mediaGrid) this.el.mediaGrid.style.display = 'none';
      this.el.emptyState.style.display = 'block';
      this.el.emptyState.innerHTML = `
        <div class="empty-state-icon">🔒</div>
        <h3>${this.escapeHtml(this.t('stats.folder_locked'))}</h3>
        <p>${this.escapeHtml(this.t('stats.folder_locked_desc'))}</p>
        <button class="pill-btn active" style="margin-top: 1rem;">
          ${this.escapeHtml(this.t('stats.folder_unlock_action'))}
        </button>
      `;
      const btn = this.el.emptyState.querySelector('button');
      if (btn) btn.onclick = () => this.openFolderUnlockModal(dirPath);
    }

    renderPrivateState(msg) {
      if (!this.el.emptyState) return;
      if (this.el.mediaGrid) this.el.mediaGrid.style.display = 'none';
      this.el.emptyState.style.display = 'block';
      this.el.emptyState.innerHTML = `
        <div class="empty-state-icon">👁️‍🗨️</div>
        <h3>${this.escapeHtml(this.t('stats.folder_private'))}</h3>
        <p>${this.escapeHtml(msg || this.t('stats.folder_private_desc'))}</p>
      `;
    }

    copySelection() {
      const selectedPaths = Array.from(this.state.selectedPaths || []);
      if (selectedPaths.length === 0) return;
      const files = this.state.files || [];
      const folders = this.state.directories || this.state.folders || [];
      const items = [];
      selectedPaths.forEach(p => {
        const f = files.find(item => item.path === p);
        const folder = folders.find(item => item.path === p);
        if (f) items.push(f);
        else if (folder) items.push({ ...folder, is_folder: true });
        else items.push({ path: p, name: p.split('/').pop() });
      });

      if (window.sys && window.sys.clipboard) {
        window.sys.clipboard.copyFiles(items);
        this.showToast(this.t('clipboard.items_copied', { count: items.length }), 'info');
      }
    }

    cutSelection() {
      const selectedPaths = Array.from(this.state.selectedPaths || []);
      if (selectedPaths.length === 0) return;
      const files = this.state.files || [];
      const folders = this.state.directories || this.state.folders || [];
      const items = [];
      selectedPaths.forEach(p => {
        const f = files.find(item => item.path === p);
        const folder = folders.find(item => item.path === p);
        if (f) items.push(f);
        else if (folder) items.push({ ...folder, is_folder: true });
        else items.push({ path: p, name: p.split('/').pop() });
      });

      if (window.sys && window.sys.clipboard) {
        window.sys.clipboard.cutFiles(items);
        this.showToast(this.t('clipboard.items_cut', { count: items.length }), 'info');
      }
    }

    async pasteClipboard() {
      if (!window.sys || !window.sys.clipboard || !window.sys.clipboard.hasData()) return;
      const clip = window.sys.clipboard.paste();
      if (clip.type !== 'files' || !Array.isArray(clip.data) || clip.data.length === 0) return;

      const dest = this.state.currentPath;
      let successCount = 0;

      for (const item of clip.data) {
        const sourcePath = item.path || item;
        try {
          if (clip.op === 'cut') {
            const res = await window.sys.api.fs.moveItem(sourcePath, dest);
            if (res && res.success) successCount++;
          } else {
            const res = await window.sys.api.fs.copyItem(sourcePath, dest);
            if (res && res.success) successCount++;
          }
        } catch (e) {}
      }

      if (clip.op === 'cut') {
        window.sys.clipboard.clear();
      }

      if (successCount > 0) {
        this.showToast(this.t('clipboard.items_pasted', { count: successCount }), 'success');
        if (window.EventBus) {
          window.EventBus.emit('fs:changed', { action: clip.op, dir: dest });
        } else {
          await this.loadDirectory(this.state.currentPath);
        }
      }
    }

    onLocaleChanged() {
      // Re-apply DOM translations inside this instance container
      if (this.containerEl) {
        this.containerEl.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.dataset.i18n;
          const trans = this.t(key);
          if (trans && trans !== key) {
            if (trans.includes('<') && trans.includes('>')) {
              el.innerHTML = trans;
            } else {
              el.textContent = trans;
            }
          }
        });

        this.containerEl.querySelectorAll('[data-i18n-title]').forEach(el => {
          const key = el.dataset.i18nTitle;
          const trans = this.t(key);
          if (trans && trans !== key) el.setAttribute('title', trans);
        });

        this.containerEl.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
          const key = el.dataset.i18nPlaceholder;
          const trans = this.t(key);
          if (trans && trans !== key) el.setAttribute('placeholder', trans);
        });
      }

      // Update dynamic selection UI
      this.updateSelectionUI();

      // Refresh breadcrumbs
      if (this.state && Array.isArray(this.state.currentBreadcrumbs)) {
        this.renderBreadcrumbs(this.state.currentBreadcrumbs);
      }

      // Refresh file/folder grid
      this.applyFilterAndRender();
      if (typeof this.updateSortUI === 'function') {
        this.updateSortUI();
      }
    }

    // -------------------------------------------------------------
    // INSTANCE EVENTS & DRAG-AND-DROP RECEPTION
    // -------------------------------------------------------------
    bindEvents() {
      // Keyboard shortcuts within Explorer instance
      this.containerEl.setAttribute('tabindex', '-1');
      this.containerEl.addEventListener('keydown', (e) => {
        const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
          return;
        }

        if (e.ctrlKey || e.metaKey) {
          const key = e.key.toLowerCase();
          if (key === 'c') {
            e.preventDefault();
            this.copySelection();
          } else if (key === 'x') {
            e.preventDefault();
            this.cutSelection();
          } else if (key === 'v') {
            e.preventDefault();
            this.pasteClipboard();
          } else if (key === 'a') {
            e.preventDefault();
            this.selectAll();
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.state.selectedPaths && this.state.selectedPaths.size > 0 && (this.state.isAdmin || (this.state.userRights && this.state.userRights.can_delete))) {
            e.preventDefault();
            this.deleteSelection();
          }
        } else if (e.key === 'Escape') {
          if (this.state.selectedPaths && this.state.selectedPaths.size > 0) {
            e.preventDefault();
            this.clearSelection();
          }
        } else if (e.key === ' ' || e.key === 'Spacebar') {
          if (this.state.selectedPaths && this.state.selectedPaths.size > 0) {
            e.preventDefault();
            const first = Array.from(this.state.selectedPaths)[0];
            const files = this.state.files || [];
            const file = files.find(f => f.path === first);
            if (file && window.sys && window.sys.openFile) {
              window.sys.openFile(file);
            }
          }
        } else if (e.key === 'Enter') {
          if (this.state.selectedPaths && this.state.selectedPaths.size > 0) {
            e.preventDefault();
            const first = Array.from(this.state.selectedPaths)[0];
            const folders = this.state.directories || this.state.folders || [];
            const folder = folders.find(f => f.path === first);
            if (folder) {
              this.loadDirectory(folder.path);
            } else {
              const files = this.state.files || [];
              const file = files.find(f => f.path === first);
              if (file && window.sys && window.sys.openFile) {
                window.sys.openFile(file);
              }
            }
          }
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (this.state.filteredFiles && this.state.filteredFiles.length > 0) {
            e.preventDefault();
            let currentIndex = this.state.lastSelectedIndex !== null ? this.state.lastSelectedIndex : -1;
            let nextIndex = currentIndex;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              nextIndex = Math.min(this.state.filteredFiles.length - 1, currentIndex + 1);
            } else {
              nextIndex = Math.max(0, currentIndex - 1);
            }
            if (nextIndex >= 0 && nextIndex < this.state.filteredFiles.length) {
              const targetFile = this.state.filteredFiles[nextIndex];
              this.state.selectedPaths.clear();
              this.state.selectedPaths.add(targetFile.path);
              this.state.lastSelectedIndex = nextIndex;
              this.updateSelectionUI();
              // Scroll card into view
              const card = this.el.mediaGrid.querySelector(`[data-index="${nextIndex}"]`);
              if (card && typeof card.scrollIntoView === 'function') {
                card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
              }
            }
          }
        } else if (e.key === 'i' || e.key === 'I') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.toggleInspector();
          }
        }
      });

      // Cross-window and OS file drop target on main instance container
      this.containerEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const hasExternalFiles = e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files');
        const hasInternalItems = !!window.SG_DRAGGING_PATHS;

        if (hasInternalItems) {
          e.dataTransfer.dropEffect = 'move';
        } else if (hasExternalFiles) {
          e.dataTransfer.dropEffect = 'copy';
        }
      });

      this.containerEl.addEventListener('drop', async (e) => {
        // If dropped onto a specific subfolder card or breadcrumb item, let child handle it
        if (e.target && (e.target.closest('.folder-card') || e.target.closest('.crumb-item'))) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // 1. External files from OS
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0 && !window.SG_DRAGGING_PATHS) {
          const canUpload = this.state.isAdmin || (this.state.userRights && this.state.userRights.can_upload);
          if (canUpload) {
            this.handleUploadFiles(e.dataTransfer.files, this.state.currentPath);
          }
          return;
        }

        // 2. Internal Drag & Drop from another explorer window or same window
        let pathsToMove = this.state.draggingPaths || window.SG_DRAGGING_PATHS;
        if (!pathsToMove) {
          try {
            const data = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
            if (data) pathsToMove = JSON.parse(data);
          } catch (err) { }
        }

        if (pathsToMove) {
          const arr = Array.isArray(pathsToMove) ? pathsToMove : [pathsToMove];
          if (arr.length > 0) {
            await this.moveItems(arr, this.state.currentPath);
          }
        }
      });

      if (this.el.filterPills) {
        this.el.filterPills.onclick = (e) => {
          const pill = e.target.closest('.pill-btn');
          if (pill && pill.dataset.category) {
            this.setFilterCategory(pill.dataset.category);
          }
        };
      }

      if (this.el.folderMapBtn) this.el.folderMapBtn.onclick = () => this.openMapModal();
      if (this.el.folderSettingsBtn) this.el.folderSettingsBtn.onclick = () => this.openFolderSettingsModal();
      if (this.el.mapModalCloseBtn) this.el.mapModalCloseBtn.onclick = () => this.closeMapModal();
      if (this.el.exitSearchBtn) this.el.exitSearchBtn.onclick = () => this.exitSearch();
      if (this.el.selectionCopyBtn) this.el.selectionCopyBtn.onclick = () => this.copySelection();
      if (this.el.selectionCutBtn) this.el.selectionCutBtn.onclick = () => this.cutSelection();
      if (this.el.selectionDeleteBtn) this.el.selectionDeleteBtn.onclick = () => this.deleteSelection();
      if (this.el.selectionSelectAllBtn) this.el.selectionSelectAllBtn.onclick = () => this.selectAll();
      if (this.el.selectionClearBtn) this.el.selectionClearBtn.onclick = () => this.clearSelection();

      if (this.el.searchModalCloseBtn) this.el.searchModalCloseBtn.onclick = () => this.closeSearchModal();
      if (this.el.searchAdvancedForm) {
        this.el.searchAdvancedForm.onsubmit = (e) => {
          e.preventDefault();
          const name = this.el.advSearchName ? this.el.advSearchName.value : '';
          this.state.searchQuery = name.toLowerCase();
          this.closeSearchModal();
          this.applyFilterAndRender();
        };
      }

      // Quick Live Filter Search Input
      if (this.el.quickSearchInput) {
        this.el.quickSearchInput.oninput = (e) => {
          const val = (e.target.value || '').trim().toLowerCase();
          this.state.searchQuery = val;
          if (this.el.quickSearchClearBtn) {
            this.el.quickSearchClearBtn.style.display = val ? 'block' : 'none';
          }
          this.applyFilterAndRender();
        };
        this.el.quickSearchInput.onkeydown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.el.quickSearchInput.value = '';
            this.state.searchQuery = '';
            if (this.el.quickSearchClearBtn) this.el.quickSearchClearBtn.style.display = 'none';
            this.applyFilterAndRender();
          }
        };
      }
      if (this.el.quickSearchClearBtn) {
        this.el.quickSearchClearBtn.onclick = () => {
          if (this.el.quickSearchInput) this.el.quickSearchInput.value = '';
          this.state.searchQuery = '';
          this.el.quickSearchClearBtn.style.display = 'none';
          this.applyFilterAndRender();
        };
      }

      // Quick View Switcher Buttons
      if (this.el.viewModeBtns) {
        this.el.viewModeBtns.forEach(btn => {
          btn.onclick = () => {
            const mode = btn.dataset.view;
            if (mode) this.setViewMode(mode);
          };
        });
      }

      // Inspector Drawer Toggle
      if (this.el.inspectorToggleBtn) {
        this.el.inspectorToggleBtn.onclick = () => this.toggleInspector();
      }
      if (this.el.inspectorCloseBtn) {
        this.el.inspectorCloseBtn.onclick = () => this.toggleInspector(false);
      }
      if (this.el.inspectorOpenBtn) {
        this.el.inspectorOpenBtn.onclick = () => {
          const first = Array.from(this.state.selectedPaths)[0];
          const file = (this.state.files || []).find(f => f.path === first);
          if (file && window.sys && window.sys.openFile) window.sys.openFile(file);
        };
      }
      if (this.el.inspectorQuicklookBtn) {
        this.el.inspectorQuicklookBtn.onclick = () => {
          const first = Array.from(this.state.selectedPaths)[0];
          const file = (this.state.files || []).find(f => f.path === first);
          if (file && window.sys && window.sys.openFile) window.sys.openFile(file);
        };
      }

      // Autorun Editor Modal Form
      if (this.el.autorunEditorCloseBtn) {
        this.el.autorunEditorCloseBtn.onclick = () => this.closeAutorunEditorModal();
      }
      if (this.el.autorunEditorCancelBtn) {
        this.el.autorunEditorCancelBtn.onclick = () => this.closeAutorunEditorModal();
      }
      if (this.el.autorunEditorDeleteBtn) {
        this.el.autorunEditorDeleteBtn.onclick = () => this.deleteAutorunConfig();
      }
      if (this.el.autorunEditorForm) {
        this.el.autorunEditorForm.onsubmit = (e) => {
          e.preventDefault();
          this.saveAutorunConfig();
        };
      }
    }

    // -------------------------------------------------------------
    // INSPECTOR DRAWER LOGIC
    // -------------------------------------------------------------
    toggleInspector(forceState) {
      if (!this.el.inspectorDrawer) return;
      const isVisible = (this.el.inspectorDrawer.style.display !== 'none');
      const newState = (forceState !== undefined) ? forceState : !isVisible;
      this.el.inspectorDrawer.style.display = newState ? 'flex' : 'none';
      if (this.el.inspectorToggleBtn) {
        this.el.inspectorToggleBtn.classList.toggle('active', newState);
      }
      if (newState) {
        this.updateInspectorUI();
      }
    }

    updateInspectorUI() {
      if (!this.el.inspectorDrawer || this.el.inspectorDrawer.style.display === 'none') return;
      const selected = Array.from(this.state.selectedPaths);
      if (selected.length === 0) {
        if (this.el.inspectorEmptyState) this.el.inspectorEmptyState.style.display = 'block';
        if (this.el.inspectorDetails) this.el.inspectorDetails.style.display = 'none';
        return;
      }

      const firstPath = selected[0];
      const file = (this.state.files || []).find(f => f.path === firstPath);
      if (!file) {
        if (this.el.inspectorEmptyState) this.el.inspectorEmptyState.style.display = 'block';
        if (this.el.inspectorDetails) this.el.inspectorDetails.style.display = 'none';
        return;
      }

      if (this.el.inspectorEmptyState) this.el.inspectorEmptyState.style.display = 'none';
      if (this.el.inspectorDetails) this.el.inspectorDetails.style.display = 'block';

      if (this.el.inspectorFilenameBadge) this.el.inspectorFilenameBadge.textContent = file.name;
      if (this.el.inspectorMetaName) this.el.inspectorMetaName.textContent = file.name;
      if (this.el.inspectorMetaSize) this.el.inspectorMetaSize.textContent = file.size_formatted || `${file.size || 0} octets`;
      if (this.el.inspectorMetaDim) this.el.inspectorMetaDim.textContent = file.dimensions || '-';
      if (this.el.inspectorMetaDate) {
        const d = new Date((file.effective_mtime || file.mtime || Date.now() / 1000) * 1000);
        this.el.inspectorMetaDate.textContent = d.toLocaleString();
      }
      if (this.el.inspectorMetaComment) this.el.inspectorMetaComment.textContent = file.comment || '-';
      if (this.el.inspectorMetaCamera) {
        const exif = file.exif || {};
        const cam = [exif.make, exif.model].filter(Boolean).join(' ');
        this.el.inspectorMetaCamera.textContent = cam || '-';
      }
      if (this.el.inspectorMetaGps) {
        const gps = (file.exif && file.exif.gps) ? `${file.exif.gps.lat.toFixed(4)}, ${file.exif.gps.lng.toFixed(4)}` : '-';
        this.el.inspectorMetaGps.textContent = gps;
      }

      // Preview rendering
      if (this.el.inspectorPreviewImg && this.el.inspectorPreviewIcon) {
        if (file.category === 'image' || file.thumb_url) {
          this.el.inspectorPreviewImg.src = file.thumb_url || file.file_url;
          this.el.inspectorPreviewImg.style.display = 'block';
          this.el.inspectorPreviewIcon.style.display = 'none';
        } else {
          this.el.inspectorPreviewImg.style.display = 'none';
          this.el.inspectorPreviewIcon.style.display = 'block';
          this.el.inspectorPreviewIcon.textContent = window.IconHelper ? window.IconHelper.getFileIcon(file) : '📄';
        }
      }
    }

    // -------------------------------------------------------------
    // AUTORUN & VLOG PRESENTATION LAUNCHER & CONFIG
    // -------------------------------------------------------------
    launchAutorun(autorunConfig) {
      const config = autorunConfig || (this.state.overrides && this.state.overrides.autorun);
      if (!config) return;
      if (window.sys && window.sys.autorun && typeof window.sys.autorun.launch === 'function') {
        window.sys.autorun.launch(config, this.state.currentPath, this);
      } else {
        this.showToast('Moteur autorun non disponible', 'error');
      }
    }

    openAutorunEditorModal(existingConfig = null) {
      if (!this.el.autorunEditorModal) return;
      const config = existingConfig || (this.state.overrides && this.state.overrides.autorun) || {
        version: "1.0",
        title: this.state.currentPath ? this.state.currentPath.split('/').pop() : "Présentation VLog",
        description: "Présentation synchronisée multimédia",
        window_layout: "split-horizontal",
        lead_media: { app: "viewer-video", file: "" },
        companion_app: { app: "viewer-text", file: "" },
        steps: [
          { time: "00:00", action: "open_app", app: "viewer-video", file: "" },
          { time: "00:10", action: "set_doc", app: "viewer-text", file: "", chapter: "Introduction" }
        ]
      };

      if (this.el.autorunEditTitle) this.el.autorunEditTitle.value = config.title || '';
      if (this.el.autorunEditDesc) this.el.autorunEditDesc.value = config.description || '';
      if (this.el.autorunEditLayout) this.el.autorunEditLayout.value = config.window_layout || 'split-horizontal';
      if (this.el.autorunEditJson) this.el.autorunEditJson.value = JSON.stringify(config, null, 2);
      if (this.el.autorunEditorDeleteBtn) {
        this.el.autorunEditorDeleteBtn.style.display = (this.state.overrides && this.state.overrides.has_autorun) ? 'inline-block' : 'none';
      }

      this.el.autorunEditorModal.style.display = 'flex';
    }

    closeAutorunEditorModal() {
      if (this.el.autorunEditorModal) {
        this.el.autorunEditorModal.style.display = 'none';
      }
    }

    async saveAutorunConfig() {
      if (!this.el.autorunEditJson) return;
      let parsed;
      try {
        parsed = JSON.parse(this.el.autorunEditJson.value);
        if (this.el.autorunEditTitle && this.el.autorunEditTitle.value) {
          parsed.title = this.el.autorunEditTitle.value;
        }
        if (this.el.autorunEditDesc && this.el.autorunEditDesc.value) {
          parsed.description = this.el.autorunEditDesc.value;
        }
        if (this.el.autorunEditLayout && this.el.autorunEditLayout.value) {
          parsed.window_layout = this.el.autorunEditLayout.value;
        }
      } catch (err) {
        this.showToast(`Syntaxe JSON invalide : ${err.message}`, 'error');
        return;
      }

      try {
        const savePath = (this.state.currentPath ? `${this.state.currentPath}/` : '') + '.autorun.json';
        const res = await window.sys.api.post('save_file_content', {
          path: savePath,
          content: JSON.stringify(parsed, null, 2),
          csrf_token: this.state.csrfToken || window.CSRF_TOKEN
        });
        if (res && res.success) {
          this.closeAutorunEditorModal();
          this.showToast('Présentation autorun.json enregistrée avec succès !', 'success');
          await this.loadDirectory(this.state.currentPath);
        } else {
          this.showToast(`Erreur : ${(res && res.error) || 'Impossible d\'enregistrer'}`, 'error');
        }
      } catch (err) {
        this.showToast(`Erreur réseau : ${err.message}`, 'error');
      }
    }

    async deleteAutorunConfig() {
      if (!confirm('Supprimer définitivement la configuration autorun.json de ce dossier ?')) return;
      try {
        const path1 = (this.state.currentPath ? `${this.state.currentPath}/` : '') + '.autorun.json';
        const path2 = (this.state.currentPath ? `${this.state.currentPath}/` : '') + 'autorun.json';
        await window.sys.api.fs.deleteItem(path1);
        await window.sys.api.fs.deleteItem(path2);
        this.closeAutorunEditorModal();
        this.showToast('Autorun supprimé', 'info');
        await this.loadDirectory(this.state.currentPath);
      } catch (err) {
        this.showToast(`Erreur : ${err.message}`, 'error');
      }
    }

  }

  // -------------------------------------------------------------
  // EXPLORER MULTI-INSTANCE MANAGER (window.explorerApp)
  // -------------------------------------------------------------
  const WebOSApp = (window.sys && window.sys.App) || window.WebOSApp || Object;

  class ExplorerApp extends WebOSApp {
    constructor() {
      super({
        id: 'explorer',
        title: 'apps.explorer.title',
        icon: '📁'
      });
      this.instances = new Map();
      this.instanceCounter = 0;
      this.activeInstance = null;
      this.activeModalInstance = null;

      window.explorerApp = this;

      if (window.WindowManager) window.WindowManager.init();
      if (window.MenuBarManager) window.MenuBarManager.init('appHeaderZone');

      this.bindMenuBar();
      this.bindGlobalModals();

      // Listen for filesystem changes across all instances
      if (window.EventBus && typeof window.EventBus.on === 'function') {
        window.EventBus.on('fs:changed', () => {
          this.instances.forEach(inst => {
            inst.loadDirectory(inst.state.currentPath);
          });
        });
      }

      // Initial window on DOMContentLoaded handled by OS Boot / Autostart Processor
      if (!window.SG_AUTOSTART_CONFIG) {
        this.createInstance();
      }
    }

    get state() {
      const active = this.getActiveInstance();
      return active ? active.state : {};
    }

    set state(val) {
      const active = this.getActiveInstance();
      if (active) active.state = val;
    }

    /**
     * Reload directory across all running Explorer instances or active instance
     */
    loadDirectory(path) {
      if (this.instances && this.instances.size > 0) {
        this.instances.forEach(inst => {
          if (typeof inst.loadDirectory === 'function') {
            inst.loadDirectory(path !== undefined ? path : inst.state.currentPath);
          }
        });
      } else {
        const active = this.getActiveInstance();
        if (active && typeof active.loadDirectory === 'function') {
          active.loadDirectory(path !== undefined ? path : active.state.currentPath);
        }
      }
    }

    getActiveInstance() {
      if (this.activeInstance && this.instances.has(this.activeInstance.id)) {
        return this.activeInstance;
      }
      const first = this.instances.values().next().value;
      return first || null;
    }

    setActiveInstance(instance) {
      this.activeInstance = instance;
      if (window.MenuBarManager) {
        window.MenuBarManager.setActiveApp('explorer');
        this.updateMenuBarForActiveInstance();
      }
    }

    removeInstance(id) {
      this.instances.delete(id);
      if (this.activeInstance && this.activeInstance.id === id) {
        this.activeInstance = this.instances.values().next().value || null;
      }
      if (this.instances.size === 0 && window.MenuBarManager) {
        window.MenuBarManager.restoreDefaultMenu();
      }
    }

    createInstance(params = {}) {
      const id = ++this.instanceCounter;
      const instance = new ExplorerInstance(this, id, params);
      this.instances.set(id, instance);
      this.setActiveInstance(instance);
      return instance;
    }

    open(params = {}) {
      // If params.dir is given or user explicitly requests a new window
      if (params.newWindow || this.instances.size === 0) {
        return this.createInstance(params);
      }

      // If params.dir is specified, check if an existing instance already views it
      if (params.dir !== undefined) {
        for (const inst of this.instances.values()) {
          if (inst.state.currentPath === params.dir) {
            if (inst.win.state === 'minimized') window.WindowManager.restoreWindow(inst.winId);
            window.WindowManager.focusWindow(inst.winId);
            return inst;
          }
        }
        // If not found, open a new instance for this folder
        return this.createInstance(params);
      }

      // If launched without params, create a new explorer instance or focus the active one
      return this.createInstance(params);
    }

    // -------------------------------------------------------------
    // CONTEXTUAL TOP MENUBAR INTEGRATION (macOS Style)
    // -------------------------------------------------------------
    bindMenuBar() {
      if (!window.MenuBarManager) return;

      window.MenuBarManager.registerAppMenu('explorer', (container) => {
        const active = this.getActiveInstance();
        const activeState = active ? active.state : {};

        container.innerHTML = `
          <div class="explorer-header-bar">
            <!-- Search Box -->
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="searchInput" class="search-input" placeholder="${this.escapeHtml(this.t('nav.search_placeholder'))}" value="${this.escapeHtml(activeState.searchQuery || '')}" aria-label="Rechercher des médias">
              <button type="button" id="searchClearBtn" class="search-clear-btn" title="${this.escapeHtml(this.t('nav.search_clear'))}" style="${activeState.searchQuery ? 'display:inline-flex;' : 'display:none;'}">✕</button>
              <button type="button" id="advancedSearchBtn" class="search-filter-btn" title="${this.escapeHtml(this.t('nav.search_advanced'))}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </button>
            </div>

            <!-- Sort Group -->
            <div class="sort-group">
              <select id="sortSelect" class="sort-select" aria-label="Sort options">
                <option value="name" ${activeState.sortBy === 'name' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.name'))}</option>
                <option value="exif_date" ${activeState.sortBy === 'exif_date' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.date'))}</option>
                <option value="date" ${activeState.sortBy === 'date' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.mtime'))}</option>
                <option value="size" ${activeState.sortBy === 'size' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.size'))}</option>
              </select>
              <button id="sortOrderBtn" class="btn-toggle" title="${this.escapeHtml(this.t('sort.order_asc'))}">
                <span id="sortOrderIcon" style="font-size:1.1rem;font-weight:bold;">${activeState.sortOrder === 'asc' ? '⇧' : '⇩'}</span>
              </button>
            </div>

            <!-- Favorites Toggle -->
            <button id="toggleFavoritesBtn" class="btn-toggle ${activeState.showFavoritesOnly ? 'active' : ''}" title="${this.escapeHtml(this.t('nav.favorites'))}">
              <span>❤️</span><span id="favCountBadge" class="fav-count-badge" style="${(activeState.favorites && activeState.favorites.length > 0) ? 'display:inline-flex;' : 'display:none;'}">${(activeState.favorites && activeState.favorites.length) || 0}</span>
            </button>

            <!-- GPS Map Button -->
            <button type="button" id="menuFolderMapBtn" class="btn-toggle" style="display: none;" title="${this.escapeHtml(this.t('nav.map'))}">
              <span>🗺️</span>
            </button>

            <!-- Archive Dropdown -->
            <div class="archive-dropdown-container" id="archiveDropdownContainer" style="${(activeState.userRights && activeState.userRights.can_download_archive === false && !activeState.isAdmin) ? 'display:none;' : 'display:inline-flex;'}">
              <button id="downloadArchiveBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.download_archive'))}">
                <span>⇲</span> ▾
              </button>
              <div id="archiveMenu" class="archive-dropdown-menu"></div>
            </div>

            <!-- View Mode Selector Dropdown -->
            <div class="view-selector-container" id="viewSelectorContainer">
              <button type="button" id="viewSelectorBtn" class="btn-toggle view-btn" title="${this.escapeHtml(this.t('view.switch_mode'))}">
                <span id="currentViewIcon">${this.getViewModeIcon(activeState.viewMode || 'polaroid')}</span>
                <span id="currentViewLabel">${this.getViewModeLabel(activeState.viewMode || 'polaroid')}</span>
                <span class="view-dropdown-arrow">▾</span>
              </button>
              <div id="viewDropdownMenu" class="view-dropdown-menu" style="display: none;"></div>
            </div>

            <!-- New Window / Instance Action -->
            <button id="newExplorerWindowBtn" class="btn-toggle" title="${this.escapeHtml(this.t('explorer.new_window'))}" style="display:inline-flex;">
              <span>🗂️+</span>
            </button>

            <!-- Folder & Upload Actions -->
            <button id="createFolderBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.create_folder'))}" style="${(activeState.isAdmin || (activeState.userRights && activeState.userRights.can_create_folder)) ? 'display:inline-flex;' : 'display:none;'}">
              <span>📁+</span>
            </button>
            <button id="uploadMediaBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.upload_media'))}" style="${(activeState.isAdmin || (activeState.userRights && activeState.userRights.can_upload)) ? 'display:inline-flex;' : 'display:none;'}">
              <span>📤</span>
            </button>
            <input type="file" id="uploadFileInput" multiple style="display: none;" />
            <button id="folderSettingsBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.folder_settings'))}" style="${activeState.isAdmin ? 'display:inline-flex;' : 'display:none;'}">
              <span>⚙</span>
            </button>
          </div>
        `;

        this.bindMenuBarEvents();
        this.updateArchiveMenuUI();
        this.updateViewDropdownUI();
      });

      window.MenuBarManager.setActiveApp('explorer');
    }

    bindMenuBarEvents() {
      const searchInput = document.getElementById('searchInput');
      const searchClearBtn = document.getElementById('searchClearBtn');
      const advSearchBtn = document.getElementById('advancedSearchBtn');
      const sortSelect = document.getElementById('sortSelect');
      const sortOrderBtn = document.getElementById('sortOrderBtn');
      const toggleFavBtn = document.getElementById('toggleFavoritesBtn');
      const dlArchiveBtn = document.getElementById('downloadArchiveBtn');
      const viewSelectorBtn = document.getElementById('viewSelectorBtn');
      const createFolderBtn = document.getElementById('createFolderBtn');
      const uploadMediaBtn = document.getElementById('uploadMediaBtn');
      const uploadFileInput = document.getElementById('uploadFileInput');
      const folderSettingsBtn = document.getElementById('folderSettingsBtn');
      const newWinBtn = document.getElementById('newExplorerWindowBtn');

      if (searchInput) {
        searchInput.oninput = (e) => {
          const active = this.getActiveInstance();
          if (active) {
            active.state.searchQuery = e.target.value.toLowerCase();
            if (searchClearBtn) searchClearBtn.style.display = e.target.value ? 'flex' : 'none';
            active.applyFilterAndRender();
          }
        };
      }

      if (searchClearBtn) {
        searchClearBtn.onclick = () => {
          const active = this.getActiveInstance();
          if (active) active.exitSearch();
        };
      }

      if (advSearchBtn) {
        advSearchBtn.onclick = () => {
          const active = this.getActiveInstance();
          if (active) active.openSearchModal();
        };
      }

      if (sortSelect) {
        sortSelect.onchange = (e) => {
          const active = this.getActiveInstance();
          if (active) {
            active.state.sortBy = e.target.value;
            active.state.sortOrder = ['date', 'exif_date', 'size'].includes(e.target.value) ? 'desc' : 'asc';
            active.saveFolderSort(active.state.currentPath, active.state.sortBy, active.state.sortOrder);
            this.updateMenuBarForActiveInstance();
            active.applyFilterAndRender();
          }
        };
      }

      if (sortOrderBtn) {
        sortOrderBtn.onclick = () => {
          const active = this.getActiveInstance();
          if (active) active.toggleSortOrder();
        };
      }

      if (toggleFavBtn) {
        toggleFavBtn.onclick = () => {
          const active = this.getActiveInstance();
          if (active) active.toggleFavoritesFilter();
        };
      }

      if (dlArchiveBtn) {
        dlArchiveBtn.onclick = (e) => {
          e.stopPropagation();
          const menu = document.getElementById('archiveMenu');
          if (menu) menu.classList.toggle('open');
        };
      }

      if (viewSelectorBtn) {
        viewSelectorBtn.onclick = (e) => {
          e.stopPropagation();
          this.toggleViewDropdown();
        };
      }

      if (newWinBtn) {
        newWinBtn.onclick = () => {
          this.createInstance();
        };
      }

      if (createFolderBtn) {
        createFolderBtn.onclick = () => {
          const active = this.getActiveInstance();
          if (active) active.openCreateFolderModal();
        };
      }

      if (uploadMediaBtn) {
        uploadMediaBtn.onclick = () => {
          if (uploadFileInput) uploadFileInput.click();
        };
      }

      if (uploadFileInput) {
        uploadFileInput.onchange = (e) => {
          const active = this.getActiveInstance();
          if (active && e.target.files && e.target.files.length > 0) {
            active.handleUploadFiles(e.target.files);
          }
        };
      }

      if (folderSettingsBtn) {
        folderSettingsBtn.onclick = () => {
          const active = this.getActiveInstance();
          if (active) active.openFolderSettingsModal();
        };
      }

      this.updateViewDropdownUI();
    }

    updateMenuBarForActiveInstance() {
      const active = this.getActiveInstance();
      if (!active) return;

      const searchInput = document.getElementById('searchInput');
      const searchClearBtn = document.getElementById('searchClearBtn');
      const sortSelect = document.getElementById('sortSelect');
      const sortOrderIcon = document.getElementById('sortOrderIcon');
      const sortOrderBtn = document.getElementById('sortOrderBtn');
      const toggleFavBtn = document.getElementById('toggleFavoritesBtn');
      const favCountBadge = document.getElementById('favCountBadge');
      const icon = document.getElementById('currentViewIcon');
      const label = document.getElementById('currentViewLabel');

      if (searchInput) searchInput.value = active.state.searchQuery || '';
      if (searchClearBtn) searchClearBtn.style.display = active.state.searchQuery ? 'flex' : 'none';
      if (sortSelect) sortSelect.value = active.state.sortBy || 'name';
      if (sortOrderIcon) sortOrderIcon.textContent = (active.state.sortOrder === 'asc') ? '⇧' : '⇩';
      if (sortOrderBtn) sortOrderBtn.classList.toggle('active', active.state.sortOrder === 'asc');
      if (toggleFavBtn) toggleFavBtn.classList.toggle('active', !!active.state.showFavoritesOnly);
      if (favCountBadge) {
        const count = active.state.favorites ? active.state.favorites.length : 0;
        favCountBadge.textContent = count;
        favCountBadge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
      if (icon) icon.textContent = this.getViewModeIcon(active.state.viewMode);
      if (label) label.textContent = this.getViewModeLabel(active.state.viewMode);

      this.updateArchiveMenuUI();
    }

    updateViewDropdownUI() {
      const active = this.getActiveInstance();
      const currentMode = active ? active.state.viewMode : 'polaroid';
      const menu = document.getElementById('viewDropdownMenu');
      if (!menu) return;

      const views = (window.GalleryViewRegistry && window.GalleryViewRegistry.getAll()) || [];
      if (views.length === 0) return;

      menu.innerHTML = views.map(v => `
        <button type="button" class="view-option-btn ${currentMode === v.id ? 'active' : ''}" data-view-mode="${v.id}">
          <span>${v.icon || '🖼️'}</span> <span>${this.escapeHtml(this.t(v.nameKey) || v.name || v.id)}</span>
        </button>
      `).join('');

      menu.querySelectorAll('.view-option-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const mode = btn.dataset.viewMode;
          if (mode) {
            const inst = this.getActiveInstance();
            if (inst) inst.setViewMode(mode);
            this.closeViewDropdown();
          }
        };
      });
    }

    setViewMode(mode) {
      const inst = this.getActiveInstance();
      if (inst && typeof inst.setViewMode === 'function') {
        inst.setViewMode(mode);
      }
    }

    getViewModeIcon(mode) {
      const plugin = window.GalleryViewRegistry && window.GalleryViewRegistry.get(mode);
      return plugin ? (plugin.icon || '🖼️') : '🖼️';
    }

    getViewModeLabel(mode) {
      const plugin = window.GalleryViewRegistry && window.GalleryViewRegistry.get(mode);
      if (plugin && plugin.nameKey) return this.t(plugin.nameKey) || plugin.name || plugin.id;
      return mode;
    }

    toggleViewDropdown() {
      this.updateViewDropdownUI();
      const menu = document.getElementById('viewDropdownMenu');
      if (!menu) return;
      menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
    }

    closeViewDropdown() {
      const menu = document.getElementById('viewDropdownMenu');
      if (menu) menu.style.display = 'none';
    }

    updateArchiveMenuUI() {
      const active = this.getActiveInstance();
      if (!active) return;

      const menu = document.getElementById('archiveMenu');
      if (!menu) return;
      const currentDir = encodeURIComponent(active.state.currentPath || '');
      const archives = active.state.availableArchives || {};

      let itemsHtml = '';
      if (Array.isArray(archives) && archives.length > 0) {
        itemsHtml = archives.map(arch => `
          <a href="${arch.url || `system/endpoints/archive.php?dir=${currentDir}&format=${arch.format || 'zip'}`}" download class="archive-menu-item">
            <span>📦</span> <span>${this.escapeHtml(arch.name || `Télécharger (${(arch.format || 'ZIP').toUpperCase()})`)}</span>
          </a>
        `).join('');
      } else if (archives && typeof archives === 'object' && Object.keys(archives).length > 0) {
        itemsHtml = Object.keys(archives).map(fmt => {
          const label = fmt.toUpperCase();
          return `
            <a href="system/endpoints/archive.php?dir=${currentDir}&format=${encodeURIComponent(fmt)}" download class="archive-menu-item">
              <span>📦</span> <span>Télécharger le dossier (${this.escapeHtml(label)})</span>
            </a>
          `;
        }).join('');
      } else {
        itemsHtml = `
          <a href="system/endpoints/archive.php?dir=${currentDir}&format=zip" download class="archive-menu-item">
            <span>📦</span> <span>Télécharger le dossier (ZIP)</span>
          </a>
        `;
      }

      menu.innerHTML = itemsHtml;
    }

    bindGlobalModals() {
      document.addEventListener('click', (e) => {
        const viewContainer = document.getElementById('viewSelectorContainer');
        if (viewContainer && !viewContainer.contains(e.target)) {
          this.closeViewDropdown();
        }
        const archiveContainer = document.querySelector('.archive-dropdown-container');
        const archiveMenu = document.getElementById('archiveMenu');
        if (archiveContainer && archiveMenu && !archiveContainer.contains(e.target)) {
          archiveMenu.classList.remove('open');
        }
      });

      // Bind global admin modal forms to delegate to activeModalInstance
      const createFolderCloseBtn = document.getElementById('createFolderCloseBtn');
      const createFolderForm = document.getElementById('createFolderForm');
      if (createFolderCloseBtn) {
        createFolderCloseBtn.onclick = () => {
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.closeCreateFolderModal();
        };
      }
      if (createFolderForm) {
        createFolderForm.onsubmit = (e) => {
          e.preventDefault();
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.createFolder();
        };
      }

      const deleteConfirmCloseBtn = document.getElementById('deleteConfirmCloseBtn');
      const deleteCancelBtn = document.getElementById('deleteCancelBtn');
      const deleteConfirmActionBtn = document.getElementById('deleteConfirmActionBtn');
      if (deleteConfirmCloseBtn) {
        deleteConfirmCloseBtn.onclick = () => {
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.closeDeleteConfirmModal();
        };
      }
      if (deleteCancelBtn) {
        deleteCancelBtn.onclick = () => {
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.closeDeleteConfirmModal();
        };
      }
      if (deleteConfirmActionBtn) {
        deleteConfirmActionBtn.onclick = () => {
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.confirmDeleteItem();
        };
      }

      const mediaCommentCloseBtn = document.getElementById('mediaCommentCloseBtn');
      const mediaCommentForm = document.getElementById('mediaCommentForm');
      if (mediaCommentCloseBtn) {
        mediaCommentCloseBtn.onclick = () => {
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.closeMediaCommentModal();
        };
      }
      if (mediaCommentForm) {
        mediaCommentForm.onsubmit = (e) => {
          e.preventDefault();
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.saveMediaComment();
        };
      }

      const folderUnlockCloseBtn = document.getElementById('folderUnlockCloseBtn');
      const folderUnlockForm = document.getElementById('folderUnlockForm');
      if (folderUnlockCloseBtn) {
        folderUnlockCloseBtn.onclick = () => {
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.closeFolderUnlockModal();
        };
      }
      if (folderUnlockForm) {
        folderUnlockForm.onsubmit = (e) => {
          e.preventDefault();
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.unlockFolder();
        };
      }

      const folderSettingsCloseBtn = document.getElementById('folderSettingsCloseBtn');
      const folderSettingsForm = document.getElementById('folderSettingsForm');
      if (folderSettingsCloseBtn) {
        folderSettingsCloseBtn.onclick = () => {
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.closeFolderSettingsModal();
        };
      }
      if (folderSettingsForm) {
        folderSettingsForm.onsubmit = (e) => {
          e.preventDefault();
          const inst = this.activeModalInstance || this.getActiveInstance();
          if (inst) inst.saveFolderSettings();
        };
      }
    }

    t(key, params = {}) {
      if (window.desktop && typeof window.desktop.t === 'function') {
        return window.desktop.t(key, params);
      }
      if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
        return window.sys.i18n.t(key, params);
      }
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, params);
      }
      return key;
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Instantiate Explorer Application Manager
  document.addEventListener('DOMContentLoaded', () => {
    window.explorerApp = new ExplorerApp();
  });

})(window);
