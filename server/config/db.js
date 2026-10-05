import mongoose from 'mongoose';

let connectionPromise;
export async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from server/.env');
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (mongoose.connection.readyState !== 2) connectionPromise = undefined;
  connectionPromise ||= mongoose.connect(process.env.MONGO_URI).catch((error) => {
    connectionPromise = undefined;
    throw error;
  });
  await connectionPromise;
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
  return mongoose.connection;
}
