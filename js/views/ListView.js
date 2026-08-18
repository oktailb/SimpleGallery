/**
 * SimpleGallery 2026 - List / Table Details View Plugin
 * Structured list layout with metadata columns, sorting, and fast actions.
 */
(function(window) {
  'use strict';

  const ListViewPlugin = {
    id: 'list',
    icon: '📑',
    nameKey: 'view.list',
    containerClass: 'list-table-view',
    cssPath: 'css/views/list.css',

    /**
     * Optional custom container wrapper for list headers and rows
     */
    renderContainer(files, ctx) {
      const headerHtml = `
        <div class="list-table-header">
          <span class="list-col-preview">${ctx.escapeHtml(ctx.t('view.col_preview') || 'Aperçu')}</span>
          <span class="list-col-name">${ctx.escapeHtml(ctx.t('view.col_name') || 'Nom / Description')}</span>
          <span class="list-col-category">${ctx.escapeHtml(ctx.t('view.col_type') || 'Type')}</span>
          <span class="list-col-size">${ctx.escapeHtml(ctx.t('view.col_size') || 'Taille')}</span>
          <span class="list-col-date">${ctx.escapeHtml(ctx.t('view.col_date') || 'Date')}</span>
          <span class="list-col-actions">${ctx.escapeHtml(ctx.t('view.col_actions') || 'Actions')}</span>
        </div>
      `;

      const rowsHtml = files.map((file, idx) => this.renderItem(file, idx, ctx)).join('');

      return `
        <div class="list-table-wrapper">
          ${headerHtml}
          <div class="list-table-body">
            ${rowsHtml}
          </div>
        </div>
      `;
    },

    /**
     * Renders a single row item for the List layout
     * @param {Object} file
     * @param {number} idx
     * @param {Object} ctx
     * @returns {string} HTML markup
     */
    renderItem(file, idx, ctx) {
      const canDelete = ctx.userRights ? ctx.userRights.can_delete : ctx.isAdmin;
      const canComment = ctx.userRights ? ctx.userRights.can_comment : ctx.isAdmin;
      const isFav = ctx.favorites && ctx.favorites.includes(file.path);

      let categoryIcon = '📄';
      if (file.category === 'image') categoryIcon = '🖼️';
      else if (file.category === 'video') categoryIcon = '🎬';
      else if (file.category === 'audio') categoryIcon = '🎵';
      else if (file.category === 'archive') categoryIcon = '📦';
      else if (file.category === 'doc') categoryIcon = '📝';

      let gpsBadge = '';
      if (file.exif && file.exif.gps) {
        gpsBadge = `<button type="button" class="gps-badge" data-path="${ctx.escapeHtml(file.path)}" title="${ctx.escapeHtml(ctx.t('card.gps_locate'))}">📍 GPS</button>`;
      } else if (ctx.smartLocationsMap && ctx.smartLocationsMap.has(file.path)) {
        gpsBadge = `<button type="button" class="gps-badge magic-badge" data-path="${ctx.escapeHtml(file.path)}" title="${ctx.escapeHtml(ctx.t('card.gps_locate_deduced'))}">✨ GPS</button>`;
      }

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
