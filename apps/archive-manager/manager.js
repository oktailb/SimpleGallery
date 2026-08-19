/**
 * SimpleGallery 2026 - Archive Manager Application
 * Autonomous archive inspector displaying internal file structures, unpacked sizes, search filter, and compression stats.
 */
(function(window) {
  'use strict';

  const ArchiveViewerPlugin = {
    id: 'archive-viewer',
    nameKey: 'viewer.archive',
    categories: ['archive'],
    extensions: ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'tgz'],
    mimeTypes: ['application/zip', 'application/x-tar', 'application/gzip', 'application/x-7z-compressed', 'application/x-rar-compressed'],
    defaultTarget: 'lightbox',
    supportsFullscreen: true,
    supportsPip: false,
    cssPath: 'apps/archive-manager/manager.css',

    async open(file, options, ctx) {
      if (!ctx || !ctx.el) return false;
      const index = (typeof options.index === 'number') ? options.index : ctx.state.filteredFiles.findIndex(f => f.path === file.path);
      if (index === -1) return false;

      ctx.state.lightboxIndex = index;

      if (!ctx.state.isLightboxHistoryPushed) {
        history.pushState({ lightbox: true }, '');
        ctx.state.isLightboxHistoryPushed = true;
      }

      ctx.el.lightboxTitle.textContent = file.name;
      ctx.el.lightboxMeta.textContent = `${file.size_formatted} • ${new Date(file.mtime * 1000).toLocaleDateString()}`;
      
      const canDownloadItem = ctx.state.isAdmin || (ctx.state.userRights ? ctx.state.userRights.can_download_item : true);
      if (ctx.el.lightboxDownloadBtn) {
        ctx.el.lightboxDownloadBtn.href = file.file_url;
        ctx.el.lightboxDownloadBtn.setAttribute('download', file.name);
        ctx.el.lightboxDownloadBtn.style.display = canDownloadItem ? 'inline-flex' : 'none';
      }

      if (ctx.el.lightboxDeleteBtn) {
        ctx.el.lightboxDeleteBtn.style.display = ctx.state.isAdmin ? 'inline-flex' : 'none';
      }

      ctx.updateLightboxFavBtn(file.path);
      if (ctx.el.imageExplorerControls) ctx.el.imageExplorerControls.style.display = 'none';
      if (ctx.el.lightboxEditImageBtn) ctx.el.lightboxEditImageBtn.style.display = 'none';
      if (ctx.el.lightboxExifBtn) ctx.el.lightboxExifBtn.style.display = 'inline-flex';
      ctx.loadUnifiedMetadata(file);

      // Render Skeleton Archive Inspector
      ctx.el.lightboxContent.innerHTML = `
        <div class="archive-viewer-modal-content">
          <div class="archive-inspector-card">
            <div class="archive-inspector-header">
              <span class="archive-inspector-title">📦 ${ctx.escapeHtml(file.name)}</span>
              <div style="display:flex;gap:10px;align-items:center;">
                <input type="text" id="archiveFilterInput" placeholder="🔍 Filtrer les fichiers..." style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:12px;padding:4px 10px;font-size:0.8rem;outline:none;" />
                <a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="pill-btn active" style="font-size:0.75rem;padding:5px 12px;text-decoration:none;background:#6366f1;color:#fff;display:flex;align-items:center;gap:6px;">📥 Télécharger</a>
              </div>
            </div>
            <div class="archive-inspector-stats" id="archiveInspectorStats">
              <div class="archive-stat-item">Taille compressée : <strong>${file.size_formatted}</strong></div>
              <div class="archive-stat-item" id="archiveStatUncompressed">Analyse de l'archive en cours...</div>
            </div>
            <div class="archive-file-list" id="archiveFileListContent">
              <div style="padding:2.5rem;text-align:center;color:var(--text-muted);">Lecture des fichiers de l'archive...</div>
            </div>
          </div>
        </div>
      `;

      ctx.el.lightbox.classList.add('open');

      // Fetch Metadata Asynchronously
      try {
        const res = await fetch(`api.php?action=get_metadata&file=${encodeURIComponent(file.path)}`);
        const json = await res.json();
        
        const listEl = document.getElementById('archiveFileListContent');
        const statsEl = document.getElementById('archiveInspectorStats');
        const filterInput = document.getElementById('archiveFilterInput');

        if (json.success && json.metadata && json.metadata.specific && json.metadata.specific.archive) {
          const arch = json.metadata.specific.archive;
          
          if (statsEl) {
            statsEl.innerHTML = `
              <div class="archive-stat-item">Taille compressée : <strong>${file.size_formatted}</strong></div>
              ${arch.uncompressed_size_formatted ? `<div class="archive-stat-item">Taille décompressée : <strong>${arch.uncompressed_size_formatted}</strong></div>` : ''}
              ${arch.files_count !== undefined ? `<div class="archive-stat-item">Fichiers : <strong>${arch.files_count}</strong></div>` : ''}
              ${arch.compression_ratio ? `<div class="archive-stat-item">Gain : <strong>${arch.compression_ratio}</strong></div>` : ''}
            `;
          }

          const allFiles = arch.files || arch.files_sample || arch.sample_files || [];

          const renderFileList = (items) => {
            if (!listEl) return;
            if (!items || items.length === 0) {
              listEl.innerHTML = `<div style="padding:2.5rem;text-align:center;color:var(--text-muted);">Aucun fichier trouvé correspondant au filtre.</div>`;
              return;
            }

            listEl.innerHTML = items.map(f => {
              const name = (typeof f === 'string') ? f : (f.name || 'Fichier');
              const size = (typeof f === 'object' && f.size_formatted) ? f.size_formatted : '';
              const isDir = name.endsWith('/');
              
              let icon = isDir ? '📁' : '📄';
              const fileExt = name.split('.').pop().toLowerCase();
              if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt)) icon = '🖼️';
              else if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(fileExt)) icon = '🎬';
              else if (['mp3', 'wav', 'ogg', 'flac'].includes(fileExt)) icon = '🎵';
              else if (['zip', 'tar', 'gz', '7z', 'rar'].includes(fileExt)) icon = '📦';
              else if (['pdf'].includes(fileExt)) icon = '📑';

              return `
                <div class="archive-file-row">
                  <span class="archive-file-name">${icon} ${ctx.escapeHtml(name)}</span>
                  ${size ? `<span class="archive-file-size">${size}</span>` : ''}
                </div>
              `;
            }).join('');
          };

          renderFileList(allFiles);

          if (filterInput) {
            filterInput.oninput = () => {
              const q = filterInput.value.trim().toLowerCase();
              if (!q) {
                renderFileList(allFiles);
              } else {
                const filtered = allFiles.filter(f => {
                  const name = (typeof f === 'string') ? f : (f.name || '');
                  return name.toLowerCase().includes(q);
                });
                renderFileList(filtered);
              }
            };
          }

        } else if (listEl) {
          listEl.innerHTML = `<div style="padding:2.5rem;text-align:center;color:var(--text-muted);">Archive prête au téléchargement (${file.size_formatted}).</div>`;
        }
      } catch (err) {
        console.warn('Archive metadata inspection failed:', err);
      }

      return true;
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(ArchiveViewerPlugin);
  }
})(window);
