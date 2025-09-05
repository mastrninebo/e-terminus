<?php
// Include necessary files
require_once '../../config/database.php';
require_once '../../includes/jwt-helper.php';

// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT');
header('Access-Control-Allow-Headers: Access-Control-Allow-Headers, Content-Type, Access-Control-Allow-Methods, Authorization, X-Requested-With');

// Check request method
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

// Get booking ID from query parameters
$bookingId = isset($_GET['booking_id']) ? (int)$_GET['booking_id'] : 0;

if ($bookingId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid booking ID']);
    exit;
}

// Get JSON data from request body
$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request data']);
    exit;
}

// Validate status
$allowedStatuses = ['confirmed', 'cancelled', 'completed'];
if (!in_array($data['status'], $allowedStatuses)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid status']);
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

// Check if booking exists
$query = "SELECT booking_id, booking_status FROM bookings WHERE booking_id = :booking_id";
$stmt = $db->prepare($query);
$stmt->bindParam(':booking_id', $bookingId);
$stmt->execute();

$booking = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$booking) {
    http_response_code(404);
    echo json_encode(['error' => 'Booking not found']);
    exit;
}

// Don't update if status is already the same
if ($booking['booking_status'] === $data['status']) {
    http_response_code(200);
    echo json_encode(['message' => 'Booking status already set to ' . $data['status']]);
    exit;
}

// Update booking status
$query = "UPDATE bookings SET booking_status = :status WHERE booking_id = :booking_id";
$stmt = $db->prepare($query);
$stmt->bindParam(':status', $data['status']);
$stmt->bindParam(':booking_id', $bookingId);

if ($stmt->execute()) {
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Booking status updated successfully',
        'booking_id' => $bookingId,
        'new_status' => $data['status']
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update booking status']);
}
