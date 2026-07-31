/**
 * cache.repository.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Redis data-access layer.
 *
 * Design principles:
 *   - Every key has a TTL. Redis is ephemeral — never sole source of truth.
 *   - Redis failures degrade gracefully; they do NOT break game requests.
 *   - All key naming is centralised here. No scattered key strings across services.
 *   - Atomic operations (SET NX, HINCRBY, Lua scripts) used where race conditions exist.
 *
 * Key Naming Convention:
 *   game:{gameUuid}                     → Active game state (Hash)
 *   player:active_game:{userId}         → Pointer to current gameUuid (String)
 *   player:stats:{userId}               → Session stats (Hash)
 *   config:effective:{userId}           → Merged effective config (String/JSON)
 *   config:global:version               → Global config version counter (String)
 *   budget:slot:{slotId}:{YYYY-MM-DD}  → Slot budget state (Hash)
 *   lock:cashout:{gameUuid}             → Distributed cashout lock (String/NX)
 *   idempotency:reveal:{gameUuid}:{idx} → Reveal idempotency (String/JSON)
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const redisClient = require('../config/redis');
const logger      = require('../logger/logger');

// ── Key Builders ──────────────────────────────────────────────────────────────

const KEYS = {
  game:              (uuid)           => `game:${uuid}`,
  activeGame:        (userId)         => `player:active_game:${userId}`,
  playerStats:       (userId)         => `player:stats:${userId}`,
  effectiveConfig:   (userId)         => `config:effective:${userId}`,
  globalConfigVer:   ()               => 'config:global:version',
  budget:            (slotId, date)   => `budget:slot:${slotId}:${date}`,
  cashoutLock:       (uuid)           => `lock:cashout:${uuid}`,
  revealIdempotency: (uuid, cellIdx)  => `idempotency:reveal:${uuid}:${cellIdx}`,
};

// ── TTL Constants (seconds) ───────────────────────────────────────────────────
const TTL = {
  GAME:              3600,   // 1 hour — overridden to match config.game_expiry_seconds
  ACTIVE_GAME_PTR:   3600,
  PLAYER_STATS:      86400,  // 1 day
  EFFECTIVE_CONFIG:  300,    // 5 minutes
  BUDGET:            86400,  // 1 day (slot resets daily)
  CASHOUT_LOCK:      10,     // 10 seconds — auto-expire if holder crashes
  REVEAL_IDEMPOTENCY:300,    // 5 minutes — covers network retry window
};

// Lua script: GET + mutate + SET in one Redis operation so concurrent reservation
// updates cannot race and overwrite each other on the same budget cache entry.
const INCREMENT_BUDGET_RESERVED_SCRIPT = `
  local raw = redis.call('get', KEYS[1])
  if not raw then return nil end

  local state = cjson.decode(raw)
  local delta = tonumber(ARGV[1]) or 0
  local reserved = tonumber(state.reservedPaise) or 0
  state.reservedPaise = reserved + delta

  if type(state.totalBudgetPaise) == 'number' then
    local spent = tonumber(state.spentPaise) or 0
    state.remainingPaise = math.max(0, state.totalBudgetPaise - spent - state.reservedPaise)
  end

  local ttl = redis.call('ttl', KEYS[1])
  if ttl > 0 then
    redis.call('set', KEYS[1], cjson.encode(state), 'EX', ttl)
  end

  return 1
`;

// Lua script: GET + mutate + SET in one Redis operation so concurrent release
// updates cannot race and restore a stale reservation value over a newer one.
const DECREMENT_BUDGET_RESERVED_SCRIPT = `
  local raw = redis.call('get', KEYS[1])
  if not raw then return nil end

  local state = cjson.decode(raw)
  local delta = tonumber(ARGV[1]) or 0
  local reserved = tonumber(state.reservedPaise) or 0
  state.reservedPaise = math.max(0, reserved - delta)

  if type(state.totalBudgetPaise) == 'number' then
    local spent = tonumber(state.spentPaise) or 0
    state.remainingPaise = math.max(0, state.totalBudgetPaise - spent - state.reservedPaise)
  end

  local ttl = redis.call('ttl', KEYS[1])
  if ttl > 0 then
    redis.call('set', KEYS[1], cjson.encode(state), 'EX', ttl)
  end

  return 1
`;

// ── Game State (Hash) ─────────────────────────────────────────────────────────

/**
 * Store the full game state as a Redis Hash.
 * @param {string} gameUuid
 * @param {Object} gameState
 * @param {number} ttlSeconds
 */
async function setGameState(gameUuid, gameState, ttlSeconds = TTL.GAME) {
  try {
    const key = KEYS.game(gameUuid);
    // Store as a flat JSON string — simpler than multi-field hash for this object size
    await redisClient.set(key, JSON.stringify(gameState), { EX: ttlSeconds });
    logger.debug(`[Cache] Game state set: ${key} TTL=${ttlSeconds}s`);
  } catch (err) {
    logger.error(`[Cache] setGameState error: ${err.message}`);
    // Redis failure does NOT crash the request — MySQL is source of truth
  }
}

