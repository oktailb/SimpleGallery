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

$all_passed = ($sec_passed && $gen_passed);
exit($all_passed ? 0 : 1);

