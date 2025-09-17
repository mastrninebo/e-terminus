<?php
// api/payments/update_status.php

header('Content-Type: application/json');
// Dynamic CORS handling
$allowed_origins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Allow-Credentials: true");
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__.'/../../config/database.php';

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($data['transaction_id']) || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

$transactionId = $data['transaction_id'];
$status = $data['status'];

try {
    $db = Database::getInstance();
    
    // Update payment status
    $stmt = $db->prepare("
        UPDATE payments 
        SET status = ? 
        WHERE transaction_id = ?
    ");
    $stmt->execute([$status, $transactionId]);
    
    // If payment is successful, update booking status and ticket
    if ($status === 'success') {
        // First, get booking_id from payment using a SELECT query
        $stmt = $db->prepare("
            SELECT booking_id 
            FROM payments 
            WHERE transaction_id = ?
        ");
        $stmt->execute([$transactionId]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);

        
        if ($payment) {
            $bookingId = $payment['booking_id'];
            
            // Update booking status
            $stmt = $db->prepare("
                UPDATE bookings 
                SET booking_status = 'confirmed' 
                WHERE booking_id = ?
            ");
            $stmt->execute([$bookingId]);
            
            // Update ticket status
            $stmt = $db->prepare("
                UPDATE tickets 
                SET is_used = 0 
                WHERE booking_id = ?
            ");
            $stmt->execute([$bookingId]);
        }
    }
    
    echo json_encode(['success' => true, 'message' => 'Payment status updated successfully']);
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error']);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}