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

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate input
if (empty($input['routeId']) || empty($input['busId']) || 
    empty($input['departureTime']) || empty($input['arrivalTime']) || 
    empty($input['price']) || empty($input['availableSeats'])) {
    http_response_code(400);
    echo json_encode(['error' => 'All fields are required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Get operator ID from token
    $operatorId = $payload['operator_id'];
    
    // Verify bus belongs to operator
    $stmt = $db->prepare("SELECT bus_id FROM buses WHERE bus_id = ? AND operator_id = ?");
    $stmt->execute([$input['busId'], $operatorId]);
    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['error' => 'Bus does not belong to this operator']);
        exit();
    }
    
    // Create new schedule
    $stmt = $db->prepare("
        INSERT INTO schedules (bus_id, route_id, departure_time, arrival_time, price, available_seats)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $input['busId'],
        $input['routeId'],
        $input['departureTime'],
        $input['arrivalTime'],
        $input['price'],
        $input['availableSeats']
    ]);
    
    $scheduleId = $db->lastInsertId();
    
    echo json_encode([
        'success' => true,
        'message' => 'Schedule created successfully',
        'schedule_id' => $scheduleId
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}