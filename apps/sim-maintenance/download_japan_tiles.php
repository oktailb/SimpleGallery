<?php
/**
 * Offline Map Tile Downloader for EC135 FFS Tactical Moving Map
 * 
 * Usage:
 *   php download_japan_tiles.php [preset] [provider] [max_zoom]
 * 
 * Presets:
 *   1. kanto_tokyo   : Tokyo, Haneda, Narita, Chiba, Kanagawa (Default)
 *   2. japan_overview: Entire Japan at zoom levels 5 to 9 (~20 MB)
 *   3. fuji_area     : Mount Fuji & Shizuoka / Yamanashi flight zones
 *   4. custom        : Specify minLat, minLon, maxLat, maxLon, minZoom, maxZoom
 * 
 * Providers:
 *   - osm     : OpenStreetMap Standard (https://tile.openstreetmap.org/{z}/{x}/{y}.png)
 *   - carto   : CartoDB Dark Matter (https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png)
 *   - topo    : OpenTopoMap Relief (https://tile.opentopomap.org/{z}/{x}/{y}.png)
 */

$preset   = $argv[1] ?? 'japan_overview';
$provider = $argv[2] ?? 'osm';
$maxZoomCli = isset($argv[3]) ? (int)$argv[3] : null;

$presets = [
    'japan_overview' => [
        'name'    => 'Entire Japan Overview (Hokkaido to Okinawa)',
        'minLat'  => 24.0,
        'maxLat'  => 46.0,
        'minLon'  => 122.0,
        'maxLon'  => 146.0,
        'minZoom' => 5,
        'maxZoom' => $maxZoomCli ?? 10,
    ],
    'kansai_kobe' => [
        'name'    => 'Kansai, Kobe Airport & Osaka Bay Area (RJBE / RJBB / RJOO)',
        'minLat'  => 33.2,
        'maxLat'  => 36.2,
        'minLon'  => 133.8,
        'maxLon'  => 136.8,
        'minZoom' => 5,
        'maxZoom' => $maxZoomCli ?? 19,
    ],
    'kanto_tokyo' => [
        'name'    => 'Kanto & Tokyo Metropolitan Area (HND / NRT / RJTF / RJTI)',
        'minLat'  => 35.0,
        'maxLat'  => 36.3,
        'minLon'  => 138.8,
        'maxLon'  => 140.6,
        'minZoom' => 7,
        'maxZoom' => $maxZoomCli ?? 19,
    ],
    'rjbe_kobe_airport' => [
        'name'    => 'Kobe Airport (RJBE) High-Res Runway, Taxiways & Helipads',
        'minLat'  => 34.615,
        'maxLat'  => 34.660,
        'minLon'  => 135.200,
        'maxLon'  => 135.270,
        'minZoom' => 12,
        'maxZoom' => $maxZoomCli ?? 19,
    ],
    'fuji_area' => [
        'name'    => 'Mount Fuji & Shizuoka Training Valley Area',
        'minLat'  => 35.1,
        'maxLat'  => 35.6,
        'minLon'  => 138.5,
        'maxLon'  => 139.1,
        'minZoom' => 8,
        'maxZoom' => $maxZoomCli ?? 19,
    ]
];

if (!isset($presets[$preset])) {
    echo "[-] Unknown preset '{$preset}'. Available presets:\n";
    foreach ($presets as $k => $p) {
        echo "    - {$k} : {$p['name']} (Zoom {$p['minZoom']} to {$p['maxZoom']})\n";
    }
    exit(1);
}

$cfg = $presets[$preset];

$providers = [
    'osm'       => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    'satellite' => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    'topo'      => 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    'carto'     => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
];

$tileUrlPattern = $providers[$provider] ?? $providers['carto'];
$outputBaseDir  = __DIR__ . DIRECTORY_SEPARATOR . 'tiles';

echo "====================================================================\n";
echo "   EC135 FFS - OFFLINE MAP TILE DOWNLOADER\n";
echo "   Preset   : {$preset} ({$cfg['name']})\n";
echo "   Provider : {$provider} ({$tileUrlPattern})\n";
echo "   Bounds   : Lat [{$cfg['minLat']}, {$cfg['maxLat']}] | Lon [{$cfg['minLon']}, {$cfg['maxLon']}]\n";
echo "   Zooms    : Level {$cfg['minZoom']} to {$cfg['maxZoom']}\n";
echo "   Output   : {$outputBaseDir}\n";
echo "====================================================================\n\n";

