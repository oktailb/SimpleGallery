<?php
require_once __DIR__ . '/config.php';

// Set HTTP Security Headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

// Automatically enforce trailing slash for directory access to prevent relative fetch 404 errors
$request_uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($request_uri, PHP_URL_PATH);
if ($path && substr($path, -1) !== '/' && !pathinfo($path, PATHINFO_EXTENSION)) {
    $query = parse_url($request_uri, PHP_URL_QUERY);
    $redirect = $path . '/' . ($query ? '?' . $query : '');
    header('Location: ' . $redirect, true, 301);
    exit;
}

// i18n Locales Discovery & Detection
$available_locales = get_available_locales($real_base_dir);
$default_locale = detect_browser_locale($available_locales, 'fr');
$initial_translations = load_locale_translations($real_base_dir, $default_locale);
?>
<!DOCTYPE html>
<html lang="<?php echo htmlspecialchars($default_locale, ENT_QUOTES, 'UTF-8'); ?>">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?php echo get_csrf_token(); ?>">
  <meta name="cookie-consent-enabled" content="<?php echo !empty($enable_cookie_consent) ? '1' : '0'; ?>">
  <meta name="default-locale" content="<?php echo htmlspecialchars($default_locale, ENT_QUOTES, 'UTF-8'); ?>">
  <meta name="description" content="SimpleGallery 2026 - Ultra-fast zero-dependency modern PHP web gallery">
  <title><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></title>

  <!-- Initial i18n Locales Configuration Payload -->
  <script id="initialLocalesConfig" type="application/json">
    <?php echo json_encode([
      'locales'      => $available_locales,
      'default'      => $default_locale,
      'translations' => $initial_translations
    ], JSON_HEX_TAG | JSON_HEX_AMP); ?>
  </script>

  <!-- Google Fonts: Inter, Outfit, and Caveat for Polaroid handwriting -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="css/gallery.css?v=<?php echo filemtime(__DIR__ . '/css/gallery.css'); ?>">

  <!-- Leaflet & MarkerCluster for Interactive Maps (100% Free, Zero API Key) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>

  <!-- Dynamic Theme Injection from config.php -->
  <style id="dynamic-theme-vars">
    :root {
      --bg-main: <?php echo $active_theme['bg_main']; ?>;
      --polaroid-bg: <?php echo $active_theme['polaroid_bg']; ?>;
      --polaroid-text: <?php echo $active_theme['polaroid_text']; ?>;
      --polaroid-sub: <?php echo $active_theme['polaroid_sub']; ?>;
      --accent-primary: <?php echo $active_theme['accent']; ?>;
      --bg-card: <?php echo $active_theme['card_bg']; ?>;
      --text-main: <?php echo $active_theme['text_main']; ?>;
      --text-muted: <?php echo $active_theme['text_muted']; ?>;
    }
  </style>

  <!-- Gallery View Plugins & Core Client Application -->
  <script src="js/views/GalleryViewRegistry.js?v=<?php echo filemtime(__DIR__ . '/js/views/GalleryViewRegistry.js'); ?>" defer></script>
  <script src="js/views/PolaroidView.js?v=<?php echo filemtime(__DIR__ . '/js/views/PolaroidView.js'); ?>" defer></script>
  <script src="js/views/GridView.js?v=<?php echo filemtime(__DIR__ . '/js/views/GridView.js'); ?>" defer></script>
  <script src="js/views/MosaicView.js?v=<?php echo filemtime(__DIR__ . '/js/views/MosaicView.js'); ?>" defer></script>
  <script src="js/views/ListView.js?v=<?php echo filemtime(__DIR__ . '/js/views/ListView.js'); ?>" defer></script>
  <script src="js/gallery.js?v=<?php echo filemtime(__DIR__ . '/js/gallery.js'); ?>" defer></script>

