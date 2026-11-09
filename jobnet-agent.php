<?php
/**
 * JobNet guarded sender.
 * Sends an employer note only when a published employer address is found on
 * the posting (API text, LinkedIn guest description, or a verified override),
 * the mailbox domain resolves, and the letter cites that role. Otherwise it holds.
 * Always emails a report to Katlego.
 */
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$tokenFile = dirname(__DIR__) . '/.jobnet-agent-token';
$logFile = dirname(__DIR__) . '/.jobnet-send-log.json';
$overrideFile = dirname(__DIR__) . '/.jobnet-email-overrides.json';
$forceFile = dirname(__DIR__) . '/.jobnet-force-send';
$provided = isset($_GET['token']) ? (string) $_GET['token'] : '';
$expected = is_readable($tokenFile) ? trim((string) file_get_contents($tokenFile)) : '';
if ($expected === '' || !hash_equals($expected, $provided)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

// Explicit override only: ?force=1 or a non-empty ~/.jobnet-force-send file on the server.
$forceQuery = isset($_GET['force']) && (string) $_GET['force'] === '1';
$forceFileOn = is_readable($forceFile) && trim((string) file_get_contents($forceFile)) !== '';
$forceSend = $forceQuery || $forceFileOn;

// Candidate identity — applications Reply-To and letter signature always use this Gmail.
const CANDIDATE_EMAIL = 'katlego.mokoto.km@gmail.com';
const CANDIDATE_NAME = 'Katlego Mokoto';
const CANDIDATE_PHONE = '065 842 4274';
const LISTINGS_URL = 'https://api.mensmercatus.online/jobnet/api/listings?limit=100';
const MAX_SENDS = 3;

function load_json_file(string $path): array
{
    if (!is_readable($path)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

function save_log(string $path, array $log): void
{
    file_put_contents($path, json_encode($log, JSON_PRETTY_PRINT));
}

function listing_text(array $job): string
{
    $parts = [];
    foreach ($job as $value) {
        if (is_string($value)) {
            $parts[] = $value;
        }
    }
    return implode("\n", $parts);
}

function extract_emails(string $text): array
{
    if (!preg_match_all('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $text, $matches)) {
        return [];
    }
    $found = [];
    foreach ($matches[0] as $email) {
        $email = strtolower(trim($email, ".,; "));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        if (preg_match('/\.(png|jpg|jpeg|gif|svg|webp)$/i', $email)) {
            continue;
        }
        $found[$email] = $email;
    }
    unset($found[strtolower(CANDIDATE_EMAIL)]);
    return array_values($found);
}

function linkedin_job_id(string $url): string
{
    if (preg_match('#linkedin\.com/jobs/view/(\d+)#i', $url, $m)) {
        return $m[1];
    }
    return '';
}

function fetch_url(string $url): string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; JobNetGuard/1.1; +https://mensmercatus.online)',
            CURLOPT_HTTPHEADER => ['Accept-Language: en-ZA,en;q=0.9'],
        ]);
        $body = curl_exec($ch);
        curl_close($ch);
        return is_string($body) ? $body : '';
    }
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 20,
            'header' => "User-Agent: Mozilla/5.0 (compatible; JobNetGuard/1.1)\r\nAccept-Language: en-ZA,en;q=0.9\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    return is_string($body) ? $body : '';
}

function emails_from_linkedin_posting(string $url): array
{
    $jobId = linkedin_job_id($url);
    if ($jobId === '') {
        return [];
    }
    $guest = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' . $jobId;
    $html = fetch_url($guest);
    if ($html === '') {
        $html = fetch_url($url);
    }
    if ($html === '') {
        return [];
    }
    if (preg_match('#description__text(.*?)(?:</section>|show-more-less)#is', $html, $m)) {
        $chunk = html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return extract_emails($chunk);
    }
    return extract_emails(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

function override_email(array $job, array $overrides): ?array
{
    $id = (string) ($job['id'] ?? '');
    if ($id === '' || !isset($overrides[$id]) || !is_array($overrides[$id])) {
        return null;
    }
    $row = $overrides[$id];
    $email = strtolower(trim((string) ($row['email'] ?? '')));
    $source = trim((string) ($row['source'] ?? 'verified override'));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return null;
    }
    return [$email, $source];
}

function emails_in_posting(array $job, array $overrides): array
{
    $found = [];
    foreach (extract_emails(listing_text($job)) as $email) {
        $found[$email] = 'listing API text';
    }
    $url = trim((string) ($job['url'] ?? $job['link'] ?? ''));
    if ($url !== '') {
        foreach (emails_from_linkedin_posting($url) as $email) {
            if (!isset($found[$email])) {
                $found[$email] = 'LinkedIn posting description';
            }
        }
    }
    $override = override_email($job, $overrides);
    if ($override !== null) {
        [$email, $source] = $override;
        $found[$email] = $source;
    }
    $out = [];
    foreach ($found as $email => $source) {
        $out[] = ['email' => $email, 'source' => $source];
    }
    return $out;
}

function mailbox_verifies(string $email): array
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return [false, 'address format is invalid'];
    }
    $domain = substr(strrchr($email, '@'), 1);
    if ($domain === '' || $domain === 'linkedin.com' || $domain === 'glassdoor.com') {
        return [false, 'domain is a job board, not an employer mailbox'];
    }
    if (!function_exists('getmxrr') || !getmxrr($domain, $hosts) || count($hosts) === 0) {
        if (!checkdnsrr($domain, 'A') && !checkdnsrr($domain, 'MX')) {
            return [false, 'no MX or A record for ' . $domain];
        }
    }
    return [true, 'mailbox domain resolves'];
}

