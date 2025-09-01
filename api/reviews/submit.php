<?php
// Handle review submission
header('Content-Type: application/json');

// Dynamic CORS handling (consistent with other files)
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

// Use existing database connection
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/jwt-helper.php'; // Add JWT helper

// Start session and check authentication
session_start();

// Get token from Authorization header, cookie, or session (same as check_session.php)
$token = null;

// Check Authorization header first
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
}

// If no header, check cookie
if (!$token && isset($_COOKIE['auth_token'])) {
    $token = $_COOKIE['auth_token'];
}

// If no cookie, check session
if (!$token && isset($_SESSION['auth_token'])) {
    $token = $_SESSION['auth_token'];
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit();
}

// Verify JWT token and get user
try {
    $payload = JWTHelper::validateToken($token);
    
    // Verify token exists in database and is not expired
    $db = Database::getInstance();
    $stmt = $db->prepare("
        SELECT us.*, u.username, u.email, u.user_type 
        FROM user_sessions us
        JOIN users u ON us.user_id = u.user_id
        WHERE us.jwt_token = ? AND us.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if (!$session) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        exit();
    }
    
    // Set user_id from the session
    $user_id = $session['user_id'];
    
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication failed']);
    exit();
}

// Get POST data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Validate input
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit();
}

// Required fields
$requiredFields = ['review_type', 'rating', 'comment'];
foreach ($requiredFields as $field) {
    if (empty($data[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit();
    }
}

// Validate rating
if ($data['rating'] < 1 || $data['rating'] > 5) {
    http_response_code(400);
    echo json_encode(['error' => 'Rating must be between 1 and 5']);
    exit();
}

// Validate review type
if (!in_array($data['review_type'], ['platform', 'operator'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid review type']);
    exit();
}

// If operator review, validate operator_id
if ($data['review_type'] === 'operator' && empty($data['operator_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Operator ID is required for operator reviews']);
    exit();
}

try {
    $bus_id = null;
    $operator_id = null;
    
    if ($data['review_type'] === 'operator') {
        $operator_id = $data['operator_id'];
        
        // Verify operator exists
        $stmt = $db->prepare("SELECT operator_id FROM operators WHERE operator_id = :operator_id AND status = 'active'");
        $stmt->bindParam(':operator_id', $operator_id);
        $stmt->execute();
        
        if (!$stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid operator']);
            exit();
        }
    }
    
    // Insert review - adjusted for your actual database structure
    $sql = "INSERT INTO reviews 
            (user_id, operator_id, bus_id, rating, comment, title, review_date, review_type) 
            VALUES 
            (:user_id, :operator_id, :bus_id, :rating, :comment, :title, NOW(), :review_type)";
    
    $stmt = $db->prepare($sql);
    
    // Bind parameters
    $stmt->bindParam(':user_id', $user_id);
    $stmt->bindParam(':operator_id', $operator_id);
    $stmt->bindParam(':bus_id', $bus_id);
    $stmt->bindParam(':rating', $data['rating']);
    $stmt->bindParam(':comment', $data['comment']);
    $stmt->bindParam(':review_type', $data['review_type']);
    
    // Handle optional title
    $title = !empty($data['title']) ? $data['title'] : null;
    $stmt->bindParam(':title', $title);
    
    // Execute query
    if ($stmt->execute()) {
        $review_id = $db->lastInsertId();
        
        $response = [
            'success' => true,
            'message' => 'Review submitted successfully',
            'review_id' => $review_id
        ];
        
        echo json_encode($response);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to submit review']);
    }
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}