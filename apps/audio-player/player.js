/**
 * SimpleGallery 2026 - Audio Player Application
 * Autonomous audio player widget with playback controls, glowing frequency wave animation, and ID3 tags.
 */
(function(window) {
  'use strict';

  const AudioViewerPlugin = {
    id: 'audio-pip',
    nameKey: 'viewer.audio',
    categories: ['audio'],
    extensions: ['mp3', 'ogg', 'wav', 'm4a', 'flac', 'aac', 'wma', 'opus'],
    mimeTypes: ['audio/*'],
    defaultTarget: 'pip',
    supportsFullscreen: false,
    supportsPip: true,
    cssPath: 'apps/audio-player/player.css',

    open(file, options, ctx) {
      if (!ctx) return false;

      const canDownloadItem = ctx.state.isAdmin || (ctx.state.userRights ? ctx.state.userRights.can_download_item !== false : true);
      const controlsListAttr = canDownloadItem ? '' : 'controlsList="nodownload"';
      const cleanPathId = encodeURIComponent(file.path).replace(/%/g, '_');
      const winId = `audio-${cleanPathId}`;

      // 1. WebOS Window Manager Mode (Primary)
      if (window.WindowManager) {
        const appTitle = (window.sys && window.sys.appManager) 
          ? window.sys.appManager.getAppTitle('audio-player') 
          : (ctx.t('apps.audio-player.title') || "Lecteur Audio");

        const win = window.WindowManager.createWindow({
          id: winId,
          appId: 'audio-player',
          appName: appTitle,
          fileName: file.name,
          title: `${appTitle} : ${file.name}`,
          icon: '🎵',
          width: 480,
          height: 220,
          content: `
            <div class="webos-audio-card" style="padding:1.5rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;height:100%;background:linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95));">
              <div style="font-size:2.5rem;animation:pulse 2s infinite ease-in-out;">🎵</div>
              <div style="font-weight:600;color:#f8fafc;text-align:center;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ctx.escapeHtml(file.comment || file.name)}</div>
              <audio id="audio-${cleanPathId}" src="${file.file_url}" controls ${controlsListAttr} autoplay style="width:100%;max-width:380px;"></audio>
            </div>
          `,
          onClose: () => {
            const aud = document.getElementById(`audio-${cleanPathId}`);
            if (aud) {
              aud.pause();
              aud.src = '';
            }
          },
          onFocus: () => {
            if (window.MenuBarManager) {
              window.MenuBarManager.registerAppMenu('audio-player', (container) => {
                container.innerHTML = `
                  <div class="app-menu-left">
                    <span class="app-menu-pill active" style="font-weight:600;">🎵 ${ctx.escapeHtml(file.name)}</span>
                    <button type="button" class="app-menu-pill" id="menuAudPlayPauseBtn">⏯️ Lecture / Pause</button>
                    <button type="button" class="app-menu-pill" id="menuAudMuteBtn">🔊 Muet</button>
                    <button type="button" class="app-menu-pill" id="menuAudInfoBtn">ℹ️ ${ctx.escapeHtml(ctx.t('lightbox.metadata_btn') || 'Propriétés (I)')}</button>
                  </div>
                `;
                const aud = document.getElementById(`audio-${cleanPathId}`);
                if (aud) {
                  const ppBtn = container.querySelector('#menuAudPlayPauseBtn');
                  const muteBtn = container.querySelector('#menuAudMuteBtn');
                  const infoBtn = container.querySelector('#menuAudInfoBtn');
                  if (ppBtn) ppBtn.onclick = () => { if (aud.paused) aud.play(); else aud.pause(); };
                  if (muteBtn) muteBtn.onclick = () => { aud.muted = !aud.muted; muteBtn.textContent = aud.muted ? '🔇 Rétablir son' : '🔊 Muet'; };
                  if (infoBtn) infoBtn.onclick = () => { if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file); };
                }
              });
              window.MenuBarManager.setActiveApp('audio-player');
            }
          }
        });

        // Shortcut I
        const keyHandler = (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          if (e.key === 'i' || e.key === 'I') {
            if (win.element && win.element.classList.contains('active')) {
              if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file);
            }
          }
        };
        window.addEventListener('keydown', keyHandler);
        return true;
      }

      // 2. Legacy PiP Fallback Mode
      if (!ctx.el || !ctx.el.pipWidget || !ctx.el.pipMediaContainer) return false;
      ctx.state.currentPipFile = file;
      if (ctx.el.pipTitle) ctx.el.pipTitle.innerText = file.comment || file.name;
      ctx.el.pipWidget.style.display = 'flex';
      ctx.el.pipWidget.classList.remove('minimized');
      if (ctx.el.pipInfoPanel) ctx.el.pipInfoPanel.style.display = 'none';

      ctx.el.pipMediaContainer.innerHTML = `
        <div class="audio-pip-wrapper">
          <div class="audio-pip-icon">🎵</div>
          <audio id="pipActiveAudio" src="${file.file_url}" controls ${controlsListAttr} autoplay style="width:100%;"></audio>
        </div>
      `;

      return true;
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(AudioViewerPlugin);
  }
})(window);
