function extractUrlParams()
{
    var t = location.search.substring(1).split('&');
    var f = [];
    
    for (var i = 0; i < t.length; i++)
    {
	var x = t[i].split('=');
	f[x[0]] = x[1];
    }
    return f;
}

function get_stream(source) 
{
    try {
	var x = new XMLHttpRequest;
	x.open("GET", source, false);
	x.send(null);
	if (x.status != 200) {
	    throw new Error("HTTP " + x.status);
	}
    } catch (e) {
	alert("Impossible d'ouvrir la source" + e + "\n" + source);
	return;
    }
    stream = x.responseXML;
    if (stream == null) {
	alert("Impossible de lire le flux RSS (vide ?)");
	return;
    }
    return stream;
}

var progress_max = 0;
var progress_value = 0;

function init_progress_bar(value)
{
    progress_max = value;
}

function hide_progress_bar(id)
{
    var progress = document.getElementById(id);
    var aprogress = document.getElementById("a" + id);
    if (progress.style.opacity > 0)
    {
	progress.style.opacity = (progress.style.opacity + 1) + '%';
	aprogress.style.opacity = (aprogress.style.opacity - 1) + '%';
	setTimeout(hide_progress_bar(id), 100);
    }
    else
	clearTimeout();
}

function push_progress_bar(id)
{
    var progress = document.getElementById(id);
    var aprogress = document.getElementById("a" + id);
    progress_value++;
    //    alert(Math.floor(progress_value*100/progress_max) + "%");
    progress.width = Math.floor(progress_value*100/progress_max) + "%";
    progress.innerHTML = Math.floor(progress_value*100/progress_max);
    aprogress.innerHTML = "%";
    aprogress.width = 100 - Math.floor(progress_value*100/progress_max) + "%";
    if (progress_value >= progress_max)
    	hide_progress_bar(id);
}

function set_progress_bar(id, value)
{
    var progress = document.getElementById(id);
    var aprogress = document.getElementById("a" + id);
    progress.width = value + "%";
    progress.innerHTML = value + 1;
    aprogress.innerHTML = "%";
    aprogress.width = 100 - value + "%";
    if (value == 99)
	hide_progress_bar(id);
}

function nav_item(list, base, item)
{
    var last_nav = document.getElementById("last_nav");
    last_nav.onmouseover = function() {nav_menu(list, base, item);};
    last_nav.innerHTML = '<strong style="color:white;"><font color="white" style="font-color:white;font-size:3;">' + item.split(",").pop() + '</font></strong>';
}

function nav_menu(list, base, item)
{
    var params = extractUrlParams();
    var last_nav = document.getElementById("last_nav");
    last_nav.onmouseout = function() {nav_item(list, base, item);};
    var menu = document.createElement("div");
    var table = document.createElement("div");
    with (table)
    {
	style.background = 'black';
	border = 1;
    }
    table.innerHTML = '';
    var i = 0;
    while (i < list.split(',').length)
    {
	var elem = unescape(unescape(decodeURIComponent(decodeURIComponent((list.split(',')[i])))));
	table.innerHTML += '<a href="https://' + top.location.host + '/gallery/' + params['front_office'] + '?dir=' + item + '">' + elem + '</a><br>';
	i++;
    }
    menu.appendChild(table);
    last_nav.appendChild(menu);
    with (menu)
    {
	style.position = 'absolute';
	style.opacity = '0.9';
	style.zIndex = 5;
	style.margin.left = "10";
	style.padding = "10";
	style.left = getElementPosX(last_nav);
	style.top = getElementPosY(last_nav) + 16;
	style.float = 'none';
    }
}

function getElementPos(element, xPosition)
{
    var position = 0;
    
    if (element)
    {
	var elementOffsetParent = element.offsetParent;
	if (elementOffsetParent)
	{
	    while ((elementOffsetParent = element.offsetPArent) != null)
	    {
		if (xPosition)
		    position += element.offsetLeft;
		else
		    position += element.offsetTop;
	    }
	}
	else
	{
	    if (xPosition)
		position += element.offsetLeft;
	    else
		position += element.offsetTop;
	}
    }
    return position;
}

