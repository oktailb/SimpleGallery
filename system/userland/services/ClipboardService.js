/**
 * SimpleGallery WebOS - Universal Clipboard Service (`sys.clipboard`)
 * Supports copying and cutting files, text, structured JSON objects and browser interoperability.
 */

(function(window) {
  'use strict';

  class ClipboardService {
    constructor() {
      this._data = null;
      this._type = null; // 'text' | 'files' | 'custom'
      this._op = 'copy'; // 'copy' | 'cut'
    }

    /**
     * Copy raw text or custom object
     * @param {string|object} data
     * @param {string} [type='text']
     */
    copy(data, type = 'text') {
      this._data = data;
      this._type = type;
      this._op = 'copy';

      if (type === 'text' && typeof data === 'string' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).catch(() => {});
      }

      this._emitChange();
      return true;
    }

    /**
     * Copy one or multiple files
     * @param {object|array|string} files
     */
    copyFiles(files) {
      const fileList = Array.isArray(files) ? files : [files];
      this._data = fileList.map(f => (typeof f === 'string' ? { path: f, name: f.split('/').pop() } : f));
      this._type = 'files';
      this._op = 'copy';

      // Also copy file paths to system clipboard as text
      const pathsText = this._data.map(f => f.path || f).join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pathsText).catch(() => {});
      }

      this._emitChange();
      return true;
    }

    /**
     * Cut one or multiple files (for move operation)
     * @param {object|array|string} files
     */
    cutFiles(files) {
      const fileList = Array.isArray(files) ? files : [files];
      this._data = fileList.map(f => (typeof f === 'string' ? { path: f, name: f.split('/').pop() } : f));
      this._type = 'files';
      this._op = 'cut';

      const pathsText = this._data.map(f => f.path || f).join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pathsText).catch(() => {});
      }

      this._emitChange();
      return true;
    }

    /**
     * Retrieve current clipboard content
     * @returns {{type: string|null, data: any, op: string}}
     */
    paste() {
      return {
        type: this._type,
        data: this._data,
        op: this._op
      };
    }

    /**
     * Clear clipboard
     */
    clear() {
      this._data = null;
      this._type = null;
      this._op = 'copy';
      this._emitChange();
    }

    /**
     * Check if clipboard contains data
     */
    hasData() {
      return this._data !== null && (!Array.isArray(this._data) || this._data.length > 0);
    }

    /**
     * Get clipboard data type
     */
    getType() {
      return this._type;
    }

    /**
     * Get clipboard operation ('copy' or 'cut')
     */
    getOp() {
      return this._op;
    }

    _emitChange() {
      if (window.EventBus) {
        window.EventBus.emit('clipboard:changed', {
          hasData: this.hasData(),
          type: this._type,
          op: this._op,
          count: Array.isArray(this._data) ? this._data.length : (this._data ? 1 : 0)
        });
      }
    }
  }

  window.sys = window.sys || {};
  window.sys.clipboard = new ClipboardService();
  window.ClipboardService = window.sys.clipboard;

})(window);
