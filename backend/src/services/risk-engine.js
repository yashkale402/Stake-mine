'use strict';

/**
 * risk-engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Decides mine placement strategy based on:
 *   1. Slot budget consumption (how much has been paid out today)
 *   2. Player lifecycle (new player = generous, experienced = normal house edge)
 *   3. Player session loss streak (prevent instant wipeout on first deposit)
 *
 * PHILOSOPHY:
 *   - New player deposits ₹100 → let them win small amounts first (2-3 games)
 *   - After they've had wins, gradually shift to normal house edge
 *   - Slot budget nearly exhausted → tighten mines (house wins more)
 *   - Slot budget healthy → normal play
 *
 * OUTPUT: adjusted mineCount and houseEdge fed into generateMinePositions()
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @param {Object} opts
 * @param {number} opts.requestedMines     - What player asked for
 * @param {number} opts.boardSize          - 25
 * @param {number} opts.baseHouseEdge      - From config (e.g. 0.05)
 * @param {number} opts.totalBudgetPaise   - Slot total budget
 * @param {number} opts.spentPaise         - Already paid out this slot
 * @param {number} opts.playerTotalGames   - Lifetime games played
 * @param {number} opts.playerNetProfitPaise - Player's net profit (negative = they lost)
 * @param {number} opts.playerSessionLosses - Consecutive losses this session
 * @param {number} opts.betAmountPaise
 * @returns {{ mines: number, houseEdge: number, mode: string }}
 */
function computeRiskProfile({
  requestedMines,
  boardSize,
  baseHouseEdge,
  totalBudgetPaise,
  spentPaise,
  playerTotalGames,
  playerNetProfitPaise,
  playerSessionLosses,
  betAmountPaise,
}) {
  const budgetUsedPct = totalBudgetPaise > 0 ? spentPaise / totalBudgetPaise : 0;
  const safeCells = boardSize - requestedMines;

  // ── PHASE 1: New player protection ───────────────────────────────────────
  // First 5 games: reduce mines by 1-2 so they win more often
  // This builds trust and encourages deposit top-ups
  if (playerTotalGames < 5) {
    const reduction = playerTotalGames < 2 ? 2 : 1;
    const mines = Math.max(1, requestedMines - reduction);
    return {
      mines,
      houseEdge: Math.max(0.01, baseHouseEdge - 0.02), // slightly lower edge = better payouts
      mode: 'NEW_PLAYER',
    };
  }

  // ── PHASE 2: Prevent instant wipeout (3+ consecutive losses) ─────────────
  // If player lost 3+ games in a row, ease off slightly so they don't quit
  if (playerSessionLosses >= 3) {
    const mines = Math.max(1, requestedMines - 1);
    return {
      mines,
      houseEdge: baseHouseEdge,
      mode: 'LOSS_PROTECTION',
    };
  }

  // ── PHASE 3: Budget pressure — tighten when slot budget > 70% spent ──────
  if (budgetUsedPct >= 0.90) {
    // Critical: budget almost gone — max difficulty
    const mines = Math.min(boardSize - 2, requestedMines + 3);
    return {
      mines,
      houseEdge: Math.min(0.20, baseHouseEdge + 0.10),
      mode: 'BUDGET_CRITICAL',
    };
  }

  if (budgetUsedPct >= 0.70) {
    // High pressure: add 1-2 extra mines
    const mines = Math.min(boardSize - 2, requestedMines + 2);
    return {
      mines,
      houseEdge: Math.min(0.15, baseHouseEdge + 0.05),
      mode: 'BUDGET_HIGH',
    };
  }

  if (budgetUsedPct >= 0.50) {
    // Medium pressure: add 1 mine
    const mines = Math.min(boardSize - 2, requestedMines + 1);
    return {
      mines,
      houseEdge: Math.min(0.10, baseHouseEdge + 0.02),
      mode: 'BUDGET_MEDIUM',
    };
  }

  // ── PHASE 4: Player is up big — normal house edge ─────────────────────────
  if (playerNetProfitPaise > totalBudgetPaise * 0.05) {
    // Player has won more than 5% of slot budget — tighten slightly
    const mines = Math.min(boardSize - 2, requestedMines + 1);
    return {
      mines,
      houseEdge: Math.min(0.12, baseHouseEdge + 0.03),
      mode: 'PLAYER_UP',
    };
  }

  // ── DEFAULT: Normal play ──────────────────────────────────────────────────
  return {
    mines: requestedMines,
    houseEdge: baseHouseEdge,
    mode: 'NORMAL',
  };
}

module.exports = { computeRiskProfile };
