<?php
namespace SimpleGallery\Apps\Browser\Backend;

class BrowserProxyAction {

    /**
     * Check if a URL is safe for public proxying (Anti-SSRF).
     */
    public static function isSafePublicUrl(string $url): bool {
        $parsed = parse_url($url);
        if (!$parsed || empty($parsed['host'])) {
            return false;
        }

        $scheme = strtolower($parsed['scheme'] ?? '');
        if (!in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        $host = strtolower(trim($parsed['host']));

        // Block obvious loopback and internal keywords
        if (in_array($host, ['localhost', 'loopback', 'broadcasthost'], true)) {
            return false;
        }

        // Direct IP address check
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (!filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
            if (strpos($host, '127.') === 0 || strpos($host, '169.254.') === 0 || strpos($host, '0.') === 0) {
                return false;
            }
            return true;
        }

        // Domain name: resolve DNS
        $resolved_ips = [];
        $ips = @dns_get_record($host, DNS_A + (defined('DNS_AAAA') ? DNS_AAAA : 0));
        if (!empty($ips)) {
            foreach ($ips as $record) {
                if (!empty($record['ip'])) $resolved_ips[] = $record['ip'];
                if (!empty($record['ipv6'])) $resolved_ips[] = $record['ipv6'];
            }
        }
        if (empty($resolved_ips)) {
            $ip = @gethostbyname($host);
            if ($ip && $ip !== $host) {
                $resolved_ips[] = $ip;
            }
        }

        if (empty($resolved_ips)) {
            return false;
        }

        foreach ($resolved_ips as $rip) {
            if (!filter_var($rip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
            if (strpos($rip, '127.') === 0 || strpos($rip, '169.254.') === 0 || strpos($rip, '0.') === 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Rewrite HTML to inject <base> and proxy navigation script.
     */
    public static function processHtml(string $html, string $source_url): string {
        $parsed = parse_url($source_url);
        $scheme = $parsed['scheme'] ?? 'https';
        $host = $parsed['host'] ?? '';
        $port = isset($parsed['port']) ? ':' . $parsed['port'] : '';
        $path = isset($parsed['path']) ? dirname($parsed['path']) : '';
        if ($path === '\\' || $path === '.') $path = '';
        
        $base_url = rtrim($scheme . '://' . $host . $port . $path, '/') . '/';

        // Script to intercept links and forms to keep navigation inside the WebOS proxy
        $proxy_client_script = '<script id="webos-browser-proxy-helper">'
            . '(function(){'
            . '  var PROXY_ENDPOINT = "api.php?action=browser_proxy&url=";'
            . '  document.addEventListener("click", function(e){'
            . '    var a = e.target.closest("a");'
            . '    if(a && a.href && !a.href.startsWith("javascript:") && !a.href.startsWith("#")){'
            . '      if(!a.href.includes("action=browser_proxy")){'
            . '        e.preventDefault();'
            . '        window.location.href = PROXY_ENDPOINT + encodeURIComponent(a.href);'
            . '      }'
            . '    }'
            . '  }, true);'
            . '  if(window.parent && window.parent !== window){'
            . '    window.parent.postMessage({ type: "webos-browser-navigated", url: ' . json_encode($source_url) . ' }, "*");'
            . '  }'
            . '})();'
            . '</script>';

        // Inject <base> tag if not present
        if (!preg_match('/<base\s[^>]*href=/i', $html)) {
            $base_tag = '<base href="' . htmlspecialchars($base_url, ENT_QUOTES, 'UTF-8') . '" />' . "\n" . $proxy_client_script;
            if (stripos($html, '<head>') !== false) {
                $html = preg_replace('/<head>/i', "<head>\n" . $base_tag, $html, 1);
            } elseif (stripos($html, '<html') !== false) {
                $html = preg_replace('/(<html[^>]*>)/i', "$1\n<head>" . $base_tag . "</head>", $html, 1);
            } else {
                $html = "<head>" . $base_tag . "</head>\n" . $html;
            }
        } else {
            // Append helper script after existing base or head
            if (stripos($html, '</head>') !== false) {
                $html = str_ireplace('</head>', $proxy_client_script . "\n</head>", $html);
            } else {
                $html = $proxy_client_script . "\n" . $html;
            }
        }

        return $html;
    }

    /**
     * Dispatcher handle entry point.
     */
    public static function handle(string $action, array $params, array $context): ?array {
        if ($action !== 'browser_proxy') {
            return null;
        }

        $url = trim($params['url'] ?? $_GET['url'] ?? '');
        if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return [
                'status' => 400,
                'data'   => ['success' => false, 'error' => 'URL invalide ou absente.']
            ];
        }

        $scheme = strtolower(parse_url($url, PHP_URL_SCHEME) ?? '');
        if (!in_array($scheme, ['http', 'https'], true)) {
            return [
                'status' => 400,
                'data'   => ['success' => false, 'error' => 'Seuls les protocoles HTTP et HTTPS sont autorisés.']
            ];
        }

        if (!self::isSafePublicUrl($url)) {
            return [
                'status' => 403,
                'data'   => ['success' => false, 'error' => 'Accès refusé : adresse IP ou réseau privé non autorisé (anti-SSRF).']
            ];
        }

        // Check if running in mock/CLI test mode
        $is_test = !empty($params['test_mode']) || (!empty($context['test_mode']));
        if ($is_test && !empty($params['mock_body'])) {
            $processed = self::processHtml((string)$params['mock_body'], $url);
            return [
                'status' => 200,
                'data'   => [
                    'success'      => true,
                    'url'          => $url,
                    'content_type' => 'text/html; charset=utf-8',
                    'content'      => $processed
                ]
            ];
        }

        // Perform cURL request
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SimpleGallery-WebOSBrowser/1.0');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language: fr,fr-FR;q=0.9,en;q=0.8',
            'Cache-Control: no-cache'
        ]);

        $response = @curl_exec($ch);
        $status_code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $content_type = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $header_size = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $curl_error = curl_error($ch);
        curl_close($ch);

        if ($response === false || empty($response)) {
            $err_msg = !empty($curl_error) ? $curl_error : 'Impossible de contacter le serveur distant.';
            if ($is_test || PHP_SAPI === 'cli') {
                return [
                    'status' => 502,
                    'data'   => ['success' => false, 'error' => $err_msg]
                ];
            }
            http_response_code(502);
            header('Content-Type: text/html; charset=utf-8');
            echo '<div style="font-family:sans-serif;padding:30px;background:#0f172a;color:#f8fafc;min-height:100vh;">'
               . '<h2 style="color:#ef4444;">❌ Erreur Proxy WebOS (502 Bad Gateway)</h2>'
               . '<p>Le serveur WebOS n\'a pas pu joindre la destination distante : <code>' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '</code></p>'
               . '<p style="color:#94a3b8;font-size:0.9rem;">Détails : ' . htmlspecialchars($err_msg, ENT_QUOTES, 'UTF-8') . '</p>'
               . '</div>';
            exit;
        }

        $body = substr($response, $header_size);
        if ($body === false) $body = '';

        // Process HTML content
        $is_html = (stripos($content_type, 'text/html') !== false || stripos($content_type, 'application/xhtml+xml') !== false);
        if ($is_html) {
            $body = self::processHtml($body, $url);
            if (empty($content_type)) $content_type = 'text/html; charset=utf-8';
        }

        if ($is_test || PHP_SAPI === 'cli') {
            return [
                'status' => $status_code ?: 200,
                'data'   => [
                    'success'      => true,
                    'url'          => $url,
                    'content_type' => $content_type,
                    'content'      => $body
                ]
            ];
        }

        // Web Request output
        @session_write_close();
        http_response_code($status_code ?: 200);

        if (!empty($content_type)) {
            header("Content-Type: {$content_type}");
        }
        // Permit framing by our own origin (stripping remote X-Frame-Options)
        header('X-Frame-Options: SAMEORIGIN');
        header('Access-Control-Allow-Origin: *');

        echo $body;
        exit;
    }
}
