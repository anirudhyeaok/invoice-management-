import mongoose from 'mongoose';
import Invoice from '../models/Invoice.model.js';
import AuditLog from '../models/AuditLog.model.js';
import ApiError from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';

/**
 * This course project records a manual demo payment only. It does not contact a
 * payment provider, collect financial details, or transfer money.
 */
export async function recordDemoPayment(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.paymentStatus === 'paid' || invoice.status === 'paid') throw new ApiError(409, 'This invoice has already been marked as paid');
    if (invoice.status !== 'approved') throw new ApiError(409, 'Only approved invoices can be marked as paid');

    invoice.status = 'paid';
    invoice.paymentStatus = 'paid';
    invoice.paidAt = new Date();
    invoice.paymentAttempts.push({
      status: 'paid',
      amount: invoice.totalAmount,
      currency: invoice.currency || 'INR',
      performedBy: req.user._id,
      message: 'Demo payment recorded manually; no money was transferred.',
    });
    await invoice.save();

    await AuditLog.create({
      entityType: 'Invoice',
      entityId: invoice._id,
      action: 'PAYMENT_RECORDED_DEMO',
      performedBy: req.user._id,
      description: `Demo payment recorded for ${invoice.invoiceNumber}; no money was transferred`,
      metadata: { amount: invoice.totalAmount, currency: invoice.currency || 'INR', mode: 'manual_demo' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendResponse(res, 200, 'Demo payment recorded. No money was transferred.', { invoice });
  } catch (error) {
    return next(error);
  }
}
