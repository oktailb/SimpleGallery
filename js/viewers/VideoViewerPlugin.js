/**
 * SimpleGallery 2026 - Video Viewer Plugin
 * Autonomous Picture-in-Picture floating video player + fullscreen theater + keyboard shortcuts & atom metadata.
 */
(function(window) {
  'use strict';

  const VideoViewerPlugin = {
    id: 'video-pip',
    nameKey: 'viewer.video',
    categories: ['video'],
    extensions: ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv', 'avi', 'wmv'],
    mimeTypes: ['video/*'],
    defaultTarget: 'pip',
    supportsFullscreen: true,
    supportsPip: true,
    cssPath: 'css/viewers/video.css',

    /**
     * Opens a video file in the floating PiP player
     * @param {Object} file
     * @param {Object} options
     * @param {Object} ctx (Gallery instance)
     */
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
        <div class="video-pip-content">
          <video id="pipActiveVideo" src="${file.file_url}" controls ${controlsListAttr} autoplay playsinline style="width:100%;height:100%;object-fit:contain;"></video>
        </div>
      `;

      this.bindVideoShortcuts(ctx);
      return true;
    },

    bindVideoShortcuts(ctx) {
      const video = document.getElementById('pipActiveVideo');
      if (!video) return;

      // Double click on video to toggle fullscreen expand
      video.ondblclick = (e) => {
        e.stopPropagation();
        ctx.togglePipExpanded();
      };

      // Keyboard controls when video is active
      const keyHandler = (e) => {
        if (!document.getElementById('pipActiveVideo')) {
          window.removeEventListener('keydown', keyHandler);
          return;
        }

        const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (isInputFocused) return;

        if (e.code === 'Space' && (ctx.el.pipWidget.classList.contains('expanded') || document.activeElement === video)) {
          e.preventDefault();
          if (video.paused) video.play(); else video.pause();
        } else if (e.key === 'm' || e.key === 'M') {
          video.muted = !video.muted;
        } else if (e.key === 'f' || e.key === 'F') {
          if (ctx.el.pipWidget.classList.contains('expanded')) {
            ctx.togglePipExpanded(false);
          } else {
            ctx.togglePipExpanded(true);
          }
        } else if (e.key === 'ArrowRight' && ctx.el.pipWidget.classList.contains('expanded')) {
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
        } else if (e.key === 'ArrowLeft' && ctx.el.pipWidget.classList.contains('expanded')) {
          video.currentTime = Math.max(0, video.currentTime - 5);
        }
      };

      window.addEventListener('keydown', keyHandler);
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(VideoViewerPlugin);
  }
})(window);
