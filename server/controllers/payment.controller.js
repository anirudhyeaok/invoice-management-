import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.model.js';
import AuditLog from '../models/AuditLog.model.js';
import ApiError from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new ApiError(503, 'Payment gateway is not configured. Add your Razorpay test keys to server/.env.');
  if (!keyId.startsWith('rzp_test_')) throw new ApiError(503, 'This prototype accepts Razorpay test keys only. Live payment keys are disabled.');
  return { keyId, keySecret };
}

export function getPaymentGatewayConfig(_req, res) {
  const ready = Boolean(process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && process.env.RAZORPAY_KEY_SECRET);
  sendResponse(res, 200, 'Payment gateway configuration loaded', { ready, provider: 'Razorpay', mode: 'test' });
}

function safeEqual(left, right) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function gatewayRequest(url, keyId, keySecret, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.description || data.error?.reason || 'Payment provider request failed.';
    throw new ApiError(502, message);
  }
  return data;
}

export async function createPaymentOrder(req, res, next) {
  try {
    const { keyId, keySecret } = credentials();
    const invoice = await Invoice.findById(req.params.id).populate('vendor', 'companyName');
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status !== 'approved') throw new ApiError(409, 'Only approved invoices can be paid');
    if (invoice.paymentStatus === 'paid') throw new ApiError(409, 'This invoice has already been paid');
    if (invoice.currency !== 'INR') throw new ApiError(400, 'Razorpay checkout is enabled for INR invoices only');
    if (!Number.isFinite(invoice.totalAmount) || invoice.totalAmount <= 0) throw new ApiError(400, 'Invoice amount must be greater than zero');

    const amount = Math.round(invoice.totalAmount * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) throw new ApiError(400, 'Invoice amount must be at least ₹1.00');
    if (invoice.paymentStatus === 'processing' && invoice.razorpayOrderId) {
      return sendResponse(res, 200, 'Existing payment checkout loaded', {
        checkout: { keyId, orderId: invoice.razorpayOrderId, amount, currency: invoice.currency, invoiceNumber: invoice.invoiceNumber, vendorName: invoice.vendor?.companyName || 'Supplier' },
      });
    }
    const order = await gatewayRequest('https://api.razorpay.com/v1/orders', keyId, keySecret, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `inv_${String(invoice._id).slice(-32)}`,
        notes: { invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber },
      }),
    });

    invoice.paymentStatus = 'processing';
    invoice.razorpayOrderId = order.id;
    invoice.paymentInitiatedAt = new Date();
    invoice.paymentAttempts.push({ orderId: order.id, status: 'created', amount: invoice.totalAmount, currency: invoice.currency, performedBy: req.user._id, message: 'Checkout opened' });
    await invoice.save();
    await AuditLog.create({ entityType: 'Invoice', entityId: invoice._id, action: 'PAYMENT_CHECKOUT_CREATED', performedBy: req.user._id, description: `Payment checkout opened for ${invoice.invoiceNumber}`, metadata: { orderId: order.id, amount: invoice.totalAmount, currency: invoice.currency }, ipAddress: req.ip, userAgent: req.get('user-agent') });

    sendResponse(res, 201, 'Payment checkout is ready', {
      checkout: { keyId, orderId: order.id, amount: order.amount, currency: order.currency, invoiceNumber: invoice.invoiceNumber, vendorName: invoice.vendor?.companyName || 'Supplier' },
    });
  } catch (error) { next(error); }
}

export async function verifyPayment(req, res, next) {
  try {
    const { keyId, keySecret } = credentials();
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const { razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature } = req.body;
    if (![paymentId, orderId, signature].every((value) => typeof value === 'string' && value.length > 0)) throw new ApiError(400, 'Payment confirmation is incomplete');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.paymentStatus === 'paid') {
      if (invoice.razorpayPaymentId === paymentId && invoice.razorpayOrderId === orderId) return sendResponse(res, 200, 'Payment already confirmed', { invoice });
      throw new ApiError(409, 'This invoice has already been paid');
    }
    if (invoice.status !== 'approved' || invoice.razorpayOrderId !== orderId || invoice.paymentStatus !== 'processing') throw new ApiError(409, 'This payment does not match the current invoice checkout');

    const expected = crypto.createHmac('sha256', keySecret).update(`${invoice.razorpayOrderId}|${paymentId}`).digest('hex');
    if (!safeEqual(expected, signature)) throw new ApiError(400, 'Payment could not be verified. Contact the project administrator.');

    const payment = await gatewayRequest(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, keyId, keySecret);
    const expectedAmount = Math.round(invoice.totalAmount * 100);
    if (payment.order_id !== invoice.razorpayOrderId || payment.amount !== expectedAmount || payment.currency !== invoice.currency) throw new ApiError(400, 'The payment amount or invoice does not match');
    if (payment.status !== 'captured') throw new ApiError(409, 'The provider has not captured this payment yet. Refresh the payment page and check again.');

    invoice.paymentStatus = 'paid';
    invoice.status = 'paid';
    invoice.razorpayPaymentId = paymentId;
    invoice.paidAt = new Date();
    invoice.paymentAttempts.push({ orderId, paymentId, status: 'paid', amount: invoice.totalAmount, currency: invoice.currency, performedBy: req.user._id, message: 'Payment verified and captured' });
    await invoice.save();
    await AuditLog.create({ entityType: 'Invoice', entityId: invoice._id, action: 'PAYMENT_CONFIRMED', performedBy: req.user._id, description: `Payment confirmed for ${invoice.invoiceNumber}`, metadata: { orderId, paymentId, amount: invoice.totalAmount, currency: invoice.currency }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendResponse(res, 200, 'Payment verified and recorded', { invoice });
  } catch (error) { next(error); }
}

export async function markPaymentAttemptFailed(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    const orderId = String(req.body.orderId || '');
    if (!orderId || orderId !== invoice.razorpayOrderId || invoice.paymentStatus !== 'processing') throw new ApiError(409, 'This checkout is no longer active');
    invoice.paymentStatus = 'failed';
    invoice.paymentAttempts.push({ orderId, status: 'failed', amount: invoice.totalAmount, currency: invoice.currency, performedBy: req.user._id, message: String(req.body.message || 'Payment was not completed').slice(0, 250) });
    await invoice.save();
    await AuditLog.create({ entityType: 'Invoice', entityId: invoice._id, action: 'PAYMENT_ATTEMPT_FAILED', performedBy: req.user._id, description: `Payment attempt was not completed for ${invoice.invoiceNumber}`, metadata: { orderId }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendResponse(res, 200, 'Payment attempt recorded', { paymentStatus: invoice.paymentStatus });
  } catch (error) { next(error); }
}
