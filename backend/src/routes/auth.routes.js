/**
 * auth.routes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Route definitions for /api/v1/auth
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.get('/me', authenticate, authController.getProfile);

module.exports = router;
