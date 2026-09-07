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

      // Master type change
      if (this.el.masterType) {
        this.el.masterType.onchange = () => {
          const type = this.el.masterType.value;
          if (this.el.masterFileField) this.el.masterFileField.style.display = (type === 'timer') ? 'none' : 'flex';
          if (this.el.masterDurationField) this.el.masterDurationField.style.display = (type === 'timer') ? 'flex' : 'none';
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

        let config = existingConfig;
        if (!config && json && json.overrides && json.overrides.autorun) {
          config = json.overrides.autorun;
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
          if (!config.master) {
            config.master = {
              type: (config.lead_media && config.lead_media.app === 'viewer-audio') ? 'audio' : 'video',
              file: (config.lead_media && config.lead_media.file) || '',
              duration: config.duration || '120'
            };
          }
          if ((!config.timeline || config.timeline.length === 0) && Array.isArray(config.steps) && config.steps.length > 0) {
            config.timeline = config.steps.map(s => ({
              time: s.time || '00:00',
              title: s.title || s.chapter || '',
              action: s.action || 'open_app',
              app: (s.app === 'viewer-video' ? 'video-player' : (s.app === 'viewer-text' ? 'doc-viewer' : (s.app || 'video-player'))),
              file: s.file || '',
              params: s.params || (s.file ? { file: s.file } : {})
            }));
          }
        }

        this.currentConfig = config;
        this.populateMeta();
        this.populateMasterFiles(config.master ? config.master.file : '');
        this.renderTimeline();

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
      if (this.el.metaLayout) this.el.metaLayout.value = this.currentConfig.layout || 'split-horizontal';
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
            this.currentConfig = JSON.parse(this.el.rawJson.value);
            this.populateMeta();
            this.renderTimeline();
          } catch (e) {
            alert('JSON Invalide : ' + e.message);
            return;
          }
        }
        this.el.visualView.style.display = 'block';
        this.el.jsonView.style.display = 'none';
        this.el.tabVisualBtn.classList.add('active');
        this.el.tabJsonBtn.classList.remove('active');
      } else {
        this.syncVisualToConfig();
        if (this.el.rawJson) {
          this.el.rawJson.value = JSON.stringify(this.currentConfig, null, 2);
        }
        this.el.visualView.style.display = 'none';
        this.el.jsonView.style.display = 'block';
        this.el.tabVisualBtn.classList.remove('active');
        this.el.tabJsonBtn.classList.add('active');
      }
    }

    syncVisualToConfig() {
      if (!this.currentConfig) this.currentConfig = {};
      this.currentConfig.version = '2.0';
      if (this.el.metaTitle) this.currentConfig.title = this.el.metaTitle.value;
      if (this.el.metaLayout) this.currentConfig.layout = this.el.metaLayout.value;
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
          const pos = card.querySelector('[data-step-pos]')?.value || 'auto';
          const file = card.querySelector('[data-step-file]')?.value || '';
          const command = card.querySelector('[data-step-cmd]')?.value || '';

          const step = { time, title, action };
          if (pos && pos !== 'auto') step.position = pos;

          if (action === 'open_app') {
            step.app = app;
            step.params = {};
            if (file) step.params.file = file;
            if (pos && pos !== 'auto') step.params.position = pos;
            if (app === 'maps') {
              const lat = parseFloat(card.querySelector('[data-step-lat]')?.value);
              const lng = parseFloat(card.querySelector('[data-step-lng]')?.value);
              const zoom = parseInt(card.querySelector('[data-step-zoom]')?.value, 10);
              if (!isNaN(lat)) step.params.lat = lat;
              if (!isNaN(lng)) step.params.lng = lng;
              if (!isNaN(zoom)) step.params.zoom = zoom;
            }
          } else if (action === 'close_app') {
            step.app = app;
          } else if (action === 'control_app') {
            step.app = app;
            step.command = command;
            step.params = {};
            if (file) step.params.file = file;
          } else if (action === 'set_doc') {
            step.action = 'set_doc';
            if (file) step.file = file;
            const hl = card.querySelector('[data-step-hl]')?.value;
            if (hl) step.highlight = hl;
          } else if (action === 'show_image') {
            step.action = 'show_image';
            if (file) step.file = file;
          } else if (action === 'notify') {
            step.action = 'notify';
            step.message = card.querySelector('[data-step-msg]')?.value || title;
          }

          timeline.push(step);
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
            <p>Aucune étape dans la timeline. Cliquez sur "+ Ajouter une étape" pour commencer.</p>
          </div>
        `;
        return;
      }

      const controllableApps = (window.sys && window.sys.appManager && typeof window.sys.appManager.getAllControllableApps === 'function')
        ? window.sys.appManager.getAllControllableApps()
        : [{ id: 'maps', name: 'Maps', icon: '🗺️' }, { id: 'image-viewer', name: 'Image Viewer', icon: '🖼️' }, { id: 'doc-viewer', name: 'Doc Viewer', icon: '📄' }, { id: 'video-player', name: 'Video Player', icon: '🎬' }];

      let html = '';
      timeline.forEach((step, idx) => {
        const time = step.time || '00:00';
        const title = step.title || '';
        const action = step.action || 'open_app';
        const app = step.app || 'maps';
        const pos = step.position || (step.params && step.params.position) || 'auto';
        const file = step.file || (step.params && step.params.file) || '';
        const lat = (step.params && step.params.lat != null) ? step.params.lat : '';
        const lng = (step.params && step.params.lng != null) ? step.params.lng : '';
        const zoom = (step.params && step.params.zoom != null) ? step.params.zoom : 13;

        html += `
          <div class="autorun-studio-step-card" data-step-index="${idx}">
            <div class="autorun-studio-step-header">
              <div class="autorun-studio-step-header-left">
                <span class="autorun-studio-step-badge">#${idx + 1}</span>
                <input type="text" class="autorun-studio-input" data-step-time value="${this.escapeHtml(time)}" style="width: 80px;" placeholder="00:00">
                <input type="text" class="autorun-studio-input" data-step-title value="${this.escapeHtml(title)}" style="flex: 1;" placeholder="Titre de l'étape...">
              </div>
              <div class="autorun-studio-step-actions">
                <button type="button" class="autorun-studio-btn-icon" data-step-up="${idx}" title="Monter">⬆️</button>
                <button type="button" class="autorun-studio-btn-icon" data-step-down="${idx}" title="Descendre">⬇️</button>
                <button type="button" class="autorun-studio-btn-icon autorun-studio-btn-delete" data-step-del="${idx}" title="Supprimer">🗑️</button>
              </div>
            </div>

            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem;">
              <div class="autorun-studio-field" style="min-width: 140px;">
                <label>Action</label>
                <select class="autorun-studio-select" data-step-action>
                  <option value="open_app" ${action === 'open_app' ? 'selected' : ''}>🚀 Ouvrir App</option>
                  <option value="control_app" ${action === 'control_app' ? 'selected' : ''}>🎮 Contrôler App</option>
                  <option value="close_app" ${action === 'close_app' ? 'selected' : ''}>❌ Fermer App</option>
                  <option value="set_doc" ${action === 'set_doc' ? 'selected' : ''}>📄 Document</option>
                  <option value="show_image" ${action === 'show_image' ? 'selected' : ''}>🖼️ Image</option>
                  <option value="notify" ${action === 'notify' ? 'selected' : ''}>💬 Notification</option>
                </select>
              </div>

              ${(action === 'open_app' || action === 'control_app' || action === 'close_app') ? `
                <div class="autorun-studio-field" style="min-width: 140px;">
                  <label>Application</label>
                  <select class="autorun-studio-select" data-step-app>
                    ${controllableApps.map(a => `<option value="${this.escapeHtml(a.id)}" ${a.id === app ? 'selected' : ''}>${a.icon || '📱'} ${this.escapeHtml(a.name || a.id)}</option>`).join('')}
                  </select>
                </div>
              ` : ''}

              ${(action === 'open_app' || action === 'set_doc' || action === 'show_image') ? `
                <div class="autorun-studio-field" style="min-width: 130px;">
                  <label>Position</label>
                  <select class="autorun-studio-select" data-step-pos>
                    <option value="auto" ${pos === 'auto' ? 'selected' : ''}>Auto</option>
                    <option value="right-half" ${pos === 'right-half' ? 'selected' : ''}>Moitié droite</option>
                    <option value="left-half" ${pos === 'left-half' ? 'selected' : ''}>Moitié gauche</option>
                    <option value="top-right" ${pos === 'top-right' ? 'selected' : ''}>Haut droite</option>
                    <option value="bottom-right" ${pos === 'bottom-right' ? 'selected' : ''}>Bas droite</option>
                    <option value="center" ${pos === 'center' ? 'selected' : ''}>Centre</option>
                    <option value="fullscreen" ${pos === 'fullscreen' ? 'selected' : ''}>Plein écran</option>
                  </select>
                </div>
              ` : ''}

              ${(app === 'maps' && action === 'open_app') ? `
                <div style="display: flex; gap: 0.5rem; flex: 1;">
                  <div class="autorun-studio-field" style="flex: 1;"><label>Lat</label><input type="number" step="any" class="autorun-studio-input" data-step-lat value="${this.escapeHtml(lat)}" placeholder="48.85"></div>
                  <div class="autorun-studio-field" style="flex: 1;"><label>Lng</label><input type="number" step="any" class="autorun-studio-input" data-step-lng value="${this.escapeHtml(lng)}" placeholder="2.35"></div>
                  <div class="autorun-studio-field" style="width: 70px;"><label>Zoom</label><input type="number" class="autorun-studio-input" data-step-zoom value="${this.escapeHtml(zoom)}"></div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });

      this.el.timelineList.innerHTML = html;

      // Bind events on step elements
      this.el.timelineList.querySelectorAll('[data-step-action], [data-step-app]').forEach(el => {
        el.onchange = () => {
          this.syncVisualToConfig();
          this.renderTimeline();
        };
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
    }

    removeStep(index) {
      this.syncVisualToConfig();
      if (this.currentConfig.timeline && this.currentConfig.timeline[index]) {
        this.currentConfig.timeline.splice(index, 1);
        this.renderTimeline();
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
          if (window.sys && window.sys.toast) {
            window.sys.toast.show('Configuration autorun.json enregistrée avec succès !', 'success');
          } else {
            alert('Enregistré avec succès !');
          }
          if (window.EventBus) {
            window.EventBus.emit('fs:changed', { action: 'save', dir: this.currentPath });
          }
        } else {
          alert('Erreur lors de la sauvegarde : ' + ((res && res.error) || 'Erreur inconnue'));
        }
      } catch (err) {
        alert('Erreur réseau : ' + err.message);
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
        if (window.sys && window.sys.toast) {
          window.sys.toast.show('Fichier autorun.json supprimé.', 'info');
        }
        if (window.EventBus) {
          window.EventBus.emit('fs:changed', { action: 'delete', dir: this.currentPath });
        }
        this.close();
      } catch (e) {
        alert('Erreur : ' + e.message);
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
