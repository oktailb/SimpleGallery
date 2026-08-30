<?php
/**
 * SimpleGallery 2026 - Search Engine (Recursive multi-filter gallery search)
 */

namespace SimpleGallery\Kernel\Search;

use SimpleGallery\Kernel\FS\DotfileManager;
use SimpleGallery\Kernel\Media\ExifParser;
use SimpleGallery\Kernel\Security\PathValidator;
use SimpleGallery\Kernel\Security\SecurityManager;

class SearchEngine {
    /**
     * Perform recursive multi-criteria search in gallery directory
     */
    public static function search(string $start_dir, string $base_dir, array $params, array $ignore_list, array $media_types): array {
        $results = [];
        $query = strtolower(trim($params['q'] ?? ''));
        $name_filter = strtolower(trim($params['name'] ?? ''));
        $words_filter = strtolower(trim($params['words'] ?? ''));
        $cat_filter = strtolower(trim($params['category'] ?? 'all'));
        $timing_filter = strtolower(trim($params['timing'] ?? 'all'));
        $date_from_str = trim($params['date_from'] ?? '');
        $date_to_str = trim($params['date_to'] ?? '');
        $size_range = strtolower(trim($params['size_range'] ?? 'all'));
        $gps_only = !empty($params['gps_only']);
        $recursive = !empty($params['recursive']);

        $now = time();
        $min_time = 0;
        $max_time = 0;

        if ($timing_filter === 'today') {
            $min_time = strtotime('today 00:00:00');
        } elseif ($timing_filter === 'week') {
            $min_time = $now - (7 * 86400);
        } elseif ($timing_filter === 'month') {
            $min_time = $now - (30 * 86400);
        } elseif ($timing_filter === 'year') {
            $min_time = $now - (365 * 86400);
        } elseif ($timing_filter === 'custom') {
            if ($date_from_str !== '') {
                $ts_from = strtotime($date_from_str . ' 00:00:00');
                if ($ts_from !== false) $min_time = $ts_from;
            }
            if ($date_to_str !== '') {
                $ts_to = strtotime($date_to_str . ' 23:59:59');
                if ($ts_to !== false) $max_time = $ts_to;
            }
        }

        $min_bytes = 0;
        $max_bytes = 0;
        if ($size_range === 'small') {
            $max_bytes = 1024 * 1024; // < 1MB
        } elseif ($size_range === 'medium') {
            $min_bytes = 1024 * 1024;
            $max_bytes = 10 * 1024 * 1024; // 1-10MB
        } elseif ($size_range === 'large') {
            $min_bytes = 10 * 1024 * 1024;
            $max_bytes = 50 * 1024 * 1024; // 10-50MB
        } elseif ($size_range === 'xlarge') {
            $min_bytes = 50 * 1024 * 1024; // > 50MB
        }

        $forbidden_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc', 'js', 'css', 'html', 'htm', 'htaccess', 'htpasswd', 'sh', 'bat', 'cmd', 'exe', 'dll', 'py', 'pl', 'cgi', 'hash', 'ini', 'sql', 'bak', 'json'];

        $scan_directory = function(string $dir) use (&$scan_directory, &$results, $query, $name_filter, $words_filter, $cat_filter, $min_time, $max_time, $min_bytes, $max_bytes, $gps_only, $recursive, $base_dir, $ignore_list, $media_types, $forbidden_exts) {
            if (!is_dir($dir) || PathValidator::isPathIgnored($dir, $base_dir, $ignore_list)) {
                return;
            }

            $items = @scandir($dir);
            if ($items === false) return;

            $comments = DotfileManager::loadDirComments($dir);

            foreach ($items as $item) {
                if ($item === '.' || $item === '..' || $item[0] === '.' || in_array($item, $ignore_list, true)) {
                    continue;
                }

                $full_path = $dir . '/' . $item;
                $rel_path = PathValidator::getRelativePath($full_path, $base_dir);

                if (is_dir($full_path)) {
                    if ($recursive) {
                        $scan_directory($full_path);
                    }
                } elseif (is_file($full_path)) {
                    $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                    if ($ext === '' || in_array($ext, $forbidden_exts, true)) continue;

                    $category = 'other';
                    foreach ($media_types as $c => $exts) {
                        if (in_array($ext, $exts, true)) {
                            $category = $c;
                            break;
                        }
                    }

                    if ($cat_filter !== 'all' && $category !== $cat_filter) {
                        continue;
                    }

                    $size = filesize($full_path);
                    if ($min_bytes > 0 && $size < $min_bytes) continue;
                    if ($max_bytes > 0 && $size > $max_bytes) continue;

                    $comment = $comments[$item] ?? '';

                    // Matching logic
                    if ($name_filter !== '' && strpos(strtolower($item), $name_filter) === false) {
                        continue;
                    }

                    if ($words_filter !== '') {
                        $match_words = ($comment !== '' && strpos(strtolower($comment), $words_filter) !== false);
                        if (!$match_words) continue;
                    }

                    if ($query !== '') {
                        $match_name = (strpos(strtolower($item), $query) !== false);
                        $match_comment = ($comment !== '' && strpos(strtolower($comment), $query) !== false);
                        if (!$match_name && !$match_comment) {
                            continue;
                        }
                    }

                    $exif = ($category === 'image') ? ExifParser::extractExifData($full_path) : null;
                    if ($gps_only) {
                        if (empty($exif['gps'])) {
                            continue;
                        }
                    }

                    $mtime = filemtime($full_path);
                    $effective_mtime = ($exif && !empty($exif['date_ts'])) ? $exif['date_ts'] : $mtime;

                    if ($min_time > 0 && $effective_mtime < $min_time) continue;
                    if ($max_time > 0 && $effective_mtime > $max_time) continue;

                    $results[] = [
                        'name'           => $item,
                        'path'           => $rel_path,
                        'extension'      => $ext,
                        'category'       => $category,
                        'size'           => $size,
                        'size_formatted' => ExifParser::formatBytes($size),
                        'mtime'          => $mtime,
                        'effective_mtime'=> $effective_mtime,
                        'exif'           => $exif,
                        'thumb_url'      => 'system/endpoints/thumb.php?file=' . rawurlencode($rel_path),
                        'file_url'       => 'system/endpoints/thumb.php?file=' . rawurlencode($rel_path) . '&raw=1',
                        'comment'        => $comment
                    ];
                }
            }
        };

        $scan_directory($start_dir);
        return $results;
    }
}
