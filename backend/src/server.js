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
const { runStartupMigrations }      = require('./config/migrate');
const redisClient                   = require('./config/redis');
const gameRepository                = require('./repositories/game.repository');
const cacheRepository               = require('./repositories/cache.repository');

// ── Expiry cron — runs every 60 s, expires stale ACTIVE games ────────────────
function startExpiryCron() {
  setInterval(async () => {
    try {
      const expired = await gameRepository.findExpiredActiveGames();
      for (const game of expired) {
        await gameRepository.settleGameExpired(game.game_uuid);
        await cacheRepository.deleteGameState(game.game_uuid);
        await cacheRepository.deleteActiveGamePointer(game.user_id);
        await gameRepository.insertHistory({
          game_uuid:         game.game_uuid,
          user_id:           game.user_id,
          bet_amount_paise:  game.bet_amount_paise,
          payout_paise:      0,
          profit_loss_paise: -game.bet_amount_paise,
          mine_count:        0,
          cells_revealed:    0,
          final_multiplier:  1.0,
          outcome:           'LOSS',
          slot_id:           null,
        });
        logger.info(`[Cron] Expired game ${game.game_uuid} for user ${game.user_id}`);
      }
    } catch (err) {
      logger.error(`[Cron] Expiry job failed: ${err.message}`);
    }
  }, 60_000);
  logger.info('[Cron] Game expiry job started (60s interval)');
}

async function bootstrap() {
  try {
    logger.info('🚀 Starting Stake Mine Backend…');

    // ── 1. Connect to Redis ──────────────────────────────────────────────────
    await redisClient.connect();

    // ── 2. Test MySQL connection ─────────────────────────────────────────────
    await testMySQL();

    // ── 3. Lightweight schema migrations (role column, admin seed) ───────────
    await runStartupMigrations();

    // ── 4. Start HTTP server ─────────────────────────────────────────────────
    app.listen(env.PORT, () => {
      logger.info(`✅ Server running on http://localhost:${env.PORT}`);
      logger.info(`📡 Environment: ${env.NODE_ENV}`);
      logger.info(`🏥 Health check: http://localhost:${env.PORT}/health`);
    });

    // ── 5. Start expiry cron ─────────────────────────────────────────────────
    startExpiryCron();
  } catch (err) {
    logger.error(err);
    logger.error(`❌ Failed to start server: ${err.message}`);
    process.exit(1); // Exit with failure code so Docker restarts the container
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully…');
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down gracefully…');
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});

bootstrap();
