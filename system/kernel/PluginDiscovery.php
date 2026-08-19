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
        foreach ($folders as $folder) {
            if ($folder[0] === '.') continue;
            $app_path = $apps_dir . '/' . $folder;
            if (!is_dir($app_path)) continue;

            $manifest_file = $app_path . '/manifest.json';
            $manifest = [];
            if (file_exists($manifest_file)) {
                $content = @file_get_contents($manifest_file);
                $manifest = @json_decode($content, true) ?: [];
            }

            // Find JS entry point
            $js_entry = null;
            if (!empty($manifest['entry']['js']) && file_exists($app_path . '/' . $manifest['entry']['js'])) {
                $js_entry = 'apps/' . $folder . '/' . $manifest['entry']['js'];
            } elseif (file_exists($app_path . '/app.js')) {
                $js_entry = 'apps/' . $folder . '/app.js';
            } elseif (file_exists($app_path . '/' . $folder . '.js')) {
                $js_entry = 'apps/' . $folder . '/' . $folder . '.js';
            }

            // Find CSS entry point
            $css_entry = null;
            if (!empty($manifest['entry']['css']) && file_exists($app_path . '/' . $manifest['entry']['css'])) {
                $css_entry = 'apps/' . $folder . '/' . $manifest['entry']['css'];
            } elseif (file_exists($app_path . '/app.css')) {
                $css_entry = 'apps/' . $folder . '/app.css';
            } elseif (file_exists($app_path . '/' . $folder . '.css')) {
                $css_entry = 'apps/' . $folder . '/' . $folder . '.css';
            }

            // Find Template / HTML UI entry point
            $template_entry = null;
            if (!empty($manifest['entry']['template']) && file_exists($app_path . '/' . $manifest['entry']['template'])) {
                $template_entry = 'apps/' . $folder . '/' . $manifest['entry']['template'];
            } elseif (file_exists($app_path . '/template.php')) {
                $template_entry = 'apps/' . $folder . '/template.php';
            } elseif (file_exists($app_path . '/template.html')) {
                $template_entry = 'apps/' . $folder . '/template.html';
            }

            $apps[$folder] = [
                'id'             => $manifest['id'] ?? $folder,
                'name'           => $manifest['name'] ?? ucfirst($folder),
                'version'        => $manifest['version'] ?? '1.0.0',
                'manifest'       => $manifest,
                'js_entry'       => $js_entry,
                'css_entry'      => $css_entry,
                'template_entry' => $template_entry
            ];
        }

        return $apps;
    }
}
