<?php
/**
 * SimpleGallery 2026 - Centralized Core & Security Functions
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

/**
 * Safely starts PHP session with secure cookie parameters
 */
function ensure_session_started(): void {
    if (session_status() === PHP_SESSION_NONE) {
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

/**
 * Generates or retrieves the session CSRF token
 */
function get_csrf_token(): string {
    ensure_session_started();
    if (empty($_SESSION['csrf_token'])) {
        if (function_exists('random_bytes')) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        } else {
            $_SESSION['csrf_token'] = md5(uniqid((string)mt_rand(), true));
        }
    }
    return $_SESSION['csrf_token'];
}

/**
 * Verifies submitted CSRF token using constant-time comparison
 */
function verify_csrf_token(?string $token): bool {
    ensure_session_started();
    $session_token = $_SESSION['csrf_token'] ?? '';
    if (empty($session_token) || empty($token)) {
        return false;
    }
    return hash_equals($session_token, $token);
}

/**
 * Checks whether current web session is authenticated as admin
 */
function is_admin_logged_in(): bool {
    ensure_session_started();
    return !empty($_SESSION['is_admin']);
}

/**
 * Retrieves configured admin password hash from .admin_password_hash file or legacy $admin_password_hash variable
 */
function get_admin_password_hash(string $legacy_hash = ''): string {
    $hash_file = __DIR__ . '/.admin_password_hash';
    if (file_exists($hash_file) && is_readable($hash_file)) {
        $content = trim((string)file_get_contents($hash_file));
        if (!empty($content)) {
            return $content;
        }
    }
    return $legacy_hash;
}

/**
 * Updates admin password hash in .admin_password_hash file atomically
 */
function update_admin_password_hash(string $new_password): bool {
    $hash = password_hash($new_password, PASSWORD_DEFAULT);
    $hash_file = __DIR__ . '/.admin_password_hash';
    return (file_put_contents($hash_file, $hash . "\n", LOCK_EX) !== false);
}

/**
 * Rate Limiting Helpers
 */
function get_client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

function get_rate_limit_file(string $key): string {
    $ip = get_client_ip();
    $hash = md5($ip . '_' . $key);
    return sys_get_temp_dir() . '/sg_limit_' . $hash . '.json';
}

function check_rate_limit(string $key, int $max_attempts = 5, int $decay_seconds = 900): bool {
    $file = get_rate_limit_file($key);
    if (!file_exists($file)) {
        return true;
    }
    $content = @file_get_contents($file);
    if (!$content) return true;
    $data = @json_decode($content, true);
    if (!is_array($data)) return true;
    
    $now = time();
    if ($now - ($data['first_attempt'] ?? 0) > $decay_seconds) {
        @unlink($file);
        return true;
    }
    return ($data['attempts'] ?? 0) < $max_attempts;
}

function increment_rate_limit(string $key): void {
    $file = get_rate_limit_file($key);
    $now = time();
    $data = ['attempts' => 1, 'first_attempt' => $now];
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        if ($content) {
            $existing = @json_decode($content, true);
            if (is_array($existing)) {
                $data['attempts'] = ($existing['attempts'] ?? 0) + 1;
                $data['first_attempt'] = $existing['first_attempt'] ?? $now;
            }
        }
    }
    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function reset_rate_limit(string $key): void {
    $file = get_rate_limit_file($key);
    if (file_exists($file)) {
        @unlink($file);
    }
}

/**
 * Airtight Canonical Path Resolver & Validator
 * Prevents all path traversal attacks (../, ..\, null bytes, URL encoded traversal, symlinks outside base).
 */
function canonicalize_and_validate_path(string $user_path, string $base_dir, bool $must_exist = true, bool $allow_root = true): ?string {
    // 1. Reject control characters and null bytes immediately
    if (preg_match('/[\x00-\x1f\x7f]/', $user_path)) {
        return null;
    }

    // Normalize base directory path
    $real_base = realpath($base_dir);
    if ($real_base === false) {
        $real_base = $base_dir;
    }
    $real_base = str_replace('\\', '/', $real_base);
    $real_base = rtrim($real_base, '/');

    // Clean user path slashes
    $clean_path = str_replace('\\', '/', trim($user_path));
    
    // Build combined path
    if (empty($clean_path) || $clean_path === '.') {
        return $allow_root ? $real_base : null;
    }

    $target = $real_base . '/' . ltrim($clean_path, '/');

    if ($must_exist) {
        $resolved = realpath($target);
        if ($resolved === false) {
            return null;
        }
        $resolved_clean = str_replace('\\', '/', $resolved);
        if ($resolved_clean === $real_base) {
            return $allow_root ? $real_base : null;
        }
        if (strpos($resolved_clean, $real_base . '/') === 0) {
            return $resolved_clean;
        }
        return null;
    } else {
        // For non-existent targets (e.g. creating file/folder or destination path)
        $parent = dirname($target);
        $resolved_parent = realpath($parent);
        if ($resolved_parent === false) {
            return null;
        }
        $resolved_parent_clean = str_replace('\\', '/', $resolved_parent);
        if ($resolved_parent_clean !== $real_base && strpos($resolved_parent_clean, $real_base . '/') !== 0) {
            return null;
        }
        $filename = basename($target);
        if ($filename === '.' || $filename === '..' || empty($filename)) {
            return null;
        }
        return $resolved_parent_clean . '/' . $filename;
    }
}

/**
 * Convenience wrapper for validating directory path
 */
function sanitize_path(?string $requested_dir, string $base_dir): ?string {
    if ($requested_dir === null) return null;
    $result = canonicalize_and_validate_path($requested_dir, $base_dir, true, true);
    if ($result !== null && !is_dir($result)) {
        return null;
    }
    return $result;
}

/**
 * Convenience wrapper for validating file path
 */
function sanitize_file_path(?string $requested_file, string $base_dir): ?string {
    if (empty($requested_file)) return null;
    $result = canonicalize_and_validate_path($requested_file, $base_dir, true, false);
    if ($result !== null && !is_file($result)) {
        return null;
    }
    return $result;
}

/**
 * Computes relative path from base directory
 */
function get_relative_path(string $full_path, string $base_dir): string {
    $full_path = str_replace('\\', '/', $full_path);
    $base_dir  = str_replace('\\', '/', $base_dir);
    $real_base = realpath($base_dir);
    if ($real_base !== false) {
        $base_dir = str_replace('\\', '/', $real_base);
    }
    $base_dir = rtrim($base_dir, '/');

    if ($full_path === $base_dir) {
        return '';
    }
    if (strpos($full_path, $base_dir . '/') === 0) {
        return substr($full_path, strlen($base_dir) + 1);
    }
    return ltrim($full_path, '/');
}

/**
 * Access Information & Security Permissions
 */
function get_dir_access_info(string $dir_path, string $base_dir): array {
    $rel = get_relative_path($dir_path, $base_dir);

    $has_password = file_exists($dir_path . '/.password');
    $has_public   = file_exists($dir_path . '/.public');
    $has_private  = file_exists($dir_path . '/.private');

    $is_private = false;
    $is_protected = false;

    if ($has_password) {
        $is_protected = true;
    } elseif ($has_public) {
        $is_private = false;
        $is_protected = false;
    } elseif ($has_private) {
        $is_private = true;
    } elseif (basename($dir_path) === 'private') {
        $is_private = true;
    }

    $is_unlocked = is_admin_logged_in();
    if (!$is_unlocked && $rel !== '') {
        if (!empty($_SESSION['unlocked_dirs'][$rel])) {
            $is_unlocked = true;
        } else {
            $parts = explode('/', $rel);
            $accum = '';
            foreach ($parts as $p) {
                $accum = ($accum === '') ? $p : $accum . '/' . $p;
                if (!empty($_SESSION['unlocked_dirs'][$accum])) {
                    $is_unlocked = true;
                    break;
                }
            }
        }
    }

    $access_mode = 'public';
    if ($is_private) {
        $access_mode = 'private';
    } elseif ($is_protected) {
        $access_mode = 'password';
    }

    return [
        'access_mode'  => $access_mode,
        'is_private'   => $is_private,
        'is_protected' => $is_protected,
        'is_unlocked'  => $is_unlocked
    ];
}

function is_dir_accessible(string $dir_path, string $base_dir): bool {
    if (is_admin_logged_in()) {
        return true;
    }

    $rel = get_relative_path($dir_path, $base_dir);
    if ($rel === '') {
        return true;
    }

    $parts = explode('/', $rel);
    $accumulated = '';
    foreach ($parts as $part) {
        $accumulated = ($accumulated === '') ? $part : $accumulated . '/' . $part;
        $current_check_dir = $base_dir . '/' . $accumulated;

        $access_info = get_dir_access_info($current_check_dir, $base_dir);

        if ($access_info['is_private']) {
            return false;
        }

        if ($access_info['is_protected'] && !$access_info['is_unlocked']) {
            return false;
        }
    }

    return true;
}

/**
 * Sanitizes SVG file content to prevent Embedded JS & XSS attacks
 */
function sanitize_svg_content(string $filepath): bool {
    if (!file_exists($filepath) || !is_file($filepath)) {
        return false;
    }

    $content = file_get_contents($filepath);
    if ($content === false || empty($content)) {
        return false;
    }

    // Disable external entity loading (XXE prevention)
    $previous_entity_loader = function_exists('libxml_disable_entity_loader') ? @libxml_disable_entity_loader(true) : null;
    $dom = new DOMDocument();
    
    // Suppress XML parsing warnings
    libxml_use_internal_errors(true);
    $loaded = $dom->loadXML($content, LIBXML_NONET | LIBXML_NOBLANKS);
    libxml_clear_errors();
    if ($previous_entity_loader !== null && function_exists('libxml_disable_entity_loader')) {
        @libxml_disable_entity_loader($previous_entity_loader);
    }

    if (!$loaded) {
        return false; // Malformed SVG
    }

    // Remove dangerous tags (<script>, <object>, <embed>, <iframe>, <foreignObject>, <link>, <use>)
    $forbidden_tags = ['script', 'object', 'embed', 'iframe', 'foreignobject', 'meta', 'link', 'use'];
    foreach ($forbidden_tags as $tag) {
        $elements = $dom->getElementsByTagName($tag);
        while ($elements->length > 0) {
            $elem = $elements->item(0);
            if ($elem && $elem->parentNode) {
                $elem->parentNode->removeChild($elem);
            }
        }
    }

    // Remove inline event handler attributes (onload, onclick, onerror, etc.) & dangerous href values
    $xpath = new DOMXPath($dom);
    $nodes = $xpath->query('//@*');

    if ($nodes) {
        foreach ($nodes as $node) {
            $name = strtolower($node->nodeName);
            $value = trim($node->nodeValue);

            // Remove any attribute starting with 'on' (event handlers)
            if (strpos($name, 'on') === 0) {
                if ($node->parentNode) {
                    $node->parentNode->removeAttribute($node->nodeName);
                }
                continue;
            }

            // Check URIs in href, xlink:href, action, src, etc.
            if (in_array($name, ['href', 'xlink:href', 'src', 'action'], true)) {
                $lower_val = strtolower($value);
                if (strpos($lower_val, 'javascript:') !== false || strpos($lower_val, 'data:') !== false || strpos($lower_val, 'vbscript:') !== false) {
                    if ($node->parentNode) {
                        $node->parentNode->removeAttribute($node->nodeName);
                    }
                }
            }
        }
    }

    $clean_xml = $dom->saveXML();
    if ($clean_xml === false) {
        return false;
    }

    return (file_put_contents($filepath, $clean_xml, LOCK_EX) !== false);
}
