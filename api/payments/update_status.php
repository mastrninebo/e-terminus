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

// Debug logging
error_log("=== UPDATE PAYMENT STATUS DEBUG ===");
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("Content type: " . ($_SERVER['CONTENT_TYPE'] ?? 'Not set'));

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// Check if JSON is valid
if ($data === null) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
    exit();
}

error_log("Decoded data: " . print_r($data, true));

// Validate required fields
if (!isset($data['transaction_id']) || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

$transactionId = $data['transaction_id'];
$status = $data['status'];

// Validate status
if (!in_array($status, ['success', 'failed'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid status']);
    exit;
}

try {
    $db = Database::getInstance();
    
    // Begin transaction
    $db->beginTransaction();
    
    // Get payment details along with booking and schedule information
    $stmt = $db->prepare("
        SELECT p.*, b.user_id, b.schedule_id, b.booking_status, s.available_seats
        FROM payments p
        JOIN bookings b ON p.booking_id = b.booking_id
        JOIN schedules s ON b.schedule_id = s.schedule_id
        WHERE p.transaction_id LIKE ? AND p.status = 'pending'
    ");
    $stmt->execute(["%|" . $transactionId . "%"]);
    $payment = $stmt->fetch();
    
    if (!$payment) {
        error_log("Payment not found or already processed for transaction ID: " . $transactionId);
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Payment not found or already processed']);
        exit;
    }
    
    // Parse the transaction_id to get number of seats and reference number
    $transactionParts = explode('|', $payment['transaction_id']);
    $numberOfSeats = intval($transactionParts[0]);
    $actualTransactionId = $transactionParts[1] ?? null;
    $referenceNo = $transactionParts[2] ?? null;
    
    $bookingId = $payment['booking_id'];
    $scheduleId = $payment['schedule_id'];
    $availableSeats = $payment['available_seats'];
    
    error_log("Found payment for booking ID: " . $bookingId);
    error_log("Number of seats: " . $numberOfSeats);
    
    // Update payment status and transaction_id (store only the actual transaction ID)
    $stmt = $db->prepare("
        UPDATE payments 
        SET status = ?, transaction_id = ? 
        WHERE payment_id = ?
    ");
    $stmt->execute([$status, $actualTransactionId, $payment['payment_id']]);
    
    if ($status === 'success') {
        error_log("Processing successful payment for booking ID: " . $bookingId);
        
        // Generate QR code for ticket
        $qrCode = 'ET-' . $bookingId . '-' . bin2hex(random_bytes(4));
        
        // Create ticket (only after successful payment)
        $stmt = $db->prepare("
            INSERT INTO tickets (booking_id, qr_code) 
            VALUES (?, ?)
        ");
        $stmt->execute([$bookingId, $qrCode]);
        error_log("Ticket created with QR code: " . $qrCode);
        
        // Update available seats
        $stmt = $db->prepare("
            UPDATE schedules 
            SET available_seats = available_seats - ? 
            WHERE schedule_id = ?
        ");
        $stmt->execute([$numberOfSeats, $scheduleId]);
        error_log("Updated available seats for schedule " . $scheduleId);
        
        $response = [
            'success' => true,
            'message' => 'Payment processed successfully',
            'booking_id' => $bookingId,
            'qr_code' => $qrCode
        ];
        
    } else { // Payment failed
        error_log("Processing failed payment for booking ID: " . $bookingId);
        
        // Update booking status to cancelled
        $stmt = $db->prepare("
            UPDATE bookings 
            SET booking_status = 'cancelled' 
            WHERE booking_id = ?
        ");
        $stmt->execute([$bookingId]);
        
        $response = [
            'success' => true,
            'message' => 'Payment failed',
            'booking_id' => $bookingId
        ];
    }
    
    // Commit transaction
    $db->commit();
    error_log("Transaction committed successfully");
    
    // Return the response
    echo json_encode($response);
    
} catch (PDOException $e) {
    // Rollback transaction on error
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log("PDO error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error']);
} catch (Exception $e) {
    // Rollback transaction on error
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}