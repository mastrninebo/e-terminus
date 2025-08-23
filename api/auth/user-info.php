<?php
// Verify JWT token and return user info
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// For production, implement proper JWT verification
// This is a simplified version for demonstration
function verifyToken($token) {
    // In production, use a proper JWT library like firebase/php-jwt
    // This is a placeholder implementation
    
    // Example token structure: "Bearer <token>"
    if (strpos($token, 'Bearer ') !== 0) {
        return false;
    }
    
    $token = substr($token, 7);
    
    // Mock validation - replace with actual JWT verification
    if ($token === 'valid_token') {
        return [
            'user_id' => 1,
            'username' => 'JohnDoe',
            'email' => 'john@example.com'
        ];
    }
    
    return false;
}

// Get Authorization header
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

// Verify token
$user = verifyToken($authHeader);

if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid or expired token']);
    exit;
}

// Return user info
echo json_encode($user);
?>