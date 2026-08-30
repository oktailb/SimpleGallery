<?php
namespace SimpleGallery\Kernel\Security;

use SimpleGallery\Kernel\Auth\AuthManager;

/**
 * Kernel Security Manager
 * Manages admin authentication, secure session handling, and access permissions.
 */
class SecurityManager {

    public static function ensureSessionStarted(?string $session_save_path = null): void {
        AuthManager::ensureSessionStarted();
    }

    public static function isAdminLoggedIn(): bool {
        return AuthManager::isAdminLoggedIn();
    }

    public static function setAdminLoggedIn(bool $state): void {
        AuthManager::ensureSessionStarted();
        if ($state) {
            $_SESSION['sg_admin_logged'] = true;
            $_SESSION['is_admin'] = true;
        } else {
            unset($_SESSION['sg_admin_logged']);
            unset($_SESSION['is_admin']);
        }
    }

    public static function getAdminPasswordHash(string $base_dir = '', string $legacy_hash = ''): string {
        return AuthManager::getPasswordHash($legacy_hash, $base_dir);
    }

    public static function updateAdminPasswordHash(string $new_password, string $base_dir = ''): bool {
        return AuthManager::updatePasswordHash($new_password, $base_dir);
    }

    public static function getCsrfToken(): string {
        return CsrfManager::getToken();
    }

    public static function verifyCsrfToken(?string $token): bool {
        return CsrfManager::verifyToken($token);
    }


    public static function sanitizeUtf8($mixed) {
        if (is_array($mixed)) {
            $cleaned = [];
            foreach ($mixed as $k => $v) {
                $clean_key = is_string($k) ? mb_convert_encoding($k, 'UTF-8', 'UTF-8') : $k;
                $cleaned[$clean_key] = self::sanitizeUtf8($v);
            }
            return $cleaned;
        }
        if (is_string($mixed)) {
            return mb_convert_encoding($mixed, 'UTF-8', 'UTF-8');
        }
        return $mixed;
    }

    public static function sanitizeSvgContent(string $filepath): bool {
        if (!file_exists($filepath) || !is_readable($filepath)) {
            return false;
        }

        $content = @file_get_contents($filepath);
        if ($content === false || trim($content) === '') {
            return false;
        }

        // 1. Remove XML declarations and DocType with potential entity declarations / XXE
        $content = preg_replace('/<!DOCTYPE[^>]*(\[[\s\S]*?\])?\s*>/is', '', $content);
        $content = preg_replace('/<!ENTITY[^>]*>/is', '', $content);

        // 2. Remove script tags and their contents
        $content = preg_replace('/<script\b[^>]*>([\s\S]*?)<\/script>/is', '', $content);
        $content = preg_replace('/<script\b[^>]*\/>/is', '', $content);

        // 3. Remove iframe tags
        $content = preg_replace('/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/is', '', $content);
        $content = preg_replace('/<iframe\b[^>]*\/>/is', '', $content);

        // 4. Remove foreignObject tags
        $content = preg_replace('/<foreignobject\b[^>]*>([\s\S]*?)<\/foreignobject>/is', '', $content);
        $content = preg_replace('/<foreignobject\b[^>]*\/>/is', '', $content);

        // 5. Remove on* event handlers
        $content = preg_replace('/\bon[a-zA-Z0-9_-]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $content);

        // 6. Remove javascript: URIs in href and xlink:href
        $content = preg_replace('/(href|xlink:href)\s*=\s*["\']\s*javascript:[^"\']*["\']/is', '$1="#"', $content);

        $result = @file_put_contents($filepath, $content, LOCK_EX);
        return ($result !== false);
    }
}
