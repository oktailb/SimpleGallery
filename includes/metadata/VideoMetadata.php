<?php
/**
 * SimpleGallery 2026 - Video Metadata Extractor Module
 * Zero-dependency pure PHP parser for MP4/MOV atoms + FFprobe optional fallback.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

/**
 * Formats duration in seconds to standard MM:SS or HH:MM:SS string
 */
function format_media_duration(float $seconds): string {
    $sec = (int)round($seconds);
    $hours = floor($sec / 3600);
    $minutes = floor(($sec % 3600) / 60);
    $remaining_seconds = $sec % 60;

    if ($hours > 0) {
        return sprintf('%02d:%02d:%02d', $hours, $minutes, $remaining_seconds);
    }
    return sprintf('%02d:%02d', $minutes, $remaining_seconds);
}

/**
 * Fast pure PHP parser for ISO Base Media File Format (MP4, MOV, M4V)
 * Reads moov -> mvhd (duration) and trak -> tkhd (dimensions)
 */
function parse_mp4_atoms_pure_php(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    $file_size = filesize($file_path);
    $max_scan = min($file_size, 1024 * 1024 * 32); // Scan first 32MB max

    $duration = null;
    $width = null;
    $height = null;

    $offset = 0;
    while ($offset < $max_scan) {
        if (fseek($fh, $offset, SEEK_SET) !== 0) break;
        $header = fread($fh, 8);
        if (strlen($header) < 8) break;

        $size = unpack('N', substr($header, 0, 4))[1];
        $type = substr($header, 4, 4);

        if ($size === 1) { // 64-bit large size
            $ext_size = fread($fh, 8);
            if (strlen($ext_size) < 8) break;
            $size = unpack('J', $ext_size)[1] ?? 0;
            $header_len = 16;
        } else {
            $header_len = 8;
        }

        if ($size <= 0) break;

        if ($type === 'moov') {
            // Read inside moov container
            $moov_data = fread($fh, min($size - $header_len, 1024 * 1024 * 4));
            
            // Search for mvhd (Movie Header)
            $mvhd_pos = strpos($moov_data, 'mvhd');
            if ($mvhd_pos !== false && $mvhd_pos >= 4) {
                $version = ord($moov_data[$mvhd_pos + 4]);
                if ($version === 0 && strlen($moov_data) >= $mvhd_pos + 24) {
                    $timescale = unpack('N', substr($moov_data, $mvhd_pos + 16, 4))[1] ?? 0;
                    $dur_units = unpack('N', substr($moov_data, $mvhd_pos + 20, 4))[1] ?? 0;
                    if ($timescale > 0) {
                        $duration = $dur_units / (float)$timescale;
                    }
                } elseif ($version === 1 && strlen($moov_data) >= $mvhd_pos + 36) {
                    $timescale = unpack('N', substr($moov_data, $mvhd_pos + 24, 4))[1] ?? 0;
                    $dur_units = unpack('J', substr($moov_data, $mvhd_pos + 28, 8))[1] ?? 0;
                    if ($timescale > 0) {
                        $duration = $dur_units / (float)$timescale;
                    }
                }
            }

            // Search for tkhd (Track Header) for video dimensions
            $tkhd_pos = strpos($moov_data, 'tkhd');
            if ($tkhd_pos !== false && strlen($moov_data) >= $tkhd_pos + 80) {
                $version = ord($moov_data[$tkhd_pos + 4]);
                $offset_dim = ($version === 1) ? 84 : 72;
                if (strlen($moov_data) >= $tkhd_pos + $offset_dim + 8) {
                    $w_raw = unpack('N', substr($moov_data, $tkhd_pos + $offset_dim, 4))[1] ?? 0;
                    $h_raw = unpack('N', substr($moov_data, $tkhd_pos + $offset_dim + 4, 4))[1] ?? 0;
                    // TKHD dimensions are 16.16 fixed-point numbers
                    $w = $w_raw >> 16;
                    $h = $h_raw >> 16;
                    if ($w > 0 && $h > 0) {
                        $width = $w;
                        $height = $h;
                    }
                }
            }
            break;
        }

        $offset += $size;
    }

    fclose($fh);

    if ($duration !== null || $width !== null) {
        return [
            'duration' => $duration,
            'width'    => $width,
            'height'   => $height
        ];
    }

    return null;
}

/**
 * Extracts complete video metadata
 */
function extract_video_metadata(string $file_path, string $ext): array {
    $ext_clean = strtolower($ext);
    $res = [
        'container'          => strtoupper($ext_clean),
        'duration'           => null,
        'duration_formatted' => null,
        'width'              => null,
        'height'             => null,
        'resolution'         => null,
        'aspect_ratio'       => null,
        'codec'              => null,
        'bitrate'            => null
    ];

    if (in_array($ext_clean, ['mp4', 'm4v', 'mov'], true)) {
        $parsed = parse_mp4_atoms_pure_php($file_path);
        if ($parsed) {
            if ($parsed['duration'] !== null) {
                $res['duration'] = round($parsed['duration'], 1);
                $res['duration_formatted'] = format_media_duration($parsed['duration']);
            }
            if ($parsed['width'] && $parsed['height']) {
                $res['width'] = $parsed['width'];
                $res['height'] = $parsed['height'];
                $res['resolution'] = $parsed['width'] . ' × ' . $parsed['height'] . ' px';
                if (function_exists('compute_aspect_ratio')) {
                    $res['aspect_ratio'] = compute_aspect_ratio($parsed['width'], $parsed['height']);
                }
            }
        }
    }

    // Default container codec hints
    $default_codecs = [
        'mp4'  => 'H.264 / AAC (AVC)',
        'webm' => 'VP8 / VP9 / Opus',
        'mov'  => 'QuickTime (ProRes / H.264)',
        'mkv'  => 'Matroska Video Container',
        'avi'  => 'Audio Video Interleave',
        'ogv'  => 'Ogg Theora'
    ];
    $res['codec'] = $default_codecs[$ext_clean] ?? strtoupper($ext_clean);

    return $res;
}
