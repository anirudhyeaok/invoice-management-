import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  description: String, quantity: Number, unitPrice: Number, totalPrice: Number,
}, { _id: false });
const discrepancySchema = new mongoose.Schema({
  field: String, poValue: mongoose.Schema.Types.Mixed, invoiceValue: mongoose.Schema.Types.Mixed,
  percentageDiff: Number, severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
}, { _id: false });
const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });
const paymentAttemptSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  paymentId: String,
  status: { type: String, enum: ['created', 'paid', 'failed'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: String,
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, trim: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  lineItems: [lineItemSchema], subtotal: Number, taxAmount: Number,
  totalAmount: { type: Number, required: true, min: 0 }, currency: { type: String, default: 'INR' },
  invoiceDate: Date, dueDate: Date,
  status: { type: String, enum: ['pending_review', 'pending_approval', 'approved', 'paid', 'rejected', 'on_hold'], default: 'pending_review' },
  originalFileKey: String, originalFileUrl: String, ocrRawText: String,
  ocrExtractedData: { rawVendorName: String, rawInvoiceNumber: String, rawDate: String, rawTotal: String, currency: String, rawLineItems: [mongoose.Schema.Types.Mixed] },
  discrepancies: [discrepancySchema], hasDiscrepancies: { type: Boolean, default: false }, exceptionNotes: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date, rejectedAt: Date, rejectionReason: String, comments: [commentSchema],
  holdReason: String,
  holdFromStatus: { type: String, enum: ['pending_approval', 'approved'] },
  razorpayOrderId: String, razorpayPaymentId: String,
  paymentStatus: { type: String, enum: ['unpaid', 'processing', 'paid', 'failed'], default: 'unpaid' },
  paymentInitiatedAt: Date, paidAt: Date, paymentAttempts: [paymentAttemptSchema], reminderCount: { type: Number, default: 0 },
  lastReminderSentAt: Date, isOverdue: { type: Boolean, default: false },
}, { timestamps: true });

invoiceSchema.index({ invoiceNumber: 'text' });
invoiceSchema.index({ vendor: 1, status: 1 });
invoiceSchema.index({ dueDate: 1, paymentStatus: 1 });
export default mongoose.model('Invoice', invoiceSchema);
