const nodemailer = require('nodemailer');
require('dotenv').config();

// Check if email is configured
const isEmailConfigured = process.env.SMTP_USER && process.env.SMTP_PASS &&
    process.env.SMTP_USER !== 'your-email@gmail.com';

let transporter = null;

if (isEmailConfigured) {
    // Create transporter
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // Verify connection
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ Email service error:', error.message);
            console.log('⚠️  Emails will not be sent. Please configure SMTP settings in .env');
        } else {
            console.log('✅ Email service ready');
        }
    });
} else {
    console.log('⚠️  Email not configured. Set SMTP_USER and SMTP_PASS in .env to enable email notifications.');
}

// Email templates
const emailTemplates = {
    orderConfirmation: (order) => ({
        subject: `Order Confirmed - ${order.orderNumber}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; background-color: #000; color: #fff; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 2px solid #da3f08; border-radius: 12px; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { font-size: 32px; font-weight: bold; color: #da3f08; text-transform: uppercase; }
                    .title { font-size: 28px; color: #da3f08; margin: 20px 0; text-transform: uppercase; }
                    .info-box { background: rgba(218, 63, 8, 0.1); border: 1px solid rgba(218, 63, 8, 0.3); border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(218, 63, 8, 0.2); }
                    .info-row:last-child { border-bottom: none; }
                    .label { color: #999; }
                    .value { color: #fff; font-weight: bold; }
                    .timer { background: rgba(255, 193, 7, 0.2); border: 2px solid #ffc107; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                    .timer-text { font-size: 18px; color: #ffc107; font-weight: bold; }
                    .instructions { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .instructions h3 { color: #da3f08; margin-top: 0; }
                    .instructions ol { padding-left: 20px; }
                    .instructions li { margin: 10px 0; line-height: 1.6; }
                    .highlight { color: #da3f08; font-weight: bold; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(218, 63, 8, 0.3); color: #999; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">The Hive Party</div>
                        <h1 class="title">Order Confirmation</h1>
                    </div>

                    <p>Hi <strong>${order.userName}</strong>,</p>
                    <p>Thank you for your order! Please complete your payment within 30 minutes.</p>

                    <div class="timer">
                        <div class="timer-text">⏱️ Complete Payment Within 30 Minutes</div>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #fff;">Your order will expire if payment is not submitted on time</p>
                    </div>

                    <div class="info-box">
                        <div class="info-row">
                            <span class="label">Order Number:</span>
                            <span class="value">${order.orderNumber}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Reference Code:</span>
                            <span class="value">${order.referenceCode}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Ticket Type:</span>
                            <span class="value">${order.ticketType.charAt(0).toUpperCase() + order.ticketType.slice(1)}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Quantity:</span>
                            <span class="value">${order.quantity} ticket(s)</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Total Amount:</span>
                            <span class="value highlight">₦ ${order.totalAmount.toLocaleString()}</span>
                        </div>
                    </div>

                    <div class="instructions">
                        <h3>🏦 Bank Transfer Instructions</h3>
                        <p><strong>Bank Name:</strong> Access Bank Nigeria<br>
                        <strong>Account Name:</strong> Hive Party Events<br>
                        <strong>Account Number:</strong> 0123456789<br>
                        <strong>Amount:</strong> <span class="highlight">₦${order.totalAmount.toLocaleString()}</span><br>
                        <strong>Reference:</strong> <span class="highlight">${order.referenceCode}</span></p>
                    </div>

                    <div class="instructions">
                        <h3>💳 Other Payment Methods</h3>
                        <p>You can also pay using:</p>
                        <ul>
                            <li><strong>Card Payment:</strong> Visa, Mastercard, Verve</li>
                            <li><strong>USSD Transfer:</strong> From your bank app</li>
                            <li><strong>Mobile Banking:</strong> Any Nigerian bank app</li>
                        </ul>
                        <p><strong>Important:</strong> Use reference code <span class="highlight">${order.referenceCode}</span> for all payments</p>
                    </div>

                    <p style="background: rgba(218, 63, 8, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #da3f08;">
                        <strong>Important:</strong> After making payment, please upload your bank receipt, transfer confirmation, or payment screenshot at the checkout page.
                    </p>

                    <div class="footer">
                        <p>The Hive Party | info@hiveparty.com</p>
                        <p>If you have any questions, please contact our support team.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    paymentReceived: (order) => ({
        subject: `Payment Received - ${order.orderNumber}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; background-color: #000; color: #fff; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 2px solid #da3f08; border-radius: 12px; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { font-size: 32px; font-weight: bold; color: #da3f08; text-transform: uppercase; }
                    .title { font-size: 28px; color: #4caf50; margin: 20px 0; text-transform: uppercase; }
                    .checkmark { font-size: 64px; color: #4caf50; }
                    .info-box { background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(218, 63, 8, 0.3); color: #999; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">The Hive Party</div>
                        <div class="checkmark">✓</div>
                        <h1 class="title">Payment Proof Received!</h1>
                    </div>

                    <p>Hi <strong>${order.userName}</strong>,</p>
                    <p>We've received your payment proof for order <strong>${order.orderNumber}</strong>.</p>

                    <div class="info-box">
                        <p><strong>What's Next?</strong></p>
                        <ul>
                            <li>✓ Our team will verify your payment within 1-2 hours</li>
                            <li>✓ You'll receive your tickets via email once approved</li>
                            <li>✓ Present your ticket QR code at the event entrance</li>
                        </ul>
                    </div>

                    <p>You can track your order status at any time using your order number: <strong>${order.orderNumber}</strong></p>

                    <div class="footer">
                        <p>The Hive Party | info@hiveparty.com</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    ticketDelivery: (order, tickets) => ({
        subject: `Your Hive Party Tickets - ${order.orderNumber}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; background-color: #000; color: #fff; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 2px solid #da3f08; border-radius: 12px; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { font-size: 32px; font-weight: bold; color: #da3f08; text-transform: uppercase; }
                    .title { font-size: 28px; color: #4caf50; margin: 20px 0; text-transform: uppercase; }
                    .success-icon { font-size: 64px; color: #4caf50; }
                    .ticket-card { background: rgba(218, 63, 8, 0.1); border: 2px solid #da3f08; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
                    .ticket-number { font-size: 24px; color: #da3f08; font-weight: bold; margin: 10px 0; }
                    .qr-code { margin: 20px auto; padding: 20px; background: white; border-radius: 8px; display: inline-block; }
                    .instructions { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(218, 63, 8, 0.3); color: #999; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">The Hive Party</div>
                        <div class="success-icon">🎉</div>
                        <h1 class="title">Your Tickets Are Ready!</h1>
                    </div>

                    <p>Hi <strong>${order.userName}</strong>,</p>
                    <p>Great news! Your payment has been verified and your tickets are ready.</p>

                    ${tickets.map(ticket => `
                        <div class="ticket-card">
                            <p style="color: #999; margin: 0;">Ticket ${tickets.indexOf(ticket) + 1} of ${tickets.length}</p>
                            <div class="ticket-number">${ticket.ticketNumber}</div>
                            <p style="color: #fff;">${order.ticketType.toUpperCase()} TICKET</p>
                            <div class="qr-code">
                                <img src="cid:qr_${ticket._id}" alt="QR Code" style="width: 200px; height: 200px;">
                            </div>
                        </div>
                    `).join('')}

                    <div class="instructions">
                        <h3 style="color: #da3f08; margin-top: 0;">📱 How to Use Your Tickets</h3>
                        <ol>
                            <li>Save this email or download the QR code images</li>
                            <li>Present the QR code at the event entrance</li>
                            <li>Each ticket can only be scanned once</li>
                            <li>Arrive early to avoid queues</li>
                        </ol>
                    </div>

                    <p style="background: rgba(218, 63, 8, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #da3f08;">
                        <strong>Important:</strong> Please do not share your QR codes. Each ticket is unique and can only be used once.
                    </p>

                    <p style="text-align: center; font-size: 18px; margin: 30px 0;">
                        <strong>See you at The Hive Party! 🎊</strong>
                    </p>

                    <div class="footer">
                        <p>The Hive Party | info@hiveparty.com</p>
                        <p>Order Number: ${order.orderNumber}</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    paymentDeclined: (order, reason) => ({
        subject: `Payment Issue - ${order.orderNumber}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; background-color: #000; color: #fff; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 2px solid #da3f08; border-radius: 12px; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { font-size: 32px; font-weight: bold; color: #da3f08; text-transform: uppercase; }
                    .title { font-size: 28px; color: #f44336; margin: 20px 0; text-transform: uppercase; }
                    .warning-icon { font-size: 64px; color: #f44336; }
                    .alert-box { background: rgba(244, 67, 54, 0.1); border: 2px solid #f44336; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .btn { display: inline-block; background: #da3f08; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(218, 63, 8, 0.3); color: #999; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">The Hive Party</div>
                        <div class="warning-icon">⚠️</div>
                        <h1 class="title">Payment Could Not Be Verified</h1>
                    </div>

                    <p>Hi <strong>${order.userName}</strong>,</p>
                    <p>Unfortunately, we couldn't verify the payment for order <strong>${order.orderNumber}</strong>.</p>

                    <div class="alert-box">
                        <p><strong>Reason:</strong></p>
                        <p>${reason || 'Payment proof could not be verified. Please ensure the payment details match your order information.'}</p>
                    </div>

                    <p><strong>What to do next:</strong></p>
                    <ul>
                        <li>Check that you made the payment to the correct account</li>
                        <li>Ensure the amount matches your order total (₦ ${order.totalAmount.toLocaleString()})</li>
                        <li>Verify you used the correct reference code: <strong>${order.referenceCode}</strong></li>
                        <li>Contact our support team with your payment confirmation</li>
                    </ul>

                    <p style="text-align: center;">
                        <a href="mailto:info@hiveparty.com?subject=Payment Issue - ${order.orderNumber}" class="btn">Contact Support</a>
                    </p>

                    <div class="footer">
                        <p>The Hive Party | info@hiveparty.com</p>
                        <p>Order Number: ${order.orderNumber}</p>
                    </div>
                </div>
            </body>
            </html>
        `
    })
};

// Send email function
async function sendEmail(to, template, attachments = []) {
    if (!transporter) {
        console.log('⚠️  Email not sent (service not configured):', template.subject);
        return { success: false, error: 'Email service not configured' };
    }

    try {
        const mailOptions = {
            from: `"The Hive Party" <${process.env.SMTP_USER}>`,
            to,
            subject: template.subject,
            html: template.html,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendEmail,
    emailTemplates
};
