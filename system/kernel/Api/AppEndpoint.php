<?php
namespace SimpleGallery\Kernel\Api;

use SimpleGallery\Kernel\Security\SecurityManager;
use SimpleGallery\Kernel\Security\CsrfManager;

/**
 * SimpleGallery WebOS - Unified App API Endpoint Gateway
 * Standardizes session management, JSON parsing, CSRF verification, error handling, and response delivery for app backends.
 */
class AppEndpoint {

    /**
     * Run an app API action handler with standard boilerplate handling
     * 
     * @param string $app_id Application identifier (e.g. 'tribune', 'sim-maintenance')
     * @param callable $handler Function signature: fn(string $action, array $params, array $context): ?array
     * @param array $options Configuration options (e.g. ['mutating_actions' => [...], 'require_admin' => [...]])
     */
    public static function handle(string $app_id, callable $handler, array $options = []): void {
        global $real_base_dir, $ignore_list, $media_types, $gallery_title, $thumbnail_dir;

        // Ensure session is active
        if (function_exists('ensure_session_started')) {
            ensure_session_started();
        } else {
            SecurityManager::ensureSessionStarted();
        }

        // Set JSON Header
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
        }

        // Resolve Action
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

        if (empty($action)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Action requise.']);
            exit;
        }

        $mutating_actions = $options['mutating_actions'] ?? [];
        $admin_actions = $options['require_admin'] ?? [];

        // Verify CSRF token for mutating actions
        if (in_array($action, $mutating_actions, true)) {
            $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? $raw_body['csrf_token'] ?? '';
            if (!SecurityManager::verifyCsrfToken($csrf)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Jeton CSRF invalide ou expiré.']);
                exit;
            }
        }

        // Verify Admin permission if required
        if (in_array($action, $admin_actions, true)) {
            if (!SecurityManager::isAdminLoggedIn()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Privilèges administrateur requis.']);
                exit;
            }
        }

        $base_dir = $real_base_dir ?? (defined('SIMPLE_GALLERY_CORE') ? dirname(dirname(dirname(__DIR__))) : dirname(dirname(dirname(__DIR__))));
        $params = array_merge($_GET, $_POST, $raw_body);

        $context = [
            'app_id'        => $app_id,
            'base_dir'      => $base_dir,
            'ignore_list'   => $ignore_list ?? [],
            'media_types'   => $media_types ?? [],
            'gallery_title' => $gallery_title ?? 'SimpleGallery',
            'thumbnail_dir' => $thumbnail_dir ?? '.thumbnails',
            'raw_body'      => $raw_body,
            'is_admin'      => SecurityManager::isAdminLoggedIn()
        ];

        try {
            $result = $handler($action, $params, $context);

            if ($result === null) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => "Action '{$action}' inconnue pour l'application {$app_id}."]);
                exit;
            }

            $status = $result['status'] ?? 200;
            $data = $result['data'] ?? $result;

            http_response_code($status);

            if (function_exists('sanitize_utf8')) {
                $data = sanitize_utf8($data);
            }

            echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            exit;

        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error'   => 'Erreur interne de traitement : ' . $e->getMessage()
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}
