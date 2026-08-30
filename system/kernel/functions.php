<?php
/**
 * SimpleGallery 2026 - System Functions Façade & Backward Compatibility Layer
 * Thin, high-performance procedural wrapper forwarding calls to Object-Oriented Kernel modules.
 */

use SimpleGallery\Kernel\Auth\AuthManager;
use SimpleGallery\Kernel\FS\ArchiveEngine;
use SimpleGallery\Kernel\FS\CacheManager;
use SimpleGallery\Kernel\FS\DotfileManager;
use SimpleGallery\Kernel\FS\PermissionsManager;
use SimpleGallery\Kernel\FS\VFS;
use SimpleGallery\Kernel\I18n\I18nEngine;
use SimpleGallery\Kernel\Media\BinaryLocator;
use SimpleGallery\Kernel\Media\ExifParser;
use SimpleGallery\Kernel\Search\SearchEngine;
use SimpleGallery\Kernel\Security\CsrfManager;
use SimpleGallery\Kernel\Security\PathValidator;
use SimpleGallery\Kernel\Security\RateLimiter;
use SimpleGallery\Kernel\Security\SecurityManager;

$project_root = dirname(dirname(__DIR__));
require_once __DIR__ . '/../boot/bootstrap.php';

// Global admin password hash cached in session/memory
global $admin_password_hash;
$admin_password_hash = get_admin_password_hash($admin_password_hash ?? '');

// -------------------------------------------------------------
// 1. Session & CSRF Security
// -------------------------------------------------------------
function ensure_session_started(): void {
    AuthManager::ensureSessionStarted();
}

function sanitize_utf8($mixed) {
    return SecurityManager::sanitizeUtf8($mixed);
}

function get_csrf_token(): string {
    return CsrfManager::getToken();
}

function verify_csrf_token(?string $token): bool {
    return CsrfManager::verifyToken($token);
}

// -------------------------------------------------------------
// 2. Authentication & Rate Limiting
// -------------------------------------------------------------
function is_admin_logged_in(): bool {
    return AuthManager::isAdminLoggedIn();
}

function get_admin_password_hash(string $legacy_hash = ''): string {
    return AuthManager::getPasswordHash($legacy_hash);
}

function update_admin_password_hash(string $new_password): bool {
    return AuthManager::updatePasswordHash($new_password);
}

function update_admin_password_in_config(string $new_password): bool {
    return AuthManager::updatePasswordInConfig($new_password);
}

function get_client_ip(): string {
    return RateLimiter::getClientIp();
}

function get_rate_limit_file(string $key): string {
    return RateLimiter::getRateLimitFile($key);
}

function check_rate_limit(string $key, int $max_attempts = 5, int $decay_seconds = 900): bool {
    return RateLimiter::checkRateLimit($key, $max_attempts, $decay_seconds);
}

function increment_rate_limit(string $key): void {
    RateLimiter::incrementRateLimit($key);
}

function reset_rate_limit(string $key): void {
    RateLimiter::resetRateLimit($key);
}

// -------------------------------------------------------------
// 3. Path Validation & Access Control
// -------------------------------------------------------------
function canonicalize_and_validate_path(string $user_path, string $base_dir, bool $must_exist = true, bool $allow_root = true): ?string {
    return PathValidator::canonicalizeAndValidate($user_path, $base_dir, $must_exist, $allow_root);
}

function sanitize_path(?string $requested_dir, string $base_dir): ?string {
    return PathValidator::sanitizePath($requested_dir, $base_dir);
}

function sanitize_file_path(?string $requested_file, string $base_dir): ?string {
    return PathValidator::sanitizeFilePath($requested_file, $base_dir);
}

function get_relative_path(string $full_path, string $base_dir): string {
    return PathValidator::getRelativePath($full_path, $base_dir);
}

function is_path_ignored(string $path, string $base_dir, array $ignore_list): bool {
    return PathValidator::isPathIgnored($path, $base_dir, $ignore_list);
}

function get_dir_access_info(string $dir_path, string $base_dir): array {
    return AuthManager::getDirAccessInfo($dir_path, $base_dir);
}

function is_dir_accessible(string $dir_path, string $base_dir): bool {
    return AuthManager::isDirAccessible($dir_path, $base_dir);
}

