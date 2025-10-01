const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const { connectDB } = require('./db/connection');
const adminRoutes = require('./routes/admin');
const orderRoutes = require('./routes/orders');
const { router: authRoutes, requireAuth } = require('./routes/auth');
const realtimeService = require('./utils/realtime');
const Admin = require('./db/models/Admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'hive-party-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/orders', orderRoutes);

// Real-time updates endpoint (Server-Sent Events)
app.get('/api/realtime', (req, res) => {
    realtimeService.addClient(res);
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
async function startServer() {
    try {
        await connectDB();

        // Create default admin if none exists
        await Admin.createDefaultAdmin();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin.html`);
            console.log(`🔐 Login page: http://localhost:${PORT}/login.html`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
