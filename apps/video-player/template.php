<?php
/**
 * SimpleGallery 2026 - Video & Video Wall Player App UI Template
 * Injected automatically by the Kernel into the workspace.
 */
?>
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
