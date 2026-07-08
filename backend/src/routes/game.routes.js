/**
 * game.routes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER — Route definitions for /api/v1/game
 *
 * ⚠️  All endpoints return 501 (Not Implemented) until the game algorithm is ready.
 *
 * TODO (implement when game algorithm is ready):
 *   - POST /api/v1/game/start   → start a new game
 *   - POST /api/v1/game/reveal  → reveal a tile
 *   - POST /api/v1/game/cashout → cash out current winnings
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');
const gameController = require('../controllers/game.controller');

const router = Router();

// POST /api/v1/game/start
router.post('/start', gameController.startGame);

// POST /api/v1/game/reveal
router.post('/reveal', gameController.revealTile);

// POST /api/v1/game/cashout
router.post('/cashout', gameController.cashOut);

module.exports = router;
