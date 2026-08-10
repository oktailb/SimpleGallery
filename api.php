<?php
/**
 * SimpleGallery 2026 - JSON API Endpoint with Dotfile Folder Overrides
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// -------------------------------------------------------------
// Admin Authentication & Action Handlers
// -------------------------------------------------------------
$raw_body = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? $_POST['action'] ?? $raw_body['action'] ?? null;

if ($action === 'login') {
    $password = $raw_body['password'] ?? $_POST['password'] ?? '';

    if (empty($admin_password_hash)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Admin password is not configured in config.php. Run `php set_admin_password.php <password>` via CLI first.'
        ]);
        exit;
    }

    if (password_verify($password, $admin_password_hash)) {
        $_SESSION['is_admin'] = true;
        echo json_encode([
            'success'  => true,
            'is_admin' => true,
            'message'  => 'Admin authentication successful'
        ]);
        exit;
    } else {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error'   => 'Incorrect admin password'
        ]);
        exit;
    }
}

if ($action === 'logout') {
    unset($_SESSION['is_admin']);
    echo json_encode([
        'success'  => true,
        'is_admin' => false,
        'message'  => 'Logged out of admin mode'
    ]);
    exit;
}

if ($action === 'change_password') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Admin privileges required'
        ]);
        exit;
    }

    $new_password = $raw_body['new_password'] ?? $_POST['new_password'] ?? '';
    if (strlen($new_password) < 4) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Password must be at least 4 characters long'
        ]);
        exit;
    }

    if (update_admin_password_in_config($new_password)) {
        echo json_encode([
            'success' => true,
            'message' => 'Admin password updated successfully in config.php'
        ]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => 'Failed to update config.php'
        ]);
        exit;
    }
}

function sanitize_path(?string $requested_dir, string $base_dir): ?string {
    if (empty($requested_dir) || $requested_dir === '.') {
        return $base_dir;
    }
    
    $requested_dir = str_replace(['\\', '..'], ['/', ''], $requested_dir);
    $target_path = realpath($base_dir . '/' . ltrim($requested_dir, '/'));

    if ($target_path === false || strpos($target_path, $base_dir) !== 0) {
        return null;
    }

    return $target_path;
}

function get_relative_path(string $full_path, string $base_dir): string {
    if ($full_path === $base_dir) {
        return '';
    }
    $rel = substr($full_path, strlen($base_dir));
    return ltrim(str_replace('\\', '/', $rel), '/');
}

/**
 * Safely encodes URL path segments preserving directory slashes '/'
 */
function encode_url_path(string $path): string {
    $parts = explode('/', $path);
    return implode('/', array_map('rawurlencode', $parts));
}

function format_bytes(int $bytes, int $precision = 2): string {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

function get_media_category(string $ext, array $media_types): string {
    $ext = strtolower($ext);
    foreach ($media_types as $cat => $extensions) {
        if (in_array($ext, $extensions, true)) {
            return $cat;
        }
    }
    return 'other';
}

if ($action === 'unlock_folder') {
    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $password = $raw_body['password'] ?? $_POST['password'] ?? '';

    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Dossier introuvable ou accès refusé'
        ]);
        exit;
    }

    $rel_path = get_relative_path($target_dir, $real_base_dir);
    $pass_file = $target_dir . '/.password';

    if (!file_exists($pass_file)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Ce dossier n\'est pas protégé par mot de passe'
        ]);
        exit;
    }

    $hash = trim((string)@file_get_contents($pass_file));
    if (password_verify($password, $hash)) {
        if (!isset($_SESSION['unlocked_dirs'])) {
            $_SESSION['unlocked_dirs'] = [];
        }
        $_SESSION['unlocked_dirs'][$rel_path] = true;
        echo json_encode([
            'success' => true,
            'message' => 'Dossier déverrouillé avec succès',
            'path'    => $rel_path
        ]);
        exit;
    } else {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error'   => 'Mot de passe du dossier incorrect'
        ]);
        exit;
    }
}

