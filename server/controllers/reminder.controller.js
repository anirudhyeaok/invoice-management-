import Invoice from '../models/Invoice.model.js';
import AuditLog from '../models/AuditLog.model.js';
import ApiError from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';
import { sendInvoiceReminder } from '../services/emailReminder.js';

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function sendInvoiceReminderEmail(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status !== 'approved' || invoice.paymentStatus === 'paid') {
      throw new ApiError(409, 'Reminders are available for approved invoices that are not marked as paid');
    }
    if (!invoice.uploadedBy?.email) throw new ApiError(409, 'The invoice submitter does not have an email address on their account');
    if (invoice.lastReminderSentAt && Date.now() - invoice.lastReminderSentAt.getTime() < REMINDER_COOLDOWN_MS) {
      throw new ApiError(429, 'A reminder was sent within the last 24 hours. Try again later.');
    }

    const providerMessageId = await sendInvoiceReminder({
      to: invoice.uploadedBy.email,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.totalAmount,
      currency: invoice.currency || 'INR',
      dueDate: invoice.dueDate,
    });

    invoice.reminderCount = (invoice.reminderCount || 0) + 1;
    invoice.lastReminderSentAt = new Date();
    await invoice.save();
    await AuditLog.create({
      entityType: 'Invoice', entityId: invoice._id, action: 'PAYMENT_REMINDER_SENT',
      performedBy: req.user._id,
      description: `Payment follow-up reminder sent to the invoice submitter for ${invoice.invoiceNumber}`,
      metadata: { reminderCount: invoice.reminderCount, providerMessageId },
      ipAddress: req.ip, userAgent: req.get('user-agent'),
    });

    sendResponse(res, 200, `Reminder email sent to ${invoice.uploadedBy.email}`, {
      reminderCount: invoice.reminderCount,
      lastReminderSentAt: invoice.lastReminderSentAt,
    });
  } catch (error) { next(error); }
}
