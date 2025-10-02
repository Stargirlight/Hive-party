const express = require('express');
const router = express.Router();
const Order = require('../db/models/Order');
const Ticket = require('../db/models/Ticket');
const AdminAction = require('../db/models/AdminAction');
const mongoose = require('mongoose');
const { sendEmail, emailTemplates } = require('../utils/emailService');

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await Order.getStats();

        // Calculate totals
        let pending = 0;
        let approved = 0;
        let revenue = 0;

        stats.forEach(stat => {
            if (stat._id === 'pending_confirmation') {
                pending = stat.count;
            } else if (stat._id === 'approved') {
                approved = stat.count;
                revenue = stat.totalAmount;
            }
        });

        // Get total tickets sold
        const ticketsSold = await Ticket.countDocuments({ status: 'active' });

        res.json({
            pending,
            approved,
            revenue,
            ticketsSold
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get all orders
router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find({})
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get single order by ID
router.get('/orders/:orderId', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Approve order
router.post('/orders/:orderId/approve', async (req, res) => {
    try {
        const { adminNotes } = req.body;
        const orderId = req.params.orderId;

        // Get the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'pending_confirmation') {
            return res.status(400).json({ error: 'Order cannot be approved' });
        }

        // Approve order using model method
        await order.approve(adminNotes);

        // Generate tickets
        const tickets = await Ticket.createFromOrder(order);

        // Log admin action
        const adminId = req.session.adminId || new mongoose.Types.ObjectId('000000000000000000000001');
        const adminEmail = req.session.adminEmail || 'admin@hiveparty.com';
        await AdminAction.log({
            adminId,
            adminEmail,
            action: 'approve_order',
            targetType: 'order',
            targetId: orderId,
            metadata: { ticketsGenerated: tickets.length }
        });

        // Send ticket delivery email with QR codes
        try {
            const emailTemplate = emailTemplates.ticketDelivery(order, tickets);

            // Attach QR code images
            const attachments = tickets.map(ticket => ({
                filename: `${ticket.ticketNumber}.png`,
                content: ticket.qrCodeImage.split('base64,')[1],
                encoding: 'base64',
                cid: `qr_${ticket._id}`
            }));

            await sendEmail(order.userEmail, emailTemplate, attachments);
        } catch (emailError) {
            console.error('Failed to send ticket delivery email:', emailError);
            // Don't fail the approval if email fails
        }

        res.json({
            success: true,
            message: 'Order approved and tickets generated',
            tickets
        });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ error: 'Failed to approve order' });
    }
});

// Decline order
router.post('/orders/:orderId/decline', async (req, res) => {
    try {
        const { reason } = req.body;
        const orderId = req.params.orderId;

        // Get the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'pending_confirmation') {
            return res.status(400).json({ error: 'Order cannot be declined' });
        }

        // Decline order using model method
        await order.decline(reason);

        // Log admin action
        const adminId = req.session.adminId || new mongoose.Types.ObjectId('000000000000000000000001');
        const adminEmail = req.session.adminEmail || 'admin@hiveparty.com';
        await AdminAction.log({
            adminId,
            adminEmail,
            action: 'decline_order',
            targetType: 'order',
            targetId: orderId,
            reason: reason || 'Not specified'
        });

        // Send payment declined email
        try {
            const emailTemplate = emailTemplates.paymentDeclined(order, reason);
            await sendEmail(order.userEmail, emailTemplate);
        } catch (emailError) {
            console.error('Failed to send payment declined email:', emailError);
        }

        res.json({
            success: true,
            message: 'Order declined'
        });
    } catch (error) {
        console.error('Error declining order:', error);
        res.status(500).json({ error: 'Failed to decline order' });
    }
});

// Get pending orders
router.get('/pending-orders', async (req, res) => {
    try {
        const orders = await Order.getPendingOrders();
        res.json(orders);
    } catch (error) {
        console.error('Error fetching pending orders:', error);
        res.status(500).json({ error: 'Failed to fetch pending orders' });
    }
});

// Get admin action logs
router.get('/audit-log', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = await AdminAction.getRecent(limit);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

module.exports = router;