if ($action === 'lock_folder') {
    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Dossier introuvable'
        ]);
        exit;
    }

    $rel_path = get_relative_path($target_dir, $real_base_dir);
    if (isset($_SESSION['unlocked_dirs'])) {
        unset($_SESSION['unlocked_dirs'][$rel_path]);
        $prefix = ($rel_path === '') ? '' : $rel_path . '/';
        foreach (array_keys($_SESSION['unlocked_dirs']) as $k) {
            if ($prefix !== '' && strpos($k, $prefix) === 0) {
                unset($_SESSION['unlocked_dirs'][$k]);
            }
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Dossier verrouillé à nouveau',
        'path'    => $rel_path
    ]);
    exit;
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

if ($action === 'update_dotfile') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Admin privileges required'
        ]);
        exit;
    }

    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $type = $raw_body['type'] ?? $_POST['type'] ?? '';
    $value = trim((string)($raw_body['value'] ?? $_POST['value'] ?? ''));
    $filename = trim((string)($raw_body['filename'] ?? $_POST['filename'] ?? ''));

    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Directory not found or access denied'
        ]);
        exit;
    }

    $allowed_types = ['title', 'description', 'comment', 'bg', 'theme', 'access_mode'];
    if (!in_array($type, $allowed_types, true)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Invalid dotfile type specified'
        ]);
        exit;
    }

    // Check directory write permissions
    if (!is_writable($target_dir)) {
        $folder_name = (get_relative_path($target_dir, $real_base_dir) === '') ? 'root gallery' : basename($target_dir);
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => "Permission denied: Web server process (e.g. www-data/http) lacks write permissions on directory '{$folder_name}'. Please grant write access (e.g., `chmod 775 {$folder_name}` or `chown -R www-data:www-data {$folder_name}`)."
        ]);
        exit;
    }

    $success = true;
    switch ($type) {
        case 'access_mode':
            $private_file  = $target_dir . '/.private';
            $password_file = $target_dir . '/.password';
            $public_file   = $target_dir . '/.public';

            if ($value === 'public') {
                if (file_exists($private_file)) @unlink($private_file);
                if (file_exists($password_file)) @unlink($password_file);
                if (basename($target_dir) === 'private') {
                    $success = (@file_put_contents($public_file, "1\n") !== false);
                } else {
                    if (file_exists($public_file)) @unlink($public_file);
                }
            } elseif ($value === 'private') {
                if (file_exists($password_file)) @unlink($password_file);
                if (file_exists($public_file)) @unlink($public_file);
                $success = (@file_put_contents($private_file, "1\n") !== false);
            } elseif ($value === 'password') {
                if (file_exists($private_file)) @unlink($private_file);
                if (file_exists($public_file)) @unlink($public_file);
                $folder_pass = trim((string)($raw_body['folder_password'] ?? $_POST['folder_password'] ?? ''));
                if ($folder_pass !== '') {
                    $hash = password_hash($folder_pass, PASSWORD_BCRYPT);
                    $success = (@file_put_contents($password_file, $hash . "\n") !== false);
                } elseif (!file_exists($password_file)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error'   => 'Un mot de passe est requis pour protéger ce dossier.'
                    ]);
                    exit;
                }
            }
            break;

        case 'title':
            $file = $target_dir . '/.title';
            if ($value === '') {
                if (file_exists($file)) $success = @unlink($file);
            } else {
                $success = (@file_put_contents($file, $value . "\n") !== false);
            }
            break;

        case 'description':
            $file1 = $target_dir . '/.desc';
            $file2 = $target_dir . '/.description';
            if ($value === '') {
                if (file_exists($file1)) @unlink($file1);
                if (file_exists($file2)) @unlink($file2);
            } else {
                if (file_exists($file2)) @unlink($file2);
                $success = (@file_put_contents($file1, $value . "\n") !== false);
            }
            break;

        case 'bg':
            $file = $target_dir . '/.bg';
            if ($value === '') {
                if (file_exists($file)) $success = @unlink($file);
            } else {
                $success = (@file_put_contents($file, $value . "\n") !== false);
            }
            break;

        case 'theme':
            $file = $target_dir . '/.theme';
            if ($value === '') {
                if (file_exists($file)) $success = @unlink($file);
            } else {
                $success = (@file_put_contents($file, $value . "\n") !== false);
            }
            break;

        case 'comment':
            if ($filename === '') {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error'   => 'Filename required for comment update'
                ]);
                exit;
            }
            $filename = basename($filename);
            $comments = load_dir_comments($target_dir);
            if ($value === '') {
                unset($comments[$filename]);
            } else {
                $comments[$filename] = $value;
            }
            $success = save_dir_comments($target_dir, $comments);
            break;
    }

    if (!$success) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => "Failed to write file. Please check folder write permissions."
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Dotfile updated successfully',
        'type'    => $type
    ]);
    exit;
}

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
            $clean_comments[basename($fname)] = $cmt_clean;
        }
    }

    if (empty($clean_comments)) {
        if (file_exists($comment_file)) return @unlink($comment_file);
        return true;
    }

    $lines = [];
    foreach ($clean_comments as $fname => $cmt) {
        $lines[] = $fname . ' = ' . $cmt;
    }
    return (@file_put_contents($comment_file, implode("\n", $lines) . "\n") !== false);
}

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
            $possible_image = $dir_path . '/' . $bg_val;
            if (file_exists($possible_image) && is_file($possible_image)) {
                $rel_bg = get_relative_path($possible_image, $base_dir);
                $overrides['background'] = 'thumb.php?file=' . rawurlencode($rel_bg);
            } else {
                $overrides['background'] = $bg_val;
            }
        }
    }

    $theme_file = $dir_path . '/.theme';
    if (file_exists($theme_file) && is_readable($theme_file)) {
        $theme_val = trim(file_get_contents($theme_file));
        if ($theme_val !== '') {
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
            } else {
                $overrides['theme'] = $theme_val;
            }
        }
    }

    return $overrides;
}