/**
 * Retrieve the full game state.
 * @param {string} gameUuid
 * @returns {Promise<Object|null>}
 */
async function getGameState(gameUuid) {
  try {
    const raw = await redisClient.get(KEYS.game(gameUuid));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.error(`[Cache] getGameState error: ${err.message}`);
    return null;
  }
}

/**
 * Delete game state from Redis (called on game end).
 * @param {string} gameUuid
 */
async function deleteGameState(gameUuid) {
  try {
    await redisClient.del(KEYS.game(gameUuid));
  } catch (err) {
    logger.error(`[Cache] deleteGameState error: ${err.message}`);
  }
}

// ── Active Game Pointer ───────────────────────────────────────────────────────

/**
 * Set the active game pointer for a player.
 * Uses SET NX — will not overwrite if player already has an active game.
 *
 * @param {number} userId
 * @param {string} gameUuid
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>} true if set; false if already exists
 */
async function setActiveGamePointer(userId, gameUuid, ttlSeconds = TTL.ACTIVE_GAME_PTR) {
  try {
    const result = await redisClient.set(
      KEYS.activeGame(userId),
      gameUuid,
      { EX: ttlSeconds }
    );
    return result === 'OK';
  } catch (err) {
    logger.error(`[Cache] setActiveGamePointer error: ${err.message}`);
    return false;
  }
}

/**
 * Get the current active gameUuid for a player.
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
async function getActiveGamePointer(userId) {
  try {
    return await redisClient.get(KEYS.activeGame(userId));
  } catch (err) {
    logger.error(`[Cache] getActiveGamePointer error: ${err.message}`);
    return null;
  }
}

/**
 * Delete the active game pointer (called on game end).
 * @param {number} userId
 */
async function deleteActiveGamePointer(userId) {
  try {
    await redisClient.del(KEYS.activeGame(userId));
  } catch (err) {
    logger.error(`[Cache] deleteActiveGamePointer error: ${err.message}`);
  }
}

// ── Slot Budget Cache ─────────────────────────────────────────────────────────

/**
 * Cache slot budget state.
 * @param {number} slotId
 * @param {string} date  'YYYY-MM-DD'
 * @param {Object} budgetState  { ledgerId, totalBudgetPaise, spentPaise, gameCount }
 * @param {number} ttlSeconds
 */
async function setBudgetState(slotId, date, budgetState, ttlSeconds = TTL.BUDGET) {
  try {
    await redisClient.set(
      KEYS.budget(slotId, date),
      JSON.stringify(budgetState),
      { EX: ttlSeconds }
    );
  } catch (err) {
    logger.error(`[Cache] setBudgetState error: ${err.message}`);
  }
}

/**
 * Get cached slot budget state.
 * @param {number} slotId
 * @param {string} date
 * @returns {Promise<Object|null>}
 */
async function getBudgetState(slotId, date) {
  try {
    const raw = await redisClient.get(KEYS.budget(slotId, date));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.error(`[Cache] getBudgetState error: ${err.message}`);
    return null;
  }
}

/**
 * Atomically increment the spent amount in the budget cache.
 * @param {number} slotId
 * @param {string} date
 * @param {number} amountPaise
 */
async function incrementBudgetSpent(slotId, date, amountPaise) {
  try {
    const key = KEYS.budget(slotId, date);
    const raw = await redisClient.get(key);
    if (!raw) return; // Cache miss — will be repopulated from MySQL on next read

    const state = JSON.parse(raw);
    state.spentPaise = (state.spentPaise || 0) + amountPaise;
    state.gameCount  = (state.gameCount  || 0) + 1;
    if (typeof state.totalBudgetPaise === 'number') {
      state.remainingPaise = Math.max(0, state.totalBudgetPaise - state.spentPaise - (state.reservedPaise || 0));
    }

    const ttl = await redisClient.ttl(key);
    if (ttl > 0) {
      await redisClient.set(key, JSON.stringify(state), { EX: ttl });
    }
  } catch (err) {
    logger.error(`[Cache] incrementBudgetSpent error: ${err.message}`);
  }
}

/**
 * Atomically increment the reserved amount in the budget cache.
 * @param {number} slotId
 * @param {string} date
 * @param {number} amountPaise
 */
async function incrementBudgetReserved(slotId, date, amountPaise) {
  try {
    const key = KEYS.budget(slotId, date);
    await redisClient.eval(INCREMENT_BUDGET_RESERVED_SCRIPT, {
      keys: [key],
      arguments: [String(amountPaise)],
    });
  } catch (err) {
    logger.error(`[Cache] incrementBudgetReserved error: ${err.message}`);
  }
}

/**
 * Atomically decrement the reserved amount in the budget cache.
 * @param {number} slotId
 * @param {string} date
 * @param {number} amountPaise
 */
async function decrementBudgetReserved(slotId, date, amountPaise) {
  try {
    const key = KEYS.budget(slotId, date);
    await redisClient.eval(DECREMENT_BUDGET_RESERVED_SCRIPT, {
      keys: [key],
      arguments: [String(amountPaise)],
    });
  } catch (err) {
    logger.error(`[Cache] decrementBudgetReserved error: ${err.message}`);
  }
}

