<?php
/**
 * SimpleGallery WebOS - Sim Logbook API Gateway
 * Dedicated to EC135 FFS Simulator Operation Logbook.
 * Compatible with PHP 7.x and PHP 8.x, with graceful offline fallback.
 */

// Disable direct PHP error output into JSON responses
error_reporting(0);
@ini_set('display_errors', '0');

require_once __DIR__ . '/dbConfig.php';

$action = isset($_REQUEST['action']) ? $_REQUEST['action'] : 'get_trainings';
$pdo = getLogbookDbConnection();

// Direct file exports (PDF / CSV / Logo / Summary) handle their own Content-Type
if (!in_array($action, array('export_csv', 'export_pdf', 'view_print', 'get_logo', 'view_summary', 'export_monthly_summary'))) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
}

// Fallback JSON-based storage if MySQL is unreachable
$jsonFallbackFile = __DIR__ . '/data/sim_logbook_data.json';
if (!is_dir(__DIR__ . '/data')) {
    @mkdir(__DIR__ . '/data', 0777, true);
}

if (!function_exists('getFallbackRecords')) {
    function getFallbackRecords() {
        global $jsonFallbackFile;
        if (file_exists($jsonFallbackFile)) {
            $content = @file_get_contents($jsonFallbackFile);
            $decoded = @json_decode($content, true);
            if (is_array($decoded)) return $decoded;
        }
        return array();
    }
}

