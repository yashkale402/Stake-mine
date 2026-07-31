'use strict';

/**
 * Budget risk policy. It changes only the parameters used when an immutable,
 * uniformly-random board is created; it never changes a board after creation.
 */
const RISK_LEVELS = Object.freeze({
  NORMAL: 'NORMAL',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  normal: 50,
  low: 75,
  medium: 90,
  high: 100,
  critical: 100,
});

function normalizeThresholds(input = {}) {
  const value = (key, fallback) => {
    const parsed = Number(input[key]);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  };
  const normal = value('normal', DEFAULT_THRESHOLDS.normal);
  const low = Math.max(normal, value('low', DEFAULT_THRESHOLDS.low));
  const medium = Math.max(low, value('medium', DEFAULT_THRESHOLDS.medium));
  const high = Math.max(medium, value('high', DEFAULT_THRESHOLDS.high));
  return { normal, low, medium, high, critical: Math.max(high, value('critical', DEFAULT_THRESHOLDS.critical)) };
}

function getRiskLevel(budgetUsagePct, thresholds = DEFAULT_THRESHOLDS) {
  const usage = Math.max(0, Number(budgetUsagePct) || 0);
  const t = normalizeThresholds(thresholds);
  if (usage <= t.normal) return RISK_LEVELS.NORMAL;
  if (usage <= t.low) return RISK_LEVELS.LOW;
  if (usage <= t.medium) return RISK_LEVELS.MEDIUM;
  if (usage <= t.high) return RISK_LEVELS.HIGH;
  return RISK_LEVELS.CRITICAL;
}

function getRiskAdjustments(level) {
  switch (level) {
    case RISK_LEVELS.LOW:
      return { mineDelta: 1, edgeDelta: 0.01, multiplierCapFactor: 0.95 };
    case RISK_LEVELS.MEDIUM:
      return { mineDelta: 2, edgeDelta: 0.03, multiplierCapFactor: 0.78 };
    case RISK_LEVELS.HIGH:
      return { mineDelta: 3, edgeDelta: 0.06, multiplierCapFactor: 0.60 };
    case RISK_LEVELS.CRITICAL:
      return { mineDelta: 4, edgeDelta: 0.10, multiplierCapFactor: 0.45 };
    default:
      return { mineDelta: 0, edgeDelta: 0, multiplierCapFactor: 1 };
  }
}

/**
 * Produces bounded game parameters. Mine positions remain uniformly random
 * among every valid board for the selected mine count.
 */
function computeRiskProfile({
  requestedMines, boardSize, baseHouseEdge, totalBudgetPaise, spentPaise,
  reservedPaise = 0, thresholds,
}) {
  const dailyBudget = Math.max(0, Number(totalBudgetPaise) || 0);
  const usedBudget = Math.max(0, Number(spentPaise) || 0);
  const reservedBudget = Math.max(0, Number(reservedPaise) || 0);
  const budgetUsagePct = dailyBudget > 0 ? (usedBudget / dailyBudget) * 100 : 0;
  const effectiveUsagePct = dailyBudget > 0 ? ((usedBudget + reservedBudget) / dailyBudget) * 100 : 0;
  const level = getRiskLevel(effectiveUsagePct, thresholds);
  const adjustment = getRiskAdjustments(level);
  const maxMines = Math.max(1, boardSize - 1); // always leave at least one possible safe cell

  const effectiveMines = Math.min(maxMines, Math.max(1, Number(requestedMines) + adjustment.mineDelta));
  const effectiveHouseEdge = Math.min(0.20, Math.max(0.01, Number(baseHouseEdge) + adjustment.edgeDelta));

  return {
    level,
    mode: level,
    mines: effectiveMines,
    houseEdge: effectiveHouseEdge,
    multiplierCapFactor: adjustment.multiplierCapFactor,
    dailyBudget,
    usedBudget,
    reservedBudget,
    remainingBudget: Math.max(0, dailyBudget - usedBudget - reservedBudget),
    budgetUsagePct: Math.round(budgetUsagePct * 100) / 100,
    effectiveUsagePct: Math.round(effectiveUsagePct * 100) / 100,
    protectionStatus: level === RISK_LEVELS.NORMAL ? 'INACTIVE' : 'ACTIVE',
  };
}

module.exports = { RISK_LEVELS, DEFAULT_THRESHOLDS, normalizeThresholds, getRiskLevel, getRiskAdjustments, computeRiskProfile };
