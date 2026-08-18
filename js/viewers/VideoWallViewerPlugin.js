/**
 * SimpleGallery 2026 - Video Wall Viewer Plugin
 * Synchronized multi-screen layout engine with layers (bg/fg), cockpit overlays & master timeline synchronization.
 */
(function(window) {
  'use strict';

  const VideoWallViewerPlugin = {
    id: 'video-wall',
    nameKey: 'viewer.videowall',
    categories: ['videowall'],
    extensions: ['vwall', 'videowall', 'vwall.ini', 'videowall.ini'],
    mimeTypes: ['application/x-videowall', 'text/x-videowall'],
    defaultTarget: 'lightbox',
    supportsFullscreen: true,
    supportsPip: false,
    cssPath: 'css/viewers/videowall.css',

    // Runtime state
    activeWall: null,
    syncIntervalId: null,

    /**
     * Opens and parses a Video Wall configuration file
     * @param {Object} file
     * @param {Object} options
     * @param {Object} ctx (Gallery instance)
     */
    async open(file, options, ctx) {
      if (!ctx || !ctx.el) return false;
      const index = (typeof options.index === 'number') ? options.index : ctx.state.filteredFiles.findIndex(f => f.path === file.path);
      if (index === -1) return false;

      this.cleanup();
      ctx.state.lightboxIndex = index;

      if (!ctx.state.isLightboxHistoryPushed) {
        history.pushState({ lightbox: true }, '');
        ctx.state.isLightboxHistoryPushed = true;
      }

      ctx.el.lightboxTitle.textContent = `🎬 Mur Vidéo: ${file.name}`;
      ctx.el.lightboxMeta.textContent = `${file.size_formatted} • Mur Vidéo Synchronisé`;

      if (ctx.el.lightboxDownloadBtn) ctx.el.lightboxDownloadBtn.style.display = 'none';
      if (ctx.el.lightboxDeleteBtn) ctx.el.lightboxDeleteBtn.style.display = ctx.state.isAdmin ? 'inline-flex' : 'none';
      if (ctx.el.imageExplorerControls) ctx.el.imageExplorerControls.style.display = 'none';
      if (ctx.el.lightboxEditImageBtn) ctx.el.lightboxEditImageBtn.style.display = 'none';
      if (ctx.el.lightboxExifBtn) ctx.el.lightboxExifBtn.style.display = 'none';

      ctx.el.lightboxContent.innerHTML = `
        <div class="videowall-modal-content">
          <div style="color:#cbd5e1;font-size:1.1rem;display:flex;align-items:center;gap:10px;">
            <div class="empty-state-icon" style="font-size:2rem;animation:spin 1s infinite linear;">⚙️</div>
            Chargement de la configuration du mur vidéo...
          </div>
        </div>
      `;

      ctx.el.lightbox.classList.add('open');

      try {
        const res = await fetch(file.file_url);
        const iniText = await res.text();
        const config = this.parseIniConfig(iniText);

        this.renderVideoWall(file, config, ctx);
      } catch (err) {
        console.error('Failed to load video wall configuration:', err);
        ctx.el.lightboxContent.innerHTML = `
          <div class="videowall-modal-content">
            <div style="color:#ef4444;font-size:1rem;">Erreur de chargement de la configuration: ${err.message}</div>
          </div>
        `;
      }

      return true;
    },

    /**
     * Robust INI parser supporting global parameters and named [sections]
     * @param {string} text
     * @returns {Object}
     */
    parseIniConfig(text) {
      const lines = text.split(/\r?\n/);
      const globals = {};
      const sections = {};
      let currentSection = null;

      for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(';') || line.startsWith('#')) continue;

        // Section header [SECTION_NAME]
        const secMatch = line.match(/^\[(.*?)\]$/);
        if (secMatch) {
          currentSection = secMatch[1].trim();
          sections[currentSection] = {};
          continue;
        }

        // Key = Value
        const eqIdx = line.indexOf('=');
        if (eqIdx !== -1) {
          const key = line.substring(0, eqIdx).trim();
          const val = line.substring(eqIdx + 1).trim();

          if (currentSection) {
            sections[currentSection][key] = val;
          } else {
            globals[key] = val;
          }
        }
      }

      return { globals, sections };
    },

    /**
     * Resolves the video source URL for a given section
     * @param {string} secName
     * @param {Object} secConfig
     * @param {string} baseDirUrl
     * @param {Object} ctx
     * @returns {string|null}
     */
    resolveVideoUrl(secName, secConfig, baseDirUrl, ctx) {
      // 1. Explicit file= or src= directive
      if (secConfig.file || secConfig.src) {
        const rel = secConfig.file || secConfig.src;
        if (rel.startsWith('http://') || rel.startsWith('https://')) return rel;
        return `${baseDirUrl}/${rel.replace(/^\.\//, '')}`;
      }

      // 2. Explicit liveUrl= (if web-compatible)
      if (secConfig.liveUrl && (secConfig.liveUrl.startsWith('http://') || secConfig.liveUrl.startsWith('https://') || secConfig.liveUrl.endsWith('.mp4'))) {
        return secConfig.liveUrl;
      }

      // 3. Search directory for matching filename (e.g. MFD1.mp4, MFD1.mov, etc.)
      const found = ctx.state.filteredFiles.find(f => {
        const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
        return nameWithoutExt.toLowerCase() === secName.toLowerCase() && f.category === 'video';
      });

      if (found) {
        return found.file_url;
      }

      // 4. Default relative guess: secName + '.mp4'
      return `${baseDirUrl}/${secName}.mp4`;
    },

    /**
     * Builds and mounts the synchronized Video Wall DOM and event engine
     * @param {Object} file
     * @param {Object} config
     * @param {Object} ctx
     */
    renderVideoWall(file, config, ctx) {
      const { globals, sections } = config;
      const baseW = parseFloat(globals.width) || 1920;
      const baseH = parseFloat(globals.height) || 1080;
      const resyncThreshold = parseFloat(globals.resyncThreshold) || 200; // ms
      const resyncInterval = parseFloat(globals.resyncInterval) || 3000;  // ms

      // Current directory URL prefix
      const currentDirUrl = file.file_url.substring(0, file.file_url.lastIndexOf('/'));

      // Determine display order
      let orderKeys = Object.keys(sections);
      if (globals.displayOrder) {
        const customOrder = globals.displayOrder.split(':').map(s => s.trim());
        orderKeys = customOrder.filter(k => sections[k]);
        // Add any remaining sections not listed in displayOrder
        for (let k of Object.keys(sections)) {
          if (!orderKeys.includes(k)) orderKeys.push(k);
        }
      }

      // Prepare Overlay Image URL if defined
      let overlayHtml = '';
      if (globals.overlay) {
        const overlayUrl = `${currentDirUrl}/${globals.overlay.replace(/^\.\//, '')}`;
        overlayHtml = `<img class="videowall-overlay-img" src="${overlayUrl}" alt="Cockpit Overlay" />`;
      }

      // Build Screen Elements HTML
      let screensHtml = '';
      const screensData = [];
      const defaultFit = globals.fit || 'fill';

      for (let secName of orderKeys) {
        const sec = sections[secName];
        const x = parseFloat(sec.x) || 0;
        const y = parseFloat(sec.y) || 0;
        const w = parseFloat(sec.width) || 400;
        const h = parseFloat(sec.height) || 300;
        const rotate = parseInt(sec.rotate, 10) || 0;
        const layer = (sec.layer === 'fg') ? 'layer-fg' : 'layer-bg';
        const secFit = sec.fit || defaultFit;

        const ox = parseFloat(sec.ox);
        const oy = parseFloat(sec.oy);
        const owidth = parseFloat(sec.owidth);
        const oheight = parseFloat(sec.oheight);
        const hasAperture = !isNaN(ox) && !isNaN(oy) && !isNaN(owidth) && !isNaN(oheight) && owidth > 0 && oheight > 0;

        let leftPct, topPct, widthPct, heightPct;
        let videoStyle = '';

        if (hasAperture) {
          leftPct = ((x + ox) / baseW) * 100;
          topPct = ((y + oy) / baseH) * 100;
          widthPct = (owidth / baseW) * 100;
          heightPct = (oheight / baseH) * 100;
          const vLeft = -(ox / owidth) * 100;
          const vTop = -(oy / oheight) * 100;
          const vW = (w / owidth) * 100;
          const vH = (h / oheight) * 100;
          videoStyle = `position: absolute; left: ${vLeft}%; top: ${vTop}%; width: ${vW}%; height: ${vH}%; object-fit: ${secFit};`;
        } else {
          leftPct = (x / baseW) * 100;
          topPct = (y / baseH) * 100;
          widthPct = (w / baseW) * 100;
          heightPct = (h / baseH) * 100;

          if (rotate % 180 !== 0) {
            // When rotated 90/270 deg, swap width & height proportions and center so it fits the container exactly
            const vWidthPct = (h / w) * 100;
            const vHeightPct = (w / h) * 100;
            videoStyle = `position: absolute; top: 50%; left: 50%; width: ${vWidthPct}%; height: ${vHeightPct}%; transform: translate(-50%, -50%) rotate(${rotate}deg); transform-origin: center center; object-fit: ${secFit};`;
          } else if (rotate !== 0) {
            videoStyle = `width: 100%; height: 100%; transform: rotate(${rotate}deg); transform-origin: center center; object-fit: ${secFit};`;
          } else {
            videoStyle = `width: 100%; height: 100%; object-fit: ${secFit};`;
          }
        }

        const videoUrl = this.resolveVideoUrl(secName, sec, currentDirUrl, ctx);

        screensData.push({
          id: secName,
          url: videoUrl,
          layer: sec.layer || 'bg'
        });

        screensHtml += `
          <div class="videowall-screen ${layer}" id="vwall_screen_${secName}" data-screen-id="${secName}"
               style="left:${leftPct}%; top:${topPct}%; width:${widthPct}%; height:${heightPct}%;">
            <span class="videowall-screen-label">${ctx.escapeHtml(secName)}</span>
            <video id="vwall_video_${secName}" src="${videoUrl}" playsinline preload="auto"
                   style="${videoStyle}" muted></video>
          </div>
        `;
      }

      // Mount Master Stage
      ctx.el.lightboxContent.innerHTML = `
        <div class="videowall-modal-content">
          <div class="videowall-stage" id="videowallStage" style="aspect-ratio: ${baseW} / ${baseH};">
            <div class="videowall-canvas" id="videowallCanvas">
              ${screensHtml}
              ${overlayHtml}
            </div>

            <!-- Master Synchronized Playback Control Bar -->
            <div class="videowall-controls-bar" id="videowallControlsBar">
              <button id="vwallMasterPlayBtn" class="videowall-btn" title="Lecture / Pause (Espace)">▶</button>
              
              <div class="videowall-progress-wrap">
                <input type="range" id="vwallMasterSeek" class="videowall-seek-slider" min="0" max="100" value="0" step="0.1" />
                <span class="videowall-time-display" id="vwallMasterTime">00:00 / 00:00</span>
              </div>

              <!-- Audio Channel Switcher -->
              <select id="vwallAudioSelect" class="videowall-audio-select" title="Piste audio active">
                ${screensData.map(s => `<option value="${s.id}">🔊 Audio: ${s.id}</option>`).join('')}
              </select>

              <!-- Aspect Ratio Fit Mode Switcher -->
              <select id="vwallFitSelect" class="videowall-audio-select" title="Mode de cadrage (Fit)">
                <option value="fill" selected>🖼️ Remplir (fill)</option>
                <option value="contain">🔍 Ajuster (contain)</option>
                <option value="cover">✂️ Découper (cover)</option>
              </select>

              <!-- Speed Selector -->
              <select id="vwallSpeedSelect" class="videowall-audio-select" title="Vitesse de lecture">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1.0x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>

              <span class="videowall-sync-badge" id="vwallSyncBadge">⚡ Synchronisé</span>
              <button id="vwallFullscreenBtn" class="videowall-btn" title="Plein écran (F)">⛶</button>
            </div>
          </div>
        </div>
      `;

      this.initSyncEngine(screensData, resyncThreshold, resyncInterval, ctx);
    },

    /**
     * Initializes Master-Slave Clock and drift correction engine
     * @param {Array} screensData
     * @param {number} thresholdMs
     * @param {number} intervalMs
     * @param {Object} ctx
     */
    initSyncEngine(screensData, thresholdMs, intervalMs, ctx) {
      const videos = screensData.map(s => document.getElementById(`vwall_video_${s.id}`)).filter(Boolean);
      if (videos.length === 0) return;

      const masterVideo = videos[0];
      let isSeeking = false;
      let activeAudioId = screensData[0]?.id;

      // Enable audio on first screen only
      videos.forEach(v => { v.muted = true; });
      if (masterVideo) masterVideo.muted = false;
      const firstScreenEl = document.getElementById(`vwall_screen_${activeAudioId}`);
      if (firstScreenEl) firstScreenEl.classList.add('active-audio');

      // Elements
      const playBtn = document.getElementById('vwallMasterPlayBtn');
      const seekSlider = document.getElementById('vwallMasterSeek');
      const timeDisplay = document.getElementById('vwallMasterTime');
      const audioSelect = document.getElementById('vwallAudioSelect');
      const speedSelect = document.getElementById('vwallSpeedSelect');
      const fullscreenBtn = document.getElementById('vwallFullscreenBtn');
      const syncBadge = document.getElementById('vwallSyncBadge');

      const formatTime = (secs) => {
        if (!secs || isNaN(secs)) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      };

      // 1. Master Play/Pause Toggle
      const togglePlay = () => {
        if (masterVideo.paused) {
          videos.forEach(v => v.play().catch(() => {}));
          if (playBtn) playBtn.textContent = '⏸';
        } else {
          videos.forEach(v => v.pause());
          if (playBtn) playBtn.textContent = '▶';
        }
      };

      if (playBtn) playBtn.onclick = togglePlay;

      // 2. Timeline Progress & Seek
      masterVideo.addEventListener('timeupdate', () => {
        if (!isSeeking && masterVideo.duration && seekSlider) {
          seekSlider.value = (masterVideo.currentTime / masterVideo.duration) * 100;
        }
        if (timeDisplay) {
          timeDisplay.textContent = `${formatTime(masterVideo.currentTime)} / ${formatTime(masterVideo.duration)}`;
        }
      });

      if (seekSlider) {
        seekSlider.oninput = () => {
          isSeeking = true;
          const targetTime = (seekSlider.value / 100) * (masterVideo.duration || 0);
          if (timeDisplay) timeDisplay.textContent = `${formatTime(targetTime)} / ${formatTime(masterVideo.duration)}`;
        };

        seekSlider.onchange = () => {
          const targetTime = (seekSlider.value / 100) * (masterVideo.duration || 0);
          videos.forEach(v => { v.currentTime = targetTime; });
          isSeeking = false;
        };
      }

      // 3. Audio Channel Switcher
      const switchAudioChannel = (screenId) => {
        activeAudioId = screenId;
        screensData.forEach(s => {
          const v = document.getElementById(`vwall_video_${s.id}`);
          const el = document.getElementById(`vwall_screen_${s.id}`);
          if (v) v.muted = (s.id !== screenId);
          if (el) el.classList.toggle('active-audio', s.id === screenId);
        });
        if (audioSelect) audioSelect.value = screenId;
      };

      if (audioSelect) {
        audioSelect.onchange = (e) => switchAudioChannel(e.target.value);
      }

      // Clicking any video screen switches active audio to it
      screensData.forEach(s => {
        const screenEl = document.getElementById(`vwall_screen_${s.id}`);
        if (screenEl) {
          screenEl.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
              switchAudioChannel(s.id);
            }
          };
        }
      });

      // 4. Fit Mode Selector (Fill / Contain / Cover)
      const fitSelect = document.getElementById('vwallFitSelect');
      if (fitSelect) {
        fitSelect.onchange = (e) => {
          const fitVal = e.target.value;
          videos.forEach(v => { v.style.objectFit = fitVal; });
        };
      }

      // 5. Playback Speed Selector
      if (speedSelect) {
        speedSelect.onchange = (e) => {
          const rate = parseFloat(e.target.value) || 1.0;
          videos.forEach(v => { v.playbackRate = rate; });
        };
      }

      // 6. Fullscreen Toggle
      if (fullscreenBtn) {
        fullscreenBtn.onclick = () => {
          const stage = document.getElementById('videowallStage');
          if (!document.fullscreenElement) {
            stage.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        };
      }

      // 6. Periodic Drift Compensation (Resynchronization)
      const thresholdSecs = thresholdMs / 1000.0;
      this.syncIntervalId = setInterval(() => {
        if (masterVideo.paused || isSeeking) return;

        const masterTime = masterVideo.currentTime;
        let hasDrift = false;

        videos.forEach(v => {
          if (v !== masterVideo && v.readyState >= 2) {
            const diff = Math.abs(v.currentTime - masterTime);
            if (diff > thresholdSecs) {
              v.currentTime = masterTime;
              hasDrift = true;
            }
          }
        });

        if (syncBadge) {
          if (hasDrift) {
            syncBadge.textContent = '⚡ Réaligné';
            syncBadge.style.borderColor = '#eab308';
            syncBadge.style.color = '#fde047';
            setTimeout(() => {
              syncBadge.textContent = '⚡ Synchronisé';
              syncBadge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
              syncBadge.style.color = '#4ade80';
            }, 1200);
          }
        }
      }, intervalMs);

      // 7. Global Keyboard Shortcuts
      const keyHandler = (e) => {
        if (!document.getElementById('videowallStage')) {
          window.removeEventListener('keydown', keyHandler);
          return;
        }

        const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (isInputFocused && document.activeElement !== seekSlider) return;

        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.key === 'm' || e.key === 'M') {
          const currentAudioVideo = document.getElementById(`vwall_video_${activeAudioId}`);
          if (currentAudioVideo) currentAudioVideo.muted = !currentAudioVideo.muted;
        } else if (e.key === 'f' || e.key === 'F') {
          const stage = document.getElementById('videowallStage');
          if (!document.fullscreenElement) stage.requestFullscreen().catch(() => {});
          else document.exitFullscreen().catch(() => {});
        } else if (e.key === 'ArrowRight') {
          videos.forEach(v => { v.currentTime = Math.min(v.duration || 99999, v.currentTime + 5); });
        } else if (e.key === 'ArrowLeft') {
          videos.forEach(v => { v.currentTime = Math.max(0, v.currentTime - 5); });
        }
      };

      window.addEventListener('keydown', keyHandler);
    },

    cleanup() {
      if (this.syncIntervalId) {
        clearInterval(this.syncIntervalId);
        this.syncIntervalId = null;
      }
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(VideoWallViewerPlugin);
  }
})(window);
