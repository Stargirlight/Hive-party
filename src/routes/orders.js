const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Order = require('../db/models/Order');
const User = require('../db/models/User');
const { validateOrderData, sanitizeString } = require('../utils/validation');
const { sendEmail, emailTemplates } = require('../utils/emailService');

// Configure multer for payment proof uploads (memory storage for Vercel)
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG) and PDF are allowed'));
        }
    }
});

// Create new order
router.post('/', async (req, res) => {
    try {
        console.log('📥 Received order creation request');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const { email, name, phone, ticketType, quantity, pricePerTicket } = req.body;

        // Validate input
        console.log('🔍 Validating order data...');
        const validation = validateOrderData(req.body);

        if (!validation.isValid) {
            console.error('❌ Validation failed:', validation.errors);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.errors
            });
        }
        console.log('✅ Validation passed');

        // Sanitize input
        const sanitizedName = sanitizeString(name);
        const sanitizedEmail = email.toLowerCase().trim();
        console.log('🧹 Sanitized data:', { name: sanitizedName, email: sanitizedEmail });

        // Find or create user
        console.log('👤 Finding/creating user...');
        const user = await User.findOrCreate(sanitizedEmail, sanitizedName, phone);
        console.log('✅ User ready:', user._id);

        // Create order using model method
        console.log('📝 Creating order...');
        const orderData = {
            userId: user._id,
            userEmail: sanitizedEmail,
            userName: sanitizedName,
            ticketType,
            quantity: parseInt(quantity),
            pricePerTicket: parseFloat(pricePerTicket)
        };
        console.log('Order data:', JSON.stringify(orderData, null, 2));

        const order = await Order.createOrder(orderData);
        console.log('✅ Order created successfully:', order.orderNumber);

        // Send order confirmation email
        try {
            const emailTemplate = emailTemplates.orderConfirmation(order);
            await sendEmail(sanitizedEmail, emailTemplate);
        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            // Don't fail the order creation if email fails
        }

        console.log('📤 Sending response...');
        res.status(201).json({
            success: true,
            order
        });
        console.log('✅ Response sent successfully');
    } catch (error) {
        console.error('❌ Error creating order:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to create order',
            message: error.message
        });
    }
});

// Get order by order number
router.get('/:orderNumber', async (req, res) => {
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Upload payment proof
router.post('/:orderId/upload-proof', upload.single('paymentProof'), async (req, res) => {
    try {
        const orderId = req.params.orderId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Get the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        if (order.status !== 'pending_payment') {
            return res.status(400).json({
                success: false,
                error: 'Cannot upload proof for this order. Status: ' + order.status
            });
        }

        // Check if order expired
        if (order.expiresAt && new Date() > order.expiresAt) {
            await order.updateOne({ status: 'expired' });
            return res.status(400).json({
                success: false,
                error: 'Order has expired'
            });
        }

        // Convert file to base64 and store in database (Vercel has no persistent filesystem)
        const base64Data = req.file.buffer.toString('base64');
        const proofData = {
            data: base64Data,
            contentType: req.file.mimetype,
            filename: req.file.originalname,
            uploadedAt: new Date()
        };

        await order.uploadPaymentProof(proofData);

        // Send payment received email
        try {
            const emailTemplate = emailTemplates.paymentReceived(order);
            await sendEmail(order.userEmail, emailTemplate);
        } catch (emailError) {
            console.error('Failed to send payment received email:', emailError);
        }

        res.json({
            success: true,
            message: 'Payment proof uploaded successfully. Your payment is under review.'
        });
    } catch (error) {
        console.error('Error uploading payment proof:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload payment proof',
            message: error.message
        });
    }
});

// Get user orders
router.get('/user/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });

        if (!user) {
            return res.json([]);
        }

        const orders = await Order.find({ userId: user._id })
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

module.exports = router;
