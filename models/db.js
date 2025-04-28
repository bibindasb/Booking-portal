const mongoose = require('mongoose');

async function connectDB() {
  const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/cabbooking';

  try {
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error; // Important to throw and exit in case of DB failure
  }
}

module.exports = { connectDB };