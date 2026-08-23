/**
 * SimpleGallery Userland - Application Manager
 * Registers, lifecycle-manages, and launches semi-autonomous apps from apps/
 */
class AppManager {
    constructor() {
        this.apps = new Map();
        this.activeApp = null;
        this.mimeMap = new Map();
        this.extMap = new Map();

        this.initDefaultApps();
    }

    /**
     * Ingests all auto-discovered application manifests provided by PluginDiscovery via window.SG_DISCOVERED_APPS
     */
    initDefaultApps() {
        const discovered = (typeof window !== 'undefined' && window.SG_DISCOVERED_APPS) || {};
        if (typeof discovered === 'object' && Object.keys(discovered).length > 0) {
            Object.values(discovered).forEach(appInfo => {
                if (appInfo && appInfo.manifest && appInfo.id) {
                    this.registerApp(appInfo.manifest, null);
                } else if (appInfo && appInfo.id) {
                    this.registerApp(appInfo, null);
                }
            });
        }
    }

    /**
     * Re-scans and synchronizes discovered apps from window.SG_DISCOVERED_APPS
     */
    refreshDiscoveredApps() {
        this.initDefaultApps();
    }

    registerApp(manifest, appInstance) {
        if (typeof manifest === 'string') {
            manifest = { id: manifest };
        }
        if (!manifest || !manifest.id) {
            console.error('[AppManager] Invalid app manifest:', manifest);
            return;
        }

        const existing = this.apps.get(manifest.id);
        this.apps.set(manifest.id, {
            manifest: { ...(existing ? existing.manifest : {}), ...manifest },
            instance: appInstance || (existing ? existing.instance : null),
            running: false
        });

        // Register extension associations
        if (Array.isArray(manifest.extensions)) {
            manifest.extensions.forEach(ext => {
                this.extMap.set(ext.toLowerCase(), manifest.id);
            });
        }

        // Register mime type associations
        if (Array.isArray(manifest.mimeTypes)) {
            manifest.mimeTypes.forEach(mime => {
                this.mimeMap.set(mime.toLowerCase(), manifest.id);
            });
        }
    }

    /**
     * Registers or binds a live application instance to its manifest ID
     */
    registerInstance(appId, appInstance) {
        if (!appId || !appInstance) return;
        const entry = this.apps.get(appId);
        if (entry) {
            entry.instance = appInstance;
        } else {
            this.apps.set(appId, {
                manifest: { id: appId },
                instance: appInstance,
                running: false
            });
        }
    }

    getAppForFile(file) {
        if (!file) return null;
        const ext = (file.extension || '').toLowerCase();
        if (this.extMap.has(ext)) {
            return this.apps.get(this.extMap.get(ext));
        }
        const cat = (file.category || '').toLowerCase();
        if (cat === 'image') return this.apps.get('image-viewer');
        if (cat === 'video') return this.apps.get('video-player');
        if (cat === 'audio') return this.apps.get('audio-player');
        if (cat === 'doc') return this.apps.get('doc-viewer');
        if (cat === 'archive') return this.apps.get('archive-manager');
        if (cat === 'videowall') return this.apps.get('video-player');
        return null;
    }

    getAppTitle(appId) {
        const entry = this.apps.get(appId);
        const manifest = entry ? entry.manifest : null;
        
        const key = `apps.${appId}.title`;
        const trans = window.desktop ? window.desktop.t(key) : (window.I18nEngine ? window.I18nEngine.t(key) : key);
        if (trans && trans !== key) return trans;
        
        return (manifest && manifest.name) || appId;
    }

    getAppDescription(appId) {
        const entry = this.apps.get(appId);
        const manifest = entry ? entry.manifest : null;
        const currentLocale = (window.desktop && window.desktop.state && window.desktop.state.currentLocale) || document.documentElement.lang || 'fr';
        if (manifest && manifest.locales && manifest.locales[currentLocale] && manifest.locales[currentLocale].description) {
            return manifest.locales[currentLocale].description;
        }
        
        const key = `apps.${appId}.description`;
        const trans = window.desktop ? window.desktop.t(key) : (window.I18nEngine ? window.I18nEngine.t(key) : key);
        if (trans && trans !== key) return trans;
        
        return (manifest && manifest.description) || '';
    }

    getAllApps() {
        // Ensure discovered apps are loaded
        if (this.apps.size === 0) {
            this.initDefaultApps();
        }

        const list = [];
        this.apps.forEach((entry, id) => {
            const manifestCat = (entry.manifest && entry.manifest.category) ? String(entry.manifest.category).trim() : '';
            const discoveredCat = (window.SG_DISCOVERED_APPS && window.SG_DISCOVERED_APPS[id] && window.SG_DISCOVERED_APPS[id].category) ? window.SG_DISCOVERED_APPS[id].category : '';
            const cat = manifestCat || discoveredCat || '';

            list.push({
                id,
                name: this.getAppTitle(id),
                icon: (entry.manifest && entry.manifest.icon) || '🗔',
                category: cat,
                description: this.getAppDescription(id),
                manifest: entry.manifest,
                instance: entry.instance
            });
        });
        return list;
    }

