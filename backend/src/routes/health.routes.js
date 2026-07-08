/**
 * health.routes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Route definitions for the health-check endpoint.
 * Mounted at /health (not under /api/v1 so it's always accessible).
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');
const healthController = require('../controllers/health.controller');

const router = Router();

// GET /health
router.get('/', healthController.healthCheck);

module.exports = router;
