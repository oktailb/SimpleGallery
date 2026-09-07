/**
 * SimpleGallery WebOS - Multimodal Synchronized Presentation Engine (AutorunSyncEngine.js)
 * Coordinates synchronized playback of video/audio/timer with live WebOS applications:
 * Maps (GPS flyTo), Document Viewer (Markdown/PDF), Image Viewer, and any registered app.
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
     * Resolves window placement geometry based on preset name or coordinates
     * @param {string|Object} posKey - Preset (left-half, right-half, top-left, top-right, bottom-left, bottom-right, center, fullscreen) or {x, y, width, height}
     * @param {string} fallback - Fallback preset
     * @returns {Object} { x, y, width, height }
     */
    computePositionBounds(posKey, fallback = 'right-half') {
      const topBarH = 52;
      const taskbarH = 44;
      const margin = 10;
      const availableW = window.innerWidth || 1280;
      const availableH = (window.innerHeight || 800) - topBarH - taskbarH;
      const halfW = Math.max(360, Math.floor((availableW - (margin * 3)) / 2));
      const halfH = Math.max(240, Math.floor((availableH - (margin * 3)) / 2));

      if (posKey && typeof posKey === 'object') {
        return {
          x: typeof posKey.x === 'number' ? posKey.x : margin,
          y: typeof posKey.y === 'number' ? posKey.y : (topBarH + margin),
          width: typeof posKey.width === 'number' ? posKey.width : halfW,
          height: typeof posKey.height === 'number' ? posKey.height : (availableH - (margin * 2))
        };
      }

      const key = (typeof posKey === 'string' && posKey && posKey !== 'auto') ? posKey : fallback;

      switch (key) {
        case 'left':
        case 'left-half':
        case 'split-horizontal':
          return { x: margin, y: topBarH + margin, width: halfW, height: availableH - (margin * 2) };
        case 'right':
        case 'right-half':
          return { x: halfW + (margin * 2), y: topBarH + margin, width: halfW, height: availableH - (margin * 2) };
        case 'top-left':
          return { x: margin, y: topBarH + margin, width: halfW, height: halfH };
        case 'top-right':
          return { x: halfW + (margin * 2), y: topBarH + margin, width: halfW, height: halfH };
        case 'bottom-left':
          return { x: margin, y: topBarH + halfH + (margin * 2), width: halfW, height: halfH };
        case 'bottom-right':
          return { x: halfW + (margin * 2), y: topBarH + halfH + (margin * 2), width: halfW, height: halfH };
        case 'center':
          return {
            x: Math.round(availableW * 0.15),
            y: topBarH + margin + Math.round(availableH * 0.08),
            width: Math.round(availableW * 0.70),
            height: Math.round(availableH * 0.80)
          };
        case 'fullscreen':
          return { x: margin, y: topBarH + margin, width: availableW - (margin * 2), height: availableH - (margin * 2) };
        default:
          return { x: halfW + (margin * 2), y: topBarH + margin, width: halfW, height: availableH - (margin * 2) };
      }
    }

    /**
     * Launches a synchronized multimodal presentation from autorun.json configuration
     * @param {Object} rawConfig - The parsed autorun.json object
     * @param {string} folderPath - Current folder path
     * @param {Object} ctx - Explorer instance context with files list
     */
    async launch(rawConfig, folderPath, ctx) {
      if (this.activeSession) {
        this.stop();
      }

      if (!rawConfig) return;

      // Deep clone configuration so playback mutations cannot corrupt the source state in memory
      const config = JSON.parse(JSON.stringify(rawConfig));

      const files = (ctx && ctx.state && ctx.state.files) || [];
      const findFile = (filename) => {
        if (!filename || typeof filename !== 'string' || filename === '[object Object]') return null;
        return files.find(f => f.name === filename || f.path === filename || f.path.endsWith('/' + filename));
      };

      // 1. Resolve master configuration (compatible with master, primary, or lead_media)
      const masterCfg = config.master || config.primary || config.lead_media || {};
      let masterType = masterCfg.type || (masterCfg.app === 'viewer-audio' ? 'audio' : 'video');
      let primaryFile = findFile(masterCfg.file);

      // Auto-detect if file not explicitly specified
      if (!primaryFile && masterType !== 'timer') {
        primaryFile = files.find(f => f.category === 'video') || files.find(f => f.category === 'audio');
        if (!primaryFile) {
          // If no video or audio is available, default to virtual timer presentation
          masterType = 'timer';
        } else {
          masterType = primaryFile.category === 'video' ? 'video' : 'audio';
        }
      }

      // 2. Prepare timeline steps (compatible with timeline or steps)
      const rawTimeline = Array.isArray(config.timeline) ? config.timeline : (Array.isArray(config.steps) ? config.steps : []);
      const timeline = rawTimeline.map((item, idx) => ({
        ...item,
        index: idx,
        timeSec: this.parseTime(item.time),
        title: item.title || item.chapter || `Étape ${idx + 1}`
      })).sort((a, b) => a.timeSec - b.timeSec);

      // Duration resolution for timer mode
      const maxStepTime = timeline.length > 0 ? timeline[timeline.length - 1].timeSec : 0;
      const totalDuration = this.parseTime(masterCfg.duration) || (maxStepTime > 0 ? maxStepTime + 20 : 120);

      // 3. Compute master window bounds
      const masterPos = masterCfg.position || config.layout || 'left-half';
      const mediaBounds = this.computePositionBounds(masterPos, 'left-half');

      // 4. Create session state with tracked window registry
      const session = {
        config,
        folderPath,
        ctx,
        timeline,
        masterType,
        primaryFile,
        totalDuration,
        currentStepIndex: -1,
        currentTime: 0,
        isPlaying: true,
        mediaEl: null,
        timerInterval: null,
        primaryWin: null,
        companionWin: null,
        trackedWindows: new Map(), // appId -> { winId, app, instance }
        hudEl: null,
        findFile
      };
      this.activeSession = session;

      // 5. Open Master Window (Video, Audio, or Timer)
      await this.openMasterWindow(session, mediaBounds);

      // 6. Mount Interactive Synchronized HUD (Bottom Bubble)
      this.mountSyncHUD(session);

      // 7. Start playback timer if virtual timer mode
      if (masterType === 'timer') {
        this.startVirtualTimer(session);
      }

      // 8. Execute initial step (t = 0)
      this.syncStep(session, 0);
    }

    /**
     * Opens the master track window (Video, Audio, or Timer Controller)
     */
    async openMasterWindow(session, bounds) {
      const { primaryFile, config, masterType } = session;
      const wm = window.WindowManager;
      if (!wm) return;

      const masterCfg = config.master || config.primary || config.lead_media || {};
      const winTitle = masterCfg.title || (primaryFile ? primaryFile.name : (config.title || 'VLog Multimodal'));
      const cleanPathId = primaryFile ? encodeURIComponent(primaryFile.path).replace(/%/g, '_') : 'timer';
      const winId = `autorun-master-${cleanPathId}`;

      let contentHtml = '';
      let isVideo = false;

      if (masterType === 'video' && primaryFile) {
        isVideo = true;
        contentHtml = `
          <div class="autorun-primary-media-container" style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;position:relative;">
            <div class="autorun-media-wrapper" style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;">
              <video id="autorun-media-${cleanPathId}" src="${primaryFile.file_url}" controls autoplay playsinline style="width:100%;height:100%;object-fit:contain;"></video>
            </div>
          </div>
        `;
      } else if (masterType === 'audio' && primaryFile) {
        contentHtml = `
          <div class="autorun-primary-media-container" style="width:100%;height:100%;background:linear-gradient(135deg, #090d16 0%, #1e1b4b 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;color:#fff;">
            <div style="font-size:3.5rem;margin-bottom:1rem;filter:drop-shadow(0 8px 16px rgba(99,102,241,0.4));">🎵</div>
            <h3 style="margin-bottom:0.5rem;font-size:1.25rem;text-align:center;">${this.escapeHtml(primaryFile.name)}</h3>
            <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:1.5rem;text-align:center;">${this.escapeHtml(config.description || 'Piste audio synchronisée')}</p>
            <audio id="autorun-media-${cleanPathId}" src="${primaryFile.file_url}" controls autoplay style="width:100%;max-width:440px;"></audio>
          </div>
        `;
      } else {
        // Virtual Timer Master Display
        contentHtml = `
          <div class="autorun-primary-media-container" style="width:100%;height:100%;background:radial-gradient(ellipse at center, #1e1b4b 0%, #090a0f 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;color:var(--text-main, #fff);text-align:center;">
            <div style="font-size:3.5rem;margin-bottom:1rem;">⏱️</div>
            <h2 style="font-size:1.4rem;font-weight:700;margin-bottom:0.5rem;">${this.escapeHtml(config.title || 'Présentation Multimodale')}</h2>
            <p style="color:var(--text-muted, #94a3b8);max-width:480px;font-size:0.95rem;line-height:1.5;margin-bottom:1.5rem;">${this.escapeHtml(config.description || 'Déroulement automatique de la chronologie interactive')}</p>
            <div style="display:flex;align-items:center;gap:1.5rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:1rem 2rem;border-radius:16px;">
              <button type="button" id="autorunTimerToggleBtn" style="background:var(--accent-primary, #6366f1);border:none;color:#fff;border-radius:50%;width:44px;height:44px;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">⏸️</button>
              <div style="text-align:left;">
                <div id="autorunTimerClock" style="font-size:1.6rem;font-weight:800;font-family:ui-monospace, monospace;letter-spacing:0.05em;">00:00</div>
                <div style="font-size:0.75rem;color:var(--text-muted, #94a3b8);">Durée : ${this.formatTime(session.totalDuration)}</div>
              </div>
            </div>
          </div>
        `;
      }

      const win = wm.createWindow({
        id: winId,
        appId: isVideo ? 'video-player' : (masterType === 'audio' ? 'audio-player' : 'explorer'),
        appName: isVideo ? 'VLog Player' : (masterType === 'audio' ? 'Audio Player' : 'Timer Master'),
        title: `${isVideo ? '🎬' : (masterType === 'audio' ? '🎵' : '⏱️')} ${winTitle}`,
        icon: isVideo ? '🎬' : (masterType === 'audio' ? '🎵' : '⏱️'),
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        content: contentHtml,
        onClose: () => {
          this.stop();
        }
      });

      session.primaryWin = win;

      // Bind media event listeners
      if (masterType !== 'timer') {
        const mediaEl = win.element.querySelector(`#autorun-media-${cleanPathId}`);
        session.mediaEl = mediaEl;

        if (mediaEl) {
          mediaEl.addEventListener('timeupdate', () => {
            session.currentTime = mediaEl.currentTime;
            this.onTimeUpdate(session, mediaEl.currentTime);
          });

          mediaEl.addEventListener('seeked', () => {
            session.currentTime = mediaEl.currentTime;
            this.onTimeUpdate(session, mediaEl.currentTime, true);
          });

          mediaEl.addEventListener('play', () => {
            session.isPlaying = true;
            this.updateHudPlayState(session);
          });

          mediaEl.addEventListener('pause', () => {
            session.isPlaying = false;
            this.updateHudPlayState(session);
          });
        }
      } else {
        // Virtual Timer master controls
        const toggleBtn = win.element.querySelector('#autorunTimerToggleBtn');
        if (toggleBtn) {
          toggleBtn.onclick = () => {
            session.isPlaying = !session.isPlaying;
            toggleBtn.textContent = session.isPlaying ? '⏸️' : '▶️';
            this.updateHudPlayState(session);
          };
        }
      }
    }

    /**
     * Starts interval loop for virtual timer master
     */
    startVirtualTimer(session) {
      if (session.timerInterval) clearInterval(session.timerInterval);
      const stepMs = 250;
      session.timerInterval = setInterval(() => {
        if (!session.isPlaying) return;
        session.currentTime += (stepMs / 1000);
        if (session.currentTime > session.totalDuration) {
          session.currentTime = session.totalDuration;
          session.isPlaying = false;
          clearInterval(session.timerInterval);
        }

        // Update timer clock display in master window
        if (session.primaryWin && session.primaryWin.element) {
          const clock = session.primaryWin.element.querySelector('#autorunTimerClock');
          if (clock) clock.textContent = this.formatTime(session.currentTime);
        }

        this.onTimeUpdate(session, session.currentTime);
      }, stepMs);
    }

    /**
     * Opens the companion window for notes, markdown, and synced documents
     */
    async openCompanionWindow(session, bounds, findFile) {
      const wm = window.WindowManager;
      if (!wm) return;

      const compCfg = session.config.companion || session.config.companion_app || {};
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
          // If companion window is closed by user, don't stop the whole presentation, just null it
          session.companionWin = null;
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
     * Mounts a synchronized HUD with chapter timeline and playback controls
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
            <span class="hud-main-title">🎬 ${this.escapeHtml(session.config.title || 'Blog Multimodal')}</span>
          </div>
          <div class="hud-controls-zone">
            <button type="button" id="autorunHudPlayPauseBtn" class="hud-ctrl-btn" title="Lecture / Pause">⏸️</button>
            <span id="autorunHudTimeDisplay" class="hud-time-display">00:00</span>
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

      // Bind Play/Pause
      const playPauseBtn = hud.querySelector('#autorunHudPlayPauseBtn');
      if (playPauseBtn) {
        playPauseBtn.onclick = () => {
          this.togglePlayPause(session);
        };
      }

      // Bind HUD chapter pill clicks
      hud.querySelectorAll('.hud-chapter-pill').forEach(btn => {
        btn.onclick = () => {
          const t = parseFloat(btn.dataset.time) || 0;
          this.seekTo(session, t);
        };
      });

      const closeBtn = hud.querySelector('#autorunHudCloseBtn');
      if (closeBtn) closeBtn.onclick = () => this.stop();
    }

    /**
     * Toggles playback between play and pause
     */
    togglePlayPause(session) {
      if (!session) return;
      if (session.mediaEl) {
        if (session.mediaEl.paused) {
          session.mediaEl.play();
        } else {
          session.mediaEl.pause();
        }
      } else {
        session.isPlaying = !session.isPlaying;
        this.updateHudPlayState(session);
      }
    }

    updateHudPlayState(session) {
      if (!session || !session.hudEl) return;
      const btn = session.hudEl.querySelector('#autorunHudPlayPauseBtn');
      if (btn) {
        btn.textContent = session.isPlaying ? '⏸️' : '▶️';
      }
    }

    /**
     * Seeks playback to a specific timestamp with state reconciliation
     */
    seekTo(session, timeSec) {
      session.currentTime = timeSec;
      if (session.mediaEl) {
        session.mediaEl.currentTime = timeSec;
        if (session.mediaEl.paused) session.mediaEl.play();
      } else {
        if (session.primaryWin && session.primaryWin.element) {
          const clock = session.primaryWin.element.querySelector('#autorunTimerClock');
          if (clock) clock.textContent = this.formatTime(timeSec);
        }
        this.onTimeUpdate(session, timeSec, true);
      }
    }

    /**
     * Time update dispatcher: checks timeline transitions and reconciles states
     */
    onTimeUpdate(session, currentTime, force = false) {
      if (!session || !session.timeline || session.timeline.length === 0) return;

      // Update HUD time display
      if (session.hudEl) {
        const timeDisplay = session.hudEl.querySelector('#autorunHudTimeDisplay');
        if (timeDisplay) timeDisplay.textContent = this.formatTime(currentTime);
      }

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
        if (force) {
          this.reconcileStateAtTime(session, currentTime, targetIndex);
        } else if (targetIndex >= 0) {
          this.executeStep(session, session.timeline[targetIndex]);
        }
      }
    }

    /**
     * Reconciles all open/closed applications when the user seeks forward or backward in time
     */
    async reconcileStateAtTime(session, currentTime, targetIndex) {
      if (!session) return;

      // 1. Determine which apps should be open and what their latest params are up to targetIndex
      const desiredApps = new Map(); // appId -> { step, command, params }
      for (let i = 0; i <= targetIndex; i++) {
        const step = session.timeline[i];
        const action = step.action || 'set_doc';
        const appId = step.app || (action === 'set_doc' ? 'doc-viewer' : (action === 'show_image' ? 'image-viewer' : null));

        if (action === 'open_app' || action === 'set_doc' || action === 'show_image') {
          if (appId) {
            desiredApps.set(appId, { step, action });
          }
        } else if (action === 'close_app') {
          if (appId) {
            desiredApps.delete(appId);
          }
        } else if (action === 'control_app') {
          if (appId && desiredApps.has(appId)) {
            desiredApps.get(appId).lastControl = step;
          }
        }
      }

      // 2. Close any currently open tracked app that should NOT be open
      for (const [appId, winInfo] of session.trackedWindows.entries()) {
        if (!desiredApps.has(appId)) {
          this.closeTrackedApp(session, appId);
        }
      }

      // 3. Open or re-synchronize desired apps
      for (const [appId, info] of desiredApps.entries()) {
        if (!session.trackedWindows.has(appId)) {
          await this.executeStep(session, info.step);
        }
        if (info.lastControl) {
          await this.executeStep(session, info.lastControl);
        }
      }

      // 4. Update HUD
      if (targetIndex >= 0) {
        this.updateHudPill(session, targetIndex);
      }
    }

    updateHudPill(session, stepIndex) {
      if (!session || !session.hudEl) return;
      session.hudEl.querySelectorAll('.hud-chapter-pill').forEach((pill, idx) => {
        pill.classList.toggle('active', idx === stepIndex);
      });
      const activePill = session.hudEl.querySelector(`.hud-chapter-pill[data-step-index="${stepIndex}"]`);
      if (activePill && typeof activePill.scrollIntoView === 'function') {
        activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }

    /**
     * Executes a timeline step action
     */
    async executeStep(session, step) {
      if (!session || !step) return;

      this.updateHudPill(session, step.index);

      const files = (session.ctx && session.ctx.state && session.ctx.state.files) || [];

      // Safely extract string filename/path - NEVER mutate step or permit "[object Object]"
      const rawFile = step.file || (step.params && step.params.file);
      let fileStr = '';
      if (typeof rawFile === 'object' && rawFile !== null) {
        fileStr = rawFile.path || rawFile.name || '';
      } else if (typeof rawFile === 'string' && rawFile && rawFile !== '[object Object]') {
        fileStr = rawFile;
      }
      const targetFile = fileStr ? files.find(f => f.name === fileStr || f.path === fileStr || f.path.endsWith('/' + fileStr)) : null;
      const targetFilePath = (targetFile ? (targetFile.path || targetFile.name) : fileStr) || '';

      const action = step.action || 'set_doc';

      switch (action) {
        case 'set_doc':
          await this.openAppAction(session, 'doc-viewer', { file: targetFilePath, highlight: step.highlight }, step);
          break;

        case 'show_image':
          await this.openAppAction(session, 'image-viewer', { file: targetFilePath }, step);
          break;

        case 'open_app': {
          const p = { ...(step.params || {}) };
          if (targetFilePath && !p.file) p.file = targetFilePath;
          await this.openAppAction(session, step.app, p, step);
          break;
        }

        case 'close_app':
          this.closeTrackedApp(session, step.app || step.targetWinId);
          break;

        case 'control_app':
          this.controlAppAction(session, step.app, step.command, step.params || step);
          break;

        case 'notify':
          if (window.sys && window.sys.toast) {
            window.sys.toast.info(step.title || step.message);
          }
          break;
      }
    }

    /**
     * Opens an application and records it in the tracked session
     */
    async openAppAction(session, appId, params = {}, step = {}) {
      if (!appId) return;

      const wm = window.WindowManager;
      const appMgr = window.sys && window.sys.appManager;
      const files = (session.ctx && session.ctx.state && session.ctx.state.files) || [];

      // Safe clone of parameters - DO NOT mutate step.params or caller's object
      const appParams = { ...(params || {}) };

      // Resolve file object if file param is provided
      let resolvedFileObj = null;
      let resolvedFilePath = '';
      if (typeof appParams.file === 'object' && appParams.file !== null) {
        resolvedFileObj = appParams.file;
        resolvedFilePath = appParams.file.path || appParams.file.name || '';
      } else if (typeof appParams.file === 'string' && appParams.file && appParams.file !== '[object Object]') {
        resolvedFilePath = appParams.file;
        resolvedFileObj = files.find(f => f.name === resolvedFilePath || f.path === resolvedFilePath || f.path.endsWith('/' + resolvedFilePath)) || null;
      }

      // Compute window placement bounds
      const posSetting = step.position || appParams.position || (step.x != null ? { x: step.x, y: step.y, width: step.width, height: step.height } : null);
      const bounds = this.computePositionBounds(posSetting, 'right-half');

      let createdWin = null;

      // 1. Maps Application special handling
      if (appId === 'maps') {
        const lat = (appParams.lat !== undefined && appParams.lat !== null && appParams.lat !== '')
          ? appParams.lat
          : (step.lat !== undefined && step.lat !== null && step.lat !== '' ? step.lat : undefined);
        const rawLng = (appParams.lng !== undefined && appParams.lng !== null && appParams.lng !== '')
          ? appParams.lng
          : (appParams.lon !== undefined && appParams.lon !== null && appParams.lon !== ''
            ? appParams.lon
            : (step.lng !== undefined && step.lng !== null && step.lng !== ''
              ? step.lng
              : (step.lon !== undefined && step.lon !== null && step.lon !== '' ? step.lon : undefined)));
        const zoom = (appParams.zoom !== undefined && appParams.zoom !== null && appParams.zoom !== '')
          ? appParams.zoom
          : (step.zoom !== undefined && step.zoom !== null && step.zoom !== '' ? step.zoom : undefined);

        const mapOptions = {
          ...appParams,
          ...bounds,
          files,
          currentPath: session.folderPath,
          newWindow: true
        };
        if (lat !== undefined && !isNaN(Number(lat))) mapOptions.lat = Number(lat);
        if (rawLng !== undefined && !isNaN(Number(rawLng))) {
          mapOptions.lng = Number(rawLng);
          mapOptions.lon = Number(rawLng);
        }
        if (zoom !== undefined && !isNaN(Number(zoom))) mapOptions.zoom = Number(zoom);

        if (window.mapsApp && typeof window.mapsApp.open === 'function') {
          const instance = window.mapsApp.open(mapOptions);
          if (instance && instance.winId) {
            session.trackedWindows.set('maps', { winId: instance.winId, app: 'maps', instance });
            createdWin = wm ? wm.windows.get(instance.winId) : null;
            if (mapOptions.lat !== undefined && mapOptions.lng !== undefined && typeof instance.moveTo === 'function') {
              instance.moveTo({ lat: mapOptions.lat, lng: mapOptions.lng, zoom: mapOptions.zoom, animate: false });
            }
          }
        } else if (appMgr) {
          appMgr.launchApp('maps', mapOptions);
        }
      }
      // 2. Document Viewer application
      else if (appId === 'doc-viewer') {
        if (window.DocViewerApp && typeof window.DocViewerApp.open === 'function') {
          const effectiveFile = resolvedFileObj || { name: (resolvedFilePath.split('/').pop() || 'document.txt'), path: resolvedFilePath, file_url: resolvedFilePath };
          window.DocViewerApp.open(effectiveFile, { ...appParams, ...bounds }, session.ctx);
          const cleanId = encodeURIComponent(effectiveFile.path || effectiveFile.name).replace(/%/g, '_');
          const winId = `doc-${cleanId}`;
          session.trackedWindows.set('doc-viewer', { winId, app: 'doc-viewer' });
          createdWin = wm ? wm.windows.get(winId) : null;
        } else if (appMgr) {
          appMgr.launchApp('doc-viewer', { ...appParams, ...bounds });
        }
      }
      // 3. Image Viewer application
      else if (appId === 'image-viewer') {
        if (window.ImageViewerPlugin && typeof window.ImageViewerPlugin.open === 'function') {
          const effectiveFile = resolvedFileObj || { name: (resolvedFilePath.split('/').pop() || 'image.jpg'), path: resolvedFilePath, file_url: resolvedFilePath };
          window.ImageViewerPlugin.open(effectiveFile, { ...appParams, ...bounds }, session.ctx);
          const cleanId = encodeURIComponent(effectiveFile.path || effectiveFile.name).replace(/%/g, '_');
          const winId = `image-${cleanId}`;
          session.trackedWindows.set('image-viewer', { winId, app: 'image-viewer' });
          createdWin = wm ? wm.windows.get(winId) : null;
        } else if (appMgr) {
          appMgr.launchApp('image-viewer', { ...appParams, ...bounds });
        }
      }
      // 4. Generic AppManager launch
      else if (appMgr) {
        appMgr.launchApp(appId, { ...appParams, ...bounds });
        if (wm && wm.activeWindowId) {
          session.trackedWindows.set(appId, { winId: wm.activeWindowId, app: appId });
          createdWin = wm.windows.get(wm.activeWindowId);
        }
      }

      // Apply geometry position if window created and bounds provided
      if (createdWin && bounds) {
        if (typeof bounds.x === 'number') createdWin.x = bounds.x;
        if (typeof bounds.y === 'number') createdWin.y = bounds.y;
        if (typeof bounds.width === 'number') createdWin.width = bounds.width;
        if (typeof bounds.height === 'number') createdWin.height = bounds.height;
        if (createdWin.element) {
          createdWin.element.style.left = `${createdWin.x}px`;
          createdWin.element.style.top = `${createdWin.y}px`;
          createdWin.element.style.width = `${createdWin.width}px`;
          createdWin.element.style.height = `${createdWin.height}px`;
        }
      }
    }

    /**
     * Closes an application or tracked window
     */
    closeTrackedApp(session, appIdOrWinId) {
      if (!session || !appIdOrWinId) return;

      const wm = window.WindowManager;
      if (!wm) return;

      // Check if mapped by appId
      const entry = session.trackedWindows.get(appIdOrWinId);
      if (entry && entry.winId) {
        wm.closeWindow(entry.winId);
        session.trackedWindows.delete(appIdOrWinId);
        return;
      }

      // Check direct window id
      if (wm.windows.has(appIdOrWinId)) {
        wm.closeWindow(appIdOrWinId);
        for (const [key, val] of session.trackedWindows.entries()) {
          if (val.winId === appIdOrWinId) session.trackedWindows.delete(key);
        }
        return;
      }

      // Check by appId match in all open windows
      wm.windows.forEach((w) => {
        if (w.appId === appIdOrWinId) {
          wm.closeWindow(w.id);
          session.trackedWindows.delete(appIdOrWinId);
        }
      });
    }

    /**
     * Controls an already open application (flyTo, scroll, zoom, change image, etc.)
     * Uses centralized AppManager command dispatching with fallback
     */
    controlAppAction(session, appId, command, params = {}) {
      if (!session || !appId) return;

      const tracked = session.trackedWindows ? session.trackedWindows.get(appId) : null;
      const winId = tracked ? tracked.winId : null;

      // 1. Delegate to centralized AppManager command dispatcher if available
      let handled = false;
      if (window.sys && window.sys.appManager && typeof window.sys.appManager.dispatchCommand === 'function') {
        handled = window.sys.appManager.dispatchCommand(appId, command, params, winId);
      }

      // 2. Fallback to direct handling if not handled
      if (!handled) {
        if (appId === 'maps') {
          const instance = (tracked && tracked.instance) || (window.mapsApp && window.mapsApp.activeInstance);
          const lat = parseFloat(params.lat);
          const lng = parseFloat(params.lng !== undefined ? params.lng : params.lon);
          const zoom = parseInt(params.zoom, 10) || 14;

          if (instance && instance.leafletMap && !isNaN(lat) && !isNaN(lng)) {
            if ((command === 'flyTo' || command === 'moveTo') && typeof instance.leafletMap.flyTo === 'function') {
              instance.leafletMap.flyTo([lat, lng], zoom, { duration: 1.5 });
            } else {
              instance.leafletMap.setView([lat, lng], zoom);
            }
          }
        } else if (appId === 'doc-viewer') {
          const highlightSelector = params.highlight || params.selector;
          if (highlightSelector) {
            const win = tracked && window.WindowManager ? window.WindowManager.windows.get(tracked.winId) : null;
            const container = win ? win.element : document.querySelector('.webos-doc-window');
            if (container) {
              try {
                const target = container.querySelector(highlightSelector);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  target.style.transition = 'background 0.3s ease';
                  target.style.background = 'rgba(99, 102, 241, 0.25)';
                  setTimeout(() => { target.style.background = ''; }, 2200);
                }
              } catch (e) {}
            }
          }
        } else if (appId === 'image-viewer') {
          const targetFile = params.file;
          if (targetFile && window.ImageViewerPlugin) {
            window.ImageViewerPlugin.open(targetFile, {}, session.ctx);
          }
        }
      }

      // 3. Global EventBus announcement
      if (window.EventBus) {
        window.EventBus.emit('autorun:command', { app: appId, command, params });
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
          try {
            const target = bodyEl.querySelector(highlightSelector);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.style.transition = 'background 0.3s ease';
              target.style.background = 'rgba(99, 102, 241, 0.2)';
              setTimeout(() => { target.style.background = ''; }, 2000);
            }
          } catch (selErr) {
            console.warn('[Autorun] Invalid highlight selector:', highlightSelector);
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

    sanitizeHtml(raw) {
      if (!raw) return '';
      return String(raw)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/\bon[a-zA-Z0-9_-]+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
    }

    renderCustomContentInCompanion(session, html, title) {
      if (!session.companionWin || !session.companionWin.element) return;
      const bodyEl = session.companionWin.element.querySelector('#autorunCompanionBody');
      if (!bodyEl) return;

      const safeHtml = this.sanitizeHtml(html);
      bodyEl.innerHTML = `
        <div style="animation:fadeIn 0.25s ease;">
          ${title ? `<h3 style="margin-bottom:1rem;color:var(--accent-primary,#6366f1);">${this.escapeHtml(title)}</h3>` : ''}
          ${safeHtml}
        </div>
      `;
    }

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
     * Closes presentation and cleans up all tracked windows, timers, and HUD
     */
    stop() {
      if (!this.activeSession) return;
      const session = this.activeSession;
      this.activeSession = null;

      if (session.timerInterval) {
        clearInterval(session.timerInterval);
        session.timerInterval = null;
      }

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
        // Close all dynamically tracked windows
        session.trackedWindows.forEach(info => {
          if (info.winId && wm.windows.has(info.winId)) {
            wm.closeWindow(info.winId);
          }
        });
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
