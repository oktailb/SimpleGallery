<?php
namespace SimpleGallery\Kernel\Security;

/**
 * Kernel Rate Limiter
 * IP-based rate limiting to protect against brute-force and spamming attacks.
 */
class RateLimiter {

    public static function getClientIp(): string {
        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    public static function getStorageFile(string $key): string {
        $ip = self::getClientIp();
        $hash = md5($ip . '_' . $key);
        return sys_get_temp_dir() . '/sg_limit_' . $hash . '.json';
    }

    public static function getRateLimitFile(string $key): string {
        return self::getStorageFile($key);
    }

    public static function check(string $key, int $max_attempts = 5, int $decay_seconds = 900): bool {
        $file = self::getStorageFile($key);
        if (!file_exists($file)) {
            return true;
        }
        $content = @file_get_contents($file);
        if (!$content) return true;
        $data = @json_decode($content, true);
        if (!is_array($data)) return true;

        $now = time();
        if ($now - ($data['first_attempt'] ?? 0) > $decay_seconds) {
            @unlink($file);
            return true;
        }
        return ($data['attempts'] ?? 0) < $max_attempts;
    }

    public static function checkRateLimit(string $key, int $max_attempts = 5, int $decay_seconds = 900): bool {
        return self::check($key, $max_attempts, $decay_seconds);
    }

    public static function increment(string $key): void {
        $file = self::getStorageFile($key);
        $now = time();
        $data = ['attempts' => 1, 'first_attempt' => $now];
        if (file_exists($file)) {
            $content = @file_get_contents($file);
            if ($content) {
                $existing = @json_decode($content, true);
                if (is_array($existing)) {
                    $data['attempts'] = ($existing['attempts'] ?? 0) + 1;
                    $data['first_attempt'] = $existing['first_attempt'] ?? $now;
                }
            }
        }
        @file_put_contents($file, json_encode($data), LOCK_EX);
    }

    public static function incrementRateLimit(string $key): void {
        self::increment($key);
    }

    public static function reset(string $key): void {
        $file = self::getStorageFile($key);
        if (file_exists($file)) {
            @unlink($file);
        }
    }

    public static function resetRateLimit(string $key): void {
        self::reset($key);
    }
}