function tailor(array $job): array
{
    $title = trim((string) ($job['title'] ?? 'the role'));
    $company = trim((string) ($job['company'] ?? 'the hiring team'));
    $location = trim((string) ($job['location'] ?? ''));
    $why = trim((string) ($job['why'] ?? ''));
    $subject = 'Application: ' . $title . ' - ' . CANDIDATE_NAME;
    $where = $location !== '' ? ' (' . $location . ')' : '';
    $body = "Dear {$company} hiring team,\n\n";
    $body .= "I am applying for the {$title} role{$where} posted by {$company}.\n\n";
    if ($why !== '') {
        $body .= "I read the posting as asking for this: {$why}\n\n";
    }
    $body .= "I build that kind of system in Python, TypeScript, and C#. Recent work is an ASP.NET Core assistant, a React workspace, a Python research desk, and a browser studio. My own job-search agent, JobNet, sent this note to the address listed for this role. Replies come straight to me.\n\n";
    $body .= "Portfolio: https://mensmercatus.online\n";
    $body .= "Phone: " . CANDIDATE_PHONE . "\n";
    $body .= "Email: " . CANDIDATE_EMAIL . "\n\n";
    $body .= "Kind regards,\n" . CANDIDATE_NAME . "\n";
    return [$subject, $body];
}

function professional(array $job, string $subject, string $body): array
{
    $title = trim((string) ($job['title'] ?? ''));
    $company = trim((string) ($job['company'] ?? ''));
    $why = trim((string) ($job['why'] ?? ''));
    $reasons = [];
    if ($title === '' || stripos($subject . "\n" . $body, $title) === false) {
        $reasons[] = 'letter does not name the job title';
    }
    if ($company === '' || stripos($body, $company) === false) {
        $reasons[] = 'letter does not name the company';
    }
    if ($why !== '' && stripos($body, $why) === false) {
        $reasons[] = 'letter does not use the posting summary';
    }
    if (strlen($body) < 280 || strlen($body) > 2500) {
        $reasons[] = 'length is outside the professional range';
    }
    if (preg_match('/\b(AGI|guaranteed|act now|click here|crypto)\b/i', $body)) {
        $reasons[] = 'blocked phrase';
    }
    if (stripos($body, CANDIDATE_NAME) === false || stripos($body, CANDIDATE_EMAIL) === false) {
        $reasons[] = 'signature is incomplete';
    }
    return [count($reasons) === 0, $reasons];
}

function send_mail(string $to, string $subject, string $body, string $replyTo = CANDIDATE_EMAIL): bool
{
    $to = str_replace(["\r", "\n"], '', $to);
    // Always route replies to the candidate Gmail, never a site noreply box.
    $replyTo = CANDIDATE_EMAIL;
    $subject = str_replace(["\r", "\n"], '', $subject);
    $headers = implode("\r\n", [
        'From: ' . CANDIDATE_NAME . ' <noreply@mensmercatus.online>',
        'Reply-To: ' . CANDIDATE_NAME . ' <' . $replyTo . '>',
        'Sender: ' . CANDIDATE_NAME . ' <noreply@mensmercatus.online>',
        'Content-Type: text/plain; charset=UTF-8',
    ]);
    return mail($to, $subject, $body, $headers);
}

$raw = @file_get_contents(LISTINGS_URL);
$payload = json_decode((string) $raw, true);
$listings = is_array($payload['listings'] ?? null) ? $payload['listings'] : [];
$apiDoNotAutoApply = !empty($payload['do_not_auto_apply']);
$blockAutoApply = $apiDoNotAutoApply && !$forceSend;
$log = load_json_file($logFile);
$overrides = load_json_file($overrideFile);
$sent = [];
$held = [];
$sends = 0;

