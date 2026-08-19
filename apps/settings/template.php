<?php
/**
 * SimpleGallery 2026 - Settings & Administration App UI Template
 * Injected automatically by the Kernel into the workspace.
 */
?>
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
        <p class="admin-active-notice" style="margin-bottom: 1.25rem; color: #94a3b8; font-size: 0.875rem; line-height: 1.4;" data-i18n="admin.active_notice">
          Mode Administrateur activé. Vous pouvez créer des dossiers, uploader, éditer les images et gérer les permissions.
        </p>

        <div class="admin-section" style="margin-bottom: 1.25rem;">
          <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 600; color: #f8fafc;" data-i18n="admin.change_password">Changer le mot de passe</h4>
          <form id="changePasswordForm">
            <input type="password" id="newAdminPasswordInput" class="admin-input" placeholder="Nouveau mot de passe..." data-i18n-placeholder="admin.new_password_placeholder" required minlength="4" />
            <button type="submit" class="pill-btn" style="width: 100%; margin-top: 0.5rem; justify-content: center; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);" data-i18n="admin.save_new_password">
              Mettre à jour
            </button>
            <div id="adminChangePassMsg" class="admin-success-msg" style="display: none; margin-top: 0.5rem;"></div>
          </form>
        </div>

        <div class="permissions-matrix-section">
          <div class="permissions-matrix-title">
            <span data-i18n="admin.perms_title">🛡️ Matrice des Droits Invités</span>
          </div>
          <div class="permissions-matrix-grid">
            <label class="permission-item-card" for="perm_can_upload">
              <input type="checkbox" id="perm_can_upload" />
              <span data-i18n="admin.perm_upload">📤 Upload de fichiers</span>
            </label>
            <label class="permission-item-card" for="perm_can_delete">
              <input type="checkbox" id="perm_can_delete" />
              <span data-i18n="admin.perm_delete">🗑️ Suppression d'éléments</span>
            </label>
            <label class="permission-item-card" for="perm_can_move">
              <input type="checkbox" id="perm_can_move" />
              <span data-i18n="admin.perm_move">🖐️ Déplacement d'éléments</span>
            </label>
            <label class="permission-item-card" for="perm_can_comment">
              <input type="checkbox" id="perm_can_comment" />
              <span data-i18n="admin.perm_comment">✏️ Édition des légendes</span>
            </label>
            <label class="permission-item-card" for="perm_can_create_folder">
              <input type="checkbox" id="perm_can_create_folder" />
              <span data-i18n="admin.perm_create_folder">📁+ Création de dossiers</span>
            </label>
            <label class="permission-item-card" for="perm_can_download_archive">
              <input type="checkbox" id="perm_can_download_archive" />
              <span data-i18n="admin.perm_download_archive">📦 Téléchargement d'archives</span>
            </label>
            <label class="permission-item-card" for="perm_can_download_item" style="grid-column: span 2;">
              <input type="checkbox" id="perm_can_download_item" />
              <span data-i18n="admin.perm_download_item">⬇️ Téléchargement direct des médias seuls</span>
            </label>
          </div>
          <button type="button" id="savePermissionsBtn" class="save-permissions-btn" data-i18n="admin.perm_save_btn">
            💾 Enregistrer la matrice de droits
          </button>
        </div>

        <button id="adminLogoutBtn" type="button" class="admin-logout-btn" data-i18n="admin.logout_btn">
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
