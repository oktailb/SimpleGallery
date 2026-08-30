<?php
namespace SimpleGallery\Kernel\Actions;

class ActionRouter {

    public const MUTATING_ACTIONS = [
        'change_password',
        'update_dotfile',
        'lock_folder',
        'unlock_folder',
        'logout',
        'login',
        'upload_file',
        'upload_media',
        'create_folder',
        'move_item',
        'delete_item',
        'delete_file',
        'delete_folder',
        'save_permissions',
        'edit_image',
        'save_text_file',
        'save_comment',
        'save_folder_settings',
        'save_desktop_shortcuts',
        'save_autostart_settings',
        'clear_all_caches',
        'tribune_clear_history',
        'tribune_boards_save',
        'tribune_file_upload',
        'tribune_schedule_post',
        'tribune_schedule_cancel',
        'tribune_proxy_post'
    ];

    /**
     * O(1) Action Map to domain controller classes
     */
    private const ACTION_MAP = [
        // Gallery & Exploration
        'get_gallery'             => GalleryActions::class,
        'get_metadata'            => GalleryActions::class,
        'get_all_media_flat'      => GalleryActions::class,
        'get_stream_url'          => GalleryActions::class,

        // Auth & System Administration
        'login'                   => AuthActions::class,
        'logout'                  => AuthActions::class,
        'change_password'         => AuthActions::class,
        'save_permissions'        => AuthActions::class,
        'get_autostart_settings'  => AuthActions::class,
        'save_autostart_settings' => AuthActions::class,

        // System, Telemetry & i18n
        'get_locales'             => SystemActions::class,
        'get_locale'              => SystemActions::class,
        'get_theme'               => SystemActions::class,
        'get_system_info'         => SystemActions::class,
        'clear_all_caches'        => SystemActions::class,
        'save_desktop_shortcuts'  => SystemActions::class,
        'get_desktop_shortcuts'   => SystemActions::class,

        // Media & Search
        'search_media'            => MediaActions::class,
        'view_file'               => MediaActions::class,
        'raw_file'                => MediaActions::class,

        // File CRUD & Dotfiles
        'unlock_folder'           => FileActions::class,
        'lock_folder'             => FileActions::class,
        'update_dotfile'          => FileActions::class,
        'save_folder_settings'    => FileActions::class,
        'save_comment'            => FileActions::class,
        'save_text_file'          => FileActions::class,
        'edit_image'              => FileActions::class,
        'delete_item'             => FileActions::class,
        'delete_file'             => FileActions::class,
        'delete_folder'           => FileActions::class,
        'create_folder'           => FileActions::class,
        'upload_file'             => FileActions::class,
        'upload_media'            => FileActions::class,
        'move_item'               => FileActions::class,

        // Tribune & Bouchot Actions
        'tribune_boards_get'      => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_boards_save'     => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_oauth_authorize' => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_oauth_callback'  => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_schedule_post'   => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_scheduled_list'  => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_schedule_cancel' => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_get'             => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_stream'          => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_post'            => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_proxy_fetch'     => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_proxy_post'      => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_clear_history'   => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_file_upload'     => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'tribune_file_get'        => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'totoz_proxy'             => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'totoz_search'            => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class,
        'url_preview'             => \SimpleGallery\Apps\Tribune\Backend\TribuneActions::class
    ];

    /**
     * Dispatch an incoming API action with O(1) routing
     */
    public static function dispatch(string $action, array $raw_body, string $base_dir, array $ignore_list, array $media_types, string $gallery_title = 'SimpleGallery', string $thumbnail_dir = '.thumbnails'): ?array {
        $params = array_merge($_GET, $_POST, $raw_body);
        $context = [
            'base_dir'      => $base_dir,
            'ignore_list'   => $ignore_list,
            'media_types'   => $media_types,
            'gallery_title' => $gallery_title,
            'thumbnail_dir' => $thumbnail_dir,
            'raw_body'      => $raw_body
        ];

        if (strpos($action, 'tribune_') === 0 || strpos($action, 'totoz_') === 0 || $action === 'url_preview') {
            $tribune_file = dirname(dirname(dirname(__DIR__))) . '/apps/tribune/backend/TribuneActions.php';
            if (file_exists($tribune_file)) {
                require_once $tribune_file;
            }
        }

        // 1. Direct O(1) Lookup
        if (isset(self::ACTION_MAP[$action])) {
            $controller = self::ACTION_MAP[$action];
            $res = $controller::handle($action, $params, $context);
            if ($res !== null) {
                return $res;
            }
        }

        // 2. Dynamic Fallback Chain
        $controllers = [
            GalleryActions::class,
            AuthActions::class,
            SystemActions::class,
            MediaActions::class,
            FileActions::class
        ];

        foreach ($controllers as $controller) {
            $res = $controller::handle($action, $params, $context);
            if ($res !== null) {
                return $res;
            }
        }

        return null;
    }
}
