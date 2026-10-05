import { Router } from 'express';
import { body } from 'express-validator';
import { createPaymentOrder, getPaymentGatewayConfig, markPaymentAttemptFailed, verifyPayment } from '../controllers/payment.controller.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.use(protect, authorize('clerk', 'admin'));
router.get('/config', getPaymentGatewayConfig);
router.post('/:id/order', createPaymentOrder);
router.post('/:id/verify', [body('razorpay_payment_id').trim().notEmpty(), body('razorpay_order_id').trim().notEmpty(), body('razorpay_signature').trim().notEmpty()], validateRequest, verifyPayment);
router.post('/:id/failed', [body('orderId').trim().notEmpty(), body('message').optional().trim().isLength({ max: 250 })], validateRequest, markPaymentAttemptFailed);
export default router;
