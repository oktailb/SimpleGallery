<?php
/**
 * SimpleGallery 2026 - Archive Metadata Extractor Module
 * Zero-dependency pure PHP parser for ZIP and Compressed Archive inspections.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

/**
 * Extracts ZIP archive statistics and file sample using native ZipArchive
 */
function parse_zip_metadata(string $file_path): ?array {
    if (!class_exists('ZipArchive')) return null;

    $zip = new ZipArchive();
    $res = $zip->open($file_path, ZipArchive::RDONLY);
    if ($res !== true) return null;

    $num_files = $zip->numFiles;
    $total_uncompressed = 0;
    $total_compressed = 0;
    $sample_files = [];

    for ($i = 0; $i < $num_files; $i++) {
        $stat = $zip->statIndex($i);
        if ($stat) {
            $total_uncompressed += (int)($stat['size'] ?? 0);
            $total_compressed += (int)($stat['comp_size'] ?? 0);

            if (count($sample_files) < 10) {
                $is_dir = (substr($stat['name'], -1) === '/');
                $sample_files[] = [
                    'name'           => $stat['name'],
                    'size'           => (int)($stat['size'] ?? 0),
                    'size_formatted' => function_exists('format_bytes') ? format_bytes((int)($stat['size'] ?? 0)) : (int)$stat['size'] . ' B',
                    'is_dir'         => $is_dir
                ];
            }
        }
    }
    $zip->close();

    $ratio = 0;
    if ($total_uncompressed > 0) {
        $ratio = round((1.0 - ($total_compressed / $total_uncompressed)) * 100);
        $ratio = max(0, min(100, $ratio));
    }

    return [
        'files_count'                => $num_files,
        'uncompressed_size'          => $total_uncompressed,
        'uncompressed_size_formatted'=> function_exists('format_bytes') ? format_bytes($total_uncompressed) : $total_uncompressed . ' B',
        'compression_ratio'          => $ratio . '%',
        'files_sample'               => $sample_files
    ];
}

/**
 * Extracts complete archive metadata
 */
function extract_archive_metadata(string $file_path, string $ext): array {
    $ext_clean = strtolower($ext);
    $res = [
        'archive_type'               => strtoupper($ext_clean),
        'files_count'                => null,
        'uncompressed_size'          => null,
        'uncompressed_size_formatted'=> null,
        'compression_ratio'          => null,
        'files_sample'               => []
    ];

    if ($ext_clean === 'zip') {
        $zip_data = parse_zip_metadata($file_path);
        if ($zip_data) {
            $res['files_count'] = $zip_data['files_count'];
            $res['uncompressed_size'] = $zip_data['uncompressed_size'];
            $res['uncompressed_size_formatted'] = $zip_data['uncompressed_size_formatted'];
            $res['compression_ratio'] = $zip_data['compression_ratio'];
            $res['files_sample'] = $zip_data['files_sample'];
        }
    }

    return $res;
}
