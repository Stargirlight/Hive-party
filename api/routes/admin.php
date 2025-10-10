<?php
// Admin routes using CSV storage

function handleAdminRoutes($path, $method, $input) {
    // Check authentication
    $admin = requireAuth();

    $pathParts = explode('/', trim($path, '/'));

    // Get dashboard stats: GET /api/admin/stats
    if (end($pathParts) === 'stats' && $method === 'GET') {
        getAdminStats();
    }
    // Get all orders: GET /api/admin/orders
    elseif (end($pathParts) === 'orders' && $method === 'GET' && count($pathParts) === 3) {
        getAllOrders();
    }
    // Get pending orders: GET /api/admin/pending-orders
    elseif (end($pathParts) === 'pending-orders' && $method === 'GET') {
        getPendingOrders();
    }
    // Get single order: GET /api/admin/orders/{orderId}
    elseif ($pathParts[2] === 'orders' && count($pathParts) === 4 && $method === 'GET') {
        getOrderById($pathParts[3]);
    }
    // Approve order: POST /api/admin/orders/{orderId}/approve
    elseif ($pathParts[2] === 'orders' && count($pathParts) === 5 && $pathParts[4] === 'approve' && $method === 'POST') {
        approveOrder($pathParts[3], $input, $admin);
    }
    // Decline order: POST /api/admin/orders/{orderId}/decline
    elseif ($pathParts[2] === 'orders' && count($pathParts) === 5 && $pathParts[4] === 'decline' && $method === 'POST') {
        declineOrder($pathParts[3], $input, $admin);
    }
    // Get audit log: GET /api/admin/audit-log
    elseif (end($pathParts) === 'audit-log' && $method === 'GET') {
        getAuditLog();
    }
    else {
        sendJson(['error' => 'Not found'], 404);
    }
}

function getAdminStats() {
    global $storage;

    $allOrders = $storage->findAll('orders');

    $pending = 0;
    $approved = 0;
    $revenue = 0;

    foreach ($allOrders as $order) {
        if (in_array($order['status'], ['pending_verification', 'pending_payment'])) {
            $pending++;
        } elseif ($order['status'] === 'approved') {
            $approved++;
            $revenue += floatval($order['total_amount']);
        }
    }

    // Count active tickets
    $ticketsSold = $storage->count('tickets', ['status' => 'active']);

    sendJson([
        'pending' => $pending,
        'approved' => $approved,
        'revenue' => $revenue,
        'ticketsSold' => $ticketsSold
    ]);
}

function getAllOrders() {
    global $storage;

    $orders = $storage->findAll('orders');

    // Sort by created_at descending
    usort($orders, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });

    $formattedOrders = array_map('formatOrderForResponse', $orders);
    sendJson($formattedOrders);
}

function getPendingOrders() {
    global $storage;

    $allOrders = $storage->findAll('orders');

    $pendingOrders = array_filter($allOrders, function($order) {
        return in_array($order['status'], ['pending_verification', 'pending_payment']);
    });

    // Sort by created_at descending
    usort($pendingOrders, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });

    $formattedOrders = array_map('formatOrderForResponse', array_values($pendingOrders));
    sendJson($formattedOrders);
}

function getOrderById($orderId) {
    global $storage;

    $order = $storage->findOne('orders', ['id' => $orderId]);

    if (!$order) {
        sendJson(['error' => 'Order not found'], 404);
    }

    // Add payment proof URL if available
    $orderData = formatOrderForResponse($order);

    if (!empty($order['payment_proof_file'])) {
        $orderData['paymentProofUrl'] = '/data/uploads/' . $order['payment_proof_file'];
    }

    sendJson($orderData);
}

