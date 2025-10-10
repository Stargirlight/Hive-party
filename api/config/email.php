<?php
// Email configuration

// Email settings - Update these with your actual values
define('SMTP_HOST', 'smtp.gmail.com'); // Or your hosting provider's SMTP
define('SMTP_PORT', 587);
define('SMTP_USERNAME', 'your-email@example.com'); // Change this
define('SMTP_PASSWORD', 'your-app-password'); // Change this
define('SMTP_FROM_EMAIL', 'noreply@hiveparty.com'); // Change this
define('SMTP_FROM_NAME', 'Hive Party');
define('ADMIN_EMAIL', 'admin@hiveparty.com'); // Change this

/**
 * Send email using PHP mail() function
 * For better deliverability, consider using PHPMailer library
 */
function sendEmail($to, $subject, $htmlBody, $textBody = '') {
    // Simple PHP mail() - works on most shared hosting
    $headers = [
        'From: ' . SMTP_FROM_NAME . ' <' . SMTP_FROM_EMAIL . '>',
        'Reply-To: ' . SMTP_FROM_EMAIL,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8'
    ];

    $success = mail($to, $subject, $htmlBody, implode("\r\n", $headers));

    if (!$success) {
        error_log("Failed to send email to: $to, subject: $subject");
    }

    return $success;
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
