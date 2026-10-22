import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import User from './models/User.model.js';

const password = process.env.NEW_DEMO_PASSWORD;
const accounts = [
  { email: 'admin@apsystem.com', role: 'admin' },
  { email: 'manager@apsystem.com', role: 'manager' },
  { email: 'clerk@apsystem.com', role: 'clerk' },
];

try {
  if (!password || password.length < 12) throw new Error('NEW_DEMO_PASSWORD must be at least 12 characters.');
  if (!process.env.MONGO_URI?.startsWith('mongodb')) throw new Error('MONGO_URI must be an Atlas MongoDB connection string.');
  const uriPath = process.env.MONGO_URI.split('?')[0].split('/').slice(3).filter(Boolean);
  if (uriPath.length !== 1 || uriPath[0] !== 'ap-system-demo') throw new Error('MONGO_URI must target the ap-system-demo database.');

  await connectDB();
  const existing = await User.find({ email: { $in: accounts.map(({ email }) => email) } }).select('_id email role').lean();
  const byEmail = new Map(existing.map((user) => [user.email, user]));
  const missing = accounts.filter(({ email, role }) => byEmail.get(email)?.role !== role);
  if (missing.length) throw new Error(`Expected seeded account(s) were not found with the correct role: ${missing.map(({ email }) => email).join(', ')}`);

  const hash = await bcrypt.hash(password, 10);
  const results = await User.bulkWrite(accounts.map(({ email, role }) => ({
    updateOne: { filter: { email, role }, update: { $set: { password: hash } } },
  })));
  if (results.matchedCount !== accounts.length) throw new Error('Not all three accounts were updated. Check the account list in Atlas.');
  console.log('Password updated for the existing admin, manager, and clerk accounts.');
} catch (error) {
  console.error(`Password reset failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
