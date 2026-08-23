<?php
/**
 * SimpleGallery 2026 - JSON API Endpoint with Dotfile Folder Overrides
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

require_once __DIR__ . '/config.php';

ensure_session_started();

// Rate limiting and session management imported via config.php -> functions.php


// -------------------------------------------------------------
// Admin Authentication & Action Handlers
// -------------------------------------------------------------
$raw_body = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? $_POST['action'] ?? $raw_body['action'] ?? null;

// Validate CSRF token for all state-changing actions
$mutating_actions = ['change_password', 'update_dotfile', 'lock_folder', 'unlock_folder', 'logout', 'login', 'upload_file', 'upload_media', 'create_folder', 'move_item', 'delete_item', 'delete_file', 'delete_folder', 'save_permissions', 'edit_image', 'save_text_file', 'save_comment', 'save_folder_settings', 'save_desktop_shortcuts', 'save_autostart_settings', 'clear_all_caches', 'tribune_clear_history', 'tribune_boards_save', 'tribune_file_upload', 'tribune_schedule_post', 'tribune_schedule_cancel'];
if (in_array($action, $mutating_actions, true)) {
    $submitted_csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $raw_body['csrf_token'] ?? $_POST['csrf_token'] ?? '';
    if (!verify_csrf_token($submitted_csrf)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => __t('api.err_csrf')
        ]);
        exit;
    }
}

if ($action === 'get_locales') {
    $locales = get_available_locales($real_base_dir);
    $detected = detect_browser_locale($locales, 'fr');
    echo json_encode([
        'success'   => true,
        'locales'   => $locales,
        'detected'  => $detected
    ]);
    exit;
}

if ($action === 'get_locale') {
    $code = $_GET['code'] ?? $raw_body['code'] ?? 'fr';
    $translations = load_locale_translations($real_base_dir, $code);
    echo json_encode([
        'success'      => true,
        'code'         => $code,
        'translations' => $translations
    ]);
    exit;
}

if ($action === 'view_file' || $action === 'raw_file') {
    $file_param = $_GET['file'] ?? $raw_body['file'] ?? '';
    $file_full = sanitize_file_path($file_param, $real_base_dir);
    if ($file_full === null || !is_file($file_full)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Fichier introuvable']);
        exit;
    }
    header('Location: thumb.php?file=' . rawurlencode($file_param) . '&raw=1', true, 302);
    exit;
}

if ($action === 'get_metadata') {
    $file_param = $_GET['file'] ?? $raw_body['file'] ?? '';
    $file_full = sanitize_file_path($file_param, $real_base_dir);
    if ($file_full === null || !is_file($file_full)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Fichier introuvable ou accès refusé.'
        ]);
        exit;
    }

    $ext = strtolower(pathinfo($file_full, PATHINFO_EXTENSION));
    $category = get_media_category($ext, $media_types);
    $rel_path = get_relative_path($file_full, $real_base_dir);

    $meta = get_file_unified_metadata($file_full, $rel_path, $category, $ext);

    echo json_encode([
        'success'  => true,
        'metadata' => $meta
    ]);
    exit;
}

if ($action === 'get_system_info') {
    $has_gd = extension_loaded('gd');
    $gd_info = $has_gd ? gd_info() : [];
    $has_ffmpeg = false;
    if (function_exists('exec')) {
        @exec('ffmpeg -version 2>&1', $ff_out, $ff_code);
        $has_ffmpeg = ($ff_code === 0);
    }

    $storage_dir = get_cache_storage_dir($real_base_dir, $thumbnail_dir ?? '.thumbnails');
    $cache_count = 0;
    $cache_size = 0;
    $thumbs_count = 0;
    $thumbs_size = 0;

    if (is_dir($storage_dir)) {
        $files = @scandir($storage_dir) ?: [];
        foreach ($files as $f) {
            if ($f[0] === '.') continue;
            $f_path = $storage_dir . '/' . $f;
            if (is_file($f_path)) {
                $f_size = @filesize($f_path) ?: 0;
                if (str_starts_with($f, 'cache_') && str_ends_with($f, '.json')) {
                    $cache_count++;
                    $cache_size += $f_size;
                } else {
                    $thumbs_count++;
                    $thumbs_size += $f_size;
                }
            }
        }
    }

    $mem_current = memory_get_usage(true);
    $mem_peak = memory_get_peak_usage(true);
    $disk_total = @disk_total_space($real_base_dir) ?: 0;
    $disk_free = @disk_free_space($real_base_dir) ?: 0;
    $disk_used = max(0, $disk_total - $disk_free);
    $disk_percent = $disk_total > 0 ? round(($disk_used / $disk_total) * 100, 1) : 0;

    $load_avg = function_exists('sys_getloadavg') ? @sys_getloadavg() : null;

    echo json_encode([
        'success'     => true,
        'system_info' => [
            'php_version'          => PHP_VERSION,
            'php_os'               => PHP_OS_FAMILY . ' (' . PHP_OS . ')',
            'php_sapi'             => PHP_SAPI,
            'zend_version'         => zend_version(),
            'server_software'      => $_SERVER['SERVER_SOFTWARE'] ?? 'PHP CLI / Built-in',
            'gd_available'         => $has_gd,
            'gd_webp'              => !empty($gd_info['WebP Support']),
            'gd_avif'              => !empty($gd_info['AVIF Support']),
            'exif_available'       => extension_loaded('exif'),
            'zip_available'        => class_exists('ZipArchive'),
            'intl_available'       => extension_loaded('intl'),
            'pdo_available'        => extension_loaded('pdo'),
            'sqlite_available'     => extension_loaded('pdo_sqlite') || extension_loaded('sqlite3'),
            'curl_available'       => extension_loaded('curl'),
            'mbstring_available'   => extension_loaded('mbstring'),
            'opcache_available'    => extension_loaded('Zend OPcache') || extension_loaded('opcache'),
            'ffmpeg_available'     => $has_ffmpeg,
            'upload_max_filesize'  => ini_get('upload_max_filesize'),
            'post_max_size'        => ini_get('post_max_size'),
            'memory_limit'         => ini_get('memory_limit'),
            'memory_current'       => $mem_current,
            'memory_current_fmt'   => format_bytes($mem_current),
            'memory_peak'          => $mem_peak,
            'memory_peak_fmt'      => format_bytes($mem_peak),
            'disk_total'           => $disk_total,
            'disk_total_fmt'       => format_bytes((int)$disk_total),
            'disk_free'            => $disk_free,
            'disk_free_fmt'        => format_bytes((int)$disk_free),
            'disk_used'            => $disk_used,
            'disk_used_fmt'        => format_bytes((int)$disk_used),
            'disk_used_percent'    => $disk_percent,
            'cache_count'          => $cache_count,
            'cache_size'           => $cache_size,
            'cache_size_fmt'       => format_bytes($cache_size),
            'thumbs_count'         => $thumbs_count,
            'thumbs_size'          => $thumbs_size,
            'thumbs_size_fmt'      => format_bytes($thumbs_size),
            'server_load'          => $load_avg,
            'is_admin'             => !empty($_SESSION['is_admin'])
        ]
    ]);
    exit;
}

if ($action === 'clear_all_caches') {
    if (empty($_SESSION['is_admin'])) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Action réservée à l\'administrateur.'
        ]);
        exit;
    }

    $storage_dir = get_cache_storage_dir($real_base_dir, $thumbnail_dir ?? '.thumbnails');
    $deleted_count = 0;
    $freed_bytes = 0;

    if (is_dir($storage_dir)) {
        $files = @scandir($storage_dir) ?: [];
        foreach ($files as $f) {
            if ($f[0] === '.') continue;
            $f_path = $storage_dir . '/' . $f;
            if (is_file($f_path)) {
                $freed_bytes += @filesize($f_path) ?: 0;
                if (@unlink($f_path)) {
                    $deleted_count++;
                }
            }
        }
    }

    echo json_encode([
        'success'       => true,
        'deleted_count' => $deleted_count,
        'freed_bytes'   => $freed_bytes,
        'freed_fmt'     => format_bytes($freed_bytes)
    ]);
    exit;
}

if (!defined('SG_EXEC')) {
    define('SG_EXEC', true);
}

function get_tribune_boards_file_path() {
    $p1 = __DIR__ . '/storage/tribune_boards.json';
    if (file_exists($p1)) return $p1;
    global $real_base_dir;
    $p2 = $real_base_dir . '/storage/tribune_boards.json';
    if (file_exists($p2)) return $p2;
    return $p1;
}

function get_tribune_messages_file_path() {
    $p1 = __DIR__ . '/storage/tribune_messages.json';
    if (file_exists($p1)) return $p1;
    global $real_base_dir;
    $p2 = $real_base_dir . '/storage/tribune_messages.json';
    if (file_exists($p2)) return $p2;
    return $p1;
}

function get_tribune_secrets_config() {
    $f1 = __DIR__ . '/storage/tribune_secrets.php';
    if (file_exists($f1)) {
        return include $f1;
    }
    global $real_base_dir;
    $f2 = $real_base_dir . '/storage/tribune_secrets.php';
    if (file_exists($f2)) {
        return include $f2;
    }
    return [];
}

function get_tribune_oauth_secret($board_id, $key = 'client_secret') {
    $env_key = 'GB2C_' . strtoupper($board_id) . '_' . strtoupper($key);
    $env_val = getenv($env_key);
    if (!empty($env_val)) return $env_val;

    $env_key2 = strtoupper($board_id) . '_' . strtoupper($key);
    $env_val2 = getenv($env_key2);
    if (!empty($env_val2)) return $env_val2;

    $secrets = get_tribune_secrets_config();
    if (isset($secrets[$board_id][$key]) && !empty($secrets[$board_id][$key])) {
        return $secrets[$board_id][$key];
    }

    $all_boards = get_tribune_boards_config();
    return $all_boards[$board_id]['oauth'][$key] ?? '';
}

function get_tribune_boards_config() {
    $storage_file = get_tribune_boards_file_path();
    if (file_exists($storage_file)) {
        $raw = @file_get_contents($storage_file);
        $data = @json_decode($raw, true);
        if (is_array($data) && !empty($data)) {
            return $data;
        }
    }
    return [
        'local' => [
            'name' => 'Tribune Locale',
            'type' => 'local',
            'url'  => '',
            'post_url' => '',
            'icon' => '🏠',
            'cookie_help' => 'Session locale SimpleGallery.'
        ]
    ];
}

if ($action === 'tribune_boards_get') {
    $boards = get_tribune_boards_config();
    // Security: sanitize client_secret so it is never leaked to the frontend JS client
    foreach ($boards as $bid => &$cfg) {
        if (isset($cfg['oauth']['client_secret'])) {
            unset($cfg['oauth']['client_secret']);
        }
    }
    unset($cfg);

    echo json_encode([
        'success' => true,
        'boards'  => $boards
    ]);
    exit;
}

if ($action === 'tribune_boards_save') {
    $new_boards = $_POST['boards'] ?? $raw_body['boards'] ?? null;
    if (!is_array($new_boards)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Format de configuration invalide.']);
        exit;
    }

    $storage_file = get_tribune_boards_file_path();
    @file_put_contents($storage_file, json_encode($new_boards, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    echo json_encode([
        'success' => true,
        'message' => 'Configuration des tribunes sauvegardée.'
    ]);
    exit;
}

if ($action === 'tribune_oauth_authorize') {
    $board_id = trim($_GET['board_id'] ?? $_POST['board_id'] ?? $raw_body['board_id'] ?? '');
    $all_boards = get_tribune_boards_config();
    $board_cfg = $all_boards[$board_id] ?? null;
    $oauth_cfg = $board_cfg['oauth'] ?? null;

    if (!$oauth_cfg || empty($oauth_cfg['authorize_url'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Configuration OAuth2 manquante pour cette tribune.']);
        exit;
    }

    $client_id = !empty($oauth_cfg['client_id']) ? $oauth_cfg['client_id'] : get_tribune_oauth_secret($board_id, 'client_id');
    if (empty($client_id)) {
        $client_id = 'simplegallery_webos';
    }

    $state = bin2hex(random_bytes(16));
    $_SESSION['tribune_oauth_state_' . $board_id] = $state;

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
    $base_uri = $scheme . '://' . $host . strtok($_SERVER['REQUEST_URI'], '?');
    $redirect_uri = !empty($oauth_cfg['redirect_uri']) ? $oauth_cfg['redirect_uri'] : ($base_uri . '?action=tribune_oauth_callback&board_id=' . urlencode($board_id));

    $params = [
        'client_id'     => $client_id,
        'response_type' => 'code',
        'scope'         => $oauth_cfg['scope'] ?? 'account board',
        'redirect_uri'  => $redirect_uri,
        'state'         => $state
    ];

    $authorize_url = $oauth_cfg['authorize_url'] . '?' . http_build_query($params);

    if (isset($_GET['raw_url']) || isset($raw_body['raw_url'])) {
        echo json_encode(['success' => true, 'authorize_url' => $authorize_url]);
        exit;
    }

    header('Location: ' . $authorize_url, true, 302);
    exit;
}

if ($action === 'tribune_oauth_callback') {
    $board_id = trim($_GET['board_id'] ?? '');
    $code = trim($_GET['code'] ?? '');
    $state = trim($_GET['state'] ?? '');

    $all_boards = get_tribune_boards_config();
    $board_cfg = $all_boards[$board_id] ?? null;
    $oauth_cfg = $board_cfg['oauth'] ?? null;

    if (!$oauth_cfg || empty($oauth_cfg['token_url']) || empty($code)) {
        echo '<!DOCTYPE html><html><body><script>
            alert("Erreur lors de l\'authentification OAuth : Code ou configuration manquant.");
            window.close();
        </script></body></html>';
        exit;
    }

    $client_id = !empty($oauth_cfg['client_id']) ? $oauth_cfg['client_id'] : get_tribune_oauth_secret($board_id, 'client_id');
    $client_secret = get_tribune_oauth_secret($board_id, 'client_secret');

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
    $base_uri = $scheme . '://' . $host . strtok($_SERVER['REQUEST_URI'], '?');
    $redirect_uri = !empty($oauth_cfg['redirect_uri']) ? $oauth_cfg['redirect_uri'] : ($base_uri . '?action=tribune_oauth_callback&board_id=' . urlencode($board_id));

    $post_fields = [
        'client_id'     => $client_id,
        'client_secret' => $client_secret,
        'code'          => $code,
        'grant_type'    => 'authorization_code',
        'redirect_uri'  => $redirect_uri
    ];

    $post_data = http_build_query($post_fields);
    $headers = [
        "Content-Type: application/x-www-form-urlencoded",
        "User-Agent: SimpleGallery-WebOS/1.0"
    ];

    $res = http_request_proxy($oauth_cfg['token_url'], 'POST', $headers, $post_data, 10);
    $data = @json_decode($res['body'], true) ?: [];
    $token = $data['access_token'] ?? '';
    $login = $data['login'] ?? '';

    if (empty($login) && !empty($token)) {
        $me_res = http_request_proxy("https://linuxfr.org/api/v1/me?bearer_token=" . urlencode($token), 'GET', ["User-Agent: SimpleGallery-WebOS/1.0"], null, 5);
        $me_data = @json_decode($me_res['body'], true) ?: [];
        $login = $me_data['login'] ?? $me_data['account']['login'] ?? '';
    }

    $payload_assoc = [
        'success'      => true,
        'type'         => 'tribune_oauth_success',
        'board_id'     => $board_id,
        'access_token' => $token,
        'refresh_token'=> $data['refresh_token'] ?? '',
        'expires_in'   => $data['expires_in'] ?? 0,
        'login'        => $login
    ];

    if ((isset($_GET['format']) && $_GET['format'] === 'json') ||
        (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload_assoc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    $json_payload = json_encode($payload_assoc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authentification Réussie</title>
</head>
<body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0;">
  <div style="font-size:3rem; margin-bottom:12px;">🔑</div>
  <h2 style="margin:0 0 8px 0; color:#34d399;">Connexion OAuth2 Réussie !</h2>
  <p style="color:#94a3b8; margin:0;">Fermeture de la fenêtre...</p>
  <script>
    (function() {
      var payload = ' . $json_payload . ';
      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage(payload, "*"); } catch (e) {}
      }
      setTimeout(function() { window.close(); }, 500);
    })();
  </script>
</body>
</html>';
    exit;
}

function process_scheduled_tribune_posts($real_base_dir) {
    $sched_file = $real_base_dir . '/storage/tribune_scheduled_posts.json';
    if (!file_exists($sched_file)) return;

    $fp = @fopen($sched_file, 'c+');
    if (!$fp) return;

    if (@flock($fp, LOCK_EX)) {
        $content = '';
        while (!feof($fp)) {
            $content .= fread($fp, 8192);
        }
        $scheduled = @json_decode($content, true) ?: [];
        if (empty($scheduled)) {
            @flock($fp, LOCK_UN);
            @fclose($fp);
            return;
        }

        $now = time();
        $remaining = [];
        $due_posts = [];

        foreach ($scheduled as $item) {
            if (!empty($item['scheduled_at']) && $now >= (int)$item['scheduled_at']) {
                $due_posts[] = $item;
            } else {
                $remaining[] = $item;
            }
        }

        if (!empty($due_posts)) {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode(array_values($remaining), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            fflush($fp);
            @flock($fp, LOCK_UN);
            @fclose($fp);

            foreach ($due_posts as $post) {
                $board = $post['board'] ?? 'local';
                if ($board === 'local') {
                    $storage_file = $real_base_dir . '/storage/tribune_messages.json';
                    $messages = [];
                    if (file_exists($storage_file)) {
                        $messages = @json_decode(@file_get_contents($storage_file), true) ?: [];
                    }

                    $max_id = 0;
                    foreach ($messages as $m) {
                        if (isset($m['id']) && $m['id'] > $max_id) $max_id = (int)$m['id'];
                    }

                    $post_time = $post['scheduled_at'] ?? time();
                    $new_post = [
                        'id'        => $max_id + 1,
                        'time'      => date('YmdHis', $post_time),
                        'clock'     => date('H:i:s', $post_time),
                        'login'     => $post['login'] ?? 'Anonyme',
                        'info'      => $post['info'] ?? 'SimpleGallery Scheduled',
                        'message'   => $post['message'] ?? '',
                        'is_admin'  => !empty($post['is_admin']),
                        'board'     => 'local'
                    ];

                    $messages[] = $new_post;
                    if (count($messages) > 300) {
                        $messages = array_slice($messages, -300);
                    }
                    @file_put_contents($storage_file, json_encode($messages, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
                } else {
                    if (!empty($post['target_url'])) {
                        $headers = [
                            "User-Agent: " . ($post['user_agent'] ?? 'SimpleGallery-Scheduled/1.0'),
                            "Content-Type: application/x-www-form-urlencoded"
                        ];
                        if (!empty($post['cookie'])) {
                            $headers[] = "Cookie: " . $post['cookie'];
                        }

                        $post_fields = [];
                        $field_name = $post['post_field'] ?? 'message';
                        $post_fields[$field_name] = $post['message'];

                        http_request_proxy($post['target_url'], 'POST', $headers, http_build_query($post_fields), 6);
                    }
                }
            }
        } else {
            @flock($fp, LOCK_UN);
            @fclose($fp);
        }
    } else {
        @fclose($fp);
    }
}

if ($action === 'tribune_schedule_post') {
    $msg_text    = trim($_POST['message'] ?? $raw_body['message'] ?? '');
    $login       = trim($_POST['login'] ?? $raw_body['login'] ?? 'Anonyme');
    $info        = trim($_POST['info'] ?? $raw_body['info'] ?? 'SimpleGallery Client');
    $board       = trim($_POST['board'] ?? $raw_body['board'] ?? 'local');
    $sched_ts    = (int)($_POST['scheduled_at'] ?? $raw_body['scheduled_at'] ?? 0);
    $target_url  = trim($_POST['target_url'] ?? $raw_body['target_url'] ?? '');
    $post_field  = trim($_POST['post_field'] ?? $raw_body['post_field'] ?? 'message');
    $cookie_hdr  = trim($_POST['cookie'] ?? $raw_body['cookie'] ?? '');
    $user_agent  = trim($_POST['user_agent'] ?? $raw_body['user_agent'] ?? 'SimpleGallery Client');

    if (empty($msg_text)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Le message ne peut pas être vide.']);
        exit;
    }

    if ($sched_ts <= (time() - 30)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'L\'heure programmée doit être située dans le futur.']);
        exit;
    }

    $sched_file = $real_base_dir . '/storage/tribune_scheduled_posts.json';
    $scheduled = [];
    if (file_exists($sched_file)) {
        $scheduled = @json_decode(@file_get_contents($sched_file), true) ?: [];
    }

    $id = bin2hex(random_bytes(10));
    $scheduled_item = [
        'id'           => $id,
        'message'      => $msg_text,
        'login'        => $login,
        'info'         => $info,
        'board'        => $board,
        'scheduled_at' => $sched_ts,
        'target_url'   => $target_url,
        'post_field'   => $post_field,
        'cookie'       => $cookie_hdr,
        'user_agent'   => $user_agent,
        'is_admin'     => !empty($_SESSION['is_admin']),
        'created_at'   => time()
    ];

    $scheduled[] = $scheduled_item;
    @file_put_contents($sched_file, json_encode(array_values($scheduled), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    echo json_encode([
        'success'   => true,
        'message'   => 'Message programmé avec succès.',
        'item'      => $scheduled_item,
        'count'     => count($scheduled)
    ]);
    exit;
}

if ($action === 'tribune_scheduled_list') {
    process_scheduled_tribune_posts($real_base_dir);

    $sched_file = $real_base_dir . '/storage/tribune_scheduled_posts.json';
    $scheduled = [];
    if (file_exists($sched_file)) {
        $scheduled = @json_decode(@file_get_contents($sched_file), true) ?: [];
    }

    echo json_encode([
        'success'   => true,
        'scheduled' => array_values($scheduled),
        'count'     => count($scheduled),
        'server_ts' => time()
    ]);
    exit;
}

if ($action === 'tribune_schedule_cancel') {
    $id = trim($_POST['id'] ?? $raw_body['id'] ?? '');
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID de message programmé manquant.']);
        exit;
    }

    $sched_file = $real_base_dir . '/storage/tribune_scheduled_posts.json';
    $scheduled = [];
    if (file_exists($sched_file)) {
        $scheduled = @json_decode(@file_get_contents($sched_file), true) ?: [];
    }

    $filtered = array_filter($scheduled, function ($item) use ($id) {
        return ($item['id'] ?? '') !== $id;
    });

    @file_put_contents($sched_file, json_encode(array_values($filtered), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    echo json_encode([
        'success' => true,
        'message' => 'Programmation annulée avec succès.',
        'count'   => count($filtered)
    ]);
    exit;
}

if ($action === 'tribune_get') {
    process_scheduled_tribune_posts($real_base_dir);
    $storage_file = $real_base_dir . '/storage/tribune_messages.json';
    $messages = [];
    if (file_exists($storage_file)) {
        $content = @file_get_contents($storage_file);
        $messages = @json_decode($content, true) ?: [];
    } else {
        $messages = [
            [
                'id'        => 1,
                'time'      => date('YmdHis', time() - 3600),
                'clock'     => date('H:i:s', time() - 3600),
                'login'     => 'oktail',
                'info'      => 'SimpleGallery WebOS',
                'message'   => 'Bienvenue sur la Tribune Libre de SimpleGallery ! [:totoz] Horloge cliquable, Totoz, Trollomètre et BAK sont activés. 🦆',
                'is_admin'  => true,
                'board'     => 'local'
            ],
            [
                'id'        => 2,
                'time'      => date('YmdHis', time() - 1800),
                'clock'     => date('H:i:s', time() - 1800),
                'login'     => 'Coincoin',
                'info'      => 'Linux 6.8 / Firefox',
                'message'   => 'Coincoin ! N\'hésitez pas à répondre en cliquant sur une horloge comme 07:00:00. [:hop]',
                'is_admin'  => false,
                'board'     => 'local'
            ]
        ];
        @file_put_contents($storage_file, json_encode($messages, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }

    echo json_encode([
        'success'   => true,
        'messages'  => $messages,
        'count'     => count($messages),
        'server_now'=> date('H:i:s')
    ]);
    exit;
}

if ($action === 'tribune_stream') {
    @session_write_close();

    if (function_exists('apache_setenv')) {
        @apache_setenv('no-gzip', '1');
    }
    @ini_set('zlib.output_compression', '0');
    @ini_set('implicit_flush', '1');

    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-transform');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');

    $storage_file = $real_base_dir . '/storage/tribune_messages.json';
    $last_mtime = 0;
    $start_time = time();
    $max_duration = 30;

    while ((time() - $start_time) < $max_duration) {
        if (connection_aborted()) {
            break;
        }

        process_scheduled_tribune_posts($real_base_dir);

        clearstatcache(true, $storage_file);
        $mtime = file_exists($storage_file) ? filemtime($storage_file) : 0;

        if ($mtime > $last_mtime) {
            $last_mtime = $mtime;
            $content = @file_get_contents($storage_file);
            $messages = @json_decode($content, true) ?: [];

            echo "event: message\n";
            echo "data: " . json_encode([
                'success'  => true,
                'messages' => $messages,
                'ts'       => time()
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";

            if (ob_get_level()) @ob_flush();
            @flush();
        }

        usleep(500000);
    }

    echo "event: ping\ndata: {}\n\n";
    if (ob_get_level()) @ob_flush();
    @flush();
    exit;
}

if ($action === 'tribune_post') {
    $msg_text = trim($_POST['message'] ?? $raw_body['message'] ?? '');
    $login    = trim($_POST['login'] ?? $raw_body['login'] ?? 'Anonyme');
    $info     = trim($_POST['info'] ?? $raw_body['info'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? 'SimpleGallery Client'));

    if (empty($msg_text)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Le message ne peut pas être vide.'
        ]);
        exit;
    }

    if (mb_strlen($msg_text) > 1000) {
        $msg_text = mb_substr($msg_text, 0, 1000);
    }

    if (empty($login)) {
        $login = 'Anonyme';
    }
    if (mb_strlen($login) > 40) {
        $login = mb_substr($login, 0, 40);
    }
    if (mb_strlen($info) > 100) {
        $info = mb_substr($info, 0, 100);
    }

    $storage_file = $real_base_dir . '/storage/tribune_messages.json';
    $messages = [];
    if (file_exists($storage_file)) {
        $content = @file_get_contents($storage_file);
        $messages = @json_decode($content, true) ?: [];
    }

    $last_id = 0;
    foreach ($messages as $m) {
        if (isset($m['id']) && $m['id'] > $last_id) {
            $last_id = $m['id'];
        }
    }

    $now_ts   = time();
    $time_id  = date('YmdHis', $now_ts);
    $clock    = date('H:i:s', $now_ts);
    $is_admin = !empty($_SESSION['is_admin']);

    $new_post = [
        'id'       => $last_id + 1,
        'time'     => $time_id,
        'clock'    => $clock,
        'login'    => htmlspecialchars($login, ENT_QUOTES, 'UTF-8'),
        'info'     => htmlspecialchars($info, ENT_QUOTES, 'UTF-8'),
        'message'  => htmlspecialchars($msg_text, ENT_QUOTES, 'UTF-8'),
        'is_admin' => $is_admin,
        'board'    => 'local'
    ];

    $messages[] = $new_post;
    if (count($messages) > 300) {
        $messages = array_slice($messages, -300);
    }

    @file_put_contents($storage_file, json_encode($messages, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    echo json_encode([
        'success' => true,
        'post'    => $new_post,
        'messages'=> $messages
    ]);
    exit;
}

function http_request_proxy($url, $method = 'GET', $headers = [], $post_data = null, $timeout = 6) {
    $is_post = (strtoupper($method) === 'POST');
    $header_lines = [];
    if (is_array($headers)) {
        foreach ($headers as $h) {
            if (is_string($h) && trim($h) !== '') {
                $header_lines[] = trim($h);
            }
        }
    } elseif (is_string($headers)) {
        foreach (explode("\r\n", $headers) as $h) {
            if (trim($h) !== '') {
                $header_lines[] = trim($h);
            }
        }
    }

    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
        curl_setopt($ch, CURLOPT_TIMEOUT, max(2, min($timeout, 6)));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $header_lines);

        if ($is_post) {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($post_data !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
            }
        } else {
            curl_setopt($ch, CURLOPT_HTTPGET, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        }

        $response = curl_exec($ch);
        $curl_error = curl_error($ch);
        $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $status_code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response !== false) {
            $raw_headers = substr($response, 0, $header_size);
            $body = substr($response, $header_size);
            $resp_headers = explode("\r\n", $raw_headers);

            $success = ($status_code >= 200 && $status_code < 400);
            return [
                'success'     => $success,
                'status_code' => $status_code,
                'headers'     => $resp_headers,
                'body'        => $body ?: '',
                'location'    => '',
                'cookies'     => [],
                'error'       => $success ? '' : ($curl_error ?: "Code HTTP {$status_code}")
            ];
        }
    }

    @ini_set('default_socket_timeout', $timeout);
    $header_str = implode("\r\n", $header_lines);
    $opts = [
        'http' => [
            'method'          => strtoupper($method),
            'timeout'         => $timeout,
            'follow_location' => $is_post ? 0 : 1,
            'max_redirects'   => 3,
            'ignore_errors'   => true,
            'header'          => $header_str,
            'content'         => $post_data
        ],
        'ssl' => [
            'verify_peer'      => false,
            'verify_peer_name' => false
        ]
    ];

    $context = stream_context_create($opts);
    $body = @file_get_contents($url, false, $context);

    $status_code = 200;
    $location = '';
    $cookies = [];
    $resp_headers = $http_response_header ?? [];

    if (is_array($resp_headers)) {
        foreach ($resp_headers as $line) {
            if (preg_match('/HTTP\/\d\.\d\s+(\d+)/i', $line, $m)) {
                $status_code = (int)$m[1];
            }
            if (stripos($line, 'Location:') === 0) {
                $location = trim(substr($line, 9));
            }
            if (stripos($line, 'Set-Cookie:') === 0) {
                if (preg_match('/^Set-Cookie:\s*([^;]+)/i', $line, $mc)) {
                    $cookies[] = trim($mc[1]);
                }
            }
        }
    }

    $success = ($body !== false && $status_code >= 200 && $status_code < 400);

    return [
        'success'     => $success,
        'status_code' => $status_code,
        'headers'     => $resp_headers,
        'body'        => $body ?: '',
        'location'    => $location,
        'cookies'     => $cookies,
        'error'       => $success ? '' : "Code HTTP {$status_code}"
    ];
}

if ($action === 'tribune_proxy_fetch') {
    $remote_url = trim($_GET['url'] ?? $_POST['url'] ?? $raw_body['url'] ?? '');
    $cookie_hdr = trim($_GET['cookie'] ?? $_POST['cookie'] ?? $raw_body['cookie'] ?? '');
    $user_agent = trim($_GET['user_agent'] ?? $_POST['user_agent'] ?? $raw_body['user_agent'] ?? 'SimpleGallery-TribuneProxy/1.0');

    if (empty($remote_url) || !filter_var($remote_url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'URL distante invalide.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $scheme = parse_url($remote_url, PHP_URL_SCHEME);
    if (!in_array(strtolower($scheme), ['http', 'https'], true)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Seuls les protocole HTTP et HTTPS sont autorisés.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $headers = [
        "User-Agent: {$user_agent}",
        "Accept: application/xml, text/xml, text/plain, application/json, */*"
    ];
    if (!empty($cookie_hdr)) {
        $headers[] = "Cookie: {$cookie_hdr}";
    }

    @session_write_close();

    $res = http_request_proxy($remote_url, 'GET', $headers, null, 5);

    if (!$res['success'] || empty($res['body'])) {
        echo json_encode([
            'success'     => false,
            'status_code' => $res['status_code'] ?? 0,
            'error'       => 'Impossible d\'obtenir le flux distant (serveur injoignable ou délai dépassé).',
            'details'     => $res['error'] ?? ''
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'success' => true,
        'content' => $res['body']
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'tribune_proxy_post') {
    $board_id        = trim($_POST['board_id'] ?? $raw_body['board_id'] ?? '');
    $remote_url      = trim($_POST['url'] ?? $raw_body['url'] ?? '');
    $custom_post_url = trim($_POST['post_url'] ?? $raw_body['post_url'] ?? '');
    $msg_text        = trim($_POST['message'] ?? $raw_body['message'] ?? '');
    $login           = trim($_POST['login'] ?? $raw_body['login'] ?? 'Anonyme');
    $cookie_hdr      = trim($_POST['cookie'] ?? $raw_body['cookie'] ?? '');
    $user_agent      = trim($_POST['user_agent'] ?? $raw_body['user_agent'] ?? 'Mozilla/5.0 (SimpleGallery Tribune)');

    // Look up board configuration dynamically from JSON storage
    $all_boards = get_tribune_boards_config();
    $board_cfg  = $all_boards[$board_id] ?? null;

    if (!$board_cfg) {
        if (!empty($remote_url)) {
            foreach ($all_boards as $bid => $cfg) {
                if (!empty($cfg['url']) && strtolower(trim($cfg['url'])) === strtolower($remote_url)) {
                    $board_cfg = $cfg;
                    $board_id  = $bid;
                    break;
                }
            }
        }
        if (!$board_cfg && isset($all_boards['linuxfr'])) {
            $board_cfg = $all_boards['linuxfr'];
            $board_id  = 'linuxfr';
        }
    }

    if (empty($msg_text)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Le message ne peut pas être vide.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Resolve post_url
    $post_url = '';
    if (!empty($custom_post_url) && filter_var($custom_post_url, FILTER_VALIDATE_URL)) {
        $post_url = $custom_post_url;
    } elseif ($board_cfg && !empty($board_cfg['post_url']) && filter_var($board_cfg['post_url'], FILTER_VALIDATE_URL)) {
        $post_url = $board_cfg['post_url'];
    } elseif (!empty($remote_url) && filter_var($remote_url, FILTER_VALIDATE_URL)) {
        $post_url = preg_replace('/\/index\.xml$/i', '', $remote_url);
        if (strrpos($post_url, '.xml') !== false) {
            $post_url = preg_replace('/\.xml$/i', '', $post_url);
        }
    }

    if (empty($post_url) || !filter_var($post_url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'URL de soumission distante invalide.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $parsed_post_url = parse_url($post_url);
    $origin = ($parsed_post_url['scheme'] ?? 'https') . '://' . ($parsed_post_url['host'] ?? '');

    // Step 1: Pre-fetch GET request to extract CSRF token if enabled/needed
    // Step 1: Resolve CSRF token (use cached session token if available to save latency)
    $csrf_token = $_SESSION['tribune_csrf_' . $board_id] ?? '';
    $should_extract_csrf = isset($board_cfg['extract_csrf']) ? (bool)$board_cfg['extract_csrf'] : true;

    $fetch_csrf_token = function() use ($post_url, $user_agent, &$cookie_hdr) {
        $get_headers = [
            "User-Agent: {$user_agent}",
            "Accept: text/html,application/xhtml+xml,*/*"
        ];
        if (!empty($cookie_hdr)) {
            $get_headers[] = "Cookie: {$cookie_hdr}";
        }

        $get_res = http_request_proxy($post_url, 'GET', $get_headers, null, 5);
        $tok = '';
        if (!empty($get_res['body'])) {
            if (preg_match('/input[^>]+name="authenticity_token"[^>]+value="([^"]+)"/i', $get_res['body'], $m_tok)) {
                $tok = $m_tok[1];
            } elseif (preg_match('/meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i', $get_res['body'], $m_meta)) {
                $tok = $m_meta[1];
            }

            if (!empty($get_res['cookies'])) {
                $existing_keys = [];
                foreach (explode(';', $cookie_hdr) as $part) {
                    $kv = explode('=', trim($part), 2);
                    if (!empty($kv[0])) {
                        $existing_keys[trim($kv[0])] = true;
                    }
                }
                foreach ($get_res['cookies'] as $ck) {
                    $kv = explode('=', trim($ck), 2);
                    $key = trim($kv[0] ?? '');
                    if (!empty($key) && !isset($existing_keys[$key])) {
                        $cookie_hdr = ($cookie_hdr ? $cookie_hdr . '; ' : '') . $ck;
                        $existing_keys[$key] = true;
                    }
                }
            }
        }
        return $tok;
    };

    if (empty($csrf_token) && $should_extract_csrf) {
        $csrf_token = $fetch_csrf_token();
        if (!empty($csrf_token)) {
            $_SESSION['tribune_csrf_' . $board_id] = $csrf_token;
        }
    }

    // Step 2: Helper to perform POST
    $execute_post = function($token) use ($board_cfg, $msg_text, $login, $user_agent, $post_url, $origin, $cookie_hdr) {
        $post_params = [];
        $is_api_endpoint = (strpos($post_url, '/api/') !== false);

        if ($is_api_endpoint) {
            $post_param_name = ($board_cfg && !empty($board_cfg['post_param'])) ? $board_cfg['post_param'] : 'message';
            $post_params[$post_param_name] = $msg_text;
        } else {
            $post_params['utf8'] = '✓';
            $post_params['authenticity_token'] = $token;

            if ($board_cfg && !empty($board_cfg['extra_params']) && is_array($board_cfg['extra_params'])) {
                foreach ($board_cfg['extra_params'] as $k => $v) {
                    if ($k !== 'utf8' && $k !== 'authenticity_token') {
                        $post_params[$k] = $v;
                    }
                }
            }

            $post_param_name = ($board_cfg && !empty($board_cfg['post_param'])) ? $board_cfg['post_param'] : 'message';
            $post_params[$post_param_name] = $msg_text;
            $post_params['login'] = $login;
        }

        $post_data = http_build_query($post_params);

        $post_headers = [
            "User-Agent: {$user_agent}",
            "Content-Type: application/x-www-form-urlencoded",
            "Referer: {$post_url}",
            "Origin: {$origin}"
        ];
        if (!empty($token) && !$is_api_endpoint) {
            $post_headers[] = "X-CSRF-Token: {$token}";
        }
        if (!empty($cookie_hdr)) {
            if (stripos($cookie_hdr, 'Bearer ') === 0 || strpos($cookie_hdr, '=') === false) {
                $token_val = preg_replace('/^Bearer\s+/i', '', trim($cookie_hdr));
                $post_headers[] = "Authorization: Bearer {$token_val}";
            } else {
                $post_headers[] = "Cookie: {$cookie_hdr}";
                if (preg_match('/(?:access_token|bearer|token)=([^;]+)/i', $cookie_hdr, $m_bearer)) {
                    $post_headers[] = "Authorization: Bearer {$m_bearer[1]}";
                }
            }
        }

        return http_request_proxy($post_url, 'POST', $post_headers, $post_data, 6);
    };

    $post_res = $execute_post($csrf_token);
    $status_code  = $post_res['status_code'];
    $location_hdr = $post_res['location'];

    // Retry once if token expired or invalid (HTTP 422 or HTTP 400 with token error)
    if (($status_code === 422 || $status_code === 400) && $should_extract_csrf) {
        unset($_SESSION['tribune_csrf_' . $board_id]);
        $csrf_token = $fetch_csrf_token();
        if (!empty($csrf_token)) {
            $_SESSION['tribune_csrf_' . $board_id] = $csrf_token;
            $post_res = $execute_post($csrf_token);
            $status_code  = $post_res['status_code'];
            $location_hdr = $post_res['location'];
        }
    }

    if (strpos($location_hdr, 'connexion') !== false || $status_code === 401 || $status_code === 403) {
        http_response_code(401);
        echo json_encode([
            'success'     => false,
            'status_code' => $status_code,
            'location'    => $location_hdr,
            'error'       => 'Authentification refusée par le backend distant (cookie de session linuxfr.org manquant ou expiré).'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($status_code >= 200 && $status_code < 400) {
        echo json_encode([
            'success'     => true,
            'status_code' => $status_code,
            'location'    => $location_hdr,
            'csrf_used'   => !empty($csrf_token),
            'message'     => 'Post envoyé au backend distant avec succès.',
            'target'      => $post_url
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        http_response_code(400);
        echo json_encode([
            'success'     => false,
            'status_code' => $status_code,
            'error'       => "Le backend distant a répondu avec le code HTTP {$status_code}.",
            'details'     => mb_substr(trim(strip_tags($post_res['body'] ?? '')), 0, 300)
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($action === 'tribune_clear_history') {
    if (empty($_SESSION['is_admin'])) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Action réservée à l\'administrateur.'
        ]);
        exit;
    }

    $storage_file = $real_base_dir . '/storage/tribune_messages.json';
    @file_put_contents($storage_file, json_encode([], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);

    echo json_encode([
        'success' => true,
        'message' => 'Historique de la tribune réinitialisé.'
    ]);
    exit;
}

if ($action === 'tribune_file_upload') {
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Aucun fichier valide n\'a été transmis ou erreur lors du téléversement.'
        ]);
        exit;
    }

    $file = $_FILES['file'];

    $max_size = 50 * 1024 * 1024;
    if ($file['size'] > $max_size) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Le fichier dépasse la taille maximale autorisée de 50 Mo.'
        ]);
        exit;
    }

    $orig_name = basename($file['name']);
    $ext = strtolower(pathinfo($orig_name, PATHINFO_EXTENSION));

    $forbidden_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'phps', 'cgi', 'pl', 'py', 'sh', 'exe', 'bat', 'cmd', 'vbs', 'msi', 'phar'];
    if (in_array($ext, $forbidden_exts, true)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Type de fichier exécutable interdit pour des raisons de sécurité.'
        ]);
        exit;
    }

    $mime_type = 'application/octet-stream';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $detected = finfo_file($finfo, $file['tmp_name']);
            if ($detected) {
                $mime_type = $detected;
            }
            finfo_close($finfo);
        }
    } elseif (function_exists('mime_content_type')) {
        $detected = @mime_content_type($file['tmp_name']);
        if ($detected) {
            $mime_type = $detected;
        }
    }
    if ($mime_type === 'application/octet-stream' && !empty($file['type'])) {
        $mime_type = $file['type'];
    }

    $upload_dir = $real_base_dir . '/storage/tribune_uploads';
    if (!is_dir($upload_dir)) {
        @mkdir($upload_dir, 0755, true);
    }

    $htaccess_path = $upload_dir . '/.htaccess';
    if (!file_exists($htaccess_path)) {
        @file_put_contents($htaccess_path, "Options -Indexes -ExecCGI\n<FilesMatch \"\\.(php|phtml|php3|php4|php5|php7|php8|phps|cgi|pl|py|sh)$\">\n    Require all denied\n</FilesMatch>\n");
    }

    $now = time();
    $files = @scandir($upload_dir) ?: [];
    $records = [];
    $total_size = 0;

    foreach ($files as $f) {
        if (str_ends_with($f, '.json')) {
            $json_p = $upload_dir . '/' . $f;
            $meta = @json_decode(@file_get_contents($json_p), true);
            $token_id = substr($f, 0, -5);
            $bin_p = $upload_dir . '/' . $token_id . '.bin';

            if ($meta && !empty($meta['uploaded_at']) && ($now - $meta['uploaded_at']) > 7 * 86400) {
                @unlink($json_p);
                @unlink($bin_p);
            } else if (file_exists($bin_p)) {
                $fsize = filesize($bin_p);
                $total_size += $fsize;
                $records[] = [
                    'token' => $token_id,
                    'time'  => $meta['uploaded_at'] ?? 0,
                    'size'  => $fsize
                ];
            }
        }
    }

    if ($total_size > 500 * 1024 * 1024) {
        usort($records, function ($a, $b) {
            return $a['time'] <=> $b['time'];
        });
        foreach ($records as $rec) {
            @unlink($upload_dir . '/' . $rec['token'] . '.json');
            @unlink($upload_dir . '/' . $rec['token'] . '.bin');
            $total_size -= $rec['size'];
            if ($total_size < 400 * 1024 * 1024) break;
        }
    }

    $token = bin2hex(random_bytes(16));
    $bin_path = $upload_dir . '/' . $token . '.bin';
    $meta_path = $upload_dir . '/' . $token . '.json';

    if (!move_uploaded_file($file['tmp_name'], $bin_path)) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => 'Échec de l\'enregistrement du fichier temporaire sur le serveur.'
        ]);
        exit;
    }

    $meta_data = [
        'token'         => $token,
        'original_name' => $orig_name,
        'mime_type'     => $mime_type,
        'size'          => $file['size'],
        'uploaded_at'   => $now,
        'ext'           => $ext
    ];

    file_put_contents($meta_path, json_encode($meta_data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);

    $relative_url = 'api.php?action=tribune_file_get&token=' . $token;

    echo json_encode([
        'success'   => true,
        'token'     => $token,
        'url'       => $relative_url,
        'filename'  => $orig_name,
        'mime_type' => $mime_type
    ]);
    exit;
}

