<?php
/**
 * SimpleGallery 2026 - Internationalization Engine (Backend)
 */

namespace SimpleGallery\Kernel\I18n;

use SimpleGallery\Kernel\PluginDiscovery;

class I18nEngine {
    private static ?array $cached_translations = null;
    private static ?string $cached_locale = null;

    /**
     * Resolve project root directory
     */
    private static function resolveProjectRoot(string $base_dir = ''): string {
        if (!empty($base_dir) && is_dir($base_dir . '/locales')) {
            return $base_dir;
        }
        $candidate = dirname(dirname(dirname(__DIR__)));
        if (is_dir($candidate . '/locales')) {
            return $candidate;
        }
        return $base_dir ?: $candidate;
    }

    /**
     * Discover all available JSON locale dictionaries in locales/ directory
     */
    public static function getAvailableLocales(string $base_dir): array {
        $root = self::resolveProjectRoot($base_dir);
        $locales_dir = $root . '/locales';
        $locales = [];

        if (is_dir($locales_dir)) {
            $files = scandir($locales_dir);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..' || !str_ends_with(strtolower($file), '.json')) {
                    continue;
                }

                $code = basename($file, '.json');
                $full_path = $locales_dir . '/' . $file;
                $content = @file_get_contents($full_path);
                $data = $content ? json_decode($content, true) : null;

                if (is_array($data)) {
                    $locales[$code] = [
                        'code'        => $code,
                        'name'        => $data['_meta']['name'] ?? strtoupper($code),
                        'native_name' => $data['_meta']['native_name'] ?? ($data['_meta']['name'] ?? strtoupper($code)),
                        'flag'        => $data['_meta']['flag'] ?? '🌐',
                        'direction'   => $data['_meta']['direction'] ?? 'ltr'
                    ];
                }
            }
        }

        if (empty($locales)) {
            $locales['fr'] = [
                'code'        => 'fr',
                'name'        => 'Français',
                'native_name' => 'Français',
                'flag'        => '🇫🇷',
                'direction'   => 'ltr'
            ];
            $locales['en'] = [
                'code'        => 'en',
                'name'        => 'English',
                'native_name' => 'English',
                'flag'        => '🇬🇧',
                'direction'   => 'ltr'
            ];
        }

        return $locales;
    }

    /**
     * Get HTML emoji flag or badge for a given locale
     */
    public static function getLocaleFlagHtml($locale_or_code, string $fallback = '🌐', array $available_locales = []): string {
        $flag = '';
        if (is_array($locale_or_code)) {
            $flag = $locale_or_code['flag'] ?? '';
        } elseif (is_string($locale_or_code)) {
            if (!empty($available_locales[$locale_or_code]['flag'])) {
                $flag = $available_locales[$locale_or_code]['flag'];
            }
        }

        if (empty($flag)) {
            $flag = $fallback;
        }

        return '<span class="locale-flag" aria-hidden="true">' . htmlspecialchars($flag, ENT_QUOTES, 'UTF-8') . '</span>';
    }

    /**
     * Detect preferred locale from browser HTTP_ACCEPT_LANGUAGE
     */
    public static function detectBrowserLocale(array $available_locales, string $default = 'fr'): string {
        if (!isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) || empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
            return $default;
        }

        $http_accept = strtolower($_SERVER['HTTP_ACCEPT_LANGUAGE']);
        $languages = explode(',', $http_accept);

        foreach ($languages as $lang_entry) {
            $parts = explode(';', trim($lang_entry));
            $code = trim($parts[0]);
            $primary_code = explode('-', $code)[0];

            if (isset($available_locales[$code])) {
                return $code;
            }
            if (isset($available_locales[$primary_code])) {
                return $primary_code;
            }
        }

        return $default;
    }

    /**
     * Load locale JSON translations with auto-fallback to French/English and merge modular app translations
     */
    public static function loadLocaleTranslations(string $base_dir, string $code): array {
        $root = self::resolveProjectRoot($base_dir);
        $locales_dir = $root . '/locales';

        $code = strtolower(basename($code));
        $file = $locales_dir . '/' . $code . '.json';
        $translations = [];

        if (file_exists($file)) {
            $content = @file_get_contents($file);
            $parsed = $content ? json_decode($content, true) : null;
            if (is_array($parsed)) {
                $translations = $parsed['translations'] ?? $parsed;
            }
        } elseif (file_exists($locales_dir . '/fr.json')) {
            $content = @file_get_contents($locales_dir . '/fr.json');
            $parsed = $content ? json_decode($content, true) : null;
            if (is_array($parsed)) {
                $translations = $parsed['translations'] ?? $parsed;
            }
        }

        // Merge discovered modular app translations
        $app_trans = PluginDiscovery::getAppTranslations($root, $code);
        if (!empty($app_trans)) {
            $translations = array_merge($translations, $app_trans);
        }

        return $translations;
    }

    /**
     * Translate a translation key in PHP backend
     */
    public static function translate(string $key, array $replacements = [], ?string $locale = null, string $base_dir = ''): string {
        if (empty($base_dir)) {
            global $real_base_dir, $project_root;
            $base_dir = $project_root ?? ($real_base_dir ?? dirname(dirname(dirname(__DIR__))));
        }

        if ($locale === null) {
            global $default_locale;
            if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['sg_locale'])) {
                $locale = $_SESSION['sg_locale'];
            } elseif (!empty($_COOKIE['sg_locale'])) {
                $locale = $_COOKIE['sg_locale'];
            } else {
                $locale = $default_locale ?? 'fr';
            }
        }

        if (self::$cached_translations === null || self::$cached_locale !== $locale) {
            self::$cached_locale = $locale;
            self::$cached_translations = self::loadLocaleTranslations($base_dir, $locale);
        }

        $translations = self::$cached_translations;

        $result = $translations[$key] ?? null;
        if ($result === null) {
            $segments = explode('.', $key);
            $curr = $translations;
            $found = true;
            foreach ($segments as $segment) {
                if (is_array($curr) && isset($curr[$segment])) {
                    $curr = $curr[$segment];
                } else {
                    $found = false;
                    break;
                }
            }
            if ($found && is_string($curr)) {
                $result = $curr;
            }
        }

        if ($result === null) {
            $result = $key;
        }

        if (!empty($replacements)) {
            foreach ($replacements as $placeholder => $val) {
                $result = str_replace(':' . $placeholder, (string)$val, $result);
                $result = str_replace('{' . $placeholder . '}', (string)$val, $result);
            }
        }

        return $result;
    }
}
