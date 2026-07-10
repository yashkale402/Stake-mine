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
 * Grabs one connection from the pool, runs a ping, then releases it.
 * Called once at server startup to confirm MySQL is reachable.
 */
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    logger.info('✅ MySQL Connected');
  } finally {
    // Always release back to the pool, even if ping() throws
    connection.release();
  }
}

module.exports = { pool, testConnection };
