require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Share = require('../models/Share');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Seeding MongoDB...');
  await Promise.all([User.deleteMany(), Listing.deleteMany(), Share.deleteMany()]);

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@college.edu',
    password: 'admin123',
    collegeDomain: 'college.edu',
    role: 'admin',
    verified: true,
  });

  const user = await User.create({
    name: 'Student One',
    email: 'student1@college.edu',
    password: 'student123',
    collegeDomain: 'college.edu',
    verified: true,
  });

  await Listing.create([
    {
      title: 'Graphing Calculator',
      description: 'TI-84 in great condition',
      price: 80,
      category: 'physical',
      condition: 'good',
      listingType: 'buy-now',
      tags: ['math', 'calculator'],
      seller: user._id,
      collegeDomain: 'college.edu',
    },
    {
      title: 'Campus Concert Tickets',
      description: 'Two tickets for Saturday show',
      price: 50,
      category: 'ticket',
      condition: 'like-new',
      listingType: 'auction',
      tags: ['music', 'concert'],
      seller: user._id,
      collegeDomain: 'college.edu',
      auction: { isAuction: true, startBid: 20 },
    },
  ]);

  await Share.create({
    name: 'Dorm Internet Split',
    description: 'Split ISP bill',
    host: user._id,
    collegeDomain: 'college.edu',
    totalAmount: 120,
    splitType: 'equal',
    members: [
      { user: user._id, status: 'joined' },
      { user: admin._id, status: 'joined' },
    ],
  });

  console.log('Seed complete. Change default admin password immediately.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
