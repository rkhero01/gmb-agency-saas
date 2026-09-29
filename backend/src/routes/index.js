import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import teamRoutes from './team.routes.js';

const router = Router();

// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/team', teamRoutes);

// Root API information endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'GMB Agency SaaS REST API',
    version: '0.2.0',
    documentation: '/docs',
    endpoints: {
      health: '/api/v1/health',
      auth: {
        login: '/api/v1/auth/login',
        register: '/api/v1/auth/register',
        me: '/api/v1/auth/me',
        logout: '/api/v1/auth/logout',
      },
      team: {
        list: '/api/v1/team',
        invite: '/api/v1/team/invite',
        updateRole: '/api/v1/team/:userId/role',
        updateStatus: '/api/v1/team/:userId/status',
      },
    },
  });
});

export default router;
