<?php
// config/zynlepay.php

// Zynle Pay Sandbox Configuration
define('ZYNLEPAY_BASE_URL', 'https://sandbox.zynlepay.com/zynlepay/jsonapi');
define('ZYNLEPAY_MERCHANT_ID', 'MEC01125');
define('ZYNLEPAY_API_ID', 'eada1103-2273-4a80-80ff-61b7e4e02969');
define('ZYNLEPAY_API_KEY', 'ef785070-dddb-488b-8ffc-e317e2fdce88');

// Current ngrok domain and path
$currentNgrokDomain = '38f8451b5f66.ngrok-free.app';
$basePath = '/e-terminus'; // Include the subdirectory path

// Callback URLs using your current ngrok domain and path
define('ZYNLEPAY_MOBILE_MONEY_CALLBACK_URL', 'https://' . $currentNgrokDomain . $basePath . '/api/payments/zynle_callback.php');
define('ZYNLEPAY_CARD_CALLBACK_URL', 'https://' . $currentNgrokDomain . $basePath . '/api/payments/zynle_callback.php');
define('ZYNLEPAY_WALLET_TO_BANK_CALLBACK_URL', 'https://' . $currentNgrokDomain . $basePath . '/api/payments/zynle_callback.php');

// Success and fail URLs
define('ZYNLEPAY_SUCCESS_URL', 'https://' . $currentNgrokDomain . $basePath . '/payment-success.html');
define('ZYNLEPAY_FAIL_URL', 'https://' . $currentNgrokDomain . $basePath . '/payment-failed.html');