<?php
require_once __DIR__.'/jwt-helper.php';
require_once __DIR__.'/../config/database.php';

session_start();

// Set security headers
header("X-Frame-Options: DENY");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: strict-origin-when-cross-origin");

class AuthHelper {
    private static $db;
    
    public static function init() {
        self::$db = Database::getInstance();
    }
    
    public static function authenticateUser($allowedTypes = []) {
        $token = self::getTokenFromRequest();
        
        if (!$token) {
            self::unauthorized('Authentication required');
        }
        
        try {
            $decoded = JWTHelper::validateToken($token);
            
            if (!$decoded) {
                self::unauthorized('Invalid or expired token');
            }
            
            // Verify token hasn't been revoked
            if (!self::verifyTokenActive($token)) {
                self::unauthorized('Token revoked');
            }
            
            // Check user type permissions
            if (!empty($allowedTypes) && !in_array($decoded['user_type'], $allowedTypes)) {
                self::forbidden('Insufficient privileges');
            }
            
            // Update session data
            $_SESSION['auth'] = [
                'user_id' => $decoded['user_id'],
                'email' => $decoded['email'],
                'user_type' => $decoded['user_type'],
                'token' => $token,
                'ip' => $_SERVER['REMOTE_ADDR'],
                'user_agent' => $_SERVER['HTTP_USER_AGENT']
            ];
            
            return $decoded;
            
        } catch (Exception $e) {
            error_log("Authentication error: " . $e->getMessage());
            self::unauthorized('Authentication failed');
        }
    }
    
    private static function getTokenFromRequest() {
        // Check Authorization header first
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }
        
        // Fallback to cookie
        if (isset($_COOKIE['auth_token'])) {
            return $_COOKIE['auth_token'];
        }
        
        // Fallback to session
        if (isset($_SESSION['auth']['token'])) {
            return $_SESSION['auth']['token'];
        }
        
        return null;
    }
    
    private static function verifyTokenActive($token) {
        try {
            $stmt = self::$db->prepare("
                SELECT 1 FROM user_sessions 
                WHERE jwt_token = ? AND expires_at > NOW() AND revoked = 0
            ");
            $stmt->execute([$token]);
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            error_log("Token verification failed: " . $e->getMessage());
            return false;
        }
    }
    
    public static function unauthorized($message = 'Unauthorized') {
        http_response_code(401);
        header('WWW-Authenticate: Bearer realm="Access to the API"');
        die(json_encode(['error' => $message]));
    }
    
    public static function forbidden($message = 'Forbidden') {
        http_response_code(403);
        die(json_encode(['error' => $message]));
    }
    
    // Shortcut methods
    public static function requireAuth() {
        return self::authenticateUser();
    }
    
    public static function requireAdmin() {
        return self::authenticateUser(['admin']);
    }
    
    public static function requireOperator() {
        return self::authenticateUser(['operator']);
    }
    
    public static function getCurrentUser() {
        return $_SESSION['auth'] ?? null;
    }
}

// Initialize the auth helper
AuthHelper::init();