/**
 * SimpleGallery 2026 - Document Viewer Application
 * Autonomous viewer supporting embedded PDF preview, interactive Text/Markdown/Code reader,
 * and integrated WYSIWYG / Markdown Editor (Toast UI Editor) in WebOS Windows.
 */
(function(window) {
  'use strict';

  let toastUiLoadingPromise = null;

  /**
   * Lazy-loads Toast UI Editor CDN assets on-demand
   */
  function loadToastUiEditor() {
    if (window.toastui && window.toastui.Editor) {
      return Promise.resolve(window.toastui.Editor);
    }
    if (toastUiLoadingPromise) return toastUiLoadingPromise;

    toastUiLoadingPromise = new Promise((resolve, reject) => {
      // 1. Inject Toast UI Editor Core & Dark Theme CSS
      if (!document.getElementById('toastui-editor-css')) {
        const link = document.createElement('link');
        link.id = 'toastui-editor-css';
        link.rel = 'stylesheet';
        link.href = 'https://uicdn.toast.com/editor/latest/toastui-editor.min.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('toastui-editor-dark-css')) {
        const linkDark = document.createElement('link');
        linkDark.id = 'toastui-editor-dark-css';
        linkDark.rel = 'stylesheet';
        linkDark.href = 'https://uicdn.toast.com/editor/latest/theme/toastui-editor-dark.min.css';
        document.head.appendChild(linkDark);
      }

      // 2. Inject Toast UI Editor Core JS Bundle
      if (!document.getElementById('toastui-editor-js')) {
        const script = document.createElement('script');
        script.id = 'toastui-editor-js';
        script.src = 'https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js';
        script.onload = () => {
          if (window.toastui && window.toastui.Editor) {
            resolve(window.toastui.Editor);
          } else {
            reject(new Error('Toast UI Editor is not defined on window.toastui'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load Toast UI Editor from CDN'));
        document.head.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (window.toastui && window.toastui.Editor) {
            clearInterval(interval);
            resolve(window.toastui.Editor);
          }
        }, 50);
      }
    });

    return toastUiLoadingPromise;
  }

  /**
   * Pure JS Markdown-to-HTML parser for secure, rich client-side rendering
   */
  function renderMarkdownHtml(md) {
    if (!md || typeof md !== 'string') return '';
    let html = md;

    // Escape HTML entities to prevent raw script injections
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks ```lang ... ```
    html = html.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const cleanLang = lang ? ` class="language-${lang}"` : '';
      return `<pre class="md-codeblock"><code${cleanLang}>${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`\n]+)`/g, '<code class="md-inline-code">$1</code>');

    // Headers # -> h1..h6
    html = html.replace(/^#{6}\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>');
    html = html.replace(/^#{5}\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>');
    html = html.replace(/^#{4}\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^#{3}\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^#{2}\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

    // Horizontal rules (---, ***, ___)
    html = html.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<hr class="md-hr">');

    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="md-blockquote"><p>$1</p></blockquote>');

    // Bold & Italic
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Images ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

    // Task lists [ ] [x]
    html = html.replace(/^\s*[-*+]\s+\[ \]\s+(.+)$/gm, '<li class="md-task-item"><input type="checkbox" disabled /> $1</li>');
    html = html.replace(/^\s*[-*+]\s+\[[xX]\]\s+(.+)$/gm, '<li class="md-task-item"><input type="checkbox" checked disabled /> $1</li>');

    // Unordered lists
    html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li class="md-li">$1</li>');

    // Ordered lists
    html = html.replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li class="md-oli">$2</li>');

    // Wrap list items
    html = html.replace(/(<li class="md-li">[\s\S]*?<\/li>)(?!(<li class="md-li">))/g, '<ul class="md-ul">$1</ul>');
    html = html.replace(/(<li class="md-oli">[\s\S]*?<\/li>)(?!(<li class="md-oli">))/g, '<ol class="md-ol">$1</ol>');
    html = html.replace(/(<li class="md-task-item">[\s\S]*?<\/li>)(?!(<li class="md-task-item">))/g, '<ul class="md-ul md-task-list">$1</ul>');

    // Tables: | col | col |
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<table class="md-table"><tbody>';
        }
        if (/^\|[\s\-:|]+\|$/.test(line)) {
          continue;
        }
        const cells = line.slice(1, -1).split('|').map(c => c.trim());
        const isHeader = (i > 0 && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim()));
        const tag = isHeader ? 'th' : 'td';
        tableHtml += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</tbody></table>';
          newLines.push(tableHtml);
          tableHtml = '';
        }
        newLines.push(lines[i]);
      }
    }
    if (inTable) {
      tableHtml += '</tbody></table>';
      newLines.push(tableHtml);
    }
    html = newLines.join('\n');

    // Paragraphs
    const blocks = html.split(/\n{2,}/);
    html = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|ul|ol|pre|blockquote|table|hr|img)/i.test(block)) {
        return block;
      }
      return `<p class="md-p">${block.replace(/\n/g, '<br/>')}</p>`;
    }).join('\n\n');

    return html;
  }

  const DocViewerPlugin = {
    id: 'generic-doc',
    nameKey: 'viewer.doc',
    categories: ['doc', 'other'],
    extensions: ['pdf', 'txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'js', 'css', 'php', 'py', 'sh', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'log', 'ini', 'sql', 'yaml', 'yml'],
    mimeTypes: ['application/pdf', 'text/*', 'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
    defaultTarget: 'pip',
    supportsFullscreen: true,
    supportsPip: true,
    cssPath: 'apps/doc-viewer/viewer.css',

    async open(file, options = {}, ctx = null) {
      const effectiveCtx = (ctx && ctx.state) ? ctx : (
        (window.explorerApp && typeof window.explorerApp.getActiveInstance === 'function' && window.explorerApp.getActiveInstance())
        || {
          state: {
            filteredFiles: [file],
            files: [file],
            isAdmin: !!window.IS_ADMIN,
            userRights: {}
          },
          t: (k, p) => (window.I18nEngine ? window.I18nEngine.t(k, p) : k),
          escapeHtml: (s) => (s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '')
        }
      );

      const filesList = (effectiveCtx.state && Array.isArray(effectiveCtx.state.filteredFiles)) ? effectiveCtx.state.filteredFiles : [file];
      const foundIdx = filesList.findIndex(f => f.path === file.path);
      const index = (typeof options.index === 'number') ? options.index : (foundIdx !== -1 ? foundIdx : 0);

      const canDownloadItem = effectiveCtx.state.isAdmin || (effectiveCtx.state.userRights ? effectiveCtx.state.userRights.can_download_item : true);
      const cleanPathId = encodeURIComponent(file.path).replace(/%/g, '_');
      const winId = `doc-${cleanPathId}`;
      const ext = (file.extension || '').toLowerCase();
      const isMd = ['md', 'markdown'].includes(ext);
      const isText = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'js', 'css', 'php', 'py', 'sh', 'log', 'ini', 'sql', 'yaml', 'yml'].includes(ext);
      const isEditableText = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'css', 'js', 'log', 'ini', 'sql', 'yaml', 'yml'].includes(ext) && !['php', 'phtml', 'phar', 'sh', 'exe'].includes(ext);
      const canEdit = (effectiveCtx.state.isAdmin || window.IS_ADMIN || (effectiveCtx.state.userRights && effectiveCtx.state.userRights.can_upload)) && isEditableText;

      // Notification helper
      const showNotification = (msg, type = 'info') => {
        if (typeof effectiveCtx.showToast === 'function') {
          effectiveCtx.showToast(msg, type);
        } else if (window.sys && window.sys.desktop && typeof window.sys.desktop.showToast === 'function') {
          window.sys.desktop.showToast(msg, type);
        } else if (window.galleryApp && typeof window.galleryApp.showToast === 'function') {
          window.galleryApp.showToast(msg, type);
        }
      };

      // 1. WebOS Window Mode (Primary)
      if (window.WindowManager) {
        const defaultW = Math.min(960, Math.max(540, Math.round(window.innerWidth * 0.75)));
        const defaultH = Math.min(700, Math.max(420, Math.round(window.innerHeight * 0.75)));

        let bodyHtml = '';

        if (ext === 'pdf') {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:#1e293b;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="font-size:0.85rem;font-weight:600;color:#f8fafc;">📄 ${effectiveCtx.escapeHtml(file.name)} (${file.size_formatted})</span>
                <div style="display:flex;gap:8px;">
                  <button type="button" id="docPdfInfoBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:rgba(255,255,255,0.1);color:#fff;border-radius:8px;" data-i18n-title="lightbox.metadata_btn" title="${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.metadata_btn') || 'Propriétés (I)')}">ℹ️</button>
                  <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:#fff;background:rgba(255,255,255,0.1);border-radius:8px;">↗ Nouvel onglet</a>
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${effectiveCtx.escapeHtml(file.name)}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:#fff;background:#6366f1;border-radius:8px;"><span data-i18n="lightbox.download">📥 Télécharger</span></a>` : ''}
                </div>
              </div>
              <iframe class="doc-pdf-iframe" src="${file.file_url}" title="${effectiveCtx.escapeHtml(file.name)}" style="width:100%;height:100%;border:none;flex:1;"></iframe>
            </div>
          `;
        } else if (isText) {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:#0d1117;color:#c9d1d9;position:relative;">
              <!-- Reader View Toolbar -->
              <div id="docReaderToolbar-${cleanPathId}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.08);">
                <span style="font-size:0.85rem;font-weight:600;color:#f8fafc;">${isMd ? '📖' : '📝'} ${effectiveCtx.escapeHtml(file.name)} (${file.size_formatted})</span>
                <div style="display:flex;gap:8px;align-items:center;">
                  <button type="button" id="docTextInfoBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:rgba(255,255,255,0.1);color:#fff;border-radius:8px;" data-i18n-title="lightbox.metadata_btn" title="${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.metadata_btn') || 'Propriétés (I)')}">ℹ️</button>
                  <button type="button" id="docWinCopyBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:rgba(255,255,255,0.1);color:#fff;border-radius:8px;">📋 Copier</button>
                  ${isMd ? `<button type="button" id="docMdViewToggleBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:rgba(255,255,255,0.12);color:#fff;border-radius:8px;">📄 Code Source</button>` : ''}
                  ${canEdit ? `<button type="button" id="docEditToggleBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--accent-primary,#6366f1);color:#fff;border-radius:8px;font-weight:600;"><span data-i18n="doc_editor.edit_btn">✏️ Éditer (WYSIWYG)</span></button>` : ''}
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${effectiveCtx.escapeHtml(file.name)}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:#fff;background:rgba(255,255,255,0.1);border-radius:8px;"><span data-i18n="lightbox.download">📥 Télécharger</span></a>` : ''}
                </div>
              </div>

              <!-- Reader Text / Markdown Content -->
              <div id="docWinTextContainer-${cleanPathId}" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:#0d1117;">
                <div id="docWinTextBody-${cleanPathId}" class="doc-text-body ${isMd ? 'doc-markdown-render' : 'doc-code-render'}">Chargement du document...</div>
              </div>

              <!-- WYSIWYG & Markdown Editor View -->
              <div id="docEditorView-${cleanPathId}" class="doc-editor-container" style="display:none;flex:1;">
                <div class="doc-editor-toolbar">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span id="docEditorStatusBadge-${cleanPathId}" class="doc-status-badge saved">● Enregistré</span>
                    <span style="font-size:0.75rem;color:var(--text-muted,#94a3b8);">(Ctrl+S pour sauvegarder)</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <button type="button" id="docSaveBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 12px;background:#22c55e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">💾 Enregistrer</button>
                    <button type="button" id="docCloseEditBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;cursor:pointer;">👁️ Mode Lecture (Rendu)</button>
                  </div>
                </div>
                <div id="docEditorHost-${cleanPathId}" style="flex:1;height:calc(100% - 42px);overflow:hidden;"></div>
              </div>
            </div>
          `;
        } else {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:2rem;">
              <div class="doc-viewer-card" style="background:rgba(30,41,59,0.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:2.5rem;text-align:center;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                <div style="font-size:3.5rem;margin-bottom:1rem;">📄</div>
                <div style="font-size:1.15rem;font-weight:700;color:#fff;margin-bottom:0.4rem;word-break:break-all;">${effectiveCtx.escapeHtml(file.name)}</div>
                <div style="font-size:0.85rem;color:var(--text-muted,#94a3b8);margin-bottom:1.5rem;">${file.size_formatted} • Format ${ext.toUpperCase()}</div>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                  <button type="button" id="docCardInfoBtn-${cleanPathId}" class="app-menu-pill" style="padding:8px 16px;cursor:pointer;border:none;background:rgba(255,255,255,0.1);color:#fff;border-radius:10px;"><span data-i18n="lightbox.metadata_btn">ℹ️ ${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.metadata_btn') || 'Propriétés')}</span></button>
                  <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="text-decoration:none;padding:8px 16px;background:rgba(255,255,255,0.12);color:#fff;border-radius:10px;">↗ Ouvrir le fichier</a>
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${effectiveCtx.escapeHtml(file.name)}" class="app-menu-pill" style="text-decoration:none;padding:8px 16px;background:#6366f1;color:#fff;border-radius:10px;font-weight:600;"><span data-i18n="lightbox.download">📥 Télécharger</span></a>` : ''}
                </div>
              </div>
            </div>
          `;
        }

        const appTitle = (window.sys && window.sys.appManager) 
          ? window.sys.appManager.getAppTitle('doc-viewer') 
          : (effectiveCtx.t('apps.doc-viewer.title') || "Lecteur de Documents");

        let activeEditorInstance = null;
        let isEditing = false;
        let isRawSourceMode = false;
        let currentRawText = '';

        const updateReaderDisplay = () => {
          const bodyEl = document.getElementById(`docWinTextBody-${cleanPathId}`);
          const mdToggleBtn = document.getElementById(`docMdViewToggleBtn-${cleanPathId}`);
          if (!bodyEl) return;

          if (isMd && !isRawSourceMode) {
            bodyEl.className = 'doc-text-body doc-markdown-render';
            bodyEl.innerHTML = renderMarkdownHtml(currentRawText);
            if (mdToggleBtn) mdToggleBtn.textContent = '📄 Code Source';
          } else {
            bodyEl.className = 'doc-text-body doc-code-render';
            bodyEl.textContent = currentRawText;
            if (mdToggleBtn) mdToggleBtn.textContent = '👁️ Rendu Final';
          }
        };

        const win = window.WindowManager.createWindow({
          id: winId,
          appId: 'doc-viewer',
          appName: appTitle,
          fileName: file.name,
          title: `${appTitle} : ${file.name}`,
          icon: isMd ? '📖' : '📄',
          width: defaultW,
          height: defaultH,
          content: bodyHtml,
          onFocus: () => {
            if (window.MenuBarManager) {
              window.MenuBarManager.registerAppMenu('doc-viewer', (container) => {
                container.innerHTML = `
                  <div class="app-menu-left">
                    <span class="app-menu-pill active" style="font-weight:600;">${isMd ? '📖' : '📄'} ${effectiveCtx.escapeHtml(file.name)}</span>
                    <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="text-decoration:none;">↗ ${effectiveCtx.escapeHtml(effectiveCtx.t('viewer.open_new_tab') || 'Nouvel onglet')}</a>
                    ${canEdit ? `<button type="button" class="app-menu-pill" id="menuDocEditBtn" style="background:var(--accent-primary,#6366f1);color:#fff;">✏️ ${effectiveCtx.escapeHtml(effectiveCtx.t('doc_editor.edit_btn') || 'Éditer (WYSIWYG)')}</button>` : ''}
                    ${canDownloadItem ? `<a href="${file.file_url}" download="${effectiveCtx.escapeHtml(file.name)}" class="app-menu-pill" style="text-decoration:none;">📥 ${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.download') || 'Télécharger')}</a>` : ''}
                    <button type="button" class="app-menu-pill" id="menuDocInfoBtn">ℹ️ ${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.metadata_btn') || 'Propriétés (I)')}</button>
                  </div>
                  <div class="app-menu-right">
                    <button type="button" class="app-menu-pill" id="menuDocFsBtn">⛶ ${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.fullscreen') || 'Plein Écran')}</button>
                  </div>
                `;
                const info = container.querySelector('#menuDocInfoBtn');
                const fs = container.querySelector('#menuDocFsBtn');
                const menuEdit = container.querySelector('#menuDocEditBtn');

                if (info) info.onclick = () => { if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file); };
                if (fs) fs.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(winId); };
                if (menuEdit) menuEdit.onclick = () => toggleEditor();
              });
              window.MenuBarManager.setActiveApp('doc-viewer');
            }
          }
        });

        // Function to perform file saving
        const saveDocument = async () => {
          if (!activeEditorInstance) return;
          const newContent = activeEditorInstance.getMarkdown();
          const badge = document.getElementById(`docEditorStatusBadge-${cleanPathId}`);
          const saveBtn = document.getElementById(`docSaveBtn-${cleanPathId}`);

          if (badge) {
            badge.className = 'doc-status-badge dirty';
            badge.textContent = '⏳ Enregistrement...';
          }
          if (saveBtn) saveBtn.disabled = true;

          const csrfToken = (effectiveCtx && effectiveCtx.state && effectiveCtx.state.csrfToken)
            || (typeof window !== 'undefined' && window.CSRF_TOKEN)
            || (typeof window !== 'undefined' && window.SG_CSRF_TOKEN)
            || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
            || (window.explorerApp && window.explorerApp.state && window.explorerApp.state.csrfToken)
            || (window.galleryApp && window.galleryApp.state && window.galleryApp.state.csrfToken)
            || '';

          try {
            const res = await fetch('api.php', {
              method: 'POST',
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
              },
              body: JSON.stringify({
                action: 'save_text_file',
                target_path: file.path,
                content: newContent,
                csrf_token: csrfToken
              })
            });

            const json = await res.json();
            if (saveBtn) saveBtn.disabled = false;

            if (json.success) {
              currentRawText = newContent;
              if (badge) {
                badge.className = 'doc-status-badge saved';
                badge.textContent = '● Enregistré';
              }
              updateReaderDisplay();
              showNotification(json.message || 'Document enregistré avec succès !', 'success');
            } else {
              if (badge) {
                badge.className = 'doc-status-badge dirty';
                badge.textContent = '⚠️ Échec enregistrement';
              }
              showNotification('⚠️ ' + (json.error || 'Erreur lors de la sauvegarde.'), 'error');
            }
          } catch (err) {
            if (saveBtn) saveBtn.disabled = false;
            if (badge) {
              badge.className = 'doc-status-badge dirty';
              badge.textContent = '⚠️ Erreur réseau';
            }
            showNotification('⚠️ Erreur réseau : ' + err.message, 'error');
          }
        };

        // Function to toggle between Reader and Toast UI WYSIWYG Editor
        const toggleEditor = async (forceState) => {
          if (!canEdit) return;
          const nextState = (forceState !== undefined) ? forceState : !isEditing;
          isEditing = nextState;

          const readerToolbar = document.getElementById(`docReaderToolbar-${cleanPathId}`);
          const textContainer = document.getElementById(`docWinTextContainer-${cleanPathId}`);
          const editorView = document.getElementById(`docEditorView-${cleanPathId}`);
          const hostEl = document.getElementById(`docEditorHost-${cleanPathId}`);

          if (readerToolbar) readerToolbar.style.display = isEditing ? 'none' : 'flex';
          if (textContainer) textContainer.style.display = isEditing ? 'none' : 'flex';
          if (editorView) editorView.style.display = isEditing ? 'flex' : 'none';

          if (isEditing) {
            if (!activeEditorInstance && hostEl) {
              showNotification('Chargement de l\'éditeur WYSIWYG...', 'info');
              try {
                const Editor = await loadToastUiEditor();

                activeEditorInstance = new Editor({
                  el: hostEl,
                  height: '100%',
                  initialEditType: isMd ? 'wysiwyg' : 'markdown',
                  previewStyle: 'vertical',
                  initialValue: currentRawText,
                  theme: 'dark',
                  usageStatistics: false,
                  toolbarItems: [
                    ['heading', 'bold', 'italic', 'strike'],
                    ['hr', 'quote'],
                    ['ul', 'ol', 'task', 'indent', 'outdent'],
                    ['table', 'image', 'link'],
                    ['code', 'codeblock']
                  ]
                });

                activeEditorInstance.on('change', () => {
                  const badge = document.getElementById(`docEditorStatusBadge-${cleanPathId}`);
                  if (badge) {
                    badge.className = 'doc-status-badge dirty';
                    badge.textContent = '● Non sauvegardé';
                  }
                });
              } catch (err) {
                console.error('Failed to init Toast UI Editor:', err);
                showNotification('⚠️ Impossible de charger l\'éditeur : ' + err.message, 'error');
                toggleEditor(false);
              }
            } else if (activeEditorInstance) {
              activeEditorInstance.setMarkdown(currentRawText);
            }
          } else {
            // Returning to reader mode: refresh rendered HTML preview
            updateReaderDisplay();
          }
        };

        // Bind in-window info & action buttons
        setTimeout(() => {
          const pdfInfo = document.getElementById(`docPdfInfoBtn-${cleanPathId}`);
          const textInfo = document.getElementById(`docTextInfoBtn-${cleanPathId}`);
          const cardInfo = document.getElementById(`docCardInfoBtn-${cleanPathId}`);
          const editBtn = document.getElementById(`docEditToggleBtn-${cleanPathId}`);
          const closeEditBtn = document.getElementById(`docCloseEditBtn-${cleanPathId}`);
          const saveBtn = document.getElementById(`docSaveBtn-${cleanPathId}`);
          const mdToggleBtn = document.getElementById(`docMdViewToggleBtn-${cleanPathId}`);

          const onInfo = () => { if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file); };
          if (pdfInfo) pdfInfo.onclick = onInfo;
          if (textInfo) textInfo.onclick = onInfo;
          if (cardInfo) cardInfo.onclick = onInfo;
          if (editBtn) editBtn.onclick = () => toggleEditor(true);
          if (closeEditBtn) closeEditBtn.onclick = () => toggleEditor(false);
          if (saveBtn) saveBtn.onclick = () => saveDocument();

          if (mdToggleBtn) {
            mdToggleBtn.onclick = () => {
              isRawSourceMode = !isRawSourceMode;
              updateReaderDisplay();
            };
          }
        }, 50);

        // Shortcut I (info) & Ctrl+S (save)
        const keyHandler = (e) => {
          if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            if (win.element && win.element.classList.contains('active') && isEditing) {
              e.preventDefault();
              saveDocument();
              return;
            }
          }

          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || isEditing) return;
          if (e.key === 'i' || e.key === 'I') {
            if (win.element && win.element.classList.contains('active')) {
              if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file);
            }
          }
        };
        window.addEventListener('keydown', keyHandler);

        // Load Text / Markdown Asynchronously
        if (isText) {
          try {
            const res = await fetch(file.file_url);
            const text = await res.text();
            currentRawText = text;
            updateReaderDisplay();

            const copyBtn = document.getElementById(`docWinCopyBtn-${cleanPathId}`);
            if (copyBtn) {
              copyBtn.onclick = () => {
                navigator.clipboard.writeText(currentRawText).then(() => {
                  copyBtn.textContent = '✓ Copié !';
                  setTimeout(() => { copyBtn.textContent = '📋 Copier'; }, 2000);
                });
              };
            }
          } catch (err) {
            const bodyEl = document.getElementById(`docWinTextBody-${cleanPathId}`);
            if (bodyEl) bodyEl.textContent = `Erreur lors de la lecture du fichier : ${err.message}`;
          }
        }

        return true;
      }

      // 2. Legacy Lightbox Fallback Mode
      if (!effectiveCtx.el) return false;
      effectiveCtx.state.lightboxIndex = index;
      effectiveCtx.el.lightboxTitle.textContent = `Lecteur de Documents : ${file.name}`;
      effectiveCtx.el.lightboxContent.innerHTML = `<div style="padding:2rem;text-align:center;">${file.name}</div>`;
      effectiveCtx.el.lightbox.classList.add('open');
      return true;
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(DocViewerPlugin);
  }
})(window);
