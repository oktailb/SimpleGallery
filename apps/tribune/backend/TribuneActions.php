<?php
namespace SimpleGallery\Apps\Tribune\Backend;

class TribuneActions {

    public static function getBoardsFilePath(string $base_dir): string {
        $project_root = dirname(dirname(dirname(__DIR__)));
        $p1 = $project_root . '/storage/tribune_boards.json';
        if (file_exists($p1)) return $p1;
        $p2 = $base_dir . '/storage/tribune_boards.json';
        if (file_exists($p2)) return $p2;
        return $p1;
    }

    public static function getMessagesFilePath(string $base_dir): string {
        $project_root = dirname(dirname(dirname(__DIR__)));
        $p1 = $project_root . '/storage/tribune_messages.json';
        if (file_exists($p1)) return $p1;
        $p2 = $base_dir . '/storage/tribune_messages.json';
        if (file_exists($p2)) return $p2;
        return $p1;
    }

    public static function getSecretsConfig(string $base_dir): array {
        $project_root = dirname(dirname(dirname(__DIR__)));
        $f1 = $project_root . '/storage/tribune_secrets.php';
        if (file_exists($f1)) return include $f1;
        $f2 = $base_dir . '/storage/tribune_secrets.php';
        if (file_exists($f2)) return include $f2;
        return [];
    }

    public static function getOauthSecret(string $board_id, string $key, string $base_dir): ?string {
        $env_key = 'GB2C_' . strtoupper($board_id) . '_' . strtoupper($key);
        $env_val = getenv($env_key);
        if (!empty($env_val)) return $env_val;

        $env_key2 = strtoupper($board_id) . '_' . strtoupper($key);
        $env_val2 = getenv($env_key2);
        if (!empty($env_val2)) return $env_val2;

        $secrets = self::getSecretsConfig($base_dir);
        if (isset($secrets[$board_id][$key])) {
            return $secrets[$board_id][$key];
        }
        return null;
    }

    public static function getBoardsConfig(string $base_dir): array {
        $storage_file = self::getBoardsFilePath($base_dir);
        if (file_exists($storage_file)) {
            $content = @file_get_contents($storage_file);
            $decoded = @json_decode($content, true);
            if (is_array($decoded) && !empty($decoded)) {
                return $decoded;
            }
        }

        return [
            'local' => [
                'name'        => 'Tribune Interne (SimpleGallery)',
                'description' => 'Tribune de discussion locale intégrée à SimpleGallery WebOS',
                'url'         => 'system/endpoints/api.php?action=tribune_get',
                'post_url'    => 'system/endpoints/api.php?action=tribune_post',
                'backend_type'=> 'local',
                'color'       => '#3b82f6',
                'anonymous'   => true
            ],
            'linuxfr' => [
                'name'        => 'LinuxFr.org (Bouchot)',
                'description' => 'Tribune publique historique des libristes francophones',
                'url'         => 'https://linuxfr.org/board/index.xml',
                'post_url'    => 'https://linuxfr.org/board',
                'backend_type'=> 'tsv',
                'color'       => '#10b981',
                'anonymous'   => true,
                'post_param'  => 'board[message]',
                'extra_params'=> ['utf8' => '✓'],
                'extract_csrf'=> true,
                'oauth'       => [
                    'authorize_url' => 'https://linuxfr.org/oauth/authorize',
                    'token_url'     => 'https://linuxfr.org/oauth/token',
                    'client_id'     => '',
                    'scope'         => 'account board'
                ]
            ],
            'dlfp' => [
                'name'        => 'Da Linux French Page',
                'description' => 'Flux alternatif LinuxFr.org',
                'url'         => 'https://linuxfr.org/board/index.xml',
                'post_url'    => 'https://linuxfr.org/board',
                'backend_type'=> 'tsv',
                'color'       => '#6366f1',
                'anonymous'   => true,
                'post_param'  => 'board[message]',
                'extract_csrf'=> true
            ]
        ];
    }

