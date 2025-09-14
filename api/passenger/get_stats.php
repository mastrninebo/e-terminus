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
    error_log("[GET_STATS_DEBUG] " . $message);
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
    echo json_encode(['error' => 'Unauthorized', 'reason' => 'No token provided']);
    exit();
}

debug_log("Token found: " . substr($token, 0, 20) . "...");

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
    
    // Get user statistics
    $stats = [
        'upcoming_trips' => 0,
        'completed_trips' => 0,
        'pending_reviews' => 0
    ];
    
    // Get upcoming trips count - confirmed bookings with future departure times
    debug_log("Getting upcoming trips count");
    try {
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM bookings b
            JOIN schedules s ON b.schedule_id = s.schedule_id
            WHERE b.user_id = ? AND b.booking_status = 'confirmed' AND s.departure_time > NOW()
        ");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        $stats['upcoming_trips'] = (int)$result['count'];
        debug_log("Upcoming trips: " . $stats['upcoming_trips']);
    } catch (PDOException $e) {
        debug_log("Error getting upcoming trips: " . $e->getMessage());
        throw $e;
    }
    
    // Get completed trips count - bookings marked as 'completed'
    debug_log("Getting completed trips count");
    try {
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM bookings b
            WHERE b.user_id = ? AND b.booking_status = 'completed'
        ");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        $stats['completed_trips'] = (int)$result['count'];
        debug_log("Completed trips: " . $stats['completed_trips']);
    } catch (PDOException $e) {
        debug_log("Error getting completed trips: " . $e->getMessage());
        throw $e;
    }
    
    // Get pending reviews count - completed bookings without reviews
    debug_log("Getting pending reviews count");
    try {
        $stmt = $db->prepare("
            SELECT COUNT(*) as count
            FROM bookings b
            LEFT JOIN reviews r ON (b.user_id = r.user_id AND b.booking_id IS NULL)
            WHERE b.user_id = ? AND b.booking_status = 'completed' AND r.review_id IS NULL
        ");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        $stats['pending_reviews'] = (int)$result['count'];
        debug_log("Pending reviews: " . $stats['pending_reviews']);
    } catch (PDOException $e) {
        debug_log("Error getting pending reviews: " . $e->getMessage());
        throw $e;
    }
    
    debug_log("Final stats: " . json_encode($stats));
    echo json_encode($stats);
    
} catch (PDOException $e) {
    debug_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'details' => $e->getMessage()]);
} catch (Exception $e) {
    debug_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'details' => $e->getMessage()]);
}