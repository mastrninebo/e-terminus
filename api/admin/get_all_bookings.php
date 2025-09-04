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

// Debug logging
error_log("=== GET ALL BOOKINGS DEBUG ===");
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("Origin: " . ($origin ?? 'None'));

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

// Method 6: Check if token is in GET parameter
if (!$token && isset($_GET['token'])) {
    $token = $_GET['token'];
    error_log("Found token in GET parameter");
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
        SELECT us.*, u.user_type 
        FROM user_sessions us
        JOIN users u ON us.user_id = u.user_id
        WHERE us.jwt_token = ? AND us.expires_at > NOW() AND u.user_type = 'admin'
    ");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if (!$session) {
        error_log("Session not found in database");
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        exit();
    }
    
    error_log("Session found in database for user: " . $session['user_type']);
    
    // Get all bookings
    $bookings = $db->query("
        SELECT b.booking_id, u.username, CONCAT(r.origin, ' to ', r.destination) as route, 
               b.booking_date, b.booking_status, p.amount, p.payment_method, p.status as payment_status
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        JOIN schedules s ON b.schedule_id = s.schedule_id
        JOIN routes r ON s.route_id = r.route_id
        LEFT JOIN payments p ON b.booking_id = p.booking_id
        ORDER BY b.booking_date DESC
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    error_log("Found " . count($bookings) . " bookings");
    echo json_encode($bookings);
    
} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}