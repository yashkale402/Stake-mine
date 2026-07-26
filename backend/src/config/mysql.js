/**
 * mysql.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Creates and exports a MySQL2 connection POOL (not a single connection).
 * Using a pool is the production-correct approach: it handles multiple
 * simultaneous requests efficiently and automatically reconnects on failure.
 *
 * Usage:
 *   const pool = require('./config/mysql');
 *   const [rows] = await pool.query('SELECT * FROM users');
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');
const logger = require('../logger/logger');

// ── Pool configuration ────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  database: env.MYSQL_DATABASE,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  waitForConnections: true,   // Queue queries instead of throwing when no connection is free
  connectionLimit: 10,        // Max simultaneous connections in the pool
  queueLimit: 0,              // Unlimited queue (0 = no limit)
  enableKeepAlive: true,      // Prevent idle connection drops
  keepAliveInitialDelay: 0,
});

/**
 * testConnection
 * Retries up to `maxRetries` times with a fixed delay.
 * Ensures MySQL is fully ready before the server starts.
 */
async function testConnection(maxRetries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await pool.getConnection();
      try {
        await connection.ping();
        logger.info('✅ MySQL Connected');
        return;
      } finally {
        connection.release();
      }
    } catch (err) {
      logger.warn(`[MySQL] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt === maxRetries) throw err;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

module.exports = { pool, testConnection };
