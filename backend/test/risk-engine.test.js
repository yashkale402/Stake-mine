'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeRiskProfile, getRiskLevel } = require('../src/services/risk-engine');

const thresholds = { normal: 50, low: 75, medium: 90, high: 100, critical: 100 };

test('risk levels follow configured budget usage thresholds and recover', () => {
  assert.equal(getRiskLevel(50, thresholds), 'NORMAL');
  assert.equal(getRiskLevel(50.01, thresholds), 'LOW');
  assert.equal(getRiskLevel(75.01, thresholds), 'MEDIUM');
  assert.equal(getRiskLevel(90.01, thresholds), 'HIGH');
  assert.equal(getRiskLevel(100.01, thresholds), 'CRITICAL');
  assert.equal(getRiskLevel(49, thresholds), 'NORMAL');
});

test('critical protection stays random-capable and always leaves a safe cell', () => {
  const profile = computeRiskProfile({
    requestedMines: 24, boardSize: 25, baseHouseEdge: 0.05,
    totalBudgetPaise: 10000, spentPaise: 10001, thresholds,
  });
  assert.equal(profile.level, 'CRITICAL');
  assert.equal(profile.mines, 24);
  assert.ok(profile.houseEdge <= 0.20);
  assert.equal(profile.remainingBudget, 0);
  assert.equal(profile.protectionStatus, 'ACTIVE');
});

test('risk progressively limits payout exposure without changing normal mode', () => {
  const normal = computeRiskProfile({ requestedMines: 3, boardSize: 25, baseHouseEdge: 0.05, totalBudgetPaise: 10000, spentPaise: 0, thresholds });
  const high = computeRiskProfile({ requestedMines: 3, boardSize: 25, baseHouseEdge: 0.05, totalBudgetPaise: 10000, spentPaise: 9500, thresholds });
  assert.equal(normal.mines, 3);
  assert.equal(normal.houseEdge, 0.05);
  assert.ok(high.mines > normal.mines);
  assert.ok(high.houseEdge > normal.houseEdge);
  assert.ok(high.multiplierCapFactor < normal.multiplierCapFactor);
});

test('reserved budget contributes to effective risk pressure', () => {
  const base = computeRiskProfile({
    requestedMines: 3, boardSize: 25, baseHouseEdge: 0.05,
    totalBudgetPaise: 10000, spentPaise: 4000, reservedPaise: 1500, thresholds,
  });
  assert.equal(base.level, 'LOW');
  assert.equal(base.budgetUsagePct, 40);
  assert.equal(base.effectiveUsagePct, 55);
});
