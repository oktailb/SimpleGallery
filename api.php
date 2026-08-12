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

// Rate limiting helper function based on client IP
function get_client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

function get_rate_limit_file(string $key): string {
    $ip = get_client_ip();
    $hash = md5($ip . '_' . $key);
    return sys_get_temp_dir() . '/sg_limit_' . $hash . '.json';
}

function check_rate_limit(string $key, int $max_attempts = 5, int $decay_seconds = 900): bool {
    $file = get_rate_limit_file($key);
    if (!file_exists($file)) {
        return true;
    }
    $content = @file_get_contents($file);
    if (!$content) return true;
    $data = @json_decode($content, true);
    if (!is_array($data)) return true;
    
    $now = time();
    if ($now - ($data['first_attempt'] ?? 0) > $decay_seconds) {
        @unlink($file);
        return true;
    }
    return ($data['attempts'] ?? 0) < $max_attempts;
}

function increment_rate_limit(string $key): void {
    $file = get_rate_limit_file($key);
    $now = time();
    $data = ['attempts' => 1, 'first_attempt' => $now];
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        if ($content) {
            $existing = @json_decode($content, true);
            if (is_array($existing)) {
                $data['attempts'] = ($existing['attempts'] ?? 0) + 1;
                $data['first_attempt'] = $existing['first_attempt'] ?? $now;
            }
        }
    }
    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function reset_rate_limit(string $key): void {
    $file = get_rate_limit_file($key);
    if (file_exists($file)) {
        @unlink($file);
    }
}

// -------------------------------------------------------------
// Admin Authentication & Action Handlers
// -------------------------------------------------------------
$raw_body = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? $_POST['action'] ?? $raw_body['action'] ?? null;

// Validate CSRF token for all state-changing actions
$mutating_actions = ['change_password', 'update_dotfile', 'lock_folder', 'unlock_folder', 'logout', 'login', 'upload_file', 'create_folder', 'move_item', 'delete_item'];
if (in_array($action, $mutating_actions, true)) {
    $submitted_csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $raw_body['csrf_token'] ?? $_POST['csrf_token'] ?? '';
    if (!verify_csrf_token($submitted_csrf)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Jeton de sécurité CSRF invalide ou manquant. Veuillez rafraîchir la page.'
        ]);
        exit;
    }
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

function sanitize_path(?string $requested_dir, string $base_dir): ?string {
    $base_dir = str_replace('\\', '/', $base_dir);
    $real_base = realpath($base_dir) ?: $base_dir;
    $real_base = str_replace('\\', '/', $real_base);

    if (empty($requested_dir) || $requested_dir === '.') {
        return $real_base;
    }
    
    $requested_dir = str_replace(['\\', '..'], ['/', ''], $requested_dir);
    $target = $real_base . '/' . ltrim($requested_dir, '/');
    $target_path = realpath($target) ?: $target;
    $target_path = str_replace('\\', '/', $target_path);

    if (!is_dir($target_path)) {
        return null;
    }

    if ($target_path !== $real_base && strpos($target_path, $real_base . '/') !== 0) {
        return null;
    }

    return $target_path;
}

function get_relative_path(string $full_path, string $base_dir): string {
    $full_path = str_replace('\\', '/', $full_path);
    $base_dir  = str_replace('\\', '/', $base_dir);
    if ($full_path === $base_dir) {
        return '';
    }
    if (strpos($full_path, $base_dir) === 0) {
        $rel = substr($full_path, strlen($base_dir));
        return ltrim($rel, '/');
    }
    return ltrim($full_path, '/');
}

/**
 * Safely encodes URL path segments preserving directory slashes '/'
 */
function encode_url_path(string $path): string {
    $parts = explode('/', $path);
    return implode('/', array_map('rawurlencode', $parts));
}

