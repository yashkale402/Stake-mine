/**
 * logger.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Configures a Winston logger with:
 *   - Console output (coloured, human-readable in development)
 *   - logs/error.log  — only ERROR level messages
 *   - logs/combined.log — all levels
 *
 * Usage anywhere in the app:
 *   const logger = require('../logger/logger');
 *   logger.info('Server started');
 *   logger.error('Something broke', { err });
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

// ── Custom log line format ────────────────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// ── Logger instance ───────────────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',

  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // Capture stack traces for Error objects
    logFormat
  ),

  transports: [
    // Console — always on
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    }),

    // File — errors only
    new transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
    }),

    // File — all levels combined
    new transports.File({
      filename: path.join('logs', 'combined.log'),
    }),
  ],

  // Do NOT exit on handled exceptions
  exitOnError: false,
});

module.exports = logger;
