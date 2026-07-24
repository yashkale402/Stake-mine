/**
 * admin.routes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Route definitions for /api/v1/admin
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/summary', adminController.getSummary);
router.get('/players', adminController.getPlayers);
router.get('/config', adminController.getConfigs);
router.get('/config-history', adminController.getConfigHistory);
router.put('/config', adminController.updateConfig);
router.get('/slots', adminController.getSlots);

module.exports = router;
