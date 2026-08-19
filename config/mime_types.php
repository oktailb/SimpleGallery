<?php
/**
 * SimpleGallery 2026 - MIME Types and File Association Configuration
 */

$media_types = [
    'image'     => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'],
    'video'     => ['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi'],
    'audio'     => ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
    'doc'       => ['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
    'archive'   => ['zip', 'tar', 'gz', 'bz2', 'rar', '7z'],
    'videowall' => ['vwall', 'videowall']
];

// App mappings by category
$app_category_associations = [
    'image'     => 'image-viewer',
    'video'     => 'video-player',
    'audio'     => 'audio-player',
    'doc'       => 'doc-viewer',
    'archive'   => 'archive-manager',
    'videowall' => 'video-player'
];
