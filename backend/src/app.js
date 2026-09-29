import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration supporting single origin or wildcard in dev
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
      if (allowedOrigins.includes(origin) || !env.IS_PRODUCTION) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
  })
);

// Standard body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging in development
if (!env.IS_PRODUCTION) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });
}

// Direct root health endpoint (e.g. for cloud container orchestrators like Kubernetes/ECS)
app.use('/health', healthRoutes);

// Versioned API routes (/api/v1)
app.use(env.API_PREFIX, apiRoutes);

// Root path friendly response
app.get('/', (req, res) => {
  res.json({
    name: env.APP_NAME,
    status: 'online',
    version: '0.1.0',
    healthCheck: `${env.API_PREFIX}/health`,
  });
});

// 404 Handler
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

export default app;
