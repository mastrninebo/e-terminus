<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: http://localhost");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once __DIR__.'/../../config/database.php';
session_start();

// Get token from session or cookie
$token = null;

if (isset($_SESSION['auth_token'])) {
    $token = $_SESSION['auth_token'];
} elseif (isset($_COOKIE['auth_token'])) {
    $token = $_COOKIE['auth_token'];
}

if ($token) {
    try {
        $db = Database::getInstance();
        
        // Remove session from database
        $stmt = $db->prepare("
            DELETE FROM user_sessions 
            WHERE jwt_token = ?
        ");
        $stmt->execute([$token]);
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

// Clear auth token cookie
setcookie('auth_token', '', time() - 3600, '/', '', true, true);

echo json_encode(['success' => true, 'message' => 'Logged out successfully']);