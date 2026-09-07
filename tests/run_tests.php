<?php
/**
 * SimpleGallery 2026 - CLI Test Suite Runner
 * Executes both Security & General Functional unit test suites.
 * Usage: php tests/run_tests.php
 */

require_once __DIR__ . '/SecurityUnitTest.php';
require_once __DIR__ . '/GeneralUnitTest.php';

$sec_suite = new SecurityUnitTestSuite();
$sec_passed = $sec_suite->runAll();

$gen_suite = new GeneralUnitTestSuite();
$gen_passed = $gen_suite->runAll();

$js_passed = true;
$node_bin = shell_exec('where node 2>nul') ? 'node' : null;
if ($node_bin) {
    echo "\n⚡ Exécution du Banc de Tests Runtime JS & Iso-Fonctionnalité (Node.js)...\n";
    passthru('node ' . escapeshellarg(__DIR__ . '/test_js_runtime.mjs'), $js_exit_code);
    $js_passed = ($js_exit_code === 0);
}

$all_passed = ($sec_passed && $gen_passed && $js_passed);
exit($all_passed ? 0 : 1);

