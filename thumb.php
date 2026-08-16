<?php
/**
 * SimpleGallery 2026 - High Performance Thumbnail Generator
 * Supports GD image resizing, FFmpeg video frame extraction, & instant direct fallback.
 */

// Disable error display in binary output to prevent corrupted image headers
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/config.php';


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

    if (strtolower($content_type) === 'image/svg+xml') {
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'none';");
        header("X-Content-Type-Options: nosniff");
    }

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
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'none';");
    header("X-Content-Type-Options: nosniff");

    $ext_lower = strtolower($ext);
    
    // Extension specific color mapping (Matching classic OS file icons!)
    $color_map = [
        'pdf'   => ['#e11d48', '#be123c'],
        'doc'   => ['#2563eb', '#1d4ed8'],
        'docx'  => ['#2563eb', '#1d4ed8'],
        'xls'   => ['#16a34a', '#15803d'],
        'xlsx'  => ['#16a34a', '#15803d'],
        'ppt'   => ['#ea580c', '#c2410c'],
        'pptx'  => ['#ea580c', '#c2410c'],
        'zip'   => ['#d97706', '#b45309'],
        'rar'   => ['#d97706', '#b45309'],
        '7z'    => ['#d97706', '#b45309'],
        'tar'   => ['#d97706', '#b45309'],
        'gz'    => ['#d97706', '#b45309'],
        'mp3'   => ['#9333ea', '#7e22ce'],
        'wav'   => ['#9333ea', '#7e22ce'],
        'flac'  => ['#9333ea', '#7e22ce'],
        'aac'   => ['#9333ea', '#7e22ce'],
        'ogg'   => ['#9333ea', '#7e22ce'],
        'txt'   => ['#0284c7', '#0369a1'],
        'md'    => ['#0284c7', '#0369a1'],
        'json'  => ['#0891b2', '#0e7490'],
        'xml'   => ['#0891b2', '#0e7490'],
        'html'  => ['#ea580c', '#c2410c'],
        'css'   => ['#2563eb', '#1d4ed8'],
        'js'    => ['#ca8a04', '#a16207'],
        'php'   => ['#6366f1', '#4f46e5'],
        'py'    => ['#0284c7', '#0369a1'],
        'psd'   => ['#0284c7', '#0369a1'],
        'ai'    => ['#ea580c', '#c2410c'],
    ];

    $category_defaults = [
        'video'   => ['#dc2626', '#b91c1c'],
        'audio'   => ['#9333ea', '#7e22ce'],
        'doc'     => ['#2563eb', '#1d4ed8'],
        'archive' => ['#d97706', '#b45309'],
        'other'   => ['#475569', '#334155']
    ];

    $colors = $color_map[$ext_lower] ?? ($category_defaults[$category] ?? $category_defaults['other']);
    $primary_color = $colors[0];
    $dark_color    = $colors[1];

    $ext_label = strtoupper($ext);
    if (strlen($ext_label) > 5) {
        $ext_label = substr($ext_label, 0, 5);
    }

    // Category icon symbol
    $icon_svg = '<path d="M135 125 h90 M135 150 h90 M135 175 h60" stroke="#64748b" stroke-width="7" stroke-linecap="round" />';
    if ($category === 'audio') {
        $icon_svg = '<path d="M170 175 a22 22 0 1 0 0 -44 a22 22 0 0 0 0 44 z M192 153 V 105 h 25" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />';
    } elseif ($category === 'video') {
        $icon_svg = '<path d="M130 120 h70 a10 10 0 0 1 10 10 v40 a10 10 0 0 1 -10 10 h-70 a10 10 0 0 1 -10 -10 v-40 a10 10 0 0 1 10 -10 z M210 140 l35 -20 v60 l-35 -20 z" fill="#64748b" />';
    } elseif ($category === 'archive') {
        $icon_svg = '<path d="M135 115 h90 v70 h-90 z M180 115 v70 M165 145 h30" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round" />';
    }

    echo <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">
  <defs>
    <!-- Paper Sheet Shadow -->
    <filter id="page-shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.45" />
    </filter>
    <!-- Fold Flap Shadow -->
    <filter id="fold-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="-3" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.35" />
    </filter>
    <linearGradient id="banner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{$primary_color}" />
      <stop offset="100%" stop-color="{$dark_color}" />
    </linearGradient>
    <linearGradient id="page-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>
    <linearGradient id="flap-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e2e8f0" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>
    <clipPath id="sheet-clip">
      <path d="M 95,30 L 220,30 L 280,90 L 280,315 C 280,323 273,330 265,330 L 95,330 C 87,330 80,323 80,315 L 80,45 C 80,37 87,30 95,30 Z" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="360" height="360" fill="#0f172a" rx="16" />

  <!-- Document Sheet Body -->
  <path d="M 95,30 L 220,30 L 280,90 L 280,315 C 280,323 273,330 265,330 L 95,330 C 87,330 80,323 80,315 L 80,45 C 80,37 87,30 95,30 Z" fill="url(#page-grad)" filter="url(#page-shadow)" />

  <!-- Folded Corner Triangle Flap -->
  <path d="M 220,30 L 220,82 C 220,86 224,90 228,90 L 280,90 Z" fill="url(#flap-grad)" filter="url(#fold-shadow)" />

  <!-- Icon inside page -->
  <g transform="translate(0, 10)">
    {$icon_svg}
  </g>

  <!-- Extension Colored Bottom Banner -->
  <g clip-path="url(#sheet-clip)">
    <rect x="70" y="240" width="220" height="95" fill="url(#banner-grad)" />
    <text x="180" y="292" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="1.5" text-anchor="middle" fill="#FFFFFF">{$ext_label}</text>
  </g>
