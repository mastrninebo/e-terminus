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
    error_log("[GET_REVIEWS_DEBUG] " . $message);
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
    
    // Get user reviews
    debug_log("Getting user reviews");
    try {
        $stmt = $db->prepare("
            SELECT 
                r.review_id,
                r.rating,
                r.comment,
                r.title,
                r.review_date,
                r.review_type,
                r.is_approved,
                b.plate_number,
                op.company_name as operator_name,
                CASE 
                    WHEN r.bus_id IS NOT NULL THEN CONCAT('Bus: ', b.plate_number)
                    WHEN r.operator_id IS NOT NULL THEN CONCAT('Operator: ', op.company_name)
                    ELSE 'Platform Review'
                END as review_target
            FROM reviews r
            LEFT JOIN buses b ON r.bus_id = b.bus_id
            LEFT JOIN operators op ON r.operator_id = op.operator_id
            WHERE r.user_id = ?
            ORDER BY r.review_date DESC
        ");
        $stmt->execute([$userId]);
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        debug_log("Found " . count($reviews) . " reviews");
        
        // Format reviews for frontend
        $formattedReviews = [];
        foreach ($reviews as $review) {
            $formattedReviews[] = [
                'review_id' => $review['review_id'],
                'rating' => $review['rating'],
                'comment' => $review['comment'],
                'title' => $review['title'] ?: $review['review_target'],
                'review_date' => $review['review_date'],
                'operator_name' => $review['operator_name'] ?: 'E-Terminus',
                'from_location' => $review['review_target'],
                'to_location' => ''  // Empty since we don't have route info
            ];
        }
        
        echo json_encode($formattedReviews);
        
    } catch (PDOException $e) {
        debug_log("Database error getting reviews: " . $e->getMessage());
        throw $e;
    }
    
} catch (PDOException $e) {
    debug_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'details' => $e->getMessage()]);
} catch (Exception $e) {
    debug_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'details' => $e->getMessage()]);
}