<?php
header('Content-Type: application/json');
// Dynamic CORS handling
$allowed_origins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Allow-Credentials: true");
}
// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../includes/jwt-helper.php';
session_start();
// Debug logging (remove in production)
error_log("=== SESSION DEBUG ===");
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("Origin: " . ($_SERVER['HTTP_ORIGIN'] ?? 'None'));
error_log("Session ID: " . session_id());
error_log("Session data: " . json_encode($_SESSION));
error_log("Cookies: " . json_encode($_COOKIE));
error_log("Headers: " . json_encode(getallheaders()));
try {
    $db = Database::getInstance();
    
    // Get token from Authorization header or cookie
    $token = null;
    
    // Check Authorization header first
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
            error_log("Token found in Authorization header");
        }
    }
    
    // If no header, check cookie
    if (!$token && isset($_COOKIE['auth_token'])) {
        $token = $_COOKIE['auth_token'];
        error_log("Token found in cookie");
    }
    
    // If no cookie, check session (updated variable name)
    if (!$token && isset($_SESSION['auth_token'])) {
        $token = $_SESSION['auth_token'];
        error_log("Token found in session");
    }
    
    if (!$token) {
        error_log("No token found in any location");
        http_response_code(401);
        echo json_encode(['authenticated' => false, 'reason' => 'No token provided']);
        exit();
    }
    
    error_log("Token found: " . substr($token, 0, 20) . "...");
    
    // Verify JWT token
    try {
        $payload = JWTHelper::validateToken($token);
        error_log("JWT validation successful");
        
        // Verify token exists in database and is not expired
        $stmt = $db->prepare("
            SELECT us.*, u.username, u.email, u.user_type, u.created_at 
            FROM user_sessions us
            JOIN users u ON us.user_id = u.user_id
            WHERE us.jwt_token = ? AND us.expires_at > NOW()
        ");
        $stmt->execute([$token]);
        $session = $stmt->fetch();
        
        if (!$session) {
            error_log("Token not found in database or expired");
            http_response_code(401);
            echo json_encode(['authenticated' => false, 'reason' => 'Invalid or expired session']);
            exit();
        }
        
        error_log("Session found in database for user: " . $session['username']);
        
        // Check if user is an admin
        $isAdmin = ($session['user_type'] === 'admin');
        
        // Return user data
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'user_id' => $session['user_id'],
                'username' => $session['username'],
                'email' => $session['email'],
                'user_type' => $session['user_type'],
                'created_at' => $session['created_at'],
                'is_admin' => $isAdmin
            ]
        ]);
        
    } catch (Exception $e) {
        error_log("JWT validation error: " . $e->getMessage());
        http_response_code(401);
        echo json_encode(['authenticated' => false, 'reason' => 'Invalid token']);
    }
    
} catch (PDOException $e) {
    error_log("Session check error: ".$e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Session verification failed']);
} catch (Exception $e) {
    error_log("Unexpected error: ".$e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'An unexpected error occurred']);
}