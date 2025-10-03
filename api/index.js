const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { connectDB } = require('../src/db/connection');
const adminRoutes = require('../src/routes/admin');
const orderRoutes = require('../src/routes/orders');
const { router: authRoutes, requireAuth } = require('../src/routes/auth');
// const realtimeService = require('../src/utils/realtime'); // Disabled for serverless
const Admin = require('../src/db/models/Admin');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/orders', orderRoutes);

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

// Initialize database connection
async function initializeApp() {
    try {
        await connectDB();
        await Admin.createDefaultAdmin();
        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Start server for local development
if (require.main === module) {
    initializeApp().then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin.html`);
            console.log(`🔐 Login page: http://localhost:${PORT}/login.html`);
        });
    });
}

// For Vercel serverless - ensure DB connects on first request
let dbInitialized = false;
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await connectDB();
            await Admin.createDefaultAdmin();
            dbInitialized = true;
        } catch (error) {
            console.error('DB init error:', error);
        }
    }
    next();
});

// Export for Vercel serverless
module.exports = app;
