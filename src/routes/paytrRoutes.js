import { Router } from 'express';
const router = Router();
import { 
    createPaymentToken, 
    paytrCallback,
    handleFailRedirect,
    handleSuccessRedirect,
    getOrderStatus
} from '../controller/paytrController.js';
import { protect } from '../middleware/authMiddleware.js';

// Token oluşturma (protected)
router.post('/create-payment', protect, createPaymentToken);

router.post('/callback', paytrCallback);
router.get('/callback', paytrCallback); // ✅ GET eklendi

router.post('/success-redirect', handleSuccessRedirect);
router.get('/success-redirect', handleSuccessRedirect); 
router.post('/fail-redirect', handleFailRedirect);
router.get('/fail-redirect', handleFailRedirect);

// Sipariş Durumu Sorgulama (Frontend için)
router.get('/status/:orderId', getOrderStatus);

export default router;