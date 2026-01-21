import express from 'express';
import * as orderController from '../controller/orderController.js';
import { protect, protectAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, orderController.createOrder); // Sipariş Ver
router.get('/', protect, orderController.getMyOrders);  // Siparişleri Gör

router.get('/admin/all', protectAdmin, orderController.getAllOrders);

router.get('/payment-status/:orderId', protect, orderController.checkOrderPaymentStatus);

router.put('/admin/status/:id', protectAdmin, orderController.updateOrderStatus);

export default router;