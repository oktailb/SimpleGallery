<?php
/**
 * SimpleGallery 2026 - System Bootstrap & BIOS
 * Handles low-level initialization, environment diagnostics, storage mounting and loads Kernel.
 */

if (!defined('SIMPLE_GALLERY_BOOTED')) {
    define('SIMPLE_GALLERY_BOOTED', true);
}
if (!defined('SG_EXEC')) {
    define('SG_EXEC', true);
}

// 1. Ensure minimal PHP version (PHP 7.2+)
if (PHP_VERSION_ID < 70200) {
    http_response_code(500);
    die('SimpleGallery requires PHP 7.2 or higher. Current version: ' . PHP_VERSION);
}

// 1.1 PHP 8.0 Polyfills for PHP 7.2 - 7.4 environments
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool {
        return (string)$needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}
if (!function_exists('str_ends_with')) {
    function str_ends_with(string $haystack, string $needle): bool {
        return (string)$needle === '' || substr($haystack, -strlen($needle)) === (string)$needle;
    }
}
if (!function_exists('str_contains')) {
    function str_contains(string $haystack, string $needle): bool {
        return (string)$needle === '' || strpos($haystack, $needle) !== false;
    }
}

// 2. Send standard security headers
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-XSS-Protection: 1; mode=block');
}

// 3. Load Kernel Autoloader
require_once __DIR__ . '/autoloader.php';

// 4. Project Root Detection
$project_root = str_replace('\\', '/', dirname(dirname(__DIR__)));

// 5. Load User & System Configurations
require_once $project_root . '/config/config.php';
require_once $project_root . '/config/security.php';
require_once $project_root . '/config/mime_types.php';
require_once $project_root . '/config/themes.php';

// 6. Theme Initialization (supports user cookie override)
if (!empty($_COOKIE['sg_theme']) && isset($theme_colors[$_COOKIE['sg_theme']])) {
    $theme_preset = $_COOKIE['sg_theme'];
} else {
    $theme_preset = $theme_preset ?? 'polaroid-classic';
}
$active_theme = $theme_colors[$theme_preset] ?? $theme_colors['polaroid-classic'];

// 7. Storage Mounting & Path Resolution Subsystem
$storage_base_dir = $project_root . '/storage';
$storage_cache_dir = $storage_base_dir . '/.thumbnails';
$storage_session_dir = $storage_base_dir . '/session';

// Thumbnail storage directory name
$thumbnail_dir = '.thumbnails';

// Ensure storage subfolders exist
if (!file_exists($storage_cache_dir)) {
    @mkdir($storage_cache_dir, 0755, true);
}
if (!file_exists($storage_session_dir)) {
    @mkdir($storage_session_dir, 0755, true);
}

// Resolve configured media storage directory (handle relative vs absolute paths)
$raw_media_dir = $storage_media_dir ?? 'storage/media';
$is_absolute = (strpos($raw_media_dir, '/') === 0 || preg_match('/^[a-zA-Z]:[\/\\\\]/', $raw_media_dir));
$target_media_path = $is_absolute ? str_replace('\\', '/', $raw_media_dir) : $project_root . '/' . ltrim(str_replace('\\', '/', $raw_media_dir), '/');

// Auto-create default storage/media if it doesn't exist yet
if (!$is_absolute && !file_exists($target_media_path)) {
    @mkdir($target_media_path, 0755, true);
}

// Storage Resolution & Diagnostics
$storage_status = [
    'configured_path' => $target_media_path,
    'is_fallback'     => false,
    'reason'          => null,
    'active_path'     => null
];

$resolved_storage = realpath($target_media_path);
if ($resolved_storage !== false && is_dir($resolved_storage)) {
    $real_base_dir = str_replace('\\', '/', $resolved_storage);
    $storage_status['active_path'] = $real_base_dir;
    $storage_status['is_fallback'] = false;
} else {
    // Fallback to project root if configured storage directory is missing or unreadable
    $real_base_dir = $project_root;
    $storage_status['active_path'] = $real_base_dir;
    $storage_status['is_fallback'] = true;
    $storage_status['reason'] = "Le dossier de stockage configuré '$target_media_path' est introuvable ou inaccessible en lecture. La galerie a basculé automatiquement sur la racine du projet.";
}

// 8. Files and folders to ignore during indexing
$ignore_list = ['.', '..', '.git', '.thumbnails', '.comment', '.admin_password_hash', 'index.php', 'api.php', 'thumb.php', 'config.php', 'functions.php', 'tests', 'includes', 'css', 'js', 'locales', 'LICENSE', 'README.md', 'set_admin_password.php', '.htaccess', '.user.ini', 'start.sh', 'system', 'config', 'storage', 'themes', 'apps', 'bin', 'wm-styles'];

// 9. Start secure session
if (php_sapi_name() !== 'cli') {
    \SimpleGallery\Kernel\Security\SecurityManager::ensureSessionStarted($storage_session_dir);
}
