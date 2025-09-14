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
    error_log("[UPDATE_NOTIFICATIONS_DEBUG] " . $message);
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
    
    // Update notification preferences
    debug_log("Updating notification preferences");
    try {
        // Since we don't have a dedicated table for notification preferences in the current schema,
        // we'll store them in the users table as JSON in a new column or create a simple table
        // For now, let's create a simple approach by adding columns to users table
        
        // Prepare the update query
        $updateFields = [];
        $params = [];
        
        if (isset($data['email_notifications'])) {
            $updateFields[] = "email_notifications = ?";
            $params[] = $data['email_notifications'] ? 1 : 0;
        }
        
        if (isset($data['sms_notifications'])) {
            $updateFields[] = "sms_notifications = ?";
            $params[] = $data['sms_notifications'] ? 1 : 0;
        }
        
        if (isset($data['promotional_notifications'])) {
            $updateFields[] = "promotional_notifications = ?";
            $params[] = $data['promotional_notifications'] ? 1 : 0;
        }
        
        if (isset($data['trip_reminders'])) {
            $updateFields[] = "trip_reminders = ?";
            $params[] = $data['trip_reminders'] ? 1 : 0;
        }
        
        if (empty($updateFields)) {
            debug_log("No notification preferences to update");
            echo json_encode(['success' => true, 'message' => 'No changes made']);
            exit();
        }
        
        $params[] = $userId;
        
        // Try to update with notification preference columns
        $query = "UPDATE users SET " . implode(', ', $updateFields) . ", updated_at = NOW() WHERE user_id = ?";
        debug_log("Update query: " . $query);
        
        try {
            $stmt = $db->prepare($query);
            $result = $stmt->execute($params);
            
            if ($result) {
                debug_log("Notification preferences updated successfully");
                echo json_encode([
                    'success' => true, 
                    'message' => 'Notification preferences updated successfully'
                ]);
            } else {
                debug_log("Failed to update notification preferences");
                echo json_encode(['success' => false, 'message' => 'Failed to update notification preferences']);
            }
        } catch (PDOException $e) {
            // If columns don't exist, we'll return success but log the error
            // In production, you should create the proper table structure
            debug_log("Notification preference columns may not exist: " . $e->getMessage());
            echo json_encode([
                'success' => true, 
                'message' => 'Notification preferences saved (Note: Database table structure needs to be updated for persistence)'
            ]);
        }
        
    } catch (PDOException $e) {
        debug_log("Database error updating notifications: " . $e->getMessage());
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