    /**
     * Dynamically and generically launches any registered application
     */
    launchApp(appId, params = {}) {
        if (!appId) return;

        // Ensure discovered apps are loaded
        if (this.apps.size === 0) {
            this.initDefaultApps();
        }

        const entry = this.apps.get(appId);

        // 1. Direct AppInstance registered on AppManager
        if (entry && entry.instance && typeof entry.instance.open === 'function') {
            entry.instance.open(params.file || params, params, window.desktop || window.explorerApp);
            if (window.EventBus) window.EventBus.emit('app:launch', { appId, params });
            return;
        }

        // 2. Generic naming conventions for loaded global app instances
        const camelId = appId.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
        const pascalId = camelId.charAt(0).toUpperCase() + camelId.slice(1);

        const candidates = [
            window[appId + 'App'],
            window[camelId + 'App'],
            window[pascalId + 'App'],
            window[appId],
            window[camelId],
            window[pascalId],
            window.sys && window.sys[camelId],
            window.sys && window.sys[appId]
        ];

        for (const candidate of candidates) {
            if (candidate && typeof candidate.open === 'function') {
                candidate.open(params.file || params, params, window.desktop || window.explorerApp);
                if (window.EventBus) window.EventBus.emit('app:launch', { appId, params });
                return;
            }
        }

        // 3. Built-in Special Modals & Windows (Settings / Admin)
        if (appId === 'settings') {
            if (window.SettingsApp && typeof window.SettingsApp.open === 'function') {
                window.SettingsApp.open(params.tab || null);
            } else if (window.desktop && typeof window.desktop.openAdminModal === 'function') {
                window.desktop.openAdminModal();
            }
            if (window.EventBus) window.EventBus.emit('app:launch', { appId, params });
            return;
        }

        if (appId === 'admin') {
            if (window.desktop && typeof window.desktop.openAdminModal === 'function') {
                window.desktop.openAdminModal();
            } else {
                const btn = document.getElementById('adminBtn');
                if (btn) btn.click();
            }
            if (window.EventBus) window.EventBus.emit('app:launch', { appId, params });
            return;
        }

        // 4. File-based viewers registered in MediaViewerRegistry
        if (params.file && window.MediaViewerRegistry) {
            if (typeof window.MediaViewerRegistry.open === 'function') {
                window.MediaViewerRegistry.open(params.file, params, window.desktop || window.explorerApp);
            } else if (typeof window.MediaViewerRegistry.findViewer === 'function') {
                const viewer = window.MediaViewerRegistry.findViewer(params.file);
                if (viewer && typeof viewer.open === 'function') {
                    viewer.open(params.file, params, window.desktop || window.explorerApp);
                }
            }
            if (window.EventBus) window.EventBus.emit('app:launch', { appId, params });
            return;
        }

        // 5. If application has file associations, open file picker
        const hasFileAssociations = entry && entry.manifest && (
            (Array.isArray(entry.manifest.extensions) && entry.manifest.extensions.length > 0) ||
            (Array.isArray(entry.manifest.mimeTypes) && entry.manifest.mimeTypes.length > 0)
        );

        if (hasFileAssociations) {
            this.openFilePicker(appId);
        } else {
            console.warn(`[AppManager] No runnable instance found for app: "${appId}"`);
        }

        if (window.EventBus) {
            window.EventBus.emit('app:launch', { appId, params });
        }
    }

    openFilePicker(appId) {
        const entry = this.apps.get(appId);
        const appTitle = this.getAppTitle(appId);
        const appIcon = (entry && entry.manifest && entry.manifest.icon) || '🗔';
        const exts = (entry && entry.manifest && entry.manifest.extensions) || [];

        const files = (window.explorerApp && window.explorerApp.state && window.explorerApp.state.files) || [];
        const matchingFiles = exts.length > 0 
            ? files.filter(f => exts.includes((f.extension || '').toLowerCase()))
            : files;

        let contentHtml = '';

        if (matchingFiles.length > 0) {
            contentHtml = `
                <div style="padding: 1.25rem;">
                    <div style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.88rem;">
                        Sélectionnez un fichier à ouvrir avec <strong>${this.escapeHtml(appTitle)}</strong> :
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; max-height: 380px; overflow-y: auto;">
                        ${matchingFiles.map((f, idx) => `
                            <button type="button" class="file-picker-item" data-file-idx="${idx}" style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 0.6rem; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; text-align: center; transition: all 0.15s ease;">
                                <div style="width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
                                    ${f.thumb_url ? `<img src="${f.thumb_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${this.escapeHtml(f.name)}">` : appIcon}
                                </div>
                                <span style="font-size: 0.78rem; font-weight: 500; word-break: break-word; line-height: 1.2; max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${this.escapeHtml(f.name)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 0.75rem;">📂</div>
                    <h4 style="color: #fff; margin-bottom: 0.5rem;">Aucun fichier compatible</h4>
                    <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">
                        Aucun fichier compatible avec <strong>${this.escapeHtml(appTitle)}</strong> (${exts.map(e => '.' + e).join(', ')}) n'a été trouvé dans le dossier actuel.
                    </p>
                    <button type="button" id="openExplorerFromPickerBtn" class="pill-btn active" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;">
                        <span>🗂️</span> <span>Ouvrir l'Explorateur</span>
                    </button>
                </div>
            `;
        }

        if (window.WindowManager) {
            const win = window.WindowManager.createWindow({
                id: `picker-${appId}`,
                appId: 'explorer',
                appName: appTitle,
                title: `Ouvrir avec ${appTitle}`,
                icon: appIcon,
                width: 520,
                height: 420,
                content: contentHtml,
                onFocus: () => {}
            });

            if (win && win.element) {
                win.element.querySelectorAll('.file-picker-item').forEach(btn => {
                    btn.onclick = () => {
                        const idx = parseInt(btn.dataset.fileIdx, 10);
                        const file = matchingFiles[idx];
                        window.WindowManager.closeWindow(`picker-${appId}`);
                        if (file) {
                            this.launchApp(appId, { file });
                        }
                    };
                });

                const expBtn = win.element.querySelector('#openExplorerFromPickerBtn');
                if (expBtn) {
                    expBtn.onclick = () => {
                        window.WindowManager.closeWindow(`picker-${appId}`);
                        this.launchApp('explorer');
                    };
                }
            }
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

window.sys = window.sys || {};
window.sys.appManager = new AppManager();
