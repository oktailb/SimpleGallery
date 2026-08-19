<?php
/**
 * SimpleGallery 2026 - User Configuration File
 *
 * This file contains user-editable preferences.
 * All system checks, directory initialization and security verification are handled automatically by the Kernel.
 */

// Title displayed in the gallery header and browser window
$gallery_title = "SimpleGallery";

/**
 * Media Storage Directory
 * - Relative path: 'storage/media' (default, located in the project's storage directory)
 * - Absolute path: e.g. '/var/photos', 'D:/MesPhotos', or 'C:/Users/name/Pictures'
 */
$storage_media_dir = 'storage/media';

// Default Visual Theme ('polaroid-classic', 'dark-glass', 'light-minimal', 'cyberpunk')
$theme_preset = 'polaroid-classic';

// Thumbnail Dimensions (pixels) & Compression Quality (1-100)
$thumb_width = 360;
$thumb_height = 360;
$thumb_quality = 85;

// Allow direct individual item downloads (true / false)
$allow_direct_download = true;

// Enable GDPR / ePrivacy cookie consent banner (true / false)
$enable_cookie_consent = true;
