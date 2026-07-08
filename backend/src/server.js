/**
 * server.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Application entry point.
 *
 * Startup sequence:
 *   1. Load and validate environment variables.
 *   2. Connect to Redis.
 *   3. Test MySQL connectivity.
 *   4. Start the HTTP server.
 *
 * If MySQL or Redis fails at startup, the process exits with code 1
 * (fail-fast — better to know immediately than serve broken requests).
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// Load env first — everything else depends on it
const env    = require('./config/env');
const logger = require('./logger/logger');
const app    = require('./app');

const { testConnection: testMySQL } = require('./config/mysql');
const redisClient                   = require('./config/redis');

async function bootstrap() {
  try {
    logger.info('🚀 Starting Stake Mine Backend…');

    // ── 1. Connect to Redis ──────────────────────────────────────────────────
    await redisClient.connect();

    // ── 2. Test MySQL connection ─────────────────────────────────────────────
    await testMySQL();

    // ── 3. Start HTTP server ─────────────────────────────────────────────────
    app.listen(env.PORT, () => {
      logger.info(`✅ Server running on http://localhost:${env.PORT}`);
      logger.info(`📡 Environment: ${env.NODE_ENV}`);
      logger.info(`🏥 Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (err) {
    logger.error(`❌ Failed to start server: ${err.message}`);
    process.exit(1); // Exit with failure code so Docker restarts the container
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully…');
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down gracefully…');
  await redisClient.quit();
  process.exit(0);
});

bootstrap();
