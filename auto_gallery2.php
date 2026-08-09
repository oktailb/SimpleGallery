<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
	  "https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="https://www.w3.org/1999/xhtml">
<?php
$dir = $_GET["dir"];
   require('config.php');
    if (isset($HTTP_GET_VARS))
    {
      while(list($name, $value) = each($HTTP_GET_VARS))
      {
        $$name = $value;
      }
    }
    if (!isset($table_parametre)) $table_parametre = '';
   if (!$dir)
     $dir = ".";
?>
<head>
  <title>Oktail.org gallery</title>
  <link rel="alternate" type="application/rss+xml" title="oktail's.org
  gallery"
  href="<?php echo 'https://' . $_SERVER['SERVER_NAME'] . '/' . $web_base_dir . '/' . $back_office . '?dir=' . $dir; ?>" />
  <meta http-equiv="Content-Type" content="text/html;charset=utf8"/>
  <script src="<?php echo 'https://' . $_SERVER['SERVER_NAME'] . '/'
  . $web_base_dir . '/' . $render . '?front_office=' . $front_office; ?>" type="text/javascript"></script>
  <script src="<?php echo 'https://' . $_SERVER['SERVER_NAME'] . '/'
  . $web_base_dir . '/modernizr.js'; ?>" type="text/javascript"></script>
</head>
<body bgcolor='black' onload="setTimeout('draw_pola()', 5);">
<p id="nav">
</p>
<div id="output"></div>
<script type="text/javascript">
show_stream(get_stream('<?php echo
			      'https://' . $_SERVER['SERVER_NAME'] . '/' . $web_base_dir . '/' . $back_office . '?dir='
			      . urlencode($dir); ?>'));
</script>
</body>
</html>
