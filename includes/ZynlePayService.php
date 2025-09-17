<?php
// includes/ZynlePayService.php

class ZynlePayService {
    private $baseUrl;
    private $merchantId;
    private $apiId;
    private $apiKey;
    
    public function __construct() {
        $this->baseUrl = ZYNLEPAY_BASE_URL;
        $this->merchantId = ZYNLEPAY_MERCHANT_ID;
        $this->apiId = ZYNLEPAY_API_ID;
        $this->apiKey = ZYNLEPAY_API_KEY;
    }
    
    /**
     * Generate a unique reference number
     * @return string Unique reference number
     */
    private function generateReferenceNumber() {
        // Use a combination of timestamp, random number, and a prefix
        return 'ET-' . time() . '-' . mt_rand(1000, 9999);
    }
    
    /**
     * Initiate a payment request
     * @param array $paymentData Payment details
     * @return array API response
     */
    public function initiatePayment($paymentData) {
        // Based on the sample code, we don't need to append '/payment' to the URL
        $url = $this->baseUrl;
        
        // Determine channel based on payment method
        $channel = 'momo'; // default for mobile money
        if ($paymentData['payment_method'] === 'card') {
            $channel = 'card';
        }
        
        // Convert amount to the smallest currency unit (ngwee for ZMW)
        $amountInSmallestUnit = (int)($paymentData['amount'] * 100);
        
        // Generate a unique reference number
        $referenceNo = $this->generateReferenceNumber();
        
        $payload = [
            'auth' => [
                'merchant_id' => $this->merchantId,
                'api_id' => $this->apiId,
                'api_key' => $this->apiKey,
                'channel' => $channel
            ],
            'data' => [
                'method' => 'runBillPayment',
                'sender_id' => $paymentData['customer_phone'],
                'reference_no' => $referenceNo,
                'amount' => (string)$amountInSmallestUnit
            ]
        ];
        
        // Log the request for debugging
        error_log("Zynle Pay Request URL: " . $url);
        error_log("Zynle Pay Request Payload: " . json_encode($payload));
        
        $response = $this->makeRequest('POST', $url, $payload);
        
        // Add the reference number to the response for tracking
        if ($response['success']) {
            $response['reference_no'] = $referenceNo;
        }
        
        return $response;
    }
    
    /**
     * Make HTTP request to Zynle Pay API
     * @param string $method HTTP method
     * @param string $url Request URL
     * @param array $data Request payload
     * @return array API response
     */
    private function makeRequest($method, $url, $data = []) {
        $ch = curl_init();
        
        $headers = [
            'Content-Type: application/json',
            'Accept: */*'
        ];
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 0);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        // Log the response for debugging
        error_log("Zynle Pay Response HTTP Code: " . $httpCode);
        error_log("Zynle Pay Response: " . $response);
        if ($error) {
            error_log("Zynle Pay CURL Error: " . $error);
        }
        
        if ($error) {
            return [
                'success' => false,
                'message' => 'CURL Error: ' . $error
            ];
        }
        
        $responseData = json_decode($response, true);
        
        // Check if JSON decoding failed
        if ($responseData === null) {
            return [
                'success' => false,
                'message' => 'Invalid JSON response: ' . $response
            ];
        }
        
        return [
            'success' => $httpCode >= 200 && $httpCode < 300,
            'status_code' => $httpCode,
            'data' => $responseData
        ];
    }
}