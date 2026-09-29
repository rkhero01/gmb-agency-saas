import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';

const server = app.listen(env.PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 ${env.APP_NAME} running`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 API listening on: http://localhost:${env.PORT}`);
  console.log(`🩺 Health check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  console.log(`=========================================`);
});

// Graceful shutdown handling
function handleGracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('Database pool drained.');
    } catch (err) {
      console.error('Error closing database pool:', err.message);
    }
    process.exit(0);
  });

  // Force shutdown if taking longer than 10 seconds
  setTimeout(() => {
    console.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});
