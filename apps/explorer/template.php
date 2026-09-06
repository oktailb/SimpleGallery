<?php
/**
 * SimpleGallery 2026 - Explorer App UI Template & Modals
 * Injected automatically by the Kernel into the workspace.
 */
?>
<template id="explorerAppTemplate">
  <!-- Explorer Application Workspace (Mounted inside WebOS Window) -->
  <div class="webos-explorer-container">
    <!-- Breadcrumbs Navigation Bar -->
    <div class="breadcrumbs-container">
      <nav class="breadcrumbs" aria-label="Breadcrumb Navigation">
        <span class="crumb-item crumb-active crumb-root-item" data-i18n-title="nav.root" title="<?php echo htmlspecialchars(__t('nav.root'), ENT_QUOTES, 'UTF-8'); ?>"><span class="crumb-root-icon" aria-hidden="true">💾</span> <span class="crumb-root-name" data-i18n="nav.root"><?php echo htmlspecialchars(__t('nav.root'), ENT_QUOTES, 'UTF-8'); ?></span></span>
      </nav>
    </div>

    <!-- Multimodal Autorun / VLog Presentation Banner -->
    <div class="explorer-autorun-banner" style="display: none;">
      <div class="autorun-banner-glow"></div>
      <div class="autorun-banner-content">
        <div class="autorun-badge">
          <span class="autorun-badge-dot"></span>
          <span class="autorun-badge-text" data-i18n="autorun.badge">VLog / Présentation</span>
        </div>
        <div class="autorun-info">
          <h3 class="autorun-title"></h3>
          <p class="autorun-description"></p>
        </div>
        <div class="autorun-actions">
          <button type="button" class="autorun-play-btn" data-i18n-title="autorun.play">
            <span class="autorun-play-icon">▶️</span>
            <span class="autorun-play-label" data-i18n="autorun.launch">Lancer la présentation</span>
          </button>
          <button type="button" class="autorun-edit-btn" style="display: none;" data-i18n-title="autorun.edit">
            ⚙️ <span data-i18n="autorun.settings">Autorun</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Filter Pills & Quick Toolbar Bar -->
    <div class="filter-bar">
      <!-- Quick Live Filter Search -->
      <div class="explorer-quick-search-wrapper">
        <span class="explorer-quick-search-icon" aria-hidden="true">🔍</span>
        <input type="search" class="explorer-quick-search-input" placeholder="Filtrer..." data-i18n-placeholder="explorer.quick_search_ph">
        <button type="button" class="explorer-quick-search-clear" style="display: none;" title="Effacer" data-i18n-title="nav.search_clear">✕</button>
      </div>

      <div class="filter-pills">
        <button class="pill-btn active" data-category="all" data-i18n="view.filter_all"><?php echo htmlspecialchars(__t('view.filter_all'), ENT_QUOTES, 'UTF-8'); ?></button>
        <button class="pill-btn" data-category="image" data-i18n="view.filter_images"><?php echo htmlspecialchars(__t('view.filter_images'), ENT_QUOTES, 'UTF-8'); ?></button>
        <button class="pill-btn" data-category="video" data-i18n="view.filter_videos"><?php echo htmlspecialchars(__t('view.filter_videos'), ENT_QUOTES, 'UTF-8'); ?></button>
        <button class="pill-btn" data-category="audio" data-i18n="view.filter_audio"><?php echo htmlspecialchars(__t('view.filter_audio'), ENT_QUOTES, 'UTF-8'); ?></button>
        <button class="pill-btn" data-category="doc" data-i18n="view.filter_docs"><?php echo htmlspecialchars(__t('view.filter_docs'), ENT_QUOTES, 'UTF-8'); ?></button>
        <button class="pill-btn" data-category="archive" data-i18n="view.filter_archives"><?php echo htmlspecialchars(__t('view.filter_archives'), ENT_QUOTES, 'UTF-8'); ?></button>
      </div>

      <!-- Quick View Switcher Buttons -->
      <div class="explorer-view-switcher">
        <button type="button" class="view-mode-btn" data-view="polaroid" title="Polaroid" data-i18n-title="view.polaroid">🖼️</button>
        <button type="button" class="view-mode-btn" data-view="grid" title="Grille" data-i18n-title="view.grid">▦</button>
        <button type="button" class="view-mode-btn" data-view="mosaic" title="Mosaïque" data-i18n-title="view.mosaic">☷</button>
        <button type="button" class="view-mode-btn" data-view="list" title="Liste" data-i18n-title="view.list">☰</button>
      </div>

      <div class="gallery-stats" data-i18n="stats.loading"><?php echo htmlspecialchars(__t('stats.loading'), ENT_QUOTES, 'UTF-8'); ?></div>

      <!-- Inspector Panel Toggle Button -->
      <button type="button" class="explorer-inspector-toggle-btn" title="Détails de l'élément" data-i18n-title="explorer.toggle_inspector">
        ℹ️ <span class="inspector-btn-text" data-i18n="explorer.details">Détails</span>
      </button>

      <!-- Folder Settings Button directly in Explorer toolbar -->
      <button type="button" class="explorer-folder-settings-btn" style="display: none;" title="<?php echo htmlspecialchars(__t('folder_settings.title'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-title="folder_settings.title">
        ⚙️ <span data-i18n="folder_settings.title"><?php echo htmlspecialchars(__t('folder_settings.title'), ENT_QUOTES, 'UTF-8'); ?></span>
      </button>

      <button type="button" class="folder-map-btn" style="display: none;" data-i18n-title="nav.map">
        🗺️ <span data-i18n="nav.map"><?php echo htmlspecialchars(__t('nav.map'), ENT_QUOTES, 'UTF-8'); ?></span>
      </button>

      <button type="button" class="explorer-autorun-btn" style="display: none;" title="<?php echo htmlspecialchars(__t('autorun.toolbar_btn'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-title="autorun.toolbar_btn">
        🎬 <span data-i18n="autorun.toolbar_btn"><?php echo htmlspecialchars(__t('autorun.toolbar_btn'), ENT_QUOTES, 'UTF-8'); ?></span>
      </button>
    </div>

    <!-- Main Workspace with Split Inspector Drawer -->
    <div class="explorer-workspace-split">
      <main class="gallery-container">

      <?php if (!empty($storage_status['is_fallback'])): ?>
        <!-- Storage Diagnostic Warning Banner -->
        <div class="storage-diagnostic-banner" style="margin-bottom: 1.5rem; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 1rem 1.25rem; color: #fbbf24; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <span style="font-size: 1.5rem; line-height: 1;">⚠️</span>
            <div>
              <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem; color: #fef08a;" data-i18n="storage.diag_fallback_title">
                <?php echo htmlspecialchars(__t('storage.diag_fallback_title'), ENT_QUOTES, 'UTF-8'); ?>
              </div>
              <div style="font-size: 0.85rem; line-height: 1.4; color: #fde68a;">
                <?php echo htmlspecialchars($storage_status['reason'] ?? '', ENT_QUOTES, 'UTF-8'); ?>
              </div>
              <div style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.9; display: flex; flex-direction: column; gap: 0.2rem; font-family: ui-monospace, monospace;">
                <div>📁 <strong data-i18n="storage.diag_configured"><?php echo htmlspecialchars(__t('storage.diag_configured'), ENT_QUOTES, 'UTF-8'); ?></strong> <?php echo htmlspecialchars($storage_status['configured_path'], ENT_QUOTES, 'UTF-8'); ?></div>
                <div>📍 <strong data-i18n="storage.diag_explored"><?php echo htmlspecialchars(__t('storage.diag_explored'), ENT_QUOTES, 'UTF-8'); ?></strong> <?php echo htmlspecialchars($storage_status['active_path'], ENT_QUOTES, 'UTF-8'); ?></div>
              </div>
              <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #cbd5e1;" data-i18n="storage.diag_hint">
                💡 <em><?php echo htmlspecialchars(__t('storage.diag_hint'), ENT_QUOTES, 'UTF-8'); ?></em>
              </div>
            </div>
          </div>
          <button type="button" onclick="this.closest('.storage-diagnostic-banner').style.display='none';" style="background: none; border: none; color: #fef08a; font-size: 1.2rem; cursor: pointer; padding: 0.2rem 0.5rem;" data-i18n-title="lightbox.close">✕</button>
        </div>
      <?php endif; ?>

      <!-- Search Active Results Banner -->
      <div class="search-results-banner" style="display: none;">
        <div class="search-results-left">
          <span class="search-results-badge" data-i18n="search.badge"><?php echo htmlspecialchars(__t('search.badge'), ENT_QUOTES, 'UTF-8'); ?></span>
          <span class="search-results-count-text search-results-text" data-i18n="search.results_found"><?php echo htmlspecialchars(__t('search.results_found'), ENT_QUOTES, 'UTF-8'); ?></span>
        </div>
        <button type="button" class="exit-search-btn" data-i18n-title="search.exit_title">
          <span data-i18n="search.exit_btn"><?php echo htmlspecialchars(__t('search.exit_btn'), ENT_QUOTES, 'UTF-8'); ?></span>
        </button>
      </div>

      <!-- Subfolders Section -->
      <section class="folder-section" style="display: none;">
        <h2 class="section-title">📂 <span data-i18n="nav.subfolders"><?php echo htmlspecialchars(__t('nav.subfolders'), ENT_QUOTES, 'UTF-8'); ?></span></h2>
        <div class="folders-grid"></div>
      </section>

      <!-- Media Section -->
      <section class="media-section">
        <div class="media-grid polaroid-grid"></div>
      </section>

      <!-- Loading State -->
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p data-i18n="stats.indexing"><?php echo htmlspecialchars(__t('stats.indexing'), ENT_QUOTES, 'UTF-8'); ?></p>
      </div>

      <!-- Empty State -->
      <div class="empty-state" style="display: none;">
        <div class="empty-state-icon">📂</div>
        <h3 data-i18n="stats.empty"><?php echo htmlspecialchars(__t('stats.empty'), ENT_QUOTES, 'UTF-8'); ?></h3>
        <p data-i18n="stats.drag_drop_hint"><?php echo htmlspecialchars(__t('stats.drag_drop_hint'), ENT_QUOTES, 'UTF-8'); ?></p>
        <div style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-muted); opacity: 0.85;">
          📁 <span data-i18n="stats.explored_location"><?php echo htmlspecialchars(__t('stats.explored_location'), ENT_QUOTES, 'UTF-8'); ?></span> : <code><?php echo htmlspecialchars($storage_status['active_path'], ENT_QUOTES, 'UTF-8'); ?></code>
        </div>
      </div>
    </main>

      <!-- Side Inspector Drawer Panel -->
      <aside class="explorer-inspector-drawer" style="display: none;">
        <div class="inspector-header">
          <div class="inspector-title-row">
            <span class="inspector-badge">ℹ️ <span data-i18n="explorer.inspector_title">Inspecteur</span></span>
            <button type="button" class="inspector-close-btn" title="Fermer le panneau" data-i18n-title="lightbox.close">✕</button>
          </div>
        </div>

        <div class="inspector-content">
          <!-- Empty Inspector State -->
          <div class="inspector-empty-state">
            <span class="inspector-empty-icon">👆</span>
            <p data-i18n="explorer.inspector_empty">Sélectionnez un élément pour afficher ses propriétés détaillées.</p>
          </div>

          <!-- Populated Inspector State -->
          <div class="inspector-details" style="display: none;">
            <div class="inspector-preview-box">
              <img class="inspector-preview-img" src="" alt="Aperçu" style="display: none;">
              <div class="inspector-preview-icon" style="display: none;">📄</div>
            </div>
            <div class="inspector-filename-badge"></div>

            <div class="inspector-actions-row">
              <button type="button" class="inspector-action-btn inspector-open-btn" title="Ouvrir le fichier" data-i18n-title="explorer.open_item">
                ▶️ <span data-i18n="explorer.open">Ouvrir</span>
              </button>
              <button type="button" class="inspector-action-btn inspector-quicklook-btn" title="Aperçu rapide (Espace)" data-i18n-title="explorer.quicklook">
                👁️ <span data-i18n="explorer.preview">Aperçu</span>
              </button>
            </div>

            <dl class="inspector-meta-list">
              <dt data-i18n="meta.filename">Nom</dt>
              <dd class="inspector-meta-name"></dd>

              <dt data-i18n="meta.filesize">Taille</dt>
              <dd class="inspector-meta-size"></dd>

              <dt data-i18n="meta.dimensions">Dimensions</dt>
              <dd class="inspector-meta-dim">-</dd>

              <dt data-i18n="meta.mtime">Modifié le</dt>
              <dd class="inspector-meta-date"></dd>

              <dt data-i18n="comment.title">Légende</dt>
              <dd class="inspector-meta-comment">-</dd>

              <dt data-i18n="meta.exif_title">EXIF / Appareil</dt>
              <dd class="inspector-meta-camera">-</dd>

              <dt data-i18n="nav.map">GPS</dt>
              <dd class="inspector-meta-gps">-</dd>
            </dl>
          </div>
        </div>
      </aside>
    </div><!-- /.explorer-workspace-split -->

    <!-- Floating Multi-Selection Action Toolbar -->
    <div class="selection-toolbar" style="display: none;">
      <span class="selection-toolbar-count" data-i18n="selection.selected_count" data-i18n-count="0"></span>
      <button type="button" class="selection-copy-btn selection-btn" data-i18n-title="clipboard.copy_tooltip" title="<?php echo htmlspecialchars(__t('clipboard.copy_tooltip'), ENT_QUOTES, 'UTF-8'); ?>">📋</button>
      <button type="button" class="selection-cut-btn selection-btn" data-i18n-title="clipboard.cut_tooltip" title="<?php echo htmlspecialchars(__t('clipboard.cut_tooltip'), ENT_QUOTES, 'UTF-8'); ?>">✂️</button>
      <button type="button" class="selection-delete-btn selection-btn" data-i18n-title="clipboard.delete_tooltip" title="<?php echo htmlspecialchars(__t('clipboard.delete_tooltip'), ENT_QUOTES, 'UTF-8'); ?>" style="color: var(--danger-color, #ef4444);">🗑️</button>
      <button type="button" class="selection-info-btn selection-btn" data-i18n="lightbox.metadata_btn"><?php echo htmlspecialchars(__t('lightbox.metadata_btn'), ENT_QUOTES, 'UTF-8'); ?></button>
      <button type="button" class="selection-select-all-btn selection-btn" data-i18n="selection.select_all"><?php echo htmlspecialchars(__t('selection.select_all'), ENT_QUOTES, 'UTF-8'); ?></button>
      <button type="button" class="selection-clear-btn selection-btn" data-i18n="selection.clear"><?php echo htmlspecialchars(__t('selection.clear'), ENT_QUOTES, 'UTF-8'); ?></button>
    </div>

    <!-- Google Drive Style Advanced Search Modal -->
    <div class="search-modal search-modal-backdrop" style="display: none;">
      <div class="search-modal-card">
        <div class="gdrive-modal-header">
          <h3 class="gdrive-modal-title" data-i18n="adv_search.title"><?php echo htmlspecialchars(__t('adv_search.title'), ENT_QUOTES, 'UTF-8'); ?></h3>
          <button type="button" class="search-modal-close-btn gdrive-modal-close" data-i18n-title="lightbox.close">✕</button>
        </div>

        <form class="search-advanced-form gdrive-search-form">
          <!-- Row 1: Type -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.title"><?php echo htmlspecialchars(__t('sort.title'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control">
              <select class="adv-search-category gdrive-select">
                <option value="all" data-i18n="adv_search.type_all"><?php echo htmlspecialchars(__t('adv_search.type_all'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="image" data-i18n="adv_search.type_image"><?php echo htmlspecialchars(__t('adv_search.type_image'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="video" data-i18n="adv_search.type_video"><?php echo htmlspecialchars(__t('adv_search.type_video'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="audio" data-i18n="adv_search.type_audio"><?php echo htmlspecialchars(__t('adv_search.type_audio'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="doc" data-i18n="view.filter_docs"><?php echo htmlspecialchars(__t('view.filter_docs'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="archive" data-i18n="view.filter_archives"><?php echo htmlspecialchars(__t('view.filter_archives'), ENT_QUOTES, 'UTF-8'); ?></option>
              </select>
            </div>
          </div>

          <!-- Row 2: Nom de l'élément -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.name"><?php echo htmlspecialchars(__t('sort.name'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control">
              <input type="text" class="adv-search-name gdrive-input" data-i18n-placeholder="nav.search_placeholder" placeholder="<?php echo htmlspecialchars(__t('nav.search_placeholder'), ENT_QUOTES, 'UTF-8'); ?>">
            </div>
          </div>

          <!-- Row 3: Contient les mots -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="comment.title"><?php echo htmlspecialchars(__t('comment.title'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control">
              <input type="text" class="adv-search-words gdrive-input" data-i18n-placeholder="comment.placeholder" placeholder="<?php echo htmlspecialchars(__t('comment.placeholder'), ENT_QUOTES, 'UTF-8'); ?>">
            </div>
          </div>

          <!-- Row 4: Emplacement -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="common.search"><?php echo htmlspecialchars(__t('common.search'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control">
              <select class="adv-search-location gdrive-select">
                <option value="everywhere" data-i18n="adv_search.loc_everywhere"><?php echo htmlspecialchars(__t('adv_search.loc_everywhere'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="current" data-i18n="adv_search.loc_current"><?php echo htmlspecialchars(__t('adv_search.loc_current'), ENT_QUOTES, 'UTF-8'); ?></option>
              </select>
            </div>
          </div>

          <!-- Row 5: Date -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.date"><?php echo htmlspecialchars(__t('sort.date'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control">
              <select class="adv-search-timing gdrive-select">
                <option value="all" data-i18n="adv_search.time_all"><?php echo htmlspecialchars(__t('adv_search.time_all'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="today" data-i18n="adv_search.time_today"><?php echo htmlspecialchars(__t('adv_search.time_today'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="week" data-i18n="adv_search.time_week"><?php echo htmlspecialchars(__t('adv_search.time_week'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="month" data-i18n="adv_search.time_month"><?php echo htmlspecialchars(__t('adv_search.time_month'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="year" data-i18n="adv_search.time_year"><?php echo htmlspecialchars(__t('adv_search.time_year'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="custom" data-i18n="adv_search.time_custom"><?php echo htmlspecialchars(__t('adv_search.time_custom'), ENT_QUOTES, 'UTF-8'); ?></option>
              </select>
            </div>
          </div>

          <!-- Row 5b: Custom Date Range -->
          <div class="adv-search-custom-date-row gdrive-form-row" style="display: none;">
            <label class="gdrive-form-label" data-i18n="adv_search.date_range"><?php echo htmlspecialchars(__t('adv_search.date_range'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control gdrive-date-range">
              <span class="gdrive-date-label" data-i18n="adv_search.date_from"><?php echo htmlspecialchars(__t('adv_search.date_from'), ENT_QUOTES, 'UTF-8'); ?></span>
              <input type="date" class="adv-search-date-from gdrive-input gdrive-date-input">
              <span class="gdrive-date-label" data-i18n="adv_search.date_to"><?php echo htmlspecialchars(__t('adv_search.date_to'), ENT_QUOTES, 'UTF-8'); ?></span>
              <input type="date" class="adv-search-date-to gdrive-input gdrive-date-input">
            </div>
          </div>

          <!-- Row 6: Taille -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.size"><?php echo htmlspecialchars(__t('sort.size'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control">
              <select class="adv-search-size gdrive-select">
                <option value="all" data-i18n="adv_search.size_all"><?php echo htmlspecialchars(__t('adv_search.size_all'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="small" data-i18n="adv_search.size_small"><?php echo htmlspecialchars(__t('adv_search.size_small'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="medium" data-i18n="adv_search.size_medium"><?php echo htmlspecialchars(__t('adv_search.size_medium'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="large" data-i18n="adv_search.size_large"><?php echo htmlspecialchars(__t('adv_search.size_large'), ENT_QUOTES, 'UTF-8'); ?></option>
                <option value="xlarge" data-i18n="adv_search.size_xlarge"><?php echo htmlspecialchars(__t('adv_search.size_xlarge'), ENT_QUOTES, 'UTF-8'); ?></option>
              </select>
            </div>
          </div>

          <!-- Row 7: Options (GPS, Favoris) -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="adv_search.options_label"><?php echo htmlspecialchars(__t('adv_search.options_label'), ENT_QUOTES, 'UTF-8'); ?></label>
            <div class="gdrive-form-control gdrive-checkbox-group">
              <label class="gdrive-checkbox-label">
                <input type="checkbox" class="adv-search-gps-only gdrive-checkbox">
                <span data-i18n="adv_search.gps_only">📍 <?php echo htmlspecialchars(__t('adv_search.gps_only'), ENT_QUOTES, 'UTF-8'); ?></span>
              </label>
              <label class="gdrive-checkbox-label">
                <input type="checkbox" class="adv-search-fav-only gdrive-checkbox">
                <span data-i18n="nav.favorites">❤️ <?php echo htmlspecialchars(__t('nav.favorites'), ENT_QUOTES, 'UTF-8'); ?></span>
              </label>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="gdrive-modal-footer">
            <button type="button" class="adv-search-reset-btn gdrive-btn-text" data-i18n="adv_search.reset"><?php echo htmlspecialchars(__t('adv_search.reset'), ENT_QUOTES, 'UTF-8'); ?></button>
            <button type="submit" class="adv-search-submit-btn gdrive-btn-primary" data-i18n="adv_search.submit"><?php echo htmlspecialchars(__t('adv_search.submit'), ENT_QUOTES, 'UTF-8'); ?></button>
          </div>
        </form>
      </div>
    </div>

    <!-- Interactive Leaflet Map & GPS Route Modal -->
    <div class="map-modal map-modal-backdrop" style="display: none;">
      <div class="map-modal-card">
        <div class="map-modal-header">
          <div class="map-modal-title-group">
            <h3 class="map-modal-title" data-i18n="map.title">🗺️ <?php echo htmlspecialchars(__t('map.title'), ENT_QUOTES, 'UTF-8'); ?></h3>
            <span class="map-modal-count-badge map-count-badge" data-i18n="map.count_badge"></span>
          </div>
          <div class="map-modal-controls">
            <div class="map-layer-selector">
              <button type="button" class="map-layer-btn" data-layer="dark" data-i18n-title="map.layer_dark" data-i18n="map.layer_dark">🌙 <?php echo htmlspecialchars(__t('map.layer_dark'), ENT_QUOTES, 'UTF-8'); ?></button>
              <button type="button" class="map-layer-btn active" data-layer="streets" data-i18n-title="map.layer_streets" data-i18n="map.layer_streets">🗺️ <?php echo htmlspecialchars(__t('map.layer_streets'), ENT_QUOTES, 'UTF-8'); ?></button>
              <button type="button" class="map-layer-btn" data-layer="satellite" data-i18n-title="map.layer_satellite" data-i18n="map.layer_satellite">🛰️ <?php echo htmlspecialchars(__t('map.layer_satellite'), ENT_QUOTES, 'UTF-8'); ?></button>
            </div>
            <button type="button" class="map-toggle-smart-gps-btn map-ctrl-btn active" data-i18n-title="map.smart_deduction">
              <span data-i18n="map.smart_deduction">✨ <?php echo htmlspecialchars(__t('map.smart_deduction'), ENT_QUOTES, 'UTF-8'); ?></span> (<span class="map-smart-gps-count">0</span>)
            </button>
            <button type="button" class="map-toggle-route-btn map-ctrl-btn active" data-i18n-title="map.route" data-i18n="map.route">
              〰️ <?php echo htmlspecialchars(__t('map.route'), ENT_QUOTES, 'UTF-8'); ?>
            </button>
            <button type="button" class="map-fit-bounds-btn map-ctrl-btn" data-i18n-title="map.recenter" data-i18n="map.recenter">
              🎯 <?php echo htmlspecialchars(__t('map.recenter'), ENT_QUOTES, 'UTF-8'); ?>
            </button>
            <button type="button" class="map-modal-close-btn map-modal-close" data-i18n-title="lightbox.close">✕</button>
          </div>
        </div>
        <div class="gallery-leaflet-map map-canvas"></div>
      </div>
    </div>

    <!-- Multimodal Blog & Autorun Presentation Editor Modal -->
    <div class="autorun-editor-modal autorun-editor-backdrop" style="display: none;">
      <div class="autorun-editor-card">
        <div class="autorun-editor-header">
          <div class="autorun-header-left">
            <h3 class="autorun-editor-title">🎬 <span data-i18n="autorun.editor_title">Configuration du Blog Multimodal (autorun.json)</span></h3>
          </div>
          <div class="autorun-header-tabs">
            <button type="button" class="autorun-tab-btn active" id="autorunTabVisualBtn" data-tab="visual">
              🎨 <span data-i18n="autorun.editor_tab_visual">Éditeur Visuel</span>
            </button>
            <button type="button" class="autorun-tab-btn" id="autorunTabJsonBtn" data-tab="json">
              ⚙️ <span data-i18n="autorun.editor_tab_json">Code JSON</span>
            </button>
          </div>
          <button type="button" class="autorun-editor-close-btn" data-i18n-title="lightbox.close">✕</button>
        </div>

        <form class="autorun-editor-form">
          <!-- TAB 1: VISUAL TIMELINE BUILDER -->
          <div class="autorun-tab-content active" id="autorunVisualTabContent">
            <!-- Basic Meta Info -->
            <div class="autorun-form-grid">
              <div class="autorun-form-col">
                <label data-i18n="autorun.prop_title">Titre de la présentation</label>
                <input type="text" class="autorun-edit-title autorun-input" placeholder="ex: Mon voyage en Islande">
              </div>
              <div class="autorun-form-col">
                <label data-i18n="autorun.prop_desc">Description / Introduction</label>
                <input type="text" class="autorun-edit-desc autorun-input" placeholder="Brève introduction du sujet">
              </div>
            </div>

            <!-- Master Media / Lead Sync Track Card -->
            <div class="autorun-section-card">
              <div class="autorun-section-header">
                <span class="autorun-section-icon">🎵</span>
                <span class="autorun-section-title" data-i18n="autorun.master_section">Média Principal (Maître de Synchronisation)</span>
              </div>
              <div class="autorun-master-grid">
                <div class="autorun-field-group">
                  <label data-i18n="autorun.master_type">Type de maître</label>
                  <select class="autorun-edit-master-type autorun-select">
                    <option value="video" data-i18n="autorun.type_video">Vidéo</option>
                    <option value="audio" data-i18n="autorun.type_audio">Piste Audio / Musique</option>
                    <option value="timer" data-i18n="autorun.type_timer">Minuterie Virtuelle (Sans média)</option>
                  </select>
                </div>
                <div class="autorun-field-group" id="autorunMasterFileGroup">
                  <label data-i18n="autorun.master_file">Fichier média principal</label>
                  <select class="autorun-edit-master-file autorun-select">
                    <option value="" data-i18n="autorun.no_file">(Aucun fichier sélectionné)</option>
                  </select>
                </div>
                <div class="autorun-field-group" id="autorunMasterDurationGroup" style="display: none;">
                  <label data-i18n="autorun.master_duration">Durée globale (secondes ou MM:SS)</label>
                  <input type="text" class="autorun-edit-master-duration autorun-input" placeholder="120 ou 02:00">
                </div>
                <div class="autorun-field-group">
                  <label data-i18n="autorun.prop_layout">Disposition des fenêtres</label>
                  <select class="autorun-edit-layout autorun-select">
                    <option value="split-horizontal" data-i18n="autorun.layout_split_h">Divisé Côte à Côte (Média Gauche / Document Droite)</option>
                    <option value="split-vertical" data-i18n="autorun.layout_split_v">Divisé Haut / Bas</option>
                    <option value="overlay" data-i18n="autorun.layout_overlay">Flottant / Cascade</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Timeline Steps Builder Card -->
            <div class="autorun-section-card">
              <div class="autorun-section-header-split">
                <div class="autorun-section-header">
                  <span class="autorun-section-icon">⏱️</span>
                  <span class="autorun-section-title" data-i18n="autorun.timeline_section">Chronologie Multimodale (Timeline)</span>
                </div>
                <button type="button" class="autorun-add-step-btn autorun-btn-secondary" id="autorunAddStepBtn" data-i18n="autorun.add_step">
                  + Ajouter une étape
                </button>
              </div>

              <!-- List of interactive step cards -->
              <div class="autorun-timeline-list" id="autorunTimelineList">
                <!-- Injected dynamically by explorer.js -->
              </div>
            </div>
          </div>

          <!-- TAB 2: RAW JSON CODE VIEW -->
          <div class="autorun-tab-content" id="autorunJsonTabContent" style="display: none;">
            <div class="autorun-form-row">
              <label data-i18n="autorun.json_source">Édition directe JSON (Timeline & Chapitres)</label>
              <textarea class="autorun-edit-json autorun-textarea autorun-code" rows="16" spellcheck="false"></textarea>
            </div>
          </div>

          <div class="autorun-editor-footer">
            <div class="autorun-footer-left">
              <button type="button" class="autorun-editor-delete-btn" style="display: none;" data-i18n="autorun.delete">Supprimer l'autorun</button>
              <button type="button" class="autorun-editor-preview-btn autorun-btn-secondary" data-i18n="autorun.preview">▶️ Tester la présentation</button>
            </div>
            <div class="autorun-footer-right">
              <button type="button" class="autorun-editor-cancel-btn" data-i18n="common.cancel">Annuler</button>
              <button type="submit" class="autorun-editor-save-btn autorun-btn-primary" data-i18n="common.save">Enregistrer</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<!-- =============================================================
     SHARED APPLICATION MODALS (Mounted into WebOS Desktop Shell)
     ============================================================= -->

<!-- Folder Settings Modal (Admin Only) -->
<div id="folderSettingsModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
  <div class="admin-modal-content">
    <div class="admin-modal-header">
      <h3 data-i18n="folder_settings.title">📁 <?php echo htmlspecialchars(__t('folder_settings.title'), ENT_QUOTES, 'UTF-8'); ?></h3>
      <button type="button" id="folderSettingsCloseBtn" class="lightbox-btn" title="<?php echo htmlspecialchars(__t('common.close'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-title="common.close">✕</button>
    </div>
    <div class="admin-modal-body">
      <form id="folderSettingsForm">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_title"><?php echo htmlspecialchars(__t('folder_settings.dotfile_title'), ENT_QUOTES, 'UTF-8'); ?></label>
          <input type="text" id="dotfileTitleInput" class="admin-input" placeholder="<?php echo htmlspecialchars(__t('folder_settings.dotfile_title'), ENT_QUOTES, 'UTF-8'); ?>" />
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_desc"><?php echo htmlspecialchars(__t('folder_settings.dotfile_desc'), ENT_QUOTES, 'UTF-8'); ?></label>
          <textarea id="dotfileDescInput" class="admin-input" rows="3" placeholder="<?php echo htmlspecialchars(__t('folder_settings.dotfile_desc'), ENT_QUOTES, 'UTF-8'); ?>" style="resize: vertical;"></textarea>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_access"><?php echo htmlspecialchars(__t('folder_settings.dotfile_access'), ENT_QUOTES, 'UTF-8'); ?></label>
          <select id="dotfileAccessModeSelect" class="sort-select" style="width: 100%;">
            <option value="public" data-i18n="folder_settings.access_public">🌐 <?php echo htmlspecialchars(__t('folder_settings.access_public'), ENT_QUOTES, 'UTF-8'); ?></option>
            <option value="private" data-i18n="folder_settings.access_private">👁️‍🗨️ <?php echo htmlspecialchars(__t('folder_settings.access_private'), ENT_QUOTES, 'UTF-8'); ?></option>
            <option value="password" data-i18n="folder_settings.access_password">🔒 <?php echo htmlspecialchars(__t('folder_settings.access_password'), ENT_QUOTES, 'UTF-8'); ?></option>
          </select>
        </div>

        <div id="folderPasswordGroup" class="form-group" style="margin-bottom: 1rem; display: none;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.password_label"><?php echo htmlspecialchars(__t('folder_settings.password_label'), ENT_QUOTES, 'UTF-8'); ?></label>
          <input type="password" id="dotfilePasswordInput" class="admin-input" placeholder="<?php echo htmlspecialchars(__t('folder_settings.password_label'), ENT_QUOTES, 'UTF-8'); ?>" />
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_bg"><?php echo htmlspecialchars(__t('folder_settings.dotfile_bg'), ENT_QUOTES, 'UTF-8'); ?></label>
          <input type="text" id="dotfileBgInput" class="admin-input" placeholder="ex: #0f172a ou bg.jpg" />
        </div>

        <button type="submit" class="pill-btn active" style="width: 100%; justify-content: center;" data-i18n="common.save">
          <?php echo htmlspecialchars(__t('common.save'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </form>
    </div>
  </div>
</div>

<!-- Create Folder Modal -->
<div id="createFolderModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
  <div class="admin-modal-content" style="max-width: 420px;">
    <div class="admin-modal-header">
      <h3 data-i18n="create_folder.title">📁 <?php echo htmlspecialchars(__t('create_folder.title'), ENT_QUOTES, 'UTF-8'); ?></h3>
      <button type="button" id="createFolderCloseBtn" class="lightbox-btn" title="<?php echo htmlspecialchars(__t('common.close'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-title="common.close">✕</button>
    </div>
    <div class="admin-modal-body">
      <form id="createFolderForm">
        <label for="createFolderNameInput" class="admin-label" data-i18n="create_folder.placeholder" style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;"><?php echo htmlspecialchars(__t('create_folder.placeholder'), ENT_QUOTES, 'UTF-8'); ?> :</label>
        <input type="text" id="createFolderNameInput" class="admin-input" placeholder="ex: Vacances 2026, Événements..." data-i18n-placeholder="create_folder.placeholder" required />
        <div id="createFolderError" class="admin-error-msg" style="display: none;"></div>
        <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;" data-i18n="create_folder.submit">
          <?php echo htmlspecialchars(__t('create_folder.submit'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </form>
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
<div id="deleteConfirmModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
  <div class="admin-modal-content" style="max-width: 440px; text-align: center;">
    <div class="admin-modal-header">
      <h3 style="color: #ef4444; width: 100%;" data-i18n="delete_confirm.title">🗑️ <?php echo htmlspecialchars(__t('delete_confirm.title'), ENT_QUOTES, 'UTF-8'); ?></h3>
      <button type="button" id="deleteConfirmCloseBtn" class="lightbox-btn" title="<?php echo htmlspecialchars(__t('common.close'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-title="common.close">✕</button>
    </div>
    <div class="admin-modal-body">
      <p id="deleteConfirmMessage" style="font-size: 0.95rem; margin: 1rem 0; color: var(--text-main); line-height: 1.5;"></p>
      <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: center;">
        <button type="button" id="deleteCancelBtn" class="btn-toggle" style="flex: 1; justify-content: center;" data-i18n="common.cancel"><?php echo htmlspecialchars(__t('common.cancel'), ENT_QUOTES, 'UTF-8'); ?></button>
        <button type="button" id="deleteConfirmActionBtn" class="pill-btn active" style="flex: 1; background: #ef4444; color: white; justify-content: center; font-weight: 700;" data-i18n="common.delete">
          🗑️ <?php echo htmlspecialchars(__t('common.delete'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Visitor Folder Password Unlock Modal -->
<div id="folderUnlockModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
  <div class="admin-modal-content">
    <div class="admin-modal-header">
      <h3 data-i18n="stats.folder_locked">🔒 <?php echo htmlspecialchars(__t('stats.folder_locked'), ENT_QUOTES, 'UTF-8'); ?></h3>
      <button type="button" id="folderUnlockCloseBtn" class="lightbox-btn" title="<?php echo htmlspecialchars(__t('common.close'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-title="common.close">✕</button>
    </div>
    <div class="admin-modal-body">
      <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.9rem;" data-i18n="stats.folder_locked_desc">
        <?php echo htmlspecialchars(__t('stats.folder_locked_desc'), ENT_QUOTES, 'UTF-8'); ?>
      </p>
      <form id="folderUnlockForm">
        <input type="hidden" id="folderUnlockPath" />
        <input type="password" id="folderPasswordInput" class="admin-input" placeholder="<?php echo htmlspecialchars(__t('folder_settings.password_label'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-placeholder="folder_settings.password_label" required />
        <div id="folderUnlockError" class="admin-error-msg" style="display: none;"></div>
        <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;" data-i18n="stats.folder_unlock_action">
          <?php echo htmlspecialchars(__t('stats.folder_unlock_action'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </form>
    </div>
  </div>
</div>

<!-- Media Legend Modal (Admin Only) -->
<div id="mediaCommentModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
  <div class="admin-modal-content">
    <div class="admin-modal-header">
      <h3 id="mediaCommentModalTitle" data-i18n="comment.title">💬 <?php echo htmlspecialchars(__t('comment.title'), ENT_QUOTES, 'UTF-8'); ?></h3>
      <button type="button" id="mediaCommentCloseBtn" class="lightbox-btn" title="<?php echo htmlspecialchars(__t('common.close'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-title="common.close">✕</button>
    </div>
    <div class="admin-modal-body">
      <form id="mediaCommentForm">
        <input type="hidden" id="mediaCommentFilename" />
        <div id="mediaCommentFilenameBadge" style="margin-bottom: 0.75rem; font-weight: 600; font-size: 0.9rem; color: var(--text-main);"></div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <input type="text" id="mediaCommentInput" class="admin-input" placeholder="<?php echo htmlspecialchars(__t('comment.placeholder'), ENT_QUOTES, 'UTF-8'); ?>" data-i18n-placeholder="comment.placeholder" />
        </div>
        <button type="submit" class="pill-btn active" style="width: 100%; justify-content: center;" data-i18n="common.save">
          <?php echo htmlspecialchars(__t('common.save'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </form>
    </div>
  </div>
</div>
