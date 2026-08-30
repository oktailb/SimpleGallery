<?php
/**
 * SimpleGallery 2026 - Tribune Secrets Store
 * Protected PHP file preventing any direct HTTP access.
 */
if (!defined('SG_EXEC') && !defined('SIMPLE_GALLERY_BOOTED')) {
    http_response_code(403);
    exit('Access Denied');
}

return [
    'linuxfr' => [
        'client_id'     => '24af3824faafc68f68efaaacb7a18a9b05aa780a2775de1baa42c53b770b2ab9',
        'client_secret' => '4fccecfb22e89219e3b01d97ede63df5243fdaf4d48b2d5fcae7ade5b6b8f20a'
    ]
];
