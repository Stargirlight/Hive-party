const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('Starting Hive Party app...');
console.log('Environment:', process.env.NODE_ENV || 'development');

const app = express();
const PORT = process.env.PORT || 3000;

// Lazy-load database and routes to prevent startup blocking
let connectDB, adminRoutes, orderRoutes, authRoutes, requireAuth, Admin;

function loadDependencies() {
    if (!connectDB) {
        try {
            ({ connectDB } = require('../src/db/connection'));
            adminRoutes = require('../src/routes/admin');
            orderRoutes = require('../src/routes/orders');
            ({ router: authRoutes, requireAuth } = require('../src/routes/auth'));
            Admin = require('../src/db/models/Admin');
            console.log('✅ Dependencies loaded');
        } catch (error) {
            console.error('❌ Error loading dependencies:', error.message);
            throw error;
        }
    }
}

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'hive-party-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database connection - lazy initialization for cPanel/Passenger
let dbInitPromise = null;
let isDbConnected = false;

async function initDB() {
    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            try {
                loadDependencies(); // Load routes and DB modules
                await connectDB();
                await Admin.createDefaultAdmin();
                isDbConnected = true;
                console.log('✅ DB initialized successfully');
            } catch (error) {
                console.error('❌ DB initialization failed:', error.message);
                dbInitPromise = null; // Reset to retry on next request
                throw error;
            }
        })();
    }
    return dbInitPromise;
}

// Health check - must be BEFORE DB middleware for Passenger startup
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        db: isDbConnected,
        env: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Middleware to ensure DB is ready before handling API requests
app.use(async (req, res, next) => {
    // Skip DB check for static files, health check, and root paths
    if (req.path.match(/\.(html|css|js|png|jpg|jpeg|gif|svg|ico)$/) ||
        req.path === '/health' ||
        req.path === '/' ||
        req.path === '/admin') {
        return next();
    }

    // Only require DB for API routes
    if (req.path.startsWith('/api/')) {
        try {
            if (!isDbConnected) {
                await initDB();
            }
            next();
        } catch (error) {
            console.error('DB middleware error:', error.message);
            res.status(503).json({
                success: false,
                error: 'Database unavailable',
                message: error.message
            });
        }
    } else {
        next();
    }
});

// Routes - wrapped in function to lazy-load
app.use('/api/auth', (req, res, next) => {
    loadDependencies();
    authRoutes(req, res, next);
});

app.use('/api/admin', (req, res, next) => {
    loadDependencies();
    requireAuth(req, res, next);
}, (req, res, next) => {
    adminRoutes(req, res, next);
});

app.use('/api/orders', (req, res, next) => {
    loadDependencies();
    orderRoutes(req, res, next);
});

// Real-time updates endpoint (Server-Sent Events)
// NOTE: SSE doesn't work on Vercel serverless - disabled for production
// For local development, uncomment the line below
// app.get('/api/realtime', (req, res) => {
//     realtimeService.addClient(res);
// });

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
});

// Start server for local development only
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin.html`);
        console.log(`🔐 Login page: http://localhost:${PORT}/login.html`);
        console.log('💡 Database will connect on first API request');
    });
}

console.log('✅ App module loaded successfully');

// Export for cPanel Passenger / Vercel serverless
module.exports = app;