// -------------------------------------------------------------
// 4. File Sanitization, Media & EXIF
// -------------------------------------------------------------
function sanitize_svg_content(string $filepath): bool {
    return SecurityManager::sanitizeSvgContent($filepath);
}

function format_bytes(int $bytes, int $precision = 1): string {
    return ExifParser::formatBytes($bytes, $precision);
}

function encode_url_path(string $relative_path): string {
    return ExifParser::encodeUrlPath($relative_path);
}

function get_media_category(string $extension, array $media_types = []): string {
    return ExifParser::getMediaCategory($extension, $media_types);
}

function parse_exif_rational(?string $value): ?float {
    return ExifParser::parseExifRational($value);
}

function parse_exif_gps_coordinate($coord_array, $ref): ?float {
    return ExifParser::parseExifGpsCoordinate($coord_array, $ref);
}

function extract_exif_data(string $filepath): ?array {
    return ExifParser::extractExifData($filepath);
}

function extract_mp4_embedded_jpeg(string $mp4_file, string $output_jpg_file): bool {
    return ExifParser::extractMp4EmbeddedJpeg($mp4_file, $output_jpg_file);
}

function transfer_jpeg_exif(string $source_jpg, string $target_jpg) {
    return ExifParser::transferJpegExif($source_jpg, $target_jpg);
}

function compute_aspect_ratio(int $width, int $height): string {
    if ($width <= 0 || $height <= 0) return 'custom';
    $gcd_fn = function(int $a, int $b) use (&$gcd_fn): int {
        return ($b === 0) ? $a : $gcd_fn($b, $a % $b);
    };
    $gcd = $gcd_fn($width, $height);
    $r_w = $width / $gcd;
    $r_h = $height / $gcd;

    $decimal = $width / $height;
    if (abs($decimal - (16 / 9)) < 0.05) return '16:9';
    if (abs($decimal - (4 / 3)) < 0.05) return '4:3';
    if (abs($decimal - (3 / 2)) < 0.05) return '3:2';
    if (abs($decimal - 1.0) < 0.02) return '1:1';
    if (abs($decimal - (9 / 16)) < 0.05) return '9:16';
    if (abs($decimal - (3 / 4)) < 0.05) return '3:4';
    if (abs($decimal - (2 / 3)) < 0.05) return '2:3';
    if (abs($decimal - (21 / 9)) < 0.05) return '21:9';

    return $r_w . ':' . $r_h;
}

function format_media_duration(float $seconds): string {
    $total_sec = (int)round($seconds);
    $hours = floor($total_sec / 3600);
    $minutes = floor(($total_sec % 3600) / 60);
    $sec = $total_sec % 60;

    if ($hours > 0) {
        return sprintf('%02d:%02d:%02d', $hours, $minutes, $sec);
    }
    return sprintf('%02d:%02d', $minutes, $sec);
}

require_once __DIR__ . '/Metadata/MetadataManager.php';



function find_binary_executable($name, array $common_paths = []): ?string {
    return BinaryLocator::findBinary($name, $common_paths);
}

function find_archive_binaries(): array {
    return BinaryLocator::findArchiveBinaries();
}

// -------------------------------------------------------------
// 5. Permissions Matrix
// -------------------------------------------------------------
function get_permissions_file_path(string $base_dir): string {
    return PermissionsManager::getPermissionsFilePath($base_dir);
}

function get_default_permissions(): array {
    return PermissionsManager::getDefaultPermissions();
}

function load_permissions_config(string $base_dir): array {
    return PermissionsManager::loadPermissions($base_dir);
}

function save_permissions_config(string $base_dir, array $permissions): bool {
    return PermissionsManager::savePermissions($base_dir, $permissions);
}

function has_permission(string $permission_key, string $base_dir): bool {
    return PermissionsManager::hasPermission($permission_key, $base_dir);
}

// -------------------------------------------------------------
// 6. Archives & Compression
// -------------------------------------------------------------
function create_archive(string $format, string $target_dir, string $output_file, string $base_dir, array $ignore_list): bool {
    return ArchiveEngine::createArchive($format, $target_dir, $output_file, $base_dir, $ignore_list);
}



