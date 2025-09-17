<?php
// api/payments/zynle_callback.php

header('Content-Type: application/json');
// Fix the paths - we're in api/payments/ so we need to go up two levels to get to the root
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../config/zynlepay.php';

// Get the callback data
$callbackData = json_decode(file_get_contents('php://input'), true);

// Log the callback for debugging
file_put_contents('zynle_callback_log.txt', date('Y-m-d H:i:s') . ' - ' . json_encode($callbackData) . "\n", FILE_APPEND);

// Validate required fields
if (!isset($callbackData['data']) || !isset($callbackData['data']['reference_no'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid callback data']);
    exit;
}

$referenceNo = $callbackData['data']['reference_no']; // This is our order_id: BOOK-{booking_id}-{payment_id}

// Extract booking_id and payment_id from reference_no
if (preg_match('/BOOK-(\d+)-(\d+)/', $referenceNo, $matches)) {
    $bookingId = $matches[1];
    $paymentId = $matches[2];
} else {
    // If it's not in the expected format, try to find by reference_no in the database
    $stmt = $conn->prepare("SELECT payment_id, booking_id FROM payments WHERE transaction_id = ?");
    $stmt->execute([$referenceNo]);
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Payment not found']);
        exit;
    }
    
    $payment = $result->fetch_assoc();
    $paymentId = $payment['payment_id'];
    $bookingId = $payment['booking_id'];
}

// Find payment by payment_id
$paymentQuery = "SELECT p.*, b.user_id FROM payments p JOIN bookings b ON p.booking_id = b.booking_id WHERE p.payment_id = ?";
$stmt = $conn->prepare($paymentQuery);
$stmt->bind_param("i", $paymentId);
$stmt->execute();
$paymentResult = $stmt->get_result();

if ($paymentResult->num_rows === 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Payment not found']);
    exit;
}

$payment = $paymentResult->fetch_assoc();

// Update payment status based on callback
$newStatus = 'pending';
$bookingStatus = 'confirmed';

// Check the status from Zynle Pay
if (isset($callbackData['data']['status'])) {
    $zynleStatus = $callbackData['data']['status'];
    
    if ($zynleStatus === 'success') {
        $newStatus = 'success';
        $bookingStatus = 'confirmed';
    } elseif ($zynleStatus === 'failed') {
        $newStatus = 'failed';
        $bookingStatus = 'cancelled';
    }
}

// Update payment record
$updatePaymentQuery = "UPDATE payments SET status = ? WHERE payment_id = ?";
$stmt = $conn->prepare($updatePaymentQuery);
$stmt->bind_param("si", $newStatus, $paymentId);
$stmt->execute();

// Update booking status
$updateBookingQuery = "UPDATE bookings SET booking_status = ? WHERE booking_id = ?";
$stmt = $conn->prepare($updateBookingQuery);
$stmt->bind_param("si", $bookingStatus, $bookingId);
$stmt->execute();

// If payment is successful, ensure ticket is marked as valid
if ($newStatus === 'success') {
    // The ticket was already created when booking was made, so we just need to ensure it's valid
    $updateTicketQuery = "UPDATE tickets SET is_used = 0 WHERE booking_id = ?";
    $stmt = $conn->prepare($updateTicketQuery);
    $stmt->bind_param("i", $bookingId);
    $stmt->execute();
}

echo json_encode(['success' => true, 'message' => 'Callback processed successfully']);
$conn->close();