function format_bytes(int $bytes, int $precision = 2): string {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

function get_media_category(string $ext, array $media_types): string {
    $ext = strtolower($ext);
    foreach ($media_types as $cat => $extensions) {
        if (in_array($ext, $extensions, true)) {
            return $cat;
        }
    }
    return 'other';
}

function parse_exif_rational(string $ratio): float {
    $parts = explode('/', $ratio);
    if (count($parts) === 2 && (float)$parts[1] !== 0.0) {
        return (float)$parts[0] / (float)$parts[1];
    }
    return (float)$ratio;
}

function parse_exif_gps_coordinate(?array $coordinate, ?string $ref): ?float {
    if (empty($coordinate) || count($coordinate) < 3 || empty($ref)) {
        return null;
    }
    $degrees = parse_exif_rational((string)$coordinate[0]);
    $minutes = parse_exif_rational((string)$coordinate[1]);
    $seconds = parse_exif_rational((string)$coordinate[2]);

    $decimal = $degrees + ($minutes / 60.0) + ($seconds / 3600.0);
    $ref = strtoupper(trim($ref));
    if ($ref === 'S' || $ref === 'W') {
        $decimal *= -1.0;
    }
    return round($decimal, 6);
}

function extract_exif_data(string $file_path): ?array {
    if (!function_exists('exif_read_data')) {
        return null;
    }
    $ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'tif', 'tiff'], true)) {
        return null;
    }

    $exif_raw = @exif_read_data($file_path, 'EXIF,IFD0,GPS');
    if (!$exif_raw || !is_array($exif_raw)) {
        return null;
    }

    $make  = trim((string)($exif_raw['Make'] ?? ''));
    $model = trim((string)($exif_raw['Model'] ?? ''));
    $camera = '';
    if ($make !== '' && $model !== '') {
        $camera = (strpos(strtolower($model), strtolower($make)) !== false) ? $model : $make . ' ' . $model;
    } else {
        $camera = ($model !== '') ? $model : $make;
    }

    $date_str = $exif_raw['DateTimeOriginal'] ?? $exif_raw['DateTimeDigitized'] ?? $exif_raw['DateTime'] ?? null;
    $date_ts = null;
    $date_formatted = null;
    if ($date_str) {
        $dt = DateTime::createFromFormat('Y:m:d H:i:s', trim((string)$date_str));
        if ($dt !== false) {
            $date_ts = $dt->getTimestamp();
            $date_formatted = $dt->format('Y-m-d H:i:s');
        }
    }

    $fnumber = null;
    if (!empty($exif_raw['FNumber'])) {
        $fval = parse_exif_rational((string)$exif_raw['FNumber']);
        if ($fval > 0) $fnumber = 'f/' . round($fval, 1);
    } elseif (!empty($exif_raw['ApertureValue'])) {
        $apval = parse_exif_rational((string)$exif_raw['ApertureValue']);
        if ($apval > 0) $fnumber = 'f/' . round(pow(2, $apval / 2.0), 1);
    }

    $shutter_speed = null;
    if (!empty($exif_raw['ExposureTime'])) {
        $exp = parse_exif_rational((string)$exif_raw['ExposureTime']);
        if ($exp > 0) {
            if ($exp < 1) {
                $shutter_speed = '1/' . round(1.0 / $exp) . 's';
            } else {
                $shutter_speed = round($exp, 1) . 's';
            }
        }
    }

    $iso = null;
    if (!empty($exif_raw['ISOSpeedRatings'])) {
        $iso_val = is_array($exif_raw['ISOSpeedRatings']) ? $exif_raw['ISOSpeedRatings'][0] : $exif_raw['ISOSpeedRatings'];
        $iso = 'ISO ' . $iso_val;
    }

    $focal = null;
    if (!empty($exif_raw['FocalLength'])) {
        $focal_val = parse_exif_rational((string)$exif_raw['FocalLength']);
        if ($focal_val > 0) $focal = round($focal_val) . 'mm';
    }

    $gps_data = null;
    $lat = parse_exif_gps_coordinate($exif_raw['GPSLatitude'] ?? null, $exif_raw['GPSLatitudeRef'] ?? null);
    $lng = parse_exif_gps_coordinate($exif_raw['GPSLongitude'] ?? null, $exif_raw['GPSLongitudeRef'] ?? null);

    if ($lat !== null && $lng !== null) {
        $gps_data = [
            'lat'      => $lat,
            'lng'      => $lng,
            'maps_url' => 'https://www.google.com/maps/search/?api=1&query=' . $lat . ',' . $lng
        ];
    }

    if (!$camera && !$date_ts && !$fnumber && !$shutter_speed && !$iso && !$focal && !$gps_data) {
        return null;
    }

    return [
        'camera'        => $camera ?: null,
        'datetime'      => $date_formatted,
        'date_ts'       => $date_ts,
        'fnumber'       => $fnumber,
        'shutter_speed' => $shutter_speed,
        'iso'           => $iso,
        'focal'         => $focal,
        'gps'           => $gps_data
    ];
}

function get_cache_storage_dir(string $base_dir, string $thumb_dir): string {
    $cache_dir = $base_dir . '/' . $thumb_dir;
    if (!is_dir($cache_dir)) {
        @mkdir($cache_dir, 0755, true);
    }
    if (!is_dir($cache_dir) || !is_writable($cache_dir)) {
        $cache_dir = sys_get_temp_dir() . '/simplegallery_thumbs';
        if (!is_dir($cache_dir)) {
            @mkdir($cache_dir, 0755, true);
        }
    }
    return $cache_dir;
}

