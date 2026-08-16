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
    private string $base_dir;
    private string $test_dir;
    private int $passed = 0;
    private int $failed = 0;
    private array $results = [];

    public function __construct() {
        $this->base_dir = realpath(dirname(__DIR__)) ?: dirname(__DIR__);
        $this->base_dir = str_replace('\\', '/', $this->base_dir);

        // Create temporary test environment folder
        $this->test_dir = $this->base_dir . '/tmp_general_unit_test_' . time() . '_' . mt_rand(1000, 9999);
        if (!is_dir($this->test_dir)) {
            @mkdir($this->test_dir, 0755, true);
        }

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
        $img_results = search_gallery_recursive($search_dir, $this->base_dir, [
            'category' => 'image',
            'recursive' => true
        ], $ignore_list ?: [], $media_types_config);

        $this->assert("Filtre catégorie 'image' trouve uniquement les photos", count($img_results) === 1 && $img_results[0]['name'] === 'vacances_plage.jpg');

        // 2. Word Search in Comments
        $comment_results = search_gallery_recursive($search_dir, $this->base_dir, [
            'words' => 'festival',
            'category' => 'all',
            'recursive' => true
        ], $ignore_list ?: [], $media_types_config);

        $this->assert("Recherche de mots dans les légendes .comment", count($comment_results) === 1 && $comment_results[0]['name'] === 'concert_rock.mp4');
    }

    /**
     * 6. Multi-Format Archive Generation Engine Tests
     */
    private function testArchiveGenerationEngine(): void {
        echo "\n📦 [6/7] Test de la Génération d'Archives Zip...\n";

        $arch_dir = $this->test_dir . '/archive_test';
        mkdir($arch_dir, 0755, true);
        file_put_contents($arch_dir . '/photo.jpg', 'fake image data');
        file_put_contents($arch_dir . '/secret.php', '<?php echo "hidden";'); // Should be excluded!

        $out_zip = $this->test_dir . '/test_output.zip';
        global $ignore_list;

        $created = create_archive('zip', $arch_dir, $out_zip, $this->base_dir, $ignore_list ?: []);
        $this->assert("Création d'archive Zip", $created === true && file_exists($out_zip) && filesize($out_zip) > 0);

        if ($created && class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($out_zip) === true) {
                $has_jpg = ($zip->locateName('photo.jpg') !== false);
                $has_php = ($zip->locateName('secret.php') !== false);
                $zip->close();
                $this->assert("L'archive contient les photos", $has_jpg === true);
                $this->assert("L'archive exclut le code PHP de sécurité", $has_php === false);
            }
        }

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
}


// Run test suite directly if called from CLI
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $suite = new GeneralUnitTestSuite();
    $success = $suite->runAll();
    exit($success ? 0 : 1);
}
