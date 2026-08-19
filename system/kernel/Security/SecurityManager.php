<?php
namespace SimpleGallery\Kernel\Security;

/**
 * Kernel Security Manager
 * Manages admin authentication, secure session handling, and access permissions.
 */
class SecurityManager {

    public static function ensureSessionStarted(?string $session_save_path = null): void {
        if (session_status() === PHP_SESSION_NONE) {
            if ($session_save_path && is_dir($session_save_path) && is_writable($session_save_path)) {
                @session_save_path($session_save_path);
            }
            if (!headers_sent()) {
                if (PHP_VERSION_ID >= 70300) {
                    session_set_cookie_params([
                        'lifetime' => 0,
                        'path'     => '/',
                        'httponly' => true,
                        'samesite' => 'Lax'
                    ]);
                } else {
                    session_set_cookie_params(0, '/; samesite=Lax', '', false, true);
                }
            }
            @session_start();
        }
    }

    public static function isAdminLoggedIn(): bool {
        self::ensureSessionStarted();
        return !empty($_SESSION['is_admin']);
    }

    public static function setAdminLoggedIn(bool $state): void {
        self::ensureSessionStarted();
        if ($state) {
            $_SESSION['is_admin'] = true;
        } else {
            unset($_SESSION['is_admin']);
        }
    }

    public static function getAdminPasswordHash(string $base_dir = '', string $legacy_hash = ''): string {
        $hash_file = ($base_dir ? rtrim($base_dir, '/\\') : dirname(dirname(dirname(__DIR__)))) . '/.admin_password_hash';
        if (file_exists($hash_file) && is_readable($hash_file)) {
            $content = trim((string)file_get_contents($hash_file));
            if (!empty($content)) {
                return $content;
            }
        }
        return $legacy_hash;
    }

    public static function updateAdminPasswordHash(string $new_password, string $base_dir = ''): bool {
        $hash = password_hash($new_password, PASSWORD_DEFAULT);
        $hash_file = ($base_dir ? rtrim($base_dir, '/\\') : dirname(dirname(dirname(__DIR__)))) . '/.admin_password_hash';
        return (@file_put_contents($hash_file, $hash . "\n", LOCK_EX) !== false);
    }
}
