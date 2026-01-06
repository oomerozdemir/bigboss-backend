import express from 'express';
import * as addressController from '../controller/addressController.js'; 
import { protect } from '../middleware/authMiddleware.js'; // DÜZELTME: { protect } olarak import edildi

const router = express.Router();

// Tüm rotalar korumalı (protect middleware'i ile)
router.get('/', protect, addressController.getAddresses);
router.post('/', protect, addressController.addAddress);
router.delete('/:id', protect, addressController.deleteAddress);

export default router;