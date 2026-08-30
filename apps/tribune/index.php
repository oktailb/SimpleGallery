<?php
/**
 * SimpleGallery WebOS - Tribune Libre Standalone Entry Point
 * Fullscreen Touch & Desktop Optimized Standalone Bouchot Client
 */
$project_root = dirname(dirname(__DIR__));
require_once $project_root . '/system/boot/bootstrap.php';
require_once $project_root . '/system/kernel/functions.php';

$theme = isset($_COOKIE['sg_theme']) ? $_COOKIE['sg_theme'] : 'light-minimal';
$lang = isset($_COOKIE['sg_locale']) ? $_COOKIE['sg_locale'] : (isset($_COOKIE['sg_lang']) ? $_COOKIE['sg_lang'] : 'fr');

$locales = ['fr' => [], 'en' => [], 'ja' => []];
foreach (['fr', 'en', 'ja'] as $l) {
    $locFile = __DIR__ . "/locales/$l.json";
    if (file_exists($locFile)) {
        $content = @file_get_contents($locFile);
        $json = @json_decode($content, true) ?: [];
        $locales[$l] = $json['translations'] ?? $json;
    }
}
?>
<!DOCTYPE html>
<html lang="<?php echo htmlspecialchars($lang, ENT_QUOTES, 'UTF-8'); ?>" data-theme="<?php echo htmlspecialchars($theme, ENT_QUOTES, 'UTF-8'); ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Tribune Libre">
    <meta name="csrf-token" content="<?php echo get_csrf_token(); ?>">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦆</text></svg>">
    <title>Tribune Libre — Bouchot & Chat Multi-Salons</title>
    
    <!-- Base Core Themes & Toolkit Styles -->
    <link rel="stylesheet" href="../../themes/base.css">
    <link rel="stylesheet" href="../../themes/<?php echo htmlspecialchars($theme, ENT_QUOTES, 'UTF-8'); ?>/theme.css">
    <link rel="stylesheet" href="../../system/userland/ui/styles/toolkit.css">
    <!-- Tribune Styles -->
    <link rel="stylesheet" href="app.css">

    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: var(--bg-main, #0f172a);
            color: var(--text-main, #f8fafc);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
        }
        #standalone-container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .tribune-window-wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
        }
    </style>
</head>
<body>
    <div id="standalone-container"></div>

    <!-- Standalone WebOS Compatibility Runtime (EventBus, Syscall, i18n, Audio, Toasts) -->
    <script src="../../system/userland/core/EventBus.js"></script>
    <script src="../../system/userland/core/SyscallClient.js"></script>
    <script>
        window.sys = window.sys || {};
        (function() {
            var locales = <?php echo json_encode($locales, JSON_UNESCAPED_UNICODE); ?>;
            var curLang = localStorage.getItem('sg_locale') || '<?php echo $lang; ?>' || 'fr';
            if (!locales[curLang]) curLang = 'fr';

            // 1. Syscall API for Standalone Mode pointing to local api.php
            window.sys.api = new SyscallClient('api.php');
            window.sys.api.forApp = function(appId) {
                return window.sys.api;
            };

            // 2. i18n Engine
            window.sys.i18n = {
                currentLocale: curLang,
                translations: locales[curLang] || {},
                t: function (key, replacements) {
                    var str = this.translations[key] || key;
                    if (replacements && typeof replacements === 'object') {
                        Object.keys(replacements).forEach(function(k) {
                            str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), replacements[k]);
                        });
                    }
                    return str;
                },
                setLocale: function (code) {
                    if (locales[code]) {
                        this.currentLocale = code;
                        this.translations = locales[code];
                        try {
                            localStorage.setItem('sg_locale', code);
                            document.cookie = 'sg_locale=' + encodeURIComponent(code) + '; path=/; max-age=31536000';
                            document.documentElement.lang = code;
                        } catch (e) {}
                        if (window.tribuneApp && typeof window.tribuneApp.onLocaleChanged === 'function') {
                            window.tribuneApp.onLocaleChanged();
                        }
                    }
                }
            };
            window.I18nEngine = window.sys.i18n;

            // 3. Audio Synth
            window.sys.audio = {
                play: function(name) {
                    try {
                        var AudioCtx = window.AudioContext || window.webkitAudioContext;
                        if (!AudioCtx) return;
                        var ctx = new AudioCtx();
                        var osc = ctx.createOscillator();
                        var gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = (name === 'pop' || name === 'click') ? 600 : 800;
                        gain.gain.setValueAtTime(0.1, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.08);
                    } catch(e) {}
                }
            };

            // 4. Toast Notifications
            window.sys.toast = {
                info: function(msg) { console.log('[Toast Info]', msg); },
                success: function(msg) { console.log('[Toast Success]', msg); },
                warning: function(msg) { console.warn('[Toast Warning]', msg); },
                error: function(msg) { console.error('[Toast Error]', msg); }
            };

            // 5. Dialogs
            window.sys.dialog = {
                alert: function(msg) { alert(typeof msg === 'object' ? msg.message : msg); return Promise.resolve(); },
                confirm: function(msg) { return Promise.resolve(confirm(typeof msg === 'object' ? msg.message : msg)); },
                prompt: function(msg, def) { return Promise.resolve(prompt(typeof msg === 'object' ? msg.message : msg, def)); }
            };
        })();
    </script>

    <!-- Tribune App Core Engine -->
    <script src="app.js"></script>

    <script>
        document.addEventListener('DOMContentLoaded', function () {
            var container = document.getElementById('standalone-container');
            if (window.tribuneApp && typeof window.tribuneApp.init === 'function') {
                window.tribuneApp.init(container);
            }
        });
    </script>
</body>
</html>
