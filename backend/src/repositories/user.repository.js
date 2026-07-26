/**
 * user.repository.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data-access layer for the `users` table.
 *
 * Responsibilities:
 *   - Execute raw SQL queries against MySQL.
 *   - Return plain row data to the service layer.
 *   - NO business logic here — only DB operations.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { pool } = require('../config/mysql');

/** Safe column list — never expose password_hash to callers unless explicitly needed */
const PUBLIC_COLS = 'id, username, email, balance_paise, role, status, created_at, updated_at';

/**
 * Find all users (admin use — never expose in player-facing APIs).
 * @returns {Promise<Array>}
 */
async function findAll() {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM users ORDER BY created_at DESC`
  );
  return rows;
}

/**
 * Find a user by primary key. Returns public fields only.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Find a user by email. Includes password_hash for authentication.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, username, email, password_hash, balance_paise, role, status, created_at
     FROM users WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function findByUsername(username) {
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE username = ? LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

/**
 * Create a new user.
 * @param {{ username: string, email: string, password_hash: string, balance_paise?: number }} data
 * @returns {Promise<Object>} Created user (public fields)
 */
async function create({ username, email, password_hash, balance_paise = 0 }) {
  const [result] = await pool.query(
    `INSERT INTO users (username, email, password_hash, balance_paise)
     VALUES (?, ?, ?, ?)`,
    [username, email, password_hash, balance_paise]
  );
  return findById(result.insertId);
}

/**
 * Credit or debit a player's wallet using an atomic UPDATE.
 * Pass a positive amount to credit; negative to debit.
 * Returns the updated balance.
 *
 * @param {number} userId
 * @param {number} deltaPaise   Positive = credit, Negative = debit
 * @param {Object} [connection] Optional MySQL connection (for transactions)
 * @returns {Promise<number>} New balance in paise
 */
async function adjustBalance(userId, deltaPaise, connection = null) {
  const db = connection || pool;

  const [result] = await db.query(
    `UPDATE users
     SET balance_paise = balance_paise + ?
     WHERE id = ? AND balance_paise + ? >= 0`,
    [deltaPaise, userId, deltaPaise]
  );

  if (result.affectedRows === 0) {
    const err = new Error('Insufficient balance or user not found');
    err.statusCode = 402;
    throw err;
  }

  // Return fresh balance
  const [rows] = await db.query(
    'SELECT balance_paise FROM users WHERE id = ?',
    [userId]
  );
  return rows[0].balance_paise;
}

/**
 * Get current balance in paise.
 * @param {number} userId
 * @param {Object} [connection]
 * @returns {Promise<number>}
 */
async function getBalance(userId, connection = null) {
  const db = connection || pool;
  const [rows] = await db.query(
    'SELECT balance_paise FROM users WHERE id = ?',
    [userId]
  );
  if (!rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0].balance_paise;
}

async function getAdminUserMetrics() {
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total_users,
       SUM(CASE WHEN role = 'PLAYER' THEN 1 ELSE 0 END) AS total_players,
       SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) AS total_admins,
       SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_users,
       SUM(balance_paise) AS total_balance_paise
     FROM users`
  );

  return rows[0];
}

async function getRecentPlayers(limit = 25) {
  const [rows] = await pool.query(
    `
      SELECT id, username, email, balance_paise, role, status, created_at, updated_at
      FROM users
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ?
    `,
    [limit]
  );

  return rows;
}

async function suspendPlayer(userId) {
  const [result] = await pool.query(
    `UPDATE users SET status = 'SUSPENDED' WHERE id = ? AND role = 'PLAYER'`,
    [userId]
  );
  return result.affectedRows;
}

async function activatePlayer(userId) {
  const [result] = await pool.query(
    `UPDATE users SET status = 'ACTIVE' WHERE id = ? AND role = 'PLAYER'`,
    [userId]
  );
  return result.affectedRows;
}

module.exports = {
  findAll,
  findById,
  findByEmail,
  findByUsername,
  create,
  adjustBalance,
  getBalance,
  getAdminUserMetrics,
  getRecentPlayers,
  suspendPlayer,
  activatePlayer,
};
