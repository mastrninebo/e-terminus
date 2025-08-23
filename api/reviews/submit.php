<?php
// Handle review submission
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost'); // More restrictive
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Use existing database connection
require_once __DIR__ . '/../../config/database.php';

// Start session and check authentication
session_start();

// Check if user is authenticated
if (!isset($_SESSION['user_id'])) {
    // Alternatively, check for token in header for API authentication
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit();
    }
    
    $token = $matches[1];
    // Here you would validate the JWT token if using token-based auth
    // For now, we'll rely on session-based auth
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
    // Get user_id from session (more secure than trusting client input)
    $user_id = $_SESSION['user_id'] ?? null;
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'User not authenticated']);
        exit();
    }
    
    $bus_id = null;
    $operator_id = null;
    
    if ($data['review_type'] === 'operator') {
        $operator_id = $data['operator_id'];
        
        // Verify operator exists
        $stmt = $pdo->prepare("SELECT operator_id FROM operators WHERE operator_id = :operator_id AND status = 'active'");
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
    
    $stmt = $pdo->prepare($sql);
    
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
        $review_id = $pdo->lastInsertId();
        
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
?>