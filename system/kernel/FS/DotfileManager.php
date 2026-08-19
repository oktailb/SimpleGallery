<?php
namespace SimpleGallery\Kernel\FS;

use SimpleGallery\Kernel\Security\PathValidator;
use SimpleGallery\Kernel\Security\SecurityManager;

/**
 * Kernel Dotfile Manager
 * Manages directory metadata files (.title, .desc, .comment, .bg, .theme, .private, .password)
 */
class DotfileManager {

    public static function getDirAccessInfo(string $dir_path, string $base_dir): array {
        $rel = PathValidator::getRelativePath($dir_path, $base_dir);

        $has_password = file_exists($dir_path . '/.password');
        $has_public   = file_exists($dir_path . '/.public');
        $has_private  = file_exists($dir_path . '/.private');

        $is_private = false;
        $is_protected = false;

        if ($has_password) {
            $is_protected = true;
        } elseif ($has_public) {
            $is_private = false;
            $is_protected = false;
        } elseif ($has_private) {
            $is_private = true;
        } elseif (basename($dir_path) === 'private') {
            $is_private = true;
        }

        $is_unlocked = SecurityManager::isAdminLoggedIn();
        if (!$is_unlocked && $rel !== '') {
            if (!empty($_SESSION['unlocked_dirs'][$rel])) {
                $is_unlocked = true;
            } else {
                $parts = explode('/', $rel);
                $accum = '';
                foreach ($parts as $p) {
                    $accum = ($accum === '') ? $p : $accum . '/' . $p;
                    if (!empty($_SESSION['unlocked_dirs'][$accum])) {
                        $is_unlocked = true;
                        break;
                    }
                }
            }
        }

        $access_mode = 'public';
        if ($is_private) {
            $access_mode = 'private';
        } elseif ($is_protected) {
            $access_mode = 'password';
        }

        return [
            'access_mode'  => $access_mode,
            'is_private'   => $is_private,
            'is_protected' => $is_protected,
            'is_unlocked'  => $is_unlocked
        ];
    }

    public static function isDirAccessible(string $dir_path, string $base_dir): bool {
        if (SecurityManager::isAdminLoggedIn()) {
            return true;
        }

        $rel = PathValidator::getRelativePath($dir_path, $base_dir);
        if ($rel === '') {
            return true;
        }

        $parts = explode('/', $rel);
        $accumulated = '';
        foreach ($parts as $part) {
            $accumulated = ($accumulated === '') ? $part : $accumulated . '/' . $part;
            $current_check_dir = $base_dir . '/' . $accumulated;

            $access_info = self::getDirAccessInfo($current_check_dir, $base_dir);

            if ($access_info['is_private']) {
                return false;
            }

            if ($access_info['is_protected'] && !$access_info['is_unlocked']) {
                return false;
            }
        }

        return true;
    }

    public static function loadComments(string $dir_path): array {
        $comments = [];
        $comment_file = $dir_path . '/.comment';
        if (file_exists($comment_file) && is_readable($comment_file)) {
            $lines = file($comment_file, FILE_IGNORE_NEW_LINES);
            if ($lines !== false) {
                for ($i = 0; $i < count($lines); $i++) {
                    $line = trim($lines[$i]);
                    if ($line === '') continue;

                    if (strpos($line, '=') !== false) {
                        list($fname, $cmt) = explode('=', $line, 2);
                        $comments[trim($fname)] = trim($cmt);
                    } elseif (strpos($line, ':') !== false && !file_exists($dir_path . '/' . $line)) {
                        list($fname, $cmt) = explode(':', $line, 2);
                        $comments[trim($fname)] = trim($cmt);
                    } else {
                        $fname = $line;
                        $cmt = isset($lines[$i + 1]) ? trim($lines[$i + 1]) : '';
                        $comments[$fname] = $cmt;
                        $i++;
                    }
                }
            }
        }
        return $comments;
    }

    public static function saveComments(string $dir_path, array $comments): bool {
        $comment_file = $dir_path . '/.comment';
        $clean_comments = [];
        foreach ($comments as $fname => $cmt) {
            $cmt_clean = trim(str_replace(["\r", "\n"], [' ', ' '], $cmt));
            if ($cmt_clean !== '') {
                $clean_comments[] = $fname . '=' . $cmt_clean;
            }
        }

        if (empty($clean_comments)) {
            if (file_exists($comment_file)) {
                return @unlink($comment_file);
            }
            return true;
        }

        return (@file_put_contents($comment_file, implode("\n", $clean_comments) . "\n", LOCK_EX) !== false);
    }

    public static function loadFolderOverrides(string $dir_path, string $base_dir, array $theme_colors = []): array {
        $access_info = self::getDirAccessInfo($dir_path, $base_dir);

        $overrides = [
            'title'        => null,
            'description'  => null,
            'background'   => null,
            'theme'        => null,
            'access_mode'  => $access_info['access_mode'],
            'is_private'   => $access_info['is_private'],
            'is_protected' => $access_info['is_protected'],
            'is_unlocked'  => $access_info['is_unlocked']
        ];

        $title_file = $dir_path . '/.title';
        if (file_exists($title_file) && is_readable($title_file)) {
            $overrides['title'] = trim((string)file_get_contents($title_file));
        }

        $desc_file = file_exists($dir_path . '/.desc') ? $dir_path . '/.desc' : (file_exists($dir_path . '/.description') ? $dir_path . '/.description' : null);
        if ($desc_file && is_readable($desc_file)) {
            $overrides['description'] = trim((string)file_get_contents($desc_file));
        }

        $bg_file = $dir_path . '/.bg';
        if (file_exists($bg_file) && is_readable($bg_file)) {
            $bg_val = trim((string)file_get_contents($bg_file));
            if ($bg_val !== '') {
                $overrides['raw_background'] = $bg_val;
                $possible_image = $dir_path . '/' . $bg_val;
                if (file_exists($possible_image) && is_file($possible_image)) {
                    $rel_bg = PathValidator::getRelativePath($possible_image, $base_dir);
                    $overrides['background'] = rawurlencode($rel_bg);
                } else {
                    $overrides['background'] = $bg_val;
                }
            }
        }

        $theme_file = $dir_path . '/.theme';
        if (file_exists($theme_file) && is_readable($theme_file)) {
            $theme_val = trim((string)file_get_contents($theme_file));
            if ($theme_val !== '') {
                if (strpos($theme_val, '=') !== false) {
                    $custom_theme = [];
                    $lines = explode("\n", $theme_val);
                    foreach ($lines as $line) {
                        if (strpos($line, '=') !== false) {
                            list($k, $v) = explode('=', trim($line), 2);
                            $custom_theme[trim($k)] = trim($v);
                        }
                    }
                    $overrides['theme'] = $custom_theme;
                    $overrides['theme_name'] = 'custom';
                } else {
                    $overrides['theme_name'] = $theme_val;
                    if (!empty($theme_colors[$theme_val])) {
                        $overrides['theme'] = $theme_colors[$theme_val];
                    } else {
                        $overrides['theme'] = $theme_val;
                    }
                }
            }
        }

        return $overrides;
    }
}
