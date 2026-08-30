<?php
/**
 * SimpleGallery 2026 - Audio Metadata Extractor Module
 * Zero-dependency pure PHP parser for ID3v1/ID3v2 tags and RIFF WAV headers.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

/**
 * Parses ID3v1 tags from the last 128 bytes of an MP3 file
 */
function parse_id3v1(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    if (fseek($fh, -128, SEEK_END) !== 0) {
        fclose($fh);
        return null;
    }

    $tag_data = fread($fh, 128);
    fclose($fh);

    if (strlen($tag_data) === 128 && substr($tag_data, 0, 3) === 'TAG') {
        $clean = function(string $str) {
            $s = trim(str_replace("\0", '', $str));
            return @mb_convert_encoding($s, 'UTF-8', 'ISO-8859-1, UTF-8, Windows-1252');
        };

        return [
            'title'   => $clean(substr($tag_data, 3, 30)),
            'artist'  => $clean(substr($tag_data, 33, 30)),
            'album'   => $clean(substr($tag_data, 63, 30)),
            'year'    => trim(substr($tag_data, 93, 4)),
            'comment' => $clean(substr($tag_data, 97, 28))
        ];
    }

    return null;
}

/**
 * Parses common ID3v2 tags (TIT2, TPE1, TALB, TDRC/TYER, TCON) from header
 */
function parse_id3v2(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    $header = fread($fh, 10);
    if (strlen($header) < 10 || substr($header, 0, 3) !== 'ID3') {
        fclose($fh);
        return null;
    }

    $ver_major = ord($header[3]);
    // Read synchsafe integer for ID3v2 tag size
    $b0 = ord($header[6]);
    $b1 = ord($header[7]);
    $b2 = ord($header[8]);
    $b3 = ord($header[9]);
    $tag_size = ($b0 << 21) | ($b1 << 14) | ($b2 << 7) | $b3;

    if ($tag_size <= 0 || $tag_size > 1024 * 1024 * 5) {
        fclose($fh);
        return null;
    }

    $data = fread($fh, min($tag_size, 1024 * 256));
    fclose($fh);

    $tags = [];
    $pos = 0;
    $len = strlen($data);

    while ($pos + 10 < $len) {
        $frame_id = substr($data, $pos, 4);
        if (!preg_match('/^[A-Z0-9]{4}$/', $frame_id)) break;

        if ($ver_major === 4) {
            $f_size = (ord($data[$pos+4]) << 21) | (ord($data[$pos+5]) << 14) | (ord($data[$pos+6]) << 7) | ord($data[$pos+7]);
        } else {
            $f_size = unpack('N', substr($data, $pos + 4, 4))[1] ?? 0;
        }

        if ($f_size <= 0 || $pos + 10 + $f_size > $len) break;

        $frame_content = substr($data, $pos + 10, $f_size);
        $encoding = ord($frame_content[0] ?? "\0");
        $raw_text = substr($frame_content, 1);

        $text = '';
        if ($encoding === 1 || $encoding === 2) { // UTF-16
            $text = @mb_convert_encoding($raw_text, 'UTF-8', 'UTF-16');
        } else {
            $text = @mb_convert_encoding($raw_text, 'UTF-8', 'ISO-8859-1, UTF-8, Windows-1252');
        }
        $text = trim(str_replace("\0", '', (string)$text));

        if ($text !== '') {
            if ($frame_id === 'TIT2') $tags['title'] = $text;
            elseif ($frame_id === 'TPE1' || $frame_id === 'TPE2') $tags['artist'] = $text;
            elseif ($frame_id === 'TALB') $tags['album'] = $text;
            elseif ($frame_id === 'TYER' || $frame_id === 'TDRC') $tags['year'] = substr($text, 0, 4);
            elseif ($frame_id === 'TCON') $tags['genre'] = $text;
        }

        $pos += 10 + $f_size;
    }

    return !empty($tags) ? $tags : null;
}

/**
 * Parses RIFF WAV audio header
 */
function parse_wav_header(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    $header = fread($fh, 44);
    fclose($fh);

    if (strlen($header) >= 44 && substr($header, 0, 4) === 'RIFF' && substr($header, 8, 4) === 'WAVE') {
        $channels = unpack('v', substr($header, 22, 2))[1] ?? 1;
        $sample_rate = unpack('V', substr($header, 24, 4))[1] ?? 44100;
        $byte_rate = unpack('V', substr($header, 28, 4))[1] ?? 0;
        $bits_per_sample = unpack('v', substr($header, 34, 2))[1] ?? 16;
        $file_size = filesize($file_path);

        $duration = null;
        if ($byte_rate > 0 && $file_size > 44) {
            $duration = ($file_size - 44) / (float)$byte_rate;
        }

        return [
            'channels'        => ($channels === 2) ? 'Stereo (2.0)' : (($channels === 1) ? 'Mono (1.0)' : "$channels ch"),
            'sample_rate'     => ($sample_rate / 1000.0) . ' kHz',
            'bits_per_sample' => $bits_per_sample . ' bits',
            'duration'        => $duration ? round($duration, 1) : null,
            'duration_formatted' => $duration ? format_media_duration($duration) : null,
            'bitrate'         => $byte_rate ? round(($byte_rate * 8) / 1000) . ' kbps' : null
        ];
    }

    return null;
}

/**
 * Extracts complete audio metadata
 */
function extract_audio_metadata(string $file_path, string $ext): array {
    $ext_clean = strtolower($ext);
    $res = [
        'format'             => strtoupper($ext_clean),
        'duration'           => null,
        'duration_formatted' => null,
        'sample_rate'        => null,
        'channels'           => null,
        'bitrate'            => null,
        'title'              => null,
        'artist'             => null,
        'album'              => null,
        'year'               => null,
        'genre'              => null
    ];

    if ($ext_clean === 'wav') {
        $wav = parse_wav_header($file_path);
        if ($wav) {
            $res['channels'] = $wav['channels'];
            $res['sample_rate'] = $wav['sample_rate'];
            $res['duration'] = $wav['duration'];
            $res['duration_formatted'] = $wav['duration_formatted'];
            $res['bitrate'] = $wav['bitrate'];
        }
    } elseif ($ext_clean === 'mp3') {
        $id3 = parse_id3v2($file_path) ?? parse_id3v1($file_path);
        if ($id3) {
            $res['title'] = !empty($id3['title']) ? $id3['title'] : null;
            $res['artist'] = !empty($id3['artist']) ? $id3['artist'] : null;
            $res['album'] = !empty($id3['album']) ? $id3['album'] : null;
            $res['year'] = !empty($id3['year']) ? $id3['year'] : null;
            $res['genre'] = !empty($id3['genre']) ? $id3['genre'] : null;
        }

        // Basic MP3 duration estimate (assuming 192kbps if unknown)
        $filesize = filesize($file_path);
        if ($filesize > 0) {
            $est_seconds = ($filesize * 8) / (192 * 1000);
            if ($est_seconds > 0 && $est_seconds < 36000) {
                $res['duration'] = round($est_seconds, 1);
                $res['duration_formatted'] = format_media_duration($est_seconds);
            }
        }
    }

    return $res;
}
