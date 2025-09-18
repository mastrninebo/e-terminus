<?php
// test_connection.php
require_once __DIR__ . '/config/zynlepay.php';

// Just try hitting the base URL
$ch = curl_init(ZYNLEPAY_BASE_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo "❌ cURL Error: " . curl_error($ch);
} else {
    echo "✅ Connected to " . ZYNLEPAY_BASE_URL . "\n";
    echo "HTTP Status: " . $httpCode . "\n";
    echo "Response (first 300 chars):\n";
    echo substr($response, 0, 300) . "\n";
}

curl_close($ch);
