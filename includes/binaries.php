<?php
/**
 * SimpleGallery 2026 - Centralized System Binary Detection Module
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

/**
 * Searches system PATH and common binary directories for executable binary or binaries
 *
 * @param string|array $binary_names Single name (e.g. 'ffmpeg') or list of candidate names (e.g. ['convert', 'magick'])
 * @param array $extra_paths Optional additional system paths to probe
 * @return string|null Resolved executable path or null if not found
 */
function find_binary_executable($binary_names, array $extra_paths = []): ?string {
    $names = is_array($binary_names) ? $binary_names : [$binary_names];

    foreach ($names as $name) {
        if (($name === 'php' || $name === 'php.exe') && defined('PHP_BINARY') && PHP_BINARY && file_exists(PHP_BINARY)) {
            return PHP_BINARY;
        }

        $php_dir = defined('PHP_BINARY') && PHP_BINARY ? dirname(PHP_BINARY) : null;
        $win_paths = [
            'C:/php/' . $name . '.exe',
            'C:/php/' . $name,
            'C:/xampp/php/' . $name . '.exe',
            'C:/xampp/php/' . $name
        ];
        if ($php_dir) {
            $win_paths[] = $php_dir . '/' . $name . '.exe';
            $win_paths[] = $php_dir . '/' . $name;
        }

        $common_paths = array_merge(
            [
                '/usr/bin/' . $name,
                '/usr/local/bin/' . $name,
                '/bin/' . $name,
                '/opt/homebrew/bin/' . $name,
                '/snap/bin/' . $name
            ],
            $win_paths,
            array_map(function($p) use ($name) {
                return rtrim($p, '/') . '/' . $name;
            }, $extra_paths)
        );

        foreach ($common_paths as $path) {
            if (file_exists($path) && (is_executable($path) || (defined('PHP_OS_FAMILY') && PHP_OS_FAMILY === 'Windows' && is_file($path)))) {
                return $path;
            }
        }

        if (defined('PHP_OS_FAMILY') && PHP_OS_FAMILY === 'Windows') {
            $win_which = @trim((string)@exec('where ' . escapeshellarg($name) . ' 2>nul'));
            if (!empty($win_which)) {
                $lines = explode("\n", str_replace("\r", "", $win_which));
                $first = trim($lines[0]);
                if (file_exists($first)) return $first;
            }
        } else {
            $which = @trim((string)@exec('which ' . escapeshellarg($name) . ' 2>/dev/null'));
            if (!empty($which) && file_exists($which) && is_executable($which)) {
                return $which;
            }
        }
    }

    return null;
}

/**
 * Finds FFmpeg executable for video thumbnail extraction
 */
function find_ffmpeg_binary(): ?string {
    return find_binary_executable('ffmpeg');
}

/**
 * Finds ExifTool executable for metadata inspection
 */
function find_exiftool_binary(): ?string {
    return find_binary_executable('exiftool');
}

/**
 * Finds ImageMagick convert or magick executable
 */
function find_convert_binary(): ?string {
    return find_binary_executable(['convert', 'magick']);
}

/**
 * Discovers available archive creation CLI utilities (Zip, 7z, Tar) & PHP extension capabilities
 */
function find_archive_binaries(): array {
    $available = [];

    if (extension_loaded('zip') || class_exists('ZipArchive')) {
        $available['zip'] = 'PHP ZipArchive';
    } else {
        $zip_cli = find_binary_executable('zip');
        if ($zip_cli) $available['zip'] = 'CLI zip (' . $zip_cli . ')';
    }

    $sz_cli = find_binary_executable(['7z', '7za']);
    if ($sz_cli) {
        $available['7z'] = 'CLI 7-Zip (' . $sz_cli . ')';
    }

    $tar_cli = find_binary_executable('tar');
    if ($tar_cli) {
        $available['tar'] = 'CLI tar (' . $tar_cli . ')';
    }

    return $available;
}
