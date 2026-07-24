/**
 * game.routes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Route definitions for /api/v1/game
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');
const gameController = require('../controllers/game.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();

// All game routes require authentication
router.use(authenticate);

router.post('/start', gameController.startGame);
router.post('/reveal', gameController.revealTile);
router.post('/cashout', gameController.cashOut);
router.get('/active', gameController.getActiveGame);
router.get('/fairness', gameController.getFairness);
router.get('/state/:gameUuid', gameController.getGameState);
router.get('/history', gameController.getHistory);

module.exports = router;
