'use strict';

const { v4: uuidv4 } = require('uuid');
const budgetRepository = require('../repositories/budget.repository');
const configRepository = require('../repositories/config.repository');
const { normalizeThresholds, getRiskLevel } = require('./risk-engine');

function thresholdsFromConfig(config = {}) {
  return normalizeThresholds({
    normal: config.risk_normal_threshold_pct,
    low: config.risk_low_threshold_pct,
    medium: config.risk_medium_threshold_pct,
    high: config.risk_high_threshold_pct,
    critical: config.risk_critical_threshold_pct,
  });
}

async function recordRiskLevelTransition({ slotId, riskLevel, budgetUsagePct, reason }) {
  if (!slotId) return null;
  const previous = await configRepository.getLatestRiskLevelAudit(slotId);
  let previousLevel = null;
  try { previousLevel = previous?.payload ? JSON.parse(previous.payload).newLevel : null; } catch { previousLevel = null; }
  if (previousLevel === riskLevel) return previous;

  await configRepository.insertAuditLog({
    entity_type: 'SLOT', entity_id: slotId, action: 'BUDGET_RISK_LEVEL_CHANGE', actor: 'risk-engine',
    payload: { previousLevel, newLevel: riskLevel, budgetUsagePct, timestamp: new Date().toISOString(), reason },
  });
  return null;
}

async function getRiskDashboard() {
  const [slots, configRows] = await Promise.all([
    configRepository.getSlotBudgetStatus(),
    configRepository.getAllGlobalConfig(),
  ]);
  const config = Object.fromEntries(configRows.map((row) => {
    try { return [row.config_key, JSON.parse(row.config_value)]; } catch { return [row.config_key, row.config_value]; }
  }));
  const thresholds = thresholdsFromConfig(config);
  return Promise.all(slots.map(async (slot) => {
    const dailyBudget = Number(slot.total_budget_paise || 0);
    const usedBudget = Number(slot.spent_paise || 0);
    const budgetUsagePct = dailyBudget > 0 ? Math.round((usedBudget / dailyBudget) * 10000) / 100 : 0;
    const currentRiskLevel = getRiskLevel(budgetUsagePct, thresholds);
    await recordRiskLevelTransition({
      slotId: slot.slot_id,
      riskLevel: currentRiskLevel,
      budgetUsagePct,
      reason: 'BUDGET_STATUS_RECALCULATION',
    });
    const lastChange = await configRepository.getLatestRiskLevelAudit(slot.slot_id);
    let activeSince = null;
    try {
      const payload = lastChange?.payload ? JSON.parse(lastChange.payload) : null;
      activeSince = payload?.newLevel === currentRiskLevel ? lastChange.created_at : null;
    } catch { activeSince = null; }
    return {
      ...slot, id: slot.slot_id,
      daily_budget_paise: dailyBudget, used_budget_paise: usedBudget,
      remaining_paise: Math.max(0, dailyBudget - usedBudget),
      spent_pct: budgetUsagePct, budget_usage_pct: budgetUsagePct,
      current_risk_level: currentRiskLevel,
      protection_status: currentRiskLevel === 'NORMAL' ? 'INACTIVE' : 'ACTIVE',
      last_risk_level_change: lastChange?.created_at || null,
      active_since: activeSince || lastChange?.created_at || null,
    };
  }));
}

/**
 * Reserve budget for a starting game. Reservations are accounting safeguards,
 * not admission control: a depleted slot must never reject a valid game.
 * Returns the reservedPaise value.
 */
async function reserveBudgetForGame({ gameUuid, userId, slotLedgerId, requestedPayoutPaise }, connection = null) {
  const reservationUuid = uuidv4();

  // Calculate current remaining budget using ledger and active reservations
  const ledger = await configRepository.getBudgetLedgerById(slotLedgerId, connection);
  if (!ledger) return 0;
  const totalBudget = Number(ledger.total_budget_paise || 0);
  const spent = Number(ledger.spent_paise || 0);
  const reserved = await budgetRepository.getActiveReservedSum(slotLedgerId, connection);
  const remaining = Math.max(0, totalBudget - spent - reserved);

  const reservedPaise = Math.max(0, Math.min(Number(requestedPayoutPaise) || 0, remaining));
  if (reservedPaise <= 0) return 0;

  // Create reservation row (uses provided connection if present)
  await budgetRepository.createReservation({
    reservationUuid,
    gameUuid,
    userId,
    slotLedgerId,
    reservedPaise,
  }, connection);

  // Insert budget history record
  await budgetRepository.insertBudgetHistory({
    slotLedgerId,
    changeType: 'RESERVATION',
    amountPaise: reservedPaise,
    reason: reservedPaise < requestedPayoutPaise ? 'GAME_START_PARTIAL_RESERVATION' : 'GAME_START_RESERVATION',
    relatedUuid: gameUuid,
  }, connection);

  return reservedPaise;
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
  thresholdsFromConfig,
  recordRiskLevelTransition,
  getRiskDashboard,
};
