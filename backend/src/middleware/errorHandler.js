import { env } from '../config/env.js';

/**
 * Global Error Handler Middleware
 */
export function errorHandler(err, req, res, next) {
  // Prevent sending multiple responses if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  const isProd = env.IS_PRODUCTION;

  // Log error stack locally
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);
  if (!isProd && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected internal server error occurred.',
      ...(isProd ? {} : { stack: err.stack }),
    },
  });
}
