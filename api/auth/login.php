<?php
header('Content-Type: application/json; charset=UTF-8');
// Dynamic CORS handling
$allowed_origins = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Allow-Credentials: true");
}
// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}
session_start();
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php'; // Composer autoloader
require_once __DIR__ . '/../../includes/EmailService.php'; // Email service
require_once __DIR__ . '/../../includes/jwt-helper.php'; // JWT helper
// Enable error logging (development only)
ini_set('display_errors', 1);
error_reporting(E_ALL);
// Get input (JSON or form POST)
$raw_input = file_get_contents('php://input');
$input = json_decode($raw_input, true);
// Fallback to $_POST if JSON is empty or invalid
if (json_last_error() !== JSON_ERROR_NONE || empty($input)) {
    if (!empty($_POST)) {
        $input = $_POST;
    }
}
// Check if this is a resend verification request
if (isset($input['action']) && $input['action'] === 'resend_verification') {
    // Handle resend verification logic
    if (empty($input['email'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email is required']);
        exit();
    }
    
    try {
        $db = Database::getInstance();
        
        // Check if user exists and is not verified
        $stmt = $db->prepare("
            SELECT user_id, username, email, verification_token 
            FROM users 
            WHERE email = ? AND is_verified = 0
            LIMIT 1
        ");
        $stmt->execute([$input['email']]);
        $user = $stmt->fetch();
        
        if (!$user) {
            // For security, don't reveal if the email exists or not
            echo json_encode([
                'success' => true, 
                'message' => 'If your email is registered and not verified, you will receive a verification email.'
            ]);
            exit();
        }
        
        // Generate a new verification token if needed
        $token = $user['verification_token'];
        if (empty($token)) {
            $token = bin2hex(random_bytes(32));
            // Update the user's verification token
            $stmt = $db->prepare("
                UPDATE users 
                SET verification_token = ? 
                WHERE user_id = ?
            ");
            $stmt->execute([$token, $user['user_id']]);
        }
        
        // Send verification email using EmailService (same as in register.php)
        try {
            $emailService = new EmailService();
            $emailSent = $emailService->sendVerificationEmail(
                $user['email'],
                $user['username'],
                $token
            );
            
            if ($emailSent) {
                echo json_encode([
                    'success' => true, 
                    'message' => 'Verification email has been resent.'
                ]);
            } else {
                echo json_encode([
                    'error' => 'Failed to send verification email. Please try again later.'
                ]);
            }
            
        } catch (Exception $e) {
            error_log("Email service error: " . $e->getMessage());
            echo json_encode([
                'error' => 'Email service is temporarily unavailable. Please try again later.'
            ]);
        }
        
    } catch (PDOException $e) {
        error_log("Resend verification error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Database error. Please try again.']);
    } catch (Exception $e) {
        error_log("Resend verification error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred.']);
    }
    exit(); // Exit after handling resend verification
}
// If not a resend verification request, continue with normal login process
// Validate input for normal login
if (empty($input['email']) && empty($input['username'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email or username is required']);
    exit();
}
if (empty($input['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Password is required']);
    exit();
}
// Rate limiting with IP-based key
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitKey = 'login_attempts_' . md5($clientIp);
if (!isset($_SESSION[$rateLimitKey])) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'last_attempt' => time()];
}
// Check rate limiting
if ($_SESSION[$rateLimitKey]['count'] >= 5) {
    $retryAfter = 900 - (time() - $_SESSION[$rateLimitKey]['last_attempt']);
    if ($retryAfter > 0) {
        header('Retry-After: ' . $retryAfter);
        http_response_code(429);
        echo json_encode([
            'error' => 'Too many attempts. Try again in ' . ceil($retryAfter/60) . ' minutes.',
            'retry_after' => $retryAfter
        ]);
        exit();
    } else {
        // Reset counter if window has passed
        $_SESSION[$rateLimitKey] = ['count' => 0, 'last_attempt' => time()];
    }
}
try {
    $db = Database::getInstance();
    
    // Get user with login attempts tracking - UPDATED with account_locked
    $loginField = filter_var($input['email'] ?? $input['username'], FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
    
    $stmt = $db->prepare("
        SELECT user_id, username, email, password_hash, user_type, 
               is_verified, account_locked, login_attempts, last_login
        FROM users 
        WHERE {$loginField} = ?
        LIMIT 1
    ");
    $stmt->execute([$input['email'] ?? $input['username']]);
    $user = $stmt->fetch();
    
    // Check if account exists and is locked
    if ($user && $user['account_locked']) {
        http_response_code(403);
        echo json_encode(['error' => 'Account locked. Please reset your password.']);
        exit();
    }
    
    // Verify credentials
    if (!$user || !password_verify($input['password'], $user['password_hash'])) {
        $_SESSION[$rateLimitKey]['count']++;
        $_SESSION[$rateLimitKey]['last_attempt'] = time();
        
        // Update failed attempt count if user exists
        if ($user) {
            $newAttempts = $user['login_attempts'] + 1;
            $lockAccount = $newAttempts >= 5;
            
            $stmt = $db->prepare("
                UPDATE users 
                SET login_attempts = ?, 
                    account_locked = ?
                WHERE user_id = ?
            ");
            $stmt->execute([$newAttempts, $lockAccount, $user['user_id']]);
        }
        
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
        exit();
    }
    
    // Check if email is verified
    if (!$user['is_verified']) {
        http_response_code(403);
        echo json_encode([
            'error' => 'Account not verified. Please check your email.',
            'verification_required' => true
        ]);
        exit();
    }
    
    // Reset login attempts, unlock account, and update last login
    $stmt = $db->prepare("
        UPDATE users 
        SET login_attempts = 0, 
            account_locked = FALSE,
            last_login = NOW() 
        WHERE user_id = ?
    ");
    $stmt->execute([$user['user_id']]);
    
    // Reset rate limiting counter
    $_SESSION[$rateLimitKey]['count'] = 0;
    
    // Generate JWT token with consistent expiration
    $sessionId = bin2hex(random_bytes(16));
    $expires = !empty($input['remember']) ? time() + 86400 * 30 : time() + 86400; // 30 days or 24 hours
    
    $tokenPayload = [
        'user_id' => $user['user_id'],
        'email' => $user['email'],
        'user_type' => $user['user_type'],
        'session_id' => $sessionId,
        'exp' => $expires // Add expiration claim
    ];
    $token = JWTHelper::generateToken($tokenPayload);
    
    // Store session in database
    try {
        $stmt = $db->prepare("
            INSERT INTO user_sessions (
                session_id, user_id, jwt_token, 
                ip_address, user_agent, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $sessionId,
            $user['user_id'],
            $token,
            $clientIp,
            $_SERVER['HTTP_USER_AGENT'] ?? '',
            date('Y-m-d H:i:s', $expires)
        ]);
    } catch (PDOException $e) {
        error_log("Session storage error: " . $e->getMessage());
        // Continue without session storage - don't fail login
    }
    
    // Always store token in session
    $_SESSION['auth_token'] = $token;
    
    // Always set a cookie (not just for remember me)
    $cookieParams = [
        'expires' => !empty($input['remember']) ? time() + 86400 * 30 : 0, // Session cookie if not remembered
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ];
    
    if ($_SERVER['HTTP_HOST'] !== 'localhost') {
        $cookieParams['domain'] = $_SERVER['HTTP_HOST'];
    }
    
    setcookie('auth_token', $token, $cookieParams);
    
    // Check if user is admin for redirect information
    $isAdmin = ($user['user_type'] === 'admin');
    
    // Return success response
    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $user['user_id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'user_type' => $user['user_type'],
            'is_admin' => $isAdmin
        ],
        'redirect' => $isAdmin ? '/public/admin/dashboard.php' : '/public/dashboard.html'
    ]);
    
} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Login failed. Please try again.']);
} catch (Exception $e) {
    error_log("Unexpected error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'An unexpected error occurred.']);
}