// -------------------------------------------------------------
// 7. Dotfiles & Metadata Overrides
// -------------------------------------------------------------
function load_dir_comments(string $dir_path): array {
    return DotfileManager::loadDirComments($dir_path);
}

function save_dir_comments(string $dir_path, array $comments): bool {
    return DotfileManager::saveDirComments($dir_path, $comments);
}

function load_folder_overrides(string $dir_path, string $base_dir): array {
    global $theme_colors;
    return DotfileManager::loadFolderOverrides($dir_path, $base_dir, $theme_colors ?? []);
}

// -------------------------------------------------------------
// 8. Caching Engine
// -------------------------------------------------------------
function get_cache_storage_dir(string $base_dir, string $thumb_dir): string {
    return CacheManager::getCacheStorageDir($base_dir, $thumb_dir);
}

function get_dir_cache_file_path(string $dir_path, string $base_dir, string $thumb_dir): string {
    return CacheManager::getDirCacheFilePath($dir_path, $base_dir, $thumb_dir);
}

function is_dir_cache_valid(string $cache_file, string $dir_path): bool {
    return CacheManager::isDirCacheValid($cache_file, $dir_path);
}

function invalidate_dir_cache(string $dir_path, string $base_dir, string $thumb_dir): void {
    CacheManager::invalidateDirCache($dir_path, $base_dir, $thumb_dir);
}

// -------------------------------------------------------------
// 9. Search Engine
// -------------------------------------------------------------
function search_gallery_recursive(string $start_dir, string $base_dir, array $params, array $ignore_list, array $media_types): array {
    return SearchEngine::search($start_dir, $base_dir, $params, $ignore_list, $media_types);
}

// -------------------------------------------------------------
// 10. Internationalization (i18n) & Autostart
// -------------------------------------------------------------
function get_available_locales(string $base_dir): array {
    return I18nEngine::getAvailableLocales($base_dir);
}

function get_locale_flag_html($locale_or_code, string $fallback = '🌐', array $available_locales = []): string {
    return I18nEngine::getLocaleFlagHtml($locale_or_code, $fallback, $available_locales);
}

function detect_browser_locale(array $available_locales, string $default = 'fr'): string {
    return I18nEngine::detectBrowserLocale($available_locales, $default);
}

function load_locale_translations(string $base_dir, string $code): array {
    return I18nEngine::loadLocaleTranslations($base_dir, $code);
}

function __t(string $key, array $replacements = [], ?string $locale = null, string $base_dir = ''): string {
    return I18nEngine::translate($key, $replacements, $locale, $base_dir);
}

function get_autostart_config(string $base_dir): array {
    $default = [
        'enabled' => true,
        'apps' => [
            ['appId' => 'explorer', 'state' => 'maximized', 'enabled' => true]
        ]
    ];

    $cfg = \SimpleGallery\Kernel\Config\ConfigStore::get('autostart', null, $base_dir);
    if (is_array($cfg)) {
        return array_merge($default, $cfg);
    }

    return $default;
}


function find_first_image_thumbnail(string $dir_path, string $base_dir, array $image_exts): ?string {
    return ExifParser::findFirstImageThumbnail($dir_path, $base_dir, $image_exts);
}

function find_binary(string $binary_name): ?string {
    return BinaryLocator::find($binary_name);
}

function find_convert_binary(): ?string {
    return BinaryLocator::find('convert') ?: BinaryLocator::find('magick');
}

function find_ffmpeg_binary(): ?string {
    return BinaryLocator::find('ffmpeg');
}

function find_ffprobe_binary(): ?string {
    return BinaryLocator::find('ffprobe');
}

function find_exiftool_binary(): ?string {
    return BinaryLocator::find('exiftool');
}

function find_7z_binary(): ?string {
    return BinaryLocator::find('7z') ?: BinaryLocator::find('7za');
}

function find_tar_binary(): ?string {
    return BinaryLocator::find('tar');
}

function find_zip_binary(): ?string {
    return BinaryLocator::find('zip');
}

function parse_exif_app1_pure_php(string $file_path): ?array {
    return ExifParser::parseApp1PurePhp($file_path);
}



