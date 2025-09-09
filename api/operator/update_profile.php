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
if (empty($input['companyName'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Company name is required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Get operator ID from token
    $operatorId = $payload['operator_id'];
    
    // Get user_id for this operator
    $stmt = $db->prepare("SELECT user_id FROM operators WHERE operator_id = ?");
    $stmt->execute([$operatorId]);
    $operatorData = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$operatorData) {
        http_response_code(404);
        echo json_encode(['error' => 'Operator not found']);
        exit();
    }
    
    $userId = $operatorData['user_id'];
    
    // Begin transaction
    $db->beginTransaction();
    
    // Update operators table
    $stmt = $db->prepare("
        UPDATE operators 
        SET company_name = ?, contact_person = ?
        WHERE operator_id = ?
    ");
    
    $result1 = $stmt->execute([
        $input['companyName'],
        $input['contactPerson'] ?? null,
        $operatorId
    ]);
    
    // Update users table for phone number
    $result2 = true;
    if (isset($input['phone'])) {
        $stmt = $db->prepare("
            UPDATE users 
            SET phone = ?
            WHERE user_id = ?
        ");
        $result2 = $stmt->execute([
            $input['phone'],
            $userId
        ]);
    }
    
    if ($result1 && $result2) {
        $db->commit();
        echo json_encode([
            'success' => true, 
            'message' => 'Profile updated successfully'
        ]);
    } else {
        $db->rollBack();
        echo json_encode([
            'success' => false, 
            'error' => 'Failed to update profile'
        ]);
    }
    
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log("Update profile error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log("Update profile general error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'An error occurred: ' . $e->getMessage()]);
}