<?php
header('Content-Type: application/json');
// Dynamic CORS handling
$allowed_origins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Allow-Credentials: true");
}
// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../includes/jwt-helper.php';

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Debug function
function debug_log($message) {
    error_log("[CHANGE_PASSWORD_DEBUG] " . $message);
}

debug_log("Script started");

// Get token from request
$token = null;
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        debug_log("Token found in Authorization header");
    }
}
if (!$token && isset($_COOKIE['auth_token'])) {
    $token = $_COOKIE['auth_token'];
    debug_log("Token found in cookie");
}
if (!$token && isset($_SESSION['auth_token'])) {
    $token = $_SESSION['auth_token'];
    debug_log("Token found in session");
}
if (!$token) {
    debug_log("No token found");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

debug_log("Token found: " . substr($token, 0, 20) . "...");

// Get JSON data
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    debug_log("Invalid JSON data");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request data']);
    exit();
}

debug_log("Request data: " . json_encode($data));

// Validate required fields
if (!isset($data['current_password']) || !isset($data['new_password']) || !isset($data['confirm_password'])) {
    debug_log("Missing required fields");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Current password, new password, and confirmation are required']);
    exit();
}

// Validate password match
if ($data['new_password'] !== $data['confirm_password']) {
    debug_log("New passwords do not match");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'New passwords do not match']);
    exit();
}

// Validate password strength (minimum 8 characters)
if (strlen($data['new_password']) < 8) {
    debug_log("New password too short");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'New password must be at least 8 characters long']);
    exit();
}

try {
    // Verify JWT token
    debug_log("Validating JWT token");
    $payload = JWTHelper::validateToken($token);
    
    if (!$payload) {
        debug_log("JWT validation failed");
        http_response_code(401);
        echo json_encode(['authenticated' => false, 'reason' => 'Invalid token']);
        exit();
    }
    
    debug_log("JWT validation successful");
    
    // Get database instance
    debug_log("Getting database instance");
    $db = Database::getInstance();
    
    // Verify token exists in database and is not expired
    debug_log("Verifying session in database");
    $stmt = $db->prepare("
        SELECT us.*, u.username, u.email, u.user_type, u.created_at 
        FROM user_sessions us
        JOIN users u ON us.user_id = u.user_id
        WHERE us.jwt_token = ? AND us.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if (!$session) {
        debug_log("Session not found in database");
        http_response_code(401);
        echo json_encode(['authenticated' => false, 'reason' => 'Invalid or expired session']);
        exit();
    }
    
    debug_log("Session found for user: " . $session['username']);
    
    // Get user ID from session
    $userId = $session['user_id'];
    debug_log("User ID: " . $userId);
    
    // Get current user data
    debug_log("Getting current user data");
    try {
        $stmt = $db->prepare("SELECT password_hash FROM users WHERE user_id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        if (!$user) {
            debug_log("User not found");
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found']);
            exit();
        }
        
        debug_log("User data found");
        
        // Verify current password
        debug_log("Verifying current password");
        if (!password_verify($data['current_password'], $user['password_hash'])) {
            debug_log("Current password verification failed");
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
            exit();
        }
        
        debug_log("Current password verified");
        
        // Hash new password
        debug_log("Hashing new password");
        $newPasswordHash = password_hash($data['new_password'], PASSWORD_DEFAULT);
        
        // Update password
        debug_log("Updating password in database");
        $stmt = $db->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?");
        $result = $stmt->execute([$newPasswordHash, $userId]);
        
        if ($result) {
            debug_log("Password updated successfully");
            
            // Invalidate all existing sessions except current one
            debug_log("Invalidating other sessions");
            $stmt = $db->prepare("DELETE FROM user_sessions WHERE user_id = ? AND jwt_token != ?");
            $stmt->execute([$userId, $token]);
            
            echo json_encode([
                'success' => true, 
                'message' => 'Password updated successfully. All other sessions have been logged out.'
            ]);
        } else {
            debug_log("Failed to update password");
            echo json_encode(['success' => false, 'message' => 'Failed to update password']);
        }
        
    } catch (PDOException $e) {
        debug_log("Database error: " . $e->getMessage());
        throw $e;
    }
    
} catch (PDOException $e) {
    debug_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    debug_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}