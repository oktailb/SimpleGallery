<?php
namespace SimpleGallery\Kernel;

/**
 * Kernel Application & Plugin Discovery Engine
 * Scans `apps/` directory and auto-mounts all applications with their manifests, JS, CSS, and HTML/PHP UI templates.
 */
class PluginDiscovery {

    /**
     * Discovers all modular apps in apps/<app_name>/
     */
    public static function getDiscoveredApps(string $project_root): array {
        $apps_dir = $project_root . '/apps';
        $apps = [];
        if (!is_dir($apps_dir)) {
            return $apps;
        }

        $folders = @scandir($apps_dir) ?: [];
        $app_dirs = [];

        foreach ($folders as $folder) {
            if ($folder[0] === '.') continue;
            $app_path = $apps_dir . '/' . $folder;
            if (!is_dir($app_path)) continue;

            if (file_exists($app_path . '/manifest.json') || file_exists($app_path . '/app.js') || file_exists($app_path . '/' . $folder . '.js')) {
                $app_dirs[$folder] = $app_path;
            } else {
                // Check 1 level of subdirectories (e.g., apps/games/*)
                $sub_folders = @scandir($app_path) ?: [];
                foreach ($sub_folders as $sub) {
                    if ($sub[0] === '.') continue;
                    $sub_path = $app_path . '/' . $sub;
                    if (is_dir($sub_path) && (file_exists($sub_path . '/manifest.json') || file_exists($sub_path . '/app.js') || file_exists($sub_path . '/' . $sub . '.js'))) {
                        $app_dirs[$folder . '/' . $sub] = $sub_path;
                    }
                }
            }
        }

        foreach ($app_dirs as $rel_key => $app_path) {
            $folder = basename($app_path);
            $manifest_file = $app_path . '/manifest.json';
            $manifest = [];
            if (file_exists($manifest_file)) {
                $content = @file_get_contents($manifest_file);
                $manifest = @json_decode($content, true) ?: [];
            }

            // Find JS entry point
            $js_entry = null;
            if (!empty($manifest['entry']['js']) && file_exists($app_path . '/' . $manifest['entry']['js'])) {
                $js_entry = 'apps/' . $rel_key . '/' . $manifest['entry']['js'];
            } elseif (file_exists($app_path . '/app.js')) {
                $js_entry = 'apps/' . $rel_key . '/app.js';
            } elseif (file_exists($app_path . '/' . $folder . '.js')) {
                $js_entry = 'apps/' . $rel_key . '/' . $folder . '.js';
            }

            // Find CSS entry point
            $css_entry = null;
            if (!empty($manifest['entry']['css']) && file_exists($app_path . '/' . $manifest['entry']['css'])) {
                $css_entry = 'apps/' . $rel_key . '/' . $manifest['entry']['css'];
            } elseif (!empty($manifest['styles'][0]) && file_exists($app_path . '/' . $manifest['styles'][0])) {
                $css_entry = 'apps/' . $rel_key . '/' . $manifest['styles'][0];
            } elseif (file_exists($app_path . '/app.css')) {
                $css_entry = 'apps/' . $rel_key . '/app.css';
            } elseif (file_exists($app_path . '/style.css')) {
                $css_entry = 'apps/' . $rel_key . '/style.css';
            } elseif (file_exists($app_path . '/' . $folder . '.css')) {
                $css_entry = 'apps/' . $rel_key . '/' . $folder . '.css';
            }

            // Find Template / HTML UI entry point
            $template_entry = null;
            if (!empty($manifest['entry']['template']) && file_exists($app_path . '/' . $manifest['entry']['template'])) {
                $template_entry = 'apps/' . $rel_key . '/' . $manifest['entry']['template'];
            } elseif (file_exists($app_path . '/template.php')) {
                $template_entry = 'apps/' . $rel_key . '/template.php';
            } elseif (file_exists($app_path . '/template.html')) {
                $template_entry = 'apps/' . $rel_key . '/template.html';
            }

            $app_id = $manifest['id'] ?? $folder;

            // Category resolution:
            // 1. From manifest.json if present and non-empty
            // 2. Else if inside a subfolder (e.g. apps/games/*), use the subfolder name
            // 3. Otherwise empty string (root)
            $cat = !empty($manifest['category']) ? trim((string)$manifest['category']) : '';
            if ($cat === '' && strpos($rel_key, '/') !== false) {
                $cat = dirname($rel_key);
            }

            $apps[$app_id] = [
                'id'             => $app_id,
                'name'           => $manifest['name'] ?? ucfirst($folder),
                'version'        => $manifest['version'] ?? '1.0.0',
                'icon'           => $manifest['icon'] ?? '📱',
                'category'       => $cat,
                'parent_folder'  => (strpos($rel_key, '/') !== false ? dirname($rel_key) : ''),
                'manifest'       => $manifest,
                'locales'        => $manifest['locales'] ?? [],
                'js_entry'       => $js_entry,
                'css_entry'      => $css_entry,
                'template_entry' => $template_entry
            ];
        }

        return $apps;
    }

