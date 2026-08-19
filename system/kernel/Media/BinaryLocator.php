<?php
namespace SimpleGallery\Kernel\Media;

/**
 * Kernel Binary Locator
 * Discovers system binaries (ffmpeg, ffprobe, 7z, tar, zip, exiftool) across Linux/macOS/Windows.
 */
class BinaryLocator {

    public static function find(string $binary_name): ?string {
        static $bin_cache = [];
        if (array_key_exists($binary_name, $bin_cache)) {
            return $bin_cache[$binary_name];
        }

        $is_windows = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN');
        $extensions = $is_windows ? ['.exe', '.bat', '.cmd', ''] : [''];

        $check_which = $is_windows ? 'where' : 'which';
        foreach ($extensions as $ext) {
            $cmd = $check_which . ' ' . escapeshellarg($binary_name . $ext) . ' 2>&1';
            $output = @shell_exec($cmd);
            if ($output) {
                $lines = explode("\n", trim($output));
                foreach ($lines as $line) {
                    $candidate = trim($line);
                    if (!empty($candidate) && file_exists($candidate) && !is_dir($candidate)) {
                        $bin_cache[$binary_name] = $candidate;
                        return $candidate;
                    }
                }
            }
        }

        // Common default directories
        $common_paths = $is_windows ? [
            'C:\\ffmpeg\\bin\\' . $binary_name . '.exe',
            'C:\\Program Files\\7-Zip\\' . $binary_name . '.exe',
            'C:\\Program Files (x86)\\7-Zip\\' . $binary_name . '.exe'
        ] : [
            '/usr/bin/' . $binary_name,
            '/usr/local/bin/' . $binary_name,
            '/opt/homebrew/bin/' . $binary_name,
            '/bin/' . $binary_name
        ];

        foreach ($common_paths as $p) {
            if (file_exists($p) && is_executable($p)) {
                $bin_cache[$binary_name] = $p;
                return $p;
            }
        }

        $bin_cache[$binary_name] = null;
        return null;
    }
}
