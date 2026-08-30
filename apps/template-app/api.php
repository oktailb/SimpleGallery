<?php
/**
 * SimpleGallery WebOS - Template App Private Backend Endpoint
 * Reference implementation of an isolated application API utilizing AppEndpoint & StorageRepository.
 */

if (!defined('SIMPLE_GALLERY_CORE')) {
    define('SIMPLE_GALLERY_CORE', true);
}

require_once dirname(__DIR__, 2) . '/system/boot/bootstrap.php';
require_once dirname(__DIR__, 2) . '/system/kernel/Api/AppEndpoint.php';
require_once dirname(__DIR__, 2) . '/system/kernel/FS/StorageRepository.php';

use SimpleGallery\Kernel\Api\AppEndpoint;
use SimpleGallery\Kernel\FS\StorageRepository;

AppEndpoint::handle('template-app', function(string $action, array $params, array $context): ?array {
    $storage = StorageRepository::forApp('template-app', $context['base_dir']);

    switch ($action) {
        // 1. Get Notes List
        case 'template_get_notes':
            $notes = $storage->getJson('notes.json', [
                [
                    'id'        => 'note-1',
                    'title'     => 'Bienvenue dans SimpleGallery WebOS',
                    'content'   => 'Ceci est une note persistée dans storage/apps/template-app/notes.json.',
                    'timestamp' => time() - 3600
                ]
            ]);
            return [
                'status' => 200,
                'data'   => ['success' => true, 'notes' => $notes]
            ];

        // 2. Add / Update Note
        case 'template_save_note':
            $title   = trim((string)($params['title'] ?? ''));
            $content = trim((string)($params['content'] ?? ''));
            if ($title === '') {
                return [
                    'status' => 400,
                    'data'   => ['success' => false, 'error' => 'Le titre de la note ne peut pas être vide.']
                ];
            }

            $notes = $storage->getJson('notes.json', []);
            $newNote = [
                'id'        => 'note-' . time() . '-' . substr(bin2hex(random_bytes(3)), 0, 4),
                'title'     => $title,
                'content'   => $content,
                'timestamp' => time()
            ];
            array_unshift($notes, $newNote);
            // Keep at most 50 notes
            $notes = array_slice($notes, 0, 50);

            $saved = $storage->saveJson('notes.json', $notes);
            return [
                'status' => $saved ? 200 : 500,
                'data'   => [
                    'success' => $saved,
                    'note'    => $newNote,
                    'notes'   => $notes,
                    'error'   => $saved ? null : 'Erreur lors de l\'enregistrement sur le disque.'
                ]
            ];

        // 3. Clear Notes
        case 'template_clear_notes':
            $saved = $storage->saveJson('notes.json', []);
            return [
                'status' => 200,
                'data'   => ['success' => true, 'notes' => []]
            ];

        // 4. Ping App Diagnostic
        case 'template_ping':
            return [
                'status' => 200,
                'data'   => [
                    'success'   => true,
                    'message'   => 'Template App API is operational.',
                    'app_id'    => 'template-app',
                    'timestamp' => time(),
                    'user'      => $context['is_admin'] ? 'Administrator' : 'Guest'
                ]
            ];

        default:
            return null; // Passes through to 404
    }
}, [
    'mutating_actions' => ['template_save_note', 'template_clear_notes']
]);
