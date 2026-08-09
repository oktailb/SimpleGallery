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
      overrides: null
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
      lightboxPrevBtn: document.getElementById('lightboxPrevBtn'),
      lightboxNextBtn: document.getElementById('lightboxNextBtn'),
      lightboxDownloadBtn: document.getElementById('lightboxDownloadBtn'),

      // Image Explorer Controls
      imageExplorerControls: document.getElementById('imageExplorerControls'),
      lightboxZoomInBtn: document.getElementById('lightboxZoomInBtn'),
      lightboxZoomOutBtn: document.getElementById('lightboxZoomOutBtn'),
      lightboxResetZoomBtn: document.getElementById('lightboxResetZoomBtn'),
      lightboxRotateBtn: document.getElementById('lightboxRotateBtn'),
      zoomBadge: document.getElementById('zoomBadge')
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

    // Lightbox Modal Controls
    this.el.lightboxCloseBtn.addEventListener('click', () => this.closeLightbox());
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
    window.addEventListener('mouseup', () => this.endDrag());

    // Touch Drag Events for Mobile
    this.el.lightboxContent.addEventListener('touchstart', (e) => this.startTouchDrag(e), { passive: true });
    window.addEventListener('touchmove', (e) => this.doTouchDrag(e), { passive: false });
    window.addEventListener('touchend', () => this.endDrag());

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
      if (!this.el.lightbox.classList.contains('open')) return;
      
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
      if (e.key === 'ArrowRight') this.navigateLightbox(1);

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

    if (overrides.description) {
      if (!this.el.folderDescBanner) {
        this.el.folderDescBanner = document.createElement('div');
        this.el.folderDescBanner.id = 'folderDescBanner';
        this.el.folderDescBanner.className = 'folder-desc-banner';
        const container = document.querySelector('.gallery-container');
        container.insertBefore(this.el.folderDescBanner, container.firstChild);
      }
      this.el.folderDescBanner.innerHTML = `💬 <span>${this.escapeHtml(overrides.description)}</span>`;
      this.el.folderDescBanner.style.display = 'flex';
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
          ${folder.cover ? `<img src="${folder.cover}" alt="${this.escapeHtml(folder.name)}" class="folder-cover-img" />` : '📁'}
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
          <div class="polaroid-caption">${this.escapeHtml(file.comment || file.name)}</div>
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
            <div class="grid-title">${this.escapeHtml(file.comment || file.name)}</div>
            <div class="grid-subinfo">
              <span>${file.extension.toUpperCase()}</span>
              <span>${file.size_formatted}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

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
    if (!this.isCurrentMediaImage() || e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.zoomState.isDragging = true;
    this.zoomState.startX = touch.clientX - this.zoomState.translateX;
    this.zoomState.startY = touch.clientY - this.zoomState.translateY;
  }

  doDrag(e) {
    if (!this.zoomState.isDragging || !this.isCurrentMediaImage()) return;
    e.preventDefault();
    this.zoomState.translateX = e.clientX - this.zoomState.startX;
    this.zoomState.translateY = e.clientY - this.zoomState.startY;
    this.updateExplorerTransform(false);
  }

  doTouchDrag(e) {
    if (!this.zoomState.isDragging || !this.isCurrentMediaImage() || e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.zoomState.translateX = touch.clientX - this.zoomState.startX;
    this.zoomState.translateY = touch.clientY - this.zoomState.startY;
    this.updateExplorerTransform(false);
  }

  endDrag() {
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
