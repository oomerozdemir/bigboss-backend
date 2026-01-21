import { Router } from 'express';
const router = Router();
import { 
    createPaymentToken, 
    paytrCallback, 
} from '../controller/paytrController.js';
import { protect } from '../middleware/authMiddleware.js';

router.post('/create-payment', protect, createPaymentToken);
router.post('/callback', paytrCallback);


export default router;