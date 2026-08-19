<?php
namespace SimpleGallery\Kernel\Security;

/**
 * Kernel CSRF Protection Manager
 */
class CsrfManager {

    public static function getToken(): string {
        SecurityManager::ensureSessionStarted();
        if (empty($_SESSION['csrf_token'])) {
            if (function_exists('random_bytes')) {
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            } else {
                $_SESSION['csrf_token'] = md5(uniqid((string)mt_rand(), true));
            }
        }
        return $_SESSION['csrf_token'];
    }

    public static function verifyToken(?string $token): bool {
        SecurityManager::ensureSessionStarted();
        $session_token = $_SESSION['csrf_token'] ?? '';
        if (empty($session_token) || empty($token)) {
            return false;
        }
        return hash_equals($session_token, $token);
    }
}
