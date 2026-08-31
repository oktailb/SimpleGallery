<?php
namespace SimpleGallery\Kernel\Actions;

use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\FS\CacheManager;
use SimpleGallery\Kernel\FS\DotfileManager;
use SimpleGallery\Kernel\FS\PermissionsManager;
use SimpleGallery\Kernel\Media\ExifParser;
use SimpleGallery\Kernel\Security\PathValidator;
use SimpleGallery\Kernel\Security\SecurityManager;

class FileActions {

    public static function handle(string $action, array $params, array $context): ?array {
        $base_dir       = $context['base_dir'] ?? '';
        $ignore_list    = $context['ignore_list'] ?? [];
        $media_types    = $context['media_types'] ?? [];
        $thumbnail_dir  = $context['thumbnail_dir'] ?? '.thumbnails';
        $raw_body       = $context['raw_body'] ?? $params;
        $thumb_dir_name = $thumbnail_dir;


        if ($action === 'unlock_folder') {
            $req_dir = $raw_body['dir'] ?? $_POST['dir'] ?? '';
            $password = $raw_body['password'] ?? $_POST['password'] ?? '';
            $dir_target = PathValidator::sanitizeDirectory($req_dir, $base_dir);

            if (!$dir_target || !is_dir($dir_target)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_folder_not_found')]];
            }

            $password_file = $dir_target . '/.password';
            if (!file_exists($password_file)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_folder_not_protected')]];
            }

            $hash = trim((string)@file_get_contents($password_file));
            if (empty($hash) || password_verify($password, $hash)) {
                AuthManager::ensureSessionStarted();
                $rel = PathValidator::getRelativePath($dir_target, $base_dir);
                $_SESSION['sg_unlocked_folders'][$rel] = true;
                $_SESSION['unlocked_dirs'][$rel] = true;

                return ['status' => 200, 'data' => [
                    'success' => true,
                    'message' => __t('api.msg_folder_unlocked')
                ]];
            }

            return ['status' => 401, 'data' => ['success' => false, 'error' => __t('api.err_invalid_folder_password')]];
        }

        if ($action === 'lock_folder') {
            $req_dir = $raw_body['dir'] ?? $_POST['dir'] ?? '';
            $dir_target = PathValidator::sanitizeDirectory($req_dir, $base_dir);

            if ($dir_target && is_dir($dir_target)) {
                AuthManager::ensureSessionStarted();
                $rel = PathValidator::getRelativePath($dir_target, $base_dir);
                unset($_SESSION['sg_unlocked_folders'][$rel]);
                unset($_SESSION['unlocked_dirs'][$rel]);
            }

            return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_folder_locked')]];
        }

        if ($action === 'update_dotfile') {
            if (!AuthManager::isAdminLoggedIn()) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_admin_required')]];
            }

            $req_dir   = $raw_body['dir'] ?? $_POST['dir'] ?? '';
            $type      = $raw_body['type'] ?? $_POST['type'] ?? '';
            $value     = $raw_body['value'] ?? $_POST['value'] ?? '';
            $dir_target = PathValidator::sanitizeDirectory($req_dir, $base_dir);

            if (!$dir_target || !is_dir($dir_target)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_folder_not_found')]];
            }

            switch ($type) {
                case 'access_mode':
                    @unlink($dir_target . '/.private');
                    @unlink($dir_target . '/.password');
                    @unlink($dir_target . '/.public');
                    if ($value === 'private') {
                        @file_put_contents($dir_target . '/.private', "1\n", LOCK_EX);
                    } elseif ($value === 'password') {
                        $pass_hash = password_hash((string)($raw_body['password'] ?? $_POST['password'] ?? ''), PASSWORD_DEFAULT);
                        @file_put_contents($dir_target . '/.password', $pass_hash . "\n", LOCK_EX);
                    }
                    break;
                case 'title':
                    if (trim((string)$value) === '') @unlink($dir_target . '/.title');
                    else @file_put_contents($dir_target . '/.title', trim((string)$value) . "\n", LOCK_EX);
                    break;
                case 'description':
                    if (trim((string)$value) === '') {
                        @unlink($dir_target . '/.desc');
                        @unlink($dir_target . '/.description');
                    } else {
                        @file_put_contents($dir_target . '/.desc', trim((string)$value) . "\n", LOCK_EX);
                    }
                    break;
                case 'bg':
                    if (trim((string)$value) === '') @unlink($dir_target . '/.bg');
                    else @file_put_contents($dir_target . '/.bg', trim((string)$value) . "\n", LOCK_EX);
                    break;
                case 'theme':
                    if (trim((string)$value) === '') @unlink($dir_target . '/.theme');
                    else @file_put_contents($dir_target . '/.theme', trim((string)$value) . "\n", LOCK_EX);
                    break;
                case 'comment':
                    $fname = $raw_body['filename'] ?? $_POST['filename'] ?? '';
                    if (!empty($fname)) {
                        $comments = DotfileManager::loadDirComments($dir_target);
                        if (trim((string)$value) === '') unset($comments[$fname]);
                        else $comments[$fname] = trim((string)$value);
                        DotfileManager::saveDirComments($dir_target, $comments);
                    }
                    break;
            }

            CacheManager::invalidateDirCache($dir_target, $base_dir, $thumb_dir_name);
            return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_dotfile_updated')]];
        }

