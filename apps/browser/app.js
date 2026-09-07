/**
 * SimpleGallery 2026 - WebOS Native Web Browser Application
 * Features:
 * - Multi-tab browsing with isolated per-tab navigation & history (Back, Forward, Reload, Home)
 * - Smart Omnibar with protocol badge, URL detection & DuckDuckGo search integration
 * - Quick Bookmarks bar (Local Gallery, Documentation, DuckDuckGo, Wikipedia)
 * - Native Local File Integration: opens HTML/HTM files directly from gallery storage
 * - Seamless bridge to Doc-Viewer: "📄 View Source" action to inspect or edit raw HTML in WYSIWYG/Code
 * - Full-screen toggle & external browser fallback
 */
(function (window) {
  'use strict';
  const document = window.document;

  const WebOSApp = (window.sys && window.sys.App) || window.WebOSApp || class {
    constructor(manifest) { this.manifest = manifest; }
    t(k) { return k; }
    escapeHtml(s) { return String(s || ''); }
  };

  class WebOSBrowserApp extends WebOSApp {
    constructor() {
      super({
        id: 'browser',
        title: 'apps.browser.title',
        icon: '🌐',
        width: 1020,
        height: 680,
        resizable: true
      });

      this.tabs = [];
      this.activeTabIndex = 0;
      this.tabCounter = 0;
      this.currentFile = null;

      let storedProxy = false;
      try {
        if (typeof window.localStorage !== 'undefined') {
          storedProxy = (window.localStorage.getItem('webos_browser_proxy') === 'true');
        }
      } catch (e) {}
      this.useProxy = storedProxy;

      if (typeof window.addEventListener === 'function') {
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'webos-browser-navigated' && e.data.url) {
            this.onIframeNavigated(e.data.url);
          }
        });
      }
    }

    getEffectiveIframeUrl(rawUrl) {
      if (!rawUrl) return '';
      if (!this.useProxy) return rawUrl;

      // Only proxy external web requests, leave local files direct
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        return `api.php?action=browser_proxy&url=${encodeURIComponent(rawUrl)}`;
      }
      return rawUrl;
    }

    toggleProxy() {
      this.useProxy = !this.useProxy;
      try {
        if (typeof window.localStorage !== 'undefined') {
          window.localStorage.setItem('webos_browser_proxy', this.useProxy ? 'true' : 'false');
        }
      } catch (e) {}

      const activeTab = this.tabs[this.activeTabIndex];
      if (activeTab && activeTab.url && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
        this.loadUrlInTab(this.activeTabIndex, activeTab.url);
      } else {
        this.render();
      }
    }

    onIframeNavigated(newUrl) {
      const activeTab = this.tabs[this.activeTabIndex];
      if (!activeTab) return;
      if (newUrl && activeTab.url !== newUrl) {
        activeTab.url = newUrl;
        activeTab.title = this.formatUrlTitle(newUrl);
        if (activeTab.history[activeTab.historyIndex] !== newUrl) {
          activeTab.history.push(newUrl);
          activeTab.historyIndex = activeTab.history.length - 1;
        }
        this.updateToolbarUI();
      }
    }

    t(key, replacements = {}) {
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, replacements);
      }
      return super.t ? super.t(key, replacements) : key;
    }

    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    onOpen(params = {}) {
      if (this.tabs.length === 0) {
        let initialUrl = '';
        let initialTitle = '';

        if (params.file) {
          this.currentFile = params.file;
          initialUrl = params.file.file_url || params.file.path || '';
          initialTitle = params.file.name || 'HTML Document';
        } else if (params.url) {
          initialUrl = params.url;
          initialTitle = params.title || initialUrl;
        }

        this.addTab(initialUrl, initialTitle);
      } else if (params.file) {
        this.currentFile = params.file;
        const targetUrl = params.file.file_url || params.file.path || '';
        this.addTab(targetUrl, params.file.name || 'HTML Document');
      } else if (params.url) {
        this.addTab(params.url, params.title || params.url);
      }

      this.render();
    }

    addTab(url = '', title = '') {
      this.tabCounter++;
      const id = `tab-${this.tabCounter}`;
      const newTab = {
        id,
        url: url || '',
        title: title || (url ? this.formatUrlTitle(url) : this.t('browser.new_tab')),
        history: url ? [url] : [],
        historyIndex: url ? 0 : -1,
        isLoading: false
      };

      this.tabs.push(newTab);
      this.activeTabIndex = this.tabs.length - 1;
      this.render();

      if (url) {
        this.loadUrlInTab(this.activeTabIndex, url);
      }
      return newTab;
    }

    closeTab(index, event) {
      if (event) event.stopPropagation();
      if (index < 0 || index >= this.tabs.length) return;

      this.tabs.splice(index, 1);
      if (this.tabs.length === 0) {
        this.addTab('', '');
        return;
      }

      if (this.activeTabIndex >= this.tabs.length) {
        this.activeTabIndex = this.tabs.length - 1;
      }
      this.render();
    }

    switchTab(index) {
      if (index < 0 || index >= this.tabs.length) return;
      this.activeTabIndex = index;
      this.render();
    }

    formatUrlTitle(url) {
      if (!url) return this.t('browser.new_tab');
      try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const parsed = new URL(url);
          return parsed.hostname.replace(/^www\./, '');
        }
        return url.split('/').pop() || url;
      } catch (e) {
        return url.split('/').pop() || url;
      }
    }

    normalizeUrl(input) {
      const trimmed = (input || '').trim();
      if (!trimmed) return '';

      // Direct protocols
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://')) {
        return trimmed;
      }

      // Local absolute or relative paths
      if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.endsWith('.html') || trimmed.endsWith('.htm')) {
        return trimmed;
      }

      // Domain like example.com or github.com
      if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
        return `https://${trimmed}`;
      }

      // Otherwise DuckDuckGo search
      return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    }

    loadUrlInTab(index, rawUrl) {
      const tab = this.tabs[index];
      if (!tab) return;

      const url = this.normalizeUrl(rawUrl);
      tab.url = url;
      tab.title = this.formatUrlTitle(url);

      if (tab.historyIndex === -1 || tab.history[tab.historyIndex] !== url) {
        tab.history = tab.history.slice(0, tab.historyIndex + 1);
        tab.history.push(url);
        tab.historyIndex = tab.history.length - 1;
      }

      tab.isLoading = true;
      this.render();

      setTimeout(() => {
        const frame = document.getElementById(`browserFrame-${tab.id}`);
        if (frame) {
          frame.src = this.getEffectiveIframeUrl(url);
          frame.onload = () => {
            tab.isLoading = false;
            try {
              if (frame.contentDocument && frame.contentDocument.title) {
                tab.title = frame.contentDocument.title;
              }
            } catch (e) {}
            this.updateToolbarUI();
          };
          frame.onerror = () => {
            tab.isLoading = false;
            this.updateToolbarUI();
          };
        }
      }, 50);
    }

    goBack() {
      const tab = this.tabs[this.activeTabIndex];
      if (tab && tab.historyIndex > 0) {
        tab.historyIndex--;
        const prevUrl = tab.history[tab.historyIndex];
        this.loadUrlInTab(this.activeTabIndex, prevUrl);
      }
    }

    goForward() {
      const tab = this.tabs[this.activeTabIndex];
      if (tab && tab.historyIndex < tab.history.length - 1) {
        tab.historyIndex++;
        const nextUrl = tab.history[tab.historyIndex];
        this.loadUrlInTab(this.activeTabIndex, nextUrl);
      }
    }

    reload() {
      const tab = this.tabs[this.activeTabIndex];
      if (tab && tab.url) {
        const frame = document.getElementById(`browserFrame-${tab.id}`);
        if (frame) {
          tab.isLoading = true;
          this.updateToolbarUI();
          frame.src = tab.url;
        }
      }
    }

    goHome() {
      const tab = this.tabs[this.activeTabIndex];
      if (tab) {
        tab.url = '';
        tab.title = this.t('browser.new_tab');
        this.render();
      }
    }

    viewSource() {
      const tab = this.tabs[this.activeTabIndex];
      if (!tab) return;

      if (this.currentFile && window.DocViewerApp && typeof window.DocViewerApp.open === 'function') {
        window.DocViewerApp.open(this.currentFile);
        return;
      }

      if (tab.url) {
        // Fetch raw text or open in Doc-Viewer
        if (window.DocViewerApp && typeof window.DocViewerApp.open === 'function') {
          const pseudoFile = {
            name: tab.title + '.html',
            path: tab.url,
            file_url: tab.url,
            extension: 'html'
          };
          window.DocViewerApp.open(pseudoFile);
        } else {
          window.open(tab.url, '_blank');
        }
      }
    }

    openExternal() {
      const tab = this.tabs[this.activeTabIndex];
      if (tab && tab.url) {
        window.open(tab.url, '_blank', 'noopener,noreferrer');
      }
    }

    render() {
      const root = document.getElementById(`${this.id}AppContainer`) ||
                   document.getElementById(`${this.id}BodyContent`);
      if (!root) return;

      const activeTab = this.tabs[this.activeTabIndex] || { url: '', title: '', historyIndex: -1, history: [] };
      const canGoBack = activeTab.historyIndex > 0;
      const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;
      const isHttps = activeTab.url.startsWith('https://');

      let tabsHtml = '';
      this.tabs.forEach((tab, idx) => {
        const isActive = idx === this.activeTabIndex;
        tabsHtml += `
          <div class="browser-tab ${isActive ? 'active' : ''}" data-tab-index="${idx}">
            <span style="font-size:0.85rem;">${tab.url ? '📄' : '🌐'}</span>
            <span class="browser-tab-title" title="${this.escapeHtml(tab.title)}">${this.escapeHtml(tab.title)}</span>
            <button type="button" class="browser-tab-close" data-close-index="${idx}" title="${this.escapeHtml(this.t('browser.close_tab'))}">×</button>
          </div>
        `;
      });

      let framesHtml = '';
      this.tabs.forEach((tab, idx) => {
        const isActive = idx === this.activeTabIndex;
        if (!tab.url) {
          framesHtml += `
            <div id="browserTabContent-${tab.id}" class="browser-frame-container ${isActive ? 'active' : ''}">
              <div class="browser-welcome-screen">
                <div class="browser-welcome-icon">🌐</div>
                <div class="browser-welcome-title">${this.escapeHtml(this.t('browser.welcome_title'))}</div>
                <div class="browser-welcome-sub">${this.escapeHtml(this.t('browser.welcome_sub'))}</div>
                
                <form class="browser-welcome-search" onsubmit="return false;">
                  <span style="margin-right:8px;opacity:0.6;">🔍</span>
                  <input type="text" class="browser-home-search-input" data-tab-index="${idx}" placeholder="${this.escapeHtml(this.t('browser.address_placeholder'))}" autofocus />
                </form>

                <div style="font-size:0.8rem;font-weight:600;color:var(--text-muted,#94a3b8);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;">${this.escapeHtml(this.t('browser.quick_links'))}</div>
                <div class="browser-quick-grid">
                  <div class="browser-quick-card" data-url="DOCUMENTATION.md">
                    <div class="browser-quick-card-icon">📚</div>
                    <div class="browser-quick-card-label">${this.escapeHtml(this.t('browser.bookmark_docs'))}</div>
                  </div>
                  <div class="browser-quick-card" data-url="https://duckduckgo.com">
                    <div class="browser-quick-card-icon">🦆</div>
                    <div class="browser-quick-card-label">${this.escapeHtml(this.t('browser.bookmark_ddg'))}</div>
                  </div>
                  <div class="browser-quick-card" data-url="https://fr.wikipedia.org">
                    <div class="browser-quick-card-icon">📖</div>
                    <div class="browser-quick-card-label">${this.escapeHtml(this.t('browser.bookmark_wiki'))}</div>
                  </div>
                  <div class="browser-quick-card" data-url="storage/">
                    <div class="browser-quick-card-icon">📁</div>
                    <div class="browser-quick-card-label">${this.escapeHtml(this.t('browser.bookmark_gallery'))}</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        } else {
          framesHtml += `
            <div id="browserTabContent-${tab.id}" class="browser-frame-container ${isActive ? 'active' : ''}">
              <iframe id="browserFrame-${tab.id}" class="browser-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" src="${this.escapeHtml(this.getEffectiveIframeUrl(tab.url))}" title="${this.escapeHtml(tab.title)}"></iframe>
            </div>
          `;
        }
      });

      root.innerHTML = `
        <div class="webos-browser-app">
          <!-- Top Tabs -->
          <div class="webos-browser-tabs">
            ${tabsHtml}
            <button type="button" class="browser-new-tab-btn" id="browserNewTabBtn" title="${this.escapeHtml(this.t('browser.new_tab'))}">+</button>
          </div>

          <!-- Navigation Toolbar -->
          <div class="webos-browser-toolbar">
            <button type="button" class="browser-nav-btn" id="browserBackBtn" ${canGoBack ? '' : 'disabled'} title="${this.escapeHtml(this.t('browser.back'))}">◀</button>
            <button type="button" class="browser-nav-btn" id="browserForwardBtn" ${canGoForward ? '' : 'disabled'} title="${this.escapeHtml(this.t('browser.forward'))}">▶</button>
            <button type="button" class="browser-nav-btn" id="browserReloadBtn" title="${this.escapeHtml(this.t('browser.reload'))}">🔄</button>
            <button type="button" class="browser-nav-btn" id="browserHomeBtn" title="${this.escapeHtml(this.t('browser.home'))}">🏠</button>

            <!-- Proxy Toggle Button -->
            <button type="button" class="browser-proxy-btn ${this.useProxy ? 'active' : ''}" id="browserProxyBtn" title="${this.escapeHtml(this.t('browser.proxy_tooltip'))}">
              <span class="browser-proxy-icon">🛡️</span>
              <span class="browser-proxy-text">${this.escapeHtml(this.useProxy ? this.t('browser.proxy_active') : this.t('browser.proxy_direct'))}</span>
            </button>

            <!-- Omnibar Address Bar -->
            <div class="browser-omnibar-box ${this.useProxy ? 'proxified' : ''}">
              <span class="browser-protocol-icon">${this.useProxy ? '🛡️' : (isHttps ? '🔒' : (activeTab.url ? '📄' : '🔍'))}</span>
              <input type="text" class="browser-url-input" id="browserOmnibarInput" value="${this.escapeHtml(activeTab.url)}" placeholder="${this.escapeHtml(this.t('browser.address_placeholder'))}" />
            </div>

            <!-- Action Buttons -->
            <button type="button" class="browser-action-btn" id="browserViewSourceBtn" title="${this.escapeHtml(this.t('browser.view_source'))}">📄</button>
            <button type="button" class="browser-action-btn" id="browserExternalBtn" title="${this.escapeHtml(this.t('browser.open_external'))}">↗</button>
          </div>

          <!-- Quick Bookmarks -->
          <div class="webos-browser-bookmarks">
            <button type="button" class="browser-bookmark-pill" data-url="DOCUMENTATION.md">📚 ${this.escapeHtml(this.t('browser.bookmark_docs'))}</button>
            <button type="button" class="browser-bookmark-pill" data-url="https://duckduckgo.com">🦆 ${this.escapeHtml(this.t('browser.bookmark_ddg'))}</button>
            <button type="button" class="browser-bookmark-pill" data-url="https://fr.wikipedia.org">📖 ${this.escapeHtml(this.t('browser.bookmark_wiki'))}</button>
            <button type="button" class="browser-bookmark-pill" data-url="storage/">📁 ${this.escapeHtml(this.t('browser.bookmark_gallery'))}</button>
          </div>

          <!-- Loading Progress Bar -->
          <div id="browserProgressBar" class="browser-progress-bar ${activeTab.isLoading ? 'loading' : ''}"></div>

          <!-- Viewport Frames -->
          <div class="webos-browser-viewport">
            ${framesHtml}
          </div>
        </div>
      `;

      this.bindBrowserEvents(root);
    }

    bindBrowserEvents(root) {
      // Tab Switching & Closing
      root.querySelectorAll('.browser-tab').forEach(el => {
        el.onclick = (e) => {
          if (e.target.closest('.browser-tab-close')) return;
          const idx = parseInt(el.dataset.tabIndex, 10);
          this.switchTab(idx);
        };
      });

      root.querySelectorAll('.browser-tab-close').forEach(btn => {
        btn.onclick = (e) => {
          const idx = parseInt(btn.dataset.closeIndex, 10);
          this.closeTab(idx, e);
        };
      });

      const newTabBtn = root.querySelector('#browserNewTabBtn');
      if (newTabBtn) newTabBtn.onclick = () => this.addTab('', '');

      // Navigation buttons
      const backBtn = root.querySelector('#browserBackBtn');
      const forwardBtn = root.querySelector('#browserForwardBtn');
      const reloadBtn = root.querySelector('#browserReloadBtn');
      const homeBtn = root.querySelector('#browserHomeBtn');
      const proxyBtn = root.querySelector('#browserProxyBtn');
      const viewSourceBtn = root.querySelector('#browserViewSourceBtn');
      const externalBtn = root.querySelector('#browserExternalBtn');

      if (backBtn) backBtn.onclick = () => this.goBack();
      if (forwardBtn) forwardBtn.onclick = () => this.goForward();
      if (reloadBtn) reloadBtn.onclick = () => this.reload();
      if (homeBtn) homeBtn.onclick = () => this.goHome();
      if (proxyBtn) proxyBtn.onclick = () => this.toggleProxy();
      if (viewSourceBtn) viewSourceBtn.onclick = () => this.viewSource();
      if (externalBtn) externalBtn.onclick = () => this.openExternal();

      // Omnibar Input Enter Key
      const omnibar = root.querySelector('#browserOmnibarInput');
      if (omnibar) {
        omnibar.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.loadUrlInTab(this.activeTabIndex, omnibar.value);
          }
        };
        omnibar.onfocus = () => omnibar.select();
      }

      // Welcome Screen Search Inputs
      root.querySelectorAll('.browser-home-search-input').forEach(inp => {
        inp.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const idx = parseInt(inp.dataset.tabIndex, 10);
            this.loadUrlInTab(idx, inp.value);
          }
        };
      });

      // Quick Cards & Bookmark Pills
      root.querySelectorAll('[data-url]').forEach(btn => {
        btn.onclick = () => {
          const targetUrl = btn.dataset.url;
          if (targetUrl) this.loadUrlInTab(this.activeTabIndex, targetUrl);
        };
      });
    }

    updateToolbarUI() {
      const activeTab = this.tabs[this.activeTabIndex];
      if (!activeTab) return;

      const omnibar = document.getElementById('browserOmnibarInput');
      if (omnibar && document.activeElement !== omnibar) {
        omnibar.value = activeTab.url;
      }

      const backBtn = document.getElementById('browserBackBtn');
      const forwardBtn = document.getElementById('browserForwardBtn');
      if (backBtn) backBtn.disabled = activeTab.historyIndex <= 0;
      if (forwardBtn) forwardBtn.disabled = activeTab.historyIndex >= activeTab.history.length - 1;

      const proxyBtn = document.getElementById('browserProxyBtn');
      if (proxyBtn) {
        proxyBtn.className = `browser-proxy-btn ${this.useProxy ? 'active' : ''}`;
        const pText = proxyBtn.querySelector('.browser-proxy-text');
        if (pText) pText.textContent = this.useProxy ? this.t('browser.proxy_active') : this.t('browser.proxy_direct');
      }

      const omnibarBox = document.querySelector('.browser-omnibar-box');
      if (omnibarBox) {
        if (this.useProxy) omnibarBox.classList.add('proxified');
        else omnibarBox.classList.remove('proxified');
        const protoIcon = omnibarBox.querySelector('.browser-protocol-icon');
        if (protoIcon) {
          protoIcon.textContent = this.useProxy ? '🛡️' : (activeTab.url.startsWith('https://') ? '🔒' : (activeTab.url ? '📄' : '🔍'));
        }
      }

      const pbar = document.getElementById('browserProgressBar');
      if (pbar) {
        if (activeTab.isLoading) {
          pbar.className = 'browser-progress-bar loading';
        } else {
          pbar.className = 'browser-progress-bar done';
          setTimeout(() => { pbar.className = 'browser-progress-bar'; }, 300);
        }
      }
    }
  }

  // Instantiate and register
  const browserApp = new WebOSBrowserApp();
  window.WebOSBrowserApp = WebOSBrowserApp;
  window.BrowserApp = browserApp;
  window.browserApp = browserApp;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('browser', browserApp);
  }
})(window);
