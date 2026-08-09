<?php

    require('config.php');

$img_tab = array();

$img_tab['jpg'] = 'ImageJpeg';
$img_tab['jpeg'] = 'ImageJpeg';
$img_tab['gif'] = 'ImageGif';
$img_tab['png'] = 'ImagePng';
$img_tab['bmp'] = 'ImageBmp';

$create_tab = array();

$create_tab['jpg'] = 'ImageCreateFromJpeg';
$create_tab['jpeg'] = 'ImageCreateFromJpeg';
$create_tab['gif'] = 'ImageCreateFromGif';
$create_tab['png'] = 'ImageCreateFromPng';
$create_tab['bmp'] = 'ImageCreateFromBmp';

function my_zip_read($archive, $filename)
{	    
    $zip = new ZipArchive;
    if (file_exists($archive)) {
	if ($zip->open(realpath($archive))) {
	    if ($zip->locateName($filename) !== false) {
		return $zip->getFromName($filename);
	    }
	}
    }
    return false;
}


function my_zip_write($archive, $filename, $content)
{
    $zip = new ZipArchive;
    if (file_exists($archive)) {
	$zip->open(realpath($archive));
    } else {
	$zip->open(getcwd() . '/' .  $archive, ZipArchive::CREATE);
    }
    if ($zip->locateName($filename) !== false) {
	$zip->deleteName($filename);
    }
    $error = $zip->addFromString($filename, $content);
    return $error;
}

function liliput($img_src, $dst_w,$dst_h)
{
    global $img_tab;
    global $create_tab;
    global $web_base_dir;
    global $icon_dir;
    global $thumbnail_dir;
    
    $img_dest = '.' . getfname($img_src);
    $len = strlen(getfname($img_src));
    $flen = strlen($img_src);
    $dir = substr($img_src, 0, ($flen - $len));
    if (!file_exists($thumbnail_dir))
	mkdir($thumbnail_dir);
    $img_dest = $thumbnail_dir . '/' . $img_dest;
    $call_create = $create_tab[getextension($img_dest)];
    $call_img = $img_tab[getextension($img_dest)];

    $t_dir = explode("/", $dir);
    array_pop($t_dir);
    $p_dir = array_pop($t_dir);
    
    
    $size = GetImageSize($img_src);
    $src_w = $size[0];
    $src_h = $size[1];

    if ($src_w == 0 || $src_h == 0)
    {
	$src_h = 64;
	$src_w = 64;
    }
    $test_h = round(($dst_w / $src_w) * $src_h);
    $test_w = round(($dst_h / $src_h) * $src_w);
    if(!$dst_h) $dst_h = $test_h;
    elseif(!$dst_w) $dst_w = $test_w;
    elseif($test_h>$dst_h) $dst_w = $test_w;
    else $dst_h = $test_h;
    
    $test = (file_exists($img_dest));
    if($test)
	$test = (filemtime($img_dest)>filemtime($img_src));
    if($test)
    {
	$size2 = GetImageSize($img_dest);
	$test = ($size2[0]==$dst_w);
	$test = ($size2[1]==$dst_h);
    }
    $res = '';
    if(!$test) 
    {
	if (strcmp ($p_dir, "private") == 0)
	{
	    $dst_w = 16;
	    $dst_h = 16;
	}
	    
	$dst_im = ImageCreateTrueColor($dst_w,$dst_h); 
	$src_im = $call_create($img_src);
	imageAlphaBlending($src_im, false);
	imageSaveAlpha($src_im, true);
	imageAlphaBlending($dst_im, false);
	imageSaveAlpha($dst_im, true);
	ImageCopyResampled($dst_im,$src_im,0,0,0,0,$dst_w,$dst_h,$src_w,$src_h);
	$call_img($dst_im,$img_dest);
	ImageDestroy($dst_im);  
	ImageDestroy($src_im);
	
	$res .= '<img ';
	$res .= 'src="https://' . $_SERVER["SERVER_NAME"] . '/' . $icon_dir . '/wait-large.gif" width="' . 1.5*$dst_w . '" height="' . 1.5*$dst_h . '" ';
	$res .= ' border="0" /><br>';
    } else {
	$res .= '<img ';
	$res .= 'src="https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $img_dest . '" width="' . 1.5*$dst_w . '" height="' . 1.5*$dst_h . '" ';
	$res .= ' border="0" /><br>';
    }
    return ($res);
}

