<?php
require_once __DIR__ . '/../e-terminus/config/database.php';

// Set content type to HTML
header('Content-Type: text/html; charset=UTF-8');

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification | E-Terminus</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: 'Ubuntu', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f8f9fa;
        }
        .verification-card {
            max-width: 500px;
            width: 100%;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="verification-card card p-4">
            <?php
            $token = $_GET['token'] ?? '';

            if (empty($token)) {
                echo '
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
                    <h2>Invalid Verification Link</h2>
                    <p class="lead">The verification link you used is invalid or expired.</p>
                    <a href="/e-terminus/public/register.html" class="btn btn-primary mt-3">
                        <i class="fas fa-user-plus me-2"></i>Register Account
                    </a>
                </div>';
            } else {
                try {
                    $db = Database::getInstance();
                    
                    // Check if token exists and account isn't already verified
                    $stmt = $db->prepare("SELECT user_id FROM users WHERE verification_token = ? AND is_verified = 0");
                    $stmt->execute([$token]);
                    
                    if ($stmt->rowCount() > 0) {
                        // Verify the account
                        $updateStmt = $db->prepare("UPDATE users SET is_verified = 1, verification_token = NULL WHERE verification_token = ?");
                        $updateStmt->execute([$token]);
                        
                        echo '
                        <div class="text-center">
                            <i class="fas fa-check-circle text-success mb-3" style="font-size: 3rem;"></i>
                            <h2>Email Verified Successfully</h2>
                            <p class="lead">Your email address has been successfully verified.</p>
                            <p>You can now log in to your account.</p>
                            <a href="/e-terminus/public/login.html" class="btn btn-primary mt-3">
                                <i class="fas fa-sign-in-alt me-2"></i>Login Now
                            </a>
                        </div>';
                    } else {
                        echo '
                        <div class="text-center">
                            <i class="fas fa-exclamation-triangle text-warning mb-3" style="font-size: 3rem;"></i>
                            <h2>Verification Failed</h2>
                            <p class="lead">This verification link is invalid or has already been used.</p>
                            <p>If you haven\'t verified your account yet, please check your email for the verification link.</p>
                            <a href="/e-terminus/public/login.html" class="btn btn-primary mt-3">
                                <i class="fas fa-sign-in-alt me-2"></i>Try Logging In
                            </a>
                        </div>';
                    }
                } catch (PDOException $e) {
                    error_log("Verification Error: " . $e->getMessage());
                    echo '
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
                        <h2>Verification Error</h2>
                        <p class="lead">An error occurred during verification.</p>
                        <p>Please try again later or contact support if the problem persists.</p>
                        <div class="d-flex justify-content-center gap-2 mt-3">
                            <a href="/e-terminus/public/login.html" class="btn btn-outline-primary">
                                <i class="fas fa-sign-in-alt me-2"></i>Login
                            </a>
                            <a href="/e-terminus/public/register.html" class="btn btn-primary">
                                <i class="fas fa-user-plus me-2"></i>Register
                            </a>
                        </div>
                    </div>';
                }
            }
            ?>
        </div>
    </div>
</body>
</html>