    public static function httpRequestProxy(string $url, string $method = 'GET', array $headers = [], ?string $post_data = null, int $timeout = 6): array {
        $is_post = (strtoupper($method) === 'POST');
        $header_lines = [];
        foreach ($headers as $h) {
            if (is_string($h) && trim($h) !== '') {
                $header_lines[] = trim($h);
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
                if ($post_data !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
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
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]
        ];

        $context = stream_context_create($opts);
        $body = @file_get_contents($url, false, $context);
        $status_code = 200;
        $location = '';
        $cookies = [];
        $resp_headers = $http_response_header ?? [];

        if (is_array($resp_headers)) {
            foreach ($resp_headers as $line) {
                if (preg_match('/HTTP\/\d\.\d\s+(\d+)/i', $line, $m)) $status_code = (int)$m[1];
                if (stripos($line, 'Location:') === 0) $location = trim(substr($line, 9));
                if (stripos($line, 'Set-Cookie:') === 0 && preg_match('/^Set-Cookie:\s*([^;]+)/i', $line, $mc)) {
                    $cookies[] = trim($mc[1]);
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

    public static function processScheduledPosts(string $base_dir): void {
        $sched_file = $base_dir . '/storage/tribune_scheduled_posts.json';
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
                        $storage_file = $base_dir . '/storage/tribune_messages.json';
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

                            self::httpRequestProxy($post['target_url'], 'POST', $headers, http_build_query($post_fields), 6);
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

    public static function handle(string $action, array $raw_body, string|array $base_dir): ?array {
        if (is_array($base_dir)) {
            $base_dir = $base_dir['base_dir'] ?? '';
        }
        if ($action === 'tribune_boards_get') {

            $boards = self::getBoardsConfig($base_dir);
            foreach ($boards as $bid => &$cfg) {
                if (isset($cfg['oauth']['client_secret'])) {
                    unset($cfg['oauth']['client_secret']);
                }
            }
            unset($cfg);
            return ['status' => 200, 'data' => ['success' => true, 'boards' => $boards]];
        }

        if ($action === 'tribune_boards_save') {
            $new_boards = $_POST['boards'] ?? $raw_body['boards'] ?? null;
            if (!is_array($new_boards)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Format de configuration invalide.']];
            }

            $storage_file = self::getBoardsFilePath($base_dir);
            @file_put_contents($storage_file, json_encode($new_boards, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

            return ['status' => 200, 'data' => ['success' => true, 'message' => 'Configuration des tribunes sauvegardée.']];
        }

        if ($action === 'tribune_oauth_authorize') {
            $board_id = trim($_GET['board_id'] ?? $_POST['board_id'] ?? $raw_body['board_id'] ?? '');
            $all_boards = self::getBoardsConfig($base_dir);
            $board_cfg = $all_boards[$board_id] ?? null;
            $oauth_cfg = $board_cfg['oauth'] ?? null;

            if (!$oauth_cfg || empty($oauth_cfg['authorize_url'])) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Configuration OAuth2 manquante pour cette tribune.']];
            }

            $client_id = !empty($oauth_cfg['client_id']) ? $oauth_cfg['client_id'] : self::getOauthSecret($board_id, 'client_id', $base_dir);
            if (empty($client_id)) $client_id = 'simplegallery_webos';

            $state = bin2hex(random_bytes(16));
            $_SESSION['tribune_oauth_state_' . $board_id] = $state;

            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
            $req_path = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
            $root_api_path = preg_replace('#/(apps/tribune|system/endpoints)/api\.php$#', '/api.php', $req_path);
            if (!str_ends_with($root_api_path, '/api.php')) {
                $root_api_path = rtrim(dirname($req_path), '/') . '/api.php';
            }
            $base_uri = $scheme . '://' . $host . $root_api_path;
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
                return ['status' => 200, 'data' => ['success' => true, 'authorize_url' => $authorize_url]];
            }

            header('Location: ' . $authorize_url, true, 302);
            exit;
        }

        if ($action === 'tribune_oauth_callback') {
            $board_id = trim($_GET['board_id'] ?? '');
            $code = trim($_GET['code'] ?? '');
            $state = trim($_GET['state'] ?? '');

            $all_boards = self::getBoardsConfig($base_dir);
            $board_cfg = $all_boards[$board_id] ?? null;
            $oauth_cfg = $board_cfg['oauth'] ?? null;

            if (!$oauth_cfg || empty($oauth_cfg['token_url']) || empty($code)) {
                echo '<!DOCTYPE html><html><body><script>alert("Erreur lors de l\'authentification OAuth : Code ou configuration manquant."); window.close();</script></body></html>';
                exit;
            }

            $client_id = !empty($oauth_cfg['client_id']) ? $oauth_cfg['client_id'] : self::getOauthSecret($board_id, 'client_id', $base_dir);
            $client_secret = self::getOauthSecret($board_id, 'client_secret', $base_dir);

            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
            $req_path = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
            $root_api_path = preg_replace('#/(apps/tribune|system/endpoints)/api\.php$#', '/api.php', $req_path);
            if (!str_ends_with($root_api_path, '/api.php')) {
                $root_api_path = rtrim(dirname($req_path), '/') . '/api.php';
            }
            $base_uri = $scheme . '://' . $host . $root_api_path;
            $redirect_uri = !empty($oauth_cfg['redirect_uri']) ? $oauth_cfg['redirect_uri'] : ($base_uri . '?action=tribune_oauth_callback&board_id=' . urlencode($board_id));

            $post_fields = [
                'client_id'     => $client_id,
                'client_secret' => $client_secret,
                'code'          => $code,
                'grant_type'    => 'authorization_code',
                'redirect_uri'  => $redirect_uri
            ];

            $res = self::httpRequestProxy($oauth_cfg['token_url'], 'POST', ["Content-Type: application/x-www-form-urlencoded", "User-Agent: SimpleGallery-WebOS/1.0"], http_build_query($post_fields), 10);
            $data = @json_decode($res['body'], true) ?: [];
            $token = $data['access_token'] ?? '';
            $login = $data['login'] ?? '';

            if (empty($login) && !empty($token)) {
                $me_res = self::httpRequestProxy("https://linuxfr.org/api/v1/me?bearer_token=" . urlencode($token), 'GET', ["User-Agent: SimpleGallery-WebOS/1.0"], null, 5);
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

            $json_payload = json_encode($payload_assoc, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            header('Content-Type: text/html; charset=utf-8');
            echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Authentification Réussie</title></head><body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0;"><div style="font-size:3rem; margin-bottom:12px;">🔑</div><h2 style="margin:0 0 8px 0; color:#34d399;">Connexion OAuth2 Réussie !</h2><p style="color:#94a3b8; margin:0;">Fermeture de la fenêtre...</p><script>(function() { var payload = ' . $json_payload . '; if (window.opener && !window.opener.closed) { try { window.opener.postMessage(payload, "*"); } catch (e) {} } setTimeout(function() { window.close(); }, 500); })();</script></body></html>';
            exit;
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
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Le message ne peut pas être vide.']];
            }

            if ($sched_ts <= (time() - 30)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'L\'heure programmée doit être située dans le futur.']];
            }

            $sched_file = $base_dir . '/storage/tribune_scheduled_posts.json';
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

            return ['status' => 200, 'data' => [
                'success'   => true,
                'message'   => 'Message programmé avec succès.',
                'item'      => $scheduled_item,
                'count'     => count($scheduled)
            ]];
        }

        if ($action === 'tribune_scheduled_list') {
            self::processScheduledPosts($base_dir);
            $sched_file = $base_dir . '/storage/tribune_scheduled_posts.json';
            $scheduled = [];
            if (file_exists($sched_file)) {
                $scheduled = @json_decode(@file_get_contents($sched_file), true) ?: [];
            }

            return ['status' => 200, 'data' => [
                'success'   => true,
                'scheduled' => array_values($scheduled),
                'count'     => count($scheduled),
                'server_ts' => time()
            ]];
        }

        if ($action === 'tribune_schedule_cancel') {
            $id = trim($_POST['id'] ?? $raw_body['id'] ?? '');
            if (empty($id)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'ID de message programmé manquant.']];
            }

            $sched_file = $base_dir . '/storage/tribune_scheduled_posts.json';
            $scheduled = [];
            if (file_exists($sched_file)) {
                $scheduled = @json_decode(@file_get_contents($sched_file), true) ?: [];
            }

            $filtered = array_filter($scheduled, function ($item) use ($id) {
                return ($item['id'] ?? '') !== $id;
            });

            @file_put_contents($sched_file, json_encode(array_values($filtered), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

            return ['status' => 200, 'data' => [
                'success' => true,
                'message' => 'Programmation annulée avec succès.',
                'count'   => count($filtered)
            ]];
        }

        if ($action === 'tribune_get') {
            self::processScheduledPosts($base_dir);
            $storage_file = $base_dir . '/storage/tribune_messages.json';
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
                    ]
                ];
                @file_put_contents($storage_file, json_encode($messages, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
            }

            return ['status' => 200, 'data' => [
                'success'    => true,
                'messages'   => $messages,
                'count'      => count($messages),
                'server_now' => date('H:i:s')
            ]];
        }

        if ($action === 'tribune_stream') {
            @session_write_close();
            if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
            @ini_set('zlib.output_compression', '0');
            @ini_set('implicit_flush', '1');

            header('Content-Type: text/event-stream; charset=utf-8');
            header('Cache-Control: no-cache, no-transform');
            header('Connection: keep-alive');
            header('X-Accel-Buffering: no');

            $storage_file = $base_dir . '/storage/tribune_messages.json';
            $last_mtime = 0;
            $start_time = time();
            $max_duration = 30;

            while ((time() - $start_time) < $max_duration) {
                if (connection_aborted()) break;
                self::processScheduledPosts($base_dir);

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
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Le message ne peut pas être vide.']];
            }

            if (mb_strlen($msg_text) > 1000) $msg_text = mb_substr($msg_text, 0, 1000);
            if (empty($login)) $login = 'Anonyme';
            if (mb_strlen($login) > 40) $login = mb_substr($login, 0, 40);
            if (mb_strlen($info) > 100) $info = mb_substr($info, 0, 100);

            $storage_file = $base_dir . '/storage/tribune_messages.json';
            $messages = [];
            if (file_exists($storage_file)) {
                $content = @file_get_contents($storage_file);
                $messages = @json_decode($content, true) ?: [];
            }

            $last_id = 0;
            foreach ($messages as $m) {
                if (isset($m['id']) && $m['id'] > $last_id) $last_id = $m['id'];
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

            return ['status' => 200, 'data' => [
                'success'  => true,
                'post'     => $new_post,
                'messages' => $messages
            ]];
        }

        if ($action === 'tribune_proxy_fetch') {
            $remote_url = trim($_GET['url'] ?? $_POST['url'] ?? $raw_body['url'] ?? '');
            $cookie_hdr = trim($_GET['cookie'] ?? $_POST['cookie'] ?? $raw_body['cookie'] ?? '');
            $user_agent = trim($_GET['user_agent'] ?? $_POST['user_agent'] ?? $raw_body['user_agent'] ?? 'SimpleGallery-TribuneProxy/1.0');

            if (empty($remote_url) || !filter_var($remote_url, FILTER_VALIDATE_URL)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'URL distante invalide.']];
            }

            $scheme = parse_url($remote_url, PHP_URL_SCHEME);
            if (!in_array(strtolower($scheme), ['http', 'https'], true)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Seuls les protocole HTTP et HTTPS sont autorisés.']];
            }

            $headers = ["User-Agent: {$user_agent}", "Accept: application/xml, text/xml, text/plain, application/json, */*"];
            if (!empty($cookie_hdr)) $headers[] = "Cookie: {$cookie_hdr}";

            @session_write_close();
            $res = self::httpRequestProxy($remote_url, 'GET', $headers, null, 5);

            if (!$res['success'] || empty($res['body'])) {
                return ['status' => 200, 'data' => [
                    'success'     => false,
                    'status_code' => $res['status_code'] ?? 0,
                    'error'       => 'Impossible d\'obtenir le flux distant (serveur injoignable ou délai dépassé).',
                    'details'     => $res['error'] ?? ''
                ]];
            }

            return ['status' => 200, 'data' => ['success' => true, 'content' => $res['body']]];
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
            $all_boards = self::getBoardsConfig($base_dir);
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
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Le message ne peut pas être vide.']];
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
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'URL de soumission distante invalide.']];
            }

            $parsed_post_url = parse_url($post_url);
            $origin = ($parsed_post_url['scheme'] ?? 'https') . '://' . ($parsed_post_url['host'] ?? '');

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

                $get_res = self::httpRequestProxy($post_url, 'GET', $get_headers, null, 5);
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

                return self::httpRequestProxy($post_url, 'POST', $post_headers, $post_data, 6);
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
                return ['status' => 401, 'data' => [
                    'success'     => false,
                    'status_code' => $status_code,
                    'location'    => $location_hdr,
                    'error'       => 'Authentification refusée par le backend distant (cookie de session linuxfr.org manquant ou expiré).'
                ]];
            }

            if ($status_code >= 200 && $status_code < 400) {
                return ['status' => 200, 'data' => [
                    'success'     => true,
                    'status_code' => $status_code,
                    'location'    => $location_hdr,
                    'csrf_used'   => !empty($csrf_token),
                    'message'     => 'Post envoyé au backend distant avec succès.',
                    'target'      => $post_url
                ]];
            } else {
                return ['status' => 400, 'data' => [
                    'success'     => false,
                    'status_code' => $status_code,
                    'error'       => "Le backend distant a répondu avec le code HTTP {$status_code}.",
                    'details'     => mb_substr(trim(strip_tags($post_res['body'] ?? '')), 0, 300)
                ]];
            }
        }

