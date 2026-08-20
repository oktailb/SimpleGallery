<?php
/**
 * SimpleGallery 2026 - Security & Access Policies Configuration
 */

// Rate limiting parameters (IP based)
$rate_limits = [
    'login' => [
        'max_attempts'  => 5,
        'decay_seconds' => 900 // 15 minutes
    ],
    'upload' => [
        'max_attempts'  => 60,
        'decay_seconds' => 60
    ],
    'search' => [
        'max_attempts'  => 120,
        'decay_seconds' => 60
    ]
];

// Dangerous file extensions strictly forbidden for upload / execution
$forbidden_upload_extensions = [
    'php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc',
    'js', 'css', 'html', 'htm', 'htaccess', 'htpasswd', 'sh', 'bat',
    'cmd', 'exe', 'dll', 'py', 'pl', 'cgi', 'hash', 'ini', 'sql', 'bak'
];

// Default permissions granted to guests (when not admin)
$default_guest_permissions = [
    'can_upload'           => false,
    'can_delete'           => false,
    'can_move'             => false,
    'can_comment'          => false,
    'can_create_folder'    => false,
    'can_download_archive' => false,
    'can_download_item'    => false
];