        if ($action === 'save_comment') {
            if (!PermissionsManager::hasPermission('can_comment', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_comment_denied')]];
            }

            $req_dir  = $raw_body['dir'] ?? $_POST['dir'] ?? '';
            $filename = $raw_body['filename'] ?? $_POST['filename'] ?? '';
            $comment  = $raw_body['comment'] ?? $_POST['comment'] ?? '';

            $dir_target = PathValidator::sanitizeDirectory($req_dir, $base_dir);
            if (!$dir_target || !is_dir($dir_target)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_folder_not_found')]];
            }

            $comments = DotfileManager::loadDirComments($dir_target);
            if (trim((string)$comment) === '') {
                unset($comments[$filename]);
            } else {
                $comments[$filename] = trim((string)$comment);
            }
            DotfileManager::saveDirComments($dir_target, $comments);
            CacheManager::invalidateDirCache($dir_target, $base_dir, $thumb_dir_name);

            return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_comment_saved')]];
        }

        if ($action === 'save_folder_settings') {
            if (!AuthManager::isAdminLoggedIn()) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_admin_required')]];
            }

            $req_dir     = $raw_body['dir'] ?? $_POST['dir'] ?? '';
            $title       = $raw_body['title'] ?? $_POST['title'] ?? null;
            $desc        = $raw_body['description'] ?? $_POST['description'] ?? null;
            $bg          = $raw_body['background'] ?? $_POST['background'] ?? null;
            $theme       = $raw_body['theme'] ?? $_POST['theme'] ?? null;
            $access_mode = $raw_body['access_mode'] ?? $_POST['access_mode'] ?? null;
            $password    = $raw_body['password'] ?? $_POST['password'] ?? null;

            $dir_target = PathValidator::sanitizeDirectory($req_dir, $base_dir);
            if (!$dir_target || !is_dir($dir_target)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_folder_not_found')]];
            }

            if ($title !== null) {
                if (trim((string)$title) === '') @unlink($dir_target . '/.title');
                else @file_put_contents($dir_target . '/.title', trim((string)$title) . "\n", LOCK_EX);
            }
            if ($desc !== null) {
                if (trim((string)$desc) === '') {
                    @unlink($dir_target . '/.desc');
                    @unlink($dir_target . '/.description');
                } else {
                    @file_put_contents($dir_target . '/.desc', trim((string)$desc) . "\n", LOCK_EX);
                }
            }
            if ($bg !== null) {
                if (trim((string)$bg) === '') @unlink($dir_target . '/.bg');
                else @file_put_contents($dir_target . '/.bg', trim((string)$bg) . "\n", LOCK_EX);
            }
            if ($theme !== null) {
                if (trim((string)$theme) === '') @unlink($dir_target . '/.theme');
                else @file_put_contents($dir_target . '/.theme', trim((string)$theme) . "\n", LOCK_EX);
            }
            if ($access_mode !== null) {
                @unlink($dir_target . '/.private');
                @unlink($dir_target . '/.password');
                @unlink($dir_target . '/.public');
                if ($access_mode === 'private') {
                    @file_put_contents($dir_target . '/.private', "1\n", LOCK_EX);
                } elseif ($access_mode === 'password' && !empty($password)) {
                    $pass_hash = password_hash((string)$password, PASSWORD_DEFAULT);
                    @file_put_contents($dir_target . '/.password', $pass_hash . "\n", LOCK_EX);
                }
            }

            CacheManager::invalidateDirCache($dir_target, $base_dir, $thumb_dir_name);
            return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_folder_settings_saved')]];
        }

        if ($action === 'upload_file' || $action === 'upload_media') {
            if (!PermissionsManager::hasPermission('can_upload', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => 'Accès refusé. Permission d\'upload manquante.']];
            }

