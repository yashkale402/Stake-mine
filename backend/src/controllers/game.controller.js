/**
 * game.controller.js
 * ──────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER — HTTP layer for game endpoints.
 *
 * ⚠️  No game logic is implemented here.
 *      These handlers are stubs that return a clear message indicating
 *      that the game algorithm is pending.
 *
 * TODO (implement when game algorithm is ready):
 *   - POST /api/v1/game/start   → call gameService.startGame()
 *   - POST /api/v1/game/reveal  → call gameService.revealTile()
 *   - POST /api/v1/game/cashout → call gameService.cashOut()
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// const gameService = require('../services/game.service'); // TODO: uncomment when ready

/**
 * TODO: POST /api/v1/game/start
 * Starts a new game session for a user.
 *
 * Expected body: { userId, betAmount, minesCount }
 */
async function startGame(req, res, next) {
  try {
    // TODO: const { userId, betAmount, minesCount } = req.body;
    // TODO: const game = await gameService.startGame(userId, betAmount, minesCount);
    // TODO: res.status(201).json({ success: true, data: game });

    res.status(501).json({
      success: false,
      message: 'Game algorithm not yet implemented. Coming soon!',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * TODO: POST /api/v1/game/reveal
 * Reveals a tile in the active game.
 *
 * Expected body: { gameId, tileIndex }
 */
async function revealTile(req, res, next) {
  try {
    // TODO: const { gameId, tileIndex } = req.body;
    // TODO: const result = await gameService.revealTile(gameId, tileIndex);
    // TODO: res.status(200).json({ success: true, data: result });

    res.status(501).json({
      success: false,
      message: 'Tile reveal not yet implemented. Coming soon!',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * TODO: POST /api/v1/game/cashout
 * Cashes out the current winnings.
 *
 * Expected body: { gameId }
 */
async function cashOut(req, res, next) {
  try {
    // TODO: const { gameId } = req.body;
    // TODO: const result = await gameService.cashOut(gameId);
    // TODO: res.status(200).json({ success: true, data: result });

    res.status(501).json({
      success: false,
      message: 'Cash-out not yet implemented. Coming soon!',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { startGame, revealTile, cashOut };
