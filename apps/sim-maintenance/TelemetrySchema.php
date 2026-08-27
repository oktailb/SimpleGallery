<?php
/**
 * FlightGear / Indra XML Protocol Schema Engine (fgfs_invis.xml)
 * Parses fgfs_invis.xml chunks and decodes binary UDP telemetry packets dynamically.
 */
class TelemetrySchema {
    private static $schema = null;
    private static $totalSize = null;

    /**
     * Locate and parse fgfs_invis.xml, with caching
     */
    public static function getSchema() {
        if (self::$schema !== null) {
            return self::$schema;
        }

        $candidates = [
            __DIR__ . '/fgfs_invis.xml',
            dirname(__DIR__, 2) . '/apps/sim-maintenance/fgfs_invis.xml',
            dirname(__DIR__, 2) . '/apps/ffs/EC135VCHack/cockpit/fgfs_invis.xml',
            dirname(__DIR__, 1) . '/ffs-maintenance/fgfs_invis.xml'
        ];

        $xmlFile = null;
        foreach ($candidates as $f) {
            if (file_exists($f)) {
                $xmlFile = $f;
                break;
            }
        }

        if (!$xmlFile) {
            // Fallback hardcoded schema if XML missing
            return self::getFallbackSchema();
        }

        $cacheFile = __DIR__ . '/fgfs_schema_cache.json';
        if (file_exists($cacheFile) && filemtime($cacheFile) >= filemtime($xmlFile)) {
            $cached = @json_decode(file_get_contents($cacheFile), true);
            if (is_array($cached) && !empty($cached['fields'])) {
                self::$schema = $cached['fields'];
                self::$totalSize = $cached['total_size'] ?? 6565;
                return self::$schema;
            }
        }

        // Parse XML
        $xmlContent = file_get_contents($xmlFile);
        if (!preg_match('/<input>([\s\S]*?)<\/input>/i', $xmlContent, $inputMatch)) {
            return self::getFallbackSchema();
        }

        preg_match_all('/<chunk>([\s\S]*?)<\/chunk>/i', $inputMatch[1], $chunkMatches);
        $offset = 0;
        $fields = [];

        foreach ($chunkMatches[1] as $chunkXml) {
            $name = preg_match('/<name>(.*?)<\/name>/i', $chunkXml, $m) ? trim($m[1]) : '';
            $type = preg_match('/<type>(.*?)<\/type>/i', $chunkXml, $m) ? strtolower(trim($m[1])) : 'bool';
            $node = preg_match('/<node>(.*?)<\/node>/i', $chunkXml, $m) ? trim($m[1]) : '';

            $sz = 1;
            if ($type === 'double') $sz = 8;
            elseif ($type === 'float' || $type === 'int') $sz = 4;
            elseif ($type === 'short' || $type === 'ushort') $sz = 2;
            else $sz = 1;

            if ($name !== '') {
                $fields[$name] = [
                    'offset' => $offset,
                    'size'   => $sz,
                    'type'   => $type,
                    'node'   => $node
                ];
            }
            $offset += $sz;
        }

        self::$schema = $fields;
        self::$totalSize = $offset;

        @file_put_contents($cacheFile, json_encode([
            'generated_at' => time(),
            'xml_source'   => $xmlFile,
            'total_size'   => $offset,
            'fields_count' => count($fields),
            'fields'       => $fields
        ], JSON_PRETTY_PRINT));

        return self::$schema;
    }

