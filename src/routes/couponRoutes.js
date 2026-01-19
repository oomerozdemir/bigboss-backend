import express from 'express';
import * as couponController from '../controller/couponController.js';
import { protect, protectAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin İşlemleri
router.post('/', protectAdmin, couponController.createCoupon);
router.get('/', protectAdmin, couponController.getAllCoupons);
router.delete('/:id', protectAdmin, couponController.deleteCoupon);

router.put('/:id', protectAdmin, couponController.updateCoupon); 

router.post('/validate', couponController.validateCoupon);

export default router;