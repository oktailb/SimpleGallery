<?php
/**
 * SimpleGallery 2026 - JSON API Endpoint with Dotfile Folder Overrides
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

require_once __DIR__ . '/config.php';

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

/**
 * Parses hidden Unix .comment file
 * Supports legacy 2-line format (line 1 = filename, line 2 = comment)
 * and key=value / key: value format.
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
                    // Legacy 2-line format
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

/**
 * Parses folder dotfile configuration overrides (.bg, .title, .desc, .theme)
 */
function load_folder_overrides(string $dir_path, string $base_dir): array {
    $overrides = [
        'title'       => null,
        'description' => null,
        'background'  => null,
        'theme'       => null
    ];

    // .title override
    $title_file = $dir_path . '/.title';
    if (file_exists($title_file) && is_readable($title_file)) {
        $overrides['title'] = trim(file_get_contents($title_file));
    }

    // .desc or .description override
    $desc_file = file_exists($dir_path . '/.desc') ? $dir_path . '/.desc' : (file_exists($dir_path . '/.description') ? $dir_path . '/.description' : null);
    if ($desc_file && is_readable($desc_file)) {
        $overrides['description'] = trim(file_get_contents($desc_file));
    }

    // .bg override (background image or CSS color)
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

    // .theme override (preset name or key=value overrides)
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

        // Check if ancestor folder has a .title override
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
            $sub_items = @scandir($full_item_path) ?: [];
            $item_count = 0;
            foreach ($sub_items as $sub) {
                if ($sub[0] !== '.' && !in_array($sub, $ignore_list, true)) {
                    $item_count++;
                }
            }

            // Check if folder has .title override
            $dir_display_name = $item;
            if (file_exists($full_item_path . '/.title')) {
                $custom_title = trim(@file_get_contents($full_item_path . '/.title'));
                if ($custom_title !== '') {
                    $dir_display_name = $custom_title;
                }
            }

            $cover_thumb = find_first_image_thumbnail($full_item_path, $real_base_dir, $media_types['image']);

            $directories[] = [
                'name'         => $dir_display_name,
                'raw_name'     => $item,
                'path'         => $item_relative,
                'mtime'        => filemtime($full_item_path),
                'item_count'   => $item_count,
                'cover'        => $cover_thumb,
                'comment'      => $comments[$item] ?? ''
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
                'file_url'       => rawurlencode($item_relative),
                'comment'        => $comments[$item] ?? ''
            ];
        }
    }
}

usort($directories, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
usort($files, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));

echo json_encode([
    'success'      => true,
    'title'        => $folder_overrides['title'] ?? $gallery_title,
    'current_path' => $current_relative,
    'parent_path'  => $parent_path,
    'breadcrumbs'  => $breadcrumbs,
    'overrides'    => $folder_overrides,
    'directories'  => $directories,
    'files'        => $files,
    'stats'        => [
        'directory_count' => count($directories),
        'file_count'      => count($files)
    ]
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
