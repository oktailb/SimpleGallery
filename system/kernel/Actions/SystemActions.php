<?php
namespace SimpleGallery\Kernel\Actions;

use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\FS\CacheManager;
use SimpleGallery\Kernel\I18n\I18nEngine;
use SimpleGallery\Kernel\Media\ExifParser;

class SystemActions {

    public static function handle(string $action, array $params, array|string $context): ?array {
        $base_dir = is_array($context) ? ($context['base_dir'] ?? '') : $context;
        $raw_body = is_array($context) ? ($context['raw_body'] ?? $params) : $params;

        if ($action === 'get_locales') {
            $locales = I18nEngine::getAvailableLocales($base_dir);
            $detected = I18nEngine::detectBrowserLocale($locales, 'fr');
            return ['status' => 200, 'data' => [
                'success'  => true,
                'locales'  => $locales,
                'detected' => $detected
            ]];
        }

        if ($action === 'get_locale') {
            $code = $_GET['code'] ?? $raw_body['code'] ?? 'fr';
            $code = preg_replace('/[^a-zA-Z0-9_-]/', '', $code);
            $translations = I18nEngine::loadLocaleTranslations($base_dir, $code);
            return ['status' => 200, 'data' => [
                'success'      => true,
                'code'         => $code,
                'translations' => $translations
            ]];
        }

        if ($action === 'get_system_info') {
            $has_gd = extension_loaded('gd');
            $gd_info = $has_gd ? gd_info() : [];
            $has_ffmpeg = false;
            if (function_exists('exec')) {
                @exec('ffmpeg -version 2>&1', $ff_out, $ff_code);
                $has_ffmpeg = ($ff_code === 0);
            }

            global $thumbnail_dir;
            $storage_dir = CacheManager::getCacheStorageDir($base_dir, $thumbnail_dir ?? '.thumbnails');
            $cache_count = 0;
            $cache_size = 0;
            $thumbs_count = 0;
            $thumbs_size = 0;

            if (is_dir($storage_dir)) {
                $files = @scandir($storage_dir) ?: [];
                foreach ($files as $f) {
                    if ($f[0] === '.') continue;
                    $f_path = $storage_dir . '/' . $f;
                    if (is_file($f_path)) {
                        $f_size = @filesize($f_path) ?: 0;
                        if (str_starts_with($f, 'cache_') && str_ends_with($f, '.json')) {
                            $cache_count++;
                            $cache_size += $f_size;
                        } else {
                            $thumbs_count++;
                            $thumbs_size += $f_size;
                        }
                    }
                }
            }

            $mem_current = memory_get_usage(true);
            $mem_peak = memory_get_peak_usage(true);
            $disk_total = @disk_total_space($base_dir) ?: 0;
            $disk_free = @disk_free_space($base_dir) ?: 0;
            $disk_used = max(0, $disk_total - $disk_free);
            $disk_percent = $disk_total > 0 ? round(($disk_used / $disk_total) * 100, 1) : 0;
            $load_avg = function_exists('sys_getloadavg') ? @sys_getloadavg() : null;

            return ['status' => 200, 'data' => [
                'success'     => true,
                'system_info' => [
                    'php_version'          => PHP_VERSION,
                    'php_os'               => PHP_OS_FAMILY . ' (' . PHP_OS . ')',
                    'php_sapi'             => PHP_SAPI,
                    'zend_version'         => zend_version(),
                    'server_software'      => $_SERVER['SERVER_SOFTWARE'] ?? 'PHP CLI / Built-in',
                    'gd_available'         => $has_gd,
                    'gd_webp'              => !empty($gd_info['WebP Support']),
                    'gd_avif'              => !empty($gd_info['AVIF Support']),
                    'exif_available'       => extension_loaded('exif'),
                    'zip_available'        => class_exists('ZipArchive'),
                    'intl_available'       => extension_loaded('intl'),
                    'pdo_available'        => extension_loaded('pdo'),
                    'sqlite_available'     => extension_loaded('pdo_sqlite') || extension_loaded('sqlite3'),
                    'curl_available'       => extension_loaded('curl'),
                    'mbstring_available'   => extension_loaded('mbstring'),
                    'opcache_available'    => extension_loaded('Zend OPcache') || extension_loaded('opcache'),
                    'ffmpeg_available'     => $has_ffmpeg,
                    'upload_max_filesize'  => ini_get('upload_max_filesize'),
                    'post_max_size'        => ini_get('post_max_size'),
                    'memory_limit'         => ini_get('memory_limit'),
                    'memory_current'       => $mem_current,
                    'memory_current_fmt'   => ExifParser::formatBytes($mem_current),
                    'memory_peak'          => $mem_peak,
                    'memory_peak_fmt'      => ExifParser::formatBytes($mem_peak),
                    'disk_total'           => $disk_total,
                    'disk_total_fmt'       => ExifParser::formatBytes((int)$disk_total),
                    'disk_free'            => $disk_free,
                    'disk_free_fmt'        => ExifParser::formatBytes((int)$disk_free),
                    'disk_used'            => $disk_used,
                    'disk_used_fmt'        => ExifParser::formatBytes((int)$disk_used),
                    'disk_used_percent'    => $disk_percent,
                    'cache_count'          => $cache_count,
                    'cache_size'           => $cache_size,
                    'cache_size_fmt'       => ExifParser::formatBytes($cache_size),
                    'thumbs_count'         => $thumbs_count,
                    'thumbs_size'          => $thumbs_size,
                    'thumbs_size_fmt'      => ExifParser::formatBytes($thumbs_size),
                    'server_load'          => $load_avg,
                    'is_admin'             => AuthManager::isAdminLoggedIn()
                ]
            ]];
        }

        if ($action === 'clear_all_caches') {
            if (!AuthManager::isAdminLoggedIn()) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_admin_required')]];
            }

            global $thumbnail_dir;
            $storage_dir = CacheManager::getCacheStorageDir($base_dir, $thumbnail_dir ?? '.thumbnails');
            $deleted_count = 0;
            $freed_bytes = 0;

            if (is_dir($storage_dir)) {
                $files = @scandir($storage_dir) ?: [];
                foreach ($files as $f) {
                    if ($f[0] === '.') continue;
                    $f_path = $storage_dir . '/' . $f;
                    if (is_file($f_path)) {
                        $freed_bytes += @filesize($f_path) ?: 0;
                        if (@unlink($f_path)) {
                            $deleted_count++;
                        }
                    }
                }
            }

            return ['status' => 200, 'data' => [
                'success'       => true,
                'deleted_count' => $deleted_count,
                'freed_bytes'   => $freed_bytes,
                'freed_fmt'     => ExifParser::formatBytes($freed_bytes)
            ]];
        }

        if ($action === 'save_desktop_shortcuts') {
            $shortcuts = $raw_body['shortcuts'] ?? $_POST['shortcuts'] ?? null;
            if (!is_array($shortcuts)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_data')]];
            }

            $saved = \SimpleGallery\Kernel\Config\ConfigStore::set('desktop', ['shortcuts' => $shortcuts], $base_dir);
            if ($saved) {
                return ['status' => 200, 'data' => ['success' => true, 'shortcuts' => $shortcuts, 'message' => 'Shortcuts saved']];
            }
            return ['status' => 500, 'data' => ['success' => false, 'error' => 'Failed to save shortcuts']];
        }

        if ($action === 'get_desktop_shortcuts') {
            $data = \SimpleGallery\Kernel\Config\ConfigStore::get('desktop', ['shortcuts' => []], $base_dir);
            $shortcuts = [];
            if (is_array($data) && isset($data['shortcuts'])) {
                $shortcuts = $data['shortcuts'];
            } elseif (is_array($data)) {
                $shortcuts = $data;
            }
            return ['status' => 200, 'data' => ['success' => true, 'shortcuts' => $shortcuts]];
        }



        return null;
    }
}
