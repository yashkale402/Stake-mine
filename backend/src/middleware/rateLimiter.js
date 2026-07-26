'use strict';

const rateLimit = require('express-rate-limit');

function buildRateLimitKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown-client';
}

function buildRateLimitResponse(req) {
  const resetTime = req.rateLimit?.resetTime instanceof Date ? req.rateLimit.resetTime : null;
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : 15 * 60;

  return {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    retryAfterSeconds,
    retryAt: resetTime ? resetTime.toISOString() : null,
  };
}

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res) => {
    res.status(429).json(buildRateLimitResponse(req));
  },
});

const gameRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res) => {
    res.status(429).json(buildRateLimitResponse(req));
  },
});

module.exports = {
  authRateLimiter,
  gameRateLimiter,
  buildRateLimitKey,
  buildRateLimitResponse,
};
