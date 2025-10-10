<?php
// Absolute minimal test - no dependencies
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => 'Simple PHP test working',
    'timestamp' => date('Y-m-d H:i:s')
]);
