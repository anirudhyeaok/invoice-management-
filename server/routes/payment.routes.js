import { Router } from 'express';
import { recordDemoPayment } from '../controllers/payment.controller.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(protect, authorize('clerk', 'admin'));
router.post('/:id/record', recordDemoPayment);
export default router;
