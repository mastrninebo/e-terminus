<?php
header('Content-Type: application/json');
// Dynamic CORS handling
$allowed_origins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Allow-Credentials: true");
}
// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../includes/jwt-helper.php';

// Debug logging
error_log("=== GET BOOKING DEBUG ===");
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("Origin: " . ($origin ?? 'None'));

// Check if booking_id is provided
if (!isset($_GET['booking_id'])) {
    error_log("No booking_id provided");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Booking ID is required']);
    exit();
}

$bookingId = $_GET['booking_id'];
error_log("Booking ID: " . $bookingId);

// Try multiple ways to get the Authorization header
$token = null;
// Method 1: Direct from $_SERVER
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    error_log("Found token in HTTP_AUTHORIZATION: " . substr($authHeader, 0, 20) . "...");
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
}
// Method 2: Using getallheaders() if available
if (!$token && function_exists('getallheaders')) {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        error_log("Found token in getallheaders Authorization: " . substr($authHeader, 0, 20) . "...");
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
}
// Method 3: From REDIRECT_HTTP_AUTHORIZATION
if (!$token && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    error_log("Found token in REDIRECT_HTTP_AUTHORIZATION: " . substr($authHeader, 0, 20) . "...");
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
}
// Method 4: Try to get from Apache-specific headers
if (!$token && function_exists('apache_request_headers')) {
    $apacheHeaders = apache_request_headers();
    if (isset($apacheHeaders['Authorization'])) {
        $authHeader = $apacheHeaders['Authorization'];
        error_log("Found token in apache_request_headers Authorization: " . substr($authHeader, 0, 20) . "...");
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
}
// Method 5: Check if token is in a custom header
if (!$token && isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'];
    error_log("Found token in X-Auth-Token header");
}
// Method 6: Check if token is in GET parameter
if (!$token && isset($_GET['token'])) {
    $token = $_GET['token'];
    error_log("Found token in GET parameter");
}

// For booking confirmation, we might allow access without token for public viewing
// But we'll still try to validate if token is provided
$userId = null;
$userType = null;

if ($token) {
    try {
        // Verify JWT token
        $payload = JWTHelper::validateToken($token);
        error_log("JWT validation successful");
        
        // Verify token exists in database and is not expired
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT us.*, u.user_type 
            FROM user_sessions us
            JOIN users u ON us.user_id = u.user_id
            WHERE us.jwt_token = ? AND us.expires_at > NOW()
        ");
        $stmt->execute([$token]);
        $session = $stmt->fetch();
        
        if ($session) {
            $userId = $session['user_id'];
            $userType = $session['user_type'];
            error_log("Session found in database for user: " . $userType);
        } else {
            error_log("Session not found in database");
        }
    } catch (Exception $e) {
        error_log("JWT validation error: " . $e->getMessage());
    }
}

try {
    $db = Database::getInstance();
    
    // Get booking details with all related information
    $query = "
        SELECT 
            b.booking_id,
            b.user_id,
            b.schedule_id,
            b.booking_status,
            b.booking_date,
            s.departure_time,
            s.arrival_time,
            s.price,
            s.available_seats,
            r.origin,
            r.destination,
            r.distance_km,
            r.estimated_duration_min as duration_minutes,
            p.amount as amount_paid,
            p.payment_method,
            p.status as payment_status,
            p.transaction_id,
            t.qr_code,
            t.is_used,
            u.username,
            u.email,
            u.phone as passenger_phone,
            c.company_name
        FROM bookings b
        JOIN schedules s ON b.schedule_id = s.schedule_id
        JOIN routes r ON s.route_id = r.route_id
        LEFT JOIN payments p ON b.booking_id = p.booking_id
        LEFT JOIN tickets t ON b.booking_id = t.booking_id
        LEFT JOIN users u ON b.user_id = u.user_id
        LEFT JOIN buses bus ON s.bus_id = bus.bus_id
        LEFT JOIN operators c ON bus.operator_id = c.operator_id
        WHERE b.booking_id = :booking_id
    ";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':booking_id', $bookingId);
    $stmt->execute();
    
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$booking) {
        error_log("Booking not found with ID: " . $bookingId);
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Booking not found']);
        exit();
    }
    
    // Set passenger name from username
    $booking['passenger_name'] = $booking['username'] ?? 'N/A';
    
    // Parse transaction_id to get number of seats if needed
    $numberOfSeats = 1; // Default
    if ($booking['transaction_id'] && strpos($booking['transaction_id'], '|') !== false) {
        $transactionParts = explode('|', $booking['transaction_id']);
        $numberOfSeats = intval($transactionParts[0]);
        // Update transaction_id to only contain the actual transaction ID
        $booking['transaction_id'] = $transactionParts[1] ?? null;
    } else if ($booking['transaction_id'] && strpos($booking['transaction_id'], 'SEATS:') !== false) {
        // Handle the case where we stored "SEATS:X" format initially
        $numberOfSeats = intval(str_replace('SEATS:', '', $booking['transaction_id']));
        $booking['transaction_id'] = null; // No actual transaction ID in this case
    }
    
    $booking['number_of_seats'] = $numberOfSeats;
    
    // Calculate total amount if not already set
    if (!$booking['amount_paid'] && $booking['price'] && $numberOfSeats) {
        $booking['amount_paid'] = $booking['price'] * $numberOfSeats;
    }
    
    // Check if user has permission to view this booking
    if ($userId && $userType !== 'admin' && $userId != $booking['user_id']) {
        error_log("User " . $userId . " attempted to access booking " . $bookingId . " without permission");
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'You do not have permission to view this booking']);
        exit();
    }
    
    error_log("Successfully retrieved booking: " . $bookingId);
    echo json_encode(['success' => true, 'booking' => $booking]);
    
} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}