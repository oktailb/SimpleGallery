<?php
/**
 * SimpleGallery 2026 - Image Metadata Extractor Module
 * Zero-dependency pure PHP extraction for Image dimensions, Aspect Ratio, GIF frames & EXIF.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

/**
 * Computes closest standard or simplified aspect ratio string from dimensions
 */
function compute_aspect_ratio(int $width, int $height): string {
    if ($width <= 0 || $height <= 0) return '';
    
    $gcd = function($a, $b) use (&$gcd) {
        return ($b === 0) ? $a : $gcd($b, $a % $b);
    };
    
    $divisor = $gcd($width, $height);
    $w_ratio = $width / $divisor;
    $h_ratio = $height / $divisor;

    // Check common standard aspect ratios with tolerance
    $val = $width / $height;
    if (abs($val - (16 / 9)) < 0.03) return '16:9';
    if (abs($val - (4 / 3)) < 0.03) return '4:3';
    if (abs($val - (3 / 2)) < 0.03) return '3:2';
    if (abs($val - 1.0) < 0.01) return '1:1';
    if (abs($val - (9 / 16)) < 0.03) return '9:16';
    if (abs($val - (3 / 4)) < 0.03) return '3:4';
    if (abs($val - (2 / 3)) < 0.03) return '2:3';
    if (abs($val - (21 / 9)) < 0.05) return '21:9';

    if ($w_ratio <= 50 && $h_ratio <= 50) {
        return $w_ratio . ':' . $h_ratio;
    }

    return round($val, 2) . ':1';
}

/**
 * Detects if a GIF file contains multiple animated frames
 */
function detect_gif_animation(string $file_path): array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) {
        return ['is_animated' => false, 'frames_count' => 1];
    }

    $count = 0;
    while (!feof($fh) && $count < 100) {
        $chunk = fread($fh, 1024 * 64);
        if ($chunk === false || $chunk === '') break;
        // Count Graphic Control Extensions in GIF stream (\x00\x21\xF9\x04)
        $count += preg_match_all('/\x00\x21\xF9\x04/', $chunk);
    }
    fclose($fh);

    return [
        'is_animated'  => $count > 1,
        'frames_count' => max(1, $count)
    ];
}

/**
 * Extracts complete image-specific metadata
 */
function extract_image_metadata(string $file_path, string $ext): ?array {
    $info = @getimagesize($file_path);
    if (!$info || !isset($info[0]) || !isset($info[1])) {
        return null;
    }

    $width = (int)$info[0];
    $height = (int)$info[1];
    $mime = $info['mime'] ?? 'image/' . $ext;
    $bits = $info['bits'] ?? null;
    $channels = $info['channels'] ?? null;

    $megapixels = round(($width * $height) / 1000000.0, 1);
    $aspect_ratio = compute_aspect_ratio($width, $height);

    $color_depth = null;
    if ($bits) {
        $color_depth = ($channels ? ($bits * $channels) : $bits) . ' bits';
    }

    $gif_info = null;
    if (strtolower($ext) === 'gif') {
        $gif_info = detect_gif_animation($file_path);
    }

    // Extract EXIF data if available
    $exif = function_exists('extract_exif_data') ? extract_exif_data($file_path) : null;

    return [
        'width'         => $width,
        'height'        => $height,
        'resolution'    => $width . ' × ' . $height . ' px',
        'aspect_ratio'  => $aspect_ratio,
        'megapixels'    => $megapixels > 0 ? $megapixels . ' MP' : null,
        'color_depth'   => $color_depth,
        'mime'          => $mime,
        'is_animated'   => $gif_info['is_animated'] ?? false,
        'frames_count'  => $gif_info['frames_count'] ?? 1,
        'exif'          => $exif
    ];
}
