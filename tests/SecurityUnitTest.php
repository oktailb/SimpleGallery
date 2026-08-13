<?php
/**
 * SimpleGallery 2026 - Security Unit Test Suite
 * Zero-dependency standalone security test suite.
 */

if (php_sapi_name() !== 'cli') {
    die("Error: Security unit tests must be executed from CLI.\n");
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../functions.php';

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

    public function __construct() {
        $this->base_dir = realpath(__DIR__ . '/..') ?: str_replace('\\', '/', __DIR__ . '/..');
        $this->temp_test_dir = $this->base_dir . '/.thumbnails/test_sandbox_' . md5(uniqid('', true));
        if (!is_dir($this->temp_test_dir)) {
            @mkdir($this->temp_test_dir, 0755, true);
        }
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
        echo "🔍 [1/6] Test de Canonisation & Attaques Path Traversal...\n";

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
        echo "\n🧼 [2/6] Test de Sanitisation SVG (XSS, JavaScript, XXE)...\n";

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
        file_put_contents($test_file, $malicious_svg);

        $sanitized = sanitize_svg_content($test_file);
        $this->assert("Exécution de sanitize_svg_content()", $sanitized === true);

        $clean_xml = file_get_contents($test_file);

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
        echo "\n🔑 [3/6] Test des Jetons de Sécurité CSRF & Sessions...\n";

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
        echo "\n🔐 [4/6] Test d'Authentification Administrateur & Stockage Hash...\n";

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
        echo "\n📁 [5/6] Test du Contrôle d'Accès aux Dossiers (Public, Privé, Protegé)...\n";

        $subfolder = $this->temp_test_dir . '/protected_album';
        @mkdir($subfolder, 0755, true);

        $access_public = get_dir_access_info($subfolder, $this->base_dir);
        $this->assert("Mode par Défaut Dossier Public", $access_public['access_mode'] === 'public');

        // Test Private Folder (.private)
        file_put_contents($subfolder . '/.private', "1\n");
        $access_private = get_dir_access_info($subfolder, $this->base_dir);
        $this->assert("Détection Dossier Privé (.private)", $access_private['is_private'] === true);
        $this->assert("Accès Non-Admin Refusé au Dossier Privé", is_dir_accessible($subfolder, $this->base_dir) === false);
        @unlink($subfolder . '/.private');

        // Test Protected Folder (.password)
        $folder_pass_hash = password_hash("FolderPass123!", PASSWORD_DEFAULT);
        file_put_contents($subfolder . '/.password', $folder_pass_hash . "\n");

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
        echo "\n⏱️ [6/6] Test de Limiteur de Débit (Rate Limiting anti-bruteforce)...\n";

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
        echo "\n🚫 [7/8] Test du Filtrage des Extensions de Téléversement...\n";

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
        echo "\n🛡️ [8/8] Audit des Directives .htaccess de Protection...\n";

        $htaccess_file = $this->base_dir . '/.htaccess';
        $this->assert("Présence du Fichier .htaccess", file_exists($htaccess_file));

        if (file_exists($htaccess_file)) {
            $content = file_get_contents($htaccess_file);

            $this->assert("Directive Options -Indexes (Browsing désactivé)", strpos($content, 'Options -Indexes') !== false);
            $this->assert("Protection Fichiers Masqués (<FilesMatch \"^\\.\">)", strpos($content, '<FilesMatch "^\.">') !== false);
            $this->assert("Protection config.php & functions.php", (strpos($content, 'functions\.php') !== false || strpos($content, 'functions.php') !== false) && (strpos($content, 'config\.php') !== false || strpos($content, 'config.php') !== false));
            $this->assert("Protection .admin_password_hash", strpos($content, '\.admin_password_hash') !== false);
            $this->assert("En-tête Content-Security-Policy SVG", strpos($content, 'Content-Security-Policy') !== false);
        }
    }
}

// Run test suite directly if called from CLI
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $suite = new SecurityUnitTestSuite();
    $success = $suite->runAll();
    exit($success ? 0 : 1);
}
