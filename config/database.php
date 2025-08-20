<?php
class Database {
    private static $instance = null;
    private $conn;

    // Configurable properties
    private $host = 'localhost';
    private $db_name = 'e_terminus';
    private $username = 'root';
    private $password = '@Master78';

    // Private constructor to enforce singleton
    private function __construct() {
        $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4";

        try {
            $this->conn = new PDO($dsn, $this->username, $this->password, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_PERSISTENT         => true
            ]);

            // Test connection
            $this->conn->query("SELECT 1");

        } catch (PDOException $e) {
            error_log("Connection failed: " . $e->getMessage());
            throw new Exception("Database connection error. Please try again later.");
        }
    }

    // Public method to get the single shared connection
    public static function getInstance() {
        if (!self::$instance) {
            self::$instance = new Database();
        }
        return self::$instance->conn;
    }
}