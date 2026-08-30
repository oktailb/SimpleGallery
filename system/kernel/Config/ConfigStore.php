<?php
namespace SimpleGallery\Kernel\Config;

/**
 * SimpleGallery WebOS - Centralized System Configuration Store
 * Handles persistence for system preferences, OS settings, autostart, permissions, and shortcuts into `config/`.
 */
class ConfigStore {

    /**
     * Get the absolute path to the system configuration directory
     */
    public static function getConfigDir(string $base_dir = ''): string {
        $project_root = dirname(dirname(dirname(__DIR__)));
        $dir = ($base_dir !== '') ? $base_dir . '/config' : $project_root . '/config';
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        return $dir;
    }

    /**
     * Get the path to a specific configuration file
     */
    public static function getFilePath(string $key, string $base_dir = ''): string {
        $clean_key = preg_replace('/[^a-zA-Z0-9_\.-]/', '', $key);
        if (!str_ends_with($clean_key, '.json')) {
            $clean_key .= '.json';
        }
        return self::getConfigDir($base_dir) . '/' . $clean_key;
    }

    /**
     * Retrieve configuration data by key with transparent fallback to legacy storage/ if present
     * 
     * @param string $key Config key name (e.g. 'autostart', 'settings', 'permissions', 'shortcuts')
     * @param mixed $default Fallback value if configuration file does not exist
     * @param string $base_dir Optional custom base directory
     * @return mixed Decoded configuration data
     */
    public static function get(string $key, $default = null, string $base_dir = '') {
        $path = self::getFilePath($key, $base_dir);

        // 1. Check in config/
        if (file_exists($path) && is_readable($path)) {
            $content = @file_get_contents($path);
            if ($content !== false && trim($content) !== '') {
                $decoded = json_decode($content, true);
                if ($decoded !== null || $content === 'null') {
                    return $decoded;
                }
            }
        }

        // 2. Backward compatibility fallback: check in storage/
        $project_root = dirname(dirname(dirname(__DIR__)));
        $storage_dir = ($base_dir !== '') ? $base_dir . '/storage' : $project_root . '/storage';
        $clean_key = preg_replace('/[^a-zA-Z0-9_\.-]/', '', $key);
        if (!str_ends_with($clean_key, '.json')) {
            $clean_key .= '.json';
        }
        $legacy_path = $storage_dir . '/' . $clean_key;

        if (file_exists($legacy_path) && is_readable($legacy_path)) {
            $content = @file_get_contents($legacy_path);
            if ($content !== false && trim($content) !== '') {
                $decoded = json_decode($content, true);
                if ($decoded !== null || $content === 'null') {
                    return $decoded;
                }
            }
        }

        return $default;
    }

    /**
     * Save configuration data by key with atomic file lock in config/
     * 
     * @param string $key Config key name
     * @param mixed $value Data to encode as JSON
     * @param string $base_dir Optional custom base directory
     * @return bool Success status
     */
    public static function set(string $key, $value, string $base_dir = ''): bool {
        $path = self::getFilePath($key, $base_dir);
        $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($encoded === false) {
            return false;
        }

        $res = @file_put_contents($path, $encoded, LOCK_EX);
        return ($res !== false);
    }

    /**
     * Delete a configuration file
     */
    public static function delete(string $key, string $base_dir = ''): bool {
        $path = self::getFilePath($key, $base_dir);
        if (file_exists($path)) {
            return @unlink($path);
        }
        return true;
    }

    /**
     * Check if a configuration exists
     */
    public static function has(string $key, string $base_dir = ''): bool {
        return file_exists(self::getFilePath($key, $base_dir));
    }
}