if ($action === 'tribune_file_get') {
    $token = $_GET['token'] ?? '';
    if (!preg_match('/^[a-f0-9]{32}$/i', $token)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Jeton de fichier invalide.'
        ]);
        exit;
    }

    $upload_dir = $real_base_dir . '/storage/tribune_uploads';
    $bin_path = $upload_dir . '/' . $token . '.bin';
    $meta_path = $upload_dir . '/' . $token . '.json';

    if (!is_file($bin_path) || !is_file($meta_path)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Fichier introuvable ou expiré.'
        ]);
        exit;
    }

    $meta = json_decode(file_get_contents($meta_path), true) ?: [];
    $mime_type = strtolower($meta['mime_type'] ?? 'application/octet-stream');
    $orig_name = $meta['original_name'] ?? ('file_' . $token);

    $safe_inline_mimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
        'video/mp4', 'video/webm', 'video/ogg',
        'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/flac',
        'application/pdf', 'text/plain'
    ];

    $disposition = in_array($mime_type, $safe_inline_mimes, true) ? 'inline' : 'attachment';

    if (ob_get_level()) {
        @ob_end_clean();
    }

    header('Content-Type: ' . $mime_type);
    header('Content-Length: ' . filesize($bin_path));
    header('Content-Disposition: ' . $disposition . '; filename="' . rawurlencode($orig_name) . '"');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'");
    header('Cache-Control: public, max-age=86400');

    readfile($bin_path);
    exit;
}

