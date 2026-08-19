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
  
  <link rel="stylesheet" href="themes/base.css?v=<?php echo filemtime(__DIR__ . '/themes/base.css'); ?>">
  <link rel="stylesheet" id="activeThemeStylesheet" href="themes/<?php echo htmlspecialchars($theme_preset, ENT_QUOTES, 'UTF-8'); ?>/theme.css?v=<?php echo file_exists(__DIR__ . '/themes/' . $theme_preset . '/theme.css') ? filemtime(__DIR__ . '/themes/' . $theme_preset . '/theme.css') : '1'; ?>">
  <link rel="stylesheet" href="css/gallery.css?v=<?php echo filemtime(__DIR__ . '/css/gallery.css'); ?>">
  <link rel="stylesheet" href="css/window-manager.css?v=<?php echo file_exists(__DIR__ . '/css/window-manager.css') ? filemtime(__DIR__ . '/css/window-manager.css') : '1'; ?>">

  <!-- Leaflet & MarkerCluster for Interactive Maps (100% Free, Zero API Key) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>

  <!-- Userland System Runtime (Core OS Bus, WindowManager, MenuBar, Registries, Syscalls, AppManager, I18n) -->
  <script src="system/userland/core/EventBus.js" defer></script>
  <script src="system/userland/core/SyscallClient.js" defer></script>
  <script src="system/userland/core/MenuBarManager.js" defer></script>
  <script src="system/userland/core/WindowManager.js" defer></script>
  <script src="system/userland/core/GalleryViewRegistry.js" defer></script>
  <script src="system/userland/core/MediaViewerRegistry.js" defer></script>
  <script src="system/userland/core/AppManager.js" defer></script>
  <script src="system/userland/i18n/I18nEngine.js" defer></script>

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

  <?php
  use SimpleGallery\Kernel\PluginDiscovery;
  $discovered_apps = PluginDiscovery::getDiscoveredApps(__DIR__);
  ?>

  <!-- Auto-Discovered Modular Applications (apps/<name>/manifest.json) -->
  <?php foreach ($discovered_apps as $app_info): ?>
    <?php if (!empty($app_info['css_entry'])): ?>
      <link rel="stylesheet" href="<?php echo htmlspecialchars($app_info['css_entry'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo filemtime(__DIR__ . '/' . $app_info['css_entry']); ?>">
    <?php endif; ?>
    <?php if (!empty($app_info['js_entry'])): ?>
      <script src="<?php echo htmlspecialchars($app_info['js_entry'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo filemtime(__DIR__ . '/' . $app_info['js_entry']); ?>" defer></script>
    <?php endif; ?>
  <?php endforeach; ?>

  <!-- Core Client Application -->
  <script src="js/gallery.js?v=<?php echo filemtime(__DIR__ . '/js/gallery.js'); ?>" defer></script>

</head>
<body>

  <!-- WebOS Top System & Application Bar (macOS Style) -->
  <header class="app-header">
    <div class="header-container">
      <!-- 1. OS Brand Section (Apple-menu style) -->
      <div class="brand-section">
        <div class="brand-logo">📸</div>
        <h1 class="brand-title"><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></h1>
      </div>

      <!-- 2. Dynamic Contextual Application Zone (Colonized by Active App via MenuBarManager) -->
      <div id="appHeaderZone" class="app-header-zone"></div>

      <!-- 3. OS System Tray (Universal Settings, Language, Admin) -->
      <div class="system-tray-section">
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
  </header>

  <!-- WebOS Desktop & Workspace Container -->
  <div id="webosDesktop" class="webos-desktop">

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

    <?php if (!empty($storage_status['is_fallback'])): ?>
      <!-- Storage Diagnostic Warning Banner -->
      <div id="storageDiagnosticBanner" class="storage-diagnostic-banner" style="margin-bottom: 1.5rem; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 1rem 1.25rem; color: #fbbf24; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;">
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
        <button type="button" onclick="document.getElementById('storageDiagnosticBanner').style.display='none';" style="background: none; border: none; color: #fef08a; font-size: 1.2rem; cursor: pointer; padding: 0.2rem 0.5rem;" title="Fermer">✕</button>
      </div>
    <?php endif; ?>

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
      <div style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-muted); opacity: 0.85;">
        📁 Emplacement exploré : <code><?php echo htmlspecialchars($storage_status['active_path'], ENT_QUOTES, 'UTF-8'); ?></code>
      </div>
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

      <!-- Generic Application Actions Container (Populated by active App Viewer) -->
      <div class="lightbox-actions">
        <div id="lightboxAppActions" class="lightbox-app-actions" style="display: flex; gap: 0.4rem;"></div>
        <button id="lightboxExifBtn" class="lightbox-btn" title="Détails EXIF (I)" data-i18n-title="lightbox.exif" style="display: none;">
          ℹ️
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

  <!-- Auto-Discovered Modular Application UI Templates & Modals (apps/<name>/template.php) -->
  <?php foreach ($discovered_apps as $app_info): ?>
    <?php if (!empty($app_info['template_entry']) && file_exists(__DIR__ . '/' . $app_info['template_entry'])): ?>
      <?php include __DIR__ . '/' . $app_info['template_entry']; ?>
    <?php endif; ?>
  <?php endforeach; ?>

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

  </div><!-- /#webosDesktop -->

  <!-- WebOS Bottom Dock & Taskbar -->
  <div id="webosTaskbar" class="webos-taskbar"></div>
</body>
</html>
