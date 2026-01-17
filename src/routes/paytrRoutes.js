import { Router } from 'express';
const router = Router();
import { createPaymentToken, paytrCallback, checkPaymentStatus, testPayment } from '../controller/paytrController.js';
import { protect } from '../middleware/authMiddleware.js';


router.post('/create-payment', protect, createPaymentToken);

router.post('/callback', paytrCallback);

router.get('/status/:orderId', protect, checkPaymentStatus);

router.post('/test', testPayment);

export default router;