</head>
<body>

  <!-- App Header -->
  <header class="app-header">
    <div class="header-container">
      <!-- Top Row: Brand & Toolbar Controls -->
      <div class="header-top-row">
        <div class="brand-section">
          <div class="brand-logo">📸</div>
          <h1 class="brand-title"><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></h1>
        </div>

        <!-- Toolbar Controls -->
        <div class="toolbar-controls">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="searchInput" class="search-input" placeholder="Rechercher des médias..." aria-label="Rechercher des médias" data-i18n-placeholder="nav.search_placeholder">
            <button type="button" id="searchClearBtn" class="search-clear-btn" title="Effacer la recherche" data-i18n-title="nav.search_clear" style="display: none;">✕</button>
            <button type="button" id="advancedSearchBtn" class="search-filter-btn" title="Options de recherche avancée" data-i18n-title="nav.search_advanced" onclick="if(window.galleryApp) window.galleryApp.openSearchModal();">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
            </button>
          </div>

          <div class="sort-group" style="display: flex; align-items: center; gap: 0.35rem;">
            <select id="sortSelect" class="sort-select" aria-label="Sort options">
              <option value="name" data-i18n="sort.name">Nom</option>
              <option value="exif_date" data-i18n="sort.date">Date de prise de vue 📷</option>
              <option value="date" data-i18n="sort.mtime">Date de modification</option>
              <option value="size" data-i18n="sort.size">Taille du fichier</option>
            </select>
            <button id="sortOrderBtn" class="btn-toggle" title="Inverser l'ordre" data-i18n-title="sort.order_asc">
              <span id="sortOrderIcon" style="font-size: 1.1rem; font-weight: bold;">⇩</span>
            </button>
          </div>

          <button id="toggleFavoritesBtn" class="btn-toggle" title="Afficher uniquement mes favoris" data-i18n-title="nav.favorites">
            <span>❤️</span><span id="favCountBadge" class="fav-count-badge" style="display:none;">0</span>
          </button>

          <div class="archive-dropdown-container">
            <button id="downloadArchiveBtn" class="btn-toggle" title="Télécharger le dossier sous forme d'archive" data-i18n-title="nav.download_archive">
              <span>⇲</span> ▾
            </button>
            <div id="archiveMenu" class="archive-dropdown-menu">
              <!-- Dynamically populated by JS based on server binary availability -->
            </div>
          </div>

          <!-- View Mode Selector Dropdown -->
          <div class="view-selector-container" id="viewSelectorContainer">
            <button type="button" id="viewSelectorBtn" class="btn-toggle view-btn" title="Mode d'affichage" data-i18n-title="view.switch_mode">
              <span id="currentViewIcon">🖼️</span>
              <span id="currentViewLabel" data-i18n="view.polaroid">Polaroid</span>
              <span class="view-dropdown-arrow">▾</span>
            </button>
            <div id="viewDropdownMenu" class="view-dropdown-menu" style="display: none;">
              <button type="button" class="view-option-btn active" data-view-mode="polaroid">
                <span>🖼️</span> <span data-i18n="view.polaroid">Polaroid</span>
              </button>
              <button type="button" class="view-option-btn" data-view-mode="grid">
                <span>🔲</span> <span data-i18n="view.grid">Grille</span>
              </button>
              <button type="button" class="view-option-btn" data-view-mode="mosaic">
                <span>🧱</span> <span data-i18n="view.mosaic">Mosaïque</span>
              </button>
              <button type="button" class="view-option-btn" data-view-mode="list">
                <span>📑</span> <span data-i18n="view.list">Liste</span>
              </button>
            </div>
          </div>

          <button id="createFolderBtn" class="btn-toggle" title="Créer un nouveau sous-dossier" data-i18n-title="nav.create_folder" style="display: none;">
            <span>📁+</span>
          </button>

          <button id="uploadMediaBtn" class="btn-toggle" title="Uploader des médias" data-i18n-title="nav.upload_media" style="display: none;">
            <span>📤</span>
          </button>
          <input type="file" id="uploadFileInput" multiple style="display: none;" />

          <button id="folderSettingsBtn" class="btn-toggle" title="Paramètres du dossier (.title, .desc, .bg, .theme)" data-i18n-title="nav.folder_settings" style="display: none;">
            <span>⚙</span>
          </button>

          <!-- Language Selector Dropdown -->
          <div class="lang-selector-container" id="langSelectorContainer">
            <button type="button" id="langSelectorBtn" class="btn-toggle lang-btn" title="Changer la langue" data-i18n-title="nav.switch_lang">
              <span id="currentLangFlag"><?php echo get_locale_flag_html($available_locales[$default_locale] ?? []); ?></span>
              <span id="currentLangCode"><?php echo strtoupper(htmlspecialchars($default_locale, ENT_QUOTES, 'UTF-8')); ?></span>
              <span class="lang-dropdown-arrow">▾</span>
            </button>
            <div id="langDropdownMenu" class="lang-dropdown-menu" style="display: none;">
              <?php foreach ($available_locales as $code => $info): ?>
                <button type="button" class="lang-option-btn <?php echo ($code === $default_locale) ? 'active' : ''; ?>" data-lang="<?php echo htmlspecialchars($code, ENT_QUOTES, 'UTF-8'); ?>">
                  <span class="lang-flag"><?php echo get_locale_flag_html($info); ?></span>
                  <span class="lang-name"><?php echo htmlspecialchars($info['name'], ENT_QUOTES, 'UTF-8'); ?></span>
                  <span class="lang-code"><?php echo strtoupper(htmlspecialchars($code, ENT_QUOTES, 'UTF-8')); ?></span>
                </button>
              <?php endforeach; ?>
            </div>
          </div>

          <button id="adminBtn" class="btn-toggle" title="Mode Administration" data-i18n-title="nav.admin">
            <span id="adminBtnIcon">🔑</span> <span id="adminBtnText" data-i18n="nav.admin">Admin</span>
          </button>
        </div>
      </div>

      <!-- Bottom Row: Dedicated Breadcrumbs Navigation Bar -->
      <div class="header-bottom-row">
        <nav id="breadcrumbs" class="breadcrumbs" aria-label="Breadcrumb Navigation">
          <span class="crumb-item crumb-active"><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></span>
        </nav>
      </div>
    </div>
  </header>

  <!-- Filter Pills Bar -->
  <div class="filter-bar">
    <div id="filterPills" class="filter-pills">
      <button class="pill-btn active" data-category="all" data-i18n="view.filter_all">Tout</button>
      <button class="pill-btn" data-category="image" data-i18n="view.filter_images">Photos</button>
      <button class="pill-btn" data-category="video" data-i18n="view.filter_videos">Vidéos</button>
      <button class="pill-btn" data-category="audio" data-i18n="view.filter_audio">Audio</button>
      <button class="pill-btn" data-category="doc" data-i18n="view.filter_docs">Documents</button>
      <button class="pill-btn" data-category="archive" data-i18n="view.filter_archives">Archives</button>
    </div>

    <div id="galleryStats" class="gallery-stats" data-i18n="stats.loading">Chargement...</div>
    <button type="button" id="folderMapBtn" class="folder-map-btn" style="display: none;" title="Explorer la carte et le trajet GPS interactif des photos du dossier" data-i18n-title="nav.map">
      🗺️ <span data-i18n="nav.map">Carte GPS</span>
    </button>
  </div>

  <!-- Main Workspace -->
  <main class="gallery-container">
    <!-- Search Active Results Banner -->
    <div id="searchResultsBanner" class="search-results-banner" style="display: none;">
      <div class="search-results-left">
        <span class="search-results-badge" data-i18n="search.badge">🔍 Recherche</span>
        <span id="searchResultsCountText" class="search-results-text" data-i18n="search.results_found">Résultats trouvés</span>
      </div>
      <button type="button" id="exitSearchBtn" class="exit-search-btn" title="Quitter la recherche et revenir à la navigation du dossier" data-i18n-title="search.exit_title">
        <span data-i18n="search.exit_btn">✕ Quitter la recherche</span>
      </button>
    </div>

    <!-- Subfolders Section -->
    <section id="folderSection" style="display: none;">
      <h2 class="section-title">📂 <span data-i18n="nav.subfolders">Sous-dossiers</span></h2>
      <div id="foldersGrid" class="folders-grid"></div>
    </section>

    <!-- Media Section -->
    <section id="mediaSection">
      <div id="mediaGrid" class="polaroid-grid"></div>
    </section>

    <!-- Loading State -->
    <div id="loadingState" class="loading-spinner">
      <div class="spinner"></div>
      <p data-i18n="stats.indexing">Indexation des fichiers médias...</p>
    </div>

    <!-- Empty State -->
    <div id="emptyState" class="empty-state" style="display: none;">
      <div class="empty-state-icon">📂</div>
      <h3 data-i18n="stats.empty">Ce dossier ne contient aucun fichier média.</h3>
      <p data-i18n="stats.drag_drop_hint">Glissez-déposez des fichiers ici pour les ajouter.</p>
    </div>
  </main>

  <!-- Lightbox Modal -->
  <div id="lightbox" class="lightbox-modal" role="dialog" aria-hidden="true">
    <div class="lightbox-header">
      <div>
        <div id="lightboxTitle" class="lightbox-title" data-i18n="lightbox.preview_title">Aperçu média</div>
        <div id="lightboxMeta" style="font-size:0.8rem;color:var(--text-muted);"></div>
        <div id="lightboxComment" class="lightbox-comment" style="display:none;"></div>
      </div>

      <!-- Image Explorer Controls (Zoom, Rotate, Download, Close) -->
      <div class="lightbox-actions">
        <div id="imageExplorerControls" class="image-explorer-controls" style="display: flex; gap: 0.4rem;">
          <button id="lightboxZoomInBtn" class="lightbox-btn" title="Zoom In (+)" data-i18n-title="lightbox.zoom_in">➕</button>
          <button id="lightboxZoomOutBtn" class="lightbox-btn" title="Zoom Out (-)" data-i18n-title="lightbox.zoom_out">➖</button>
          <button id="lightboxResetZoomBtn" class="lightbox-btn" title="Reset Zoom (0)" data-i18n-title="lightbox.reset_zoom">🔄</button>
          <button id="lightboxRotateBtn" class="lightbox-btn" title="Rotate 90° (R)" data-i18n-title="lightbox.rotate">⟳</button>
          <span id="zoomBadge" class="zoom-badge">100%</span>
        </div>

        <button id="lightboxExifBtn" class="lightbox-btn" title="Détails EXIF (I)" data-i18n-title="lightbox.exif" style="display: none;">
          ℹ️
        </button>
        <button id="lightboxEditImageBtn" class="lightbox-btn" title="Éditer l'image (Recadrage, Rotation, Filtres - Mode Admin)" data-i18n-title="lightbox.edit_image" style="display: none;">
          🎨
        </button>
        <button id="lightboxEditCommentBtn" class="lightbox-btn" title="Éditer la légende (.comment)" data-i18n-title="lightbox.edit_comment" style="display: none;">
          ✏️
        </button>
        <button id="lightboxDeleteBtn" class="lightbox-btn" title="Supprimer le média (Mode Admin)" data-i18n-title="lightbox.delete" style="display: none; color: #f87171;">
          🗑️
        </button>
        <button id="lightboxFavBtn" class="lightbox-btn" title="Ajouter aux favoris" data-i18n-title="lightbox.favorite_add">
          🤍
        </button>
        <button id="lightboxFullscreenBtn" class="lightbox-btn" title="Plein écran (F)" data-i18n-title="lightbox.fullscreen">
          ⛶
        </button>
        <a id="lightboxDownloadBtn" href="#" class="lightbox-btn" title="Télécharger le fichier" data-i18n-title="lightbox.download" download>
          ⬇️
        </a>
        <button id="lightboxCloseBtn" class="lightbox-btn" title="Fermer (Échap)" data-i18n-title="lightbox.close">
          ✕
        </button>
      </div>
    </div>

    <div class="lightbox-body">
      <button id="lightboxPrevBtn" class="lightbox-nav-btn lightbox-nav-prev" title="Précédent" data-i18n-title="lightbox.prev">
        &lsaquo;
      </button>

      <div id="lightboxContent" class="lightbox-content-wrapper"></div>

      <button id="lightboxNextBtn" class="lightbox-nav-btn lightbox-nav-next" title="Suivant" data-i18n-title="lightbox.next">
        &rsaquo;
      </button>
    </div>

    <!-- Lightbox EXIF Drawer Panel -->
    <div id="lightboxExifPanel" class="lightbox-exif-panel" style="display: none;">
      <div class="exif-panel-header">
        <h4 data-i18n="lightbox.exif_panel_title">ℹ️ Propriétés du fichier</h4>
        <button id="closeExifPanelBtn" class="lightbox-btn" style="padding:0.2rem 0.5rem;" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div id="exifPanelBody" class="exif-panel-body"></div>
    </div>

    <div class="lightbox-footer">
      <div data-i18n="lightbox.shortcuts_hint">
        Navigation: <kbd>&larr;</kbd> <kbd>&rarr;</kbd> / Swipe | Zoom: <kbd>+</kbd> <kbd>-</kbd> | Drag/Pan: <kbd>Mouse drag</kbd> | Reset: <kbd>0</kbd> / <kbd>R</kbd> | Fullscreen: <kbd>F</kbd> | Exit: <kbd>Esc</kbd>
      </div>
    </div>
  </div>

  <!-- Admin Authentication Modal -->
  <div id="adminModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3 data-i18n="admin.login_title">🔐 Connexion Administrateur</h3>
        <button id="adminModalCloseBtn" class="lightbox-btn" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <div id="adminLoginState">
          <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.9rem;" data-i18n="admin.password_placeholder">
            Saisissez votre mot de passe administrateur pour déverrouiller la gestion.
          </p>
          <form id="adminLoginForm">
            <input type="password" id="adminPasswordInput" class="admin-input" placeholder="Mot de passe administrateur..." data-i18n-placeholder="admin.password_placeholder" required />
            <div id="adminLoginError" class="admin-error-msg" style="display: none;"></div>
            <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;" data-i18n="admin.login_btn">
              Se connecter
            </button>
          </form>
        </div>
        <div id="adminActiveState" style="display: none;">
          <p style="margin-bottom: 1rem; color: var(--text-main); font-weight: 500;" data-i18n="admin.active_notice">
            🛡️ Mode Administrateur activé !
          </p>
          <form id="changePasswordForm" style="margin-bottom: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-main);" data-i18n="admin.change_password">Changer le mot de passe</h4>
            <input type="password" id="newAdminPasswordInput" class="admin-input" placeholder="Nouveau mot de passe..." data-i18n-placeholder="admin.new_password_placeholder" required minlength="4" />
            <button type="submit" class="pill-btn" style="width: 100%; margin-top: 0.5rem; justify-content: center;" data-i18n="admin.save_new_password">
              Mettre à jour
            </button>
            <div id="adminChangePassMsg" class="admin-success-msg" style="display: none; margin-top: 0.5rem;"></div>
          </form>
          <div id="adminPermissionsContainer"></div>
          <button id="adminLogoutBtn" class="pill-btn" style="width: 100%; margin-top: 1rem; justify-content: center; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);" data-i18n="admin.logout_btn">
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Folder Settings Modal (Admin Only) -->
  <div id="folderSettingsModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3 data-i18n="folder_settings.title">📁 Paramètres du Dossier</h3>
        <button id="folderSettingsCloseBtn" class="lightbox-btn" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <form id="folderSettingsForm">
          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_title">Titre personnalisé (.title)</label>
            <input type="text" id="dotfileTitleInput" class="admin-input" placeholder="Titre..." />
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_desc">Description du dossier (.desc)</label>
            <textarea id="dotfileDescInput" class="admin-input" rows="3" placeholder="Description..." style="resize: vertical;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_access">Contrôle d'accès (.private / .password)</label>
            <select id="dotfileAccessModeSelect" class="sort-select" style="width: 100%;">
              <option value="public" data-i18n="folder_settings.access_public">🌐 Public (Visible par tous)</option>
              <option value="private" data-i18n="folder_settings.access_private">👁️‍🗨️ Privé (Admin uniquement)</option>
              <option value="password" data-i18n="folder_settings.access_password">🔒 Protégé par mot de passe</option>
            </select>
          </div>

          <div id="folderPasswordGroup" class="form-group" style="margin-bottom: 1rem; display: none;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.password_label">Mot de passe du dossier</label>
            <input type="password" id="dotfileFolderPasswordInput" class="admin-input" placeholder="Mot de passe..." />
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_bg">Image ou couleur de fond (.bg)</label>
            <input type="text" id="dotfileBgInput" class="admin-input" placeholder="ex: #0f172a ou bg.jpg" />
          </div>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;" data-i18n="folder_settings.dotfile_theme">Thème visuel (.theme)</label>
            <select id="dotfileThemeSelect" class="sort-select" style="width: 100%;">
              <option value="">(Thème par défaut)</option>
              <option value="polaroid-classic">Polaroid Classic</option>
              <option value="dark-glass">Dark Glassmorphism</option>
              <option value="light-minimal">Light Minimal</option>
              <option value="cyberpunk">Cyberpunk</option>
            </select>
          </div>

          <button type="submit" class="pill-btn active" style="width: 100%; justify-content: center;" data-i18n="common.save">
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Media Legend Modal (Admin Only) -->
  <div id="mediaCommentModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3 id="mediaCommentModalTitle" data-i18n="comment.title">💬 Éditer la Légende</h3>
        <button id="mediaCommentCloseBtn" class="lightbox-btn" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <form id="mediaCommentForm">
          <input type="hidden" id="mediaCommentFilename" />
          <div class="form-group" style="margin-bottom: 1rem;">
            <label id="mediaCommentFilenameLabel" style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;"></label>
            <input type="text" id="mediaCommentInput" class="admin-input" placeholder="Écrivez une légende pour ce média..." data-i18n-placeholder="comment.placeholder" />
          </div>
          <button type="submit" class="pill-btn active" style="width: 100%; justify-content: center;" data-i18n="common.save">
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Visitor Folder Password Unlock Modal -->
  <div id="folderUnlockModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3 data-i18n="stats.folder_locked">🔒 Dossier Protégé</h3>
        <button id="folderUnlockCloseBtn" class="lightbox-btn" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.9rem;" data-i18n="stats.folder_locked_desc">
          Ce dossier est protégé par mot de passe. Saisissez le mot de passe pour explorer son contenu.
        </p>
        <form id="folderUnlockForm">
          <input type="hidden" id="folderUnlockPath" />
          <input type="password" id="folderUnlockPasswordInput" class="admin-input" placeholder="Mot de passe du dossier..." data-i18n-placeholder="folder_settings.password_label" required />
          <div id="folderUnlockError" class="admin-error-msg" style="display: none;"></div>
          <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;" data-i18n="stats.folder_unlock_action">
            Déverrouiller le dossier
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Drag & Drop Upload Overlay (Admin Only) -->
  <div id="dropZoneOverlay" class="drop-zone-overlay" style="display: none;">
    <div class="drop-zone-content">
      <div class="drop-zone-icon">📤</div>
      <h3 data-i18n="upload.drag_drop_title">Glissez-déposez vos médias ici</h3>
      <p data-i18n="upload.drag_drop_subtitle">Photos, vidéos, audio, documents (Téléversement administrateur sécurisé)</p>
    </div>
  </div>

  <!-- Upload Progress Modal -->
  <div id="uploadProgressModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content" style="max-width: 480px;">
      <div class="admin-modal-header">
        <h3 data-i18n="upload.progress_title">📤 Téléversement en cours...</h3>
      </div>
      <div class="admin-modal-body">
        <div class="upload-progress-bar-container">
          <div id="uploadProgressBar" class="upload-progress-bar" style="width: 0%;">0%</div>
        </div>
        <p id="uploadProgressStatus" style="font-size:0.85rem;margin-top:0.8rem;color:var(--text-muted);" data-i18n="upload.status_prep">Préparation des fichiers...</p>
        <div id="uploadResultMessages" style="margin-top:1rem;max-height:150px;overflow-y:auto;font-size:0.85rem;display:none;"></div>
      </div>
    </div>
  </div>

  <!-- Create Folder Modal -->
  <div id="createFolderModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content" style="max-width: 420px;">
      <div class="admin-modal-header">
        <h3 data-i18n="create_folder.title">📁 Nouveau Dossier</h3>
        <button id="createFolderCloseBtn" class="lightbox-btn" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <form id="createFolderForm">
          <label for="createFolderNameInput" class="admin-label" data-i18n="create_folder.placeholder">Nom du dossier :</label>
          <input type="text" id="createFolderNameInput" class="admin-input" placeholder="ex: Vacances 2026, Événements..." data-i18n-placeholder="create_folder.placeholder" required />
          <div id="createFolderError" class="admin-error-msg" style="display: none;"></div>
          <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;" data-i18n="create_folder.submit">
            Créer le dossier
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <div id="deleteConfirmModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content" style="max-width: 440px; text-align: center;">
      <div class="admin-modal-header">
        <h3 style="color: #ef4444; width: 100%;" data-i18n="delete_confirm.title">🗑️ Confirmation de suppression</h3>
        <button id="deleteConfirmCloseBtn" class="lightbox-btn" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <p id="deleteConfirmMessage" style="font-size: 0.95rem; margin: 1rem 0; color: var(--text-main); line-height: 1.5;"></p>
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: center;">
          <button id="deleteCancelBtn" class="btn-toggle" style="flex: 1; justify-content: center;" data-i18n="common.cancel">Annuler</button>
          <button id="deleteConfirmActionBtn" class="pill-btn active" style="flex: 1; background: #ef4444; color: white; justify-content: center; font-weight: 700;" data-i18n="common.delete">
            🗑️ Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Floating Picture-in-Picture (PiP) Player Widget -->
  <div id="pip-player-widget" style="display: none;">
    <div id="pipHeader" class="pip-header">
      <span id="pipTitle" class="pip-title" data-i18n="pip.title">Lecture multimédia...</span>
      <div class="pip-controls">
        <button id="pipInfoBtn" class="pip-btn" title="Informations &amp; Propriétés (I)" data-i18n-title="lightbox.metadata_btn">ℹ️</button>
        <button id="pipExpandBtn" class="pip-btn" title="Plein écran (Agrandir)" data-i18n-title="pip.expand">⛶</button>
        <button id="pipMinimizeBtn" class="pip-btn" title="Masquer / Réduire" data-i18n-title="pip.minimize">🗕</button>
        <button id="pipCloseBtn" class="pip-btn" title="Fermer le lecteur" data-i18n-title="pip.close">✕</button>
      </div>
    </div>
    <div id="pipMediaContainer" class="pip-media-content">
      <!-- Dynamically inserted audio or video tag -->
    </div>
    <div id="pipInfoPanel" class="pip-info-panel" style="display: none;">
      <!-- Dynamically filled with media properties -->
    </div>
  </div>

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

  <!-- Admin Image Editor Modal (HTML5 Canvas & Transformations) -->
  <div id="imageEditorModal" class="editor-modal-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="editorModalTitle">
    <div class="editor-modal-card">
      <div class="editor-modal-header">
        <div class="editor-title-group">
          <h3 id="editorModalTitle" class="editor-title" data-i18n="editor.title">🎨 Éditeur d'Image</h3>
          <span id="editorImageNameBadge" class="editor-badge">image.jpg</span>
          <span id="editorImageDimBadge" class="editor-dim-badge">0 × 0 px</span>
        </div>
        <div class="editor-header-actions">
          <button type="button" id="editorResetAllBtn" class="editor-btn-secondary" title="Réinitialiser toutes les modifications" data-i18n-title="editor.reset_all_title" data-i18n="editor.reset_all">
            🔄 Réinitialiser tout
          </button>
          <button type="button" id="editorOpenSaveChoiceBtn" class="editor-btn-primary" title="Sauvegarder les modifications" data-i18n-title="editor.save_title" data-i18n="editor.save_btn">
            💾 Enregistrer l'image
          </button>
          <button type="button" id="imageEditorCloseBtn" class="editor-close-btn" title="Fermer sans enregistrer (Échap)" data-i18n-title="editor.close_title">✕</button>
        </div>
      </div>

      <div class="editor-modal-body">
        <!-- Canvas Workspace Area -->
        <div class="editor-workspace" id="editorWorkspace">
          <div class="editor-canvas-wrapper" id="editorCanvasWrapper">
            <canvas id="editorCanvas" class="editor-canvas"></canvas>
            <!-- Crop Marquee Selection Box Overlay -->
            <div id="editorCropBox" class="editor-crop-box" style="display: none;">
              <div class="crop-handle handle-nw" data-handle="nw"></div>
              <div class="crop-handle handle-ne" data-handle="ne"></div>
              <div class="crop-handle handle-sw" data-handle="sw"></div>
              <div class="crop-handle handle-se" data-handle="se"></div>
              <div class="crop-handle handle-n" data-handle="n"></div>
              <div class="crop-handle handle-s" data-handle="s"></div>
              <div class="crop-handle handle-w" data-handle="w"></div>
              <div class="crop-handle handle-e" data-handle="e"></div>
              <div class="crop-grid-lines"></div>
            </div>
          </div>
        </div>

        <!-- Sidebar / Tools Panel -->
        <div class="editor-sidebar">
          <!-- Tool Tab 1: Recadrage (Crop) -->
          <div class="editor-tool-section">
            <h4 class="editor-section-title" data-i18n="editor.crop_title">✂️ Recadrage (Crop)</h4>
            <div class="crop-ratio-buttons">
              <button type="button" class="crop-ratio-btn active" data-ratio="free" data-i18n="editor.crop_free">Libre</button>
              <button type="button" class="crop-ratio-btn" data-ratio="1:1" data-i18n="editor.crop_square">1:1 (Carré)</button>
              <button type="button" class="crop-ratio-btn" data-ratio="4:3">4:3</button>
              <button type="button" class="crop-ratio-btn" data-ratio="16:9">16:9</button>
              <button type="button" class="crop-ratio-btn" data-ratio="3:2">3:2</button>
            </div>
            <div class="editor-tool-row" style="margin-top: 8px;">
              <button type="button" id="editorToggleCropBtn" class="editor-tool-btn active" title="Activer / Désactiver le cadre de recadrage" data-i18n="editor.crop_toggle">
                ✂️ Activer Recadrage
              </button>
              <button type="button" id="editorApplyCropBtn" class="editor-tool-btn editor-tool-btn-accent" title="Appliquer le recadrage sélectionné" data-i18n="editor.crop_apply">
                ✓ Valider Recadrage
              </button>
            </div>
          </div>

          <!-- Tool Tab 2: Transformations -->
          <div class="editor-tool-section">
            <h4 class="editor-section-title" data-i18n="editor.transform_title">🔄 Rotation &amp; Miroir</h4>
            <div class="editor-tool-grid">
              <button type="button" id="editorRotateCcwBtn" class="editor-tool-btn" title="Rotation 90° Anti-horaire" data-i18n="editor.rotate_left">
                ⟲ 90° Gauche
              </button>
              <button type="button" id="editorRotateCwBtn" class="editor-tool-btn" title="Rotation 90° Horaire" data-i18n="editor.rotate_right">
                ⟳ 90° Droite
              </button>
              <button type="button" id="editorFlipHBtn" class="editor-tool-btn" title="Miroir Horizontal" data-i18n="editor.flip_h">
                ⇄ Miroir H
              </button>
              <button type="button" id="editorFlipVBtn" class="editor-tool-btn" title="Miroir Vertical" data-i18n="editor.flip_v">
                ⇅ Miroir V
              </button>
            </div>
          </div>

          <!-- Tool Tab 3: Ajustements de Couleur -->
          <div class="editor-tool-section">
            <h4 class="editor-section-title" data-i18n="editor.adjustments_title">☀️ Réglages &amp; Lumière</h4>
            <div class="editor-slider-group">
              <div class="editor-slider-header">
                <label for="editorBrightnessSlider" data-i18n="editor.brightness">Luminosité</label>
                <span id="editorBrightnessVal" class="slider-val">0%</span>
              </div>
              <input type="range" id="editorBrightnessSlider" min="-100" max="100" value="0" class="editor-slider">
            </div>

            <div class="editor-slider-group">
              <div class="editor-slider-header">
                <label for="editorContrastSlider" data-i18n="editor.contrast">Contraste</label>
                <span id="editorContrastVal" class="slider-val">0%</span>
              </div>
              <input type="range" id="editorContrastSlider" min="-100" max="100" value="0" class="editor-slider">
            </div>

            <div class="editor-slider-group">
              <div class="editor-slider-header">
                <label for="editorSaturationSlider" data-i18n="editor.saturation">Saturation</label>
                <span id="editorSaturationVal" class="slider-val">0%</span>
              </div>
              <input type="range" id="editorSaturationSlider" min="-100" max="100" value="0" class="editor-slider">
            </div>
          </div>

          <!-- Tool Tab 4: Filtres Rapides -->
          <div class="editor-tool-section">
            <h4 class="editor-section-title" data-i18n="editor.filters_title">🎭 Filtres</h4>
            <div class="editor-filter-pills">
              <button type="button" class="editor-filter-btn active" data-filter="none" data-i18n="editor.filter_normal">Normal</button>
              <button type="button" class="editor-filter-btn" data-filter="grayscale" data-i18n="editor.filter_grayscale">Noir &amp; Blanc</button>
              <button type="button" class="editor-filter-btn" data-filter="sepia" data-i18n="editor.filter_sepia">Sépia</button>
              <button type="button" class="editor-filter-btn" data-filter="warm" data-i18n="editor.filter_warm">Chaud / Vintage</button>
              <button type="button" class="editor-filter-btn" data-filter="invert" data-i18n="editor.filter_invert">Inversé</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Save Image Mode Choice Modal (Overwrite vs Copy) -->
  <div id="imageSaveChoiceModal" class="admin-modal" role="dialog" aria-modal="true" style="display: none;">
    <div class="admin-modal-content" style="max-width: 480px;">
      <div class="admin-modal-header">
        <h3 data-i18n="save_choice.title">💾 Enregistrer les Modifications</h3>
        <button type="button" id="saveChoiceCloseBtn" class="lightbox-btn" title="Fermer" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <p style="color: var(--text-main); font-size: 0.9rem; margin-bottom: 1.25rem;" data-i18n="save_choice.subtitle">
          Comment souhaitez-vous enregistrer cette image modifiée ?
        </p>

        <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.5rem;">
          <label class="save-choice-card">
            <input type="radio" name="saveImageModeRadio" value="copy" checked class="save-choice-radio">
            <div class="save-choice-text">
              <strong data-i18n="save_choice.copy_title">✨ Créer une nouvelle copie (Recommandé)</strong>
              <span data-i18n="save_choice.copy_desc">Enregistre l'image éditée sous un nouveau nom et préserve l'original.</span>
            </div>
          </label>

          <label class="save-choice-card">
            <input type="radio" name="saveImageModeRadio" value="overwrite" class="save-choice-radio">
            <div class="save-choice-text">
              <strong data-i18n="save_choice.overwrite_title">⚠️ Remplacer le fichier original</strong>
              <span data-i18n="save_choice.overwrite_desc">Écrase directement le fichier source sur le serveur et régénère immédiatement sa miniature.</span>
            </div>
          </label>
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" id="saveChoiceCancelBtn" class="pill-btn" style="justify-content: center;" data-i18n="common.cancel">
            Annuler
          </button>
          <button type="button" id="saveChoiceConfirmBtn" class="pill-btn active" style="justify-content: center;" data-i18n="save_choice.confirm">
            ✓ Confirmer l'enregistrement
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- App Footer -->
  <footer class="app-footer">
    <div class="footer-container">
      <div class="footer-info">
        <a href="https://github.com/oktailb/SimpleGallery" target="_blank" rel="noopener noreferrer" class="footer-github-link" title="SimpleGallery on GitHub">
          📸 <strong><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></strong>
        </a>
        <span class="footer-separator">•</span>
        <span class="footer-tech">PHP &amp; Vanilla JS</span>
      </div>
      <div class="footer-links">
        <button type="button" id="openCookieSettingsBtn" class="footer-link-btn" title="Gérer vos préférences de confidentialité et cookies" data-i18n-title="cookie.footer_link" data-i18n="cookie.footer_link">
          🍪 Préférences Cookies
        </button>
      </div>
    </div>
  </footer>

  <!-- RGPD / ePrivacy Cookie Consent Floating Toast Banner -->
  <div id="cookieConsentBanner" class="cookie-banner" role="region" aria-label="Gestion des cookies et confidentialité" style="display: none;">
    <div class="cookie-banner-content">
      <div class="cookie-banner-text">
        <div class="cookie-banner-icon">🍪</div>
        <div>
          <h4 class="cookie-banner-title" data-i18n="cookie.banner_title">Respect de votre vie privée</h4>
          <p class="cookie-banner-desc" data-i18n="cookie.banner_desc">
            SimpleGallery utilise uniquement des cookies essentiels et le stockage local pour vos préférences. Zéro traceur publicitaire.
          </p>
        </div>
      </div>
      <div class="cookie-banner-actions">
        <button type="button" id="cookieAcceptAllBtn" class="cookie-btn cookie-btn-primary" data-i18n="cookie.accept_all">
          ✓ Tout accepter
        </button>
        <button type="button" id="cookieRejectNonEssentialBtn" class="cookie-btn cookie-btn-secondary" data-i18n="cookie.reject_non_essential">
          Essentiels uniquement
        </button>
        <button type="button" id="cookieCustomizeBtn" class="cookie-btn cookie-btn-ghost" data-i18n="cookie.customize">
          ⚙️ Personnaliser
        </button>
      </div>
    </div>
  </div>

  <!-- Detailed Cookie Settings Modal -->
  <div id="cookieSettingsModal" class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="cookieModalTitle" style="display: none;">
    <div class="admin-modal-content cookie-modal-card">
      <div class="admin-modal-header">
        <h3 id="cookieModalTitle" data-i18n="cookie.modal_title">🍪 Gestion des Préférences &amp; Cookies</h3>
        <button type="button" id="cookieSettingsCloseBtn" class="lightbox-btn" title="Fermer (Échap)" data-i18n-title="common.close">✕</button>
      </div>
      <div class="admin-modal-body">
        <p class="cookie-modal-intro" data-i18n="cookie.modal_desc">
          Personnalisez ci-dessous vos choix en matière de cookies et stockage local.
        </p>

        <div class="cookie-options-list">
          <!-- Option 1: Strictly Necessary -->
          <div class="cookie-option-card">
            <div class="cookie-option-info">
              <div class="cookie-option-title-row">
                <span class="cookie-option-name" data-i18n="cookie.opt_necessary_title">1. Cookies Strictement Nécessaires</span>
                <span class="cookie-badge cookie-badge-required" data-i18n="cookie.opt_necessary_badge">Toujours actif</span>
              </div>
              <p class="cookie-option-desc" data-i18n="cookie.opt_necessary_desc">
                Indispensables au fonctionnement sécurisé de la galerie : maintien de la session d'administration, protection contre les attaques CSRF et accès aux dossiers protégés par mot de passe.
              </p>
            </div>
            <div class="cookie-toggle-wrap">
              <input type="checkbox" id="cookieOptNecessary" checked disabled aria-label="Cookies strictement nécessaires">
            </div>
          </div>

          <!-- Option 2: Local Preferences & Favorites -->
          <div class="cookie-option-card">
            <div class="cookie-option-info">
              <div class="cookie-option-title-row">
                <span class="cookie-option-name" data-i18n="cookie.opt_pref_title">2. Préférences d'Affichage &amp; Favoris</span>
                <span class="cookie-badge cookie-badge-optional" data-i18n="cookie.opt_pref_badge">Optionnel</span>
              </div>
              <p class="cookie-option-desc" data-i18n="cookie.opt_pref_desc">
                Permet à votre navigateur d'enregistrer localement vos favoris ❤️ et votre mode de vue préféré.
              </p>
            </div>
            <div class="cookie-toggle-wrap">
              <input type="checkbox" id="cookieOptPreferences" checked aria-label="Préférences d'affichage et favoris">
            </div>
          </div>

          <!-- Option 3: External CDN Resources -->
          <div class="cookie-option-card">
            <div class="cookie-option-info">
              <div class="cookie-option-title-row">
                <span class="cookie-option-name" data-i18n="cookie.opt_cdn_title">3. Typographies &amp; Cartographie (CDN)</span>
                <span class="cookie-badge cookie-badge-optional" data-i18n="cookie.opt_cdn_badge">Optionnel</span>
              </div>
              <p class="cookie-option-desc" data-i18n="cookie.opt_cdn_desc">
                Chargement des polices stylisées Google Fonts et des cartes interactives OpenStreetMap / Leaflet sans pistage publicitaire.
              </p>
            </div>
            <div class="cookie-toggle-wrap">
              <input type="checkbox" id="cookieOptCdn" checked aria-label="Ressources externes CDN">
            </div>
          </div>
        </div>

        <div class="cookie-modal-actions">
          <button type="button" id="cookieSavePreferencesBtn" class="cookie-btn cookie-btn-primary" style="width: 100%; justify-content: center;" data-i18n="cookie.save_preferences">
            Enregistrer mes choix
          </button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
