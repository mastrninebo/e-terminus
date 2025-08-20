<?php
header('Content-Type: application/json');
require_once __DIR__.'/../../config/database.php';
require_once __DIR__.'/../../includes/jwt-helper.php';

// Security headers
header("X-Frame-Options: DENY");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: strict-origin-when-cross-origin");

// CORS headers
$allowedOrigins = ['http://localhost', 'http://127.0.0.1'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost");
}
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_start();

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
        exit;
    } else {
        // Reset counter if window has passed
        $_SESSION[$rateLimitKey] = ['count' => 0, 'last_attempt' => time()];
    }
}

// Get input data
$input = json_decode(file_get_contents('php://input'), true);
if ($input === null && !empty($_POST)) {
    $input = $_POST;
}

// Validate input
if (empty($input['email']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit;
}

try {
    $db = Database::getInstance();
    
    // Get user with login attempts tracking - UPDATED with account_locked
    $stmt = $db->prepare("
        SELECT user_id, username, email, password_hash, user_type, 
               is_verified, account_locked, login_attempts, last_login
        FROM users 
        WHERE email = ? OR username = ?
        LIMIT 1
    ");
    $stmt->execute([$input['email'], $input['email']]);
    $user = $stmt->fetch();

    // Check if account exists and is locked
    if ($user && $user['account_locked']) {
        http_response_code(403);
        echo json_encode(['error' => 'Account locked. Please reset your password.']);
        exit;
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
        exit;
    }

    // Check if email is verified
    if (!$user['is_verified']) {
        http_response_code(403);
        echo json_encode([
            'error' => 'Account not verified. Please check your email.',
            'verification_required' => true
        ]);
        exit;
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

    // Generate JWT token
    $sessionId = bin2hex(random_bytes(16));
    $tokenPayload = [
        'user_id' => $user['user_id'],
        'email' => $user['email'],
        'user_type' => $user['user_type'],
        'session_id' => $sessionId
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
            date('Y-m-d H:i:s', time() + 86400)
        ]);
    } catch (PDOException $e) {
        error_log("Session storage error: " . $e->getMessage());
        // Continue without session storage - don't fail login
    }

    // Set secure cookie if "remember me" was checked
    if (!empty($input['remember'])) {
        $cookieParams = [
            'expires' => time() + 86400 * 30,
            'path' => '/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict'
        ];
        
        // Set domain only if not localhost
        if ($_SERVER['HTTP_HOST'] !== 'localhost') {
            $cookieParams['domain'] = $_SERVER['HTTP_HOST'];
        }
        
        setcookie('auth_token', $token, $cookieParams);
    }

    // Return success response
    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $user['user_id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'user_type' => $user['user_type']
        ]
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