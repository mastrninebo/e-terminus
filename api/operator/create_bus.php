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
if (empty($input['plateNumber']) || empty($input['capacity']) || empty($input['status'])) {
    http_response_code(400);
    echo json_encode(['error' => 'All fields are required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Get operator ID from token
    $operatorId = $payload['operator_id'];
    
    // Check if plate number already exists
    $stmt = $db->prepare("SELECT bus_id FROM buses WHERE plate_number = ?");
    $stmt->execute([$input['plateNumber']]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => 'Bus with this plate number already exists']);
        exit();
    }
    
    // Create new bus
    $stmt = $db->prepare("
        INSERT INTO buses (operator_id, plate_number, capacity, status)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([
        $operatorId,
        $input['plateNumber'],
        $input['capacity'],
        $input['status']
    ]);
    
    $busId = $db->lastInsertId();
    
    echo json_encode([
        'success' => true,
        'message' => 'Bus created successfully',
        'bus_id' => $busId
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}