if (!function_exists('saveFallbackRecords')) {
    function saveFallbackRecords($records) {
        global $jsonFallbackFile;
        @file_put_contents($jsonFallbackFile, json_encode($records, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

if (!function_exists('computeMonthlySummaryData')) {
    function computeMonthlySummaryData($month, $pdo) {
        $year = intval(substr($month, 0, 4));
        $mNum = intval(substr($month, 5, 2));
        $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $mNum, $year);

        $rows = array();
        if ($pdo) {
            try {
                $stmt = $pdo->prepare("SELECT * FROM log WHERE date LIKE ? AND deleted = 0 ORDER BY date ASC, startTime ASC");
                $stmt->execute(array($month . '%'));
                $rows = $stmt->fetchAll();
            } catch (Exception $e) {}
        } else {
            $all = getFallbackRecords();
            foreach ($all as $r) {
                if (isset($r['date']) && substr($r['date'], 0, strlen($month)) === $month && empty($r['deleted'])) {
                    $rows[] = $r;
                }
            }
        }

        // Group records by exact day number 1..N
        $byDay = array();
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $byDay[$d] = array();
        }

        $stats = array(
            'total_sessions' => count($rows),
            'total_customer_wet' => 0,
            'total_customer_dry' => 0,
            'total_internal' => 0,
            'total_maintenance' => 0,
            'total_other' => 0,
            'total_flight_time' => 0,
            'total_downtime' => 0,
            'motion_count' => 0,
            'good_feedback_count' => 0
        );

        foreach ($rows as $row) {
            $d = intval(substr($row['date'], 8, 2));
            if ($d >= 1 && $d <= $daysInMonth) {
                $byDay[$d][] = $row;
            }

            $start = strtotime(isset($row['startTime']) ? $row['startTime'] : '00:00');
            $end   = strtotime(isset($row['endTime']) ? $row['endTime'] : '00:00');
            $delta = max(0, $end - $start);
            $type  = strtoupper(isset($row['type']) ? $row['type'] : 'WET');

            if ($type === 'WET') {
                $stats['total_customer_wet'] += $delta;
                $stats['total_flight_time'] += $delta;
            } elseif ($type === 'DRY') {
                $stats['total_customer_dry'] += $delta;
                $stats['total_flight_time'] += $delta;
            } elseif ($type === 'INTERNAL') {
                $stats['total_internal'] += $delta;
                $stats['total_flight_time'] += $delta;
            } elseif ($type === 'MAINTENANCE') {
                $stats['total_maintenance'] += $delta;
            } else {
                $stats['total_other'] += $delta;
                $stats['total_flight_time'] += $delta;
            }

            if (!empty($row['motion'])) {
                $stats['motion_count']++;
            }
            if (strtoupper(isset($row['feedback']) ? $row['feedback'] : '') === 'GOOD') {
                $stats['good_feedback_count']++;
            }

            if (!empty($row['downTime']) && $row['downTime'] !== '00:00' && $row['downTime'] !== '00:00:00') {
                $dtParts = explode(':', $row['downTime']);
                if (count($dtParts) >= 2) {
                    $stats['total_downtime'] += (intval($dtParts[0]) * 3600) + (intval($dtParts[1]) * 60);
                }
            }
        }

        $sec2hm = function($sec) {
            if ($sec <= 0) return '';
            $h = floor($sec / 3600);
            $m = floor(($sec % 3600) / 60);
            return sprintf("%d:%02d", $h, $m);
        };

        $sec2hmPadded = function($sec) {
            $h = floor($sec / 3600);
            $m = floor(($sec % 3600) / 60);
            return sprintf("%02d:%02d", $h, $m);
        };

        $days = array();
        $totCustomer = 0;
        $totInternal = 0;
        $totOther = 0;
        $totMaint = 0;
        $totDown = 0;
        $dryTotalSec = 0;
        $availValues = array();
        $failureCount = 0;

        for ($d = 1; $d <= $daysInMonth; $d++) {
            $dateISO = sprintf("%04d-%02d-%02d", $year, $mNum, $d);
            $dayOfWeek = intval(date('N', strtotime($dateISO))); // 1 (Mon) .. 7 (Sun)
            $isWeekend = ($dayOfWeek === 6 || $dayOfWeek === 7);

            $dayCustomer = 0;
            $dayInternal = 0;
            $dayOther = 0;
            $dayMaint = 0;
            $dayDown = 0;
            $hasDry = false;
            $remarksList = array();

            foreach ($byDay[$d] as $r) {
                $start = strtotime(isset($r['startTime']) ? $r['startTime'] : '00:00');
                $end   = strtotime(isset($r['endTime']) ? $r['endTime'] : '00:00');
                $delta = max(0, $end - $start);
                $type  = strtoupper(isset($r['type']) ? $r['type'] : 'WET');

                if ($type === 'WET' || $type === 'DRY') {
                    $dayCustomer += $delta;
                    if ($type === 'DRY') {
                        $hasDry = true;
                        $dryTotalSec += $delta;
                    }
                } elseif ($type === 'INTERNAL') {
                    $dayInternal += $delta;
                } elseif ($type === 'MAINTENANCE') {
                    $dayMaint += $delta;
                } else {
                    $dayOther += $delta;
                }

                if (!empty($r['downTime']) && $r['downTime'] !== '00:00' && $r['downTime'] !== '00:00:00') {
                    $dt = explode(':', $r['downTime']);
                    if (count($dt) >= 2) {
                        $dtSec = (intval($dt[0]) * 3600) + (intval($dt[1]) * 60);
                        if ($dtSec > 0) {
                            $dayDown += $dtSec;
                            $failureCount++;
                        }
                    }
                }

                if (!empty($r['memo'])) {
                    $remarksList[] = $r['memo'];
                }
            }

            $totCustomer += $dayCustomer;
            $totInternal += $dayInternal;
            $totOther    += $dayOther;
            $totMaint    += $dayMaint;
            $totDown     += $dayDown;

            // Compute daily Availability %
            $dayPlanned = $dayCustomer + $dayInternal + $dayOther + $dayMaint;
            $availStr = '';
            if ($dayPlanned > 0 || $dayDown > 0) {
                if ($dayDown <= 0) {
                    $availVal = 100.0;
                    $availStr = '100.00%';
                } else {
                    $availVal = max(0, min(100, round(($dayPlanned / ($dayPlanned + $dayDown)) * 100, 2)));
                    $availStr = sprintf("%.2f%%", $availVal);
                }
                $availValues[] = $availVal;
            }

            $remarkParts = array();
            if ($hasDry) $remarkParts[] = 'DRY';
            if (!empty($remarksList)) {
                $uniqueRemarks = array_unique($remarksList);
                foreach ($uniqueRemarks as $ur) {
                    if ($ur !== 'DRY' && strpos($ur, 'DRY (') !== 0) {
                        $remarkParts[] = $ur;
                    }
                }
            }

            $days[] = array(
                'day' => $d,
                'label' => sprintf("%d/%d", $mNum, $d),
                'is_weekend' => $isWeekend,
                'customer_sec' => $dayCustomer,
                'customer_str' => $sec2hm($dayCustomer),
                'internal_sec' => $dayInternal,
                'internal_str' => $sec2hm($dayInternal),
                'other_sec' => $dayOther,
                'other_str' => $sec2hm($dayOther),
                'maint_sec' => $dayMaint,
                'maint_str' => $sec2hm($dayMaint),
                'down_sec' => $dayDown,
                'down_str' => $sec2hm($dayDown),
                'avail_str' => $availStr,
                'remarks' => implode(', ', $remarkParts)
            );
        }

        // Summary Totals
        $totCombined = $totCustomer + $totInternal;
        $totalOperating = $totCustomer + $totInternal + $totOther;

        $availMax = !empty($availValues) ? max($availValues) : 100.0;
        $availMin = !empty($availValues) ? min($availValues) : 100.0;
        $availAvg = ($totalOperating + $totDown > 0) 
            ? round(($totalOperating / ($totalOperating + $totDown)) * 100, 2)
            : 100.0;

        $mtbfSec = ($failureCount > 0) ? floor($totalOperating / $failureCount) : $totalOperating;
        $mttrSec = ($failureCount > 0) ? floor($totDown / $failureCount) : 0;

        return array(
            'month' => $month,
            'days' => $days,
            'stats' => $stats,
            'formatted' => array(
                'flight_time' => $sec2hmPadded($stats['total_flight_time']),
                'customer_wet' => $sec2hmPadded($stats['total_customer_wet']),
                'customer_dry' => $sec2hmPadded($stats['total_customer_dry']),
                'internal' => $sec2hmPadded($stats['total_internal']),
                'maintenance' => $sec2hmPadded($stats['total_maintenance']),
                'other' => $sec2hmPadded($stats['total_other']),
                'downtime' => $sec2hmPadded($stats['total_downtime'])
            ),
            'totals' => array(
                'customer_sec' => $totCustomer,
                'customer_str' => $sec2hmPadded($totCustomer),
                'internal_sec' => $totInternal,
                'internal_str' => $sec2hmPadded($totInternal),
                'customer_plus_internal_str' => $sec2hmPadded($totCombined),
                'other_str' => $sec2hmPadded($totOther),
                'maint_str' => $sec2hmPadded($totMaint),
                'down_str' => $sec2hmPadded($totDown),
                'dry_str' => $sec2hmPadded($dryTotalSec)
            ),
            'metrics' => array(
                'avail_max' => sprintf("%.2f%%", $availMax),
                'avail_min' => sprintf("%.2f%%", $availMin),
                'avail_avg' => sprintf("%.2f%%", $availAvg),
                'mtbf_str' => $sec2hmPadded($mtbfSec),
                'mttr_str' => $sec2hmPadded($mttrSec),
                'failures' => $failureCount
            )
        );
    }
}

switch ($action) {
    case 'get_logo':
        $logoFile = __DIR__ . '/logo_blue.png';
        if (!file_exists($logoFile)) {
            $logoFile = dirname(__DIR__) . '/ffs/logo_blue.png';
        }
        if (file_exists($logoFile)) {
            if (!headers_sent()) {
                header('Content-Type: image/png');
                header('Cache-Control: public, max-age=86400');
            }
            readfile($logoFile);
            exit;
        }
        http_response_code(404);
        echo "Logo not found";
        exit;

    case 'get_trainings':
        $date = isset($_REQUEST['date']) ? $_REQUEST['date'] : date('Y-m-d');
        if ($pdo) {
            try {
                $stmt = $pdo->prepare("SELECT * FROM log WHERE date = ? ORDER BY startTime ASC, id ASC");
                $stmt->execute(array($date));
                $rows = $stmt->fetchAll();
                
                foreach ($rows as &$row) {
                    $start = strtotime($row['startTime']);
                    $end   = strtotime($row['endTime']);
                    $delta = max(0, $end - $start);
                    $min   = ($delta / 60) % 60;
                    $hrs   = floor($delta / 3600);
                    $row['duration'] = sprintf("%02d:%02d", $hrs, $min);
                }
                
                echo json_encode(array(
                    'success' => true,
                    'date' => $date,
                    'records' => $rows
                ));
            } catch (Exception $e) {
                echo json_encode(array('success' => false, 'error' => $e->getMessage()));
            }
        } else {
            // Local fallback
            $all = getFallbackRecords();
            $filtered = array();
            foreach ($all as $r) {
                if (isset($r['date']) && $r['date'] === $date) {
                    $filtered[] = $r;
                }
            }
            usort($filtered, function($a, $b) {
                return strcmp(isset($a['startTime']) ? $a['startTime'] : '', isset($b['startTime']) ? $b['startTime'] : '');
            });
            echo json_encode(array(
                'success' => true,
                'date' => $date,
                'records' => $filtered,
                'fallback' => true
            ));
        }
        break;

    case 'add_training':
        $date       = trim(isset($_POST['date']) ? $_POST['date'] : date('Y-m-d'));
        $instructor = trim(isset($_POST['instructor']) ? $_POST['instructor'] : '');
        $trainee    = trim(isset($_POST['trainee']) ? $_POST['trainee'] : '');
        $startTime  = trim(isset($_POST['startTime']) ? $_POST['startTime'] : '08:00');
        $endTime    = trim(isset($_POST['endTime']) ? $_POST['endTime'] : '09:00');
        $downTime   = trim(isset($_POST['downTime']) ? $_POST['downTime'] : '00:00');
        $category   = trim(isset($_POST['category']) ? $_POST['category'] : 'FFS C');
        $type       = trim(isset($_POST['type']) ? $_POST['type'] : 'WET');
        $motion     = (!empty($_POST['motion']) && $_POST['motion'] !== '0' && $_POST['motion'] !== 'false') ? 1 : 0;
        $feedback   = trim(isset($_POST['feedback']) ? $_POST['feedback'] : 'GOOD');
        $memo       = trim(isset($_POST['memo']) ? $_POST['memo'] : '');

        if (empty($instructor) || empty($trainee)) {
            echo json_encode(array('success' => false, 'error' => 'Instructor and Trainee are required.'));
            exit;
        }

        if ($pdo) {
            try {
                $stmt = $pdo->prepare("INSERT INTO log (date, instructor, trainee, startTime, endTime, downTime, category, type, motion, feedback, memo, deleted) 
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)");
                $stmt->execute(array($date, $instructor, $trainee, $startTime, $endTime, $downTime, $category, $type, $motion, $feedback, $memo));
                
                echo json_encode(array(
                    'success' => true,
                    'id' => $pdo->lastInsertId(),
                    'message' => 'Training session added successfully.'
                ));
            } catch (Exception $e) {
                echo json_encode(array('success' => false, 'error' => $e->getMessage()));
            }
        } else {
            $all = getFallbackRecords();
            $maxId = 0;
            foreach ($all as $item) {
                if (isset($item['id']) && intval($item['id']) > $maxId) {
                    $maxId = intval($item['id']);
                }
            }
            $newId = $maxId + 1;
            
            $start = strtotime($startTime);
            $end   = strtotime($endTime);
            $delta = max(0, $end - $start);
            $min   = ($delta / 60) % 60;
            $hrs   = floor($delta / 3600);
            $dur   = sprintf("%02d:%02d", $hrs, $min);

            $newRec = array(
                'id' => $newId,
                'date' => $date,
                'instructor' => $instructor,
                'trainee' => $trainee,
                'startTime' => $startTime,
                'endTime' => $endTime,
                'downTime' => $downTime,
                'duration' => $dur,
                'category' => $category,
                'type' => $type,
                'motion' => $motion,
                'feedback' => $feedback,
                'memo' => $memo,
                'deleted' => 0
            );
            $all[] = $newRec;
            saveFallbackRecords($all);
            echo json_encode(array('success' => true, 'id' => $newId, 'message' => 'Training session added (local fallback).'));
        }
        break;

    case 'update_training':
        $id         = intval(isset($_POST['id']) ? $_POST['id'] : 0);
        $instructor = trim(isset($_POST['instructor']) ? $_POST['instructor'] : '');
        $trainee    = trim(isset($_POST['trainee']) ? $_POST['trainee'] : '');
        $startTime  = trim(isset($_POST['startTime']) ? $_POST['startTime'] : '08:00');
        $endTime    = trim(isset($_POST['endTime']) ? $_POST['endTime'] : '09:00');
        $downTime   = trim(isset($_POST['downTime']) ? $_POST['downTime'] : '00:00');
        $category   = trim(isset($_POST['category']) ? $_POST['category'] : 'FFS C');
        $type       = trim(isset($_POST['type']) ? $_POST['type'] : 'WET');
        $motion     = (!empty($_POST['motion']) && $_POST['motion'] !== '0' && $_POST['motion'] !== 'false') ? 1 : 0;
        $feedback   = trim(isset($_POST['feedback']) ? $_POST['feedback'] : 'GOOD');
        $memo       = trim(isset($_POST['memo']) ? $_POST['memo'] : '');

        if ($id <= 0 || empty($instructor) || empty($trainee)) {
            echo json_encode(array('success' => false, 'error' => 'Invalid parameters for update.'));
            exit;
        }

        if ($pdo) {
            try {
                $stmt = $pdo->prepare("UPDATE log SET instructor = ?, trainee = ?, startTime = ?, endTime = ?, downTime = ?, category = ?, type = ?, motion = ?, feedback = ?, memo = ? WHERE id = ?");
                $stmt->execute(array($instructor, $trainee, $startTime, $endTime, $downTime, $category, $type, $motion, $feedback, $memo, $id));
                echo json_encode(array('success' => true, 'message' => 'Record updated successfully.'));
            } catch (Exception $e) {
                echo json_encode(array('success' => false, 'error' => $e->getMessage()));
            }
        } else {
            $all = getFallbackRecords();
            $found = false;
            foreach ($all as &$r) {
                if (isset($r['id']) && intval($r['id']) === $id) {
                    $r['instructor'] = $instructor;
                    $r['trainee'] = $trainee;
                    $r['startTime'] = $startTime;
                    $r['endTime'] = $endTime;
                    $r['downTime'] = $downTime;
                    $r['category'] = $category;
                    $r['type'] = $type;
                    $r['motion'] = $motion;
                    $r['feedback'] = $feedback;
                    $r['memo'] = $memo;
                    $found = true;
                    break;
                }
            }
            if ($found) {
                saveFallbackRecords($all);
                echo json_encode(array('success' => true, 'message' => 'Record updated.'));
            } else {
                echo json_encode(array('success' => false, 'error' => 'Record not found.'));
            }
        }
        break;

    case 'stroke_training':
        $id = intval(isset($_POST['id']) ? $_POST['id'] : 0);
        $deleted = intval(isset($_POST['deleted']) ? $_POST['deleted'] : 1);
        if ($pdo) {
            try {
                $stmt = $pdo->prepare("UPDATE log SET deleted = ? WHERE id = ?");
                $stmt->execute(array($deleted, $id));
                echo json_encode(array('success' => true, 'id' => $id, 'deleted' => $deleted));
            } catch (Exception $e) {
                echo json_encode(array('success' => false, 'error' => $e->getMessage()));
            }
        } else {
            $all = getFallbackRecords();
            foreach ($all as &$r) {
                if (isset($r['id']) && intval($r['id']) === $id) {
                    $r['deleted'] = $deleted;
                    break;
                }
            }
            saveFallbackRecords($all);
            echo json_encode(array('success' => true, 'id' => $id, 'deleted' => $deleted));
        }
        break;

    case 'delete_training':
        $id = intval(isset($_POST['id']) ? $_POST['id'] : 0);
        if ($pdo) {
            try {
                $stmt = $pdo->prepare("DELETE FROM log WHERE id = ?");
                $stmt->execute(array($id));
                echo json_encode(array('success' => true, 'id' => $id, 'message' => 'Record deleted permanently.'));
            } catch (Exception $e) {
                echo json_encode(array('success' => false, 'error' => $e->getMessage()));
            }
        } else {
            $all = getFallbackRecords();
            $newList = array();
            foreach ($all as $r) {
                if (isset($r['id']) && intval($r['id']) === $id) continue;
                $newList[] = $r;
            }
            saveFallbackRecords($newList);
            echo json_encode(array('success' => true, 'id' => $id, 'message' => 'Record deleted permanently.'));
        }
        break;

    case 'get_autocomplete':
        $defaultInstructors = array('AHJ/HIRATA', 'AHJ/SATO', 'AHJ/FURUKAWA', 'AHJ/KINUGASA', 'AHJ/HASHIGUCHI', 'AHJ/YAMAZAKI', 'HRT/KATO');
        $defaultTrainees = array('Tokushima PD / Mech', 'Aero VXR', 'Toho Air', 'Nakanihon Air', 'Shizuoka Air', 'Hiroshima PD', 'Saitama Air');

        if ($pdo) {
            try {
                $instStmt = $pdo->query("SELECT DISTINCT instructor FROM log WHERE instructor != '' ORDER BY instructor ASC");
                $fetchedInst = $instStmt ? $instStmt->fetchAll(PDO::FETCH_COLUMN) : array();
                $instructors = array_unique(array_merge($defaultInstructors, $fetchedInst));

                $traineeStmt = $pdo->query("SELECT DISTINCT trainee FROM log WHERE trainee != '' ORDER BY trainee ASC");
                $fetchedTrainee = $traineeStmt ? $traineeStmt->fetchAll(PDO::FETCH_COLUMN) : array();
                $trainees = array_unique(array_merge($defaultTrainees, $fetchedTrainee));

                echo json_encode(array(
                    'success' => true,
                    'instructors' => array_values($instructors),
                    'trainees' => array_values($trainees)
                ));
            } catch (Exception $e) {
                echo json_encode(array('success' => true, 'instructors' => $defaultInstructors, 'trainees' => $defaultTrainees));
            }
        } else {
            $all = getFallbackRecords();
            $insts = $defaultInstructors;
            $trainees = $defaultTrainees;
            foreach ($all as $item) {
                if (!empty($item['instructor'])) $insts[] = $item['instructor'];
                if (!empty($item['trainee'])) $trainees[] = $item['trainee'];
            }
            echo json_encode(array(
                'success' => true,
                'instructors' => array_values(array_unique($insts)),
                'trainees' => array_values(array_unique($trainees))
            ));
        }
        break;

    case 'get_news':
        $newsFiles = array(
            __DIR__ . '/news.txt',
            dirname(__DIR__) . '/ffs/news.txt'
        );
        $newsContent = '';
        foreach ($newsFiles as $nf) {
            if (file_exists($nf)) {
                $newsContent = trim(@file_get_contents($nf));
                if (!empty($newsContent)) break;
            }
        }
        if (empty($newsContent)) {
            $newsContent = "ALL SYSTEMS NOMINAL. Daily pre-flight maintenance certified.";
        }
        echo json_encode(array('success' => true, 'news' => $newsContent));
        break;

    case 'save_news':
    case 'update_news':
        $news = isset($_POST['news']) ? trim($_POST['news']) : '';
        $lines = preg_split('/[\r\n]+/', $news);
        $formattedLines = array();
        foreach ($lines as $line) {
            $cleaned = trim(preg_replace('/^[\s•\-\*●]+/u', '', $line));
            if (!empty($cleaned)) {
                $formattedLines[] = "<li><h>" . htmlspecialchars($cleaned, ENT_QUOTES, 'UTF-8') . "</h></li>";
            }
        }
        $savedContent = implode("\n", $formattedLines);
        $newsFile = __DIR__ . '/news.txt';
        $written = @file_put_contents($newsFile, $savedContent);
        if ($written !== false) {
            echo json_encode(array('success' => true, 'news' => $savedContent));
        } else {
            echo json_encode(array('success' => false, 'error' => 'Failed to save maintenance log.'));
        }
        break;

    case 'get_stats':
        $month = isset($_REQUEST['month']) ? $_REQUEST['month'] : date('Y-m');
        $summary = computeMonthlySummaryData($month, $pdo);

        echo json_encode(array(
            'success' => true,
            'month' => $month,
            'summary' => $summary,
            'stats' => $summary['stats'],
            'formatted' => $summary['formatted']
        ));
        break;

    case 'export_csv':
        $month = isset($_GET['date']) ? $_GET['date'] : date('Y-m');
        $mode = isset($_GET['mode']) ? $_GET['mode'] : 'full'; // 'full' or 'summary'
        
        header('Content-Type: text/csv; charset=utf-8');
        if ($mode === 'summary') {
            header('Content-Disposition: attachment; filename="EC135_FFS_Monthly_Summary_' . str_replace('-', '_', $month) . '.csv"');
            $summary = computeMonthlySummaryData($month, $pdo);
            $output = fopen('php://output', 'w');
            
            fputcsv($output, array('DATE', 'Customer TRNG (h:m)', 'Internal TRNG (h:m)', 'OTHER (h:m)', 'MAINT (h:m)', 'DOWN (h:m)', 'AVIAL (%)', 'REMARKS'));
            foreach ($summary['days'] as $day) {
                fputcsv($output, array(
                    $day['label'],
                    $day['customer_str'],
                    $day['internal_str'],
                    $day['other_str'],
                    $day['maint_str'],
                    $day['down_str'],
                    $day['avail_str'],
                    $day['remarks']
                ));
            }
            fputcsv($output, array());
            fputcsv($output, array('SUBTOTAL', $summary['totals']['customer_str'], $summary['totals']['internal_str']));
            fputcsv($output, array('TOTAL', $summary['totals']['customer_plus_internal_str'], '', $summary['totals']['other_str'], $summary['totals']['maint_str'], $summary['totals']['down_str'], '', 'DRY TOTAL', $summary['totals']['dry_str']));
            fputcsv($output, array('MAX', '', '', '', '', '', $summary['metrics']['avail_max'], 'MTBF', $summary['metrics']['mtbf_str']));
            fputcsv($output, array('MIN', '', '', '', '', '', $summary['metrics']['avail_min'], 'MTTR', $summary['metrics']['mttr_str']));
            fputcsv($output, array('AVR', '', '', '', '', '', $summary['metrics']['avail_avg']));
            fclose($output);
            exit;
        }

        header('Content-Disposition: attachment; filename="EC135_FFS_Operation_Log_' . str_replace('-', '_', $month) . '.csv"');
        $output = fopen('php://output', 'w');
        fputcsv($output, array('Date', 'Instructor', 'Trainee', 'Start Time', 'End Time', 'Duration', 'Category', 'Type', 'Motion', 'Downtime', 'Feedback', 'Memo', 'Status'));
        
        $rows = array();
        if ($pdo) {
            $stmt = $pdo->prepare("SELECT * FROM log WHERE date LIKE ? ORDER BY date ASC, startTime ASC");
            $stmt->execute(array($month . '%'));
            $rows = $stmt->fetchAll();
        } else {
            $all = getFallbackRecords();
            foreach ($all as $r) {
                if (isset($r['date']) && substr($r['date'], 0, strlen($month)) === $month) {
                    $rows[] = $r;
                }
            }
        }

        foreach ($rows as $row) {
            $start = strtotime(isset($row['startTime']) ? $row['startTime'] : '00:00');
            $end   = strtotime(isset($row['endTime']) ? $row['endTime'] : '00:00');
            $delta = max(0, $end - $start);
            $min   = ($delta / 60) % 60;
            $hrs   = floor($delta / 3600);
            $dur   = sprintf("%02d:%02d", $hrs, $min);
            
            fputcsv($output, array(
                isset($row['date']) ? $row['date'] : '',
                isset($row['instructor']) ? $row['instructor'] : '',
                isset($row['trainee']) ? $row['trainee'] : '',
                isset($row['startTime']) ? $row['startTime'] : '',
                isset($row['endTime']) ? $row['endTime'] : '',
                $dur,
                isset($row['category']) ? $row['category'] : 'FFS C',
                isset($row['type']) ? $row['type'] : 'WET',
                !empty($row['motion']) ? 'YES' : 'NO',
                isset($row['downTime']) ? $row['downTime'] : '00:00',
                isset($row['feedback']) ? $row['feedback'] : 'GOOD',
                isset($row['memo']) ? $row['memo'] : '',
                !empty($row['deleted']) ? 'CANCELLED' : 'VALID'
            ));
        }
        fclose($output);
        exit;

    case 'view_summary':
    case 'export_monthly_summary':
        $month = isset($_GET['date']) ? $_GET['date'] : (isset($_GET['month']) ? $_GET['month'] : date('Y-m'));
        $summary = computeMonthlySummaryData($month, $pdo);
        $yearPart = substr($month, 0, 4);
        $monthPart = substr($month, 5, 2);
        $docTitle = "EC135 FFS Monthly Operation Summary - " . $month;

        if (!headers_sent()) {
            header('Content-Type: text/html; charset=utf-8');
            header('Content-Disposition: inline; filename="' . $docTitle . '.html"');
        }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?php echo htmlspecialchars($docTitle); ?></title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 15mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: "Times New Roman", Times, Georgia, serif;
            background: #f8fafc;
            color: #000000;
            margin: 0;
            padding: 15px 10px;
        }
        .no-print-toolbar {
            background: #0f172a;
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 8px;
            margin: 0 auto 20px auto;
            max-width: 210mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .no-print-toolbar button {
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 13px;
        }
        .summary-sheet {
            background: #ffffff;
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 30px auto;
            padding: 12mm 15mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            border: 1px solid #e2e8f0;
        }
        .period-header {
            text-align: center;
            font-size: 17px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000000;
            font-size: 11px;
        }
        .summary-table th, .summary-table td {
            border: 1px solid #000000;
            padding: 3.5px 4px;
            text-align: center;
            vertical-align: middle;
        }
        .th-date { width: 9%; background: #ffffff; }
        .th-cust { width: 14%; background: #ffff00; }
        .th-int  { width: 13%; background: #ffffcc; }
        .th-oth  { width: 11%; background: #38bdf8; }
        .th-maint{ width: 11%; background: #4ade80; }
        .th-down { width: 11%; background: #f87171; }
        .th-avail{ width: 12%; background: #fb923c; }
        .th-rem  { width: 19%; background: #ffffff; }

        .row-weekend td {
            background: #e2e8f0 !important;
        }
        .remarks-cell {
            text-align: left !important;
            padding-left: 6px !important;
            font-size: 10px;
        }

        /* Totals Block */
        .tot-hdr-cust { background: #ffff00; font-weight: bold; }
        .tot-hdr-int  { background: #ffffcc; font-weight: bold; }
        .tot-hdr-oth  { background: #38bdf8; font-weight: bold; }
        .tot-hdr-maint{ background: #4ade80; font-weight: bold; }
        .tot-hdr-down { background: #f87171; font-weight: bold; }
        .tot-hdr-avail{ background: #fb923c; font-weight: bold; }

        .subtotal-cust { background: #ffff00; font-weight: bold; }
        .subtotal-int  { background: #ffffcc; font-weight: bold; }

        .total-combined { background: #facc15; font-weight: bold; }
        .total-oth   { background: #38bdf8; font-weight: bold; }
        .total-maint { background: #4ade80; font-weight: bold; }
        .total-down  { background: #f87171; font-weight: bold; }

        @media print {
            body { background: #ffffff !important; padding: 0 !important; }
            .no-print-toolbar { display: none !important; }
            .summary-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; min-height: auto !important; }
        }
    </style>
</head>
<body>
    <div class="no-print-toolbar">
        <span>📄 <strong><?php echo htmlspecialchars($docTitle); ?></strong></span>
        <button onclick="window.print();">🖨️ Imprimer / Enregistrer en PDF</button>
    </div>

    <div class="summary-sheet">
        <div class="period-header">
            <?php echo htmlspecialchars($yearPart); ?>年&nbsp;&nbsp;&nbsp;&nbsp;<?php echo htmlspecialchars($monthPart); ?>月
        </div>

        <table class="summary-table">
            <thead>
                <tr>
                    <th class="th-date" rowspan="2">DATE</th>
                    <th class="th-cust">Customer TRNG</th>
                    <th class="th-int">Internal TRNG</th>
                    <th class="th-oth">OTHER</th>
                    <th class="th-maint">MAINT</th>
                    <th class="th-down">DOWN</th>
                    <th class="th-avail" rowspan="2">AVIAL(%)</th>
                    <th class="th-rem" rowspan="2">REMARKS</th>
                </tr>
                <tr>
                    <th class="th-cust"><small>h:m</small></th>
                    <th class="th-int"><small>h:m</small></th>
                    <th class="th-oth"><small>h:m</small></th>
                    <th class="th-maint"><small>h:m</small></th>
                    <th class="th-down"><small>h:m</small></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($summary['days'] as $day): ?>
                    <tr class="<?php echo $day['is_weekend'] ? 'row-weekend' : ''; ?>">
                        <td><?php echo htmlspecialchars($day['label']); ?></td>
                        <td><?php echo htmlspecialchars($day['customer_str']); ?></td>
                        <td><?php echo htmlspecialchars($day['internal_str']); ?></td>
                        <td><?php echo htmlspecialchars($day['other_str']); ?></td>
                        <td><?php echo htmlspecialchars($day['maint_str']); ?></td>
                        <td><?php echo htmlspecialchars($day['down_str']); ?></td>
                        <td><?php echo htmlspecialchars($day['avail_str']); ?></td>
                        <td class="remarks-cell"><?php echo htmlspecialchars($day['remarks']); ?></td>
                    </tr>
                <?php endforeach; ?>

                <!-- Summary Header Bar -->
                <tr>
                    <td style="border:none;"></td>
                    <td class="tot-hdr-cust">Customer TRNG</td>
                    <td class="tot-hdr-int">Internal TRNG</td>
                    <td class="tot-hdr-oth">OTHER</td>
                    <td class="tot-hdr-maint">MAINT</td>
                    <td class="tot-hdr-down">DOWN</td>
                    <td class="tot-hdr-avail">AVIAL(%)</td>
                    <td style="border:none;"></td>
                </tr>
                
                <!-- SUBTOTAL -->
                <tr>
                    <td style="font-weight:bold;">SUBTOTAL</td>
                    <td class="subtotal-cust"><?php echo htmlspecialchars($summary['totals']['customer_str']); ?></td>
                    <td class="subtotal-int"><?php echo htmlspecialchars($summary['totals']['internal_str']); ?></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>

                <!-- TOTAL & DRY TOTAL -->
                <tr>
                    <td style="font-weight:bold;">TOTAL</td>
                    <td colspan="2" class="total-combined"><?php echo htmlspecialchars($summary['totals']['customer_plus_internal_str']); ?></td>
                    <td class="total-oth"><?php echo htmlspecialchars($summary['totals']['other_str']); ?></td>
                    <td class="total-maint"><?php echo htmlspecialchars($summary['totals']['maint_str']); ?></td>
                    <td class="total-down"><?php echo htmlspecialchars($summary['totals']['down_str']); ?></td>
                    <td></td>
                    <td style="font-weight:bold; padding:0;">
                        <table style="width:100%; border-collapse:collapse; height:100%;">
                            <tr>
                                <td style="border:none; border-right:1px solid #000; width:50%; font-weight:bold;">DRY TOTAL</td>
                                <td style="border:none; width:50%; font-weight:bold;"><?php echo htmlspecialchars($summary['totals']['dry_str']); ?></td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- MAX & MTBF -->
                <tr>
                    <td style="font-weight:bold;">MAX</td>
                    <td colspan="5"></td>
                    <td style="font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['avail_max']); ?></td>
                    <td style="padding:0;">
                        <table style="width:100%; border-collapse:collapse; height:100%;">
                            <tr>
                                <td style="border:none; border-right:1px solid #000; width:50%; font-weight:bold;">MTBF</td>
                                <td style="border:none; width:50%; font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['mtbf_str']); ?></td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- MIN & MTTR -->
                <tr>
                    <td style="font-weight:bold;">MIN</td>
                    <td colspan="5"></td>
                    <td style="font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['avail_min']); ?></td>
                    <td style="padding:0;">
                        <table style="width:100%; border-collapse:collapse; height:100%;">
                            <tr>
                                <td style="border:none; border-right:1px solid #000; width:50%; font-weight:bold;">MTTR</td>
                                <td style="border:none; width:50%; font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['mttr_str']); ?></td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- AVR -->
                <tr>
                    <td style="font-weight:bold;">AVR</td>
                    <td colspan="5"></td>
                    <td style="font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['avail_avg']); ?></td>
                    <td></td>
                </tr>
            </tbody>
        </table>
    </div>

    <script>
        document.title = <?php echo json_encode($docTitle); ?>;
    </script>
</body>
</html>
<?php
        exit;

    case 'export_pdf':
    case 'view_print':
        $dateParam = isset($_GET['date']) ? $_GET['date'] : date('Y-m');
        $isMonth = (strlen($dateParam) <= 7);
        $month = $isMonth ? $dateParam : substr($dateParam, 0, 7);
        $docTitle = "EC135 FFS SIM Operation Log - " . $dateParam;

        if (!headers_sent()) {
            header('Content-Type: text/html; charset=utf-8');
            header('Content-Disposition: inline; filename="' . $docTitle . '.html"');
        }

        $summary = $isMonth ? computeMonthlySummaryData($month, $pdo) : null;
        $yearPart = substr($month, 0, 4);
        $monthPart = substr($month, 5, 2);

        $rows = array();
        if ($pdo) {
            $stmt = $pdo->prepare("SELECT * FROM log WHERE date LIKE ? AND deleted = 0 ORDER BY date ASC, startTime ASC");
            $stmt->execute(array($dateParam . '%'));
            $rows = $stmt->fetchAll();
        } else {
            $all = getFallbackRecords();
            foreach ($all as $r) {
                if (isset($r['date']) && substr($r['date'], 0, strlen($dateParam)) === $dateParam && empty($r['deleted'])) {
                    $rows[] = $r;
                }
            }
        }

        function formatDurationDelta($delta) {
            if (!$delta || $delta <= 0) return "00 + 00";
            $durationM = (($delta / 60) % 60);
            $durationH = floor($delta / 3600);
            return sprintf("%02d + %02d", $durationH, $durationM);
        }

        function formatDowntimeStr($dtStr) {
            if (empty($dtStr) || $dtStr === '00:00' || $dtStr === '00:00:00') {
                return "00 + 00";
            }
            $parts = explode(':', $dtStr);
            $h = isset($parts[0]) ? intval($parts[0]) : 0;
            $m = isset($parts[1]) ? intval($parts[1]) : 0;
            return sprintf("%02d + %02d", $h, $m);
        }

        // Group records by day
        $grouped = array();
        foreach ($rows as $row) {
            $d = $row['date'];
            $typeUpper = strtoupper(isset($row['type']) ? $row['type'] : 'WET');
            if ($typeUpper === 'MAINTENANCE') continue;

            if (!isset($grouped[$d])) {
                $grouped[$d] = array(
                    'date' => $d,
                    'records' => array(),
                    'tot_revenue' => 0,
                    'tot_non_revenue' => 0,
                    'tot_downtime' => 0
                );
            }
            $start = strtotime(isset($row['startTime']) ? $row['startTime'] : '00:00');
            $end   = strtotime(isset($row['endTime']) ? $row['endTime'] : '00:00');
            $delta = max(0, $end - $start);
            $isRevenue = ($typeUpper === 'WET' || $typeUpper === 'DRY');

            if ($isRevenue) {
                $grouped[$d]['tot_revenue'] += $delta;
            } else {
                $grouped[$d]['tot_non_revenue'] += $delta;
            }

            $downSec = 0;
            if (!empty($row['downTime']) && $row['downTime'] !== '00:00' && $row['downTime'] !== '00:00:00') {
                $dt = explode(':', $row['downTime']);
                if (count($dt) >= 2) {
                    $downSec = (intval($dt[0]) * 3600) + (intval($dt[1]) * 60);
                    $grouped[$d]['tot_downtime'] += $downSec;
                }
            }

            $memo = isset($row['memo']) ? $row['memo'] : '';
            if ($typeUpper === 'DRY') {
                $dryTag = "DRY (" . (isset($row['instructor']) ? $row['instructor'] : '') . ")";
                if (strpos($memo, 'DRY') === false) {
                    $memo = trim($memo) !== '' ? ($memo . ', ' . $dryTag) : $dryTag;
                }
            }

            $instFormatted = str_replace('/', ' / ', isset($row['instructor']) ? $row['instructor'] : '');
            $traineeFormatted = str_replace('/', ' / ', isset($row['trainee']) ? $row['trainee'] : '');
            $sTime = substr(isset($row['startTime']) ? $row['startTime'] : '00:00', 0, 5);
            $eTime = substr(isset($row['endTime']) ? $row['endTime'] : '00:00', 0, 5);

            $grouped[$d]['records'][] = array(
                'instructor' => $instFormatted,
                'trainee' => $traineeFormatted,
                'time' => $sTime . ' ~ ' . $eTime,
                'revenue_str' => $isRevenue ? formatDurationDelta($delta) : '+',
                'non_revenue_str' => !$isRevenue ? formatDurationDelta($delta) : '+',
                'downtime_str' => formatDowntimeStr(isset($row['downTime']) ? $row['downTime'] : ''),
                'memo' => $memo,
                'motion' => (!empty($row['motion']) && $row['motion'] != 0) ? '✓' : '',
                'category' => isset($row['category']) ? $row['category'] : 'FFS C'
            );
        }

        // Load logo as base64 for reliable print rendering
        $logoPath = __DIR__ . '/logo_blue.png';
        if (!file_exists($logoPath)) {
            $logoPath = dirname(__DIR__) . '/ffs/logo_blue.png';
        }
        $logoBase64 = file_exists($logoPath) ? base64_encode(file_get_contents($logoPath)) : '';
        $logoSrc = $logoBase64 ? 'data:image/png;base64,' . $logoBase64 : 'logo_blue.png';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?php echo htmlspecialchars($docTitle); ?></title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 15mm;
        }
        @page portrait-sheet {
            size: A4 portrait;
            margin: 12mm 15mm;
        }
        @page landscape-sheet {
            size: A4 landscape;
            margin: 28mm 15mm 12mm 15mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: "Times New Roman", Times, Georgia, serif;
            background: #f1f5f9;
            color: #000000;
            margin: 0;
            padding: 20px 10px;
        }
        .no-print-toolbar {
            background: #0f172a;
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 8px;
            margin: 0 auto 20px auto;
            max-width: 297mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .no-print-toolbar button {
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.15s;
        }
        .no-print-toolbar button:hover {
            background: #0369a1;
        }

        /* 1st Page: Monthly Summary Sheet (Exact A4 Portrait) */
        .portrait-page {
            page: portrait-sheet;
            background: #ffffff;
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 30px auto;
            padding: 12mm 15mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            border: 1px solid #e2e8f0;
            page-break-after: always;
            break-after: page;
        }
        .period-header {
            text-align: center;
            font-size: 17px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000000;
            font-size: 11px;
        }
        .summary-table th, .summary-table td {
            border: 1px solid #000000;
            padding: 3.5px 4px;
            text-align: center;
            vertical-align: middle;
        }
        .th-date { width: 9%; background: #ffffff; }
        .th-cust { width: 14%; background: #ffff00; }
        .th-int  { width: 13%; background: #ffffcc; }
        .th-oth  { width: 11%; background: #38bdf8; }
        .th-maint{ width: 11%; background: #4ade80; }
        .th-down { width: 11%; background: #f87171; }
        .th-avail{ width: 12%; background: #fb923c; }
        .th-rem  { width: 19%; background: #ffffff; }

        .row-weekend td {
            background: #e2e8f0 !important;
        }
        .remarks-cell {
            text-align: left !important;
            padding-left: 6px !important;
            font-size: 10px;
        }

        .tot-hdr-cust { background: #ffff00; font-weight: bold; }
        .tot-hdr-int  { background: #ffffcc; font-weight: bold; }
        .tot-hdr-oth  { background: #38bdf8; font-weight: bold; }
        .tot-hdr-maint{ background: #4ade80; font-weight: bold; }
        .tot-hdr-down { background: #f87171; font-weight: bold; }
        .tot-hdr-avail{ background: #fb923c; font-weight: bold; }

        .subtotal-cust { background: #ffff00; font-weight: bold; }
        .subtotal-int  { background: #ffffcc; font-weight: bold; }

        .total-combined { background: #facc15; font-weight: bold; }
        .total-oth   { background: #38bdf8; font-weight: bold; }
        .total-maint { background: #4ade80; font-weight: bold; }
        .total-down  { background: #f87171; font-weight: bold; }

        /* Subsequent Pages: Daily Operation Log Sheets (Exact A4 Landscape) */
        .landscape-page {
            page: landscape-sheet;
            background: #ffffff;
            width: 297mm;
            min-height: 210mm;
            margin: 0 auto 30px auto;
            padding: 28mm 15mm 15mm 15mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            border: 1px solid #e2e8f0;
            page-break-before: always;
            break-before: page;
            page-break-after: always;
            break-after: page;
        }
        .landscape-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
        }
        
        /* Airbus Header */
        .brand-row {
            display: flex;
            align-items: flex-end;
            gap: 25px;
            margin-bottom: 6px;
        }
        .airbus-logo-img {
            height: 28px;
            width: auto;
            display: block;
        }
        .brand-helicopters {
            font-family: "Times New Roman", Times, Georgia, serif;
            font-size: 20px;
            font-weight: bold;
            color: #000000;
            line-height: 1;
            margin-bottom: 2px;
        }
        
        .hdr-divider {
            border: none;
            border-top: 1.5px solid #000000;
            margin: 4px 0 6px 0;
        }
        
        .meta-header-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            align-items: center;
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 0.5px;
            padding: 2px 0;
        }
        .meta-header-grid .meta-left {
            text-align: left;
        }
        .meta-header-grid .meta-center {
            text-align: center;
        }
        .meta-header-grid .meta-right {
            text-align: right;
        }
        
        /* Official Report Table */
        .op-table-landscape {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11.5px;
        }
        .op-table-landscape th {
            background: #d9d9d9;
            color: #000000;
            font-weight: bold;
            border: 1px solid #000000;
            padding: 6px 4px;
            text-align: center;
            vertical-align: middle;
            font-size: 10.5px;
            letter-spacing: 0.3px;
        }
        .op-table-landscape td {
            border: 1px solid #000000;
            padding: 5px 6px;
            text-align: center;
            vertical-align: middle;
            color: #000000;
        }
        .op-table-landscape td.memo-text {
            text-align: left;
            padding-left: 8px;
            font-size: 11px;
        }
        .op-table-landscape tr.total-row td {
            font-weight: bold;
            background: #ffffff;
            border: 1px solid #000000;
            padding: 5px 6px;
        }
        .op-table-landscape tr.total-row td.total-title {
            text-align: right;
            padding-right: 10px;
            letter-spacing: 0.5px;
        }

        @media print {
            body {
                background: #ffffff !important;
                padding: 0 !important;
            }
            .no-print-toolbar {
                display: none !important;
            }
            .portrait-page {
                page: portrait-sheet;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
            }
            .landscape-page {
                page: landscape-sheet;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
            }
        }
    </style>
</head>
<body>
    <div class="no-print-toolbar">
        <span>📄 <strong><?php echo htmlspecialchars($docTitle); ?></strong> (<?php echo ($summary ? 'Totalisation Portrait + ' : '') . count($grouped); ?> page(s) journal)</span>
        <button onclick="window.print();">🖨️ Imprimer / Enregistrer en PDF</button>
    </div>

    <?php if ($summary): ?>
        <!-- PAGE 1: MONTHLY TOTALIZATION & AVAILABILITY SUMMARY (PORTRAIT A4) -->
        <div class="portrait-page">
            <div class="period-header">
                <?php echo htmlspecialchars($yearPart); ?>年&nbsp;&nbsp;&nbsp;&nbsp;<?php echo htmlspecialchars($monthPart); ?>月
            </div>

            <table class="summary-table">
                <thead>
                    <tr>
                        <th class="th-date" rowspan="2">DATE</th>
                        <th class="th-cust">Customer TRNG</th>
                        <th class="th-int">Internal TRNG</th>
                        <th class="th-oth">OTHER</th>
                        <th class="th-maint">MAINT</th>
                        <th class="th-down">DOWN</th>
                        <th class="th-avail" rowspan="2">AVIAL(%)</th>
                        <th class="th-rem" rowspan="2">REMARKS</th>
                    </tr>
                    <tr>
                        <th class="th-cust"><small>h:m</small></th>
                        <th class="th-int"><small>h:m</small></th>
                        <th class="th-oth"><small>h:m</small></th>
                        <th class="th-maint"><small>h:m</small></th>
                        <th class="th-down"><small>h:m</small></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($summary['days'] as $day): ?>
                        <tr class="<?php echo $day['is_weekend'] ? 'row-weekend' : ''; ?>">
                            <td><?php echo htmlspecialchars($day['label']); ?></td>
                            <td><?php echo htmlspecialchars($day['customer_str']); ?></td>
                            <td><?php echo htmlspecialchars($day['internal_str']); ?></td>
                            <td><?php echo htmlspecialchars($day['other_str']); ?></td>
                            <td><?php echo htmlspecialchars($day['maint_str']); ?></td>
                            <td><?php echo htmlspecialchars($day['down_str']); ?></td>
                            <td><?php echo htmlspecialchars($day['avail_str']); ?></td>
                            <td class="remarks-cell"><?php echo htmlspecialchars($day['remarks']); ?></td>
                        </tr>
                    <?php endforeach; ?>

                    <!-- Summary Header Bar -->
                    <tr>
                        <td style="border:none;"></td>
                        <td class="tot-hdr-cust">Customer TRNG</td>
                        <td class="tot-hdr-int">Internal TRNG</td>
                        <td class="tot-hdr-oth">OTHER</td>
                        <td class="tot-hdr-maint">MAINT</td>
                        <td class="tot-hdr-down">DOWN</td>
                        <td class="tot-hdr-avail">AVIAL(%)</td>
                        <td style="border:none;"></td>
                    </tr>
                    
                    <!-- SUBTOTAL -->
                    <tr>
                        <td style="font-weight:bold;">SUBTOTAL</td>
                        <td class="subtotal-cust"><?php echo htmlspecialchars($summary['totals']['customer_str']); ?></td>
                        <td class="subtotal-int"><?php echo htmlspecialchars($summary['totals']['internal_str']); ?></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>

                    <!-- TOTAL & DRY TOTAL -->
                    <tr>
                        <td style="font-weight:bold;">TOTAL</td>
                        <td colspan="2" class="total-combined"><?php echo htmlspecialchars($summary['totals']['customer_plus_internal_str']); ?></td>
                        <td class="total-oth"><?php echo htmlspecialchars($summary['totals']['other_str']); ?></td>
                        <td class="total-maint"><?php echo htmlspecialchars($summary['totals']['maint_str']); ?></td>
                        <td class="total-down"><?php echo htmlspecialchars($summary['totals']['down_str']); ?></td>
                        <td></td>
                        <td style="font-weight:bold; padding:0;">
                            <table style="width:100%; border-collapse:collapse; height:100%;">
                                <tr>
                                    <td style="border:none; border-right:1px solid #000; width:50%; font-weight:bold;">DRY TOTAL</td>
                                    <td style="border:none; width:50%; font-weight:bold;"><?php echo htmlspecialchars($summary['totals']['dry_str']); ?></td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- MAX & MTBF -->
                    <tr>
                        <td style="font-weight:bold;">MAX</td>
                        <td colspan="5"></td>
                        <td style="font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['avail_max']); ?></td>
                        <td style="padding:0;">
                            <table style="width:100%; border-collapse:collapse; height:100%;">
                                <tr>
                                    <td style="border:none; border-right:1px solid #000; width:50%; font-weight:bold;">MTBF</td>
                                    <td style="border:none; width:50%; font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['mtbf_str']); ?></td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- MIN & MTTR -->
                    <tr>
                        <td style="font-weight:bold;">MIN</td>
                        <td colspan="5"></td>
                        <td style="font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['avail_min']); ?></td>
                        <td style="padding:0;">
                            <table style="width:100%; border-collapse:collapse; height:100%;">
                                <tr>
                                    <td style="border:none; border-right:1px solid #000; width:50%; font-weight:bold;">MTTR</td>
                                    <td style="border:none; width:50%; font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['mttr_str']); ?></td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- AVR -->
                    <tr>
                        <td style="font-weight:bold;">AVR</td>
                        <td colspan="5"></td>
                        <td style="font-weight:bold;"><?php echo htmlspecialchars($summary['metrics']['avail_avg']); ?></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
    <?php endif; ?>

    <!-- SUBSEQUENT PAGES: DAILY FLIGHT LOGS (LANDSCAPE A4) -->
    <?php if (empty($grouped)): ?>
        <?php if (!$summary): ?>
            <div class="landscape-page" style="text-align:center; padding: 50px 20px; font-family: sans-serif; color: #64748b;">
                <h2>Aucun enregistrement d'exploitation pour la date <strong><?php echo htmlspecialchars($dateParam); ?></strong>.</h2>
            </div>
        <?php endif; ?>
    <?php else: ?>
        <?php foreach ($grouped as $dayData): ?>
            <div class="landscape-page">
                <div class="brand-row">
                    <img src="<?php echo $logoSrc; ?>" alt="AIRBUS" class="airbus-logo-img">
                    <span class="brand-helicopters">Helicopters</span>
                </div>
                <hr class="hdr-divider">
                <div class="meta-header-grid">
                    <div class="meta-left">DATE : <?php echo htmlspecialchars($dayData['date']); ?></div>
                    <div class="meta-center">EC135 FFS</div>
                    <div class="meta-right">OPERATION LOG</div>
                </div>
                <hr class="hdr-divider">

                <table class="op-table-landscape">
                    <thead>
                        <tr>
                            <th style="width: 14%;">ORGANIZATION<br>INSTRUCTOR</th>
                            <th style="width: 17%;">ORGANIZATION<br>TRAINEE</th>
                            <th style="width: 12%;">TIME</th>
                            <th style="width: 9%;">REVENUE<br>TRAINING</th>
                            <th style="width: 9%;">NON<br>REVENUE</th>
                            <th style="width: 9%;">DOWN<br>TIME</th>
                            <th>MEMO</th>
                            <th style="width: 6%;">MOTION</th>
                            <th style="width: 6%;">MODE</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($dayData['records'] as $rec): ?>
                            <tr>
                                <td><?php echo htmlspecialchars($rec['instructor']); ?></td>
                                <td><?php echo htmlspecialchars($rec['trainee']); ?></td>
                                <td><?php echo htmlspecialchars($rec['time']); ?></td>
                                <td><?php echo htmlspecialchars($rec['revenue_str']); ?></td>
                                <td><?php echo htmlspecialchars($rec['non_revenue_str']); ?></td>
                                <td><?php echo htmlspecialchars($rec['downtime_str']); ?></td>
                                <td class="memo-text"><?php echo htmlspecialchars($rec['memo']); ?></td>
                                <td><span style="font-weight:bold; font-size:13px;"><?php echo $rec['motion']; ?></span></td>
                                <td><?php echo htmlspecialchars($rec['category']); ?></td>
                            </tr>
                        <?php endforeach; ?>
                        <tr class="total-row">
                            <td colspan="3" class="total-title">TOTAL:</td>
                            <td><?php echo formatDurationDelta($dayData['tot_revenue']); ?></td>
                            <td><?php echo formatDurationDelta($dayData['tot_non_revenue']); ?></td>
                            <td><?php echo formatDurationDelta($dayData['tot_downtime']); ?></td>
                            <td colspan="3"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        <?php endforeach; ?>
    <?php endif; ?>

    <script>
        document.title = <?php echo json_encode($docTitle); ?>;
    </script>
</body>
</html>
<?php
        exit;

    default:
        echo json_encode(array('success' => false, 'error' => 'Unknown action.'));
        break;
}