function getextension($fichier)
{
    $bouts = explode(".", $fichier);
    $extension = array_pop($bouts);
    return strtolower($extension);
}

function getfname($fichier)
{
    $bouts = explode("/", $fichier);
    $fname = array_pop($bouts);
    return $fname;
}

function getfnameshort($fichier)
{
    $bouts = explode("/", $fichier);
    $fname = array_pop($bouts);
    $bouts = explode(".", $fname);
    $extention = array_pop($bouts);
    $fname = implode(".", $bouts);
    return $fname;
}

function dir_size($dir)
{
    $handle = @opendir($dir);
    
    $mas = 0;
    while ($file = @readdir($handle)) {
	if ($file != '..' && $file != '.' && !is_dir($dir.'/'.$file))
	{
	    $mas += @filesize($dir.'/'.$file);
	} 
	else if (is_dir($dir.'/'.$file) && $file != '..' && $file != '.')
	{
	    $mas += dir_size($dir.'/'.$file);
	}
    }
    return $mas;
}

function dir_nbelem($dir)
{
    $handle = @opendir($dir);
    $mas = 0;
    
    while ($file = @readdir($handle))
    {
	if ($file[0] != '.')
	{
	    if (!is_dir($dir.'/'.$file))
	    {	
		$mas++;
	    }
	    else
	    {
		$mas += dir_nbelem($dir.'/'.$file);
	    }
	}
    }
    return $mas;
}

function print_size($size)
{
    if ($size <= 1024)
	$res =  $size . ':unit=octets';
    elseif ($size <= 1024*1024)
	$res = ($size - ($size % 1024)) / 1024 . ':unit=Ko';
    elseif ($size <= (1024*1024*1024))
	$res = ($size - ($size % (1024*1024))) / (1024*1024) . ':unit=Mo';
    elseif ($size <= (1024*1024*1024*1024))
	$res = sprintf ("%0.2f:unit=Go", ($size - ($size % (1024*1024*1024))) / (1024*1024*1024));
    else
	$res = sprintf ("%0.2f:unit=Go", ($size - ($size % (1024*1024*1024))) / (1024*1024*1024));
    return $res;
}

function show_tar($file, $icon, $target)
{
    $cmd = 'tar -tf ' . $file;
    return ('<p>' . `$cmd` . '</p>');
}

function show_rar($file, $icon, $target)
{
    $cmd = 'unrar vb "' . $file . '" | head -12 | sed "s/\ /\&nbsp;/g"';
    return ('<pre style="text-align:left;">' . `$cmd` . '</pre>');
}


function show_zip($file, $icon, $target)
{
    $cmd = 'unzip -l "' . $file . '" | head -12 | sed "s/^\ *//g" | sed -e "s/\ \ //g" | cut -d " " -f 3- | sed "s/\$/<br>/g"';
    return ('<pre style="text-align:left">' . `$cmd` . '</pre>');
}

function show_img($file, $icon, $target)
{
    return (liliput($file, 256, 256));
}

function show_pdf($file, $icon, $target)
{
    $len = strlen(getfname($file));
    $flen = strlen($file);
    $dir = substr($file, 0, ($flen - $len));
    if (!file_exists($dir . '.thumbails'))
	mkdir($dir . '.thumbails');
    $res = '';
    $res .= '<pre style="text-align:left;">';
    $cmd = 'pdfinfo ' . $file . ' | tail -8 | sed "s/\\n/<br>/g" | sed "s/\ /\&nbsp;/g"';
    $res .= `$cmd`;
    $res .= '</pre>';
    return ($res);
}

function stream_it($file, $icon, $target)
{
    global $real_base_dir;
    global $thumbnail_dir;
    
    $len = strlen(getfname($file));
    $flen = strlen($file);
    $dir = substr($file, 0, ($flen - $len));
    if (!file_exists($thumbnail_dir))
	mkdir($thumbnail_dir);
    $cmd = '(ffmpeg -y -i "' . $real_base_dir . '/' . $file . '" -b 200k -r 25 -s 640x480 -deinterlace -ab 56 -ar 22050 -ac 1 "' . $real_base_dir . '/' . $thumbnail_dir . '/.' . getfnameshort($file) . '.flv")&';
    if (!file_exists($thumbnail_dir . '/.' . getfnameshort($file) . '.flv'))
	system($cmd);
    return (show_flv($thumbnail_dir . '/.' . getfnameshort($file) . '.flv', $icon, $target));
}

