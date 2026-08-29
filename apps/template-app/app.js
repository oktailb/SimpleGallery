/**
 * SimpleGallery WebOS - Development Template Application (`TemplateApp`)
 * Reference implementation showing how to build clean, modular apps using WebOSApp & WebOSToolkit.
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
        width: 840,
        height: 580,
        tabs: [
          { id: 'overview', label: 'template.tab_overview', icon: '🏠' },
          { id: 'widgets', label: 'template.tab_widgets', icon: '🛠️' },
          { id: 'api', label: 'template.tab_api', icon: '⚡' }
        ]
      });

      this.demoText = '';
      this.clickCount = 0;
    }

    onOpen() {
      this.toast.info(this.t('template.status_ready'));
    }

    renderTab(tabId) {
      if (tabId === 'overview') return this.renderOverviewTab();
      if (tabId === 'widgets') return this.renderWidgetsTab();
      if (tabId === 'api') return this.renderApiTab();
      return '';
    }

    renderOverviewTab() {
      return `
        <div class="template-app-container">
          <div class="template-card template-hero">
            <h2>🧪 ${this.escapeHtml(this.t('template.welcome_title'))}</h2>
            <p>${this.escapeHtml(this.t('template.welcome_subtitle'))}</p>
            <div class="template-actions" style="justify-content:center;">
              <button type="button" class="webos-btn webos-btn-primary" id="tmplBtnToast">
                🔔 ${this.escapeHtml(this.t('template.btn_toast'))}
              </button>
              <button type="button" class="webos-btn" id="tmplBtnConfirm">
                ❓ ${this.escapeHtml(this.t('template.btn_confirm'))}
              </button>
              <button type="button" class="webos-btn" id="tmplBtnAudio">
                🎵 ${this.escapeHtml(this.t('template.btn_audio'))}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    renderWidgetsTab() {
      return `
        <div class="template-app-container">
          <div class="template-card">
            <h3>🛠️ Composants & Formulaires WebOSToolkit</h3>
            <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px;">
              <div>
                <label style="display:block; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">Saisie de démonstration :</label>
                <input type="text" id="tmplDemoInput" class="webos-search-input" value="${this.escapeHtml(this.demoText)}" placeholder="${this.escapeHtml(this.t('template.input_placeholder'))}" style="width:100%; box-sizing:border-box;">
              </div>
              <div id="tmplSwitchContainer"></div>
              <div id="tmplSliderContainer"></div>
            </div>
          </div>
        </div>
      `;
    }

    renderApiTab() {
      return `
        <div class="template-app-container">
          <div class="template-card">
            <h3>⚡ Services & Communications API WebOS</h3>
            <p style="color:var(--text-muted); font-size:0.9rem;">Interagissez avec le noyau PHP backend et les services système unifiés (sys.fs, sys.storage, sys.audio, sys.dialog).</p>
            <div class="template-actions">
              <button type="button" class="webos-btn webos-btn-primary" id="tmplBtnPingApi">
                📡 Tester l'API RPC (Ping Host)
              </button>
              <button type="button" class="webos-btn" id="tmplBtnStorageSave">
                💾 Sauvegarder l'état (sys.storage)
              </button>
            </div>
            <pre id="tmplApiResult" style="margin-top:16px; padding:12px; background:rgba(0,0,0,0.3); border-radius:8px; font-family:monospace; font-size:0.85rem; overflow-x:auto; min-height:80px;"></pre>
          </div>
        </div>
      `;
    }

    bindEvents(container) {
      if (!container || !window.sys || !window.sys.ui || !window.sys.ui.bindActions) return;

      window.sys.ui.bindActions(container, {
        'click #tmplBtnToast': () => {
          this.clickCount++;
          this.toast.success(`Toast #${this.clickCount} déclenché avec succès !`);
        },
        'click #tmplBtnConfirm': () => {
          if (window.sys && window.sys.dialog) {
            window.sys.dialog.confirm(
              'Souhaitez-vous valider cette action de démonstration ?',
              'Confirmation Template',
              false
            ).then(confirmed => {
              if (confirmed) this.toast.success('Action confirmée !');
              else this.toast.info('Action annulée.');
            });
          }
        },
        'click #tmplBtnAudio': () => {
          if (window.sys && window.sys.audio) {
            window.sys.audio.playWin();
            this.toast.info('Effet sonore WebAudio joué !');
          }
        },
        'input #tmplDemoInput': (el) => {
          this.demoText = el.value;
        },
        'click #tmplBtnPingApi': () => {
          const resultEl = document.getElementById('tmplApiResult');
          if (resultEl) resultEl.textContent = 'Envoi de la requête à api.php...';

          this.api.get('get_autostart_settings').then(res => {
            if (resultEl) resultEl.textContent = JSON.stringify(res, null, 2);
            this.toast.success('Réponse API reçue avec succès');
          }).catch(err => {
            if (resultEl) resultEl.textContent = `Erreur: ${err.message}`;
            this.toast.error('Erreur lors de l\'appel API');
          });
        },
        'click #tmplBtnStorageSave': () => {
          if (window.sys && window.sys.storage) {
            window.sys.storage.set(this.id, 'last_click_count', this.clickCount);
            window.sys.storage.set(this.id, 'demo_text', this.demoText);
            this.toast.success('Données enregistrées dans sys.storage');
          }
        }
      });
    }

    onRender(container) {
      if (this.currentTab === 'widgets') {
        const switchBox = container.querySelector('#tmplSwitchContainer');
        if (switchBox && window.sys && window.sys.ui && window.sys.ui.forms) {
          switchBox.innerHTML = '';
          const sw = window.sys.ui.forms.switch({
            label: 'Option de démonstration active',
            checked: true,
            onChange: (val) => this.toast.info(`Switch mis à jour: ${val}`)
          });
          switchBox.appendChild(sw.element);
        }

        const sliderBox = container.querySelector('#tmplSliderContainer');
        if (sliderBox && window.sys && window.sys.ui && window.sys.ui.forms) {
          sliderBox.innerHTML = '';
          const sl = window.sys.ui.forms.slider({
            label: 'Niveau de réglage / Curseur (Slider) :',
            min: 0,
            max: 100,
            value: 50,
            unit: '%',
            onChange: (val) => console.log('Slider value:', val)
          });
          sliderBox.appendChild(sl.element);
        }
      }
    }
  }

  // Instantiate and mount TemplateApp
  const templateApp = new TemplateApp();
  window.TemplateApp = templateApp;
  window.templateApp = templateApp;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('template-app', templateApp);
  }

})(window);
