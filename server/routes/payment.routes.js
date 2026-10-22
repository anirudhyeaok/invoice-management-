import { Router } from 'express';
import { recordPayment } from '../controllers/payment.controller.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(protect, authorize('clerk', 'admin'));
router.post('/:id/record', recordPayment);
export default router;
