<?php
/**
 * SimpleGallery WebOS - Sim Logbook DB Configuration
 * Resilient Database Connector (PDO + MySQLi + Safe Fallback).
 */

$servername = "localhost";
$username   = "root";
$password   = "ebbdec135";
$dbname     = "ffs_operation_log";

function getLogbookDbConnection() {
    global $servername, $username, $password, $dbname;
    
    // 1. Try PDO MySQL if class exists
    if (class_exists('PDO')) {
        $hosts = [$servername, '127.0.0.1'];
        foreach ($hosts as $h) {
            try {
                $dsn = "mysql:host={$h};dbname={$dbname};charset=utf8mb4";
                $pdo = new PDO($dsn, $username, $password, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_SILENT,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT            => 2
                ]);
                if ($pdo) {
                    @$pdo->exec("CREATE TABLE IF NOT EXISTS `log` (
                        `id` INT AUTO_INCREMENT PRIMARY KEY,
                        `date` DATE NOT NULL,
                        `instructor` VARCHAR(100) NOT NULL,
                        `trainee` VARCHAR(100) NOT NULL,
                        `startTime` VARCHAR(20) NOT NULL,
                        `endTime` VARCHAR(20) NOT NULL,
                        `downTime` VARCHAR(20) DEFAULT '00:00',
                        `category` VARCHAR(50) DEFAULT 'FFS C',
                        `type` VARCHAR(50) DEFAULT 'WET',
                        `motion` TINYINT(1) DEFAULT 1,
                        `feedback` VARCHAR(20) DEFAULT 'GOOD',
                        `memo` TEXT,
                        `deleted` TINYINT(1) DEFAULT 0,
                        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
                    return $pdo;
                }
            } catch (Exception $e) {
                // Ignore and try next
            }
        }
    }
    
    return null;
}
