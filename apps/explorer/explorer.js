/**
 * SimpleGallery 2026 - Explorer Application (apps/explorer/explorer.js)
 * Fully modular and autonomous Gallery Explorer.
 * Manages file/folder state, navigation, views, drag & drop, selection, search, and admin explorer tools.
 */
(function(window) {
  'use strict';

  // -------------------------------------------------------------
  // EXPLORER CORE APPLICATION CLASS
  // -------------------------------------------------------------
  class ExplorerApp {
    constructor() {
      this.state = {
        currentPath: '',
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
      this.emptyDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

      if (window.WindowManager) window.WindowManager.init();
      if (window.MenuBarManager) window.MenuBarManager.init('appHeaderZone');

      this.initElements();
      this.loadSavedPreferences();
      this.bindMenuBar();
      this.bindEvents();
      this.initMarqueeSelection();
      this.handleUrlChange();
    }

    initElements() {
      this.el = {
        folderSection: document.getElementById('folderSection'),
        foldersGrid: document.getElementById('foldersGrid'),
        mediaSection: document.getElementById('mediaSection'),
        mediaGrid: document.getElementById('mediaGrid'),
        loadingState: document.getElementById('loadingState'),
        emptyState: document.getElementById('emptyState'),
        filterPills: document.getElementById('filterPills'),
        galleryStats: document.getElementById('galleryStats'),
        folderMapBtn: document.getElementById('folderMapBtn'),
        searchResultsBanner: document.getElementById('searchResultsBanner'),
        searchResultsCountText: document.getElementById('searchResultsCountText'),
        exitSearchBtn: document.getElementById('exitSearchBtn'),
        dropZoneOverlay: document.getElementById('dropZoneOverlay'),
        selectionToolbar: document.getElementById('selectionToolbar'),
        selectionToolbarCount: document.getElementById('selectionToolbarCount'),
        selectionSelectAllBtn: document.getElementById('selectionSelectAllBtn'),
        selectionClearBtn: document.getElementById('selectionClearBtn'),
        // Modals
        mapModal: document.getElementById('mapModal'),
        mapModalCloseBtn: document.getElementById('mapModalCloseBtn'),
        mapModalCountBadge: document.getElementById('mapModalCountBadge'),
        mapSmartGpsCount: document.getElementById('mapSmartGpsCount'),
        mapToggleSmartGpsBtn: document.getElementById('mapToggleSmartGpsBtn'),
        mapToggleRouteBtn: document.getElementById('mapToggleRouteBtn'),
        mapFitBoundsBtn: document.getElementById('mapFitBoundsBtn'),
        galleryLeafletMap: document.getElementById('galleryLeafletMap'),
        searchModal: document.getElementById('searchModal'),
        searchModalCloseBtn: document.getElementById('searchModalCloseBtn'),
        searchAdvancedForm: document.getElementById('searchAdvancedForm'),
        advSearchTiming: document.getElementById('advSearchTiming'),
        advSearchCustomDateRow: document.getElementById('advSearchCustomDateRow'),
        advSearchResetBtn: document.getElementById('advSearchResetBtn'),
        createFolderModal: document.getElementById('createFolderModal'),
        createFolderCloseBtn: document.getElementById('createFolderCloseBtn'),
        createFolderForm: document.getElementById('createFolderForm'),
        newFolderNameInput: document.getElementById('newFolderNameInput'),
        deleteConfirmModal: document.getElementById('deleteConfirmModal'),
        deleteConfirmCloseBtn: document.getElementById('deleteConfirmCloseBtn'),
        deleteCancelBtn: document.getElementById('deleteCancelBtn'),
        deleteConfirmActionBtn: document.getElementById('deleteConfirmActionBtn'),
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
        folderDescBanner: document.getElementById('folderDescBanner')
      };
    }

    loadSavedPreferences() {
      try {
        const savedView = localStorage.getItem('gallery_view_mode');
        if (savedView) this.state.viewMode = savedView;
        const savedFavs = JSON.parse(localStorage.getItem('sg_favorites') || '[]');
        this.state.favorites = Array.isArray(savedFavs) ? savedFavs : [];
      } catch (e) {}
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
    // CONTEXTUAL TOP MENUBAR INTEGRATION (macOS Style)
    // -------------------------------------------------------------
    bindMenuBar() {
      if (!window.MenuBarManager) return;

      window.MenuBarManager.registerAppMenu('explorer', (container) => {
        container.innerHTML = `
          <div class="explorer-header-bar">
            <!-- Breadcrumbs Nav -->
            <nav id="breadcrumbs" class="breadcrumbs" aria-label="Breadcrumb Navigation">
              <span class="crumb-item crumb-active">${this.escapeHtml(this.state.galleryTitle)}</span>
            </nav>

            <!-- Search Box -->
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="searchInput" class="search-input" placeholder="${this.escapeHtml(this.t('nav.search_placeholder') || 'Rechercher des médias...')}" value="${this.escapeHtml(this.state.searchQuery || '')}" aria-label="Rechercher des médias">
              <button type="button" id="searchClearBtn" class="search-clear-btn" title="${this.escapeHtml(this.t('nav.search_clear') || 'Effacer la recherche')}" style="${this.state.searchQuery ? 'display:inline-flex;' : 'display:none;'}">✕</button>
              <button type="button" id="advancedSearchBtn" class="search-filter-btn" title="${this.escapeHtml(this.t('nav.search_advanced') || 'Options de recherche avancée')}">
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
                <option value="name" ${this.state.sortBy === 'name' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.name') || 'Nom')}</option>
                <option value="exif_date" ${this.state.sortBy === 'exif_date' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.date') || 'Date prise de vue 📷')}</option>
                <option value="date" ${this.state.sortBy === 'date' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.mtime') || 'Date modif')}</option>
                <option value="size" ${this.state.sortBy === 'size' ? 'selected' : ''}>${this.escapeHtml(this.t('sort.size') || 'Taille')}</option>
              </select>
              <button id="sortOrderBtn" class="btn-toggle" title="${this.escapeHtml(this.t('sort.order_asc') || 'Inverser l\'ordre')}">
                <span id="sortOrderIcon" style="font-size:1.1rem;font-weight:bold;">${this.state.sortOrder === 'asc' ? '⇧' : '⇩'}</span>
              </button>
            </div>

            <!-- Favorites Toggle -->
            <button id="toggleFavoritesBtn" class="btn-toggle ${this.state.showFavoritesOnly ? 'active' : ''}" title="${this.escapeHtml(this.t('nav.favorites') || 'Favoris')}">
              <span>❤️</span><span id="favCountBadge" class="fav-count-badge" style="${this.state.favorites.length > 0 ? 'display:inline-flex;' : 'display:none;'}">${this.state.favorites.length}</span>
            </button>

            <!-- Archive Dropdown -->
            <div class="archive-dropdown-container" id="archiveDropdownContainer" style="${(this.state.userRights && this.state.userRights.can_download_archive === false && !this.state.isAdmin) ? 'display:none;' : 'display:inline-flex;'}">
              <button id="downloadArchiveBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.download_archive') || 'Télécharger archive')}">
                <span>⇲</span> ▾
              </button>
              <div id="archiveMenu" class="archive-dropdown-menu"></div>
            </div>

            <!-- View Mode Selector Dropdown -->
            <div class="view-selector-container" id="viewSelectorContainer">
              <button type="button" id="viewSelectorBtn" class="btn-toggle view-btn" title="${this.escapeHtml(this.t('view.switch_mode') || 'Mode d\'affichage')}">
                <span id="currentViewIcon">${this.getViewModeIcon(this.state.viewMode)}</span>
                <span id="currentViewLabel">${this.getViewModeLabel(this.state.viewMode)}</span>
                <span class="view-dropdown-arrow">▾</span>
              </button>
              <div id="viewDropdownMenu" class="view-dropdown-menu" style="display: none;">
                ${((window.GalleryViewRegistry && window.GalleryViewRegistry.getAll()) || []).map(v => `
                  <button type="button" class="view-option-btn ${this.state.viewMode === v.id ? 'active' : ''}" data-view-mode="${v.id}">
                    <span>${v.icon || '🖼️'}</span> <span>${this.escapeHtml(this.t(v.nameKey) || v.name || v.id)}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Folder & Upload Actions -->
            <button id="createFolderBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.create_folder') || 'Créer un nouveau sous-dossier')}" style="${(this.state.isAdmin || (this.state.userRights && this.state.userRights.can_create_folder)) ? 'display:inline-flex;' : 'display:none;'}">
              <span>📁+</span>
            </button>
            <button id="uploadMediaBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.upload_media') || 'Uploader des médias')}" style="${(this.state.isAdmin || (this.state.userRights && this.state.userRights.can_upload)) ? 'display:inline-flex;' : 'display:none;'}">
              <span>📤</span>
            </button>
            <input type="file" id="uploadFileInput" multiple style="display: none;" />
            <button id="folderSettingsBtn" class="btn-toggle" title="${this.escapeHtml(this.t('nav.folder_settings') || 'Paramètres du dossier')}" style="${this.state.isAdmin ? 'display:inline-flex;' : 'display:none;'}">
              <span>⚙</span>
            </button>
          </div>
        `;

        this.bindMenuBarEvents();
        if (this.state.currentBreadcrumbs) {
          this.renderBreadcrumbs(this.state.currentBreadcrumbs);
        }
        this.updateArchiveMenuUI();
      });

      window.MenuBarManager.restoreDefaultMenu();
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
      const viewDropdownMenu = document.getElementById('viewDropdownMenu');
      const createFolderBtn = document.getElementById('createFolderBtn');
      const uploadMediaBtn = document.getElementById('uploadMediaBtn');
      const uploadFileInput = document.getElementById('uploadFileInput');
      const folderSettingsBtn = document.getElementById('folderSettingsBtn');

      if (searchInput) {
        searchInput.oninput = (e) => {
          this.state.searchQuery = e.target.value.toLowerCase();
          if (searchClearBtn) {
            searchClearBtn.style.display = e.target.value ? 'flex' : 'none';
          }
          this.applyFilterAndRender();
        };
      }

      if (searchClearBtn) {
        searchClearBtn.onclick = () => this.exitSearch();
      }

      if (advSearchBtn) {
        advSearchBtn.onclick = () => this.openSearchModal();
      }

      if (sortSelect) {
        sortSelect.onchange = (e) => {
          this.state.sortBy = e.target.value;
          this.state.sortOrder = ['date', 'exif_date', 'size'].includes(e.target.value) ? 'desc' : 'asc';
          this.saveFolderSort(this.state.currentPath, this.state.sortBy, this.state.sortOrder);
          this.updateSortOrderUI();
          this.applyFilterAndRender();
        };
      }

      if (sortOrderBtn) {
        sortOrderBtn.onclick = () => this.toggleSortOrder();
      }

      if (toggleFavBtn) {
        toggleFavBtn.onclick = () => this.toggleFavoritesFilter();
      }

      if (dlArchiveBtn) {
        dlArchiveBtn.onclick = (e) => {
          e.stopPropagation();
          this.toggleArchiveMenu();
        };
      }

      if (viewSelectorBtn) {
        viewSelectorBtn.onclick = (e) => {
          e.stopPropagation();
          this.toggleViewDropdown();
        };
      }

      this.updateViewDropdownUI();

      if (createFolderBtn) createFolderBtn.onclick = () => this.openCreateFolderModal();
      if (uploadMediaBtn) uploadMediaBtn.onclick = () => { if (uploadFileInput) uploadFileInput.click(); };
      if (uploadFileInput) {
        uploadFileInput.onchange = (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.handleUploadFiles(e.target.files);
          }
        };
      }
      if (folderSettingsBtn) folderSettingsBtn.onclick = () => this.openFolderSettingsModal();
    }

    updateViewDropdownUI() {
      const menu = document.getElementById('viewDropdownMenu');
      const icon = document.getElementById('currentViewIcon');
      const label = document.getElementById('currentViewLabel');
      if (icon) icon.textContent = this.getViewModeIcon(this.state.viewMode);
      if (label) label.textContent = this.getViewModeLabel(this.state.viewMode);

      if (!menu) return;
      const views = (window.GalleryViewRegistry && window.GalleryViewRegistry.getAll()) || [];
      if (views.length === 0) return;

      menu.innerHTML = views.map(v => `
        <button type="button" class="view-option-btn ${this.state.viewMode === v.id ? 'active' : ''}" data-view-mode="${v.id}">
          <span>${v.icon || '🖼️'}</span> <span>${this.escapeHtml(this.t(v.nameKey) || v.name || v.id)}</span>
        </button>
      `).join('');

      menu.querySelectorAll('.view-option-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const mode = btn.dataset.viewMode;
          if (mode) {
            this.setViewMode(mode);
            this.closeViewDropdown();
          }
        };
      });
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
      const isVisible = menu.style.display === 'flex';
      menu.style.display = isVisible ? 'none' : 'flex';
    }

    closeViewDropdown() {
      const menu = document.getElementById('viewDropdownMenu');
      if (menu) menu.style.display = 'none';
    }

    setViewMode(mode) {
      this.state.viewMode = mode;
      try {
        localStorage.setItem('gallery_view_mode', mode);
      } catch (e) {}

      this.updateViewDropdownUI();
      this.renderMedia();
    }

    // -------------------------------------------------------------
    // NAVIGATION & DIRECTORY LOADING
    // -------------------------------------------------------------
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
        if (this.el.searchResultsBanner) this.el.searchResultsBanner.style.display = 'none';

        this.state.directories = json.directories || [];
        this.state.files = json.files || [];
        this.state.overrides = json.overrides || {};
        this.state.isAdmin = !!json.is_admin;
        this.state.adminEnabled = !!json.admin_enabled;
        this.state.userRights = json.user_rights || {};
        if (json.available_archives) this.state.availableArchives = json.available_archives;

        // Apply folder theme / background overrides
        if (window.desktop && typeof window.desktop.applyDotfileOverrides === 'function') {
          window.desktop.applyDotfileOverrides(this.state.overrides);
        }

        // Restore per-folder persistent sort
        const savedSort = this.getFolderSort(dirPath);
        if (savedSort && savedSort.sortBy) {
          this.state.sortBy = savedSort.sortBy;
          this.state.sortOrder = savedSort.sortOrder || 'asc';
        } else {
          this.state.sortBy = 'name';
          this.state.sortOrder = 'asc';
        }

        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.value = this.state.sortBy;
        this.updateSortOrderUI();

        this.renderBreadcrumbs(json.breadcrumbs || []);
        this.renderFolders(json.directories || []);
        this.updateArchiveMenuUI();

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

    renderBreadcrumbs(crumbs) {
      this.state.currentBreadcrumbs = crumbs;
      const nav = document.getElementById('breadcrumbs');
      if (!nav) return;

      nav.innerHTML = crumbs.map((crumb, idx) => {
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

      nav.querySelectorAll('a[data-path]').forEach(link => {
        link.onclick = (e) => {
          e.preventDefault();
          this.navigateTo(link.dataset.path);
        };
      });
    }

    renderFolders(folders) {
      if (!this.el.folderSection || !this.el.foldersGrid) return;

      if (!folders || folders.length === 0) {
        this.el.folderSection.style.display = 'none';
        this.el.foldersGrid.innerHTML = '';
        return;
      }

      this.el.folderSection.style.display = 'block';
      this.el.foldersGrid.innerHTML = folders.map(folder => {
        const badge = folder.is_protected ? '<span class="folder-badge lock-badge">🔒</span>' : '';
        const isDraggable = this.state.isAdmin ? 'true' : 'false';
        const handleClass = this.state.isAdmin ? 'drag-handle' : '';
        const deleteBtnHtml = this.state.isAdmin ? `<button class="delete-item-btn" data-path="${folder.path}" data-name="${this.escapeHtml(folder.name)}" data-type="folder" title="${this.escapeHtml(this.t('folder.delete_title'))}">🗑️</button>` : '';

        return `
          <a href="?dir=${encodeURIComponent(folder.path)}" class="folder-card ${handleClass} ${folder.is_protected && !folder.is_unlocked && !this.state.isAdmin ? 'protected-card' : ''}" data-path="${folder.path}" data-protected="${folder.is_protected ? '1' : '0'}" data-unlocked="${folder.is_unlocked ? '1' : '0'}" draggable="${isDraggable}">
            ${deleteBtnHtml}
            ${badge}
            <div class="folder-icon-wrapper">
              ${folder.is_protected && !folder.is_unlocked && !this.state.isAdmin ? '<div class="folder-lock-icon">🔒</div>' : (folder.cover ? `<img src="${folder.cover}" alt="${this.escapeHtml(folder.name)}" class="folder-cover-img" loading="lazy" draggable="false" />` : '📁')}
            </div>
            <div class="folder-name">${this.escapeHtml(folder.name)}</div>
            <div class="folder-meta">
              <span>${this.escapeHtml(this.t('folder.items_count', { count: folder.item_count }))}</span>
            </div>
            ${folder.comment ? `<div class="folder-comment">💬 ${this.escapeHtml(folder.comment)}</div>` : ''}
          </a>
        `;
      }).join('');

      this.el.foldersGrid.querySelectorAll('.folder-card').forEach(card => {
        const folderPath = card.dataset.path;

        card.onclick = (e) => {
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
            <button type="button" class="pill-btn active" style="margin-top: 1rem;" onclick="window.explorerApp.setFilterCategory('all')">
              ${this.escapeHtml(this.t('view.filter_all'))}
            </button>
          `;
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

      const context = {
        t: this.t.bind(this),
        escapeHtml: this.escapeHtml.bind(this),
        isAdmin: this.state.isAdmin,
        userRights: this.state.userRights,
        favorites: this.state.favorites,
        smartLocationsMap: smartLocationsMap,
        isDraggable: this.state.isAdmin ? 'true' : 'false',
        handleClass: this.state.isAdmin ? 'drag-handle' : ''
      };

      const viewPlugin = (window.GalleryViewRegistry && window.GalleryViewRegistry.get(this.state.viewMode))
        || (window.GalleryViewRegistry && window.GalleryViewRegistry.get('polaroid'))
        || (window.GalleryViewRegistry && window.GalleryViewRegistry.getAll()[0]);

      if (viewPlugin) {
        this.el.mediaGrid.className = viewPlugin.containerClass || 'polaroid-grid';
        if (typeof viewPlugin.renderContainer === 'function') {
          this.el.mediaGrid.innerHTML = viewPlugin.renderContainer(list, context);
        } else if (typeof viewPlugin.renderItem === 'function') {
          this.el.mediaGrid.innerHTML = list.map((file, idx) => viewPlugin.renderItem(file, idx, context)).join('');
        }
      }

      this.bindMediaCardEvents();
    }

    bindMediaCardEvents() {
      if (!this.el.mediaGrid) return;

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
      this.updateSortOrderUI();
      this.applyFilterAndRender();
    }

    saveFolderSort(dirPath, sortBy, sortOrder) {
      try {
        const sorts = JSON.parse(localStorage.getItem('sg_folder_sorts') || '{}');
        sorts[dirPath || '__root__'] = { sortBy, sortOrder };
        localStorage.setItem('sg_folder_sorts', JSON.stringify(sorts));
      } catch (e) {}
    }

    getFolderSort(dirPath) {
      try {
        const sorts = JSON.parse(localStorage.getItem('sg_folder_sorts') || '{}');
        return sorts[dirPath || '__root__'] || null;
      } catch (e) {
        return null;
      }
    }

    updateSortOrderUI() {
      const icon = document.getElementById('sortOrderIcon');
      const btn = document.getElementById('sortOrderBtn');
      if (icon) icon.textContent = (this.state.sortOrder === 'asc') ? '⇧' : '⇩';
      if (btn) btn.classList.toggle('active', this.state.sortOrder === 'asc');
    }

    toggleFavorite(filePath) {
      const idx = this.state.favorites.indexOf(filePath);
      if (idx !== -1) {
        this.state.favorites.splice(idx, 1);
        this.showToast(this.t('lightbox.favorite_removed') || 'Retiré des favoris', 'info');
      } else {
        this.state.favorites.push(filePath);
        this.showToast(this.t('lightbox.favorite_added') || 'Ajouté aux favoris', 'success');
      }
      try {
        localStorage.setItem('sg_favorites', JSON.stringify(this.state.favorites));
      } catch (e) {}

      this.updateFavoritesCountUI();
      this.applyFilterAndRender();
    }

    toggleFavoritesFilter() {
      this.state.showFavoritesOnly = !this.state.showFavoritesOnly;
      const btn = document.getElementById('toggleFavoritesBtn');
      if (btn) btn.classList.toggle('active', this.state.showFavoritesOnly);
      this.applyFilterAndRender();
    }

    updateFavoritesCountUI() {
      const badge = document.getElementById('favCountBadge');
      if (!badge) return;
      const count = this.state.favorites.length;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
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
      if (!this.el.galleryStats) return;
      this.el.galleryStats.textContent = this.t('stats.summary', {
        folders: this.state.directories.length,
        files: this.state.filteredFiles.length
      });
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
        this.el.selectionToolbarCount.textContent = `${count} élément(s) sélectionné(s)`;
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
    }

    initMarqueeSelection() {
      let isSelecting = false;
      let startX = 0, startY = 0;
      let marqueeEl = null;

      document.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, a, select, .explorer-header-bar, .admin-modal, .selection-toolbar, .webos-window')) return;
        if (!this.el.mediaGrid) return;

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
            if (file) {
              if (intersects) {
                this.state.selectedPaths.add(file.path);
              }
            }
          });
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
    // ARCHIVE DOWNLOAD DROPDOWN
    // -------------------------------------------------------------
    toggleArchiveMenu() {
      const menu = document.getElementById('archiveMenu');
      if (!menu) return;
      menu.classList.toggle('open');
    }

    updateHeaderActionButtons() {
      const canDownloadArchive = this.state.isAdmin || (this.state.userRights ? this.state.userRights.can_download_archive !== false : true);
      const canUpload = this.state.isAdmin || (this.state.userRights ? this.state.userRights.can_upload === true : false);
      const canCreateFolder = this.state.isAdmin || (this.state.userRights ? this.state.userRights.can_create_folder === true : false);
      const isAdmin = this.state.isAdmin;

      const archiveContainer = document.getElementById('archiveDropdownContainer');
      if (archiveContainer) {
        archiveContainer.style.display = canDownloadArchive ? 'inline-flex' : 'none';
      }

      const createFolderBtn = document.getElementById('createFolderBtn');
      if (createFolderBtn) {
        createFolderBtn.style.display = canCreateFolder ? 'inline-flex' : 'none';
      }

      const uploadMediaBtn = document.getElementById('uploadMediaBtn');
      if (uploadMediaBtn) {
        uploadMediaBtn.style.display = canUpload ? 'inline-flex' : 'none';
      }

      const folderSettingsBtn = document.getElementById('folderSettingsBtn');
      if (folderSettingsBtn) {
        folderSettingsBtn.style.display = isAdmin ? 'inline-flex' : 'none';
      }
    }

    updateArchiveMenuUI() {
      this.updateHeaderActionButtons();
      const menu = document.getElementById('archiveMenu');
      if (!menu) return;
      const currentDir = encodeURIComponent(this.state.currentPath || '');
      const archives = this.state.availableArchives || {};

      let itemsHtml = '';

      if (Array.isArray(archives) && archives.length > 0) {
        itemsHtml = archives.map(arch => `
          <a href="${arch.url || `archive.php?dir=${currentDir}&format=${arch.format || 'zip'}`}" download class="archive-menu-item">
            <span>📦</span> <span>${this.escapeHtml(arch.name || `Télécharger (${(arch.format || 'ZIP').toUpperCase()})`)}</span>
          </a>
        `).join('');
      } else if (archives && typeof archives === 'object' && Object.keys(archives).length > 0) {
        itemsHtml = Object.keys(archives).map(fmt => {
          const label = fmt.toUpperCase();
          return `
            <a href="archive.php?dir=${currentDir}&format=${encodeURIComponent(fmt)}" download class="archive-menu-item">
              <span>📦</span> <span>Télécharger le dossier (${this.escapeHtml(label)})</span>
            </a>
          `;
        }).join('');
      } else {
        itemsHtml = `
          <a href="archive.php?dir=${currentDir}&format=zip" download class="archive-menu-item">
            <span>📦</span> <span>Télécharger le dossier (ZIP)</span>
          </a>
        `;
      }

      menu.innerHTML = itemsHtml;
    }

    // -------------------------------------------------------------
    // GPS MAP & SMART SMART GPS
    // -------------------------------------------------------------
    computeSmartGpsLocations(files) {
      if (!files || files.length === 0) return [];
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
      if (!this.el.folderMapBtn) return;
      const mapped = this.computeSmartGpsLocations(this.state.filteredFiles);
      if (mapped.length === 0) {
        this.el.folderMapBtn.style.display = 'none';
        return;
      }
      this.el.folderMapBtn.innerHTML = `🗺️ ${this.t('nav.map') || 'Carte GPS'} (${mapped.length})`;
      this.el.folderMapBtn.style.display = 'inline-flex';
    }

    openMapModal(focusPath = null) {
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
        this.leafletMap = window.L.map('galleryLeafletMap', { zoomControl: true });
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
      if (!this.state.isAdmin || !this.el.createFolderModal) return;
      this.el.createFolderModal.style.display = 'block';
      this.el.createFolderModal.classList.add('open');
      if (this.el.newFolderNameInput) {
        this.el.newFolderNameInput.value = '';
        setTimeout(() => this.el.newFolderNameInput.focus(), 50);
      }
    }

    closeCreateFolderModal() {
      if (!this.el.createFolderModal) return;
      this.el.createFolderModal.style.display = 'none';
      this.el.createFolderModal.classList.remove('open');
    }

    async createFolder() {
      if (!this.el.newFolderNameInput) return;
      const name = this.el.newFolderNameInput.value.trim();
      if (!name) return;

      try {
        const formData = new FormData();
        formData.append('action', 'create_folder');
        formData.append('dir', this.state.currentPath);
        formData.append('name', name);

        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          this.closeCreateFolderModal();
          this.showToast(this.t('folder.create_success') || 'Dossier créé avec succès', 'success');
          this.loadDirectory(this.state.currentPath);
        } else {
          this.showToast(json.error || 'Erreur lors de la création', 'error');
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    openDeleteConfirmModal(path, name, type = 'file') {
      this.pendingDeletePath = path;
      this.pendingDeleteType = type;
      if (!this.el.deleteConfirmModal) return;
      if (this.el.deleteConfirmItemName) this.el.deleteConfirmItemName.textContent = name;
      if (this.el.deleteConfirmItemType) this.el.deleteConfirmItemType.textContent = (type === 'folder') ? 'le dossier' : 'le fichier';
      this.el.deleteConfirmModal.style.display = 'block';
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
      const type = this.pendingDeleteType;

      try {
        const formData = new FormData();
        formData.append('action', type === 'folder' ? 'delete_folder' : 'delete_file');
        formData.append(type === 'folder' ? 'folder_path' : 'file_path', path);

        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          this.closeDeleteConfirmModal();
          this.showToast('Élément supprimé avec succès', 'success');
          this.loadDirectory(this.state.currentPath);
        } else {
          this.showToast(json.error || 'Erreur lors de la suppression', 'error');
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    openMediaCommentModal(filename, comment = '') {
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
        const formData = new FormData();
        formData.append('action', 'save_comment');
        formData.append('dir', this.state.currentPath);
        formData.append('filename', this.pendingCommentFilename);
        formData.append('comment', comment);

        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          this.closeMediaCommentModal();
          this.showToast('Légende enregistrée', 'success');
          this.loadDirectory(this.state.currentPath);
        } else {
          this.showToast(json.error || 'Erreur d\'enregistrement', 'error');
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    openFolderUnlockModal(dirPath) {
      if (!this.el.folderUnlockModal) return;
      this.pendingUnlockDirPath = dirPath;
      if (this.el.folderPasswordInput) this.el.folderPasswordInput.value = '';
      if (this.el.folderUnlockError) this.el.folderUnlockError.style.display = 'none';
      this.el.folderUnlockModal.style.display = 'block';
      this.el.folderUnlockModal.classList.add('open');
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
        const formData = new FormData();
        formData.append('action', 'unlock_folder');
        formData.append('dir', this.pendingUnlockDirPath);
        formData.append('password', password);

        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          const unlockedPath = this.pendingUnlockDirPath;
          this.closeFolderUnlockModal();
          this.showToast('Dossier déverrouillé', 'success');
          this.navigateTo(unlockedPath);
        } else {
          if (this.el.folderUnlockError) {
            this.el.folderUnlockError.textContent = json.error || 'Mot de passe incorrect';
            this.el.folderUnlockError.style.display = 'block';
          }
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    openFolderSettingsModal() {
      if (!this.state.isAdmin || !this.el.folderSettingsModal) return;
      const overrides = this.state.overrides || {};
      if (this.el.dotfileTitleInput) this.el.dotfileTitleInput.value = overrides.title || '';
      if (this.el.dotfileDescInput) this.el.dotfileDescInput.value = overrides.description || '';
      if (this.el.dotfileBgInput) this.el.dotfileBgInput.value = overrides.background || '';
      if (this.el.dotfileAccessModeSelect) this.el.dotfileAccessModeSelect.value = overrides.access_mode || 'public';
      if (this.el.folderPasswordGroup) {
        this.el.folderPasswordGroup.style.display = (overrides.access_mode === 'password') ? 'block' : 'none';
      }
      this.el.folderSettingsModal.style.display = 'block';
      this.el.folderSettingsModal.classList.add('open');
    }

    closeFolderSettingsModal() {
      if (!this.el.folderSettingsModal) return;
      this.el.folderSettingsModal.style.display = 'none';
      this.el.folderSettingsModal.classList.remove('open');
    }

    async saveFolderSettings() {
      try {
        const formData = new FormData();
        formData.append('action', 'save_folder_settings');
        formData.append('dir', this.state.currentPath);
        if (this.el.dotfileTitleInput) formData.append('title', this.el.dotfileTitleInput.value.trim());
        if (this.el.dotfileDescInput) formData.append('description', this.el.dotfileDescInput.value.trim());
        if (this.el.dotfileBgInput) formData.append('background', this.el.dotfileBgInput.value.trim());
        if (this.el.dotfileAccessModeSelect) formData.append('access_mode', this.el.dotfileAccessModeSelect.value);
        if (this.el.dotfilePasswordInput) formData.append('password', this.el.dotfilePasswordInput.value);

        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          this.closeFolderSettingsModal();
          this.showToast('Paramètres du dossier enregistrés', 'success');
          this.loadDirectory(this.state.currentPath);
        } else {
          this.showToast(json.error || 'Erreur d\'enregistrement', 'error');
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
      }
    }

    async handleUploadFiles(files) {
      if (!files || files.length === 0) return;
      const formData = new FormData();
      formData.append('action', 'upload_media');
      formData.append('dir', this.state.currentPath);
      for (let i = 0; i < files.length; i++) {
        formData.append('files[]', files[i]);
      }

      this.showToast(`Téléversement de ${files.length} fichier(s)...`, 'info');
      try {
        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          this.showToast('Fichiers téléversés avec succès', 'success');
          this.loadDirectory(this.state.currentPath);
        } else {
          this.showToast(json.error || 'Erreur lors du téléversement', 'error');
        }
      } catch (err) {
        this.showToast(`Erreur: ${err.message}`, 'error');
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
        <button class="pill-btn active" style="margin-top: 1rem;" onclick="window.explorerApp.openFolderUnlockModal('${encodeURIComponent(dirPath)}')">
          ${this.escapeHtml(this.t('stats.folder_unlock_action'))}
        </button>
      `;
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

    // -------------------------------------------------------------
    // GLOBAL EVENTS
    // -------------------------------------------------------------
    bindEvents() {
      window.addEventListener('popstate', () => this.handleUrlChange());

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

      if (this.el.filterPills) {
        this.el.filterPills.onclick = (e) => {
          const pill = e.target.closest('.pill-btn');
          if (pill && pill.dataset.category) {
            this.setFilterCategory(pill.dataset.category);
          }
        };
      }

      if (this.el.folderMapBtn) this.el.folderMapBtn.onclick = () => this.openMapModal();
      if (this.el.mapModalCloseBtn) this.el.mapModalCloseBtn.onclick = () => this.closeMapModal();
      if (this.el.exitSearchBtn) this.el.exitSearchBtn.onclick = () => this.exitSearch();
      if (this.el.selectionSelectAllBtn) this.el.selectionSelectAllBtn.onclick = () => this.selectAll();
      if (this.el.selectionClearBtn) this.el.selectionClearBtn.onclick = () => this.clearSelection();

      // Admin Modal Forms & Closers
      if (this.el.createFolderCloseBtn) this.el.createFolderCloseBtn.onclick = () => this.closeCreateFolderModal();
      if (this.el.createFolderForm) {
        this.el.createFolderForm.onsubmit = (e) => {
          e.preventDefault();
          this.createFolder();
        };
      }

      if (this.el.deleteConfirmCloseBtn) this.el.deleteConfirmCloseBtn.onclick = () => this.closeDeleteConfirmModal();
      if (this.el.deleteCancelBtn) this.el.deleteCancelBtn.onclick = () => this.closeDeleteConfirmModal();
      if (this.el.deleteConfirmActionBtn) this.el.deleteConfirmActionBtn.onclick = () => this.confirmDeleteItem();

      if (this.el.mediaCommentCloseBtn) this.el.mediaCommentCloseBtn.onclick = () => this.closeMediaCommentModal();
      if (this.el.mediaCommentForm) {
        this.el.mediaCommentForm.onsubmit = (e) => {
          e.preventDefault();
          this.saveMediaComment();
        };
      }

      if (this.el.folderUnlockCloseBtn) this.el.folderUnlockCloseBtn.onclick = () => this.closeFolderUnlockModal();
      if (this.el.folderUnlockForm) {
        this.el.folderUnlockForm.onsubmit = (e) => {
          e.preventDefault();
          this.unlockFolder();
        };
      }

      if (this.el.folderSettingsCloseBtn) this.el.folderSettingsCloseBtn.onclick = () => this.closeFolderSettingsModal();
      if (this.el.folderSettingsForm) {
        this.el.folderSettingsForm.onsubmit = (e) => {
          e.preventDefault();
          this.saveFolderSettings();
        };
      }
      if (this.el.dotfileAccessModeSelect) {
        this.el.dotfileAccessModeSelect.onchange = (e) => {
          if (this.el.folderPasswordGroup) {
            this.el.folderPasswordGroup.style.display = (e.target.value === 'password') ? 'block' : 'none';
          }
        };
      }

      if (this.el.searchModalCloseBtn) this.el.searchModalCloseBtn.onclick = () => this.closeSearchModal();
      if (this.el.searchAdvancedForm) {
        this.el.searchAdvancedForm.onsubmit = (e) => {
          e.preventDefault();
          const name = document.getElementById('advSearchName')?.value || '';
          this.state.searchQuery = name.toLowerCase();
          this.closeSearchModal();
          this.applyFilterAndRender();
        };
      }
    }
  }

  // Instantiate Explorer Application
  document.addEventListener('DOMContentLoaded', () => {
    window.explorerApp = new ExplorerApp();
  });

})(window);
