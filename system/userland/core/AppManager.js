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

        console.log(`[AppManager] Registered application: ${manifest.name} (${manifest.id})`);
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
        return null;
    }

    async openFile(file, context = {}) {
        const app = this.getAppForFile(file);
        if (app && app.instance && typeof app.instance.open === 'function') {
            window.sys.events.emit('app:before_open', { appId: app.manifest.id, file });
            return await app.instance.open(file, context);
        } else {
            console.warn(`[AppManager] No application available to open file:`, file);
        }
    }
}

window.sys = window.sys || {};
window.sys.appManager = new AppManager();
