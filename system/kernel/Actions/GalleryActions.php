<?php
namespace SimpleGallery\Kernel\Actions;

use SimpleGallery\Kernel\Security\PathValidator;
use SimpleGallery\Kernel\Security\SecurityManager;
use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\FS\CacheManager;
use SimpleGallery\Kernel\FS\DotfileManager;
use SimpleGallery\Kernel\FS\PermissionsManager;
use SimpleGallery\Kernel\FS\ArchiveEngine;
use SimpleGallery\Kernel\Media\BinaryLocator;
use SimpleGallery\Kernel\Media\ExifParser;


/**
 * Kernel Gallery Actions Handler
 * Handles get_gallery, get_metadata, get_all_media_flat, and get_stream_url.
 */
class GalleryActions {

    public static function handle(string $action, array $params, array $context): ?array {
        $base_dir      = $context['base_dir'] ?? '';
        $media_types   = $context['media_types'] ?? [];
        $ignore_list   = $context['ignore_list'] ?? [];
        $gallery_title = $context['gallery_title'] ?? 'SimpleGallery';
        $thumbnail_dir = $context['thumbnail_dir'] ?? '.thumbnails';

        switch ($action) {
            case 'get_gallery':
                return self::getGallery($params, $base_dir, $media_types, $ignore_list, $gallery_title, $thumbnail_dir);

            case 'get_metadata':
                return self::getMetadata($params, $base_dir, $media_types);

            case 'get_all_media_flat':
                return self::getAllMediaFlat($base_dir, $media_types, $ignore_list);

            case 'get_stream_url':
                return self::getStreamUrl($params, $base_dir);

            default:
                return null;
        }
    }

