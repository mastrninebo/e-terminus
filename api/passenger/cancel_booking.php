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
// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../includes/jwt-helper.php';

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Debug function
function debug_log($message) {
    error_log("[CANCEL_BOOKING_DEBUG] " . $message);
}

debug_log("Script started");

// Get token from request
$token = null;
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        debug_log("Token found in Authorization header");
    }
}
if (!$token && isset($_COOKIE['auth_token'])) {
    $token = $_COOKIE['auth_token'];
    debug_log("Token found in cookie");
}
if (!$token && isset($_SESSION['auth_token'])) {
    $token = $_SESSION['auth_token'];
    debug_log("Token found in session");
}
if (!$token) {
    debug_log("No token found");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}

debug_log("Token found: " . substr($token, 0, 20) . "...");

// Get JSON data
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    debug_log("Invalid JSON data");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request data']);
    exit();
}

debug_log("Request data: " . json_encode($data));

if (!isset($data['booking_id'])) {
    debug_log("Missing booking_id");
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Booking ID is required']);
    exit();
}

try {
    // Verify JWT token
    debug_log("Validating JWT token");
    $payload = JWTHelper::validateToken($token);
    
    if (!$payload) {
        debug_log("JWT validation failed");
        http_response_code(401);
        echo json_encode(['authenticated' => false, 'reason' => 'Invalid token']);
        exit();
    }
    
    debug_log("JWT validation successful");
    
    // Get database instance
    debug_log("Getting database instance");
    $db = Database::getInstance();
    
    // Verify token exists in database and is not expired
    debug_log("Verifying session in database");
    $stmt = $db->prepare("
        SELECT us.*, u.username, u.email, u.user_type, u.created_at 
        FROM user_sessions us
        JOIN users u ON us.user_id = u.user_id
        WHERE us.jwt_token = ? AND us.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if (!$session) {
        debug_log("Session not found in database");
        http_response_code(401);
        echo json_encode(['authenticated' => false, 'reason' => 'Invalid or expired session']);
        exit();
    }
    
    debug_log("Session found for user: " . $session['username']);
    
    // Get user ID from session
    $userId = $session['user_id'];
    debug_log("User ID: " . $userId);
    
    // Verify booking belongs to user and get booking details
    debug_log("Verifying booking belongs to user");
    try {
        $stmt = $db->prepare("
            SELECT b.*, s.departure_time, s.arrival_time, r.origin, r.destination
            FROM bookings b
            JOIN schedules s ON b.schedule_id = s.schedule_id
            JOIN routes r ON s.route_id = r.route_id
            WHERE b.booking_id = ? AND b.user_id = ?
        ");
        $stmt->execute([$data['booking_id'], $userId]);
        $booking = $stmt->fetch();
        
        if (!$booking) {
            debug_log("Booking not found or doesn't belong to user");
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Booking not found']);
            exit();
        }
        
        debug_log("Booking found: " . json_encode($booking));
        
        // Check if booking can be cancelled
        debug_log("Checking if booking can be cancelled");
        
        // Only allow cancellation of confirmed bookings
        if ($booking['booking_status'] !== 'confirmed') {
            debug_log("Booking cannot be cancelled - status: " . $booking['booking_status']);
            echo json_encode(['success' => false, 'message' => 'This booking cannot be cancelled']);
            exit();
        }
        
        // Check if booking is too close to departure time (less than 24 hours)
        $departureTime = new DateTime($booking['departure_time']);
        $now = new DateTime();
        $interval = $now->diff($departureTime);
        $hoursUntilDeparture = ($interval->days * 24) + $interval->h;
        
        debug_log("Hours until departure: " . $hoursUntilDeparture);
        
        if ($hoursUntilDeparture < 24) {
            debug_log("Booking too close to departure for cancellation");
            echo json_encode(['success' => false, 'message' => 'Booking cannot be cancelled less than 24 hours before departure']);
            exit();
        }
        
        // Start transaction
        debug_log("Starting database transaction");
        $db->beginTransaction();
        
        try {
            // Update booking status to cancelled
            debug_log("Updating booking status to cancelled");
            $stmt = $db->prepare("UPDATE bookings SET booking_status = 'cancelled' WHERE booking_id = ?");
            $result = $stmt->execute([$data['booking_id']]);
            
            if (!$result) {
                throw new Exception("Failed to update booking status");
            }
            
            debug_log("Booking status updated successfully");
            
            // Commit transaction
            $db->commit();
            debug_log("Transaction committed successfully");
            
            echo json_encode([
                'success' => true, 
                'message' => 'Booking cancelled successfully',
                'booking_details' => [
                    'booking_id' => $booking['booking_id'],
                    'route' => $booking['origin'] . ' to ' . $booking['destination'],
                    'departure_time' => $booking['departure_time']
                ]
            ]);
            
        } catch (Exception $e) {
            // Rollback transaction on error
            $db->rollBack();
            debug_log("Transaction rolled back: " . $e->getMessage());
            throw $e;
        }
        
    } catch (PDOException $e) {
        debug_log("Database error during booking cancellation: " . $e->getMessage());
        throw $e;
    }
    
} catch (PDOException $e) {
    debug_log("Database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    debug_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}