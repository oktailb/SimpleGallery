<?php
/**
 * SimpleGallery 2026 - Video Metadata Extractor Module
 * Zero-dependency pure PHP parser for MP4/MOV atoms + FFprobe optional fallback.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

if (!function_exists('format_media_duration')) {
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
}


/**
 * Fast pure PHP parser for ISO Base Media File Format (MP4, MOV, M4V, 3GP)
 * Seeks atom tree to find moov (even when at end of file) and scans all tracks.
 */
function parse_mp4_atoms_pure_php(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    $file_size = (float)filesize($file_path);
    $duration = null;
    $width = null;
    $height = null;

    $offset = 0;
    // Iterate atom table (fast fseek leaps)
    while ($offset < $file_size) {
        if (@fseek($fh, (int)$offset, SEEK_SET) !== 0) break;
        $header = @fread($fh, 8);
        if (!$header || strlen($header) < 8) break;

        $raw_size = unpack('N', substr($header, 0, 4))[1] ?? 0;
        $type = substr($header, 4, 4);

        if ($raw_size === 1) { // 64-bit large size
            $ext_size = @fread($fh, 8);
            if (!$ext_size || strlen($ext_size) < 8) break;
            $atom_size = unpack('J', $ext_size)[1] ?? 0;
            $header_len = 16;
        } elseif ($raw_size === 0) { // Atom extends to EOF
            $atom_size = $file_size - $offset;
            $header_len = 8;
        } else {
            $atom_size = $raw_size;
            $header_len = 8;
        }

        if ($atom_size <= 0) break;

        if ($type === 'moov') {
            // Read moov container (up to 16MB)
            $read_len = min((int)($atom_size - $header_len), 1024 * 1024 * 16);
            $moov_data = @fread($fh, $read_len);
            if ($moov_data) {
                // 1. Movie Header (mvhd) -> Duration
                $mvhd_pos = strpos($moov_data, 'mvhd');
                if ($mvhd_pos !== false && $mvhd_pos >= 4) {
                    $version = ord($moov_data[$mvhd_pos + 4] ?? "\0");
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

                // 2. Track Headers (tkhd) -> Dimensions across all tracks
                $pos = 0;
                while (($tkhd_pos = strpos($moov_data, 'tkhd', $pos)) !== false) {
                    $pos = $tkhd_pos + 4;
                    if (strlen($moov_data) >= $tkhd_pos + 88) {
                        $version = ord($moov_data[$tkhd_pos + 4] ?? "\0");
                        $dim_offset = ($version === 1) ? 88 : 76;
                        if (strlen($moov_data) >= $tkhd_pos + 4 + $dim_offset + 8) {
                            $w_raw = unpack('N', substr($moov_data, $tkhd_pos + 4 + $dim_offset, 4))[1] ?? 0;
                            $h_raw = unpack('N', substr($moov_data, $tkhd_pos + 4 + $dim_offset + 4, 4))[1] ?? 0;
                            $w = $w_raw >> 16;
                            $h = $h_raw >> 16;
                            if ($w > 0 && $h > 0) {
                                $width = $w;
                                $height = $h;
                                break; // Video track found
                            }
                        }
                    }
                }
            }
            break;
        }

        $offset += $atom_size;
    }

    @fclose($fh);

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
 * Fast pure PHP parser for Matroska & WebM files (EBML header scanner)
 */
function parse_webm_ebml_pure_php(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    $chunk = @fread($fh, 1024 * 512); // First 512KB
    @fclose($fh);
    if (!$chunk || strlen($chunk) < 64) return null;

    // Verify EBML ID (0x1A 0x45 0xDF 0xA3)
    if (substr($chunk, 0, 4) !== "\x1A\x45\xDF\xA3") {
        return null;
    }

    $width = null;
    $height = null;
    $duration = null;

    // Search PixelWidth (0xB0) and PixelHeight (0xBA)
    $pw_pos = strpos($chunk, "\xB0");
    if ($pw_pos !== false && strlen($chunk) >= $pw_pos + 4) {
        $len = ord($chunk[$pw_pos + 1]) & 0x7F;
        if ($len === 1) $width = ord($chunk[$pw_pos + 2]);
        elseif ($len === 2) $width = unpack('n', substr($chunk, $pw_pos + 2, 2))[1] ?? null;
    }

    $ph_pos = strpos($chunk, "\xBA");
    if ($ph_pos !== false && strlen($chunk) >= $ph_pos + 4) {
        $len = ord($chunk[$ph_pos + 1]) & 0x7F;
        if ($len === 1) $height = ord($chunk[$ph_pos + 2]);
        elseif ($len === 2) $height = unpack('n', substr($chunk, $ph_pos + 2, 2))[1] ?? null;
    }

    // Search Duration element (0x44 0x89)
    $dur_pos = strpos($chunk, "\x44\x89");
    if ($dur_pos !== false && strlen($chunk) >= $dur_pos + 6) {
        $len = ord($chunk[$dur_pos + 2]);
        if ($len === 4) {
            $raw_f = unpack('G', substr($chunk, $dur_pos + 3, 4))[1] ?? null; // IEEE 754 float
            if ($raw_f && $raw_f > 0) $duration = $raw_f / 1000.0;
        } elseif ($len === 8) {
            $raw_d = unpack('E', substr($chunk, $dur_pos + 3, 8))[1] ?? null; // IEEE 754 double
            if ($raw_d && $raw_d > 0) $duration = $raw_d / 1000.0;
        }
    }

    if ($width || $height || $duration) {
        return [
            'duration' => $duration,
            'width'    => $width,
            'height'   => $height
        ];
    }

    return null;
}

/**
 * Fast pure PHP parser for AVI RIFF files (avih header)
 */
function parse_avi_riff_pure_php(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    $header = @fread($fh, 256);
    @fclose($fh);
    if (!$header || strlen($header) < 64) return null;

    if (substr($header, 0, 4) !== 'RIFF' || substr($header, 8, 4) !== 'AVI ') {
        return null;
    }

    $avih_pos = strpos($header, 'avih');
    if ($avih_pos !== false && strlen($header) >= $avih_pos + 44) {
        $us_per_frame = unpack('V', substr($header, $avih_pos + 8, 4))[1] ?? 0;
        $total_frames = unpack('V', substr($header, $avih_pos + 24, 4))[1] ?? 0;
        $width        = unpack('V', substr($header, $avih_pos + 32, 4))[1] ?? 0;
        $height       = unpack('V', substr($header, $avih_pos + 36, 4))[1] ?? 0;

        $duration = ($us_per_frame > 0 && $total_frames > 0) ? ($us_per_frame * $total_frames) / 1000000.0 : null;

        return [
            'duration' => $duration,
            'width'    => $width > 0 ? $width : null,
            'height'   => $height > 0 ? $height : null
        ];
    }

    return null;
}

/**
 * Optional FFprobe / ExifTool external binary probe
 */
function probe_video_with_cli_tool(string $file_path): ?array {
    if (!function_exists('find_binary_executable')) return null;

    $ffprobe = find_binary_executable('ffprobe');
    if ($ffprobe) {
        $cmd = sprintf(
            '%s -v quiet -print_format json -show_format -show_streams %s 2>&1',
            escapeshellarg($ffprobe),
            escapeshellarg($file_path)
        );
        $output = @exec($cmd);
        if ($output) {
            $json = @json_decode($output, true);
            if ($json && !empty($json['streams'])) {
                $vid_stream = null;
                foreach ($json['streams'] as $st) {
                    if (($st['codec_type'] ?? '') === 'video') {
                        $vid_stream = $st;
                        break;
                    }
                }
                $dur = (float)($json['format']['duration'] ?? $vid_stream['duration'] ?? 0);
                $w = (int)($vid_stream['width'] ?? 0);
                $h = (int)($vid_stream['height'] ?? 0);
                $codec = $vid_stream['codec_name'] ?? null;

                if ($dur > 0 || ($w > 0 && $h > 0)) {
                    return [
                        'duration' => $dur > 0 ? $dur : null,
                        'width'    => $w > 0 ? $w : null,
                        'height'   => $h > 0 ? $h : null,
                        'codec'    => $codec ? strtoupper($codec) : null
                    ];
                }
            }
        }
    }

    return null;
}

/**
 * Extracts complete video metadata with multi-tier pure PHP parsers + fallback
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

    $parsed = null;

    // 1. Pure PHP container parsers
    if (in_array($ext_clean, ['mp4', 'm4v', 'mov', '3gp'], true)) {
        $parsed = parse_mp4_atoms_pure_php($file_path);
    } elseif (in_array($ext_clean, ['webm', 'mkv'], true)) {
        $parsed = parse_webm_ebml_pure_php($file_path);
    } elseif ($ext_clean === 'avi') {
        $parsed = parse_avi_riff_pure_php($file_path);
    }

    // 2. Fallback to CLI tools (FFprobe / ExifTool) if dimensions or duration were missing
    if (!$parsed || !$parsed['duration'] || !$parsed['width']) {
        $cli_parsed = probe_video_with_cli_tool($file_path);
        if ($cli_parsed) {
            $parsed = array_merge($parsed ?: [], array_filter($cli_parsed));
        }
    }

    if ($parsed) {
        if (!empty($parsed['duration'])) {
            $res['duration'] = round($parsed['duration'], 1);
            $res['duration_formatted'] = format_media_duration($parsed['duration']);
        }
        if (!empty($parsed['width']) && !empty($parsed['height'])) {
            $res['width'] = $parsed['width'];
            $res['height'] = $parsed['height'];
            $res['resolution'] = $parsed['width'] . ' × ' . $parsed['height'] . ' px';
            if (function_exists('compute_aspect_ratio')) {
                $res['aspect_ratio'] = compute_aspect_ratio($parsed['width'], $parsed['height']);
            }
        }
        if (!empty($parsed['codec'])) {
            $res['codec'] = $parsed['codec'];
        }
    }

    // Default container codec hints if codec wasn't detected from stream
    if (empty($res['codec'])) {
        $default_codecs = [
            'mp4'  => 'H.264 / AAC (AVC)',
            'webm' => 'VP8 / VP9 / Opus',
            'mov'  => 'QuickTime (ProRes / H.264)',
            'mkv'  => 'Matroska Video Container',
            'avi'  => 'Audio Video Interleave',
            'ogv'  => 'Ogg Theora'
        ];
        $res['codec'] = $default_codecs[$ext_clean] ?? strtoupper($ext_clean);
    }

    return $res;
}
