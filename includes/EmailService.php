<?php
// includes/EmailService.php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../vendor/autoload.php';

class EmailService {
    private $mailer;
    private $config;

    public function __construct() {
        $this->config = require __DIR__ . '/../config/email.php';

        $this->mailer = new PHPMailer(true);
        $this->mailer->isSMTP();
        $this->mailer->Host = $this->config['host'];
        $this->mailer->SMTPAuth = true;
        $this->mailer->Username = $this->config['username'];
        $this->mailer->Password = $this->config['password'];
        $this->mailer->SMTPSecure = $this->config['smtp_secure'];
        $this->mailer->Port = $this->config['port'];
        $this->mailer->CharSet = 'UTF-8';
        $this->mailer->isHTML(true);
    }

    /**
     * Test SMTP connection without sending email
     */
    public function testConnection() {
        try {
            if (!$this->mailer->smtpConnect()) {
                return false;
            }
            $this->mailer->smtpClose();
            return true;
        } catch (Exception $e) {
            error_log("SMTP Connection Test Failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send verification email
     */
    public function sendVerificationEmail($toEmail, $toName, $token) {
        try {
            $this->mailer->setFrom($this->config['username'], 'E-Terminus');
            $this->mailer->addAddress($toEmail, $toName);

            $this->mailer->Subject = 'Email Verification - E-Terminus';
             $verificationLink = "http://localhost/e-terminus/verify-email.php?token=" . urlencode($token);

            $this->mailer->Body = "
                <h2>Email Verification</h2>
                <p>Hello {$toName},</p>
                <p>Please verify your email by clicking the link below:</p>
                <p><a href='{$verificationLink}'>Verify Email</a></p>
                <p>If you did not sign up, please ignore this email.</p>
            ";

            return $this->mailer->send();
        } catch (Exception $e) {
            error_log("Email sending failed: " . $e->getMessage());
            return false;
        }
    }
}
