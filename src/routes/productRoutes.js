import { Router } from 'express';
import { getAllProducts, createProduct, deleteProduct, updateProduct, getProductById } from '../controller/productController.js'; 
import { protectAdmin } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);

router.post('/', protectAdmin, upload.any(), createProduct); 
router.put('/:id', protectAdmin, upload.any(), updateProduct);

router.delete('/:id', protectAdmin, deleteProduct);


export default router;