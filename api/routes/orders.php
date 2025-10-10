<?php
// Order routes using CSV storage

function handleOrderRoutes($path, $method, $input) {
    // Remove empty parts from path
    $pathParts = array_filter(explode('/', trim($path, '/')), function($part) {
        return $part !== '';
    });
    $pathParts = array_values($pathParts); // Re-index array

    // Create new order: POST /api/orders
    if (count($pathParts) === 2 && $method === 'POST') {
        createOrder($input);
    }
    // Get order by order number: GET /api/orders/{orderNumber}
    elseif (count($pathParts) === 3 && $method === 'GET' && strpos($pathParts[2], 'HP') === 0) {
        getOrderByNumber($pathParts[2]);
    }
    // Upload payment proof: POST /api/orders/{orderId}/upload-proof
    elseif (count($pathParts) === 4 && $pathParts[3] === 'upload-proof' && $method === 'POST') {
        uploadPaymentProof($pathParts[2]);
    }
    // Get user orders: GET /api/orders/user/{email}
    elseif (count($pathParts) === 4 && $pathParts[2] === 'user' && $method === 'GET') {
        getUserOrders($pathParts[3]);
    }
    else {
        // Debug: Show what we received
        sendJson([
            'error' => 'Not found',
            'debug' => [
                'path' => $path,
                'pathParts' => $pathParts,
                'partCount' => count($pathParts),
                'method' => $method,
                'input' => $input
            ]
        ], 404);
    }
}

function createOrder($input) {
    global $storage;

    // Debug: Log that we reached this function
    error_log("createOrder called with input: " . json_encode($input));

    if (!isset($storage)) {
        sendJson([
            'success' => false,
            'error' => 'Storage not initialized',
            'debug' => 'The $storage global variable is not set'
        ], 500);
    }

    $email = $input['email'] ?? null;
    $name = $input['name'] ?? null;
    $phone = $input['phone'] ?? null;
    $ticketType = $input['ticketType'] ?? null;
    $quantity = $input['quantity'] ?? null;
    $pricePerTicket = $input['pricePerTicket'] ?? null;

    // Validate input
    $errors = validateOrderData($input);
    if (!empty($errors)) {
        sendJson([
            'success' => false,
            'error' => 'Validation failed',
            'details' => $errors
        ], 400);
    }

    // Sanitize input
    $sanitizedName = sanitizeString($name);
    $sanitizedEmail = strtolower(trim($email));

    // Find or create user
    $user = findOrCreateUser($sanitizedEmail, $sanitizedName, $phone);

    // Generate order number
    $orderNumber = 'HP' . strtoupper(uniqid());

    // Calculate total
    $total = floatval($pricePerTicket) * intval($quantity);

    // Create order
    $orderData = [
        'user_id' => $user['id'],
        'user_email' => $sanitizedEmail,
        'user_name' => $sanitizedName,
        'order_number' => $orderNumber,
        'ticket_type' => $ticketType,
        'quantity' => intval($quantity),
        'price_per_ticket' => floatval($pricePerTicket),
        'total_amount' => $total,
        'status' => 'pending_payment',
        'expires_at' => date('Y-m-d H:i:s', time() + 24 * 60 * 60), // 24 hours
        'payment_proof_file' => '',
        'admin_notes' => '',
        'decline_reason' => ''
    ];

    $orderId = $storage->insert('orders', $orderData);
    $orderData['id'] = $orderId;

    // Send confirmation email (uncomment when email is configured)
    // if (file_exists(__DIR__ . '/../config/email.php')) {
    //     require_once __DIR__ . '/../config/email.php';
    //     sendOrderConfirmationEmail($orderData);
    //     notifyAdminNewOrder($orderData);
    // }

    sendJson([
        'success' => true,
        'order' => formatOrderForResponse($orderData)
    ], 201);
}

function getOrderByNumber($orderNumber) {
    global $storage;

    $order = $storage->findOne('orders', ['order_number' => $orderNumber]);

    if (!$order) {
        sendJson(['error' => 'Order not found'], 404);
    }

    sendJson(formatOrderForResponse($order));
}

