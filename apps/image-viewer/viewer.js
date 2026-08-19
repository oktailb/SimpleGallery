/**
 * SimpleGallery 2026 - Image Viewer Application
 * Fully autonomous Image Lightbox Explorer + Canvas Retouching Studio + Filter/Save Engine.
 */
(function(window) {
  'use strict';

  const ImageViewerPlugin = {
    id: 'image-viewer',
    nameKey: 'viewer.image',
    categories: ['image'],
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'heic', 'bmp', 'ico', 'tiff'],
    mimeTypes: ['image/*'],
    defaultTarget: 'lightbox',
    supportsFullscreen: true,
    supportsPip: false,
    cssPath: 'apps/image-viewer/viewer.css',

    // Internal State
    zoomState: {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
      isDragging: false,
      startX: 0,
      startY: 0
    },

    editorState: {
      originalFile: null,
      rotation: 0,
      flipH: false,
      flipV: false,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      sepia: 0,
      grayscale: 0,
      blur: 0,
      invert: 0
    },

    /**
     * Opens an image file in the Lightbox explorer
     */
    open(file, options, ctx) {
      if (!ctx || !ctx.el) return false;
      const index = (typeof options.index === 'number') ? options.index : ctx.state.filteredFiles.findIndex(f => f.path === file.path);
      if (index === -1) return false;

      this.currentCtx = ctx;
      this.currentFile = file;
      this.currentIndex = index;

      ctx.state.lightboxIndex = index;

      // Update Lightbox UI Header
      if (!ctx.state.isLightboxHistoryPushed) {
        history.pushState({ lightbox: true }, '');
        ctx.state.isLightboxHistoryPushed = true;
      }

      ctx.el.lightboxTitle.textContent = file.name;
      ctx.el.lightboxMeta.textContent = `${file.size_formatted} • ${new Date(file.mtime * 1000).toLocaleDateString()}`;
      
      const canDownloadItem = ctx.state.isAdmin || (ctx.state.userRights ? ctx.state.userRights.can_download_item : true);
      if (ctx.el.lightboxDownloadBtn) {
        ctx.el.lightboxDownloadBtn.href = file.file_url;
        ctx.el.lightboxDownloadBtn.setAttribute('download', file.name);
        ctx.el.lightboxDownloadBtn.style.display = canDownloadItem ? 'inline-flex' : 'none';
      }

      if (ctx.el.lightboxDeleteBtn) {
        ctx.el.lightboxDeleteBtn.style.display = ctx.state.isAdmin ? 'inline-flex' : 'none';
      }

      ctx.updateLightboxFavBtn(file.path);

      if (ctx.el.lightboxComment) {
        if (file.comment) {
          ctx.el.lightboxComment.textContent = `💬 ${file.comment}`;
          ctx.el.lightboxComment.style.display = 'block';
        } else {
          ctx.el.lightboxComment.style.display = 'none';
        }
      }

      // Reset Explorer Zoom
      this.resetZoom();

      // Show Controls
      if (ctx.el.lightboxExifBtn) ctx.el.lightboxExifBtn.style.display = 'inline-flex';
      ctx.loadUnifiedMetadata(file);

      // Render Application Controls into Lightbox Action Bar
      const isEditableImage = ctx.state.isAdmin && file.category === 'image' && file.extension !== 'svg';
      const appActions = document.getElementById('lightboxAppActions');
      if (appActions) {
        appActions.innerHTML = `
          <div id="imageExplorerControls" class="image-explorer-controls" style="display: flex; gap: 0.4rem;">
            <button id="lightboxZoomInBtn" class="lightbox-btn" title="${ctx.escapeHtml(ctx.t('lightbox.zoom_in') || 'Zoom In (+)')}">➕</button>
            <button id="lightboxZoomOutBtn" class="lightbox-btn" title="${ctx.escapeHtml(ctx.t('lightbox.zoom_out') || 'Zoom Out (-)')}">➖</button>
            <button id="lightboxResetZoomBtn" class="lightbox-btn" title="${ctx.escapeHtml(ctx.t('lightbox.reset_zoom') || 'Reset Zoom (0)')}">🔄</button>
            <button id="lightboxRotateBtn" class="lightbox-btn" title="${ctx.escapeHtml(ctx.t('lightbox.rotate') || 'Rotate 90° (R)')}">⟳</button>
            <span id="zoomBadge" class="zoom-badge">100%</span>
            ${isEditableImage ? `<button id="lightboxEditImageBtn" class="lightbox-btn" title="${ctx.escapeHtml(ctx.t('lightbox.edit_image') || 'Éditer l\'image (Recadrage, Rotation, Filtres)')}">🎨</button>` : ''}
          </div>
        `;
        const editBtn = document.getElementById('lightboxEditImageBtn');
        if (editBtn) editBtn.onclick = () => this.openImageEditor(file, ctx);
      }

      // Render Image Content
      ctx.el.lightboxContent.innerHTML = `
        <div class="image-viewer-container" id="imageViewerContainer">
          <img id="lightboxExplorerImg" src="${file.file_url}" alt="${ctx.escapeHtml(file.name)}" class="explorer-img" draggable="false" />
        </div>
      `;

      this.bindExplorerEvents(ctx);
      ctx.el.lightbox.classList.add('open');
      return true;
    },

    // -------------------------------------------------------------
    // INTERACTIVE ZOOM, PAN, & ROTATION ENGINE
    // -------------------------------------------------------------
    bindExplorerEvents(ctx) {
      const img = document.getElementById('lightboxExplorerImg');
      const container = document.getElementById('imageViewerContainer') || ctx.el.lightboxContent;
      if (!img || !container) return;

      // Mouse Drag / Pan
      container.onmousedown = (e) => this.startDrag(e);
      window.onmousemove = (e) => this.doDrag(e);
      window.onmouseup = (e) => this.endDrag(e);

      // Touch Drag / Pan
      container.ontouchstart = (e) => this.startTouchDrag(e);
      window.ontouchmove = (e) => this.doTouchDrag(e);
      window.ontouchend = (e) => this.endDrag(e);

      // Mouse Wheel Zoom
      container.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        this.adjustZoom(delta);
      };

      // Double click to toggle Zoom
      img.ondblclick = (e) => {
        e.stopPropagation();
        if (this.zoomState.scale > 1) {
          this.resetZoom();
        } else {
          this.adjustZoom(1.5);
        }
      };

      // Toolbar Zoom Buttons
      const zoomInBtn = document.getElementById('lightboxZoomInBtn') || document.getElementById('explorerZoomInBtn');
      const zoomOutBtn = document.getElementById('lightboxZoomOutBtn') || document.getElementById('explorerZoomOutBtn');
      const zoomResetBtn = document.getElementById('lightboxResetZoomBtn') || document.getElementById('explorerZoomResetBtn');
      const rotateBtn = document.getElementById('lightboxRotateBtn') || document.getElementById('explorerRotateBtn');

      if (zoomInBtn) zoomInBtn.onclick = () => this.adjustZoom(0.3);
      if (zoomOutBtn) zoomOutBtn.onclick = () => this.adjustZoom(-0.3);
      if (zoomResetBtn) zoomResetBtn.onclick = () => this.resetZoom();
      if (rotateBtn) rotateBtn.onclick = () => this.rotateImage();
    },

    resetZoom() {
      this.zoomState = {
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotation: 0,
        isDragging: false,
        startX: 0,
        startY: 0
      };
      this.updateExplorerTransform(true);
    },

    clampTranslate() {
      const img = document.getElementById('lightboxExplorerImg');
      if (!img) return;

      const { scale, rotation } = this.zoomState;
      if (scale <= 1) {
        this.zoomState.translateX = 0;
        this.zoomState.translateY = 0;
        return;
      }

      const container = document.getElementById('imageViewerContainer') || img.parentElement;
      const containerWidth = container ? container.clientWidth : window.innerWidth;
      const containerHeight = container ? container.clientHeight : window.innerHeight;

      const imgW = img.offsetWidth || containerWidth;
      const imgH = img.offsetHeight || containerHeight;
      const isRotated = (rotation % 180 !== 0);
      const effW = isRotated ? imgH : imgW;
      const effH = isRotated ? imgW : imgH;

      const scaledW = effW * scale;
      const scaledH = effH * scale;

      const maxPanX = Math.max((scaledW - containerWidth) / 2, (containerWidth * (scale - 1)) / 2, (effW * (scale - 1)) / 2) + 80;
      const maxPanY = Math.max((scaledH - containerHeight) / 2, (containerHeight * (scale - 1)) / 2, (effH * (scale - 1)) / 2) + 80;

      this.zoomState.translateX = Math.min(maxPanX, Math.max(-maxPanX, this.zoomState.translateX));
      this.zoomState.translateY = Math.min(maxPanY, Math.max(-maxPanY, this.zoomState.translateY));
    },

    adjustZoom(delta) {
      let newScale = Math.min(Math.max(1, this.zoomState.scale + delta), 5);
      newScale = Math.round(newScale * 100) / 100;

      if (newScale === 1) {
        this.zoomState.translateX = 0;
        this.zoomState.translateY = 0;
      }

      this.zoomState.scale = newScale;
      this.clampTranslate();
      this.updateExplorerTransform(true);
    },

    rotateImage() {
      this.zoomState.rotation = (this.zoomState.rotation + 90) % 360;
      this.clampTranslate();
      this.updateExplorerTransform(true);
    },

    startDrag(e) {
      if (this.zoomState.scale <= 1) return;
      if (e.target.closest('button, input, a, .lightbox-header, .lightbox-nav-btn, .image-explorer-controls')) return;
      e.preventDefault();

      this.zoomState.isDragging = true;
      this.zoomState.startX = e.clientX - this.zoomState.translateX;
      this.zoomState.startY = e.clientY - this.zoomState.translateY;

      const img = document.getElementById('lightboxExplorerImg');
      if (img) img.classList.add('is-panning');
    },

    startTouchDrag(e) {
      if (this.zoomState.scale <= 1) return;
      if (e.touches.length === 1) {
        this.zoomState.isDragging = true;
        this.zoomState.startX = e.touches[0].clientX - this.zoomState.translateX;
        this.zoomState.startY = e.touches[0].clientY - this.zoomState.translateY;

        const img = document.getElementById('lightboxExplorerImg');
        if (img) img.classList.add('is-panning');
      }
    },

    doDrag(e) {
      if (!this.zoomState.isDragging) return;
      e.preventDefault();
      this.zoomState.translateX = e.clientX - this.zoomState.startX;
      this.zoomState.translateY = e.clientY - this.zoomState.startY;
      this.clampTranslate();
      this.updateExplorerTransform(false);
    },

    doTouchDrag(e) {
      if (!this.zoomState.isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      this.zoomState.translateX = e.touches[0].clientX - this.zoomState.startX;
      this.zoomState.translateY = e.touches[0].clientY - this.zoomState.startY;
      this.clampTranslate();
      this.updateExplorerTransform(false);
    },

    endDrag() {
      this.zoomState.isDragging = false;
      const img = document.getElementById('lightboxExplorerImg');
      if (img) {
        img.classList.remove('is-panning');
        img.classList.remove('dragging');
      }
    },

    updateExplorerTransform(withTransition = true) {
      const img = document.getElementById('lightboxExplorerImg');
      if (!img) return;

      img.style.transition = withTransition ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' : 'none';
      img.style.transform = `translate(${this.zoomState.translateX}px, ${this.zoomState.translateY}px) scale(${this.zoomState.scale}) rotate(${this.zoomState.rotation}deg)`;

      const zoomResetBtn = document.getElementById('explorerZoomResetBtn');
      if (zoomResetBtn) {
        zoomResetBtn.textContent = `${Math.round(this.zoomState.scale * 100)}%`;
      }
    },

    // -------------------------------------------------------------
    // IMAGE EDITOR & FILTER RETOUCH STUDIO
    // -------------------------------------------------------------
    openImageEditor(file, ctx) {
      const modal = document.getElementById('imageEditorModal');
      if (!modal) return;

      this.editorState = {
        originalFile: file,
        rotation: 0,
        flipH: false,
        flipV: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        sepia: 0,
        grayscale: 0,
        blur: 0,
        invert: 0
      };

      const previewImg = document.getElementById('imageEditorPreviewImg');
      if (previewImg) {
        previewImg.src = file.file_url;
      }

      this.bindEditorControls(ctx);
      modal.classList.add('open');
    },

    bindEditorControls(ctx) {
      const modal = document.getElementById('imageEditorModal');
      if (!modal) return;

      // Close button
      const closeBtn = document.getElementById('imageEditorCloseBtn');
      const cancelBtn = document.getElementById('imageEditorCancelBtn');
      if (closeBtn) closeBtn.onclick = () => modal.classList.remove('open');
      if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('open');

      // Sliders
      const setupSlider = (id, prop, unit = '') => {
        const slider = document.getElementById(id);
        const valSpan = document.getElementById(`${id}Val`);
        if (slider) {
          slider.value = this.editorState[prop];
          if (valSpan) valSpan.textContent = `${slider.value}${unit}`;
          slider.oninput = () => {
            this.editorState[prop] = parseFloat(slider.value);
            if (valSpan) valSpan.textContent = `${slider.value}${unit}`;
            this.applyEditorPreview();
          };
        }
      };

      setupSlider('editorBrightness', 'brightness', '%');
      setupSlider('editorContrast', 'contrast', '%');
      setupSlider('editorSaturation', 'saturation', '%');
      setupSlider('editorSepia', 'sepia', '%');
      setupSlider('editorGrayscale', 'grayscale', '%');
      setupSlider('editorBlur', 'blur', 'px');
      setupSlider('editorInvert', 'invert', '%');

      // Transform buttons
      const rotLeftBtn = document.getElementById('editorRotateLeftBtn');
      const rotRightBtn = document.getElementById('editorRotateRightBtn');
      const flipHBtn = document.getElementById('editorFlipHBtn');
      const flipVBtn = document.getElementById('editorFlipVBtn');
      const resetFiltersBtn = document.getElementById('editorResetFiltersBtn');

      if (rotLeftBtn) rotLeftBtn.onclick = () => { this.editorState.rotation = (this.editorState.rotation - 90) % 360; this.applyEditorPreview(); };
      if (rotRightBtn) rotRightBtn.onclick = () => { this.editorState.rotation = (this.editorState.rotation + 90) % 360; this.applyEditorPreview(); };
      if (flipHBtn) flipHBtn.onclick = () => { this.editorState.flipH = !this.editorState.flipH; this.applyEditorPreview(); };
      if (flipVBtn) flipVBtn.onclick = () => { this.editorState.flipV = !this.editorState.flipV; this.applyEditorPreview(); };

      if (resetFiltersBtn) {
        resetFiltersBtn.onclick = () => {
          this.editorState.brightness = 100;
          this.editorState.contrast = 100;
          this.editorState.saturation = 100;
          this.editorState.sepia = 0;
          this.editorState.grayscale = 0;
          this.editorState.blur = 0;
          this.editorState.invert = 0;
          this.editorState.rotation = 0;
          this.editorState.flipH = false;
          this.editorState.flipV = false;
          this.applyEditorPreview();
        };
      }

      // Save button -> Opens choice modal (Overwrite vs Copy)
      const saveBtn = document.getElementById('imageEditorSaveBtn');
      if (saveBtn) {
        saveBtn.onclick = () => this.openSaveChoiceModal(ctx);
      }
    },

    applyEditorPreview() {
      const img = document.getElementById('imageEditorPreviewImg');
      if (!img) return;

      const { brightness, contrast, saturation, sepia, grayscale, blur, invert, rotation, flipH, flipV } = this.editorState;
      img.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) grayscale(${grayscale}%) blur(${blur}px) invert(${invert}%)`;
      img.style.transform = `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;
    },

    openSaveChoiceModal(ctx) {
      const choiceModal = document.getElementById('imageSaveChoiceModal');
      if (!choiceModal) return;

      choiceModal.classList.add('open');

      const overwriteBtn = document.getElementById('saveChoiceOverwriteBtn');
      const copyBtn = document.getElementById('saveChoiceCopyBtn');
      const cancelBtn = document.getElementById('saveChoiceCancelBtn');

      if (cancelBtn) cancelBtn.onclick = () => choiceModal.classList.remove('open');

      if (overwriteBtn) {
        overwriteBtn.onclick = async () => {
          choiceModal.classList.remove('open');
          await this.executeSave(false, ctx);
        };
      }

      if (copyBtn) {
        copyBtn.onclick = async () => {
          choiceModal.classList.remove('open');
          await this.executeSave(true, ctx);
        };
      }
    },

    async executeSave(saveAsCopy, ctx) {
      const file = this.editorState.originalFile;
      if (!file) return;

      ctx.showLoading(true);

      try {
        const payload = {
          action: 'edit_image',
          file: file.path,
          save_as_copy: saveAsCopy,
          rotation: this.editorState.rotation,
          flip_h: this.editorState.flipH,
          flip_v: this.editorState.flipV,
          brightness: this.editorState.brightness,
          contrast: this.editorState.contrast,
          saturation: this.editorState.saturation,
          sepia: this.editorState.sepia,
          grayscale: this.editorState.grayscale,
          blur: this.editorState.blur,
          invert: this.editorState.invert
        };

        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': ctx.state.csrfToken },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
          ctx.showToast(json.message || ctx.t('editor.save_success'), 'success');
          const editorModal = document.getElementById('imageEditorModal');
          if (editorModal) editorModal.classList.remove('open');
          await ctx.loadDirectory(ctx.state.currentPath, true);
        } else {
          ctx.showToast(json.error || ctx.t('editor.save_error'), 'error');
        }
      } catch (err) {
        console.error('Image editor save error:', err);
        ctx.showToast('Erreur réseau lors de la sauvegarde.', 'error');
      } finally {
        ctx.showLoading(false);
      }
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(ImageViewerPlugin);
  }
})(window);
