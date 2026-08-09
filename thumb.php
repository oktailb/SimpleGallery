<?php
/**
 * SimpleGallery 2026 - High Performance Thumbnail Generator
 * Supports GD image resizing, FFmpeg video frame extraction, & instant direct fallback.
 */

// Disable error display in binary output to prevent corrupted image headers
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/config.php';

function sanitize_file_path(?string $requested_file, string $base_dir): ?string {
    if (empty($requested_file)) {
        return null;
    }
    
    $requested_file = str_replace(['\\', '..'], ['/', ''], $requested_file);
    $target_path = realpath($base_dir . '/' . ltrim($requested_file, '/'));

    if ($target_path === false || !is_file($target_path)) {
        return null;
    }

    if (strpos($target_path, $base_dir) !== 0) {
        return null;
    }

    return $target_path;
}

function send_cached_file(string $file_path, string $content_type, int $max_age = 31536000): void {
    if (!file_exists($file_path)) {
        return;
    }
    $mtime = filemtime($file_path);
    $size = filesize($file_path);
    $etag = '"' . md5($file_path . '-' . $mtime . '-' . $size) . '"';

    header('Content-Type: ' . $content_type);
    header('Cache-Control: public, max-age=' . $max_age);
    header('ETag: ' . $etag);
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');

    $if_none_match = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? trim($_SERVER['HTTP_IF_NONE_MATCH']) : null;
    $if_modified_since = isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) ? strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) : null;

    if (($if_none_match !== null && $if_none_match === $etag) || 
        ($if_modified_since !== null && $if_modified_since >= $mtime)) {
        http_response_code(304);
        exit;
    }

    header('Content-Length: ' . $size);
    readfile($file_path);
    exit;
}

function serve_direct_file(string $file_path, string $ext): void {
    $mime_types = [
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'gif'  => 'image/gif',
        'webp' => 'image/webp',
        'avif' => 'image/avif',
        'bmp'  => 'image/bmp',
        'svg'  => 'image/svg+xml'
    ];

    $content_type = $mime_types[$ext] ?? 'application/octet-stream';
    send_cached_file($file_path, $content_type, 86400);
}

function render_svg_placeholder(string $category, string $ext, string $filename): void {
    header('Content-Type: image/svg+xml');
    header('Cache-Control: public, max-age=86400');
    
    $colors = [
        'video'   => ['#E53E3E', '#9B2C2C', '▶'],
        'audio'   => ['#805AD5', '#553C9A', '🎵'],
        'doc'     => ['#3182CE', '#2B6CB0', '📄'],
        'archive' => ['#DD6B20', '#C05621', '📦'],
        'other'   => ['#718096', '#4A5568', '📁']
    ];

    $info = $colors[$category] ?? $colors['other'];
    $bg1 = $info[0];
    $bg2 = $info[1];
    $icon = $info[2];
    $ext_label = strtoupper($ext);
    $short_name = htmlspecialchars(mb_strimwidth(basename($filename), 0, 18, '...'), ENT_QUOTES, 'UTF-8');

    echo <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{$bg1}" />
      <stop offset="100%" stop-color="{$bg2}" />
    </linearGradient>
  </defs>
  <rect width="360" height="360" rx="16" fill="url(#grad)" />
  <circle cx="180" cy="150" r="54" fill="rgba(255,255,255,0.15)" />
  <text x="180" y="166" font-size="50" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF">{$icon}</text>
  <rect x="50" y="240" width="260" height="40" rx="8" fill="rgba(0,0,0,0.3)" />
  <text x="180" y="265" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="bold" letter-spacing="1" text-anchor="middle" fill="#FFFFFF">{$ext_label}</text>
  <text x="180" y="310" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" text-anchor="middle" fill="rgba(255,255,255,0.85)">{$short_name}</text>
</svg>
SVG;
    exit;
}

function find_ffmpeg_binary(): ?string {
    if (file_exists('/usr/bin/ffmpeg') && is_executable('/usr/bin/ffmpeg')) {
        return '/usr/bin/ffmpeg';
    }
    $which = @exec('which ffmpeg 2>/dev/null');
    if (!empty($which) && file_exists($which)) {
        return $which;
    }
    return null;
}

$requested_file = $_GET['file'] ?? '';
$file_path = sanitize_file_path($requested_file, $real_base_dir);

if (!$file_path) {
    http_response_code(404);
    echo "File not found.";
    exit;
}

$ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));

// Setup thumbnail cache directory
$cache_dir = $real_base_dir . '/' . $thumbnail_dir;
if (!is_dir($cache_dir)) {
    @mkdir($cache_dir, 0755, true);
}

// -------------------------------------------------------------
// 1. VIDEO THUMBNAIL HANDLING (via FFmpeg)
// -------------------------------------------------------------
$is_video = in_array($ext, $media_types['video'], true);

