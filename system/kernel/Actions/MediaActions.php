<?php
namespace SimpleGallery\Kernel\Actions;

use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\FS\ArchiveEngine;
use SimpleGallery\Kernel\FS\PermissionsManager;
use SimpleGallery\Kernel\Media\BinaryLocator;
use SimpleGallery\Kernel\Media\ExifParser;
use SimpleGallery\Kernel\Search\SearchEngine;
use SimpleGallery\Kernel\Security\PathValidator;

class MediaActions {

    public static function handle(string $action, array $params, array $context): ?array {
        $base_dir    = $context['base_dir'] ?? '';
        $ignore_list = $context['ignore_list'] ?? [];
        $media_types = $context['media_types'] ?? [];
        $raw_body    = $context['raw_body'] ?? $params;

        if ($action === 'view_file' || $action === 'raw_file') {
            $file_param = $_GET['file'] ?? $raw_body['file'] ?? '';
            $file_full = PathValidator::sanitizeFile($file_param, $base_dir);
            if ($file_full === null || !is_file($file_full)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => 'Fichier introuvable']];
            }
            header('Location: system/endpoints/thumb.php?file=' . rawurlencode($file_param) . '&raw=1', true, 302);
            exit;
        }

        if ($action === 'get_metadata') {
            $file_param = $_GET['file'] ?? $raw_body['file'] ?? '';
            $file_full = PathValidator::sanitizeFile($file_param, $base_dir);
            if ($file_full === null || !is_file($file_full)) {
                return ['status' => 404, 'data' => [
                    'success' => false,
                    'error'   => 'Fichier introuvable ou accès refusé.'
                ]];
            }

            $ext = strtolower(pathinfo($file_full, PATHINFO_EXTENSION));
            $category = ExifParser::getMediaCategory($ext, $media_types);
            $rel_path = PathValidator::getRelativePath($file_full, $base_dir);
            $meta = get_file_unified_metadata($file_full, $rel_path, $category, $ext);

            return ['status' => 200, 'data' => [
                'success'  => true,
                'metadata' => $meta
            ]];
        }

        if ($action === 'download_archive') {
            if (!PermissionsManager::hasPermission('can_download_archive', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => 'Permission de téléchargement d\'archive refusée']];
            }

            $format = strtolower($raw_body['format'] ?? $_GET['format'] ?? 'zip');
            $req_dir = $raw_body['dir'] ?? $_GET['dir'] ?? '';
            $dir_target = PathValidator::sanitizeDirectory($req_dir, $base_dir);

            if (!$dir_target || !is_dir($dir_target) || PathValidator::isPathIgnored($dir_target, $base_dir, $ignore_list)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => 'Dossier introuvable ou accès refusé']];
            }

            if (!AuthManager::isDirAccessible($dir_target, $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => 'Accès refusé : Ce dossier est protégé ou privé.']];
            }

            $available_formats = BinaryLocator::findArchiveBinaries();
            if (!isset($available_formats[$format])) {
                $format = 'zip';
            }

            $tmp_dir = sys_get_temp_dir() . '/simplegallery_archives';
            if (!is_dir($tmp_dir)) @mkdir($tmp_dir, 0755, true);

            $ext_map = ['zip' => '.zip', '7z' => '.7z', 'tar' => '.tar.gz'];
            $mime_map = ['zip' => 'application/zip', '7z' => 'application/x-7z-compressed', 'tar' => 'application/gzip'];

            $file_ext = $ext_map[$format] ?? '.zip';
            $mime_type = $mime_map[$format] ?? 'application/octet-stream';

            $folder_name = ($dir_target === $base_dir) ? 'gallery' : basename($dir_target);
            $folder_name_safe = preg_replace('/[^\w\.\-\s]/u', '_', $folder_name);
            $archive_name = $folder_name_safe . '_' . date('Ymd_His') . $file_ext;
            $archive_path = $tmp_dir . '/' . $archive_name;

            if (ArchiveEngine::createArchive($format, $dir_target, $archive_path, $base_dir, $ignore_list)) {
                if (ob_get_level()) {
                    ob_end_clean();
                }
                header('Content-Type: ' . $mime_type);
                header('Content-Disposition: attachment; filename="' . $archive_name . '"');
                header('Content-Length: ' . filesize($archive_path));
                header('Cache-Control: no-cache, must-revalidate');
                header('Pragma: no-cache');
                header('Expires: 0');

                readfile($archive_path);
                @unlink($archive_path);
                exit;
            } else {
                return ['status' => 500, 'data' => ['success' => false, 'error' => 'Impossible de créer l\'archive au format ' . htmlspecialchars($format)]];
            }
        }

        if ($action === 'search') {
            $req_dir = $raw_body['dir'] ?? $_GET['dir'] ?? '';
            $start_dir = PathValidator::sanitizeDirectory($req_dir, $base_dir) ?: $base_dir;

            $search_params = [
                'q'          => $raw_body['q'] ?? $_GET['q'] ?? '',
                'name'       => $raw_body['name'] ?? $_GET['name'] ?? '',
                'words'      => $raw_body['words'] ?? $_GET['words'] ?? '',
                'category'   => $raw_body['category'] ?? $_GET['category'] ?? 'all',
                'timing'     => $raw_body['timing'] ?? $_GET['timing'] ?? 'all',
                'date_from'  => $raw_body['date_from'] ?? $_GET['date_from'] ?? '',
                'date_to'    => $raw_body['date_to'] ?? $_GET['date_to'] ?? '',
                'size_range' => $raw_body['size_range'] ?? $_GET['size_range'] ?? 'all',
                'gps_only'   => !empty($raw_body['gps_only']) || !empty($_GET['gps_only']),
                'recursive'  => !empty($raw_body['recursive']) || !empty($_GET['recursive'])
            ];

            $search_results = SearchEngine::search($start_dir, $base_dir, $search_params, $ignore_list, $media_types);

            return ['status' => 200, 'data' => [
                'success' => true,
                'count'   => count($search_results),
                'results' => $search_results
            ]];
        }

        return null;
    }
}
