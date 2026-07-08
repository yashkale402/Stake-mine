/**
 * rateLimiter.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Express Rate Limit middleware.
 *
 * Protects the API from brute-force attacks and excessive traffic by limiting
 * how many requests a single IP can make within a time window.
 *
 * Configured values:
 *   - 100 requests per 15-minute window per IP (adjust for production)
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 100,                  // Max requests per window per IP
  standardHeaders: true,     // Return rate-limit info in RateLimit-* headers
  legacyHeaders: false,      // Disable deprecated X-RateLimit-* headers

  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

module.exports = rateLimiter;
