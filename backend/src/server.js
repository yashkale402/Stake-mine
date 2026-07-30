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
const http   = require('http');
const jwt    = require('jsonwebtoken');
const env    = require('./config/env');
const logger = require('./logger/logger');
const app    = require('./app');

const { Server } = require('socket.io');
const { testConnection: testMySQL } = require('./config/mysql');
const { runStartupMigrations }      = require('./config/migrate');
const redisClient                   = require('./config/redis');
const gameRepository                = require('./repositories/game.repository');
const cacheRepository               = require('./repositories/cache.repository');
const socketEmitter                 = require('./lib/socket-emitter');

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
          mine_count:        game.mine_count,
          cells_revealed:    0,
          final_multiplier:  1.0,
          outcome:           'LOSS',
          slot_id:           game.slot_id || null,
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

    // ── 4. Start HTTP + WebSocket server ───────────────────────────────────────
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
      path: '/socket.io',
      transports: ['websocket'],
    });

    io.use((socket, next) => {
      const authToken = socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!authToken) {
        return next(new Error('Authentication error'));
      }

      try {
        const decoded = jwt.verify(authToken, env.JWT_SECRET);
        socket.user = {
          id: decoded.id,
          role: decoded.role || 'PLAYER',
        };
        return next();
      } catch (err) {
        logger.warn(`[Socket] JWT verification failed: ${err.message}`);
        return next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      const room = `user:${socket.user.id}`;
      socket.join(room);
      logger.info(`[Socket] user=${socket.user.id} connected and joined room=${room}`);

      socket.on('disconnect', (reason) => {
        logger.info(`[Socket] user=${socket.user.id} disconnected: ${reason}`);
      });
    });

    socketEmitter.setIo(io);

    httpServer.listen(env.PORT, () => {
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
