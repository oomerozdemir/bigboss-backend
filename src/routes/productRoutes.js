import { Router } from 'express';
import {
    getAllProducts,
    createProduct,
    deleteProduct,
    updateProduct,
    getProductById,
    deleteProductsBulk,
    addProductsToCategoryBulk,
    updateProductStatus,
    bulkUpdateProducts,
    getBulkProducts,
    incrementViewCount,
    incrementCartCount
} from '../controller/productController.js';
import { protectAdmin, protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

// Listeleme Rotaları
router.get('/', getAllProducts);
router.get('/bulk-list', protect, protectAdmin, getBulkProducts);

// Toplu İşlem Rotaları
router.post('/bulk-update', protect, protectAdmin, bulkUpdateProducts);
router.post('/bulk-delete', protect, protectAdmin, deleteProductsBulk);        
router.post('/bulk-category', protect, protectAdmin, addProductsToCategoryBulk); 

// ✅ ÜRÜN OLUŞTURMA - upload.any() kullan (varyant resimleri için)
router.post('/', protect, protectAdmin, upload.any(), createProduct);

// Detay
router.get('/:id', getProductById);

// İstatistik Sayaçları (herkese açık, fire-and-forget)
router.post('/:id/view', incrementViewCount);
router.post('/:id/cart-add', incrementCartCount);

// ✅ ÜRÜN GÜNCELLEME - upload.any() kullan (tutarlılık için)
router.put('/:id', protect, protectAdmin, upload.any(), updateProduct);

// Silme
router.delete('/:id', protectAdmin, deleteProduct);

// Durum Güncelleme
router.patch('/:id/status', protectAdmin, updateProductStatus);

export default router;