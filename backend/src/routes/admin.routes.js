'use strict';

const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get('/summary', adminController.getSummary);
router.get('/players', adminController.getPlayers);
router.get('/players/:id', adminController.getPlayerDetail);
router.post('/players/:id/suspend', adminController.suspendPlayer);
router.post('/players/:id/activate', adminController.activatePlayer);
router.post('/players/:id/balance', adminController.adjustPlayerBalance);
router.get('/config', adminController.getConfigs);
router.get('/config-history', adminController.getConfigHistory);
router.put('/config', adminController.updateConfig);
router.get('/slots', adminController.getSlots);
router.get('/slots/budget-status', adminController.getSlotBudgetStatus);
router.put('/slots/:id', adminController.updateSlot);

module.exports = router;
