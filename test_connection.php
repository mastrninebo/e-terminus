<?php
require_once 'config/database.php'; // Adjust path if needed

try {
    $db = Database::getInstance();
    echo "✅ Connection successful!<br><br>";

    $tables = $db->query("SHOW TABLES")->fetchAll();

    echo "<strong>Tables in the database:</strong><br>";
    foreach ($tables as $table) {
        echo "- " . array_values($table)[0] . "<br>";
    }

} catch (Exception $e) {
    die("❌ Connection failed: " . $e->getMessage());
}
?>