function approveOrder($orderId, $input, $admin) {
    global $storage;

    $adminNotes = $input['adminNotes'] ?? '';

    // Get order
    $order = $storage->findOne('orders', ['id' => $orderId]);

    if (!$order) {
        sendJson(['error' => 'Order not found'], 404);
    }

    if (!in_array($order['status'], ['pending_verification', 'pending_payment'])) {
        sendJson(['error' => 'Order cannot be approved'], 400);
    }

    // Update order status
    $storage->update('orders',
        ['id' => $orderId],
        [
            'status' => 'approved',
            'admin_notes' => $adminNotes,
            'approved_at' => date('Y-m-d H:i:s')
        ]
    );

    // Generate tickets
    $ticketsGenerated = 0;
    for ($i = 0; $i < intval($order['quantity']); $i++) {
        $ticketNumber = 'TKT' . strtoupper(uniqid());

        $ticketData = [
            'order_id' => $orderId,
            'order_number' => $order['order_number'],
            'ticket_number' => $ticketNumber,
            'ticket_type' => $order['ticket_type'],
            'user_name' => $order['user_name'],
            'user_email' => $order['user_email'],
            'status' => 'active',
            'scanned' => '0',
            'scanned_at' => ''
        ];

        $storage->insert('tickets', $ticketData);
        $ticketsGenerated++;
    }

    // Log admin action
    logAdminAction($admin, 'approve_order', 'order', $orderId, [
        'ticketsGenerated' => $ticketsGenerated,
        'orderNumber' => $order['order_number']
    ]);

    // Send ticket email (uncomment when email is configured)
    // if (file_exists(__DIR__ . '/../config/email.php')) {
    //     require_once __DIR__ . '/../config/email.php';
    //     sendTicketEmail($order, []);
    // }

    sendJson([
        'success' => true,
        'message' => 'Order approved and tickets generated',
        'ticketsGenerated' => $ticketsGenerated
    ]);
}

function declineOrder($orderId, $input, $admin) {
    global $storage;

    $reason = $input['reason'] ?? 'Not specified';

    // Get order
    $order = $storage->findOne('orders', ['id' => $orderId]);

    if (!$order) {
        sendJson(['error' => 'Order not found'], 404);
    }

    if (!in_array($order['status'], ['pending_verification', 'pending_payment'])) {
        sendJson(['error' => 'Order cannot be declined'], 400);
    }

    // Update order status
    $storage->update('orders',
        ['id' => $orderId],
        [
            'status' => 'declined',
            'decline_reason' => $reason,
            'declined_at' => date('Y-m-d H:i:s')
        ]
    );

    // Log admin action
    logAdminAction($admin, 'decline_order', 'order', $orderId, [
        'reason' => $reason,
        'orderNumber' => $order['order_number']
    ]);

    // Send rejection email (uncomment when email is configured)
    // if (file_exists(__DIR__ . '/../config/email.php')) {
    //     require_once __DIR__ . '/../config/email.php';
    //     sendRejectionEmail($order, $reason);
    // }

    sendJson([
        'success' => true,
        'message' => 'Order declined'
    ]);
}

function getAuditLog() {
    global $storage;

    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;

    $logs = $storage->findAll('adminactions');

    // Sort by timestamp descending
    usort($logs, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });

    // Limit results
    $logs = array_slice($logs, 0, $limit);

    $formattedLogs = [];
    foreach ($logs as $log) {
        $metadata = [];

        // Parse metadata fields
        foreach ($log as $key => $value) {
            if (strpos($key, 'meta_') === 0) {
                $metadata[substr($key, 5)] = $value;
            }
        }

        $formattedLogs[] = [
            'id' => $log['id'],
            'adminId' => $log['admin_id'] ?? '',
            'adminEmail' => $log['admin_email'] ?? '',
            'action' => $log['action'] ?? '',
            'targetType' => $log['target_type'] ?? '',
            'targetId' => $log['target_id'] ?? '',
            'metadata' => $metadata,
            'timestamp' => $log['created_at']
        ];
    }

    sendJson($formattedLogs);
}

function logAdminAction($admin, $action, $targetType, $targetId, $metadata = []) {
    global $storage;

    $actionData = [
        'admin_id' => $admin['id'],
        'admin_email' => $admin['email'],
        'action' => $action,
        'target_type' => $targetType,
        'target_id' => $targetId
    ];

    // Add metadata fields
    foreach ($metadata as $key => $value) {
        $actionData['meta_' . $key] = is_array($value) ? json_encode($value) : $value;
    }

    $storage->insert('adminactions', $actionData);
}
