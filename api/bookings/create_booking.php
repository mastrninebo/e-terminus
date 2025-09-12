<?php
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
require_once __DIR__.'/../../includes/jwt-helper.php';

// Get token from Authorization header or cookie
$token = null;

// Check Authorization header first
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
}

// If no header, check cookie
if (!$token && isset($_COOKIE['auth_token'])) {
    $token = $_COOKIE['auth_token'];
}

// If no cookie, check session
if (!$token && session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (!$token && isset($_SESSION['auth_token'])) {
    $token = $_SESSION['auth_token'];
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required']);
    exit();
}

try {
    $db = Database::getInstance();
    
    // Verify JWT token
    $payload = JWTHelper::validateToken($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit();
    }
    
    // Verify token exists in database and is not expired
    $stmt = $db->prepare("
        SELECT us.user_id 
        FROM user_sessions us
        WHERE us.jwt_token = ? AND us.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if (!$session) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired session']);
        exit();
    }
    
    $userId = $session['user_id'];
    
    // Get JSON data
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    // Validate required fields
    if (!isset($data['schedule_id']) || !isset($data['number_of_seats']) || !isset($data['payment_method'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }
    
    $scheduleId = intval($data['schedule_id']);
    $numberOfSeats = intval($data['number_of_seats']);
    $paymentMethod = $data['payment_method'];
    
    // Check if schedule exists and has enough seats
    $stmt = $db->prepare("
        SELECT s.*, b.capacity, o.company_name, r.origin, r.destination, r.estimated_duration_min
        FROM schedules s
        JOIN buses b ON s.bus_id = b.bus_id
        JOIN operators o ON b.operator_id = o.operator_id
        JOIN routes r ON s.route_id = r.route_id
        WHERE s.schedule_id = ? AND s.status = 'scheduled'
    ");
    $stmt->execute([$scheduleId]);
    $schedule = $stmt->fetch();
    
    if (!$schedule) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Schedule not found']);
        exit;
    }
    
    // Check if enough seats are available
    if ($schedule['available_seats'] < $numberOfSeats) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Not enough seats available']);
        exit;
    }
    
    // Calculate total price
    $totalPrice = $schedule['price'] * $numberOfSeats;
    
    // Begin transaction
    $db->beginTransaction();
    
    try {
        // Create booking
        $stmt = $db->prepare("
            INSERT INTO bookings (user_id, schedule_id, booking_status) 
            VALUES (?, ?, 'confirmed')
        ");
        $stmt->execute([$userId, $scheduleId]);
        $bookingId = $db->lastInsertId();
        
        // Create payment record
        $stmt = $db->prepare("
            INSERT INTO payments (booking_id, amount, payment_method, status) 
            VALUES (?, ?, ?, 'pending')
        ");
        $stmt->execute([$bookingId, $totalPrice, $paymentMethod]);
        
        // Update available seats
        $stmt = $db->prepare("
            UPDATE schedules 
            SET available_seats = available_seats - ? 
            WHERE schedule_id = ?
        ");
        $stmt->execute([$numberOfSeats, $scheduleId]);
        
        // Generate QR code for ticket
        $qrCode = 'ET-' . $bookingId . '-' . bin2hex(random_bytes(4));
        
        // Create ticket
        $stmt = $db->prepare("
            INSERT INTO tickets (booking_id, qr_code) 
            VALUES (?, ?)
        ");
        $stmt->execute([$bookingId, $qrCode]);
        
        // Commit transaction
        $db->commit();
        
        echo json_encode([
            'success' => true, 
            'booking_id' => $bookingId,
            'qr_code' => $qrCode
        ]);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $db->rollBack();
        throw $e;
    }
    
} catch (PDOException $e) {
    error_log("Booking creation error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error']);
} catch (Exception $e) {
    error_log("Unexpected booking error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}