function get_dir_cache_file_path(string $dir_path, string $base_dir, string $thumb_dir): string {
    $storage = get_cache_storage_dir($base_dir, $thumb_dir);
    $rel = get_relative_path($dir_path, $base_dir);
    $key = md5('dir_index_' . $rel);
    return $storage . '/cache_' . $key . '.json';
}

function is_dir_cache_valid(string $cache_file, string $dir_path): bool {
    if (!file_exists($cache_file) || filesize($cache_file) === 0) {
        return false;
    }
    $cache_mtime = filemtime($cache_file);
    $dir_mtime = filemtime($dir_path);

    if ($cache_mtime < $dir_mtime) {
        return false;
    }

    $dotfiles = ['.title', '.desc', '.description', '.comment', '.theme', '.bg', '.private', '.password', '.public'];
    foreach ($dotfiles as $df) {
        $df_path = $dir_path . '/' . $df;
        if (file_exists($df_path) && filemtime($df_path) > $cache_mtime) {
            return false;
        }
    }

    return true;
}

function invalidate_dir_cache(string $dir_path, string $base_dir, string $thumb_dir): void {
    $cache_file = get_dir_cache_file_path($dir_path, $base_dir, $thumb_dir);
    if (file_exists($cache_file)) {
        @unlink($cache_file);
    }

    // Invalidate parent directory cache so subfolder item_count & cover update immediately
    $real_base = str_replace('\\', '/', realpath($base_dir) ?: $base_dir);
    $real_dir  = str_replace('\\', '/', realpath($dir_path) ?: $dir_path);

    if ($real_dir !== $real_base) {
        $parent_dir = dirname($real_dir);
        if (strpos($parent_dir, $real_base) === 0) {
            $parent_cache_file = get_dir_cache_file_path($parent_dir, $base_dir, $thumb_dir);
            if (file_exists($parent_cache_file)) {
                @unlink($parent_cache_file);
            }
        }
    }
}

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

function is_dir_accessible(string $dir_path, string $base_dir): bool {
    if (is_admin_logged_in()) {
        return true;
    }

    $rel = get_relative_path($dir_path, $base_dir);
    if ($rel === '') {
        return true;
    }

    $parts = explode('/', $rel);
    $accumulated = '';
    foreach ($parts as $part) {
        $accumulated = ($accumulated === '') ? $part : $accumulated . '/' . $part;
        $current_check_dir = $base_dir . '/' . $accumulated;

        $access_info = get_dir_access_info($current_check_dir, $base_dir);

        if ($access_info['is_private']) {
            return false;
        }

        if ($access_info['is_protected'] && !$access_info['is_unlocked']) {
            return false;
        }
    }

    return true;
}

function get_dir_access_info(string $dir_path, string $base_dir): array {
    $rel = get_relative_path($dir_path, $base_dir);

    $has_password = file_exists($dir_path . '/.password');
    $has_public   = file_exists($dir_path . '/.public');
    $has_private  = file_exists($dir_path . '/.private');

    $is_private = false;
    $is_protected = false;

    if ($has_password) {
        $is_protected = true;
    } elseif ($has_public) {
        $is_private = false;
        $is_protected = false;
    } elseif ($has_private) {
        $is_private = true;
    } elseif (basename($dir_path) === 'private') {
        $is_private = true;
    }

    $is_unlocked = is_admin_logged_in();
    if (!$is_unlocked && $rel !== '') {
        if (!empty($_SESSION['unlocked_dirs'][$rel])) {
            $is_unlocked = true;
        } else {
            $parts = explode('/', $rel);
            $accum = '';
            foreach ($parts as $p) {
                $accum = ($accum === '') ? $p : $accum . '/' . $p;
                if (!empty($_SESSION['unlocked_dirs'][$accum])) {
                    $is_unlocked = true;
                    break;
                }
            }
        }
    }

    $access_mode = 'public';
    if ($is_private) {
        $access_mode = 'private';
    } elseif ($is_protected) {
        $access_mode = 'password';
    }

    return [
        'access_mode'  => $access_mode,
        'is_private'   => $is_private,
        'is_protected' => $is_protected,
        'is_unlocked'  => $is_unlocked
    ];
}

if ($action === 'update_dotfile') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Admin privileges required'
        ]);
        exit;
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