            $dir_param = $_POST['dir'] ?? $_GET['dir'] ?? '';
            $target_dir = PathValidator::sanitizeDirectory($dir_param, $base_dir);
            if ($target_dir === null || !is_dir($target_dir)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => 'Dossier cible introuvable ou accès refusé.']];
            }

            if (empty($_FILES)) {
                $content_length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
                $post_max = ini_get('post_max_size');
                $error_msg = 'Aucun fichier reçu pour le téléversement.';
                if ($content_length > 0) {
                    $error_msg = "La taille totale du téléversement dépasse la limite serveur post_max_size ({$post_max}).";
                }
                return ['status' => 400, 'data' => ['success' => false, 'error' => $error_msg]];
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
                    if ($ext === 'svg') {
                        SecurityManager::sanitizeSvgContent($dest_path);
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
                CacheManager::invalidateDirCache($target_dir, $base_dir, $thumb_dir_name);
            }

            $has_success = !empty($uploaded_results);
            return [
                'status' => $has_success ? 200 : 400,
                'data'   => [
                    'success'  => $has_success,
                    'uploaded' => $uploaded_results,
                    'errors'   => $errors,
                    'message'  => $has_success ? count($uploaded_results) . ' fichier(s) téléversé(s) avec succès.' : 'Échec du téléversement.'
                ]
            ];
        }

        if ($action === 'create_folder') {
            if (!PermissionsManager::hasPermission('can_create_folder', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_create_folder_denied')]];
            }

            $dir_param = $_POST['dir'] ?? $raw_body['dir'] ?? '';
            $name_param = trim($_POST['name'] ?? $raw_body['name'] ?? '');

            $target_dir = PathValidator::sanitizeDirectory($dir_param, $base_dir);
            if ($target_dir === null || !is_dir($target_dir)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_folder_not_found')]];
            }

            $clean_name = basename($name_param);
            if (empty($clean_name) || $clean_name[0] === '.' || preg_match('/[\/\\\\:\*\?"<>\|]/', $clean_name)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_folder_name')]];
            }

            $new_dir = $target_dir . '/' . $clean_name;
            if (file_exists($new_dir)) {
                return ['status' => 409, 'data' => ['success' => false, 'error' => __t('api.err_folder_exists')]];
            }

            if (@mkdir($new_dir, 0755, true)) {
                CacheManager::invalidateDirCache($target_dir, $base_dir, $thumb_dir_name);
                return ['status' => 200, 'data' => [
                    'success' => true,
                    'message' => __t('api.msg_folder_created'),
                    'name'    => $clean_name
                ]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('api.err_folder_create_failed')]];
        }

        if ($action === 'move_item') {
            if (!PermissionsManager::hasPermission('can_move', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_move_denied')]];
            }

            $source_param = $_POST['source'] ?? $raw_body['source'] ?? '';
            $target_dir_param = $_POST['target_dir'] ?? $raw_body['target_dir'] ?? '';
            $new_name_param = isset($_POST['new_name']) ? trim($_POST['new_name']) : (isset($raw_body['new_name']) ? trim($raw_body['new_name']) : null);

            $source_full = PathValidator::canonicalizeAndValidate($source_param, $base_dir, true, false);
            $target_dir_full = PathValidator::sanitizeDirectory($target_dir_param, $base_dir);

            if ($source_full === null || $target_dir_full === null || !file_exists($source_full) || !is_dir($target_dir_full)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_source_or_dest_invalid')]];
            }

            if (is_dir($source_full) && ($source_full === $target_dir_full || strpos($target_dir_full . '/', $source_full . '/') === 0)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_move_into_self')]];
            }

            $dest_name = $new_name_param !== null ? basename($new_name_param) : basename($source_full);
            if (empty($dest_name) || $dest_name[0] === '.' || preg_match('/[\/\\\\:\*\?"<>\|]/', $dest_name)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_name')]];
            }

            $destination = $target_dir_full . '/' . $dest_name;
            if (file_exists($destination) && $destination !== $source_full) {
                return ['status' => 409, 'data' => ['success' => false, 'error' => __t('api.err_destination_exists')]];
            }

            if (@rename($source_full, $destination)) {
                CacheManager::invalidateDirCache(dirname($source_full), $base_dir, $thumb_dir_name);
                CacheManager::invalidateDirCache($target_dir_full, $base_dir, $thumb_dir_name);
                return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_item_moved')]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('api.err_move_failed')]];
        }

        if ($action === 'copy_item') {
            if (!PermissionsManager::hasPermission('can_upload', $base_dir) && !AuthManager::isAdmin()) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_permission_denied')]];
            }

            $source_param = $_POST['source'] ?? $raw_body['source'] ?? '';
            $target_dir_param = $_POST['target_dir'] ?? $raw_body['target_dir'] ?? '';
            $new_name_param = isset($_POST['new_name']) ? trim($_POST['new_name']) : (isset($raw_body['new_name']) ? trim($raw_body['new_name']) : null);

            $source_full = PathValidator::canonicalizeAndValidate($source_param, $base_dir, true, false);
            $target_dir_full = PathValidator::sanitizeDirectory($target_dir_param, $base_dir);

            if ($source_full === null || $target_dir_full === null || !file_exists($source_full) || !is_dir($target_dir_full)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_source_or_dest_invalid')]];
            }

            $dest_name = $new_name_param !== null ? basename($new_name_param) : basename($source_full);
            if (empty($dest_name) || $dest_name[0] === '.' || preg_match('/[\/\\\\:\*\?"<>\|]/', $dest_name)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_name')]];
            }

            $destination = $target_dir_full . '/' . $dest_name;
            if (file_exists($destination)) {
                $ext = pathinfo($dest_name, PATHINFO_EXTENSION);
                $name_without_ext = pathinfo($dest_name, PATHINFO_FILENAME);
                $counter = 1;
                do {
                    $candidate = $name_without_ext . '_copy' . ($counter > 1 ? $counter : '') . ($ext ? '.' . $ext : '');
                    $destination = $target_dir_full . '/' . $candidate;
                    $counter++;
                } while (file_exists($destination));
            }

            $copy_recursive = function(string $src, string $dst) use (&$copy_recursive): bool {
                if (is_dir($src)) {
                    @mkdir($dst, 0755, true);
                    $files = @scandir($src) ?: [];
                    foreach ($files as $file) {
                        if ($file === '.' || $file === '..') continue;
                        if (!$copy_recursive($src . '/' . $file, $dst . '/' . $file)) return false;
                    }
                    return true;
                }
                return @copy($src, $dst);
            };

            if ($copy_recursive($source_full, $destination)) {
                CacheManager::invalidateDirCache($target_dir_full, $base_dir, $thumb_dir_name);
                return ['status' => 200, 'data' => [
                    'success'     => true,
                    'message'     => 'Élément copié avec succès',
                    'destination' => basename($destination)
                ]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => 'Erreur lors de la copie']];
        }

        if ($action === 'delete_item' || $action === 'delete_file' || $action === 'delete_folder') {
            if (!PermissionsManager::hasPermission('can_delete', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_delete_denied')]];
            }

            $target_param = $_POST['target'] ?? $_GET['target'] ?? $raw_body['target'] ?? '';
            $target_full = PathValidator::canonicalizeAndValidate($target_param, $base_dir, true, false);

            if ($target_full === null || !file_exists($target_full)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_item_not_found')]];
            }

            $parent_dir = dirname($target_full);
            $success = false;

            if (is_dir($target_full)) {
                $recursive_delete = function(string $dir) use (&$recursive_delete): bool {
                    $items = @scandir($dir);
                    if ($items === false) return false;
                    foreach ($items as $item) {
                        if ($item === '.' || $item === '..') continue;
                        $path = $dir . '/' . $item;
                        if (is_dir($path)) {
                            if (!$recursive_delete($path)) return false;
                        } else {
                            if (!@unlink($path)) return false;
                        }
                    }
                    return @rmdir($dir);
                };
                $success = $recursive_delete($target_full);
            } else {
                $success = @unlink($target_full);
            }

            if ($success) {
                CacheManager::invalidateDirCache($parent_dir, $base_dir, $thumb_dir_name);
                return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_item_deleted')]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('api.err_delete_failed')]];
        }

        if ($action === 'edit_image') {
            if (!AuthManager::isAdminLoggedIn() && !PermissionsManager::hasPermission('can_upload', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_admin_required')]];
            }

            $target_param = $raw_body['target_path'] ?? $_POST['target_path'] ?? '';
            $save_mode = $raw_body['save_mode'] ?? $_POST['save_mode'] ?? 'copy';
            $image_data = $raw_body['image_data'] ?? $_POST['image_data'] ?? '';

            if (empty($target_param)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_path')]];
            }

            if (empty($image_data)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_missing_image_data')]];
            }

            $target_file = PathValidator::sanitizeFile($target_param, $base_dir);
            if ($target_file === null || !is_file($target_file) || PathValidator::isPathIgnored($target_file, $base_dir, $ignore_list)) {
                return ['status' => 404, 'data' => ['success' => false, 'error' => __t('api.err_invalid_path')]];
            }

            $ext = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));
            if (!in_array($ext, $media_types['image'] ?? ['jpg', 'jpeg', 'png', 'webp', 'gif'], true) || in_array($ext, ['php', 'phtml', 'phar', 'svg'], true)) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_unsupported_format')]];
            }

            if (preg_match('/^data:image\/(\w+);base64,/', $image_data, $type_match)) {
                $data_substr = substr($image_data, strpos($image_data, ',') + 1);
                $decoded_image = base64_decode($data_substr);
                if ($decoded_image === false) {
                    return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_image_data')]];
                }
            } else {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_image_data')]];
            }

            $parent_dir = dirname($target_file);
            if (!is_writable($parent_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_write_permission')]];
            }

            $dest_file = $target_file;
            $is_copy = ($save_mode === 'copy');

            if ($is_copy) {
                $info = pathinfo($target_file);
                $base_name = $info['filename'];
                $file_ext = !empty($info['extension']) ? '.' . $info['extension'] : '.jpg';
                $clean_base = preg_replace('/_edited(_\d+)?$/i', '', $base_name);
                $candidate_name = $clean_base . '_edited' . $file_ext;
                $counter = 1;
                while (file_exists($parent_dir . '/' . $candidate_name)) {
                    $candidate_name = $clean_base . '_edited_' . $counter . $file_ext;
                    $counter++;
                }
                $dest_file = $parent_dir . '/' . $candidate_name;
            }

            $image_to_write = $decoded_image;
            if (($ext === 'jpg' || $ext === 'jpeg')) {
                $image_to_write = ExifParser::transferJpegExif($target_file, $decoded_image);
            }

            $save_success = (@file_put_contents($dest_file, $image_to_write, LOCK_EX) !== false);

            if ($save_success) {
                @chmod($dest_file, 0644);
                CacheManager::invalidateDirCache($parent_dir, $base_dir, $thumb_dir_name);

                if (!$is_copy) {
                    $rel = PathValidator::getRelativePath($dest_file, $base_dir);
                    $thumb_cache_dir = CacheManager::getCacheStorageDir($base_dir, $thumb_dir_name);
                    $cache_key_jpg = $thumb_cache_dir . '/' . md5($rel) . '.jpg';
                    if (file_exists($cache_key_jpg)) @unlink($cache_key_jpg);
                }

                $saved_relative = PathValidator::getRelativePath($dest_file, $base_dir);
                $saved_filename = basename($dest_file);

                return ['status' => 200, 'data' => [
                    'success'        => true,
                    'message'        => $is_copy ? __t('api.success_copy_saved', ['name' => $saved_filename]) : __t('api.success_image_updated', ['name' => $saved_filename]),
                    'save_mode'      => $save_mode,
                    'is_copy'        => $is_copy,
                    'file_name'      => $saved_filename,
                    'path'           => $saved_relative,
                    'thumb_url'      => 'system/endpoints/thumb.php?file=' . rawurlencode($saved_relative) . '&t=' . time(),
                    'file_url'       => 'system/endpoints/thumb.php?file=' . rawurlencode($saved_relative) . '&raw=1&t=' . time()
                ]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('api.err_file_write_failed')]];
        }

        if ($action === 'save_text_file') {
            if (!PermissionsManager::hasPermission('can_upload', $base_dir)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_save_denied')]];
            }

            $file_param = $raw_body['file'] ?? $_POST['file'] ?? '';
            $content    = $raw_body['content'] ?? $_POST['content'] ?? '';

            $file_full = PathValidator::canonicalizeAndValidate($file_param, $base_dir, false, false);
            if ($file_full === null) {
                return ['status' => 400, 'data' => ['success' => false, 'error' => __t('api.err_invalid_path')]];
            }

            $ext = strtolower(pathinfo($file_full, PATHINFO_EXTENSION));
            $forbidden_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc', 'sh', 'bash', 'bat', 'cmd', 'exe', 'cgi', 'pl', 'py', 'htaccess', 'user.ini', 'admin_password_hash'];
            if (in_array($ext, $forbidden_exts, true)) {
                return ['status' => 403, 'data' => ['success' => false, 'error' => __t('api.err_forbidden_file_type')]];
            }

            if (@file_put_contents($file_full, (string)$content, LOCK_EX) !== false) {
                CacheManager::invalidateDirCache(dirname($file_full), $base_dir, $thumb_dir_name);
                return ['status' => 200, 'data' => ['success' => true, 'message' => __t('api.msg_file_saved')]];
            }

            return ['status' => 500, 'data' => ['success' => false, 'error' => __t('api.err_file_save_failed')]];
        }

        return null;
    }
}
