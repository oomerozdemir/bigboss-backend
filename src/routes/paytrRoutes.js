import { Router } from 'express';
const router = Router();
import { createPaymentToken, paytrCallback, checkPaymentStatus, testPayment } from '../controllers/paytrController';
import { protect } from '../middleware/authMiddleware'; 
router.post('/create-payment', protect, createPaymentToken);

router.post('/callback', paytrCallback);

router.get('/status/:orderId', protect, checkPaymentStatus);

router.post('/test', testPayment);

export default router;