if ($action === 'totoz_proxy') {
    @session_write_close();
    $name = trim($_GET['name'] ?? $raw_body['name'] ?? 'totoz');
    $name = preg_replace('/[^a-zA-Z0-9_\.: -]/', '', $name);
    if (empty($name)) $name = 'totoz';

    $remote_url = "https://totoz.eu/img/" . rawurlencode($name);
    $opts = [
        'http' => [
            'method'          => 'GET',
            'timeout'         => 5,
            'follow_location' => 1,
            'max_redirects'   => 5,
            'header'          => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n"
        ],
        'ssl' => [
            'verify_peer'      => false,
            'verify_peer_name' => false
        ]
    ];
    $context = stream_context_create($opts);
    $img_data = @file_get_contents($remote_url, false, $context);

    if ($img_data === false || empty($img_data)) {
        header('Content-Type: image/svg+xml');
        echo '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><text y="18" font-size="16">🦆</text></svg>';
        exit;
    }

    $content_type = 'image/gif';
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $hdr) {
            if (stripos($hdr, 'Content-Type:') === 0) {
                $content_type = trim(substr($hdr, 13));
                break;
            }
        }
    }

    header('Content-Type: ' . $content_type);
    header('Cache-Control: public, max-age=604800');
    echo $img_data;
    exit;
}

