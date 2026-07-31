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

const { pool } = require('../src/config/mysql');
const configRepository = require('../src/repositories/config.repository');
const cacheRepository = require('../src/repositories/cache.repository');

test('admin slot budget updates take effect immediately for today\'s ledger', async (t) => {
  const slotDate = new Date().toISOString().split('T')[0];
  const slotName = `budget-test-${Date.now()}`;

  let slotId;
  try {
    const [result] = await pool.query(
      `INSERT INTO slot_configs (slot_name, start_hour, end_hour, budget_paise, pacing_strategy, is_active)
       VALUES (?, 0, 23, ?, 'ADAPTIVE', TRUE)`,
      [slotName, 1000]
    );
    slotId = result.insertId;

    await configRepository.getOrCreateBudgetLedger(slotId, slotDate, 1000);

    const initialLedger = await configRepository.getBudgetLedgerById(
      (await configRepository.getOrCreateBudgetLedger(slotId, slotDate, 1000)).id
    );
    assert.equal(initialLedger.total_budget_paise, 1000);

    await configRepository.updateSlot(slotId, { budget_paise: 2500 }, 'test-admin');
    await configRepository.updateTodayLedgerBudget(slotId, slotDate, 2500);
    await cacheRepository.deleteBudgetState(slotId, slotDate);

    const refreshedLedger = await configRepository.getOrCreateBudgetLedger(slotId, slotDate, 2500);
    assert.equal(refreshedLedger.total_budget_paise, 2500);
  } finally {
    if (slotId) {
      await pool.query('DELETE FROM slot_budget_ledger WHERE slot_id = ?', [slotId]);
      await pool.query('DELETE FROM slot_configs WHERE id = ?', [slotId]);
    }
  }
});