function webm_it($file, $icon, $target)
{
    global $real_base_dir;
    global $thumbnail_dir;
    
    $len = strlen(getfname($file));
    $flen = strlen($file);
    $dir = substr($file, 0, ($flen - $len));

//  $cmd = '(ffmpeg -y -i \"' . $real_base_dir . '/' . $file . '\" -c:v libvpx -crf 10 -b:v 1M -c:a libvorbis \"' . $real_base_dir . '/' . $dir . "/" . getfnameshort($file) . '.webm\" && rm -f \"' . $real_base_dir . '/' . $file . '\")&';
    $cmd = '(ffmpeg -y -i \'' . $real_base_dir . '/' . $file . '\' -c:v libvpx -crf 10 -b:v 1M -c:a libvorbis \'' . $real_base_dir . '/' . $dir . "/" . getfnameshort($file) . '.webm\' > /tmp/res.txt)&';

    if (!file_exists($dir . "/" . getfnameshort($file) . '.webm'))
    {
	system($cmd);
	system("echo '$cmd' > /tmp/cmd.txt");
    }
    return ($dir . "/" . getfnameshort($file) . ".webm");
}

function show_vid($file, $icon, $target)
{
    global $web_base_dir;
    $webm_name = webm_it($file, $icon, $target);

    return ('<video width="320" controls>
		<source src="https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $webm_name . '">
		</video>');
}

function show_svg($file, $icon, $target)
{
    global $web_base_dir;
    return ('<embed src="https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $file . '"
  name="' . getfnameshort($file) . '" width="300" pluginspage="https://www.adobe.com/svg/viewer/install/" type="image/svg+xml"');
}

function show_flv($file, $icon, $target)
{
    global $flv_player;
    global $web_base_dir;
    return ('<p id="' . $file . '">
<object type="application/x-shockwave-flash" data="' . $flv_player . '" width="480" height="320">
    <param name="movie" value="' . $flv_player . '" />
    <param name="allowFullScreen" value="true" />
    <param name="FlashVars" value="flv=https://'
	    . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/'
	    . $file . '&amp;title=' . $target . 
	    '&amp;startimage=' . $icon . 
	    '&amp;autoload=0&amp;' .
	    'bgcolor=0f0f0f&amp;' . 
	    'showvolume=1&amp;' . 
	    'showtime=2&amp;' . 
	    'showfullscreen=1&amp;' .
	    'margin=0&amp;' . 
	    'buffer=10&amp;' . 
	    'showtitleandstartimage=1" />
</object>' . '</p>');
//	   	<embed type="application/x-shockwave-flash"
//		src="' . $flv_player . '?flv=
// . '&amp;title=' . $file . '&amp;showvolume=1&amp;showtime=2&amp;showfullscreen=1&amp;bgcolor=#000000" width="400" height="300" />
		
}

function show_mp3($file, $icon, $target)
{
    global $web_base_dir;
    global $mp3_player;

    $res = '<object type="application/x-shockwave-flash" data="' . $mp3_player . '" width="300" height="30" id="dewplayer" name="dewplayer">
<param name="wmode" value="transparent" />
<param name="movie" value="https://' . $_SERVER["SERVER_NAME"] . '/' . urlencode($web_base_dir) . '/' . urlencode($file) . '" />
<param name="flashvars" value="son=https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . urldecode($file) . '&showtime=1" />
</object>';
    return ($res);
}

function show_html($file, $icon, $target)
{
    return ('cooming soon ...<br>');
}

function show_odf($file, $icon, $target)
{
    return ('cooming soon ...<br>');
}

function show_nothing($file, $icon, $target)
{
}

$comments_tab = array();

function load_comments($dir)
{
  global $comments_tab;
  $handle = @fopen($dir . '/.comment', 'r');
  if ($handle === FALSE)
    {
      return;
    }
  while (($string = fgets($handle)) !== false)
    {
      $fname = rtrim($string);
      $fcomment = fgets($handle);
      $comments_tab[$fname] = $fcomment;
    }
}

$ext_tab = array();

$ext_tab['jpg'] = 'show_img';
$ext_tab['jpeg'] = 'show_img';
$ext_tab['gif'] = 'show_img';
$ext_tab['png'] = 'show_img';
$ext_tab['pcx'] = 'show_img';
$ext_tab['bmp'] = 'show_img';
$ext_tab['pdf'] = 'show_pdf';
$ext_tab['zip'] = 'show_zip';
$ext_tab['rar'] = 'show_rar';
$ext_tab['gz'] = 'show_tar';
$ext_tab['gzip'] = 'show_tar';
$ext_tab['tgz'] = 'show_tar';
$ext_tab['tar'] = 'show_tar';
$ext_tab['bz2'] = 'show_tar';
$ext_tab['mpg'] = 'show_vid';
$ext_tab['mpeg'] = 'show_vid';
$ext_tab['mpe'] = 'show_vid';
$ext_tab['mp4'] = 'show_vid';
$ext_tab['avi'] = 'show_vid';
$ext_tab['asf'] = 'show_vid';
$ext_tab['wmv'] = 'show_vid';
$ext_tab['mov'] = 'show_vid';
$ext_tab['mkv'] = 'show_vid';
$ext_tab['ogv'] = 'show_vid';
$ext_tab['webm'] = 'show_vid';
$ext_tab['flv'] = 'show_flv';
$ext_tab['svg'] = 'show_svg';
$ext_tab['mp3'] = 'show_mp3';
$ext_tab['ogg'] = 'show_mp3';
$ext_tab['wav'] = 'show_mp3';
$ext_tab['mid'] = 'show_mp3';
$ext_tab['htm'] = 'show_html';
$ext_tab['html'] = 'show_html';
$ext_tab['odg'] = 'show_odf';
$ext_tab['odp'] = 'show_odf';
$ext_tab['ods'] = 'show_odf';
$ext_tab['odt'] = 'show_odf';

function img_icn($dir, $file, $what)
{
    global $web_base_dir;
    global $thumbnail_dir;

    return ($what == 1?('https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $thumbnail_dir . '/.' . $file):256);
}

function svg_icn($dir, $file, $what)
{
    global $web_base_dir;
    global $thumbnail_dir;

    $bouts = explode(".", $file);
    $extention = array_pop($bouts);
    $name = array_pop($bouts);
    if (!file_exists($thumbnail_dir))
	mkdir($thumbnail_dir);
    $img_dest = $thumbnail_dir . '/.' . $file;
    if (!file_exists($thumbnail_dir. '/.' . $name . ".png"))
    {
	$cmd = 'convert -background non "' . $dir . '/' . $file . '.svg" "' . $thumbnail_dir . '/.' . $file . '.png"';
	system($cmd);
    }
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $thumbnail_dir . '/.' . $name . '.png'):128);  
}

function pdf_icn($dir, $file, $what)
{
    global $web_base_dir;
    global $thumbnail_dir;

    if (!file_exists($thumbnail_dir))
	mkdir($thumbnail_dir);
    $img_dest = $thumbnail_dir . '/.' . $file;
    if (!file_exists($thumbnail_dir . '/.' . $file . ".jpg"))
    {
	$cmd = 'pdftoppm -f 1 -l 1 -r 50 "' . $dir . '/' . $file . '" "' . $dir . '/' . $file . '"';
	system($cmd);
	$cmd = 'convert -quality 50 "' . $dir . '/' . $file . '-*.ppm" "' . $dir . '/' . $file . '-*.jpg"';
	system($cmd);
	system('rm -f ' . $dir . '/*.ppm');
	$cmd = 'mv "' . $dir . '/' . $file . '-*.jpg" "' . $thumbnail_dir . '/.' . $file . '.jpg"';
	system($cmd);
    }
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $thumbnail_dir . '/.' . $file . '.jpg'):128);
}

function vid_icn($dir, $file, $what)
{
    global $thumbnail_dir;
    global $web_base_dir;

    if (!file_exists($thumbnail_dir))
	mkdir($thumbnail_dir);
    $img_dest = $thumbnail_dir . '/.' . $file;
    if (!file_exists($thumbnail_dir . '/.' . $file . ".png"))
    {
	$cmd = 'totem-video-thumbnailer "' . $dir . '/' . $file . '" "' . $thumbnail_dir . '/.' . $file . '.png"';
	system($cmd);
    }
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $thumbnail_dir . '/.' . $file . '.png'):192);
}

