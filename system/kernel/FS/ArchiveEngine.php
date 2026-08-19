<?php
namespace SimpleGallery\Kernel\FS;

use SimpleGallery\Kernel\Security\PathValidator;
use SimpleGallery\Kernel\Media\BinaryLocator;
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

                $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                if (in_array($ext, ['php', 'htaccess', 'ini', 'hash'], true)) continue;

                $localPath = PathValidator::getRelativePath($filePath, $real_target);
                $zip->addFile($filePath, $localPath);
            }

            return $zip->close();
        }

        if ($format === 'zip') {
            $zip_cli = BinaryLocator::find('zip');
            if ($zip_cli) {
                $cmd = sprintf(
                    'cd %s && %s -r %s . -x "*.php" "*.htaccess" "*.ini" ".*" 2>&1',
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
                    'cd %s && %s a -t7z %s . -xr!*.php -xr!.* 2>&1',
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
                    'cd %s && %s -czf %s --exclude="*.php" --exclude=".*" . 2>&1',
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
