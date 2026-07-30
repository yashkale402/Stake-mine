'use strict';

const configRepository = require('../repositories/config.repository');
const budgetRepository = require('../repositories/budget.repository');
const playerProfileService = require('./player-profile.service');
const { getRiskLevel, getRiskAdjustments, normalizeThresholds } = require('./risk-engine');

/**
 * Compute a quote for maximum allowed payout for a prospective game start.
 * This function is intentionally conservative and returns an object:
 * { maxAllowedPayout, maxMultiplier, riskLevel }
 */
async function quotePayout({ userId, betPaise, mineCount, boardSize, slotLedgerId }) {
  // Load runtime config values
  const rtpCfg = await configRepository.getGlobalConfig('rtp_target');
  const houseEdgeCfg = await configRepository.getGlobalConfig('house_edge');
  const maxMultiplierCfg = await configRepository.getGlobalConfig('maximum_multiplier');
  const [normalCfg, lowCfg, mediumCfg, highCfg, criticalCfg] = await Promise.all([
    configRepository.getGlobalConfig('risk_normal_threshold_pct'), configRepository.getGlobalConfig('risk_low_threshold_pct'),
    configRepository.getGlobalConfig('risk_medium_threshold_pct'), configRepository.getGlobalConfig('risk_high_threshold_pct'),
    configRepository.getGlobalConfig('risk_critical_threshold_pct'),
  ]);

  const rtpTarget = rtpCfg ? Number(JSON.parse(rtpCfg.config_value)) : 0.95;
  const houseEdge = houseEdgeCfg ? Number(JSON.parse(houseEdgeCfg.config_value)) : 0.05;
  const configuredMaxMultiplier = maxMultiplierCfg ? Number(JSON.parse(maxMultiplierCfg.config_value)) : 100;

  // Load ledger row to compute remaining budget
  const ledgerRow = await configRepository.getBudgetLedgerById(slotLedgerId);
  if (!ledgerRow) {
    const err = new Error('Slot budget ledger not found');
    err.statusCode = 404;
    throw err;
  }
  const totalBudget = Number(ledgerRow.total_budget_paise || 0);
  const spent = Number(ledgerRow.spent_paise || 0);
  const reserved = await budgetRepository.getActiveReservedSum(slotLedgerId);
  const remaining = Math.max(0, totalBudget - spent - reserved);

  const budgetUsagePct = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
  const thresholds = normalizeThresholds({
    normal: normalCfg ? JSON.parse(normalCfg.config_value) : 50,
    low: lowCfg ? JSON.parse(lowCfg.config_value) : 75,
    medium: mediumCfg ? JSON.parse(mediumCfg.config_value) : 90,
    high: highCfg ? JSON.parse(highCfg.config_value) : 100,
    critical: criticalCfg ? JSON.parse(criticalCfg.config_value) : 100,
  });
  const riskLevel = getRiskLevel(budgetUsagePct, thresholds);

  // Player profile adjustments
  const profile = await playerProfileService.getPlayerProfile(userId);
  let profileFactor = 1.0;
  if (profile === 'NEW_PLAYER') profileFactor = 1.1;
  if (profile === 'HIGH_ROLLER') profileFactor = 0.8;
  if (profile === 'LOSS_RECOVERY') profileFactor = 1.05;

  // Base max multiplier (conservative): scale down by house edge and risk
  const riskMultiplierCap = Math.max(1.25, configuredMaxMultiplier * getRiskAdjustments(riskLevel).multiplierCapFactor);

  const maxMultiplier = Math.max(1.0, Math.floor(riskMultiplierCap * profileFactor * 100) / 100);

  // Max allowed payout is limited by remaining budget and configured maximum exposure
  const maxExposureCfg = await configRepository.getGlobalConfig('maximum_exposure_paise');
  const maxExposure = maxExposureCfg ? Number(JSON.parse(maxExposureCfg.config_value)) : Infinity;

  const potentialPayout = Math.floor(betPaise * maxMultiplier);
  const allowedByBudget = Math.floor(remaining * 0.9); // hold 10% buffer
  const maxAllowedPayout = Math.min(potentialPayout, allowedByBudget, maxExposure);

  return { maxAllowedPayout, maxMultiplier, riskLevel, remaining, totalBudget, budgetUsagePct };
}

module.exports = { quotePayout };