if ($is_video) {
    $video_cache_key = md5($file_path . '_' . filesize($file_path) . '_' . filemtime($file_path) . '_vthumb');
    $video_cache_file = $cache_dir . '/' . $video_cache_key . '.jpg';

    // Serve cached video poster if present
    if (file_exists($video_cache_file) && filesize($video_cache_file) > 0 && filemtime($video_cache_file) >= filemtime($file_path)) {
        send_cached_file($video_cache_file, 'image/jpeg', 31536000);
    }

    // Try FFmpeg frame extraction
    $ffmpeg = find_ffmpeg_binary();
    if ($ffmpeg) {
        $cmd = sprintf(
            '%s -ss 00:00:01 -i %s -vframes 1 -q:v 3 -vf "scale=360:-1" %s 2>&1',
            escapeshellarg($ffmpeg),
            escapeshellarg($file_path),
            escapeshellarg($video_cache_file)
        );
        @exec($cmd);

        if (file_exists($video_cache_file) && filesize($video_cache_file) > 0) {
            send_cached_file($video_cache_file, 'image/jpeg', 31536000);
        }
    }

    // Fallback if FFmpeg not available or failed
    render_svg_placeholder('video', $ext, $file_path);
}

// -------------------------------------------------------------
// 2. IMAGE THUMBNAIL HANDLING (GD or Direct Stream Fallback)
// -------------------------------------------------------------
$is_image = in_array($ext, $media_types['image'], true);

if ($is_image) {
    // SVGs serve directly
    if ($ext === 'svg') {
        serve_direct_file($file_path, 'svg');
    }

    // If GD extension is not loaded in PHP, fall back to direct file stream immediately!
    if (!function_exists('imagecreatefromjpeg') && !function_exists('imagecreatefrompng')) {
        serve_direct_file($file_path, $ext);
    }

    // GD processing
    $cache_key = md5($file_path . '_' . filesize($file_path) . '_' . filemtime($file_path) . '_' . $thumb_width . 'x' . $thumb_height);
    $cache_file_webp = $cache_dir . '/' . $cache_key . '.webp';
    $cache_file_jpg  = $cache_dir . '/' . $cache_key . '.jpg';

    if (file_exists($cache_file_webp) && filemtime($cache_file_webp) >= filemtime($file_path)) {
        send_cached_file($cache_file_webp, 'image/webp', 31536000);
    }

    if (file_exists($cache_file_jpg) && filemtime($cache_file_jpg) >= filemtime($file_path)) {
        send_cached_file($cache_file_jpg, 'image/jpeg', 31536000);
    }

    // Attempt GD image loading
    $src_img = false;
    switch ($ext) {
        case 'jpg':
        case 'jpeg':
            if (function_exists('imagecreatefromjpeg')) $src_img = @imagecreatefromjpeg($file_path);
            break;
        case 'png':
            if (function_exists('imagecreatefrompng')) $src_img = @imagecreatefrompng($file_path);
            break;
        case 'gif':
            if (function_exists('imagecreatefromgif')) $src_img = @imagecreatefromgif($file_path);
            break;
        case 'webp':
            if (function_exists('imagecreatefromwebp')) $src_img = @imagecreatefromwebp($file_path);
            break;
        case 'avif':
            if (function_exists('imagecreatefromavif')) $src_img = @imagecreatefromavif($file_path);
            break;
        case 'bmp':
            if (function_exists('imagecreatefrombmp')) $src_img = @imagecreatefrombmp($file_path);
            break;
    }

    // If GD loading failed, serve original image file directly!
    if (!$src_img) {
        serve_direct_file($file_path, $ext);
    }

    $orig_w = imagesx($src_img);
    $orig_h = imagesy($src_img);

    if ($orig_w <= 0 || $orig_h <= 0) {
        imagedestroy($src_img);
        serve_direct_file($file_path, $ext);
    }

    // Calculate aspect ratio scale
    $ratio = min($thumb_width / $orig_w, $thumb_height / $orig_h);
    $new_w = (int)max(1, round($orig_w * $ratio));
    $new_h = (int)max(1, round($orig_h * $ratio));

    $thumb_img = imagecreatetruecolor($new_w, $new_h);

    if (in_array($ext, ['png', 'gif', 'webp'], true)) {
        imagealphablending($thumb_img, false);
        imagesavealpha($thumb_img, true);
        $transparent = imagecolorallocatealpha($thumb_img, 255, 255, 255, 127);
        imagefilledrectangle($thumb_img, 0, 0, $new_w, $new_h, $transparent);
    }

    imagecopyresampled($thumb_img, $src_img, 0, 0, 0, 0, $new_w, $new_h, $orig_w, $orig_h);

    if (function_exists('imagewebp')) {
        @imagewebp($thumb_img, $cache_file_webp, $thumb_quality);
        imagedestroy($src_img);
        imagedestroy($thumb_img);

        if (file_exists($cache_file_webp)) {
            send_cached_file($cache_file_webp, 'image/webp', 31536000);
        }
    } else {
        @imagejpeg($thumb_img, $cache_file_jpg, $thumb_quality);
        imagedestroy($src_img);
        imagedestroy($thumb_img);

        if (file_exists($cache_file_jpg)) {
            send_cached_file($cache_file_jpg, 'image/jpeg', 31536000);
        }
    }

    // Ultimate fallback if saving failed
    serve_direct_file($file_path, $ext);
}

// -------------------------------------------------------------
// 3. OTHER MEDIA (Audio, Docs, Archives)
// -------------------------------------------------------------
$category = 'other';
foreach ($media_types as $cat => $extensions) {
    if (in_array($ext, $extensions, true)) {
        $category = $cat;
        break;
    }
}
render_svg_placeholder($category, $ext, $file_path);
