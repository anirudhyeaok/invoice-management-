import { Router } from 'express';
import { body } from 'express-validator';
import { createVendor, getVendor, listVendors, updateVendor } from '../controllers/vendor.controller.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.use(protect);
router.get('/', listVendors);
router.get('/:id', getVendor);
router.post('/', authorize('admin', 'manager'), [
  body('companyName').trim().notEmpty(), body('contactName').trim().notEmpty(), body('email').isEmail().normalizeEmail(),
], validateRequest, createVendor);
router.patch('/:id', authorize('admin', 'manager'), [body('email').optional().isEmail().normalizeEmail()], validateRequest, updateVendor);
export default router;
