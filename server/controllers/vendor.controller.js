import mongoose from 'mongoose';
import Vendor from '../models/Vendor.model.js';
import AuditLog from '../models/AuditLog.model.js';
import ApiError from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';

export async function listVendors(req, res, next) {
  try {
    const query = {};
    if (req.query.status && ['active', 'inactive', 'blacklisted'].includes(req.query.status)) query.status = req.query.status;
    if (req.query.search) query.$or = [
      { companyName: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
      { contactName: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
    ];
    const vendors = await Vendor.find(query).sort({ companyName: 1 }).limit(200);
    sendResponse(res, 200, 'Vendors loaded', { vendors });
  } catch (error) { next(error); }
}

export async function getVendor(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, 'Vendor ID is invalid');
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    sendResponse(res, 200, 'Vendor loaded', { vendor });
  } catch (error) { next(error); }
}

export async function createVendor(req, res, next) {
  try {
    const vendor = await Vendor.create(req.body);
    await AuditLog.create({ entityType: 'Vendor', entityId: vendor._id, action: 'VENDOR_CREATED', performedBy: req.user._id,
      description: `Vendor ${vendor.companyName} created`, ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendResponse(res, 201, 'Vendor created', { vendor });
  } catch (error) { next(error); }
}

export async function updateVendor(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, 'Vendor ID is invalid');
    const allowed = ['companyName', 'contactName', 'email', 'phone', 'gstin', 'panNumber', 'bankDetails', 'address', 'status', 'paymentTerms', 'notes'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    await AuditLog.create({ entityType: 'Vendor', entityId: vendor._id,
      action: vendor.status === 'blacklisted' ? 'VENDOR_BLACKLISTED' : 'VENDOR_UPDATED', performedBy: req.user._id,
      description: `Vendor ${vendor.companyName} updated`, ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendResponse(res, 200, 'Vendor updated', { vendor });
  } catch (error) { next(error); }
}
