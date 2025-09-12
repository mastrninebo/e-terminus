<?php
header('Content-Type: application/json');
// Dynamic CORS handling
$allowed_origins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Allow-Credentials: true");
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__.'/../../config/database.php';

// Check if schedule_id is provided
if (!isset($_GET['schedule_id']) || empty($_GET['schedule_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Schedule ID is required']);
    exit;
}

$scheduleId = intval($_GET['schedule_id']);

try {
    $db = Database::getInstance();
    
    // Get schedule details with joins to get operator and route information
    $stmt = $db->prepare("
        SELECT s.*, b.capacity, b.plate_number, o.company_name, r.origin, r.destination, 
               r.distance_km, r.estimated_duration_min
        FROM schedules s
        JOIN buses b ON s.bus_id = b.bus_id
        JOIN operators o ON b.operator_id = o.operator_id
        JOIN routes r ON s.route_id = r.route_id
        WHERE s.schedule_id = ? AND s.status = 'scheduled'
    ");
    $stmt->execute([$scheduleId]);
    $schedule = $stmt->fetch();
    
    if ($schedule) {
        // Calculate duration in minutes if not directly available
        if (!isset($schedule['duration_minutes']) && isset($schedule['estimated_duration_min'])) {
            $schedule['duration_minutes'] = $schedule['estimated_duration_min'];
        }
        
        echo json_encode(['success' => true, 'schedule' => $schedule]);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Schedule not found']);
    }
    
} catch (PDOException $e) {
    error_log("Get schedule error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error']);
}