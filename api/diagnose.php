<?php
// Diagnostic script to find the error
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain');

echo "=== PHP Diagnostic Test ===\n\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Current directory: " . __DIR__ . "\n\n";

// Test 1: Check if files exist
echo "--- File Existence Check ---\n";
$files = [
    'index.php',
    'db/csv_storage.php',
    'db/connection.php',
    'routes/auth.php',
    'routes/orders.php',
    'routes/admin.php'
];

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    echo "$file: " . (file_exists($path) ? "EXISTS" : "MISSING") . "\n";
}

echo "\n--- Trying to load csv_storage.php ---\n";
try {
    require_once __DIR__ . '/db/csv_storage.php';
    echo "✓ csv_storage.php loaded successfully\n";
    echo "✓ Storage object created: " . (isset($storage) ? "YES" : "NO") . "\n";
} catch (Exception $e) {
    echo "✗ Error loading csv_storage.php:\n";
    echo "  " . $e->getMessage() . "\n";
    echo "  File: " . $e->getFile() . "\n";
    echo "  Line: " . $e->getLine() . "\n";
}

echo "\n--- Trying to load routes ---\n";
try {
    require_once __DIR__ . '/routes/auth.php';
    echo "✓ auth.php loaded\n";
} catch (Exception $e) {
    echo "✗ Error loading auth.php: " . $e->getMessage() . "\n";
}

try {
    require_once __DIR__ . '/routes/orders.php';
    echo "✓ orders.php loaded\n";
} catch (Exception $e) {
    echo "✗ Error loading orders.php: " . $e->getMessage() . "\n";
}

try {
    require_once __DIR__ . '/routes/admin.php';
    echo "✓ admin.php loaded\n";
} catch (Exception $e) {
    echo "✗ Error loading admin.php: " . $e->getMessage() . "\n";
}

echo "\n--- Data Directory Check ---\n";
$dataDir = __DIR__ . '/../data';
echo "Data directory path: $dataDir\n";
echo "Exists: " . (is_dir($dataDir) ? "YES" : "NO") . "\n";
if (is_dir($dataDir)) {
    echo "Writable: " . (is_writable($dataDir) ? "YES" : "NO") . "\n";
    echo "Permissions: " . substr(sprintf('%o', fileperms($dataDir)), -4) . "\n";
}

echo "\n=== End Diagnostic ===\n";
