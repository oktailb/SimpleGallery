<?php
namespace SimpleGallery\Kernel\FS;

/**
 * SimpleGallery WebOS - App Data & Runtime Storage Repository
 * Handles persistent data storage for applications inside `storage/apps/<app_id>/` or `storage/`.
 */
class StorageRepository {

    /** @var string */
    protected $appId;
    /** @var string */
    protected $baseDir;
    /** @var string */
    protected $storageDir;

    public function __construct(string $app_id = '', string $base_dir = '') {
        $this->appId = preg_replace('/[^a-zA-Z0-9_\.-]/', '', $app_id);
        $project_root = dirname(dirname(dirname(__DIR__)));
        $root = ($base_dir !== '') ? $base_dir : $project_root;

        if ($this->appId !== '') {
            $this->storageDir = $root . '/storage/apps/' . $this->appId;
        } else {
            $this->storageDir = $root . '/storage';
        }

        if (!is_dir($this->storageDir)) {
            @mkdir($this->storageDir, 0755, true);
        }
    }

    /**
     * Create a repository scoped to a specific application
     */
    public static function forApp(string $app_id, string $base_dir = ''): self {
        return new self($app_id, $base_dir);
    }

    /**
     * Get the absolute path to a file in storage
     */
    public function getPath(string $filename): string {
        $clean_name = preg_replace('/[^a-zA-Z0-9_\.-]/', '', $filename);
        return $this->storageDir . '/' . $clean_name;
    }

    /**
     * Get the storage directory for this app
     */
    public function getDirectory(): string {
        return $this->storageDir;
    }

    /**
     * Get and decode a JSON storage file
     */
    public function getJson(string $filename, $default = null) {
        $path = $this->getPath($filename);
        if (!str_ends_with($path, '.json')) {
            $path .= '.json';
        }

        if (file_exists($path) && is_readable($path)) {
            $content = @file_get_contents($path);
            if ($content !== false && trim($content) !== '') {
                $decoded = json_decode($content, true);
                if ($decoded !== null || $content === 'null') {
                    return $decoded;
                }
            }
        }
        return $default;
    }

    /**
     * Save data to a JSON storage file with atomic lock
     */
    public function setJson(string $filename, $value): bool {
        $path = $this->getPath($filename);
        if (!str_ends_with($path, '.json')) {
            $path .= '.json';
        }

        $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($encoded === false) return false;

        return (@file_put_contents($path, $encoded, LOCK_EX) !== false);
    }

    /**
     * Alias for setJson
     */
    public function saveJson(string $filename, $value): bool {
        return $this->setJson($filename, $value);
    }

    /**
     * Read raw file contents
     */
    public function getRaw(string $filename, ?string $default = null): ?string {
        $path = $this->getPath($filename);
        if (file_exists($path) && is_readable($path)) {
            $data = @file_get_contents($path);
            return ($data !== false) ? $data : $default;
        }
        return $default;
    }

    /**
     * Write raw file contents
     */
    public function setRaw(string $filename, string $content): bool {
        $path = $this->getPath($filename);
        return (@file_put_contents($path, $content, LOCK_EX) !== false);
    }

    /**
     * Delete a storage file
     */
    public function delete(string $filename): bool {
        $path = $this->getPath($filename);
        if (file_exists($path)) {
            return @unlink($path);
        }
        return true;
    }
}
