<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getInstance();
    
    // Get popular routes with schedule count and min price
    $stmt = $db->prepare("
        SELECT r.route_id, r.origin, r.destination, r.distance_km, r.estimated_duration_min,
               COUNT(s.schedule_id) as schedule_count,
               MIN(s.price) as min_price
        FROM routes r
        LEFT JOIN schedules s ON r.route_id = s.route_id AND s.status = 'scheduled'
        GROUP BY r.route_id
        ORDER BY schedule_count DESC, r.origin, r.destination
        LIMIT 4
    ");
    $stmt->execute();
    $routes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($routes);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}