    public static function getGallery(array $params, string $base_dir, array $media_types, array $ignore_list, string $gallery_title, string $thumbnail_dir): array {
        $requested_dir = $params['dir'] ?? '';
        $target_dir = PathValidator::sanitizePath($requested_dir, $base_dir);

        if (!$target_dir || !is_dir($target_dir)) {
            return [
                'status' => 404,
                'data'   => ['success' => false, 'error' => __t('api.err_folder_not_found', [], null, $base_dir)]
            ];
        }

        $access_info = DotfileManager::getDirAccessInfo($target_dir, $base_dir);
        if ($access_info['is_private'] && !AuthManager::isAdminLoggedIn()) {
            return [
                'status' => 403,
                'data'   => ['success' => false, 'error' => __t('api.err_private_access', [], null, $base_dir)]
            ];
        }

        if ($access_info['is_protected'] && !$access_info['is_unlocked'] && !AuthManager::isAdminLoggedIn()) {
            return [
                'status' => 200,
                'data'   => [
                    'success'      => true,
                    'is_locked'    => true,
                    'access_mode'  => 'password',
                    'current_path' => PathValidator::getRelativePath($target_dir, $base_dir),
                    'message'      => __t('api.msg_password_required', [], null, $base_dir)
                ]
            ];
        }

        $folder_overrides = DotfileManager::getFolderOverrides($target_dir, $base_dir);
        $comments         = DotfileManager::loadDirComments($target_dir);
        $current_relative = PathValidator::getRelativePath($target_dir, $base_dir);

        // Build breadcrumbs
        $breadcrumbs = [['name' => $gallery_title, 'path' => '']];
        if ($current_relative !== '') {
            $parts = explode('/', $current_relative);
            $accumulated = '';
            foreach ($parts as $part) {
                $accumulated = ($accumulated === '') ? $part : $accumulated . '/' . $part;
                $part_dir = PathValidator::sanitizePath($accumulated, $base_dir);
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
            if (strpos($parent_dir_full, $base_dir) === 0) {
                $parent_path = PathValidator::getRelativePath($parent_dir_full, $base_dir);
            }
        }

        $directories = [];
        $files = [];

        $cache_file_path = CacheManager::getDirCacheFilePath($target_dir, $base_dir, $thumbnail_dir);
        $cached_raw = null;

        if (CacheManager::isDirCacheValid($cache_file_path, $target_dir)) {
            $json_content = @file_get_contents($cache_file_path);
            if ($json_content) {
                $decoded = @json_decode($json_content, true);
                if (is_array($decoded) && isset($decoded['raw_items'])) {
                    $cached_raw = $decoded['raw_items'];
                }
            }
        }

        if ($cached_raw !== null) {
            if (empty($cached_raw['directories']) && empty($cached_raw['files'])) {
                $real_items = @scandir($target_dir) ?: [];
                foreach ($real_items as $ri) {
                    if ($ri[0] !== '.' && !in_array($ri, $ignore_list, true)) {
                        $cached_raw = null;
                        break;
                    }
                }
            }
        }

        if ($cached_raw !== null) {
            // CACHE HIT
            foreach ($cached_raw['directories'] as $dir_item) {
                $full_item_path = $target_dir . '/' . $dir_item['raw_name'];
                $sub_access = DotfileManager::getDirAccessInfo($full_item_path, $base_dir);

                if ($sub_access['is_private'] && !AuthManager::isAdminLoggedIn()) {
                    continue;
                }

                $dir_display_name = $dir_item['raw_name'];
                if (file_exists($full_item_path . '/.title')) {
                    $custom_title = trim(@file_get_contents($full_item_path . '/.title'));
                    if ($custom_title !== '') {
                        $dir_display_name = $custom_title;
                    }
                }

                $cover_thumb = null;
                if ($sub_access['is_unlocked'] || AuthManager::isAdminLoggedIn()) {
                    $cover_exts = array_merge($media_types['image'] ?? [], $media_types['video'] ?? []);
                    $cover_thumb = ExifParser::findFirstImageThumbnail($full_item_path, $base_dir, $cover_exts);
                }

                $sub_items = @scandir($full_item_path) ?: [];
                $live_item_count = 0;
                foreach ($sub_items as $sub) {
                    if ($sub[0] !== '.' && !in_array($sub, $ignore_list, true)) {
                        $live_item_count++;
                    }
                }

                $directories[] = [
                    'name'         => $dir_display_name,
                    'raw_name'     => $dir_item['raw_name'],
                    'path'         => $dir_item['path'],
                    'mtime'        => $dir_item['mtime'],
                    'item_count'   => $live_item_count,
                    'cover'        => $cover_thumb,
                    'comment'      => $comments[$dir_item['raw_name']] ?? '',
                    'access_mode'  => $sub_access['access_mode'],
                    'is_private'   => $sub_access['is_private'],
                    'is_protected' => $sub_access['is_protected'],
                    'is_unlocked'  => $sub_access['is_unlocked']
                ];
            }

            foreach ($cached_raw['files'] as $file_item) {
                $file_item['comment'] = $comments[$file_item['name']] ?? '';
                if (isset($file_item['thumb_url']) && str_starts_with($file_item['thumb_url'], 'thumb.php?')) {
                    $file_item['thumb_url'] = 'system/endpoints/' . $file_item['thumb_url'];
                }
                if (isset($file_item['file_url']) && str_starts_with($file_item['file_url'], 'thumb.php?')) {
                    $file_item['file_url'] = 'system/endpoints/' . $file_item['file_url'];
                }
                $files[] = $file_item;
            }
        } else {
            // CACHE MISS: Full disk scan & EXIF extraction
            $raw_directories = [];
            $raw_files = [];

            $scan_items = @scandir($target_dir);
            if ($scan_items !== false) {
                foreach ($scan_items as $item) {
                    if (in_array($item, $ignore_list, true) || $item[0] === '.') {
                        continue;
                    }

                    $full_item_path = $target_dir . '/' . $item;
                    $item_relative = PathValidator::getRelativePath($full_item_path, $base_dir);

                    if (is_dir($full_item_path)) {
                        $sub_access = DotfileManager::getDirAccessInfo($full_item_path, $base_dir);

                        $sub_items = @scandir($full_item_path) ?: [];
                        $item_count = 0;
                        foreach ($sub_items as $sub) {
                            $sub_ext = strtolower(pathinfo($sub, PATHINFO_EXTENSION));
                            if ($sub[0] !== '.' && !in_array($sub, $ignore_list, true) && !in_array($sub_ext, ['php', 'phtml', 'phar', 'htaccess', 'ini', 'hash'], true)) {
                                $item_count++;
                            }
                        }

                        $raw_directories[] = [
                            'raw_name'   => $item,
                            'path'       => $item_relative,
                            'mtime'      => filemtime($full_item_path),
                            'item_count' => $item_count
                        ];

                        if ($sub_access['is_private'] && !AuthManager::isAdminLoggedIn()) {
                            continue;
                        }

                        $dir_display_name = $item;
                        if (file_exists($full_item_path . '/.title')) {
                            $custom_title = trim(@file_get_contents($full_item_path . '/.title'));
                            if ($custom_title !== '') {
                                $dir_display_name = $custom_title;
                            }
                        }

                        $cover_thumb = null;
                        if ($sub_access['is_unlocked'] || AuthManager::isAdminLoggedIn()) {
                            $cover_exts = array_merge($media_types['image'] ?? [], $media_types['video'] ?? []);
                            $cover_thumb = ExifParser::findFirstImageThumbnail($full_item_path, $base_dir, $cover_exts);
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
                        $forbidden_system_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc', 'js', 'css', 'html', 'htm', 'htaccess', 'htpasswd', 'sh', 'bat', 'cmd', 'exe', 'dll', 'py', 'pl', 'cgi', 'hash', 'ini', 'sql', 'bak', 'json'];
                        if ($ext === '' || in_array($ext, $forbidden_system_exts, true) || in_array($item, $ignore_list, true)) {
                            continue;
                        }
                        $category = ExifParser::getMediaCategory($ext, $media_types);
                        $size = filesize($full_item_path);
                        $mtime = filemtime($full_item_path);

                        $exif = ($category === 'image') ? ExifParser::extractExifData($full_item_path) : null;
                        $effective_mtime = ($exif && !empty($exif['date_ts'])) ? $exif['date_ts'] : $mtime;

                        $file_entry = [
                            'name'           => $item,
                            'path'           => $item_relative,
                            'extension'      => $ext,
                            'category'       => $category,
                            'size'           => $size,
                            'size_formatted' => ExifParser::formatBytes($size),
                            'mtime'          => $mtime,
                            'effective_mtime'=> $effective_mtime,
                            'exif'           => $exif,
                            'thumb_url'      => 'system/endpoints/thumb.php?file=' . rawurlencode($item_relative),
                            'file_url'       => 'system/endpoints/thumb.php?file=' . rawurlencode($item_relative) . '&raw=1',
                            'comment'        => $comments[$item] ?? ''
                        ];

                        $raw_files[] = $file_entry;
                        $files[]     = $file_entry;
                    }
                }
            }

            $cache_payload = [
                'created_at' => time(),
                'raw_items'  => [
                    'directories' => $raw_directories,
                    'files'       => $raw_files
                ]
            ];
            @file_put_contents($cache_file_path, json_encode($cache_payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }

        usort($directories, function($a, $b) {
            return strnatcasecmp($a['name'], $b['name']);
        });
        usort($files, function($a, $b) {
            return strnatcasecmp($a['name'], $b['name']);
        });

        $output_data = [
            'success'           => true,
            'csrf_token'        => SecurityManager::getCsrfToken(),
            'title'             => $folder_overrides['title'] ?? $gallery_title,
            'current_path'      => $current_relative,
            'parent_path'       => $parent_path,
            'breadcrumbs'       => $breadcrumbs,
            'overrides'         => $folder_overrides,
            'directories'       => $directories,
            'files'             => $files,
            'is_admin'          => AuthManager::isAdminLoggedIn(),
            'admin_enabled'     => !empty(AuthManager::getPasswordHash($base_dir)),
            'user_permissions'  => PermissionsManager::loadPermissions($base_dir),
            'user_rights'        => [
                'is_admin'             => AuthManager::isAdminLoggedIn(),
                'can_upload'           => PermissionsManager::hasPermission('can_upload', $base_dir),
                'can_delete'           => PermissionsManager::hasPermission('can_delete', $base_dir),
                'can_move'             => PermissionsManager::hasPermission('can_move', $base_dir),
                'can_comment'          => PermissionsManager::hasPermission('can_comment', $base_dir),
                'can_create_folder'    => PermissionsManager::hasPermission('can_create_folder', $base_dir),
                'can_download_archive' => PermissionsManager::hasPermission('can_download_archive', $base_dir),
                'can_download_item'    => PermissionsManager::hasPermission('can_download_item', $base_dir)
            ],
            'available_archives'=> BinaryLocator::findArchiveBinaries(),

            'stats'             => [
                'directory_count' => count($directories),
                'file_count'      => count($files)
            ]
        ];

        return ['status' => 200, 'data' => $output_data];
    }

    public static function getMetadata(array $params, string $base_dir, array $media_types): array {
        $file_param = $params['file'] ?? '';
        $file_path = PathValidator::sanitizeFilePath($file_param, $base_dir);

        if (!$file_path || !is_file($file_path)) {
            return [
                'status' => 404,
                'data'   => ['success' => false, 'error' => __t('api.err_file_not_found', [], null, $base_dir)]
            ];
        }

        if (!AuthManager::isDirAccessible(dirname($file_path), $base_dir)) {
            return [
                'status' => 403,
                'data'   => ['success' => false, 'error' => __t('api.err_access_denied', [], null, $base_dir)]
            ];
        }

        $filename = basename($file_path);
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $category = ExifParser::getMediaCategory($ext, $media_types);
        $metadata = get_file_unified_metadata($file_path, $filename, $category, $ext);

        return [
            'status' => 200,
            'data'   => [
                'success'  => true,
                'metadata' => $metadata
            ]
        ];

    }

    public static function getAllMediaFlat(string $base_dir, array $media_types, array $ignore_list): array {
        $all_files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($base_dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            if ($item->isDir()) {
                if (in_array($item->getFilename(), $ignore_list, true) || $item->getFilename()[0] === '.') {
                    continue;
                }
                $access = DotfileManager::getDirAccessInfo($item->getPathname(), $base_dir);
                if ($access['is_private'] && !AuthManager::isAdminLoggedIn()) {
                    continue;
                }
            } elseif ($item->isFile()) {
                $ext = strtolower($item->getExtension());
                if (in_array($ext, $media_types['image'] ?? [], true) || in_array($ext, $media_types['video'] ?? [], true) || in_array($ext, $media_types['audio'] ?? [], true)) {
                    $rel = PathValidator::getRelativePath($item->getPathname(), $base_dir);
                    $all_files[] = [
                        'name'      => $item->getFilename(),
                        'path'      => $rel,
                        'extension' => $ext,
                        'category'  => ExifParser::getMediaCategory($ext, $media_types),
                        'thumb_url' => 'system/endpoints/thumb.php?file=' . rawurlencode($rel),
                        'file_url'  => 'system/endpoints/thumb.php?file=' . rawurlencode($rel) . '&raw=1'
                    ];
                }
            }
        }

        return [
            'status' => 200,
            'data'   => [
                'success' => true,
                'files'   => $all_files,
                'count'   => count($all_files)
            ]
        ];
    }

    public static function getStreamUrl(array $params, string $base_dir): array {
        $file_param = $params['file'] ?? '';
        $file_path = PathValidator::sanitizeFilePath($file_param, $base_dir);

        if (!$file_path || !is_file($file_path)) {
            return [
                'status' => 404,
                'data'   => ['success' => false, 'error' => __t('api.err_file_not_found', [], null, $base_dir)]
            ];
        }

        $rel = PathValidator::getRelativePath($file_path, $base_dir);
        return [
            'status' => 200,
            'data'   => [
                'success'    => true,
                'stream_url' => 'system/endpoints/thumb.php?file=' . rawurlencode($rel) . '&raw=1'
            ]
        ];
    }
}
