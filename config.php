<?php

$real_base_dir = '/var/www/html/gallery';
$web_base_dir = 'gallery';
$icon_dir = 'img';
$thumbnail_dir = '.thumbails';
$front_office = 'auto_gallery2.php';
$back_office = 'gallery_it.php';
$render = 'auto_gallery.js';
$send_file = 'send_file.php';
$flv_player = 'https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/player_flv_maxi.swf';
$mp3_player = 'https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/dewplayer.swf';
$author = 'oktail';
$title = 'La gallerie de ' . $_SERVER["SERVER_NAME"];
$background = $_SERVER["SERVER_NAME"] . '/' . $icon_dir . '/bg.jpg';

?>
