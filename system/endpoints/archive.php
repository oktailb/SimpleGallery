<?php
/**
 * SimpleGallery 2026 - Standalone Archive Download Controller
 */

$project_root = dirname(dirname(__DIR__));
require_once $project_root . '/system/boot/bootstrap.php';
require_once $project_root . '/system/kernel/functions.php';

use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\FS\ArchiveEngine;
use SimpleGallery\Kernel\FS\PermissionsManager;
use SimpleGallery\Kernel\Media\BinaryLocator;
use SimpleGallery\Kernel\Security\PathValidator;

ensure_session_started();

if (!PermissionsManager::hasPermission('can_download_archive', $real_base_dir)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    die("Accès refusé : Le téléchargement d'archives est désactivé.");
}

$format = strtolower($_GET['format'] ?? 'zip');
$req_dir = $_GET['dir'] ?? '';
$dir_target = PathValidator::sanitizeDirectory($req_dir, $real_base_dir);

if (!$dir_target || !is_dir($dir_target) || PathValidator::isPathIgnored($dir_target, $real_base_dir, $ignore_list)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    die("Dossier introuvable ou accès refusé.");
}

if (!AuthManager::isDirAccessible($dir_target, $real_base_dir)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    die("Accès refusé : Ce dossier est protégé ou privé.");
}

$available_formats = BinaryLocator::findArchiveBinaries();
if (!isset($available_formats[$format])) {
    $format = 'zip';
}

$tmp_dir = sys_get_temp_dir() . '/simplegallery_archives';
if (!is_dir($tmp_dir)) {
    @mkdir($tmp_dir, 0755, true);
}

$ext_map = [
    'zip' => '.zip',
    '7z'  => '.7z',
    'tar' => '.tar.gz'
];
$mime_map = [
    'zip' => 'application/zip',
    '7z'  => 'application/x-7z-compressed',
    'tar' => 'application/gzip'
];

$file_ext = $ext_map[$format] ?? '.zip';
$mime_type = $mime_map[$format] ?? 'application/octet-stream';

$folder_name = ($dir_target === $real_base_dir) ? 'gallery' : basename($dir_target);
$folder_name_safe = preg_replace('/[^\w\.\-\s]/u', '_', $folder_name);
$archive_name = $folder_name_safe . '_' . date('Ymd_His') . $file_ext;
$archive_path = $tmp_dir . '/' . $archive_name;

if (ArchiveEngine::createArchive($format, $dir_target, $archive_path, $real_base_dir, $ignore_list)) {
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
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    die("Erreur serveur : Impossible de générer l'archive au format " . htmlspecialchars($format));
}
