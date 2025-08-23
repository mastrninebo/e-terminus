<?php
// Handle review submission
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Use existing database connection
require_once __DIR__ . '/../../config/database.php';

// Get POST data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Validate input
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// Required fields (title is now optional)
$requiredFields = ['user_id', 'review_type', 'rating', 'comment'];
foreach ($requiredFields as $field) {
    if (empty($data[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

// Validate rating
if ($data['rating'] < 1 || $data['rating'] > 5) {
    http_response_code(400);
    echo json_encode(['error' => 'Rating must be between 1 and 5']);
    exit;
}

// Validate review type
if (!in_array($data['review_type'], ['platform', 'operator'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid review type']);
    exit;
}

// If operator review, validate operator_id
if ($data['review_type'] === 'operator' && empty($data['operator_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Operator ID is required for operator reviews']);
    exit;
}

try {
    // For platform reviews, we'll use bus_id = NULL
    // For operator reviews, we need to find a bus_id for that operator
    $bus_id = null;
    
    if ($data['review_type'] === 'operator') {
        // Get a bus_id for this operator (we'll use the first active bus)
        $stmt = $pdo->prepare("SELECT bus_id FROM buses WHERE operator_id = :operator_id AND status = 'active' LIMIT 1");
        $stmt->bindParam(':operator_id', $data['operator_id']);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            http_response_code(400);
            echo json_encode(['error' => 'No active buses found for this operator']);
            exit;
        }
        
        $bus_id = $result['bus_id'];
    }
    
    // Insert into existing reviews table (now with optional title)
    $sql = "INSERT INTO reviews 
            (user_id, bus_id, rating, comment, title, review_date) 
            VALUES 
            (:user_id, :bus_id, :rating, :comment, :title, NOW())";
    
    $stmt = $pdo->prepare($sql);
    
    // Bind parameters
    $stmt->bindParam(':user_id', $data['user_id']);
    $stmt->bindParam(':bus_id', $bus_id);
    $stmt->bindParam(':rating', $data['rating']);
    $stmt->bindParam(':comment', $data['comment']);
    
    // Handle optional title
    $title = !empty($data['title']) ? $data['title'] : null;
    $stmt->bindParam(':title', $title);
    
    // Execute query
    $stmt->execute();
    
    // Get the review ID
    $review_id = $pdo->lastInsertId();
    
    $response = [
        'success' => true,
        'message' => 'Review submitted successfully',
        'review_id' => $review_id
    ];
    
    echo json_encode($response);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>