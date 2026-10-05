import { Router } from 'express';
import { exportInvoicesCsv } from '../controllers/report.controller.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(protect, authorize('manager', 'admin'));
router.get('/invoices.csv', exportInvoicesCsv);
export default router;
