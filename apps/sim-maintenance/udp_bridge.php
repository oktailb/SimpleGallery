<?php
/**
 * Daemon UDP Bridge - Indra FFS (EC135)
 * Reçoit le flux 50 Hz en continu et persiste la dernière trame décodée
 */

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

$unpackDouble = function($bin) {
    if (strlen($bin) < 8) return 0.0;
    $v = unpack('dval', $bin)['val'];
    if (is_nan($v) || is_infinite($v) || abs($v) > 100000) {
        $v = unpack('dval', strrev($bin))['val'];
    }
    return (is_nan($v) || is_infinite($v)) ? 0.0 : $v;
};

$unpackFloat = function($bin) {
    if (strlen($bin) < 4) return 0.0;
    $v = unpack('fval', $bin)['val'];
    if (is_nan($v) || is_infinite($v) || abs($v) > 100000) {
        $v = unpack('fval', strrev($bin))['val'];
    }
    return (is_nan($v) || is_infinite($v)) ? 0.0 : $v;
};

$unpackInt = function($bin) {
    if (strlen($bin) < 4) return 0;
    return unpack('lval', $bin)['val'] ?? 0;
};

$scriptMtime = filemtime(__FILE__);
$lastStim = 0;
$pktCount = 0;
$lastWrite = 0;
$lastMtimeCheck = 0;

