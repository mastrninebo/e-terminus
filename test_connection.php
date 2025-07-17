<?php
require_once 'config/database.php';

try {
    $database = new Database();
    $db = $database->connect();
    
    echo "<h2>✅ Connection Successful!</h2>";
    echo "<p>Database: e_terminus</p>";
    
    // Test a query
    $stmt = $db->query("SHOW TABLES");
    $tables = $stmt->fetchAll();
    
    echo "<h3>Tables in database:</h3>";
    echo "<ul>";
    foreach($tables as $table) {
        echo "<li>" . $table['Tables_in_e_terminus'] . "</li>";
    }
    echo "</ul>";

} catch(Exception $e) {
    echo "<h2>❌ Connection Failed</h2>";
    echo "<p><strong>Error:</strong> " . $e->getMessage() . "</p>";
    echo "<h3>Troubleshooting:</h3>";
    echo "<ol>
        <li>Verify MySQL server is running</li>
        <li>Check credentials in config/database.php</li>
        <li>Ensure user has proper permissions</li>
    </ol>";
}
?>