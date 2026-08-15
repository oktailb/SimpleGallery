<?php
/**
 * SimpleGallery 2026 Configuration
 */

require_once __DIR__ . '/functions.php';

// Title of the gallery
$gallery_title = "SimpleGallery";

// Gallery root folder path (defaults to current folder)
$real_base_dir = realpath(__DIR__) ?: __DIR__;
$real_base_dir = str_replace('\\', '/', $real_base_dir);

// Thumbnail storage directory relative to current folder or path
$thumbnail_dir = '.thumbnails';

// Thumbnail dimensions & quality
$thumb_width = 360;
$thumb_height = 360;
$thumb_quality = 85;

// Allow direct individual item downloads (true by default, set to false to disable direct item downloads)
$allow_direct_download = true;

/**
 * Theme & Color Configuration
 * Preset choices: 'polaroid-classic', 'dark-glass', 'light-minimal', 'cyberpunk', 'custom'
 */
$theme_preset = 'polaroid-classic';

$theme_colors = [
    // Polaroid Classic Theme
    'polaroid-classic' => [
        'bg_main'         => '#0f141c',
        'polaroid_bg'     => '#fcfaf5',
        'polaroid_text'   => '#1e293b',
        'polaroid_sub'    => '#64748b',
        'accent'          => '#6366f1',
        'card_bg'         => 'rgba(255, 255, 255, 0.05)',
        'text_main'       => '#f8fafc',
        'text_muted'      => '#94a3b8'
    ],
    // Dark Glassmorphism Theme
    'dark-glass' => [
        'bg_main'         => '#090d16',
        'polaroid_bg'     => '#182032',
        'polaroid_text'   => '#f1f5f9',
        'polaroid_sub'    => '#94a3b8',
        'accent'          => '#8b5cf6',
        'card_bg'         => 'rgba(255, 255, 255, 0.04)',
        'text_main'       => '#f8fafc',
        'text_muted'      => '#94a3b8'
    ],
    // Light Minimal Theme
    'light-minimal' => [
        'bg_main'         => '#f1f5f9',
        'polaroid_bg'     => '#ffffff',
        'polaroid_text'   => '#0f172a',
        'polaroid_sub'    => '#64748b',
        'accent'          => '#2563eb',
        'card_bg'         => '#ffffff',
        'text_main'       => '#0f172a',
        'text_muted'      => '#475569'
    ],
    // Cyberpunk Theme
    'cyberpunk' => [
        'bg_main'         => '#0d0221',
        'polaroid_bg'     => '#1d1135',
        'polaroid_text'   => '#00f5d4',
        'polaroid_sub'    => '#7b2cbf',
        'accent'          => '#ff007f',
        'card_bg'         => 'rgba(255, 0, 127, 0.1)',
        'text_main'       => '#00f5d4',
        'text_muted'      => '#b5179e'
    ]
];

// Active theme palette selection
$active_theme = $theme_colors[$theme_preset] ?? $theme_colors['polaroid-classic'];

// Supported file extensions categorized
$media_types = [
    'image'   => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'],
    'video'   => ['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi'],
    'audio'   => ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
    'doc'     => ['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
    'archive' => ['zip', 'tar', 'gz', 'bz2', 'rar', '7z']
];

// Admin Authentication Configuration (loaded from .admin_password_hash file or legacy string)
$admin_password_hash = get_admin_password_hash('');

/**
 * Dynamically updates admin password hash in .admin_password_hash file
 */
function update_admin_password_in_config(string $new_password): bool {
    return update_admin_password_hash($new_password);
}

// Files and folders to ignore in indexing
$ignore_list = ['.', '..', '.git', '.thumbnails', '.comment', '.admin_password_hash', 'index.php', 'api.php', 'thumb.php', 'config.php', 'functions.php', 'tests', 'css', 'js', 'LICENSE', 'README.md', 'set_admin_password.php', '.htaccess', '.user.ini', 'start.sh'];