if ($action === 'totoz_search') {
    @session_write_close();
    $q = trim($_GET['q'] ?? $raw_body['q'] ?? '');
    $q = preg_replace('/[^a-zA-Z0-9_\.: -]/', '', $q);

    $remote_url = "https://totoz.eu/search.xml?terms=" . urlencode($q);
    $opts = [
        'http' => [
            'method'  => 'GET',
            'timeout' => 4,
            'header'  => "User-Agent: Mozilla/5.0 (SimpleGallery Tribune Client)\r\n"
        ]
    ];
    $context = stream_context_create($opts);
    $xml_data = @file_get_contents($remote_url, false, $context);

    $results = [];
    if ($xml_data !== false) {
        $xml = @simplexml_load_string($xml_data);
        if ($xml && isset($xml->totoz)) {
            foreach ($xml->totoz as $t) {
                $name = (string)$t->name;
                $nsfw = isset($t->nsfw) ? ((string)$t->nsfw === 'true' || (string)$t->nsfw === '1') : false;
                if ($name) {
                    $results[] = ['name' => $name, 'nsfw' => $nsfw];
                }
            }
        }
    }

    echo json_encode(['success' => true, 'totoz' => array_slice($results, 0, 15)]);
    exit;
}

if ($action === 'url_preview') {
    @session_write_close();
    $url = trim($_GET['url'] ?? $raw_body['url'] ?? '');
    if (empty($url) || !preg_match('#^https?://#i', $url)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'URL invalide']);
        exit;
    }

    // Security check: prevent SSRF to local/internal IP addresses
    $parsed_host = parse_url($url, PHP_URL_HOST);
    if (!$parsed_host || in_array(strtolower($parsed_host), ['localhost', '127.0.0.1', '::1', '0.0.0.0'])) {
        echo json_encode(['success' => false, 'error' => 'Accès restreint']);
        exit;
    }

    // Cache lookup
    $cache_file = $real_base_dir . '/storage/url_preview_cache.json';
    $cache = [];
    if (file_exists($cache_file)) {
        $cache = @json_decode(@file_get_contents($cache_file), true) ?: [];
    }

    $url_hash = md5($url);
    if (isset($cache[$url_hash]) && (time() - ($cache[$url_hash]['cached_at'] ?? 0)) < 86400 * 7) {
        echo json_encode(['success' => true, 'preview' => $cache[$url_hash]]);
        exit;
    }

    // Default metadata
    $title = '';
    $description = '';
    $image = '';
    $site_name = $parsed_host;

    // Check for YouTube oEmbed
    if (preg_match('#(?:youtube\.com/(?:watch\?v=|embed/|v/)|youtu\.be/)([a-zA-Z0-9_-]{11})#i', $url, $yt_matches)) {
        $yt_id = $yt_matches[1];
        $site_name = 'YouTube';
        $image = "https://img.youtube.com/vi/{$yt_id}/hqdefault.jpg";

        $oembed_url = "https://www.youtube.com/oembed?url=" . urlencode($url) . "&format=json";
        $ctx = stream_context_create([
            'http' => ['timeout' => 3, 'user_agent' => 'SimpleGallery/1.0', 'ignore_errors' => true]
        ]);
        $oembed_json = @file_get_contents($oembed_url, false, $ctx);
        if ($oembed_json) {
            $oembed_data = @json_decode($oembed_json, true);
            if ($oembed_data && !empty($oembed_data['title'])) {
                $title = $oembed_data['title'];
                if (!empty($oembed_data['author_name'])) {
                    $description = "Vidéo par " . $oembed_data['author_name'];
                }
            }
        }
    }
    // Check if direct image link
    else if (preg_match('#\.(jpg|jpeg|png|gif|webp|svg)$#i', parse_url($url, PHP_URL_PATH) ?? '')) {
        $title = basename(parse_url($url, PHP_URL_PATH));
        $image = $url;
        $description = "Image en ligne";
    }
    else {
        // Fetch HTML head for OpenGraph tags
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 3,
                'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) SimpleGalleryBot/1.0\r\nAccept: text/html\r\n",
                'ignore_errors' => true
            ]
        ]);
        $html = @file_get_contents($url, false, $ctx, 0, 150000);
        if ($html) {
            // Extract og:title or <title>
            if (preg_match('#<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']#i', $html, $m) ||
                preg_match('#<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']#i', $html, $m)) {
                $title = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            } elseif (preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m)) {
                $title = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES, 'UTF-8'));
            }

            // Extract og:image
            if (preg_match('#<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']#i', $html, $m) ||
                preg_match('#<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']#i', $html, $m)) {
                $image = $m[1];
            }

            // Extract og:description or <meta name="description">
            if (preg_match('#<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']#i', $html, $m) ||
                preg_match('#<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']#i', $html, $m)) {
                $description = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            }

            // Extract og:site_name
            if (preg_match('#<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)["\']#i', $html, $m)) {
                $site_name = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
            }
        }
    }

    $preview_data = [
        'url'         => $url,
        'site_name'   => $site_name ?: $parsed_host,
        'title'       => $title ?: $parsed_host,
        'description' => mb_strlen($description) > 140 ? mb_substr($description, 0, 137) . '…' : $description,
        'image'       => $image,
        'cached_at'   => time()
    ];

    $cache[$url_hash] = $preview_data;
    @file_put_contents($cache_file, json_encode($cache, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);

    echo json_encode(['success' => true, 'preview' => $preview_data]);
    exit;
}