function find_first_image_thumbnail(string $dir_path, string $base_dir, array $image_exts): ?string {
    $items = @scandir($dir_path);
    if ($items === false) return null;

    foreach ($items as $item) {
        if ($item[0] === '.') continue;
        $full = $dir_path . '/' . $item;
        if (is_file($full)) {
            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (in_array($ext, $image_exts, true)) {
                $rel = get_relative_path($full, $base_dir);
                return 'thumb.php?file=' . rawurlencode($rel);
            }
        }
    }
    return null;
}

$requested_dir = $_GET['dir'] ?? '';
$target_dir = sanitize_path($requested_dir, $real_base_dir);

if ($target_dir === null || !is_dir($target_dir)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error'   => 'Directory not found or access denied.'
    ]);
    exit;
}

$current_relative = get_relative_path($target_dir, $real_base_dir);

// Access check for target directory
if (!is_dir_accessible($target_dir, $real_base_dir)) {
    $access_info = get_dir_access_info($target_dir, $real_base_dir);
    if ($access_info['is_protected']) {
        http_response_code(401);
        echo json_encode([
            'success'      => false,
            'error'        => 'Ce dossier est protégé par un mot de passe.',
            'is_protected' => true,
            'path'         => $current_relative
        ]);
        exit;
    } else {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé.'
        ]);
        exit;
    }
}

$comments = load_dir_comments($target_dir);
$folder_overrides = load_folder_overrides($target_dir, $real_base_dir);

