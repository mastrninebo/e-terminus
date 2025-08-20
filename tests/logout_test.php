<?php
session_start();
$_SESSION['user'] = [
    'id' => 1,
    'token' => 'YOUR_JWT_TOKEN'
];

$ch = curl_init('http://localhost/e-terminus/api/auth/logout.php');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);

$response = curl_exec($ch);
echo "LOGOUT RESPONSE:\n";
print_r(json_decode($response, true));

// Verify session deleted
$db = new PDO('mysql:host=localhost;dbname=e_terminus', 'root', '@Master78');
$stmt = $db->prepare("SELECT * FROM user_sessions WHERE jwt_token = ?");
$stmt->execute(['YOUR_JWT_TOKEN']);
echo "SESSION IN DB:\n";
print_r($stmt->fetch(PDO::FETCH_ASSOC));