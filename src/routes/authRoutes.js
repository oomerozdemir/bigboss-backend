import { Router } from 'express';
import { register, login, adminLogin } from '../controller/authController.js';

const router = Router();

// Kayıt ol rotası: POST /api/auth/register
router.post('/register', register);

// Giriş yap rotası: POST /api/auth/login
router.post('/login', login);

router.post('/admin-login', adminLogin);

export default router;