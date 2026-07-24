/**
 * auth.middleware.js
 * JWT authentication + role guards.
 */

'use strict';

const jwt    = require('jsonwebtoken');
const env    = require('../config/env');
const logger = require('../logger/logger');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization header missing or malformed. Expected: Bearer <token>',
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id:       decoded.id,
      email:    decoded.email,
      username: decoded.username,
      role:     decoded.role || 'PLAYER',
    };
    next();
  } catch (err) {
    logger.warn(`[Auth] JWT verification failed: ${err.message}`);
    return res.status(401).json({
      success: false,
      message: 'Token is invalid or expired. Please log in again.',
    });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
