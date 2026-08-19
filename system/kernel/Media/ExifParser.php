<?php
namespace SimpleGallery\Kernel\Media;

use DateTime;

/**
 * Kernel EXIF & GPS Parser
 */
class ExifParser {

    public static function parseRational($ratio): float {
        if (is_array($ratio)) {
            $ratio = $ratio[0] ?? '';
        }
        $ratio_str = trim((string)$ratio);
        $ratio_str = preg_replace('/^f\//i', '', $ratio_str);

        $parts = explode('/', $ratio_str);
        if (count($parts) === 2) {
            $num = (float)trim($parts[0]);
            $den = (float)trim($parts[1]);
            if ($den !== 0.0) {
                return $num / $den;
            }
            return $num;
        }
        return (float)$ratio_str;
    }

    public static function parseGpsCoordinate($coordinate, $ref): ?float {
        if (is_array($ref)) {
            $ref = $ref[0] ?? '';
        }
        if (empty($coordinate) || !is_array($coordinate) || count($coordinate) < 3 || empty($ref)) {
            return null;
        }
        $degrees = self::parseRational($coordinate[0]);
        $minutes = self::parseRational($coordinate[1]);
        $seconds = self::parseRational($coordinate[2]);

        $decimal = $degrees + ($minutes / 60.0) + ($seconds / 3600.0);
        $ref = strtoupper(trim((string)$ref));
        if ($ref === 'S' || $ref === 'W') {
            $decimal *= -1.0;
        }
        return round($decimal, 6);
    }

