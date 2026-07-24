/**
 * migrate.js
 * Lightweight startup migrations for existing MySQL volumes.
 */

'use strict';

const { pool } = require('./mysql');
const logger = require('../logger/logger');

async function runStartupMigrations() {
  await ensureUsersRoleColumn();
  await ensureUsersStatusColumn();
  await ensureAdminSeed();
  logger.info('[Migrate] Startup migrations complete');
}

async function ensureUsersRoleColumn() {
  try {
    const hasRole = await columnExists('users', 'role');
    if (hasRole) return;

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN role ENUM('PLAYER','ADMIN') NOT NULL DEFAULT 'PLAYER'
      AFTER balance_paise
    `);

    logger.info('[Migrate] Added users.role column');
  } catch (err) {
    logger.warn(`[Migrate] role column: ${err.message}`);
  }
}

async function ensureUsersStatusColumn() {
  try {
    const hasStatus = await columnExists('users', 'status');
    if (hasStatus) return;

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN status ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE'
      AFTER role
    `);

    logger.info('[Migrate] Added users.status column');
  } catch (err) {
    logger.warn(`[Migrate] status column: ${err.message}`);
  }
}

async function ensureAdminSeed() {
  try {
    const hasRole = await columnExists('users', 'role');
    const hasStatus = await columnExists('users', 'status');

    if (!hasRole || !hasStatus) {
      logger.warn('[Migrate] Admin seed skipped because users schema is incomplete');
      return;
    }

    await pool.query(
      `
        INSERT INTO users (username, email, password_hash, balance_paise, role, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          status = VALUES(status)
      `,
      [
        'Admin',
        'admin@stake.mine',
        '$2b$10$mQXCvA.2XmmujqI/CFymYuu17Hvky3dts8cKfcCjNeg4ugZ8/ZzwW',
        0,
        'ADMIN',
        'ACTIVE',
      ]
    );

    logger.info('[Migrate] Admin seed ensured');
  } catch (err) {
    logger.warn(`[Migrate] admin seed: ${err.message}`);
  }
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

module.exports = { runStartupMigrations };
