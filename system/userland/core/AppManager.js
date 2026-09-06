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

    /**
     * Universal registration method (supports instance, (appId, instance), or (manifest, instance))
     */
    register(arg1, arg2) {
        if (arg1 && typeof arg1 === 'object' && arg1.id && (typeof arg1.open === 'function' || arg2 === undefined)) {
            // Called as register(appInstance)
            this.registerInstance(arg1.id, arg1);
            return;
        }
        if (typeof arg1 === 'string') {
            // Called as register('app-id', appInstance)
            this.registerInstance(arg1, arg2);
            return;
        }
        // Called as register(manifest, appInstance)
        this.registerApp(arg1, arg2);
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

    openFile(file) {
        if (!file) return;
        const app = this.getAppForFile(file);
        if (app && app.manifest && app.manifest.id) {
            return this.launchApp(app.manifest.id, { file });
        }
        if (window.sys && window.sys.toast) {
            window.sys.toast.info(`Aucune application associée pour ouvrir "${file.name || file.path}"`);
        }
    }

    getAppTitle(appId) {
        const entry = this.apps.get(appId);
        const manifest = entry ? entry.manifest : null;
        const currentLocale = (window.desktop && window.desktop.state && window.desktop.state.currentLocale) || document.documentElement.lang || 'fr';
        if (manifest && manifest.locales && manifest.locales[currentLocale] && manifest.locales[currentLocale].title) {
            return manifest.locales[currentLocale].title;
        }

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

    /**
     * Get list of disabled application IDs
     * Default disabled apps: sim-maintenance, sim-logbook
     */
    getDisabledAppIds() {
        if (Array.isArray(window.SG_DISABLED_APPS)) {
            return window.SG_DISABLED_APPS;
        }
        try {
            const stored = localStorage.getItem('sg_disabled_apps');
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return ['sim-maintenance', 'sim-logbook'];
    }

    /**
     * Check whether an application is enabled
     */
    isAppEnabled(appId) {
        return !this.getDisabledAppIds().includes(appId);
    }

    /**
     * Check whether an application is disabled
     */
    isAppDisabled(appId) {
        return !this.isAppEnabled(appId);
    }

    /**
     * Enable or disable an application by ID
     */
    setAppEnabled(appId, enabled) {
        let disabledList = this.getDisabledAppIds().slice();
        if (enabled) {
            disabledList = disabledList.filter(id => id !== appId);
        } else {
            if (!disabledList.includes(appId)) {
                disabledList.push(appId);
            }
        }
        window.SG_DISABLED_APPS = disabledList;
        localStorage.setItem('sg_disabled_apps', JSON.stringify(disabledList));

        // Sync with server if sys.api available
        if (window.sys && window.sys.api && typeof window.sys.api.post === 'function') {
            window.sys.api.post('set_app_enabled', { app_id: appId, enabled }).catch(() => {});
        }

        if (window.EventBus) {
            window.EventBus.emit('apps:updated', { appId, enabled, disabledList });
        }
    }

    /**
     * Returns discovered apps list for autostart settings
     */
    getDiscoveredApps() {
        return this.getAllApps(true);
    }

    /**
     * Returns list of registered apps
     * @param {boolean} [includeDisabled=false] Whether to include disabled apps
     */
    getAllApps(includeDisabled = false) {
        // Ensure discovered apps are loaded
        if (this.apps.size === 0) {
            this.initDefaultApps();
        }

        const disabledList = this.getDisabledAppIds();
        const list = [];
        this.apps.forEach((entry, id) => {
            const isEnabled = !disabledList.includes(id);
            if (!includeDisabled && !isEnabled) return;

            const manifestCat = (entry.manifest && entry.manifest.category) ? String(entry.manifest.category).trim() : '';
            const discoveredCat = (window.SG_DISCOVERED_APPS && window.SG_DISCOVERED_APPS[id] && window.SG_DISCOVERED_APPS[id].category) ? window.SG_DISCOVERED_APPS[id].category : '';
            const cat = manifestCat || discoveredCat || '';

            list.push({
                id,
                name: this.getAppTitle(id),
                icon: (entry.manifest && entry.manifest.icon) || '🗔',
                category: cat,
                description: this.getAppDescription(id),
                enabled: isEnabled,
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

    /**
     * Registers or updates controllable commands for an application
     * @param {string} appId
     * @param {Object} commands Map of commandName -> { label, params, description, handler }
     */
    registerAppCommands(appId, commands) {
        if (!appId || !commands || typeof commands !== 'object') return;
        const entry = this.apps.get(appId) || { manifest: { id: appId }, instance: null, running: false };
        entry.commands = { ...(entry.commands || {}), ...commands };
        this.apps.set(appId, entry);
    }

    /**
     * Returns the controllable commands for a specific application
     * Combines registered JS commands, manifest.json commands, and instance commands
     * @param {string} appId
     * @returns {Object} Map of commandName -> commandDefinition
     */
    getAppCommands(appId) {
        if (!appId) return {};
        if (this.apps.size === 0) this.initDefaultApps();

        const entry = this.apps.get(appId);
        const manifestCmds = (entry && entry.manifest && entry.manifest.commands) || {};
        const registeredCmds = (entry && entry.commands) || {};
        const instanceCmds = (entry && entry.instance && typeof entry.instance.getCommands === 'function')
            ? entry.instance.getCommands()
            : ((entry && entry.instance && entry.instance.commands) || {});

        // Built-in fallback command definitions for standard apps
        const builtinDefaults = this.getBuiltinAppCommands(appId);

        return {
            ...builtinDefaults,
            ...manifestCmds,
            ...registeredCmds,
            ...instanceCmds
        };
    }

    /**
     * Built-in fallback commands for system apps if not explicitly defined in manifest
     */
    getBuiltinAppCommands(appId) {
        switch (appId) {
            case 'maps':
                return {
                    flyTo: {
                        label: 'Déplacer la vue (flyTo)',
                        description: 'Anime la caméra vers les coordonnées GPS spécifiées',
                        params: {
                            lat: { type: 'number', label: 'Latitude', default: 48.8566 },
                            lng: { type: 'number', label: 'Longitude', default: 2.3522 },
                            zoom: { type: 'number', label: 'Zoom', default: 14 }
                        }
                    },
                    zoomIn: { label: 'Zoomer avant (+)', params: {} },
                    zoomOut: { label: 'Zoomer arrière (-)', params: {} },
                    setView: {
                        label: 'Centrer la carte (sans animation)',
                        params: {
                            lat: { type: 'number', label: 'Latitude', default: 48.8566 },
                            lng: { type: 'number', label: 'Longitude', default: 2.3522 },
                            zoom: { type: 'number', label: 'Zoom', default: 13 }
                        }
                    }
                };
            case 'image-viewer':
                return {
                    showImage: {
                        label: "Changer d'image",
                        params: {
                            file: { type: 'file', category: 'image', label: 'Fichier image' }
                        }
                    },
                    next: { label: 'Image suivante', params: {} },
                    prev: { label: 'Image précédente', params: {} },
                    rotate: { label: 'Pivoter 90°', params: {} },
                    zoomIn: { label: 'Zoomer avant (+)', params: {} },
                    zoomOut: { label: 'Zoomer arrière (-)', params: {} },
                    resetZoom: { label: 'Réinitialiser le zoom', params: {} }
                };
            case 'doc-viewer':
                return {
                    scroll: {
                        label: 'Faire défiler vers ancre / section',
                        params: {
                            highlight: { type: 'text', label: 'Ancre / Sélecteur', placeholder: '#chapitre-1' }
                        }
                    },
                    nextPage: { label: 'Page suivante', params: {} },
                    prevPage: { label: 'Page précédente', params: {} },
                    toggleEdit: { label: 'Basculer mode édition (WYSIWYG)', params: {} }
                };
            case 'video-player':
                return {
                    play: { label: 'Lecture', params: {} },
                    pause: { label: 'Pause', params: {} },
                    seek: {
                        label: 'Aller à un temps précis',
                        params: {
                            time: { type: 'time', label: 'Instant (MM:SS ou sec)', default: '00:00' }
                        }
                    },
                    setVolume: {
                        label: 'Régler le volume',
                        params: {
                            volume: { type: 'number', min: 0, max: 1, step: 0.1, label: 'Volume (0.0 - 1.0)', default: 1 }
                        }
                    }
                };
            case 'audio-player':
                return {
                    play: { label: 'Lecture', params: {} },
                    pause: { label: 'Pause', params: {} },
                    seek: {
                        label: 'Aller à un temps précis',
                        params: {
                            time: { type: 'time', label: 'Instant (MM:SS ou sec)', default: '00:00' }
                        }
                    }
                };
            default:
                return {};
        }
    }

    /**
     * Returns all applications that have controllable commands
     * @returns {Array<Object>} List of { id, name, icon, commands }
     */
    getAllControllableApps() {
        if (this.apps.size === 0) this.initDefaultApps();
        const appsList = this.getAllApps(false);
        const controllable = [];

        appsList.forEach(app => {
            const cmds = this.getAppCommands(app.id);
            if (cmds && Object.keys(cmds).length > 0) {
                controllable.push({
                    id: app.id,
                    name: app.name,
                    icon: app.icon,
                    commands: cmds
                });
            }
        });

        return controllable;
    }

    /**
     * Universally dispatches a command to an application instance or window
     * @param {string} appId Target app identifier
     * @param {string} command Name of the command to execute
     * @param {Object} params Parameters for the command
     * @param {string} [winId] Optional specific window ID
     * @returns {boolean} True if handled
     */
    dispatchCommand(appId, command, params = {}, winId = null) {
        if (!appId || !command) return false;

        const entry = this.apps.get(appId);
        const wm = window.WindowManager;

        // 1. Try instance handleCommand method
        if (entry && entry.instance && typeof entry.instance.handleCommand === 'function') {
            try {
                const result = entry.instance.handleCommand(command, params, winId);
                if (result !== false) return true;
            } catch (e) {
                console.warn(`[AppManager] Error in ${appId}.handleCommand:`, e);
            }
        }

        // 2. Try direct instance[command] method
        if (entry && entry.instance && typeof entry.instance[command] === 'function') {
            try {
                entry.instance[command](params, winId);
                return true;
            } catch (e) {
                console.warn(`[AppManager] Error calling ${appId}.${command}:`, e);
            }
        }

        // 3. Fallback: app specific global instances (mapsApp, DocViewerApp, ImageViewerPlugin)
        if (appId === 'maps') {
            const mapApp = window.mapsApp;
            const instance = (mapApp && mapApp.activeInstance);
            if (instance && instance.leafletMap) {
                if (command === 'flyTo' || command === 'setView') {
                    const lat = parseFloat(params.lat);
                    const lng = parseFloat(params.lng);
                    const zoom = parseInt(params.zoom, 10) || 14;
                    if (!isNaN(lat) && !isNaN(lng)) {
                        if (command === 'flyTo' && typeof instance.leafletMap.flyTo === 'function') {
                            instance.leafletMap.flyTo([lat, lng], zoom, { duration: 1.5 });
                        } else {
                            instance.leafletMap.setView([lat, lng], zoom);
                        }
                        return true;
                    }
                } else if (command === 'zoomIn') {
                    instance.leafletMap.zoomIn();
                    return true;
                } else if (command === 'zoomOut') {
                    instance.leafletMap.zoomOut();
                    return true;
                }
            }
        } else if (appId === 'doc-viewer') {
            const highlight = params.highlight || params.selector;
            if (command === 'scroll' && highlight) {
                const win = winId && wm ? wm.windows.get(winId) : null;
                const container = (win && win.element) || document.querySelector('.webos-doc-window');
                if (container) {
                    try {
                        const target = container.querySelector(highlight);
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            target.style.transition = 'background 0.3s ease';
                            target.style.background = 'rgba(99, 102, 241, 0.25)';
                            setTimeout(() => { target.style.background = ''; }, 2200);
                            return true;
                        }
                    } catch (e) {}
                }
            }
        } else if (appId === 'image-viewer') {
            if (command === 'showImage' && params.file) {
                if (window.ImageViewerPlugin && typeof window.ImageViewerPlugin.open === 'function') {
                    window.ImageViewerPlugin.open(params.file, {});
                    return true;
                }
            } else if (window.ImageViewerPlugin && typeof window.ImageViewerPlugin.handleCommand === 'function') {
                return window.ImageViewerPlugin.handleCommand(command, params, winId);
            }
        } else if (appId === 'video-player') {
            const videoEl = (winId && document.querySelector(`video[data-win-id="${winId}"]`)) || 
                            document.querySelector('.webos-window.is-active video') || 
                            document.querySelector('video');
            if (videoEl) {
                if (command === 'play') videoEl.play();
                else if (command === 'pause') videoEl.pause();
                else if (command === 'seek' && params.time != null) {
                    const sec = typeof params.time === 'number' ? params.time : parseFloat(params.time) || 0;
                    videoEl.currentTime = sec;
                } else if (command === 'setVolume' && params.volume != null) {
                    videoEl.volume = Math.max(0, Math.min(1, parseFloat(params.volume) || 1));
                }
                return true;
            }
        }

        // 4. Emit event on window and EventBus
        if (window.EventBus) {
            window.EventBus.emit(`app:${appId}:command`, { command, params, winId });
            window.EventBus.emit('app:command', { app: appId, command, params, winId });
        }

        return true;
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

const appManagerInstance = new AppManager();

window.sys = window.sys || {};
window.sys.appManager = appManagerInstance;
window.AppManager = appManagerInstance;
window.WebOSAppManager = appManagerInstance;
