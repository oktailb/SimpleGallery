<?php
/**
 * Daemon UDP Bridge - Indra FFS (EC135)
 * Continuous 50 Hz background receiver with dynamic fgfs_invis.xml schema decoding.
 */
require_once __DIR__ . '/TelemetrySchema.php';

$cfgFile = __DIR__ . '/config.json';
$cfg = file_exists($cfgFile) ? json_decode(file_get_contents($cfgFile), true) : [];

$hostIp    = $argv[1] ?? ($cfg['sim_host_ip'] ?? '172.120.1.3');
$localPort = (int)($argv[2] ?? ($cfg['sim_local_port'] ?? 3032));
$hostPort  = (int)($argv[3] ?? ($cfg['sim_host_port'] ?? 3035));

$dataFile = __DIR__ . '/latest_telemetry.json';
$lockFile = __DIR__ . '/udp_bridge.lock';

// Single-instance protection
$lockFp = @fopen($lockFile, 'c+');
if (!$lockFp || !@flock($lockFp, LOCK_EX | LOCK_NB)) {
    // Another daemon instance is already active
    exit(0);
}
@ftruncate($lockFp, 0);
@fwrite($lockFp, (string)getmypid());

$ctx = stream_context_create([
    'socket' => [
        'so_reuseaddr' => true
    ]
]);

$socket = @stream_socket_server("udp://0.0.0.0:{$localPort}", $errno, $errstr, STREAM_SERVER_BIND, $ctx);
if (!$socket) {
    echo "ERROR: Cannot bind to 0.0.0.0:{$localPort} - [$errno] $errstr\n";
    exit(1);
}

stream_set_blocking($socket, false);

$scriptMtime = filemtime(__FILE__);
$schemaMtime = file_exists(__DIR__ . '/fgfs_invis.xml') ? filemtime(__DIR__ . '/fgfs_invis.xml') : 0;
$telemetryClassMtime = file_exists(__DIR__ . '/TelemetrySchema.php') ? filemtime(__DIR__ . '/TelemetrySchema.php') : 0;
$lastStim = 0;
$pktCount = 0;
$lastWrite = 0;
$lastMtimeCheck = 0;

while (true) {
    $now = microtime(true);

    // Auto-reload if script, schema, or TelemetrySchema.php was updated
    if (($now - $lastMtimeCheck) >= 2.0) {
        $lastMtimeCheck = $now;
        @clearstatcache(true, __FILE__);
        if (file_exists(__FILE__) && filemtime(__FILE__) > $scriptMtime) {
            exit(0);
        }
        if (file_exists(__DIR__ . '/fgfs_invis.xml') && filemtime(__DIR__ . '/fgfs_invis.xml') > $schemaMtime) {
            exit(0);
        }
        if (file_exists(__DIR__ . '/TelemetrySchema.php') && filemtime(__DIR__ . '/TelemetrySchema.php') > $telemetryClassMtime) {
            exit(0);
        }
    }

    // Heartbeat every 100ms (10 Hz stimulation)
    if (($now - $lastStim) >= 0.1) {
        $lastStim = $now;
        @stream_socket_sendto($socket, chr(0), 0, "{$hostIp}:{$hostPort}");
        @stream_socket_sendto($socket, str_repeat(chr(0), 88), 0, "{$hostIp}:{$hostPort}");
        if ($hostPort !== 3033) {
            @stream_socket_sendto($socket, chr(0), 0, "{$hostIp}:3033");
            @stream_socket_sendto($socket, str_repeat(chr(0), 88), 0, "{$hostIp}:3033");
        }
    }

    $peer = '';
    $data = @stream_socket_recvfrom($socket, 8192, 0, $peer);

    if ($data !== false && strlen($data) > 0) {
        $pktCount++;
        
        // Decode dynamically via master XML Schema engine
        $payload = TelemetrySchema::decode($data, $peer, $hostIp, $localPort);

        // Atomic write to latest_telemetry.json (throttled at max 50 Hz, min 5ms between writes)
        if (($now - $lastWrite) >= 0.010) {
            $lastWrite = $now;
            $tmp = $dataFile . '.tmp.' . getmypid();
            @file_put_contents($tmp, json_encode($payload));
            @chmod($tmp, 0666);
            @rename($tmp, $dataFile);
            @chmod($dataFile, 0666);
        }
    } else {
        // Sleep 1ms to prevent busy CPU loop
        usleep(1000);
    }
}
