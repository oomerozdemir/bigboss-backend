// routes/paytrRoutes.js - CALLBACK GET SUPPORT ADDED

import { Router } from 'express';
const router = Router();
import { 
    createPaymentToken, 
    paytrCallback
} from '../controller/paytrController.js';
import { protect } from '../middleware/authMiddleware.js';

// Token oluşturma (protected)
router.post('/create-payment', protect, createPaymentToken);

router.post('/callback', paytrCallback);
router.get('/callback', paytrCallback); // ✅ GET eklendi

export default router;