function exe_icn($dir, $file, $what)
{
    global $thumbnail_dir;
    global $web_base_dir;

    if (!file_exists($thumbnail_dir))
	mkdir($thumbnail_dir);
    $img_dest = $thumbnail_dir . '/.' . $file;
    if (!file_exists($thumbnail_dir . '/.' . $file))
    {
	$cmd = 'wrestool -t14 -x "' . $dir . '/' . $file . '" -o "' . $thumbnail_dir . '/.' . $file . '"';
	system($cmd);
    }
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $thumbnail_dir . '/.' . $file):32);
}

function aud_icn($dir, $file, $what)
{
    global $icon_dir;
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $icon_dir . '/gnome-audio.png'):64);
}

function arch_icn($dir, $file, $what)
{
    global $icon_dir;
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $icon_dir . '/file-roller.png'):64);
}

function oth_icn($dir, $file, $what)
{
    global $icon_dir;
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $icon_dir . '/file.png'):64);
}

function odf_icn($dir, $file, $what)
{
    global $icon_dir;
    global $web_base_dir;
    global $thumbnail_dir;

    if (!file_exists($thumbnail_dir . '/.' . $file . '.png'))
    {
	$fp = fopen($thumbnail_dir . '/.' . $file . '.png', 'w');
	$res = my_zip_read($dir . '/' . $file, 'Thumbnails/thumbnail.png');
	fwrite($fp, $res);
	fclose($fp);
    }
    return ($what?('https://' . $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $thumbnail_dir . '/.' . $file . '.png'):128);
}

