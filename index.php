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
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?php echo get_csrf_token(); ?>">
  <meta name="description" content="SimpleGallery 2026 - Ultra-fast zero-dependency modern PHP web gallery">
  <title><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></title>

  <!-- Google Fonts: Inter, Outfit, and Caveat for Polaroid handwriting -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="css/gallery.css?v=<?php echo filemtime(__DIR__ . '/css/gallery.css'); ?>">

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
            <input type="text" id="searchInput" class="search-input" placeholder="Rechercher des médias..." aria-label="Rechercher des médias">
            <button type="button" id="advancedSearchBtn" class="search-filter-btn" title="Options de recherche avancée" onclick="if(window.galleryApp) window.galleryApp.openSearchModal();">
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
              <option value="name">Sort by Name</option>
              <option value="exif_date">Sort by Date EXIF 📷</option>
              <option value="date">Sort by File Date</option>
              <option value="size">Sort by Size</option>
            </select>
            <button id="sortOrderBtn" class="btn-toggle" title="Toggle Ascending / Descending Order">
              <span id="sortOrderIcon" style="font-size: 1.1rem; font-weight: bold;">⇩</span>
            </button>
          </div>

          <button id="toggleFavoritesBtn" class="btn-toggle" title="Afficher uniquement mes favoris">
            <span>❤️</span><span id="favCountBadge" class="polaroid-badge" style="display:none; margin-left:4px;">0</span>
          </button>

          <div class="archive-dropdown-container">
            <button id="downloadArchiveBtn" class="btn-toggle" title="Télécharger le dossier sous forme d'archive">
              <span>⇲</span> ▾
            </button>
            <div id="archiveMenu" class="archive-dropdown-menu">
              <!-- Dynamically populated by JS based on server binary availability -->
            </div>
          </div>

          <div class="control-btn-group">
            <button id="viewPolaroidBtn" class="btn-toggle active" title="Polaroid View">
              <span>🖼️</span> Polaroid
            </button>
            <button id="viewGridBtn" class="btn-toggle" title="Grid View">
              <span>🔲</span> Grid
            </button>
          </div>

          <button id="createFolderBtn" class="btn-toggle" title="Créer un nouveau sous-dossier" style="display: none;">
            <span>📁+</span>
          </button>

          <button id="uploadMediaBtn" class="btn-toggle" title="Upload Media (Drag & Drop)" style="display: none;">
            <span>📤</span>
          </button>
          <input type="file" id="uploadFileInput" multiple style="display: none;" />

          <button id="folderSettingsBtn" class="btn-toggle" title="Customize Folder (.title, .desc, .bg, .theme)" style="display: none;">
            <span>🎨</span> Folder Settings
          </button>

          <button id="adminBtn" class="btn-toggle" title="Admin Mode">
            <span id="adminBtnIcon">🔑</span> <span id="adminBtnText">Admin</span>
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
      <button class="pill-btn active" data-category="all">All Media</button>
      <button class="pill-btn" data-category="image">Photos</button>
      <button class="pill-btn" data-category="video">Videos</button>
      <button class="pill-btn" data-category="audio">Audio</button>
      <button class="pill-btn" data-category="doc">Documents</button>
      <button class="pill-btn" data-category="archive">Archives</button>
    </div>

    <div id="galleryStats" class="gallery-stats">Loading...</div>
    <a id="folderMapBtn" href="#" target="_blank" class="folder-map-btn" style="display: none;" title="Ouvrir le trajet/parcours GPS complet du dossier dans Google Maps">
      🗺️ Trajet GPS
    </a>
  </div>

  <!-- Main Workspace -->
  <main class="gallery-container">
    <!-- Subfolders Section -->
    <section id="folderSection" style="display: none;">
      <h2 class="section-title">📂 Subdirectories</h2>
      <div id="foldersGrid" class="folders-grid"></div>
    </section>

    <!-- Media Section -->
    <section id="mediaSection">
      <div id="mediaGrid" class="polaroid-grid"></div>
    </section>

    <!-- Loading State -->
    <div id="loadingState" class="loading-spinner">
      <div class="spinner"></div>
      <p>Indexing folder media...</p>
    </div>

    <!-- Empty State -->
    <div id="emptyState" class="empty-state" style="display: none;">
      <div class="empty-state-icon">📂</div>
      <h3>No media files found</h3>
      <p>Copy photos, videos, or audio into this folder to get started!</p>
    </div>
  </main>

  <!-- Lightbox Modal -->
  <div id="lightbox" class="lightbox-modal" role="dialog" aria-hidden="true">
    <div class="lightbox-header">
      <div>
        <div id="lightboxTitle" class="lightbox-title">Media Preview</div>
        <div id="lightboxMeta" style="font-size:0.8rem;color:var(--text-muted);"></div>
        <div id="lightboxComment" class="lightbox-comment" style="display:none;"></div>
      </div>

      <!-- Image Explorer Controls (Zoom, Rotate, Download, Close) -->
      <div class="lightbox-actions">
        <div id="imageExplorerControls" class="image-explorer-controls" style="display: flex; gap: 0.4rem;">
          <button id="lightboxZoomInBtn" class="lightbox-btn" title="Zoom In (+)">➕</button>
          <button id="lightboxZoomOutBtn" class="lightbox-btn" title="Zoom Out (-)">➖</button>
          <button id="lightboxResetZoomBtn" class="lightbox-btn" title="Reset Zoom (0)">🔄</button>
          <button id="lightboxRotateBtn" class="lightbox-btn" title="Rotate 90° (R)">⟳</button>
          <span id="zoomBadge" class="zoom-badge">100%</span>
        </div>

        <button id="lightboxExifBtn" class="lightbox-btn" title="Toggle EXIF Details (I)" style="display: none;">
          ℹ️ EXIF
        </button>
        <button id="lightboxEditCommentBtn" class="lightbox-btn" title="Edit Legend (.comment)" style="display: none;">
          ✏️
        </button>
        <button id="lightboxDeleteBtn" class="lightbox-btn" title="Delete Media (Admin Only)" style="display: none; color: #f87171;">
          🗑️
        </button>
        <button id="lightboxFavBtn" class="lightbox-btn" title="Ajouter aux favoris">
          🤍
        </button>
        <button id="lightboxFullscreenBtn" class="lightbox-btn" title="Toggle Fullscreen (F)">
          ⛶
        </button>
        <a id="lightboxDownloadBtn" href="#" class="lightbox-btn" title="Download Media" download>
          ⬇️
        </a>
        <button id="lightboxCloseBtn" class="lightbox-btn" title="Close (Esc)">
          ✕
        </button>
      </div>
    </div>

    <div class="lightbox-body">
      <button id="lightboxPrevBtn" class="lightbox-nav-btn lightbox-nav-prev" title="Previous (&larr;)">
        &lsaquo;
      </button>

      <div id="lightboxContent" class="lightbox-content-wrapper"></div>

      <button id="lightboxNextBtn" class="lightbox-nav-btn lightbox-nav-next" title="Next (&rarr;)">
        &rsaquo;
      </button>
    </div>

    <!-- Lightbox EXIF Drawer Panel -->
    <div id="lightboxExifPanel" class="lightbox-exif-panel" style="display: none;">
      <div class="exif-panel-header">
        <h4>📷 EXIF Metadata</h4>
        <button id="closeExifPanelBtn" class="lightbox-btn" style="padding:0.2rem 0.5rem;">✕</button>
      </div>
      <div id="exifPanelBody" class="exif-panel-body"></div>
    </div>

    <div class="lightbox-footer">
      <div>
        Navigation: <kbd>&larr;</kbd> <kbd>&rarr;</kbd> / Swipe | Zoom: <kbd>+</kbd> <kbd>-</kbd> | Drag/Pan: <kbd>Mouse drag</kbd> | Reset: <kbd>0</kbd> / <kbd>R</kbd> | Fullscreen: <kbd>F</kbd> | Exit: <kbd>Esc</kbd>
      </div>
    </div>
  </div>

  <!-- Admin Authentication Modal -->
  <div id="adminModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3>🔐 Admin Mode</h3>
        <button id="adminModalCloseBtn" class="lightbox-btn" title="Close">✕</button>
      </div>
      <div class="admin-modal-body">
        <div id="adminLoginState">
          <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.9rem;">
            Enter your admin password to unlock management features.
          </p>
          <form id="adminLoginForm">
            <input type="password" id="adminPasswordInput" class="admin-input" placeholder="Admin password..." required />
            <div id="adminLoginError" class="admin-error-msg" style="display: none;"></div>
            <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;">
              Log In
            </button>
          </form>
        </div>
        <div id="adminActiveState" style="display: none;">
          <p style="margin-bottom: 1rem; color: var(--text-main); font-weight: 500;">
            🛡️ Admin mode is currently active!
          </p>
          <form id="changePasswordForm" style="margin-bottom: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-main);">Change Admin Password</h4>
            <input type="password" id="newAdminPasswordInput" class="admin-input" placeholder="New password..." required minlength="4" />
            <button type="submit" class="pill-btn" style="width: 100%; margin-top: 0.5rem; justify-content: center;">
              Update Password
            </button>
            <div id="adminChangePassMsg" class="admin-success-msg" style="display: none; margin-top: 0.5rem;"></div>
          </form>
          <div id="adminPermissionsContainer"></div>
          <button id="adminLogoutBtn" class="pill-btn" style="width: 100%; margin-top: 1rem; justify-content: center; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);">
            Log Out Admin Mode
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Folder Settings Modal (Admin Only) -->
  <div id="folderSettingsModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3>📁 Customize Folder Dotfiles</h3>
        <button id="folderSettingsCloseBtn" class="lightbox-btn" title="Close">✕</button>
      </div>
      <div class="admin-modal-body">
        <form id="folderSettingsForm">
          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">Folder Display Title (.title)</label>
            <input type="text" id="dotfileTitleInput" class="admin-input" placeholder="Custom folder name..." />
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">Folder Description Banner (.desc)</label>
            <textarea id="dotfileDescInput" class="admin-input" rows="3" placeholder="Folder description or banner text..." style="resize: vertical;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">Access Control (.private / .password)</label>
            <select id="dotfileAccessModeSelect" class="sort-select" style="width: 100%;">
              <option value="public">🌐 Public (Visible to everyone)</option>
              <option value="private">👁️‍🗨️ Hidden / Admin Only (.private)</option>
              <option value="password">🔒 Password Protected (.password)</option>
            </select>
          </div>

          <div id="folderPasswordGroup" class="form-group" style="margin-bottom: 1rem; display: none;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">Folder Password (.password)</label>
            <input type="password" id="dotfileFolderPasswordInput" class="admin-input" placeholder="Set or update folder password..." />
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">Background (.bg - color/gradient or image path)</label>
            <input type="text" id="dotfileBgInput" class="admin-input" placeholder="e.g. #0f172a or bg.jpg" />
          </div>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;">Folder Theme Preset (.theme)</label>
            <select id="dotfileThemeSelect" class="sort-select" style="width: 100%;">
              <option value="">(Use Global Default Theme)</option>
              <option value="polaroid-classic">Polaroid Classic</option>
              <option value="dark-glass">Dark Glassmorphism</option>
              <option value="light-minimal">Light Minimal</option>
              <option value="cyberpunk">Cyberpunk</option>
            </select>
          </div>

          <button type="submit" class="pill-btn active" style="width: 100%; justify-content: center;">
            Save Folder Dotfiles
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Media Legend Modal (Admin Only) -->
  <div id="mediaCommentModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3 id="mediaCommentModalTitle">💬 Edit Media Legend</h3>
        <button id="mediaCommentCloseBtn" class="lightbox-btn" title="Close">✕</button>
      </div>
      <div class="admin-modal-body">
        <form id="mediaCommentForm">
          <input type="hidden" id="mediaCommentFilename" />
          <div class="form-group" style="margin-bottom: 1rem;">
            <label id="mediaCommentFilenameLabel" style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem;"></label>
            <input type="text" id="mediaCommentInput" class="admin-input" placeholder="Legend / comment text for this media..." />
          </div>
          <button type="submit" class="pill-btn active" style="width: 100%; justify-content: center;">
            Save Legend (.comment)
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Visitor Folder Password Unlock Modal -->
  <div id="folderUnlockModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content">
      <div class="admin-modal-header">
        <h3>🔒 Protected Folder</h3>
        <button id="folderUnlockCloseBtn" class="lightbox-btn" title="Close">✕</button>
      </div>
      <div class="admin-modal-body">
        <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.9rem;">
          This folder is password protected. Please enter the password to view its contents.
        </p>
        <form id="folderUnlockForm">
          <input type="hidden" id="folderUnlockPath" />
          <input type="password" id="folderUnlockPasswordInput" class="admin-input" placeholder="Folder password..." required />
          <div id="folderUnlockError" class="admin-error-msg" style="display: none;"></div>
          <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;">
            Unlock Folder
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Drag & Drop Upload Overlay (Admin Only) -->
  <div id="dropZoneOverlay" class="drop-zone-overlay" style="display: none;">
    <div class="drop-zone-content">
      <div class="drop-zone-icon">📤</div>
      <h3>Glissez-déposez vos médias ici</h3>
      <p>Photos, vidéos, audio, documents (Téléversement administrateur sécurisé)</p>
    </div>
  </div>

  <!-- Upload Progress Modal -->
  <div id="uploadProgressModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content" style="max-width: 480px;">
      <div class="admin-modal-header">
        <h3>📤 Téléversement en cours...</h3>
      </div>
      <div class="admin-modal-body">
        <div class="upload-progress-bar-container">
          <div id="uploadProgressBar" class="upload-progress-bar" style="width: 0%;">0%</div>
        </div>
        <p id="uploadProgressStatus" style="font-size:0.85rem;margin-top:0.8rem;color:var(--text-muted);">Préparation des fichiers...</p>
        <div id="uploadResultMessages" style="margin-top:1rem;max-height:150px;overflow-y:auto;font-size:0.85rem;display:none;"></div>
      </div>
    </div>
  </div>

  <!-- Create Folder Modal -->
  <div id="createFolderModal" class="admin-modal" role="dialog" aria-hidden="true" style="display: none;">
    <div class="admin-modal-content" style="max-width: 420px;">
      <div class="admin-modal-header">
        <h3>📁 Nouveau Dossier</h3>
        <button id="createFolderCloseBtn" class="lightbox-btn" title="Close">✕</button>
      </div>
      <div class="admin-modal-body">
        <form id="createFolderForm">
          <label for="createFolderNameInput" class="admin-label">Nom du dossier :</label>
          <input type="text" id="createFolderNameInput" class="admin-input" placeholder="ex: Vacances 2026, Événements..." required />
          <div id="createFolderError" class="admin-error-msg" style="display: none;"></div>
          <button type="submit" class="pill-btn active" style="width: 100%; margin-top: 1rem; justify-content: center;">
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
        <h3 style="color: #ef4444; width: 100%;">🗑️ Confirmation de suppression</h3>
        <button id="deleteConfirmCloseBtn" class="lightbox-btn" title="Close">✕</button>
      </div>
      <div class="admin-modal-body">
        <p id="deleteConfirmMessage" style="font-size: 0.95rem; margin: 1rem 0; color: var(--text-main); line-height: 1.5;"></p>
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: center;">
          <button id="deleteCancelBtn" class="btn-toggle" style="flex: 1;">Annuler</button>
          <button id="deleteConfirmActionBtn" class="pill-btn active" style="flex: 1; background: #ef4444; color: white; justify-content: center; font-weight: 700;">
            🗑️ Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Floating Picture-in-Picture (PiP) Player Widget -->
  <div id="pip-player-widget" style="display: none;">
    <div id="pipHeader" class="pip-header">
      <span id="pipTitle" class="pip-title">Lecture multimédia...</span>
      <div class="pip-controls">
        <button id="pipMinimizeBtn" class="pip-btn" title="Réduire / Agrandir">🗕</button>
        <button id="pipCloseBtn" class="pip-btn" title="Fermer le lecteur">✕</button>
      </div>
    </div>
    <div id="pipMediaContainer" class="pip-media-content">
      <!-- Dynamically inserted audio or video tag -->
    </div>
  </div>

  <!-- Google Drive Style Advanced Search Modal -->
  <div id="searchModal" class="search-modal-backdrop" style="display: none;">
    <div class="search-modal-card">
      <div class="gdrive-modal-header">
        <h3 class="gdrive-modal-title">Recherche avancée</h3>
        <button type="button" id="searchModalCloseBtn" class="gdrive-modal-close" title="Fermer (Échap)">✕</button>
      </div>

      <form id="searchAdvancedForm" class="gdrive-search-form">
        <!-- Row 1: Type -->
        <div class="gdrive-form-row">
          <label for="advSearchCategory" class="gdrive-form-label">Type</label>
          <div class="gdrive-form-control">
            <select id="advSearchCategory" class="gdrive-select">
              <option value="all">Tout</option>
              <option value="image">Photos (Images)</option>
              <option value="video">Vidéos</option>
              <option value="audio">Audio / Musique</option>
              <option value="doc">Documents</option>
              <option value="archive">Archives</option>
            </select>
          </div>
        </div>

        <!-- Row 2: Nom de l'élément -->
        <div class="gdrive-form-row">
          <label for="advSearchName" class="gdrive-form-label">Nom de l'élément</label>
          <div class="gdrive-form-control">
            <input type="text" id="advSearchName" class="gdrive-input" placeholder="Saisissez un terme figurant dans le nom du fichier">
          </div>
        </div>

        <!-- Row 3: Contient les mots -->
        <div class="gdrive-form-row">
          <label for="advSearchWords" class="gdrive-form-label">Contient les mots</label>
          <div class="gdrive-form-control">
            <input type="text" id="advSearchWords" class="gdrive-input" placeholder="Saisissez des mots figurant dans la légende ou description">
          </div>
        </div>

        <!-- Row 4: Emplacement -->
        <div class="gdrive-form-row">
          <label for="advSearchLocation" class="gdrive-form-label">Emplacement</label>
          <div class="gdrive-form-control">
            <select id="advSearchLocation" class="gdrive-select">
              <option value="everywhere">Partout (recherche récursive dans tous les sous-dossiers)</option>
              <option value="current">Dans ce dossier uniquement</option>
            </select>
          </div>
        </div>

        <!-- Row 5: Date -->
        <div class="gdrive-form-row">
          <label for="advSearchTiming" class="gdrive-form-label">Date</label>
          <div class="gdrive-form-control">
            <select id="advSearchTiming" class="gdrive-select">
              <option value="all">N'importe quand</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">30 derniers jours</option>
              <option value="year">Cette année</option>
              <option value="custom">Période personnalisée...</option>
            </select>
          </div>
        </div>

        <!-- Row 5b: Custom Date Range (hidden by default) -->
        <div id="advSearchCustomDateRow" class="gdrive-form-row" style="display: none;">
          <label class="gdrive-form-label">Période</label>
          <div class="gdrive-form-control gdrive-date-range">
            <span class="gdrive-date-label">Du</span>
            <input type="date" id="advSearchDateFrom" class="gdrive-input gdrive-date-input">
            <span class="gdrive-date-label">Au</span>
            <input type="date" id="advSearchDateTo" class="gdrive-input gdrive-date-input">
          </div>
        </div>

        <!-- Row 6: Taille -->
        <div class="gdrive-form-row">
          <label for="advSearchSize" class="gdrive-form-label">Taille</label>
          <div class="gdrive-form-control">
            <select id="advSearchSize" class="gdrive-select">
              <option value="all">N'importe quelle taille</option>
              <option value="small">Petite (&lt; 1 Mo)</option>
              <option value="medium">Moyenne (1 Mo à 10 Mo)</option>
              <option value="large">Grande (10 Mo à 50 Mo)</option>
              <option value="xlarge">Très grande (&gt; 50 Mo)</option>
            </select>
          </div>
        </div>

        <!-- Row 7: Options (GPS, Favoris) -->
        <div class="gdrive-form-row">
          <label class="gdrive-form-label">Options</label>
          <div class="gdrive-form-control gdrive-checkbox-group">
            <label class="gdrive-checkbox-label">
              <input type="checkbox" id="advSearchGpsOnly" class="gdrive-checkbox">
              <span>📍 Avec coordonnées GPS uniquement</span>
            </label>
            <label class="gdrive-checkbox-label">
              <input type="checkbox" id="advSearchFavOnly" class="gdrive-checkbox">
              <span>❤️ Uniquement les favoris</span>
            </label>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="gdrive-modal-footer">
          <button type="button" id="advSearchResetBtn" class="gdrive-btn-text">Réinitialiser</button>
          <button type="submit" id="advSearchSubmitBtn" class="gdrive-btn-primary">Rechercher</button>
        </div>
      </form>
    </div>
  </div>

</body>
</html>
