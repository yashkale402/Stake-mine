/**
 * config.repository.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data-access layer for global_config, slot_configs, slot_budget_ledger,
 * player_config_overrides, and audit_logs.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { pool } = require('../config/mysql');

// ── Global Config ─────────────────────────────────────────────────────────────

/**
 * Fetch all global config rows.
 * @returns {Promise<Array<{config_key: string, config_value: any}>>}
 */
async function getAllGlobalConfig() {
  const [rows] = await pool.query(
    'SELECT config_key, config_value, version FROM global_config'
  );
  return rows;
}

/**
 * Fetch a single global config value by key.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function getGlobalConfig(key) {
  const [rows] = await pool.query(
    'SELECT config_value, version FROM global_config WHERE config_key = ?',
    [key]
  );
  return rows[0] || null;
}

/**
 * Upsert a global config value. Increments version on update.
 * @param {string} key
 * @param {any}    value  (will be JSON-stringified)
 * @param {string} updatedBy
 * @returns {Promise<void>}
 */
async function setGlobalConfig(key, value, updatedBy = 'system') {
  await pool.query(
    `INSERT INTO global_config (config_key, config_value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       config_value = VALUES(config_value),
       updated_by   = VALUES(updated_by),
       version      = version + 1`,
    [key, JSON.stringify(value), updatedBy]
  );
}

// ── Player Config Overrides ───────────────────────────────────────────────────

/**
 * Get all currently active overrides for a user.
 * Active = effective_from <= NOW() AND (effective_to IS NULL OR effective_to > NOW())
 *
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function getActivePlayerOverrides(userId) {
  const [rows] = await pool.query(
    `SELECT config_key, config_value
     FROM player_config_overrides
     WHERE user_id = ?
       AND effective_from <= NOW()
       AND (effective_to IS NULL OR effective_to > NOW())`,
    [userId]
  );
  return rows;
}

// ── Slot Configs ──────────────────────────────────────────────────────────────

/**
 * Get all active slot configs.
 * @returns {Promise<Array>}
 */
async function getAllSlots() {
  const [rows] = await pool.query(
    `SELECT id, slot_name, start_hour, end_hour, budget_paise, pacing_strategy,
            pacing_config, timezone
     FROM slot_configs
     WHERE is_active = TRUE
     ORDER BY start_hour ASC`
  );
  return rows;
}

/**
 * Find the slot that covers the given hour (0–23).
 * @param {number} hour
 * @returns {Promise<Object|null>}
 */
async function getSlotByHour(hour) {
  const [rows] = await pool.query(
    `SELECT id, slot_name, start_hour, end_hour, budget_paise, pacing_strategy, pacing_config, timezone
     FROM slot_configs
     WHERE is_active = TRUE
       AND start_hour <= ? AND end_hour > ?
     LIMIT 1`,
    [hour, hour]
  );
  return rows[0] || null;
}

// ── Slot Budget Ledger ────────────────────────────────────────────────────────

/**
 * Get or create a budget ledger row for (slotId, date).
 * If it doesn't exist yet, creates it with the slot's configured budget.
 *
 * @param {number} slotId
 * @param {string} slotDate   'YYYY-MM-DD'
 * @param {number} budgetPaise
 * @returns {Promise<Object>}
 */
async function getOrCreateBudgetLedger(slotId, slotDate, budgetPaise) {
  // Upsert: if row exists, do nothing (spent_paise stays intact)
  await pool.query(
    `INSERT INTO slot_budget_ledger (slot_id, slot_date, total_budget_paise)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE slot_id = slot_id`,
    [slotId, slotDate, budgetPaise]
  );

  const [rows] = await pool.query(
    `SELECT id, slot_id, slot_date, total_budget_paise, spent_paise, game_count
     FROM slot_budget_ledger
     WHERE slot_id = ? AND slot_date = ?`,
    [slotId, slotDate]
  );
  return rows[0];
}

/**
 * Increment spent_paise and game_count after a game is settled (win/cashout).
 *
 * @param {number} ledgerId
 * @param {number} netWinningPaise   Amount paid out minus bet (winnings only)
 * @param {Object} [connection]
 * @returns {Promise<void>}
 */
async function incrementBudgetSpent(ledgerId, netWinningPaise, connection = null) {
  const db = connection || pool;
  await db.query(
    `UPDATE slot_budget_ledger
     SET spent_paise = spent_paise + ?,
         game_count  = game_count  + 1
     WHERE id = ?`,
    [netWinningPaise, ledgerId]
  );
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

/**
 * Insert an audit log entry. Fire-and-forget — errors are swallowed
 * so a logging failure never breaks a game request.
 *
 * @param {Object} data
 */
async function insertAuditLog(data) {
  const { entity_type, entity_id, action, actor, payload, ip_address } = data;
  try {
    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, actor, payload, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entity_type,
        String(entity_id),
        action,
        String(actor),
        payload ? JSON.stringify(payload) : null,
        ip_address || null,
      ]
    );
  } catch (err) {
    // Audit log failures must NEVER crash the app
    console.error('[AuditLog] Failed to insert audit log:', err.message);
  }
}

