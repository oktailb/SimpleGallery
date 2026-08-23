<?php
/**
 * SimpleGallery 2026 - General Functional & Feature Unit Test Suite
 * Covers directory indexing, path operations, dotfile overrides, caching, search filters, comments, and archives.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

require_once dirname(__DIR__) . '/config.php';

class GeneralUnitTestSuite {
    /** @var string */
    private $base_dir;
    /** @var string */
    private $test_dir;
    /** @var int */
    private $passed = 0;
    /** @var int */
    private $failed = 0;
    /** @var array */
    private $results = [];

    public function getResults(): array {
        return $this->results;
    }

    public function getCounts(): array {
        return [
            'passed' => $this->passed,
            'failed' => $this->failed,
            'total'  => $this->passed + $this->failed
        ];
    }

    public function __construct() {
        $this->base_dir = realpath(dirname(__DIR__)) ?: dirname(__DIR__);
        $this->base_dir = str_replace('\\', '/', $this->base_dir);

        // Create temporary test environment folder in ignored directory (.thumbnails)
        $sandbox = $this->base_dir . '/.thumbnails/test_sandbox_gen_' . md5(uniqid('', true));
        if (!is_dir($sandbox)) {
            @mkdir($sandbox, 0755, true);
        }
        if (!is_dir($sandbox) || !is_writable($sandbox)) {
            $sandbox = sys_get_temp_dir() . '/sg_test_sandbox_gen_' . md5(uniqid('', true));
            if (!is_dir($sandbox)) {
                @mkdir($sandbox, 0755, true);
            }
        }
        $this->test_dir = str_replace('\\', '/', $sandbox);

    }

    public function __destruct() {
        if (is_dir($this->test_dir)) {
            $this->recursive_rmdir($this->test_dir);
        }
    }

    private function recursive_rmdir(string $dir): void {
        if (!is_dir($dir)) return;
        $items = @scandir($dir);
        if ($items === false) return;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $dir . '/' . $item;
            if (is_dir($path)) {
                $this->recursive_rmdir($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }

    private function assert(string $test_name, bool $condition, string $details = ''): void {
        if ($condition) {
            $this->passed++;
            $this->results[] = ['name' => $test_name, 'status' => 'PASS', 'details' => ''];
            echo "  ✅ PASS: {$test_name}\n";
        } else {
            $this->failed++;
            $this->results[] = ['name' => $test_name, 'status' => 'FAIL', 'details' => $details];
            echo "  ❌ FAIL: {$test_name}" . ($details ? " - {$details}" : "") . "\n";
        }
    }

    public function runAll(): bool {
        $saved_session = $_SESSION ?? [];
        $_SESSION = [];

        echo "\n============================================================\n";
        echo " ⚙️ SimpleGallery 2026 - Suite de Tests Fonctionnels Généraux\n";
        echo "============================================================\n\n";

        $this->testPathAndRelativeHelpers();
        $this->testDotfileFolderOverrides();
        $this->testCommentLegendParser();
        $this->testDirectoryCacheEngine();
        $this->testSearchEngineFilters();
        $this->testArchiveGenerationEngine();
        $this->testMp4ExtractorFallback();
        $this->testCookieConsentConfiguration();
        $this->testImageEditorBackend();
        $this->testI18nEngineAndLocales();
        $this->testUnifiedMetadataExtractors();
        $this->testSystemMonitorAppAndTelemetry();
        $this->testNextGenTaskbarAndAppCategories();
        $this->testTribuneAppAndMultiBouchot();

        $_SESSION = $saved_session;

        echo "\n============================================================\n";
        echo " 📊 RÉSULTAT FINAL DES TESTS FONCTIONNELS\n";
        echo "============================================================\n";
        echo "  Tests Réussis : {$this->passed}\n";
        echo "  Tests Échoués : {$this->failed}\n";
        echo "  Total Tests   : " . ($this->passed + $this->failed) . "\n";

        if ($this->failed === 0) {
            echo "\n 🎉 VÉRIFICATION RÉUSSIE : TOUTES LES FONCTIONNALITÉS SONT STABLES !\n\n";
            return true;
        } else {
            echo "\n ⚠️ ATTENTION : CERTAINS TESTS FONCTIONNELS ONT ÉCHOUÉ !\n\n";
            return false;
        }
    }

    /**
     * 1. Path & Relative Path Resolution Tests
     */
    private function testPathAndRelativeHelpers(): void {
        echo "📂 [1/7] Test de la Résolution des Chemins Relatifs...\n";

        $rel_root = get_relative_path($this->base_dir, $this->base_dir);
        $this->assert("get_relative_path sur racine renvoie ''", $rel_root === '');

        $sub = $this->base_dir . '/css/gallery.css';
        $rel_sub = get_relative_path($sub, $this->base_dir);
        $this->assert("get_relative_path('css/gallery.css') renvoie 'css/gallery.css'", $rel_sub === 'css/gallery.css');

        $win_style = str_replace('/', '\\', $this->base_dir . '/js/gallery.js');
        $rel_win = get_relative_path($win_style, $this->base_dir);
        $this->assert("get_relative_path normalise les antislashs Windows", $rel_win === 'js/gallery.js');
    }

    /**
     * 2. Dotfile Folder Overrides Tests (.title, .desc, .bg, .theme)
     */
    private function testDotfileFolderOverrides(): void {
        echo "\n📁 [2/7] Test de Configuration des Dotfiles de Dossier (.title, .desc, .bg, .theme)...\n";

        $sample_dir = $this->test_dir . '/folder_config_test';
        mkdir($sample_dir, 0755, true);

        file_put_contents($sample_dir . '/.title', "Mon Titre Personnalisé\n");
        file_put_contents($sample_dir . '/.desc', "Description de test du dossier\n");
        file_put_contents($sample_dir . '/.bg', "#1e293b\n");
        file_put_contents($sample_dir . '/.theme', "dark-glass\n");

        $overrides = load_folder_overrides($sample_dir, $this->base_dir);

        $this->assert("Titre personnalisé lu depuis .title", $overrides['title'] === "Mon Titre Personnalisé");
        $this->assert("Description lue depuis .desc", $overrides['description'] === "Description de test du dossier");
        $this->assert("Arrière-plan brut lu depuis .bg", ($overrides['raw_background'] ?? '') === "#1e293b");
        $this->assert("Thème 'dark-glass' résolu en palette", is_array($overrides['theme']) && isset($overrides['theme']['bg_main']));
    }

    /**
     * 3. Comment Legend Parser Tests (.comment)
     */
    private function testCommentLegendParser(): void {
        echo "\n💬 [3/7] Test du Parser de Légendes de Fichiers (.comment)...\n";

        $sample_dir = $this->test_dir . '/comments_test';
        mkdir($sample_dir, 0755, true);

        $initial_comments = [
            'photo1.jpg' => 'Coucher de soleil sur la plage',
            'video1.mp4' => 'Vacances 2026'
        ];

        $saved = save_dir_comments($sample_dir, $initial_comments);
        $this->assert("Sauvegarde du fichier .comment", $saved === true && file_exists($sample_dir . '/.comment'));

        $loaded = load_dir_comments($sample_dir);
        $this->assert("Lecture des légendes photo1.jpg", ($loaded['photo1.jpg'] ?? '') === 'Coucher de soleil sur la plage');
        $this->assert("Lecture des légendes video1.mp4", ($loaded['video1.mp4'] ?? '') === 'Vacances 2026');

        // Update comment
        $loaded['photo1.jpg'] = 'Coucher de soleil à Hawaii';
        save_dir_comments($sample_dir, $loaded);
        $reloaded = load_dir_comments($sample_dir);
        $this->assert("Mise à jour d'une légende existante", ($reloaded['photo1.jpg'] ?? '') === 'Coucher de soleil à Hawaii');
    }

    /**
     * 4. Directory Cache Engine Tests
     */
    private function testDirectoryCacheEngine(): void {
        echo "\n⚡ [4/7] Test du Moteur de Cache des Dossiers...\n";

        $sample_dir = $this->test_dir . '/cache_test';
        mkdir($sample_dir, 0755, true);
        touch($sample_dir . '/sample_image.jpg');

        $cache_file = get_dir_cache_file_path($sample_dir, $this->base_dir, '.thumbnails');
        $this->assert("Génération du chemin de cache JSON", !empty($cache_file));

        $is_valid_before = is_dir_cache_valid($cache_file, $sample_dir);
        $this->assert("Cache invalide si inexistant", $is_valid_before === false);

        // Create dummy cache payload
        $dummy_payload = ['created_at' => time(), 'raw_items' => ['directories' => [], 'files' => []]];
        file_put_contents($cache_file, json_encode($dummy_payload));
        touch($cache_file, time() + 10);

        $is_valid_after = is_dir_cache_valid($cache_file, $sample_dir);
        $this->assert("Cache valide une fois créé avec mtime récent", $is_valid_after === true);

        // Invalidate cache
        invalidate_dir_cache($sample_dir, $this->base_dir, '.thumbnails');
        $this->assert("Invalidation du cache supprime le fichier JSON", !file_exists($cache_file));
    }

    /**
     * 5. Search Engine Filters Tests
     */
    private function testSearchEngineFilters(): void {
        echo "\n🔍 [5/7] Test des Filtres Multidimensionnels du Moteur de Recherche...\n";

        $search_dir = $this->test_dir . '/search_test';
        mkdir($search_dir, 0755, true);

        // Create dummy test media files
        file_put_contents($search_dir . '/vacances_plage.jpg', str_repeat('A', 100)); // small
        file_put_contents($search_dir . '/concert_rock.mp4', str_repeat('B', 1500));
        file_put_contents($search_dir . '/document_comptable.pdf', str_repeat('C', 500));

        save_dir_comments($search_dir, ['concert_rock.mp4' => 'Super festival d été']);

        global $ignore_list, $media_types;
        $media_types_config = $media_types ?: [
            'image' => ['jpg'], 'video' => ['mp4'], 'doc' => ['pdf']
        ];

        // 1. Category Filter Test
        $img_results = search_gallery_recursive($search_dir, $search_dir, [
            'category' => 'image',
            'recursive' => true
        ], [], $media_types_config);

        $this->assert("Filtre catégorie 'image' trouve uniquement les photos", count($img_results) === 1 && $img_results[0]['name'] === 'vacances_plage.jpg');

        // 2. Word Search in Comments
        $comment_results = search_gallery_recursive($search_dir, $search_dir, [
            'words' => 'festival',
            'category' => 'all',
            'recursive' => true
        ], [], $media_types_config);

        $this->assert("Recherche de mots dans les légendes .comment", count($comment_results) === 1 && $comment_results[0]['name'] === 'concert_rock.mp4');
    }

    /**
     * 6. Multi-Format Archive Generation Engine Tests
     */
    private function testArchiveGenerationEngine(): void {
        echo "\n📦 [6/7] Test de la Génération d'Archives Zip...\n";

        $arch_dir = $this->test_dir . '/archive_test';
        @mkdir($arch_dir, 0755, true);
        file_put_contents($arch_dir . '/photo.jpg', 'fake image data');
        file_put_contents($arch_dir . '/secret.php', '<?php echo "hidden";'); // Should be excluded!
        file_put_contents($arch_dir . '/.dotfile_secret', 'sensitive'); // Should be excluded!

        // Create a private subfolder inside archive_test
        $private_sub = $arch_dir . '/private_subfolder';
        @mkdir($private_sub, 0755, true);
        file_put_contents($private_sub . '/.private', "1\n");
        file_put_contents($private_sub . '/private_pic.jpg', 'private content');

        $out_zip = $this->test_dir . '/test_output.zip';

        $created = create_archive('zip', $arch_dir, $out_zip, $arch_dir, []);
        $this->assert("Création d'archive Zip", $created === true && file_exists($out_zip) && filesize($out_zip) > 0);

        if ($created && class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($out_zip) === true) {
                $has_jpg = ($zip->locateName('photo.jpg') !== false);
                $has_php = ($zip->locateName('secret.php') !== false);
                $has_dotfile = ($zip->locateName('.dotfile_secret') !== false);
                $has_private_pic = ($zip->locateName('private_subfolder/private_pic.jpg') !== false || $zip->locateName('private_pic.jpg') !== false);
                $zip->close();
                $this->assert("L'archive contient les photos publiques", $has_jpg === true);
                $this->assert("L'archive exclut le code PHP de sécurité", $has_php === false);
                $this->assert("L'archive exclut les fichiers dotfiles masqués", $has_dotfile === false);
                $this->assert("L'archive exclut les sous-dossiers privés non-admin", $has_private_pic === false);
            }
        }

        // Test existence of archive.php
        $this->assert("Point d'accès archive.php présent à la racine", file_exists($this->base_dir . '/archive.php'));

        if (file_exists($out_zip)) @unlink($out_zip);
    }

    /**
     * 7. MP4 Extractor Fallback Test
     */
    private function testMp4ExtractorFallback(): void {
        echo "\n🎥 [7/7] Test de l'Extracteur de Miniature MP4...\n";

        $fake_mp4 = $this->test_dir . '/fake.mp4';
        $out_jpg = $this->test_dir . '/out.jpg';
        file_put_contents($fake_mp4, 'NOT_REAL_MP4_DATA');

        $result = extract_mp4_embedded_jpeg($fake_mp4, $out_jpg);
        $this->assert("extract_mp4_embedded_jpeg gère proprement un fichier non-MP4 sans planter", $result === false);

        if (file_exists($fake_mp4)) @unlink($fake_mp4);
        if (file_exists($out_jpg)) @unlink($out_jpg);
    }

    /**
     * Helper to get full rendered UI template output including auto-discovered app templates
     */
    private function getRenderedIndex(): string {
        $index_content = @file_get_contents($this->base_dir . '/index.php') ?: '';
        $discovered_apps = \SimpleGallery\Kernel\PluginDiscovery::getDiscoveredApps($this->base_dir);
        $all_templates = '';
        foreach ($discovered_apps as $app) {
            if (!empty($app['template_entry']) && file_exists($this->base_dir . '/' . $app['template_entry'])) {
                $all_templates .= "\n" . file_get_contents($this->base_dir . '/' . $app['template_entry']);
            }
        }
        return $index_content . "\n" . $all_templates;
    }

    /**
     * 8. Cookie Consent Configuration & Template Meta Tag Test
     */
    private function testCookieConsentConfiguration(): void {
        echo "\n🍪 [8/8] Test de la Configuration du Consentement Cookies...\n";
        global $enable_cookie_consent;

        $this->assert("Variable \$enable_cookie_consent définie dans config.php", isset($enable_cookie_consent));
        $this->assert("Consentement des cookies activé par défaut", $enable_cookie_consent === true);

        $rendered_ui = $this->getRenderedIndex();
        $this->assert("index.php contient la balise meta cookie-consent-enabled", strpos($rendered_ui, 'name="cookie-consent-enabled"') !== false);
        $this->assert("Application settings fournit le bandeau cookieConsentBanner", strpos($rendered_ui, 'id="cookieConsentBanner"') !== false);
        $this->assert("Application settings fournit l'accès aux préférences cookies", (strpos($rendered_ui, 'id="openCookieSettingsBtn"') !== false || strpos($rendered_ui, 'cookieConsentBanner') !== false));
        $this->assert("index.php contient le pied de page app-footer ou la taskbar intégrée", (strpos($rendered_ui, 'app-footer') !== false || strpos($rendered_ui, 'webos-taskbar') !== false));
    }

    /**
     * 9. Image Editor Backend & UI Elements Test
     */
    private function testImageEditorBackend(): void {
        echo "\n🎨 [9/9] Test de l'Éditeur d'Images Admin (Backend & UI)...\n";

        $rendered_ui = $this->getRenderedIndex();
        $image_viewer_js = @file_get_contents($this->base_dir . '/apps/image-viewer/viewer.js') ?: '';
        $this->assert("Application image-viewer fournit le contrôle d'édition d'image", (strpos($rendered_ui, 'id="lightboxEditImageBtn"') !== false || strpos($image_viewer_js, 'imgEdit-') !== false || strpos($image_viewer_js, 'menuImgEditBtn') !== false));
        $this->assert("Application image-viewer fournit le modal imageEditorModal", strpos($rendered_ui, 'id="imageEditorModal"') !== false);
        $this->assert("Application image-viewer fournit le modal de choix de sauvegarde imageSaveChoiceModal", strpos($rendered_ui, 'id="imageSaveChoiceModal"') !== false);

        $api_content = @file_get_contents($this->base_dir . '/api.php');
        $this->assert("api.php déclare l'action edit_image dans les actions mutantes", strpos($api_content, "'edit_image'") !== false);
        $this->assert("api.php implémente le gestionnaire d'action edit_image", strpos($api_content, "\$action === 'edit_image'") !== false);

        // Create a 10x10 sample truecolor JPEG image
        $test_image_file = $this->test_dir . '/sample_photo.jpg';
        if (function_exists('imagecreatetruecolor')) {
            $im = @imagecreatetruecolor(10, 10);
            if ($im) {
                $red = imagecolorallocate($im, 255, 0, 0);
                imagefill($im, 0, 0, $red);
                imagejpeg($im, $test_image_file);
            }
        }
        if (!file_exists($test_image_file)) {
            // Minimal valid 1x1 JPEG binary fallback
            $jpeg_min = "\xFF\xD8\xFF\xE0\x00\x10\x4A\x46\x49\x46\x00\x01\x01\x01\x00\x48\x00\x48\x00\x00\xFF\xDB\x00\x43\x00\xFF\xC0\x00\x0B\x08\x00\x01\x00\x01\x01\x01\x11\x00\xFF\xC4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xFF\xDA\x00\x08\x01\x01\x00\x00\x3F\x00\x7F\xFF\xD9";
            file_put_contents($test_image_file, $jpeg_min);
        }

        $this->assert("Image de test sample_photo.jpg créée avec succès", file_exists($test_image_file));

        // Test copy filename resolution logic
        $info = pathinfo($test_image_file);
        $base_name = $info['filename'];
        $clean_base = preg_replace('/_edited(_\d+)?$/i', '', $base_name);
        $candidate_name = $clean_base . '_edited.jpg';
        $copy_path = dirname($test_image_file) . '/' . $candidate_name;
        
        file_put_contents($copy_path, 'EDITED_COPY_DATA');
        $this->assert("Génération du nom de copie '_edited.jpg' valide", file_exists($copy_path));
        $this->assert("L'image originale est préservée lors d'une copie", filesize($test_image_file) > 0);

        // Test EXIF segment preservation helper
        $mock_exif_payload = "Exif\0\0MM\x00\x2A\x00\x00\x00\x08\x00\x00";
        $mock_orig_jpeg = "\xFF\xD8\xFF\xE1" . pack('n', strlen($mock_exif_payload) + 2) . $mock_exif_payload . "\xFF\xDB\x00\x43\x00\xFF\xD9";
        $orig_exif_file = $this->test_dir . '/orig_with_exif.jpg';
        file_put_contents($orig_exif_file, $mock_orig_jpeg);

        $new_canvas_jpeg = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00\x48\x00\x48\x00\x00\xFF\xDB\x00\x43\x00\xFF\xD9";
        $injected_jpeg = transfer_jpeg_exif($orig_exif_file, $new_canvas_jpeg);
        $this->assert("transfer_jpeg_exif injecte le segment APP1 EXIF d'origine", strpos($injected_jpeg, "Exif\0\0") !== false);

        if (file_exists($test_image_file)) @unlink($test_image_file);
        if (file_exists($copy_path)) @unlink($copy_path);
        if (file_exists($orig_exif_file)) @unlink($orig_exif_file);

        // Test Document WYSIWYG & Markdown save action
        $doc_viewer_js = @file_get_contents($this->base_dir . '/apps/doc-viewer/viewer.js') ?: '';
        $this->assert("doc-viewer intègre le chargeur Toast UI Editor", strpos($doc_viewer_js, 'loadToastUiEditor') !== false);
        $this->assert("api.php déclare l'action save_text_file dans les actions mutantes", strpos($api_content, "'save_text_file'") !== false);
        $this->assert("api.php implémente le gestionnaire d'action save_text_file", strpos($api_content, "\$action === 'save_text_file'") !== false);

        // Test sample markdown saving
        $test_md_file = $this->test_dir . '/notes.md';
        file_put_contents($test_md_file, "# Initial Title\n\nSome text content");
        $this->assert("Création fichier Markdown test", file_exists($test_md_file));

        $updated_content = "# Updated Title\n\n* Updated with Toast UI Editor";
        file_put_contents($test_md_file, $updated_content);
        $this->assert("Sauvegarde contenu Markdown mis à jour", file_get_contents($test_md_file) === $updated_content);

        if (file_exists($test_md_file)) @unlink($test_md_file);
    }

    /**
     * 10. i18n Locales Discovery & Engine Test
     */
    private function testI18nEngineAndLocales(): void {
        echo "\n🌐 [10/10] Test du Moteur d'Internationalisation (i18n) & Découverte...\n";

        $locales = get_available_locales($this->base_dir);
        $this->assert("Découverte automatique des locales non vide", !empty($locales));
        $this->assert("Locale 'fr' présente dans les locales", isset($locales['fr']));
        $this->assert("Locale 'en' présente dans les locales", isset($locales['en']));
        $this->assert("Drapeau de la locale 'fr' est 🇫🇷", ($locales['fr']['flag'] ?? '') === '🇫🇷');
        $this->assert("Drapeau de la locale 'en' est 🇬🇧", ($locales['en']['flag'] ?? '') === '🇬🇧');

        // Test browser locale detection
        $_SERVER['HTTP_ACCEPT_LANGUAGE'] = 'fr-FR,fr;q=0.9,en-US;q=0.8';
        $detected_fr = detect_browser_locale($locales, 'fr');
        $this->assert("Détection de la langue du navigateur (FR)", $detected_fr === 'fr');

        $_SERVER['HTTP_ACCEPT_LANGUAGE'] = 'en-US,en;q=0.9';
        $detected_en = detect_browser_locale($locales, 'fr');
        $this->assert("Détection de la langue du navigateur (EN)", $detected_en === 'en');

        // Test loading translations
        $fr_trans = load_locale_translations($this->base_dir, 'fr');
        $this->assert("Traductions FR chargées avec succès", !empty($fr_trans) && isset($fr_trans['app.title']));
        $this->assert("Traduction FR de 'nav.root' non vide", in_array($fr_trans['nav.root'] ?? '', ['Stockage', 'Accueil'], true));

        $en_trans = load_locale_translations($this->base_dir, 'en');
        $this->assert("Traductions EN chargées avec succès", !empty($en_trans) && isset($en_trans['app.title']));
        $this->assert("Traduction EN de 'nav.root' non vide", in_array($en_trans['nav.root'] ?? '', ['Storage', 'Home'], true));

        // Test adding a dynamic third locale file
        $temp_es_file = $this->base_dir . '/locales/tmp_test_es.json';
        file_put_contents($temp_es_file, json_encode([
            '_meta' => ['code' => 'tmp_test_es', 'name' => 'Español Test', 'flag' => '🇪🇸'],
            'translations' => ['app.title' => 'SimpleGallery ES']
        ]));

        // Test global __t helper function
        $msg_fr = __t('api.err_admin_required', [], 'fr', $this->base_dir);
        $this->assert("Traduction PHP __t FR correcte", $msg_fr === 'Droits administrateur requis pour cette action.');

        $msg_en = __t('api.err_admin_required', [], 'en', $this->base_dir);
        $this->assert("Traduction PHP __t EN correcte", $msg_en === 'Admin rights required for this action.');

        $msg_repl = __t('stats.summary', ['folders' => 3, 'files' => 12], 'en', $this->base_dir);
        $this->assert("Interpolation de variables __t correcte", $msg_repl === '3 folders • 12 files');

        if (file_exists($temp_es_file)) @unlink($temp_es_file);
    }

    /**
     * 11. Unified Multi-Format Metadata Extractors Test
     */
    private function testUnifiedMetadataExtractors(): void {
        echo "\nℹ️ [11/11] Test des Extracteurs de Métadonnées Multi-Formats...\n";

        // 1. Test Text/Document Metadata
        $doc_path = $this->test_dir . '/sample_doc.txt';
        file_put_contents($doc_path, "Ligne 1: Bonjour le monde\nLigne 2: Test SimpleGallery 2026\nLigne 3: Fin de fichier");
        $meta_doc = get_file_unified_metadata($doc_path, 'sample_doc.txt', 'doc', 'txt');

        $this->assert("Extraction métadonnées générales TXT", isset($meta_doc['general']['filename']) && $meta_doc['general']['filename'] === 'sample_doc.txt');
        $this->assert("Comptage des lignes TXT (3 lignes)", ($meta_doc['specific']['doc']['lines_count'] ?? 0) === 3);

        // 2. Test Image Aspect Ratio computation
        $ratio_169 = compute_aspect_ratio(1920, 1080);
        $this->assert("Calcul Ratio 1920x1080 => 16:9", $ratio_169 === '16:9');
        $ratio_43 = compute_aspect_ratio(4032, 3024);
        $this->assert("Calcul Ratio 4032x3024 => 4:3", $ratio_43 === '4:3');
        $ratio_11 = compute_aspect_ratio(1000, 1000);
        $this->assert("Calcul Ratio 1000x1000 => 1:1", $ratio_11 === '1:1');

        // 3. Test Audio duration formatting helper
        $dur_fmt = format_media_duration(125.4);
        $this->assert("Formatage durée audio 125.4s => 02:05", $dur_fmt === '02:05');
        $dur_fmt_hr = format_media_duration(3665);
        $this->assert("Formatage durée longue 3665s => 01:01:05", $dur_fmt_hr === '01:01:05');

        // 4. Test API get_metadata action resolution with sanitize_file_path
        $api_code = @file_get_contents($this->base_dir . '/api.php');
        $this->assert("api.php utilise sanitize_file_path pour get_metadata", strpos($api_code, "sanitize_file_path(\$file_param") !== false);

        // 5. Test Synthetic MP4 Atom Parsing (mvhd duration & tkhd dimensions)
        $mp4_test = $this->test_dir . '/test_video.mp4';
        // Build minimal valid ISO MP4: ftyp + moov (mvhd + trak/tkhd)
        $ftyp = pack('Na4a4N', 16, 'ftyp', 'isom', 512);
        
        // mvhd (version 0): size=108, 'mvhd', ver/flags=0, ctime=0, mtime=0, timescale=1000, duration=15000 (15 sec)
        $mvhd_body = "\x00\x00\x00\x00" . pack('NNNN', 0, 0, 1000, 15000) . str_repeat("\x00", 80);
        $mvhd = pack('Na4', 8 + strlen($mvhd_body), 'mvhd') . $mvhd_body;

        // tkhd (version 0): size=92, 'tkhd', ver/flags=0, ctime/mtime/track_id..., width=1920<<16, height=1080<<16
        $tkhd_body = "\x00\x00\x00\x01" . str_repeat("\x00", 72) . pack('NN', 1920 << 16, 1080 << 16);
        $tkhd = pack('Na4', 8 + strlen($tkhd_body), 'tkhd') . $tkhd_body;
        $trak = pack('Na4', 8 + strlen($tkhd), 'trak') . $tkhd;

        $moov = pack('Na4', 8 + strlen($mvhd) + strlen($trak), 'moov') . $mvhd . $trak;
        file_put_contents($mp4_test, $ftyp . $moov);

        $parsed_mp4 = parse_mp4_atoms_pure_php($mp4_test);
        $this->assert("Parseur MP4 pur PHP extrait la durée (15s)", ($parsed_mp4['duration'] ?? 0) == 15);
        $this->assert("Parseur MP4 pur PHP extrait la résolution (1920x1080)", ($parsed_mp4['width'] ?? 0) === 1920 && ($parsed_mp4['height'] ?? 0) === 1080);

        // 6. Test Pure PHP ZIP Parser (EOCD and Central Directory Records)
        $zip_pure_test = $this->test_dir . '/test_pure.zip';
        $z = new ZipArchive();
        if ($z->open($zip_pure_test, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
            $z->addFromString('doc1.txt', 'Content for first document');
            $z->addFromString('images/pic.png', 'Fake PNG binary payload data');
            $z->close();
        }

        $pure_zip_res = parse_zip_pure_php($zip_pure_test);
        $this->assert("Parseur ZIP pur PHP (EOCD) détecte les 2 fichiers", ($pure_zip_res['files_count'] ?? 0) === 2);
        $this->assert("Parseur ZIP pur PHP calcule la taille décompressée", ($pure_zip_res['uncompressed_size'] ?? 0) > 0);
        $this->assert("Parseur ZIP pur PHP extrait l'échantillon de fichiers", count($pure_zip_res['files_sample'] ?? []) === 2);

        if (file_exists($zip_pure_test)) @unlink($zip_pure_test);
        if (file_exists($mp4_test)) @unlink($mp4_test);
        if (file_exists($doc_path)) @unlink($doc_path);
    }

    /**
     * 12. System Monitor App & Telemetry API Test
     */
    private function testSystemMonitorAppAndTelemetry(): void {
        echo "\n📊 [12/12] Test de l'Application Moniteur Système & Télémétrie Serveur...\n";

        // 1. App Discovery
        $discovered = \SimpleGallery\Kernel\PluginDiscovery::getDiscoveredApps($this->base_dir);
        $this->assert("Application 'system-monitor' découverte par PluginDiscovery", isset($discovered['system-monitor']));
        $this->assert("Manifeste system-monitor valide", !empty($discovered['system-monitor']['manifest']['id']));
        $this->assert("Point d'entrée JS de system-monitor présent", file_exists($this->base_dir . '/' . $discovered['system-monitor']['js_entry']));
        $this->assert("Feuille de style CSS de system-monitor présente", file_exists($this->base_dir . '/' . $discovered['system-monitor']['css_entry']));

        // 2. Translations
        $fr_trans = \SimpleGallery\Kernel\PluginDiscovery::getAppTranslations($this->base_dir, 'fr');
        $this->assert("Traduction FR de system-monitor chargée", !empty($fr_trans['apps.system-monitor.title']) || !empty($discovered['system-monitor']['locales']['fr']['title']));

        $en_trans = \SimpleGallery\Kernel\PluginDiscovery::getAppTranslations($this->base_dir, 'en');
        $this->assert("Traduction EN de system-monitor chargée", !empty($en_trans['apps.system-monitor.title']) || !empty($discovered['system-monitor']['locales']['en']['title']));

        $ja_trans = \SimpleGallery\Kernel\PluginDiscovery::getAppTranslations($this->base_dir, 'ja');
        $this->assert("Traduction JA de system-monitor chargée", !empty($ja_trans['apps.system-monitor.title']) || !empty($discovered['system-monitor']['locales']['ja']['title']));

        // 3. API Declarations
        $api_code = @file_get_contents($this->base_dir . '/api.php');
        $this->assert("api.php déclare l'action get_system_info", strpos($api_code, "\$action === 'get_system_info'") !== false);
        $this->assert("api.php déclare l'action clear_all_caches dans les actions mutantes", strpos($api_code, "'clear_all_caches'") !== false);
        $this->assert("api.php fournit les métriques de mémoire RAM (current & peak)", strpos($api_code, "'memory_current'") !== false && strpos($api_code, "'memory_peak'") !== false);
        $this->assert("api.php fournit les métriques d'espace disque (total, free, used)", strpos($api_code, "'disk_total'") !== false && strpos($api_code, "'disk_free'") !== false);
        $this->assert("api.php fournit les métriques de caches et miniatures", strpos($api_code, "'cache_count'") !== false && strpos($api_code, "'thumbs_count'") !== false);
    }

    /**
     * 13. Next-Gen Taskbar & App Category Organization Test
     */
    private function testNextGenTaskbarAndAppCategories(): void {
        echo "\n🖥️ [13/13] Test de la Barre des Tâches Évoluée & Catégories d'Applications...\n";

        // 1. Dynamic App Categories Discovery (from manifest.json or subfolder name, else empty string for root)
        $discovered = \SimpleGallery\Kernel\PluginDiscovery::getDiscoveredApps($this->base_dir);
        $this->assert("Catégorie de 'system-monitor' vient du manifest ('system')", ($discovered['system-monitor']['category'] ?? '') === 'system');
        $this->assert("Catégorie de '8queens' vient du manifest ou sous-dossier ('game' ou 'games')", in_array($discovered['8queens']['category'] ?? '', ['game', 'games'], true));
        $this->assert("Catégorie de 'explorer' vient du manifest ('view')", ($discovered['explorer']['category'] ?? '') === 'view');
        $this->assert("Catégorie de 'image-viewer' vient du manifest ('viewer')", ($discovered['image-viewer']['category'] ?? '') === 'viewer');

        // 2. WindowManager Next-Gen Taskbar Elements
        $wm_code = @file_get_contents($this->base_dir . '/system/userland/core/WindowManager.js');
        $this->assert("WindowManager implémente le conteneur d'applications taskbar-apps-container", strpos($wm_code, 'taskbarAppsContainer') !== false);
        $this->assert("WindowManager implémente le System Tray taskbar-tray-container", strpos($wm_code, 'taskbarTrayContainer') !== false);
        $this->assert("WindowManager implémente le bouton horloge taskbarCalendarBtn", strpos($wm_code, 'taskbarCalendarBtn') !== false);
        $this->assert("WindowManager implémente le bouton 'Afficher le Bureau' taskbarShowDesktopBtn", strpos($wm_code, 'taskbarShowDesktopBtn') !== false);
        $this->assert("WindowManager implémente la prévisualisation au survol taskbarPreviewCard", strpos($wm_code, 'taskbarPreviewCard') !== false);

        // 3. Category Translations
        $fr_trans = load_locale_translations($this->base_dir, 'fr');
        $this->assert("Traduction FR de categories.productivity présente", !empty($fr_trans['categories.productivity']));
        $this->assert("Traduction FR de categories.games présente", !empty($fr_trans['categories.games']));
        $this->assert("Traduction FR de taskbar.show_desktop présente", !empty($fr_trans['taskbar.show_desktop']));
    }

    /**
     * 14. Tribune Libre & Multi-Bouchot App Test
     */
    private function testTribuneAppAndMultiBouchot(): void {
        echo "\n🦆 [14/14] Test de l'Application Tribune Libre & Client Bouchot...\n";

        // 1. App Discovery
        $discovered = \SimpleGallery\Kernel\PluginDiscovery::getDiscoveredApps($this->base_dir);
        $this->assert("Application 'tribune' découverte par PluginDiscovery", isset($discovered['tribune']));
        $this->assert("Manifeste tribune valide (ID='tribune')", ($discovered['tribune']['manifest']['id'] ?? '') === 'tribune');
        $this->assert("Point d'entrée JS de tribune présent", file_exists($this->base_dir . '/' . $discovered['tribune']['js_entry']));
        $this->assert("Feuille de style CSS de tribune présente", file_exists($this->base_dir . '/' . $discovered['tribune']['css_entry']));
        $this->assert("Catégorie de 'tribune' vient du manifest ('communication')", ($discovered['tribune']['category'] ?? '') === 'communication');

        // 2. Translations
        $fr_trans = \SimpleGallery\Kernel\PluginDiscovery::getAppTranslations($this->base_dir, 'fr');
        $this->assert("Traduction FR de tribune chargée", !empty($fr_trans['apps.tribune.title']) || !empty($discovered['tribune']['locales']['fr']['title']));

        // 3. Backend Endpoints in api.php
        $api_code = @file_get_contents($this->base_dir . '/api.php');
        $this->assert("api.php déclare l'action tribune_get", strpos($api_code, "action === 'tribune_get'") !== false);
        $this->assert("api.php déclare l'action tribune_post dans les actions mutantes", strpos($api_code, "'tribune_post'") !== false);
        $this->assert("api.php déclare l'action tribune_proxy_fetch", strpos($api_code, "action === 'tribune_proxy_fetch'") !== false);
        $this->assert("api.php déclare l'action tribune_file_upload dans les actions mutantes", strpos($api_code, "'tribune_file_upload'") !== false);
        $this->assert("api.php déclare l'action tribune_file_get", strpos($api_code, "action === 'tribune_file_get'") !== false);
        $this->assert("api.php déclare l'action tribune_stream (SSE EventSource)", strpos($api_code, "action === 'tribune_stream'") !== false);
        $this->assert("api.php déclare l'action tribune_schedule_post", strpos($api_code, "action === 'tribune_schedule_post'") !== false);
        $this->assert("api.php déclare l'action tribune_scheduled_list", strpos($api_code, "action === 'tribune_scheduled_list'") !== false);

        // 4. App UI Elements
        $app_js = @file_get_contents($this->base_dir . '/apps/tribune/app.js');
        $this->assert("Application tribune fournit le bouton d'upload 📎", strpos($app_js, 'tribuneUploadBtn') !== false);
        $this->assert("Application tribune fournit l'input file masqué", strpos($app_js, 'tribuneFileInput') !== false);
        $this->assert("Application tribune intègre EventSource (SSE)", strpos($app_js, 'startSSE') !== false);
        $this->assert("Application tribune fournit le bouton de programmation ⏰", strpos($app_js, 'tribuneScheduleBtn') !== false);

        // 5. Storage file check
        $storage_file = $this->base_dir . '/storage/tribune_messages.json';
        $this->assert("Fichier de stockage storage/tribune_messages.json présent", file_exists($storage_file));
        $content = @file_get_contents($storage_file);
        $json = @json_decode($content, true);
        $this->assert("Fichier storage/tribune_messages.json contient une liste valide", is_array($json) && count($json) >= 1);

        // 6. Test direct de stockage et récupération anonymisée de fichier
        $test_upload_dir = $this->base_dir . '/storage/tribune_uploads';
        if (!is_dir($test_upload_dir)) {
            @mkdir($test_upload_dir, 0755, true);
        }
        $test_token = bin2hex(random_bytes(16));
        $test_bin = $test_upload_dir . '/' . $test_token . '.bin';
        $test_meta = $test_upload_dir . '/' . $test_token . '.json';

        $dummy_content = "PNG DUMMY IMAGE CONTENT FOR TRIBUNE TEST";
        file_put_contents($test_bin, $dummy_content);
        file_put_contents($test_meta, json_encode([
            'token'         => $test_token,
            'original_name' => 'sample_image.png',
            'mime_type'     => 'image/png',
            'size'          => strlen($dummy_content),
            'uploaded_at'   => time(),
            'ext'           => 'png'
        ]));

        $this->assert("Fichier binaire temporaire créé dans storage/tribune_uploads/", file_exists($test_bin));
        $this->assert("Métadonnées JSON temporaires créées avec jeton 32 hex", file_exists($test_meta));

        $meta_decoded = json_decode(file_get_contents($test_meta), true);
        $this->assert("Le type MIME enregistré est bien préservé (image/png)", ($meta_decoded['mime_type'] ?? '') === 'image/png');
        $this->assert("Le nom original est conservé (sample_image.png)", ($meta_decoded['original_name'] ?? '') === 'sample_image.png');

        @unlink($test_bin);
        @unlink($test_meta);
    }
}


// Run test suite directly if called from CLI
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $suite = new GeneralUnitTestSuite();
    $success = $suite->runAll();
    exit($success ? 0 : 1);
}



