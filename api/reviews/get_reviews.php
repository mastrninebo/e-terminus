<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: http://localhost");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';

try {
    $db = Database::getInstance();
    
    // Get approved reviews with user information
    $stmt = $db->prepare("
        SELECT r.review_id, r.comment, r.rating, r.review_date,
               u.username, u.email
        FROM reviews r
        JOIN users u ON r.user_id = u.user_id
        WHERE r.is_approved = 1
        ORDER BY r.review_date DESC
        LIMIT 10
    ");
    $stmt->execute();
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format reviews for frontend
    $formattedReviews = [];
    foreach ($reviews as $review) {
        $formattedReviews[] = [
            'id' => $review['review_id'],
            'content' => $review['comment'],
            'author' => $review['username'],
            'rating' => (int)$review['rating'],
            'avatar' => strtoupper(substr($review['username'], 0, 2))
        ];
    }
    
    echo json_encode($formattedReviews);
    
} catch (PDOException $e) {
    error_log("Error fetching reviews: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch reviews']);
}