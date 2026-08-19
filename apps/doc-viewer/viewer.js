/**
 * SimpleGallery 2026 - Document Viewer Application
 * Autonomous viewer supporting embedded PDF preview, interactive Text/Markdown/Code reader, and document actions in WebOS Windows.
 */
(function(window) {
  'use strict';

  const DocViewerPlugin = {
    id: 'generic-doc',
    nameKey: 'viewer.doc',
    categories: ['doc', 'other'],
    extensions: ['pdf', 'txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'js', 'css', 'php', 'py', 'sh', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'log', 'ini', 'sql'],
    mimeTypes: ['application/pdf', 'text/*', 'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
    defaultTarget: 'pip',
    supportsFullscreen: true,
    supportsPip: true,
    cssPath: 'apps/doc-viewer/viewer.css',

    async open(file, options, ctx) {
      if (!ctx) return false;
      const index = (typeof options.index === 'number') ? options.index : ctx.state.filteredFiles.findIndex(f => f.path === file.path);
      if (index === -1) return false;

      const canDownloadItem = ctx.state.isAdmin || (ctx.state.userRights ? ctx.state.userRights.can_download_item : true);
      const cleanPathId = encodeURIComponent(file.path).replace(/%/g, '_');
      const winId = `doc-${cleanPathId}`;
      const ext = (file.extension || '').toLowerCase();
      const isText = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'js', 'css', 'php', 'py', 'sh', 'log', 'ini', 'sql'].includes(ext);

      // 1. WebOS Window Mode (Primary)
      if (window.WindowManager) {
        const defaultW = Math.min(880, Math.max(480, Math.round(window.innerWidth * 0.75)));
        const defaultH = Math.min(620, Math.max(360, Math.round(window.innerHeight * 0.70)));

        let bodyHtml = '';

        if (ext === 'pdf') {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:#1e293b;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="font-size:0.85rem;font-weight:600;color:#f8fafc;">📄 ${ctx.escapeHtml(file.name)} (${file.size_formatted})</span>
                <div style="display:flex;gap:8px;">
                  <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:#fff;background:rgba(255,255,255,0.1);border-radius:8px;">↗ Nouvel onglet</a>
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:#fff;background:#6366f1;border-radius:8px;">📥 Télécharger</a>` : ''}
                </div>
              </div>
              <iframe class="doc-pdf-iframe" src="${file.file_url}" title="${ctx.escapeHtml(file.name)}" style="width:100%;height:100%;border:none;flex:1;"></iframe>
            </div>
          `;
        } else if (isText) {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:#0d1117;color:#c9d1d9;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.08);">
                <span style="font-size:0.85rem;font-weight:600;color:#f8fafc;">📝 ${ctx.escapeHtml(file.name)} (${file.size_formatted})</span>
                <div style="display:flex;gap:8px;">
                  <button type="button" id="docWinCopyBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:#6366f1;color:#fff;border-radius:8px;">📋 Copier le texte</button>
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:#fff;background:rgba(255,255,255,0.1);border-radius:8px;">📥 Télécharger</a>` : ''}
                </div>
              </div>
              <div id="docWinTextBody-${cleanPathId}" style="flex:1;padding:1rem 1.25rem;overflow:auto;font-family:Consolas,Monaco,'Courier New',monospace;font-size:0.88rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;user-select:text;">Chargement du contenu texte...</div>
            </div>
          `;
        } else {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:2rem;">
              <div class="doc-viewer-card" style="background:rgba(30,41,59,0.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:2.5rem;text-align:center;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                <div style="font-size:3.5rem;margin-bottom:1rem;">📄</div>
                <div style="font-size:1.15rem;font-weight:700;color:#fff;margin-bottom:0.4rem;word-break:break-all;">${ctx.escapeHtml(file.name)}</div>
                <div style="font-size:0.85rem;color:var(--text-muted,#94a3b8);margin-bottom:1.5rem;">${file.size_formatted} • Format ${ext.toUpperCase()}</div>
                <div style="display:flex;gap:10px;justify-content:center;">
                  <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="text-decoration:none;padding:8px 16px;background:rgba(255,255,255,0.12);color:#fff;border-radius:10px;">↗ Ouvrir le fichier</a>
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="app-menu-pill" style="text-decoration:none;padding:8px 16px;background:#6366f1;color:#fff;border-radius:10px;font-weight:600;">📥 Télécharger</a>` : ''}
                </div>
              </div>
            </div>
          `;
        }

        const win = window.WindowManager.createWindow({
          id: winId,
          appId: 'generic-doc',
          appName: 'Lecteur de Documents',
          fileName: file.name,
          title: `Lecteur de Documents : ${file.name}`,
          icon: '📄',
          width: defaultW,
          height: defaultH,
          content: bodyHtml,
          onFocus: () => {
            if (window.MenuBarManager) {
              window.MenuBarManager.registerAppMenu('generic-doc', (container) => {
                container.innerHTML = `
                  <div class="app-menu-left">
                    <span class="app-menu-pill active" style="font-weight:600;">📄 ${ctx.escapeHtml(file.name)}</span>
                    <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="text-decoration:none;">↗ Nouvel onglet</a>
                    ${canDownloadItem ? `<a href="${file.file_url}" download="${ctx.escapeHtml(file.name)}" class="app-menu-pill" style="text-decoration:none;">📥 Télécharger</a>` : ''}
                  </div>
                  <div class="app-menu-right">
                    <button type="button" class="app-menu-pill" id="menuDocFsBtn">⛶ Plein Écran</button>
                  </div>
                `;
                const fs = container.querySelector('#menuDocFsBtn');
                if (fs) fs.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(winId); };
              });
              window.MenuBarManager.setActiveApp('generic-doc');
            }
          }
        });

        // Load Text Asynchronously if applicable
        if (isText) {
          try {
            const res = await fetch(file.file_url);
            const text = await res.text();
            const bodyEl = document.getElementById(`docWinTextBody-${cleanPathId}`);
            if (bodyEl) {
              bodyEl.textContent = text;
            }
            const copyBtn = document.getElementById(`docWinCopyBtn-${cleanPathId}`);
            if (copyBtn) {
              copyBtn.onclick = () => {
                navigator.clipboard.writeText(text).then(() => {
                  copyBtn.textContent = '✓ Copié !';
                  setTimeout(() => { copyBtn.textContent = '📋 Copier le texte'; }, 2000);
                });
              };
            }
          } catch (err) {
            const bodyEl = document.getElementById(`docWinTextBody-${cleanPathId}`);
            if (bodyEl) bodyEl.textContent = `Erreur lors de la lecture du fichier texte: ${err.message}`;
          }
        }

        return true;
      }

      // 2. Legacy Lightbox Fallback Mode
      if (!ctx.el) return false;
      ctx.state.lightboxIndex = index;
      ctx.el.lightboxTitle.textContent = `Lecteur de Documents : ${file.name}`;
      ctx.el.lightboxContent.innerHTML = `<div style="padding:2rem;text-align:center;">${file.name}</div>`;
      ctx.el.lightbox.classList.add('open');
      return true;
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(DocViewerPlugin);
  }
})(window);
