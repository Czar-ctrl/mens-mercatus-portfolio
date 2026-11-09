<?php
/**
 * Same-origin proxy to loopback Mercatus Cartel Robot.
 * Shared host proxy → VPS robot via https://api.mensmercatus.online (raw IP hits nginx default vhost → 404). Override with MERCATUS_ROBOT_URL.
 * Routing: prefer ?path=/health (CGI-safe); also PATH_INFO when available.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: https://mensmercatus.online');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$upstream = getenv('MERCATUS_ROBOT_URL') ?: 'https://api.mensmercatus.online';

$path = '';
if (!empty($_GET['path'])) {
  $path = (string)$_GET['path'];
} elseif (!empty($_SERVER['PATH_INFO'])) {
  $path = (string)$_SERVER['PATH_INFO'];
} elseif (!empty($_SERVER['QUERY_STRING']) && str_starts_with($_SERVER['QUERY_STRING'], '/')) {
  // CGI style: index.php?/health
  $path = explode('&', $_SERVER['QUERY_STRING'], 2)[0];
}

if ($path === '' || $path === '/') {
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $path = '/health';
  } else {
    http_response_code(404);
    echo json_encode([
      'status' => 'error',
      'name' => 'Mercatus Cartel Robot',
      'error' => 'path_required',
      'message' => 'POST needs path. Examples: /api/cartel/index.php?path=/api/mercatus-cartel/assist or /api/cartel/index.php?/api/mercatus-cartel/chat',
      'assistUi' => 'https://mensmercatus.online/apps/mercatus-assist/',
      'mode' => 'proxy',
    ], JSON_UNESCAPED_SLASHES);
    exit;
  }
}
if ($path[0] !== '/') {
  $path = '/' . $path;
}

$url = rtrim($upstream, '/') . $path;
$body = file_get_contents('php://input');
$ch = curl_init($url);
$opts = [
  CURLOPT_CUSTOMREQUEST => $_SERVER['REQUEST_METHOD'],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CONNECTTIMEOUT => 5,
  CURLOPT_TIMEOUT => 45,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
];
if ($body !== false && $body !== '') {
  $opts[CURLOPT_POSTFIELDS] = $body;
}
curl_setopt_array($ch, $opts);
$resp = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);
if ($resp === false || $code === 0) {
  http_response_code(503);
  echo json_encode([
    'status' => 'offline',
    'name' => 'Mercatus Cartel Robot',
    'error' => 'upstream_unreachable',
    'message' => 'Upstream Mercatus Cartel Robot unreachable from this shared host proxy.',
    'detail' => $err ?: 'upstream not configured for this host',
    'hint' => 'Check https://api.mensmercatus.online/health or fall back to DEMO coaching at /apps/mercatus-assist/.',
    'assistUi' => 'https://mensmercatus.online/apps/mercatus-assist/',
    'probe' => 'https://mensmercatus.online/api/cartel/index.php',
    'upstream' => $upstream,
    'mode' => 'demo_fallback',
  ], JSON_UNESCAPED_SLASHES);
  exit;
}
http_response_code($code ?: 502);
echo $resp;