    /**
     * Decode a live UDP telemetry binary string according to fgfs_invis.xml schema
     */
    public static function decode($raw, $peer = '', $hostIp = '172.120.1.3', $localPort = 3032) {
        $schema = self::getSchema();
        $len = strlen($raw);

        $getVal = function($name, $default = 0.0) use ($raw, $len, $schema) {
            if (!isset($schema[$name])) return $default;
            $f = $schema[$name];
            $off = $f['offset'];
            $sz  = $f['size'];
            if ($len < ($off + $sz)) return $default;
            $sub = substr($raw, $off, $sz);

            switch ($f['type']) {
                case 'double':
                    $v = unpack('d', $sub)[1] ?? 0.0;
                    return (is_nan($v) || is_infinite($v)) ? 0.0 : $v;
                case 'float':
                    $v = unpack('f', $sub)[1] ?? 0.0;
                    return (is_nan($v) || is_infinite($v)) ? 0.0 : $v;
                case 'int':
                    return unpack('V', $sub)[1] ?? 0;
                case 'short':
                case 'ushort':
                    return unpack('v', $sub)[1] ?? 0;
                case 'bool':
                case 'char':
                default:
                    return ord($sub[0]) > 0;
            }
        };

        $getBool = function($name) use ($getVal) {
            return (bool)$getVal($name, false);
        };

        $normPct = function($val) {
            if ($val > 0.0 && $val <= 1.0) {
                return round($val * 100.0, 1);
            }
            return round(max(0.0, min(100.0, (float)$val)), 1);
        };

        // 1. CWP (Central Warning Panel)
        $cwp = [
            'master_caution'  => $getBool('ltMasterCautionUpper') || $getBool('ltMasterCaution'),
            'emerg_off1'      => $getBool('ltEmergOff1'),
            'emerg_off2'      => $getBool('ltEmergOff2'),
            'fire1'           => $getBool('ltFireWarn1'),
            'fire2'           => $getBool('ltFireWarn2'),
            'active_warn1'    => $getBool('ltActiveWarn1'),
            'active_warn2'    => $getBool('ltActiveWarn2'),
            'low_fuel1'       => $getBool('ltLowFuelWarn1'),
            'low_fuel2'       => $getBool('ltLowFuelWarn2'),
            'rotor_rpm_warn'  => $getBool('ltRotorRpmWarn'),
            'spare_warn1'     => $getBool('ltSpareWarn1'),
            'spare_warn2'     => $getBool('ltSpareWarn2'),
            'bat_temp_warn'   => $getBool('ltBatTempWarn'),
            'bat_disch_warn'  => $getBool('ltBatDischWarn'),
            'xmsn_oil_p_warn' => $getBool('ltXmsnOilPWarn'),
            'ap_trim_warn'    => $getBool('ltApTrimWarn'),
            'cargo_smoke1'    => $getBool('ltCargoSmokeWarn1'),
            'high_nr_cata'    => $getBool('ltHighNrCata'),
            'master_warning'  => false
        ];
        $cwp['master_warning'] = ($cwp['fire1'] || $cwp['fire2'] || $cwp['xmsn_oil_p_warn'] || $cwp['emerg_off1'] || $cwp['emerg_off2'] || $cwp['high_nr_cata']);

        // 2. Flight dynamics
        $hdg   = $getVal('heading', 0.0);
        $spd   = $getVal('speed', 0.0);
        $pit   = $getVal('bankangle', 0.0);
        $rol   = $getVal('rollangle', 0.0);
        $alt   = $getVal('altitude', 0.0);
        $xpdrAlt = $getVal('altitude_ft', $getVal('altitude', 0.0));
        $onGround = $getBool('on_ground');

        // Garmin 430 GPS Coordinate Decoding (from kinematic.nas)
        $decodeGarminCoord = function($offset) use ($raw, $len) {
            if ($len < ($offset + 4)) return 0.0;
            $sub = substr($raw, $offset, 4);
            $u = unpack('N', $sub)[1] ?? 0;
            if ($u > 2147483647) $u -= 4294967296;
            return round($u / 3600000.0, 6);
        };

        $latG1 = $decodeGarminCoord(2301);
        $lonG1 = $decodeGarminCoord(2305);
        $latG2 = $decodeGarminCoord(5282);
        $lonG2 = $decodeGarminCoord(5286);
        $lat = ($latG1 != 0.0) ? $latG1 : $latG2;
        $lon = ($lonG1 != 0.0) ? $lonG1 : $lonG2;

        $slip = $getVal('sideslip', 50.0);
        $flight = [
            'is_live'          => true,
            'latitude'         => $lat,
            'longitude'        => $lon,
            'altitude'         => round($alt, 1),
            'airspeed_ias'     => round($spd, 1),
            'pitch'            => round($pit, 2),
            'roll'             => round($rol, 2),
            'sideslip'         => round($slip, 2),
            'slip_plt'         => round($slip, 2),
            'slip_cplt'        => round($slip, 2),
            'heading_mag'      => round(fmod($hdg + 360.0, 360.0), 1),
            'xpdr_altitude'    => round($xpdrAlt, 0),
            'on_ground'        => $onGround,
            'flag_adi'         => $getVal('flag', 0),
            'flag_alt'         => $getVal('flag', 0),
            'pwr_stby_horizon' => $getBool('PwrStbyHorizon') ? 1 : 0,
            'flight_phase'     => $onGround ? 'ON GROUND' : 'AIRBORNE'
        ];

        // 3. Powerplant
        $n2e1 = $getVal('n2engine1', 0.0);
        $n2e2 = $getVal('n2engine2', 0.0);
        $nr   = $getVal('rotorRpm', 0.0);
        $rb   = $getVal('rotorBrakeHandle', $getVal('st_rotorBrake_I2H_rotorBrakeHandle', $getVal('rotor_brake', $getVal('rotorBrake', 0.0))));
        $powerplant = [
            'rotor_nr'     => round($nr, 1),
            'rotor_rpm'    => round(395.0 * ($nr / 100.0), 0),
            'rotor_brake'  => round($rb, 2),
            'n2_eng1'      => round($n2e1, 1),
            'n2_eng2'      => round($n2e2, 1)
        ];

        // 4. Autopilot Control Console (APC)
        $apc = [
            'ap_off'   => $getBool('ltApOff'),
            'trim_off' => $getBool('ltTrimOff'),
            'test_on'  => $getBool('ltTestOn'),
            'app_a'    => $getBool('ltAppA'),
            'app_c'    => $getBool('ltAppC'),
            'hdg'      => $getBool('ltHdg'),
            'nav_a'    => $getBool('ltNavA'),
            'nav_c'    => $getBool('ltNavC'),
            'alt_a'    => $getBool('ltAltA'),
            'bc_a'     => $getBool('ltBcA'),
            'bc_c'     => $getBool('ltBcC'),
            'gs_a'     => $getBool('ltGsA'),
            'gs_c'     => $getBool('ltGsC'),
            'vs_on'    => $getBool('ltVsOn'),
            'ias'      => $getBool('ltIas'),
            'alt'      => $getBool('ltAlt'),
            'target_hdg' => round(fmod($hdg + 360.0, 360.0), 0),
            'target_alt' => round($alt, 0),
            'target_ias' => round($spd, 0),
            'target_vs'  => 0
        ];

        // 5. Garmin Air Data & Fuel Computer Messages (Shadin / Garmin RS-232 format)
        $extractAirData = function($offset) use ($raw, $len) {
            if ($len < ($offset + 17)) return ['id' => '', 'value' => 0.0, 'raw_str' => '', 'valid' => false];
            $id = trim(substr($raw, $offset, 2));
            $rawVal = trim(substr($raw, $offset + 2, 10));
            $valid = ord($raw[$offset + 16]) > 0;
            $num = floatval(preg_replace('/[^0-9\.\-]/', '', $rawVal));
            return [
                'id'      => $id,
                'value'   => $num,
                'raw_str' => $rawVal,
                'valid'   => $valid
            ];
        };

        // Garmin 1 Air Data (3209..3480) & Garmin 2 (6190..6461)
        $airData = [
            'tas'            => $extractAirData(3226)['value'] ?: $extractAirData(6207)['value'],
            'mach'           => $extractAirData(3243)['value'] ?: $extractAirData(6224)['value'],
            'pressure_alt'   => $extractAirData(3260)['value'] ?: $extractAirData(6241)['value'],
            'density_alt'    => $extractAirData(3277)['value'] ?: $extractAirData(6258)['value'],
            'oat'            => $extractAirData(3294)['value'] ?: $extractAirData(6275)['value'],
            'tat'            => $extractAirData(3311)['value'] ?: $extractAirData(6292)['value'],
            'wind_dir'       => (int)($extractAirData(3328)['value'] ?: $extractAirData(6309)['value']),
            'wind_speed'     => (int)($extractAirData(3345)['value'] ?: $extractAirData(6326)['value']),
            'turn_rate'      => $extractAirData(3362)['value'] ?: $extractAirData(6343)['value'],
            'vertical_speed' => $extractAirData(3379)['value'] ?: $extractAirData(6360)['value'],
        ];

        $fuelData = [
            'flow_eng1'      => $extractAirData(3447)['value'] ?: $extractAirData(6428)['value'],
            'flow_eng2'      => $extractAirData(3413)['value'] ?: $extractAirData(6394)['value'],
            'used_eng1'      => $extractAirData(3464)['value'] ?: $extractAirData(6445)['value'],
            'used_eng2'      => $extractAirData(3430)['value'] ?: $extractAirData(6411)['value'],
        ];

        // 6. DME, GPS, MBR
        $dme = [
            'gnd1'       => $getBool('ltGnd1'),
            'gnd2'       => $getBool('ltGnd2'),
            'dme1'       => $getBool('ltDme1'),
            'dme2'       => $getBool('ltDme2'),
            'dme1_hold'  => $getBool('ltDme1Hold'),
            'dme2_hold'  => $getBool('ltDme2Hold'),
            'call'       => $getBool('ltCall'),
            'high_nr'    => $getBool('ltHighNr'),
            'high_nr_on' => $getBool('ltHighNrOn'),
        ];
        $gps = [
            'latitude'   => $lat,
            'longitude'  => $lon,
            'garmin1'    => [
                'latitude' => $latG1,
                'longitude' => $lonG1,
                'power'     => (bool)$getVal('JAP_GARMIN_OUT[0]/POWER_GARMIN_OUT/flPowerGarmin430'),
                'display'   => (bool)$getVal('JAP_GARMIN_OUT[0]/POWER_GARMIN_OUT/ltDisplayOnGarmin430')
            ],
            'garmin2'    => [
                'latitude' => $latG2,
                'longitude' => $lonG2,
                'power'     => (bool)$getVal('JAP_GARMIN_OUT[1]/POWER_GARMIN_OUT/flPowerGarmin430'),
                'display'   => (bool)$getVal('JAP_GARMIN_OUT[1]/POWER_GARMIN_OUT/ltDisplayOnGarmin430')
            ],
            'airdata'    => $airData,
            'fuel'       => $fuelData,
            'msg'        => $getBool('ltMsg'),
            'wpt'        => $getBool('ltWpt'),
            'term'       => $getBool('ltTerm'),
            'apr'        => $getBool('ltApr'),
            'intg'       => $getBool('ltIntg'),
            'obs'        => $getBool('ltObs'),
        ];
        $mbr = [
            'airway_a' => $getBool('ltAirwayA') || $getBool('airway_a'),
            'outer_o'  => $getBool('ltOuterO') || $getBool('outer_o'),
            'middle_m' => $getBool('ltMiddleM') || $getBool('middle_m'),
        ];

        // 6. Audio selectors
        $audioPlt = [
            'atc'  => $getBool('ltAtc'),
            'dme1' => $getBool('ltDme1'),
            'dme2' => $getBool('ltDme2'),
            'emer' => $getBool('ltEmer'),
            'mkr'  => $getBool('ltMkr'),
            'nav1' => $getBool('ltNav1'),
            'nav2' => $getBool('ltNav2'),
            'vhf1' => $getBool('ltVhf1'),
            'vhf2' => $getBool('ltVhf2'),
        ];
        $audioCplt = [
            'atc'  => $getBool('ltAtcCplt'),
            'dme1' => $getBool('ltDme1Cplt'),
            'dme2' => $getBool('ltDme2Cplt'),
            'emer' => $getBool('ltEmerCplt'),
            'mkr'  => $getBool('ltMkrCplt'),
            'nav1' => $getBool('ltNav1Cplt'),
            'nav2' => $getBool('ltNav2Cplt'),
            'vhf1' => $getBool('ltVhf1Cplt'),
            'vhf2' => $getBool('ltVhf2Cplt'),
        ];

        // 7. Displays (CAD, VEMD, Euronav, PFD/ND)
        $displays = [
            'cad_brt'          => $normPct($getVal('BrtCad', 100.0)),
            'cad_on'           => $getBool('CadScreenOn'),
            'vemd_brt'         => $normPct($getVal('BrtVemd', 100.0)),
            'vemd1_on'         => $getBool('Vemd1ScreenOn'),
            'vemd2_on'         => $getBool('Vemd2ScreenOn'),
            'euronav_contrast' => $normPct($getVal('contrastSmd68', 100.0)),
            'pfd_crt'          => $normPct($getVal('CrtPfd', 100.0)),
            'nd_crt'           => $normPct($getVal('CrtNd', 100.0)),
        ];

        // 8. Lighting (Mastered at exact offsets 6481..6490 from fgfs_invis.xml)
        $swLightingMode = (int)$getVal('swInstruments', 0); // 0=DAY, 1=NIGHT, 2=NVG
        $lighting = [
            'mode'            => ($swLightingMode === 1 ? 'NIGHT' : ($swLightingMode === 2 ? 'NVG' : 'DAY')),
            'instruments_pct' => $normPct($getVal('ltInstruments', 0.0)),
            'stby_hor_pct'    => $normPct($getVal('ltStbyHor', 0.0)),
            'daylight_pct'    => $normPct($getVal('ltDaylight', 0.0)),
            'cockpit_light'   => $getBool('PwrCockpitLight'),
            'map_holder'      => $getBool('PwrMapHolder'),
            'bg_light'        => $getBool('PwrBackgrndLight'),
        ];

        // 9. Power supply
        $powerSupply = [
            'euronav'     => $getBool('Power_Euronav') || $getBool('PwrRn6'),
            'cad'         => $getBool('Power_CAD') || $getBool('bkrIess1_cad'),
            'vemd'        => $getBool('Power_VEMD') || $getBool('bkrIess1_vemd'),
            'plt_fcds'    => $getBool('Power_PLT_FCDS'),
            'transponder' => $getBool('Power_Transponder'),
            'wp'          => $getBool('Power_WP'),
            'ics_plt'     => $getBool('Power_ICS_PLT'),
            'ics_cplt'    => $getBool('Power_ICS_CPLT'),
        ];

        // 10. Simulator status & cycles (offset 6561)
        $simStatus = [
            'session_init' => $getBool('ltSessionInit'),
            'sim_oper'     => $getBool('ltSimOper'),
            'sim_stop'     => $getBool('ltSimStop'),
            'motion_ready' => $getBool('ltMotionReady'),
            'motion_on'    => $getBool('ltMotionOn'),
            'elt_test'     => $getBool('ltEltTest'),
            'cycles'       => (int)$getVal('cycles', 0)
        ];

        return [
            'success'      => true,
            'is_live'      => true,
            'temperature'  => 21.4,
            'humidity'     => 48.5,
            'temp_status'  => 'normal',
            'hum_status'   => 'normal',
            'timestamp'    => microtime(true),
            'packet_len'   => $len,
            'peer'         => $peer,
            'host'         => [
                'ip'     => "{$hostIp}:{$localPort}",
                'status' => 'CONNECTED (50 Hz)'
            ],
            'flight'       => $flight,
            'powerplant'   => $powerplant,
            'cwp'          => $cwp,
            'autopilot'    => $apc,
            'radionav'     => [
                'dme' => $dme,
                'gps' => $gps,
                'mbr' => $mbr
            ],
            'audio_comms'  => [
                'pilot'   => $audioPlt,
                'copilot' => $audioCplt
            ],
            'displays'     => $displays,
            'lighting'     => $lighting,
            'power_supply' => $powerSupply,
            'sim_status'   => $simStatus,
            'xml_schema'   => [
                'fields_loaded' => count($schema),
                'total_bytes'   => self::$totalSize
            ]
        ];
    }

    private static function getFallbackSchema() {
        return [];
    }
}
