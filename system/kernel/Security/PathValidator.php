<?php
namespace SimpleGallery\Kernel\Security;

/**
 * Kernel Path Validator & Anti-Traversal Shield
 */
class PathValidator {

    /**
     * Canonicalizes path and guarantees that the resulting target is strictly inside $base_dir sandbox.
     */
    public static function canonicalize(string $user_path, string $base_dir, bool $must_exist = true, bool $allow_root = true): ?string {
        if (preg_match('/[\x00-\x1f\x7f]/', $user_path)) {
            return null;
        }

        $real_base = realpath($base_dir);
        if ($real_base === false) {
            $real_base = $base_dir;
        }
        $real_base = str_replace('\\', '/', $real_base);
        $real_base = rtrim($real_base, '/');

        $clean_path = str_replace('\\', '/', trim($user_path));

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

    public static function sanitizeDirectory(?string $requested_dir, string $base_dir): ?string {
        if ($requested_dir === null) return null;
        $result = self::canonicalize($requested_dir, $base_dir, true, true);
        if ($result !== null && !is_dir($result)) {
            return null;
        }
        return $result;
    }

    public static function sanitizeFile(?string $requested_file, string $base_dir): ?string {
        if (empty($requested_file)) return null;
        $result = self::canonicalize($requested_file, $base_dir, true, false);
        if ($result !== null && !is_file($result)) {
            return null;
        }
        return $result;
    }

    public static function getRelativePath(string $full_path, string $base_dir): string {
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
}
