<?php
/**
 * SimpleGallery 2026 - Guest Permissions Matrix Manager
 */

namespace SimpleGallery\Kernel\FS;

use SimpleGallery\Kernel\Auth\AuthManager;

class PermissionsManager {
    public const DEFAULT_PERMISSIONS = [
        'can_upload'           => false,
        'can_delete'           => false,
        'can_move'             => false,
        'can_comment'          => true,
        'can_create_folder'    => false,
        'can_download_archive' => true,
        'can_download_item'    => true
    ];

    /**
     * Get path to permissions matrix JSON configuration file
     */
    public static function getPermissionsFilePath(string $base_dir): string {
        return $base_dir . '/config/permissions.json';
    }

    /**
     * Get default permissions matrix array
     */
    public static function getDefaultPermissions(): array {
        return self::DEFAULT_PERMISSIONS;
    }

    /**
     * Load permissions from config/permissions.json or fallback to defaults
     */
    public static function loadPermissions(string $base_dir): array {
        $file = self::getPermissionsFilePath($base_dir);
        if (file_exists($file)) {
            $json = @file_get_contents($file);
            $perms = json_decode((string)$json, true);
            if (is_array($perms)) {
                return array_merge(self::DEFAULT_PERMISSIONS, $perms);
            }
        }
        return self::DEFAULT_PERMISSIONS;
    }

    /**
     * Save updated permissions matrix to config/permissions.json
     */
    public static function savePermissions(string $base_dir, array $permissions): bool {
        $file = self::getPermissionsFilePath($base_dir);
        $clean = array_merge(self::DEFAULT_PERMISSIONS, $permissions);
        $payload = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        return @file_put_contents($file, $payload, LOCK_EX) !== false;
    }

    /**
     * Check if a given permission is granted to the current user (Admin always returns true)
     */
    public static function hasPermission(string $permission_key, string $base_dir): bool {
        if (AuthManager::isAdminLoggedIn()) {
            return true;
        }

        $perms = self::loadPermissions($base_dir);
        return !empty($perms[$permission_key]);
    }
}
