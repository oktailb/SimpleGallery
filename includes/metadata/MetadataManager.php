<?php
/**
 * SimpleGallery 2026 - Central Metadata Manager & Coordinator
 * Orchestrates unified metadata extraction across all file formats and categories.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

require_once __DIR__ . '/ImageMetadata.php';
require_once __DIR__ . '/VideoMetadata.php';
require_once __DIR__ . '/AudioMetadata.php';
require_once __DIR__ . '/DocumentMetadata.php';
require_once __DIR__ . '/ArchiveMetadata.php';

/**
 * Returns unified, normalized metadata payload for any file in the gallery
 */
function get_file_unified_metadata(string $file_path, string $rel_path, string $category, string $ext): array {
    if (!is_file($file_path) || !is_readable($file_path)) {
        return [];
    }

    $stat = @stat($file_path);
    $size = $stat['size'] ?? @filesize($file_path) ?? 0;
    $mtime = $stat['mtime'] ?? @filemtime($file_path) ?? time();

    // 1. General properties common to all file types
    $mime = function_exists('mime_content_type') ? @mime_content_type($file_path) : null;
    $general = [
        'filename'           => basename($file_path),
        'path'               => $rel_path,
        'filesize'           => (int)$size,
        'filesize_formatted' => function_exists('format_bytes') ? format_bytes((int)$size) : $size . ' B',
        'mtime'              => (int)$mtime,
        'mtime_formatted'    => date('Y-m-d H:i:s', $mtime),
        'category'           => $category,
        'extension'          => strtolower($ext),
        'mime_type'          => $mime
    ];

    $specific = [];
    $exif = null;

    // 2. Specialized extractors based on category
    switch ($category) {
        case 'image':
            $img = extract_image_metadata($file_path, $ext);
            if ($img) {
                $exif = $img['exif'] ?? null;
                unset($img['exif']);
                $specific['image'] = $img;
            }
            break;

        case 'video':
            $vid = extract_video_metadata($file_path, $ext);
            if ($vid) {
                $specific['video'] = $vid;
            }
            break;

        case 'audio':
            $aud = extract_audio_metadata($file_path, $ext);
            if ($aud) {
                $specific['audio'] = $aud;
            }
            break;

        case 'doc':
            $doc = extract_document_metadata($file_path, $ext);
            if ($doc) {
                $specific['doc'] = $doc;
            }
            break;

        case 'archive':
            $arch = extract_archive_metadata($file_path, $ext);
            if ($arch) {
                $specific['archive'] = $arch;
            }
            break;
    }

    // Direct EXIF fallback if not already captured
    if ($exif === null && function_exists('extract_exif_data')) {
        $exif = extract_exif_data($file_path);
    }

    return [
        'general'  => $general,
        'specific' => $specific,
        'exif'     => $exif
    ];
}
