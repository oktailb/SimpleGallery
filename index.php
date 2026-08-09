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

</body>
</html>
