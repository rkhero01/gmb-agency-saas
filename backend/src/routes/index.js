import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

// Mount sub-routers
router.use('/health', healthRoutes);

// Root API information endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'GMB Agency SaaS REST API',
    version: '0.1.0',
    documentation: '/docs',
    endpoints: {
      health: '/api/v1/health',
    },
  });
});

export default router;