if ($action === 'run_unit_tests') {
    if (!defined('SG_RUNNING_TESTS_VIA_API')) {
        define('SG_RUNNING_TESTS_VIA_API', true);
    }

    $start_time = microtime(true);
    ob_start();

    $suites = [];
    $total_passed = 0;
    $total_failed = 0;

    try {
        require_once __DIR__ . '/tests/SecurityUnitTest.php';
        $sec_suite = new SecurityUnitTestSuite();
        $sec_suite->runAll();
        $sec_counts = $sec_suite->getCounts();
        $sec_results = $sec_suite->getResults();

        $suites[] = [
            'id'      => 'security',
            'name'    => 'Tests de Sécurité (SecurityUnitTest)',
            'passed'  => $sec_counts['passed'],
            'failed'  => $sec_counts['failed'],
            'total'   => $sec_counts['total'],
            'tests'   => $sec_results
        ];
        $total_passed += $sec_counts['passed'];
        $total_failed += $sec_counts['failed'];
    } catch (\Throwable $e) {
        $suites[] = [
            'id'      => 'security',
            'name'    => 'Tests de Sécurité',
            'passed'  => 0,
            'failed'  => 1,
            'total'   => 1,
            'tests'   => [['name' => 'Exception: ' . $e->getMessage(), 'status' => 'FAIL', 'details' => $e->getTraceAsString()]]
        ];
        $total_failed++;
    }

    try {
        require_once __DIR__ . '/tests/GeneralUnitTest.php';
        $gen_suite = new GeneralUnitTestSuite();
        $gen_suite->runAll();
        $gen_counts = $gen_suite->getCounts();
        $gen_results = $gen_suite->getResults();

        $suites[] = [
            'id'      => 'general',
            'name'    => 'Tests Fonctionnels Généraux (GeneralUnitTest)',
            'passed'  => $gen_counts['passed'],
            'failed'  => $gen_counts['failed'],
            'total'   => $gen_counts['total'],
            'tests'   => $gen_results
        ];
        $total_passed += $gen_counts['passed'];
        $total_failed += $gen_counts['failed'];
    } catch (\Throwable $e) {
        $suites[] = [
            'id'      => 'general',
            'name'    => 'Tests Fonctionnels Généraux',
            'passed'  => 0,
            'failed'  => 1,
            'total'   => 1,
            'tests'   => [['name' => 'Exception: ' . $e->getMessage(), 'status' => 'FAIL', 'details' => $e->getTraceAsString()]]
        ];
        $total_failed++;
    }

    ob_end_clean();
    $duration_ms = round((microtime(true) - $start_time) * 1000, 1);

    echo json_encode([
        'success'  => true,
        'summary'  => [
            'total'       => $total_passed + $total_failed,
            'passed'      => $total_passed,
            'failed'      => $total_failed,
            'duration_ms' => $duration_ms,
            'all_passed'  => ($total_failed === 0)
        ],
        'suites'   => $suites
    ]);
    exit;
}

if ($action === 'login') {
    if (!check_rate_limit('admin_login')) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error'   => 'Trop de tentatives de connexion échouées. Veuillez patienter 15 minutes.'
        ]);
        exit;
    }

    $password = $raw_body['password'] ?? $_POST['password'] ?? '';

    if (empty($admin_password_hash)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Admin password is not configured in config.php. Run `php set_admin_password.php <password>` via CLI first.'
        ]);
        exit;
    }

    if (password_verify($password, $admin_password_hash)) {
        reset_rate_limit('admin_login');
        session_regenerate_id(true);
        $_SESSION['is_admin'] = true;
        echo json_encode([
            'success'    => true,
            'is_admin'   => true,
            'csrf_token' => get_csrf_token(),
            'message'    => 'Admin authentication successful'
        ]);
        exit;
    } else {
        increment_rate_limit('admin_login');
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error'   => 'Incorrect admin password'
        ]);
        exit;
    }
}

if ($action === 'logout') {
    unset($_SESSION['is_admin']);
    echo json_encode([
        'success'  => true,
        'is_admin' => false,
        'message'  => 'Logged out of admin mode'
    ]);
    exit;
}

if ($action === 'change_password') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Admin privileges required'
        ]);
        exit;
    }

    $new_password = $raw_body['new_password'] ?? $_POST['new_password'] ?? '';
    if (strlen($new_password) < 8) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Le mot de passe doit contenir au moins 8 caractères'
        ]);
        exit;
    }

    if (update_admin_password_in_config($new_password)) {
        echo json_encode([
            'success' => true,
            'message' => 'Admin password updated successfully in config.php'
        ]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => 'Failed to update config.php'
        ]);
        exit;
    }
}

if ($action === 'get_permissions') {
    echo json_encode([
        'success'           => true,
        'is_admin'          => is_admin_logged_in(),
        'permissions'       => load_permissions_config($real_base_dir),
        'available_archives'=> find_archive_binaries()
    ]);
    exit;
}

if ($action === 'save_permissions') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Droits administrateur requis pour modifier la matrice de droits']);
        exit;
    }
    $new_perms = $raw_body['permissions'] ?? $_POST['permissions'] ?? [];
    if (is_string($new_perms)) {
        $new_perms = json_decode($new_perms, true) ?: [];
    }
    if (save_permissions_config($real_base_dir, $new_perms)) {
        echo json_encode(['success' => true, 'permissions' => load_permissions_config($real_base_dir)]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Échec de la sauvegarde des permissions']);
        exit;
    }
}

if ($action === 'download_archive') {
    if (!has_permission('can_download_archive', $real_base_dir)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Permission de téléchargement d\'archive refusée']);
        exit;
    }

    $format = strtolower($raw_body['format'] ?? $_GET['format'] ?? 'zip');
    $req_dir = $raw_body['dir'] ?? $_GET['dir'] ?? '';
    $dir_target = sanitize_path($req_dir, $real_base_dir);

    if (!$dir_target || !is_dir($dir_target) || is_path_ignored($dir_target, $real_base_dir, $ignore_list)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Dossier introuvable ou accès refusé']);
        exit;
    }

    if (!is_dir_accessible($dir_target, $real_base_dir)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Accès refusé : Ce dossier est protégé ou privé.']);
        exit;
    }

    $available_formats = find_archive_binaries();
    if (!isset($available_formats[$format])) {
        $format = 'zip';
    }

    $tmp_dir = sys_get_temp_dir() . '/simplegallery_archives';
    if (!is_dir($tmp_dir)) @mkdir($tmp_dir, 0755, true);

    $ext_map = ['zip' => '.zip', '7z' => '.7z', 'tar' => '.tar.gz'];
    $mime_map = ['zip' => 'application/zip', '7z' => 'application/x-7z-compressed', 'tar' => 'application/gzip'];

    $file_ext = $ext_map[$format] ?? '.zip';
    $mime_type = $mime_map[$format] ?? 'application/octet-stream';

    $folder_name = ($dir_target === $real_base_dir) ? 'gallery' : basename($dir_target);
    $folder_name_safe = preg_replace('/[^\w\.\-\s]/u', '_', $folder_name);
    $archive_name = $folder_name_safe . '_' . date('Ymd_His') . $file_ext;
    $archive_path = $tmp_dir . '/' . $archive_name;

    if (create_archive($format, $dir_target, $archive_path, $real_base_dir, $ignore_list)) {
        if (ob_get_level()) {
            ob_end_clean();
        }
        header('Content-Type: ' . $mime_type);
        header('Content-Disposition: attachment; filename="' . $archive_name . '"');
        header('Content-Length: ' . filesize($archive_path));
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        readfile($archive_path);
        @unlink($archive_path);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Impossible de créer l\'archive au format ' . htmlspecialchars($format)]);
        exit;
    }
}

if ($action === 'search') {
    $req_dir = $raw_body['dir'] ?? $_GET['dir'] ?? '';
    $start_dir = sanitize_path($req_dir, $real_base_dir) ?: $real_base_dir;

    $search_params = [
        'q'          => $raw_body['q'] ?? $_GET['q'] ?? '',
        'name'       => $raw_body['name'] ?? $_GET['name'] ?? '',
        'words'      => $raw_body['words'] ?? $_GET['words'] ?? '',
        'category'   => $raw_body['category'] ?? $_GET['category'] ?? 'all',
        'timing'     => $raw_body['timing'] ?? $_GET['timing'] ?? 'all',
        'date_from'  => $raw_body['date_from'] ?? $_GET['date_from'] ?? '',
        'date_to'    => $raw_body['date_to'] ?? $_GET['date_to'] ?? '',
        'size_range' => $raw_body['size_range'] ?? $_GET['size_range'] ?? 'all',
        'gps_only'   => !empty($raw_body['gps_only']) || !empty($_GET['gps_only']),
        'recursive'  => !empty($raw_body['recursive']) || !empty($_GET['recursive'])
    ];

    $search_results = search_gallery_recursive($start_dir, $real_base_dir, $search_params, $ignore_list, $media_types);

    echo json_encode([
        'success' => true,
        'count'   => count($search_results),
        'results' => $search_results
    ]);
    exit;
}

// Path & Access functions imported via config.php -> functions.php


// Path & EXIF functions imported via config.php -> functions.php -> includes/exif.php


// Directory Cache Engine helpers imported via config.php -> functions.php



if ($action === 'unlock_folder') {
    if (!check_rate_limit('unlock_folder')) {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error'   => 'Trop de tentatives de déverrouillage échouées. Veuillez patienter 15 minutes.'
        ]);
        exit;
    }

    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $password = $raw_body['password'] ?? $_POST['password'] ?? '';

    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Dossier introuvable ou accès refusé'
        ]);
        exit;
    }

    $rel_path = get_relative_path($target_dir, $real_base_dir);
    $pass_file = $target_dir . '/.password';

    if (!file_exists($pass_file)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Ce dossier n\'est pas protégé par mot de passe'
        ]);
        exit;
    }

    $hash = trim((string)@file_get_contents($pass_file));
    if (password_verify($password, $hash)) {
        reset_rate_limit('unlock_folder');
        if (!isset($_SESSION['unlocked_dirs'])) {
            $_SESSION['unlocked_dirs'] = [];
        }
        $_SESSION['unlocked_dirs'][$rel_path] = true;
        echo json_encode([
            'success' => true,
            'message' => 'Dossier déverrouillé avec succès',
            'path'    => $rel_path
        ]);
        exit;
    } else {
        increment_rate_limit('unlock_folder');
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error'   => 'Mot de passe du dossier incorrect'
        ]);
        exit;
    }
}

if ($action === 'lock_folder') {
    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Dossier introuvable'
        ]);
        exit;
    }

    $rel_path = get_relative_path($target_dir, $real_base_dir);
    if (isset($_SESSION['unlocked_dirs'])) {
        unset($_SESSION['unlocked_dirs'][$rel_path]);
        $prefix = ($rel_path === '') ? '' : $rel_path . '/';
        foreach (array_keys($_SESSION['unlocked_dirs']) as $k) {
            if ($prefix !== '' && strpos($k, $prefix) === 0) {
                unset($_SESSION['unlocked_dirs'][$k]);
            }
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Dossier verrouillé à nouveau',
        'path'    => $rel_path
    ]);
    exit;
}

// Directory Access Permission helpers imported via config.php -> functions.php


if ($action === 'update_dotfile') {
    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $type = $raw_body['type'] ?? $_POST['type'] ?? '';
    
    if ($type === 'comment') {
        if (!has_permission('can_comment', $real_base_dir)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Permission d\'édition des légendes refusée']);
            exit;
        }
    } else {
        if (!is_admin_logged_in()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Droits administrateur requis']);
            exit;
        }
    }

    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $type = $raw_body['type'] ?? $_POST['type'] ?? '';
    $value = trim((string)($raw_body['value'] ?? $_POST['value'] ?? ''));
    $filename = trim((string)($raw_body['filename'] ?? $_POST['filename'] ?? ''));

    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Directory not found or access denied'
        ]);
        exit;
    }

    $allowed_types = ['title', 'description', 'comment', 'bg', 'theme', 'access_mode'];
    if (!in_array($type, $allowed_types, true)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Invalid dotfile type specified'
        ]);
        exit;
    }

    // Check directory write permissions
    if (!is_writable($target_dir)) {
        $folder_name = (get_relative_path($target_dir, $real_base_dir) === '') ? 'root gallery' : basename($target_dir);
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => "Permission denied: Web server process (e.g. www-data/http) lacks write permissions on directory '{$folder_name}'. Please grant write access (e.g., `chmod 775 {$folder_name}` or `chown -R www-data:www-data {$folder_name}`)."
        ]);
        exit;
    }

    $success = true;
    switch ($type) {
        case 'access_mode':
            $private_file  = $target_dir . '/.private';
            $password_file = $target_dir . '/.password';
            $public_file   = $target_dir . '/.public';

            if ($value === 'public') {
                if (file_exists($private_file)) @unlink($private_file);
                if (file_exists($password_file)) @unlink($password_file);
                if (basename($target_dir) === 'private') {
                    $success = (@file_put_contents($public_file, "1\n") !== false);
                } else {
                    if (file_exists($public_file)) @unlink($public_file);
                }
            } elseif ($value === 'private') {
                if (file_exists($password_file)) @unlink($password_file);
                if (file_exists($public_file)) @unlink($public_file);
                $success = (@file_put_contents($private_file, "1\n") !== false);
            } elseif ($value === 'password') {
                if (file_exists($private_file)) @unlink($private_file);
                if (file_exists($public_file)) @unlink($public_file);
                $folder_pass = trim((string)($raw_body['folder_password'] ?? $_POST['folder_password'] ?? ''));
                if ($folder_pass !== '') {
                    $hash = password_hash($folder_pass, PASSWORD_BCRYPT);
                    $success = (@file_put_contents($password_file, $hash . "\n") !== false);
                } elseif (!file_exists($password_file)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error'   => 'Un mot de passe est requis pour protéger ce dossier.'
                    ]);
                    exit;
                }
            }
            break;

        case 'title':
            $file = $target_dir . '/.title';
            if ($value === '') {
                if (file_exists($file)) $success = @unlink($file);
            } else {
                $success = (@file_put_contents($file, $value . "\n") !== false);
            }
            break;

        case 'description':
            $file1 = $target_dir . '/.desc';
            $file2 = $target_dir . '/.description';
            if ($value === '') {
                if (file_exists($file1)) @unlink($file1);
                if (file_exists($file2)) @unlink($file2);
            } else {
                if (file_exists($file2)) @unlink($file2);
                $success = (@file_put_contents($file1, $value . "\n") !== false);
            }
            break;

        case 'bg':
            $file = $target_dir . '/.bg';
            if ($value === '') {
                if (file_exists($file)) $success = @unlink($file);
            } else {
                $success = (@file_put_contents($file, $value . "\n") !== false);
            }
            break;

        case 'theme':
            $file = $target_dir . '/.theme';
            if ($value === '') {
                if (file_exists($file)) $success = @unlink($file);
            } else {
                $success = (@file_put_contents($file, $value . "\n") !== false);
            }
            break;

        case 'comment':
            if ($filename === '') {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error'   => 'Filename required for comment update'
                ]);
                exit;
            }
            $filename = basename($filename);
            $comments = load_dir_comments($target_dir);
            if ($value === '') {
                unset($comments[$filename]);
            } else {
                $comments[$filename] = $value;
            }
            $success = save_dir_comments($target_dir, $comments);
            break;
    }

    if (!$success) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => "Failed to write file. Please check folder write permissions."
        ]);
        exit;
    }

    invalidate_dir_cache($target_dir, $real_base_dir, $thumbnail_dir);

    echo json_encode([
        'success' => true,
        'message' => 'Dotfile updated successfully',
        'type'    => $type
    ]);
    exit;
}