</svg>
SVG;
    exit;
}

// Binary discovery helpers imported via config.php -> functions.php -> includes/binaries.php



function generate_imagemagick_frame_thumbnail(string $file_path, string $output_file, int $thumb_w = 360, int $thumb_h = 360, int $thumb_q = 85): bool {
    // 1. Try PHP Imagick extension if loaded
    if (class_exists('Imagick')) {
        try {
            $im = new Imagick();
            $im->readImage($file_path . '[0]');
            $im->setImageFormat('jpeg');
            $im->thumbnailImage($thumb_w, $thumb_h, true);
            $im->setImageCompressionQuality($thumb_q);
            $im->writeImage($output_file);
            $im->clear();
            $im->destroy();
            if (file_exists($output_file) && filesize($output_file) > 0) {
                return true;
            }
        } catch (Throwable $e) {
            // Fallback to CLI convert
        }
    }

    // 2. Try ImageMagick CLI (convert / magick)
    $convert = find_convert_binary();
    if ($convert) {
        $cmd = sprintf(
            '%s %s[0] -thumbnail %dx%d -quality %d %s 2>&1',
            escapeshellarg($convert),
            escapeshellarg($file_path),
            (int)$thumb_w,
            (int)$thumb_h,
            (int)$thumb_q,
            escapeshellarg($output_file)
        );
        @exec($cmd);
        if (file_exists($output_file) && filesize($output_file) > 0) {
            return true;
        }
    }

    return false;
}

ensure_session_started();


$requested_file = $_GET['file'] ?? '';
$file_path = sanitize_file_path($requested_file, $real_base_dir);

if (!$file_path || is_path_ignored($file_path, $real_base_dir, $ignore_list)) {
    http_response_code(404);
    echo "File not found.";
    exit;
}

$ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
$forbidden_system_exts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc', 'htaccess', 'htpasswd', 'sh', 'bat', 'cmd', 'exe', 'dll', 'py', 'pl', 'cgi', 'hash', 'ini'];
if (in_array($ext, $forbidden_system_exts, true)) {
    http_response_code(403);
    echo "403 Forbidden: Access denied.";
    exit;
}

if (!is_dir_accessible(dirname($file_path), $real_base_dir)) {
    http_response_code(403);
    echo "403 Forbidden: Access denied.";
    exit;
}

// Setup thumbnail cache directory with fallback to sys_get_temp_dir()
$cache_dir = $real_base_dir . '/' . $thumbnail_dir;
if (!is_dir($cache_dir)) {
    @mkdir($cache_dir, 0755, true);
}
if (!is_dir($cache_dir) || !is_writable($cache_dir)) {
    $cache_dir = sys_get_temp_dir() . '/simplegallery_thumbs';
    if (!is_dir($cache_dir)) {
        @mkdir($cache_dir, 0755, true);
    }
}

// -------------------------------------------------------------
// 1. VIDEO THUMBNAIL HANDLING (5-Stage Extraction Chain)
// -------------------------------------------------------------
$is_video = in_array($ext, $media_types['video'], true);

