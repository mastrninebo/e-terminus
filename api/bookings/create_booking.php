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

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/zynlepay.php';
require_once __DIR__ . '/../../includes/jwt-helper.php';
require_once __DIR__ . '/../../includes/ZynlePayService.php';

// Debug logging
error_log("=== CREATE BOOKING DEBUG ===");
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("Content type: " . ($_SERVER['CONTENT_TYPE'] ?? 'Not set'));

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
if (!$token) {
    // Start session if not already started
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (isset($_SESSION['auth_token'])) {
        $token = $_SESSION['auth_token'];
    }
}

error_log("Token found: " . ($token ? 'Yes' : 'No'));

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
    error_log("User ID: " . $userId);
    
    // Get JSON data
    $json = file_get_contents('php://input');
    error_log("Raw JSON data: " . $json);
    
    $data = json_decode($json, true);
    
    // Check if JSON is valid
    if ($data === null) {
        error_log("JSON decode error: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
        exit();
    }
    
    error_log("Decoded data: " . print_r($data, true));
    
    // Validate required fields
    $requiredFields = ['schedule_id', 'number_of_seats', 'payment_method'];
    $missingFields = [];
    
    foreach ($requiredFields as $field) {
        if (!isset($data[$field])) {
            $missingFields[] = $field;
        }
    }
    
    if (!empty($missingFields)) {
        error_log("Missing required fields: " . implode(', ', $missingFields));
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields: ' . implode(', ', $missingFields)]);
        exit;
    }
    
    $scheduleId = intval($data['schedule_id']);
    $numberOfSeats = intval($data['number_of_seats']);
    $paymentMethod = $data['payment_method'];
    $paymentDetails = $data['payment_details'] ?? [];
    
    error_log("Schedule ID: " . $scheduleId);
    error_log("Number of seats: " . $numberOfSeats);
    error_log("Payment method: " . $paymentMethod);
    
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
        error_log("Schedule not found with ID: " . $scheduleId);
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Schedule not found']);
        exit();
    }
    
    // Check if enough seats are available
    if ($schedule['available_seats'] < $numberOfSeats) {
        error_log("Not enough seats. Available: " . $schedule['available_seats'] . ", Requested: " . $numberOfSeats);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Not enough seats available']);
        exit();
    }
    
    // Calculate total price
    $totalPrice = $schedule['price'] * $numberOfSeats;
    error_log("Total price: " . $totalPrice);
    
    // Get user details for Zynle Pay
    $stmt = $db->prepare("
        SELECT username, email, phone 
        FROM users 
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    // Initialize variables that will be used in the response
    $bookingId = null;
    $paymentId = null;
    $response = [
        'success' => true,
        'booking_id' => null
    ];
    
    // Begin transaction
    $db->beginTransaction();
    
    try {
        // Step 1: Create booking with CONFIRMED status but we'll track payment status separately
        $stmt = $db->prepare("
            INSERT INTO bookings (user_id, schedule_id, booking_status) 
            VALUES (?, ?, 'confirmed')
        ");
        $stmt->execute([$userId, $scheduleId]);
        $bookingId = $db->lastInsertId();
        error_log("Booking created with ID: " . $bookingId);
        
        // Step 2: Create payment record with pending status
        // Store number of seats in transaction_id temporarily
        $tempTransactionId = "SEATS:" . $numberOfSeats;
        $stmt = $db->prepare("
            INSERT INTO payments (booking_id, amount, payment_method, transaction_id, status) 
            VALUES (?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([$bookingId, $totalPrice, $paymentMethod, $tempTransactionId]);
        $paymentId = $db->lastInsertId();
        error_log("Payment created with ID: " . $paymentId);
        
        // Set the basic response data
        $response['booking_id'] = $bookingId;
        $response['payment_id'] = $paymentId;
        
        // If payment method is Zynle Pay, initiate payment before committing the transaction
        if (in_array($paymentMethod, ['mobile_money', 'card'])) {
            // Get the payment phone number from payment details or fall back to user's phone
            $paymentPhone = $user['phone']; // Default to user's phone from database
            
            // If payment method is mobile money and mobile number is provided in payment details
            if ($paymentMethod === 'mobile_money' && isset($paymentDetails['mobile_number']) && !empty($paymentDetails['mobile_number'])) {
                // Format the mobile number with Zambia country code (260)
                $paymentPhone = '260' . $paymentDetails['mobile_number'];
                error_log("Using payment phone number: " . $paymentPhone);
            } else {
                error_log("Using user's phone number: " . $paymentPhone);
            }
            
            // Prepare data for Zynle Pay
            $paymentData = [
                'amount' => $totalPrice,
                'order_id' => 'BOOK-' . $bookingId . '-' . $paymentId,
                'order_desc' => 'Bus ticket from ' . $schedule['origin'] . ' to ' . $schedule['destination'],
                'customer_name' => $user['username'],
                'customer_email' => $user['email'],
                'customer_phone' => $paymentPhone,
                'payment_method' => $paymentMethod
            ];
            
            // Initialize Zynle Pay service
            $zynlePayService = new ZynlePayService();
            
            // Initiate payment
            $zynleResponse = $zynlePayService->initiatePayment($paymentData);
            error_log("Zynle Pay response: " . print_r($zynleResponse, true));
            
            if ($zynleResponse['success'] && isset($zynleResponse['data']['response'])) {
                // Check if the transaction was initiated successfully
                $responseCode = $zynleResponse['data']['response']['response_code'] ?? '';
                
                if ($responseCode === '120') { // Transaction initiated successfully
                    // Get the transaction details
                    $transactionId = $zynleResponse['data']['response']['transaction_id'] ?? null;
                    $referenceNo = $zynleResponse['reference_no'] ?? null;
                    
                    // Update payment record with transaction ID (overwriting the temporary one)
                    // Store number of seats and reference in transaction_id field
                    $combinedTransactionId = $numberOfSeats . "|" . $transactionId . "|" . ($referenceNo ?? '');
                    $stmt = $db->prepare("
                        UPDATE payments 
                        SET transaction_id = ? 
                        WHERE payment_id = ?
                    ");
                    $stmt->execute([$combinedTransactionId, $paymentId]);
                    
                    // Store the reference number in a session for callback verification
                    $_SESSION['zynle_reference_no'] = $referenceNo;
                    
                    // Format the amount properly
                    $formattedAmount = number_format($totalPrice, 2, '.', '');
                    
                    // Add payment details to the response
                    $response['payment_initiated'] = true;
                    $response['transaction_id'] = $transactionId;
                    $response['reference_no'] = $referenceNo;
                    $response['message'] = 'Payment initiated successfully. Please complete the payment on your mobile device.';
                    $response['redirect_url'] = "payment-simulation.html?booking_id={$bookingId}&transaction_id={$transactionId}&amount={$formattedAmount}";
                } else {
                    // Handle other response codes
                    $responseDescription = $zynleResponse['data']['response']['response_description'] ?? 'Unknown error';
                    error_log("Zynle Pay API returned error code: " . $responseCode . " - " . $responseDescription);
                    
                    // Add payment error details to the response
                    $response['payment_pending'] = true;
                    $response['payment_error'] = $responseDescription;
                    
                    // Add redirect URL for error case
                    $formattedAmount = number_format($totalPrice, 2, '.', '');
                    $response['redirect_url'] = "payment-simulation.html?booking_id={$bookingId}&error=" . urlencode($responseDescription) . "&amount={$formattedAmount}";
                }
            } else {
                // Log the error for debugging
                error_log("Zynle Pay API failed: " . ($zynleResponse['message'] ?? 'Unknown error'));
                
                // Add payment error details to the response
                $response['payment_pending'] = true;
                $response['payment_error'] = $zynleResponse['message'] ?? 'Payment service temporarily unavailable';
                
                // Add redirect URL for API failure case
                $formattedAmount = number_format($totalPrice, 2, '.', '');
                $response['redirect_url'] = "payment-simulation.html?booking_id={$bookingId}&error=" . urlencode($zynleResponse['message'] ?? 'Payment service temporarily unavailable') . "&amount={$formattedAmount}";
            }
        } else {
            // For non-Zynle Pay payment methods (e.g., cash)
            // Create ticket immediately
            $qrCode = 'ET-' . $bookingId . '-' . bin2hex(random_bytes(4));
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
            
            // Update payment status to success
            $stmt = $db->prepare("
                UPDATE payments 
                SET status = 'success' 
                WHERE payment_id = ?
            ");
            $stmt->execute([$paymentId]);
            
            $response['qr_code'] = $qrCode;
        }
        
        // Commit transaction
        $db->commit();
        error_log("Transaction committed successfully");
        
        // Return the response
        echo json_encode($response);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("Transaction error: " . $e->getMessage());
        throw $e;
    }
    
} catch (PDOException $e) {
    error_log("PDO error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error']);
} catch (Exception $e) {
    error_log("General error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}