// ── Effective Config Cache ────────────────────────────────────────────────────

/**
 * Cache the merged effective configuration for a player.
 * @param {number|string} userId   'global' for the global config
 * @param {Object}        config
 * @param {number}        ttlSeconds
 */
async function setEffectiveConfig(userId, config, ttlSeconds = TTL.EFFECTIVE_CONFIG) {
  try {
    await redisClient.set(
      KEYS.effectiveConfig(userId),
      JSON.stringify(config),
      { EX: ttlSeconds }
    );
  } catch (err) {
    logger.error(`[Cache] setEffectiveConfig error: ${err.message}`);
  }
}

/**
 * Get cached effective config for a player.
 * @param {number|string} userId
 * @returns {Promise<Object|null>}
 */
async function getEffectiveConfig(userId) {
  try {
    const raw = await redisClient.get(KEYS.effectiveConfig(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.error(`[Cache] getEffectiveConfig error: ${err.message}`);
    return null;
  }
}

/**
 * Invalidate effective config for a specific player (or all via pattern).
 * Called when admin changes global or player config.
 *
 * @param {number|string} userId  Pass 'global' to invalidate for global config change
 */
async function invalidateEffectiveConfig(userId) {
  try {
    if (userId === 'global') {
      // Invalidate all player config caches — scan for pattern
      // Note: SCAN is non-blocking unlike KEYS *
      let cursor = 0;
      do {
        const result = await redisClient.scan(cursor, {
          MATCH: 'config:effective:*',
          COUNT: 100,
        });
        cursor = result.cursor;
        if (result.keys.length > 0) {
          await redisClient.del(result.keys);
        }
      } while (cursor !== 0);
    } else {
      await redisClient.del(KEYS.effectiveConfig(userId));
    }
  } catch (err) {
    logger.error(`[Cache] invalidateEffectiveConfig error: ${err.message}`);
  }
}

// ── Distributed Cashout Lock ──────────────────────────────────────────────────

/**
 * Acquire the cashout lock for a game.
 * Uses SET NX PX — atomic; only one caller can hold the lock.
 *
 * @param {string} gameUuid
 * @param {string} lockValue  Unique value (UUID) so only the holder can release it
 * @returns {Promise<boolean>} true if acquired
 */
async function acquireCashoutLock(gameUuid, lockValue) {
  try {
    const result = await redisClient.set(
      KEYS.cashoutLock(gameUuid),
      lockValue,
      { NX: true, EX: TTL.CASHOUT_LOCK }
    );
    return result === 'OK';
  } catch (err) {
    logger.error(`[Cache] acquireCashoutLock error: ${err.message}`);
    return false;
  }
}

/**
 * Release the cashout lock — ONLY if this caller holds it.
 * Uses a Lua script for atomic compare-and-delete to prevent
 * releasing another requester's lock.
 *
 * @param {string} gameUuid
 * @param {string} lockValue
 * @returns {Promise<boolean>} true if released
 */
async function releaseCashoutLock(gameUuid, lockValue) {
  // Lua script: GET + compare + DEL (atomic)
  const luaScript = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;
  try {
    const result = await redisClient.eval(luaScript, {
      keys: [KEYS.cashoutLock(gameUuid)],
      arguments: [lockValue],
    });
    return result === 1;
  } catch (err) {
    logger.error(`[Cache] releaseCashoutLock error: ${err.message}`);
    return false;
  }
}

// ── Reveal Idempotency ────────────────────────────────────────────────────────

/**
 * Store the result of a reveal for idempotency (retry safety).
 * @param {string} gameUuid
 * @param {number} cellIndex
 * @param {Object} result
 */
async function setRevealIdempotency(gameUuid, cellIndex, result) {
  try {
    await redisClient.set(
      KEYS.revealIdempotency(gameUuid, cellIndex),
      JSON.stringify(result),
      { EX: TTL.REVEAL_IDEMPOTENCY }
    );
  } catch (err) {
    logger.error(`[Cache] setRevealIdempotency error: ${err.message}`);
  }
}

/**
 * Check if a reveal has already been processed (idempotency check).
 * @param {string} gameUuid
 * @param {number} cellIndex
 * @returns {Promise<Object|null>} Cached result or null
 */
async function getRevealIdempotency(gameUuid, cellIndex) {
  try {
    const raw = await redisClient.get(KEYS.revealIdempotency(gameUuid, cellIndex));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.error(`[Cache] getRevealIdempotency error: ${err.message}`);
    return null;
  }
}

module.exports = {
  KEYS,
  TTL,
  // Game state
  setGameState,
  getGameState,
  deleteGameState,
  // Active game pointer
  setActiveGamePointer,
  getActiveGamePointer,
  deleteActiveGamePointer,
  // Budget
  setBudgetState,
  getBudgetState,
  incrementBudgetSpent,
  incrementBudgetReserved,
  decrementBudgetReserved,
  // Config
  setEffectiveConfig,
  getEffectiveConfig,
  invalidateEffectiveConfig,
  // Locks
  acquireCashoutLock,
  releaseCashoutLock,
  // Idempotency
  setRevealIdempotency,
  getRevealIdempotency,
};
