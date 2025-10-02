const express = require('express');
const router = express.Router();
const Admin = require('../db/models/Admin');

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find admin
        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (!admin) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                error: 'Account is disabled. Please contact system administrator.'
            });
        }

        // Verify password
        const isValidPassword = await admin.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Update last login
        await admin.updateLastLogin();

        // Create session
        req.session.adminId = admin._id;
        req.session.adminEmail = admin.email;
        req.session.adminName = admin.name;
        req.session.adminRole = admin.role;

        // Save session before responding
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create session'
                });
            }

            res.json({
                success: true,
                admin: {
                    id: admin._id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred during login'
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Failed to logout'
            });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check authentication status
router.get('/status', (req, res) => {
    if (req.session.adminId) {
        res.json({
            authenticated: true,
            admin: {
                id: req.session.adminId,
                email: req.session.adminEmail,
                name: req.session.adminName,
                role: req.session.adminRole
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Middleware to protect admin routes
const requireAuth = (req, res, next) => {
    if (!req.session.adminId) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    next();
};

module.exports = { router, requireAuth };
