<?php
/**
 * SimpleGallery 2026 Configuration
 */

// Title of the gallery
$gallery_title = "SimpleGallery";

// Gallery root folder path (defaults to current folder)
$real_base_dir = realpath(__DIR__);

// Thumbnail storage directory relative to current folder or path
$thumbnail_dir = '.thumbnails';

// Thumbnail dimensions & quality
$thumb_width = 360;
$thumb_height = 360;
$thumb_quality = 85;

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

// Admin Authentication Configuration
// Password hash generated using PHP password_hash().
// Set to empty string '' to disable admin authentication until configured.
// To change/set hash via CLI: `php set_admin_password.php <your_password>`
$admin_password_hash = '$2y$12$p0xr31miEkE7scX2PUjCnuXofgiy1hW3uvBKPg014.EshI/q0fo/e';

/**
 * Checks whether current web session is authenticated as admin
 */
function is_admin_logged_in(): bool {
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }
    return !empty($_SESSION['is_admin']);
}

/**
 * Dynamically updates $admin_password_hash in config.php
 */
function update_admin_password_in_config(string $new_password): bool {
    $hash = password_hash($new_password, PASSWORD_DEFAULT);
    $config_file = __DIR__ . '/config.php';

    if (!file_exists($config_file) || !is_writable($config_file)) {
        return false;
    }

    $config_content = file_get_contents($config_file);
    $pattern = '/\$admin_password_hash\s*=\s*[\'"][^\'"]*[\'"];/';
    $replacement = "\$admin_password_hash = '" . addcslashes($hash, "'\\") . "';";

    if (preg_match($pattern, $config_content)) {
        $safe_replacement = str_replace('$', '\$', $replacement);
        $new_content = preg_replace($pattern, $safe_replacement, $config_content, 1);
    } else {
        $new_content = rtrim($config_content) . "\n\n" . $replacement . "\n";
    }

    return file_put_contents($config_file, $new_content) !== false;
}

// Files and folders to ignore in indexing
$ignore_list = ['.', '..', '.git', '.thumbnails', '.comment', 'index.php', 'api.php', 'thumb.php', 'config.php', 'css', 'js', 'LICENSE', 'README.md', 'set_admin_password.php'];