if ($action === 'save_comment') {
    if (!has_permission('can_comment', $real_base_dir)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Permission d\'édition des légendes refusée']);
        exit;
    }

    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $filename = trim((string)($raw_body['filename'] ?? $_POST['filename'] ?? ''));
    $comment = trim((string)($raw_body['comment'] ?? $_POST['comment'] ?? ''));

    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Dossier introuvable ou accès refusé']);
        exit;
    }

    if ($filename === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nom du fichier requis']);
        exit;
    }

    $filename = basename($filename);
    $comments = load_dir_comments($target_dir);
    if ($comment === '') {
        unset($comments[$filename]);
    } else {
        $comments[$filename] = $comment;
    }

    $saved = save_dir_comments($target_dir, $comments);
    if ($saved) {
        invalidate_dir_cache($target_dir, $real_base_dir, $thumbnail_dir);
        echo json_encode([
            'success' => true,
            'message' => 'Légende enregistrée avec succès',
            'filename' => $filename,
            'comment' => $comment
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Échec de l\'écriture du fichier de commentaires']);
    }
    exit;
}

if ($action === 'save_folder_settings') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Droits administrateur requis']);
        exit;
    }

    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $title = trim((string)($raw_body['title'] ?? $_POST['title'] ?? ''));
    $desc = trim((string)($raw_body['description'] ?? $_POST['description'] ?? ''));
    $bg = trim((string)($raw_body['background'] ?? $_POST['background'] ?? ''));
    $access_mode = trim((string)($raw_body['access_mode'] ?? $_POST['access_mode'] ?? 'public'));
    $password = trim((string)($raw_body['password'] ?? $_POST['password'] ?? ''));

    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Dossier introuvable ou accès refusé']);
        exit;
    }

    // Title
    $title_file = $target_dir . '/.title';
    if ($title === '') {
        if (file_exists($title_file)) @unlink($title_file);
    } else {
        @file_put_contents($title_file, $title . "\n");
    }

    // Description
    $desc_file = $target_dir . '/.desc';
    $desc_file2 = $target_dir . '/.description';
    if ($desc === '') {
        if (file_exists($desc_file)) @unlink($desc_file);
        if (file_exists($desc_file2)) @unlink($desc_file2);
    } else {
        if (file_exists($desc_file2)) @unlink($desc_file2);
        @file_put_contents($desc_file, $desc . "\n");
    }

    // Background
    $bg_file = $target_dir . '/.bg';
    if ($bg === '') {
        if (file_exists($bg_file)) @unlink($bg_file);
    } else {
        @file_put_contents($bg_file, $bg . "\n");
    }

    // Access Mode
    $private_file = $target_dir . '/.private';
    $password_file = $target_dir . '/.password';
    $public_file = $target_dir . '/.public';

    if ($access_mode === 'public') {
        if (file_exists($private_file)) @unlink($private_file);
        if (file_exists($password_file)) @unlink($password_file);
        if (basename($target_dir) === 'private') {
            @file_put_contents($public_file, "1\n");
        } else {
            if (file_exists($public_file)) @unlink($public_file);
        }
    } elseif ($access_mode === 'private') {
        if (file_exists($password_file)) @unlink($password_file);
        if (file_exists($public_file)) @unlink($public_file);
        @file_put_contents($private_file, "1\n");
    } elseif ($access_mode === 'password') {
        if (file_exists($private_file)) @unlink($private_file);
        if (file_exists($public_file)) @unlink($public_file);
        if ($password !== '') {
            $hash = password_hash($password, PASSWORD_BCRYPT);
            @file_put_contents($password_file, $hash . "\n");
        }
    }

    invalidate_dir_cache($target_dir, $real_base_dir, $thumbnail_dir);
    echo json_encode([
        'success' => true,
        'message' => 'Paramètres du dossier enregistrés avec succès'
    ]);
    exit;
}

if ($action === 'save_desktop_shortcuts') {
    $shortcuts = $raw_body['shortcuts'] ?? $_POST['shortcuts'] ?? null;
    if (!is_array($shortcuts)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Liste de raccourcis invalide']);
        exit;
    }

    $config_dir = __DIR__ . '/config';
    if (!is_dir($config_dir)) {
        @mkdir($config_dir, 0755, true);
    }
    $desktop_file = $config_dir . '/desktop.json';

    $existing = ['shortcuts' => []];
    if (file_exists($desktop_file)) {
        $parsed = json_decode((string)file_get_contents($desktop_file), true);
        if (is_array($parsed)) $existing = $parsed;
    }

    // Clean and validate shortcuts
    $sanitized = [];
    foreach ($shortcuts as $s) {
        if (!is_array($s)) continue;
        $sanitized[] = [
            'id'          => (string)($s['id'] ?? uniqid('sc_')),
            'type'        => (string)($s['type'] ?? 'app'),
            'appId'       => isset($s['appId']) ? (string)$s['appId'] : null,
            'path'        => isset($s['path']) ? (string)$s['path'] : null,
            'name'        => (string)($s['name'] ?? ''),
            'defaultName' => (string)($s['defaultName'] ?? ($s['name'] ?? '')),
            'nameKey'     => isset($s['nameKey']) ? (string)$s['nameKey'] : null,
            'icon'        => (string)($s['icon'] ?? '📁'),
            'thumb_url'   => isset($s['thumb_url']) ? (string)$s['thumb_url'] : null,
            'cover_url'   => isset($s['cover_url']) ? (string)$s['cover_url'] : null,
            'category'    => isset($s['category']) ? (string)$s['category'] : null,
            'extension'   => isset($s['extension']) ? (string)$s['extension'] : null,
            'enabled'     => $s['enabled'] !== false
        ];
    }

    $existing['shortcuts'] = $sanitized;
    $encoded = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $written = @file_put_contents($desktop_file, $encoded);

    if ($written !== false) {
        echo json_encode([
            'success'   => true,
            'message'   => 'Configuration du bureau enregistrée',
            'shortcuts' => $sanitized
        ]);
    } else {
        // Return success with local_only flag so frontend continues smoothly without 500 status
        echo json_encode([
            'success'    => true,
            'local_only' => true,
            'warning'    => 'Impossible d\'écrire config/desktop.json (permissions disque)',
            'shortcuts'  => $sanitized
        ]);
    }
    exit;
}

if ($action === 'get_desktop_shortcuts') {
    $desktop_file = __DIR__ . '/config/desktop.json';
    $config = ['shortcuts' => []];
    if (file_exists($desktop_file)) {
        $parsed = json_decode((string)file_get_contents($desktop_file), true);
        if (is_array($parsed)) $config = $parsed;
    }
    echo json_encode([
        'success'   => true,
        'shortcuts' => $config['shortcuts'] ?? []
    ]);
    exit;
}

if ($action === 'get_autostart_settings') {
    $cfg = get_autostart_config(__DIR__);
    echo json_encode([
        'success' => true,
        'config'  => $cfg
    ]);
    exit;
}

if ($action === 'save_autostart_settings') {
    if (empty($_SESSION['is_admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Action réservée à l\'administrateur.']);
        exit;
    }

    $raw_config = $_POST['config'] ?? $raw_body['config'] ?? null;
    if (is_string($raw_config)) {
        $raw_config = json_decode($raw_config, true);
    }

    if (!is_array($raw_config)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Format de configuration invalide.']);
        exit;
    }

    $storage_dir = __DIR__ . '/storage';
    if (!is_dir($storage_dir)) {
        @mkdir($storage_dir, 0755, true);
    }
    $autostart_file = $storage_dir . '/autostart.json';

    $encoded = json_encode($raw_config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $written = @file_put_contents($autostart_file, $encoded, LOCK_EX);

    if ($written !== false) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Impossible d\'écrire dans storage/autostart.json.']);
    }
    exit;
}

if ($action === 'upload_file' || $action === 'upload_media') {
    if (!has_permission('can_upload', $real_base_dir)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Permission d\'upload manquante.'
        ]);
        exit;
    }

    // CSRF token is verified globally via $mutating_actions

    $dir_param = $_POST['dir'] ?? $_GET['dir'] ?? '';
    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Dossier cible introuvable ou accès refusé.'
        ]);
        exit;
    }

    if (empty($_FILES)) {
        $content_length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        $post_max = ini_get('post_max_size');
        $error_msg = 'Aucun fichier reçu pour le téléversement.';
        if ($content_length > 0) {
            $error_msg = "La taille totale du téléversement dépasse la limite serveur post_max_size ({$post_max}).";
        }
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => $error_msg
        ]);
        exit;
    }

    $overwrite = isset($_POST['overwrite']) && ($_POST['overwrite'] === '1' || $_POST['overwrite'] === 'true');

    $allowed_exts = [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif', 'tiff',
        'mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv', 'avi',
        'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
        'pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip', 'rar', 'tar', 'gz', '7z'
    ];

    $forbidden_exts = [
        'php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc',
        'js', 'mjs', 'css', 'html', 'htm', 'htaccess', 'htpasswd',
        'sh', 'bat', 'cmd', 'exe', 'dll', 'py', 'pl', 'cgi'
    ];

    $files_input = $_FILES['file'] ?? $_FILES['files'] ?? null;
    if (!$files_input && !empty($_FILES)) {
        $keys = array_keys($_FILES);
        $first_key = $keys[0];
        $files_input = $_FILES[$first_key];
    }

    $uploaded_results = [];
    $errors = [];

    $is_multiple = is_array($files_input['name']);
    $file_count = $is_multiple ? count($files_input['name']) : 1;

    for ($i = 0; $i < $file_count; $i++) {
        $raw_name = $is_multiple ? $files_input['name'][$i] : $files_input['name'];
        $tmp_name = $is_multiple ? $files_input['tmp_name'][$i] : $files_input['tmp_name'];
        $error_code = $is_multiple ? $files_input['error'][$i] : $files_input['error'];

        if ($error_code !== UPLOAD_ERR_OK) {
            switch ($error_code) {
                case UPLOAD_ERR_INI_SIZE:
                    $max_size = ini_get('upload_max_filesize');
                    $errors[] = "Le fichier '{$raw_name}' dépasse la taille maximale autorisée par PHP (upload_max_filesize = {$max_size}).";
                    break;
                case UPLOAD_ERR_FORM_SIZE:
                    $errors[] = "Le fichier '{$raw_name}' dépasse la limite autorisée par le formulaire.";
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $errors[] = "Le téléversement de '{$raw_name}' a été interrompu.";
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $errors[] = "Aucun fichier téléversé pour '{$raw_name}'.";
                    break;
                case UPLOAD_ERR_NO_TMP_DIR:
                    $errors[] = "Erreur serveur : Dossier temporaire PHP manquant.";
                    break;
                case UPLOAD_ERR_CANT_WRITE:
                    $errors[] = "Erreur serveur : Échec de l'écriture de '{$raw_name}' sur le disque (permissions).";
                    break;
                case UPLOAD_ERR_EXTENSION:
                    $errors[] = "Une extension PHP a stoppé le téléversement de '{$raw_name}'.";
                    break;
                default:
                    $errors[] = "Erreur de téléversement pour '{$raw_name}' (Code {$error_code}).";
                    break;
            }
            continue;
        }

        $safe_filename = basename($raw_name);
        $safe_filename = preg_replace('/[^\w\.\-\s]/u', '_', $safe_filename);

        if ($safe_filename[0] === '.') {
            $errors[] = "Sécurité : Les fichiers système masqués (dotfiles) comme '{$raw_name}' sont strictement interdits.";
            continue;
        }

        if (preg_match('/\.(php|phtml|php3|php4|php5|phps|phar|inc|pl|py|cgi|sh|exe|bat|cmd)\./i', $safe_filename)) {
            $errors[] = "Sécurité : Double extension d'exécution suspecte détectée sur '{$raw_name}'.";
            continue;
        }

        $ext = strtolower(pathinfo($safe_filename, PATHINFO_EXTENSION));
        if ($ext === '' || in_array($ext, $forbidden_exts, true) || !in_array($ext, $allowed_exts, true)) {
            $errors[] = "Sécurité : L'extension '.{$ext}' du fichier '{$raw_name}' n'est pas autorisée.";
            continue;
        }

        $target_file_name = $safe_filename;
        $dest_path = $target_dir . '/' . $target_file_name;

        if (file_exists($dest_path) && !$overwrite) {
            $info = pathinfo($safe_filename);
            $base_name = $info['filename'];
            $counter = 1;
            while (file_exists($target_dir . '/' . $target_file_name)) {
                $target_file_name = $base_name . '_' . $counter . ($ext !== '' ? '.' . $ext : '');
                $counter++;
            }
            $dest_path = $target_dir . '/' . $target_file_name;
        }

        if (@move_uploaded_file($tmp_name, $dest_path)) {
            @chmod($dest_path, 0644);
            if ($ext === 'svg') {
                sanitize_svg_content($dest_path);
            }
            $uploaded_results[] = [
                'original_name' => $raw_name,
                'saved_name'    => $target_file_name,
                'renamed'       => ($target_file_name !== $raw_name)
            ];
        } else {
            $errors[] = "Échec du déplacement du fichier '{$raw_name}' vers le dossier cible.";
        }
    }

    if (!empty($uploaded_results)) {
        invalidate_dir_cache($target_dir, $real_base_dir, $thumbnail_dir);
    }

    $has_success = !empty($uploaded_results);
    http_response_code($has_success ? 200 : 400);

    echo json_encode([
        'success'  => $has_success,
        'uploaded' => $uploaded_results,
        'errors'   => $errors,
        'message'  => $has_success ? count($uploaded_results) . ' fichier(s) téléversé(s) avec succès.' : 'Échec du téléversement.'
    ]);
    exit;
}

