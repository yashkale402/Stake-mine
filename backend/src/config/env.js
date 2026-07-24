/**
 * env.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Loads and validates all environment variables from .env using dotenv.
 * Throws an error early (fail-fast) if any required variable is missing,
 * so the application never starts in a broken state.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const dotenv = require('dotenv');

// Load .env file into process.env
dotenv.config();

// ── Required variables ────────────────────────────────────────────────────────
const REQUIRED_VARS = [
  'PORT',
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `[ENV] Missing required environment variables: ${missing.join(', ')}\n` +
      `Please copy .env.example to .env and fill in the values.`
  );
}

// ── Exported config object ────────────────────────────────────────────────────
module.exports = {
  // Server
  PORT:           parseInt(process.env.PORT, 10) || 3001,
  NODE_ENV:       process.env.NODE_ENV || 'development',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',

  // MySQL
  MYSQL_HOST:     process.env.MYSQL_HOST,
  MYSQL_PORT:     parseInt(process.env.MYSQL_PORT, 10) || 3306,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,
  MYSQL_USER:     process.env.MYSQL_USER,
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,

  // Redis
  REDIS_HOST:      process.env.REDIS_HOST,
  REDIS_PORT:      parseInt(process.env.REDIS_PORT, 10) || 6379,
  REDIS_CACHE_TTL: parseInt(process.env.REDIS_CACHE_TTL, 10) || 3600,

  // JWT
  JWT_SECRET:     process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
