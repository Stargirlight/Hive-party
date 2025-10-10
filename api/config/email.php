<?php
// Email configuration

// Email settings
define('SMTP_HOST', 'mail.ebiperre.tech');
define('SMTP_PORT', 465); // SSL port
define('SMTP_USERNAME', 'test@ebiperre.tech');
define('SMTP_PASSWORD', ''); // TODO: Add your email password here
define('SMTP_FROM_EMAIL', 'test@ebiperre.tech');
define('SMTP_FROM_NAME', 'Hive Party');
define('ADMIN_EMAIL', 'test@ebiperre.tech');

// Email enabled flag - set to true after adding password above
define('EMAIL_ENABLED', true); // Emails are enabled

/**
 * Send email using SMTP socket connection
 */
function sendEmail($to, $subject, $htmlBody, $textBody = '') {
    // Check if email is enabled
    if (!EMAIL_ENABLED) {
        error_log("Email not sent (EMAIL_ENABLED=false): To: $to, Subject: $subject");
        return false;
    }

    // Check if password is set
    if (empty(SMTP_PASSWORD)) {
        error_log("Email not sent: SMTP_PASSWORD is empty");
        return false;
    }

    // Validate email address
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        error_log("Invalid email address: $to");
        return false;
    }

    // Log email attempt
    error_log("Attempting to send email to: $to, subject: $subject");

    try {
        // Connect to SMTP server with SSL
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        $smtp = stream_socket_client(
            'ssl://' . SMTP_HOST . ':' . SMTP_PORT,
            $errno,
            $errstr,
            30,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if (!$smtp) {
            error_log("SMTP connection failed: $errstr ($errno)");
            return false;
        }

        // Read server greeting (220)
        $response = '';
        while (true) {
            $line = fgets($smtp, 515);
            $response .= $line;
            error_log("Greeting: " . trim($line));
            // Stop when we get a line that doesn't start with "220-"
            if (substr($line, 0, 4) !== '220-') {
                break;
            }
        }

        // Send EHLO
        fputs($smtp, "EHLO " . SMTP_HOST . "\r\n");

        // Read all EHLO responses (250 or 250-)
        $response = '';
        while (true) {
            $line = fgets($smtp, 515);
            $response .= $line;
            error_log("EHLO: " . trim($line));
            // Stop when we get "250 " (with space, not dash)
            if (substr($line, 0, 4) === '250 ') {
                break;
            }
        }

        // Send AUTH LOGIN
        fputs($smtp, "AUTH LOGIN\r\n");
        $response = fgets($smtp, 515);
        error_log("AUTH LOGIN response: " . trim($response));

        // Should get "334 VXNlcm5hbWU6" (asking for username)
        if (substr($response, 0, 3) !== '334') {
            error_log("AUTH LOGIN failed, expected 334, got: $response");
            fclose($smtp);
            return false;
        }

        // Send username (base64 encoded)
        fputs($smtp, base64_encode(SMTP_USERNAME) . "\r\n");
        $response = fgets($smtp, 515);
        error_log("Username response: " . trim($response));

        // Should get "334 UGFzc3dvcmQ6" (asking for password)
        if (substr($response, 0, 3) !== '334') {
            error_log("Username failed, expected 334, got: $response");
            fclose($smtp);
            return false;
        }

        // Send password (base64 encoded)
        fputs($smtp, base64_encode(SMTP_PASSWORD) . "\r\n");
        $response = fgets($smtp, 515);
        error_log("Password response: " . trim($response));

        // Should get "235" (authentication successful)
        if (substr($response, 0, 3) !== '235') {
            error_log("Authentication failed, expected 235, got: $response");
            fclose($smtp);
            return false;
        }

        error_log("Authentication successful!");

        // Send MAIL FROM
        fputs($smtp, "MAIL FROM: <" . SMTP_FROM_EMAIL . ">\r\n");
        $response = fgets($smtp, 515);
        error_log("MAIL FROM: $response");

        // Send RCPT TO
        fputs($smtp, "RCPT TO: <$to>\r\n");
        $response = fgets($smtp, 515);
        error_log("RCPT TO: $response");

        // Send DATA
        fputs($smtp, "DATA\r\n");
        $response = fgets($smtp, 515);
        error_log("DATA: $response");

        // Build email headers with base64 encoding to avoid line length issues
        $headers = "From: " . SMTP_FROM_NAME . " <" . SMTP_FROM_EMAIL . ">\r\n";
        $headers .= "Reply-To: " . SMTP_FROM_EMAIL . "\r\n";
        $headers .= "To: $to\r\n";
        $headers .= "Subject: $subject\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "Content-Transfer-Encoding: base64\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
        $headers .= "\r\n";

        // Encode body in base64 and chunk to 76 characters per line
        $encodedBody = chunk_split(base64_encode($htmlBody), 76, "\r\n");

        // Send headers and body
        fputs($smtp, $headers . $encodedBody . "\r\n.\r\n");
        $response = fgets($smtp, 515);
        error_log("SEND: $response");

        // Send QUIT
        fputs($smtp, "QUIT\r\n");
        fclose($smtp);

        if (substr($response, 0, 3) === '250') {
            error_log("Email sent successfully to: $to");
            return true;
        } else {
            error_log("Failed to send email: $response");
            return false;
        }
    } catch (Exception $e) {
        error_log("Email exception: " . $e->getMessage());
        return false;
    }
}

