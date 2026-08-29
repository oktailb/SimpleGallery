/**
 * SimpleGallery Userland - Syscall Client
 * Unified, zero-boilerplate API client for WebOS communicating with Kernel (api.php).
 */
class SyscallClient {
  constructor(endpoint = 'api.php') {
    this.endpoint = endpoint;
  }

  getCsrfToken() {
    return (typeof window !== 'undefined' && (
      window.SG_CSRF_TOKEN ||
      window.CSRF_TOKEN ||
      document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    )) || '';
  }

  /**
   * Build complete API URL for action and parameters
   */
  url(action, params = {}) {
    const url = new URL(this.endpoint, window.location.href);
    if (action) url.searchParams.set('action', action);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.set(k, params[k]);
      }
    });
    return url.toString();
  }

  /**
   * Perform HTTP GET request to API
   */
  async get(action, params = {}) {
    const fetchUrl = this.url(action, params);
    try {
      const res = await fetch(fetchUrl, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      return await res.json();
    } catch (err) {
      console.error(`[SyscallClient] GET ${action} failed:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Perform HTTP POST request to API with JSON payload & CSRF token
   */
  async post(action, payload = {}) {
    const csrfToken = this.getCsrfToken();
    const bodyData = {
      action,
      csrf_token: csrfToken,
      ...payload
    };

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(bodyData)
      });
      return await res.json();
    } catch (err) {
      console.error(`[SyscallClient] POST ${action} failed:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Perform Multipart / FormData File Upload with optional progress listener
   */
  upload(action, formData, onProgress = null) {
    return new Promise((resolve) => {
      const csrfToken = this.getCsrfToken();
      if (!(formData instanceof FormData)) {
        const fd = new FormData();
        Object.keys(formData).forEach(k => fd.append(k, formData[k]));
        formData = fd;
      }

      if (!formData.has('action') && action) {
        formData.append('action', action);
      }
      if (!formData.has('csrf_token') && csrfToken) {
        formData.append('csrf_token', csrfToken);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.endpoint, true);
      xhr.withCredentials = true;
      if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);

      if (typeof onProgress === 'function') {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent, e.loaded, e.total);
          }
        };
      }

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch (err) {
          resolve({ success: false, error: 'Réponse serveur invalide' });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, error: 'Erreur réseau lors du téléversement' });
      };

      xhr.send(formData);
    });
  }

  /**
   * Generic call method for backwards compatibility
   */
  async call(action, params = {}, method = 'POST') {
    if (method.toUpperCase() === 'GET') {
      return this.get(action, params);
    }
    return this.post(action, params);
  }

  // High-level FS Syscalls
  get fs() {
    return {
      list: (path = '') => this.get('', { dir: path }),
      search: (params = {}) => this.get('search', params),
      createFolder: (dir, name) => this.post('create_folder', { dir, folder_name: name, name }),
      deleteItem: (target_path) => this.post('delete_item', { target_path }),
      moveItem: (source_paths, target_dir) => this.post('move_item', { source_paths, target_dir }),
      saveTextFile: (file, content) => this.post('save_text_file', { file, content }),
      getMetadata: (file) => this.get('get_metadata', { file }),
      unlockFolder: (dir, password) => this.post('unlock_folder', { dir, password }),
      saveFolderSettings: (params) => this.post('save_folder_settings', params),
      saveComment: (dir, filename, comment) => this.post('save_comment', { dir, filename, comment })
    };
  }

  // High-level Auth Syscalls
  get auth() {
    return {
      login: (password) => this.post('login', { password }),
      logout: () => this.post('logout', {}),
      changePassword: (oldPassword, newPassword) => this.post('change_password', { old_password: oldPassword, new_password: newPassword })
    };
  }
}

window.sys = window.sys || {};
window.sys.api = new SyscallClient();
