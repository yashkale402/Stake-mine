/**
 * index.js  (routes aggregator)
 * ──────────────────────────────────────────────────────────────────────────────
 * Single entry point for all versioned API routes.
 * Mount new feature routers here as the project grows.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');

const userRoutes  = require('./user.routes');
const gameRoutes  = require('./game.routes');

const router = Router();

// ── /api/v1/users ─────────────────────────────────────────────────────────────
router.use('/users', userRoutes);

// ── /api/v1/game  ─────────────────────────────────────────────────────────────
router.use('/game', gameRoutes);

module.exports = router;
