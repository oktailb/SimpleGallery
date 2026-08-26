<?php
/**
 * Script de diagnostic CLI - Communication UDP Simulateur Indra FFS (EC135)
 * Usage: php test_indra_connection.php [HOST_IP] [LOCAL_PORT] [HOST_PORT]
 * Exemple: php test_indra_connection.php 172.120.1.3 3033 3034
 */

// 1. Chargement de la configuration
$cfgFile = __DIR__ . '/config.json';
$cfg = file_exists($cfgFile) ? json_decode(file_get_contents($cfgFile), true) : [];

$hostIp    = $argv[1] ?? ($cfg['sim_host_ip'] ?? '172.120.1.3');
$localPort = (int)($argv[2] ?? ($cfg['sim_local_port'] ?? 3033));
$hostPort  = (int)($argv[3] ?? ($cfg['sim_host_port'] ?? 3034));

echo "====================================================================\n";
echo " DIAGNOSTIC DE CONNEXION INDRA FFS (EC135 - st_OUT)\n";
echo "====================================================================\n";
echo " [CONFIG] Host IP    : {$hostIp}\n";
echo " [CONFIG] Local Port : {$localPort} (écoute client)\n";
echo " [CONFIG] Host Port  : {$hostPort} (port cible simulateur)\n";
echo "====================================================================\n\n";

// Étape 1 : Test de connectivité Réseau (Ping ICMP)
echo "[ÉTAPE 1/4] Test de joignabilité réseau (Ping vers {$hostIp})...\n";
$isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
$pingCmd = $isWindows ? "ping -n 2 -w 1000 {$hostIp}" : "ping -c 2 -W 1 {$hostIp}";
exec($pingCmd, $pingOutput, $pingRet);

if ($pingRet === 0) {
    echo "  -> [SUCCÈS] L'hôte {$hostIp} répond au ping !\n";
} else {
    echo "  -> [AVERTISSEMENT] L'hôte {$hostIp} ne répond pas au ping.\n";
    echo "     Vérifiez que votre câble/Wi-Fi est bien sur le sous-réseau 172.120.1.x.\n";
}
echo "\n";

// Étape 2 : Ouverture du socket UDP local
echo "[ÉTAPE 2/4] Création et liaison du socket UDP local (0.0.0.0:{$localPort})...\n";
$ctx = stream_context_create([
    'socket' => [
        'so_reuseaddr' => true
    ]
]);

$errno = 0;
$errstr = '';
$socket = @stream_socket_server("udp://0.0.0.0:{$localPort}", $errno, $errstr, STREAM_SERVER_BIND, $ctx);

if (!$socket) {
    echo "  -> [ERREUR BIND] Échec de liaison sur 0.0.0.0:{$localPort} : [{$errno}] {$errstr}\n";
    echo "     Le port {$localPort} est peut-être déjà occupé par un autre processus.\n";
    echo "     Essai avec un socket client dynamique...\n";
    $socket = @stream_socket_client("udp://{$hostIp}:{$hostPort}", $errno, $errstr, 1.0);
    if (!$socket) {
        echo "  -> [ERREUR FATALE] Impossible de créer un socket : [{$errno}] {$errstr}\n";
        exit(1);
    }
    echo "  -> [INFO] Socket client UDP ouvert vers {$hostIp}:{$hostPort}.\n";
} else {
    echo "  -> [SUCCÈS] Socket local UDP lié avec succès sur 0.0.0.0:{$localPort}.\n";
}
stream_set_blocking($socket, false);
echo "\n";

// Étape 3 : Envoi des trames de stimulation
echo "[ÉTAPE 3/4] Envoi des trames de stimulation (Heartbeat) vers {$hostIp}:{$hostPort}...\n";

// A. 1 octet nul (stim)
$sent1 = @stream_socket_sendto($socket, chr(0), 0, "{$hostIp}:{$hostPort}");
echo "  -> Trame 1 octet (0x00)          : " . ($sent1 !== false ? "OK ({$sent1} octets envoyés)" : "ÉCHEC") . "\n";

// B. 88 octets nuls (taille struct st_OUT)
$sent88 = @stream_socket_sendto($socket, str_repeat(chr(0), 88), 0, "{$hostIp}:{$hostPort}");
echo "  -> Trame 88 octets (sizeof st_OUT): " . ($sent88 !== false ? "OK ({$sent88} octets envoyés)" : "ÉCHEC") . "\n";

// C. Test d'envoi croisé sur le port local au cas où l'Host écoute sur 3033
if ($hostPort !== $localPort) {
    @stream_socket_sendto($socket, chr(0), 0, "{$hostIp}:{$localPort}");
    @stream_socket_sendto($socket, str_repeat(chr(0), 88), 0, "{$hostIp}:{$localPort}");
    echo "  -> Trame d'envoi miroir sur port {$localPort} : Envoyée\n";
}
echo "\n";

