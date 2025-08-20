<?php
// config/email.php
return [
    'host' => 'smtp.mail.yahoo.com',
    'port' => 465,                // Yahoo requires port 587 for TLS
    'username' => 'kasangula78@yahoo.com', // Your full Yahoo email
    'password' => 'jbnjieglvcmzwyez',          // Yahoo App Password (NOT your login password)
    'from_email' => 'kasangula78@yahoo.com', // Must match username
    'from_name' => 'E-Terminus Bus Services',
    'smtp_secure' => 'ssl',       // Yahoo requires TLS, not SSL
    'smtp_auth' => true,
    'debug' => 2,                 // Set to 2 for debugging, 0 for production
    'timeout' => 30               // Yahoo can be slow sometimes
];