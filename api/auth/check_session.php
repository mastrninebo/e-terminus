<?php
header('Content-Type: application/json');
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../includes/jwt-helper.php';

session_start();

if (empty($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['authenticated' => false]);
    exit;
}

try {
    $db = Database::getInstance();
    
    // Verify token from database
    $stmt = $db->prepare("
        SELECT * FROM user_sessions 
        WHERE jwt_token = ? AND expires_at > NOW()
    ");
    $stmt->execute([$_SESSION['user']['token']]);
    $session = $stmt->fetch();

    if (!$session) {
        http_response_code(401);
        echo json_encode(['authenticated' => false]);
        exit;
    }

    // Return user data
    echo json_encode([
        'authenticated' => true,
        'user' => $_SESSION['user']
    ]);
    
} catch (PDOException $e) {
    error_log("Session check error: ".$e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Session verification failed']);
}