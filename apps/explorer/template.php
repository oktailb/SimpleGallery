<?php
/**
 * SimpleGallery 2026 - Explorer App UI Template & Modals
 * Injected automatically by the Kernel into the workspace.
 */
?>
<template id="explorerAppTemplate">
  <!-- Explorer Application Workspace (Mounted inside WebOS Window) -->
  <div class="webos-explorer-container">
    <!-- Breadcrumbs Navigation Bar (Moved above filter pills for maximum readability) -->
    <div class="breadcrumbs-container">
      <nav class="breadcrumbs" aria-label="Breadcrumb Navigation">
        <span class="crumb-item crumb-active crumb-root-item" title="Stockage (Racine)"><span class="crumb-root-icon" aria-hidden="true">💾</span> <span class="crumb-root-name" data-i18n="nav.root">Stockage</span></span>
      </nav>
    </div>

    <!-- Filter Pills Bar -->
    <div class="filter-bar">
      <div class="filter-pills">
        <button class="pill-btn active" data-category="all" data-i18n="view.filter_all">Tout</button>
        <button class="pill-btn" data-category="image" data-i18n="view.filter_images">Photos</button>
        <button class="pill-btn" data-category="video" data-i18n="view.filter_videos">Vidéos</button>
        <button class="pill-btn" data-category="audio" data-i18n="view.filter_audio">Audio</button>
        <button class="pill-btn" data-category="doc" data-i18n="view.filter_docs">Documents</button>
        <button class="pill-btn" data-category="archive" data-i18n="view.filter_archives">Archives</button>
      </div>

      <div class="gallery-stats" data-i18n="stats.loading">Chargement...</div>
    </div>

    <!-- Main Workspace -->
    <main class="gallery-container">

      <?php if (!empty($storage_status['is_fallback'])): ?>
        <!-- Storage Diagnostic Warning Banner -->
        <div class="storage-diagnostic-banner" style="margin-bottom: 1.5rem; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 1rem 1.25rem; color: #fbbf24; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <span style="font-size: 1.5rem; line-height: 1;">⚠️</span>
            <div>
              <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem; color: #fef08a;">
                Diagnostic Stockage : Mode Fallback Racine Actif
              </div>
              <div style="font-size: 0.85rem; line-height: 1.4; color: #fde68a;">
                <?php echo htmlspecialchars($storage_status['reason'] ?? '', ENT_QUOTES, 'UTF-8'); ?>
              </div>
              <div style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.9; display: flex; flex-direction: column; gap: 0.2rem; font-family: ui-monospace, monospace;">
                <div>📁 <strong>Dossier configuré ($storage_media_dir) :</strong> <?php echo htmlspecialchars($storage_status['configured_path'], ENT_QUOTES, 'UTF-8'); ?></div>
                <div>📍 <strong>Dossier exploré ($real_base_dir) :</strong> <?php echo htmlspecialchars($storage_status['active_path'], ENT_QUOTES, 'UTF-8'); ?></div>
              </div>
              <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #cbd5e1;">
                💡 <em>Pour utiliser le dossier dédié, créez le dossier <code>storage/media/</code> ou modifiez <code>$storage_media_dir</code> dans <code>config/config.php</code>.</em>
              </div>
            </div>
          </div>
          <button type="button" onclick="this.closest('.storage-diagnostic-banner').style.display='none';" style="background: none; border: none; color: #fef08a; font-size: 1.2rem; cursor: pointer; padding: 0.2rem 0.5rem;" title="Fermer">✕</button>
        </div>
      <?php endif; ?>

      <!-- Search Active Results Banner -->
      <div class="search-results-banner" style="display: none;">
        <div class="search-results-left">
          <span class="search-results-badge" data-i18n="search.badge">🔍 Recherche</span>
          <span class="search-results-count-text search-results-text" data-i18n="search.results_found">Résultats trouvés</span>
        </div>
        <button type="button" class="exit-search-btn" title="Quitter la recherche et revenir à la navigation du dossier" data-i18n-title="search.exit_title">
          <span data-i18n="search.exit_btn">✕ Quitter la recherche</span>
        </button>
      </div>

      <!-- Subfolders Section -->
      <section class="folder-section" style="display: none;">
        <h2 class="section-title">📂 <span data-i18n="nav.subfolders">Sous-dossiers</span></h2>
        <div class="folders-grid"></div>
      </section>

      <!-- Media Section -->
      <section class="media-section">
        <div class="media-grid polaroid-grid"></div>
      </section>

      <!-- Loading State -->
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p data-i18n="stats.indexing">Indexation des fichiers médias...</p>
      </div>

      <!-- Empty State -->
      <div class="empty-state" style="display: none;">
        <div class="empty-state-icon">📂</div>
        <h3 data-i18n="stats.empty">Ce dossier ne contient aucun fichier média.</h3>
        <p data-i18n="stats.drag_drop_hint">Glissez-déposez des fichiers ici pour les ajouter.</p>
        <div style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-muted); opacity: 0.85;">
          📁 Emplacement exploré : <code><?php echo htmlspecialchars($storage_status['active_path'], ENT_QUOTES, 'UTF-8'); ?></code>
        </div>
      </div>
    </main>

    <!-- Floating Multi-Selection Action Toolbar -->
    <div class="selection-toolbar" style="display: none;">
      <span class="selection-toolbar-count">0 élément(s) sélectionné(s)</span>
      <button type="button" class="selection-info-btn selection-btn" data-i18n="lightbox.metadata_btn">ℹ️ Propriétés</button>
      <button type="button" class="selection-select-all-btn selection-btn" data-i18n="selection.select_all">Tout sélectionner</button>
      <button type="button" class="selection-clear-btn selection-btn" data-i18n="selection.clear">Désélectionner tout</button>
    </div>

    <!-- Google Drive Style Advanced Search Modal -->
    <div class="search-modal search-modal-backdrop" style="display: none;">
      <div class="search-modal-card">
        <div class="gdrive-modal-header">
          <h3 class="gdrive-modal-title" data-i18n="adv_search.title">Recherche avancée</h3>
          <button type="button" class="search-modal-close-btn gdrive-modal-close" title="Fermer (Échap)" data-i18n-title="common.close">✕</button>
        </div>

        <form class="search-advanced-form gdrive-search-form">
          <!-- Row 1: Type -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.title">Type</label>
            <div class="gdrive-form-control">
              <select class="adv-search-category gdrive-select">
                <option value="all" data-i18n="adv_search.type_all">Tout</option>
                <option value="image" data-i18n="adv_search.type_image">Photos (Images)</option>
                <option value="video" data-i18n="adv_search.type_video">Vidéos</option>
                <option value="audio" data-i18n="adv_search.type_audio">Audio / Musique</option>
                <option value="doc" data-i18n="view.filter_docs">Documents</option>
                <option value="archive" data-i18n="view.filter_archives">Archives</option>
              </select>
            </div>
          </div>

          <!-- Row 2: Nom de l'élément -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.name">Nom de l'élément</label>
            <div class="gdrive-form-control">
              <input type="text" class="adv-search-name gdrive-input" placeholder="Saisissez un terme figurant dans le nom du fichier" data-i18n-placeholder="nav.search_placeholder">
            </div>
          </div>

          <!-- Row 3: Contient les mots -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="comment.title">Contient les mots</label>
            <div class="gdrive-form-control">
              <input type="text" class="adv-search-words gdrive-input" placeholder="Saisissez des mots figurant dans la légende ou description" data-i18n-placeholder="comment.placeholder">
            </div>
          </div>

          <!-- Row 4: Emplacement -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="common.search">Emplacement</label>
            <div class="gdrive-form-control">
              <select class="adv-search-location gdrive-select">
                <option value="everywhere" data-i18n="adv_search.loc_everywhere">Partout (recherche récursive dans tous les sous-dossiers)</option>
                <option value="current" data-i18n="adv_search.loc_current">Dans ce dossier uniquement</option>
              </select>
            </div>
          </div>

          <!-- Row 5: Date -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.date">Date</label>
            <div class="gdrive-form-control">
              <select class="adv-search-timing gdrive-select">
                <option value="all" data-i18n="adv_search.time_all">N'importe quand</option>
                <option value="today" data-i18n="adv_search.time_today">Aujourd'hui</option>
                <option value="week" data-i18n="adv_search.time_week">7 derniers jours</option>
                <option value="month" data-i18n="adv_search.time_month">30 derniers jours</option>
                <option value="year" data-i18n="adv_search.time_year">Cette année</option>
                <option value="custom" data-i18n="adv_search.time_custom">Période personnalisée...</option>
              </select>
            </div>
          </div>

          <!-- Row 5b: Custom Date Range (hidden by default) -->
          <div class="adv-search-custom-date-row gdrive-form-row" style="display: none;">
            <label class="gdrive-form-label" data-i18n="adv_search.date_range">Période</label>
            <div class="gdrive-form-control gdrive-date-range">
              <span class="gdrive-date-label" data-i18n="adv_search.date_from">Du</span>
              <input type="date" class="adv-search-date-from gdrive-input gdrive-date-input">
              <span class="gdrive-date-label" data-i18n="adv_search.date_to">Au</span>
              <input type="date" class="adv-search-date-to gdrive-input gdrive-date-input">
            </div>
          </div>

          <!-- Row 6: Taille -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="sort.size">Taille</label>
            <div class="gdrive-form-control">
              <select class="adv-search-size gdrive-select">
                <option value="all" data-i18n="adv_search.size_all">N'importe quelle taille</option>
                <option value="small" data-i18n="adv_search.size_small">Petite (&lt; 1 Mo)</option>
                <option value="medium" data-i18n="adv_search.size_medium">Moyenne (1 Mo à 10 Mo)</option>
                <option value="large" data-i18n="adv_search.size_large">Grande (10 Mo à 50 Mo)</option>
                <option value="xlarge" data-i18n="adv_search.size_xlarge">Très grande (&gt; 50 Mo)</option>
              </select>
            </div>
          </div>

          <!-- Row 7: Options (GPS, Favoris) -->
          <div class="gdrive-form-row">
            <label class="gdrive-form-label" data-i18n="adv_search.options_label">Options</label>
            <div class="gdrive-form-control gdrive-checkbox-group">
              <label class="gdrive-checkbox-label">
                <input type="checkbox" class="adv-search-gps-only gdrive-checkbox">
                <span data-i18n="adv_search.gps_only">📍 Avec coordonnées GPS uniquement</span>
              </label>
              <label class="gdrive-checkbox-label">
                <input type="checkbox" class="adv-search-fav-only gdrive-checkbox">
                <span data-i18n="nav.favorites">❤️ Uniquement les favoris</span>
              </label>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="gdrive-modal-footer">
            <button type="button" class="adv-search-reset-btn gdrive-btn-text" data-i18n="adv_search.reset">Réinitialiser</button>
            <button type="submit" class="adv-search-submit-btn gdrive-btn-primary" data-i18n="adv_search.submit">Rechercher</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Interactive Leaflet Map & GPS Route Modal -->
    <div class="map-modal map-modal-backdrop" style="display: none;">
      <div class="map-modal-card">
        <div class="map-modal-header">
          <div class="map-modal-title-group">
            <h3 class="map-modal-title" data-i18n="map.title">🗺️ Exploration Cartographique &amp; Trajet GPS</h3>
            <span class="map-modal-count-badge map-count-badge" data-i18n="map.count_badge">0 photos géolocalisées</span>
          </div>
          <div class="map-modal-controls">
            <div class="map-layer-selector">
              <button type="button" class="map-layer-btn" data-layer="dark" title="Fond de carte sombre" data-i18n-title="map.layer_dark" data-i18n="map.layer_dark">🌙 Sombre</button>
              <button type="button" class="map-layer-btn active" data-layer="streets" title="Plan de rues (OpenStreetMap)" data-i18n-title="map.layer_streets" data-i18n="map.layer_streets">🗺️ Rues</button>
              <button type="button" class="map-layer-btn" data-layer="satellite" title="Vue Satellite (Esri)" data-i18n-title="map.layer_satellite" data-i18n="map.layer_satellite">🛰️ Satellite</button>
            </div>
            <button type="button" class="map-toggle-smart-gps-btn map-ctrl-btn active" title="Activer / Désactiver l'interpolation et déduction GPS intelligente des photos prises à proximité temporelle">
              <span data-i18n="map.smart_deduction">✨ Déduction auto</span> (<span class="map-smart-gps-count">0</span>)
            </button>
            <button type="button" class="map-toggle-route-btn map-ctrl-btn active" title="Afficher / Masquer le tracé chronologique du parcours" data-i18n="map.route">
              〰️ Trajet
            </button>
            <button type="button" class="map-fit-bounds-btn map-ctrl-btn" title="Recentrer la carte sur tous les médias" data-i18n="map.recenter">
              🎯 Recentrer
            </button>
            <button type="button" class="map-modal-close-btn map-modal-close" title="Fermer la carte (Échap)" data-i18n-title="common.close">✕</button>
          </div>
        </div>
        <div class="gallery-leaflet-map map-canvas"></div>
      </div>
    </div>
  </div>
</template>

