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
    getBulkProducts
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

// ANA ÜRÜN OLUŞTURMA
router.post('/', protect, protectAdmin, upload.any(), createProduct);


router.get('/:id', getProductById);
router.put('/:id', protect, protectAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 5 }]), updateProduct);
router.delete('/:id', protectAdmin, deleteProduct);
router.patch('/:id/status', protectAdmin, updateProductStatus);




export default router;