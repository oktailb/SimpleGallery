<?php
/**
 * SimpleGallery 2026 - Centralized Core & Security Functions
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

require_once __DIR__ . '/includes/exif.php';
require_once __DIR__ . '/includes/binaries.php';

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
 * Recursively cleans and sanitizes any string or array to ensure valid UTF-8 for json_encode
 */
function sanitize_utf8($mixed) {
    if (is_array($mixed)) {
        $clean = [];
        foreach ($mixed as $k => $v) {
            $clean_k = sanitize_utf8($k);
            $clean[$clean_k] = sanitize_utf8($v);
        }
        return $clean;
    } elseif (is_string($mixed)) {
        if (!mb_check_encoding($mixed, 'UTF-8')) {
            $mixed = mb_convert_encoding($mixed, 'UTF-8', 'UTF-8, ISO-8859-1, Windows-1252, ASCII');
        }
        if (function_exists('mb_scrub')) {
            return mb_scrub($mixed, 'UTF-8');
        }
        return $mixed;
    }
    return $mixed;
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
    return (@file_put_contents($hash_file, $hash . "\n", LOCK_EX) !== false);
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
 * Checks if any segment of a relative or full path is ignored by $ignore_list or hidden dotfile
 */
function is_path_ignored(string $path, string $base_dir, array $ignore_list): bool {
    $rel = get_relative_path($path, $base_dir);
    if ($rel === '') return false;

    $parts = explode('/', str_replace('\\', '/', $rel));
    foreach ($parts as $part) {
        if ($part === '' || $part === '.' || $part === '..') continue;
        if (in_array($part, $ignore_list, true) || $part[0] === '.') {
            return true;
        }
    }
    return false;
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

    // Remove dangerous tags (<script>, <object>, <embed>, <iframe>, <foreignObject>, <link>, <use>) case-insensitively
    $xpath = new DOMXPath($dom);
    $forbidden_tags = ['script', 'object', 'embed', 'iframe', 'foreignobject', 'meta', 'link', 'use'];
    
    $all_elements = $xpath->query('//*');
    if ($all_elements) {
        $to_remove = [];
        foreach ($all_elements as $elem) {
            $tag_name = strtolower($elem->localName ?: $elem->nodeName);
            if (in_array($tag_name, $forbidden_tags, true)) {
                $to_remove[] = $elem;
            }
        }
        foreach ($to_remove as $elem) {
            if ($elem->parentNode) {
                $elem->parentNode->removeChild($elem);
            }
        }
    }

    // Remove inline event handler attributes (onload, onclick, onerror, etc.) & dangerous href values
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

/**
 * Fast pure PHP parser to extract embedded JPEG thumbnails from MP4/MOV container metadata
 */
function extract_mp4_embedded_jpeg(string $mp4_file, string $output_jpg_file): bool {
    if (!file_exists($mp4_file) || !is_readable($mp4_file)) {
        return false;
    }

    $file_size = filesize($mp4_file);
    if ($file_size < 100) {
        return false;
    }

    $handle = @fopen($mp4_file, 'rb');
    if (!$handle) return false;

    // Read first 2MB and last 1MB of file where moov/meta/covr atoms reside
    $read_size = min(2 * 1024 * 1024, $file_size);
    $head_buffer = fread($handle, $read_size);

    $tail_buffer = '';
    if ($file_size > $read_size) {
        $tail_seek = max(0, $file_size - (1024 * 1024));
        fseek($handle, $tail_seek);
        $tail_buffer = fread($handle, 1024 * 1024);
    }
    fclose($handle);

    $buffers = [$head_buffer, $tail_buffer];

    foreach ($buffers as $buffer) {
        if (empty($buffer)) continue;

        // Look for JPEG Magic Bytes: \xFF\xD8\xFF
        $offset = 0;
        while (($soi = strpos($buffer, "\xFF\xD8\xFF", $offset)) !== false) {
            $eoi = strpos($buffer, "\xFF\xD9", $soi + 3);
            if ($eoi !== false && ($eoi - $soi) > 2000 && ($eoi - $soi) < 2000000) {
                $jpeg_data = substr($buffer, $soi, ($eoi - $soi) + 2);
                if (function_exists('getimagesizefromstring')) {
                    $img_info = @getimagesizefromstring($jpeg_data);
                    if ($img_info !== false && $img_info[0] > 50 && $img_info[1] > 50) {
                        if (@file_put_contents($output_jpg_file, $jpeg_data, LOCK_EX) !== false) {
                            return true;
                        }
                    }
                } else {
                    if (@file_put_contents($output_jpg_file, $jpeg_data, LOCK_EX) !== false) {
                        return true;
                    }
                }
            }
            $offset = $soi + 3;
        }
    }

    return false;
}

/**
 * -------------------------------------------------------------
 * GUEST PERMISSION MATRIX & RIGHTS MANAGEMENT
 * -------------------------------------------------------------
 */
function get_permissions_file_path(string $base_dir): string {
    return $base_dir . '/.permissions.json';
}

function get_default_permissions(): array {
    global $allow_direct_download;
    $allow_item = isset($allow_direct_download) ? (bool)$allow_direct_download : true;
    return [
        'can_upload'           => false,
        'can_delete'           => false,
        'can_move'             => false,
        'can_comment'          => true,
        'can_create_folder'    => false,
        'can_download_archive' => true,
        'can_download_item'    => $allow_item
    ];
}

function load_permissions_config(string $base_dir): array {
    $file = get_permissions_file_path($base_dir);
    $defaults = get_default_permissions();
    if (!file_exists($file)) {
        return $defaults;
    }
    $content = @file_get_contents($file);
    if (empty($content)) return $defaults;
    $data = @json_decode($content, true);
    if (!is_array($data)) return $defaults;

    return array_merge($defaults, $data);
}

function save_permissions_config(string $base_dir, array $permissions): bool {
    $file = get_permissions_file_path($base_dir);
    $defaults = get_default_permissions();
    $clean = [];
    foreach ($defaults as $key => $val) {
        $clean[$key] = isset($permissions[$key]) ? (bool)$permissions[$key] : $val;
    }
    return (@file_put_contents($file, json_encode($clean, JSON_PRETTY_PRINT), LOCK_EX) !== false);
}

function has_permission(string $permission_key, string $base_dir): bool {
    if (is_admin_logged_in()) {
        return true;
    }
    $perms = load_permissions_config($base_dir);
    return !empty($perms[$permission_key]);
}

/**
 * -------------------------------------------------------------
 * MULTI-FORMAT ARCHIVE DISCOVERY & GENERATION (ZIP, 7Z, TAR)
 * -------------------------------------------------------------
 */


function create_archive(string $format, string $target_dir, string $output_file, string $base_dir, array $ignore_list): bool {
    if (!is_dir($target_dir)) return false;

    $real_target = realpath($target_dir);
    if (!$real_target) return false;

    if ($format === 'zip' && (extension_loaded('zip') || class_exists('ZipArchive'))) {
        $zip = new ZipArchive();
        if ($zip->open($output_file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($real_target, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if ($file->isDir()) continue;
            $filePath = str_replace('\\', '/', $file->getRealPath());
            if (is_path_ignored($filePath, $base_dir, $ignore_list)) continue;

            $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
            if (in_array($ext, ['php', 'htaccess', 'ini', 'hash'], true)) continue;

            $localPath = get_relative_path($filePath, $real_target);
            $zip->addFile($filePath, $localPath);
        }

        return $zip->close();
    }

    if ($format === 'zip') {
        $zip_cli = find_binary_executable('zip');
        if ($zip_cli) {
            $cmd = sprintf(
                'cd %s && %s -r %s . -x "*.php" "*.htaccess" "*.ini" ".*" 2>&1',
                escapeshellarg($real_target),
                escapeshellarg($zip_cli),
                escapeshellarg($output_file)
            );
            @exec($cmd);
            return (file_exists($output_file) && filesize($output_file) > 0);
        }
    }

    if ($format === '7z') {
        $sz_cli = find_binary_executable('7z') ?: find_binary_executable('7za');
        if ($sz_cli) {
            $cmd = sprintf(
                'cd %s && %s a -t7z %s . -xr!*.php -xr!.* 2>&1',
                escapeshellarg($real_target),
                escapeshellarg($sz_cli),
                escapeshellarg($output_file)
            );
            @exec($cmd);
            return (file_exists($output_file) && filesize($output_file) > 0);
        }
    }

    if ($format === 'tar') {
        $tar_cli = find_binary_executable('tar');
        if ($tar_cli) {
            $cmd = sprintf(
                'cd %s && %s -czf %s --exclude="*.php" --exclude=".*" . 2>&1',
                escapeshellarg($real_target),
                escapeshellarg($tar_cli),
                escapeshellarg($output_file)
            );
            @exec($cmd);
            return (file_exists($output_file) && filesize($output_file) > 0);
        }
    }

    return false;
}

/**
 * Reads and parses directory .comment legend files
 */
function load_dir_comments(string $dir_path): array {
    $comments = [];
    $comment_file = $dir_path . '/.comment';
    if (file_exists($comment_file) && is_readable($comment_file)) {
        $lines = file($comment_file, FILE_IGNORE_NEW_LINES);
        if ($lines !== false) {
            for ($i = 0; $i < count($lines); $i++) {
                $line = trim($lines[$i]);
                if ($line === '') continue;

                if (strpos($line, '=') !== false) {
                    list($fname, $cmt) = explode('=', $line, 2);
                    $comments[trim($fname)] = trim($cmt);
                } elseif (strpos($line, ':') !== false && !file_exists($dir_path . '/' . $line)) {
                    list($fname, $cmt) = explode(':', $line, 2);
                    $comments[trim($fname)] = trim($cmt);
                } else {
                    $fname = $line;
                    $cmt = isset($lines[$i + 1]) ? trim($lines[$i + 1]) : '';
                    $comments[$fname] = $cmt;
                    $i++;
                }
            }
        }
    }
    return $comments;
}

function save_dir_comments(string $dir_path, array $comments): bool {
    $comment_file = $dir_path . '/.comment';
    $clean_comments = [];
    foreach ($comments as $fname => $cmt) {
        $cmt_clean = trim(str_replace(["\r", "\n"], [' ', ' '], $cmt));
        if ($cmt_clean !== '') {
            $clean_comments[] = $fname . '=' . $cmt_clean;
        }
    }

    if (empty($clean_comments)) {
        if (file_exists($comment_file)) {
            return @unlink($comment_file);
        }
        return true;
    }

    return (@file_put_contents($comment_file, implode("\n", $clean_comments) . "\n", LOCK_EX) !== false);
}

/**
 * Reads folder .dotfile configuration overrides (.title, .desc, .bg, .theme) & access info
 */
function load_folder_overrides(string $dir_path, string $base_dir): array {
    $access_info = get_dir_access_info($dir_path, $base_dir);

    $overrides = [
        'title'        => null,
        'description'  => null,
        'background'   => null,
        'theme'        => null,
        'access_mode'  => $access_info['access_mode'],
        'is_private'   => $access_info['is_private'],
        'is_protected' => $access_info['is_protected'],
        'is_unlocked'  => $access_info['is_unlocked']
    ];

    $title_file = $dir_path . '/.title';
    if (file_exists($title_file) && is_readable($title_file)) {
        $overrides['title'] = trim(file_get_contents($title_file));
    }

    $desc_file = file_exists($dir_path . '/.desc') ? $dir_path . '/.desc' : (file_exists($dir_path . '/.description') ? $dir_path . '/.description' : null);
    if ($desc_file && is_readable($desc_file)) {
        $overrides['description'] = trim(file_get_contents($desc_file));
    }

    $bg_file = $dir_path . '/.bg';
    if (file_exists($bg_file) && is_readable($bg_file)) {
        $bg_val = trim(file_get_contents($bg_file));
        if ($bg_val !== '') {
            $overrides['raw_background'] = $bg_val;
            $possible_image = $dir_path . '/' . $bg_val;
            if (file_exists($possible_image) && is_file($possible_image)) {
                $rel_bg = get_relative_path($possible_image, $base_dir);
                $overrides['background'] = encode_url_path($rel_bg);
            } else {
                $overrides['background'] = $bg_val;
            }
        }
    }

    $theme_file = $dir_path . '/.theme';
    if (file_exists($theme_file) && is_readable($theme_file)) {
        $theme_val = trim(file_get_contents($theme_file));
        if ($theme_val !== '') {
            global $theme_colors;
            if (strpos($theme_val, '=') !== false) {
                $custom_theme = [];
                $lines = explode("\n", $theme_val);
                foreach ($lines as $line) {
                    if (strpos($line, '=') !== false) {
                        list($k, $v) = explode('=', trim($line), 2);
                        $custom_theme[trim($k)] = trim($v);
                    }
                }
                $overrides['theme'] = $custom_theme;
                $overrides['theme_name'] = 'custom';
            } else {
                $overrides['theme_name'] = $theme_val;
                if (!empty($theme_colors[$theme_val])) {
                    $overrides['theme'] = $theme_colors[$theme_val];
                } else {
                    $overrides['theme'] = $theme_val;
                }
            }
        }
    }

    return $overrides;
}

/**
 * Directory Cache Engine Helpers
 */
function get_cache_storage_dir(string $base_dir, string $thumb_dir): string {
    $cache_dir = $base_dir . '/' . $thumb_dir;
    if (!is_dir($cache_dir)) {
        @mkdir($cache_dir, 0755, true);
    }
    if (!is_dir($cache_dir) || !is_writable($cache_dir)) {
        $cache_dir = sys_get_temp_dir() . '/simplegallery_thumbs';
        if (!is_dir($cache_dir)) {
            @mkdir($cache_dir, 0755, true);
        }
    }
    return $cache_dir;
}

function get_dir_cache_file_path(string $dir_path, string $base_dir, string $thumb_dir): string {
    $storage = get_cache_storage_dir($base_dir, $thumb_dir);
    $rel = get_relative_path($dir_path, $base_dir);
    $key = md5('dir_index_v6_utf8_sanitized_' . $rel);
    return $storage . '/cache_' . $key . '.json';
}

function is_dir_cache_valid(string $cache_file, string $dir_path): bool {
    if (!file_exists($cache_file) || filesize($cache_file) === 0) {
        return false;
    }
    $cache_mtime = filemtime($cache_file);
    $dir_mtime = filemtime($dir_path);

    if ($cache_mtime < $dir_mtime) {
        return false;
    }

    $dotfiles = ['.title', '.desc', '.description', '.comment', '.theme', '.bg', '.private', '.password', '.public'];
    foreach ($dotfiles as $df) {
        $df_path = $dir_path . '/' . $df;
        if (file_exists($df_path) && filemtime($df_path) > $cache_mtime) {
            return false;
        }
    }

    return true;
}

function invalidate_dir_cache(string $dir_path, string $base_dir, string $thumb_dir): void {
    $cache_file = get_dir_cache_file_path($dir_path, $base_dir, $thumb_dir);
    if (file_exists($cache_file)) {
        @unlink($cache_file);
    }

    // Invalidate parent directory cache so subfolder item_count & cover update immediately
    $real_base = str_replace('\\', '/', realpath($base_dir) ?: $base_dir);
    $real_dir  = str_replace('\\', '/', realpath($dir_path) ?: $dir_path);

    if ($real_dir !== $real_base) {
        $parent_dir = dirname($real_dir);
        if (strpos($parent_dir, $real_base) === 0) {
            $parent_cache_file = get_dir_cache_file_path($parent_dir, $base_dir, $thumb_dir);
            if (file_exists($parent_cache_file)) {
                @unlink($parent_cache_file);
            }
        }
    }
}



/**
 * -------------------------------------------------------------
 * RECURSIVE MULTIDIMENSIONAL SEARCH ENGINE
 * -------------------------------------------------------------
 */
function search_gallery_recursive(string $start_dir, string $base_dir, array $params, array $ignore_list, array $media_types): array {
    $results = [];
    $query = strtolower(trim($params['q'] ?? ''));
    $name_filter = strtolower(trim($params['name'] ?? ''));
    $words_filter = strtolower(trim($params['words'] ?? ''));
    $cat_filter = strtolower(trim($params['category'] ?? 'all'));
    $timing_filter = strtolower(trim($params['timing'] ?? 'all'));
    $date_from_str = trim($params['date_from'] ?? '');
    $date_to_str = trim($params['date_to'] ?? '');
    $size_range = strtolower(trim($params['size_range'] ?? 'all'));
    $gps_only = !empty($params['gps_only']);
    $recursive = !empty($params['recursive']);

    $now = time();
    $min_time = 0;
    $max_time = 0;

    if ($timing_filter === 'today') {
        $min_time = strtotime('today 00:00:00');
    } elseif ($timing_filter === 'week') {
        $min_time = $now - (7 * 86400);
    } elseif ($timing_filter === 'month') {
        $min_time = $now - (30 * 86400);
    } elseif ($timing_filter === 'year') {
        $min_time = $now - (365 * 86400);
    } elseif ($timing_filter === 'custom') {
        if ($date_from_str !== '') {
            $ts_from = strtotime($date_from_str . ' 00:00:00');
            if ($ts_from !== false) $min_time = $ts_from;
        }
        if ($date_to_str !== '') {
            $ts_to = strtotime($date_to_str . ' 23:59:59');
            if ($ts_to !== false) $max_time = $ts_to;
        }
    }

    $min_bytes = 0;
    $max_bytes = 0;
    if ($size_range === 'small') {
        $max_bytes = 1024 * 1024; // < 1MB
    } elseif ($size_range === 'medium') {
        $min_bytes = 1024 * 1024;
        $max_bytes = 10 * 1024 * 1024; // 1-10MB
    } elseif ($size_range === 'large') {
        $min_bytes = 10 * 1024 * 1024;
        $max_bytes = 50 * 1024 * 1024; // 10-50MB
    } elseif ($size_range === 'xlarge') {
        $min_bytes = 50 * 1024 * 1024; // > 50MB
    }

    $forbidden_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc', 'js', 'css', 'html', 'htm', 'htaccess', 'htpasswd', 'sh', 'bat', 'cmd', 'exe', 'dll', 'py', 'pl', 'cgi', 'hash', 'ini', 'sql', 'bak', 'json'];

    $scan_directory = function(string $dir) use (&$scan_directory, &$results, $query, $name_filter, $words_filter, $cat_filter, $min_time, $max_time, $min_bytes, $max_bytes, $gps_only, $recursive, $base_dir, $ignore_list, $media_types, $forbidden_exts) {
        if (!is_dir($dir) || is_path_ignored($dir, $base_dir, $ignore_list)) {
            return;
        }

        $items = @scandir($dir);
        if ($items === false) return;

        $comments = load_dir_comments($dir);

        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || $item[0] === '.' || in_array($item, $ignore_list, true)) {
                continue;
            }

            $full_path = $dir . '/' . $item;
            $rel_path = get_relative_path($full_path, $base_dir);

            if (is_dir($full_path)) {
                if ($recursive) {
                    $scan_directory($full_path);
                }
            } elseif (is_file($full_path)) {
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                if ($ext === '' || in_array($ext, $forbidden_exts, true)) continue;

                $category = 'other';
                foreach ($media_types as $c => $exts) {
                    if (in_array($ext, $exts, true)) {
                        $category = $c;
                        break;
                    }
                }

                if ($cat_filter !== 'all' && $category !== $cat_filter) {
                    continue;
                }

                $size = filesize($full_path);
                if ($min_bytes > 0 && $size < $min_bytes) continue;
                if ($max_bytes > 0 && $size > $max_bytes) continue;

                $comment = $comments[$item] ?? '';

                // Matching logic
                if ($name_filter !== '' && strpos(strtolower($item), $name_filter) === false) {
                    continue;
                }

                if ($words_filter !== '') {
                    $match_words = ($comment !== '' && strpos(strtolower($comment), $words_filter) !== false);
                    if (!$match_words) continue;
                }

                if ($query !== '') {
                    $match_name = (strpos(strtolower($item), $query) !== false);
                    $match_comment = ($comment !== '' && strpos(strtolower($comment), $query) !== false);
                    if (!$match_name && !$match_comment) {
                        continue;
                    }
                }

                $exif = ($category === 'image') ? extract_exif_data($full_path) : null;
                if ($gps_only) {
                    if (empty($exif['gps'])) {
                        continue;
                    }
                }

                $mtime = filemtime($full_path);
                $effective_mtime = ($exif && !empty($exif['date_ts'])) ? $exif['date_ts'] : $mtime;

                if ($min_time > 0 && $effective_mtime < $min_time) continue;
                if ($max_time > 0 && $effective_mtime > $max_time) continue;

                $results[] = [
                    'name'           => $item,
                    'path'           => $rel_path,
                    'extension'      => $ext,
                    'category'       => $category,
                    'size'           => $size,
                    'size_formatted' => format_bytes($size),
                    'mtime'          => $mtime,
                    'effective_mtime'=> $effective_mtime,
                    'exif'           => $exif,
                    'thumb_url'      => 'thumb.php?file=' . rawurlencode($rel_path),
                    'file_url'       => encode_url_path($rel_path),
                    'comment'        => $comment
                ];
            }
        }
    };

    $scan_directory($start_dir);
    return $results;
}

/**
 * -------------------------------------------------------------
 * INTERNATIONALIZATION & LOCALES DISCOVERY ENGINE (i18n)
 * -------------------------------------------------------------
 */

/**
 * Scan locales/ directory and return all discovered locales with metadata.
 * Format: [ 'fr' => ['code' => 'fr', 'name' => 'Français', 'flag' => '🇫🇷'], ... ]
 */
function get_available_locales(string $base_dir): array {
    $locales_dir = rtrim($base_dir, '/\\') . '/locales';
    $locales = [];

    if (!is_dir($locales_dir)) {
        return $locales;
    }

    $files = @scandir($locales_dir);
    if ($files === false) return $locales;

    foreach ($files as $file) {
        if ($file[0] === '.' || substr(strtolower($file), -5) !== '.json') continue;
        $full_path = $locales_dir . '/' . $file;
        $code = strtolower(pathinfo($file, PATHINFO_FILENAME));
        
        $content = @file_get_contents($full_path);
        if (!$content) continue;
        $data = @json_decode($content, true);
        if (!is_array($data)) continue;

        $meta = $data['_meta'] ?? [];
        $locales[$code] = [
            'code'     => $meta['code'] ?? $code,
            'name'     => $meta['name'] ?? ucfirst($code),
            'flag'     => $meta['flag'] ?? '🌐',
            'flag_svg' => !empty($meta['flag_svg']) ? $meta['flag_svg'] : null
        ];
    }

    return $locales;
}

/**
 * Returns flag HTML generically from locale metadata (SVG vector if provided, otherwise emoji/fallback).
 * Accepts either a locale info array OR a locale code.
 */
function get_locale_flag_html($locale_or_code, string $fallback = '🌐', array $available_locales = []): string {
    if (is_array($locale_or_code)) {
        if (!empty($locale_or_code['flag_svg'])) {
            return $locale_or_code['flag_svg'];
        }
        $flag = $locale_or_code['flag'] ?? $fallback;
        return '<span class="flag-emoji">' . htmlspecialchars($flag, ENT_QUOTES, 'UTF-8') . '</span>';
    }

    $code = strtolower(trim((string)$locale_or_code));
    if (!empty($available_locales[$code])) {
        return get_locale_flag_html($available_locales[$code], $fallback);
    }

    return '<span class="flag-emoji">' . htmlspecialchars($fallback, ENT_QUOTES, 'UTF-8') . '</span>';
}

/**
 * Detect best matching locale based on browser HTTP_ACCEPT_LANGUAGE.
 */
function detect_browser_locale(array $available_locales, string $default = 'fr'): string {
    if (empty($available_locales)) return $default;

    $accept = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
    if (!empty($accept)) {
        $parts = explode(',', $accept);
        foreach ($parts as $part) {
            $lang_tag = explode(';', $part)[0];
            $lang_tag = trim($lang_tag);
            $primary_lang = strtolower(explode('-', $lang_tag)[0]);
            
            if (isset($available_locales[$primary_lang])) {
                return $primary_lang;
            }
        }
    }

    if (isset($available_locales[$default])) {
        return $default;
    }
    $keys = array_keys($available_locales);
    return !empty($keys) ? $keys[0] : $default;
}

/**
 * Load translations array for a specific locale code.
 */
function load_locale_translations(string $base_dir, string $code): array {
    $clean_code = preg_replace('/[^a-z0-9_-]/i', '', strtolower($code));
    $file = rtrim($base_dir, '/\\') . '/locales/' . $clean_code . '.json';
    if (!is_file($file)) return [];
    
    $content = @file_get_contents($file);
    if (!$content) return [];
    $data = @json_decode($content, true);
    if (!is_array($data)) return [];

    return $data['translations'] ?? [];
}

/**
 * Global helper function to translate keys in PHP backend.
 */
function __t(string $key, array $replacements = [], ?string $locale = null, string $base_dir = ''): string {
    static $translations_cache = [];
    
    if (empty($base_dir)) {
        global $real_base_dir;
        $base_dir = $real_base_dir ?? dirname(__DIR__);
    }

    if ($locale === null) {
        $locales = get_available_locales($base_dir);
        $req_lang = $_SERVER['HTTP_X_LANG'] ?? $_GET['lang'] ?? $_POST['lang'] ?? null;
        if ($req_lang && isset($locales[strtolower($req_lang)])) {
            $locale = strtolower($req_lang);
        } else {
            $locale = detect_browser_locale($locales, 'fr');
        }
    }

    if (!isset($translations_cache[$locale])) {
        $translations_cache[$locale] = load_locale_translations($base_dir, $locale);
    }

    $msg = $translations_cache[$locale][$key] ?? null;
    if ($msg === null) {
        if ($locale !== 'fr') {
            if (!isset($translations_cache['fr'])) {
                $translations_cache['fr'] = load_locale_translations($base_dir, 'fr');
            }
            $msg = $translations_cache['fr'][$key] ?? $key;
        } else {
            $msg = $key;
        }
    }

    foreach ($replacements as $k => $v) {
        $msg = str_replace('{' . $k . '}', (string)$v, $msg);
    }

    return $msg;
}


