import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getProductReviews,
  createReview,
  deleteReview,
  canUserReview
} from '../controller/reviewController.js';

const router = express.Router();

// Herkese açık
router.get('/:productId', getProductReviews);

// Giriş yapmış kullanıcılar
router.get('/:productId/can-review', protect, canUserReview);
router.post('/:productId', protect, createReview);
router.delete('/:reviewId/delete', protect, deleteReview);

export default router;
