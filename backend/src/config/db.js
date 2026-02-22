const mongoose = require('mongoose');

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');

  await mongoose.connect(uri);
  console.log('MongoDB connected');
};

module.exports = { connectDb };
