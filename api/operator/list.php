<?php
// Return list of bus operators
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Use existing database connection
require_once __DIR__ . '/../../config/database.php';

try {
    // Query to get operators - using your existing operators table
    $stmt = $pdo->prepare("SELECT operator_id, company_name FROM operators WHERE status = 'active' ORDER BY company_name");
    $stmt->execute();
    
    $operators = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($operators);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>