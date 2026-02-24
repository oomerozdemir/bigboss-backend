import { Router } from 'express';
import { register, login, adminLogin, getAllUsers } from '../controller/authController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Kayıt ol rotası: POST /api/auth/register
router.post('/register', register);

// Giriş yap rotası: POST /api/auth/login
router.post('/login', login);

router.post('/admin-login', adminLogin);

// Tüm kullanıcılar (Admin): GET /api/auth/users
router.get('/users', protectAdmin, getAllUsers);

export default router;
