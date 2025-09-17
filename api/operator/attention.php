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
    $operatorId = $payload['user_id'];
    
    // Get buses needing maintenance
    $stmt = $db->prepare("
        SELECT bus_id, plate_number 
        FROM buses 
        WHERE operator_id = ? AND status = 'maintenance'
    ");
    $stmt->execute([$operatorId]);
    $busesNeedingMaintenance = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get cancelled trips for today
    $stmt = $db->prepare("
        SELECT COUNT(*) as count 
        FROM schedules s
        JOIN buses b ON s.bus_id = b.bus_id
        WHERE b.operator_id = ? 
        AND s.status = 'cancelled' 
        AND DATE(s.departure_time) = CURDATE()
    ");
    $stmt->execute([$operatorId]);
    $cancelledResult = $stmt->fetch(PDO::FETCH_ASSOC);
    $cancelledTripsToday = $cancelledResult['count'];
    
    // Get new reviews to respond to (reviews without response and not approved)
    $stmt = $db->prepare("
        SELECT COUNT(*) as count 
        FROM reviews 
        WHERE operator_id = ? 
        AND is_approved = 0
    ");
    $stmt->execute([$operatorId]);
    $reviewsResult = $stmt->fetch(PDO::FETCH_ASSOC);
    $newReviewsToRespond = $reviewsResult['count'];
    
    // Return the attention data
    echo json_encode([
        'buses_needing_maintenance' => $busesNeedingMaintenance,
        'cancelled_trips_today' => (int)$cancelledTripsToday,
        'new_reviews_to_respond' => (int)$newReviewsToRespond
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}