import express from 'express';
import { protect, protectAdmin } from '../middleware/authMiddleware.js';
import {
  syncCart,
  getCart,
  clearCart,
  triggerAbandonedCartReminders,
} from '../controller/cartController.js';

const router = express.Router();

// Kullanıcı sepet işlemleri
router.post('/sync', protect, syncCart);          // Sepeti kaydet / güncelle
router.get('/', protect, getCart);                // Sepeti getir
router.delete('/clear', protect, clearCart);      // Sepeti temizle

// Admin: terk edilmiş sepet hatırlatmalarını manuel tetikle
router.post('/reminders/trigger', protectAdmin, triggerAbandonedCartReminders);

export default router;
