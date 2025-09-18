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

// Get bus ID from query parameters
$busId = isset($_GET['bus_id']) ? $_GET['bus_id'] : '';

if (empty($busId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Bus ID is required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Get operator ID from token
    $operatorId = $payload['operator_id'];
    
    // Check if bus exists and belongs to this operator
    $stmt = $db->prepare("SELECT * FROM buses WHERE bus_id = ? AND operator_id = ?");
    $stmt->execute([$busId, $operatorId]);
    $bus = $stmt->fetch();
    
    if (!$bus) {
        http_response_code(404);
        echo json_encode(['error' => 'Bus not found']);
        exit();
    }
    
    // Delete bus
    $stmt = $db->prepare("DELETE FROM buses WHERE bus_id = ? AND operator_id = ?");
    $stmt->execute([$busId, $operatorId]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Bus deleted successfully'
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}