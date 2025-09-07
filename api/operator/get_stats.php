<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/jwt-helper.php';

// Get Authorization header
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || strpos($authHeader, 'Bearer ') !== 0) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit();
}

// Extract token
$token = substr($authHeader, 7);

// Validate token
$payload = JWTHelper::validateToken($token);
if (!$payload) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid or expired token']);
    exit();
}

// Verify user is operator
if ($payload['user_type'] !== 'operator') {
    http_response_code(403);
    echo json_encode(['error' => 'Operator access required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Get operator ID from token
    $operatorId = $payload['operator_id'];
    
    // Get operator statistics
    $stmt = $db->prepare("
        SELECT 
            (SELECT COUNT(*) FROM buses WHERE operator_id = ? AND status = 'active') AS total_buses,
            (SELECT COUNT(*) FROM schedules s 
             JOIN buses b ON s.bus_id = b.bus_id 
             WHERE b.operator_id = ? AND DATE(s.departure_time) = CURDATE() AND s.status = 'scheduled') AS today_trips,
            (SELECT AVG(rating) FROM reviews WHERE operator_id = ? AND is_approved = 1) AS average_rating
    ");
    $stmt->execute([$operatorId, $operatorId, $operatorId]);
    $stats = $stmt->fetch();
    
    // Format average rating
    if ($stats['average_rating']) {
        $stats['average_rating'] = round($stats['average_rating'], 1);
    } else {
        $stats['average_rating'] = 0;
    }
    
    echo json_encode($stats);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}