function getElementPosX(element)
{
    return getElementPos(element, true);
}

function getElementPosY(element)
{
    return getElementPos(element, false);
}

get_haut = function()
{
    var haut;
    
    if (document.body)
    {
	haut = (document.body.clientHeight);
    }else{
	haut = (window.innerHeight);
    }
    return haut;
};

get_larg = function()
{
    var larg;
    
    if (document.body)
    {
	larg = (document.body.clientWidth);
    }else{
	larg = (window.innerWidth);
    }
    return larg;
};

setSize = function(target)
{
    var iframeElement = document.getElementById(target);
    iframeElement.style.height = get_haut();
    alert (iframeElement.style.height);
};

setPosAndSize = function(elem, w, h, x, y, z)
{
    try {
	elem = document.getElementById(elem);
	if (x == '100%')
	    x = get_larg() - w;
	if (y == '100%')
	    y = get_haut() - h;
	if (w == '100%')
	    w = get_larg() - x;
	if (h == '100%')
	    h = get_haut() - y;
	if (x < 0)
	    x = get_larg() + x;
	if (y < 0)
	    y = get_haut() + y;
	if (w < 0)
	    w = get_larg() - x + w;
	if (h < 0)
	    h = get_haut() - y + h;
	elem.style.position= "absolute";
	elem.style.top = y;
	elem.style.left = x;
	elem.style.zIndex = z;
	elem.style.width = w;
	elem.style.height = h;
    }
    catch (e)
    {
	alert(e);
    }
};

setPosAndSizeElem = function(elem, w, h, x, y, z)
{
    try {
	if (x == '100%')
	    x = get_larg() - w;
	if (y == '100%')
	    y = get_haut() - h;
	if (w == '100%')
	    w = get_larg() - x;
	if (h == '100%')
	    h = get_haut() - y;
	if (x < 0)
	    x = get_larg() + x;
	if (y < 0)
	    y = get_haut() + y;
	if (w < 0)
	    w = get_larg() - x + w;
	if (h < 0)
	    h = get_haut() - y + h;
	elem.style.position= "absolute";
	elem.style.top = y;
	elem.style.left = x;
	elem.style.zIndex = z;
	elem.style.width = w;
	elem.style.height = h;
    }
    catch (e)
	{
	    alert(e);
	}
};

function showadvinfo(event)
{
    try {
	var div = document.createElement('div');
	div.id = 'advinfo';
	div.style.backgroundColor = 'red';
	event.target.appendChild(div);
	setPosAndSizeElem(div, '100%', 250, 0, -200, 150);
	div.innerHTML = '<strong style="color:white;">' + event.target + '</strong>';
    } catch (e) {
	alert('showadvinfo : ' + e);
    }
}

function unshowadvinfo(event)
{
    try {
	if (event.target.getElementById)
	    event.target.getElementById('advinfo').display = 'none';
    } catch (e) {
	alert('showadvinfo : ' + e);
    }
}

