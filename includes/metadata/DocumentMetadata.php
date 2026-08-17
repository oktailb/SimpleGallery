<?php
/**
 * SimpleGallery 2026 - Document Metadata Extractor Module
 * Zero-dependency pure PHP parser for PDF headers, Text, and Markdown statistics.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

/**
 * Extracts PDF document metadata (pages, version, title, author)
 */
function parse_pdf_metadata(string $file_path): ?array {
    $fh = @fopen($file_path, 'rb');
    if (!$fh) return null;

    $header = fread($fh, 1024);
    if (!preg_match('/%PDF-([0-9.]+)/', $header, $v_match)) {
        fclose($fh);
        return null;
    }
    $pdf_version = 'PDF ' . $v_match[1];

    $file_size = filesize($file_path);
    $scan_size = min($file_size, 1024 * 1024 * 4); // Scan up to 4MB
    fseek($fh, 0, SEEK_SET);
    $content = fread($fh, $scan_size);

    // Also read the trailer / end of PDF where Info dictionary often sits
    if ($file_size > $scan_size) {
        fseek($fh, -min($file_size, 1024 * 128), SEEK_END);
        $content .= fread($fh, 1024 * 128);
    }
    fclose($fh);

    // Count pages via /Count or /Type /Page
    $page_count = null;
    if (preg_match_all('/\/Count\s+(\d+)/i', $content, $c_matches)) {
        $page_count = (int)max($c_matches[1]);
    }
    if ($page_count === null || $page_count === 0) {
        $page_count = preg_match_all('/\/Type\s*\/Page[^s]/i', $content);
    }

    $get_pdf_info_field = function(string $field) use ($content) {
        if (preg_match('/\/' . $field . '\s*\(([^)]+)\)/i', $content, $m)) {
            return trim($m[1]);
        }
        return null;
    };

    return [
        'pdf_version' => $pdf_version,
        'pages'       => $page_count > 0 ? $page_count : null,
        'title'       => $get_pdf_info_field('Title'),
        'author'      => $get_pdf_info_field('Author'),
        'creator'     => $get_pdf_info_field('Creator') ?? $get_pdf_info_field('Producer')
    ];
}

/**
 * Extracts plain text or markdown statistics
 */
function parse_text_metadata(string $file_path): ?array {
    $file_size = filesize($file_path);
    if ($file_size > 1024 * 1024 * 10) { // Limit to 10MB
        return null;
    }

    $content = @file_get_contents($file_path);
    if ($content === false) return null;

    $encoding = 'UTF-8';
    if (function_exists('mb_detect_encoding')) {
        $enc = @mb_detect_encoding($content, ['UTF-8', 'ISO-8859-1', 'Windows-1252', 'ASCII'], true);
        if ($enc) $encoding = $enc;
    }

    $lines = substr_count($content, "\n") + 1;
    $words = function_exists('str_word_count') ? @str_word_count(strip_tags($content)) : null;
    $chars = strlen($content);

    return [
        'lines_count' => $lines,
        'words_count' => $words,
        'chars_count' => $chars,
        'encoding'    => $encoding
    ];
}

/**
 * Extracts complete document metadata
 */
function extract_document_metadata(string $file_path, string $ext): array {
    $ext_clean = strtolower($ext);
    $res = [
        'doc_type'     => strtoupper($ext_clean),
        'pages'        => null,
        'pdf_version'  => null,
        'title'        => null,
        'author'       => null,
        'creator'      => null,
        'lines_count'  => null,
        'words_count'  => null,
        'encoding'     => null
    ];

    if ($ext_clean === 'pdf') {
        $pdf = parse_pdf_metadata($file_path);
        if ($pdf) {
            $res['pages'] = $pdf['pages'];
            $res['pdf_version'] = $pdf['pdf_version'];
            $res['title'] = $pdf['title'];
            $res['author'] = $pdf['author'];
            $res['creator'] = $pdf['creator'];
        }
    } elseif (in_array($ext_clean, ['txt', 'md', 'json', 'xml', 'csv', 'log', 'css', 'js', 'php', 'html'], true)) {
        $txt = parse_text_metadata($file_path);
        if ($txt) {
            $res['lines_count'] = $txt['lines_count'];
            $res['words_count'] = $txt['words_count'];
            $res['encoding'] = $txt['encoding'];
        }
    }

    return $res;
}