$icn_tab['jpg'] = 'img_icn';
$icn_tab['jpeg'] = 'img_icn';
$icn_tab['gif'] = 'img_icn';
$icn_tab['png'] = 'img_icn';
$icn_tab['pcx'] = 'img_icn';
$icn_tab['bmp'] = 'img_icn';
$icn_tab['svg'] = 'svg_icn';
$icn_tab['pdf'] = 'pdf_icn';
$icn_tab['zip'] = 'arch_icn';
$icn_tab['rar'] = 'arch_icn';
$icn_tab['gz'] = 'arch_icn';
$icn_tab['gzip'] = 'arch_icn';
$icn_tab['tgz'] = 'arch_icn';
$icn_tab['tar'] = 'arch_icn';
$icn_tab['bz2'] = 'arch_icn';
$icn_tab['mpg'] = 'vid_icn';
$icn_tab['mpeg'] = 'vid_icn';
$icn_tab['mpe'] = 'vid_icn';
$icn_tab['mp4'] = 'vid_icn';
$icn_tab['avi'] = 'vid_icn';
$icn_tab['asf'] = 'vid_icn';
$icn_tab['wmv'] = 'vid_icn';
$icn_tab['flv'] = 'vid_icn';
$icn_tab['mov'] = 'vid_icn';
$icn_tab['mkv'] = 'vid_icn';
$icn_tab['ogv'] = 'vid_icn';
$icn_tab['webm'] = 'vid_icn';
$icn_tab['mp3'] = 'aud_icn';
$icn_tab['ogg'] = 'aud_icn';
$icn_tab['wav'] = 'aud_icn';
$icn_tab['mid'] = 'aud_icn';
$icn_tab['exe'] = 'exe_icn';
$icn_tab['odg'] = 'odf_icn';
$icn_tab['odp'] = 'odf_icn';
$icn_tab['ods'] = 'odf_icn';
$icn_tab['odt'] = 'odf_icn';


function preview($file, $icon, $target)
{
  global $ext_tab;

  foreach($ext_tab as $ext => $call)
    {
      if (getextension($file) == $ext)
	{
	  return ($call($file, $icon, $target));
	}
    }
}

