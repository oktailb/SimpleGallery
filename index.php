<?php
require_once __DIR__ . '/config.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="SimpleGallery 2026 - Ultra-fast zero-dependency modern PHP web gallery">
  <title><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></title>

  <!-- Google Fonts: Inter, Outfit, and Caveat for Polaroid handwriting -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="css/gallery.css">

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

  <script src="js/gallery.js" defer></script>
</head>
<body>

  <!-- App Header -->
  <header class="app-header">
    <div class="header-container">
      <div class="brand-section">
        <div class="brand-logo">📸</div>
        <h1 class="brand-title"><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></h1>
      </div>

      <!-- Breadcrumbs -->
      <nav id="breadcrumbs" class="breadcrumbs" aria-label="Breadcrumb Navigation">
        <span class="crumb-item crumb-active"><?php echo htmlspecialchars($gallery_title, ENT_QUOTES, 'UTF-8'); ?></span>
      </nav>

      <!-- Toolbar Controls -->
      <div class="toolbar-controls">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" class="search-input" placeholder="Search media..." aria-label="Search media">
        </div>

        <select id="sortSelect" class="sort-select" aria-label="Sort options">
          <option value="name">Sort by Name</option>
          <option value="date">Sort by Date</option>
          <option value="size">Sort by Size</option>
        </select>

        <div class="control-btn-group">
          <button id="viewPolaroidBtn" class="btn-toggle active" title="Polaroid View">
            <span>🖼️</span> Polaroid
          </button>
          <button id="viewGridBtn" class="btn-toggle" title="Grid View">
            <span>🔲</span> Grid
          </button>
        </div>

        <button id="folderSettingsBtn" class="btn-toggle" title="Customize Folder (.title, .desc, .bg, .theme)" style="display: none;">
          <span>🎨</span> Folder Settings
        </button>

        <button id="adminBtn" class="btn-toggle" title="Admin Mode">
          <span id="adminBtnIcon">🔑</span> <span id="adminBtnText">Admin</span>
        </button>
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

        <button id="lightboxEditCommentBtn" class="lightbox-btn" title="Edit Legend (.comment)" style="display: none;">
          ✏️
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
          <button id="adminLogoutBtn" class="pill-btn" style="width: 100%; justify-content: center; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);">
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

</body>
</html>
