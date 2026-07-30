'use strict';

const { pool } = require('../config/mysql');

/**
 * Create a reservation row for a game. Intended to be called inside a
 * transaction when creating a game session.
 */
async function createReservation({ reservationUuid, gameUuid, userId, slotLedgerId, reservedPaise }, connection = null) {
  const db = connection || pool;
  await db.query(
    `INSERT INTO budget_reservations
       (reservation_uuid, game_uuid, user_id, slot_ledger_id, reserved_paise)
     VALUES (?, ?, ?, ?, ?)`,
    [reservationUuid, gameUuid, userId, slotLedgerId, reservedPaise]
  );
}

async function getActiveReservedSum(slotLedgerId, connection = null) {
  const db = connection || pool;
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(reserved_paise),0) AS total_reserved
     FROM budget_reservations
     WHERE slot_ledger_id = ? AND status = 'ACTIVE'`,
    [slotLedgerId]
  );
  return Number(rows[0].total_reserved || 0);
}

async function findReservationByGameUuid(gameUuid, connection = null) {
  const db = connection || pool;
  const [rows] = await db.query(
    `SELECT * FROM budget_reservations WHERE game_uuid = ? LIMIT 1`,
    [gameUuid]
  );
  return rows[0] || null;
}

async function settleReservationByGameUuid(gameUuid, amountPaise, connection = null) {
  const db = connection || pool;
  // Mark reservation as SETTLED and record settled_at. Preserve the original reserved amount.
  await db.query(
    `UPDATE budget_reservations
     SET status = 'SETTLED', settled_at = NOW()
     WHERE game_uuid = ? AND status = 'ACTIVE'`,
    [gameUuid]
  );
}

async function releaseReservationByGameUuid(gameUuid, connection = null) {
  const db = connection || pool;
  await db.query(
    `UPDATE budget_reservations
     SET status = 'RELEASED', settled_at = NOW()
     WHERE game_uuid = ? AND status = 'ACTIVE'`,
    [gameUuid]
  );
}

async function insertBudgetHistory({ slotLedgerId, changeType, amountPaise, reason, relatedUuid }, connection = null) {
  const db = connection || pool;
  await db.query(
    `INSERT INTO budget_history (slot_ledger_id, change_type, amount_paise, reason, related_uuid)
     VALUES (?, ?, ?, ?, ?)`,
    [slotLedgerId, changeType, amountPaise, reason || null, relatedUuid || null]
  );
}

module.exports = {
  createReservation,
  getActiveReservedSum,
  findReservationByGameUuid,
  settleReservationByGameUuid,
  releaseReservationByGameUuid,
  insertBudgetHistory,
};
