/**
 * errorHandler.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Global Express error-handling middleware.
 *
 * Must be registered LAST in app.js (after all routes).
 * Express identifies error-handlers by their 4-parameter signature: (err, req, res, next).
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const logger = require('../logger/logger');

/**
 * @param {Error}  err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next  — required even if unused (Express signature)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the full stack trace for debugging
  logger.error(`[ErrorHandler] ${err.stack || err.message}`);

  const statusCode = err.statusCode || 500;
  const message    = err.message    || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    // Surface structured extras (e.g. activeGame on 409) so clients can recover
    ...(err.activeGame && { activeGame: err.activeGame }),
    ...(err.finalState && { finalState: err.finalState }),
    // Only expose stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
