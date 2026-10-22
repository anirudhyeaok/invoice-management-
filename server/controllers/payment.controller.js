import mongoose from 'mongoose';
import Invoice from '../models/Invoice.model.js';
import AuditLog from '../models/AuditLog.model.js';
import ApiError from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';

export async function recordPayment(req, res, next) {
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
      message: 'Payment recorded.',
    });
    await invoice.save();

    await AuditLog.create({
      entityType: 'Invoice',
      entityId: invoice._id,
      action: 'PAYMENT_RECORDED',
      performedBy: req.user._id,
      description: `Payment recorded for ${invoice.invoiceNumber}`,
      metadata: { amount: invoice.totalAmount, currency: invoice.currency || 'INR', mode: 'manual_record' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendResponse(res, 200, 'Payment recorded!', { invoice });
  } catch (error) {
    return next(error);
  }
}
