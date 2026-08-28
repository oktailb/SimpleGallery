<?php
/**
 * Test & Diagnostic Script: Pure Read-Only UDP Sniffer for st_IN (Port 3035 / Interlocks Doors)
 * STRICTLY READ-ONLY: Never writes or transmits anything to the network.
 * 
 * Usage:
 *   php ./webos/apps/sim-maintenance/test_listen_st_in.php [port]
 *   (Default port: 3035)
 */

$port = isset($argv[1]) ? (int)$argv[1] : 3035;

echo "====================================================================\n";
echo "   EC135 FFS - PURE READ-ONLY UDP SNIFFER (st_IN / INTERLOCKS)\n";
echo "   Listening on 0.0.0.0:{$port} (SO_REUSEADDR enabled)\n";
echo "   NO DATA WILL BE SENT / WRITTEN TO THE NETWORK.\n";
echo "====================================================================\n\n";

$ctx = stream_context_create([
    'socket' => [
        'so_reuseaddr' => true,
        'so_reuseport' => true
    ]
]);

$socket = @stream_socket_server("udp://0.0.0.0:{$port}", $errno, $errstr, STREAM_SERVER_BIND, $ctx);
if (!$socket) {
    echo "[-] Cannot bind to 0.0.0.0:{$port} - [$errno] $errstr\n";
    echo "    (The port might be exclusively bound without SO_REUSEPORT)\n";
    exit(1);
}

stream_set_blocking($socket, false);
echo "[+] Successfully bound to UDP port {$port}. Waiting for incoming packets...\n";
echo "    Press Ctrl+C to stop.\n\n";

$doorNames = [
    0  => 'SPACER      (Passerelle)',
    1  => 'RH DOME     (Dôme Droit)',
    2  => 'LH DOME     (Dôme Gauche)',
    3  => 'ROOF        (Trappe Toit)',
    4  => 'EM.AFT      (Issue Secours Arrière)',
    5  => 'EM.BAL      (Issue Secours Balcon)',
    6  => 'UP PROJ.    (Trappe Projecteurs)',
    7  => 'PERIMETER   (Portillon Fosse)',
    8  => 'AFT CAB     (Porte Arrière Cabine)',
    9  => 'BALCONY     (Porte Balcon)',
    10 => 'RAMP P.     (Patins Rampe)'
];

$pktCount = 0;
$startTime = microtime(true);

while (true) {
    $peer = '';
    $raw = @stream_socket_recvfrom($socket, 65535, 0, $peer);

    if ($raw !== false && strlen($raw) > 0) {
        $pktCount++;
        $len = strlen($raw);
        $now = date('H:i:s') . sprintf('.%03d', (microtime(true) - floor(microtime(true))) * 1000);

        echo "--------------------------------------------------------------------\n";
        echo "[{$now}] Packet #{$pktCount} received from {$peer} | Length: {$len} bytes\n";

        // Check if length matches st_IN (7314 bytes or similar)
        if ($len >= 7303) {
            $offset = 7292; // Offset of JAP_INTERLOCKS_IN
            $sub = substr($raw, $offset, 11);
            $bytes = array_values(unpack('C*', $sub));

            echo "\n>>> [INTERLOCKS DOORS PANEL (JAP_INTERLOCKS_IN at offset {$offset})] <<<\n";
            foreach ($doorNames as $idx => $name) {
                $val = $bytes[$idx] ?? 0;
                $statusStr = ($val === 1) ? "\033[32m[ 1 - CLOSED (VERT)  ]\033[0m" : "\033[31m[ 0 - OPEN   (ROUGE) ]\033[0m";
                echo sprintf("  %-36s : %s\n", $name, $statusStr);
            }

            // Also check warning temps (offset 7303, 9 bytes)
            if ($len >= 7312) {
                $subTemp = substr($raw, 7303, 9);
                $tempBytes = array_values(unpack('C*', $subTemp));
                $tempNames = ['Cockpit Nose', 'Spacer Racks', 'CE2 Rack', 'VP Projectors', 'Up Projectors', 'Process Rack', 'Visual Racks', 'Debriefing Rack', 'Common RTN'];
                echo "\n>>> [TEMPERATURE WARNINGS (st_warningTempIn at offset 7303)] <<<\n";
                foreach ($tempNames as $tIdx => $tName) {
                    $tVal = $tempBytes[$tIdx] ?? 0;
                    $tStr = ($tVal === 1) ? "\033[31m[ ALARM / OVERHEAT ]\033[0m" : "\033[32m[ NOMINAL          ]\033[0m";
                    echo sprintf("  %-25s : %s\n", $tName, $tStr);
                }
            }
        } else {
            echo "  Raw preview (first 32 bytes): " . bin2hex(substr($raw, 0, 32)) . "...\n";
            echo "  (Packet size {$len} < 7303 bytes for full st_IN decoding)\n";
        }

        echo "--------------------------------------------------------------------\n\n";
    }

    usleep(10000); // 10ms poll
}
