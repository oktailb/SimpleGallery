<?php
/**
 * SimpleGallery WebOS - Tribune Libre Private API Gateway
 */

$project_root = dirname(dirname(__DIR__));
require_once $project_root . '/system/boot/bootstrap.php';
require_once $project_root . '/system/kernel/functions.php';
require_once __DIR__ . '/backend/TribuneActions.php';

use SimpleGallery\Kernel\Api\AppEndpoint;
use SimpleGallery\Apps\Tribune\Backend\TribuneActions;

AppEndpoint::handle('tribune', function(string $action, array $params, array $context): ?array {
    return TribuneActions::handle($action, $params, $context);
}, [
    'mutating_actions' => [
        'tribune_post',
        'tribune_proxy_post',
        'tribune_file_upload',
        'tribune_schedule_post',
        'tribune_schedule_cancel',
        'tribune_boards_save',
        'tribune_clear_history'
    ]
]);