function uploadPaymentProof($orderId) {
    global $storage;

    // Check if file was uploaded
    if (!isset($_FILES['paymentProof']) || $_FILES['paymentProof']['error'] !== UPLOAD_ERR_OK) {
        sendJson([
            'success' => false,
            'error' => 'No file uploaded'
        ], 400);
    }

    $file = $_FILES['paymentProof'];

    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!in_array($file['type'], $allowedTypes)) {
        sendJson([
            'success' => false,
            'error' => 'Only image files (JPEG, PNG) and PDF are allowed'
        ], 400);
    }

    // Validate file size (5MB max)
    if ($file['size'] > 5 * 1024 * 1024) {
        sendJson([
            'success' => false,
            'error' => 'File size must be less than 5MB'
        ], 400);
    }

    // Get order
    $order = $storage->findOne('orders', ['id' => $orderId]);

    if (!$order) {
        sendJson([
            'success' => false,
            'error' => 'Order not found'
        ], 404);
    }

    if ($order['status'] !== 'pending_payment') {
        sendJson([
            'success' => false,
            'error' => 'Cannot upload proof for this order. Status: ' . $order['status']
        ], 400);
    }

    // Check if expired
    if (!empty($order['expires_at']) && strtotime($order['expires_at']) < time()) {
        $storage->update('orders', ['id' => $orderId], ['status' => 'expired']);
        sendJson([
            'success' => false,
            'error' => 'Order has expired'
        ], 400);
    }

    // Save file to uploads directory
    $uploadsDir = __DIR__ . '/../../data/uploads';
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0755, true);
    }

    $fileExtension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $newFileName = $orderId . '_' . time() . '.' . $fileExtension;
    $targetPath = $uploadsDir . '/' . $newFileName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        sendJson([
            'success' => false,
            'error' => 'Failed to save file'
        ], 500);
    }

    // Update order
    $storage->update('orders',
        ['id' => $orderId],
        [
            'payment_proof_file' => $newFileName,
            'status' => 'pending_verification'
        ]
    );

    // Send notification email (uncomment when email is configured)
    // if (file_exists(__DIR__ . '/../config/email.php')) {
    //     require_once __DIR__ . '/../config/email.php';
    //     notifyAdminPaymentProof($order);
    // }

    sendJson([
        'success' => true,
        'message' => 'Payment proof uploaded successfully. Your payment is under review.'
    ]);
}

function getUserOrders($email) {
    global $storage;

    $user = $storage->findOne('users', ['email' => $email]);

    if (!$user) {
        sendJson([]);
    }

    $orders = $storage->find('orders', ['user_id' => $user['id']]);

    // Sort by created_at descending
    usort($orders, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });

    $formattedOrders = array_map('formatOrderForResponse', $orders);
    sendJson($formattedOrders);
}

// Helper functions

function validateOrderData($data) {
    $errors = [];

    if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Valid email is required';
    }

    if (empty($data['name']) || strlen($data['name']) < 2) {
        $errors['name'] = 'Name must be at least 2 characters';
    }

    if (empty($data['phone'])) {
        $errors['phone'] = 'Phone number is required';
    }

    if (empty($data['ticketType'])) {
        $errors['ticketType'] = 'Ticket type is required';
    }

    if (empty($data['quantity']) || intval($data['quantity']) < 1) {
        $errors['quantity'] = 'Quantity must be at least 1';
    }

    if (empty($data['pricePerTicket']) || floatval($data['pricePerTicket']) <= 0) {
        $errors['pricePerTicket'] = 'Price per ticket must be greater than 0';
    }

    return $errors;
}

function sanitizeString($str) {
    return htmlspecialchars(trim($str), ENT_QUOTES, 'UTF-8');
}

function findOrCreateUser($email, $name, $phone) {
    global $storage;

    $user = $storage->findOne('users', ['email' => $email]);

    if ($user) {
        return $user;
    }

    // Create new user
    $userData = [
        'email' => $email,
        'name' => $name,
        'phone' => $phone
    ];

    $userId = $storage->insert('users', $userData);
    $userData['id'] = $userId;

    return $userData;
}

function formatOrderForResponse($order) {
    return [
        'id' => $order['id'] ?? null,
        'orderNumber' => $order['order_number'] ?? null,
        'userId' => $order['user_id'] ?? null,
        'userEmail' => $order['user_email'] ?? null,
        'userName' => $order['user_name'] ?? null,
        'ticketType' => $order['ticket_type'] ?? null,
        'quantity' => isset($order['quantity']) ? intval($order['quantity']) : 0,
        'pricePerTicket' => isset($order['price_per_ticket']) ? floatval($order['price_per_ticket']) : 0,
        'totalAmount' => isset($order['total_amount']) ? floatval($order['total_amount']) : 0,
        'status' => $order['status'] ?? 'pending',
        'createdAt' => $order['created_at'] ?? date('Y-m-d H:i:s'),
        'expiresAt' => $order['expires_at'] ?? null,
        'hasPaymentProof' => !empty($order['payment_proof_file']),
        'adminNotes' => $order['admin_notes'] ?? '',
        'declineReason' => $order['decline_reason'] ?? ''
    ];
}
