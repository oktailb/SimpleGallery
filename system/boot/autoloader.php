<?php
/**
 * SimpleGallery 2026 - System Kernel Autoloader
 */

spl_autoload_register(function ($class) {
    // Map SimpleGallery\Kernel\* or SimpleGallery\* to system/kernel/
    $prefix = 'SimpleGallery\\Kernel\\';
    $base_dir = dirname(__DIR__) . '/kernel/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) === 0) {
        $relative_class = substr($class, $len);
        $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }

    // Direct kernel class lookup fallback
    $direct_file = $base_dir . str_replace('\\', '/', $class) . '.php';
    if (file_exists($direct_file)) {
        require_once $direct_file;
        return;
    }
});