ini_set('memory_limit', '512M');

function latLonToTile($lat, $lon, $zoom) {
    $latRad = deg2rad($lat);
    $n = pow(2, $zoom);
    $x = (int)(($lon + 180.0) / 360.0 * $n);
    $y = (int)((1.0 - asinh(tan($latRad)) / M_PI) / 2.0 * $n);
    return [max(0, min($n - 1, $x)), max(0, min($n - 1, $y))];
}

// 1. Calculate total tile count without consuming memory
$totalTiles = 0;
for ($z = $cfg['minZoom']; $z <= $cfg['maxZoom']; $z++) {
    list($minX, $maxY) = latLonToTile($cfg['minLat'], $cfg['minLon'], $z);
    list($maxX, $minY) = latLonToTile($cfg['maxLat'], $cfg['maxLon'], $z);
    $countX = abs($maxX - $minX) + 1;
    $countY = abs($maxY - $minY) + 1;
    $totalTiles += ($countX * $countY);
}

echo "[+] Total tiles to process: {$totalTiles}\n";
echo "[+] Starting download stream...\n\n";

$downloaded = 0;
$skipped    = 0;
$errors     = 0;
$processed  = 0;

$context = stream_context_create([
    'http' => [
        'header'  => "User-Agent: EC135-FFS-Maintenance-TileSync/1.0 (admin@sim.local)\r\n",
        'timeout' => 5
    ]
]);

$force = in_array('--force', $argv) || in_array('-f', $argv) || ($provider !== 'carto');

// 2. Stream download directly on-the-fly (Zero RAM overhead)
for ($z = $cfg['minZoom']; $z <= $cfg['maxZoom']; $z++) {
    list($minX, $maxY) = latLonToTile($cfg['minLat'], $cfg['minLon'], $z);
    list($maxX, $minY) = latLonToTile($cfg['maxLat'], $cfg['maxLon'], $z);

    for ($x = min($minX, $maxX); $x <= max($minX, $maxX); $x++) {
        $targetDir = $outputBaseDir . DIRECTORY_SEPARATOR . $z . DIRECTORY_SEPARATOR . $x;
        if (!is_dir($targetDir)) {
            @mkdir($targetDir, 0777, true);
        }

        for ($y = min($minY, $maxY); $y <= max($minY, $maxY); $y++) {
            $processed++;
            $targetFile = $targetDir . DIRECTORY_SEPARATOR . $y . '.png';

            if (!$force && file_exists($targetFile) && filesize($targetFile) > 100) {
                $skipped++;
            } else {
                $url = str_replace(['{z}', '{x}', '{y}'], [$z, $x, $y], $tileUrlPattern);
                $data = @file_get_contents($url, false, $context);
                if ($data !== false && strlen($data) > 100) {
                    file_put_contents($targetFile, $data);
                    $downloaded++;
                } else {
                    $errors++;
                }
                usleep(25000); // 25ms throttle
            }

            if ($processed % 25 === 0 || $processed === $totalTiles) {
                $pct = round(($processed / $totalTiles) * 100, 1);
                echo "  -> Progress: {$pct}% ({$processed}/{$totalTiles}) | DL: {$downloaded} | Cached: {$skipped} | Errors: {$errors}\r";
            }
        }
    }
}

// 3. Download local standalone Leaflet bundle (JS & CSS) for 100% offline support
$libDir = __DIR__ . DIRECTORY_SEPARATOR . 'lib';
if (!is_dir($libDir)) @mkdir($libDir, 0777, true);

$leafletJs  = @file_get_contents('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', false, $context);
$leafletCss = @file_get_contents('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', false, $context);

if ($leafletJs && strlen($leafletJs) > 1000) {
    file_put_contents($libDir . DIRECTORY_SEPARATOR . 'leaflet.js', $leafletJs);
}
if ($leafletCss && strlen($leafletCss) > 100) {
    file_put_contents($libDir . DIRECTORY_SEPARATOR . 'leaflet.css', $leafletCss);
}

echo "\n\n====================================================================\n";
echo "   DOWNLOAD COMPLETE!\n";
echo "   Downloaded : {$downloaded} tiles\n";
echo "   Cached/Skipped: {$skipped} tiles\n";
echo "   Errors     : {$errors}\n";
echo "   Tiles stored in: {$outputBaseDir}\n";
echo "====================================================================\n";
