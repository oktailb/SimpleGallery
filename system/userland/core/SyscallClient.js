/**
 * SimpleGallery Userland - Syscall Client
 * Native JavaScript API wrapper communicating with the Kernel via api.php.
 */
class SyscallClient {
    constructor(endpoint = 'api.php') {
        this.endpoint = endpoint;
        this.csrfToken = window.SG_CSRF_TOKEN || '';
    }

    setCsrfToken(token) {
        this.csrfToken = token;
    }

    async call(action, params = {}, method = 'POST') {
        const headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': this.csrfToken
        };

        let url = this.endpoint;
        let options = { method, headers };

        if (method === 'GET') {
            const query = new URLSearchParams({ action, ...params }).toString();
            url += (url.includes('?') ? '&' : '?') + query;
        } else {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify({ action, csrf_token: this.csrfToken, ...params });
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`[Syscall] Error calling ${action}:`, error);
            return { success: false, error: error.message };
        }
    }

    // High-level FS Syscalls
    get fs() {
        return {
            list: (path = '') => this.call('list_dir', { path }, 'GET'),
            search: (params = {}) => this.call('search', params, 'GET'),
            createFolder: (parentPath, name) => this.call('create_folder', { path: parentPath, name }),
            deleteItem: (path) => this.call('delete_item', { path }),
            moveItem: (source, destination) => this.call('move_item', { source, destination }),
            updateDotfile: (path, type, content) => this.call('update_dotfile', { path, type, content })
        };
    }

    // High-level Auth Syscalls
    get auth() {
        return {
            login: (password) => this.call('login', { password }),
            logout: () => this.call('logout', {}),
            changePassword: (oldPassword, newPassword) => this.call('change_password', { old_password: oldPassword, new_password: newPassword })
        };
    }
}

window.sys = window.sys || {};
window.sys.api = new SyscallClient();
