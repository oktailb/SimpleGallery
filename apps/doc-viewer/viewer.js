/**
 * SimpleGallery 2026 - Document Viewer Application
 * Autonomous viewer supporting embedded PDF preview, interactive Text/Markdown/Code reader,
 * and integrated WYSIWYG / Markdown Editor (Toast UI Editor) in WebOS Windows.
 */
(function (window) {
  'use strict';

  let toastUiLoadingPromise = null;
  let markdownEnginesPromise = null;
  let latexEnginePromise = null;

  /**
   * Lazy-loads Toast UI Editor CDN assets on-demand
   */
  function loadToastUiEditor() {
    if (window.toastui && window.toastui.Editor) {
      return Promise.resolve(window.toastui.Editor);
    }
    if (toastUiLoadingPromise) return toastUiLoadingPromise;

    toastUiLoadingPromise = new Promise((resolve, reject) => {
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
   * Lazy-loads Marked.js, Prism.js and KaTeX on-demand
   */
  function loadMarkdownEngines() {
    if (markdownEnginesPromise) return markdownEnginesPromise;
    markdownEnginesPromise = new Promise((resolve) => {
      const loadScript = (id, src) => new Promise((res) => {
        if (document.getElementById(id)) return res();
        const s = document.createElement('script');
        s.id = id;
        s.src = src;
        s.onload = () => res();
        s.onerror = () => res(); // graceful fallback
        document.head.appendChild(s);
      });

      const loadLink = (id, href) => {
        if (document.getElementById(id)) return;
        const l = document.createElement('link');
        l.id = id;
        l.rel = 'stylesheet';
        l.href = href;
        document.head.appendChild(l);
      };

      loadLink('katex-css', 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css');
      loadLink('prism-theme-css', 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css');

      Promise.all([
        loadScript('marked-js', 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js'),
        loadScript('katex-js', 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js'),
        loadScript('prism-js', 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js')
      ]).then(() => {
        resolve();
      });
    });
    return markdownEnginesPromise;
  }

  /**
   * Lazy-loads LaTeX.js on-demand
   */
  function loadLatexEngine() {
    if (latexEnginePromise) return latexEnginePromise;
    latexEnginePromise = new Promise((resolve) => {
      if (window.latexjs) return resolve(window.latexjs);

      const s = document.createElement('script');
      s.id = 'latexjs-js';
      s.src = 'https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/latex.min.js';
      s.onload = () => resolve(window.latexjs || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return latexEnginePromise;
  }

  /**
   * Pure JS Fallback Markdown-to-HTML parser (100% resilient offline)
   */
  function fallbackPureJsMarkdown(md) {
    if (!md || typeof md !== 'string') return '';
    let html = md;

    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const cleanLang = lang ? ` class="language-${lang}"` : '';
      return `<pre class="md-codeblock"><code${cleanLang}>${code.trim()}</code></pre>`;
    });

    html = html.replace(/`([^`\n]+)`/g, '<code class="md-inline-code">$1</code>');
    html = html.replace(/^#{6}\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>');
    html = html.replace(/^#{5}\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>');
    html = html.replace(/^#{4}\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^#{3}\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^#{2}\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');
    html = html.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<hr class="md-hr">');
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="md-blockquote"><p>$1</p></blockquote>');

    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      const cleanUrl = url.trim();
      if (cleanUrl.startsWith('file://')) {
        return `<span class="md-local-ref" title="${cleanUrl}">🖼️ [${alt || cleanUrl.split('/').pop()}]</span>`;
      }
      return `<img src="${cleanUrl}" alt="${alt}" class="md-img" />`;
    });

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const cleanUrl = url.trim();
      if (cleanUrl.startsWith('file://')) {
        return `<span class="md-local-ref" title="${cleanUrl}">📄 ${text}</span>`;
      }
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="md-link">${text}</a>`;
    });

    // Lists
    const rawLines = html.split('\n');
    const processed = [];
    let activeList = null;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const taskMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === 'x';
        if (activeList !== 'task') {
          if (activeList) processed.push(`</${activeList === 'ol' ? 'ol' : 'ul'}>`);
          processed.push('<ul class="md-ul md-task-list">');
          activeList = 'task';
        }
        processed.push(`<li class="md-task-item"><input type="checkbox" ${checked ? 'checked ' : ''}disabled /> <span>${taskMatch[2]}</span></li>`);
        continue;
      }

      const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
      if (ulMatch) {
        if (activeList !== 'ul') {
          if (activeList) processed.push(`</${activeList === 'ol' ? 'ol' : 'ul'}>`);
          processed.push('<ul class="md-ul">');
          activeList = 'ul';
        }
        processed.push(`<li class="md-li">${ulMatch[1]}</li>`);
        continue;
      }

      const olMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
      if (olMatch) {
        if (activeList !== 'ol') {
          if (activeList) processed.push(`</${activeList === 'ol' ? 'ol' : 'ul'}>`);
          processed.push('<ol class="md-ol">');
          activeList = 'ol';
        }
        processed.push(`<li class="md-oli">${olMatch[2]}</li>`);
        continue;
      }

      if (activeList) {
        processed.push(`</${activeList === 'ol' ? 'ol' : 'ul'}>`);
        activeList = null;
      }
      processed.push(line);
    }
    if (activeList) processed.push(`</${activeList === 'ol' ? 'ol' : 'ul'}>`);
    html = processed.join('\n');

    // Tables
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
        if (/^\|[\s\-:|]+\|$/.test(line)) continue;
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

  /**
   * Enhanced Modern Markdown-to-HTML parser with KaTeX, Prism & GitHub Callouts
   */
  function renderMarkdownHtml(md) {
    if (!md || typeof md !== 'string') return '';

    const mathBlocks = [];
    const mathInlines = [];
    let processed = md;

    // 1. Extract & Protect Math Blocks: $$...$$
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      const idx = mathBlocks.length;
      mathBlocks.push(formula.trim());
      return `@@MATH_BLOCK_${idx}@@`;
    });

    // 2. Extract & Protect Inline Math: $...$
    processed = processed.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, formula) => {
      const idx = mathInlines.length;
      mathInlines.push(formula.trim());
      return `${prefix}@@MATH_INLINE_${idx}@@`;
    });

    // 3. GitHub Alerts / Callouts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
    const alertIcons = {
      note: 'ℹ️',
      tip: '💡',
      important: '🟣',
      warning: '⚠️',
      caution: '🛑'
    };
    processed = processed.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:^>.*$\n?)*)/gmi, (match, type, content) => {
      const cleanType = type.toLowerCase();
      const icon = alertIcons[cleanType] || 'ℹ️';
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      return `\n\n<div class="md-alert md-alert-${cleanType}"><div class="md-alert-title"><span>${icon}</span> <span>${type}</span></div><div class="md-alert-content">${cleanContent}</div></div>\n\n`;
    });

    let html = '';
    // Use Marked if available, otherwise pure JS fallback
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        html = window.marked.parse(processed, { gfm: true, breaks: true });
      } catch (e) {
        html = fallbackPureJsMarkdown(processed);
      }
    } else {
      html = fallbackPureJsMarkdown(processed);
    }

    // 4. Restore and Render Math with KaTeX
    html = html.replace(/@@MATH_BLOCK_(\d+)@@/g, (match, idx) => {
      const formula = mathBlocks[Number(idx)];
      if (window.katex && typeof window.katex.renderToString === 'function') {
        try {
          return window.katex.renderToString(formula, { displayMode: true, throwOnError: false });
        } catch (e) {
          return `<div class="katex-display"><code>$$${formula}$$</code></div>`;
        }
      }
      return `<div class="katex-display"><code>$$${formula}$$</code></div>`;
    });

    html = html.replace(/@@MATH_INLINE_(\d+)@@/g, (match, idx) => {
      const formula = mathInlines[Number(idx)];
      if (window.katex && typeof window.katex.renderToString === 'function') {
        try {
          return window.katex.renderToString(formula, { displayMode: false, throwOnError: false });
        } catch (e) {
          return `<code class="md-inline-code">$${formula}$</code>`;
        }
      }
      return `<code class="md-inline-code">$${formula}$</code>`;
    });

    // 5. Enhance code blocks with Container, Language Header, and Copy Button
    html = html.replace(/<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi, (match, lang, code) => {
      const displayLang = (lang || 'code').toUpperCase();
      const codeId = 'code-' + Math.random().toString(36).slice(2, 9);
      return `
        <div class="md-codeblock-container">
          <div class="md-codeblock-header">
            <span>${displayLang}</span>
            <button type="button" class="md-code-copy-btn" data-code-id="${codeId}">📋 Copier</button>
          </div>
          <pre><code id="${codeId}" class="${lang ? 'language-' + lang : ''}">${code}</code></pre>
        </div>
      `;
    });

    return html;
  }

  const DocViewerPlugin = {
    id: 'generic-doc',
    nameKey: 'viewer.doc',
    categories: ['doc', 'other'],
    extensions: ['pdf', 'txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'htm', 'tex', 'latex', 'js', 'css', 'php', 'py', 'sh', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'log', 'ini', 'sql', 'yaml', 'yml'],
    mimeTypes: ['application/pdf', 'text/*', 'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
    defaultTarget: 'pip',
    supportsFullscreen: true,
    supportsPip: true,
    cssPath: 'apps/doc-viewer/viewer.css',
    instances: new Map(),

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
      const ext = (file.extension || (file.name ? file.name.split('.').pop() : '')).toLowerCase();
      const isPdf = ext === 'pdf';
      const isMd = ['md', 'markdown'].includes(ext);
      const isHtml = ['html', 'htm'].includes(ext);
      const isTex = ['tex', 'latex'].includes(ext);
      const isText = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'htm', 'tex', 'latex', 'js', 'css', 'php', 'py', 'sh', 'log', 'ini', 'sql', 'yaml', 'yml'].includes(ext);
      const isEditableText = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'htm', 'tex', 'latex', 'css', 'js', 'log', 'ini', 'sql', 'yaml', 'yml'].includes(ext) && !['php', 'phtml', 'phar', 'sh', 'exe'].includes(ext);
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
          const pdfUrl = file.file_url + (file.file_url.includes('?') ? '&' : '?') + 'v=' + (file.mtime || Date.now());
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:var(--window-bg, var(--bg-main, #1e293b));">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--header-bg, var(--bg-card, rgba(0,0,0,0.3)));border-bottom:1px solid var(--border-color, rgba(255,255,255,0.1));">
                <span style="font-size:0.85rem;font-weight:600;color:var(--text-main, #f8fafc);">📄 ${effectiveCtx.escapeHtml(file.name)} (${file.size_formatted})</span>
                <div style="display:flex;gap:8px;">
                  <button type="button" id="docPdfInfoBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--bg-card, rgba(255,255,255,0.1));color:var(--text-main, #fff);border-radius:8px;" data-i18n-title="lightbox.metadata_btn" title="${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.metadata_btn') || 'Propriétés (I)')}">ℹ️</button>
                  <a href="${pdfUrl}" target="_blank" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:var(--text-main, #fff);background:var(--bg-card, rgba(255,255,255,0.1));border-radius:8px;">↗ Nouvel onglet</a>
                  ${canDownloadItem ? `<a href="${pdfUrl}" download="${effectiveCtx.escapeHtml(file.name)}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:#fff;background:var(--accent-primary, #6366f1);border-radius:8px;"><span data-i18n="lightbox.download">📥 Télécharger</span></a>` : ''}
                </div>
              </div>
              <object class="doc-pdf-iframe" data="${pdfUrl}" type="application/pdf" style="width:100%;height:100%;border:none;flex:1;">
                <iframe class="doc-pdf-iframe" src="${pdfUrl}" title="${effectiveCtx.escapeHtml(file.name)}" style="width:100%;height:100%;border:none;flex:1;">
                  <div style="padding:2rem;text-align:center;color:var(--text-main, #fff);">
                    <p>Votre navigateur ne prend pas en charge l'affichage PDF direct.</p>
                    <a href="${pdfUrl}" target="_blank" style="color:var(--accent-primary, #60a5fa);">Ouvrir le PDF</a>
                  </div>
                </iframe>
              </object>
            </div>
          `;
        } else if (isText) {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:var(--window-bg, var(--bg-main, #0d1117));color:var(--text-main, #c9d1d9);position:relative;">
              <!-- Reader View Toolbar -->
              <div id="docReaderToolbar-${cleanPathId}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--header-bg, var(--bg-card, rgba(255,255,255,0.03)));border-bottom:1px solid var(--border-color, rgba(255,255,255,0.08));">
                <span style="font-size:0.85rem;font-weight:600;color:var(--text-main, #f8fafc);">${isMd ? '📖' : (isHtml ? '🌐' : (isTex ? '📜' : '📝'))} ${effectiveCtx.escapeHtml(file.name)} (${file.size_formatted})</span>
                <div style="display:flex;gap:8px;align-items:center;">
                  <button type="button" id="docTextInfoBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--bg-card, rgba(255,255,255,0.1));color:var(--text-main, #fff);border-radius:8px;" data-i18n-title="lightbox.metadata_btn" title="${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.metadata_btn') || 'Propriétés (I)')}">ℹ️</button>
                  <button type="button" id="docWinCopyBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--bg-card, rgba(255,255,255,0.1));color:var(--text-main, #fff);border-radius:8px;">📋 Copier</button>
                  ${isMd ? `<button type="button" id="docMdViewToggleBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--bg-card, rgba(255,255,255,0.12));color:var(--text-main, #fff);border-radius:8px;">📄 Code Source</button>` : ''}
                  ${isHtml ? `<button type="button" id="docHtmlViewToggleBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--bg-card, rgba(255,255,255,0.12));color:var(--text-main, #fff);border-radius:8px;">📄 Code Source</button>` : ''}
                  ${isTex ? `<button type="button" id="docTexViewToggleBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--bg-card, rgba(255,255,255,0.12));color:var(--text-main, #fff);border-radius:8px;">📄 Code Source TeX</button>` : ''}
                  ${canEdit ? `<button type="button" id="docEditToggleBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;cursor:pointer;border:none;background:var(--accent-primary,#6366f1);color:#fff;border-radius:8px;font-weight:600;"><span data-i18n="doc_editor.edit_btn">✏️ ${effectiveCtx.escapeHtml(effectiveCtx.t('doc_editor.edit_btn'))}</span></button>` : ''}
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${effectiveCtx.escapeHtml(file.name)}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;text-decoration:none;color:var(--text-main, #fff);background:var(--bg-card, rgba(255,255,255,0.1));border-radius:8px;"><span data-i18n="lightbox.download">📥 Télécharger</span></a>` : ''}
                </div>
              </div>

              <!-- Reader Text / Markdown Content -->
              <div id="docWinTextContainer-${cleanPathId}" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--window-bg, var(--bg-main, #0d1117));">
                <div id="docWinTextBody-${cleanPathId}" class="doc-text-body ${isMd ? 'doc-markdown-render' : 'doc-code-render'}">Chargement du document...</div>
              </div>

              <!-- WebOS Code & LaTeX Studio / Markdown Editor View -->
              <div id="docEditorView-${cleanPathId}" class="doc-editor-container" style="display:none;flex:1;flex-direction:column;">
                <div class="doc-editor-toolbar">
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span id="docEditorStatusBadge-${cleanPathId}" class="doc-status-badge saved">● Enregistré</span>
                    <span class="doc-editor-badge-lang">${isTex ? '📐 LaTeX' : (isMd ? '📝 Markdown' : (isHtml ? '🌐 HTML' : `📄 ${ext.toUpperCase()}`))}</span>
                    <span style="font-size:0.75rem;color:var(--text-muted,#94a3b8);">(Ctrl+S pour enregistrer)</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    ${isMd ? `<button type="button" id="docToggleWysiwygBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 10px;background:var(--bg-card, rgba(255,255,255,0.1));color:var(--text-main, #fff);border:none;border-radius:8px;cursor:pointer;">✨ WYSIWYG</button>` : ''}
                    <button type="button" id="docSaveBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 14px;background:#22c55e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">💾 Enregistrer</button>
                    <button type="button" id="docCloseEditBtn-${cleanPathId}" class="app-menu-pill" style="font-size:0.75rem;padding:4px 12px;background:var(--bg-card, rgba(255,255,255,0.12));color:var(--text-main, #fff);border:none;border-radius:8px;cursor:pointer;">👁️ Mode Lecture (Rendu)</button>
                  </div>
                </div>

                ${isTex ? `
                <div id="docTexToolbar-${cleanPathId}" class="doc-tex-helper-bar">
                  <span class="doc-tex-bar-label">Macros LaTeX :</span>
                  <button type="button" class="doc-tex-pill" data-tex-macro="section" title="\\section{Titre}">\\section</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="subsection" title="\\subsection{Titre}">\\subsection</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="textbf" title="\\textbf{Texte gras}">\\textbf</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="textit" title="\\textit{Texte italique}">\\textit</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="math-block" title="$$ Équation $$">$$...$$</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="math-inline" title="$ Formule $">$...$</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="frac" title="\\frac{num}{den}">\\frac{}{}</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="env-itemize" title="\\begin{itemize} ... \\end{itemize}">\\begin{itemize}</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="env-enumerate" title="\\begin{enumerate} ... \\end{enumerate}">\\begin{enumerate}</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="item" title="\\item Nouvel élément">\\item</button>
                  <button type="button" class="doc-tex-pill" data-tex-macro="comment" title="% Commentaire">% Com</button>
                </div>
                ` : ''}

                <!-- Modern Code & Text Studio Area -->
                <div id="docCodeStudio-${cleanPathId}" class="doc-code-studio">
                  <div class="doc-code-editor-layout">
                    <div id="docCodeGutter-${cleanPathId}" class="doc-code-gutter" aria-hidden="true">1</div>
                    <textarea id="docCodeTextarea-${cleanPathId}" class="doc-code-textarea" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off"></textarea>
                  </div>
                  <div id="docCodeStatusBar-${cleanPathId}" class="doc-code-status-bar">
                    <span id="docCodePos-${cleanPathId}">Ligne 1, Col 1</span>
                    <span id="docCodeCounts-${cleanPathId}">0 lignes • 0 caractères</span>
                  </div>
                </div>

                <!-- Toast UI Container (Fallback WYSIWYG for Markdown only) -->
                <div id="docEditorHost-${cleanPathId}" style="display:none;flex:1;height:calc(100% - 42px);overflow:hidden;"></div>
              </div>
            </div>
          `;
        } else {
          bodyHtml = `
            <div class="webos-doc-container" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--window-bg, var(--bg-main, #0f172a));padding:2rem;">
              <div class="doc-viewer-card" style="background:var(--bg-card, rgba(30,41,59,0.7));backdrop-filter:blur(16px);border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:16px;padding:2.5rem;text-align:center;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                <div style="font-size:3.5rem;margin-bottom:1rem;">📄</div>
                <div style="font-size:1.15rem;font-weight:700;color:var(--text-main, #fff);margin-bottom:0.4rem;word-break:break-all;">${effectiveCtx.escapeHtml(file.name)}</div>
                <div style="font-size:0.85rem;color:var(--text-muted,#94a3b8);margin-bottom:1.5rem;">${file.size_formatted} • Format ${ext.toUpperCase()}</div>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                  <button type="button" id="docCardInfoBtn-${cleanPathId}" class="app-menu-pill" style="padding:8px 16px;cursor:pointer;border:none;background:var(--bg-card, rgba(255,255,255,0.1));color:var(--text-main, #fff);border-radius:10px;"><span data-i18n="lightbox.metadata_btn">ℹ️ ${effectiveCtx.escapeHtml(effectiveCtx.t('lightbox.metadata_btn') || 'Propriétés')}</span></button>
                  <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="text-decoration:none;padding:8px 16px;background:var(--bg-card, rgba(255,255,255,0.12));color:var(--text-main, #fff);border-radius:10px;">↗ Ouvrir le fichier</a>
                  ${canDownloadItem ? `<a href="${file.file_url}" download="${effectiveCtx.escapeHtml(file.name)}" class="app-menu-pill" style="text-decoration:none;padding:8px 16px;background:var(--accent-primary, #6366f1);color:#fff;border-radius:10px;font-weight:600;"><span data-i18n="lightbox.download">📥 Télécharger</span></a>` : ''}
                </div>
              </div>
            </div>
          `;
        }

        const appTitle = (window.sys && window.sys.appManager)
          ? window.sys.appManager.getAppTitle('doc-viewer')
          : (effectiveCtx.t('apps.doc-viewer.title'));

        let activeEditorInstance = null;
        let isEditing = false;
        let isRawSourceMode = false;
        let currentRawText = '';

        const updateReaderDisplay = () => {
          const bodyEl = document.getElementById(`docWinTextBody-${cleanPathId}`);
          const mdToggleBtn = document.getElementById(`docMdViewToggleBtn-${cleanPathId}`);
          const htmlToggleBtn = document.getElementById(`docHtmlViewToggleBtn-${cleanPathId}`);
          const texToggleBtn = document.getElementById(`docTexViewToggleBtn-${cleanPathId}`);
          if (!bodyEl) return;

          // 1. Markdown Mode (Rich GFM, Math KaTeX, Prism Highlighting, Copy Buttons)
          if (isMd && !isRawSourceMode) {
            bodyEl.className = 'doc-text-body doc-markdown-render';
            bodyEl.style.padding = '';
            bodyEl.innerHTML = renderMarkdownHtml(currentRawText);
            if (mdToggleBtn) mdToggleBtn.textContent = '📄 Code Source';

            // Bind code block copy buttons
            bodyEl.querySelectorAll('.md-code-copy-btn').forEach(btn => {
              btn.onclick = (e) => {
                e.stopPropagation();
                const codeId = btn.dataset.codeId;
                const codeEl = document.getElementById(codeId);
                if (codeEl) {
                  navigator.clipboard.writeText(codeEl.textContent || '').then(() => {
                    const orig = btn.textContent;
                    btn.textContent = '✅ Copié !';
                    setTimeout(() => { btn.textContent = orig; }, 2000);
                  });
                }
              };
            });

            // Highlight syntax with Prism if loaded
            if (window.Prism && typeof window.Prism.highlightAllUnder === 'function') {
              try { window.Prism.highlightAllUnder(bodyEl); } catch (e) {}
            }
          }
          // 2. HTML Mode (Isolated Web Preview)
          else if (isHtml && !isRawSourceMode) {
            bodyEl.className = 'doc-text-body';
            bodyEl.style.padding = '0';
            const htmlSrc = file.file_url + (file.file_url.includes('?') ? '&' : '?') + 't=' + Date.now();
            bodyEl.innerHTML = `<iframe class="doc-html-frame" sandbox="allow-scripts allow-same-origin" src="${htmlSrc}" title="${effectiveCtx.escapeHtml(file.name)}"></iframe>`;
            if (htmlToggleBtn) htmlToggleBtn.textContent = '📄 Code Source';
          }
          // 3. LaTeX Mode (Compiled TeX View via latex.js in High-Fidelity Paper Iframe)
          else if (isTex && !isRawSourceMode) {
            bodyEl.className = 'doc-text-body';
            bodyEl.style.padding = '0';
            bodyEl.style.overflow = 'hidden';
            bodyEl.innerHTML = `<div id="docLatexHost-${cleanPathId}" style="width:100%;height:100%;display:flex;flex-direction:column;background:var(--desk-bg, #f1f5f9);">
              <div id="docLatexLoading-${cleanPathId}" style="padding:2.5rem;text-align:center;color:var(--text-muted,#64748b);font-size:0.95rem;">
                ⏳ Compilation du document LaTeX via LaTeX.js...
              </div>
            </div>`;
            if (texToggleBtn) texToggleBtn.textContent = '📄 Code Source TeX';

            const compileTex = (latexjs) => {
              const host = document.getElementById(`docLatexHost-${cleanPathId}`);
              if (!host) return;

              try {
                if (latexjs && typeof latexjs.parse === 'function') {
                  const generator = new latexjs.HtmlGenerator({ hyphenate: false });
                  const parsed = latexjs.parse(currentRawText, { generator: generator });
                  const baseURL = "https://cdn.jsdelivr.net/npm/latex.js@0.12.4/dist/";
                  const doc = parsed.htmlDocument(baseURL);

                  // 1. Inject KaTeX CSS
                  const katexLink = doc.createElement('link');
                  katexLink.rel = 'stylesheet';
                  katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
                  doc.head.appendChild(katexLink);

                  // 2. High-fidelity paper layout preserving LaTeX.js native CSS grid
                  const customStyle = doc.createElement('style');
                  customStyle.textContent = `
                    html {
                      background-color: #f1f5f9;
                      margin: 0;
                      padding: 0;
                      min-height: 100%;
                    }
                    body {
                      background-color: #ffffff !important;
                      color: #111827 !important;
                      max-width: 920px !important;
                      min-height: 100vh !important;
                      margin: 2rem auto !important;
                      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08) !important;
                      border-radius: 2px !important;
                      box-sizing: border-box !important;
                    }
                    @media (max-width: 960px) {
                      html { background-color: #ffffff; }
                      body {
                        max-width: 100% !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                      }
                    }
                  `;
                  doc.head.appendChild(customStyle);

                  const frame = document.createElement('iframe');
                  frame.className = 'doc-latex-frame';
                  frame.style.width = '100%';
                  frame.style.height = '100%';
                  frame.style.border = 'none';
                  frame.style.background = '#f1f5f9';
                  frame.title = effectiveCtx.escapeHtml(file.name);
                  frame.sandbox = 'allow-scripts allow-same-origin';

                  host.innerHTML = '';
                  host.appendChild(frame);
                  frame.srcdoc = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
                } else {
                  host.innerHTML = `<div class="doc-markdown-render" style="padding:2rem;">` + renderMarkdownHtml(currentRawText) + `</div>`;
                }
              } catch (e) {
                console.warn('LaTeX.js parse error:', e);
                host.innerHTML = `
                  <div style="padding:2rem;max-width:900px;margin:0 auto;width:100%;box-sizing:border-box;">
                    <div style="color:#ef4444;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-left:4px solid #ef4444;border-radius:8px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;font-family:sans-serif;">
                      <div style="font-weight:700;margin-bottom:0.4rem;display:flex;align-items:center;gap:8px;">
                        <span>⚠️</span> Diagnostic de compilation LaTeX.js
                      </div>
                      <div style="font-family:monospace;font-size:0.85rem;color:#fca5a5;word-break:break-word;">${effectiveCtx.escapeHtml(e.message)}</div>
                      <div style="margin-top:0.8rem;font-size:0.8rem;color:var(--text-muted,#94a3b8);">
                        Rendu de secours en mode mathématique universel (KaTeX) :
                      </div>
                    </div>
                    <div class="doc-markdown-render">${renderMarkdownHtml(currentRawText)}</div>
                  </div>`;
              }
            };

            if (window.latexjs && typeof window.latexjs.parse === 'function') {
              compileTex(window.latexjs);
            } else {
              loadLatexEngine().then(compileTex);
            }
          }
          // 4. Raw Code / Text Mode
          else {
            bodyEl.className = 'doc-text-body doc-code-render';
            bodyEl.style.padding = '';
            bodyEl.textContent = currentRawText;
            if (mdToggleBtn) mdToggleBtn.textContent = '👁️ Rendu Final';
            if (htmlToggleBtn) htmlToggleBtn.textContent = '🌐 Aperçu Web';
            if (texToggleBtn) texToggleBtn.textContent = '📜 Rendu LaTeX';
          }
        };

        let isWysiwygActive = false;
        let codeStudioBound = false;

        const setupCodeStudio = (textareaEl, gutterEl, posEl, countsEl, onDirty) => {
          const updateGutter = () => {
            if (!gutterEl) return;
            const lines = textareaEl.value.split('\n');
            const count = lines.length;
            let html = '';
            for (let i = 1; i <= count; i++) {
              html += `<div>${i}</div>`;
            }
            gutterEl.innerHTML = html;
          };

          const updateStatus = () => {
            const text = textareaEl.value;
            const selStart = textareaEl.selectionStart;
            const linesUpTo = text.substring(0, selStart).split('\n');
            const lineNum = linesUpTo.length;
            const colNum = linesUpTo[linesUpTo.length - 1].length + 1;
            const totalLines = text.split('\n').length;
            if (posEl) posEl.textContent = `Ligne ${lineNum}, Col ${colNum}`;
            if (countsEl) countsEl.textContent = `${totalLines} lignes • ${text.length} caractères`;
          };

          updateGutter();
          updateStatus();

          if (codeStudioBound) return;
          codeStudioBound = true;

          textareaEl.addEventListener('scroll', () => {
            if (gutterEl) gutterEl.scrollTop = textareaEl.scrollTop;
          });

          textareaEl.addEventListener('input', () => {
            updateGutter();
            updateStatus();
            if (onDirty) onDirty();
          });

          textareaEl.addEventListener('keyup', updateStatus);
          textareaEl.addEventListener('click', updateStatus);

          textareaEl.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = textareaEl.selectionStart;
              const end = textareaEl.selectionEnd;
              const val = textareaEl.value;
              if (start === end) {
                textareaEl.value = val.substring(0, start) + '  ' + val.substring(end);
                textareaEl.selectionStart = textareaEl.selectionEnd = start + 2;
              } else {
                const before = val.substring(0, start);
                const sel = val.substring(start, end);
                const after = val.substring(end);
                const lines = sel.split('\n');
                if (e.shiftKey) {
                  const newLines = lines.map(l => l.startsWith('  ') ? l.slice(2) : (l.startsWith(' ') ? l.slice(1) : l));
                  textareaEl.value = before + newLines.join('\n') + after;
                } else {
                  const newLines = lines.map(l => '  ' + l);
                  textareaEl.value = before + newLines.join('\n') + after;
                }
                textareaEl.selectionStart = start;
                textareaEl.selectionEnd = start + (textareaEl.value.length - val.length);
              }
              updateGutter();
              updateStatus();
              if (onDirty) onDirty();
            } else if (e.key === 'Enter') {
              const start = textareaEl.selectionStart;
              const val = textareaEl.value;
              const lineStart = val.lastIndexOf('\n', start - 1) + 1;
              const currentLine = val.substring(lineStart, start);
              const matchIndent = currentLine.match(/^\s+/);
              if (matchIndent && matchIndent[0]) {
                e.preventDefault();
                const indent = matchIndent[0];
                textareaEl.value = val.substring(0, start) + '\n' + indent + val.substring(start);
                textareaEl.selectionStart = textareaEl.selectionEnd = start + 1 + indent.length;
                updateGutter();
                updateStatus();
                if (onDirty) onDirty();
              }
            }
          });
        };

        const insertTexMacro = (type) => {
          const textarea = document.getElementById(`docCodeTextarea-${cleanPathId}`);
          if (!textarea) return;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const val = textarea.value;
          const sel = val.substring(start, end);

          let before = '';
          let after = '';
          let defaultInside = '';

          switch (type) {
            case 'section':
              before = '\\section{';
              after = '}';
              defaultInside = 'Titre';
              break;
            case 'subsection':
              before = '\\subsection{';
              after = '}';
              defaultInside = 'Sous-titre';
              break;
            case 'textbf':
              before = '\\textbf{';
              after = '}';
              break;
            case 'textit':
              before = '\\textit{';
              after = '}';
              break;
            case 'math-block':
              before = '$$\n  ';
              after = '\n$$';
              break;
            case 'math-inline':
              before = '$';
              after = '$';
              break;
            case 'frac':
              before = '\\frac{';
              after = '}{b}';
              defaultInside = 'a';
              break;
            case 'env-itemize':
              before = '\\begin{itemize}\n  \\item ';
              after = '\n\\end{itemize}';
              break;
            case 'env-enumerate':
              before = '\\begin{enumerate}\n  \\item ';
              after = '\n\\end{enumerate}';
              break;
            case 'item':
              before = '\\item ';
              after = '';
              break;
            case 'comment':
              before = '% ';
              after = '';
              break;
            default:
              before = `\\${type}{`;
              after = '}';
          }

          const content = sel || defaultInside;
          const replacement = before + content + after;
          textarea.value = val.substring(0, start) + replacement + val.substring(end);
          textarea.selectionStart = start + before.length;
          textarea.selectionEnd = start + before.length + content.length;
          textarea.focus();
          textarea.dispatchEvent(new Event('input'));
        };

        // Function to perform file saving
        const saveDocument = async () => {
          let newContent = '';
          const textarea = document.getElementById(`docCodeTextarea-${cleanPathId}`);
          if (isWysiwygActive && activeEditorInstance && typeof activeEditorInstance.getMarkdown === 'function') {
            newContent = activeEditorInstance.getMarkdown();
          } else if (textarea) {
            newContent = textarea.value;
          } else if (activeEditorInstance && typeof activeEditorInstance.getMarkdown === 'function') {
            newContent = activeEditorInstance.getMarkdown();
          } else {
            newContent = currentRawText;
          }

          const badge = document.getElementById(`docEditorStatusBadge-${cleanPathId}`);
          const saveBtn = document.getElementById(`docSaveBtn-${cleanPathId}`);

          if (badge) {
            badge.className = 'doc-status-badge dirty';
            badge.textContent = '⏳ Enregistrement...';
          }
          if (saveBtn) saveBtn.disabled = true;

          try {
            const json = await window.sys.api.fs.saveTextFile(file.path, newContent);
            if (saveBtn) saveBtn.disabled = false;

            if (json.success) {
              currentRawText = newContent;
              file.file_url = file.file_url.replace(/([?&])t=\d+/, '') + (file.file_url.includes('?') ? '&' : '?') + 't=' + Date.now();
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

        // Function to toggle between Reader and Editor View
        const toggleEditor = async (forceState) => {
          if (!canEdit) return;
          const nextState = (forceState !== undefined) ? forceState : !isEditing;
          isEditing = nextState;

          const readerToolbar = document.getElementById(`docReaderToolbar-${cleanPathId}`);
          const textContainer = document.getElementById(`docWinTextContainer-${cleanPathId}`);
          const editorView = document.getElementById(`docEditorView-${cleanPathId}`);
          const textarea = document.getElementById(`docCodeTextarea-${cleanPathId}`);
          const gutterEl = document.getElementById(`docCodeGutter-${cleanPathId}`);
          const posEl = document.getElementById(`docCodePos-${cleanPathId}`);
          const countsEl = document.getElementById(`docCodeCounts-${cleanPathId}`);
          const badge = document.getElementById(`docEditorStatusBadge-${cleanPathId}`);

          if (readerToolbar) readerToolbar.style.display = isEditing ? 'none' : 'flex';
          if (textContainer) textContainer.style.display = isEditing ? 'none' : 'flex';
          if (editorView) editorView.style.display = isEditing ? 'flex' : 'none';

          if (isEditing) {
            if (textarea) {
              textarea.value = currentRawText;
              setupCodeStudio(textarea, gutterEl, posEl, countsEl, () => {
                if (badge) {
                  badge.className = 'doc-status-badge dirty';
                  badge.textContent = '● Non sauvegardé';
                }
              });
              setTimeout(() => { textarea.focus(); }, 50);
            }
          } else {
            // Returning to reader mode: sync text and refresh rendered preview
            if (textarea && !isWysiwygActive) {
              currentRawText = textarea.value;
            } else if (activeEditorInstance && isWysiwygActive) {
              currentRawText = activeEditorInstance.getMarkdown();
            }
            updateReaderDisplay();
          }
        };

        const win = window.WindowManager.createWindow({
          id: winId,
          appId: 'doc-viewer',
          appName: appTitle,
          fileName: file.name,
          title: `${appTitle} : ${file.name}`,
          icon: isMd ? '📖' : '📄',
          width: (typeof options.width === 'number') ? options.width : defaultW,
          height: (typeof options.height === 'number') ? options.height : defaultH,
          x: (typeof options.x === 'number') ? options.x : undefined,
          y: (typeof options.y === 'number') ? options.y : undefined,
          content: bodyHtml,
          onFocus: () => {
            if (window.MenuBarManager) {
              window.MenuBarManager.registerAppMenu('doc-viewer', (container) => {
                container.innerHTML = `
                  <div class="app-menu-left">
                    <span class="app-menu-pill active" style="font-weight:600;">${isMd ? '📖' : '📄'} ${effectiveCtx.escapeHtml(file.name)}</span>
                    <a href="${file.file_url}" target="_blank" class="app-menu-pill" style="text-decoration:none;">↗ ${effectiveCtx.escapeHtml(effectiveCtx.t('viewer.open_new_tab') || 'Nouvel onglet')}</a>
                    ${canEdit ? `<button type="button" class="app-menu-pill" id="menuDocEditBtn" style="background:var(--accent-primary,#6366f1);color:#fff;">✏️ ${effectiveCtx.escapeHtml(effectiveCtx.t('doc_editor.edit_btn'))}</button>` : ''}
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
          },
          onClose: () => {
            DocViewerPlugin.instances.delete(winId);
          }
        });

        DocViewerPlugin.instances.set(winId, {
          winId,
          cleanPathId,
          file,
          isPdf,
          isMd,
          isText,
          currentPage: 1,
          toggleEditor: (forceState) => toggleEditor(forceState),
          getContainer: () => document.getElementById(`docWinTextBody-${cleanPathId}`) || document.getElementById(`docWinTextContainer-${cleanPathId}`),
          getPdfEmbed: () => document.getElementById(`docPdfEmbed-${cleanPathId}`) || (win.element ? win.element.querySelector('object, iframe') : null)
        });

        // Bind in-window info & action buttons
        setTimeout(() => {
          const pdfInfo = document.getElementById(`docPdfInfoBtn-${cleanPathId}`);
          const textInfo = document.getElementById(`docTextInfoBtn-${cleanPathId}`);
          const cardInfo = document.getElementById(`docCardInfoBtn-${cleanPathId}`);
          const editBtn = document.getElementById(`docEditToggleBtn-${cleanPathId}`);
          const closeEditBtn = document.getElementById(`docCloseEditBtn-${cleanPathId}`);
          const saveBtn = document.getElementById(`docSaveBtn-${cleanPathId}`);
          const mdToggleBtn = document.getElementById(`docMdViewToggleBtn-${cleanPathId}`);
          const htmlToggleBtn = document.getElementById(`docHtmlViewToggleBtn-${cleanPathId}`);
          const texToggleBtn = document.getElementById(`docTexViewToggleBtn-${cleanPathId}`);

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
          if (htmlToggleBtn) {
            htmlToggleBtn.onclick = () => {
              isRawSourceMode = !isRawSourceMode;
              updateReaderDisplay();
            };
          }
          if (texToggleBtn) {
            texToggleBtn.onclick = () => {
              isRawSourceMode = !isRawSourceMode;
              updateReaderDisplay();
            };
          }

          const texToolbar = document.getElementById(`docTexToolbar-${cleanPathId}`);
          if (texToolbar) {
            texToolbar.querySelectorAll('.doc-tex-pill').forEach(btn => {
              btn.onclick = () => insertTexMacro(btn.dataset.texMacro);
            });
          }

          const wysiwygBtn = document.getElementById(`docToggleWysiwygBtn-${cleanPathId}`);
          if (wysiwygBtn) {
            wysiwygBtn.onclick = async () => {
              isWysiwygActive = !isWysiwygActive;
              wysiwygBtn.textContent = isWysiwygActive ? '📄 Mode Code' : '✨ WYSIWYG';
              const codeStudio = document.getElementById(`docCodeStudio-${cleanPathId}`);
              const hostEl = document.getElementById(`docEditorHost-${cleanPathId}`);
              const textarea = document.getElementById(`docCodeTextarea-${cleanPathId}`);
              if (isWysiwygActive) {
                if (codeStudio) codeStudio.style.display = 'none';
                if (hostEl) hostEl.style.display = 'block';
                if (textarea) currentRawText = textarea.value;
                if (!activeEditorInstance && hostEl) {
                  showNotification('Chargement de l\'éditeur WYSIWYG...', 'info');
                  try {
                    const Editor = await loadToastUiEditor();
                    activeEditorInstance = new Editor({
                      el: hostEl,
                      height: '100%',
                      initialEditType: 'wysiwyg',
                      previewStyle: 'tab',
                      initialValue: currentRawText,
                      theme: 'dark',
                      usageStatistics: false
                    });
                    activeEditorInstance.on('change', () => {
                      const badge = document.getElementById(`docEditorStatusBadge-${cleanPathId}`);
                      if (badge) {
                        badge.className = 'doc-status-badge dirty';
                        badge.textContent = '● Non sauvegardé';
                      }
                    });
                  } catch (e) {
                    console.error('Failed to init Toast UI Editor:', e);
                    showNotification('⚠️ Erreur éditeur : ' + e.message, 'error');
                  }
                } else if (activeEditorInstance) {
                  activeEditorInstance.setMarkdown(currentRawText);
                }
              } else {
                if (activeEditorInstance) currentRawText = activeEditorInstance.getMarkdown();
                if (hostEl) hostEl.style.display = 'none';
                if (codeStudio) codeStudio.style.display = 'flex';
                if (textarea) {
                  textarea.value = currentRawText;
                  textarea.dispatchEvent(new Event('input'));
                  textarea.focus();
                }
              }
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

        // Load Text / Markdown / HTML / LaTeX Asynchronously
        if (isText) {
          try {
            const fetchUrl = file.file_url + (file.file_url.includes('?') ? '&' : '?') + 't=' + Date.now();
            const res = await fetch(fetchUrl, { cache: 'no-store' });
            const text = await res.text();
            currentRawText = text;
            updateReaderDisplay();

            if (isMd) {
              loadMarkdownEngines().then(() => {
                if (isMd && !isRawSourceMode) updateReaderDisplay();
              });
            } else if (isTex) {
              loadLatexEngine().then(() => {
                if (isTex && !isRawSourceMode) updateReaderDisplay();
              });
            }

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
    },

    getActiveInstance(winId = null) {
      if (winId && this.instances.has(winId)) return this.instances.get(winId);
      const values = Array.from(this.instances.values());
      return values.length > 0 ? values[values.length - 1] : null;
    },

    scrollTo(params = {}, winId = null) {
      const inst = this.getActiveInstance(winId);
      if (!inst) return false;

      const target = params.page != null ? params.page : (params.highlight || params.selector || '1');
      const pageNum = parseInt(target, 10);

      if (inst.isPdf) {
        const embed = inst.getPdfEmbed();
        if (embed && !isNaN(pageNum) && pageNum > 0) {
          inst.currentPage = pageNum;
          const baseUrl = inst.file.file_url.split('#')[0];
          embed.src = `${baseUrl}#page=${pageNum}`;
          return true;
        }
      }

      const container = inst.getContainer();
      if (container) {
        if (typeof target === 'string' && (target.startsWith('#') || target.startsWith('.'))) {
          try {
            const el = container.querySelector(target);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.transition = 'background 0.3s ease';
              el.style.background = 'rgba(99, 102, 241, 0.25)';
              setTimeout(() => { el.style.background = ''; }, 2200);
              return true;
            }
          } catch (e) {}
        }

        if (!isNaN(pageNum) && pageNum > 0) {
          inst.currentPage = pageNum;
          const scrollPos = (pageNum - 1) * container.clientHeight * 0.9;
          container.scrollTo({ top: scrollPos, behavior: 'smooth' });
          return true;
        }
      }
      return false;
    },

    searchText(params = {}, winId = null) {
      const query = params.string || params.query || params.text || '';
      if (!query) return false;
      const inst = this.getActiveInstance(winId);
      if (!inst) return false;
      const container = inst.getContainer();
      if (!container) return false;

      container.querySelectorAll('.doc-search-match').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
        }
      });

      const shouldScroll = params.scrollto !== false && params.scrollto !== 'false' && params.scrollTo !== false;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let node;
      let firstMatchSpan = null;
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');

      while ((node = walker.nextNode())) {
        const match = regex.exec(node.nodeValue);
        if (match) {
          const span = document.createElement('span');
          span.className = 'doc-search-match';
          span.style.background = 'rgba(234, 179, 8, 0.55)';
          span.style.color = '#fff';
          span.style.borderRadius = '3px';
          span.style.padding = '0 2px';
          span.style.boxShadow = '0 0 8px rgba(234, 179, 8, 0.8)';
          span.style.transition = 'all 0.3s ease';

          const splitText = node.splitText(match.index);
          splitText.splitText(match[0].length);
          span.textContent = splitText.nodeValue;
          splitText.parentNode.replaceChild(span, splitText);

          if (!firstMatchSpan) firstMatchSpan = span;
          break;
        }
      }

      if (firstMatchSpan && shouldScroll) {
        firstMatchSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          firstMatchSpan.style.background = 'rgba(99, 102, 241, 0.35)';
          firstMatchSpan.style.boxShadow = 'none';
        }, 2500);
        return true;
      }
      return !!firstMatchSpan;
    },

    nextPage(params = {}, winId = null) {
      const inst = this.getActiveInstance(winId);
      if (!inst) return false;
      if (inst.isPdf) {
        return this.scrollTo({ page: (inst.currentPage || 1) + 1 }, winId);
      }
      const container = inst.getContainer();
      if (container) {
        container.scrollBy({ top: container.clientHeight * 0.85, behavior: 'smooth' });
        inst.currentPage = (inst.currentPage || 1) + 1;
        return true;
      }
      return false;
    },

    prevPage(params = {}, winId = null) {
      const inst = this.getActiveInstance(winId);
      if (!inst) return false;
      if (inst.isPdf) {
        return this.scrollTo({ page: Math.max(1, (inst.currentPage || 1) - 1) }, winId);
      }
      const container = inst.getContainer();
      if (container) {
        container.scrollBy({ top: -container.clientHeight * 0.85, behavior: 'smooth' });
        inst.currentPage = Math.max(1, (inst.currentPage || 1) - 1);
        return true;
      }
      return false;
    },

    setTheme(params = {}, winId = null) {
      const theme = params.theme || 'dark';
      const inst = this.getActiveInstance(winId);
      if (!inst) return false;
      const container = inst.getContainer();
      if (container) {
        if (theme === 'light') {
          container.style.background = '#f8fafc';
          container.style.color = '#0f172a';
        } else if (theme === 'sepia') {
          container.style.background = '#fbf0d9';
          container.style.color = '#433422';
        } else {
          container.style.background = '';
          container.style.color = '';
        }
        return true;
      }
      return false;
    },

    handleCommand(command, params = {}, winId = null) {
      switch (command) {
        case 'nextPage':
          return this.nextPage(params, winId);
        case 'prevPage':
          return this.prevPage(params, winId);
        case 'scrollTo':
        case 'scroll':
          return this.scrollTo(params, winId);
        case 'searchText':
          return this.searchText(params, winId);
        case 'setTheme':
          return this.setTheme(params, winId);
        case 'toggleEdit': {
          const inst = this.getActiveInstance(winId);
          if (inst && typeof inst.toggleEditor === 'function') {
            inst.toggleEditor();
            return true;
          }
          return false;
        }
      }
      return false;
    }
  };

  window.DocViewerApp = DocViewerPlugin;
  window.docViewerApp = DocViewerPlugin;

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(DocViewerPlugin);
  }

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('doc-viewer', DocViewerPlugin);
  }
})(window);
