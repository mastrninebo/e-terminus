<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getInstance();
    
    // Get query parameters
    $origin = $_GET['origin'] ?? '';
    $destination = $_GET['destination'] ?? '';
    $date = $_GET['date'] ?? '';
    
    if (empty($origin) || empty($destination)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required parameters']);
        exit;
    }
    
    // Format date for comparison
    $formattedDate = '';
    if (!empty($date)) {
        $dateObj = new DateTime($date);
        $formattedDate = $dateObj->format('Y-m-d');
    }
    
    // Build the query
    $sql = "
        SELECT s.schedule_id, s.departure_time, s.arrival_time, s.price, s.available_seats,
               r.origin, r.destination, r.estimated_duration_min,
               b.bus_id, b.capacity, b.plate_number,
               o.operator_id, o.company_name,
               TIMESTAMPDIFF(MINUTE, s.departure_time, s.arrival_time) as duration_minutes
        FROM schedules s
        JOIN routes r ON s.route_id = r.route_id
        JOIN buses b ON s.bus_id = b.bus_id
        JOIN operators o ON b.operator_id = o.operator_id
        WHERE r.origin = ? AND r.destination = ?
        AND s.status = 'scheduled'
        AND s.available_seats > 0
    ";
    
    $params = [$origin, $destination];
    
    // Add date filter if provided
    if (!empty($formattedDate)) {
        $sql .= " AND DATE(s.departure_time) = ?";
        $params[] = $formattedDate;
    }
    
    $sql .= " ORDER BY s.departure_time";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format results for frontend
    $formattedResults = [];
    foreach ($results as $result) {
        // Calculate duration in hours and minutes
        $hours = floor($result['duration_minutes'] / 60);
        $minutes = $result['duration_minutes'] % 60;
        $duration = $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m";
        
        $formattedResults[] = [
            'schedule_id' => $result['schedule_id'],
            'company_name' => $result['company_name'],
            'operator_id' => $result['operator_id'],
            'bus_type' => 'Standard Bus',
            'plate_number' => $result['plate_number'],
            'origin' => $result['origin'],
            'destination' => $result['destination'],
            'departure_time' => $result['departure_time'],
            'arrival_time' => $result['arrival_time'],
            'price' => $result['price'],
            'available_seats' => $result['available_seats'],
            'duration_minutes' => $result['duration_minutes'],
            'rating' => 4,
            'origin_terminal' => 'Main Terminal',
            'capacity' => $result['capacity']
        ];
    }
    
    echo json_encode($formattedResults);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
