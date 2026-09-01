<?php
require_once __DIR__ . '/system/boot/bootstrap.php';
require_once __DIR__ . '/system/kernel/functions.php';

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
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🖼️</text></svg>">
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
  <link rel="stylesheet" href="system/userland/ui/styles/toolkit.css?v=<?php echo file_exists(__DIR__ . '/system/userland/ui/styles/toolkit.css') ? filemtime(__DIR__ . '/system/userland/ui/styles/toolkit.css') : '1'; ?>">

  <!-- Leaflet & MarkerCluster for Interactive Maps (100% Free, Zero API Key) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>

  <!-- Userland System Runtime (Core OS Bus, WindowManager, MenuBar, Registries, Syscalls, AppManager, I18n, WebOSToolkit) -->
  <script src="system/userland/core/IconHelper.js" defer></script>
  <script src="system/userland/core/EventBus.js" defer></script>
  <script src="system/userland/core/SyscallClient.js" defer></script>
  <script src="system/userland/core/MenuBarManager.js" defer></script>
  <script src="system/userland/core/WindowManager.js" defer></script>
  <script src="system/userland/core/GalleryViewRegistry.js" defer></script>
  <script src="system/userland/core/MediaViewerRegistry.js" defer></script>
  <script src="system/userland/core/AppManager.js" defer></script>
  <script src="system/userland/i18n/I18nEngine.js" defer></script>
  <script src="system/userland/theme/ThemeEngine.js" defer></script>
  <script src="system/userland/ui/WebOSToolkit.js" defer></script>
  <script src="system/userland/services/WebOSServices.js" defer></script>
  <script src="system/userland/services/ClipboardService.js" defer></script>
  <script src="system/userland/core/ShortcutManager.js" defer></script>
  <script src="system/userland/services/FilePickerService.js" defer></script>
  <script src="system/userland/desktop/WallpaperManager.js" defer></script>
  <script src="system/userland/desktop/TaskbarClock.js" defer></script>
  <script src="system/userland/desktop/DesktopShortcuts.js" defer></script>
  <script src="system/userland/core/WebOSApp.js" defer></script>


  <script src="system/userland/ui/MetadataInspector.js" defer></script>

  <!-- Synchronous theme restore and initial disabled apps payload -->
  <script>
    (function() {
      try {
        var t = localStorage.getItem('sg_active_theme') || (document.cookie.match(/(?:^|;\s*)sg_theme=([^;]+)/) || [])[1];
        if (t) {
          document.documentElement.setAttribute('data-theme', t);
        }
      } catch(e) {}
    })();
    window.SG_DISABLED_APPS = <?php echo json_encode(\SimpleGallery\Kernel\PluginDiscovery::getDisabledAppIds(__DIR__)); ?>;
  </script>

  <!-- Dynamic Theme Injection from config/themes.php -->
  <style id="dynamic-theme-vars">
    :root, :root[data-theme="<?php echo $theme_preset; ?>"], body[data-theme="<?php echo $theme_preset; ?>"] {
      --bg-main: <?php echo $active_theme['bg_main']; ?>;
      --window-bg: <?php echo $active_theme['window_bg'] ?? $active_theme['bg_main']; ?>;
      --header-bg: <?php echo $active_theme['header_bg'] ?? $active_theme['card_bg']; ?>;
      --menu-bar-bg: <?php echo $active_theme['menu_bar_bg'] ?? $active_theme['bg_main']; ?>;
      --sidebar-bg: <?php echo $active_theme['sidebar_bg'] ?? 'rgba(0, 0, 0, 0.25)'; ?>;
      --polaroid-bg: <?php echo $active_theme['polaroid_bg']; ?>;
      --polaroid-text: <?php echo $active_theme['polaroid_text']; ?>;
      --polaroid-sub: <?php echo $active_theme['polaroid_sub']; ?>;
      --accent-primary: <?php echo $active_theme['accent']; ?>;
      --accent: <?php echo $active_theme['accent']; ?>;
      --bg-card: <?php echo $active_theme['card_bg']; ?>;
      --card-bg: <?php echo $active_theme['card_bg']; ?>;
      --border-color: <?php echo $active_theme['border_color'] ?? 'rgba(255, 255, 255, 0.08)'; ?>;
      --border-color-hover: <?php echo $active_theme['border_color_hover'] ?? 'rgba(99, 102, 241, 0.4)'; ?>;
      --text-main: <?php echo $active_theme['text_main']; ?>;
      --text-muted: <?php echo $active_theme['text_muted']; ?>;
    }
  </style>

  <?php
  use SimpleGallery\Kernel\PluginDiscovery;
  $discovered_apps = PluginDiscovery::getDiscoveredApps(__DIR__, false);
  $all_apps_manifests = PluginDiscovery::getDiscoveredApps(__DIR__, true);
  $discovered_views = PluginDiscovery::getDiscoveredViews(__DIR__);
  $discovered_wm_styles = PluginDiscovery::getDiscoveredWindowStyles(__DIR__);
  ?>
  <script>
    window.SG_DISCOVERED_APPS = <?php echo json_encode($all_apps_manifests); ?>;
    window.SG_DISCOVERED_WM_STYLES = <?php echo json_encode($discovered_wm_styles); ?>;
  </script>

  <!-- Auto-Discovered Explorer Views (apps/explorer/views/<name>/manifest.json) -->
  <?php foreach ($discovered_views as $view_info): ?>
    <?php if (!empty($view_info['css_entry'])): ?>
      <link rel="stylesheet" href="<?php echo htmlspecialchars($view_info['css_entry'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo filemtime(__DIR__ . '/' . $view_info['css_entry']); ?>">
    <?php endif; ?>
    <?php if (!empty($view_info['js_entry'])): ?>
      <script src="<?php echo htmlspecialchars($view_info['js_entry'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo filemtime(__DIR__ . '/' . $view_info['js_entry']); ?>" defer></script>
    <?php endif; ?>
  <?php endforeach; ?>

  <!-- Auto-Discovered Window Manager Skins (wm-styles/<name>/style.json) -->
  <?php foreach ($discovered_wm_styles as $style_info): ?>
    <?php if (!empty($style_info['css_entry'])): ?>
      <link rel="stylesheet" href="<?php echo htmlspecialchars($style_info['css_entry'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo filemtime(__DIR__ . '/' . $style_info['css_entry']); ?>">
    <?php endif; ?>
  <?php endforeach; ?>

  <!-- Auto-Discovered Modular Applications (apps/<name>/manifest.json) -->
  <?php foreach ($discovered_apps as $app_info): ?>
    <?php if (!empty($app_info['css_entry'])): ?>
      <link rel="stylesheet" href="<?php echo htmlspecialchars($app_info['css_entry'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo filemtime(__DIR__ . '/' . $app_info['css_entry']); ?>">
    <?php endif; ?>
    <?php if (!empty($app_info['js_entry'])): ?>
      <script src="<?php echo htmlspecialchars($app_info['js_entry'], ENT_QUOTES, 'UTF-8'); ?>?v=<?php echo filemtime(__DIR__ . '/' . $app_info['js_entry']); ?>" defer></script>
    <?php endif; ?>
  <?php endforeach; ?>

  <?php
  $desktop_config_file = __DIR__ . '/config/desktop.json';
  $desktop_config = ['shortcuts' => []];
  if (file_exists($desktop_config_file)) {
      $parsed_desktop = json_decode((string)file_get_contents($desktop_config_file), true);
      if (is_array($parsed_desktop)) {
          $desktop_config = $parsed_desktop;
      }
  }
  ?>
  <script>
    window.SG_DISCOVERED_APPS = <?php echo json_encode($discovered_apps, JSON_HEX_TAG | JSON_HEX_AMP); ?>;
    window.SG_I18N_CONFIG = <?php echo json_encode([
      'locales'      => $available_locales,
      'default'      => $default_locale,
      'translations' => $initial_translations
    ], JSON_HEX_TAG | JSON_HEX_AMP); ?>;
    window.SG_DESKTOP_CONFIG = <?php echo json_encode($desktop_config, JSON_HEX_TAG | JSON_HEX_AMP); ?>;
    window.SG_AUTOSTART_CONFIG = <?php echo json_encode(get_autostart_config(__DIR__), JSON_HEX_TAG | JSON_HEX_AMP); ?>;
    window.CSRF_TOKEN = <?php echo json_encode(get_csrf_token()); ?>;
    window.SG_CSRF_TOKEN = window.CSRF_TOKEN;
    window.IS_ADMIN = <?php echo is_admin_logged_in() ? 'true' : 'false'; ?>;
  </script>

  <!-- WebOS Desktop Host Environment -->
  <script src="js/desktop.js?v=<?php echo filemtime(__DIR__ . '/js/desktop.js'); ?>" defer></script>