if ($action === 'upload_file') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Mode administrateur requis pour le téléversement.'
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
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Aucun fichier reçu pour le téléversement.'
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
            $errors[] = "Erreur de téléversement pour '{$raw_name}' (Code {$error_code}).";
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
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Mode administrateur requis pour créer un dossier.'
        ]);
        exit;
    }

    $dir_param = $raw_body['dir'] ?? $_POST['dir'] ?? $_GET['dir'] ?? '';
    $folder_name = trim((string)($raw_body['folder_name'] ?? $_POST['folder_name'] ?? ''));

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
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Mode administrateur requis pour déplacer un élément.'
        ]);
        exit;
    }

    $source_param = $raw_body['source_path'] ?? $_POST['source_path'] ?? $_GET['source_path'] ?? '';
    $target_dir_param = $raw_body['target_dir'] ?? $_POST['target_dir'] ?? $_GET['target_dir'] ?? '';

    $real_base = str_replace('\\', '/', realpath($real_base_dir) ?: $real_base_dir);

    $source_rel = str_replace(['\\', '..'], ['/', ''], $source_param);
    $source_full = $real_base . '/' . ltrim($source_rel, '/');
    $source_full = str_replace('\\', '/', realpath($source_full) ?: $source_full);

    if (!file_exists($source_full)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Élément source introuvable.'
        ]);
        exit;
    }

    $real_base_slash = rtrim($real_base, '/') . '/';
    if ($source_full !== $real_base && strpos($source_full . '/', $real_base_slash) !== 0) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé au fichier source.'
        ]);
        exit;
    }

    if (strtolower($source_full) === strtolower($real_base)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Sécurité : Impossible de déplacer la racine de la galerie.'
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

    if (is_dir($source_full)) {
        if (strtolower($target_dir_full) === strtolower($source_full) || stripos($target_dir_full, $source_full . '/') === 0) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error'   => 'Impossible de déplacer un dossier à l\'intérieur de lui-même.'
            ]);
            exit;
        }
    }

    $source_parent_dir = str_replace('\\', '/', dirname($source_full));
    if (strtolower($source_parent_dir) === strtolower($target_dir_full)) {
        echo json_encode([
            'success' => true,
            'message' => 'L\'élément est déjà dans le dossier cible.'
        ]);
        exit;
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

        echo json_encode([
            'success'  => true,
            'message'  => 'Élément déplacé avec succès.',
            'new_path' => get_relative_path($dest_full, $real_base_dir)
        ]);
    } else {
        $last_err = error_get_last();
        $detail = $last_err ? $last_err['message'] : 'Vérifiez les permissions d\'écriture sur les dossiers source et destination.';
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Échec du déplacement : ' . $detail
        ]);
    }
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

if ($action === 'delete_item') {
    if (!is_admin_logged_in()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error'   => 'Accès refusé. Mode administrateur requis pour supprimer un élément.'
        ]);
        exit;
    }

    $target_param = $raw_body['target_path'] ?? $_POST['target_path'] ?? $_GET['target_path'] ?? '';
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
        $thumb_cache_file = $thumbnail_dir . '/' . md5(get_relative_path($target_full, $real_base_dir)) . '.jpg';
        if (file_exists($thumb_cache_file)) {
            @unlink($thumb_cache_file);
        }
    }

    if ($delete_success) {
        invalidate_dir_cache($parent_dir, $real_base_dir, $thumbnail_dir);
        echo json_encode([
            'success' => true,
            'message' => "L'élément '{$item_name}' a été supprimé avec succès."
        ]);
    } else {
        $last_err = error_get_last();
        $detail = $last_err ? $last_err['message'] : 'Vérifiez les permissions de fichier sur le serveur.';
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Échec de la suppression : ' . $detail
        ]);
    }
    exit;
}

function load_dir_comments(string $dir_path): array {
    $comments = [];
    $comment_file = $dir_path . '/.comment';
    if (file_exists($comment_file) && is_readable($comment_file)) {
        $lines = file($comment_file, FILE_IGNORE_NEW_LINES);
        if ($lines !== false) {
            for ($i = 0; $i < count($lines); $i++) {
                $line = trim($lines[$i]);
                if ($line === '') continue;

                if (strpos($line, '=') !== false) {
                    list($fname, $cmt) = explode('=', $line, 2);
                    $comments[trim($fname)] = trim($cmt);
                } elseif (strpos($line, ':') !== false && !file_exists($dir_path . '/' . $line)) {
                    list($fname, $cmt) = explode(':', $line, 2);
                    $comments[trim($fname)] = trim($cmt);
                } else {
                    $fname = $line;
                    $cmt = isset($lines[$i + 1]) ? trim($lines[$i + 1]) : '';
                    $comments[$fname] = $cmt;
                    $i++;
                }
            }
        }
    }
    return $comments;
}