function gallery ($dir)
{
    global $real_base_dir;
    global $front_office;
    global $web_base_dir;
    global $icon_dir;
    global $author;

    $init_dir = $dir;
    $dir = realpath($dir);
    if (1 || strstr($dir, $real_base_dir))
    {
	$dir = $init_dir;
	global $comments_tab;
	global $icn_tab;
	system("rm -f core.*");
//	system("echo " . $dir . "/autoget.pl > plop");
//	system("pwd > plip");
	if (file_exists($dir . "/autoget.pl"))
	    {
		$res = "perl ./" . $dir . "/autoget.pl";
		$res = `$res`;
	    }
	load_comments($dir);
	if (!is_dir($dir))
	    return;
	$f = 0;
	$d = 0;
	if ($dh = @opendir($dir))
	{
	    while (($file = @readdir($dh)) !== false)
	    {
		if (($file[0] != '.') && ($file[strlen($file) - 1] != '~'))
		{
		    if (is_dir($dir . '/' . $file) != "")
		    {
			$directories[$d] = $file;
			$d++;
		    } //if
			else
		    {
			if (strcmp(getextension($file), "php") && strcmp($file, "index.html") && strcmp(getextension($file), "js") && strcmp(getextension($file), "xul") && strcmp(getextension($file), "swf") && strcmp(getextension($file), "db") && strcmp(getextension($file), "pl") && strcmp(getextension($file), "html"))
			{
			    $files[$f] = $file;
			    $f++;
			}
		    } //else
		} //if
	    } //while
	    $i = 0;
	    @sort ($directories);
	    @sort ($files);
	    $i = 0;
	    $res = '';
	    while ($i < $d)
	    {
#		$size = (float) exec ('stat -c %s '. escapeshellarg($dir . '/' . $files[$i]));
		$res .= ' <item>' . "\n";
		$res .= '  <title>' . urlencode($directories[$i]) . '</title>' . "\n";
		$res .= '  <author>' . $author . '</author>' . "\n";
		$res .= '  <pubDate>';
		$res .= exec('stat --format=%y "' . $directories[$i] . '"');
		$res .= '  </pubDate>' . "\n";
		$res .= '  <link>' . "\n";
		$res .= 'https://'. $_SERVER["SERVER_NAME"] . '/' . $web_base_dir . '/' . $front_office . '?dir='
		    . urlencode($dir) 
		    . '/'
		    . urlencode($directories[$i])
		    . '</link>' . "\n";
		$res .= '  <guid>' . "\n";
		$res .= 'dir:where=' . urlencode($dir) . '/' . urlencode($directories[$i]) 
		    . ":num=" . ($i + 1)
		    . ":total=" . $d 
		    . ":size=" . print_size(dir_size($dir . '/' . $directories[$i])) 
		    . ":count=" . dir_nbelem($dir . '/' . $directories[$i]) 
		    . ':icn_size=128'
		    . ':type=dir'
		    . ':id=' . $directories[$i]
		    . ':comment=' . '' //$comments_tab[$directories[$i]]
		    . ':subtype=dir'
		    . "\n";
		$res .= '</guid>' . "\n";
		$res .= '  <description><![CDATA[<p align=center>' . "\n";
		$res .= '  </p>]]></description>' . "\n";
		$res .= '<image>https://' . $_SERVER["SERVER_NAME"] . '/' . $icon_dir . '/folder.png</image>' . "\n";
		$res .= ' </item>' . "\n";
		$i++;
	    }
	    $i = 0;
	    while ($i < $f)
	    {
		$size = (float) exec ('stat -c %s '. escapeshellarg($dir . '/' . $files[$i]));
		$res .= '<item>' . "\n";
		$res .= '<title>' . $files[$i] . '</title>' . "\n";
		$res .= '<description><![CDATA[' . "\n";
		/*if (strlen($comments_tab[rtrim($files[$i])]) > 2)
		{
		    $res .= 'Commentaire :<br>' . "\n";
		    $res .= $comments_tab[rtrim($files[$i])];
		}*/
		$res .= '<br>';
		$icon = $icn_tab[getextension($files[$i])];
		if ($icon == "")
		    $icon = 'oth_icn';
		$res .= preview($dir . '/' . $files[$i], $icon($dir, $files[$i], 1), $files[$i]);
		$res .= ']]></description>' . "\n";
		$cmd = '"stat ' . $files[$i] . ' | tail -1"';
		$res .= '<pubDate>' . `$cmd` . '</pubDate>' . "\n";
		$res .= '<link>https://' . $_SERVER["SERVER_NAME"]
		    . '/' . $web_base_dir . '/' . $dir . '/'
		    . $files[$i]
		    . '</link>' . "\n";
		$res .= '  <guid>' . "\n";
		$res .= 'file:where=' . urlencode($dir) . '/' . urlencode($files[$i]) 
		    . ":num=" . ($i + 1)
		    . ":total=" . $f 
		    . ':size=' . print_size($size)
		    . ':count=1'
		    . ':icn_size=' . $icon($dir, $files[$i], 0)
		    . ':type=' . $icon
		    . ':id=' . $files[$i]
		    . ':comment=' . '' //$comments_tab[rtrim($files[$i])]
		    . ':subtype=' . rtrim(getextension($files[$i]))
		    . "";
		$res .= '</guid>' . "\n";
		$res .= '<image>';
		$res .= $icon($dir, $files[$i], 1);
		$res .= '</image>' . "\n";
		$i++;
		$res .= '</item>' . "\n";
	    }
	}
	else
	    $res = 'erreur d ouverture de ' . $dir;
    }
    else
    {
	$res = $init_dir . " : Bad directory : " . $dir . "<br>\n";
    }
    return ($res);
}

