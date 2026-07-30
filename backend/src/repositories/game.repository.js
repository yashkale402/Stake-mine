/**
 * game.repository.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data-access layer for game_sessions and game_history tables.
 *
 * Responsibilities:
 *   - All SQL for game lifecycle (insert, update, finalize).
 *   - No business logic — only DB operations.
 *   - Accepts an optional MySQL connection for transactional operations.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { pool } = require('../config/mysql');
const budgetRepository = require('./budget.repository');
const configRepository = require('./config.repository');
const budgetService = require('../services/budget.service');

/**
 * Insert a new game session record (status = ACTIVE).
 *
 * @param {Object} data
 * @param {Object} [connection] - Optional MySQL connection for transactions
 * @returns {Promise<Object>} Newly created game session row
 */
async function createGame(data, connection = null) {
  const db = connection || pool;
  const {
    game_uuid,
    user_id,
    slot_ledger_id,
    bet_amount_paise,
    mine_count,
    board_size,
    mine_positions,
    config_snapshot,
    expires_at,
  } = data;

  const [result] = await db.query(
    `INSERT INTO game_sessions
       (game_uuid, user_id, slot_ledger_id, bet_amount_paise, mine_count,
        board_size, mine_positions, config_snapshot, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      game_uuid,
      user_id,
      slot_ledger_id || null,
      bet_amount_paise,
      mine_count,
      board_size,
      JSON.stringify(mine_positions),
      JSON.stringify(config_snapshot),
      expires_at,
    ]
  );

  // Load inserted row
  const gameRow = await findGameById(result.insertId, db);

  // Attempt conservative reservation for this game inside the same transaction
  try {
    if (gameRow && gameRow.slot_ledger_id) {
      // Conservative reservation: min(bet * max_multiplier, remaining_budget * 0.9)
      const maxMultCfg = await configRepository.getGlobalConfig('maximum_multiplier');
      const configuredMaxMultiplier = maxMultCfg ? Number(JSON.parse(maxMultCfg.config_value)) : 100;

      const ledgerRow = await configRepository.getBudgetLedgerById(gameRow.slot_ledger_id, connection || null);
      if (!ledgerRow) return gameRow;
      const totalBudget = Number(ledgerRow.total_budget_paise || 0);
      const spent = Number(ledgerRow.spent_paise || 0);
      const reserved = await require('./budget.repository').getActiveReservedSum(gameRow.slot_ledger_id, connection || null);
      const remaining = Math.max(0, totalBudget - spent - reserved);

      const potentialPayout = Math.floor(bet_amount_paise * configuredMaxMultiplier);
      const reserveAmount = Math.min(potentialPayout, Math.floor(remaining * 0.9));

      await budgetService.reserveBudgetForGame({
          gameUuid: game_uuid,
          userId: user_id,
          slotLedgerId: gameRow.slot_ledger_id,
          requestedPayoutPaise: reserveAmount,
      }, connection || null);
    }
  } catch (err) {
    throw err;
  }

  return gameRow;
}

/**
 * Find an active game session by its UUID.
 * Returns null if not found or not ACTIVE.
 *
 * @param {string} gameUuid
 * @param {Object} [connection]
 * @returns {Promise<Object|null>}
 */
async function findActiveGameByUuid(gameUuid, connection = null) {
  const db = connection || pool;
  const [rows] = await db.query(
    `SELECT * FROM game_sessions
     WHERE game_uuid = ? AND status = 'ACTIVE'
     LIMIT 1`,
    [gameUuid]
  );
  return rows[0] || null;
}

/**
 * Find any game session by UUID (any status — used for recovery).
 *
 * @param {string} gameUuid
 * @returns {Promise<Object|null>}
 */
async function findGameByUuid(gameUuid) {
  const [rows] = await pool.query(
    'SELECT * FROM game_sessions WHERE game_uuid = ? LIMIT 1',
    [gameUuid]
  );
  return rows[0] || null;
}

/**
 * Find the currently ACTIVE game for a user, if any.
 *
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function findActiveGameByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT * FROM game_sessions
     WHERE user_id = ? AND status = 'ACTIVE'
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Update the reveal state (revealed_cells, multiplier) during a safe reveal.
 * Uses the game_uuid for safety — does not update if status is not ACTIVE.
 *
 * @param {string} gameUuid
 * @param {number[]} revealedCells
 * @param {number}   multiplier
 * @param {Object}  [connection]
 * @returns {Promise<void>}
 */
async function updateRevealState(gameUuid, revealedCells, multiplier, connection = null) {
  const db = connection || pool;
  await db.query(
    `UPDATE game_sessions
     SET revealed_cells = ?, current_multiplier = ?
     WHERE game_uuid = ? AND status = 'ACTIVE'`,
    [JSON.stringify(revealedCells), multiplier, gameUuid]
  );
}

/**
 * Settle a game as CASHED_OUT.
 * Uses conditional WHERE status='ACTIVE' to prevent double settlement.
 *
 * @param {string} gameUuid
 * @param {number} payoutPaise
 * @param {number} finalMultiplier
 * @param {Object} [connection]
 * @returns {Promise<number>} Rows affected (1 = success, 0 = already settled)
 */
async function settleGameCashout(gameUuid, payoutPaise, finalMultiplier, connection = null) {
  const db = connection || pool;
  const [result] = await db.query(
    `UPDATE game_sessions
     SET status = 'CASHED_OUT',
         payout_paise = ?,
         current_multiplier = ?,
         ended_at = NOW()
     WHERE game_uuid = ? AND status = 'ACTIVE'`,
    [payoutPaise, finalMultiplier, gameUuid]
  );

  // Also settle any reservation for this game (if present)
  try {
    await budgetService.settleReservationOnCashout(gameUuid, payoutPaise, connection || null);
  } catch (err) {
    console.error('[Budget] failed to mark reservation settled:', err.message);
  }

  return result.affectedRows;
}

/**
 * Settle a game as LOST (mine hit).
 *
 * @param {string} gameUuid
 * @param {Object} [connection]
 * @returns {Promise<number>} Rows affected
 */
async function settleGameLost(gameUuid, connection = null) {
  const db = connection || pool;
  const [result] = await db.query(
    `UPDATE game_sessions
     SET status = 'LOST',
         payout_paise = 0,
         ended_at = NOW()
     WHERE game_uuid = ? AND status = 'ACTIVE'`,
    [gameUuid]
  );

  // Release any reservation associated with this game
  try {
    await budgetService.releaseReservationOnLoss(gameUuid, connection || null);
  } catch (err) {
    console.error('[Budget] failed to release reservation:', err.message);
  }

  return result.affectedRows;
}

/**
 * Mark an ACTIVE game as EXPIRED.
 * Called by the expiry cron job.
 *
 * @param {string} gameUuid
 * @returns {Promise<number>} Rows affected
 */
async function settleGameExpired(gameUuid) {
  const [result] = await pool.query(
    `UPDATE game_sessions
     SET status = 'EXPIRED', ended_at = NOW()
     WHERE game_uuid = ? AND status = 'ACTIVE'`,
    [gameUuid]
  );
  return result.affectedRows;
}

/**
 * Find all ACTIVE games that have passed their expiry time.
 * Used by the cron/cleanup job.
 *
 * @returns {Promise<Array>}
 */
async function findExpiredActiveGames() {
  const [rows] = await pool.query(
    `SELECT game_uuid, user_id, bet_amount_paise, mine_count
     FROM game_sessions
     WHERE status = 'ACTIVE' AND expires_at < NOW()`
  );
  return rows;
}

/**
 * Insert a game_history record (write-once, after settlement).
 *
 * @param {Object} data
 * @param {Object} [connection]
 * @returns {Promise<void>}
 */
async function insertHistory(data, connection = null) {
  const db = connection || pool;
  const {
    game_uuid,
    user_id,
    bet_amount_paise,
    payout_paise,
    profit_loss_paise,
    mine_count,
    cells_revealed,
    final_multiplier,
    outcome,
    slot_id,
  } = data;

  await db.query(
    `INSERT INTO game_history
       (game_uuid, user_id, bet_amount_paise, payout_paise, profit_loss_paise,
        mine_count, cells_revealed, final_multiplier, outcome, slot_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      game_uuid,
      user_id,
      bet_amount_paise,
      payout_paise,
      profit_loss_paise,
      mine_count,
      cells_revealed,
      final_multiplier,
      outcome,
      slot_id || null,
    ]
  );
}

