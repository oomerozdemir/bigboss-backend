import { Router } from 'express';
import { 
    getAllCategories, 
    createMainCategory, 
    createSubCategory,
    deleteMainCategory,
    deleteSubCategory,
    updateMainCategory,
    updateSubCategory
} from '../controller/categoryController.js';
import { protectAdmin } from '../middleware/authMiddleware.js'; 

const router = Router();

// GET
router.get('/', getAllCategories);

// POST 
router.post('/main', protectAdmin, createMainCategory);
router.post('/sub', protectAdmin, createSubCategory);

// DELETE  
router.delete('/main/:id', protectAdmin, deleteMainCategory);
router.delete('/sub/:id', protectAdmin, deleteSubCategory);

// PUT 
router.put('/main/:id', protectAdmin, updateMainCategory);
router.put('/sub/:id', protectAdmin, updateSubCategory);
export default router;