function list_sub_dir($dir)
{
    global $real_base_dir;
    global $web_base_dir;
    global $icon_dir;
    global $front_office;
    global $back_office;
    global $render;
    global $send_file;
    global $background;

    $init_dir = $dir;
    if ($dir == $real_base_dir)
	return ($dir . ':1:gallery');
    $real_dir = realpath($dir);
    if (1 || strstr($real_dir, $real_base_dir))
    {
	if (!is_dir($real_dir))
	    return 'REP';
	$d = 0;
	if ($dh = @opendir($dir . "/.."))
	{
	    while (($file = @readdir($dh)) !== false)
	    {
		if (($file[0] != '.') && ($file[strlen($file) - 1] != '~'))
		{
		    if (is_dir($dir . '/../' . $file) != "")
		    {
			$directories[$d] = urlencode($file);
			$d++;
		    } //if
		}
	    }
	}
	else
	    return('echec opendir' . getcwd() . ' ' . $real_dir . "/..");
	@sort ($directories);
	$i = 0;
	$res = '';
	$res .= $dir . ":" . $d . ':';
	while ($i < $d - 1)
	{
	    $res .= $directories[$i] . ",";
	    $i++;
	}
	$res .= $directories[$i] . ':' . $real_base_dir . ':' . $web_base_dir . ':' . $icon_dir . ':' . $front_office . ':' . $back_office . ':' . $render . ':' . $_SERVER["SERVER_NAME"] . ':' . $send_file;
	return ($res);
    }
    return ('');
}

if (isset($HTTP_GET_VARS))
{
   while(list($name, $value) = each($HTTP_GET_VARS))
   {
     $$name = $value;
   }
}

header('Content-Type: application/rss+xml');

if (!isset($table_parametre)) $table_parametre = '';

$dir = $_GET["dir"];

if (file_exists($dir . '/.bg'))
{
    $cmd = 'cat "' . $dir . '/.bg"';
    $background = `$cmd`;
}
if (file_exists($dir . '/.cache.rss'))
{
    system('cat ' . $dir . '/.cache.rss');
}
else
{
    $output = '';
    $last_date = exec('date');
    $output .= '<?xml version="1.0" encoding="utf8"?>' . "\n";
    $output .= '<rss version="2.0">' . "\n";
    $output .= '<channel>' . "\n";
    $output .= '<title>' . $title . '</title>' . "\n";
    $output .= '<description>' . list_sub_dir($dir) . ':' . $background . '</description>' . "\n";
    $output .= '<lastBuildDate>' . $last_date . '</lastBuildDate>' . "\n";
    $output .= '<link>https://' . $_SERVER["SERVER_NAME"] . '</link>' . "\n";
    $output .= '<ttl>1</ttl>' . "\n";
    $output .= gallery($dir);
    $output .= '</channel>' . "\n";
    $output .= '</rss>';
    //system('echo \'' . $output . '\'> \'' . $dir . '/.cache.rss\'');
    echo $output;
}
?>


