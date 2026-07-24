/**
 * index.js  (routes aggregator)
 * ──────────────────────────────────────────────────────────────────────────────
 * Single entry point for all versioned API routes.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');

const authRoutes  = require('./auth.routes');
const userRoutes  = require('./user.routes');
const gameRoutes  = require('./game.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

// ── /api/v1/auth ──────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── /api/v1/users ─────────────────────────────────────────────────────────────
router.use('/users', userRoutes);

// ── /api/v1/game ──────────────────────────────────────────────────────────────
router.use('/game', gameRoutes);

// ── /api/v1/admin ─────────────────────────────────────────────────────────────
router.use('/admin', adminRoutes);

module.exports = router;
