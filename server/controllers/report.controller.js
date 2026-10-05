import Invoice from '../models/Invoice.model.js';
import ApiError from '../utils/ApiError.js';

function makeFilter(queryParams) {
  const filter = {};
  if (queryParams.status) {
    const statuses = String(queryParams.status).split(',').map((value) => value.trim()).filter(Boolean);
    const allowed = Invoice.schema.path('status').enumValues;
    if (statuses.some((status) => !allowed.includes(status))) throw new ApiError(400, 'Choose a valid invoice status');
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  if (queryParams.startDate || queryParams.endDate) {
    const dates = {};
    if (queryParams.startDate) {
      const start = new Date(queryParams.startDate);
      if (Number.isNaN(start.getTime())) throw new ApiError(400, 'Start date is invalid');
      start.setHours(0, 0, 0, 0);
      dates.$gte = start;
    }
    if (queryParams.endDate) {
      const end = new Date(queryParams.endDate);
      if (Number.isNaN(end.getTime())) throw new ApiError(400, 'End date is invalid');
      end.setHours(23, 59, 59, 999);
      dates.$lte = end;
    }
    if (dates.$gte && dates.$lte && dates.$gte > dates.$lte) throw new ApiError(400, 'Start date must be before end date');
    filter.invoiceDate = dates;
  }
  return filter;
}

function csvCell(value) {
  let text = value == null ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportInvoicesCsv(req, res, next) {
  try {
    const filter = makeFilter(req.query);
    const invoices = await Invoice.find(filter)
      .populate('vendor', 'companyName email')
      .populate('purchaseOrder', 'poNumber')
      .populate('uploadedBy', 'name email role')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ invoiceDate: -1, createdAt: -1 }).lean();
    const columns = [
      ['Invoice Number', (invoice) => invoice.invoiceNumber],
      ['Vendor', (invoice) => invoice.vendor?.companyName],
      ['Vendor Email', (invoice) => invoice.vendor?.email],
      ['Invoice Date', (invoice) => invoice.invoiceDate],
      ['Due Date', (invoice) => invoice.dueDate],
      ['Currency', (invoice) => invoice.currency],
      ['Invoice Total', (invoice) => invoice.totalAmount],
      ['Invoice Status', (invoice) => invoice.status],
      ['Payment Status', (invoice) => invoice.paymentStatus],
      ['Purchase Order', (invoice) => invoice.purchaseOrder?.poNumber],
      ['Exception Notes', (invoice) => invoice.exceptionNotes],
      ['Hold Reason', (invoice) => invoice.holdReason],
      ['Uploaded By', (invoice) => invoice.uploadedBy?.name],
      ['Uploaded By Role', (invoice) => invoice.uploadedBy?.role],
      ['Approved By', (invoice) => invoice.approvedBy?.name],
      ['Approved At', (invoice) => invoice.approvedAt],
      ['Rejected By', (invoice) => invoice.rejectedBy?.name],
      ['Rejected At', (invoice) => invoice.rejectedAt],
      ['Rejection Reason', (invoice) => invoice.rejectionReason],
      ['Line Items', (invoice) => JSON.stringify(invoice.lineItems || [])],
      ['Purchase Order Differences', (invoice) => JSON.stringify(invoice.discrepancies || [])],
      ['Team Comments', (invoice) => JSON.stringify(invoice.comments || [])],
      ['Payment Attempts', (invoice) => JSON.stringify(invoice.paymentAttempts || [])],
      ['Payment Provider Order ID', (invoice) => invoice.razorpayOrderId],
      ['Payment Provider Payment ID', (invoice) => invoice.razorpayPaymentId],
      ['Payment Initiated At', (invoice) => invoice.paymentInitiatedAt],
      ['Paid At', (invoice) => invoice.paidAt],
      ['Uploaded At', (invoice) => invoice.createdAt],
      ['Updated At', (invoice) => invoice.updatedAt],
    ];
    const lines = [columns.map(([title]) => csvCell(title)).join(',')];
    for (const invoice of invoices) lines.push(columns.map(([, read]) => csvCell(read(invoice))).join(','));
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-report-${date}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(`\uFEFF${lines.join('\r\n')}`);
  } catch (error) { next(error); }
}
