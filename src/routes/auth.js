const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../db/models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'hive-party-jwt-secret-change-in-production';
const JWT_EXPIRY = '7d'; // 7 days

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

        // Create JWT token
        const token = jwt.sign(
            {
                adminId: admin._id.toString(),
                email: admin.email,
                name: admin.name,
                role: admin.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        // Set httpOnly cookie with token
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Also create session for backward compatibility (local dev)
        req.session.adminId = admin._id;
        req.session.adminEmail = admin.email;
        req.session.adminName = admin.name;
        req.session.adminRole = admin.role;

        res.json({
            success: true,
            admin: {
                id: admin._id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            }
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
    // Clear the auth cookie
    res.clearCookie('authToken');

    // Also destroy session for backward compatibility
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check authentication status
router.get('/status', (req, res) => {
    // Try JWT token first (for Vercel)
    const token = req.cookies?.authToken;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return res.json({
                authenticated: true,
                admin: {
                    id: decoded.adminId,
                    email: decoded.email,
                    name: decoded.name,
                    role: decoded.role
                }
            });
        } catch (err) {
            // Token invalid or expired, clear it
            res.clearCookie('authToken');
        }
    }

    // Fallback to session (for local dev)
    if (req.session.adminId) {
        return res.json({
            authenticated: true,
            admin: {
                id: req.session.adminId,
                email: req.session.adminEmail,
                name: req.session.adminName,
                role: req.session.adminRole
            }
        });
    }

    res.json({ authenticated: false });
});

// Middleware to protect admin routes
const requireAuth = (req, res, next) => {
    // Try JWT token first (for Vercel)
    const token = req.cookies?.authToken;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.admin = {
                id: decoded.adminId,
                email: decoded.email,
                name: decoded.name,
                role: decoded.role
            };
            return next();
        } catch (err) {
            // Token invalid, continue to check session
        }
    }

    // Fallback to session (for local dev)
    if (req.session.adminId) {
        req.admin = {
            id: req.session.adminId,
            email: req.session.adminEmail,
            name: req.session.adminName,
            role: req.session.adminRole
        };
        return next();
    }

    return res.status(401).json({
        success: false,
        error: 'Authentication required'
    });
};

module.exports = { router, requireAuth };
