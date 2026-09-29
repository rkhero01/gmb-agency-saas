import { env } from '../config/env.js';
import { checkDatabaseHealth } from '../config/database.js';

const startTime = Date.now();

/**
 * Health check controller
 * GET /api/v1/health
 */
export async function getHealth(req, res, next) {
  try {
    const dbHealth = await checkDatabaseHealth();

    const healthData = {
      status: 'healthy',
      app: env.APP_NAME,
      version: '0.1.0',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        nodeVersion: process.version,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      services: {
        database: {
          type: 'PostgreSQL',
          connected: dbHealth.connected,
          message: dbHealth.message,
        },
      },
    };

    res.status(200).json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    next(error);
  }
}
