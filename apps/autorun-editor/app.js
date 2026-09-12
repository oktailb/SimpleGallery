/**
 * SimpleGallery - Autorun Studio Application (apps/autorun-editor/app.js)
 * Autonomous timeline authoring and orchestrating studio for multimodal narratives.
 */
(function(window, document) {
  'use strict';

  const WebOSApp = (window.sys && window.sys.App) || window.WebOSApp || Object;

  class AutorunEditorApp extends WebOSApp {
    constructor() {
      super({
        id: 'autorun-editor',
        title: 'apps.autorun-editor.title',
        icon: '🎬',
        width: 820,
        height: 640
      });

      this.currentPath = '';
      this.currentFiles = [];
      this.currentConfig = null;
      this.activeTab = 'visual';
      this.winInstance = null;

      // Expose globally so Explorer or any app can trigger it easily
      window.AutorunStudio = this;
    }

    t(key, params) {
      if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
        return window.sys.i18n.t(key, params);
      }
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, params);
      }
      return key;
    }

    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    renderShell() {
      const template = document.getElementById('autorunEditorAppTemplate');
      const innerHtml = template && template.innerHTML ? template.innerHTML : '';
      return `
        <div class="webos-app-shell autorun-studio-shell" id="${this.id}AppContainer" style="display:flex; flex-direction:column; height:100%; width:100%; padding:0; margin:0; box-sizing:border-box; overflow:hidden;">
          <div class="webos-app-body" id="${this.id}BodyContent" style="flex:1; height:100%; width:100%; display:flex; flex-direction:column; overflow:hidden;">
            ${innerHtml}
          </div>
        </div>
      `;
    }

    render() {
      // Retain custom UI state and prevent template being overwritten by base WebOSApp render()
    }

    onOpen(params = {}) {
      const path = (typeof params === 'string') ? params : (params.path || params.dir || '');
      this.currentPath = path;
      this.initUI();
      this.loadFolder(path, params.config);
    }

    initUI() {
      const winEl = (this.window && this.window.element) || document.getElementById(`${this.id}AppContainer`) || document;
      let root = winEl.querySelector('.autorun-studio-container');

      // If template markup was not yet rendered into container, clone and mount it
      if (!root) {
        const template = document.getElementById('autorunEditorAppTemplate');
        if (template && template.content) {
          const clone = template.content.cloneNode(true).firstElementChild;
          const bodyEl = document.getElementById(`${this.id}BodyContent`) || (this.window && this.window.bodyEl);
          if (bodyEl && clone) {
            bodyEl.innerHTML = '';
            bodyEl.appendChild(clone);
            root = clone;
          }
        }
      }

      if (!root) return;

      this.el = {
        container: root,
        folderBadge: root.querySelector('[data-folder-badge]'),
        tabVisualBtn: root.querySelector('[data-tab="visual"]'),
        tabJsonBtn: root.querySelector('[data-tab="json"]'),
        visualView: root.querySelector('[data-visual-view]'),
        jsonView: root.querySelector('[data-json-view]'),
        metaTitle: root.querySelector('[data-meta-title]'),
        metaLayout: root.querySelector('[data-meta-layout]'),
        metaDesc: root.querySelector('[data-meta-desc]'),
        masterType: root.querySelector('[data-master-type]'),
        masterFile: root.querySelector('[data-master-file]'),
        masterFileField: root.querySelector('[data-master-file-field]'),
        masterDuration: root.querySelector('[data-master-duration]'),
        masterDurationField: root.querySelector('[data-master-duration-field]'),
        addStepBtn: root.querySelector('[data-add-step-btn]'),
        timelineList: root.querySelector('[data-timeline-list]'),
        rawJson: root.querySelector('[data-raw-json]'),
        deleteBtn: root.querySelector('[data-delete-btn]'),
        previewBtn: root.querySelector('[data-preview-btn]'),
        saveBtn: root.querySelector('[data-save-btn]')
      };

      // Tab switching
      if (this.el.tabVisualBtn) this.el.tabVisualBtn.onclick = () => this.switchTab('visual');
      if (this.el.tabJsonBtn) this.el.tabJsonBtn.onclick = () => this.switchTab('json');

      // Live JSON input listener
      if (this.el.rawJson) {
        this.el.rawJson.oninput = () => {
          try {
            this.currentConfig = JSON.parse(this.el.rawJson.value);
          } catch (e) {
            // While typing, invalid JSON is expected; do not break
          }
        };
      }

      // Live visual metadata change listeners
      const onVisualMetaChange = () => {
        if (this.activeTab === 'visual') {
          this.syncVisualToConfig();
          if (this.el.rawJson) {
            this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
          }
        }
      };
      if (this.el.metaTitle) this.el.metaTitle.oninput = onVisualMetaChange;
      if (this.el.metaLayout) this.el.metaLayout.onchange = onVisualMetaChange;
      if (this.el.metaDesc) this.el.metaDesc.oninput = onVisualMetaChange;
      if (this.el.masterFile) this.el.masterFile.onchange = onVisualMetaChange;
      if (this.el.masterDuration) this.el.masterDuration.oninput = onVisualMetaChange;

      // Master type change
      if (this.el.masterType) {
        this.el.masterType.onchange = () => {
          const type = this.el.masterType.value;
          if (this.el.masterFileField) this.el.masterFileField.style.display = (type === 'timer') ? 'none' : 'flex';
          if (this.el.masterDurationField) this.el.masterDurationField.style.display = (type === 'timer') ? 'flex' : 'none';
          onVisualMetaChange();
        };
      }

      // Add Step
      if (this.el.addStepBtn) this.el.addStepBtn.onclick = () => this.addStep();

      // Preview / Save / Delete
      if (this.el.previewBtn) this.el.previewBtn.onclick = () => this.preview();
      if (this.el.saveBtn) this.el.saveBtn.onclick = () => this.save();
      if (this.el.deleteBtn) this.el.deleteBtn.onclick = () => this.delete();

      if (typeof this.setContent === 'function') {
        this.setContent(root);
      }
    }

    async loadFolder(dirPath, existingConfig = null) {
      const cleanPath = (dirPath === '.' || !dirPath) ? '' : String(dirPath).trim();
      this.currentPath = cleanPath;
      if (this.el.folderBadge) {
        this.el.folderBadge.textContent = cleanPath ? `📁 ${cleanPath}` : '📁 (Racine)';
      }

      try {
        const json = await window.sys.api.get('get_gallery', { dir: cleanPath, _t: Date.now() });
        this.currentFiles = (json && json.files) || [];

        // 1. Prefer fresh config from server overrides if present
        let config = null;
        if (json && json.overrides && json.overrides.autorun) {
          config = json.overrides.autorun;
        } else if (existingConfig) {
          config = existingConfig;
        }

        const folderName = cleanPath ? cleanPath.split('/').pop() : 'Présentation WebOS';
        const defaultVideo = this.currentFiles.find(f => f.category === 'video');
        const defaultAudio = this.currentFiles.find(f => f.category === 'audio');

        if (!config) {
          config = {
            version: '2.0',
            title: folderName,
            description: 'Récit immersif synchronisé avec nos médias et applications WebOS',
            layout: 'split-horizontal',
            master: {
              type: defaultVideo ? 'video' : (defaultAudio ? 'audio' : 'timer'),
              file: defaultVideo ? defaultVideo.name : (defaultAudio ? defaultAudio.name : ''),
              duration: '120'
            },
            timeline: [
              { time: '00:00', title: 'Introduction', action: 'open_app', app: 'maps', params: { lat: 48.8566, lng: 2.3522, zoom: 12 } }
            ]
          };
        } else {
          config = JSON.parse(JSON.stringify(config));

          // Normalize window_layout -> layout
          if (!config.layout && config.window_layout) {
            config.layout = config.window_layout;
          }

          // Normalize master from lead_media if master is missing or empty
          if (!config.master || (!config.master.file && config.lead_media && config.lead_media.file)) {
            config.master = {
              type: (config.lead_media && config.lead_media.app === 'viewer-audio') ? 'audio' : 'video',
              file: (config.lead_media && config.lead_media.file) || (config.master && config.master.file) || '',
              duration: config.duration || (config.master && config.master.duration) || '120'
            };
          }

          // Normalize timeline from steps if timeline is empty or missing, or if timeline has only a blank dummy step
          const hasTimelineSteps = Array.isArray(config.timeline) && config.timeline.length > 0 && config.timeline.some(t => t.file || t.app || t.action);
          if (!hasTimelineSteps && Array.isArray(config.steps) && config.steps.length > 0) {
            config.timeline = config.steps.map(s => ({
              time: s.time || '00:00',
              title: s.title || s.chapter || '',
              action: s.action || 'open_app',
              app: (s.app === 'viewer-video' ? 'video-player' : (s.app === 'viewer-text' ? 'doc-viewer' : (s.app || 'video-player'))),
              file: s.file || (s.params && s.params.file) || '',
              params: s.params || (s.file ? { file: s.file } : {})
            }));
          }
        }

        this.currentConfig = config;
        this.populateMeta();
        this.populateMasterFiles(config.master ? config.master.file : '');
        this.renderTimeline();

        // Immediately synchronize the raw JSON textarea so the JSON tab is never desynchronized
        if (this.el.rawJson) {
          this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
        }

        // Reset to active tab or visual tab
        this.switchTab(this.activeTab || 'visual');

        if (this.el.deleteBtn) {
          this.el.deleteBtn.style.display = (json && json.overrides && json.overrides.has_autorun) ? 'inline-block' : 'none';
        }
      } catch (err) {
        console.error('[AutorunStudio] Error loading folder:', err);
      }
    }

    populateMeta() {
      if (!this.currentConfig) return;
      if (this.el.metaTitle) this.el.metaTitle.value = this.currentConfig.title || '';
      if (this.el.metaLayout) this.el.metaLayout.value = this.currentConfig.layout || this.currentConfig.window_layout || 'split-horizontal';
      if (this.el.metaDesc) this.el.metaDesc.value = this.currentConfig.description || '';

      const mType = (this.currentConfig.master && this.currentConfig.master.type) || 'video';
      if (this.el.masterType) {
        this.el.masterType.value = mType;
        this.el.masterType.dispatchEvent(new Event('change'));
      }
      if (this.el.masterDuration) {
        this.el.masterDuration.value = (this.currentConfig.master && this.currentConfig.master.duration) || '120';
      }
    }

    populateMasterFiles(selectedFileName = '') {
      if (!this.el.masterFile) return;
      const mediaFiles = this.currentFiles.filter(f => f.category === 'video' || f.category === 'audio' || f.name.match(/\.(mp4|webm|mov|mkv|mp3|wav|ogg|flac)$/i));

      let html = '<option value="">(Aucun média)</option>';
      mediaFiles.forEach(f => {
        const isSel = (f.name === selectedFileName || f.path === selectedFileName) ? 'selected' : '';
        const icon = f.category === 'video' ? '🎬' : '🎵';
        html += `<option value="${this.escapeHtml(f.name)}" ${isSel}>${icon} ${this.escapeHtml(f.name)}</option>`;
      });
      this.el.masterFile.innerHTML = html;
    }

    switchTab(tabId) {
      this.activeTab = tabId;
      if (tabId === 'visual') {
        if (this.el.rawJson && this.el.rawJson.value) {
          try {
            const parsed = JSON.parse(this.el.rawJson.value);
            this.currentConfig = parsed;
            this.populateMeta();
            this.populateMasterFiles(parsed.master ? parsed.master.file : '');
            this.renderTimeline();
          } catch (e) {
            alert('JSON Invalide : ' + e.message);
            return;
          }
        }
        if (this.el.visualView) this.el.visualView.style.display = 'block';
        if (this.el.jsonView) this.el.jsonView.style.display = 'none';
        if (this.el.tabVisualBtn) this.el.tabVisualBtn.classList.add('active');
        if (this.el.tabJsonBtn) this.el.tabJsonBtn.classList.remove('active');
      } else {
        this.syncVisualToConfig();
        if (this.el.rawJson) {
          this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
        }
        if (this.el.visualView) this.el.visualView.style.display = 'none';
        if (this.el.jsonView) this.el.jsonView.style.display = 'block';
        if (this.el.tabVisualBtn) this.el.tabVisualBtn.classList.remove('active');
        if (this.el.tabJsonBtn) this.el.tabJsonBtn.classList.add('active');
      }
    }

    syncVisualToConfig() {
      if (!this.currentConfig) this.currentConfig = {};
      this.currentConfig.version = '2.0';
      if (this.el.metaTitle) this.currentConfig.title = this.el.metaTitle.value;
      if (this.el.metaLayout) {
        this.currentConfig.layout = this.el.metaLayout.value;
        if (this.currentConfig.window_layout) this.currentConfig.window_layout = this.el.metaLayout.value;
      }
      if (this.el.metaDesc) this.currentConfig.description = this.el.metaDesc.value;

      this.currentConfig.master = {
        type: this.el.masterType ? this.el.masterType.value : 'video',
        file: this.el.masterFile ? this.el.masterFile.value : '',
        duration: this.el.masterDuration ? this.el.masterDuration.value : '120'
      };

      if (this.el.timelineList) {
        const cards = this.el.timelineList.querySelectorAll('.autorun-studio-step-card');
        const timeline = [];
        cards.forEach(card => {
          const time = card.querySelector('[data-step-time]')?.value || '00:00';
          const title = card.querySelector('[data-step-title]')?.value || '';
          const action = card.querySelector('[data-step-action]')?.value || 'open_app';
          const app = card.querySelector('[data-step-app]')?.value || '';
          let file = card.querySelector('[data-step-file]')?.value || '';
          if (file === '[object Object]') file = '';
          const pos = card.querySelector('[data-step-pos]')?.value || 'auto';
          const command = card.querySelector('[data-step-cmd]')?.value || '';
          const lat = card.querySelector('[data-step-lat]')?.value;
          const lng = card.querySelector('[data-step-lng]')?.value;
          const zoom = card.querySelector('[data-step-zoom]')?.value;
          const highlight = card.querySelector('[data-step-hl]')?.value || '';
          const message = card.querySelector('[data-step-msg]')?.value || '';

          const stepObj = { time, title, action };
          if (pos && pos !== 'auto') {
            stepObj.position = pos;
          }

          if (action === 'open_app') {
            stepObj.app = app;
            stepObj.params = {};
            if (file) {
              stepObj.file = file;
              stepObj.params.file = file;
            }
            if (highlight) stepObj.params.highlight = highlight;
            if (pos && pos !== 'auto') stepObj.params.position = pos;
            if (app === 'maps') {
              if (lat != null && lat !== '') stepObj.params.lat = parseFloat(lat);
              if (lng != null && lng !== '') stepObj.params.lng = parseFloat(lng);
              if (zoom != null && zoom !== '') stepObj.params.zoom = parseInt(zoom, 10);
            }
          } else if (action === 'close_app') {
            stepObj.app = app;
          } else if (action === 'control_app') {
            stepObj.app = app;
            stepObj.command = command;
            stepObj.params = {};

            // Collect dynamic parameters if present
            const paramInputs = card.querySelectorAll('.step-param-input');
            if (paramInputs && paramInputs.length > 0) {
              paramInputs.forEach(inp => {
                const pName = inp.dataset.paramName;
                if (!pName) return;
                let pVal = inp.value;
                if (inp.type === 'number') {
                  pVal = (pVal !== '' && !isNaN(Number(pVal))) ? parseFloat(pVal) : pVal;
                }
                stepObj.params[pName] = pVal;
              });
            }

            // Fallbacks for direct inputs
            if (file) {
              if (stepObj.params.file == null) stepObj.params.file = file;
              stepObj.file = file;
            }
            if (highlight && stepObj.params.highlight == null) stepObj.params.highlight = highlight;
            if (app === 'maps' && (command === 'flyTo' || command === 'setView' || command === 'moveTo')) {
              if (stepObj.params.lat == null && lat != null && lat !== '') stepObj.params.lat = parseFloat(lat);
              if (stepObj.params.lng == null && lng != null && lng !== '') stepObj.params.lng = parseFloat(lng);
              if (stepObj.params.lon == null && stepObj.params.lng != null) stepObj.params.lon = stepObj.params.lng;
              if (stepObj.params.lng == null && stepObj.params.lon != null) stepObj.params.lng = stepObj.params.lon;
              if (stepObj.params.zoom == null && zoom != null && zoom !== '') stepObj.params.zoom = parseInt(zoom, 10);
            } else if (app === 'doc-viewer' && (command === 'scroll' || command === 'scrollTo')) {
              if (stepObj.params.highlight == null && highlight) stepObj.params.highlight = highlight;
            } else if (app === 'image-viewer' && command === 'showImage') {
              if (stepObj.params.file == null && file) stepObj.params.file = file;
            }
          } else if (action === 'set_doc') {
            stepObj.action = 'set_doc';
            if (file) {
              stepObj.file = file;
              stepObj.params = { file };
            }
            if (highlight) stepObj.highlight = highlight;
          } else if (action === 'show_image') {
            stepObj.action = 'show_image';
            if (file) {
              stepObj.file = file;
              stepObj.params = { file };
            }
          } else if (action === 'notify') {
            stepObj.action = 'notify';
            stepObj.message = message || title;
          }

          timeline.push(stepObj);
        });
        this.currentConfig.timeline = timeline;
      }
    }

    renderTimeline() {
      if (!this.el.timelineList) return;
      const timeline = (this.currentConfig && Array.isArray(this.currentConfig.timeline)) ? this.currentConfig.timeline : [];

      if (timeline.length === 0) {
        this.el.timelineList.innerHTML = `
          <div class="autorun-studio-empty">
            <div class="autorun-studio-empty-icon">⏱️</div>
            <p>${this.escapeHtml(this.t('autorun.empty_timeline'))}</p>
          </div>
        `;
        return;
      }

      const files = this.currentFiles || [];
      let docExts = ['pdf', 'txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'htm', 'tex', 'latex', 'js', 'css', 'php', 'py', 'sh', 'log', 'ini', 'sql', 'yaml', 'yml', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'rst', 'asciidoc'];
      if (window.sys && window.sys.appManager && typeof window.sys.appManager.getAppManifest === 'function') {
        const m = window.sys.appManager.getAppManifest('doc-viewer');
        if (m && Array.isArray(m.extensions)) docExts = m.extensions;
      } else if (window.SG_DISCOVERED_APPS && window.SG_DISCOVERED_APPS['doc-viewer'] && Array.isArray(window.SG_DISCOVERED_APPS['doc-viewer'].extensions)) {
        docExts = window.SG_DISCOVERED_APPS['doc-viewer'].extensions;
      }
      const docRegex = new RegExp(`\\.(${docExts.join('|')})$`, 'i');
      const docFiles = files.filter(f => f.category === 'doc' || (f.name && f.name.match(docRegex)));
      const imgFiles = files.filter(f => f.category === 'image' || (f.name && f.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif|heic|heif|tiff)$/i)));
      const videoFiles = files.filter(f => f.category === 'video' || (f.name && f.name.match(/\.(mp4|webm|mov|mkv|avi|m4v|ogv)$/i)));
      const audioFiles = files.filter(f => f.category === 'audio' || (f.name && f.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|opus|wma)$/i)));
      const mediaFiles = files.filter(f => f.category === 'video' || f.category === 'audio' || (f.name && f.name.match(/\.(mp4|webm|mov|mkv|avi|mp3|wav|ogg|flac|aac|m4a|opus)$/i)));

      const controllableApps = (window.sys && window.sys.appManager && typeof window.sys.appManager.getAllControllableApps === 'function')
        ? window.sys.appManager.getAllControllableApps()
        : [
            { id: 'maps', name: 'Maps', icon: '🗺️' },
            { id: 'image-viewer', name: 'Image Viewer', icon: '🖼️' },
            { id: 'doc-viewer', name: 'Doc Viewer', icon: '📄' },
            { id: 'video-player', name: 'Video Player', icon: '🎬' },
            { id: 'audio-player', name: 'Audio Player', icon: '🎵' }
          ];

      const allApps = (window.sys && window.sys.appManager && typeof window.sys.appManager.getAllApps === 'function')
        ? window.sys.appManager.getAllApps(false)
        : [
            { id: 'maps', name: 'Maps', icon: '🗺️' },
            { id: 'doc-viewer', name: 'Doc Viewer', icon: '📄' },
            { id: 'image-viewer', name: 'Image Viewer', icon: '🖼️' },
            { id: 'video-player', name: 'Video Player', icon: '🎬' },
            { id: 'audio-player', name: 'Audio Player', icon: '🎵' },
            { id: 'system-monitor', name: 'System Monitor', icon: '📊' }
          ];

      const buildFileOptions = (selectedVal, allowedList) => {
        let cleanVal = selectedVal;
        if (typeof cleanVal === 'object' && cleanVal !== null) {
          cleanVal = cleanVal.name || cleanVal.path || '';
        }
        if (cleanVal === '[object Object]') cleanVal = '';

        let optHtml = `<option value="">${this.escapeHtml(this.t('autorun.no_file'))}</option>`;
        const list = (allowedList && allowedList.length > 0) ? allowedList : files;
        let found = false;
        list.forEach(f => {
          if (f.name === cleanVal || f.path === cleanVal) found = true;
          const isSel = (f.name === cleanVal || f.path === cleanVal) ? 'selected' : '';
          const icon = f.category === 'video' ? '🎬' : (f.category === 'audio' ? '🎵' : (f.category === 'image' ? '🖼️' : (f.category === 'doc' ? '📄' : '📁')));
          optHtml += `<option value="${this.escapeHtml(f.name)}" ${isSel}>${icon} ${this.escapeHtml(f.name)}</option>`;
        });
        if (cleanVal && !found) {
          optHtml += `<option value="${this.escapeHtml(cleanVal)}" selected>📄 ${this.escapeHtml(cleanVal)}</option>`;
        }
        return optHtml;
      };

      const getCommandsForApp = (appId) => {
        if (window.sys && window.sys.appManager && typeof window.sys.appManager.getAppCommands === 'function') {
          const cmds = window.sys.appManager.getAppCommands(appId);
          if (cmds && Object.keys(cmds).length > 0) return cmds;
        }
        if (appId === 'maps') {
          return {
            moveTo: {
              label: 'Déplacer la vue (moveTo)',
              params: {
                lat: { type: 'number', label: this.t('autorun.lat'), default: 48.8566 },
                lng: { type: 'number', label: this.t('autorun.lng'), default: 2.3522 },
                zoom: { type: 'number', label: this.t('autorun.zoom'), default: 13 }
              }
            },
            flyTo: {
              label: this.t('autorun.cmd_flyto'),
              params: {
                lat: { type: 'number', label: this.t('autorun.lat'), default: 48.8566 },
                lng: { type: 'number', label: this.t('autorun.lng'), default: 2.3522 },
                zoom: { type: 'number', label: this.t('autorun.zoom'), default: 13 }
              }
            },
            setView: {
              label: 'Centrer la carte (setView)',
              params: {
                lat: { type: 'number', label: this.t('autorun.lat'), default: 48.8566 },
                lng: { type: 'number', label: this.t('autorun.lng'), default: 2.3522 },
                zoom: { type: 'number', label: this.t('autorun.zoom'), default: 13 }
              }
            },
            whereIam: {
              label: 'Position actuelle (whereIam)',
              params: {}
            },
            zoomIn: { label: 'Zoomer avant (+)', params: {} },
            zoomOut: { label: 'Zoomer arrière (-)', params: {} }
          };
        }
        if (appId === 'doc-viewer') {
          return {
            scrollTo: {
              label: 'Défiler vers la page (scrollTo)',
              params: {
                page: { type: 'number', label: 'Numéro de page', default: 1 }
              }
            },
            searchText: {
              label: 'Rechercher texte (searchText)',
              params: {
                query: { type: 'text', label: 'Texte à rechercher', placeholder: 'Mot ou phrase...' },
                scrollTo: {
                  type: 'select',
                  label: 'Défiler vers',
                  options: [
                    { value: 'true', label: 'Oui' },
                    { value: 'false', label: 'Non' }
                  ]
                }
              }
            },
            nextPage: { label: 'Page suivante', params: {} },
            prevPage: { label: 'Page précédente', params: {} },
            scroll: {
              label: this.t('autorun.cmd_scroll'),
              params: {
                highlight: { type: 'text', label: this.t('autorun.highlight'), placeholder: '#chapitre-1' }
              }
            },
            setTheme: {
              label: 'Changer le thème',
              params: {
                theme: {
                  type: 'select',
                  label: 'Thème',
                  options: ['dark', 'light', 'sepia']
                }
              }
            },
            toggleEdit: { label: 'Basculer mode édition', params: {} }
          };
        }
        if (appId === 'image-viewer') {
          return {
            showImage: {
              label: this.t('autorun.cmd_show_img'),
              params: {
                file: { type: 'file', category: 'image', label: this.t('autorun.target_file') }
              }
            },
            zoom: {
              label: 'Définir le zoom (zoom)',
              params: {
                factor: { type: 'number', label: 'Facteur de zoom', default: 1.5, step: 0.1 }
              }
            },
            move: {
              label: 'Déplacer l\'image (move)',
              params: {
                x: { type: 'number', label: 'Déplacement X (px)', default: 50 },
                y: { type: 'number', label: 'Déplacement Y (px)', default: 0 }
              }
            },
            next: { label: 'Image suivante', params: {} },
            prev: { label: 'Image précédente', params: {} },
            rotate: { label: 'Pivoter 90°', params: {} },
            zoomIn: { label: 'Zoomer avant (+)', params: {} },
            zoomOut: { label: 'Zoomer arrière (-)', params: {} },
            resetZoom: { label: 'Réinitialiser zoom', params: {} }
          };
        }
        if (appId === 'video-player') {
          return {
            play: { label: 'Lecture', params: {} },
            pause: { label: 'Pause', params: {} },
            seekTo: {
              label: 'Aller à un instant (seekTo)',
              params: {
                time: { type: 'time', label: this.t('autorun.step_time'), placeholder: '00:00' }
              }
            },
            seek: {
              label: 'Aller à un instant',
              params: {
                time: { type: 'time', label: this.t('autorun.step_time'), placeholder: '00:00' }
              }
            },
            setVolume: {
              label: 'Régler volume',
              params: {
                volume: { type: 'number', min: 0, max: 1, step: 0.1, label: 'Volume (0.0 - 1.0)', default: 1 }
              }
            },
            playbackRate: {
              label: 'Vitesse de lecture',
              params: {
                speed: { type: 'number', label: 'Vitesse', min: 0.25, max: 4, step: 0.25, default: 1 }
              }
            }
          };
        }
        if (appId === 'audio-player') {
          return {
            play: { label: 'Lecture', params: {} },
            pause: { label: 'Pause', params: {} },
            seekTo: {
              label: 'Aller à un instant (seekTo)',
              params: {
                time: { type: 'time', label: this.t('autorun.step_time'), placeholder: '00:00' }
              }
            },
            seek: {
              label: 'Aller à un instant',
              params: {
                time: { type: 'time', label: this.t('autorun.step_time'), placeholder: '00:00' }
              }
            },
            setVolume: {
              label: 'Régler volume',
              params: {
                volume: { type: 'number', min: 0, max: 1, step: 0.1, label: 'Volume (0.0 - 1.0)', default: 1 }
              }
            },
            playbackRate: {
              label: 'Vitesse de lecture',
              params: {
                speed: { type: 'number', label: 'Vitesse', min: 0.25, max: 4, step: 0.25, default: 1 }
              }
            }
          };
        }
        return {};
      };

      let html = '';
      timeline.forEach((step, idx) => {
        const time = typeof step.time === 'string' ? step.time : '00:00';
        const title = step.title || '';
        const action = step.action || 'open_app';
        const app = step.app || (action === 'set_doc' ? 'doc-viewer' : (action === 'show_image' ? 'image-viewer' : 'maps'));
        let file = step.file || (step.params && step.params.file) || '';
        if (typeof file === 'object' && file !== null) {
          file = file.path || file.name || '';
        }
        if (file === '[object Object]') file = '';
        const pos = step.position || (step.params && step.params.position) || 'auto';
        const lat = (step.params && step.params.lat != null) ? step.params.lat : (step.lat != null ? step.lat : '');
        const lng = (step.params && step.params.lng != null) ? step.params.lng : (step.lng != null ? step.lng : '');
        const zoom = (step.params && step.params.zoom != null) ? step.params.zoom : (step.zoom != null ? step.zoom : 13);
        const highlight = step.highlight || (step.params && step.params.highlight) || '';
        const message = step.message || step.title || '';

        html += `
          <div class="autorun-studio-step-card" data-step-index="${idx}">
            <div class="autorun-studio-step-header">
              <div class="autorun-studio-step-header-left">
                <span class="autorun-studio-step-badge">#${idx + 1}</span>
                <input type="text" class="autorun-studio-input" data-step-time value="${this.escapeHtml(time)}" style="width: 80px;" placeholder="00:00" title="${this.escapeHtml(this.t('autorun.step_time'))}">
                <input type="text" class="autorun-studio-input" data-step-title value="${this.escapeHtml(title)}" style="flex: 1;" placeholder="${this.escapeHtml(this.t('autorun.step_title'))}">
              </div>
              <div class="autorun-studio-step-actions">
                <button type="button" class="autorun-studio-btn-icon" data-step-up="${idx}" title="${this.escapeHtml(this.t('autorun.move_up'))}">⬆️</button>
                <button type="button" class="autorun-studio-btn-icon" data-step-down="${idx}" title="${this.escapeHtml(this.t('autorun.move_down'))}">⬇️</button>
                <button type="button" class="autorun-studio-btn-icon autorun-studio-btn-delete" data-step-del="${idx}" title="${this.escapeHtml(this.t('autorun.delete_step'))}">🗑️</button>
              </div>
            </div>

            <div class="autorun-studio-step-body">
              <div class="autorun-studio-fields-row">
                <div class="autorun-studio-field" style="min-width: 150px;">
                  <label>${this.escapeHtml(this.t('autorun.step_action'))}</label>
                  <select class="autorun-studio-select step-action-select" data-step-action data-step-index="${idx}">
                    <option value="open_app" ${action === 'open_app' ? 'selected' : ''}>🚀 ${this.escapeHtml(this.t('autorun.action_open_app'))}</option>
                    <option value="control_app" ${action === 'control_app' ? 'selected' : ''}>🎮 ${this.escapeHtml(this.t('autorun.action_control_app'))}</option>
                    <option value="close_app" ${action === 'close_app' ? 'selected' : ''}>❌ ${this.escapeHtml(this.t('autorun.action_close_app'))}</option>
                    <option value="set_doc" ${action === 'set_doc' ? 'selected' : ''}>📄 ${this.escapeHtml(this.t('autorun.action_doc'))}</option>
                    <option value="show_image" ${action === 'show_image' ? 'selected' : ''}>🖼️ ${this.escapeHtml(this.t('autorun.action_image'))}</option>
                    <option value="notify" ${action === 'notify' ? 'selected' : ''}>💬 ${this.escapeHtml(this.t('autorun.action_notify'))}</option>
                  </select>
                </div>

                ${(action === 'open_app' || action === 'control_app' || action === 'close_app') ? `
                  <div class="autorun-studio-field" style="min-width: 150px;">
                    <label>${this.escapeHtml(this.t('autorun.target_app'))}</label>
                    <select class="autorun-studio-select step-app-select" data-step-app data-step-index="${idx}">
                      ${(() => {
                        const list = (action === 'control_app' && controllableApps.length > 0) ? controllableApps : allApps;
                        let opts = '';
                        list.forEach(a => {
                          const isSel = (a.id === app) ? 'selected' : '';
                          const icon = a.icon || '📱';
                          opts += `<option value="${this.escapeHtml(a.id)}" ${isSel}>${icon} ${this.escapeHtml(a.name || a.id)}</option>`;
                        });
                        if (app && !list.some(a => a.id === app)) {
                          opts += `<option value="${this.escapeHtml(app)}" selected>📱 ${this.escapeHtml(app)}</option>`;
                        }
                        return opts;
                      })()}
                    </select>
                  </div>
                ` : ''}

                ${(action === 'open_app' || action === 'set_doc' || action === 'show_image') ? `
                  <div class="autorun-studio-field" style="min-width: 140px;">
                    <label>${this.escapeHtml(this.t('autorun.step_pos'))}</label>
                    <select class="autorun-studio-select step-pos-select" data-step-pos data-step-index="${idx}">
                      <option value="auto" ${(!pos || pos === 'auto') ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_auto'))}</option>
                      <option value="right-half" ${pos === 'right-half' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_right_half'))}</option>
                      <option value="left-half" ${pos === 'left-half' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_left_half'))}</option>
                      <option value="top-right" ${pos === 'top-right' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_top_right'))}</option>
                      <option value="bottom-right" ${pos === 'bottom-right' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_bottom_right'))}</option>
                      <option value="top-left" ${pos === 'top-left' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_top_left'))}</option>
                      <option value="bottom-left" ${pos === 'bottom-left' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_bottom_left'))}</option>
                      <option value="center" ${pos === 'center' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_center'))}</option>
                      <option value="fullscreen" ${pos === 'fullscreen' ? 'selected' : ''}>${this.escapeHtml(this.t('autorun.pos_fullscreen'))}</option>
                    </select>
                  </div>
                ` : ''}
              </div>

              <!-- Contextual Fields based on Action & Target App -->
              ${(action === 'open_app' && app === 'maps') ? `
                <div class="step-field-group-inline">
                  <div class="step-mini-col">
                    <label>${this.escapeHtml(this.t('autorun.lat'))}</label>
                    <input type="number" step="any" class="autorun-studio-input" data-step-lat value="${this.escapeHtml(lat)}" placeholder="48.8566">
                  </div>
                  <div class="step-mini-col">
                    <label>${this.escapeHtml(this.t('autorun.lng'))}</label>
                    <input type="number" step="any" class="autorun-studio-input" data-step-lng value="${this.escapeHtml(lng)}" placeholder="2.3522">
                  </div>
                  <div class="step-mini-col" style="max-width: 90px;">
                    <label>${this.escapeHtml(this.t('autorun.zoom'))}</label>
                    <input type="number" step="1" min="1" max="19" class="autorun-studio-input" data-step-zoom value="${this.escapeHtml(zoom)}" placeholder="13">
                  </div>
                  <div class="step-mini-col" style="display:flex;align-items:flex-end;">
                    <button type="button" class="autorun-studio-btn autorun-capture-map-btn" data-step-capture-map="${idx}" title="${this.escapeHtml(this.t('autorun.capture_map_title'))}" style="padding:6px 12px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.5);border-radius:6px;color:var(--text-main,#f8fafc);cursor:pointer;font-size:0.8rem;white-space:nowrap;">📍 ${this.escapeHtml(this.t('autorun.capture_map'))}</button>
                  </div>
                </div>
              ` : ''}

              ${(action === 'set_doc' || (action === 'open_app' && app === 'doc-viewer')) ? `
                <div class="step-field-group-inline">
                  <div class="autorun-studio-field" style="flex: 2; min-width: 200px;">
                    <label>${this.escapeHtml(this.t('autorun.target_file'))}</label>
                    <select class="autorun-studio-select step-file-select" data-step-file>
                      ${buildFileOptions(file, docFiles)}
                    </select>
                  </div>
                  <div class="autorun-studio-field" style="flex: 1; min-width: 140px;">
                    <label>${this.escapeHtml(this.t('autorun.highlight'))}</label>
                    <input type="text" class="autorun-studio-input" data-step-hl value="${this.escapeHtml(highlight)}" placeholder="#chapitre-1">
                  </div>
                </div>
              ` : ''}

              ${(action === 'show_image' || (action === 'open_app' && app === 'image-viewer')) ? `
                <div class="step-field-group-inline">
                  <div class="autorun-studio-field" style="flex: 1; min-width: 220px;">
                    <label>${this.escapeHtml(this.t('autorun.target_file'))}</label>
                    <select class="autorun-studio-select step-file-select" data-step-file>
                      ${buildFileOptions(file, imgFiles)}
                    </select>
                  </div>
                </div>
              ` : ''}

              ${(action === 'open_app' && app === 'video-player') ? `
                <div class="step-field-group-inline">
                  <div class="autorun-studio-field" style="flex: 1; min-width: 220px;">
                    <label>${this.escapeHtml(this.t('autorun.target_file'))}</label>
                    <select class="autorun-studio-select step-file-select" data-step-file>
                      ${buildFileOptions(file, videoFiles.length > 0 ? videoFiles : mediaFiles)}
                    </select>
                  </div>
                </div>
              ` : ''}

              ${(action === 'open_app' && app === 'audio-player') ? `
                <div class="step-field-group-inline">
                  <div class="autorun-studio-field" style="flex: 1; min-width: 220px;">
                    <label>${this.escapeHtml(this.t('autorun.target_file'))}</label>
                    <select class="autorun-studio-select step-file-select" data-step-file>
                      ${buildFileOptions(file, audioFiles.length > 0 ? audioFiles : mediaFiles)}
                    </select>
                  </div>
                </div>
              ` : ''}

              ${(action === 'open_app' && !['maps', 'doc-viewer', 'image-viewer', 'video-player', 'audio-player'].includes(app)) ? `
                <div class="step-field-group-inline">
                  <div class="autorun-studio-field" style="flex: 1; min-width: 220px;">
                    <label>${this.escapeHtml(this.t('autorun.target_file'))}</label>
                    <select class="autorun-studio-select step-file-select" data-step-file>
                      ${buildFileOptions(file, files)}
                    </select>
                  </div>
                </div>
              ` : ''}

              ${(action === 'notify') ? `
                <div class="step-field-group-inline">
                  <div class="autorun-studio-field" style="flex: 1;">
                    <label>${this.escapeHtml(this.t('autorun.message'))}</label>
                    <input type="text" class="autorun-studio-input" data-step-msg value="${this.escapeHtml(message)}" placeholder="Notification...">
                  </div>
                </div>
              ` : ''}

              ${(action === 'control_app') ? (() => {
                const appCommands = getCommandsForApp(app);
                const cmdKeys = Object.keys(appCommands);
                const activeCommand = step.command || (cmdKeys.length > 0 ? cmdKeys[0] : '');
                const activeCmdDef = appCommands[activeCommand] || {};
                const paramsDef = activeCmdDef.params || {};
                const paramKeys = Object.keys(paramsDef);

                let cmdOptions = '';
                cmdKeys.forEach(ck => {
                  const def = appCommands[ck];
                  const label = (def && def.label) ? def.label : ck;
                  const isSel = (ck === activeCommand) ? 'selected' : '';
                  cmdOptions += `<option value="${this.escapeHtml(ck)}" ${isSel}>${this.escapeHtml(label)}</option>`;
                });
                if (activeCommand && !cmdKeys.includes(activeCommand)) {
                  cmdOptions += `<option value="${this.escapeHtml(activeCommand)}" selected>${this.escapeHtml(activeCommand)}</option>`;
                }

                let dynamicParamsHtml = '';
                if (paramKeys.length > 0) {
                  let innerFields = '';
                  paramKeys.forEach(pKey => {
                    const pDef = paramsDef[pKey] || {};
                    const pType = pDef.type || 'text';
                    const pLabel = pDef.label || pKey;
                    const pVal = (step.params && step.params[pKey] != null)
                      ? step.params[pKey]
                      : ((step[pKey] != null) ? step[pKey] : (pDef.default ?? ''));

                    if (pType === 'file') {
                      const fileCategory = pDef.category;
                      const fileList = (fileCategory === 'image') ? imgFiles : ((fileCategory === 'doc') ? docFiles : ((fileCategory === 'video' || fileCategory === 'media') ? mediaFiles : files));
                      innerFields += `
                        <div class="autorun-studio-field" style="flex: 1; min-width: 200px;">
                          <label>${this.escapeHtml(pLabel)}</label>
                          <select class="autorun-studio-select step-param-input" data-param-name="${this.escapeHtml(pKey)}">
                            ${buildFileOptions(pVal, fileList)}
                          </select>
                        </div>
                      `;
                    } else if (pType === 'number') {
                      innerFields += `
                        <div class="step-mini-col">
                          <label>${this.escapeHtml(pLabel)}</label>
                          <input type="number" step="${pDef.step || 'any'}" ${pDef.min != null ? `min="${pDef.min}"` : ''} ${pDef.max != null ? `max="${pDef.max}"` : ''} class="autorun-studio-input step-param-input" data-param-name="${this.escapeHtml(pKey)}" value="${this.escapeHtml(pVal)}" placeholder="${this.escapeHtml(pDef.default ?? '')}">
                        </div>
                      `;
                    } else if (pType === 'time') {
                      innerFields += `
                        <div class="autorun-studio-field" style="width: 120px;">
                          <label>${this.escapeHtml(pLabel)}</label>
                          <input type="text" class="autorun-studio-input step-param-input" data-param-name="${this.escapeHtml(pKey)}" value="${this.escapeHtml(pVal)}" placeholder="${this.escapeHtml(pDef.placeholder || '00:00')}">
                        </div>
                      `;
                    } else if (pType === 'select') {
                      let sOpts = '';
                      (pDef.options || []).forEach(opt => {
                        const v = typeof opt === 'object' ? opt.value : opt;
                        const l = typeof opt === 'object' ? opt.label : opt;
                        sOpts += `<option value="${this.escapeHtml(v)}" ${v == pVal ? 'selected' : ''}>${this.escapeHtml(l)}</option>`;
                      });
                      innerFields += `
                        <div class="autorun-studio-field" style="min-width: 140px;">
                          <label>${this.escapeHtml(pLabel)}</label>
                          <select class="autorun-studio-select step-param-input" data-param-name="${this.escapeHtml(pKey)}">
                            ${sOpts}
                          </select>
                        </div>
                      `;
                    } else {
                      innerFields += `
                        <div class="autorun-studio-field" style="flex: 1; min-width: 180px;">
                          <label>${this.escapeHtml(pLabel)}</label>
                          <input type="text" class="autorun-studio-input step-param-input" data-param-name="${this.escapeHtml(pKey)}" value="${this.escapeHtml(pVal)}" placeholder="${this.escapeHtml(pDef.placeholder || '')}">
                        </div>
                      `;
                    }
                  });

                  dynamicParamsHtml = `<div class="step-field-group-inline">${innerFields}</div>`;
                }

                return `
                  <div class="step-field-group-inline">
                    <div class="autorun-studio-field" style="flex: 1; min-width: 220px;">
                      <label>${this.escapeHtml(this.t('autorun.command'))}</label>
                      <select class="autorun-studio-select step-cmd-select" data-step-cmd data-step-index="${idx}">
                        ${cmdOptions}
                      </select>
                    </div>
                    ${(app === 'maps') ? `
                      <div class="step-mini-col" style="display:flex;align-items:flex-end;">
                        <button type="button" class="autorun-studio-btn autorun-capture-map-btn" data-step-capture-map="${idx}" title="${this.escapeHtml(this.t('autorun.capture_map_title'))}" style="padding:6px 12px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.5);border-radius:6px;color:var(--text-main,#f8fafc);cursor:pointer;font-size:0.8rem;white-space:nowrap;">📍 ${this.escapeHtml(this.t('autorun.capture_map'))}</button>
                      </div>
                    ` : ''}
                  </div>
                  ${dynamicParamsHtml}
                `;
              })() : ''}
            </div>
          </div>
        `;
      });

      this.el.timelineList.innerHTML = html;

      // Bind events on step elements
      this.el.timelineList.querySelectorAll('[data-step-action], [data-step-app], [data-step-cmd]').forEach(el => {
        el.onchange = () => {
          this.syncVisualToConfig();
          this.renderTimeline();
          if (this.el.rawJson) this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
        };
      });

      // Bind live inputs on all remaining step inputs and selects
      this.el.timelineList.querySelectorAll('input:not([data-step-action]):not([data-step-app]):not([data-step-cmd]), select:not([data-step-action]):not([data-step-app]):not([data-step-cmd])').forEach(el => {
        const onStepChange = () => {
          this.syncVisualToConfig();
          if (this.el.rawJson) this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
        };
        el.oninput = onStepChange;
        el.onchange = onStepChange;
      });

      this.el.timelineList.querySelectorAll('[data-step-up]').forEach(btn => {
        btn.onclick = () => this.moveStep(parseInt(btn.dataset.stepUp, 10), -1);
      });
      this.el.timelineList.querySelectorAll('[data-step-down]').forEach(btn => {
        btn.onclick = () => this.moveStep(parseInt(btn.dataset.stepDown, 10), 1);
      });
      this.el.timelineList.querySelectorAll('[data-step-del]').forEach(btn => {
        btn.onclick = () => this.removeStep(parseInt(btn.dataset.stepDel, 10));
      });
      this.el.timelineList.querySelectorAll('[data-step-capture-map]').forEach(btn => {
        btn.onclick = () => this.captureMapPosition(parseInt(btn.dataset.stepCaptureMap, 10));
      });
    }

    async captureMapPosition(stepIdx) {
      let mapInstance = window.mapsApp ? window.mapsApp.activeInstance : null;
      if (!mapInstance && window.mapsApp && window.mapsApp.instances && window.mapsApp.instances.size > 0) {
        mapInstance = Array.from(window.mapsApp.instances.values())[0];
      }

      if (!mapInstance) {
        if (window.sys && window.sys.appManager) {
          window.sys.appManager.launchApp('maps', { currentPath: this.currentPath });
        } else if (window.mapsApp && typeof window.mapsApp.open === 'function') {
          window.mapsApp.open({ currentPath: this.currentPath });
        }
        const toast = (window.sys && window.sys.toast && typeof window.sys.toast.show === 'function')
          ? window.sys.toast
          : (window.sys && window.sys.showToast ? { show: window.sys.showToast } : null);
        if (toast) {
          toast.show('🗺️ Maps a été ouvert. Positionnez la carte à l\'endroit souhaité, puis recliquez sur "📍 Capturer depuis Maps".', 'info');
        } else {
          alert('Maps a été ouvert. Positionnez la carte à l\'endroit souhaité, puis recliquez sur "📍 Capturer depuis Maps".');
        }
        return;
      }

      const pos = (typeof mapInstance.whereIam === 'function') ? mapInstance.whereIam() : null;
      if (!pos) return;

      this.syncVisualToConfig();
      if (this.currentConfig && Array.isArray(this.currentConfig.timeline) && this.currentConfig.timeline[stepIdx]) {
        const step = this.currentConfig.timeline[stepIdx];
        if (!step.params) step.params = {};
        step.params.lat = pos.lat;
        step.params.lng = pos.lng;
        step.params.lon = pos.lon;
        step.params.zoom = pos.zoom;
        step.lat = pos.lat;
        step.lng = pos.lng;
        step.zoom = pos.zoom;
      }
      this.renderTimeline();
      if (this.el.rawJson) this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);

      const toast = (window.sys && window.sys.toast && typeof window.sys.toast.show === 'function')
        ? window.sys.toast
        : (window.sys && window.sys.showToast ? { show: window.sys.showToast } : null);
      if (toast) {
        toast.show(`📍 Coordonnées capturées : ${pos.lat}, ${pos.lng} (zoom ${pos.zoom})`, 'success');
      }
    }

    addStep() {
      this.syncVisualToConfig();
      if (!this.currentConfig.timeline) this.currentConfig.timeline = [];
      const count = this.currentConfig.timeline.length;
      let nextSec = count * 15;
      const m = Math.floor(nextSec / 60);
      const s = nextSec % 60;
      const tc = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      this.currentConfig.timeline.push({
        time: tc,
        title: `Étape ${count + 1}`,
        action: 'open_app',
        app: 'maps',
        params: { lat: 48.8566, lng: 2.3522, zoom: 13 }
      });
      this.renderTimeline();
      if (this.el.rawJson) this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
    }

    removeStep(index) {
      this.syncVisualToConfig();
      if (this.currentConfig.timeline && this.currentConfig.timeline[index]) {
        this.currentConfig.timeline.splice(index, 1);
        this.renderTimeline();
        if (this.el.rawJson) this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
      }
    }

    moveStep(index, dir) {
      this.syncVisualToConfig();
      const list = this.currentConfig.timeline;
      if (!list) return;
      const target = index + dir;
      if (target < 0 || target >= list.length) return;
      const tmp = list[index];
      list[index] = list[target];
      list[target] = tmp;
      this.renderTimeline();
      if (this.el.rawJson) this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
    }

    preview() {
      if (this.activeTab === 'visual') {
        this.syncVisualToConfig();
      } else {
        try {
          this.currentConfig = JSON.parse(this.el.rawJson.value);
        } catch (e) {
          alert('JSON invalide : ' + e.message);
          return;
        }
      }

      if (window.sys && window.sys.launchAutorun) {
        window.sys.launchAutorun(this.currentConfig, this.currentPath);
      } else if (window.explorerApp && typeof window.explorerApp.launchAutorun === 'function') {
        window.explorerApp.launchAutorun(this.currentConfig);
      } else {
        alert('Moteur AutorunSyncEngine introuvable.');
      }
    }

    async save() {
      if (this.activeTab === 'visual') {
        this.syncVisualToConfig();
      } else {
        try {
          this.currentConfig = JSON.parse(this.el.rawJson.value);
        } catch (e) {
          alert('JSON invalide : ' + e.message);
          return;
        }
      }

      const savePath = (this.currentPath ? `${this.currentPath}/` : '') + 'autorun.json';
      try {
        const res = await window.sys.api.post('save_file_content', {
          path: savePath,
          file: savePath,
          content: JSON.stringify(this.currentConfig, null, 2),
          csrf_token: window.CSRF_TOKEN || window.SG_CSRF_TOKEN || ''
        });

        if (res && res.success) {
          if (this.el.rawJson) this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
          this.showToast('Configuration autorun.json enregistrée avec succès !', 'success');
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'save', dir: this.currentPath });
          }
        } else {
          this.showToast('Erreur lors de la sauvegarde : ' + ((res && res.error) || 'Erreur inconnue'), 'error');
        }
      } catch (err) {
        this.showToast('Erreur : ' + err.message, 'error');
      }
    }

    async delete() {
      if (!confirm('Voulez-vous vraiment supprimer le fichier autorun.json de ce dossier ?')) return;
      const path1 = (this.currentPath ? `${this.currentPath}/` : '') + '.autorun.json';
      const path2 = (this.currentPath ? `${this.currentPath}/` : '') + 'autorun.json';

      try {
        if (window.sys.api && window.sys.api.fs && typeof window.sys.api.fs.deleteItem === 'function') {
          await window.sys.api.fs.deleteItem(path1);
          await window.sys.api.fs.deleteItem(path2);
        } else {
          await window.sys.api.post('delete_item', { target: path1 });
          await window.sys.api.post('delete_item', { target: path2 });
        }
        this.showToast('Fichier autorun.json supprimé.', 'info');
        if (window.EventBus) {
          window.EventBus.emit('fs:changed', { action: 'delete', dir: this.currentPath });
        }
        this.close();
      } catch (e) {
        this.showToast('Erreur : ' + e.message, 'error');
      }
    }

    showToast(message, type = 'info') {
      const targetType = (type === 'error' || type === 'success' || type === 'warning' || type === 'info') ? type : 'info';
      if (this.toast && typeof this.toast[targetType] === 'function') {
        this.toast[targetType](message);
      } else if (window.sys && window.sys.toast && typeof window.sys.toast[targetType] === 'function') {
        window.sys.toast[targetType](message);
      } else if (window.sys && window.sys.toast && typeof window.sys.toast.show === 'function') {
        window.sys.toast.show(message, targetType);
      } else if (window.sys && window.sys.ui && typeof window.sys.ui.showToast === 'function') {
        window.sys.ui.showToast(message, { type: targetType });
      } else if (typeof window.showToast === 'function') {
        window.showToast(message, targetType);
      } else {
        alert(message);
      }
    }

    openFolder(path, options = {}) {
      this.open({ path, ...options });
    }
  }

  const autorunStudio = new AutorunEditorApp();
  window.AutorunStudio = autorunStudio;

  // Register in WebOS AppManager
  if (window.sys && window.sys.appManager) {
    window.sys.appManager.register(autorunStudio);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      if (window.sys && window.sys.appManager) {
        window.sys.appManager.register(autorunStudio);
      }
    });
  }

})(window, document);
