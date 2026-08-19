<?php
/**
 * SimpleGallery 2026 - Explorer App UI Template
 * Injected automatically by the Kernel into the workspace.
 */
?>
<!-- Floating Multi-Selection Action Toolbar -->
<div id="selectionToolbar" class="selection-toolbar" style="display: none;">
  <span id="selectionToolbarCount">0 élément(s) sélectionné(s)</span>
  <button id="selectionSelectAllBtn" type="button" class="selection-btn" data-i18n="selection.select_all">Tout sélectionner</button>
  <button id="selectionClearBtn" type="button" class="selection-btn" data-i18n="selection.clear">Désélectionner tout</button>
</div>

<!-- Google Drive Style Advanced Search Modal -->
<div id="searchModal" class="search-modal-backdrop" style="display: none;">
  <div class="search-modal-card">
    <div class="gdrive-modal-header">
      <h3 class="gdrive-modal-title" data-i18n="adv_search.title">Recherche avancée</h3>
      <button type="button" id="searchModalCloseBtn" class="gdrive-modal-close" title="Fermer (Échap)" data-i18n-title="common.close">✕</button>
    </div>

    <form id="searchAdvancedForm" class="gdrive-search-form">
      <!-- Row 1: Type -->
      <div class="gdrive-form-row">
        <label for="advSearchCategory" class="gdrive-form-label" data-i18n="sort.title">Type</label>
        <div class="gdrive-form-control">
          <select id="advSearchCategory" class="gdrive-select">
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
        <label for="advSearchName" class="gdrive-form-label" data-i18n="sort.name">Nom de l'élément</label>
        <div class="gdrive-form-control">
          <input type="text" id="advSearchName" class="gdrive-input" placeholder="Saisissez un terme figurant dans le nom du fichier" data-i18n-placeholder="nav.search_placeholder">
        </div>
      </div>

      <!-- Row 3: Contient les mots -->
      <div class="gdrive-form-row">
        <label for="advSearchWords" class="gdrive-form-label" data-i18n="comment.title">Contient les mots</label>
        <div class="gdrive-form-control">
          <input type="text" id="advSearchWords" class="gdrive-input" placeholder="Saisissez des mots figurant dans la légende ou description" data-i18n-placeholder="comment.placeholder">
        </div>
      </div>

      <!-- Row 4: Emplacement -->
      <div class="gdrive-form-row">
        <label for="advSearchLocation" class="gdrive-form-label" data-i18n="common.search">Emplacement</label>
        <div class="gdrive-form-control">
          <select id="advSearchLocation" class="gdrive-select">
            <option value="everywhere" data-i18n="adv_search.loc_everywhere">Partout (recherche récursive dans tous les sous-dossiers)</option>
            <option value="current" data-i18n="adv_search.loc_current">Dans ce dossier uniquement</option>
          </select>
        </div>
      </div>

      <!-- Row 5: Date -->
      <div class="gdrive-form-row">
        <label for="advSearchTiming" class="gdrive-form-label" data-i18n="sort.date">Date</label>
        <div class="gdrive-form-control">
          <select id="advSearchTiming" class="gdrive-select">
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
      <div id="advSearchCustomDateRow" class="gdrive-form-row" style="display: none;">
        <label class="gdrive-form-label" data-i18n="adv_search.date_range">Période</label>
        <div class="gdrive-form-control gdrive-date-range">
          <span class="gdrive-date-label" data-i18n="adv_search.date_from">Du</span>
          <input type="date" id="advSearchDateFrom" class="gdrive-input gdrive-date-input">
          <span class="gdrive-date-label" data-i18n="adv_search.date_to">Au</span>
          <input type="date" id="advSearchDateTo" class="gdrive-input gdrive-date-input">
        </div>
      </div>

      <!-- Row 6: Taille -->
      <div class="gdrive-form-row">
        <label for="advSearchSize" class="gdrive-form-label" data-i18n="sort.size">Taille</label>
        <div class="gdrive-form-control">
          <select id="advSearchSize" class="gdrive-select">
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
            <input type="checkbox" id="advSearchGpsOnly" class="gdrive-checkbox">
            <span data-i18n="adv_search.gps_only">📍 Avec coordonnées GPS uniquement</span>
          </label>
          <label class="gdrive-checkbox-label">
            <input type="checkbox" id="advSearchFavOnly" class="gdrive-checkbox">
            <span data-i18n="nav.favorites">❤️ Uniquement les favoris</span>
          </label>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="gdrive-modal-footer">
        <button type="button" id="advSearchResetBtn" class="gdrive-btn-text" data-i18n="adv_search.reset">Réinitialiser</button>
        <button type="submit" id="advSearchSubmitBtn" class="gdrive-btn-primary" data-i18n="adv_search.submit">Rechercher</button>
      </div>
    </form>
  </div>
</div>

<!-- Interactive Leaflet Map & GPS Route Modal -->
<div id="mapModal" class="map-modal-backdrop" style="display: none;">
  <div class="map-modal-card">
    <div class="map-modal-header">
      <div class="map-modal-title-group">
        <h3 class="map-modal-title" data-i18n="map.title">🗺️ Exploration Cartographique &amp; Trajet GPS</h3>
        <span id="mapModalCountBadge" class="map-count-badge" data-i18n="map.count_badge">0 photos géolocalisées</span>
      </div>
      <div class="map-modal-controls">
        <div class="map-layer-selector">
          <button type="button" class="map-layer-btn" data-layer="dark" title="Fond de carte sombre" data-i18n-title="map.layer_dark" data-i18n="map.layer_dark">🌙 Sombre</button>
          <button type="button" class="map-layer-btn active" data-layer="streets" title="Plan de rues (OpenStreetMap)" data-i18n-title="map.layer_streets" data-i18n="map.layer_streets">🗺️ Rues</button>
          <button type="button" class="map-layer-btn" data-layer="satellite" title="Vue Satellite (Esri)" data-i18n-title="map.layer_satellite" data-i18n="map.layer_satellite">🛰️ Satellite</button>
        </div>
        <button type="button" id="mapToggleSmartGpsBtn" class="map-ctrl-btn active" title="Activer / Désactiver l'interpolation et déduction GPS intelligente des photos prises à proximité temporelle">
          <span data-i18n="map.smart_deduction">✨ Déduction auto</span> (<span id="mapSmartGpsCount">0</span>)
        </button>
        <button type="button" id="mapToggleRouteBtn" class="map-ctrl-btn active" title="Afficher / Masquer le tracé chronologique du parcours" data-i18n="map.route">
          〰️ Trajet
        </button>
        <button type="button" id="mapFitBoundsBtn" class="map-ctrl-btn" title="Recentrer la carte sur tous les médias" data-i18n="map.recenter">
          🎯 Recentrer
        </button>
        <button type="button" id="mapModalCloseBtn" class="map-modal-close" title="Fermer la carte (Échap)" data-i18n-title="common.close">✕</button>
      </div>
    </div>
    <div id="galleryLeafletMap" class="map-canvas"></div>
  </div>
</div>
