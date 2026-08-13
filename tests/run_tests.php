<?php
/**
 * SimpleGallery 2026 - CLI Security Test Runner
 * Usage: php tests/run_tests.php
 */

require_once __DIR__ . '/SecurityUnitTest.php';

$suite = new SecurityUnitTestSuite();
$passed = $suite->runAll();
exit($passed ? 0 : 1);
