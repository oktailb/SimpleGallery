<?php
/**
 * SimpleGallery 2026 Configuration & Bootstrap Gateway
 */

// 1. Load system bootstrap (BIOS, Kernel autoloader, storage mounting, security)
require_once __DIR__ . '/system/boot/bootstrap.php';

// 2. Load helper functions
require_once __DIR__ . '/functions.php';

// 3. Admin Authentication Configuration
$admin_password_hash = get_admin_password_hash('');

/**
 * Dynamically updates admin password hash in .admin_password_hash file
 */
function update_admin_password_in_config(string $new_password): bool {
    return update_admin_password_hash($new_password);
}
