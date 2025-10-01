const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hive-party';

async function connectDB() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB via Mongoose');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function closeDB() {
  await mongoose.connection.close();
  console.log('🔌 Disconnected from MongoDB');
}

module.exports = { connectDB, closeDB };