        if ($action === 'tribune_clear_history') {
            if (empty($_SESSION['is_admin'])) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => 'Action réservée à l\'administrateur.']];
            }

            $storage_file = $base_dir . '/storage/tribune_messages.json';
            @file_put_contents($storage_file, json_encode([], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);

            return ['status' => 200, 'data' => ['success' => true, 'message' => 'Historique de la tribune réinitialisé.']];
        }

        if ($action === 'tribune_file_upload') {
            if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Aucun fichier valide n\'a été transmis ou erreur lors du téléversement.']];
            }

            $file = $_FILES['file'];
            $max_size = 50 * 1024 * 1024;
            if ($file['size'] > $max_size) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Le fichier dépasse la taille maximale autorisée de 50 Mo.']];
            }

            $orig_name = basename($file['name']);
            $ext = strtolower(pathinfo($orig_name, PATHINFO_EXTENSION));
            $forbidden_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'phps', 'cgi', 'pl', 'py', 'sh', 'exe', 'bat', 'cmd', 'vbs', 'msi', 'phar'];
            if (in_array($ext, $forbidden_exts, true)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Type de fichier exécutable interdit pour des raisons de sécurité.']];
            }

            $mime_type = 'application/octet-stream';
            if (function_exists('finfo_open')) {
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                if ($finfo) {
                    $detected = finfo_file($finfo, $file['tmp_name']);
                    if ($detected) $mime_type = $detected;
                    finfo_close($finfo);
                }
            } elseif (function_exists('mime_content_type')) {
                $detected = @mime_content_type($file['tmp_name']);
                if ($detected) $mime_type = $detected;
            }

            $upload_dir = $base_dir . '/storage/tribune_uploads';
            if (!is_dir($upload_dir)) @mkdir($upload_dir, 0755, true);

            $token = bin2hex(random_bytes(16));
            $bin_path = $upload_dir . '/' . $token . '.bin';
            $meta_path = $upload_dir . '/' . $token . '.json';

            if (!move_uploaded_file($file['tmp_name'], $bin_path)) {
                return ['status' => 500, 'data' => ['success' => false, 'error' => 'Échec de l\'enregistrement du fichier temporaire sur le serveur.']];
            }

            $now = time();
            $meta_data = [
                'token'         => $token,
                'original_name' => $orig_name,
                'mime_type'     => $mime_type,
                'size'          => $file['size'],
                'uploaded_at'   => $now,
                'ext'           => $ext
            ];

            file_put_contents($meta_path, json_encode($meta_data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
            $relative_url = 'system/endpoints/api.php?action=tribune_file_get&token=' . $token;

            return ['status' => 200, 'data' => [
                'success'   => true,
                'token'     => $token,
                'url'       => $relative_url,
                'filename'  => $orig_name,
                'mime_type' => $mime_type
            ]];
        }

        if ($action === 'tribune_file_get') {
            $token = $_GET['token'] ?? '';
            if (!preg_match('/^[a-f0-9]{32}$/i', $token)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'Jeton de fichier invalide.']];
            }

            $upload_dir = $base_dir . '/storage/tribune_uploads';
            $bin_path = $upload_dir . '/' . $token . '.bin';
            $meta_path = $upload_dir . '/' . $token . '.json';

            if (!is_file($bin_path) || !is_file($meta_path)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => 'Fichier introuvable ou expiré.']];
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
            if (ob_get_level()) @ob_end_clean();

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
                'http' => ['method' => 'GET', 'timeout' => 5, 'follow_location' => 1, 'max_redirects' => 5, 'header' => "User-Agent: Mozilla/5.0\r\n"],
                'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
            ];
            $img_data = @file_get_contents($remote_url, false, stream_context_create($opts));

            if ($img_data === false || empty($img_data)) {
                header('Content-Type: image/svg+xml');
                echo '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><text y="18" font-size="16">🦆</text></svg>';
                exit;
            }

            header('Content-Type: image/gif');
            header('Cache-Control: public, max-age=604800');
            echo $img_data;
            exit;
        }

        if ($action === 'totoz_search') {
            @session_write_close();
            $q = trim($_GET['q'] ?? $raw_body['q'] ?? '');
            $q = preg_replace('/[^a-zA-Z0-9_\.: -]/', '', $q);

            $remote_url = "https://totoz.eu/search.xml?terms=" . urlencode($q);
            $xml_data = @file_get_contents($remote_url, false, stream_context_create(['http' => ['method' => 'GET', 'timeout' => 4, 'header' => "User-Agent: Mozilla/5.0\r\n"]]));

            $results = [];
            if ($xml_data !== false) {
                $xml = @simplexml_load_string($xml_data);
                if ($xml && isset($xml->totoz)) {
                    foreach ($xml->totoz as $t) {
                        $name = (string)$t->name;
                        $nsfw = isset($t->nsfw) ? ((string)$t->nsfw === 'true' || (string)$t->nsfw === '1') : false;
                        if ($name) $results[] = ['name' => $name, 'nsfw' => $nsfw];
                    }
                }
            }

            return ['status' => 200, 'data' => ['success' => true, 'totoz' => array_slice($results, 0, 15)]];
        }

        if ($action === 'url_preview') {
            @session_write_close();
            $url = trim($_GET['url'] ?? $raw_body['url'] ?? '');
            if (empty($url) || !preg_match('#^https?://#i', $url)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => 'URL invalide']];
            }

            $parsed_host = parse_url($url, PHP_URL_HOST);
            if (!$parsed_host || in_array(strtolower($parsed_host), ['localhost', '127.0.0.1', '::1', '0.0.0.0'])) {
                return ['status' => 200, 'data' => ['success' => false, 'error' => 'Accès restreint']];
            }

            $cache_file = $base_dir . '/storage/url_preview_cache.json';
            $cache = [];
            if (file_exists($cache_file)) {
                $cache = @json_decode(@file_get_contents($cache_file), true) ?: [];
            }

            $url_hash = md5($url);
            if (isset($cache[$url_hash]) && (time() - ($cache[$url_hash]['cached_at'] ?? 0)) < 86400 * 7) {
                return ['status' => 200, 'data' => ['success' => true, 'preview' => $cache[$url_hash]]];
            }

            $title = '';
            $description = '';
            $image = '';
            $site_name = $parsed_host;

            if (preg_match('#\.(jpg|jpeg|png|gif|webp|svg)$#i', parse_url($url, PHP_URL_PATH) ?? '')) {
                $title = basename(parse_url($url, PHP_URL_PATH));
                $image = $url;
                $description = "Image en ligne";
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

            return ['status' => 200, 'data' => ['success' => true, 'preview' => $preview_data]];
        }

        return null;
    }
}