// Étape 4 : Écoute et essai automatique de matrice de ports
echo "[ÉTAPE 4/4] Test de réception en direct...\n";
echo "--------------------------------------------------------------------\n";

$portsToTry = [
    ['local' => 3033, 'host' => 3034],
    ['local' => 3034, 'host' => 3033],
    ['local' => 3033, 'host' => 3033],
    ['local' => 3034, 'host' => 3034],
    ['local' => 3030, 'host' => 3031],
    ['local' => 3032, 'host' => 3035]
];

$unpackDouble = function($bin) {
    if (strlen($bin) < 8) return 0.0;
    $v = unpack('dval', $bin)['val'];
    if (is_nan($v) || is_infinite($v) || abs($v) > 100000) {
        $v = unpack('dval', strrev($bin))['val'];
    }
    return (is_nan($v) || is_infinite($v)) ? 0.0 : $v;
};

$pktCount = 0;

// Test first with specified/configured ports
$t0 = microtime(true);
$lastStim = 0;
while ((microtime(true) - $t0) < 5.0) {
    $now = microtime(true);
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
        $len = strlen($data);
        $elapsed = round(($now - $t0) * 1000, 1);
        if ($pktCount === 1 || ($pktCount % 5 === 0)) {
            echo ">>> [T+{$elapsed}ms] PAQUET #{$pktCount} REÇU ({$len}B) depuis [{$peer}]\n";
            if ($len >= 85) {
                $hdg  = $unpackDouble(substr($data, 18, 8));
                $spd  = $unpackDouble(substr($data, 26, 8));
                $alt  = $unpackDouble(substr($data, 52, 8));
                $nr   = $unpackDouble(substr($data, 77, 8));
                $pit  = $unpackDouble(substr($data, 34, 8));
                $rol  = $unpackDouble(substr($data, 42, 8));
                echo "    Cap: " . round(fmod($hdg+360, 360), 1) . "° | IAS: " . round($spd, 1) . " kts | Alt: " . round($alt, 1) . " ft | Pitch: " . round($pit, 1) . "° | Rotor: " . round($nr, 1) . "%\n";
            }
        }
    }
    usleep(4000);
}
@fclose($socket);

if ($pktCount === 0) {
    echo "  -> Aucun paquet sur Local:{$localPort} / Host:{$hostPort}.\n";
    echo "  -> Test automatique des combinaisons de ports alternatives...\n";

    foreach ($portsToTry as $combo) {
        $lP = $combo['local'];
        $hP = $combo['host'];
        if ($lP === $localPort && $hP === $hostPort) continue;

        $testSock = @stream_socket_server("udp://0.0.0.0:{$lP}", $e1, $e2, STREAM_SERVER_BIND);
        if (!$testSock) continue;
        stream_set_blocking($testSock, false);

        // Send stim variations
        @stream_socket_sendto($testSock, chr(0), 0, "{$hostIp}:{$hP}");
        @stream_socket_sendto($testSock, str_repeat(chr(0), 88), 0, "{$hostIp}:{$hP}");
        @stream_socket_sendto($testSock, str_repeat(chr(0), 1024), 0, "{$hostIp}:{$hP}");

        $tSub = microtime(true);
        while ((microtime(true) - $tSub) < 0.6) {
            $peer = '';
            $d = @stream_socket_recvfrom($testSock, 8192, 0, $peer);
            if ($d !== false && strlen($d) > 0) {
                $pktCount++;
                echo "\n>>> COMBINAISON GAGNANTE TROUVÉE !\n";
                echo "    Local Port : {$lP}\n";
                echo "    Host Port  : {$hP}\n";
                echo "    Taille     : " . strlen($d) . " octets depuis [{$peer}]\n";
                if (strlen($d) >= 85) {
                    $hdg = $unpackDouble(substr($d, 18, 8));
                    echo "    Cap décodé : " . round(fmod($hdg+360, 360), 1) . "°\n";
                }
                echo "    --> Mettez à jour config.json avec : \"sim_local_port\": {$lP}, \"sim_host_port\": {$hP}\n";
                fclose($testSock);
                break 2;
            }
            usleep(4000);
        }
        fclose($testSock);
    }
}

echo "\n====================================================================\n";
echo " RÉSULTAT DU TEST\n";
echo "====================================================================\n";
if ($pktCount > 0) {
    echo " [SUCCÈS] {$pktCount} paquets st_OUT ont été reçus et décodés avec succès !\n";
} else {
    echo " [ÉCHEC] 0 paquet reçu en 5 secondes.\n";
    echo " Pistes à tester :\n";
    echo "  1. Tester l'inversion des ports :\n";
    echo "     php test_indra_connection.php {$hostIp} 3034 3033\n";
    echo "  2. Tester le même port en local et distant :\n";
    echo "     php test_indra_connection.php {$hostIp} 3033 3033\n";
}
echo "====================================================================\n";