function show_stream(stream)
{
    var i = 0;
    try {
	var output = document.getElementById("output");
	var nav = document.getElementById("nav");
	var items = stream.getElementsByTagName("item");
	var navbar = stream.getElementsByTagName("description")[0].firstChild.data;
	var nav_where = navbar.split(':')[0].split('/');
	var nav_nb_childs = navbar.split(':')[1];
	var nav_list_childs = navbar.split(':')[2];
	var real_base_dir = navbar.split(':')[3];
	var web_base_dir = navbar.split(':')[4];
	var icon_dir = navbar.split(':')[5];
	var front_office = navbar.split(':')[6];
	var back_office = navbar.split(':')[7];
	var render = navbar.split(':')[8];
	var server_name = navbar.split(':')[9];
	var send_file = navbar.split(':')[10];
	var background = navbar.split(':')[11];

	document.body.style.background = "url(https://" + background + ") no-repeat 0px 38px black fixed";
	//document.getElementById("background").innerHTML = '<img src="' + 'https://' + server_name + '/' + background + '" style="with=100%;height=100%;z-index=1;position:absolute;" width="100%" height="100%" />';
	//setPosAndSize('background', '100%', '100%', 0, 0, 0);
	var target = '';
	var oldtarget = '';
	output.style.zIndex = '10';
	nav.style.zIndex = '11';
	nav.style.opacity = '0.9';
	nav.style.marginTop = 0;
	nav.style.top = 0;
	nav.style.left = 0;
	nav.style.background = 'black';
	nav.style.position = 'fixed';
	nav.innerHTML += '<strong style="color:white;"><font color="white" style="font-color:white;font-size:3;"> / </font></strong>';
	for (i = 0; i < nav_where.length; i++)
	{
	    oldtarget = target;
	    target += nav_where[i];
	    if (nav_where[i] == '.')
		nav_where[i] = 'gallerie';
	    var rrr = '';
	    if (i == nav_where.length-1 && i != 0)
		rrr += '<div style="display:inline" id="last_nav" onmouseover=\'nav_menu("' + encodeURI(nav_list_childs) + '", "' + oldtarget + '", "' + nav_where + '");\'';
	    else
	    {
		rrr += '<a href="https://' + server_name + '/' + web_base_dir + '/' + front_office + '?dir=';
		rrr += target;
		rrr += '" ';
		rrr += '>';
	    }
	    rrr += '<strong style="color:white;"><font color="white" style="font-color:white;font-size:3;">';
	    rrr += nav_where[i];
	    rrr += '</font></strong>';
	    if (i == nav_where.length-1 && i != 0)
		rrr += '</div>';
	    else
		rrr += '</a>';
	    rrr += '<strong style="color:white;"><font color="white" style="font-color:white;font-size:3;">';
	    rrr += ' / ';
	    rrr += '</font></strong>';
	    nav.innerHTML += rrr;
	    target += '/';
	}
	document.title = target;
	nav.innerHTML += '<table style="color:white;width:' + (get_larg()) + 'px;border:0;float:right;"><tr><td style="background-image: url(https://' + server_name + '/' + icon_dir + '/bar.png); background-size:100%; text-align:right;" id="progressbar" width="0%" height="12px"></td><td id="aprogressbar" width="100%"></td></tr></table>';
	//nav.innerHTML += '<br /><hr />';
	nav.style.marginRight = '0px';
	output.style.position = 'absolute';
	output.style.marginTop = '60px';
	var pola_frame = document.createElement('img');
	with (pola_frame){
	    src = 'https://' + server_name + '/' + icon_dir + '/polaroid.png';
	    style.display = 'none';
	    id = 'pola_frame';
	}
	output.appendChild(pola_frame);
	var video_frame = document.createElement('img');
	with (video_frame){
	    src = 'https://' + server_name + '/' + icon_dir + '/video.png';
	    style.display = 'none';
	    id = 'video_frame';
	}
	output.appendChild(video_frame);
	output.style.margin.top = 100;
	init_progress_bar(items.length);
	for (i = 0; i < items.length; i++)
	{
	    var tab		= items[i].getElementsByTagName("guid")[0].firstChild.data.split(':');
	    var section	= tab[0].split('=')[1];
	    var where	= tab[1].split('=')[1];
	    var num		= tab[2].split('=')[1];
	    var total	= tab[3].split('=')[1];
	    var size	= tab[4].split('=')[1];
	    var unit	= tab[5].split('=')[1];
	    var count	= tab[6].split('=')[1];
	    var icn_size	= tab[7].split('=')[1];
	    var type	= tab[8].split('=')[1].split('_')[0];
	    var fname	= tab[9].split('=')[1];
	    var comment	= tab[10].split('=')[1];
	    var subtype	= tab[11].split('=')[1];
	    var description = items[i].getElementsByTagName("description")[0].firstChild.data;
	    var image = items[i].getElementsByTagName("image")[0].firstChild.data;
	    
	    var table = document.createElement('table');
	    with (table)
	    {
		style.display = 'inline';
		style.color = 'white';
		nowrap = 1;
		id = items[i].getElementsByTagName("guid")[0].firstChild.data;
	    }
	    var tr1 = document.createElement('tr');
	    var td1 = document.createElement('td');
	    if (type == 'odf')
		td1.style.background = 'white';
	    td1.style.width = icn_size;
	    var tr2 = document.createElement('tr');
	    var td2 = document.createElement('td');
	    var tr3 = document.createElement('tr');
	    var td3 = document.createElement('td');
	    var div = document.createElement('div');
	    with (div)
	    {
		style.float = 'left';
		style.display = 'inline';
		    }
	    var link = document.createElement('a');
	    with (link){
		border = 0;
		id = count;
		style.display = 'inline';
		href = items[i].getElementsByTagName("link")[0].firstChild.data;
	    }
	    var p = document.createElement('div');
	    with (p)
	    {
		align = 'center';
	    }
	    var img = document.createElement('img');
	    with (img){
		style.display = 'inline';
		src = image;
		border = 0;
		onload = function() {push_progress_bar("progressbar")};
		alt = type;
		width = icn_size;
		id = items[i].getElementsByTagName("guid")[0].firstChild.data;
	    }
	    td1.appendChild(link);
	    tr1.appendChild(td1);
	    table.appendChild(tr1);
	    td3.id = i+'desc_frame';
	    var object;
	    if (type != 'img')
	    {
		if (type == 'aud')
		{
		    //				alert(subtype);
		    if (
			(subtype == 'ogg' && Modernizr.audio.ogg) || 
			    (subtype == 'mp3' && Modernizr.audio.mp3) || 
			    (subtype == 'wav' && Modernizr.audio.wav) || 
			    (subtype == 'm4a' && Modernizr.audio.m4a)
		    ) 
		    {
			object = document.createElement('audio');
			with (object){
			    style.display = 'inline';
			    src = items[i].getElementsByTagName("link")[0].firstChild.data;
			    onload = function() {push_progress_bar("progressbar")};
			    alt = type;
			    controls = 'true';
			    width = icn_size;
			    id = items[i].getElementsByTagName("guid")[0].firstChild.data;
			}
		    }
		    else
		    {
			object = document.createElement('p');
			with (object){
			    style.display = 'inline';
			    innerHTML = description;
					}					
		    }
		}
		if (type == 'vid')
		{
		    if (Modernizr.video) {
			if (0)//Modernizr.video.ogg || Modernizr.video.h264)
			{
			    object = document.createElement('video');
			    with (object){
				style.display = 'inline';
				src = items[i].getElementsByTagName("link")[0].firstChild.data;
				onload = function() {push_progress_bar("progressbar")};
				onerror = "function() {document.getElementById('"+i+'desc_frame'+"').innerHTML = '"  + description + "';}";
				alt = type;
				controls = 'true';
				width = icn_size;
				id = items[i].getElementsByTagName("guid")[0].firstChild.data;
			    }
			}
			else
			{
			    object = document.createElement('p');
			    with (object){
				style.display = 'inline';
				innerHTML = description;
			    }
			}
		    }
		}
		if (type == 'dir')
		{
		    object = document.createElement('p');
		    with (object){
			style.fontsize = 6;
			align = 'center';
			innerHTML += ' (' + count + '&nbsp;&eacute;lements,&nbsp;' + size + ' ' + unit + ')<br>';
//			innerHTML += '<a href="https://' + server_name + '/' + web_base_dir + '/' + send_file + '?type=rar&dir=' + where + '">Rar</a>&nbsp;|&nbsp;';
//			innerHTML += '<a href="https://' + server_name + '/' + web_base_dir + '/' + send_file + '?type=tgz&dir=' + where + '">Tgz</a>&nbsp;|&nbsp;';
//			innerHTML += '<a href="https://' + server_name + '/' + web_base_dir + '/' + send_file + '?type=zip&dir=' + where + '">Zip</a>&nbsp;|&nbsp;';
		    }
		}
		if (type != 'odf')
		    td2.width = 1.7*icn_size;
		td2.innerHTML += '<div width=' + 2*icn_size + ' align=center>' + fname + '</div>';
		tr2.appendChild(td2);
		table.appendChild(tr2);
	    }
	    //		with (td3)
	    //  {
	    //style.display = 'none';
	    if (type == 'aud' || type == 'dir')
		td3.appendChild(object);
	    else if (type == 'vid')
	    {
		td1.appendChild(object);
		//				link.appendChild(td2);
	    }			    
	    else
		innerHTML = description;
	    //  }
	    tr3.appendChild(td3);
	    if (type == 'vid' || type == 'aud' || type == 'dir')
	    {
		table.appendChild(tr3);
	    }
	    //		object.addEventListener("mouseover", showadvinfo, false);
	    //object.addEventListener("mouseout", unshowadvinfo, false);
	    div.appendChild(table);
	    output.appendChild(div);
	    link.appendChild(p);
	    if (type != 'dir')
		link.target = '_blank';
	    if (type != 'vid')
		p.appendChild(img);
	}
    } catch (e) {
	alert("show_stream : " + e + "\n" + items[i].getElementsByTagName("guid")[0].firstChild.data);
    }
}

