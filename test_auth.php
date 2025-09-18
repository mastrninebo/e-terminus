<?php
require_once __DIR__ . '/config/zynlepay.php';

$payload = [
    "merchantid" => ZYNLEPAY_MERCHANT_ID,
    "api_id"     => ZYNLEPAY_API_ID,
    "api_key"    => ZYNLEPAY_API_KEY,
    // not a real transaction, just a dummy check field
    "test"       => true
];

$ch = curl_init(ZYNLEPAY_BASE_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo "❌ cURL Error: " . curl_error($ch);
} else {
    echo "✅ POST request sent to " . ZYNLEPAY_BASE_URL . "\n";
    echo "HTTP Status: " . $httpCode . "\n";
    echo "Response:\n";
    echo $response . "\n";
}

curl_close($ch);
