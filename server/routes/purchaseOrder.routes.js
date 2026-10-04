import { Router } from 'express';
import PurchaseOrder from '../models/PurchaseOrder.model.js';
import ApiError from '../utils/ApiError.js';
import { protect } from '../middleware/authMiddleware.js';
import { sendResponse } from '../utils/ApiResponse.js';
import mongoose from 'mongoose';

const router = Router();
router.use(protect);
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.vendorId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.vendorId)) throw new ApiError(400, 'Vendor ID is invalid');
      filter.vendor = req.query.vendorId;
    }
    if (req.query.status) filter.status = req.query.status;
    const purchaseOrders = await PurchaseOrder.find(filter).populate('vendor', 'companyName').sort({ createdAt: -1 }).limit(200);
    sendResponse(res, 200, 'Purchase orders loaded', { purchaseOrders });
  } catch (error) { next(error); }
});
export default router;
