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

// Check if schedule_id is provided
if (!isset($_GET['schedule_id']) || empty($_GET['schedule_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Schedule ID is required']);
    exit();
}

$scheduleId = (int)$_GET['schedule_id'];

if ($scheduleId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid schedule ID']);
    exit();
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate input
if (empty($input['departureTime']) || empty($input['arrivalTime']) || 
    empty($input['price']) || empty($input['availableSeats'])) {
    http_response_code(400);
    echo json_encode(['error' => 'All fields are required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Get operator ID from token
    $operatorId = $payload['operator_id'];
    
    // Verify the schedule belongs to this operator
    $stmt = $db->prepare("
        SELECT s.schedule_id, s.available_seats as current_seats
        FROM schedules s
        JOIN buses b ON s.bus_id = b.bus_id
        WHERE s.schedule_id = ? AND b.operator_id = ?
    ");
    $stmt->execute([$scheduleId, $operatorId]);
    $schedule = $stmt->fetch();
    
    if (!$schedule) {
        http_response_code(403);
        echo json_encode(['error' => 'Schedule does not belong to this operator']);
        exit();
    }
    
    // Check if there are any active bookings for this schedule
    $stmt = $db->prepare("SELECT COUNT(*) FROM bookings WHERE schedule_id = ? AND booking_status != 'cancelled'");
    $stmt->execute([$scheduleId]);
    $bookingCount = $stmt->fetchColumn();
    
    // If there are bookings, don't allow reducing available seats below current bookings
    if ($bookingCount > 0 && $input['availableSeats'] < $schedule['current_seats']) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot reduce available seats when there are active bookings']);
        exit();
    }
    
    // Update the schedule
    $stmt = $db->prepare("
        UPDATE schedules 
        SET departure_time = ?, arrival_time = ?, price = ?, available_seats = ?
        WHERE schedule_id = ?
    ");
    $stmt->execute([
        $input['departureTime'],
        $input['arrivalTime'],
        $input['price'],
        $input['availableSeats'],
        $scheduleId
    ]);
    
    if ($stmt->rowCount() === 0) {
        http_response_code(400);
        echo json_encode(['error' => 'No changes made to schedule']);
        exit();
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Schedule updated successfully'
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}