// Build breadcrumbs
$breadcrumbs = [['name' => $gallery_title, 'path' => '']];
if ($current_relative !== '') {
    $parts = explode('/', $current_relative);
    $accumulated = '';
    foreach ($parts as $part) {
        $accumulated = ($accumulated === '') ? $part : $accumulated . '/' . $part;
        $part_dir = sanitize_path($accumulated, $real_base_dir);
        $part_title = $part;

        if ($part_dir && file_exists($part_dir . '/.title')) {
            $custom_t = trim(@file_get_contents($part_dir . '/.title'));
            if ($custom_t !== '') $part_title = $custom_t;
        }

        $breadcrumbs[] = [
            'name' => $part_title,
            'path' => $accumulated
        ];
    }
}

// Parent path
$parent_path = null;
if ($current_relative !== '') {
    $parent_dir_full = dirname($target_dir);
    if (strpos($parent_dir_full, $real_base_dir) === 0) {
        $parent_path = get_relative_path($parent_dir_full, $real_base_dir);
    }
}

$directories = [];
$files = [];

$scan_items = @scandir($target_dir);
if ($scan_items !== false) {
    foreach ($scan_items as $item) {
        if (in_array($item, $ignore_list, true) || $item[0] === '.') {
            continue;
        }

        $full_item_path = $target_dir . '/' . $item;
        $item_relative = get_relative_path($full_item_path, $real_base_dir);

        if (is_dir($full_item_path)) {
            $sub_access = get_dir_access_info($full_item_path, $real_base_dir);

            // Hide private folders completely from non-admins
            if ($sub_access['is_private'] && !is_admin_logged_in()) {
                continue;
            }

            $sub_items = @scandir($full_item_path) ?: [];
            $item_count = 0;
            foreach ($sub_items as $sub) {
                if ($sub[0] !== '.' && !in_array($sub, $ignore_list, true)) {
                    $item_count++;
                }
            }

            $dir_display_name = $item;
            if (file_exists($full_item_path . '/.title')) {
                $custom_title = trim(@file_get_contents($full_item_path . '/.title'));
                if ($custom_title !== '') {
                    $dir_display_name = $custom_title;
                }
            }

            $cover_thumb = null;
            if ($sub_access['is_unlocked'] || is_admin_logged_in()) {
                $cover_exts = array_merge($media_types['image'], $media_types['video']);
                $cover_thumb = find_first_image_thumbnail($full_item_path, $real_base_dir, $cover_exts);
            }

            $directories[] = [
                'name'         => $dir_display_name,
                'raw_name'     => $item,
                'path'         => $item_relative,
                'mtime'        => filemtime($full_item_path),
                'item_count'   => $item_count,
                'cover'        => $cover_thumb,
                'comment'      => $comments[$item] ?? '',
                'access_mode'  => $sub_access['access_mode'],
                'is_private'   => $sub_access['is_private'],
                'is_protected' => $sub_access['is_protected'],
                'is_unlocked'  => $sub_access['is_unlocked']
            ];
        } elseif (is_file($full_item_path)) {
            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            $category = get_media_category($ext, $media_types);
            $size = filesize($full_item_path);
            $mtime = filemtime($full_item_path);

            $files[] = [
                'name'           => $item,
                'path'           => $item_relative,
                'extension'      => $ext,
                'category'       => $category,
                'size'           => $size,
                'size_formatted' => format_bytes($size),
                'mtime'          => $mtime,
                'thumb_url'      => 'thumb.php?file=' . rawurlencode($item_relative),
                'file_url'       => encode_url_path($item_relative),
                'comment'        => $comments[$item] ?? ''
            ];
        }
    }
}

usort($directories, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
usort($files, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));

echo json_encode([
    'success'       => true,
    'title'         => $folder_overrides['title'] ?? $gallery_title,
    'current_path'  => $current_relative,
    'parent_path'   => $parent_path,
    'breadcrumbs'   => $breadcrumbs,
    'overrides'     => $folder_overrides,
    'directories'   => $directories,
    'files'         => $files,
    'is_admin'      => is_admin_logged_in(),
    'admin_enabled' => !empty($admin_password_hash),
    'stats'         => [
        'directory_count' => count($directories),
        'file_count'      => count($files)
    ]
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
