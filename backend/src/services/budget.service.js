'use strict';

const { v4: uuidv4 } = require('uuid');
const budgetRepository = require('../repositories/budget.repository');
const configRepository = require('../repositories/config.repository');

/**
 * Reserve budget for a starting game. Throws if reservation cannot be made.
 * Returns the reservedPaise value.
 */
async function reserveBudgetForGame({ gameUuid, userId, slotLedgerId, requestedPayoutPaise }, connection = null) {
  const reservationUuid = uuidv4();

  // Calculate current remaining budget using ledger and active reservations
  const ledger = await configRepository.getOrCreateBudgetLedger(slotLedgerId, new Date().toISOString().split('T')[0], 0);
  const totalBudget = Number(ledger.total_budget_paise || 0);
  const spent = Number(ledger.spent_paise || 0);
  const reserved = await budgetRepository.getActiveReservedSum(slotLedgerId, connection);
  const remaining = Math.max(0, totalBudget - spent - reserved);

  if (requestedPayoutPaise > remaining) {
    const err = new Error('Insufficient slot budget for this bet');
    err.statusCode = 409;
    throw err;
  }

  // Create reservation row (uses provided connection if present)
  await budgetRepository.createReservation({
    reservationUuid,
    gameUuid,
    userId,
    slotLedgerId,
    reservedPaise: requestedPayoutPaise,
  }, connection);

  // Insert budget history record
  await budgetRepository.insertBudgetHistory({
    slotLedgerId,
    changeType: 'RESERVATION',
    amountPaise: requestedPayoutPaise,
    reason: 'GAME_START_RESERVATION',
    relatedUuid: gameUuid,
  }, connection);

  return requestedPayoutPaise;
}

async function settleReservationOnCashout(gameUuid, payoutPaise, connection = null) {
  // Mark reservation settled
  await budgetRepository.settleReservationByGameUuid(gameUuid, payoutPaise, connection);
  // Insert settlement history
  const reservation = await budgetRepository.findReservationByGameUuid(gameUuid, connection);
  if (reservation) {
    await budgetRepository.insertBudgetHistory({
      slotLedgerId: reservation.slot_ledger_id,
      changeType: 'SETTLEMENT',
      amountPaise: payoutPaise,
      reason: 'GAME_CASHOUT',
      relatedUuid: gameUuid,
    }, connection);
  }
}

async function releaseReservationOnLoss(gameUuid, connection = null) {
  const reservation = await budgetRepository.findReservationByGameUuid(gameUuid, connection);
  if (!reservation) return;
  await budgetRepository.releaseReservationByGameUuid(gameUuid, connection);
  await budgetRepository.insertBudgetHistory({
    slotLedgerId: reservation.slot_ledger_id,
    changeType: 'RELEASE',
    amountPaise: reservation.reserved_paise,
    reason: 'GAME_LOSS_RELEASE',
    relatedUuid: gameUuid,
  }, connection);
}

module.exports = {
  reserveBudgetForGame,
  settleReservationOnCashout,
  releaseReservationOnLoss,
};
