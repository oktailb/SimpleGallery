/**
 * SimpleGallery WebOS - Development Reference Application (`TemplateApp`)
 * Complete reference implementation showcasing:
 * - SyscallClient (System Syscalls + App Private Backend API)
 * - FilePickerService (Inter-app gallery file selector)
 * - WindowManager & Lifecycle (open, focus, close, theme/locale reactivity)
 * - MenuBarManager (Dynamic top menu bar integration)
 * - EventBus IPC (System and custom inter-process messaging)
 * - MetadataInspector & MediaViewerRegistry
 * - Toast & Audio feedback
 */
(function(window) {
  'use strict';

  const WebOSApp = (window.sys && window.sys.App) || window.WebOSApp;

  class TemplateApp extends WebOSApp {
    constructor() {
      super({
        id: 'template-app',
        title: 'apps.template-app.title',
        icon: '🧪',
        width: 880,
        height: 620,
        tabs: [
          { id: 'overview',   label: 'template.tab_overview',   icon: '🏠' },
          { id: 'filepicker', label: 'template.tab_filepicker', icon: '📁' },
          { id: 'backend',    label: 'template.tab_backend',    icon: '💾' },
          { id: 'events',     label: 'template.tab_events',     icon: '⚡' }
        ]
      });

      // App Private API Client pointing to apps/template-app/api.php
      const syscall = (window.sys && window.sys.syscall) || (window.sys && window.sys.api);
      this.appApi = syscall
        ? syscall.forApp('template-app')
        : new SyscallClient('apps/template-app/api.php');

      this.selectedFile = null;
      this.notes = [];
      this.eventLogs = [];
      this.isListeningEvents = false;
    }

    onOpen() {
      this.registerMenus();
      this.setupEventBusListener();
      this.loadNotes();
      if (this.toast) {
        this.toast.info(this.t('template.status_ready'));
      }
    }

    onClose() {
      if (this.eventUnsubscribe) {
        this.eventUnsubscribe();
      }
    }

    /**
     * Top MenuBar integration
     */
    registerMenus() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenus('template-app', [
        {
          id: 'file',
          label: 'Fichier',
          items: [
            { id: 'open-filepicker', label: '📁 Ouvrir Sélecteur...', action: () => this.openFilePickerDemo() },
            { id: 'clear-notes', label: '🗑️ Effacer les notes', action: () => this.clearNotes() },
            { separator: true },
            { id: 'close-app', label: 'Fermer', action: () => this.close() }
          ]
        },
        {
          id: 'tools',
          label: 'Outils',
          items: [
            { id: 'ping-system', label: '📡 Ping Syscall Système', action: () => this.testSystemSyscall() },
            { id: 'emit-event', label: '⚡ Émettre Événement IPC', action: () => this.emitDemoEvent() }
          ]
        },
        {
          id: 'help',
          label: 'Aide',
          items: [
            { id: 'about-template', label: 'À propos de Template App', action: () => this.showAboutModal() }
          ]
        }
      ]);
    }

    /**
     * Global EventBus listener
     */
    setupEventBusListener() {
      if (this.isListeningEvents || !window.sys || !window.sys.events) return;
      this.isListeningEvents = true;

      const logEvent = (name, payload) => {
        const time = new Date().toLocaleTimeString();
        this.eventLogs.unshift({ time, name, payload: JSON.stringify(payload || {}) });
        if (this.eventLogs.length > 30) this.eventLogs.pop();
        this.updateEventLogUI();
      };

      const bus = window.sys.events;
      bus.on('theme:change', (e) => logEvent('theme:change', e));
      bus.on('locale:change', (e) => logEvent('locale:change', e));
      bus.on('template:ping', (e) => logEvent('template:ping', e));
      bus.on('filepicker:select', (e) => logEvent('filepicker:select', e));
    }

    // -------------------------------------------------------------
    // Tab Renderers
    // -------------------------------------------------------------

    renderTab(tabId) {
      if (tabId === 'overview') return this.renderOverviewTab();
      if (tabId === 'filepicker') return this.renderFilePickerTab();
      if (tabId === 'backend') return this.renderBackendTab();
      if (tabId === 'events') return this.renderEventsTab();
      return '';
    }

    renderOverviewTab() {
      return `
        <div class="template-app-container">
          <div class="template-card">
            <h2>🧪 ${this.escapeHtml(this.t('template.welcome_title'))}</h2>
            <p>${this.escapeHtml(this.t('template.welcome_subtitle'))}</p>
            
            <div class="template-actions" style="margin-top:8px;">
              <button type="button" class="webos-btn webos-btn-primary" id="tmplBtnToast">
                🔔 ${this.escapeHtml(this.t('template.btn_toast'))}
              </button>
              <button type="button" class="webos-btn" id="tmplBtnConfirm">
                ❓ ${this.escapeHtml(this.t('template.btn_confirm'))}
              </button>
              <button type="button" class="webos-btn" id="tmplBtnAudio">
                🎵 ${this.escapeHtml(this.t('template.btn_audio'))}
              </button>
              <button type="button" class="webos-btn" id="tmplBtnPingSystem">
                📡 ${this.escapeHtml(this.t('template.ping_api'))}
              </button>
            </div>
          </div>

          <div class="template-card">
            <h3>📖 Guide d'Intégration Rapide</h3>
            <p>Découvrez comment orchestrer les services universels SimpleGallery WebOS :</p>
            <ul style="margin:0; padding-left:20px; font-size:0.875rem; color:var(--text-muted); line-height:1.6;">
              <li><strong>FilePickerService</strong> : <code>window.sys.filePicker.openModal({ ... })</code> pour inviter l'utilisateur à choisir un média.</li>
              <li><strong>SyscallClient</strong> : <code>window.sys.syscall.forApp('app-id')</code> pour communiquer de manière isolée avec <code>apps/app-id/api.php</code>.</li>
              <li><strong>StorageRepository</strong> : <code>StorageRepository::forApp('app-id')</code> côté PHP pour stocker des données JSON atomiques dans <code>storage/apps/app-id/</code>.</li>
              <li><strong>EventBus IPC</strong> : <code>window.sys.events.emit()</code> / <code>on()</code> pour le couplage lâche inter-applications.</li>
            </ul>
          </div>
        </div>
      `;
    }

    renderFilePickerTab() {
      const file = this.selectedFile;
      return `
        <div class="template-app-container">
          <div class="template-card">
            <h3>📁 Sélecteur Universel de Fichiers (FilePickerService)</h3>
            <p>Permet à n'importe quelle application tierce de solliciter la sélection d'un fichier présent dans la galerie avec filtres de catégorie.</p>
            
            <div class="template-actions">
              <button type="button" class="webos-btn webos-btn-primary" id="tmplBtnOpenFilePicker">
                📂 ${this.escapeHtml(this.t('template.open_file_picker'))}
              </button>
            </div>

            <div style="margin-top:12px;">
              <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:8px;">
                ${this.escapeHtml(this.t('template.selected_file'))}
              </label>

              ${file ? `
                <div class="template-file-preview">
                  ${(file.category === 'image' || file.category === 'video') ? `
                    <img src="system/endpoints/thumb.php?file=${encodeURIComponent(file.path)}" class="template-file-thumb" alt="thumbnail" />
                  ` : `
                    <div class="template-file-thumb">📄</div>
                  `}
                  <div class="template-file-info">
                    <div class="template-file-name">${this.escapeHtml(file.name)}</div>
                    <div class="template-file-details">
                      <span><strong>Taille :</strong> ${this.escapeHtml(file.size_formatted || `${file.size || 0} B`)}</span> |
                      <span><strong>Type :</strong> ${this.escapeHtml((file.extension || '').toUpperCase())}</span> |
                      <span><strong>Chemin :</strong> <code>${this.escapeHtml(file.path)}</code></span>
                    </div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <button type="button" class="webos-btn" id="tmplBtnInspectFile" title="Inspecter">ℹ️ ${this.escapeHtml(this.t('template.inspect_meta'))}</button>
                    <button type="button" class="webos-btn webos-btn-primary" id="tmplBtnOpenViewer" title="Visualiser">👁️ ${this.escapeHtml(this.t('template.open_viewer'))}</button>
                  </div>
                </div>
              ` : `
                <div style="padding:20px; text-align:center; background:var(--bg-main, rgba(0,0,0,0.03)); border-radius:8px; color:var(--text-muted); font-size:0.875rem;">
                  ${this.escapeHtml(this.t('template.no_file_selected'))}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }

    renderBackendTab() {
      return `
        <div class="template-app-container">
          <div class="template-card">
            <h3>💾 ${this.escapeHtml(this.t('template.notepad_title'))}</h3>
            <p>Les données sont enregistrées de façon isolée et sécurisée dans <code>storage/apps/template-app/notes.json</code> via le backend privé <code>apps/template-app/api.php</code>.</p>
            
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
              <input type="text" id="tmplNoteTitle" class="webos-search-input" placeholder="${this.escapeHtml(this.t('template.note_title_placeholder'))}" style="width:100%; box-sizing:border-box;">
              <textarea id="tmplNoteContent" class="webos-search-input" placeholder="${this.escapeHtml(this.t('template.note_content_placeholder'))}" style="width:100%; height:80px; box-sizing:border-box; resize:vertical; font-family:inherit;"></textarea>
              
              <div class="template-actions">
                <button type="button" class="webos-btn webos-btn-primary" id="tmplBtnSaveNote">
                  💾 ${this.escapeHtml(this.t('template.save_note'))}
                </button>
                <button type="button" class="webos-btn" id="tmplBtnClearNotes">
                  🗑️ ${this.escapeHtml(this.t('template.clear_notes'))}
                </button>
                <button type="button" class="webos-btn" id="tmplBtnPingAppBackend">
                  ⚡ Ping Backend App (api.php)
                </button>
              </div>
            </div>

            <div style="margin-top:14px;">
              <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:8px;">
                Notes enregistrées (${this.notes.length}) :
              </label>
              <div class="template-notes-list" id="tmplNotesContainer">
                ${this.renderNotesList()}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderNotesList() {
      if (!this.notes || this.notes.length === 0) {
        return `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:0.8rem;">Aucune note enregistrée.</div>`;
      }
      return this.notes.map(note => `
        <div class="template-note-item">
          <div class="template-note-header">
            <span class="template-note-title">📝 ${this.escapeHtml(note.title)}</span>
            <span class="template-note-date">${new Date((note.timestamp || 0) * 1000).toLocaleString()}</span>
          </div>
          ${note.content ? `<div class="template-note-content">${this.escapeHtml(note.content)}</div>` : ''}
        </div>
      `).join('');
    }

    renderEventsTab() {
      return `
        <div class="template-app-container">
          <div class="template-card">
            <h3>⚡ ${this.escapeHtml(this.t('template.events_title'))}</h3>
            <p>Capture en direct des messages IPC transitant sur le bus central <code>window.sys.events</code>.</p>
            
            <div class="template-actions">
              <button type="button" class="webos-btn webos-btn-primary" id="tmplBtnEmitEvent">
                📢 ${this.escapeHtml(this.t('template.emit_ping'))}
              </button>
              <button type="button" class="webos-btn" id="tmplBtnClearLogs">
                🧹 Effacer l'historique
              </button>
            </div>

            <div style="margin-top:10px;">
              <div class="template-event-log" id="tmplEventLogContainer">
                ${this.renderEventRows()}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderEventRows() {
      if (!this.eventLogs || this.eventLogs.length === 0) {
        return `<div style="color:var(--text-muted);">En attente d'événements IPC...</div>`;
      }
      return this.eventLogs.map(ev => `
        <div class="template-event-row">
          <span class="template-event-time">[${ev.time}]</span>
          <span class="template-event-name">${this.escapeHtml(ev.name)}</span>
          <span style="color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(ev.payload)}</span>
        </div>
      `).join('');
    }

    // -------------------------------------------------------------
    // Event Handlers & API Actions
    // -------------------------------------------------------------

    bindEvents(container) {
      super.bindEvents(container);

      // Overview Actions
      container.querySelector('#tmplBtnToast')?.addEventListener('click', () => {
        if (this.toast) this.toast.success('Exemple de notification Toast réussie !');
      });

      container.querySelector('#tmplBtnConfirm')?.addEventListener('click', () => {
        if (this.dialog) {
          this.dialog.confirm({
            title: 'Confirmation WebOS',
            message: 'Souhaitez-vous valider cette action de démonstration ?',
            onConfirm: () => {
              if (this.toast) this.toast.info('Action confirmée !');
            }
          });
        }
      });

      container.querySelector('#tmplBtnAudio')?.addEventListener('click', () => {
        if (window.sys && window.sys.audio && typeof window.sys.audio.play === 'function') {
          window.sys.audio.play('pop');
        } else if (this.toast) {
          this.toast.info('🎵 Effet sonore déclenché');
        }
      });

      container.querySelector('#tmplBtnPingSystem')?.addEventListener('click', () => this.testSystemSyscall());

      // FilePicker Actions
      container.querySelector('#tmplBtnOpenFilePicker')?.addEventListener('click', () => this.openFilePickerDemo());

      container.querySelector('#tmplBtnInspectFile')?.addEventListener('click', () => {
        if (this.selectedFile && window.sys && window.sys.showMetadata) {
          window.sys.showMetadata(this.selectedFile);
        }
      });

      container.querySelector('#tmplBtnOpenViewer')?.addEventListener('click', () => {
        if (this.selectedFile && window.sys && window.sys.mediaViewer) {
          window.sys.mediaViewer.openFile(this.selectedFile);
        }
      });

      // Backend Actions
      container.querySelector('#tmplBtnSaveNote')?.addEventListener('click', () => this.saveNote());
      container.querySelector('#tmplBtnClearNotes')?.addEventListener('click', () => this.clearNotes());
      container.querySelector('#tmplBtnPingAppBackend')?.addEventListener('click', () => this.pingAppBackend());

      // EventBus Actions
      container.querySelector('#tmplBtnEmitEvent')?.addEventListener('click', () => this.emitDemoEvent());
      container.querySelector('#tmplBtnClearLogs')?.addEventListener('click', () => {
        this.eventLogs = [];
        this.updateEventLogUI();
      });
    }

    async openFilePickerDemo() {
      if (!window.sys || !window.sys.filePicker) {
        if (this.toast) this.toast.error('FilePickerService non disponible.');
        return;
      }

      window.sys.filePicker.openModal({
        title: 'Sélectionner un fichier de test',
        allowMultiple: false,
        onSelect: (selected) => {
          const file = Array.isArray(selected) ? selected[0] : selected;
          if (file) {
            this.selectedFile = file;
            if (this.toast) this.toast.success(`Fichier sélectionné : ${file.name}`);
            if (window.sys && window.sys.events) {
              window.sys.events.emit('filepicker:select', { file: file.name, path: file.path });
            }
            this.switchTab('filepicker');
          }
        }
      });
    }

    async loadNotes() {
      try {
        const res = await this.appApi.get('template_get_notes');
        if (res.success && Array.isArray(res.notes)) {
          this.notes = res.notes;
          const container = document.getElementById('tmplNotesContainer');
          if (container) container.innerHTML = this.renderNotesList();
        }
      } catch (e) {
        console.warn('[TemplateApp] Failed to load notes:', e);
      }
    }

    async saveNote() {
      const titleInput = document.getElementById('tmplNoteTitle');
      const contentInput = document.getElementById('tmplNoteContent');
      const title = titleInput ? titleInput.value.trim() : '';
      const content = contentInput ? contentInput.value.trim() : '';

      if (!title) {
        if (this.toast) this.toast.warning('Veuillez saisir un titre pour la note.');
        return;
      }

      try {
        const res = await this.appApi.post('template_save_note', { title, content });
        if (res.success) {
          if (this.toast) this.toast.success('Note enregistrée avec succès !');
          if (titleInput) titleInput.value = '';
          if (contentInput) contentInput.value = '';
          if (res.notes) this.notes = res.notes;
          const container = document.getElementById('tmplNotesContainer');
          if (container) container.innerHTML = this.renderNotesList();
        } else {
          if (this.toast) this.toast.error(res.error || 'Erreur d\'enregistrement.');
        }
      } catch (e) {
        if (this.toast) this.toast.error('Échec de la communication avec le backend.');
      }
    }

    async clearNotes() {
      try {
        const res = await this.appApi.post('template_clear_notes');
        if (res.success) {
          this.notes = [];
          const container = document.getElementById('tmplNotesContainer');
          if (container) container.innerHTML = this.renderNotesList();
          if (this.toast) this.toast.info('Calepin réinitialisé.');
        }
      } catch (e) {
        if (this.toast) this.toast.error('Erreur lors de la réinitialisation.');
      }
    }

    async pingAppBackend() {
      try {
        const res = await this.appApi.get('template_ping');
        if (res.success) {
          if (this.toast) this.toast.success(`Backend App OK (${res.message})`);
        }
      } catch (e) {
        if (this.toast) this.toast.error('Backend inaccessible.');
      }
    }

    async testSystemSyscall() {
      if (!window.sys || !window.sys.syscall) return;
      try {
        const res = await window.sys.syscall.get('get_system_info');
        if (res.success) {
          if (this.toast) this.toast.success(`Syscall Système OK (RAM libre : ${res.memory?.free_formatted || 'N/A'})`);
        } else {
          if (this.toast) this.toast.warning('Syscall a répondu avec une erreur.');
        }
      } catch (e) {
        if (this.toast) this.toast.error('Erreur lors du syscall système.');
      }
    }

    emitDemoEvent() {
      if (window.sys && window.sys.events) {
        const payload = { timestamp: Date.now(), source: 'template-app', random: Math.floor(Math.random() * 1000) };
        window.sys.events.emit('template:ping', payload);
        if (this.toast) this.toast.info('Événement "template:ping" émis sur le bus IPC.');
      }
    }

    updateEventLogUI() {
      const container = document.getElementById('tmplEventLogContainer');
      if (container) {
        container.innerHTML = this.renderEventRows();
      }
    }

    showAboutModal() {
      if (this.dialog) {
        this.dialog.alert({
          title: 'À propos de Template App',
          message: 'SimpleGallery WebOS Reference Template v2.0\nConçu pour illustrer les bonnes pratiques de développement d\'applications modulaires.'
        });
      }
    }
  }

  // Register with AppManager
  if (window.sys && window.sys.appManager) {
    window.sys.appManager.register(new TemplateApp());
  } else if (window.WebOSAppManager) {
    window.WebOSAppManager.register(new TemplateApp());
  }

})(window);
