'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generateMinePositions, computeMultiplier } = require('../src/services/game.service');
const {
  buildPlayerEngagementProfile,
  calculateStreaks,
  resolveDailyReward,
} = require('../src/services/player-engagement.helper');

test('generateMinePositions returns unique sorted mine positions inside bounds', () => {
  const mines = generateMinePositions(25, 5);

  assert.equal(mines.length, 5);
  assert.deepEqual([...mines].sort((a, b) => a - b), mines);
  assert.equal(new Set(mines).size, mines.length);
  mines.forEach((value) => {
    assert.ok(value >= 0 && value < 25);
  });
});

test('computeMultiplier increases after safe reveals', () => {
  const zeroReveal = computeMultiplier(0, 3, 25, 0.05);
  const firstReveal = computeMultiplier(1, 3, 25, 0.05);
  const secondReveal = computeMultiplier(2, 3, 25, 0.05);

  assert.equal(zeroReveal, 1.0);
  assert.ok(firstReveal > zeroReveal);
  assert.ok(secondReveal > firstReveal);
});

test('calculateStreaks derives current and best streak from recent history', () => {
  const result = calculateStreaks([
    { outcome: 'CASHOUT' },
    { outcome: 'WIN' },
    { outcome: 'LOSS' },
    { outcome: 'WIN' },
    { outcome: 'WIN' },
    { outcome: 'WIN' },
  ]);

  assert.deepEqual(result, { current: 2, best: 3 });
});

test('resolveDailyReward detects same-day claims', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const available = resolveDailyReward(null, now);
  const unavailable = resolveDailyReward('2026-07-24T05:00:00.000Z', now);

  assert.equal(available.available, true);
  assert.equal(unavailable.available, false);
});

test('buildPlayerEngagementProfile produces missions, badges, and progression', () => {
  const profile = buildPlayerEngagementProfile({
    stats: {
      total_games: 12,
      wins: 2,
      cashouts: 4,
      losses: 6,
      total_wagered_paise: 50000,
      total_paid_paise: 62000,
      biggest_cashout_paise: 26000,
      net_profit_paise: 12000,
      average_multiplier: 1.67,
    },
    history: [
      { outcome: 'WIN' },
      { outcome: 'CASHOUT' },
      { outcome: 'LOSS' },
      { outcome: 'WIN' },
    ],
    lastDailyRewardAt: null,
    now: new Date('2026-07-24T12:00:00.000Z'),
  });

  assert.equal(profile.progression.level, 2);
  assert.equal(profile.daily_reward.available, true);
  assert.equal(profile.missions.length >= 4, true);
  assert.equal(profile.badges.some((badge) => badge.unlocked), true);
  assert.equal(profile.stats.current_streak, 2);
});
