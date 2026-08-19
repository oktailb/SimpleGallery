/**
 * SimpleGallery 2026 - Archive Manager Application
 * Autonomous archive inspector displaying internal file structures, unpacked sizes, search filter, and compression stats in WebOS Windows.
 */
(function(window) {
  'use strict';

  const ArchiveViewerPlugin = {
    id: 'archive-viewer',
    nameKey: 'viewer.archive',
    categories: ['archive'],
    extensions: ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'tgz'],
    mimeTypes: ['application/zip', 'application/x-tar', 'application/gzip', 'application/x-7z-compressed', 'application/x-rar-compressed'],
    defaultTarget: 'pip',
    supportsFullscreen: true,
    supportsPip: true,
    cssPath: 'apps/archive-manager/manager.css',

    async open(file, options, ctx) {
      if (!ctx) return false;
      const index = (typeof options.index === 'number') ? options.index : ctx.state.filteredFiles.findIndex(f => f.path === file.path);
      if (index === -1) return false;

      const canDownloadItem = ctx.state.isAdmin || (ctx.state.userRights ? ctx.state.userRights.can_download_item : true);
      const cleanPathId = encodeURIComponent(file.path).replace(/%/g, '_');
      const winId = `archive-${cleanPathId}`;

      // 1. WebOS Window Manager Mode (Primary)
      if (window.WindowManager) {
        const defaultW = Math.min(840, Math.max(480, Math.round(window.innerWidth * 0.75)));
        const defaultH = Math.min(580, Math.max(360, Math.round(window.innerHeight * 0.70)));

        const win = window.WindowManager.createWindow({
          id: winId,
          appId: 'archive-manager',
          appName: "Gestionnaire d'Archives",
          fileName: file.name,
          title: `Gestionnaire d'Archives : ${file.name}`,
          icon: '📦',
          width: defaultW,
          height: defaultH,
          content: `
            <div class="webos-archive-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:#0d1117;color:#c9d1d9;overflow:hidden;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.08);gap:10px;">
                <span style="font-size:0.9rem;font-weight:600;color:#f8fafc;">📦 ${ctx.escapeHtml(file.name)}</span>
                <div style="display:flex;gap:10px;align-items:center;">
                  <input type="text" id="archiveFilterInput-${cleanPathId}" placeholder="🔍 Filtrer les fichiers..." style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:12px;padding:4px 10px;font-size:0.8rem;outline:none;" />
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="app-menu-pill" style="font-size:0.75rem;padding:5px 12px;text-decoration:none;background:#6366f1;color:#fff;display:flex;align-items:center;gap:6px;border-radius:8px;">📥 Télécharger</a>` : ''}
                </div>
              </div>
              <div id="archiveStats-${cleanPathId}" style="display:flex;gap:1.5rem;padding:8px 16px;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.82rem;color:var(--text-muted,#94a3b8);">
                <div>Taille compressée : <strong style="color:#f8fafc;">${file.size_formatted}</strong></div>
                <div id="archiveStatUncompressed-${cleanPathId}">Analyse de l'archive...</div>
              </div>
              <div id="archiveFileList-${cleanPathId}" style="flex:1;overflow-y:auto;padding:8px 16px;display:flex;flex-direction:column;gap:4px;">
                <div style="padding:2.5rem;text-align:center;color:var(--text-muted,#94a3b8);">Lecture des fichiers de l'archive...</div>
              </div>
            </div>
          `,
          onFocus: () => {
            if (window.MenuBarManager) {
              window.MenuBarManager.registerAppMenu('archive-manager', (container) => {
                container.innerHTML = `
                  <div class="app-menu-left">
                    <span class="app-menu-pill active" style="font-weight:600;">📦 ${ctx.escapeHtml(file.name)}</span>
                    ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="app-menu-pill" style="text-decoration:none;">📥 Télécharger</a>` : ''}
                  </div>
                  <div class="app-menu-right">
                    <button type="button" class="app-menu-pill" id="menuArchFsBtn">⛶ Plein Écran</button>
                  </div>
                `;
                const fs = container.querySelector('#menuArchFsBtn');
                if (fs) fs.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(winId); };
              });
              window.MenuBarManager.setActiveApp('archive-manager');
            }
          }
        });

        // Fetch Archive Metadata Asynchronously
        try {
          const res = await fetch(`api.php?action=get_metadata&file=${encodeURIComponent(file.path)}`);
          const json = await res.json();
          
          const listEl = document.getElementById(`archiveFileList-${cleanPathId}`);
          const statsEl = document.getElementById(`archiveStats-${cleanPathId}`);
          const filterInput = document.getElementById(`archiveFilterInput-${cleanPathId}`);

          if (json.success && json.metadata && json.metadata.specific && json.metadata.specific.archive) {
            const arch = json.metadata.specific.archive;
            
            if (statsEl) {
              statsEl.innerHTML = `
                <div>Taille compressée : <strong style="color:#f8fafc;">${file.size_formatted}</strong></div>
                ${arch.uncompressed_size_formatted ? `<div>Taille décompressée : <strong style="color:#f8fafc;">${arch.uncompressed_size_formatted}</strong></div>` : ''}
                ${arch.files_count !== undefined ? `<div>Fichiers : <strong style="color:#f8fafc;">${arch.files_count}</strong></div>` : ''}
                ${arch.compression_ratio ? `<div>Gain : <strong style="color:#f8fafc;">${arch.compression_ratio}</strong></div>` : ''}
              `;
            }

            const allFiles = arch.files || arch.files_sample || arch.sample_files || [];

            const renderFileList = (items) => {
              if (!listEl) return;
              if (!items || items.length === 0) {
                listEl.innerHTML = `<div style="padding:2.5rem;text-align:center;color:var(--text-muted,#94a3b8);">Aucun fichier trouvé correspondant au filtre.</div>`;
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
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:0.85rem;">
                    <span>${icon} ${ctx.escapeHtml(name)}</span>
                    ${size ? `<span style="font-size:0.75rem;color:var(--text-muted,#94a3b8);">${size}</span>` : ''}
                  </div>
                `;
              }).join('');
            };

            renderFileList(allFiles);

            if (filterInput) {
              filterInput.oninput = (e) => {
                const query = e.target.value.toLowerCase().trim();
                if (!query) {
                  renderFileList(allFiles);
                  return;
                }
                const filtered = allFiles.filter(item => {
                  const name = (typeof item === 'string') ? item : (item.name || '');
                  return name.toLowerCase().includes(query);
                });
                renderFileList(filtered);
              };
            }

          } else {
            if (listEl) {
              listEl.innerHTML = `
                <div style="padding:2.5rem;text-align:center;">
                  <div style="font-size:2.5rem;margin-bottom:0.75rem;">📦</div>
                  <div style="font-weight:600;color:#f8fafc;margin-bottom:0.4rem;">${ctx.escapeHtml(file.name)}</div>
                  <p style="color:var(--text-muted,#94a3b8);font-size:0.85rem;margin-bottom:1.25rem;">Les détails internes de cette archive ne sont pas disponibles directement en ligne.</p>
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="app-menu-pill" style="text-decoration:none;padding:8px 16px;background:#6366f1;color:#fff;border-radius:8px;font-weight:600;">📥 Télécharger l'archive complète</a>` : ''}
                </div>
              `;
            }
          }
        } catch(err) {
          const listEl = document.getElementById(`archiveFileList-${cleanPathId}`);
          if (listEl) {
            listEl.innerHTML = `<div style="padding:2.5rem;text-align:center;color:#ef4444;">Erreur lors de l'inspection de l'archive: ${err.message}</div>`;
          }
        }

        return true;
      }

      // 2. Fallback Lightbox Mode
      if (!ctx.el) return false;
      ctx.state.lightboxIndex = index;
      ctx.el.lightboxTitle.textContent = `Gestionnaire d'Archives : ${file.name}`;
      ctx.el.lightboxContent.innerHTML = `<div style="padding:2rem;text-align:center;">${file.name}</div>`;
      ctx.el.lightbox.classList.add('open');
      return true;
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(ArchiveViewerPlugin);
  }
})(window);
