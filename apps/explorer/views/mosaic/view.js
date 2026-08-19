/**
 * SimpleGallery 2026 - Explorer Fluid Mosaic View Plugin (apps/explorer/views/mosaic/view.js)
 */
(function(window) {
  'use strict';

  const MosaicViewPlugin = {
    id: 'mosaic',
    icon: '🧱',
    name: 'Mosaïque',
    nameKey: 'view.mosaic',
    containerClass: 'fluid-mosaic-grid',
    cssPath: 'apps/explorer/views/mosaic/view.css',

    renderItem(file, idx, ctx) {
      let overlayHtml = '';
      if (file.category === 'video') {
        overlayHtml = '<div class="video-play-overlay">▶</div>';
      } else if (file.category === 'audio') {
        overlayHtml = '<div class="audio-play-overlay">🎵</div>';
      }

      let mosaicCardClass = 'mosaic-card';
      if (file.category === 'video') {
        mosaicCardClass += ' film-strip-mosaic-card';
      } else if (file.category === 'audio') {
        mosaicCardClass += ' audio-cassette-mosaic-card';
      } else if (file.category !== 'image') {
        mosaicCardClass += ' doc-file-mosaic-card';
      }

      let gpsBadge = '';
      if (file.exif && file.exif.gps) {
        gpsBadge = `<button type="button" class="gps-badge" data-path="${ctx.escapeHtml(file.path)}" title="${ctx.escapeHtml(ctx.t('card.gps_locate'))}">📍 GPS</button>`;
      } else if (ctx.smartLocationsMap && ctx.smartLocationsMap.has(file.path)) {
        gpsBadge = `<button type="button" class="gps-badge magic-badge" data-path="${ctx.escapeHtml(file.path)}" title="${ctx.escapeHtml(ctx.t('card.gps_locate_deduced'))}">✨ GPS</button>`;
      }

      const canDelete = ctx.userRights ? ctx.userRights.can_delete : ctx.isAdmin;
      const canComment = ctx.userRights ? ctx.userRights.can_comment : ctx.isAdmin;
      const isFav = ctx.favorites && ctx.favorites.includes(file.path);

      const deleteBtnHtml = canDelete
        ? `<button class="delete-item-btn" data-path="${file.path}" data-name="${ctx.escapeHtml(file.name)}" data-type="file" title="${ctx.escapeHtml(ctx.t('card.delete_item'))}">🗑️</button>`
        : '';
      const favBtnHtml = `<button class="favorite-btn ${isFav ? 'is-favorite' : ''}" data-path="${file.path}" title="${ctx.escapeHtml(isFav ? ctx.t('lightbox.favorite_remove') : ctx.t('lightbox.favorite_add'))}" onclick="event.stopPropagation()">${isFav ? '❤️' : '🤍'}</button>`;
      const pipCardBtn = ['video', 'audio'].includes(file.category)
        ? `<button class="pip-card-btn" data-index="${idx}" title="${ctx.escapeHtml(ctx.t('card.pip_mode'))}" onclick="event.stopPropagation()">🗗</button>`
        : '';

      return `
        <div class="${mosaicCardClass} ${ctx.handleClass || ''}" data-index="${idx}" draggable="${ctx.isDraggable || 'false'}">
          ${deleteBtnHtml}
          <div class="mosaic-img-wrapper">
            <img src="${file.thumb_url}" alt="${ctx.escapeHtml(file.name)}" loading="lazy" draggable="false" />
            ${favBtnHtml}
            ${pipCardBtn}
            ${overlayHtml}
          </div>
          <div class="mosaic-hover-info">
            <div class="mosaic-title">${ctx.escapeHtml(file.comment || file.name)}</div>
            <div class="mosaic-meta">
              <span>${file.size_formatted || ''}</span>
              ${gpsBadge}
              ${canComment ? `<button class="edit-media-comment-btn" data-filename="${ctx.escapeHtml(file.name)}" data-comment="${ctx.escapeHtml(file.comment || '')}" title="${ctx.escapeHtml(ctx.t('card.edit_comment'))}">✏️</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }
  };

  if (window.GalleryViewRegistry) {
    window.GalleryViewRegistry.register(MosaicViewPlugin);
  }
})(window);
