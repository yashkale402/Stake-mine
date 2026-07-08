/**
 * user.repository.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data-access layer for the `users` table.
 *
 * Responsibilities:
 *   - Execute raw SQL queries against MySQL.
 *   - Return plain row data to the service layer.
 *   - No business logic here — only DB operations.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { pool } = require('../config/mysql');

/**
 * Retrieve every user row from the database.
 * @returns {Promise<Array>} Array of user objects
 */
async function findAll() {
  const [rows] = await pool.query(
    'SELECT id, username, email, balance, created_at FROM users ORDER BY created_at DESC'
  );
  return rows;
}

/**
 * Retrieve a single user by primary key.
 * @param {number} id
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, username, email, balance, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

/**
 * Retrieve a single user by email address.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT id, username, email, balance, created_at FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

/**
 * Insert a new user and return the generated row.
 * @param {{ username: string, email: string, balance?: number }} data
 * @returns {Promise<Object>} Newly created user
 */
async function create({ username, email, balance = 1000.00 }) {
  const [result] = await pool.query(
    'INSERT INTO users (username, email, balance) VALUES (?, ?, ?)',
    [username, email, balance]
  );

  // Fetch the full row to return consistent shape
  return findById(result.insertId);
}

module.exports = { findAll, findById, findByEmail, create };
