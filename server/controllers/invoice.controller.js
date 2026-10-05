import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.model.js';
import Vendor from '../models/Vendor.model.js';
import PurchaseOrder from '../models/PurchaseOrder.model.js';
import AuditLog from '../models/AuditLog.model.js';
import ApiError from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';
import { extractInvoiceData } from '../services/ocrService.js';
import { compareInvoiceToPurchaseOrder } from '../services/matchingService.js';
import { removeInvoiceFile, saveInvoiceFile, streamStoredInvoiceFile } from '../services/invoiceFileStorage.js';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

export async function createInvoice(req, res, next) {
  let fileSaved = false;
  let storedFileId;
  try {
    if (!req.file) throw new ApiError(400, 'Choose an invoice file to upload');
    if (!validId(req.body.vendorId)) throw new ApiError(400, 'Choose a valid vendor');
    const vendor = await Vendor.findById(req.body.vendorId);
    if (!vendor) throw new ApiError(404, 'Vendor not found');

    let purchaseOrder = null;
    if (req.body.purchaseOrderId) {
      if (!validId(req.body.purchaseOrderId)) throw new ApiError(400, 'Purchase order ID is invalid');
      purchaseOrder = await PurchaseOrder.findById(req.body.purchaseOrderId);
      if (!purchaseOrder) throw new ApiError(404, 'Purchase order not found');
      if (!purchaseOrder.vendor.equals(vendor._id)) throw new ApiError(400, 'Purchase order belongs to a different vendor');
    }

    const { extractedData, rawText } = await extractInvoiceData(req.file.path, req.file.mimetype);
    const invoiceNumber = String(req.body.invoiceNumber || extractedData.invoiceNumber || '').trim();
    const amountInput = req.body.totalAmount ?? extractedData.totalAmount;
    const totalAmount = Number(amountInput);
    if (!invoiceNumber) throw new ApiError(422, 'Could not read an invoice number. Add one and try again.');
    if (!Number.isFinite(totalAmount) || totalAmount < 0) throw new ApiError(422, 'Could not read the invoice total. Add a valid amount and try again.');

    const invoiceData = {
      vendor: vendor._id,
      purchaseOrder: purchaseOrder?._id,
      invoiceNumber,
      invoiceDate: req.body.invoiceDate || extractedData.invoiceDate || undefined,
      dueDate: req.body.dueDate || extractedData.dueDate || undefined,
      totalAmount,
      subtotal: req.body.subtotal === undefined ? undefined : Number(req.body.subtotal),
      taxAmount: req.body.taxAmount === undefined ? undefined : Number(req.body.taxAmount),
      currency: req.body.currency || extractedData.currency || 'INR',
      lineItems: req.body.lineItems ? JSON.parse(req.body.lineItems) : [],
    };
    const match = purchaseOrder ? compareInvoiceToPurchaseOrder(invoiceData, purchaseOrder) : { discrepancies: [], hasDiscrepancies: false };
    storedFileId = await saveInvoiceFile(req.file.path, req.file.originalname, req.file.mimetype);
    await fs.unlink(req.file.path).catch(() => {});
    const invoice = await Invoice.create({
      ...invoiceData,
      ...match,
      status: match.hasDiscrepancies ? 'pending_review' : 'pending_approval',
      uploadedBy: req.user._id,
      originalFileKey: storedFileId,
      ocrRawText: rawText,
      ocrExtractedData: extractedData,
    });
    fileSaved = true;
    invoice.originalFileUrl = `/api/invoices/${invoice._id}/file`;
    await invoice.save();
    await AuditLog.create({
      entityType: 'Invoice', entityId: invoice._id, action: 'INVOICE_UPLOADED', performedBy: req.user._id,
      description: `Invoice ${invoice.invoiceNumber} uploaded for ${vendor.companyName}`,
      metadata: { status: invoice.status, hasDiscrepancies: invoice.hasDiscrepancies },
      ipAddress: req.ip, userAgent: req.get('user-agent'),
    });
    sendResponse(res, 201, 'Invoice uploaded and extracted', { invoice, extractedData, discrepancies: match.discrepancies });
  } catch (error) {
    if (!fileSaved && storedFileId) await removeInvoiceFile(storedFileId);
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    next(error);
  }
}

