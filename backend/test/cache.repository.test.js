'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PORT = '3001';
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_PORT = '3306';
process.env.MYSQL_DATABASE = 'stake_mine';
process.env.MYSQL_USER = 'root';
process.env.MYSQL_PASSWORD = 'root';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test-secret';

const redisClient = require('../src/config/redis');
const cacheRepository = require('../src/repositories/cache.repository');

test('incrementBudgetReserved preserves the full sum under concurrent calls', async (t) => {
  const slotId = 77;
  const date = '2099-01-01';
  const key = cacheRepository.KEYS.budget(slotId, date);
  const concurrency = 20;
  const incrementAmount = 250;

  try {
    await redisClient.connect();
  } catch (err) {
    t.skip(`Redis is unavailable: ${err.message}`);
    return;
  }

  try {
    await redisClient.del(key);
    await redisClient.set(
      key,
      JSON.stringify({
        totalBudgetPaise: 10_000,
        spentPaise: 0,
        reservedPaise: 0,
        remainingPaise: 10_000,
      }),
      { EX: 30 }
    );

    await Promise.all(
      Array.from({ length: concurrency }, () => cacheRepository.incrementBudgetReserved(slotId, date, incrementAmount))
    );

    const raw = await redisClient.get(key);
    assert.ok(raw, 'expected the cache entry to be written');
    const state = JSON.parse(raw);
    assert.equal(state.reservedPaise, concurrency * incrementAmount);
    assert.equal(state.remainingPaise, Math.max(0, 10_000 - state.reservedPaise));
  } finally {
    await redisClient.del(key);
    await redisClient.disconnect();
  }
});
