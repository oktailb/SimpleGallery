/**
 * SimpleGallery 2026 - Explorer Tabular List View Plugin (apps/explorer/views/list/view.js)
 */
(function(window) {
  'use strict';

  const ListViewPlugin = {
    id: 'list',
    icon: '📑',
    name: 'Liste',
    nameKey: 'view.list',
    containerClass: 'tabular-list-container',
    cssPath: 'apps/explorer/views/list/view.css',

    renderContainer(files, ctx) {
      const rows = files.map((file, idx) => this.renderItem(file, idx, ctx)).join('');
      return `
        <div class="list-table-wrapper">
          <div class="list-table-header">
            <div class="list-col-preview" data-i18n="list.preview">Aperçu</div>
            <div class="list-col-name" data-i18n="list.name">Nom &amp; Description</div>
            <div class="list-col-category" data-i18n="list.type">Type</div>
            <div class="list-col-size" data-i18n="list.size">Taille</div>
            <div class="list-col-date" data-i18n="list.date">Date de modification</div>
            <div class="list-col-actions" data-i18n="list.actions">Actions</div>
          </div>
          <div class="list-table-body">
            ${rows}
          </div>
        </div>
      `;
    },

    renderItem(file, idx, ctx) {
      let categoryIcon = '📄';
      if (file.category === 'image') categoryIcon = '🖼️';
      else if (file.category === 'video') categoryIcon = '🎬';
      else if (file.category === 'audio') categoryIcon = '🎵';
      else if (file.category === 'archive') categoryIcon = '📦';

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

      const dateFormatted = file.mtime_formatted || (file.mtime ? new Date(file.mtime * 1000).toLocaleDateString() : '—');

      return `
        <div class="list-table-row ${ctx.handleClass || ''}" data-index="${idx}" draggable="${ctx.isDraggable || 'false'}">
          <div class="list-col-preview">
            <img src="${file.thumb_url}" alt="${ctx.escapeHtml(file.name)}" loading="lazy" draggable="false" />
          </div>
          <div class="list-col-name">
            <div class="list-item-main-title">${ctx.escapeHtml(file.name)}</div>
            ${file.comment ? `<div class="list-item-sub-comment">${ctx.escapeHtml(file.comment)}</div>` : ''}
          </div>
          <div class="list-col-category">
            <span class="list-category-badge">${categoryIcon} ${ctx.escapeHtml(file.category)}</span>
          </div>
          <div class="list-col-size">
            <span>${file.size_formatted || '—'}</span>
          </div>
          <div class="list-col-date">
            <span>${dateFormatted}</span>
          </div>
          <div class="list-col-actions" onclick="event.stopPropagation()">
            ${gpsBadge}
            ${canComment ? `<button class="edit-media-comment-btn" data-filename="${ctx.escapeHtml(file.name)}" data-comment="${ctx.escapeHtml(file.comment || '')}" title="${ctx.escapeHtml(ctx.t('card.edit_comment'))}">✏️</button>` : ''}
            ${pipCardBtn}
            ${favBtnHtml}
            ${deleteBtnHtml}
          </div>
        </div>
      `;
    }
  };

  if (window.GalleryViewRegistry) {
    window.GalleryViewRegistry.register(ListViewPlugin);
  }
})(window);
