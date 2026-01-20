import { Router } from 'express';
const router = Router();
import { createPaymentToken, paytrCallback, checkPaymentStatus, testPayment, handlePaymentFail, handlePaymentSuccess } from '../controller/paytrController.js';
import { protect } from '../middleware/authMiddleware.js';


router.post('/create-payment', protect, createPaymentToken);

router.post('/callback', paytrCallback);

router.get('/status/:orderId', protect, checkPaymentStatus);

router.post('/test', testPayment);

router.all('/success', handlePaymentSuccess); 
router.all('/fail', handlePaymentFail);

export default router;