<?php
/**
 * SimpleGallery 2026 - Authentication & Access Manager
 */

namespace SimpleGallery\Kernel\Auth;

use SimpleGallery\Kernel\Security\PathValidator;

class AuthManager {
    /**
     * Ensure session is started with secure cookie parameters
     */
    public static function ensureSessionStarted(): void {
        if (session_status() === PHP_SESSION_NONE) {
            $is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
                || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
                || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');

            if (!headers_sent()) {
                session_set_cookie_params([
                    'lifetime' => 0,
                    'path'     => '/',
                    'domain'   => '',
                    'secure'   => $is_https,
                    'httponly' => true,
                    'samesite' => 'Lax'
                ]);
            }
            @session_start();
        }
    }

    /**
     * Check if currently logged in as administrator
     */
    public static function isAdminLoggedIn(): bool {
        self::ensureSessionStarted();
        return (!empty($_SESSION['sg_admin_logged']) && $_SESSION['sg_admin_logged'] === true)
            || (!empty($_SESSION['is_admin']) && $_SESSION['is_admin'] === true);
    }

    /**
     * Get administrator password hash from .admin_password_hash or config fallback
     */
    public static function getPasswordHash(string $legacy_hash = '', string $base_dir = ''): string {
        global $project_root, $admin_password_hash;
        $root = $project_root ?? dirname(__DIR__, 3);
        $candidates = array_unique(array_filter([
            $root . '/.admin_password_hash',
            $base_dir ? $base_dir . '/.admin_password_hash' : null,
            $root . '/storage/.admin_password_hash',
            $root . '/storage/media/.admin_password_hash',
            $root . '/config/.admin_password_hash'
        ]));

        foreach ($candidates as $hash_file) {
            if (file_exists($hash_file)) {
                $content = trim((string)@file_get_contents($hash_file));
                if (!empty($content)) {
                    return $content;
                }
            }
        }

        if (!empty($admin_password_hash)) {
            return $admin_password_hash;
        }

        return $legacy_hash;
    }

    /**
     * Update admin password hash in .admin_password_hash
     */
    public static function updatePasswordHash(string $new_password, string $base_dir = ''): bool {
        global $project_root, $admin_password_hash;
        $root = $project_root ?? dirname(__DIR__, 3);
        $hash_file = $root . '/.admin_password_hash';

        $new_hash = password_hash($new_password, PASSWORD_DEFAULT);
        $written = @file_put_contents($hash_file, $new_hash . PHP_EOL, LOCK_EX);

        if ($written !== false) {
            @chmod($hash_file, 0600);
            $admin_password_hash = $new_hash;
            return true;
        }

        return false;
    }


    /**
     * Update admin password in config file or hash storage
     */
    public static function updatePasswordInConfig(string $new_password, string $base_dir = ''): bool {
        return self::updatePasswordHash($new_password, $base_dir);
    }

    /**
     * Determine folder access level and state (.private, .password, or public)
     */
    public static function getDirAccessInfo(string $dir_path, string $base_dir): array {
        $info = [
            'mode'           => 'public',
            'access_mode'    => 'public',
            'is_private'     => false,
            'is_protected'   => false,
            'is_accessible'  => true,
            'is_unlocked'    => true,
            'requires_auth'  => false,
            'rel_path'       => PathValidator::getRelativePath($dir_path, $base_dir)
        ];

        $private_file = $dir_path . '/.private';
        if (file_exists($private_file)) {
            $info['mode'] = 'private';
            $info['access_mode'] = 'private';
            $info['is_private'] = true;
            $info['requires_auth'] = true;
            if (self::isAdminLoggedIn()) {
                $info['is_accessible'] = true;
                $info['is_unlocked'] = true;
            } else {
                $info['is_accessible'] = false;
                $info['is_unlocked'] = false;
            }
            return $info;
        }

        $password_file = $dir_path . '/.password';
        if (file_exists($password_file)) {
            $info['mode'] = 'password';
            $info['access_mode'] = 'password';
            $info['is_protected'] = true;
            $info['requires_auth'] = true;

            if (self::isAdminLoggedIn()) {
                $info['is_accessible'] = true;
                $info['is_unlocked'] = true;
                return $info;
            }

            self::ensureSessionStarted();
            $rel = $info['rel_path'];
            $unlocked = (!empty($_SESSION['sg_unlocked_folders'][$rel]))
                || (!empty($_SESSION['unlocked_dirs'][$rel]));

            $info['is_unlocked'] = $unlocked;
            $info['is_accessible'] = $unlocked;
            return $info;
        }

        return $info;
    }

    /**
     * Check if a directory is accessible by the current visitor/session
     */
    public static function isDirAccessible(string $dir_path, string $base_dir): bool {
        $info = self::getDirAccessInfo($dir_path, $base_dir);
        return $info['is_accessible'];
    }
}
