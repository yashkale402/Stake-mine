/**
 * notFound.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 404 middleware — catches any request that didn't match a defined route.
 * Must be placed AFTER all routes, but BEFORE the global error handler.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err); // Pass to global error handler
};

module.exports = notFound;
