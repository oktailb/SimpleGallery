<?php
/**
 * SimpleGallery WebOS - Kernel API Gateway
 * Minimal, secure, modular REST/JSON syscall dispatcher.
 */

$project_root = dirname(dirname(__DIR__));
require_once $project_root . '/system/boot/bootstrap.php';
require_once $project_root . '/system/kernel/functions.php';

use SimpleGallery\Kernel\Actions\ActionRouter;
use SimpleGallery\Kernel\Security\SecurityManager;

ensure_session_started();

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? $_POST['action'] ?? null;
$raw_body = [];
$request_method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($request_method === 'POST') {

    $content_type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($content_type, 'application/json') !== false) {
        $raw_input = file_get_contents('php://input');
        if ($raw_input) {
            $raw_body = (array)@json_decode($raw_input, true);
            if (empty($action) && isset($raw_body['action'])) {
                $action = (string)$raw_body['action'];
            }
        }
    }
}

$action = $action ?? 'get_gallery';

// CSRF Verification on modifying actions
if (in_array($action, ActionRouter::MUTATING_ACTIONS, true)) {
    $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? $raw_body['csrf_token'] ?? '';
    if (!SecurityManager::verifyCsrfToken($csrf)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => __t('api.err_invalid_csrf', [], null, $real_base_dir)]);
        exit;
    }
}

$result = ActionRouter::dispatch(
    $action,
    $raw_body,
    $real_base_dir,
    $ignore_list,
    $media_types,
    $gallery_title,
    $thumbnail_dir ?? '.thumbnails'
);

if ($result === null) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => __t('api.err_unknown_action', [], null, $real_base_dir)]);
    exit;
}

http_response_code($result['status'] ?? 200);
$data = $result['data'] ?? $result;
if (function_exists('sanitize_utf8')) {
    $data = sanitize_utf8($data);
}

echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
exit;