function save_dir_comments(string $dir_path, array $comments): bool {
    $comment_file = $dir_path . '/.comment';
    $clean_comments = [];
    foreach ($comments as $fname => $cmt) {
        $cmt_clean = trim(str_replace(["\r", "\n"], [' ', ' '], $cmt));
        if ($cmt_clean !== '') {
            $clean_comments[basename($fname)] = $cmt_clean;
        }
    }

    if (empty($clean_comments)) {
        if (file_exists($comment_file)) return @unlink($comment_file);
        return true;
    }

    $lines = [];
    foreach ($clean_comments as $fname => $cmt) {
        $lines[] = $fname . ' = ' . $cmt;
    }
    return (@file_put_contents($comment_file, implode("\n", $lines) . "\n") !== false);
}

function load_folder_overrides(string $dir_path, string $base_dir): array {
    $access_info = get_dir_access_info($dir_path, $base_dir);

    $overrides = [
        'title'        => null,
        'description'  => null,
        'background'   => null,
        'theme'        => null,
        'access_mode'  => $access_info['access_mode'],
        'is_private'   => $access_info['is_private'],
        'is_protected' => $access_info['is_protected'],
        'is_unlocked'  => $access_info['is_unlocked']
    ];

    $title_file = $dir_path . '/.title';
    if (file_exists($title_file) && is_readable($title_file)) {
        $overrides['title'] = trim(file_get_contents($title_file));
    }

    $desc_file = file_exists($dir_path . '/.desc') ? $dir_path . '/.desc' : (file_exists($dir_path . '/.description') ? $dir_path . '/.description' : null);
    if ($desc_file && is_readable($desc_file)) {
        $overrides['description'] = trim(file_get_contents($desc_file));
    }

    $bg_file = $dir_path . '/.bg';
    if (file_exists($bg_file) && is_readable($bg_file)) {
        $bg_val = trim(file_get_contents($bg_file));
        if ($bg_val !== '') {
            $possible_image = $dir_path . '/' . $bg_val;
            if (file_exists($possible_image) && is_file($possible_image)) {
                $rel_bg = get_relative_path($possible_image, $base_dir);
                $overrides['background'] = 'thumb.php?file=' . rawurlencode($rel_bg);
            } else {
                $overrides['background'] = $bg_val;
            }
        }
    }

    $theme_file = $dir_path . '/.theme';
    if (file_exists($theme_file) && is_readable($theme_file)) {
        $theme_val = trim(file_get_contents($theme_file));
        if ($theme_val !== '') {
            global $theme_colors;
            if (strpos($theme_val, '=') !== false) {
                $custom_theme = [];
                $lines = explode("\n", $theme_val);
                foreach ($lines as $line) {
                    if (strpos($line, '=') !== false) {
                        list($k, $v) = explode('=', trim($line), 2);
                        $custom_theme[trim($k)] = trim($v);
                    }
                }
                $overrides['theme'] = $custom_theme;
                $overrides['theme_name'] = 'custom';
            } else {
                $overrides['theme_name'] = $theme_val;
                if (!empty($theme_colors[$theme_val])) {
                    $overrides['theme'] = $theme_colors[$theme_val];
                } else {
                    $overrides['theme'] = $theme_val;
                }
            }
        }
    }

    return $overrides;
}

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

if ($target_dir === null || !is_dir($target_dir)) {
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
                    if ($sub[0] !== '.' && !in_array($sub, $ignore_list, true)) {
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
                    'file_url'       => encode_url_path($item_relative),
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
    'success'       => true,
    'csrf_token'    => get_csrf_token(),
    'title'         => $folder_overrides['title'] ?? $gallery_title,
    'current_path'  => $current_relative,
    'parent_path'   => $parent_path,
    'breadcrumbs'   => $breadcrumbs,
    'overrides'     => $folder_overrides,
    'directories'   => $directories,
    'files'         => $files,
    'is_admin'      => is_admin_logged_in(),
    'admin_enabled' => !empty($admin_password_hash),
    'stats'         => [
        'directory_count' => count($directories),
        'file_count'      => count($files)
    ]
];

$json_string = json_encode($output_data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($json_string === false) {
    $json_string = json_encode([
        'success' => false,
        'error'   => 'JSON encoding error: ' . json_last_error_msg()
    ]);
}
echo $json_string;