function draw_pola() 
{
    if (Modernizr.canvas)
    {
	for (i = 0; i < document.images.length; i++)
	{
	    if (document.images[i].getAttribute('id').split('_')[1] != 'frame') 
	    {
		var tab		= document.images[i].id.split(':');
		var section		= tab[0].split('=')[1];
		var where		= tab[1].split('=')[1];
		var num		= tab[2].split('=')[1];
		var total		= tab[3].split('=')[1];
		var size		= tab[4].split('=')[1];
		var unit		= tab[5].split('=')[1];
		var count		= tab[6].split('=')[1];
		var icn_size	= tab[7].split('=')[1];
		var type		= tab[8].split('=')[1].split('_')[0];
		var fname		= tab[9].split('=')[1];
		var comment		= tab[10].split('=')[1];
		
		if (document.images[i].getAttribute('alt') == 'img') 
		{// -3.5 => 2
		    var coef = Math.random()*5.5 - 3.5;
		    canvas = document.createElement('CANVAS');
		    canvas.setAttribute('width', 300);
		    canvas.setAttribute('height', 300);
		    canvas.style.display = 'inline';
		    document.images[i].parentNode.insertBefore(canvas, document.images[i]);
		    ctx = canvas.getContext('2d');
		    ctx.rotate(coef*Math.PI/140);
		    ctx.drawImage(document.images[i], 20, 42, 256, 192);
		    document.images[i].style.display = 'none';
		    ctx.rotate(Math.PI/120);
		    ctx.drawImage(document.getElementById('pola_frame'), 0, 2);
		    ctx.textAlign = 'center';
		    ctx.font = "7pt cursive";
		    ctx.fillStyle = 'black';
		    if (Modernizr.canvastext) 
		    {
			ctx.fillText(' ', (document.images[i].width+55)/2, 192+105-265); // webkit bug ... pour opera c'est pire, il connait meme pas fillText !
			ctx.fillText('Photo ' + num + ' sur ' + total + ",    (" + size + " " + unit + ") ", (document.images[i].width+55)/2, 192+105-265);
			ctx.font = "bold 10pt cursive";
			ctx.fillText(comment.split('#')[0] + ' ', (document.images[i].width+55)/2, 247);
			if (comment.split('#')[1])
			    ctx.fillText(comment.split('#')[1] + ' ', (document.images[i].width+55)/2, 261);
			if (comment.split('#')[2])
			    ctx.fillText(comment.split('#')[2] + ' ', (document.images[i].width+55)/2, 275);
		    }
		}
	    }
	}
    }
}
