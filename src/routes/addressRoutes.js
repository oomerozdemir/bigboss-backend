import express from 'express';
import * as addressController from '../controller/addressController.js'; // .js uzantısı önemli!
import authMiddleware from '../middleware/authMiddleware.js'; // .js uzantısı önemli!

const router = express.Router();

// Tüm rotalar korumalı
router.get('/', authMiddleware, addressController.getAddresses);
router.post('/', authMiddleware, addressController.addAddress);
router.delete('/:id', authMiddleware, addressController.deleteAddress);

export default router;