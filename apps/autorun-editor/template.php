<?php
/**
 * SimpleGallery - Autorun Studio Application Template
 */
?>
<template id="autorunEditorAppTemplate">
  <div class="autorun-studio-container">
    <div class="autorun-studio-toolbar">
      <div class="autorun-studio-toolbar-left">
        <span class="autorun-studio-folder-badge" data-folder-badge>📁 (Racine)</span>
      </div>
      <div class="autorun-studio-tabs">
        <button type="button" class="autorun-studio-tab-btn active" data-tab="visual" data-i18n="autorun_studio.tab_visual">
          🎨 <?php echo htmlspecialchars(__t('autorun_studio.tab_visual'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
        <button type="button" class="autorun-studio-tab-btn" data-tab="json" data-i18n="autorun_studio.tab_json">
          ⚙️ <?php echo htmlspecialchars(__t('autorun_studio.tab_json'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </div>
    </div>

    <div class="autorun-studio-body">
      <!-- Visual Editor View -->
      <div class="autorun-studio-visual-view" data-visual-view>
        <!-- Story Metadata Card -->
        <div class="autorun-studio-meta-card">
          <div class="autorun-studio-grid-2">
            <div class="autorun-studio-field">
              <label data-i18n="autorun_studio.meta_title"><?php echo htmlspecialchars(__t('autorun_studio.meta_title'), ENT_QUOTES, 'UTF-8'); ?></label>
              <input type="text" class="autorun-studio-input" data-meta-title placeholder="Titre de la présentation...">
            </div>
            <div class="autorun-studio-field">
              <label data-i18n="autorun_studio.meta_layout"><?php echo htmlspecialchars(__t('autorun_studio.meta_layout'), ENT_QUOTES, 'UTF-8'); ?></label>
              <select class="autorun-studio-select" data-meta-layout>
                <option value="split-horizontal">Split Horizontal (Gauche / Droite)</option>
                <option value="split-vertical">Split Vertical (Haut / Bas)</option>
                <option value="quad">Quad (4 Coins)</option>
                <option value="floating">Libre / Flottant</option>
              </select>
            </div>
          </div>
          <div class="autorun-studio-field">
            <label data-i18n="autorun_studio.meta_desc"><?php echo htmlspecialchars(__t('autorun_studio.meta_desc'), ENT_QUOTES, 'UTF-8'); ?></label>
            <input type="text" class="autorun-studio-input" data-meta-desc placeholder="Synopsis du récit multimédia...">
          </div>

          <!-- Master Media Row -->
          <div class="autorun-studio-grid-3">
            <div class="autorun-studio-field">
              <label data-i18n="autorun_studio.master_type"><?php echo htmlspecialchars(__t('autorun_studio.master_type'), ENT_QUOTES, 'UTF-8'); ?></label>
              <select class="autorun-studio-select" data-master-type>
                <option value="video">🎬 Vidéo Principale</option>
                <option value="audio">🎵 Audio / Podcast</option>
                <option value="timer">⏱️ Minuteur Virtuel</option>
              </select>
            </div>
            <div class="autorun-studio-field" data-master-file-field>
              <label data-i18n="autorun_studio.master_media"><?php echo htmlspecialchars(__t('autorun_studio.master_media'), ENT_QUOTES, 'UTF-8'); ?></label>
              <select class="autorun-studio-select" data-master-file>
                <option value="">(Aucun fichier)</option>
              </select>
            </div>
            <div class="autorun-studio-field" data-master-duration-field style="display: none;">
              <label data-i18n="autorun_studio.master_duration"><?php echo htmlspecialchars(__t('autorun_studio.master_duration'), ENT_QUOTES, 'UTF-8'); ?></label>
              <input type="number" class="autorun-studio-input" data-master-duration value="120" min="10" step="5">
            </div>
          </div>
        </div>

        <!-- Timeline Section -->
        <div class="autorun-studio-timeline-zone">
          <div class="autorun-studio-timeline-header">
            <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">⏱️ Timeline des Événements</h3>
            <button type="button" class="autorun-studio-btn-secondary" data-add-step-btn data-i18n="autorun_studio.add_step">
              <?php echo htmlspecialchars(__t('autorun_studio.add_step'), ENT_QUOTES, 'UTF-8'); ?>
            </button>
          </div>
          <div class="autorun-studio-timeline-list" data-timeline-list></div>
        </div>
      </div>

      <!-- JSON Raw View -->
      <div class="autorun-studio-json-view" data-json-view style="display: none;">
        <textarea class="autorun-studio-textarea" data-raw-json spellcheck="false"></textarea>
      </div>
    </div>

    <!-- Footer Controls -->
    <div class="autorun-studio-footer">
      <div class="autorun-studio-footer-left">
        <button type="button" class="autorun-studio-btn-danger" data-delete-btn style="display: none;" data-i18n="autorun_studio.delete">
          <?php echo htmlspecialchars(__t('autorun_studio.delete'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
        <button type="button" class="autorun-studio-btn-secondary" data-preview-btn data-i18n="autorun_studio.preview">
          <?php echo htmlspecialchars(__t('autorun_studio.preview'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </div>
      <div class="autorun-studio-footer-right">
        <button type="button" class="autorun-studio-btn-primary" data-save-btn data-i18n="autorun_studio.save">
          <?php echo htmlspecialchars(__t('autorun_studio.save'), ENT_QUOTES, 'UTF-8'); ?>
        </button>
      </div>
    </div>
  </div>
</template>