if ($action === 'create_folder') {
    if (!has_permission('can_create_folder', $real_base_dir)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Permission de création de dossier manquante.'
        ]);
        exit;
    }

    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $folder_name = trim((string)($raw_body['folder_name'] ?? $raw_body['name'] ?? $_POST['folder_name'] ?? $_POST['name'] ?? ''));

    $target_dir = sanitize_path($dir_param, $real_base_dir);
    if ($target_dir === null || !is_dir($target_dir)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Dossier parent introuvable ou accès refusé.'
        ]);
        exit;
    }

    if ($folder_name === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Le nom du dossier ne peut pas être vide.'
        ]);
        exit;
    }

    $safe_folder_name = basename($folder_name);
    $safe_folder_name = preg_replace('/[^\w\.\-\s]/u', '_', $safe_folder_name);
    $safe_folder_name = trim($safe_folder_name);

    if ($safe_folder_name === '' || $safe_folder_name[0] === '.') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Sécurité : Les noms de dossiers masqués (dotfiles) ou invalides sont interdits.'
        ]);
        exit;
    }

    $new_folder_path = $target_dir . '/' . $safe_folder_name;

    if (file_exists($new_folder_path)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => "Un dossier ou un fichier nommé '{$safe_folder_name}' existe déjà."
        ]);
        exit;
    }

    if (@mkdir($new_folder_path, 0755, true)) {
        invalidate_dir_cache($target_dir, $real_base_dir, $thumbnail_dir);
        echo json_encode([
            'success'     => true,
            'message'     => 'Dossier créé avec succès.',
            'folder_name' => $safe_folder_name
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => "Échec de la création du dossier. Vérifiez les permissions d'écriture sur le serveur."
        ]);
    }
    exit;
}

if ($action === 'move_item') {
    if (!has_permission('can_move', $real_base_dir)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Permission de déplacement manquante.'
        ]);
        exit;
    }

    $source_param = $raw_body['source_path'] ?? $_POST['source_path'] ?? $_GET['source_path'] ?? '';
    $source_paths_param = $raw_body['source_paths'] ?? $_POST['source_paths'] ?? null;
    $target_dir_param = $raw_body['target_dir'] ?? $_POST['target_dir'] ?? $_GET['target_dir'] ?? '';

    $paths_to_move = [];
    if (is_array($source_paths_param) && !empty($source_paths_param)) {
        $paths_to_move = $source_paths_param;
    } elseif (!empty($source_param)) {
        $paths_to_move = [$source_param];
    }

    if (empty($paths_to_move)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Aucun fichier source spécifié pour le déplacement.'
        ]);
        exit;
    }

    $target_dir_full = sanitize_path($target_dir_param, $real_base_dir);
    if ($target_dir_full === null || !is_dir($target_dir_full)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Dossier de destination introuvable ou accès refusé.'
        ]);
        exit;
    }

    $real_base = str_replace('\\', '/', realpath($real_base_dir) ?: $real_base_dir);
    $real_base_slash = rtrim($real_base, '/') . '/';

    $moved_count = 0;
    $errors = [];

    foreach ($paths_to_move as $sp) {
        $source_rel = str_replace(['\\', '..'], ['/', ''], $sp);
        $source_full = $real_base . '/' . ltrim($source_rel, '/');
        $source_full = str_replace('\\', '/', realpath($source_full) ?: $source_full);

        if (!file_exists($source_full)) {
            $errors[] = "Introuvable : " . basename($sp);
            continue;
        }

        if ($source_full !== $real_base && strpos($source_full . '/', $real_base_slash) !== 0) {
            $errors[] = "Accès refusé : " . basename($sp);
            continue;
        }

        if (strtolower($source_full) === strtolower($real_base)) {
            $errors[] = "Impossible de déplacer la racine";
            continue;
        }

        if (is_dir($source_full)) {
            if (strtolower($target_dir_full) === strtolower($source_full) || stripos($target_dir_full, $source_full . '/') === 0) {
                $errors[] = "Impossible de déplacer un dossier dans lui-même";
                continue;
            }
        }

        $source_parent_dir = str_replace('\\', '/', dirname($source_full));
        if (strtolower($source_parent_dir) === strtolower($target_dir_full)) {
            $moved_count++;
            continue;
        }

        $item_name = basename($source_full);
        $dest_full = $target_dir_full . '/' . $item_name;

        if (file_exists($dest_full)) {
            $info = pathinfo($item_name);
            $base_name = $info['filename'];
            $ext = isset($info['extension']) ? '.' . $info['extension'] : '';
            $counter = 1;
            while (file_exists($target_dir_full . '/' . $base_name . '_' . $counter . $ext)) {
                $counter++;
            }
            $dest_full = $target_dir_full . '/' . $base_name . '_' . $counter . $ext;
        }

        error_clear_last();
        $move_success = @rename($source_full, $dest_full);
        if (!$move_success && is_file($source_full)) {
            $move_success = @copy($source_full, $dest_full) && @unlink($source_full);
        }

        if ($move_success) {
            invalidate_dir_cache($source_parent_dir, $real_base_dir, $thumbnail_dir);
            invalidate_dir_cache($target_dir_full, $real_base_dir, $thumbnail_dir);
            $moved_count++;
        } else {
            $errors[] = "Échec du déplacement de " . basename($sp);
        }
    }

    echo json_encode([
        'success'     => $moved_count > 0,
        'moved_count' => $moved_count,
        'errors'      => $errors,
        'message'     => $moved_count . ' élément(s) déplacé(s) avec succès.'
    ]);
    exit;
}

function recursive_delete_dir(string $dir): bool {
    if (!is_dir($dir)) return false;
    $items = @scandir($dir);
    if ($items === false) return false;

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . '/' . $item;
        if (is_dir($path)) {
            recursive_delete_dir($path);
        } else {
            @unlink($path);
        }
    }
    return @rmdir($dir);
}

if ($action === 'delete_item' || $action === 'delete_file' || $action === 'delete_folder') {
    if (!has_permission('can_delete', $real_base_dir)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Permission de suppression manquante.'
        ]);
        exit;
    }

    $target_param = $raw_body['target_path'] ?? $raw_body['path'] ?? $raw_body['file_path'] ?? $raw_body['folder_path'] ?? $_POST['target_path'] ?? $_POST['path'] ?? $_POST['file_path'] ?? $_POST['folder_path'] ?? $_GET['target_path'] ?? '';
    if (empty($target_param)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Chemin de l\'élément à supprimer non spécifié.'
        ]);
        exit;
    }

    $real_base = str_replace('\\', '/', realpath($real_base_dir) ?: $real_base_dir);
    $target_rel = str_replace(['\\', '..'], ['/', ''], $target_param);
    $target_full = $real_base . '/' . ltrim($target_rel, '/');
    $target_full = str_replace('\\', '/', realpath($target_full) ?: $target_full);

    if (!file_exists($target_full)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'L\'élément à supprimer n\'existe pas.'
        ]);
        exit;
    }

    $real_base_slash = rtrim($real_base, '/') . '/';
    if ($target_full !== $real_base && strpos($target_full . '/', $real_base_slash) !== 0) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé.'
        ]);
        exit;
    }

    if (strtolower($target_full) === strtolower($real_base)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Sécurité : Impossible de supprimer le dossier racine de la galerie.'
        ]);
        exit;
    }

    $parent_dir = str_replace('\\', '/', dirname($target_full));
    $item_name = basename($target_full);

    error_clear_last();
    $delete_success = false;
    if (is_dir($target_full)) {
        $delete_success = recursive_delete_dir($target_full);
    } else {
        $delete_success = @unlink($target_full);
        $thumb_cache_dir = get_cache_storage_dir($real_base_dir, $thumbnail_dir);
        $thumb_cache_file = $thumb_cache_dir . '/' . md5(get_relative_path($target_full, $real_base_dir)) . '.jpg';
        if (file_exists($thumb_cache_file)) {
            @unlink($thumb_cache_file);
        }
    }

    if ($delete_success) {
        invalidate_dir_cache($parent_dir, $real_base_dir, $thumbnail_dir);
        echo json_encode([
            'success' => true,
            'message' => __t('api.success_deleted', ['name' => $item_name])
        ]);
    } else {
        $last_err = error_get_last();
        $detail = $last_err ? $last_err['message'] : 'Permissions';
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => __t('api.err_delete_failed', ['detail' => $detail])
        ]);
    }
    exit;
}

if ($action === 'edit_image') {
    if (!is_admin_logged_in() && !has_permission('can_upload', $real_base_dir)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => __t('api.err_admin_required')
        ]);
        exit;
    }

    $target_param = $raw_body['target_path'] ?? $_POST['target_path'] ?? '';
    $save_mode = $raw_body['save_mode'] ?? $_POST['save_mode'] ?? 'copy'; // 'overwrite' or 'copy'
    $image_data = $raw_body['image_data'] ?? $_POST['image_data'] ?? ''; // base64 data URI

    if (empty($target_param)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => __t('api.err_invalid_path')]);
        exit;
    }

    if (empty($image_data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => __t('api.err_missing_image_data')]);
        exit;
    }

    $target_file = sanitize_file_path($target_param, $real_base_dir);
    if ($target_file === null || !is_file($target_file) || is_path_ignored($target_file, $real_base_dir, $ignore_list)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => __t('api.err_invalid_path')]);
        exit;
    }

    $ext = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));
    if (!in_array($ext, $media_types['image'], true) || in_array($ext, ['php', 'phtml', 'phar', 'svg'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => __t('api.err_unsupported_format')]);
        exit;
    }

    // Decode base64 image data
    if (preg_match('/^data:image\/(\w+);base64,/', $image_data, $type_match)) {
        $data_substr = substr($image_data, strpos($image_data, ',') + 1);
        $decoded_image = base64_decode($data_substr);
        if ($decoded_image === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => __t('api.err_invalid_image_data')]);
            exit;
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => __t('api.err_invalid_image_data')]);
        exit;
    }

    // Verify it is a valid image with getimagesizefromstring if available
    if (function_exists('getimagesizefromstring')) {
        $check_info = @getimagesizefromstring($decoded_image);
        if ($check_info === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => __t('api.err_invalid_image_data')]);
            exit;
        }
    }

    $parent_dir = dirname($target_file);
    if (!is_writable($parent_dir)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => __t('api.err_write_permission')]);
        exit;
    }

    $dest_file = $target_file;
    $is_copy = ($save_mode === 'copy');

    if ($is_copy) {
        $info = pathinfo($target_file);
        $base_name = $info['filename'];
        $file_ext = !empty($info['extension']) ? '.' . $info['extension'] : '.jpg';
        
        // Strip previous _edited suffix if present to prevent photo_edited_edited_edited...
        $clean_base = preg_replace('/_edited(_\d+)?$/i', '', $base_name);
        $candidate_name = $clean_base . '_edited' . $file_ext;
        $counter = 1;
        while (file_exists($parent_dir . '/' . $candidate_name)) {
            $candidate_name = $clean_base . '_edited_' . $counter . $file_ext;
            $counter++;
        }
        $dest_file = $parent_dir . '/' . $candidate_name;
    }

    // Preserve original EXIF metadata if editing a JPEG image
    $image_to_write = $decoded_image;
    if (($ext === 'jpg' || $ext === 'jpeg') && function_exists('transfer_jpeg_exif')) {
        $image_to_write = transfer_jpeg_exif($target_file, $decoded_image);
    }

    $save_success = (@file_put_contents($dest_file, $image_to_write, LOCK_EX) !== false);

    if ($save_success) {
        @chmod($dest_file, 0644);

        // Invalidate directory cache
        invalidate_dir_cache($parent_dir, $real_base_dir, $thumbnail_dir);

        // If overwrite, also delete old cached thumbnail
        if (!$is_copy) {
            $rel = get_relative_path($dest_file, $real_base_dir);
            $thumb_cache_dir = get_cache_storage_dir($real_base_dir, $thumbnail_dir);
            $cache_key_jpg = $thumb_cache_dir . '/' . md5($rel) . '.jpg';
            if (file_exists($cache_key_jpg)) @unlink($cache_key_jpg);
        }

        $saved_relative = get_relative_path($dest_file, $real_base_dir);
        $saved_filename = basename($dest_file);

        echo json_encode([
            'success'        => true,
            'message'        => $is_copy ? __t('api.success_copy_saved', ['name' => $saved_filename]) : __t('api.success_image_updated', ['name' => $saved_filename]),
            'save_mode'      => $save_mode,
            'is_copy'        => $is_copy,
            'file_name'      => $saved_filename,
            'path'           => $saved_relative,
            'thumb_url'      => 'thumb.php?file=' . rawurlencode($saved_relative) . '&t=' . time(),
            'file_url'       => 'thumb.php?file=' . rawurlencode($saved_relative) . '&raw=1&t=' . time()
        ]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => __t('api.err_file_write_failed')]);
        exit;
    }
}

