import { Router } from 'express';
import { exportProductsCsv, bulkImportProducts } from '../controller/bulkController.js';
import { protect, protectAdmin } from '../middleware/authMiddleware.js'; 
import upload from "../middleware/uploadMiddleware.js"

const router = Router();

// CSV İndir
router.get('/export', protect, protectAdmin, exportProductsCsv);

// Toplu Yükle (Resimlerle Birlikte)
router.post('/import', protect, protectAdmin, upload.any(), bulkImportProducts);

export default router;