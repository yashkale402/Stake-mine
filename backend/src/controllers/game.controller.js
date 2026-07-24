/**
 * game.controller.js
 * ──────────────────────────────────────────────────────────────────────────────
 * HTTP layer for game endpoints (start, reveal, cashout, state, history).
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const gameService = require('../services/game.service');
const { success } = require('../utils/response.helper');

/**
 * POST /api/v1/game/start
 * Expected body: { betAmountPaise, mineCount }
 */
async function startGame(req, res, next) {
  try {
    const userId = req.user.id;
    const { betAmountPaise, mineCount } = req.body;

    const game = await gameService.startGame(userId, Number(betAmountPaise), Number(mineCount));
    res.status(201).json(success(game, 'Game started successfully'));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/game/reveal
 * Expected body: { gameUuid, cellIndex }
 */
async function revealTile(req, res, next) {
  try {
    const userId = req.user.id;
    const { gameUuid, cellIndex } = req.body;

    if (!gameUuid) {
      const err = new Error('gameUuid is required');
      err.statusCode = 400;
      throw err;
    }

    const result = await gameService.revealCell(userId, gameUuid, Number(cellIndex));
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/game/cashout
 * Expected body: { gameUuid }
 */
async function cashOut(req, res, next) {
  try {
    const userId = req.user.id;
    const { gameUuid } = req.body;

    if (!gameUuid) {
      const err = new Error('gameUuid is required');
      err.statusCode = 400;
      throw err;
    }

    const result = await gameService.cashout(userId, gameUuid);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/game/active
 * Returns the player's current ACTIVE game, or null.
 */
async function getActiveGame(req, res, next) {
  try {
    const userId = req.user.id;
    const game = await gameService.getActiveGame(userId);
    res.status(200).json(success(game));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/game/state/:gameUuid
 */
async function getGameState(req, res, next) {
  try {
    const userId = req.user.id;
    const { gameUuid } = req.params;

    const state = await gameService.getGameState(userId, gameUuid);
    res.status(200).json(success(state));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/game/history
 * Query params: ?page=1&limit=20
 */
async function getHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const history = await gameService.getGameHistory(userId, page, limit);
    res.status(200).json(success(history));
  } catch (err) {
    next(err);
  }
}

async function getFairness(req, res, next) {
  try {
    const result = await gameService.getFairnessInfo(req.user.id);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startGame,
  revealTile,
  cashOut,
  getActiveGame,
  getGameState,
  getHistory,
  getFairness,
};