while (true) {
    $now = microtime(true);

    // Auto-reload if script was updated
    if (($now - $lastMtimeCheck) >= 2.0) {
        $lastMtimeCheck = $now;
        @clearstatcache(true, __FILE__);
        if (file_exists(__FILE__) && filemtime(__FILE__) > $scriptMtime) {
            // Self-terminate to allow new code to run
            exit(0);
        }
    }

    // Heartbeat every 100ms (10 Hz)
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

        // Helper to check boolean / char active flag (> 0)
        $isSet = function($idx) use ($data, $len) {
            return ($len > $idx) ? (ord($data[$idx]) > 0) : false;
        };

        // Helper to normalize percentage (handles both 0..1.0 and 0..100.0)
        $normPct = function($val) {
            if ($val > 0.0 && $val <= 1.0) {
                return round($val * 100.0, 1);
            }
            return round(max(0.0, min(100.0, $val)), 1);
        };

        // 1. CWP (18 Annunciators)
        $cwpData = [
            'master_caution'  => $isSet(0),
            'emerg_off1'      => $isSet(1),
            'emerg_off2'      => $isSet(2),
            'fire1'           => $isSet(3),
            'fire2'           => $isSet(4),
            'active_warn1'    => $isSet(5),
            'active_warn2'    => $isSet(6),
            'low_fuel1'       => $isSet(7),
            'low_fuel2'       => $isSet(8),
            'rotor_rpm_warn'  => $isSet(9),
            'spare_warn1'     => $isSet(10),
            'spare_warn2'     => $isSet(11),
            'bat_temp_warn'   => $isSet(12),
            'bat_disch_warn'  => $isSet(13),
            'xmsn_oil_p_warn' => $isSet(14),
            'ap_trim_warn'    => $isSet(15),
            'cargo_smoke1'    => $isSet(16),
            'high_nr_cata'    => $isSet(17),
            'master_warning'  => false
        ];
        $cwpData['master_warning'] = ($cwpData['fire1'] || $cwpData['fire2'] || $cwpData['xmsn_oil_p_warn'] || $cwpData['emerg_off1'] || $cwpData['emerg_off2'] || $cwpData['high_nr_cata']);

        // 2. Flight & Navigation Core
        $hdg  = ($len >= 26) ? $unpackDouble(substr($data, 18, 8)) : 0.0;
        $spd  = ($len >= 34) ? $unpackDouble(substr($data, 26, 8)) : 0.0;
        $pit  = ($len >= 42) ? $unpackDouble(substr($data, 34, 8)) : 0.0;
        $rol  = ($len >= 50) ? $unpackDouble(substr($data, 42, 8)) : 0.0;
        $flagAdi = ($len >= 51) ? ord($data[50]) : 0;
        $pwrStbyHor = ($len >= 52) ? ord($data[51]) : 0;
        $alt  = ($len >= 60) ? $unpackDouble(substr($data, 52, 8)) : 0.0;
        $flagAlt = ($len >= 61) ? ord($data[60]) : 0;

        // 3. Powerplant
        $n2e1 = ($len >= 69) ? $unpackDouble(substr($data, 61, 8)) : 0.0;
        $n2e2 = ($len >= 77) ? $unpackDouble(substr($data, 69, 8)) : 0.0;
        $nr   = ($len >= 85) ? $unpackDouble(substr($data, 77, 8)) : 0.0;

        // 4. DME & GPS Annunciators & Marker Beacons
        $dme = [
            'gnd1'       => $isSet(85),
            'gnd2'       => $isSet(86),
            'dme1'       => $isSet(87),
            'dme2'       => $isSet(88),
            'dme1_hold'  => $isSet(89),
            'dme2_hold'  => $isSet(90),
            'call'       => $isSet(91),
            'high_nr'    => $isSet(92),
            'high_nr_on' => $isSet(93),
        ];

        $gps = [
            'msg'  => $isSet(95),
            'wpt'  => $isSet(96),
            'term' => $isSet(97),
            'apr'  => $isSet(98),
            'intg' => $isSet(99),
            'obs'  => $isSet(100),
        ];

        $mbr = [
            'airway_a' => $isSet(101),
            'outer_o'  => $isSet(102),
            'middle_m' => $isSet(103),
        ];

        // 5. Autopilot Console (APC)
        $apc = [
            'ap_off'     => $isSet(104),
            'trim_off'   => $isSet(105),
            'test_on'    => $isSet(106),
            'app_a'      => $isSet(107),
            'app_c'      => $isSet(108),
            'hdg'        => $isSet(109),
            'nav_a'      => $isSet(110),
            'nav_c'      => $isSet(111),
            'alt_a'      => $isSet(112),
            'bc_a'       => $isSet(113),
            'bc_c'       => $isSet(114),
            'gs_a'       => $isSet(115),
            'gs_c'       => $isSet(116),
            'vs_on'      => $isSet(117),
            'ias'        => $isSet(118),
            'alt'        => $isSet(119),
        ];

        // 6. Audio Comms & Intercom
        $audioPlt = [
            'atc'  => $isSet(120),
            'dme1' => $isSet(121),
            'dme2' => $isSet(122),
            'emer' => $isSet(123),
            'mkr'  => $isSet(124),
            'nav1' => $isSet(125),
            'nav2' => $isSet(126),
            'vhf1' => $isSet(127),
            'vhf2' => $isSet(128),
        ];

        $audioCplt = [
            'atc'  => $isSet(129),
            'dme1' => $isSet(130),
            'dme2' => $isSet(131),
            'emer' => $isSet(132),
            'mkr'  => $isSet(133),
            'nav1' => $isSet(134),
            'nav2' => $isSet(135),
            'vhf1' => $isSet(136),
            'vhf2' => $isSet(137),
        ];

        // 7. CAD & VEMD & ELT & Cockpit Lights
        $cadBrt     = ($len >= 337) ? $normPct($unpackDouble(substr($data, 329, 8))) : 100.0;
        $cadOn      = $isSet(337);
        $vemdBrt    = ($len >= 346) ? $normPct($unpackDouble(substr($data, 338, 8))) : 100.0;
        $vemd1On    = $isSet(346);
        $vemd2On    = $isSet(347);
        $eltTest    = $isSet(348);
        $pwrLight   = [
            'cockpit' => $isSet(349),
            'map'     => $isSet(350),
            'bg'      => $isSet(351),
        ];

        // 8. Simulator Platform & Motion System
        $simStatus = [
            'session_init' => $isSet(352),
            'sim_oper'     => $isSet(353),
            'sim_stop'     => $isSet(354),
            'motion_ready' => $isSet(355),
            'motion_on'    => $isSet(356),
        ];

        // 9. Transponder & Power Supply
        $xpdrAlt = ($len >= 510) ? round($unpackFloat(substr($data, 506, 4)), 0) : 0;
        $onGround = $isSet(510);

        $pwrSupply = [
            'euronav'     => $isSet(511),
            'cad'         => $isSet(512),
            'vemd'        => $isSet(513),
            'plt_fcds'    => $isSet(514),
            'transponder' => $isSet(515),
            'wp'          => $isSet(516),
            'ics_plt'     => $isSet(517),
            'ics_cplt'    => $isSet(518),
        ];

        // 10. Japan Lighting & Display Dimming
        $swLightingMode = ($len >= 6210) ? ord($data[6209]) : 0; // 0=DAY, 1=NIGHT, 2=NVG
        $ltInstPct      = ($len >= 6214) ? $normPct($unpackFloat(substr($data, 6210, 4))) : 100.0;
        $ltStbyHorPct   = ($len >= 6218) ? $normPct($unpackFloat(substr($data, 6214, 4))) : 100.0;
        $ltDaylightPct  = ($len >= 6222) ? $normPct($unpackFloat(substr($data, 6218, 4))) : 100.0;
        $euronavContrast = ($len >= 6226) ? $normPct($unpackFloat(substr($data, 6222, 4))) : 100.0;
        $pfdCrt          = ($len >= 6230) ? $normPct($unpackFloat(substr($data, 6226, 4))) : 100.0;
        $ndCrt           = ($len >= 6234) ? $normPct($unpackFloat(substr($data, 6230, 4))) : 100.0;

        // 11. Cycles
        $cycles = ($len >= 6293) ? $unpackInt(substr($data, 6289, 4)) : 0;

        $payload = [
            'is_live'    => true,
            'timestamp'  => microtime(true),
            'packet_len' => $len,
            'peer'       => $peer,
            'host'       => [
                'ip'     => "{$hostIp}:{$localPort}",
                'status' => 'CONNECTED (50 Hz)'
            ],
            'flight'     => [
                'is_live'          => true,
                'altitude'         => round($alt, 1),
                'airspeed_ias'     => round($spd, 1),
                'pitch'            => round($pit, 2),
                'roll'             => round($rol, 2),
                'heading_mag'      => round(fmod($hdg + 360.0, 360.0), 1),
                'xpdr_altitude'    => $xpdrAlt,
                'on_ground'        => $onGround,
                'flag_adi'         => $flagAdi,
                'flag_alt'         => $flagAlt,
                'pwr_stby_horizon' => $pwrStbyHor,
                'flight_phase'     => $onGround ? 'ON GROUND' : 'AIRBORNE'
            ],
            'powerplant' => [
                'rotor_nr'     => round($nr, 1),
                'rotor_rpm'    => round(395.0 * ($nr / 100.0), 0),
                'n2_eng1'      => round($n2e1, 1),
                'n2_eng2'      => round($n2e2, 1)
            ],
            'cwp'            => $cwpData,
            'autopilot'      => $apc,
            'radionav'       => [
                'dme' => $dme,
                'gps' => $gps,
                'mbr' => $mbr
            ],
            'audio_comms'    => [
                'pilot'   => $audioPlt,
                'copilot' => $audioCplt
            ],
            'displays'       => [
                'cad_brt'          => $cadBrt,
                'cad_on'           => $cadOn,
                'vemd_brt'         => $vemdBrt,
                'vemd1_on'         => $vemd1On,
                'vemd2_on'         => $vemd2On,
                'euronav_contrast' => $euronavContrast,
                'pfd_crt'          => $pfdCrt,
                'nd_crt'           => $ndCrt
            ],
            'lighting'       => [
                'mode'             => ($swLightingMode === 1 ? 'NIGHT' : ($swLightingMode === 2 ? 'NVG' : 'DAY')),
                'instruments_pct'  => $ltInstPct,
                'stby_hor_pct'     => $ltStbyHorPct,
                'daylight_pct'     => $ltDaylightPct,
                'cockpit_light'    => $pwrLight['cockpit'],
                'map_holder'       => $pwrLight['map'],
                'bg_light'         => $pwrLight['bg']
            ],
            'power_supply'   => $pwrSupply,
            'sim_status'     => array_merge($simStatus, [
                'cycles'   => $cycles,
                'elt_test' => $eltTest
            ])
        ];

        // Write cache at max 20 Hz
        if (($now - $lastWrite) >= 0.05) {
            $lastWrite = $now;
            @file_put_contents($dataFile, json_encode($payload));
        }
    }

    usleep(2000); // 2ms loop
}

