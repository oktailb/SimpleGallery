/**
 * SimpleGallery Userland - i18n Internationalization Engine
 */
class I18nEngine {
    constructor() {
        this.currentLocale = 'fr';
        this.translations = {};
        this.availableLocales = {};
    }

    async init(defaultLocale = 'fr') {
        this.currentLocale = localStorage.getItem('sg_locale') || defaultLocale;
        await this.loadTranslations(this.currentLocale);
    }

    async loadTranslations(code) {
        try {
            const res = await fetch(`api.php?action=get_locale&code=${encodeURIComponent(code)}`);
            const data = await res.json();
            if (data.success && data.translations) {
                this.translations = data.translations;
                this.currentLocale = code;
                localStorage.setItem('sg_locale', code);
                window.sys.events.emit('locale:changed', { code, translations: this.translations });
            }
        } catch (err) {
            console.error(`[I18nEngine] Failed to load locale ${code}:`, err);
        }
    }

    t(key, replacements = {}) {
        let text = this.translations[key] || key;
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
        return text;
    }

    translate(key, replacements = {}) {
        return this.t(key, replacements);
    }

    setTranslations(code, translations) {
        this.currentLocale = code;
        this.translations = translations || {};
    }

    getAvailableLocales() {
        if (window.desktop && window.desktop.state && window.desktop.state.availableLocales && Object.keys(window.desktop.state.availableLocales).length > 0) {
            return window.desktop.state.availableLocales;
        }
        if (this.availableLocales && Object.keys(this.availableLocales).length > 0) {
            return this.availableLocales;
        }
        return {
            fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
            en: { code: 'en', name: 'English', flag: '🇬🇧' },
            ja: { code: 'ja', name: '日本語', flag: '🇯🇵' }
        };
    }

    setAvailableLocales(locales) {
        if (locales && typeof locales === 'object') {
            this.availableLocales = locales;
        }
    }
}

window.sys = window.sys || {};
window.sys.i18n = new I18nEngine();
window.I18nEngine = window.sys.i18n;

