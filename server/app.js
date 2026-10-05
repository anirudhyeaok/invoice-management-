import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import purchaseOrderRoutes from './routes/purchaseOrder.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import reportRoutes from './routes/report.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { connectDB } from './config/db.js';

const app = express();
// In development, Vite may select another localhost port if 5173 is occupied.
app.use(morgan('dev'));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", 'https://checkout.razorpay.com'],
      'connect-src': ["'self'", 'https://api.razorpay.com'],
      'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://*.razorpay.com'],
    },
  },
}));
const configuredClientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin(origin, callback) {
    const localDevelopmentOrigin = process.env.NODE_ENV !== 'production'
      && /^http:\/\/(localhost|127\.0\.0\.1):517\d+$/.test(origin || '');
    if (!origin || origin === configuredClientOrigin || localDevelopmentOrigin) return callback(null, true);
    return callback(new Error('This origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'Accounts Payable API is running' }));
app.use('/api', async (_req, _res, next) => {
  try { await connectDB(); next(); } catch (error) { next(error); }
});
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
