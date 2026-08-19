<?php
namespace SimpleGallery\Kernel\FS;

use SimpleGallery\Kernel\Security\PathValidator;
use SimpleGallery\Kernel\Security\SecurityManager;
use SimpleGallery\Kernel\Media\ExifParser;

/**
 * Kernel Virtual File System (VFS)
 * Provides safe virtualized access to files and directories.
 */
class VFS {

    public static function formatBytes(int $bytes, int $precision = 2): string {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        return round($bytes, $precision) . ' ' . $units[$pow];
    }

    public static function getCategory(string $ext, array $media_types): string {
        $ext = strtolower($ext);
        foreach ($media_types as $cat => $extensions) {
            if (in_array($ext, $extensions, true)) {
                return $cat;
            }
        }
        return 'other';
    }

    public static function listDirectory(string $target_dir, string $base_dir, array $media_types, array $theme_colors = []): ?array {
        $sanitized_dir = PathValidator::sanitizeDirectory($target_dir, $base_dir);
        if (!$sanitized_dir || !DotfileManager::isDirAccessible($sanitized_dir, $base_dir)) {
            return null;
        }

        $rel_dir = PathValidator::getRelativePath($sanitized_dir, $base_dir);
        $overrides = DotfileManager::loadFolderOverrides($sanitized_dir, $base_dir, $theme_colors);
        $comments = DotfileManager::loadComments($sanitized_dir);

        $items = @scandir($sanitized_dir);
        if ($items === false) {
            return null;
        }

        $folders = [];
        $files = [];

        $forbidden_exts = ['php', 'htaccess', 'ini', 'hash', 'sh', 'bat'];

        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || $item[0] === '.') {
                continue;
            }

            $full_path = $sanitized_dir . '/' . $item;
            $rel_path = PathValidator::getRelativePath($full_path, $base_dir);

            if (is_dir($full_path)) {
                if (!DotfileManager::isDirAccessible($full_path, $base_dir)) {
                    continue;
                }

                $sub_overrides = DotfileManager::loadFolderOverrides($full_path, $base_dir, $theme_colors);
                
                // Count items and find first image as cover
                $sub_items = @scandir($full_path) ?: [];
                $item_count = 0;
                $cover_thumb = null;
                foreach ($sub_items as $sub) {
                    if ($sub[0] === '.') continue;
                    $sub_ext = strtolower(pathinfo($sub, PATHINFO_EXTENSION));
                    if (in_array($sub_ext, $forbidden_exts, true)) continue;
                    $item_count++;
                    if (!$cover_thumb && in_array($sub_ext, $media_types['image'] ?? [], true)) {
                        $cover_thumb = 'thumb.php?file=' . rawurlencode(PathValidator::getRelativePath($full_path . '/' . $sub, $base_dir));
                    }
                }

                $folders[] = [
                    'name'        => $item,
                    'path'        => $rel_path,
                    'title'       => $sub_overrides['title'] ?? $item,
                    'description' => $sub_overrides['description'] ?? null,
                    'item_count'  => $item_count,
                    'cover_thumb' => $cover_thumb,
                    'access_mode' => $sub_overrides['access_mode'],
                    'is_protected'=> $sub_overrides['is_protected'],
                    'is_unlocked' => $sub_overrides['is_unlocked']
                ];
            } elseif (is_file($full_path)) {
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                if ($ext === '' || in_array($ext, $forbidden_exts, true)) {
                    continue;
                }

                $category = self::getCategory($ext, $media_types);
                $size = filesize($full_path);
                $mtime = filemtime($full_path);
                $comment = $comments[$item] ?? '';

                $exif = ($category === 'image') ? ExifParser::extract($full_path) : null;
                $effective_mtime = ($exif && !empty($exif['date_ts'])) ? $exif['date_ts'] : $mtime;

                $files[] = [
                    'name'            => $item,
                    'path'            => $rel_path,
                    'extension'       => $ext,
                    'category'        => $category,
                    'size'            => $size,
                    'size_formatted'  => self::formatBytes($size),
                    'mtime'           => $mtime,
                    'effective_mtime' => $effective_mtime,
                    'exif'            => $exif,
                    'thumb_url'       => 'thumb.php?file=' . rawurlencode($rel_path),
                    'file_url'        => 'thumb.php?file=' . rawurlencode($rel_path) . '&raw=1',
                    'comment'         => $comment
                ];
            }
        }

        // Build breadcrumbs
        $breadcrumbs = [];
        $parts = array_filter(explode('/', $rel_dir));
        $accum = '';
        foreach ($parts as $part) {
            $accum = ($accum === '') ? $part : $accum . '/' . $part;
            $crumb_path = $base_dir . '/' . $accum;
            $crumb_overrides = DotfileManager::loadFolderOverrides($crumb_path, $base_dir, $theme_colors);
            $breadcrumbs[] = [
                'name'  => $crumb_overrides['title'] ?? $part,
                'path'  => $accum
            ];
        }

        return [
            'current_path' => $rel_dir,
            'title'        => $overrides['title'] ?? ($rel_dir === '' ? 'Root' : basename($rel_dir)),
            'description'  => $overrides['description'] ?? null,
            'background'   => $overrides['background'] ?? null,
            'theme'        => $overrides['theme'] ?? null,
            'theme_name'   => $overrides['theme_name'] ?? null,
            'access_mode'  => $overrides['access_mode'],
            'is_protected' => $overrides['is_protected'],
            'is_unlocked'  => $overrides['is_unlocked'],
            'breadcrumbs'  => $breadcrumbs,
            'folders'      => $folders,
            'files'        => $files
        ];
    }
}
