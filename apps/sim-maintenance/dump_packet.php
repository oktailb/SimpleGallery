<?php
/**
 * Hex and Field Inspector for live Indra FFS UDP packet
 * Usage: php dump_packet.php [HOST_IP] [LOCAL_PORT] [HOST_PORT]
 */
$cfgFile = __DIR__ . '/config.json';
$cfg = file_exists($cfgFile) ? json_decode(file_get_contents($cfgFile), true) : [];

$hostIp    = $argv[1] ?? ($cfg['sim_host_ip'] ?? '172.120.1.3');
$localPort = (int)($argv[2] ?? ($cfg['sim_local_port'] ?? 3032));
$hostPort  = (int)($argv[3] ?? ($cfg['sim_host_port'] ?? 3035));

echo "====================================================================\n";
echo " DUMP TÉLÉMÉTRIE INDRA FFS (EC135 - st_OUT)\n";
echo "====================================================================\n";
echo " [CONFIG] Host IP    : {$hostIp}\n";
echo " [CONFIG] Local Port : {$localPort}\n";
echo " [CONFIG] Host Port  : {$hostPort}\n";
echo "====================================================================\n\n";

$sock = @stream_socket_server("udp://0.0.0.0:{$localPort}", $errno, $errstr, STREAM_SERVER_BIND);
if (!$sock) {
    echo "[ERREUR BIND] Impossible de lier 0.0.0.0:{$localPort} : [{$errno}] {$errstr}\n";
    echo "Un autre processus (ex: udp_bridge.php) utilise peut-être ce port.\n";
    echo "Essai avec un socket client d'envoi/réception direct...\n";
    $sock = @stream_socket_client("udp://{$hostIp}:{$hostPort}", $errno, $errstr, 1.0);
    if (!$sock) {
        echo "[ERREUR FATALE] Impossible d'ouvrir le socket : $errstr\n";
        exit(1);
    }
}
stream_set_blocking($sock, false);

// Stimulate
@stream_socket_sendto($sock, chr(0), 0, "{$hostIp}:{$hostPort}");
@stream_socket_sendto($sock, str_repeat(chr(0), 88), 0, "{$hostIp}:{$hostPort}");

echo "Écoute du paquet UDP en provenance de {$hostIp}...\n";

$t0 = microtime(true);
$raw = null;
$peerSender = '';
while ((microtime(true) - $t0) < 4.0) {
    $peer = '';
    $d = @stream_socket_recvfrom($sock, 8192, 0, $peer);
    if ($d !== false && strlen($d) > 0) {
        $raw = $d;
        $peerSender = $peer;
        break;
    }
    usleep(5000);
}
@fclose($sock);

if (!$raw) {
    echo "-> Aucun paquet direct reçu en 4s.\n";
    $latest = __DIR__ . '/latest_telemetry.json';
    if (file_exists($latest)) {
        echo "-> Lecture du cache latest_telemetry.json existant :\n";
        echo file_get_contents($latest) . "\n";
    }
    exit(0);
}

require_once __DIR__ . '/TelemetrySchema.php';

$len = strlen($raw);
echo "\n[SUCCÈS] Paquet reçu de {$len} octets depuis [{$peerSender}]\n\n";

$decoded = TelemetrySchema::decode($raw, $peerSender, $hostIp, $localPort);
echo json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
echo "\n====================================================================\n";
