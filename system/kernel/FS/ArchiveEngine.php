<?php
namespace SimpleGallery\Kernel\FS;

use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\Media\BinaryLocator;
use SimpleGallery\Kernel\Security\PathValidator;
use RecursiveIteratorIterator;
use RecursiveDirectoryIterator;
use ZipArchive;

/**
 * Kernel Archive Engine (ZIP, 7Z, TAR)
 */
class ArchiveEngine {

    public static function createArchive(string $format, string $target_dir, string $output_file, string $base_dir, array $ignore_list = []): bool {
        if (!is_dir($target_dir)) return false;

        $real_target = realpath($target_dir);
        if (!$real_target) return false;

        $forbidden_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc', 'htaccess', 'htpasswd', 'ini', 'sh', 'bash', 'bat', 'cmd', 'exe', 'cgi', 'pl', 'py', 'hash', 'sql', 'bak', 'user.ini'];

        if ($format === 'zip' && (extension_loaded('zip') || class_exists('ZipArchive'))) {
            $zip = new ZipArchive();
            if ($zip->open($output_file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                return false;
            }

            $files = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($real_target, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::LEAVES_ONLY
            );

            foreach ($files as $file) {
                if ($file->isDir()) continue;
                $filePath = str_replace('\\', '/', $file->getRealPath());

                // Exclude dotfiles
                $filename = basename($filePath);
                if ($filename[0] === '.') continue;

                // Exclude paths containing dot directories
                $localPath = PathValidator::getRelativePath($filePath, $real_target);
                $parts = explode('/', $localPath);
                $has_dot_part = false;
                foreach ($parts as $p) {
                    if ($p !== '' && $p[0] === '.') {
                        $has_dot_part = true;
                        break;
                    }
                }
                if ($has_dot_part) continue;

                // Exclude forbidden security extensions
                $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                if ($ext === '' || in_array($ext, $forbidden_exts, true)) continue;

                // Exclude private / protected subfolders if not accessible
                $file_dir = dirname($filePath);
                if (!AuthManager::isDirAccessible($file_dir, $base_dir)) {
                    continue;
                }

                $zip->addFile($filePath, $localPath);
            }

            return $zip->close();
        }

        if ($format === 'zip') {
            $zip_cli = BinaryLocator::find('zip');
            if ($zip_cli) {
                $cmd = sprintf(
                    'cd %s && %s -r %s . -x "*.php*" "*.htaccess" "*.ini" ".*" "*/.*" 2>&1',
                    escapeshellarg($real_target),
                    escapeshellarg($zip_cli),
                    escapeshellarg($output_file)
                );
                @exec($cmd);
                return (file_exists($output_file) && filesize($output_file) > 0);
            }
        }

        if ($format === '7z') {
            $sz_cli = BinaryLocator::find('7z') ?: BinaryLocator::find('7za');
            if ($sz_cli) {
                $cmd = sprintf(
                    'cd %s && %s a -t7z %s . -xr!*.php* -xr!.* -xr!*/.* 2>&1',
                    escapeshellarg($real_target),
                    escapeshellarg($sz_cli),
                    escapeshellarg($output_file)
                );
                @exec($cmd);
                return (file_exists($output_file) && filesize($output_file) > 0);
            }
        }

        if ($format === 'tar') {
            $tar_cli = BinaryLocator::find('tar');
            if ($tar_cli) {
                $cmd = sprintf(
                    'cd %s && %s -czf %s --exclude="*.php*" --exclude=".*" --exclude="*/.*" . 2>&1',
                    escapeshellarg($real_target),
                    escapeshellarg($tar_cli),
                    escapeshellarg($output_file)
                );
                @exec($cmd);
                return (file_exists($output_file) && filesize($output_file) > 0);
            }
        }

        return false;
    }
}