foreach ($listings as $job) {
    if (!is_array($job)) {
        continue;
    }
    $id = (string) ($job['id'] ?? $job['title'] ?? 'unknown');
    $label = trim((string) ($job['title'] ?? 'Role')) . ' at ' . trim((string) ($job['company'] ?? 'Unknown'));
    if (isset($log[$id])) {
        $held[] = ['id' => $id, 'role' => $label, 'reason' => 'already sent on ' . $log[$id]];
        continue;
    }
    if ($blockAutoApply) {
        $held[] = [
            'id' => $id,
            'role' => $label,
            'reason' => 'listings API has do_not_auto_apply; held until ?force=1 or server .jobnet-force-send is set',
        ];
        continue;
    }
    $addresses = emails_in_posting($job, $overrides);
    if (count($addresses) === 0) {
        $held[] = ['id' => $id, 'role' => $label, 'reason' => 'posting has no employer email address, so none was guessed'];
        continue;
    }
    $chosen = $addresses[0];
    $email = $chosen['email'];
    $source = $chosen['source'];
    [$okBox, $boxReason] = mailbox_verifies($email);
    if (!$okBox) {
        $held[] = ['id' => $id, 'role' => $label, 'reason' => $email . ' failed verification: ' . $boxReason];
        continue;
    }
    [$subject, $body] = tailor($job);
    [$okLetter, $letterReasons] = professional($job, $subject, $body);
    if (!$okLetter) {
        $held[] = ['id' => $id, 'role' => $label, 'reason' => 'tailoring gate: ' . implode('; ', $letterReasons)];
        continue;
    }
    if ($sends >= MAX_SENDS) {
        $held[] = ['id' => $id, 'role' => $label, 'reason' => 'daily send cap of ' . MAX_SENDS . ' reached'];
        continue;
    }
    $delivered = send_mail($email, $subject, $body, CANDIDATE_EMAIL);
    if (!$delivered) {
        $held[] = ['id' => $id, 'role' => $label, 'reason' => 'mail server rejected the send to ' . $email];
        continue;
    }
    $log[$id] = gmdate('c');
    $sends++;
    $sent[] = ['id' => $id, 'role' => $label, 'to' => $email, 'source' => $source];
}
save_log($logFile, $log);

$sampleJob = null;
foreach ($listings as $job) {
    if (is_array($job) && (($job['signal'] ?? '') === 'high')) {
        $sampleJob = $job;
        break;
    }
}
if ($sampleJob === null && isset($listings[0]) && is_array($listings[0])) {
    $sampleJob = $listings[0];
}
$sample = $sampleJob ? tailor($sampleJob) : ['', ''];

$lines = [];
$lines[] = 'JobNet guarded send report';
$lines[] = 'Run at ' . gmdate('c') . ' UTC';
$lines[] = 'Candidate contact used: ' . CANDIDATE_NAME . ' <' . CANDIDATE_EMAIL . '>, phone ' . CANDIDATE_PHONE;
$lines[] = 'Listings reviewed: ' . count($listings);
$lines[] = 'Sent: ' . count($sent);
$lines[] = 'Held: ' . count($held);
$lines[] = '';
$lines[] = 'Guardrails: an address is used only if it is written on the posting (API text, LinkedIn description, or a verified override); the domain must resolve; the letter must name the title, the company, and the posting summary; blocked phrases are refused; at most ' . MAX_SENDS . ' sends per run. When the listings API sets do_not_auto_apply, no employer mail is sent unless ?force=1 or a non-empty .jobnet-force-send file is present. Every employer letter and this report use Reply-To ' . CANDIDATE_EMAIL . '.';
$lines[] = 'API do_not_auto_apply: ' . ($apiDoNotAutoApply ? 'true' : 'false') . '; force override: ' . ($forceSend ? 'yes' : 'no') . '.';
$lines[] = '';
if (count($sent) === 0) {
    if ($blockAutoApply) {
        $lines[] = 'No employer mail was sent because the listings scrape has do_not_auto_apply. Apply manually on LinkedIn, or re-run with ?force=1 / .jobnet-force-send only when a posting-printed address is confirmed.';
    } else {
        $lines[] = 'No employer mail was sent. The current shortlist still lacks published employer mailboxes on most board links, and JobNet does not invent one.';
    }
    $lines[] = '';
}
foreach ($sent as $row) {
    $lines[] = 'SENT ' . $row['role'] . ' -> ' . $row['to'] . ' (source: ' . $row['source'] . ')';
}
foreach ($held as $row) {
    $lines[] = 'HELD ' . $row['role'] . ' - ' . $row['reason'];
}
if ($sample[0] !== '') {
    $lines[] = '';
    $lines[] = 'Sample letter prepared for the strongest current role. It was not sent unless listed above.';
    $lines[] = 'Subject: ' . $sample[0];
    $lines[] = $sample[1];
}
$report = implode("\n", $lines);
$reportSent = send_mail(CANDIDATE_EMAIL, 'JobNet send report - ' . count($sent) . ' sent, ' . count($held) . ' held', $report, CANDIDATE_EMAIL);

echo json_encode([
    'ok' => true,
    'reviewed' => count($listings),
    'do_not_auto_apply' => $apiDoNotAutoApply,
    'force' => $forceSend,
    'sent' => $sent,
    'held' => $held,
    'report_emailed' => $reportSent,
], JSON_PRETTY_PRINT);
