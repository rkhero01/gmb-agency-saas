import { Router } from 'express';
import { login, logout, getMe, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public Authentication Endpoints
router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);

// Protected Authentication Endpoints
router.get('/me', authenticate, getMe);

export default router;