if ($is_video) {
    $video_cache_key = md5($file_path . '_' . filesize($file_path) . '_' . filemtime($file_path) . '_vthumb');
    $video_cache_file = $cache_dir . '/' . $video_cache_key . '.jpg';

    // Serve cached video poster if present
    if (file_exists($video_cache_file) && filesize($video_cache_file) > 0 && filemtime($video_cache_file) >= filemtime($file_path)) {
        send_cached_file($video_cache_file, 'image/jpeg', 31536000);
    }

    // Attempt 1: Fast pure PHP parser to extract embedded JPEG metadata thumbnail (Android/iOS MP4/MOV)
    if (extract_mp4_embedded_jpeg($file_path, $video_cache_file)) {
        send_cached_file($video_cache_file, 'image/jpeg', 31536000);
    }

    // Attempt 2: ExifTool CLI (Extract embedded Preview/Thumbnail metadata)
    $exiftool = find_exiftool_binary();
    if ($exiftool) {
        $cmd_exif1 = sprintf(
            '%s -b -ThumbnailImage %s > %s 2>/dev/null',
            escapeshellarg($exiftool),
            escapeshellarg($file_path),
            escapeshellarg($video_cache_file)
        );
        @exec($cmd_exif1);
        if (!file_exists($video_cache_file) || filesize($video_cache_file) === 0) {
            $cmd_exif2 = sprintf(
                '%s -b -PreviewImage %s > %s 2>/dev/null',
                escapeshellarg($exiftool),
                escapeshellarg($file_path),
                escapeshellarg($video_cache_file)
            );
            @exec($cmd_exif2);
        }
        if (file_exists($video_cache_file) && filesize($video_cache_file) > 1000) {
            send_cached_file($video_cache_file, 'image/jpeg', 31536000);
        }
    }

    // Attempt 3: Try FFmpeg frame extraction
    $ffmpeg = find_ffmpeg_binary();
    if ($ffmpeg) {
        $cmd1 = sprintf(
            '%s -y -ss 00:00:01 -i %s -vframes 1 -f image2 -pix_fmt yuv420p -q:v 3 -vf "scale=360:-2" %s 2>&1',
            escapeshellarg($ffmpeg),
            escapeshellarg($file_path),
            escapeshellarg($video_cache_file)
        );
        @exec($cmd1);

        if (!file_exists($video_cache_file) || filesize($video_cache_file) === 0) {
            $cmd2 = sprintf(
                '%s -y -i %s -ss 00:00:00.5 -vframes 1 -f image2 -pix_fmt yuv420p -q:v 3 -vf "scale=360:-2" %s 2>&1',
                escapeshellarg($ffmpeg),
                escapeshellarg($file_path),
                escapeshellarg($video_cache_file)
            );
            @exec($cmd2);
        }

        if (file_exists($video_cache_file) && filesize($video_cache_file) > 0) {
            send_cached_file($video_cache_file, 'image/jpeg', 31536000);
        }
    }

    // Attempt 4: ImageMagick (Imagick extension or convert CLI for IONOS / shared hosting)
    if (generate_imagemagick_frame_thumbnail($file_path, $video_cache_file, $thumb_width, $thumb_height, $thumb_quality)) {
        send_cached_file($video_cache_file, 'image/jpeg', 31536000);
    }

    // Fallback if none of the above are available or supported
    render_svg_placeholder('video', $ext, $file_path);
}

// -------------------------------------------------------------
// 2. PDF DOCUMENT THUMBNAIL HANDLING (via ImageMagick)
// -------------------------------------------------------------
if ($ext === 'pdf') {
    $pdf_cache_key = md5($file_path . '_' . filesize($file_path) . '_' . filemtime($file_path) . '_pdfthumb');
    $pdf_cache_file = $cache_dir . '/' . $pdf_cache_key . '.jpg';

    if (file_exists($pdf_cache_file) && filesize($pdf_cache_file) > 0 && filemtime($pdf_cache_file) >= filemtime($file_path)) {
        send_cached_file($pdf_cache_file, 'image/jpeg', 31536000);
    }

    if (generate_imagemagick_frame_thumbnail($file_path, $pdf_cache_file, $thumb_width, $thumb_height, $thumb_quality)) {
        send_cached_file($pdf_cache_file, 'image/jpeg', 31536000);
    }
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
    $cache_key = md5($file_path . '_' . filesize($file_path) . '_' . filemtime($file_path) . '_' . $thumb_width . 'x' . $thumb_height . '_v2');
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

    // Auto-rotate image according to EXIF orientation metadata (JPEG / TIFF)
    if (in_array($ext, ['jpg', 'jpeg', 'tif', 'tiff'], true)) {
        $exif = function_exists('exif_read_data') ? @exif_read_data($file_path) : parse_exif_app1_pure_php($file_path);
        if (!empty($exif['Orientation'])) {
            $orientation = (int)$exif['Orientation'];
            switch ($orientation) {
                case 2:
                    if (function_exists('imageflip')) @imageflip($src_img, IMG_FLIP_HORIZONTAL);
                    break;
                case 3:
                    $rotated = @imagerotate($src_img, 180, 0);
                    if ($rotated !== false) {
                        imagedestroy($src_img);
                        $src_img = $rotated;
                    }
                    break;
                case 4:
                    if (function_exists('imageflip')) @imageflip($src_img, IMG_FLIP_VERTICAL);
                    break;
                case 5:
                    $rotated = @imagerotate($src_img, 270, 0);
                    if ($rotated !== false) {
                        imagedestroy($src_img);
                        $src_img = $rotated;
                        if (function_exists('imageflip')) @imageflip($src_img, IMG_FLIP_HORIZONTAL);
                    }
                    break;
                case 6:
                    $rotated = @imagerotate($src_img, 270, 0); // 270 deg CCW = 90 deg CW
                    if ($rotated !== false) {
                        imagedestroy($src_img);
                        $src_img = $rotated;
                    }
                    break;
                case 7:
                    $rotated = @imagerotate($src_img, 90, 0);
                    if ($rotated !== false) {
                        imagedestroy($src_img);
                        $src_img = $rotated;
                        if (function_exists('imageflip')) @imageflip($src_img, IMG_FLIP_HORIZONTAL);
                    }
                    break;
                case 8:
                    $rotated = @imagerotate($src_img, 90, 0); // 90 deg CCW = 270 deg CW
                    if ($rotated !== false) {
                        imagedestroy($src_img);
                        $src_img = $rotated;
                    }
                    break;
            }
        }
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