/**
 * Get paginated game history for a player.
 *
 * @param {number} userId
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<Array>}
 */
async function getHistory(userId, limit = 20, offset = 0) {
  const [rows] = await pool.query(
    `SELECT game_uuid, bet_amount_paise, payout_paise, profit_loss_paise,
            mine_count, cells_revealed, final_multiplier, outcome, played_at
     FROM game_history
     WHERE user_id = ?
     ORDER BY played_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  return rows;
}

async function getRecentHistory(userId, limit = 20) {
  const [rows] = await pool.query(
    `SELECT game_uuid, bet_amount_paise, payout_paise, profit_loss_paise,
            mine_count, cells_revealed, final_multiplier, outcome, played_at
     FROM game_history
     WHERE user_id = ?
     ORDER BY played_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

async function getConsecutiveLosses(userId) {
  const [rows] = await pool.query(
    `SELECT outcome FROM game_history
     WHERE user_id = ?
     ORDER BY played_at DESC
     LIMIT 10`,
    [userId]
  );
  let count = 0;
  for (const row of rows) {
    if (row.outcome === 'LOSS') count++;
    else break;
  }
  return count;
}

/**
 * Count total history records for a player (for pagination).
 *
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function countHistory(userId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as total FROM game_history WHERE user_id = ?',
    [userId]
  );
  return rows[0].total;
}

async function getAdminGameMetrics() {
  const [sessionRows, historyRows, outcomeRows] = await Promise.all([
    pool.query(
      `SELECT
         SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_games,
         COUNT(*) AS lifetime_sessions
       FROM game_sessions`
    ),
    pool.query(
      `SELECT
         COUNT(*) AS settled_games,
         COALESCE(SUM(bet_amount_paise), 0) AS total_wagered_paise,
         COALESCE(SUM(payout_paise), 0) AS total_paid_paise,
         COALESCE(SUM(profit_loss_paise), 0) AS net_house_paise,
         COALESCE(AVG(final_multiplier), 0) AS average_multiplier
       FROM game_history`
    ),
    pool.query(
      `SELECT outcome, COUNT(*) AS total
       FROM game_history
       GROUP BY outcome`
    ),
  ]);

  const sessionMetrics = sessionRows[0][0];
  const historyMetrics = historyRows[0][0];
  const outcomes = outcomeRows[0].reduce((acc, row) => {
    acc[row.outcome] = row.total;
    return acc;
  }, {});

  return {
    ...sessionMetrics,
    ...historyMetrics,
    outcomes,
  };
}

async function getPlayerSummaryStats(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        COUNT(*) AS total_games,
        SUM(CASE WHEN outcome = 'CASHOUT' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN outcome = 'CASHOUT' THEN 1 ELSE 0 END) AS cashouts,
        SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) AS losses,
        COALESCE(SUM(bet_amount_paise), 0) AS total_wagered_paise,
        COALESCE(SUM(payout_paise), 0) AS total_paid_paise,
        COALESCE(MAX(payout_paise), 0) AS biggest_cashout_paise,
        COALESCE(SUM(profit_loss_paise), 0) AS net_profit_paise,
        COALESCE(AVG(final_multiplier), 0) AS average_multiplier
      FROM game_history
      WHERE user_id = ?
    `,
    [userId]
  );

  return rows[0];
}

async function getLeaderboard(limit = 10) {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        COUNT(h.id) AS total_games,
        COALESCE(SUM(h.profit_loss_paise), 0) AS net_profit_paise,
        COALESCE(MAX(h.payout_paise), 0) AS biggest_cashout_paise
      FROM users u
      LEFT JOIN game_history h ON h.user_id = u.id
      WHERE u.role = 'PLAYER'
      GROUP BY u.id, u.username
      ORDER BY net_profit_paise DESC, biggest_cashout_paise DESC, total_games DESC
      LIMIT ?
    `,
    [limit]
  );

  return rows;
}

async function getAdminKpis() {
  const [[financials], [retention], [churn]] = await Promise.all([
    pool.query(
      `
        SELECT
          COALESCE(SUM(bet_amount_paise), 0) AS wager_volume_paise,
          COALESCE(SUM(payout_paise), 0) AS payout_volume_paise,
          COUNT(DISTINCT user_id) AS monetized_players
        FROM game_history
      `
    ),
    pool.query(
      `
        SELECT
          COUNT(DISTINCT CASE WHEN played_at >= NOW() - INTERVAL 7 DAY THEN user_id END) AS active_7d,
          COUNT(DISTINCT CASE WHEN played_at >= NOW() - INTERVAL 30 DAY THEN user_id END) AS active_30d
        FROM game_history
      `
    ),
    pool.query(
      `
        SELECT
          COUNT(*) AS total_players,
          SUM(
            CASE
              WHEN id NOT IN (
                SELECT DISTINCT user_id
                FROM game_history
                WHERE played_at >= NOW() - INTERVAL 14 DAY
              )
              THEN 1 ELSE 0
            END
          ) AS inactive_14d
        FROM users
        WHERE role = 'PLAYER'
      `
    ),
  ]);

  const totalPlayers = Number(churn[0].total_players || 0);
  const wagerVolumePaise = Number(financials[0].wager_volume_paise || 0);
  const payoutVolumePaise = Number(financials[0].payout_volume_paise || 0);
  const monetizedPlayers = Number(financials[0].monetized_players || 0);
  const active30d = Number(retention[0].active_30d || 0);

  return {
    retention_pct: totalPlayers === 0 ? 0 : round2((active30d / totalPlayers) * 100),
    arpu_paise: monetizedPlayers === 0 ? 0 : Math.round(wagerVolumePaise / monetizedPlayers),
    wager_volume_paise: wagerVolumePaise,
    payout_ratio_pct: wagerVolumePaise === 0 ? 0 : round2((payoutVolumePaise / wagerVolumePaise) * 100),
    churn_risk_pct:
      totalPlayers === 0 ? 0 : round2((Number(churn[0].inactive_14d || 0) / totalPlayers) * 100),
    active_7d: Number(retention[0].active_7d || 0),
    active_30d: active30d,
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Internal helper — find by auto-increment id
async function findGameById(id, db = pool) {
  const [rows] = await db.query(
    'SELECT * FROM game_sessions WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  createGame,
  findActiveGameByUuid,
  findGameByUuid,
  findActiveGameByUserId,
  updateRevealState,
  settleGameCashout,
  settleGameLost,
  settleGameExpired,
  findExpiredActiveGames,
  insertHistory,
  getHistory,
  getRecentHistory,
  getConsecutiveLosses,
  countHistory,
  getAdminGameMetrics,
  getPlayerSummaryStats,
  getLeaderboard,
  getAdminKpis,
};
