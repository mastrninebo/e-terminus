<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Include necessary files
require_once '../../config/database.php';
require_once '../../includes/jwt-helper.php';

// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: DELETE');
header('Access-Control-Allow-Headers: Access-Control-Allow-Headers, Content-Type, Access-Control-Allow-Methods, Authorization, X-Requested-With');

// Check request method
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get JWT token from headers
$jwt = null;
$headers = apache_request_headers();

if (isset($headers['Authorization'])) {
    $authHeader = $headers['Authorization'];
    $arr = explode(" ", $authHeader);
    $jwt = $arr[1];
}

// Validate JWT
if (!$jwt || !JWTHelper::validateToken($jwt)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Get operator ID from query parameters
$operatorId = isset($_GET['operator_id']) ? (int)$_GET['operator_id'] : 0;

if ($operatorId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid operator ID']);
    exit;
}

// Connect to database
try {
    $db = Database::getInstance();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection error: ' . $e->getMessage()]);
    exit;
}

// Check if operator exists
$query = "SELECT o.operator_id, o.user_id, u.username 
          FROM operators o 
          JOIN users u ON o.user_id = u.user_id 
          WHERE o.operator_id = :operator_id";
$stmt = $db->prepare($query);
$stmt->bindParam(':operator_id', $operatorId);
$stmt->execute();

$operator = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$operator) {
    http_response_code(404);
    echo json_encode(['error' => 'Operator not found']);
    exit;
}

// Begin transaction for cascading delete
try {
    $db->beginTransaction();
    
    // Get all buses associated with this operator
    $query = "SELECT bus_id FROM buses WHERE operator_id = :operator_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':operator_id', $operatorId);
    $stmt->execute();
    $buses = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Get all schedules associated with these buses
    $busIds = implode(',', array_fill(0, count($buses), '?'));
    $query = "SELECT schedule_id FROM schedules WHERE bus_id IN ($busIds)";
    $stmt = $db->prepare($query);
    foreach ($buses as $i => $busId) {
        $stmt->bindValue(($i + 1), $busId);
    }
    $stmt->execute();
    $schedules = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Get all bookings associated with these schedules
    if (!empty($schedules)) {
        $scheduleIds = implode(',', array_fill(0, count($schedules), '?'));
        $query = "SELECT booking_id FROM bookings WHERE schedule_id IN ($scheduleIds)";
        $stmt = $db->prepare($query);
        foreach ($schedules as $i => $scheduleId) {
            $stmt->bindValue(($i + 1), $scheduleId);
        }
        $stmt->execute();
        $bookings = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Delete all tickets associated with these bookings
        if (!empty($bookings)) {
            $bookingIds = implode(',', array_fill(0, count($bookings), '?'));
            $query = "DELETE FROM tickets WHERE booking_id IN ($bookingIds)";
            $stmt = $db->prepare($query);
            foreach ($bookings as $i => $bookingId) {
                $stmt->bindValue(($i + 1), $bookingId);
            }
            $stmt->execute();
            
            // Delete all payments associated with these bookings
            $query = "DELETE FROM payments WHERE booking_id IN ($bookingIds)";
            $stmt = $db->prepare($query);
            foreach ($bookings as $i => $bookingId) {
                $stmt->bindValue(($i + 1), $bookingId);
            }
            $stmt->execute();
            
            // Delete all bookings
            $query = "DELETE FROM bookings WHERE schedule_id IN ($scheduleIds)";
            $stmt = $db->prepare($query);
            foreach ($schedules as $i => $scheduleId) {
                $stmt->bindValue(($i + 1), $scheduleId);
            }
            $stmt->execute();
        }
    }
    
    // Delete all reviews associated with these buses
    if (!empty($buses)) {
        $busIds = implode(',', array_fill(0, count($buses), '?'));
        $query = "DELETE FROM reviews WHERE bus_id IN ($busIds)";
        $stmt = $db->prepare($query);
        foreach ($buses as $i => $busId) {
            $stmt->bindValue(($i + 1), $busId);
        }
        $stmt->execute();
    }
    
    // Delete all schedules
    if (!empty($schedules)) {
        $scheduleIds = implode(',', array_fill(0, count($schedules), '?'));
        $query = "DELETE FROM schedules WHERE schedule_id IN ($scheduleIds)";
        $stmt = $db->prepare($query);
        foreach ($schedules as $i => $scheduleId) {
            $stmt->bindValue(($i + 1), $scheduleId);
        }
        $stmt->execute();
    }
    
    // Delete all buses
    if (!empty($buses)) {
        $busIds = implode(',', array_fill(0, count($buses), '?'));
        $query = "DELETE FROM buses WHERE bus_id IN ($busIds)";
        $stmt = $db->prepare($query);
        foreach ($buses as $i => $busId) {
            $stmt->bindValue(($i + 1), $busId);
        }
        $stmt->execute();
    }
    
    // Delete the operator
    $query = "DELETE FROM operators WHERE operator_id = :operator_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':operator_id', $operatorId);
    $stmt->execute();
    
    // Delete the associated user
    $query = "DELETE FROM users WHERE user_id = :user_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $operator['user_id']);
    $stmt->execute();
    
    // Commit transaction
    $db->commit();
    
    // Return success response with details of what was deleted
    echo json_encode([
        'success' => true,
        'message' => 'Operator and all associated data deleted successfully',
        'operator_id' => $operatorId,
        'operator_name' => $operator['username'],
        'deleted_data' => [
            'buses' => count($buses),
            'schedules' => count($schedules),
            'bookings' => !empty($schedules) ? count($bookings) : 0
        ]
    ]);
    
} catch (Exception $e) {
    // Rollback transaction on error
    $db->rollBack();
    
    http_response_code(500);
    echo json_encode(['error' => 'Failed to delete operator: ' . $e->getMessage()]);
}