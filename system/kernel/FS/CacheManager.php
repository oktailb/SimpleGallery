<?php
namespace SimpleGallery\Kernel\FS;

use SimpleGallery\Kernel\Security\PathValidator;

/**
 * Kernel Cache Manager
 * Manages directory listings cache and thumbnail cache paths.
 */
class CacheManager {

    public static function getCacheStorageDir(string $base_dir, string $thumb_dir): string {
        global $storage_cache_dir;
        if (!empty($storage_cache_dir)) {
            $cache_dir = $storage_cache_dir;
        } else {
            $parent = dirname($base_dir);
            $cache_dir = (is_dir($parent) && is_writable($parent)) ? ($parent . '/' . $thumb_dir) : ($base_dir . '/' . $thumb_dir);
        }
        if (!is_dir($cache_dir)) {
            @mkdir($cache_dir, 0755, true);
        }
        if (!is_dir($cache_dir) || !is_writable($cache_dir)) {
            $cache_dir = sys_get_temp_dir() . '/simplegallery_thumbnails';
            if (!is_dir($cache_dir)) {
                @mkdir($cache_dir, 0755, true);
            }
        }
        return $cache_dir;
    }

    public static function getDirCacheFilePath(string $dir_path, string $base_dir, string $thumb_dir): string {
        $storage = self::getCacheStorageDir($base_dir, $thumb_dir);
        $rel = PathValidator::getRelativePath($dir_path, $base_dir);
        $key = md5('dir_index_v7_kernel_' . $rel);
        return $storage . '/cache_' . $key . '.json';
    }

    public static function isDirCacheValid(string $cache_file, string $dir_path): bool {
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

    public static function invalidateDirCache(string $dir_path, string $base_dir, string $thumb_dir): void {
        $cache_file = self::getDirCacheFilePath($dir_path, $base_dir, $thumb_dir);
        if (file_exists($cache_file)) {
            @unlink($cache_file);
        }

        $real_base = str_replace('\\', '/', realpath($base_dir) ?: $base_dir);
        $real_dir  = str_replace('\\', '/', realpath($dir_path) ?: $dir_path);

        if ($real_dir !== $real_base) {
            $parent_dir = dirname($real_dir);
            if (strpos($parent_dir, $real_base) === 0) {
                $parent_cache_file = self::getDirCacheFilePath($parent_dir, $base_dir, $thumb_dir);
                if (file_exists($parent_cache_file)) {
                    @unlink($parent_cache_file);
                }
            }
        }
    }
}
