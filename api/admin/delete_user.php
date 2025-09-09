<?php
header('Content-Type: application/json');
// Dynamic CORS handling
$allowed_origins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: DELETE, OPTIONS");
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
// Debug logging
error_log("=== DELETE USER DEBUG ===");
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("Origin: " . ($origin ?? 'None'));
// Only allow DELETE requests
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}
// Get user_id from request parameters
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
if ($user_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid user_id is required']);
    exit();
}
// Try multiple ways to get the Authorization header
$token = null;
// Method 1: Direct from $_SERVER
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    error_log("Found token in HTTP_AUTHORIZATION: " . substr($authHeader, 0, 20) . "...");
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
}
// Method 2: Using getallheaders() if available
if (!$token && function_exists('getallheaders')) {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        error_log("Found token in getallheaders Authorization: " . substr($authHeader, 0, 20) . "...");
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
}
// Method 3: From REDIRECT_HTTP_AUTHORIZATION
if (!$token && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    error_log("Found token in REDIRECT_HTTP_AUTHORIZATION: " . substr($authHeader, 0, 20) . "...");
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
}
// Method 4: Try to get from Apache-specific headers
if (!$token && function_exists('apache_request_headers')) {
    $apacheHeaders = apache_request_headers();
    if (isset($apacheHeaders['Authorization'])) {
        $authHeader = $apacheHeaders['Authorization'];
        error_log("Found token in apache_request_headers Authorization: " . substr($authHeader, 0, 20) . "...");
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
}
// Method 5: Check if token is in a custom header
if (!$token && isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'];
    error_log("Found token in X-Auth-Token header");
}
if (!$token) {
    error_log("No token found in any location");
    http_response_code(401);
    echo json_encode(['error' => 'No token provided']);
    exit();
}
error_log("Token found successfully");
try {
    // Verify JWT token
    $payload = JWTHelper::validateToken($token);
    error_log("JWT validation successful");
    
    // Verify token exists in database and is not expired
    $db = Database::getInstance();
    $stmt = $db->prepare("
        SELECT us.*, u.user_id as admin_id, u.user_type 
        FROM user_sessions us
        JOIN users u ON us.user_id = u.user_id
        WHERE us.jwt_token = ? AND us.expires_at > NOW() AND u.user_type = 'admin'
    ");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if (!$session) {
        error_log("Session not found in database or user is not admin");
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        exit();
    }
    
    $admin_id = $session['admin_id'];
    error_log("Admin session found for admin_id: " . $admin_id);
    
    // Check if user exists
    $stmt = $db->prepare("SELECT * FROM users WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit();
    }
    
    // Prevent admin from deleting themselves
    if ($user_id == $admin_id) {
        http_response_code(403);
        echo json_encode(['error' => 'Admins cannot delete their own account']);
        exit();
    }
    
    // Start transaction
    $db->beginTransaction();
    
    try {
        // 1. Delete user reviews (reviews table references user_id)
        $stmt = $db->prepare("DELETE FROM reviews WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $reviewsDeleted = $stmt->rowCount();
        error_log("Deleted $reviewsDeleted reviews for user_id: $user_id");
        
        // 2. Check if user is an operator and delete operator record
        $stmt = $db->prepare("SELECT operator_id FROM operators WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $operator = $stmt->fetch();
        
        if ($operator) {
            $operator_id = $operator['operator_id'];
            error_log("User is operator with operator_id: $operator_id");
            
            // 2a. Delete buses associated with this operator
            $stmt = $db->prepare("DELETE FROM buses WHERE operator_id = ?");
            $stmt->execute([$operator_id]);
            $busesDeleted = $stmt->rowCount();
            error_log("Deleted $busesDeleted buses for operator_id: $operator_id");
            
            // 2b. Delete operator record
            $stmt = $db->prepare("DELETE FROM operators WHERE user_id = ?");
            $stmt->execute([$user_id]);
            error_log("Deleted operator record for user_id: $user_id");
        }
        
        // 3. Delete user bookings and related data
        // 3a. Get all booking IDs for this user
        $stmt = $db->prepare("SELECT booking_id FROM bookings WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $bookingIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (count($bookingIds) > 0) {
            $placeholders = implode(',', array_fill(0, count($bookingIds), '?'));
            
            // 3b. Delete tickets for these bookings
            $stmt = $db->prepare("DELETE FROM tickets WHERE booking_id IN ($placeholders)");
            $stmt->execute($bookingIds);
            $ticketsDeleted = $stmt->rowCount();
            error_log("Deleted $ticketsDeleted tickets for user_id: $user_id");
            
            // 3c. Delete payments for these bookings
            $stmt = $db->prepare("DELETE FROM payments WHERE booking_id IN ($placeholders)");
            $stmt->execute($bookingIds);
            $paymentsDeleted = $stmt->rowCount();
            error_log("Deleted $paymentsDeleted payments for user_id: $user_id");
            
            // 3d. Delete bookings
            $stmt = $db->prepare("DELETE FROM bookings WHERE user_id = ?");
            $stmt->execute([$user_id]);
            $bookingsDeleted = $stmt->rowCount();
            error_log("Deleted $bookingsDeleted bookings for user_id: $user_id");
        }
        
        // 4. Delete password resets (will cascade automatically, but we'll do it explicitly)
        $stmt = $db->prepare("DELETE FROM password_resets WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $resetsDeleted = $stmt->rowCount();
        error_log("Deleted $resetsDeleted password resets for user_id: $user_id");
        
        // 5. Delete user sessions (will cascade automatically, but we'll do it explicitly)
        $stmt = $db->prepare("DELETE FROM user_sessions WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $sessionsDeleted = $stmt->rowCount();
        error_log("Deleted $sessionsDeleted sessions for user_id: $user_id");
        
        // 6. Finally, delete the user
        $stmt = $db->prepare("DELETE FROM users WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $usersDeleted = $stmt->rowCount();
        
        if ($usersDeleted === 0) {
            throw new Exception("Failed to delete user");
        }
        
        // Commit transaction
        $db->commit();
        
        // Return success response
        echo json_encode([
            'success' => true,
            'message' => 'User and all related data deleted successfully',
            'deleted_records' => [
                'user' => $usersDeleted,
                'reviews' => $reviewsDeleted,
                'bookings' => $bookingsDeleted ?? 0,
                'tickets' => $ticketsDeleted ?? 0,
                'payments' => $paymentsDeleted ?? 0,
                'password_resets' => $resetsDeleted,
                'sessions' => $sessionsDeleted,
                'buses' => $busesDeleted ?? 0
            ]
        ]);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $db->rollBack();
        throw $e;
    }
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}