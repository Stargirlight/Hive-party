<?php
// Catch ALL errors before anything else
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display, we'll handle them
ini_set('log_errors', 1);

// Catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode([
            'error' => 'Fatal Error',
            'message' => $error['message'],
            'file' => $error['file'],
            'line' => $error['line']
        ]);
    }
});

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load environment variables
if (file_exists(__DIR__ . '/../.env')) {
    $lines = file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($key, $value) = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
        putenv(trim($key) . '=' . trim($value));
    }
}

// Start session
session_start();

// Get request path and method
$requestUri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];

// Parse the path correctly
// When .htaccess rewrites /api/orders to /api/index.php,
// we need to get the original path from REQUEST_URI
$parsedPath = parse_url($requestUri, PHP_URL_PATH);
$path = trim($parsedPath, '/');

// Remove /api/index.php if it appears in the path
$path = str_replace('api/index.php', '', $path);
$path = trim($path, '/');

// Parse JSON body for POST/PUT requests
$input = null;
if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $input = $_POST; // Fallback to form data
    }
}

// Helper function to send JSON response
function sendJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

// Error handling for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    sendJson([
        'error' => 'PHP Error',
        'message' => $errstr,
        'file' => $errfile,
        'line' => $errline
    ], 500);
});

// Include CSV storage and route handlers
try {
    require_once __DIR__ . '/db/csv_storage.php';
    require_once __DIR__ . '/routes/auth.php';
    require_once __DIR__ . '/routes/admin.php';
    require_once __DIR__ . '/routes/orders.php';
} catch (Exception $e) {
    sendJson([
        'error' => 'Failed to load dependencies',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], 500);
}

// Health check
if ($path === 'health' || $path === 'api/health') {
    sendJson([
        'status' => 'ok',
        'timestamp' => date('c'),
        'php_version' => PHP_VERSION,
        'storage' => 'csv'
    ]);
}

// Debug: Log the incoming request
error_log("REQUEST: $method $path");

// Route handling
if (strpos($path, 'api/auth') === 0) {
    handleAuthRoutes($path, $method, $input);
} elseif (strpos($path, 'api/admin') === 0) {
    handleAdminRoutes($path, $method, $input);
} elseif (strpos($path, 'api/orders') === 0) {
    handleOrderRoutes($path, $method, $input);
} else {
    // Debug: Show what path was received
    sendJson([
        'error' => 'Not found',
        'debug' => [
            'path' => $path,
            'method' => $method,
            'uri' => $_SERVER['REQUEST_URI']
        ]
    ], 404);
}
