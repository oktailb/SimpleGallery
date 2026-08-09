/**
 * SimpleGallery 2026 - Vanilla JS Client Application with Dotfile Overrides Support
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
      lightboxDownloadBtn: document.getElementById('lightboxDownloadBtn')
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

    this.el.lightboxCloseBtn.addEventListener('click', () => this.closeLightbox());
    this.el.lightboxPrevBtn.addEventListener('click', () => this.navigateLightbox(-1));
    this.el.lightboxNextBtn.addEventListener('click', () => this.navigateLightbox(1));

    window.addEventListener('keydown', (e) => {
      if (!this.el.lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
      if (e.key === 'ArrowRight') this.navigateLightbox(1);
    });

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
    // 1. Background image or color (.bg)
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

    // 2. Folder Description banner (.desc / .description)
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

    // 3. Custom Theme Overrides (.theme)
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
          📁
        </div>
        <div class="folder-name">${this.escapeHtml(folder.name)}</div>
        <div class="folder-meta">
          <span>${folder.item_count} ${folder.item_count === 1 ? 'item' : 'items'}</span>
          <span>&rarr;</span>
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

    let html = '';
    if (file.category === 'image') {
      html = `<img src="${file.file_url}" alt="${this.escapeHtml(file.name)}" />`;
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

  closeLightbox() {
    this.el.lightbox.classList.remove('open');
    this.el.lightboxContent.innerHTML = '';
    this.state.lightboxIndex = null;
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
