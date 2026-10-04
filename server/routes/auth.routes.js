import { Router } from 'express';
import { body } from 'express-validator';
import { getMe, listUsers, login, logout, register, setupStatus } from '../controllers/auth.controller.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = Router();
const emailRule = body('email').isEmail().withMessage('Enter a valid email').normalizeEmail();

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  emailRule,
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['clerk', 'manager', 'admin']),
], protect, authorize('admin'), register);
router.get('/setup-status', setupStatus);
router.post('/login', [emailRule, body('password').notEmpty().withMessage('Password is required')], login);
router.post('/logout', protect, logout);
router.get('/users', protect, authorize('admin'), listUsers);
router.get('/me', protect, getMe);
export default router;
