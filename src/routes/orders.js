const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Order = require('../db/models/Order');
const User = require('../db/models/User');
const { validateOrderData, sanitizeString } = require('../utils/validation');
const { sendEmail, emailTemplates } = require('../utils/emailService');

// Configure multer for payment proof uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/payment-proofs/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
    }
});

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
        const { email, name, phone, ticketType, quantity, pricePerTicket } = req.body;

        // Validate input
        const validation = validateOrderData(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.errors
            });
        }

        // Sanitize input
        const sanitizedName = sanitizeString(name);
        const sanitizedEmail = email.toLowerCase().trim();

        // Find or create user
        const user = await User.findOrCreate(sanitizedEmail, sanitizedName, phone);

        // Create order using model method
        const order = await Order.createOrder({
            userId: user._id,
            userEmail: sanitizedEmail,
            userName: sanitizedName,
            ticketType,
            quantity: parseInt(quantity),
            pricePerTicket: parseFloat(pricePerTicket)
        });

        // Send order confirmation email
        try {
            const emailTemplate = emailTemplates.orderConfirmation(order);
            await sendEmail(sanitizedEmail, emailTemplate);
        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            // Don't fail the order creation if email fails
        }

        res.status(201).json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error creating order:', error);
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

        // Save file path using model method
        const proofUrl = `/uploads/payment-proofs/${req.file.filename}`;
        await order.uploadPaymentProof(proofUrl);

        // Send payment received email
        try {
            const emailTemplate = emailTemplates.paymentReceived(order);
            await sendEmail(order.userEmail, emailTemplate);
        } catch (emailError) {
            console.error('Failed to send payment received email:', emailError);
        }

        res.json({
            success: true,
            message: 'Payment proof uploaded successfully. Your payment is under review.',
            proofUrl
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