    /**
     * Aggregates all app-embedded translations for a given language code
     */
    public static function getAppTranslations(string $project_root, string $code): array {
        $apps_dir = $project_root . '/apps';
        $translations = [];
        if (!is_dir($apps_dir)) {
            return $translations;
        }

        $code = strtolower($code);
        $folders = @scandir($apps_dir) ?: [];
        $app_dirs = [];

        foreach ($folders as $folder) {
            if ($folder[0] === '.') continue;
            $app_path = $apps_dir . '/' . $folder;
            if (!is_dir($app_path)) continue;

            if (file_exists($app_path . '/manifest.json') || file_exists($app_path . '/app.js') || file_exists($app_path . '/' . $folder . '.js')) {
                $app_dirs[$folder] = $app_path;
            } else {
                $sub_folders = @scandir($app_path) ?: [];
                foreach ($sub_folders as $sub) {
                    if ($sub[0] === '.') continue;
                    $sub_path = $app_path . '/' . $sub;
                    if (is_dir($sub_path)) {
                        $app_dirs[$folder . '/' . $sub] = $sub_path;
                    }
                }
            }
        }

        foreach ($app_dirs as $rel_key => $app_path) {
            $folder = basename($app_path);
            $app_id = $folder;

            // 1. Check apps/<app>/locales/<code>.json
            $locale_file = $app_path . '/locales/' . $code . '.json';
            if (file_exists($locale_file)) {
                $content = @file_get_contents($locale_file);
                $json = @json_decode($content, true) ?: [];
                $t = $json['translations'] ?? $json;
                if (is_array($t)) {
                    self::flattenTranslations($t, '', $translations);
                }
            }

            // 2. Check apps/<app>/manifest.json -> locales[code]
            $manifest_file = $app_path . '/manifest.json';
            if (file_exists($manifest_file)) {
                $content = @file_get_contents($manifest_file);
                $manifest = @json_decode($content, true) ?: [];
                $app_id = $manifest['id'] ?? $folder;
                if (!empty($manifest['locales'][$code]) && is_array($manifest['locales'][$code])) {
                    $loc = $manifest['locales'][$code];
                    if (!empty($loc['title'])) {
                        $translations["apps.{$app_id}.title"] = $loc['title'];
                    }
                    if (!empty($loc['description'])) {
                        $translations["apps.{$app_id}.description"] = $loc['description'];
                    }
                    if (!empty($loc['translations']) && is_array($loc['translations'])) {
                        foreach ($loc['translations'] as $k => $v) {
                            $translations[$k] = $v;
                        }
                    }
                }
                if (empty($translations["apps.{$app_id}.title"]) && !empty($manifest['name'])) {
                    $translations["apps.{$app_id}.title"] = $manifest['name'];
                }
            }
        }

        return $translations;
    }

    /**
     * Discovers all modular Explorer view plugins in apps/explorer/views/<view_id>/
     */
    public static function getDiscoveredViews(string $project_root): array {
        $views_dir = $project_root . '/apps/explorer/views';
        $views = [];
        if (!is_dir($views_dir)) {
            return $views;
        }

        $folders = @scandir($views_dir) ?: [];
        foreach ($folders as $folder) {
            if ($folder[0] === '.') continue;
            $view_path = $views_dir . '/' . $folder;
            if (!is_dir($view_path)) continue;

            $manifest_file = $view_path . '/manifest.json';
            $manifest = [];
            if (file_exists($manifest_file)) {
                $content = @file_get_contents($manifest_file);
                $manifest = @json_decode($content, true) ?: [];
            }

            // Find JS entry point
            $js_entry = null;
            if (!empty($manifest['entry']['js']) && file_exists($view_path . '/' . $manifest['entry']['js'])) {
                $js_entry = 'apps/explorer/views/' . $folder . '/' . $manifest['entry']['js'];
            } elseif (file_exists($view_path . '/view.js')) {
                $js_entry = 'apps/explorer/views/' . $folder . '/view.js';
            } elseif (file_exists($view_path . '/' . $folder . '.js')) {
                $js_entry = 'apps/explorer/views/' . $folder . '/' . $folder . '.js';
            }

            // Find CSS entry point
            $css_entry = null;
            if (!empty($manifest['entry']['css']) && file_exists($view_path . '/' . $manifest['entry']['css'])) {
                $css_entry = 'apps/explorer/views/' . $folder . '/' . $manifest['entry']['css'];
            } elseif (file_exists($view_path . '/view.css')) {
                $css_entry = 'apps/explorer/views/' . $folder . '/view.css';
            } elseif (file_exists($view_path . '/' . $folder . '.css')) {
                $css_entry = 'apps/explorer/views/' . $folder . '/' . $folder . '.css';
            }

            $views[$folder] = [
                'id'        => $manifest['id'] ?? $folder,
                'name'      => $manifest['name'] ?? ucfirst($folder),
                'nameKey'   => $manifest['nameKey'] ?? ('view.' . $folder),
                'icon'      => $manifest['icon'] ?? '🖼️',
                'manifest'  => $manifest,
                'js_entry'  => $js_entry,
                'css_entry' => $css_entry
            ];
        }

        return $views;
    }

    /**
     * Recursively flattens a nested array into dot-separated string keys
     */
    private static function flattenTranslations(array $array, string $prefix, array &$result): void {
        foreach ($array as $key => $val) {
            $fullKey = $prefix === '' ? $key : $prefix . '.' . $key;
            if (is_array($val)) {
                self::flattenTranslations($val, $fullKey, $result);
            } else {
                $result[$fullKey] = (string)$val;
            }
        }
    }
}
