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

    initDefaultApps() {
        const defaultManifests = [
            {
                id: 'explorer',
                name: 'Explorateur',
                icon: '🗂️',
                description: 'Explorateur de dossiers, albums et fichiers multimédias',
                locales: {
                    fr: { title: 'Explorateur de Galerie', description: 'Explorateur de dossiers, albums et fichiers multimédias' },
                    en: { title: 'Gallery Explorer', description: 'Explore folders, albums and multimedia files' }
                }
            },
            {
                id: 'maps',
                name: 'Carte GPS',
                icon: '🗺️',
                description: 'Exploration cartographique et tracé chronologique des photos géolocalisées',
                locales: {
                    fr: { title: 'Carte GPS & Trajets', description: 'Exploration cartographique et tracé chronologique des photos géolocalisées' },
                    en: { title: 'GPS Maps & Routes', description: 'Map exploration and chronological travel paths' }
                }
            },
            {
                id: 'image-viewer',
                name: 'Photos',
                icon: '🖼️',
                description: 'Visionneuse photo haute définition, zoom fluide et métadonnées EXIF',
                extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'],
                locales: {
                    fr: { title: 'Visionneuse Photos', description: 'Visionneuse photo haute définition, zoom fluide et métadonnées EXIF' },
                    en: { title: 'Photo Viewer', description: 'High-definition photo viewer with fluid zoom and EXIF data' }
                }
            },
            {
                id: 'video-player',
                name: 'Lecteur Vidéo',
                icon: '🎬',
                description: 'Lecteur vidéo avec contrôle de vitesse, mur vidéo et sous-titres',
                extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi'],
                locales: {
                    fr: { title: 'Lecteur Vidéo & Mur Vidéo', description: 'Lecteur vidéo avec contrôle de vitesse, mur vidéo et sous-titres' },
                    en: { title: 'Video Player & Video Wall', description: 'Video playback, speed control, video wall and subtitles' }
                }
            },
            {
                id: 'audio-player',
                name: 'Lecteur Audio',
                icon: '🎵',
                description: 'Lecteur de musique avec visualiseur spectral en direct et playlist',
                extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
                locales: {
                    fr: { title: 'Lecteur Audio & Visualiseur', description: 'Lecteur de musique avec visualiseur spectral en direct et playlist' },
                    en: { title: 'Audio Player & Visualizer', description: 'Music player with live audio spectrum visualizer' }
                }
            },
            {
                id: 'doc-viewer',
                name: 'Documents',
                icon: '📄',
                description: 'Lecteur PDF, visualiseur Markdown rendu HTML et éditeur de texte',
                extensions: ['pdf', 'txt', 'md', 'markdown', 'json', 'xml', 'csv', 'log'],
                locales: {
                    fr: { title: 'Visionneuse Documents & Markdown', description: 'Lecteur PDF, visualiseur Markdown rendu HTML et éditeur de texte' },
                    en: { title: 'Document & Markdown Viewer', description: 'PDF reader, rendered Markdown viewer and text editor' }
                }
            },
            {
                id: 'archive-manager',
                name: 'Archives',
                icon: '📦',
                description: 'Exploration d\'archives ZIP et téléchargement de dossiers',
                extensions: ['zip'],
                locales: {
                    fr: { title: 'Gestionnaire d\'Archives', description: 'Exploration d\'archives ZIP et téléchargement de dossiers' },
                    en: { title: 'Archive Manager', description: 'ZIP archive inspection and directory downloads' }
                }
            },
            {
                id: 'settings',
                name: 'Paramètres',
                icon: '⚙️',
                description: 'Configuration du système, sécurité et matrice des droits',
                locales: {
                    fr: { title: 'Paramètres & Administration', description: 'Configuration du système, sécurité et matrice des droits' },
                    en: { title: 'Settings & Administration', description: 'System setup, security and guest permissions matrix' }
                }
            }
        ];

        defaultManifests.forEach(m => this.registerApp(m, null));
    }

    registerApp(manifest, appInstance) {
        if (!manifest || !manifest.id) {
            console.error('[AppManager] Invalid app manifest:', manifest);
            return;
        }

        this.apps.set(manifest.id, {
            manifest,
            instance: appInstance,
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

    getAllApps() {
        const list = [];
        this.apps.forEach((entry, id) => {
            list.push({
                id,
                name: this.getAppTitle(id),
                icon: (entry.manifest && entry.manifest.icon) || '🗔',
                description: this.getAppDescription(id),
                manifest: entry.manifest,
                instance: entry.instance
            });
        });
        return list;
    }

    launchApp(appId, params = {}) {
        if (!appId) return;

        switch (appId) {
            case 'explorer':
                if (window.explorerApp && typeof window.explorerApp.open === 'function') {
                    window.explorerApp.open(params);
                }
                break;

            case 'maps':
                if (window.sys && typeof window.sys.openMaps === 'function') {
                    window.sys.openMaps(params);
                }
                break;

            case 'settings':
            case 'admin':
                if (window.desktop && typeof window.desktop.openAdminModal === 'function') {
                    window.desktop.openAdminModal();
                } else {
                    const btn = document.getElementById('adminBtn');
                    if (btn) btn.click();
                }
                break;

            default:
                const entry = this.apps.get(appId);
                if (entry && entry.instance && typeof entry.instance.open === 'function') {
                    entry.instance.open(params.file || {}, params, window.desktop || window.explorerApp);
                } else if (params.file && window.MediaViewerRegistry) {
                    if (typeof window.MediaViewerRegistry.open === 'function') {
                        window.MediaViewerRegistry.open(params.file, params, window.desktop || window.explorerApp);
                    } else if (typeof window.MediaViewerRegistry.findViewer === 'function') {
                        const viewer = window.MediaViewerRegistry.findViewer(params.file);
                        if (viewer && typeof viewer.open === 'function') {
                            viewer.open(params.file, params, window.desktop || window.explorerApp);
                        }
                    }
                } else {
                    // Open interactive file picker for this application
                    this.openFilePicker(appId);
                }
                break;
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
