<?php
// Authentication routes using CSV storage

function handleAuthRoutes($path, $method, $input) {
    $pathParts = explode('/', trim($path, '/'));
    $action = end($pathParts);

    if ($action === 'login' && $method === 'POST') {
        handleLogin($input);
    } elseif ($action === 'logout' && $method === 'POST') {
        handleLogout();
    } elseif ($action === 'status' && $method === 'GET') {
        handleAuthStatus();
    } else {
        sendJson(['error' => 'Not found'], 404);
    }
}

function handleLogin($input) {
    global $storage;

    $email = $input['email'] ?? null;
    $password = $input['password'] ?? null;

    if (!$email || !$password) {
        sendJson([
            'success' => false,
            'error' => 'Email and password are required'
        ], 400);
    }

    // Find admin
    $admin = $storage->findOne('admins', ['email' => strtolower($email)]);

    if (!$admin) {
        sendJson([
            'success' => false,
            'error' => 'Invalid email or password'
        ], 401);
    }

    // Check if admin is active
    if (empty($admin['isActive']) || $admin['isActive'] !== '1') {
        sendJson([
            'success' => false,
            'error' => 'Account is disabled. Please contact system administrator.'
        ], 403);
    }

    // Verify password
    if (!password_verify($password, $admin['password'])) {
        sendJson([
            'success' => false,
            'error' => 'Invalid email or password'
        ], 401);
    }

    // Update last login
    $storage->update('admins',
        ['id' => $admin['id']],
        ['last_login' => date('Y-m-d H:i:s')]
    );

    // Create session
    $_SESSION['adminId'] = $admin['id'];
    $_SESSION['adminEmail'] = $admin['email'];
    $_SESSION['adminName'] = $admin['name'];
    $_SESSION['adminRole'] = $admin['role'] ?? 'admin';

    // Create JWT token
    $jwtSecret = getenv('JWT_SECRET') ?: 'hive-party-jwt-secret-change-in-production';
    $token = createJWT([
        'adminId' => $admin['id'],
        'email' => $admin['email'],
        'name' => $admin['name'],
        'role' => $admin['role'] ?? 'admin'
    ], $jwtSecret);

    // Set cookie
    setcookie('authToken', $token, [
        'expires' => time() + (7 * 24 * 60 * 60),
        'path' => '/',
        'httponly' => true,
        'secure' => (getenv('NODE_ENV') === 'production'),
        'samesite' => 'Lax'
    ]);

    sendJson([
        'success' => true,
        'admin' => [
            'id' => $admin['id'],
            'email' => $admin['email'],
            'name' => $admin['name'],
            'role' => $admin['role'] ?? 'admin'
        ]
    ]);
}

function handleLogout() {
    session_destroy();

    setcookie('authToken', '', [
        'expires' => time() - 3600,
        'path' => '/',
    ]);

    sendJson([
        'success' => true,
        'message' => 'Logged out successfully'
    ]);
}

function handleAuthStatus() {
    // Check JWT token
    if (isset($_COOKIE['authToken'])) {
        $jwtSecret = getenv('JWT_SECRET') ?: 'hive-party-jwt-secret-change-in-production';
        $decoded = verifyJWT($_COOKIE['authToken'], $jwtSecret);

        if ($decoded) {
            sendJson([
                'authenticated' => true,
                'admin' => [
                    'id' => $decoded['adminId'],
                    'email' => $decoded['email'],
                    'name' => $decoded['name'],
                    'role' => $decoded['role']
                ]
            ]);
        }
    }

    // Fallback to session
    if (isset($_SESSION['adminId'])) {
        sendJson([
            'authenticated' => true,
            'admin' => [
                'id' => $_SESSION['adminId'],
                'email' => $_SESSION['adminEmail'],
                'name' => $_SESSION['adminName'],
                'role' => $_SESSION['adminRole']
            ]
        ]);
    }

    sendJson(['authenticated' => false]);
}

// Middleware to check authentication
function requireAuth() {
    // Check JWT token
    if (isset($_COOKIE['authToken'])) {
        $jwtSecret = getenv('JWT_SECRET') ?: 'hive-party-jwt-secret-change-in-production';
        $decoded = verifyJWT($_COOKIE['authToken'], $jwtSecret);

        if ($decoded) {
            return [
                'id' => $decoded['adminId'],
                'email' => $decoded['email'],
                'name' => $decoded['name'],
                'role' => $decoded['role']
            ];
        }
    }

    // Fallback to session
    if (isset($_SESSION['adminId'])) {
        return [
            'id' => $_SESSION['adminId'],
            'email' => $_SESSION['adminEmail'],
            'name' => $_SESSION['adminName'],
            'role' => $_SESSION['adminRole']
        ];
    }

    sendJson([
        'success' => false,
        'error' => 'Authentication required'
    ], 401);
}

// Simple JWT creation
function createJWT($payload, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload['exp'] = time() + (7 * 24 * 60 * 60);
    $payload = json_encode($payload);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

// Simple JWT verification
function verifyJWT($jwt, $secret) {
    $tokenParts = explode('.', $jwt);
    if (count($tokenParts) !== 3) {
        return false;
    }

    list($header, $payload, $signature) = $tokenParts;

    $validSignature = hash_hmac('sha256', $header . "." . $payload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($validSignature));

    if ($signature !== $base64UrlSignature) {
        return false;
    }

    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);

    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return false;
    }

    return $payload;
}
