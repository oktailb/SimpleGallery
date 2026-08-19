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

    // Internal Explorer State
    zoomState: {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
      isDragging: false,
      startX: 0,
      startY: 0
    },

    // Internal Canvas Studio State
    editorState: {
      file: null,
      imageObj: null,
      sourceCanvas: document.createElement('canvas'),
      rotation: 0,
      flipH: false,
      flipV: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      filter: 'none',
      isCropping: false,
      cropRatio: 'free',
      cropBox: { x: 0, y: 0, w: 0, h: 0 },
      isDraggingCrop: false,
      activeCropHandle: null,
      cropDragStart: { x: 0, y: 0 },
      cropBoxStart: null,
      isInitialized: false
    },

    /**
     * Opens an image file in a WebOS Floating Window
     */
    open(file, options, ctx) {
      if (!ctx) return false;
      const index = (typeof options.index === 'number') ? options.index : ctx.state.filteredFiles.findIndex(f => f.path === file.path);
      if (index === -1) return false;

      this.currentCtx = ctx;
      this.currentFile = file;
      this.currentIndex = index;

      const isEditableImage = ctx.state.isAdmin && (file.category === 'image' || !file.category) && file.extension !== 'svg';
      const cleanPathId = encodeURIComponent(file.path).replace(/%/g, '_');
      const winId = `image-${cleanPathId}`;

      // Reset zoom state for this view
      this.resetZoom();

      if (window.WindowManager) {
        const defaultW = Math.min(920, Math.max(480, Math.round(window.innerWidth * 0.75)));
        const defaultH = Math.min(640, Math.max(360, Math.round(window.innerHeight * 0.70)));
        const appTitle = (window.sys && window.sys.appManager) 
          ? window.sys.appManager.getAppTitle('image-viewer') 
          : (ctx.t('apps.image-viewer.title') || "Visionneuse d'Images");

        const win = window.WindowManager.createWindow({
          id: winId,
          appId: 'image-viewer',
          appName: appTitle,
          fileName: file.name,
          title: `${appTitle} : ${file.name}`,
          icon: '🖼️',
          width: defaultW,
          height: defaultH,
          content: `
            <div class="webos-image-window-content" id="imgWinContent-${cleanPathId}" style="width:100%;height:100%;display:flex;flex-direction:column;position:relative;overflow:hidden;background:#090a0f;">
              <div class="image-viewer-container" id="imageViewerContainer-${cleanPathId}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;cursor:grab;">
                <img id="imgExplorer-${cleanPathId}" src="${file.file_url}" alt="${ctx.escapeHtml(file.name)}" class="explorer-img" style="max-width:100%;max-height:100%;object-fit:contain;user-select:none;transition:transform 0.15s cubic-bezier(0.2,0,0,1);" draggable="false" />
              </div>
              <div class="image-floating-toolbar" style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:rgba(15,23,42,0.85);backdrop-filter:blur(16px);padding:4px 10px;border-radius:9999px;border:1px solid rgba(255,255,255,0.15);box-shadow:0 10px 25px rgba(0,0,0,0.5);z-index:10;">
                <button type="button" class="image-explorer-btn" id="imgZoomIn-${cleanPathId}" data-i18n-title="lightbox.zoom_in" title="${ctx.escapeHtml(ctx.t('lightbox.zoom_in') || 'Zoom avant (+)')}">➕</button>
                <button type="button" class="image-explorer-btn" id="imgZoomOut-${cleanPathId}" data-i18n-title="lightbox.zoom_out" title="${ctx.escapeHtml(ctx.t('lightbox.zoom_out') || 'Zoom arrière (-)')}">➖</button>
                <button type="button" class="image-explorer-btn" id="imgReset-${cleanPathId}" data-i18n-title="lightbox.reset_zoom" title="${ctx.escapeHtml(ctx.t('lightbox.reset_zoom') || 'Réinitialiser (0)')}">🔄</button>
                <button type="button" class="image-explorer-btn" id="imgRotate-${cleanPathId}" data-i18n-title="lightbox.rotate" title="${ctx.escapeHtml(ctx.t('lightbox.rotate') || 'Pivoter 90° (R)')}">⟳</button>
                <span id="imgZoomBadge-${cleanPathId}" style="font-size:0.75rem;font-weight:700;color:#f8fafc;padding:0 4px;">100%</span>
                <button type="button" class="image-explorer-btn" id="imgInfoBtn-${cleanPathId}" data-i18n-title="lightbox.metadata_btn" title="${ctx.escapeHtml(ctx.t('lightbox.metadata_btn') || 'Informations & Propriétés (I)')}">ℹ️</button>
                ${isEditableImage ? `<button type="button" class="image-explorer-btn" id="imgEdit-${cleanPathId}" data-i18n-title="lightbox.edit_image" style="background:var(--accent-primary,#6366f1);color:#fff;border-radius:12px;padding:0 8px;width:auto;font-size:0.75rem;font-weight:600;" title="${ctx.escapeHtml(ctx.t('lightbox.edit_image') || 'Éditer l\'image')}"><span data-i18n="lightbox.edit_image_btn">🎨 ${ctx.escapeHtml(ctx.t('lightbox.edit_image_btn') || 'Éditer')}</span></button>` : ''}
              </div>
            </div>
          `,
          onFocus: () => {
            if (window.MenuBarManager) {
              window.MenuBarManager.registerAppMenu('image-viewer', (container) => {
                container.innerHTML = `
                  <div class="app-menu-left">
                    <span class="app-menu-pill active" style="font-weight:600;">🖼️ ${ctx.escapeHtml(file.name)}</span>
                    <button type="button" class="app-menu-pill" id="menuImgZoomInBtn">➕ ${ctx.escapeHtml(ctx.t('lightbox.zoom_in') || 'Zoom +')}</button>
                    <button type="button" class="app-menu-pill" id="menuImgZoomOutBtn">➖ ${ctx.escapeHtml(ctx.t('lightbox.zoom_out') || 'Zoom -')}</button>
                    <button type="button" class="app-menu-pill" id="menuImgResetBtn">🔄 ${ctx.escapeHtml(ctx.t('lightbox.reset_zoom') || '1:1')}</button>
                    <button type="button" class="app-menu-pill" id="menuImgRotateBtn">⟳ ${ctx.escapeHtml(ctx.t('lightbox.rotate') || 'Rotation 90°')}</button>
                    <button type="button" class="app-menu-pill" id="menuImgInfoBtn">ℹ️ ${ctx.escapeHtml(ctx.t('lightbox.metadata_btn') || 'Propriétés (I)')}</button>
                    ${isEditableImage ? `<button type="button" class="app-menu-pill" id="menuImgEditBtn" style="background:var(--accent-primary,#6366f1);color:#fff;">🎨 ${ctx.escapeHtml(ctx.t('lightbox.edit_image_btn') || 'Éditer')}</button>` : ''}
                  </div>
                  <div class="app-menu-right">
                    <button type="button" class="app-menu-pill" id="menuImgFsBtn">⛶ ${ctx.escapeHtml(ctx.t('lightbox.fullscreen') || 'Plein Écran')}</button>
                  </div>
                `;
                const zi = container.querySelector('#menuImgZoomInBtn');
                const zo = container.querySelector('#menuImgZoomOutBtn');
                const rz = container.querySelector('#menuImgResetBtn');
                const ro = container.querySelector('#menuImgRotateBtn');
                const info = container.querySelector('#menuImgInfoBtn');
                const ed = container.querySelector('#menuImgEditBtn');
                const fs = container.querySelector('#menuImgFsBtn');
                if (zi) zi.onclick = () => this.adjustZoom(0.3, cleanPathId);
                if (zo) zo.onclick = () => this.adjustZoom(-0.3, cleanPathId);
                if (rz) rz.onclick = () => this.resetZoom(cleanPathId);
                if (ro) ro.onclick = () => this.rotateImage(cleanPathId);
                if (info) info.onclick = () => { if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file); };
                if (ed) ed.onclick = () => this.openImageEditor(file, ctx);
                if (fs) fs.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(winId); };
              });
              window.MenuBarManager.setActiveApp('image-viewer');
            }
          }
        });

        this.bindWindowImageEvents(win, file, cleanPathId, ctx);
        return true;
      }

      // Legacy fallback
      ctx.state.lightboxIndex = index;
      ctx.el.lightboxTitle.textContent = `Visionneuse d'Image : ${file.name}`;
      ctx.el.lightboxContent.innerHTML = `
        <div class="image-viewer-container" id="imageViewerContainer">
          <img id="lightboxExplorerImg" src="${file.file_url}" alt="${ctx.escapeHtml(file.name)}" class="explorer-img" draggable="false" />
        </div>
      `;
      this.bindExplorerEvents(ctx);
      ctx.el.lightbox.classList.add('open');
      return true;
    },

    bindWindowImageEvents(win, file, cleanPathId, ctx) {
      const img = document.getElementById(`imgExplorer-${cleanPathId}`);
      const container = document.getElementById(`imageViewerContainer-${cleanPathId}`);
      if (!img || !container) return;

      const zoomInBtn = document.getElementById(`imgZoomIn-${cleanPathId}`);
      const zoomOutBtn = document.getElementById(`imgZoomOut-${cleanPathId}`);
      const resetBtn = document.getElementById(`imgReset-${cleanPathId}`);
      const rotateBtn = document.getElementById(`imgRotate-${cleanPathId}`);
      const infoBtn = document.getElementById(`imgInfoBtn-${cleanPathId}`);
      const editBtn = document.getElementById(`imgEdit-${cleanPathId}`);

      if (zoomInBtn) zoomInBtn.onclick = () => this.adjustZoom(0.3, cleanPathId);
      if (zoomOutBtn) zoomOutBtn.onclick = () => this.adjustZoom(-0.3, cleanPathId);
      if (resetBtn) resetBtn.onclick = () => this.resetZoom(cleanPathId);
      if (rotateBtn) rotateBtn.onclick = () => this.rotateImage(cleanPathId);
      if (infoBtn) infoBtn.onclick = () => { if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file); };
      if (editBtn) editBtn.onclick = () => this.openImageEditor(file, ctx);

      // Keyboard shortcut I for info
      const keyHandler = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'i' || e.key === 'I') {
          if (win.element && win.element.classList.contains('active')) {
            if (window.sys && window.sys.showMetadata) window.sys.showMetadata(file);
          }
        }
      };
      window.addEventListener('keydown', keyHandler);

      // Pan Drag
      container.onmousedown = (e) => this.startDrag(e, cleanPathId);
      window.addEventListener('mousemove', (e) => this.doDrag(e, cleanPathId));
      window.addEventListener('mouseup', (e) => this.endDrag(e, cleanPathId));

      // Wheel Zoom
      container.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        this.adjustZoom(delta, cleanPathId);
      };

      // Double Click Zoom
      img.ondblclick = (e) => {
        e.stopPropagation();
        if (this.zoomState.scale > 1) {
          this.resetZoom(cleanPathId);
        } else {
          this.adjustZoom(1.5, cleanPathId);
        }
      };
    },

    resetZoom(cleanPathId = null) {
      this.zoomState = {
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotation: 0,
        isDragging: false,
        startX: 0,
        startY: 0
      };
      this.updateExplorerTransform(true, cleanPathId);
    },

    clampTranslate(cleanPathId = null) {
      const img = (cleanPathId && document.getElementById(`imgExplorer-${cleanPathId}`)) || document.querySelector('.webos-window.active .explorer-img') || document.getElementById('lightboxExplorerImg');
      if (!img) return;

      const { scale, rotation } = this.zoomState;
      if (scale <= 1) {
        this.zoomState.translateX = 0;
        this.zoomState.translateY = 0;
        return;
      }

      const container = (cleanPathId && document.getElementById(`imageViewerContainer-${cleanPathId}`)) || img.parentElement;
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

    adjustZoom(delta, cleanPathId = null) {
      let newScale = Math.min(Math.max(1, this.zoomState.scale + delta), 5);
      newScale = Math.round(newScale * 100) / 100;

      if (newScale === 1) {
        this.zoomState.translateX = 0;
        this.zoomState.translateY = 0;
      }

      this.zoomState.scale = newScale;
      this.clampTranslate(cleanPathId);
      this.updateExplorerTransform(true, cleanPathId);
    },

    rotateImage(cleanPathId = null) {
      this.zoomState.rotation = (this.zoomState.rotation + 90) % 360;
      this.clampTranslate(cleanPathId);
      this.updateExplorerTransform(true, cleanPathId);
    },

    startDrag(e, cleanPathId = null) {
      if (this.zoomState.scale <= 1) return;
      if (e.target.closest('button, input, a, .image-floating-toolbar, .webos-window-header')) return;
      e.preventDefault();

      this.zoomState.isDragging = true;
      this.zoomState.startX = e.clientX - this.zoomState.translateX;
      this.zoomState.startY = e.clientY - this.zoomState.translateY;

      const img = (cleanPathId && document.getElementById(`imgExplorer-${cleanPathId}`)) || document.querySelector('.webos-window.active .explorer-img') || document.getElementById('lightboxExplorerImg');
      if (img) img.classList.add('is-panning');
    },

    doDrag(e, cleanPathId = null) {
      if (!this.zoomState.isDragging) return;
      e.preventDefault();
      this.zoomState.translateX = e.clientX - this.zoomState.startX;
      this.zoomState.translateY = e.clientY - this.zoomState.startY;
      this.clampTranslate(cleanPathId);
      this.updateExplorerTransform(false, cleanPathId);
    },

    endDrag(e, cleanPathId = null) {
      if (!this.zoomState.isDragging) return;
      this.zoomState.isDragging = false;
      const img = (cleanPathId && document.getElementById(`imgExplorer-${cleanPathId}`)) || document.querySelector('.webos-window.active .explorer-img') || document.getElementById('lightboxExplorerImg');
      if (img) img.classList.remove('is-panning');
      this.updateExplorerTransform(true, cleanPathId);
    },

    updateExplorerTransform(withTransition = true, cleanPathId = null) {
      const img = (cleanPathId && document.getElementById(`imgExplorer-${cleanPathId}`)) || document.querySelector('.webos-window.active .explorer-img') || document.getElementById('lightboxExplorerImg');
      if (!img) return;

      img.style.transition = withTransition ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' : 'none';
      img.style.transform = `translate(${this.zoomState.translateX}px, ${this.zoomState.translateY}px) scale(${this.zoomState.scale}) rotate(${this.zoomState.rotation}deg)`;

      const badge = (cleanPathId && document.getElementById(`imgZoomBadge-${cleanPathId}`)) || document.querySelector('.webos-window.active [id^="imgZoomBadge"]') || document.getElementById('zoomBadge');
      if (badge) {
        badge.textContent = `${Math.round(this.zoomState.scale * 100)}%`;
      }
    },

    // -------------------------------------------------------------
    // CANVAS RETOUCHING STUDIO & CROP/FILTER ENGINE
    // -------------------------------------------------------------
    openImageEditor(file, ctx) {
      const modal = document.getElementById('imageEditorModal');
      if (!modal) return;

      this.editorState.file = file;
      const nameBadge = document.getElementById('editorImageNameBadge');
      if (nameBadge) nameBadge.textContent = file.name;

      if (!this.editorState.isInitialized) {
        this.initEditorControls(ctx);
        this.editorState.isInitialized = true;
      }

      ctx.showLoading(true);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.showLoading(false);
        this.editorState.imageObj = img;
        
        // Initialize source canvas with original image resolution
        const srcCanvas = this.editorState.sourceCanvas;
        srcCanvas.width = img.naturalWidth;
        srcCanvas.height = img.naturalHeight;
        const sctx = srcCanvas.getContext('2d');
        sctx.drawImage(img, 0, 0);

        this.resetImageEditorState();
        modal.classList.add('open');
        this.renderEditorCanvas();
      };

      img.onerror = () => {
        ctx.showLoading(false);
        ctx.showToast(ctx.t('editor.load_error') || "⚠️ Impossible de charger l'image pour l'édition.", 'error');
      };

      img.src = file.file_url + (file.file_url.includes('?') ? '&' : '?') + 't=' + Date.now();
    },

    closeImageEditor() {
      const modal = document.getElementById('imageEditorModal');
      if (!modal) return;
      modal.classList.remove('open');
      this.closeSaveChoiceModal();
    },

    initEditorControls(ctx) {
      const closeBtn = document.getElementById('imageEditorCloseBtn');
      if (closeBtn) closeBtn.onclick = () => this.closeImageEditor();

      const resetAllBtn = document.getElementById('editorResetAllBtn');
      if (resetAllBtn) resetAllBtn.onclick = () => this.resetImageEditor();

      // Rotation & Flip Controls
      const rotCcwBtn = document.getElementById('editorRotateCcwBtn');
      const rotCwBtn = document.getElementById('editorRotateCwBtn');
      const flipHBtn = document.getElementById('editorFlipHBtn');
      const flipVBtn = document.getElementById('editorFlipVBtn');

      if (rotCcwBtn) rotCcwBtn.onclick = () => this.rotateEditor(-90);
      if (rotCwBtn) rotCwBtn.onclick = () => this.rotateEditor(90);
      if (flipHBtn) flipHBtn.onclick = () => this.flipEditor('h');
      if (flipVBtn) flipVBtn.onclick = () => this.flipEditor('v');

      // Crop Toggle & Apply
      const toggleCropBtn = document.getElementById('editorToggleCropBtn');
      const applyCropBtn = document.getElementById('editorApplyCropBtn');
      if (toggleCropBtn) toggleCropBtn.onclick = () => this.toggleCrop();
      if (applyCropBtn) applyCropBtn.onclick = () => this.applyCrop();

      // Crop Aspect Ratios
      const ratioBtns = document.querySelectorAll('.crop-ratio-btn');
      ratioBtns.forEach(btn => {
        btn.onclick = () => {
          ratioBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.editorState.cropRatio = btn.dataset.ratio || 'free';
          if (!this.editorState.isCropping) {
            this.toggleCrop(true);
          } else {
            this.initDefaultCropBox();
            this.updateCropBoxDOM();
          }
        };
      });

      // Color Adjustments Sliders
      const setupSlider = (id, prop, unit = '%') => {
        const slider = document.getElementById(id);
        const valSpan = document.getElementById(`${id.replace('Slider', 'Val')}`);
        if (slider) {
          slider.oninput = (e) => {
            this.editorState[prop] = parseInt(e.target.value, 10);
            if (valSpan) valSpan.textContent = `${this.editorState[prop]}${unit}`;
            this.renderEditorCanvas();
          };
        }
      };

      setupSlider('editorBrightnessSlider', 'brightness');
      setupSlider('editorContrastSlider', 'contrast');
      setupSlider('editorSaturationSlider', 'saturation');

      // Quick Filter Buttons
      const filterBtns = document.querySelectorAll('.editor-filter-btn');
      filterBtns.forEach(btn => {
        btn.onclick = () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.editorState.filter = btn.dataset.filter || 'none';
          this.renderEditorCanvas();
        };
      });

      // Save Choice Trigger
      const openSaveChoiceBtn = document.getElementById('editorOpenSaveChoiceBtn');
      if (openSaveChoiceBtn) openSaveChoiceBtn.onclick = () => this.openSaveChoiceModal(ctx);

      const saveChoiceCloseBtn = document.getElementById('saveChoiceCloseBtn');
      const saveChoiceCancelBtn = document.getElementById('saveChoiceCancelBtn');
      if (saveChoiceCloseBtn) saveChoiceCloseBtn.onclick = () => this.closeSaveChoiceModal();
      if (saveChoiceCancelBtn) saveChoiceCancelBtn.onclick = () => this.closeSaveChoiceModal();

      const choiceModal = document.getElementById('imageSaveChoiceModal');
      if (choiceModal) {
        choiceModal.onclick = (e) => {
          if (e.target === choiceModal) this.closeSaveChoiceModal();
        };
      }

      const saveChoiceConfirmBtn = document.getElementById('saveChoiceConfirmBtn');
      if (saveChoiceConfirmBtn) {
        saveChoiceConfirmBtn.onclick = () => {
          const radio = document.querySelector('input[name="saveImageModeRadio"]:checked');
          const saveMode = radio ? radio.value : 'copy';
          this.saveEditedImage(saveMode, ctx);
        };
      }

      // Crop Drag & Resize Interactions
      this.initCropInteractions();
    },

    resetImageEditorState() {
      this.editorState.rotation = 0;
      this.editorState.flipH = false;
      this.editorState.flipV = false;
      this.editorState.brightness = 0;
      this.editorState.contrast = 0;
      this.editorState.saturation = 0;
      this.editorState.filter = 'none';
      this.editorState.isCropping = false;
      this.editorState.cropRatio = 'free';

      const bSlider = document.getElementById('editorBrightnessSlider');
      const cSlider = document.getElementById('editorContrastSlider');
      const sSlider = document.getElementById('editorSaturationSlider');
      const bVal = document.getElementById('editorBrightnessVal');
      const cVal = document.getElementById('editorContrastVal');
      const sVal = document.getElementById('editorSaturationVal');

      if (bSlider) bSlider.value = '0';
      if (cSlider) cSlider.value = '0';
      if (sSlider) sSlider.value = '0';
      if (bVal) bVal.textContent = '0%';
      if (cVal) cVal.textContent = '0%';
      if (sVal) sVal.textContent = '0%';

      document.querySelectorAll('.editor-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
      document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === 'free'));

      const cropBox = document.getElementById('editorCropBox');
      const toggleCropBtn = document.getElementById('editorToggleCropBtn');
      if (cropBox) cropBox.style.display = 'none';
      if (toggleCropBtn) toggleCropBtn.classList.remove('active');
    },

    resetImageEditor() {
      if (!this.editorState.imageObj) return;
      const srcCanvas = this.editorState.sourceCanvas;
      srcCanvas.width = this.editorState.imageObj.naturalWidth;
      srcCanvas.height = this.editorState.imageObj.naturalHeight;
      const sctx = srcCanvas.getContext('2d');
      sctx.drawImage(this.editorState.imageObj, 0, 0);

      this.resetImageEditorState();
      this.renderEditorCanvas();
    },

    rotateEditor(degrees) {
      this.editorState.rotation = (this.editorState.rotation + degrees + 360) % 360;
      this.renderEditorCanvas();
      if (this.editorState.isCropping) {
        this.initDefaultCropBox();
        this.updateCropBoxDOM();
      }
    },

    flipEditor(axis) {
      if (axis === 'h') this.editorState.flipH = !this.editorState.flipH;
      if (axis === 'v') this.editorState.flipV = !this.editorState.flipV;
      this.renderEditorCanvas();
    },

    toggleCrop(forceState) {
      const nextState = (forceState !== undefined) ? forceState : !this.editorState.isCropping;
      this.editorState.isCropping = nextState;
      const toggleCropBtn = document.getElementById('editorToggleCropBtn');
      const cropBox = document.getElementById('editorCropBox');
      if (toggleCropBtn) toggleCropBtn.classList.toggle('active', nextState);
      if (cropBox) cropBox.style.display = nextState ? 'block' : 'none';

      if (nextState) {
        this.initDefaultCropBox();
        this.updateCropBoxDOM();
      }
    },

    initDefaultCropBox() {
      const canvas = document.getElementById('editorCanvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const displayW = rect.width;
      const displayH = rect.height;

      let cropW = displayW * 0.8;
      let cropH = displayH * 0.8;

      if (this.editorState.cropRatio !== 'free') {
        const parts = this.editorState.cropRatio.split(':').map(Number);
        if (parts.length === 2) {
          const aspect = parts[0] / parts[1];
          if (cropW / cropH > aspect) {
            cropW = cropH * aspect;
          } else {
            cropH = cropW / aspect;
          }
        }
      }

      this.editorState.cropBox = {
        x: (displayW - cropW) / 2,
        y: (displayH - cropH) / 2,
        w: cropW,
        h: cropH
      };
    },

    updateCropBoxDOM() {
      const cropBox = document.getElementById('editorCropBox');
      if (!cropBox) return;
      const b = this.editorState.cropBox;
      cropBox.style.left = `${b.x}px`;
      cropBox.style.top = `${b.y}px`;
      cropBox.style.width = `${b.w}px`;
      cropBox.style.height = `${b.h}px`;
    },

    initCropInteractions() {
      const cropBox = document.getElementById('editorCropBox');
      const wrapper = document.getElementById('editorCanvasWrapper');
      if (!cropBox || !wrapper) return;

      const onPointerDown = (clientX, clientY, handle) => {
        this.editorState.isDraggingCrop = true;
        this.editorState.activeCropHandle = handle;
        this.editorState.cropDragStart = { x: clientX, y: clientY };
        this.editorState.cropBoxStart = { ...this.editorState.cropBox };
      };

      cropBox.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const handle = e.target.dataset.handle || null;
        onPointerDown(e.clientX, e.clientY, handle);
      });

      cropBox.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          e.stopPropagation();
          const handle = e.target.dataset.handle || null;
          onPointerDown(e.touches[0].clientX, e.touches[0].clientY, handle);
        }
      }, { passive: false });

      const onPointerMove = (clientX, clientY) => {
        if (!this.editorState.isDraggingCrop) return;
        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;

        const maxW = canvas.getBoundingClientRect().width;
        const maxH = canvas.getBoundingClientRect().height;
        const dx = clientX - this.editorState.cropDragStart.x;
        const dy = clientY - this.editorState.cropDragStart.y;
        const start = this.editorState.cropBoxStart;
        const handle = this.editorState.activeCropHandle;
        const minSize = 30;

        let newBox = { ...start };

        if (!handle) {
          // Drag entire crop box
          newBox.x = Math.max(0, Math.min(maxW - start.w, start.x + dx));
          newBox.y = Math.max(0, Math.min(maxH - start.h, start.y + dy));
        } else {
          // Resize via handles
          if (handle.includes('e')) newBox.w = Math.max(minSize, Math.min(maxW - start.x, start.w + dx));
          if (handle.includes('s')) newBox.h = Math.max(minSize, Math.min(maxH - start.y, start.h + dy));
          if (handle.includes('w')) {
            const adjDx = Math.min(dx, start.w - minSize);
            newBox.x = Math.max(0, start.x + adjDx);
            newBox.w = start.w - (newBox.x - start.x);
          }
          if (handle.includes('n')) {
            const adjDy = Math.min(dy, start.h - minSize);
            newBox.y = Math.max(0, start.y + adjDy);
            newBox.h = start.h - (newBox.y - start.y);
          }

          // Apply aspect ratio constraint
          if (this.editorState.cropRatio !== 'free') {
            const parts = this.editorState.cropRatio.split(':').map(Number);
            if (parts.length === 2) {
              const aspect = parts[0] / parts[1];
              if (handle === 'e' || handle === 'w' || handle.includes('e') || handle.includes('w')) {
                newBox.h = newBox.w / aspect;
              } else {
                newBox.w = newBox.h * aspect;
              }
            }
          }
        }

        this.editorState.cropBox = newBox;
        this.updateCropBoxDOM();
      };

      window.addEventListener('mousemove', (e) => {
        if (this.editorState.isDraggingCrop) {
          e.preventDefault();
          onPointerMove(e.clientX, e.clientY);
        }
      });

      window.addEventListener('touchmove', (e) => {
        if (this.editorState.isDraggingCrop && e.touches.length === 1) {
          e.preventDefault();
          onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: false });

      const onPointerUp = () => {
        this.editorState.isDraggingCrop = false;
        this.editorState.activeCropHandle = null;
      };

      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
    },

    applyCrop() {
      if (!this.editorState.isCropping) return;
      const canvas = document.getElementById('editorCanvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const box = this.editorState.cropBox;
      const cropX = Math.round(box.x * scaleX);
      const cropY = Math.round(box.y * scaleY);
      const cropW = Math.round(box.w * scaleX);
      const cropH = Math.round(box.h * scaleY);

      if (cropW <= 0 || cropH <= 0) return;

      // Extract cropped pixels from current display canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cctx = cropCanvas.getContext('2d');
      cctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Store cropped output back into sourceCanvas
      const srcCanvas = this.editorState.sourceCanvas;
      srcCanvas.width = cropW;
      srcCanvas.height = cropH;
      const sctx = srcCanvas.getContext('2d');
      sctx.drawImage(cropCanvas, 0, 0);

      // Reset transformations
      this.editorState.rotation = 0;
      this.editorState.flipH = false;
      this.editorState.flipV = false;

      this.toggleCrop(false);
      this.renderEditorCanvas();
    },

    renderEditorCanvas() {
      const canvas = document.getElementById('editorCanvas');
      const src = this.editorState.sourceCanvas;
      if (!canvas || !src || src.width <= 0 || src.height <= 0) return;

      const rot = this.editorState.rotation;
      const isRotated90 = (rot === 90 || rot === 270);
      const destW = isRotated90 ? src.height : src.width;
      const destH = isRotated90 ? src.width : src.height;

      canvas.width = destW;
      canvas.height = destH;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, destW, destH);

      ctx.save();
      ctx.translate(destW / 2, destH / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(this.editorState.flipH ? -1 : 1, this.editorState.flipV ? -1 : 1);

      // Build CSS filter string for canvas draw
      const b = 100 + this.editorState.brightness;
      const c = 100 + this.editorState.contrast;
      const s = 100 + this.editorState.saturation;
      let filterStr = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

      if (this.editorState.filter === 'grayscale') filterStr += ' grayscale(100%)';
      if (this.editorState.filter === 'sepia') filterStr += ' sepia(85%)';
      if (this.editorState.filter === 'warm') filterStr += ' sepia(35%) saturate(140%)';
      if (this.editorState.filter === 'invert') filterStr += ' invert(100%)';

      ctx.filter = filterStr;
      ctx.drawImage(src, -src.width / 2, -src.height / 2);
      ctx.restore();

      const dimBadge = document.getElementById('editorImageDimBadge');
      if (dimBadge) {
        dimBadge.textContent = `${destW} × ${destH} px`;
      }
    },

    openSaveChoiceModal(ctx) {
      const choiceModal = document.getElementById('imageSaveChoiceModal');
      if (!choiceModal) return;

      const file = this.editorState.file;
      const preview = document.getElementById('saveChoiceCopyNamePreview');
      if (file && preview) {
        const parts = file.name.split('.');
        const ext = parts.length > 1 ? '.' + parts.pop() : '';
        const base = parts.join('.');
        const cleanBase = base.replace(/_edited(_\d+)?$/i, '');
        preview.textContent = `${cleanBase}_edited${ext}`;
      }

      choiceModal.classList.add('open');
    },

    closeSaveChoiceModal() {
      const choiceModal = document.getElementById('imageSaveChoiceModal');
      if (!choiceModal) return;
      choiceModal.classList.remove('open');
    },

    async saveEditedImage(saveMode, ctx) {
      const canvas = document.getElementById('editorCanvas');
      const file = this.editorState.file;
      if (!canvas || !file) return;

      ctx.showLoading(true);

      try {
        const ext = (file.extension || 'jpg').toLowerCase();
        const mime = (ext === 'png') ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
        const quality = (mime === 'image/png') ? undefined : 0.92;
        const dataUrl = canvas.toDataURL(mime, quality);

        const payload = {
          action: 'edit_image',
          target_path: file.path,
          save_mode: saveMode,
          image_data: dataUrl,
          csrf_token: ctx.state.csrfToken
        };

        const res = await fetch('api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': ctx.state.csrfToken
          },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        ctx.showLoading(false);

        if (json.success) {
          this.closeSaveChoiceModal();
          this.closeImageEditor();
          ctx.showToast(json.message || 'Image enregistrée avec succès !', 'success');

          // Reload gallery directory to display new/updated image
          await ctx.loadDirectory(ctx.state.currentPath);

          // If lightbox is open, refresh preview
          if (ctx.state.lightboxIndex !== null) {
            if (saveMode === 'overwrite') {
              ctx.openLightbox(ctx.state.lightboxIndex);
            } else {
              const copyIdx = ctx.state.filteredFiles.findIndex(f => f.name === json.file_name);
              if (copyIdx !== -1) {
                ctx.openLightbox(copyIdx);
              }
            }
          }
        } else {
          ctx.showToast('⚠️ ' + (json.error || 'Erreur lors de la sauvegarde.'), 'error');
        }
      } catch (err) {
        ctx.showLoading(false);
        ctx.showToast('⚠️ Erreur réseau lors de la sauvegarde : ' + err.message, 'error');
      }
    }
  };

  if (window.MediaViewerRegistry) {
    window.MediaViewerRegistry.register(ImageViewerPlugin);
  }
})(window);