async function getRecentAuditLogs(entityType = null, limit = 25) {
  const params = [];
  let sql = `
    SELECT id, entity_type, entity_id, action, actor, payload, ip_address, created_at
    FROM audit_logs
  `;

  if (entityType) {
    sql += ' WHERE entity_type = ?';
    params.push(entityType);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getLatestAuditLogForActorAction(actor, action) {
  const [rows] = await pool.query(
    `
      SELECT id, actor, action, payload, created_at
      FROM audit_logs
      WHERE actor = ? AND action = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [String(actor), action]
  );

  return rows[0] || null;
}

async function getBudgetLedgerById(ledgerId, connection = null) {
  const db = connection || pool;
  const [rows] = await db.query(
    `SELECT id, slot_id, slot_date, total_budget_paise, spent_paise, game_count
     FROM slot_budget_ledger WHERE id = ? LIMIT 1`,
    [ledgerId]
  );
  return rows[0] || null;
}

async function getLatestRiskLevelAudit(slotId) {
  const [rows] = await pool.query(
    `SELECT id, payload, created_at
     FROM audit_logs
     WHERE entity_type = 'SLOT' AND entity_id = ? AND action = 'BUDGET_RISK_LEVEL_CHANGE'
     ORDER BY created_at DESC LIMIT 1`,
    [String(slotId)]
  );
  return rows[0] || null;
}

/**
 * Get budget utilisation for all active slots for today.
 * Joins slot_configs with today's ledger row (if any).
 * @returns {Promise<Array>}
 */
async function getSlotBudgetStatus() {
  const [rows] = await pool.query(
    `SELECT
       sc.id         AS id,
       sc.slot_name,
       sc.start_hour,
       sc.end_hour,
       sc.is_active,
       sc.budget_paise AS budget_paise,
       sc.budget_paise AS configured_budget_paise,
       sc.id AS slot_id,
       COALESCE(sbl.total_budget_paise, sc.budget_paise) AS total_budget_paise,
       sbl.id                                       AS ledger_id,
       COALESCE(sbl.spent_paise, 0)                      AS spent_paise,
       COALESCE(br.total_reserved, 0)                    AS reserved_paise,
       COALESCE(sbl.game_count, 0)                       AS game_count,
       COALESCE(sbl.slot_date, CURDATE())                AS slot_date,
       -- Derived fields
       (COALESCE(sbl.total_budget_paise, sc.budget_paise) - COALESCE(sbl.spent_paise, 0) - COALESCE(br.total_reserved, 0)) AS remaining_paise,
       CASE WHEN COALESCE(sbl.total_budget_paise, sc.budget_paise) > 0
            THEN ROUND((COALESCE(sbl.spent_paise, 0) / COALESCE(sbl.total_budget_paise, sc.budget_paise)) * 100, 2)
            ELSE 0 END AS spent_pct
     FROM slot_configs sc
     LEFT JOIN slot_budget_ledger sbl
       ON sbl.slot_id = sc.id AND sbl.slot_date = CURDATE()
     LEFT JOIN (
       SELECT slot_ledger_id, COALESCE(SUM(reserved_paise), 0) AS total_reserved
       FROM budget_reservations
       WHERE status = 'ACTIVE'
       GROUP BY slot_ledger_id
     ) br ON br.slot_ledger_id = sbl.id
     WHERE sc.is_active = TRUE
     ORDER BY sc.start_hour ASC`
  );
  return rows;
}

async function updateSlot(id, fields, updatedBy) {
  const { budget_paise, slot_name, start_hour, end_hour, is_active } = fields;
  await pool.query(
    `UPDATE slot_configs SET
      budget_paise  = COALESCE(?, budget_paise),
      slot_name     = COALESCE(?, slot_name),
      start_hour    = COALESCE(?, start_hour),
      end_hour      = COALESCE(?, end_hour),
      is_active     = COALESCE(?, is_active),
      updated_by    = ?
     WHERE id = ?`,
    [budget_paise ?? null, slot_name ?? null, start_hour ?? null, end_hour ?? null, is_active ?? null, updatedBy, id]
  );
}

module.exports = {
  getAllGlobalConfig,
  getGlobalConfig,
  setGlobalConfig,
  getActivePlayerOverrides,
  getAllSlots,
  getSlotByHour,
  getOrCreateBudgetLedger,
  getBudgetLedgerById,
  incrementBudgetSpent,
  insertAuditLog,
  getRecentAuditLogs,
  getLatestAuditLogForActorAction,
  getLatestRiskLevelAudit,
  updateSlot,
  getSlotBudgetStatus,
};
