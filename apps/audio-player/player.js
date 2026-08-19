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
      if (!ctx || !ctx.el) return false;
      if (!ctx.el.pipWidget || !ctx.el.pipMediaContainer) return false;

      ctx.state.currentPipFile = file;
      if (ctx.el.pipTitle) ctx.el.pipTitle.innerText = file.comment || file.name;
      ctx.el.pipWidget.style.display = 'flex';
      ctx.el.pipWidget.classList.remove('minimized');
      if (ctx.el.pipInfoPanel) ctx.el.pipInfoPanel.style.display = 'none';

      const canDownloadItem = ctx.state.isAdmin || (ctx.state.userRights ? ctx.state.userRights.can_download_item !== false : true);
      const controlsListAttr = canDownloadItem ? '' : 'controlsList="nodownload"';

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
