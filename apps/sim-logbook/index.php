<?php
/**
 * SimpleGallery WebOS - Sim Logbook Standalone / iPad Mobile Entry Point
 * Fullscreen Touch-Optimized Web App for EC135 FFS Instructors & Technicians
 */
$theme = isset($_COOKIE['sg_theme']) ? $_COOKIE['sg_theme'] : 'light-minimal';
$lang = isset($_COOKIE['sg_locale']) ? $_COOKIE['sg_locale'] : (isset($_COOKIE['sg_lang']) ? $_COOKIE['sg_lang'] : 'fr');

$locales = ['fr' => [], 'en' => [], 'ja' => []];
foreach (['fr', 'en', 'ja'] as $l) {
    $locFile = __DIR__ . "/locales/$l.json";
    if (file_exists($locFile)) {
        $locales[$l] = json_decode(file_get_contents($locFile), true) ?: [];
    }
}
?>
<!DOCTYPE html>
<html lang="<?php echo htmlspecialchars($lang); ?>" data-theme="<?php echo htmlspecialchars($theme); ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Sim Logbook">
    <meta name="format-detection" content="telephone=no">
    <title>Sim Logbook — EC135 FFS (Standalone iPad)</title>
    
    <!-- Base Core Theme & Variables -->
    <link rel="stylesheet" href="../../themes/base.css">
    <link rel="stylesheet" href="../../themes/<?php echo htmlspecialchars($theme); ?>/theme.css">
    <!-- Sim Logbook Styles -->
    <link rel="stylesheet" href="style.css">

    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: var(--bg-main, #f1f5f9);
            color: var(--text-main, #0f172a);
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
    </style>
</head>
<body>
    <div id="standalone-container"></div>

    <!-- Complete i18n Engine for Standalone Execution -->
    <script>
        window.sys = window.sys || {};
        (function() {
            var locales = <?php echo json_encode($locales, JSON_UNESCAPED_UNICODE); ?>;
            var curLang = localStorage.getItem('sg_locale') || '<?php echo $lang; ?>' || 'fr';
            if (!locales[curLang]) curLang = 'fr';

            window.sys.i18n = {
                currentLocale: curLang,
                translations: locales[curLang] || {},
                t: function (key, fallback) {
                    return this.translations[key] || fallback || key;
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
                        if (window.simLogbookApp && typeof window.simLogbookApp.onLocaleChanged === 'function') {
                            window.simLogbookApp.onLocaleChanged();
                        }
                    }
                }
            };
        })();
    </script>

    <!-- Sim Logbook Engine -->
    <script src="app.js"></script>

    <script>
        document.addEventListener('DOMContentLoaded', function () {
            var container = document.getElementById('standalone-container');
            if (window.simLogbookApp && typeof window.simLogbookApp.init === 'function') {
                window.simLogbookApp.init(container);
            }
        });
    </script>
</body>
</html>