</head>
<body data-theme="<?php echo htmlspecialchars($theme_preset, ENT_QUOTES, 'UTF-8'); ?>">

  <!-- WebOS Top System & Application Bar (macOS Style) -->
  <header class="app-header">
    <div class="header-container">
      <!-- 1. OS Brand Section (Apple-menu style Application Launcher) -->
      <div class="brand-section" id="brandSection">
        <button type="button" id="appLauncherBtn" class="app-launcher-btn" title="Menu des Applications WebOS" data-i18n-title="nav.apps_menu">
          <span class="brand-logo">📸</span>
          <h1 class="brand-title"><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></h1>
          <span class="brand-arrow">▾</span>
        </button>
        <div id="appLauncherMenu" class="app-launcher-menu" style="display: none;">
          <div class="app-launcher-header">
            <span class="app-launcher-title" data-i18n="nav.apps_menu">Applications</span>
          </div>
          <div id="appLauncherList" class="app-launcher-list"></div>
        </div>
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

    <!-- Permanent Desktop Surface & Shortcuts Grid (Non-closable WebOS Base Layer) -->
    <div id="desktopSurface" class="desktop-surface">
      <div id="desktopShortcuts" class="desktop-shortcuts-grid"></div>
    </div>

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

  </div><!-- /#webosDesktop -->

  <!-- WebOS Integrated Bottom Taskbar & Footer -->
  <footer id="webosTaskbar" class="webos-taskbar app-footer">
    <!-- Left: Brand info & Cookie Settings -->
    <div class="taskbar-left-zone">
      <a href="https://github.com/oktailb/SimpleGallery" target="_blank" rel="noopener noreferrer" class="taskbar-brand-link" title="SimpleGallery on GitHub">
        📸 <strong><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></strong>
      </a>
      <span class="taskbar-tech">PHP &amp; JS</span>
      <span class="taskbar-separator">•</span>
      <button type="button" id="openCookieSettingsBtn" class="taskbar-cookie-btn" title="Gérer vos préférences de confidentialité et cookies" data-i18n-title="cookie.footer_link" data-i18n="cookie.footer_link">
        🍪 Cookies
      </button>
      <div id="cookieConsentBanner" style="display:none;"></div>
    </div>

    <!-- Center: Running Applications & Pinned Apps -->
    <div class="taskbar-apps-container" id="taskbarAppsContainer"></div>

    <!-- Right: System Tray (Telemetry, Clock, Show Desktop) -->
    <div class="taskbar-tray-container" id="taskbarTrayContainer">
      <button type="button" class="taskbar-tray-btn" id="taskbarSysmonBtn" title="Moniteur Système (Télémétrie)">
        <span class="taskbar-tray-icon">📊</span>
        <span id="taskbarFpsPill" class="taskbar-tray-pill">60 FPS</span>
      </button>

      <button type="button" class="taskbar-clock-btn" id="taskbarCalendarBtn" title="Calendrier &amp; Horloge">
        <span id="taskbarClockTime" class="taskbar-clock-time">--:--</span>
        <span id="taskbarClockDate" class="taskbar-clock-date">--/--</span>
      </button>

      <button type="button" class="taskbar-show-desktop" id="taskbarShowDesktopBtn" title="Afficher le Bureau"></button>
    </div>
  </footer>

  <!-- Floating Hover Preview Card (Window Peeking) -->
  <div id="taskbarPreviewCard" class="taskbar-preview-card" style="display: none;"></div>

  <!-- Mini Calendar Popover -->
  <div id="taskbarCalendarPopover" class="taskbar-calendar-popover" style="display: none;"></div>
</body>
</html>
