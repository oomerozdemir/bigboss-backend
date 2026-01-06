import express from 'express';
import * as orderController from '../controller/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, orderController.createOrder); // Sipariş Ver
router.get('/', protect, orderController.getMyOrders);  // Siparişleri Gör

export default router;