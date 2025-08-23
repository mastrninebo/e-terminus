<?php
// Return list of bus operators
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Use existing database connection
require_once __DIR__ . '/../../config/database.php';

try {
    // Get database connection - FIXED: Use getInstance() which returns the PDO connection
    $pdo = Database::getInstance();
    
    // Check if connection is valid
    if ($pdo === null) {
        throw new Exception("Database connection is null");
    }
    
    // Query to get operators - using your existing operators table
    $stmt = $pdo->prepare("SELECT operator_id, company_name FROM operators WHERE status = 'active' ORDER BY company_name");
    
    if ($stmt === false) {
        throw new Exception("Failed to prepare SQL statement");
    }
    
    $stmt->execute();
    
    $operators = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Add debug logging
    error_log("Operators list fetched: " . count($operators) . " operators found");
    
    if (empty($operators)) {
        error_log("No active operators found in database");
        // Return empty array instead of error
        echo json_encode([]);
        exit();
    }
    
    // Validate each operator has required fields
    $validOperators = [];
    foreach ($operators as $operator) {
        if (isset($operator['operator_id']) && isset($operator['company_name'])) {
            $validOperators[] = [
                'operator_id' => (int)$operator['operator_id'],
                'company_name' => htmlspecialchars($operator['company_name'])
            ];
        } else {
            error_log("Invalid operator data: " . print_r($operator, true));
        }
    }
    
    if (empty($validOperators)) {
        error_log("No valid operators found after validation");
        echo json_encode([]);
        exit();
    }
    
    echo json_encode($validOperators);
    
} catch (PDOException $e) {
    error_log("Database error in list.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Database error', 
        'message' => $e->getMessage(),
        'operators' => [] // Ensure always returns an array
    ]);
} catch (Exception $e) {
    error_log("General error in list.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage(),
        'operators' => [] // Ensure always returns an array
    ]);
}