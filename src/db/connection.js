const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hive-party';

// Cache connection for serverless
let cachedConnection = null;

async function connectDB() {
  // Reuse existing connection if available (important for serverless)
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('♻️  Reusing existing MongoDB connection');
    return cachedConnection;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Quick timeout for cPanel
      socketTimeoutMS: 10000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    cachedConnection = mongoose.connection;
    console.log('✅ Connected to MongoDB via Mongoose');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    return cachedConnection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error; // Don't use process.exit in serverless
  }
}

async function closeDB() {
  await mongoose.connection.close();
  console.log('🔌 Disconnected from MongoDB');
}

module.exports = { connectDB, closeDB };
