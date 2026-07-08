/**
 * requestLogger.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Simple request-logging middleware built on top of Winston.
 * Logs method, URL, status code, and response time for every request.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const logger = require('../logger/logger');

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Hook into the response 'finish' event so we can log after the response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} → ${res.statusCode} [${duration}ms]`
    );
  });

  next();
};

module.exports = requestLogger;
