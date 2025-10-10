// Minimal test app for cPanel - no database, just static serving
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting test app...');

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Test app running!' });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

console.log('Test app initialized');

// For local testing
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Test server running on port ${PORT}`);
    });
}

module.exports = app;
