<?php
header('Content-Type: application/json; charset=UTF-8');
header("Access-Control-Allow-Origin: http://localhost"); // Specific origin for production
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

session_start();
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php'; // Composer autoloader
require_once __DIR__ . '/../../includes/EmailService.php'; // Email service

// Enable error logging (development only)
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Generate CSRF token if not exists
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Get input (JSON or form POST)
$raw_input = file_get_contents('php://input');
$input = json_decode($raw_input, true);

// Fallback to $_POST if JSON is empty or invalid
if (json_last_error() !== JSON_ERROR_NONE || empty($input)) {
    if (!empty($_POST)) {
        $input = $_POST;
    }
}

// If still empty, user accessed directly in browser
if (empty($input)) {
    echo json_encode([
        "message" => "Welcome to the registration endpoint. Please send POST data.",
        "csrf_token" => $_SESSION['csrf_token']
    ]);
    exit();
}

// Validate CSRF token
if (!isset($input['csrfToken']) || !hash_equals($_SESSION['csrf_token'], $input['csrfToken'])) {
    http_response_code(403);
    echo json_encode(['error' => 'CSRF token validation failed']);
    exit();
}

// Validate required fields
$errors = [];
$required_fields = ['username', 'email', 'phone', 'password'];

foreach ($required_fields as $field) {
    if (empty($input[$field])) {
        $errors[$field] = 'This field is required';
    }
}

// Specific validations
if (!empty($input['email']) && !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Invalid email format';
}

if (!empty($input['phone']) && !preg_match('/^260\d{9}$/', $input['phone'])) {
    $errors['phone'] = 'Invalid Zambian phone number (must start with 260 followed by 9 digits)';
}

if (!empty($input['password'])) {
    if (strlen($input['password']) < 8) {
        $errors['password'] = 'Password must be at least 8 characters';
    } elseif (!preg_match('/[A-Z]/', $input['password'])) {
        $errors['password'] = 'Password must contain at least one uppercase letter';
    } elseif (!preg_match('/[0-9]/', $input['password'])) {
        $errors['password'] = 'Password must contain at least one number';
    }
}

// Return validation errors
if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['error' => 'Validation failed', 'errors' => $errors]);
    exit();
}

try {
    $db = Database::getInstance();

    // Check for existing user
    $stmt = $db->prepare("SELECT user_id FROM users WHERE email = ? OR username = ?");
    $stmt->execute([$input['email'], $input['username']]);

    if ($stmt->rowCount() > 0) {
        http_response_code(409);
        
        // Get specific field that caused conflict
        $conflictStmt = $db->prepare("SELECT email, username FROM users WHERE email = ? OR username = ?");
        $conflictStmt->execute([$input['email'], $input['username']]);
        $existingUsers = $conflictStmt->fetchAll();
        
        $conflictErrors = [];
        foreach ($existingUsers as $existing) {
            if ($existing['email'] === $input['email']) {
                $conflictErrors['email'] = 'Email already registered';
            }
            if ($existing['username'] === $input['username']) {
                $conflictErrors['username'] = 'Username already taken';
            }
        }
        
        echo json_encode([
            'error' => 'User already exists',
            'errors' => $conflictErrors
        ]);
        exit();
    }

    // Create verification token
    $verificationToken = bin2hex(random_bytes(32));
    
    // Create new user
    $stmt = $db->prepare("
        INSERT INTO users (username, email, phone, password_hash, user_type, verification_token, created_at)
        VALUES (?, ?, ?, ?, 'passenger', ?, NOW())
    ");

    $success = $stmt->execute([
        $input['username'],
        $input['email'],
        $input['phone'],
        password_hash($input['password'], PASSWORD_BCRYPT, ['cost' => 12]),
        $verificationToken
    ]);

    if ($success) {
        $userId = $db->lastInsertId();
        
        // Generate new CSRF token after successful operation
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        
        // Send verification email
        try {
            $emailService = new EmailService();
            $emailSent = $emailService->sendVerificationEmail(
                $input['email'],
                $input['username'],
                $verificationToken
            );
            
            if ($emailSent) {
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Registration successful! Please check your email to verify your account.',
                    'user_id' => $userId,
                    'email_sent' => true,
                    'csrf_token' => $_SESSION['csrf_token']
                ]);
            } else {
                // Email failed but user was created
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Registration successful, but verification email could not be sent. Please contact support.',
                    'user_id' => $userId,
                    'email_sent' => false,
                    'csrf_token' => $_SESSION['csrf_token']
                ]);
            }
            
        } catch (Exception $e) {
            error_log("Email service error: " . $e->getMessage());
            
            // User created but email service failed
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Registration successful, but email service is temporarily unavailable. Please contact support to verify your account.',
                'user_id' => $userId,
                'email_sent' => false,
                'csrf_token' => $_SESSION['csrf_token']
            ]);
        }
        
    } else {
        throw new Exception('Database insertion failed');
    }
} catch (PDOException $e) {
    error_log("Registration Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Registration failed. Please try again.']);
} catch (Exception $e) {
    error_log("Registration Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Registration failed. Please try again.']);
}