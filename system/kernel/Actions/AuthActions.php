<?php
namespace SimpleGallery\Kernel\Actions;

use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\FS\PermissionsManager;
use SimpleGallery\Kernel\Security\RateLimiter;

class AuthActions {

    public static function handle(string $action, array $params, array|string $context): ?array {
        $base_dir = is_array($context) ? ($context['base_dir'] ?? '') : $context;
        $raw_body = is_array($context) ? ($context['raw_body'] ?? $params) : $params;

        if ($action === 'login') {
            $password = $_POST['password'] ?? $raw_body['password'] ?? '';
            $ip_key = 'login_' . RateLimiter::getClientIp();

            if (!RateLimiter::check($ip_key, 5, 900)) {
                return ['status' => 429, 'data' => ['success' => false, 'error' => __t('api.err_rate_limit')]];
            }

            $admin_hash = AuthManager::getPasswordHash('', $base_dir);

            if (!empty($admin_hash) && password_verify($password, $admin_hash)) {
                RateLimiter::reset($ip_key);
                AuthManager::ensureSessionStarted();
                $_SESSION['sg_admin_logged'] = true;
                $_SESSION['is_admin'] = true;

                return ['status' => 200, 'data' => [
                    'success'    => true,
                    'message'    => __t('api.msg_auth_success'),
                    'csrf_token' => get_csrf_token()
                ]];
            }

            RateLimiter::increment($ip_key);
            return ['status' => 401, 'data' => ['success' => false, 'error' => __t('api.err_invalid_password')]];
        }

        if ($action === 'logout') {
            AuthManager::ensureSessionStarted();
            unset($_SESSION['sg_admin_logged']);
            unset($_SESSION['is_admin']);
            return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_logged_out')]];
        }

        if ($action === 'change_password') {
            if (!AuthManager::isAdminLoggedIn()) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_admin_required')]];
            }

            $current_pass = $_POST['current_password'] ?? $raw_body['current_password'] ?? '';
            $new_pass     = $_POST['new_password'] ?? $raw_body['new_password'] ?? '';

            if (empty($new_pass) || strlen($new_pass) < 6) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_pwd_short')]];
            }

            $admin_hash = AuthManager::getPasswordHash('', $base_dir);
            if (!empty($admin_hash) && !password_verify($current_pass, $admin_hash)) {
                return ['status' => 401, 'data' => ['success' => false, 'error' => __t('api.err_current_pwd_invalid')]];
            }

            if (AuthManager::updatePasswordHash($new_pass, $base_dir)) {
                return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_pwd_updated')]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('api.err_pwd_save')]];
        }

        if ($action === 'get_permissions') {
            $perms = PermissionsManager::loadPermissions($base_dir);
            return ['status' => 200, 'data' => [
                'success'     => true,
                'permissions' => $perms,
                'is_admin'    => AuthManager::isAdminLoggedIn()
            ]];
        }

        if ($action === 'save_permissions') {
            if (!AuthManager::isAdminLoggedIn()) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_admin_required')]];
            }

            $new_perms = $raw_body['permissions'] ?? $_POST['permissions'] ?? [];
            if (is_string($new_perms)) {
                $new_perms = json_decode($new_perms, true);
            }
            if (!is_array($new_perms)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_data')]];
            }

            if (PermissionsManager::savePermissions($base_dir, $new_perms)) {
                return ['status' => 200, 'data' => [
                    'success'     => true,
                    'message'     => __t('api.msg_permissions_saved'),
                    'permissions' => PermissionsManager::loadPermissions($base_dir)
                ]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('api.err_permissions_save')]];
        }

        if ($action === 'get_autostart_settings') {
            $config = get_autostart_config($base_dir);
            return ['status' => 200, 'data' => ['success' => true, 'autostart' => $config]];
        }

        if ($action === 'save_autostart_settings') {
            if (!AuthManager::isAdminLoggedIn()) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_admin_required')]];
            }

            $raw_autostart = $raw_body['autostart'] ?? $raw_body['config'] ?? $_POST['autostart'] ?? $_POST['config'] ?? null;
            if (is_string($raw_autostart)) {
                $raw_autostart = json_decode($raw_autostart, true);
            }

            if (!is_array($raw_autostart)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_data')]];
            }

            $saved = \SimpleGallery\Kernel\Config\ConfigStore::set('autostart', $raw_autostart, $base_dir);
            if ($saved) {
                return ['status' => 200, 'data' => ['success' => true, 'autostart' => $raw_autostart, 'message' => __t('settings.autostart_saved')]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('settings.autostart_save_error')]];

        }



        return null;
    }
}
