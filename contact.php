<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Use the contact form.']);
    exit;
}

function field(string $key, int $max): string
{
    $value = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $value = str_replace(["\r", "\n"], ' ', $value);
    if (strlen($value) > $max) {
        $value = substr($value, 0, $max);
    }
    return $value;
}

$name = field('name', 120);
$email = field('email', 160);
$company = field('company', 160);
$message = isset($_POST['message']) ? trim((string) $_POST['message']) : '';
$message = str_replace("\r\n", "\n", $message);
$message = str_replace("\r", "\n", $message);

if ($name === '' || $email === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Name, email, and a message are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Enter a valid email so I can reply.']);
    exit;
}

if (strlen($message) > 4000) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Keep the message under 4000 characters.']);
    exit;
}

$who = $company !== '' ? $name . ' at ' . $company : $name;
$subject = 'Mens Mercatus — ' . $who;
$body = "From: {$name} <{$email}>\nCompany: " . ($company !== '' ? $company : '—') . "\n\n{$message}\n";
$headers = implode("\r\n", [
    'From: Mens Mercatus <noreply@mensmercatus.online>',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
]);

$sent = mail('katlego.mokoto.km@gmail.com', $subject, $body, $headers);

if (!$sent) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'The message did not leave the server. Use the email link below.']);
    exit;
}

echo json_encode(['ok' => true]);
