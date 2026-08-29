/**
 * SimpleGallery WebOS - Centralized WebOS Services Engine (`window.sys.services` / `window.sys.*`)
 * High-level system abstractions for Filesystem, UI Dialogs, Toasts, WebAudio Sound Synthesis, and Storage.
 */

(function (window, document) {
  'use strict';

  window.sys = window.sys || {};

  // =========================================================================
  // 1. Storage Service (`sys.storage`)
  // =========================================================================
  const StorageService = {
    get(appId, key, defaultValue = null) {
      try {
        const fullKey = `webos_app_${appId}_${key}`;
        const raw = localStorage.getItem(fullKey);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
      } catch (e) {
        console.warn(`[WebOS Storage] Failed to get '${key}' for '${appId}':`, e);
        return defaultValue;
      }
    },
    set(appId, key, value) {
      try {
        const fullKey = `webos_app_${appId}_${key}`;
        localStorage.setItem(fullKey, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn(`[WebOS Storage] Failed to set '${key}' for '${appId}':`, e);
        return false;
      }
    },
    remove(appId, key) {
      try {
        const fullKey = `webos_app_${appId}_${key}`;
        localStorage.removeItem(fullKey);
      } catch (e) {}
    },
    forApp(appId) {
      return {
        get: (key, defaultValue = null) => StorageService.get(appId, key, defaultValue),
        set: (key, value) => StorageService.set(appId, key, value),
        remove: (key) => StorageService.remove(appId, key)
      };
    }
  };

  // =========================================================================
  // 2. WebAudio Synthesizer Service (`sys.audio`)
  // =========================================================================
  class WebAudioSynth {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    _getAudioContext() {
      if (!this.ctx && typeof AudioContext !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1) {
      if (!this.enabled) return;
      try {
        const ctx = this._getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    }

    // Standard Preset Effects for Games & UI
    playClick() { this.playTone(800, 'sine', 0.04, 0.05); }
    playSuccess() {
      this.playTone(523.25, 'triangle', 0.08, 0.08); // C5
      setTimeout(() => this.playTone(659.25, 'triangle', 0.12, 0.08), 80); // E5
    }
    playWarning() { this.playTone(300, 'sawtooth', 0.15, 0.08); }
    playError() {
      this.playTone(180, 'sawtooth', 0.15, 0.1);
      setTimeout(() => this.playTone(130, 'sawtooth', 0.2, 0.1), 100);
    }

    // Arcade Game Sound Presets
    playBounce() { this.playTone(350, 'sine', 0.05, 0.08); }
    playScore() { this.playTone(880, 'triangle', 0.15, 0.1); }
    playMove() { this.playTone(440, 'sine', 0.04, 0.05); }
    playRotate() {
      if (!this.enabled) return;
      try {
        const ctx = this._getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } catch (e) {}
    }
    playFlow() {
      if (!this.enabled) return;
      try {
        const ctx = this._getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.linearRampToValueAtTime(720, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      } catch (e) {}
    }
    playVictory() {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.15, 0.1), idx * 100);
      });
    }
    playWin() {
      this.playVictory();
    }
  }

  const AudioService = new WebAudioSynth();

  // =========================================================================
  // 3. High-Level Filesystem Service (`sys.fs`)
  // =========================================================================
  const FilesystemService = {
    get api() {
      return (window.sys && window.sys.api) || window.SyscallClient;
    },
    getMetadata(filePath) {
      if (this.api && typeof this.api.get === 'function') {
        return this.api.get('get_metadata', { file: filePath });
      }
      return Promise.reject(new Error('SyscallClient not available'));
    },
    saveTextFile(filePath, content) {
      if (this.api && typeof this.api.post === 'function') {
        return this.api.post('save_text_file', { file: filePath, content: content });
      }
      return Promise.reject(new Error('SyscallClient not available'));
    },
    uploadFile(fileObj, targetDir) {
      const formData = new FormData();
      formData.append('action', 'upload_file');
      formData.append('target_dir', targetDir || '');
      formData.append('file', fileObj);

      const csrf = window.CSRF_TOKEN || (window.desktop && window.desktop.state && window.desktop.state.csrfToken) || '';
      formData.append('csrf_token', csrf);

      return fetch('api.php', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: formData
      }).then(r => r.json());
    }
  };

  // Attach Services to `window.sys`
  window.sys.storage = StorageService;
  window.sys.audio = AudioService;
  window.sys.fs = FilesystemService;

  // Shortcuts & Proxy bindings
  window.sys.toast = {
    info: (msg, opts) => (window.sys.ui && window.sys.ui.toast ? window.sys.ui.toast.info(msg, opts) : (window.WebOSToolkit ? window.WebOSToolkit.toastInfo(msg, opts) : console.log('[Toast]', msg))),
    success: (msg, opts) => (window.sys.ui && window.sys.ui.toast ? window.sys.ui.toast.success(msg, opts) : (window.WebOSToolkit ? window.WebOSToolkit.toastSuccess(msg, opts) : console.log('[Toast]', msg))),
    warning: (msg, opts) => (window.sys.ui && window.sys.ui.toast ? window.sys.ui.toast.warning(msg, opts) : (window.WebOSToolkit ? window.WebOSToolkit.toastWarning(msg, opts) : console.warn('[Toast]', msg))),
    error: (msg, opts) => (window.sys.ui && window.sys.ui.toast ? window.sys.ui.toast.error(msg, opts) : (window.WebOSToolkit ? window.WebOSToolkit.toastError(msg, opts) : console.error('[Toast]', msg)))
  };

  window.sys.dialog = {
    alert: (msg, title, opts) => (window.sys.ui ? window.sys.ui.alertDialog({ message: msg, title: title, ...opts }) : Promise.resolve()),
    confirm: (msg, title, isDanger, opts) => (window.sys.ui ? window.sys.ui.confirmDialog({ message: msg, title: title, danger: isDanger, ...opts }) : Promise.resolve(false)),
    prompt: (msg, defaultVal, title, opts) => (window.sys.ui ? window.sys.ui.promptDialog({ message: msg, defaultValue: defaultVal, title: title, ...opts }) : Promise.resolve(null))
  };

})(window, document);
