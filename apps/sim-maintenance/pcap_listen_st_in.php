<?php
/**
 * Promiscuous PCAP Stream Reader for st_IN (Port 3033 / 192.168.4.211 -> 192.168.4.3)
 * Pure passive listener via raw packet capture stream.
 */

// Filter all IP frames between Visual/Cockpit (192.168.4.211) and Host (192.168.4.3 / 172.120.1.3)
$cmd = 'tcpdump -n -s 0 -U -w - -i any "ip and (host 192.168.4.3 or host 192.168.4.211 or host 172.120.1.3)" 2>/dev/null';

echo "====================================================================\n";
echo "   EC135 FFS - PASSIVE PCAP STREAM SNIFFER (st_IN / INTERLOCKS)\n";
echo "   Reading from raw capture stream (tcpdump promiscuous mode)\n";
echo "====================================================================\n\n";

$fp = popen($cmd, 'r');
if (!$fp) {
    echo "[-] Cannot start tcpdump process.\n";
    exit(1);
}

// Read Global PCAP Header (24 bytes)
$globalHdr = fread($fp, 24);
if (strlen($globalHdr) < 24) {
    echo "[-] Failed to read PCAP global header.\n";
    exit(1);
}

$magic = unpack('N', substr($globalHdr, 0, 4))[1] ?? 0;
$isLE = ($magic === 0xd4c3b2a1);

echo "[+] Capture stream active! Waiting for st_IN frames...\n";
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
$buffer = '';

while (!feof($fp)) {
    // Read Packet Header (16 bytes)
    $hdr = fread($fp, 16);
    if (strlen($hdr) < 16) break;

    $inclLen = $isLE ? unpack('V', substr($hdr, 8, 4))[1] : unpack('N', substr($hdr, 8, 4))[1];
    if ($inclLen <= 0 || $inclLen > 65535) continue;

    $pktData = '';
    while (strlen($pktData) < $inclLen && !feof($fp)) {
        $chunk = fread($fp, $inclLen - strlen($pktData));
        if ($chunk === false || strlen($chunk) === 0) break;
        $pktData .= $chunk;
    }

    if (strlen($pktData) < $inclLen) continue;

    // Check Linux Cooked Header (SLL - 16 bytes) or Ethernet (14 bytes)
    // SLL has protocol at bytes 14-15 (0x0800 for IP)
    $ipOffset = 16; // default Linux SLL
    if (substr($pktData, 0, 2) === "\x00\x00") {
        $ipOffset = 16;
    } else {
        $ipOffset = 14;
    }

    $ipHeader = substr($pktData, $ipOffset);
    if (strlen($ipHeader) < 20) continue;

    $ipIhl = (ord($ipHeader[0]) & 0x0F) * 4;
    $ipProto = ord($ipHeader[9]);
    $ipId = unpack('n', substr($ipHeader, 4, 2))[1] ?? 0;
    $fragOffset = (unpack('n', substr($ipHeader, 6, 2))[1] & 0x1FFF) * 8;
    $flags = (ord($ipHeader[6]) & 0xE0) >> 5;
    $moreFrags = ($flags & 0x01) === 1;

    $payload = substr($ipHeader, $ipIhl);

    // If initial UDP packet, strip 8-byte UDP header
    if ($fragOffset === 0 && $ipProto === 17) {
        $payload = substr($payload, 8);
        $buffer = $payload;
    } else {
        $buffer .= $payload;
    }

    // When full packet is assembled or large enough
    if (!$moreFrags || strlen($buffer) >= 7300) {
        $pktCount++;
        $len = strlen($buffer);
        $now = date('H:i:s') . sprintf('.%03d', (microtime(true) - floor(microtime(true))) * 1000);

        echo "--------------------------------------------------------------------\n";
        echo "[{$now}] st_IN Frame #{$pktCount} assembled | Total: {$len} bytes (IP ID: {$ipId})\n";

        if ($len >= 7292) {
            $offset = 7292; // JAP_INTERLOCKS_IN
            $sub = substr($buffer, $offset, 11);
            $bytes = array_values(unpack('C*', $sub));

            echo "\n>>> [INTERLOCKS DOORS PANEL (JAP_INTERLOCKS_IN at offset 7292)] <<<\n";
            foreach ($doorNames as $idx => $name) {
                $val = $bytes[$idx] ?? 0;
                $statusStr = ($val === 1) ? "\033[32m[ 1 - CLOSED (VERT)  ]\033[0m" : "\033[31m[ 0 - OPEN   (ROUGE) ]\033[0m";
                echo sprintf("  %-36s : %s\n", $name, $statusStr);
            }

            if ($len >= 7312) {
                $subTemp = substr($buffer, 7303, 9);
                $tempBytes = array_values(unpack('C*', $subTemp));
                $tempNames = ['Cockpit Nose', 'Spacer Racks', 'CE2 Rack', 'VP Projectors', 'Up Projectors', 'Process Rack', 'Visual Racks', 'Debriefing Rack', 'Common RTN'];
                echo "\n>>> [TEMPERATURE WARNINGS (st_warningTempIn at offset 7303)] <<<\n";
                foreach ($tempNames as $tIdx => $tName) {
                    $tVal = $tempBytes[$tIdx] ?? 0;
                    $tStr = ($tVal === 1) ? "\033[31m[ ALARM / OVERHEAT ]\033[0m" : "\033[32m[ NOMINAL          ]\033[0m";
                    echo sprintf("  %-25s : %s\n", $tName, $tStr);
                }
            }
        }
        echo "--------------------------------------------------------------------\n\n";
        $buffer = '';
    }
}

pclose($fp);
