import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import teamRoutes from './team.routes.js';
import clientRoutes from './client.routes.js';
import locationRoutes from './location.routes.js';
import googleRoutes from './google.routes.js';

const router = Router();

// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/team', teamRoutes);
router.use('/clients', clientRoutes);
router.use('/locations', locationRoutes);
router.use('/google', googleRoutes);

// Root API information endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'GMB Agency SaaS REST API',
    version: '0.4.0',
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
      clients: {
        list: '/api/v1/clients',
        create: '/api/v1/clients',
        get: '/api/v1/clients/:clientId',
        update: '/api/v1/clients/:clientId',
        delete: '/api/v1/clients/:clientId',
        locations: '/api/v1/clients/:clientId/locations',
      },
      locations: {
        listByClient: '/api/v1/clients/:clientId/locations',
        createForClient: '/api/v1/clients/:clientId/locations',
        create: '/api/v1/locations',
        get: '/api/v1/locations/:locationId',
        update: '/api/v1/locations/:locationId',
        delete: '/api/v1/locations/:locationId',
      },
      google: {
        connect: '/api/v1/google/connect',
        callback: '/api/v1/google/callback',
        status: '/api/v1/google/status',
        accounts: '/api/v1/google/accounts',
        locations: '/api/v1/google/locations',
        linkLocation: '/api/v1/google/locations/:locationId/link',
        disconnect: '/api/v1/google/disconnect',
      },
    },
  });
});

export default router;
