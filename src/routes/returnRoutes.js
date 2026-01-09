import express from 'express';
import * as returnController from '../controller/returnController.js';
import { protect, protectAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, returnController.createReturnRequest); // Kullanıcı
router.get('/', protectAdmin, returnController.getAllReturns);   // Admin
router.put('/:id', protectAdmin, returnController.processReturn); // Admin İşlem

export default router;