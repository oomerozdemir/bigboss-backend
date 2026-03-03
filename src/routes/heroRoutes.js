import { Router } from 'express';
import {
  getHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  toggleHeroSlide,
  reorderSlides,
  getSiteContent,
  upsertSiteContent,
} from '../controller/heroController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

// Public
router.get('/slides', getHeroSlides);
router.get('/content', getSiteContent);

// Admin only
router.post('/slides', protectAdmin, upload.single('image'), createHeroSlide);
router.put('/slides/:id', protectAdmin, upload.single('image'), updateHeroSlide);
router.delete('/slides/:id', protectAdmin, deleteHeroSlide);
router.patch('/slides/:id/toggle', protectAdmin, toggleHeroSlide);
router.post('/slides/reorder', protectAdmin, reorderSlides);
router.post('/content', protectAdmin, upsertSiteContent);

export default router;
