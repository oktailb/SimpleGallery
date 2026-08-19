/**
 * SimpleGallery 2026 - WebOS Unified Metadata Inspector & Properties Window
 * Displays comprehensive multi-format file properties, EXIF metadata, GPS maps, and codecs.
 */
(function(window) {
  'use strict';

  const metadataCache = new Map();

  class MetadataInspector {
    constructor() {
      this.currentWinId = 'meta-inspector-window';
      this.openInspectors = new Map();

      if (window.sys && window.sys.events) {
        window.sys.events.on('locale:changed', () => this.refreshOpenInspectors());
      }
    }

    refreshOpenInspectors() {
      this.openInspectors.forEach(({ file, meta }, cleanPathId) => {
        const bodyEl = document.getElementById(`metaInspectorBody-${cleanPathId}`);
        if (bodyEl) {
          bodyEl.innerHTML = this.buildHtml(file, meta);
          this.initMiniMap(cleanPathId, meta.exif || file.exif);
        }
      });
    }

    t(key, replacements = {}) {
      if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
        return window.sys.i18n.t(key, replacements);
      }
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, replacements);
      }
      if (window.desktop && typeof window.desktop.t === 'function') {
        return window.desktop.t(key, replacements);
      }
      return key;
    }

    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    async open(file, ctx = null) {
      if (!file) return;

      const panelTitle = this.t('lightbox.metadata_panel_title') || 'Propriétés du fichier';
      const cleanPathId = encodeURIComponent(file.path || file.name).replace(/%/g, '_');
      const winId = `meta-${cleanPathId}`;

      // 1. Initial Quick Render
      const initialMeta = {
        general: {
          filename: file.name,
          path: file.path,
          filesize_formatted: file.size_formatted || `${file.size || 0} B`,
          mtime_formatted: file.mtime ? new Date(file.mtime * 1000).toLocaleString() : '',
          category: file.category,
          extension: file.extension,
          mime_type: (file.category === 'image' ? `image/${file.extension}` : (file.category === 'video' ? `video/${file.extension}` : null))
        },
        specific: {},
        exif: file.exif || null
      };

      const renderBody = (meta, isLoading = false) => `
        <div class="webos-metadata-inspector-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:#0d1117;color:#c9d1d9;overflow:hidden;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.08);gap:10px;">
            <div style="display:flex;align-items:center;gap:8px;overflow:hidden;">
              <span style="font-size:1.2rem;">ℹ️</span>
              <strong style="font-size:0.95rem;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(file.name)}</strong>
            </div>
            ${isLoading ? '<div style="font-size:0.8rem;color:#818cf8;animation:pulse 1.5s infinite;">⏳ Chargement...</div>' : ''}
          </div>
          <div id="metaInspectorBody-${cleanPathId}" style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px;">
            ${this.buildHtml(file, meta)}
          </div>
        </div>
      `;

      if (window.WindowManager) {
        let win = window.WindowManager.windows.get(winId);
        if (win) {
          window.WindowManager.focusWindow(winId);
          if (win.bodyEl) win.bodyEl.innerHTML = renderBody(initialMeta, !metadataCache.has(file.path));
        } else {
          win = window.WindowManager.createWindow({
            id: winId,
            appId: 'metadata-inspector',
            appName: panelTitle,
            fileName: file.name,
            title: `ℹ️ ${panelTitle} : ${file.name}`,
            icon: 'ℹ️',
            width: 460,
            height: 580,
            content: renderBody(initialMeta, !metadataCache.has(file.path)),
            onClose: () => {
              this.openInspectors.delete(cleanPathId);
            }
          });
        }

        this.openInspectors.set(cleanPathId, { file, meta: initialMeta });

        // Fetch Full Asynchronous Metadata
        if (!metadataCache.has(file.path)) {
          try {
            const res = await fetch(`api.php?action=get_metadata&file=${encodeURIComponent(file.path)}`);
            const json = await res.json();
            if (json.success && json.metadata) {
              metadataCache.set(file.path, json.metadata);
              this.openInspectors.set(cleanPathId, { file, meta: json.metadata });
              const bodyEl = document.getElementById(`metaInspectorBody-${cleanPathId}`);
              if (bodyEl) {
                bodyEl.innerHTML = this.buildHtml(file, json.metadata);
                this.initMiniMap(cleanPathId, json.metadata.exif || file.exif);
              }
            }
          } catch (e) {
            console.warn('[MetadataInspector] Failed to fetch full metadata:', e);
          }
        } else {
          const cachedMeta = metadataCache.get(file.path);
          this.openInspectors.set(cleanPathId, { file, meta: cachedMeta });
          const bodyEl = document.getElementById(`metaInspectorBody-${cleanPathId}`);
          if (bodyEl) {
            bodyEl.innerHTML = this.buildHtml(file, cachedMeta);
            this.initMiniMap(cleanPathId, cachedMeta.exif || file.exif);
          }
        }
      }
    }

    buildHtml(file, meta) {
      const general = meta.general || {
        filename: file.name,
        path: file.path,
        filesize_formatted: file.size_formatted || `${file.size || 0} B`,
        mtime_formatted: file.mtime ? new Date(file.mtime * 1000).toLocaleString() : '',
        category: file.category,
        extension: file.extension
      };
      const specific = meta.specific || {};
      const exif = meta.exif || file.exif || null;

      let html = '';

      // 1. General Info Card
      html += `
        <div class="meta-section-card">
          <div class="meta-section-title">
            <span>${this.escapeHtml(this.t('meta.general_title') || 'Informations Générales')}</span>
            <span class="meta-badge">${this.escapeHtml((general.extension || file.extension || '').toUpperCase())}</span>
          </div>
          <div class="meta-row">
            <span class="meta-row-label">${this.escapeHtml(this.t('meta.filename') || 'Nom')}</span>
            <span class="meta-row-value">${this.escapeHtml(general.filename || file.name)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-row-label">${this.escapeHtml(this.t('meta.filesize') || 'Taille')}</span>
            <span class="meta-row-value">${this.escapeHtml(general.filesize_formatted || file.size_formatted)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-row-label">${this.escapeHtml(this.t('meta.mtime') || 'Modifié le')}</span>
            <span class="meta-row-value">${this.escapeHtml(general.mtime_formatted || new Date(file.mtime * 1000).toLocaleString())}</span>
          </div>
          ${general.path ? `
            <div class="meta-row">
              <span class="meta-row-label">${this.escapeHtml(this.t('meta.path') || 'Emplacement')}</span>
              <span class="meta-row-value" style="font-family:monospace; font-size:0.75rem; word-break:break-all;">${this.escapeHtml(general.path)}</span>
            </div>
          ` : ''}
          ${general.mime_type ? `
            <div class="meta-row">
              <span class="meta-row-label">${this.escapeHtml(this.t('meta.mime') || 'Type MIME')}</span>
              <span class="meta-row-value" style="font-family:monospace; font-size:0.75rem;">${this.escapeHtml(general.mime_type)}</span>
            </div>
          ` : ''}
        </div>
      `;

      // 2. Image Specific Properties
      if (specific.image) {
        const img = specific.image;
        html += `
          <div class="meta-section-card">
            <div class="meta-section-title">🖼️ ${this.escapeHtml(this.t('meta.image_title') || 'Propriétés Image')}</div>
            ${img.resolution ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.resolution') || 'Dimensions')}</span>
                <span class="meta-row-value">${this.escapeHtml(img.resolution)}</span>
              </div>
            ` : ''}
            ${img.aspect_ratio ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.aspect_ratio') || 'Ratio d\'aspect')}</span>
                <span class="meta-row-value">${this.escapeHtml(img.aspect_ratio)}</span>
              </div>
            ` : ''}
            ${img.megapixels ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.megapixels') || 'Mégapixels')}</span>
                <span class="meta-row-value">${this.escapeHtml(img.megapixels)}</span>
              </div>
            ` : ''}
            ${img.color_depth ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.color_depth') || 'Profondeur')}</span>
                <span class="meta-row-value">${this.escapeHtml(img.color_depth)}</span>
              </div>
            ` : ''}
            ${img.is_animated ? `
              <div class="meta-row">
                <span class="meta-row-label">Animation</span>
                <span class="meta-row-value" style="color:#38bdf8;">GIF Animé (${img.frames_count || 1} images)</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      // 3. Video Specific Properties
      if (specific.video) {
        const vid = specific.video;
        html += `
          <div class="meta-section-card">
            <div class="meta-section-title">🎬 ${this.escapeHtml(this.t('meta.video_title') || 'Propriétés Vidéo')}</div>
            ${vid.container ? `
              <div class="meta-row">
                <span class="meta-row-label">Conteneur</span>
                <span class="meta-row-value">${this.escapeHtml(vid.container)}</span>
              </div>
            ` : ''}
            ${vid.resolution ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.resolution') || 'Résolution')}</span>
                <span class="meta-row-value">${this.escapeHtml(vid.resolution)} ${vid.aspect_ratio ? `(${this.escapeHtml(vid.aspect_ratio)})` : ''}</span>
              </div>
            ` : ''}
            ${vid.duration_formatted ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.duration') || 'Durée')}</span>
                <span class="meta-row-value">${this.escapeHtml(vid.duration_formatted)}</span>
              </div>
            ` : ''}
            ${(vid.codec || vid.video_codec) ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.video_codec') || 'Codec Vidéo')}</span>
                <span class="meta-row-value">${this.escapeHtml(vid.codec || vid.video_codec)}</span>
              </div>
            ` : ''}
            ${vid.audio_codec ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.audio_codec') || 'Codec Audio')}</span>
                <span class="meta-row-value">${this.escapeHtml(vid.audio_codec)}</span>
              </div>
            ` : ''}
            ${vid.bitrate ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.bitrate') || 'Débit')}</span>
                <span class="meta-row-value">${this.escapeHtml(vid.bitrate)}</span>
              </div>
            ` : ''}
            ${vid.fps ? `
              <div class="meta-row">
                <span class="meta-row-label">Cadence</span>
                <span class="meta-row-value">${this.escapeHtml(vid.fps)} fps</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      // 4. Audio Specific Properties
      if (specific.audio) {
        const aud = specific.audio;
        html += `
          <div class="meta-section-card">
            <div class="meta-section-title">🎵 ${this.escapeHtml(this.t('meta.audio_title') || 'Propriétés Audio')}</div>
            ${aud.format ? `
              <div class="meta-row">
                <span class="meta-row-label">Format</span>
                <span class="meta-row-value">${this.escapeHtml(aud.format)}</span>
              </div>
            ` : ''}
            ${aud.duration_formatted ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.duration') || 'Durée')}</span>
                <span class="meta-row-value">${this.escapeHtml(aud.duration_formatted)}</span>
              </div>
            ` : ''}
            ${aud.audio_codec ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.audio_codec') || 'Codec')}</span>
                <span class="meta-row-value">${this.escapeHtml(aud.audio_codec)}</span>
              </div>
            ` : ''}
            ${aud.channels ? `
              <div class="meta-row">
                <span class="meta-row-label">Canaux</span>
                <span class="meta-row-value">${this.escapeHtml(aud.channels)}</span>
              </div>
            ` : ''}
            ${aud.sample_rate ? `
              <div class="meta-row">
                <span class="meta-row-label">Échantillonnage</span>
                <span class="meta-row-value">${this.escapeHtml(aud.sample_rate)}</span>
              </div>
            ` : ''}
            ${aud.bits_per_sample ? `
              <div class="meta-row">
                <span class="meta-row-label">Résolution</span>
                <span class="meta-row-value">${this.escapeHtml(aud.bits_per_sample)}</span>
              </div>
            ` : ''}
            ${aud.bitrate ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.bitrate') || 'Débit')}</span>
                <span class="meta-row-value">${this.escapeHtml(aud.bitrate)}</span>
              </div>
            ` : ''}
            ${aud.title ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.title_tag') || 'Titre')}</span>
                <span class="meta-row-value">${this.escapeHtml(aud.title)}</span>
              </div>
            ` : ''}
            ${aud.artist ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.artist_tag') || 'Artiste')}</span>
                <span class="meta-row-value">${this.escapeHtml(aud.artist)}</span>
              </div>
            ` : ''}
            ${aud.album ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.album_tag') || 'Album')}</span>
                <span class="meta-row-value">${this.escapeHtml(aud.album)}</span>
              </div>
            ` : ''}
            ${aud.year ? `
              <div class="meta-row">
                <span class="meta-row-label">Année</span>
                <span class="meta-row-value">${this.escapeHtml(aud.year)}</span>
              </div>
            ` : ''}
            ${aud.genre ? `
              <div class="meta-row">
                <span class="meta-row-label">Genre</span>
                <span class="meta-row-value">${this.escapeHtml(aud.genre)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      // 5. Document Specific Properties
      if (specific.doc) {
        const doc = specific.doc;
        html += `
          <div class="meta-section-card">
            <div class="meta-section-title">📄 ${this.escapeHtml(this.t('meta.doc_title') || 'Propriétés Document')}</div>
            ${doc.doc_type ? `
              <div class="meta-row">
                <span class="meta-row-label">Type</span>
                <span class="meta-row-value">${this.escapeHtml(doc.doc_type)}</span>
              </div>
            ` : ''}
            ${doc.pdf_version ? `
              <div class="meta-row">
                <span class="meta-row-label">Version</span>
                <span class="meta-row-value">${this.escapeHtml(doc.pdf_version)}</span>
              </div>
            ` : ''}
            ${doc.pages ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.pages') || 'Pages')}</span>
                <span class="meta-row-value">${this.escapeHtml(doc.pages)}</span>
              </div>
            ` : ''}
            ${doc.title ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.title_tag') || 'Titre')}</span>
                <span class="meta-row-value">${this.escapeHtml(doc.title)}</span>
              </div>
            ` : ''}
            ${doc.author ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.author') || 'Auteur')}</span>
                <span class="meta-row-value">${this.escapeHtml(doc.author)}</span>
              </div>
            ` : ''}
            ${doc.creator ? `
              <div class="meta-row">
                <span class="meta-row-label">Créateur</span>
                <span class="meta-row-value">${this.escapeHtml(doc.creator)}</span>
              </div>
            ` : ''}
            ${doc.lines_count ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.lines') || 'Lignes')}</span>
                <span class="meta-row-value">${this.escapeHtml(doc.lines_count)}</span>
              </div>
            ` : ''}
            ${doc.words_count ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.words') || 'Mots')}</span>
                <span class="meta-row-value">${this.escapeHtml(doc.words_count)}</span>
              </div>
            ` : ''}
            ${doc.chars_count ? `
              <div class="meta-row">
                <span class="meta-row-label">Caractères</span>
                <span class="meta-row-value">${this.escapeHtml(doc.chars_count)}</span>
              </div>
            ` : ''}
            ${doc.encoding ? `
              <div class="meta-row">
                <span class="meta-row-label">Encodage</span>
                <span class="meta-row-value">${this.escapeHtml(doc.encoding)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      // 6. Archive Specific Properties
      if (specific.archive) {
        const arch = specific.archive;
        html += `
          <div class="meta-section-card">
            <div class="meta-section-title">📦 ${this.escapeHtml(this.t('meta.archive_title') || 'Contenu Archive')}</div>
            ${arch.archive_type ? `
              <div class="meta-row">
                <span class="meta-row-label">Format</span>
                <span class="meta-row-value">${this.escapeHtml(arch.archive_type)}</span>
              </div>
            ` : ''}
            ${arch.files_count !== undefined && arch.files_count !== null ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.files_count') || 'Fichiers')}</span>
                <span class="meta-row-value">${this.escapeHtml(arch.files_count)}</span>
              </div>
            ` : ''}
            ${arch.uncompressed_size_formatted ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.uncompressed_size') || 'Taille décompressée')}</span>
                <span class="meta-row-value">${this.escapeHtml(arch.uncompressed_size_formatted)}</span>
              </div>
            ` : ''}
            ${arch.compression_ratio ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('meta.compression_ratio') || 'Gain')}</span>
                <span class="meta-row-value" style="color:#4ade80;font-weight:600;">${this.escapeHtml(arch.compression_ratio)}</span>
              </div>
            ` : ''}
            ${(arch.files_sample && arch.files_sample.length > 0) ? `
              <div style="margin-top:10px;">
                <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;">Aperçu des fichiers internes (${Math.min(arch.files_sample.length, 50)}) :</div>
                <div style="max-height:140px;overflow-y:auto;background:rgba(0,0,0,0.25);border-radius:6px;padding:6px 8px;font-size:0.75rem;font-family:monospace;border:1px solid rgba(255,255,255,0.06);">
                  ${arch.files_sample.slice(0, 50).map(f => `
                    <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">${f.is_dir ? '📁 ' : '📄 '}${this.escapeHtml(f.name)}</span>
                      <span style="color:var(--text-muted);">${this.escapeHtml(f.size_formatted || '')}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }

      // 7. EXIF & Camera Section
      if (exif && (exif.camera || exif.datetime || exif.fnumber || exif.shutter_speed || exif.iso || exif.focal || exif.artist || exif.software || exif.description)) {
        html += `
          <div class="meta-section-card">
            <div class="meta-section-title">📷 ${this.escapeHtml(this.t('exif.title') || 'Métadonnées EXIF')}</div>
            ${exif.camera ? `
              <div class="exif-camera-box" style="background:rgba(255,255,255,0.05);padding:6px 10px;border-radius:6px;font-weight:600;color:#f8fafc;margin-bottom:6px;">📷 ${this.escapeHtml(exif.camera)}</div>
            ` : ''}
            ${exif.datetime ? `
              <div class="meta-row">
                <span class="meta-row-label">${this.escapeHtml(this.t('exif.datetime') || 'Prise de vue')}</span>
                <span class="meta-row-value">📅 ${this.escapeHtml(exif.datetime)}</span>
              </div>
            ` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
              ${exif.fnumber ? `<div style="background:rgba(255,255,255,0.03);padding:6px 8px;border-radius:6px;"><span style="font-size:0.75rem;color:var(--text-muted);">${this.escapeHtml(this.t('exif.aperture') || 'Ouverture')}</span><div style="font-weight:600;color:#f8fafc;">${this.escapeHtml(exif.fnumber)}</div></div>` : ''}
              ${exif.shutter_speed ? `<div style="background:rgba(255,255,255,0.03);padding:6px 8px;border-radius:6px;"><span style="font-size:0.75rem;color:var(--text-muted);">${this.escapeHtml(this.t('exif.shutter') || 'Vitesse')}</span><div style="font-weight:600;color:#f8fafc;">${this.escapeHtml(exif.shutter_speed)}</div></div>` : ''}
              ${exif.iso ? `<div style="background:rgba(255,255,255,0.03);padding:6px 8px;border-radius:6px;"><span style="font-size:0.75rem;color:var(--text-muted);">${this.escapeHtml(this.t('exif.iso') || 'ISO')}</span><div style="font-weight:600;color:#f8fafc;">${this.escapeHtml(exif.iso)}</div></div>` : ''}
              ${exif.focal ? `<div style="background:rgba(255,255,255,0.03);padding:6px 8px;border-radius:6px;"><span style="font-size:0.75rem;color:var(--text-muted);">${this.escapeHtml(this.t('exif.focal') || 'Focale')}</span><div style="font-weight:600;color:#f8fafc;">${this.escapeHtml(exif.focal)}</div></div>` : ''}
            </div>
            ${exif.artist ? `
              <div class="meta-row" style="margin-top:6px;">
                <span class="meta-row-label">Auteur</span>
                <span class="meta-row-value">${this.escapeHtml(exif.artist)}</span>
              </div>
            ` : ''}
            ${exif.software ? `
              <div class="meta-row">
                <span class="meta-row-label">Logiciel</span>
                <span class="meta-row-value">${this.escapeHtml(exif.software)}</span>
              </div>
            ` : ''}
            ${exif.description ? `
              <div class="meta-row">
                <span class="meta-row-label">Description</span>
                <span class="meta-row-value">${this.escapeHtml(exif.description)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      // 8. GPS Geolocation Section & Map
      if (exif && exif.gps && exif.gps.lat && exif.gps.lng) {
        html += `
          <div class="meta-section-card">
            <div class="meta-section-title">📍 ${this.escapeHtml(this.t('exif.gps_title') || 'Localisation GPS')}</div>
            <div class="meta-row">
              <span class="meta-row-label">Coordonnées</span>
              <span class="meta-row-value" style="font-family:monospace; font-size:0.775rem;">${exif.gps.lat}°, ${exif.gps.lng}°</span>
            </div>
            <div id="exifMiniMap-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}" style="height:160px;width:100%;border-radius:8px;margin-top:8px;border:1px solid rgba(255,255,255,0.1);"></div>
          </div>
        `;
      }

      return html;
    }

    initMiniMap(cleanPathId, exif) {
      if (exif && exif.gps && exif.gps.lat && exif.gps.lng && typeof L !== 'undefined') {
        setTimeout(() => {
          const mapId = `exifMiniMap-${cleanPathId.split('_').pop()}`;
          const mapEl = document.getElementById(mapId) || document.querySelector(`[id^="exifMiniMap-"]`);
          if (!mapEl) return;
          mapEl.innerHTML = '';
          const miniMap = L.map(mapEl, {
            center: [exif.gps.lat, exif.gps.lng],
            zoom: 14,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            touchZoom: false
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
          L.marker([exif.gps.lat, exif.gps.lng]).addTo(miniMap);
        }, 100);
      }
    }
  }

  window.MetadataInspector = new MetadataInspector();
  window.sys = window.sys || {};
  window.sys.showMetadata = (file) => window.MetadataInspector.open(file);

})(window);
