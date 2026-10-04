import { Router } from 'express';
import { body } from 'express-validator';
import { createInvoice, decideInvoice, getInvoice, getInvoiceHistory, listApprovalQueue, listInvoices, placeInvoiceOnHold, releaseInvoiceHold, streamInvoiceFile, updateInvoice } from '../controllers/invoice.controller.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { invoiceUpload } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.use(protect);
router.get('/', listInvoices);
router.get('/approvals/queue', authorize('manager', 'admin'), listApprovalQueue);
router.post('/', authorize('clerk', 'admin'), invoiceUpload.single('file'), [
  body('vendorId').isMongoId().withMessage('Choose a vendor'),
  body('totalAmount').optional().isFloat({ min: 0 }),
], validateRequest, createInvoice);
router.get('/:id/file', streamInvoiceFile);
router.get('/:id/history', getInvoiceHistory);
router.post('/:id/decision', authorize('manager', 'admin'), [body('decision').isIn(['approve', 'reject']), body('comment').trim().notEmpty().isLength({ max: 2000 })], validateRequest, decideInvoice);
router.post('/:id/hold', authorize('manager', 'admin'), [body('reason').trim().notEmpty().isLength({ max: 2000 })], validateRequest, placeInvoiceOnHold);
router.post('/:id/release-hold', authorize('manager', 'admin'), [body('reason').optional().trim().isLength({ max: 2000 })], validateRequest, releaseInvoiceHold);
router.get('/:id', getInvoice);
router.patch('/:id', [
  body('invoiceNumber').optional().trim().notEmpty(),
  body('totalAmount').optional().isFloat({ min: 0 }),
], validateRequest, updateInvoice);
export default router;
