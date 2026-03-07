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
    incrementCartCount,
    toggleFlashSale
} from '../controller/productController.js';
import { getCombinations, addCombination, removeCombination } from '../controller/combinationController.js';
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

// Flash Sale Toggle
router.patch('/:id/toggle-flash-sale', protect, protectAdmin, toggleFlashSale);

// Kombin Önerisi
router.get('/:id/combinations', getCombinations);
router.post('/:id/combinations', protect, protectAdmin, addCombination);
router.delete('/:id/combinations/:combinedId', protect, protectAdmin, removeCombination);

export default router;