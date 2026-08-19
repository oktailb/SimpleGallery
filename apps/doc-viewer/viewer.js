/**
 * SimpleGallery 2026 - Document Viewer Application
 * Autonomous viewer supporting embedded PDF preview, interactive Text/Markdown/Code reader, and document actions.
 */
(function(window) {
  'use strict';

  const DocViewerPlugin = {
    id: 'generic-doc',
    nameKey: 'viewer.doc',
    categories: ['doc', 'other'],
    extensions: ['pdf', 'txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'js', 'css', 'php', 'py', 'sh', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'log', 'ini', 'sql'],
    mimeTypes: ['application/pdf', 'text/*', 'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
    defaultTarget: 'lightbox',
    supportsFullscreen: true,
    supportsPip: false,
    cssPath: 'apps/doc-viewer/viewer.css',

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

      const ext = (file.extension || '').toLowerCase();

      // 1. PDF Embedded Reader
      if (ext === 'pdf') {
        ctx.el.lightboxContent.innerHTML = `
          <div class="doc-viewer-modal-content">
            <div class="doc-pdf-container">
              <div class="doc-pdf-toolbar">
                <span>📄 ${ctx.escapeHtml(file.name)}</span>
                <div style="display:flex;gap:8px;">
                  <a href="${file.file_url}" target="_blank" class="pill-btn active" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;">↗ Ouvrir dans un nouvel onglet</a>
                </div>
              </div>
              <iframe class="doc-pdf-iframe" src="${file.file_url}" title="${ctx.escapeHtml(file.name)}"></iframe>
            </div>
          </div>
        `;
      } 
      // 2. Interactive Text / Markdown / Code Reader
      else if (['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'js', 'css', 'php', 'py', 'sh', 'log', 'ini', 'sql'].includes(ext)) {
        ctx.el.lightboxContent.innerHTML = `
          <div class="doc-viewer-modal-content">
            <div class="doc-text-container">
              <div class="doc-text-header">
                <span>📝 ${ctx.escapeHtml(file.name)} (${file.size_formatted})</span>
                <button id="docCopyTextBtn" class="pill-btn active" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:#6366f1;color:#fff;">📋 Copier le texte</button>
              </div>
              <div class="doc-text-body" id="docTextBodyContent">Chargement du contenu texte...</div>
            </div>
          </div>
        `;

        try {
          const res = await fetch(file.file_url);
          const text = await res.text();
          const bodyEl = document.getElementById('docTextBodyContent');
          if (bodyEl) {
            bodyEl.textContent = text;
          }
          const copyBtn = document.getElementById('docCopyTextBtn');
          if (copyBtn) {
            copyBtn.onclick = () => {
              navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = '✓ Copié !';
                setTimeout(() => { copyBtn.textContent = '📋 Copier le texte'; }, 2000);
              });
            };
          }
        } catch (err) {
          const bodyEl = document.getElementById('docTextBodyContent');
          if (bodyEl) bodyEl.textContent = `Erreur lors de la lecture du fichier texte: ${err.message}`;
        }
      } 
      // 3. Fallback Document Info Card
      else {
        ctx.el.lightboxContent.innerHTML = `
          <div class="doc-viewer-modal-content">
            <div class="doc-viewer-card">
              <div class="doc-viewer-icon">📝</div>
              <div class="doc-viewer-title">${ctx.escapeHtml(file.name)}</div>
              <div class="doc-viewer-meta">${file.size_formatted} • Fichier ${ext.toUpperCase()}</div>
              <div class="doc-viewer-actions">
                <a href="${file.file_url}" target="_blank" class="pill-btn active" style="text-decoration:none;">↗ Ouvrir le fichier</a>
                ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="pill-btn" style="text-decoration:none;background:rgba(255,255,255,0.1);color:#fff;">📥 Télécharger</a>` : ''}
              </div>
            </div>
          </div>
        `;
      }

      ctx.el.lightbox.classList.add('open');
      return true;
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(DocViewerPlugin);
  }
})(window);
