/**
 * user.routes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Route definitions for /api/v1/users
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();

router.use(authenticate);

router.get('/profile', userController.getProfile);
router.get('/engagement', userController.getEngagement);
router.get('/leaderboard', userController.getLeaderboard);
router.post('/deposit', userController.deposit);
router.post('/daily-reward/claim', userController.claimDailyReward);

module.exports = router;