/**
 * Send order confirmation email
 */
function sendOrderConfirmationEmail($order) {
    $subject = "Order Confirmation - {$order['order_number']}";
    $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                h2 { color: #da3f08; }
                .info-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class='container'>
                <h2>Thank you for your order! 🎉</h2>
                <p>Dear {$order['user_name']},</p>
                <p>Your order has been created successfully.</p>

                <div class='info-box'>
                    <h3>Order Details:</h3>
                    <ul>
                        <li><strong>Order Number:</strong> {$order['order_number']}</li>
                        <li><strong>Ticket Type:</strong> " . ucfirst($order['ticket_type']) . "</li>
                        <li><strong>Quantity:</strong> {$order['quantity']}</li>
                        <li><strong>Total Amount:</strong> ₦" . number_format($order['total_amount']) . "</li>
                    </ul>
                </div>

                <h3>Payment Instructions:</h3>
                <p>Please make payment to:</p>
                <div class='info-box'>
                    <p><strong>Account Details:</strong><br>
                    Bank: [Your Bank Name]<br>
                    Account Number: [Your Account Number]<br>
                    Account Name: [Your Account Name]<br>
                    <strong>Reference:</strong> {$order['order_number']}</p>
                </div>

                <p>After payment, please upload your proof of payment on our website.</p>
                <p><strong>Order expires in 24 hours:</strong> {$order['expires_at']}</p>

                <div class='footer'>
                    <p>This is an automated email from Hive Party. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
    ";

    return sendEmail($order['user_email'], $subject, $body);
}

/**
 * Send ticket email after approval
 */
function sendTicketEmail($order, $tickets) {
    $subject = "Your Hive Party Tickets - {$order['order_number']}";

    $ticketsList = '';
    if (!empty($tickets)) {
        foreach ($tickets as $ticket) {
            $ticketsList .= "<li>{$ticket['ticket_number']}</li>";
        }
    } else {
        $ticketsList = "<li>View your tickets in your email or download from our website</li>";
    }

    $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                h2 { color: #da3f08; }
                .info-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='success'>
                    <h2>Your tickets are ready! 🎉</h2>
                </div>

                <p>Dear {$order['user_name']},</p>
                <p>Your payment has been approved and your tickets are now active!</p>

                <div class='info-box'>
                    <h3>Order Details:</h3>
                    <ul>
                        <li><strong>Order Number:</strong> {$order['order_number']}</li>
                        <li><strong>Ticket Type:</strong> " . ucfirst($order['ticket_type']) . "</li>
                        <li><strong>Quantity:</strong> {$order['quantity']}</li>
                    </ul>
                </div>

                <div class='info-box'>
                    <h3>Your Ticket Numbers:</h3>
                    <ul>
                        $ticketsList
                    </ul>
                </div>

                <p><strong>Important:</strong> Please present your ticket QR codes at the event entrance.</p>
                <p>You can view and download your tickets from our website.</p>

                <p style='font-size: 18px; margin-top: 30px;'>See you at Hive Party! 🎊</p>

                <div class='footer'>
                    <p>This is an automated email from Hive Party. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
    ";

    return sendEmail($order['user_email'], $subject, $body);
}

/**
 * Send order rejection email
 */
function sendRejectionEmail($order, $reason) {
    $subject = "Order Update - {$order['order_number']}";
    $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                h2 { color: #da3f08; }
                .info-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 5px; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class='container'>
                <h2>Order Status Update</h2>

                <p>Dear {$order['user_name']},</p>

                <div class='warning'>
                    <p>We're sorry, but your order <strong>{$order['order_number']}</strong> could not be approved.</p>
                </div>

                <div class='info-box'>
                    <p><strong>Reason:</strong> {$reason}</p>
                </div>

                <p>If you believe this is an error or have any questions, please contact us:</p>
                <ul>
                    <li>Email: " . ADMIN_EMAIL . "</li>
                    <li>Reference your order number: {$order['order_number']}</li>
                </ul>

                <div class='footer'>
                    <p>This is an automated email from Hive Party. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
    ";

    return sendEmail($order['user_email'], $subject, $body);
}

/**
 * Notify admin of new order
 */
function notifyAdminNewOrder($order) {
    $subject = "New Order Received - {$order['order_number']}";
    $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                h2 { color: #da3f08; }
                .info-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class='container'>
                <h2>📦 New Order Notification</h2>

                <p>A new order has been placed:</p>

                <div class='info-box'>
                    <ul>
                        <li><strong>Order Number:</strong> {$order['order_number']}</li>
                        <li><strong>Customer:</strong> {$order['user_name']} ({$order['user_email']})</li>
                        <li><strong>Ticket Type:</strong> " . ucfirst($order['ticket_type']) . "</li>
                        <li><strong>Quantity:</strong> {$order['quantity']}</li>
                        <li><strong>Amount:</strong> ₦" . number_format($order['total_amount']) . "</li>
                        <li><strong>Status:</strong> {$order['status']}</li>
                    </ul>
                </div>

                <p><a href='https://yourdomain.com/admin.html' style='background: #da3f08; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;'>View in Dashboard</a></p>
            </div>
        </body>
        </html>
    ";

    return sendEmail(ADMIN_EMAIL, $subject, $body);
}

/**
 * Notify admin of payment proof upload
 */
function notifyAdminPaymentProof($order) {
    $subject = "Payment Proof Uploaded - {$order['order_number']}";
    $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                h2 { color: #da3f08; }
                .info-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .highlight { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class='container'>
                <h2>💳 Payment Proof Uploaded</h2>

                <div class='highlight'>
                    <p><strong>Action Required:</strong> Payment proof needs to be reviewed</p>
                </div>

                <div class='info-box'>
                    <p>Payment proof has been uploaded for order <strong>{$order['order_number']}</strong></p>
                    <ul>
                        <li><strong>Customer:</strong> {$order['user_name']} ({$order['user_email']})</li>
                        <li><strong>Ticket Type:</strong> " . ucfirst($order['ticket_type']) . "</li>
                        <li><strong>Amount:</strong> ₦" . number_format($order['total_amount']) . "</li>
                    </ul>
                </div>

                <p><a href='https://yourdomain.com/admin.html' style='background: #da3f08; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;'>Review in Dashboard</a></p>
            </div>
        </body>
        </html>
    ";

    return sendEmail(ADMIN_EMAIL, $subject, $body);
}
