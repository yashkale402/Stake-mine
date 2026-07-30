'use strict';

const configRepository = require('../repositories/config.repository');
const budgetRepository = require('../repositories/budget.repository');
const playerProfileService = require('./player-profile.service');

/**
 * Compute a quote for maximum allowed payout for a prospective game start.
 * This function is intentionally conservative and returns an object:
 * { maxAllowedPayout, maxMultiplier, riskLevel }
 */
async function quotePayout({ userId, betPaise, mineCount, boardSize, slotLedgerId }) {
  // Load runtime config values
  const rtpCfg = await configRepository.getGlobalConfig('rtp_target');
  const houseEdgeCfg = await configRepository.getGlobalConfig('house_edge');
  const emergencyThresholdCfg = await configRepository.getGlobalConfig('emergency_threshold_pct');
  const maxMultiplierCfg = await configRepository.getGlobalConfig('maximum_multiplier');

  const rtpTarget = rtpCfg ? Number(JSON.parse(rtpCfg.config_value)) : 0.95;
  const houseEdge = houseEdgeCfg ? Number(JSON.parse(houseEdgeCfg.config_value)) : 0.05;
  const emergencyThreshold = emergencyThresholdCfg ? Number(JSON.parse(emergencyThresholdCfg.config_value)) : 0.2;
  const configuredMaxMultiplier = maxMultiplierCfg ? Number(JSON.parse(maxMultiplierCfg.config_value)) : 100;

  // Load ledger row to compute remaining budget
  const ledgerRow = await configRepository.getOrCreateBudgetLedger(slotLedgerId, new Date().toISOString().split('T')[0], 0);
  const totalBudget = Number(ledgerRow.total_budget_paise || 0);
  const spent = Number(ledgerRow.spent_paise || 0);
  const reserved = await budgetRepository.getActiveReservedSum(slotLedgerId);
  const remaining = Math.max(0, totalBudget - spent - reserved);

  const remainingPct = totalBudget > 0 ? remaining / totalBudget : 1;
  let riskLevel = 'NORMAL';
  if (remainingPct < 0.10) riskLevel = 'CRITICAL';
  else if (remainingPct < 0.20) riskLevel = 'HIGH';
  else if (remainingPct < 0.50) riskLevel = 'NORMAL';
  else riskLevel = 'LOW';

  // Player profile adjustments
  const profile = await playerProfileService.getPlayerProfile(userId);
  let profileFactor = 1.0;
  if (profile === 'NEW_PLAYER') profileFactor = 1.1;
  if (profile === 'HIGH_ROLLER') profileFactor = 0.8;
  if (profile === 'LOSS_RECOVERY') profileFactor = 1.05;

  // Base max multiplier (conservative): scale down by house edge and risk
  let riskMultiplierCap = configuredMaxMultiplier;
  if (riskLevel === 'HIGH') riskMultiplierCap = Math.max(2, configuredMaxMultiplier * 0.6);
  if (riskLevel === 'CRITICAL') riskMultiplierCap = Math.max(1.5, configuredMaxMultiplier * 0.4);

  const maxMultiplier = Math.max(1.0, Math.floor(riskMultiplierCap * profileFactor * 100) / 100);

  // Max allowed payout is limited by remaining budget and configured maximum exposure
  const maxExposureCfg = await configRepository.getGlobalConfig('maximum_exposure_paise');
  const maxExposure = maxExposureCfg ? Number(JSON.parse(maxExposureCfg.config_value)) : Infinity;

  const potentialPayout = Math.floor(betPaise * maxMultiplier);
  const allowedByBudget = Math.floor(remaining * 0.9); // hold 10% buffer
  const maxAllowedPayout = Math.min(potentialPayout, allowedByBudget, maxExposure);

  return { maxAllowedPayout, maxMultiplier, riskLevel, remaining, totalBudget };
}

module.exports = { quotePayout };