if ($action === 'save_text_file') {
    if (!is_admin_logged_in() && !has_permission('can_upload', $real_base_dir)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => __t('api.err_admin_required')
        ]);
        exit;
    }

    $target_param = $raw_body['target_path'] ?? $_POST['target_path'] ?? '';
    $content = $raw_body['content'] ?? $_POST['content'] ?? null;

    if (empty($target_param)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => __t('api.err_invalid_path')]);
        exit;
    }

    if ($content === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => __t('api.err_missing_content') ?: 'Contenu manquant']);
        exit;
    }

    $target_file = sanitize_file_path($target_param, $real_base_dir);
    if ($target_file === null || !is_file($target_file)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => __t('api.err_invalid_path')]);
        exit;
    }

    $base_name = basename($target_file);
    $sensitive_files = ['.admin_password_hash', '.htaccess', '.htpasswd', '.env', '.user.ini', 'php.ini', 'web.config'];
    if (in_array(strtolower($base_name), $sensitive_files, true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => __t('api.err_unsupported_format') ?: 'Fichier système protégé']);
        exit;
    }

    $ext = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));
    $allowed_text_exts = ['md', 'markdown', 'txt', 'json', 'csv', 'xml', 'html', 'css', 'js', 'log', 'ini', 'sql', 'yaml', 'yml'];
    $disallowed_exts = ['php', 'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'phps', 'sh', 'bash', 'exe', 'bat', 'cmd', 'cgi', 'pl', 'py'];

    if (!in_array($ext, $allowed_text_exts, true) || in_array($ext, $disallowed_exts, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => __t('api.err_unsupported_format')]);
        exit;
    }

    $parent_dir = dirname($target_file);
    $save_success = (@file_put_contents($target_file, $content, LOCK_EX) !== false);
    if (!$save_success) {
        $save_success = (@file_put_contents($target_file, $content) !== false);
    }

    if ($save_success) {
        @chmod($target_file, 0644);
        invalidate_dir_cache($parent_dir, $real_base_dir, $thumbnail_dir);

        $saved_relative = get_relative_path($target_file, $real_base_dir);
        $saved_filename = basename($target_file);

        echo json_encode([
            'success'   => true,
            'message'   => __t('doc_editor.save_success') ?: 'Document enregistré avec succès !',
            'file_name' => $saved_filename,
            'path'      => $saved_relative,
            'size'      => filesize($target_file)
        ]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => __t('api.err_file_write_failed')]);
        exit;
    }
}

// load_dir_comments(), save_dir_comments(), and load_folder_overrides() imported from functions.php


function find_first_image_thumbnail(string $dir_path, string $base_dir, array $image_exts): ?string {
    $items = @scandir($dir_path);
    if ($items === false) return null;

    foreach ($items as $item) {
        if ($item[0] === '.') continue;
        $full = $dir_path . '/' . $item;
        if (is_file($full)) {
            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (in_array($ext, $image_exts, true)) {
                $rel = get_relative_path($full, $base_dir);
                return 'thumb.php?file=' . rawurlencode($rel);
            }
        }
    }
    return null;
}

$requested_dir = $_GET['dir'] ?? '';
$target_dir = sanitize_path($requested_dir, $real_base_dir);

if ($target_dir === null || !is_dir($target_dir) || is_path_ignored($target_dir, $real_base_dir, $ignore_list)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error'   => 'Directory not found or access denied.'
    ]);
    exit;
}

$current_relative = get_relative_path($target_dir, $real_base_dir);

// Access check for target directory
if (!is_dir_accessible($target_dir, $real_base_dir)) {
    $access_info = get_dir_access_info($target_dir, $real_base_dir);
    if ($access_info['is_protected']) {
        http_response_code(401);
        echo json_encode([
            'success'      => false,
            'error'        => 'Ce dossier est protégé par un mot de passe.',
            'is_protected' => true,
            'path'         => $current_relative
        ]);
        exit;
    } else {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé.'
        ]);
        exit;
    }
}

$comments = load_dir_comments($target_dir);
$folder_overrides = load_folder_overrides($target_dir, $real_base_dir);

// Build breadcrumbs
$breadcrumbs = [['name' => $gallery_title, 'path' => '']];
if ($current_relative !== '') {
    $parts = explode('/', $current_relative);
    $accumulated = '';
    foreach ($parts as $part) {
        $accumulated = ($accumulated === '') ? $part : $accumulated . '/' . $part;
        $part_dir = sanitize_path($accumulated, $real_base_dir);
        $part_title = $part;

        if ($part_dir && file_exists($part_dir . '/.title')) {
            $custom_t = trim(@file_get_contents($part_dir . '/.title'));
            if ($custom_t !== '') $part_title = $custom_t;
        }

        $breadcrumbs[] = [
            'name' => $part_title,
            'path' => $accumulated
        ];
    }
}

// Parent path
$parent_path = null;
if ($current_relative !== '') {
    $parent_dir_full = dirname($target_dir);
    if (strpos($parent_dir_full, $real_base_dir) === 0) {
        $parent_path = get_relative_path($parent_dir_full, $real_base_dir);
    }
}

$directories = [];
$files = [];

$cache_file_path = get_dir_cache_file_path($target_dir, $real_base_dir, $thumbnail_dir);
$cached_raw = null;

if (is_dir_cache_valid($cache_file_path, $target_dir)) {
    $json_content = @file_get_contents($cache_file_path);
    if ($json_content) {
        $decoded = @json_decode($json_content, true);
        if (is_array($decoded) && isset($decoded['raw_items'])) {
            $cached_raw = $decoded['raw_items'];
        }
    }
}

if ($cached_raw !== null) {
    // CACHE HIT: Process pre-computed raw items with dynamic access controls
    foreach ($cached_raw['directories'] as $dir_item) {
        $full_item_path = $target_dir . '/' . $dir_item['raw_name'];
        $sub_access = get_dir_access_info($full_item_path, $real_base_dir);

        if ($sub_access['is_private'] && !is_admin_logged_in()) {
            continue;
        }

        $dir_display_name = $dir_item['raw_name'];
        if (file_exists($full_item_path . '/.title')) {
            $custom_title = trim(@file_get_contents($full_item_path . '/.title'));
            if ($custom_title !== '') {
                $dir_display_name = $custom_title;
            }
        }

        $cover_thumb = null;
        if ($sub_access['is_unlocked'] || is_admin_logged_in()) {
            $cover_exts = array_merge($media_types['image'], $media_types['video']);
            $cover_thumb = find_first_image_thumbnail($full_item_path, $real_base_dir, $cover_exts);
        }

        $sub_items = @scandir($full_item_path) ?: [];
        $live_item_count = 0;
        foreach ($sub_items as $sub) {
            if ($sub[0] !== '.' && !in_array($sub, $ignore_list, true)) {
                $live_item_count++;
            }
        }

        $directories[] = [
            'name'         => $dir_display_name,
            'raw_name'     => $dir_item['raw_name'],
            'path'         => $dir_item['path'],
            'mtime'        => $dir_item['mtime'],
            'item_count'   => $live_item_count,
            'cover'        => $cover_thumb,
            'comment'      => $comments[$dir_item['raw_name']] ?? '',
            'access_mode'  => $sub_access['access_mode'],
            'is_private'   => $sub_access['is_private'],
            'is_protected' => $sub_access['is_protected'],
            'is_unlocked'  => $sub_access['is_unlocked']
        ];
    }

    foreach ($cached_raw['files'] as $file_item) {
        $file_item['comment'] = $comments[$file_item['name']] ?? '';
        $files[] = $file_item;
    }
} else {
    // CACHE MISS: Full disk scan & EXIF extraction
    $raw_directories = [];
    $raw_files = [];

    $scan_items = @scandir($target_dir);
    if ($scan_items !== false) {
        foreach ($scan_items as $item) {
            if (in_array($item, $ignore_list, true) || $item[0] === '.') {
                continue;
            }

            $full_item_path = $target_dir . '/' . $item;
            $item_relative = get_relative_path($full_item_path, $real_base_dir);

            if (is_dir($full_item_path)) {
                $sub_access = get_dir_access_info($full_item_path, $real_base_dir);

                $sub_items = @scandir($full_item_path) ?: [];
                $item_count = 0;
                foreach ($sub_items as $sub) {
                    $sub_ext = strtolower(pathinfo($sub, PATHINFO_EXTENSION));
                    if ($sub[0] !== '.' && !in_array($sub, $ignore_list, true) && !in_array($sub_ext, ['php', 'phtml', 'phar', 'htaccess', 'ini', 'hash'], true)) {
                        $item_count++;
                    }
                }

                $raw_directories[] = [
                    'raw_name'   => $item,
                    'path'       => $item_relative,
                    'mtime'      => filemtime($full_item_path),
                    'item_count' => $item_count
                ];

                if ($sub_access['is_private'] && !is_admin_logged_in()) {
                    continue;
                }

                $dir_display_name = $item;
                if (file_exists($full_item_path . '/.title')) {
                    $custom_title = trim(@file_get_contents($full_item_path . '/.title'));
                    if ($custom_title !== '') {
                        $dir_display_name = $custom_title;
                    }
                }

                $cover_thumb = null;
                if ($sub_access['is_unlocked'] || is_admin_logged_in()) {
                    $cover_exts = array_merge($media_types['image'], $media_types['video']);
                    $cover_thumb = find_first_image_thumbnail($full_item_path, $real_base_dir, $cover_exts);
                }

                $directories[] = [
                    'name'         => $dir_display_name,
                    'raw_name'     => $item,
                    'path'         => $item_relative,
                    'mtime'        => filemtime($full_item_path),
                    'item_count'   => $item_count,
                    'cover'        => $cover_thumb,
                    'comment'      => $comments[$item] ?? '',
                    'access_mode'  => $sub_access['access_mode'],
                    'is_private'   => $sub_access['is_private'],
                    'is_protected' => $sub_access['is_protected'],
                    'is_unlocked'  => $sub_access['is_unlocked']
                ];
            } elseif (is_file($full_item_path)) {
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                $forbidden_system_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc', 'js', 'css', 'html', 'htm', 'htaccess', 'htpasswd', 'sh', 'bat', 'cmd', 'exe', 'dll', 'py', 'pl', 'cgi', 'hash', 'ini', 'sql', 'bak', 'json'];
                if ($ext === '' || in_array($ext, $forbidden_system_exts, true) || in_array($item, $ignore_list, true)) {
                    continue;
                }
                $category = get_media_category($ext, $media_types);
                $size = filesize($full_item_path);
                $mtime = filemtime($full_item_path);

                $exif = ($category === 'image') ? extract_exif_data($full_item_path) : null;
                $effective_mtime = ($exif && !empty($exif['date_ts'])) ? $exif['date_ts'] : $mtime;

                $file_entry = [
                    'name'           => $item,
                    'path'           => $item_relative,
                    'extension'      => $ext,
                    'category'       => $category,
                    'size'           => $size,
                    'size_formatted' => format_bytes($size),
                    'mtime'          => $mtime,
                    'effective_mtime'=> $effective_mtime,
                    'exif'           => $exif,
                    'thumb_url'      => 'thumb.php?file=' . rawurlencode($item_relative),
                    'file_url'       => 'thumb.php?file=' . rawurlencode($item_relative) . '&raw=1',
                    'comment'        => $comments[$item] ?? ''
                ];

                $raw_files[] = $file_entry;
                $files[]     = $file_entry;
            }
        }
    }

    $cache_payload = [
        'created_at' => time(),
        'raw_items'  => [
            'directories' => $raw_directories,
            'files'       => $raw_files
        ]
    ];
    @file_put_contents($cache_file_path, json_encode($cache_payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

usort($directories, function($a, $b) {
    return strnatcasecmp($a['name'], $b['name']);
});
usort($files, function($a, $b) {
    return strnatcasecmp($a['name'], $b['name']);
});

$output_data = [
    'success'           => true,
    'csrf_token'        => get_csrf_token(),
    'title'             => $folder_overrides['title'] ?? $gallery_title,
    'current_path'      => $current_relative,
    'parent_path'       => $parent_path,
    'breadcrumbs'       => $breadcrumbs,
    'overrides'         => $folder_overrides,
    'directories'       => $directories,
    'files'             => $files,
    'is_admin'          => is_admin_logged_in(),
    'admin_enabled'     => !empty($admin_password_hash),
    'user_permissions'  => load_permissions_config($real_base_dir),
    'user_rights'        => [
        'is_admin'             => is_admin_logged_in(),
        'can_upload'           => has_permission('can_upload', $real_base_dir),
        'can_delete'           => has_permission('can_delete', $real_base_dir),
        'can_move'             => has_permission('can_move', $real_base_dir),
        'can_comment'          => has_permission('can_comment', $real_base_dir),
        'can_create_folder'    => has_permission('can_create_folder', $real_base_dir),
        'can_download_archive' => has_permission('can_download_archive', $real_base_dir),
        'can_download_item'    => has_permission('can_download_item', $real_base_dir)
    ],
    'available_archives'=> find_archive_binaries(),
    'stats'             => [
        'directory_count' => count($directories),
        'file_count'      => count($files)
    ]
];

if (function_exists('sanitize_utf8')) {
    $output_data = sanitize_utf8($output_data);
}

$json_flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
    $json_flags |= JSON_INVALID_UTF8_SUBSTITUTE;
}

$json_string = json_encode($output_data, $json_flags);
if ($json_string === false) {
    $json_string = json_encode([
        'success' => false,
        'error'   => 'JSON encoding error: ' . json_last_error_msg()
    ]);
}
echo $json_string;
