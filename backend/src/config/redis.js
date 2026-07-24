/**
 * redis.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Creates and exports a Redis client using the official `redis` npm package (v4+).
 *
 * Key points:
 *  - The client is created ONCE and shared across the app (singleton pattern).
 *  - All Redis errors are caught and logged; they do NOT crash the server.
 *  - The `connect()` call must be awaited at startup (see server.js).
 *
 * Usage:
 *   const redisClient = require('./config/redis');
 *   await redisClient.set('key', 'value', { EX: 60 }); // expires in 60s
 *   const val = await redisClient.get('key');
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { createClient } = require('redis');
const env = require('./env');
const logger = require('../logger/logger');

// ── Create client ─────────────────────────────────────────────────────────────
const redisClient = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    reconnectStrategy: (retries) => {
      // Exponential back-off capped at 10 seconds
      const delay = Math.min(retries * 100, 10_000);
      logger.warn(`[Redis] Reconnecting (attempt ${retries}) in ${delay}ms…`);
      return delay;
    },
  },
});

// ── Event listeners ───────────────────────────────────────────────────────────
redisClient.on('error', (err) => {
  const detail = err && (err.message || err.code || String(err));
  logger.error(`[Redis] Client error: ${detail}`);
});

redisClient.on('reconnecting', () => {
  logger.warn('[Redis] Reconnecting…');
});

redisClient.on('ready', () => {
  logger.info('✅ Redis Connected');
});

module.exports = redisClient;