    public static function parseApp1PurePhp(string $file_path): ?array {
        if (!file_exists($file_path) || !is_readable($file_path)) {
            return null;
        }
        $fp = @fopen($file_path, 'rb');
        if (!$fp) return null;

        $header = fread($fp, 2);
        if ($header !== "\xFF\xD8") {
            fclose($fp);
            return null;
        }

        $exif_data = null;
        while (!feof($fp)) {
            $marker = fread($fp, 2);
            if (strlen($marker) < 2 || $marker[0] !== "\xFF") break;
            if ($marker[1] === "\xDA" || $marker[1] === "\xD9") break;

            $len_bytes = fread($fp, 2);
            if (strlen($len_bytes) < 2) break;
            $length = unpack('n', $len_bytes)[1] - 2;
            if ($length <= 0) break;

            if ($marker[1] === "\xE1") {
                $data = fread($fp, $length);
                if (strlen($data) >= 6 && substr($data, 0, 6) === "Exif\x00\x00") {
                    $exif_data = substr($data, 6);
                    break;
                }
            } else {
                fseek($fp, $length, SEEK_CUR);
            }
        }
        fclose($fp);

        if (!$exif_data || strlen($exif_data) < 14) {
            return null;
        }

        $byte_order = substr($exif_data, 0, 2);
        $is_little = ($byte_order === 'II');
        if ($byte_order !== 'II' && $byte_order !== 'MM') {
            return null;
        }

        $unpack_short = function(int $offset) use ($exif_data, $is_little): int {
            if ($offset + 2 > strlen($exif_data)) return 0;
            return unpack($is_little ? 'v' : 'n', substr($exif_data, $offset, 2))[1];
        };

        $unpack_long = function(int $offset) use ($exif_data, $is_little): int {
            if ($offset + 4 > strlen($exif_data)) return 0;
            return unpack($is_little ? 'V' : 'N', substr($exif_data, $offset, 4))[1];
        };

        $first_ifd_offset = $unpack_long(4);
        if ($first_ifd_offset < 8 || $first_ifd_offset >= strlen($exif_data)) {
            return null;
        }

        $extracted = [];

        $read_string = function(int $offset, int $count) use ($exif_data): string {
            if ($offset + $count > strlen($exif_data)) return '';
            return trim(str_replace("\0", '', substr($exif_data, $offset, $count)));
        };

        $read_rational = function(int $offset) use ($unpack_long) {
            $num = $unpack_long($offset);
            $den = $unpack_long($offset + 4);
            if ($den === 0) return 0.0;
            return $num / $den;
        };

        $visited = [];
        $parse_ifd = function(int $ifd_offset) use (&$parse_ifd, &$visited, &$extracted, $exif_data, $unpack_short, $unpack_long, $read_string, $read_rational) {
            if ($ifd_offset + 2 > strlen($exif_data) || isset($visited[$ifd_offset])) return;
            $visited[$ifd_offset] = true;

            $num_entries = $unpack_short($ifd_offset);
            $curr = $ifd_offset + 2;

            for ($i = 0; $i < $num_entries; $i++) {
                if ($curr + 12 > strlen($exif_data)) break;
                $tag = $unpack_short($curr);
                $type = $unpack_short($curr + 2);
                $count = $unpack_long($curr + 4);
                $value_offset = $unpack_long($curr + 8);
                $val_ptr = ($count > 4 || $type == 5 || $type == 10) ? $value_offset : ($curr + 8);

                if ($tag === 0x010F) {
                    $extracted['Make'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x0110) {
                    $extracted['Model'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x0112) {
                    $extracted['Orientation'] = $unpack_short($curr + 8);
                } elseif ($tag === 0x0132 || $tag === 0x9003 || $tag === 0x9004) {
                    $extracted['DateTimeOriginal'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x829D) {
                    $extracted['FNumber'] = $read_rational($val_ptr);
                } elseif ($tag === 0x829A) {
                    $extracted['ExposureTime'] = $read_rational($val_ptr);
                } elseif ($tag === 0x8827) {
                    $extracted['ISOSpeedRatings'] = $unpack_short($val_ptr);
                } elseif ($tag === 0x920A) {
                    $extracted['FocalLength'] = $read_rational($val_ptr);
                } elseif ($tag === 0x0105) {
                    $extracted['ImageDescription'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x0131) {
                    $extracted['Software'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x013B) {
                    $extracted['Artist'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x8769 || $tag === 0x8825) {
                    if ($value_offset > 0 && $value_offset < strlen($exif_data)) {
                        $parse_ifd($value_offset);
                    }
                } elseif ($tag === 0x0001) {
                    $extracted['GPSLatitudeRef'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x0002) {
                    $deg = $read_rational($val_ptr);
                    $min = $read_rational($val_ptr + 8);
                    $sec = $read_rational($val_ptr + 16);
                    $extracted['GPSLatitude'] = [$deg, $min, $sec];
                } elseif ($tag === 0x0003) {
                    $extracted['GPSLongitudeRef'] = $read_string($val_ptr, $count);
                } elseif ($tag === 0x0004) {
                    $deg = $read_rational($val_ptr);
                    $min = $read_rational($val_ptr + 8);
                    $sec = $read_rational($val_ptr + 16);
                    $extracted['GPSLongitude'] = [$deg, $min, $sec];
                }

                $curr += 12;
            }
        };

        $parse_ifd($first_ifd_offset);
        return !empty($extracted) ? $extracted : null;
    }

    public static function extract(string $file_path): ?array {
        $ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'tif', 'tiff'], true)) {
            return null;
        }

        $exif_raw = null;
        $exif_2d = null;

        if (function_exists('exif_read_data')) {
            $exif_raw = @exif_read_data($file_path, 'EXIF,IFD0,GPS');
            if (!$exif_raw || !is_array($exif_raw)) {
                $exif_raw = @exif_read_data($file_path, null, true);
            }
            if (!$exif_raw || !is_array($exif_raw)) {
                $exif_raw = @exif_read_data($file_path);
            }
            if ($exif_raw && is_array($exif_raw)) {
                $exif_2d = @exif_read_data($file_path, null, true);
            }
        }

        if (!$exif_raw || !is_array($exif_raw)) {
            $exif_raw = self::parseApp1PurePhp($file_path);
        }

        if (!$exif_raw || !is_array($exif_raw)) {
            return null;
        }

        $get_val = function(string $key) use ($exif_raw, $exif_2d) {
            if (isset($exif_raw[$key])) return $exif_raw[$key];
            if (is_array($exif_raw)) {
                foreach ($exif_raw as $sec => $data) {
                    if (is_array($data) && isset($data[$key])) return $data[$key];
                }
            }
            if (is_array($exif_2d)) {
                if (isset($exif_2d[$key])) return $exif_2d[$key];
                foreach ($exif_2d as $sec => $data) {
                    if (is_array($data) && isset($data[$key])) return $data[$key];
                }
            }
            return null;
        };

        $make  = trim(str_replace("\0", '', (string)($get_val('Make') ?? '')));
        $model = trim(str_replace("\0", '', (string)($get_val('Model') ?? '')));
        $camera = '';
        if ($make !== '' && $model !== '') {
            $make_clean = preg_replace('/\s+corporation$/i', '', $make);
            if (stripos($model, $make_clean) !== false || stripos($model, $make) !== false) {
                $camera = $model;
            } else {
                $camera = $make_clean . ' ' . $model;
            }
        } else {
            $camera = ($model !== '') ? $model : $make;
        }

        $date_str = $get_val('DateTimeOriginal') ?? $get_val('DateTimeDigitized') ?? $get_val('DateTime') ?? $get_val('FileDateTime') ?? null;
        $date_ts = null;
        $date_formatted = null;
        if ($date_str) {
            $str = trim(str_replace("\0", '', (string)$date_str));
            if ($str !== '' && strpos($str, '0000:00:00') === false) {
                $formats = ['Y:m:d H:i:s', 'Y-m-d H:i:s', 'Y/m/d H:i:s', 'Y:m:d', 'Y-m-d', 'Y/m/d'];
                foreach ($formats as $fmt) {
                    $dt = DateTime::createFromFormat($fmt, $str);
                    if ($dt !== false) {
                        $ts = $dt->getTimestamp();
                        if ($ts > 0) {
                            $date_ts = $ts;
                            $date_formatted = $dt->format('Y-m-d H:i:s');
                            break;
                        }
                    }
                }
                if ($date_ts === null) {
                    $ts = @strtotime($str);
                    if ($ts !== false && $ts > 0) {
                        $date_ts = $ts;
                        $date_formatted = date('Y-m-d H:i:s', $ts);
                    }
                }
            }
        }

        $fnumber = null;
        $fnum_raw = $get_val('FNumber') ?? $get_val('ApertureFNumber') ?? null;
        if (!empty($fnum_raw)) {
            $fval = self::parseRational($fnum_raw);
            if ($fval > 0) $fnumber = 'f/' . round($fval, 1);
        }

        $shutter_speed = null;
        $exp_raw = $get_val('ExposureTime') ?? null;
        if (!empty($exp_raw)) {
            $exp = self::parseRational($exp_raw);
            if ($exp > 0) {
                $shutter_speed = ($exp < 1) ? '1/' . round(1.0 / $exp) . 's' : round($exp, 1) . 's';
            }
        }

        $iso = null;
        $iso_raw = $get_val('ISOSpeedRatings') ?? $get_val('PhotographicSensitivity') ?? $get_val('ISO') ?? null;
        if (!empty($iso_raw)) {
            $iso_val = is_array($iso_raw) ? ($iso_raw[0] ?? '') : $iso_raw;
            $iso_str = trim((string)$iso_val);
            if ($iso_str !== '') {
                $iso = (stripos($iso_str, 'iso') === 0) ? $iso_str : 'ISO ' . $iso_str;
            }
        }

        $focal = null;
        $focal_raw = $get_val('FocalLength') ?? $get_val('FocalLengthIn35mmFilm') ?? null;
        if (!empty($focal_raw)) {
            $fval = self::parseRational($focal_raw);
            if ($fval > 0) $focal = round($fval) . 'mm';
        }

        $gps_data = null;
        $lat = self::parseGpsCoordinate($get_val('GPSLatitude'), $get_val('GPSLatitudeRef'));
        $lng = self::parseGpsCoordinate($get_val('GPSLongitude'), $get_val('GPSLongitudeRef'));

        if ($lat !== null && $lng !== null) {
            $gps_data = [
                'lat'      => $lat,
                'lng'      => $lng,
                'maps_url' => 'https://www.google.com/maps/search/?api=1&query=' . $lat . ',' . $lng
            ];
        }

        return [
            'camera'        => $camera ?: null,
            'datetime'      => $date_formatted,
            'date_ts'       => $date_ts,
            'fnumber'       => $fnumber,
            'shutter_speed' => $shutter_speed,
            'iso'           => $iso,
            'focal'         => $focal,
            'software'      => trim(str_replace("\0", '', (string)($get_val('Software') ?? ''))) ?: null,
            'artist'        => trim(str_replace("\0", '', (string)($get_val('Artist') ?? ''))) ?: null,
            'description'   => trim(str_replace("\0", '', (string)($get_val('ImageDescription') ?? ''))) ?: null,
            'gps'           => $gps_data
        ];
    }
}
