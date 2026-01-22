import { Router } from 'express';
import { getAllProducts, createProduct, deleteProduct, updateProduct, getProductById,
    deleteProductsBulk, addProductsToCategoryBulk, updateProductStatus, bulkUpdateProducts, getBulkProducts
 } from '../controller/productController.js'; 
import { protectAdmin, protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);

router.post('/', protectAdmin, upload.any(), createProduct); 
router.put('/:id', protectAdmin, upload.any(), updateProduct);

router.delete('/:id', protectAdmin, deleteProduct);

router.post('/bulk-update', protect, protectAdmin, bulkUpdateProducts);

router.post('/bulk-delete', protectAdmin, deleteProductsBulk);
router.post('/bulk-category', protectAdmin, addProductsToCategoryBulk);
router.patch('/:id/status', protectAdmin, updateProductStatus);

router.get('/bulk-list', protect, protectAdmin, getBulkProducts);

// ✅ Toplu Güncelleme Rotası (Zaten vardı)
router.post('/bulk-update', protect, protectAdmin, bulkUpdateProducts);


export default router;