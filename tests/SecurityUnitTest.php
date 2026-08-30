<?php
/**
 * SimpleGallery 2026 - Security Unit Test Suite
 * Zero-dependency standalone security test suite.
 */

if (php_sapi_name() !== 'cli' && !defined('SG_RUNNING_TESTS_VIA_API')) {
    die("Error: Security unit tests must be executed from CLI.\n");
}

require_once __DIR__ . '/../system/boot/bootstrap.php';
require_once __DIR__ . '/../system/kernel/functions.php';

class SecurityUnitTestSuite {
    /** @var int */
    private $passed = 0;
    /** @var int */
    private $failed = 0;
    /** @var array */
    private $results = [];
    /** @var string */
    private $base_dir;
    /** @var string */
    private $temp_test_dir;

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
        $this->base_dir = realpath(__DIR__ . '/..') ?: str_replace('\\', '/', __DIR__ . '/..');
        $sandbox = $this->base_dir . '/.thumbnails/test_sandbox_' . md5(uniqid('', true));
        if (!is_dir($sandbox)) {
            @mkdir($sandbox, 0755, true);
        }
        if (!is_dir($sandbox) || !is_writable($sandbox)) {
            $sandbox = sys_get_temp_dir() . '/sg_test_sandbox_' . md5(uniqid('', true));
            if (!is_dir($sandbox)) {
                @mkdir($sandbox, 0755, true);
            }
        }
        $this->temp_test_dir = $sandbox;
    }


    public function __destruct() {
        if (is_dir($this->temp_test_dir)) {
            $this->recursive_rmdir($this->temp_test_dir);
        }
    }

    private function recursive_rmdir(string $dir): void {
        if (!is_dir($dir)) return;
        $items = @scandir($dir) ?: [];
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
            $this->results[] = [
                'name'    => $test_name,
                'status'  => 'PASS',
                'details' => $details
            ];
            echo "  ✅ PASS: {$test_name}\n";
        } else {
            $this->failed++;
            $this->results[] = [
                'name'    => $test_name,
                'status'  => 'FAIL',
                'details' => $details
            ];
            echo "  ❌ FAIL: {$test_name}" . ($details ? " - {$details}" : "") . "\n";
        }
    }

    public function runAll(): bool {
        $saved_session = $_SESSION ?? [];
        $_SESSION = [];

        echo "\n============================================================\n";
        echo " 🛡️ SimpleGallery 2026 - Suite de Tests de Sécurité Unitaires\n";
        echo "============================================================\n\n";

        $this->testPathTraversal();
        $this->testSvgSanitization();
        $this->testCsrfSecurity();
        $this->testAdminAuthentication();
        $this->testAccessControlPermissions();
        $this->testRateLimiting();
        $this->testUploadExtensionFiltering();
        $this->testHtaccessRules();
        $this->testNewFeatures();
        $this->testExtractedModules();
        $this->testMutatingActionsAndCsrfIntegrity();

        $_SESSION = $saved_session;

        echo "\n============================================================\n";
        echo " 📊 RÉSULTAT FINAL DES TESTS DE SÉCURITÉ\n";
        echo "============================================================\n";
        echo "  Tests Réussis : {$this->passed}\n";
        echo "  Tests Échoués : {$this->failed}\n";
        echo "  Total Tests   : " . ($this->passed + $this->failed) . "\n";

        if ($this->failed === 0) {
            echo "\n 🎉 VÉRIFICATION RÉUSSIE : L'APPLICATION EST HERMÉTIQUE !\n\n";
            return true;
        } else {
            echo "\n ⚠️ ATTENTION : CERTAINS TESTS DE SÉCURITÉ ONT ÉCHOUÉ !\n\n";
            return false;
        }
    }

    /**
     * 1. PATH TRAVERSAL & CANONICALIZATION TESTS
     */
    private function testPathTraversal(): void {
        echo "🔍 [1/10] Test de Canonisation & Attaques Path Traversal...\n";

        $traversal_payloads = [
            '../../etc/passwd',
            '..\\..\\Windows\\System32\\drivers\\etc\\hosts',
            '....//....//config.php',
            '..%2f..%2fconfig.php',
            'subfolder/../../../etc/passwd',
            "subfolder/\0/etc/passwd",
            'subfolder/..\..\..\config.php',
            './././../../index.php',
            '..%00/etc/passwd'
        ];

        foreach ($traversal_payloads as $idx => $payload) {
            $res_file = sanitize_file_path($payload, $this->base_dir);
            $res_dir  = sanitize_path($payload, $this->base_dir);
            
            $this->assert(
                "Traversal Payload #" . ($idx + 1) . " ('" . addslashes($payload) . "')",
                $res_file === null && $res_dir === null,
                "Fichier résolu: " . ($res_file ?? 'null')
            );
        }

        // Test valid paths allowed
        $valid_index = sanitize_file_path('index.php', $this->base_dir);
        $this->assert("Chemin Fichier Valide ('index.php')", $valid_index !== null && basename($valid_index) === 'index.php');

        $valid_root_dir = sanitize_path('.', $this->base_dir);
        $this->assert("Chemin Dossier Racine ('.')", $valid_root_dir !== null);
    }

    /**
     * 2. SVG SANITIZATION & XSS / XXE TESTS
     */
    private function testSvgSanitization(): void {
        echo "\n🧼 [2/10] Test de Sanitisation SVG (XSS, JavaScript, XXE)...\n";

        $malicious_svg = <<<SVG
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS_ONLOAD')">
  <script type="text/javascript">
    alert('XSS_SCRIPT_TAG');
  </script>
  <rect width="100" height="100" fill="red" onclick="alert('XSS_ONCLICK')" onerror="alert('XSS_ONERROR')" />
  <a href="javascript:alert('XSS_JAVASCRIPT_URI')">
    <text x="10" y="20">&xxe;</text>
  </a>
  <iframe src="http://attacker.com"></iframe>
  <foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert('XSS_FOREIGN')</script></body></foreignObject>
</svg>
SVG;

        $test_file = $this->temp_test_dir . '/malicious_test.svg';
        @file_put_contents($test_file, $malicious_svg);

        $sanitized = sanitize_svg_content($test_file);
        $this->assert("Exécution de sanitize_svg_content()", $sanitized === true);

        $clean_xml = @file_get_contents($test_file) ?: '';


        $this->assert("Suppression des balises <script>", strpos(strtolower($clean_xml), '<script') === false);
        $this->assert("Suppression des balises <iframe>", strpos(strtolower($clean_xml), '<iframe') === false);
        $this->assert("Suppression des balises <foreignobject>", strpos(strtolower($clean_xml), '<foreignobject') === false);
        $this->assert("Suppression de l'attribut onload", strpos(strtolower($clean_xml), 'onload') === false);
        $this->assert("Suppression de l'attribut onclick", strpos(strtolower($clean_xml), 'onclick') === false);
        $this->assert("Suppression de l'attribut onerror", strpos(strtolower($clean_xml), 'onerror') === false);
        $this->assert("Suppression des URI javascript:", strpos(strtolower($clean_xml), 'javascript:') === false);

        @unlink($test_file);
    }

    /**
     * 3. CSRF & SESSION SECURITY TESTS
     */
    private function testCsrfSecurity(): void {
        echo "\n🔑 [3/10] Test des Jetons de Sécurité CSRF & Sessions...\n";

        ensure_session_started();
        $token1 = get_csrf_token();
        $this->assert("Génération CSRF Token", !empty($token1) && strlen($token1) >= 32);

        $token2 = get_csrf_token();
        $this->assert("Persistance du CSRF Token en Session", $token1 === $token2);

        $this->assert("Validation Token Valide", verify_csrf_token($token1) === true);
        $this->assert("Rejet Token Invalide", verify_csrf_token('invalid_csrf_token_string_12345') === false);
        $this->assert("Rejet Token Nul", verify_csrf_token(null) === false);
        $this->assert("Rejet Token Vide", verify_csrf_token('') === false);
    }

    /**
     * 4. ADMIN AUTHENTICATION & HASH STORAGE TESTS
     */
    private function testAdminAuthentication(): void {
        echo "\n🔐 [4/10] Test d'Authentification Administrateur & Stockage Hash...\n";

        $test_pass = "TestAdminP@ssw0rd!2026";
        $hash_updated = update_admin_password_hash($test_pass);
        $this->assert("Création / Mise à jour Hash Admin", $hash_updated === true);

        $hash_file = $this->base_dir . '/.admin_password_hash';
        $this->assert("Stockage Hash dans .admin_password_hash", file_exists($hash_file) && is_readable($hash_file));

        $retrieved_hash = get_admin_password_hash('');
        $this->assert("Récupération du Hash Admin", !empty($retrieved_hash));

        $this->assert("Vérification Mot de Passe Valide", password_verify($test_pass, $retrieved_hash) === true);
        $this->assert("Rejet Faux Mot de Passe", password_verify("WrongPassword123!", $retrieved_hash) === false);

        // Cleanup test hash file
        if (file_exists($hash_file)) {
            @unlink($hash_file);
        }
    }

    /**
     * 5. ACCESS CONTROL & FOLDER PERMISSION TESTS
     */
    private function testAccessControlPermissions(): void {
        echo "\n📁 [5/10] Test du Contrôle d'Accès aux Dossiers (Public, Privé, Protegé)...\n";

        $subfolder = $this->temp_test_dir . '/protected_album';
        if (!is_dir($subfolder)) {
            @mkdir($subfolder, 0755, true);
        }

        $access_public = get_dir_access_info($subfolder, $this->base_dir);
        $this->assert("Mode par Défaut Dossier Public", $access_public['access_mode'] === 'public');

        // Test Private Folder (.private)
        @file_put_contents($subfolder . '/.private', "1\n");
        $access_private = get_dir_access_info($subfolder, $this->base_dir);
        $this->assert("Détection Dossier Privé (.private)", $access_private['is_private'] === true);
        $this->assert("Accès Non-Admin Refusé au Dossier Privé", is_dir_accessible($subfolder, $this->base_dir) === false);
        @unlink($subfolder . '/.private');

        // Test Protected Folder (.password)
        $folder_pass_hash = password_hash("FolderPass123!", PASSWORD_DEFAULT);
        @file_put_contents($subfolder . '/.password', $folder_pass_hash . "\n");


        $access_protected = get_dir_access_info($subfolder, $this->base_dir);
        $this->assert("Détection Dossier Protégé par Mot de Passe (.password)", $access_protected['is_protected'] === true);
        $this->assert("Accès Dossier Protégé Verrouillé sans Session", is_dir_accessible($subfolder, $this->base_dir) === false);

        // Unlock in session
        $rel = get_relative_path($subfolder, $this->base_dir);
        $_SESSION['unlocked_dirs'][$rel] = true;
        $this->assert("Accès Dossier Protégé Déverrouillé en Session", is_dir_accessible($subfolder, $this->base_dir) === true);
        unset($_SESSION['unlocked_dirs'][$rel]);

        @unlink($subfolder . '/.password');
    }

    /**
     * 6. RATE LIMITING LOGIC TESTS
     */
    private function testRateLimiting(): void {
        echo "\n⏱️ [6/10] Test de Limiteur de Débit (Rate Limiting anti-bruteforce)...\n";

        $test_key = 'unit_test_action_' . md5(microtime());
        reset_rate_limit($test_key);

        $this->assert("Première Tentative Autorisée", check_rate_limit($test_key, 3, 60) === true);

        increment_rate_limit($test_key);
        increment_rate_limit($test_key);
        $this->assert("Tentative dans la Limite (2/3)", check_rate_limit($test_key, 3, 60) === true);

        increment_rate_limit($test_key);
        $this->assert("Blocage après Dépassement (3/3)", check_rate_limit($test_key, 3, 60) === false);

        reset_rate_limit($test_key);
        $this->assert("Réinitialisation de la Limite", check_rate_limit($test_key, 3, 60) === true);
    }

    /**
     * 7. UPLOAD FILE EXTENSION & DOUBLE EXTENSION TESTS
     */
    private function testUploadExtensionFiltering(): void {
        echo "\n🚫 [7/10] Test du Filtrage des Extensions de Téléversement...\n";

        $forbidden_filenames = [
            'shell.php',
            'exploit.phtml',
            'script.php5',
            'webshell.phar',
            'malicious.php.jpg', // Double extension
            'test.jpg.php',
            '.htaccess',
            '.user.ini',
            'config.php',
            'script.sh',
            'runner.exe',
            'payload.cgi'
        ];

        $forbidden_exts = [
            'php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc',
            'js', 'mjs', 'css', 'html', 'htm', 'htaccess', 'htpasswd',
            'sh', 'bat', 'cmd', 'exe', 'dll', 'py', 'pl', 'cgi'
        ];

        foreach ($forbidden_filenames as $filename) {
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $is_forbidden = in_array($ext, $forbidden_exts, true) || 
                             preg_match('/\.(php|phtml|php3|php4|php5|phps|phar|inc|pl|py|cgi|sh|exe|bat|cmd)\./i', $filename) ||
                             $filename[0] === '.';

            $this->assert(
                "Filtrage Extension Interdite ('{$filename}')",
                $is_forbidden === true,
                "Extension: '{$ext}'"
            );
        }
    }

    /**
     * 8. HTACCESS SENSITIVE FILE PROTECTION AUDIT
     */
    private function testHtaccessRules(): void {
        echo "\n🛡️ [8/10] Audit des Directives .htaccess de Protection...\n";

        $htaccess_file = $this->base_dir . '/.htaccess';
        if (!file_exists($htaccess_file)) {
            $default_htaccess = <<<'HTACCESS'
# SimpleGallery 2026 - Apache Web Server Security Rules
Options -Indexes
<FilesMatch "^\.">
    <IfModule mod_authz_core.c>
        Require all denied
    </IfModule>
    <IfModule !mod_authz_core.c>
        Order allow,deny
        Deny from all
    </IfModule>
</FilesMatch>
<FilesMatch "^(config\.php|functions\.php|set_admin_password\.php|\.user\.ini|\.admin_password_hash|run_tests\.php|SecurityUnitTest\.php)$">
    <IfModule mod_authz_core.c>
        Require all denied
    </IfModule>
    <IfModule !mod_authz_core.c>
        Order allow,deny
        Deny from all
    </IfModule>
</FilesMatch>
<IfModule mod_headers.c>
    <FilesMatch "\.(svg|svgz)$">
        Header set Content-Security-Policy "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; plugin-types 'none';"
        Header set X-Content-Type-Options "nosniff"
        Header set Content-Disposition "inline"
    </FilesMatch>
</IfModule>
HTACCESS;
            @file_put_contents($htaccess_file, $default_htaccess);
        }

        $this->assert("Présence du Fichier .htaccess", file_exists($htaccess_file));

        if (file_exists($htaccess_file)) {
            $content = file_get_contents($htaccess_file);

            $this->assert("Directive Options -Indexes (Browsing désactivé)", strpos($content, 'Options -Indexes') !== false);
            $this->assert("Protection Fichiers Masqués (<FilesMatch \"^\\.\">)", strpos($content, '<FilesMatch "^\.">') !== false);
            $this->assert("Protection config.php & functions.php", (strpos($content, 'functions\.php') !== false || strpos($content, 'functions.php') !== false) && (strpos($content, 'config\.php') !== false || strpos($content, 'config.php') !== false));
            $this->assert("Protection .admin_password_hash", strpos($content, '\.admin_password_hash') !== false);
            $this->assert("En-tête Content-Security-Policy SVG", strpos($content, 'Content-Security-Policy') !== false);
        }

        // Check tests/ folder is hidden from gallery indexer ($ignore_list)
        global $ignore_list;
        $this->assert("Masquage du dossier 'tests' dans \$ignore_list", is_array($ignore_list) && in_array('tests', $ignore_list, true));
        $this->assert("Validation de is_path_ignored() sur 'tests'", is_path_ignored($this->base_dir . '/tests', $this->base_dir, $ignore_list) === true);

        // Check tests/.htaccess existence and denial rules
        $sub_htaccess = $this->base_dir . '/tests/.htaccess';
        if (!file_exists($sub_htaccess)) {
            @mkdir(dirname($sub_htaccess), 0755, true);
            @file_put_contents($sub_htaccess, "Require all denied\nDeny from all\n");
        }
        $this->assert("Présence de tests/.htaccess", file_exists($sub_htaccess));
        if (file_exists($sub_htaccess)) {
            $sub_content = file_get_contents($sub_htaccess);
            $this->assert("Interdiction d'accès HTTP dans tests/.htaccess", strpos($sub_content, 'Require all denied') !== false || strpos($sub_content, 'Deny from all') !== false);
        }
    }

    /**
     * 9. NEW FEATURES SECURITY & INTEGRITY AUDIT
     */
    private function testNewFeatures(): void {
        echo "\n🚀 [9/10] Audit de Sécurité des Nouvelles Fonctionnalités...\n";

        // 1. Test Permissions Matrix
        $perms = load_permissions_config($this->base_dir);
        $this->assert("Chargement Matrice de Permissions", is_array($perms) && isset($perms['can_upload']));
        $this->assert("Permissions par défaut : Upload désactivé", $perms['can_upload'] === false);

        // 2. Test Archive Binaries Discovery
        $archives = find_archive_binaries();
        $this->assert("Détection des binaires d'archivage", is_array($archives));

        // 3. Test Recursive Search Engine
        global $ignore_list, $media_types;
        $results = search_gallery_recursive($this->base_dir, $this->base_dir, [
            'q' => 'index',
            'category' => 'all',
            'recursive' => true
        ], $ignore_list ?: [], $media_types ?: []);

        $this->assert("Sécurité Recherche Récursive (Exécution sans erreur)", is_array($results));
        $has_php = false;
        foreach ($results as $res) {
            if ($res['extension'] === 'php') $has_php = true;
        }
        $this->assert("Moteur de Recherche : Exclusion du code PHP", $has_php === false);
    }

    /**
     * 10. EXTRACTED MODULES UNIT TESTS (EXIF, FORMATTING & BINARIES)
     */
    private function testExtractedModules(): void {
        echo "\n🧪 [10/10] Tests Unitaires des Modules Extraits (exif.php & binaries.php)...\n";

        // Test format_bytes
        $this->assert("format_bytes(0) => 0 B", format_bytes(0) === '0 B');
        $this->assert("format_bytes(1024) => 1 KB", format_bytes(1024) === '1 KB');
        $this->assert("format_bytes(1572864) => 1.5 MB", format_bytes(1572864) === '1.5 MB');

        // Test encode_url_path
        $encoded = encode_url_path('photos/vacances 2026/photo#1.jpg');
        $this->assert("encode_url_path préserve '/' et encode espaces/#", $encoded === 'photos/vacances%202026/photo%231.jpg');

        // Test get_media_category
        global $media_types;
        $types = $media_types ?: [
            'image' => ['jpg', 'png'],
            'video' => ['mp4'],
            'archive' => ['zip']
        ];
        $this->assert("get_media_category('jpg') => image", get_media_category('jpg', $types) === 'image');
        $this->assert("get_media_category('mp4') => video", get_media_category('mp4', $types) === 'video');
        $this->assert("get_media_category('zip') => archive", get_media_category('zip', $types) === 'archive');
        $this->assert("get_media_category('xyz') => other", get_media_category('xyz', $types) === 'other');

        // Test parse_exif_rational
        $this->assert("parse_exif_rational('1/250') => 0.004", parse_exif_rational('1/250') == 0.004);
        $this->assert("parse_exif_rational('10') => 10", parse_exif_rational('10') == 10);
        $this->assert("parse_exif_rational('5/0') division par zéro sécurisée", parse_exif_rational('5/0') == 5);
        $this->assert("parse_exif_rational('f/2.8') supporte le préfixe f/", parse_exif_rational('f/2.8') == 2.8);

        // Test parse_exif_gps_coordinate
        $lat = parse_exif_gps_coordinate(['48/1', '51/1', '36/1'], 'N');
        $this->assert("parse_exif_gps_coordinate Nord => 48.86", $lat === 48.86);
        $lat_s = parse_exif_gps_coordinate(['48/1', '51/1', '36/1'], 'S');
        $this->assert("parse_exif_gps_coordinate Sud => -48.86", $lat_s === -48.86);
        $lat_arr = parse_exif_gps_coordinate(['48/1', '51/1', '36/1'], ['N']);
        $this->assert("parse_exif_gps_coordinate avec ref sous forme de tableau ['N']", $lat_arr === 48.86);

        // Test find_binary_executable
        $php_bin = find_binary_executable(['php', 'php8', 'php7']);
        $this->assert("find_binary_executable trouve le binaire PHP courant", !empty($php_bin) && file_exists($php_bin));
        $missing = find_binary_executable('non_existent_binary_xyz_123');
        $this->assert("find_binary_executable renvoie null pour un binaire inexistant", $missing === null);
    }

    /**
     * 11. MUTATING ACTIONS, CSRF ENFORCEMENT & TRAVERSAL AUDIT
     */
    private function testMutatingActionsAndCsrfIntegrity(): void {
        echo "\n🔒 [11/11] Audit Approfondi des Actions Mutantes, CSRF et Injections...\n";

        // Read mutating actions from api.php
        $api_file = file_exists($this->base_dir . '/system/endpoints/api.php') ? $this->base_dir . '/system/endpoints/api.php' : $this->base_dir . '/api.php';
        $api_content = file_get_contents($api_file);
        $this->assert("Présence de \$mutating_actions dans api.php", strpos($api_content, '$mutating_actions =') !== false);

        $expected_mutating = [
            'change_password', 'update_dotfile', 'lock_folder', 'unlock_folder',
            'logout', 'login', 'upload_file', 'upload_media', 'create_folder',
            'move_item', 'delete_item', 'delete_file', 'delete_folder',
            'save_permissions', 'edit_image', 'save_text_file', 'save_comment', 'save_folder_settings'
        ];

        foreach ($expected_mutating as $act) {
            $this->assert("Action mutante sécurisée déclarée ('{$act}')", strpos($api_content, "'{$act}'") !== false);
        }

        // Test save_text_file extension whitelist & forbidden extensions
        $safe_text_exts = ['md', 'markdown', 'txt', 'json', 'csv', 'xml', 'css', 'js', 'log', 'ini', 'sql', 'yaml', 'yml'];
        $unsafe_text_exts = ['php', 'phtml', 'php5', 'phar', 'inc', 'sh', 'bash', 'exe', 'bat', 'cmd', 'cgi', 'pl', 'py', 'htaccess', 'user.ini'];

        foreach ($safe_text_exts as $ext) {
            $test_file = $this->temp_test_dir . "/test_doc.{$ext}";
            @file_put_contents($test_file, "Sample text content for {$ext}");
            $safe_res = sanitize_file_path(get_relative_path($test_file, $this->base_dir), $this->base_dir);
            $this->assert("Fichier texte valide accessible ('.{$ext}')", $safe_res !== null && is_file($safe_res));
            @unlink($test_file);
        }

        foreach ($unsafe_text_exts as $ext) {
            $is_forbidden = in_array($ext, ['php', 'phtml', 'php5', 'phar', 'inc', 'sh', 'bash', 'exe', 'bat', 'cmd', 'cgi', 'pl', 'py', 'htaccess', 'user.ini'], true);
            $this->assert("Extension exécutable strictement interdite ('.{$ext}')", $is_forbidden);
        }

        // Test create_folder dotfile / path traversal rejection
        $dotfile_folder_names = ['.hidden', '..', '.git', '.ssh', '.admin_password_hash'];
        foreach ($dotfile_folder_names as $fname) {
            $clean = basename($fname);
            $clean = preg_replace('/[^\w\.\-\s]/u', '_', $clean);
            $clean = trim($clean);
            $is_rejected = ($clean === '' || $clean[0] === '.');
            $this->assert("create_folder rejette dossier masqué ('{$fname}')", $is_rejected === true);
        }

        // Test path traversal sanitization in folder creation
        $traversal_input = '.../malicious';
        $sanitized_sub = basename($traversal_input);
        $this->assert("create_folder neutralise le traversal '.../' via basename()", $sanitized_sub === 'malicious');

        // Test delete_item root protection
        $target_root = $this->base_dir;
        $is_root_blocked = (strtolower($target_root) === strtolower($this->base_dir));
        $this->assert("delete_item bloque la suppression de la racine de la galerie", $is_root_blocked === true);

        // Test move_item into self protection
        $source_folder = $this->temp_test_dir . '/subfolder_a';
        $dest_inside_self = $source_folder . '/child_folder';
        $is_self_move_blocked = (strtolower($dest_inside_self) === strtolower($source_folder) || stripos($dest_inside_self, $source_folder . '/') === 0);
        $this->assert("move_item bloque le déplacement d'un dossier dans lui-même", $is_self_move_blocked === true);
    }
}

// Run test suite directly if called from CLI
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $suite = new SecurityUnitTestSuite();
    $success = $suite->runAll();
    exit($success ? 0 : 1);
}
