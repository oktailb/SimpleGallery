/**
 * SimpleGallery 2026 - Vanilla JS Client Application
 * Includes Interactive Image Explorer Engine (Zoom, Pan/Drag, Rotation, Touch & Shortcuts)
 */

class SimpleGallery {
  constructor() {
    this.state = {
      currentPath: '',
      viewMode: localStorage.getItem('gallery_view_mode') || 'polaroid',
      filterCategory: 'all',
      sortBy: 'name',
      searchQuery: '',
      directories: [],
      files: [],
      filteredFiles: [],
      lightboxIndex: null,
      overrides: null,
      isAdmin: false,
      adminEnabled: false
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

      // Media Comment Modal
      lightboxEditCommentBtn: document.getElementById('lightboxEditCommentBtn'),
      mediaCommentModal: document.getElementById('mediaCommentModal'),
      mediaCommentCloseBtn: document.getElementById('mediaCommentCloseBtn'),
      mediaCommentForm: document.getElementById('mediaCommentForm'),
      mediaCommentFilename: document.getElementById('mediaCommentFilename'),
      mediaCommentFilenameLabel: document.getElementById('mediaCommentFilenameLabel'),
      mediaCommentInput: document.getElementById('mediaCommentInput')
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
      this.applyFilterAndRender();
    });

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
    if (this.el.folderSettingsForm) {
      this.el.folderSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveFolderSettings();
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
                          (this.el.adminModal && this.el.adminModal.classList.contains('open'));

      if (isInputFocused || isModalOpen) {
        if (e.key === 'Escape') {
          if (this.el.mediaCommentModal && this.el.mediaCommentModal.classList.contains('open')) {
            this.closeMediaCommentModal();
          } else if (this.el.folderSettingsModal && this.el.folderSettingsModal.classList.contains('open')) {
            this.closeFolderSettingsModal();
          } else if (this.el.adminModal && this.el.adminModal.classList.contains('open')) {
            this.closeAdminModal();
          }
        }
        return;
      }

      if (!this.el.lightbox.classList.contains('open')) return;

      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
      if (e.key === 'ArrowRight') this.navigateLightbox(1);
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.toggleFullscreen(); }

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
        alert(json.error || 'Failed to load directory');
        this.showLoading(false);
        return;
      }

      this.state.directories = json.directories;
      this.state.files = json.files;
      this.state.overrides = json.overrides || {};
      this.state.isAdmin = !!json.is_admin;
      this.state.adminEnabled = !!json.admin_enabled;

      this.updateAdminUI();
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

    if (overrides.description || this.state.isAdmin) {
      if (!this.el.folderDescBanner) {
        this.el.folderDescBanner = document.createElement('div');
        this.el.folderDescBanner.id = 'folderDescBanner';
        this.el.folderDescBanner.className = 'folder-desc-banner';
        const container = document.querySelector('.gallery-container');
        if (container) container.insertBefore(this.el.folderDescBanner, container.firstChild);
      }
      if (overrides.description) {
        this.el.folderDescBanner.innerHTML = `
          💬 <span style="flex:1;">${this.escapeHtml(overrides.description)}</span>
          ${this.state.isAdmin ? `<button class="edit-dotfile-btn" title="Edit description (.desc)">✏️ Edit Banner</button>` : ''}
        `;
        this.el.folderDescBanner.style.display = 'flex';
      } else if (this.state.isAdmin) {
        this.el.folderDescBanner.innerHTML = `
          💬 <span style="flex:1;color:var(--text-muted);font-style:italic;">No description banner set (.desc)</span>
          <button class="edit-dotfile-btn" title="Add description (.desc)">➕ Add Description</button>
        `;
        this.el.folderDescBanner.style.display = 'flex';
      }

      const editBtn = this.el.folderDescBanner.querySelector('.edit-dotfile-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openFolderSettingsModal();
        });
      }
    } else if (this.el.folderDescBanner) {
      this.el.folderDescBanner.style.display = 'none';
    }

    if (overrides.theme) {
      if (typeof overrides.theme === 'object') {
        Object.entries(overrides.theme).forEach(([key, val]) => {
          const cssVar = key.startsWith('--') ? key : `--${key.replace('_', '-')}`;
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

  renderBreadcrumbs(crumbs) {
    this.el.breadcrumbs.innerHTML = crumbs.map((crumb, idx) => {
      const isLast = idx === crumbs.length - 1;
      if (isLast) {
        return `<span class="crumb-item crumb-active">${crumb.name}</span>`;
      }
      return `
        <a href="?dir=${encodeURIComponent(crumb.path)}" class="crumb-item" data-path="${crumb.path}">
          ${crumb.name}
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
  }

  renderFolders(folders) {
    if (folders.length === 0) {
      this.el.folderSection.style.display = 'none';
      return;
    }

    this.el.folderSection.style.display = 'block';
    this.el.foldersGrid.innerHTML = folders.map(folder => `
      <a href="?dir=${encodeURIComponent(folder.path)}" class="folder-card" data-path="${folder.path}">
        <div class="folder-icon-wrapper">
          ${folder.cover ? `<img src="${folder.cover}" alt="${this.escapeHtml(folder.name)}" class="folder-cover-img" loading="lazy" />` : '📁'}
        </div>
        <div class="folder-name">${this.escapeHtml(folder.name)}</div>
        <div class="folder-meta">
          <span>${folder.item_count} ${folder.item_count === 1 ? 'item' : 'items'}</span>
        </div>
        ${folder.comment ? `<div class="folder-comment">💬 ${this.escapeHtml(folder.comment)}</div>` : ''}
      </a>
    `).join('');

    this.el.foldersGrid.querySelectorAll('.folder-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(card.dataset.path);
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
      if (this.state.sortBy === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true });
      if (this.state.sortBy === 'date') return b.mtime - a.mtime;
      if (this.state.sortBy === 'size') return b.size - a.size;
      return 0;
    });

    this.state.filteredFiles = list;
    this.updateStats();
    this.renderMedia();
  }

  updateStats() {
    const fileCount = this.state.filteredFiles.length;
    const folderCount = this.state.directories.length;
    this.el.galleryStats.textContent = `${folderCount} folders, ${fileCount} files`;
  }

  renderMedia() {
    const list = this.state.filteredFiles;

    if (list.length === 0 && this.state.directories.length === 0) {
      this.el.emptyState.style.display = 'block';
      this.el.mediaGrid.style.display = 'none';
      return;
    }

    this.el.emptyState.style.display = 'none';
    this.el.mediaGrid.style.display = 'grid';

    if (this.state.viewMode === 'polaroid') {
      this.el.mediaGrid.className = 'polaroid-grid';
      this.el.mediaGrid.innerHTML = list.map((file, idx) => `
        <div class="polaroid-card" data-index="${idx}">
          <div class="polaroid-img-wrapper">
            <img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" />
            <span class="polaroid-badge">${file.extension.toUpperCase()}</span>
          </div>
          <div class="polaroid-caption">
            <span>${this.escapeHtml(file.comment || file.name)}</span>
            ${this.state.isAdmin ? `<button class="edit-media-comment-btn" data-filename="${this.escapeHtml(file.name)}" data-comment="${this.escapeHtml(file.comment || '')}" title="Edit legend (.comment)">✏️</button>` : ''}
          </div>
          <div class="polaroid-subcaption">${file.name} • ${file.size_formatted}</div>
        </div>
      `).join('');
    } else {
      this.el.mediaGrid.className = 'modern-grid';
      this.el.mediaGrid.innerHTML = list.map((file, idx) => `
        <div class="grid-card" data-index="${idx}">
          <div class="grid-img-wrapper">
            <img src="${file.thumb_url}" alt="${this.escapeHtml(file.name)}" loading="lazy" />
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
      `).join('');
    }

    this.el.mediaGrid.querySelectorAll('.edit-media-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const filename = btn.dataset.filename;
        const comment = btn.dataset.comment;
        this.openMediaCommentModal(filename, comment);
      });
    });

    this.el.mediaGrid.querySelectorAll('[data-index]').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.index, 10);
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

    if (this.el.lightboxComment) {
      if (file.comment) {
        this.el.lightboxComment.textContent = `💬 ${file.comment}`;
        this.el.lightboxComment.style.display = 'block';
      } else {
        this.el.lightboxComment.style.display = 'none';
      }
    }

    this.resetZoom();

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

  adjustZoom(delta) {
    if (!this.isCurrentMediaImage()) return;
    let newScale = Math.min(Math.max(1, this.zoomState.scale + delta), 5);
    newScale = Math.round(newScale * 100) / 100;

    if (newScale === 1) {
      this.zoomState.translateX = 0;
      this.zoomState.translateY = 0;
    }

    this.zoomState.scale = newScale;
    this.updateExplorerTransform(true);
  }

  rotateImage() {
    if (!this.isCurrentMediaImage()) return;
    this.zoomState.rotation = (this.zoomState.rotation + 90) % 360;
    this.updateExplorerTransform(true);
  }

  startDrag(e) {
    if (!this.isCurrentMediaImage()) return;
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
    if (!this.zoomState.isDragging || !this.isCurrentMediaImage()) return;
    e.preventDefault();
    this.zoomState.translateX = e.clientX - this.zoomState.startX;
    this.zoomState.translateY = e.clientY - this.zoomState.startY;
    this.updateExplorerTransform(false);
  }

  doTouchDrag(e) {
    if (this.isCurrentMediaImage() && this.zoomState.scale > 1 && this.zoomState.isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      this.zoomState.translateX = touch.clientX - this.zoomState.startX;
      this.zoomState.translateY = touch.clientY - this.zoomState.startY;
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
      if (this.el.lightboxEditCommentBtn) this.el.lightboxEditCommentBtn.style.display = 'inline-flex';
    } else {
      this.el.adminBtn.classList.remove('admin-active');
      if (this.el.adminBtnIcon) this.el.adminBtnIcon.textContent = '🔑';
      if (this.el.adminBtnText) this.el.adminBtnText.textContent = 'Admin';
      if (this.el.adminLoginState) this.el.adminLoginState.style.display = 'block';
      if (this.el.adminActiveState) this.el.adminActiveState.style.display = 'none';
      if (this.el.folderSettingsBtn) this.el.folderSettingsBtn.style.display = 'none';
      if (this.el.lightboxEditCommentBtn) this.el.lightboxEditCommentBtn.style.display = 'none';
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password })
      });
      const json = await res.json();

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
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

  async changeAdminPassword() {
    const new_password = this.el.newAdminPasswordInput.value;
    if (!new_password) return;

    try {
      const res = await fetch('api.php?action=change_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', new_password })
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

  async updateDotfile(type, value, filename = '') {
    try {
      const res = await fetch('api.php?action=update_dotfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_dotfile',
          dir: this.state.currentPath,
          type,
          value,
          filename
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
      this.el.dotfileThemeSelect.value = typeof overrides.theme === 'string' ? overrides.theme : '';
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

    this.showLoading(true);
    const results = await Promise.all([
      this.updateDotfile('title', titleVal),
      this.updateDotfile('description', descVal),
      this.updateDotfile('bg', bgVal),
      this.updateDotfile('theme', themeVal)
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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.galleryApp = new SimpleGallery();
});
