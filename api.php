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
$mutating_actions = ['change_password', 'update_dotfile', 'lock_folder', 'unlock_folder', 'logout', 'login', 'upload_file', 'upload_media', 'create_folder', 'move_item', 'delete_item', 'delete_file', 'delete_folder', 'save_permissions', 'edit_image', 'save_text_file', 'save_comment', 'save_folder_settings'];
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

    $tmp_dir = sys_get_temp_dir() . '/simplegallery_archives';
    if (!is_dir($tmp_dir)) @mkdir($tmp_dir, 0755, true);

    $ext_map = ['zip' => '.zip', '7z' => '.7z', 'tar' => '.tar.gz'];
    $file_ext = $ext_map[$format] ?? '.zip';
    $archive_name = 'gallery_' . date('Ymd_His') . '_' . substr(md5($dir_target), 0, 6) . $file_ext;
    $archive_path = $tmp_dir . '/' . $archive_name;

    if (create_archive($format, $dir_target, $archive_path, $real_base_dir, $ignore_list)) {
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $archive_name . '"');
        header('Content-Length: ' . filesize($archive_path));
        header('Cache-Control: no-cache, must-revalidate');
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
    if ($target_file === null || !is_file($target_file) || is_path_ignored($target_file, $real_base_dir, $ignore_list)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => __t('api.err_invalid_path')]);
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
    if (!is_writable($parent_dir) || !is_writable($target_file)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => __t('api.err_write_permission')]);
        exit;
    }

    $save_success = (@file_put_contents($target_file, $content, LOCK_EX) !== false);

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
