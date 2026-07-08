/**
 * health.controller.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Health-check endpoint controller.
 *
 * GET /health
 *
 * This endpoint is used by Docker health-checks, load balancers, and monitoring
 * tools to confirm the backend is alive and its dependencies are reachable.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { pool }   = require('../config/mysql');
const redisClient = require('../config/redis');

/**
 * GET /health
 * Checks MySQL and Redis connectivity and returns service status.
 */
async function healthCheck(req, res) {
  const status = {
    mysql: 'disconnected',
    redis: 'disconnected',
  };

  // ── Check MySQL ───────────────────────────────────────────────────────────
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    status.mysql = 'connected';
  } catch {
    status.mysql = 'disconnected';
  }

  // ── Check Redis ───────────────────────────────────────────────────────────
  try {
    const pong = await redisClient.ping();
    status.redis = pong === 'PONG' ? 'connected' : 'disconnected';
  } catch {
    status.redis = 'disconnected';
  }

  // ── Determine overall health ──────────────────────────────────────────────
  const allHealthy = status.mysql === 'connected' && status.redis === 'connected';
  const httpStatus = allHealthy ? 200 : 503;

  res.status(httpStatus).json({
    success: allHealthy,
    mysql: status.mysql,
    redis: status.redis,
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { healthCheck };
