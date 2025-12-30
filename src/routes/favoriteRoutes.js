import { Router } from 'express';
import { toggleFavorite, getFavorites } from '../controller/favoriteController.js';
import { protect } from '../middleware/authMiddleware.js'; 
const router = Router();

// İki işlem de giriş yapmış kullanıcı gerektirir (protect)
router.post('/toggle', protect, toggleFavorite);
router.get('/', protect, getFavorites);

export default router;