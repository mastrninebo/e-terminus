<?php
class JWTHelper {
    private static $secretKey;
    private static $algorithm = 'HS256';
    private static $expireSeconds = 86400; // 24 hours
    
    public static function init() {
        // Load secret key from environment or config
        self::$secretKey = getenv('JWT_SECRET') ?: file_get_contents(__DIR__.'/../config/jwt-secret.key');
        
        if (empty(self::$secretKey)) {
            throw new Exception('JWT secret key not configured');
        }
    }
    
    public static function generateToken(array $payload): string {
        $header = [
            'typ' => 'JWT',
            'alg' => self::$algorithm,
            'iat' => time()
        ];
        
        // Set expiration
        $payload['exp'] = time() + self::$expireSeconds;
        
        $encodedHeader = self::base64UrlEncode(json_encode($header));
        $encodedPayload = self::base64UrlEncode(json_encode($payload));
        
        $signature = hash_hmac('sha256', "$encodedHeader.$encodedPayload", self::$secretKey, true);
        $encodedSignature = self::base64UrlEncode($signature);
        
        return "$encodedHeader.$encodedPayload.$encodedSignature";
    }
    
    public static function validateToken(string $token): ?array {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                return null;
            }
            
            [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
            
            // Verify signature
            $signature = self::base64UrlDecode($encodedSignature);
            $expectedSignature = hash_hmac('sha256', "$encodedHeader.$encodedPayload", self::$secretKey, true);
            
            if (!hash_equals($signature, $expectedSignature)) {
                return null;
            }
            
            $payload = json_decode(self::base64UrlDecode($encodedPayload), true);
            
            // Verify expiration
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                return null;
            }
            
            return $payload;
            
        } catch (Exception $e) {
            error_log("JWT validation error: " . $e->getMessage());
            return null;
        }
    }
    
    private static function base64UrlEncode(string $data): string {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }
    
    private static function base64UrlDecode(string $data): string {
        $padded = str_pad(str_replace(['-', '_'], ['+', '/'], $data), strlen($data) % 4, '=', STR_PAD_RIGHT);
        return base64_decode($padded);
    }
    
    public static function refreshToken(string $token): ?string {
        $payload = self::validateToken($token);
        if (!$payload) {
            return null;
        }
        
        // Remove old expiration
        unset($payload['exp'], $payload['iat']);
        
        return self::generateToken($payload);
    }
}

// Initialize JWT helper
JWTHelper::init();