<?php
/**
 * SimpleGallery 2026 - CLI Utility to Set / Change Admin Password Hash in config.php
 * Usage: php set_admin_password.php [new_password]
 */

require_once __DIR__ . '/config.php';

if (php_sapi_name() !== 'cli') {
    die("Error: This script must be executed from the command line (CLI) for security.\n");
}

$password = $argv[1] ?? null;

if (empty($password)) {
    echo "Usage: php set_admin_password.php <new_password>\n";
    echo "Example: php set_admin_password.php MySecretPass123!\n";
    exit(1);
}

if (strlen($password) < 8) {
    echo "Error: Password must be at least 8 characters long.\n";
    exit(1);
}

if (update_admin_password_in_config($password)) {
    echo "✅ Admin password hash updated successfully in config.php!\n";
} else {
    echo "❌ Error writing to config.php\n";
    exit(1);
}
