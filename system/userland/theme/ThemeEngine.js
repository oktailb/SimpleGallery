/**
 * SimpleGallery Userland - Theme & Wallpaper Engine
 */
class ThemeEngine {
  constructor() {
    this.wallpapers = [
      {
        id: 'nebula',
        nameKey: 'settings.wallpaper_nebula',
        style: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #0f172a 100%)'
      },
      {
        id: 'ocean',
        nameKey: 'settings.wallpaper_ocean',
        style: 'linear-gradient(135deg, #030712 0%, #0c4a6e 50%, #0f172a 100%)'
      },
      {
        id: 'sunset',
        nameKey: 'settings.wallpaper_sunset',
        style: 'linear-gradient(135deg, #18052e 0%, #4c1d95 50%, #0f172a 100%)'
      },
      {
        id: 'aurora',
        nameKey: 'settings.wallpaper_aurora',
        style: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #020617 100%)'
      },
      {
        id: 'cyberpunk',
        nameKey: 'settings.wallpaper_cyberpunk',
        style: 'linear-gradient(135deg, #0d0221 0%, #310842 50%, #020005 100%)'
      },
      {
        id: 'slate',
        nameKey: 'settings.wallpaper_slate',
        style: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      }
    ];

    this.themes = [
      {
        id: 'dark-glass',
        name: 'Dark Glassmorphism',
        bg_main: '#090d16',
        window_bg: 'rgba(12, 17, 29, 0.96)',
        header_bg: 'rgba(24, 32, 50, 0.9)',
        menu_bar_bg: 'rgba(9, 13, 22, 0.85)',
        sidebar_bg: 'rgba(0, 0, 0, 0.3)',
        polaroid_bg: '#182032',
        polaroid_text: '#f1f5f9',
        polaroid_sub: '#94a3b8',
        accent: '#8b5cf6',
        card_bg: 'rgba(255, 255, 255, 0.04)',
        border_color: 'rgba(255, 255, 255, 0.08)',
        border_color_hover: 'rgba(139, 92, 246, 0.4)',
        text_main: '#f8fafc',
        text_muted: '#94a3b8',
        mockupBg: '#090d16',
        mockupCard: '#182032',
        mockupAccent: '#8b5cf6'
      },
      {
        id: 'polaroid-classic',
        name: 'Polaroid Classic',
        bg_main: '#0f141c',
        window_bg: 'rgba(15, 20, 28, 0.96)',
        header_bg: 'rgba(30, 41, 59, 0.9)',
        menu_bar_bg: 'rgba(15, 23, 42, 0.85)',
        sidebar_bg: 'rgba(0, 0, 0, 0.25)',
        polaroid_bg: '#fcfaf5',
        polaroid_text: '#1e293b',
        polaroid_sub: '#64748b',
        accent: '#6366f1',
        card_bg: 'rgba(255, 255, 255, 0.05)',
        border_color: 'rgba(255, 255, 255, 0.08)',
        border_color_hover: 'rgba(99, 102, 241, 0.4)',
        text_main: '#f8fafc',
        text_muted: '#94a3b8',
        mockupBg: '#0f141c',
        mockupCard: '#fcfaf5',
        mockupAccent: '#6366f1'
      },
      {
        id: 'light-minimal',
        name: 'Light Minimal',
        bg_main: '#f1f5f9',
        window_bg: 'rgba(255, 255, 255, 0.98)',
        header_bg: '#f8fafc',
        menu_bar_bg: 'rgba(255, 255, 255, 0.94)',
        sidebar_bg: 'rgba(241, 245, 249, 0.95)',
        polaroid_bg: '#ffffff',
        polaroid_text: '#0f172a',
        polaroid_sub: '#64748b',
        accent: '#2563eb',
        card_bg: '#ffffff',
        border_color: 'rgba(0, 0, 0, 0.12)',
        border_color_hover: 'rgba(37, 99, 235, 0.4)',
        text_main: '#0f172a',
        text_muted: '#475569',
        mockupBg: '#f1f5f9',
        mockupCard: '#ffffff',
        mockupAccent: '#2563eb'
      },
      {
        id: 'cyberpunk',
        name: 'Cyberpunk Neon',
        bg_main: '#0d0221',
        window_bg: 'rgba(13, 2, 33, 0.96)',
        header_bg: 'rgba(35, 8, 55, 0.9)',
        menu_bar_bg: 'rgba(13, 2, 33, 0.88)',
        sidebar_bg: 'rgba(0, 0, 0, 0.4)',
        polaroid_bg: '#190536',
        polaroid_text: '#f43f5e',
        polaroid_sub: '#a855f7',
        accent: '#ec4899',
        card_bg: 'rgba(236, 72, 153, 0.05)',
        border_color: 'rgba(236, 72, 153, 0.2)',
        border_color_hover: 'rgba(244, 63, 94, 0.6)',
        text_main: '#fdf4ff',
        text_muted: '#c084fc',
        mockupBg: '#0d0221',
        mockupCard: '#190536',
        mockupAccent: '#ec4899'
      }
    ];
  }

  getThemes() {
    return this.themes;
  }

  getTheme(id) {
    return this.themes.find(t => t.id === id) || this.themes[0];
  }

  getWallpapers() {
    return this.wallpapers;
  }

  registerTheme(theme) {
    if (!theme || !theme.id) return;
    const existingIdx = this.themes.findIndex(t => t.id === theme.id);
    if (existingIdx >= 0) {
      this.themes[existingIdx] = theme;
    } else {
      this.themes.push(theme);
    }
  }

  registerWallpaper(wallpaper) {
    if (!wallpaper || !wallpaper.id) return;
    const existingIdx = this.wallpapers.findIndex(w => w.id === wallpaper.id);
    if (existingIdx >= 0) {
      this.wallpapers[existingIdx] = wallpaper;
    } else {
      this.wallpapers.push(wallpaper);
    }
  }
}

window.sys = window.sys || {};
window.sys.theme = new ThemeEngine();
window.ThemeEngine = window.sys.theme;
