/**
 * SimpleGallery WebOS - Multimodal Synchronized Presentation Engine (AutorunSyncEngine.js)
 * Coordinates synchronized playback of video/audio with live Markdown documents, slides, and images.
 * Powers VLogs, multimodal blogs, guided tours, and interactive audio-guided photo albums.
 */
(function (window, document) {
  'use strict';

  class AutorunSyncEngine {
    constructor() {
      this.activeSession = null;
    }

    /**
     * Converts time string (MM:SS, HH:MM:SS) or number to seconds
     * @param {string|number} val
     * @returns {number}
     */
    parseTime(val) {
      return this.parseTimecode(val);
    }

    parseTimecode(val) {
      if (typeof val === 'number') return Math.max(0, val);
      if (!val) return 0;
      const str = String(val).trim();
      const parts = str.split(':').map(p => parseFloat(p) || 0);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      return parseFloat(str) || 0;
    }

    /**
     * Formats seconds into MM:SS
     * @param {number} sec
     * @returns {string}
     */
    formatTime(sec) {
      const s = Math.floor(sec || 0);
      const m = Math.floor(s / 60);
      const remS = s % 60;
      return `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
    }

    /**
     * Launches a synchronized multimodal presentation from autorun.json configuration
     * @param {Object} config - The parsed autorun.json object
     * @param {string} folderPath - Current folder path
     * @param {Object} ctx - Explorer instance context with files list
     */
    async launch(config, folderPath, ctx) {
      if (this.activeSession) {
        this.stop();
      }

      if (!config) return;

      const files = (ctx && ctx.state && ctx.state.files) || [];
      const findFile = (filename) => {
        if (!filename) return null;
        return files.find(f => f.name === filename || f.path === filename || f.path.endsWith('/' + filename));
      };

      // 1. Resolve primary media file (video or audio)
      const primaryCfg = config.primary || {};
      const primaryFile = findFile(primaryCfg.file) || files.find(f => f.category === 'video' || f.category === 'audio');
      if (!primaryFile) {
        if (window.sys && window.sys.toast) {
          window.sys.toast.warning("Fichier média principal (vidéo ou audio) introuvable pour l'autorun.");
        }
        return;
      }

      // 2. Prepare timeline steps
      const rawTimeline = Array.isArray(config.timeline) ? config.timeline : [];
      const timeline = rawTimeline.map((item, idx) => ({
        ...item,
        index: idx,
        timeSec: this.parseTime(item.time),
        title: item.title || `Étape ${idx + 1}`
      })).sort((a, b) => a.timeSec - b.timeSec);

      // 3. Compute layout geometry (Split-Screen Tiling)
      const topBarH = 52;
      const taskbarH = 44;
      const margin = 10;
      const availableW = window.innerWidth;
      const availableH = window.innerHeight - topBarH - taskbarH;

      const layout = config.layout || 'split-horizontal';
      let mediaBounds, companionBounds;

      if (layout === 'split-horizontal') {
        const leftW = Math.max(480, Math.round(availableW * 0.54));
        const rightW = availableW - leftW - (margin * 3);
        mediaBounds = { x: margin, y: topBarH + margin, width: leftW, height: availableH - (margin * 2) };
        companionBounds = { x: leftW + (margin * 2), y: topBarH + margin, width: rightW, height: availableH - (margin * 2) };
      } else {
        mediaBounds = { x: margin + 20, y: topBarH + margin + 20, width: Math.round(availableW * 0.55), height: Math.round(availableH * 0.75) };
        companionBounds = { x: Math.round(availableW * 0.42), y: topBarH + margin + 60, width: Math.round(availableW * 0.54), height: Math.round(availableH * 0.78) };
      }

      // 4. Create session state
      const session = {
        config,
        folderPath,
        ctx,
        timeline,
        primaryFile,
        currentStepIndex: -1,
        mediaEl: null,
        primaryWin: null,
        companionWin: null,
        hudEl: null
      };
      this.activeSession = session;

      // 5. Open Primary Media Window
      await this.openPrimaryMediaWindow(session, mediaBounds);

      // 6. Open Companion Window (Doc / Slide / Image Viewer)
      await this.openCompanionWindow(session, companionBounds, findFile);

      // 7. Mount Interactive Synchronized HUD
      this.mountSyncHUD(session);

      // 8. Execute initial step (t = 0)
      this.syncStep(session, 0);
    }

    /**
     * Opens the primary media window (Video or Audio player)
     */
    async openPrimaryMediaWindow(session, bounds) {
      const { primaryFile, config } = session;
      const wm = window.WindowManager;
      if (!wm) return;

      const primaryCfg = config.primary || {};
      const winTitle = primaryCfg.title || `${primaryFile.name} (VLog Principal)`;
      const isVideo = (primaryFile.category === 'video' || primaryFile.name.match(/\.(mp4|webm|mov|mkv)$/i));
      const cleanPathId = encodeURIComponent(primaryFile.path).replace(/%/g, '_');
      const winId = `autorun-media-${cleanPathId}`;

      const win = wm.createWindow({
        id: winId,
        appId: isVideo ? 'video-player' : 'audio-player',
        appName: 'VLog Player',
        title: `🎬 ${winTitle}`,
        icon: isVideo ? '🎬' : '🎵',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        content: `
          <div class="autorun-primary-media-container" style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;position:relative;">
            <div class="autorun-media-wrapper" style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;">
              ${isVideo 
                ? `<video id="autorun-video-${cleanPathId}" src="${primaryFile.file_url}" controls autoplay playsinline style="width:100%;height:100%;object-fit:contain;"></video>`
                : `<div style="padding:2rem;text-align:center;color:#fff;">
                     <div style="font-size:3rem;margin-bottom:1rem;">🎵</div>
                     <h3 style="margin-bottom:1rem;">${primaryFile.name}</h3>
                     <audio id="autorun-video-${cleanPathId}" src="${primaryFile.file_url}" controls autoplay style="width:100%;max-width:440px;"></audio>
                   </div>`
              }
            </div>
          </div>
        `,
        onClose: () => {
          this.stop();
        }
      });

      session.primaryWin = win;

      // Find HTML media element
      const mediaEl = win.element.querySelector(`#autorun-video-${cleanPathId}`);
      session.mediaEl = mediaEl;

      if (mediaEl) {
        mediaEl.addEventListener('timeupdate', () => {
          this.onTimeUpdate(session, mediaEl.currentTime);
        });

        mediaEl.addEventListener('seeked', () => {
          this.onTimeUpdate(session, mediaEl.currentTime, true);
        });
      }
    }

    /**
     * Opens the companion window for synchronous notes, markdown, and images
     */
    async openCompanionWindow(session, bounds, findFile) {
      const wm = window.WindowManager;
      if (!wm) return;

      const compCfg = session.config.companion || {};
      const winTitle = compCfg.title || 'Support Écrit & Médias Synchronisés';
      const winId = `autorun-companion-${Date.now()}`;

      const win = wm.createWindow({
        id: winId,
        appId: 'doc-viewer',
        appName: 'Support Synchronisé',
        title: `📄 ${winTitle}`,
        icon: '📑',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        content: `
          <div class="autorun-companion-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:var(--window-bg, #0f172a);color:var(--text-main, #f8fafc);overflow:hidden;">
            <div class="autorun-companion-header" style="padding:0.6rem 1rem;background:rgba(255,255,255,0.03);border-bottom:1px solid var(--border-color, rgba(255,255,255,0.08));display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;">
              <span id="autorunStepTitle" style="font-weight:600;display:flex;align-items:center;gap:0.4rem;">
                <span>📍</span> <span class="step-text">Démarrage de la présentation...</span>
              </span>
              <span id="autorunStepTime" style="font-size:0.75rem;color:var(--text-muted, #94a3b8);">00:00</span>
            </div>
            <div id="autorunCompanionBody" class="autorun-companion-body" style="flex:1;overflow-y:auto;padding:1.5rem;position:relative;">
              <div class="autorun-placeholder" style="text-align:center;color:var(--text-muted);margin-top:3rem;">
                <span style="font-size:2.5rem;">📖</span>
                <p style="margin-top:1rem;">Les notes et documents synchronisés s'afficheront ici en temps réel pendant la lecture du VLog.</p>
              </div>
            </div>
          </div>
        `,
        onClose: () => {
          this.stop();
        }
      });

      session.companionWin = win;

      // If companion has a starting file, load it immediately
      if (compCfg.file) {
        const initialFile = findFile(compCfg.file);
        if (initialFile) {
          this.displayDocumentInCompanion(session, initialFile);
        }
      }
    }

    /**
     * Mounts a sleek synchronized HUD (Head-Up Display) with chapter timeline
     */
    mountSyncHUD(session) {
      let hud = document.getElementById('autorunSyncHud');
      if (hud) hud.remove();

      hud = document.createElement('div');
      hud.id = 'autorunSyncHud';
      hud.className = 'autorun-sync-hud';

      const chapters = session.timeline.map((item, idx) => `
        <button type="button" class="hud-chapter-pill ${idx === 0 ? 'active' : ''}" data-step-index="${idx}" data-time="${item.timeSec}">
          <span class="hud-pill-time">${this.formatTime(item.timeSec)}</span>
          <span class="hud-pill-title">${this.escapeHtml(item.title)}</span>
        </button>
      `).join('');

      hud.innerHTML = `
        <div class="hud-inner">
          <div class="hud-title-zone">
            <span class="hud-live-dot"></span>
            <span class="hud-main-title">🎬 ${this.escapeHtml(session.config.title || 'VLog Synchronisé')}</span>
          </div>
          <div class="hud-chapters-scroll">
            ${chapters}
          </div>
          <div class="hud-actions">
            <button type="button" id="autorunHudCloseBtn" class="hud-action-btn" title="Fermer la présentation synchronisée">✕</button>
          </div>
        </div>
      `;

      document.body.appendChild(hud);
      session.hudEl = hud;

      // Bind HUD clicks
      hud.querySelectorAll('.hud-chapter-pill').forEach(btn => {
        btn.onclick = () => {
          const t = parseFloat(btn.dataset.time) || 0;
          if (session.mediaEl) {
            session.mediaEl.currentTime = t;
            if (session.mediaEl.paused) session.mediaEl.play();
          }
        };
      });

      const closeBtn = hud.querySelector('#autorunHudCloseBtn');
      if (closeBtn) closeBtn.onclick = () => this.stop();
    }

    /**
     * Media timeupdate handler: triggers timeline actions as playback progresses
     */
    onTimeUpdate(session, currentTime, force = false) {
      if (!session || !session.timeline || session.timeline.length === 0) return;

      // Find active timeline step for currentTime
      let targetIndex = -1;
      for (let i = 0; i < session.timeline.length; i++) {
        if (currentTime >= session.timeline[i].timeSec) {
          targetIndex = i;
        } else {
          break;
        }
      }

      if (targetIndex !== session.currentStepIndex || force) {
        session.currentStepIndex = targetIndex;
        if (targetIndex >= 0) {
          this.executeStep(session, session.timeline[targetIndex]);
        }
      }
    }

    /**
     * Executes a timeline step action
     */
    async executeStep(session, step) {
      if (!session || !step) return;

      // Update HUD active pill
      if (session.hudEl) {
        session.hudEl.querySelectorAll('.hud-chapter-pill').forEach((pill, idx) => {
          pill.classList.toggle('active', idx === step.index);
        });
        const activePill = session.hudEl.querySelector(`.hud-chapter-pill[data-step-index="${step.index}"]`);
        if (activePill && typeof activePill.scrollIntoView === 'function') {
          activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }

      // Update Companion Window header
      if (session.companionWin && session.companionWin.element) {
        const titleEl = session.companionWin.element.querySelector('#autorunStepTitle .step-text');
        const timeEl = session.companionWin.element.querySelector('#autorunStepTime');
        if (titleEl) titleEl.textContent = step.title;
        if (timeEl) timeEl.textContent = this.formatTime(step.timeSec);
      }

      const files = (session.ctx && session.ctx.state && session.ctx.state.files) || [];
      const targetFile = files.find(f => f.name === step.file || f.path === step.file || f.path.endsWith('/' + step.file));

      const action = step.action || 'set_doc';

      switch (action) {
        case 'set_doc':
          if (targetFile) {
            await this.displayDocumentInCompanion(session, targetFile, step.highlight);
          } else if (step.content) {
            this.renderCustomContentInCompanion(session, step.content, step.title);
          }
          break;

        case 'show_image':
          if (targetFile) {
            this.displayImageInCompanion(session, targetFile, step.title);
          }
          break;

        case 'open_app':
          if (step.app && window.sys && window.sys.appManager) {
            window.sys.appManager.launchApp(step.app, step.params || {});
          }
          break;

        case 'notify':
          if (window.sys && window.sys.toast) {
            window.sys.toast.info(step.title || step.message);
          }
          break;
      }
    }

    /**
     * Loads and displays a text/markdown file inside the companion window
     */
    async displayDocumentInCompanion(session, file, highlightSelector) {
      if (!session.companionWin || !session.companionWin.element) return;
      const bodyEl = session.companionWin.element.querySelector('#autorunCompanionBody');
      if (!bodyEl) return;

      bodyEl.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);">Chargement du document <em>${this.escapeHtml(file.name)}</em>...</div>`;

      try {
        let content = '';
        if (window.sys && window.sys.api) {
          const res = await window.sys.api.get('read_text_file', { path: file.path });
          if (res && res.success) {
            content = res.content || '';
          }
        }
        if (!content && file.file_url) {
          const resp = await fetch(file.file_url);
          content = await resp.text();
        }

        const isMarkdown = file.name.match(/\.(md|markdown)$/i);
        let renderedHtml = '';
        if (isMarkdown) {
          renderedHtml = this.renderMarkdown(content);
        } else {
          renderedHtml = `<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.95rem;line-height:1.6;">${this.escapeHtml(content)}</pre>`;
        }

        bodyEl.innerHTML = `
          <div class="autorun-doc-rendered" style="animation:fadeIn 0.25s ease;">
            <div style="font-size:0.8rem;color:var(--accent-primary, #6366f1);margin-bottom:1rem;font-weight:600;">
              📄 ${this.escapeHtml(file.name)}
            </div>
            ${renderedHtml}
          </div>
        `;

        if (highlightSelector) {
          const target = bodyEl.querySelector(highlightSelector);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.transition = 'background 0.3s ease';
            target.style.background = 'rgba(99, 102, 241, 0.2)';
            setTimeout(() => { target.style.background = ''; }, 2000);
          }
        }
      } catch (e) {
        bodyEl.innerHTML = `<div style="color:#f87171;padding:1rem;">Erreur de chargement du document : ${this.escapeHtml(e.message)}</div>`;
      }
    }

    /**
     * Displays an image in the companion window with smooth transition
     */
    displayImageInCompanion(session, file, title) {
      if (!session.companionWin || !session.companionWin.element) return;
      const bodyEl = session.companionWin.element.querySelector('#autorunCompanionBody');
      if (!bodyEl) return;

      bodyEl.innerHTML = `
        <div class="autorun-image-showcase" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
          <div style="flex:1;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:1rem;">
            <img src="${file.file_url}" alt="${this.escapeHtml(title || file.name)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,0.5);" />
          </div>
          <div style="padding:0.75rem;text-align:center;font-weight:500;font-size:0.9rem;color:var(--text-main);">
            🖼️ ${this.escapeHtml(title || file.comment || file.name)}
          </div>
        </div>
      `;
    }

    renderCustomContentInCompanion(session, html, title) {
      if (!session.companionWin || !session.companionWin.element) return;
      const bodyEl = session.companionWin.element.querySelector('#autorunCompanionBody');
      if (!bodyEl) return;

      bodyEl.innerHTML = `
        <div style="animation:fadeIn 0.25s ease;">
          ${title ? `<h3 style="margin-bottom:1rem;color:var(--accent-primary,#6366f1);">${this.escapeHtml(title)}</h3>` : ''}
          ${html}
        </div>
      `;
    }

    /**
     * Markdown renderer helper
     */
    renderMarkdown(md) {
      if (!md) return '';
      let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Headers
      html = html.replace(/^### (.*$)/gim, '<h3 style="margin:1.2rem 0 0.5rem;font-size:1.15rem;color:var(--text-main);">$1</h3>');
      html = html.replace(/^## (.*$)/gim, '<h2 style="margin:1.5rem 0 0.6rem;font-size:1.35rem;color:var(--text-main);border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:0.3rem;">$1</h2>');
      html = html.replace(/^# (.*$)/gim, '<h1 style="margin:1.8rem 0 0.8rem;font-size:1.6rem;color:var(--text-main);">$1</h1>');

      // Bold & Italic
      html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
      html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

      // Lists
      html = html.replace(/^\s*\-\s+(.*$)/gim, '<li style="margin-left:1.5rem;list-style-type:disc;">$1</li>');

      // Paragraphs
      html = html.split('\n\n').map(p => {
        if (p.startsWith('<h') || p.startsWith('<li')) return p;
        return `<p style="margin-bottom:1rem;line-height:1.65;font-size:0.95rem;">${p.replace(/\n/g, '<br/>')}</p>`;
      }).join('');

      return html;
    }

    syncStep(session, index) {
      if (!session || !session.timeline || index < 0 || index >= session.timeline.length) return;
      session.currentStepIndex = index;
      this.executeStep(session, session.timeline[index]);
    }

    /**
     * Closes presentation and cleans up all windows and HUD
     */
    stop() {
      if (!this.activeSession) return;
      const session = this.activeSession;
      this.activeSession = null;

      if (session.mediaEl) {
        session.mediaEl.pause();
      }

      if (session.hudEl) {
        session.hudEl.remove();
      }

      const wm = window.WindowManager;
      if (wm) {
        if (session.primaryWin && wm.windows.has(session.primaryWin.id)) {
          wm.closeWindow(session.primaryWin.id);
        }
        if (session.companionWin && wm.windows.has(session.companionWin.id)) {
          wm.closeWindow(session.companionWin.id);
        }
      }
    }

    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  window.sys = window.sys || {};
  window.sys.autorun = new AutorunSyncEngine();
  window.AutorunSyncEngine = AutorunSyncEngine;
})(window, document);
