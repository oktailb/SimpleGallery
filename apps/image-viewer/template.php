<?php
/**
 * SimpleGallery 2026 - Image Viewer App UI Template
 * Injected automatically by the Kernel into the workspace.
 */
?>
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