export async function listInvoices(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const query = {};
    if (req.query.status) {
      const statuses = String(req.query.status).split(',').filter((status) => Invoice.schema.path('status').enumValues.includes(status));
      if (!statuses.length) throw new ApiError(400, 'Status filter is not valid');
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (req.query.vendorId) {
      if (!validId(req.query.vendorId)) throw new ApiError(400, 'Vendor ID is invalid');
      query.vendor = req.query.vendorId;
    }
    if (req.query.search) query.invoiceNumber = { $regex: String(req.query.search).slice(0, 80), $options: 'i' };
    if (req.query.startDate || req.query.endDate) {
      query.invoiceDate = {};
      if (req.query.startDate && !Number.isNaN(Date.parse(req.query.startDate))) query.invoiceDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate && !Number.isNaN(Date.parse(req.query.endDate))) query.invoiceDate.$lte = new Date(req.query.endDate);
    }
    const allowedSort = ['createdAt', 'invoiceDate', 'dueDate', 'totalAmount', 'invoiceNumber', 'status'];
    const sortBy = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const [invoices, total] = await Promise.all([
      Invoice.find(query).populate('vendor', 'companyName email').populate('uploadedBy', 'name role').populate('approvedBy', 'name')
        .sort({ [sortBy]: sortOrder }).skip((page - 1) * limit).limit(limit),
      Invoice.countDocuments(query),
    ]);
    sendResponse(res, 200, 'Invoices loaded', { invoices, total, page, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
}

export async function getInvoice(req, res, next) {
  try {
    if (!validId(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const invoice = await Invoice.findById(req.params.id)
      .populate('vendor').populate('purchaseOrder').populate('uploadedBy', 'name role email')
      .populate('reviewedBy', 'name').populate('approvedBy', 'name').populate('rejectedBy', 'name')
      .populate('comments.author', 'name role');
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    sendResponse(res, 200, 'Invoice loaded', { invoice });
  } catch (error) { next(error); }
}

export async function listApprovalQueue(req, res, next) {
  try {
    const invoices = await Invoice.find({ status: 'pending_approval' })
      .populate('vendor', 'companyName email').populate('uploadedBy', 'name role')
      .sort({ createdAt: 1 }).limit(100);
    sendResponse(res, 200, 'Approval queue loaded', { invoices });
  } catch (error) { next(error); }
}

export async function decideInvoice(req, res, next) {
  try {
    if (!validId(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const decision = req.body.decision;
    const comment = String(req.body.comment || '').trim();
    if (!['approve', 'reject'].includes(decision)) throw new ApiError(400, 'Choose approve or reject');
    if (!comment) throw new ApiError(400, 'Add a comment explaining your decision');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status !== 'pending_approval') throw new ApiError(409, 'This invoice is no longer waiting for approval');
    invoice.comments.push({ author: req.user._id, text: comment });
    if (decision === 'approve') {
      invoice.status = 'approved'; invoice.approvedBy = req.user._id; invoice.approvedAt = new Date();
      invoice.rejectedBy = undefined; invoice.rejectedAt = undefined; invoice.rejectionReason = undefined;
    } else {
      invoice.status = 'rejected'; invoice.rejectedBy = req.user._id; invoice.rejectedAt = new Date(); invoice.rejectionReason = comment;
      invoice.approvedBy = undefined; invoice.approvedAt = undefined;
    }
    await invoice.save();
    const action = decision === 'approve' ? 'INVOICE_APPROVED' : 'INVOICE_REJECTED';
    await AuditLog.create({ entityType: 'Invoice', entityId: invoice._id, action, performedBy: req.user._id,
      description: `${invoice.invoiceNumber} ${decision === 'approve' ? 'approved' : 'rejected'}`, metadata: { comment }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendResponse(res, 200, `Invoice ${decision === 'approve' ? 'approved' : 'rejected'}`, { invoice });
  } catch (error) { next(error); }
}

export async function placeInvoiceOnHold(req, res, next) {
  try {
    if (!validId(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const reason = String(req.body.reason || '').trim();
    if (!reason) throw new ApiError(400, 'Add a reason for placing this invoice on hold');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (!['pending_approval', 'approved'].includes(invoice.status)) throw new ApiError(409, 'Only pending or approved invoices can be put on hold');
    invoice.holdFromStatus = invoice.status;
    invoice.status = 'on_hold';
    invoice.holdReason = reason;
    invoice.comments.push({ author: req.user._id, text: `Placed on hold: ${reason}` });
    await invoice.save();
    await AuditLog.create({ entityType: 'Invoice', entityId: invoice._id, action: 'INVOICE_PUT_ON_HOLD', performedBy: req.user._id,
      description: `${invoice.invoiceNumber} put on hold`, metadata: { reason, previousStatus: invoice.holdFromStatus }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendResponse(res, 200, 'Invoice placed on hold', { invoice });
  } catch (error) { next(error); }
}

export async function releaseInvoiceHold(req, res, next) {
  try {
    if (!validId(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status !== 'on_hold') throw new ApiError(409, 'This invoice is not on hold');
    const reason = String(req.body.reason || '').trim();
    invoice.status = invoice.holdFromStatus || 'pending_approval';
    invoice.comments.push({ author: req.user._id, text: reason ? `Hold released: ${reason}` : 'Hold released; invoice returned to its previous step.' });
    const previousReason = invoice.holdReason;
    invoice.holdReason = undefined;
    invoice.holdFromStatus = undefined;
    await invoice.save();
    await AuditLog.create({ entityType: 'Invoice', entityId: invoice._id, action: 'INVOICE_HOLD_RELEASED', performedBy: req.user._id,
      description: `${invoice.invoiceNumber} returned to ${invoice.status.replaceAll('_', ' ')}`, metadata: { previousReason, releaseReason: reason, status: invoice.status }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendResponse(res, 200, 'Invoice hold released', { invoice });
  } catch (error) { next(error); }
}

export async function getInvoiceHistory(req, res, next) {
  try {
    if (!validId(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const logs = await AuditLog.find({ entityType: 'Invoice', entityId: req.params.id })
      .populate('performedBy', 'name role').sort({ createdAt: 1 });
    sendResponse(res, 200, 'Invoice history loaded', { history: logs });
  } catch (error) { next(error); }
}

export async function updateInvoice(req, res, next) {
  try {
    if (!validId(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (!['clerk', 'admin'].includes(req.user.role)) throw new ApiError(403, 'Only clerks or admins can edit invoice details');
    if (!['pending_review', 'pending_approval', 'rejected'].includes(invoice.status)) throw new ApiError(409, 'This invoice can no longer be edited');
    if (req.user.role === 'clerk' && !invoice.uploadedBy.equals(req.user._id)) throw new ApiError(403, 'You can only edit invoices you uploaded');
    if (req.body.vendorId !== undefined) {
      if (!validId(req.body.vendorId)) throw new ApiError(400, 'Vendor ID is invalid');
      const vendor = await Vendor.findById(req.body.vendorId);
      if (!vendor) throw new ApiError(404, 'Vendor not found');
      if (!invoice.vendor.equals(vendor._id)) {
        invoice.vendor = vendor._id;
        invoice.purchaseOrder = undefined;
        invoice.discrepancies = [];
        invoice.hasDiscrepancies = false;
      }
    }
    const editable = ['invoiceNumber', 'invoiceDate', 'dueDate', 'subtotal', 'taxAmount', 'totalAmount', 'currency', 'lineItems', 'exceptionNotes'];
    for (const field of editable) if (req.body[field] !== undefined) invoice[field] = req.body[field];
    if (invoice.purchaseOrder) {
      const purchaseOrder = await PurchaseOrder.findById(invoice.purchaseOrder);
      const match = compareInvoiceToPurchaseOrder(invoice, purchaseOrder);
      invoice.discrepancies = match.discrepancies;
      invoice.hasDiscrepancies = match.hasDiscrepancies;
    }
    const isSubmission = req.body.submitForApproval === true || req.body.submitForApproval === 'true';
    const wasRejected = invoice.status === 'rejected';
    if (isSubmission) {
      if (req.user.role !== 'clerk' && req.user.role !== 'admin') throw new ApiError(403, 'Only the submitting team can resubmit an invoice');
      if (invoice.hasDiscrepancies && !String(invoice.exceptionNotes || '').trim()) {
        throw new ApiError(400, 'Add exception notes before sending this invoice for approval');
      }
      invoice.status = 'pending_approval';
      invoice.reviewedBy = req.user._id;
      invoice.rejectedBy = undefined; invoice.rejectedAt = undefined; invoice.rejectionReason = undefined;
      invoice.comments.push({ author: req.user._id, text: 'Invoice corrected and resubmitted for approval.' });
    }
    await invoice.save();
    await AuditLog.create({
      entityType: 'Invoice', entityId: invoice._id,
      action: isSubmission ? (wasRejected ? 'INVOICE_RESUBMITTED' : 'INVOICE_SUBMITTED_FOR_APPROVAL') : 'INVOICE_UPDATED',
      performedBy: req.user._id, description: isSubmission ? `Invoice ${invoice.invoiceNumber} ${wasRejected ? 'resubmitted' : 'submitted for approval'}` : `Invoice ${invoice.invoiceNumber} updated`,
      metadata: { status: invoice.status }, ipAddress: req.ip, userAgent: req.get('user-agent'),
    });
    sendResponse(res, 200, 'Invoice updated', { invoice });
  } catch (error) { next(error); }
}

export async function streamInvoiceFile(req, res, next) {
  try {
    if (!validId(req.params.id)) throw new ApiError(400, 'Invoice ID is invalid');
    const invoice = await Invoice.findById(req.params.id).select('originalFileKey invoiceNumber');
    if (!invoice?.originalFileKey) throw new ApiError(404, 'Invoice file not found');
    if (mongoose.Types.ObjectId.isValid(invoice.originalFileKey)) return streamStoredInvoiceFile(invoice.originalFileKey, res, next);
    const filePath = path.join(uploadDirectory, path.basename(invoice.originalFileKey));
    res.type(path.extname(invoice.originalFileKey).toLowerCase() === '.pdf' ? 'application/pdf' : path.extname(invoice.originalFileKey).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(invoice.invoiceNumber)}"`);
    res.sendFile(filePath, (error) => { if (error) next(error); });
  } catch (error) { next(error); }
}
