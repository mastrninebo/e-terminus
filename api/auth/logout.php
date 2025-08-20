<?php
header('Content-Type: application/json');
require_once __DIR__.'/../../config/database.php';

session_start();

if (!empty($_SESSION['user']['token'])) {
    try {
        $db = Database::getInstance();
        
        // Remove session from database
        $stmt = $db->prepare("
            DELETE FROM user_sessions 
            WHERE jwt_token = ?
        ");
        $stmt->execute([$_SESSION['user']['token']]);
    } catch (PDOException $e) {
        error_log("Logout error: ".$e->getMessage());
    }
}

// Clear all session data
$_SESSION = array();

// Destroy session
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

session_destroy();

echo json_encode(['success' => true, 'message' => 'Logged out successfully']);