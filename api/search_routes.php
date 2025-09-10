<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';

// Get search parameters
$origin = isset($_GET['origin']) ? $_GET['origin'] : '';
$destination = isset($_GET['destination']) ? $_GET['destination'] : '';
$date = isset($_GET['date']) ? $_GET['date'] : '';

if (empty($origin) || empty($destination)) {
    http_response_code(400);
    echo json_encode(['error' => 'Origin and destination are required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Build the query
    $query = "
        SELECT s.schedule_id, s.departure_time, s.arrival_time, s.price, s.available_seats,
               r.origin, r.destination, b.plate_number, b.capacity,
               o.company_name
        FROM schedules s
        JOIN routes r ON s.route_id = r.route_id
        JOIN buses b ON s.bus_id = b.bus_id
        JOIN operators o ON b.operator_id = o.operator_id
        WHERE r.origin = ? AND r.destination = ? AND s.status = 'scheduled'
    ";
    
    $params = [$origin, $destination];
    
    // Add date filter if provided
    if (!empty($date)) {
        $query .= " AND DATE(s.departure_time) = ?";
        $params[] = $date;
    }
    
    // Only show future schedules
    $query .= " AND s.departure_time > NOW() ORDER BY s.departure_time";
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($schedules);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}