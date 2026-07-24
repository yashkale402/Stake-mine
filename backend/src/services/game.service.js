/**
 * game.service.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stake Mine Game Engine — Production Implementation.
 *
 * CRITICAL DESIGN RULE (from approved architecture):
 *   Mine positions are generated ONCE at game start using CSPRNG.
 *   They are stored in Redis and MySQL.
 *   Every reveal ONLY checks whether the selected cell is in mine_positions.
 *   There is NO deferred mine placement. NO probability calculation on reveal.
 *   Mine positions are IMMUTABLE for the lifetime of the game.
 *
 * Flow:
 *   startGame  → validate → generate mines → store → return board (no mines)
 *   revealCell → load state → check cell ∈ mine_positions → win/lose
 *   cashout    → lock → compute payout → settle MySQL → clear Redis
 *
 * Architecture:
 *   Controller → GameService → { GameRepository, CacheRepository, UserRepository,
 *                                ConfigService, ConfigRepository }
 *   No SQL in this file. No Redis commands in this file.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto             = require('crypto');
const { v4: uuidv4 }    = require('uuid');

const configService      = require('./config.service');
const gameRepository     = require('../repositories/game.repository');
const userRepository     = require('../repositories/user.repository');
const configRepository   = require('../repositories/config.repository');
const cacheRepository    = require('../repositories/cache.repository');
const { pool }           = require('../config/mysql');
const logger             = require('../logger/logger');

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — MINE GENERATION (Cryptographically Secure)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate `mineCount` unique mine positions within [0, boardSize).
 * Uses crypto.randomBytes for CSPRNG — never Math.random().
 *
 * Algorithm: Fisher-Yates partial shuffle on indices array.
 * Time complexity: O(boardSize), Space: O(boardSize).
 *
 * @param {number} boardSize  Total cells (e.g. 25 for 5×5)
 * @param {number} mineCount  Number of mines to place
 * @returns {number[]} Sorted array of mine positions
 */
function generateMinePositions(boardSize, mineCount) {
  // Build indices array [0, 1, 2, ..., boardSize-1]
  const indices = Array.from({ length: boardSize }, (_, i) => i);

  // Partial Fisher-Yates shuffle — only shuffle the first `mineCount` positions
  for (let i = 0; i < mineCount; i++) {
    // Cryptographically secure random integer in [i, boardSize)
    const j = i + _secureRandomInt(boardSize - i);
    // Swap
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // The first `mineCount` elements are the mine positions
  return indices.slice(0, mineCount).sort((a, b) => a - b);
}

/**
 * Cryptographically secure random integer in [0, max).
 * Rejection sampling ensures uniform distribution — avoids modulo bias.
 *
 * @param {number} max
 * @returns {number}
 */
function _secureRandomInt(max) {
  if (max <= 1) return 0;

  // Use rejection sampling to avoid modulo bias
  const bytesNeeded = 4; // 32-bit range is enough for any board size
  const maxUint32   = 0xFFFFFFFF;
  const limit       = maxUint32 - (maxUint32 % max);

  let value;
  do {
    value = crypto.randomBytes(bytesNeeded).readUInt32BE(0);
  } while (value > limit);

  return value % max;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MULTIPLIER ENGINE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the current payout multiplier.
 *
 * ACTUARIAL formula (default):
 *   The multiplier reflects the statistical probability of safely revealing
 *   `revealsCompleted` cells on a board of `boardSize` with `mineCount` mines,
 *   adjusted by the house edge.
 *
 *   multiplier = (1 / safeProbability) * (1 - houseEdge)
 *
 *   safeProbability = P(all revealed cells are safe)
 *     = [(boardSize - mineCount)! / (boardSize - mineCount - r)!]
 *       / [boardSize! / (boardSize - r)!]
 *
 * @param {number} revealsCompleted  Number of safely revealed cells so far
 * @param {number} mineCount
 * @param {number} boardSize
 * @param {number} houseEdge         e.g. 0.05 for 5%
 * @returns {number} Multiplier (e.g. 1.0000, 1.24, 2.50...)
 */
function computeMultiplier(revealsCompleted, mineCount, boardSize, houseEdge) {
  if (revealsCompleted === 0) return 1.0;

  const safeCells = boardSize - mineCount;

  // Numerator: product of (safeCells, safeCells-1, ..., safeCells-r+1)
  // Denominator: product of (boardSize, boardSize-1, ..., boardSize-r+1)
  // We compute incrementally to avoid large factorials
  let numerator   = 1;
  let denominator = 1;

  for (let i = 0; i < revealsCompleted; i++) {
    numerator   *= (safeCells - i);
    denominator *= (boardSize - i);
  }

  const safeProbability = numerator / denominator;
  const rawMultiplier   = 1 / safeProbability;
  const netMultiplier   = rawMultiplier * (1 - houseEdge);

  // Round to 4 decimal places for display/storage consistency
  return Math.round(netMultiplier * 10000) / 10000;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — SLOT / BUDGET HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get the current slot and its budget ledger.
 * Creates today's ledger row if it doesn't exist yet.
 *
 * @returns {Promise<{ slot: Object|null, ledger: Object|null }>}
 */
async function _loadSlotAndBudget() {
  const now  = new Date();
  const hour = now.getHours();

  // Check Redis budget cache first
  const slot = await configRepository.getSlotByHour(hour);
  if (!slot) {
    logger.warn(`[Game] No active slot found for hour ${hour}`);
    return { slot: null, ledger: null };
  }

  // Format today as YYYY-MM-DD
  const slotDate = now.toISOString().split('T')[0];

  // Check cache
  let budgetState = await cacheRepository.getBudgetState(slot.id, slotDate);

  if (!budgetState) {
    // Load from MySQL (creates row if new day)
    const ledger = await configRepository.getOrCreateBudgetLedger(
      slot.id,
      slotDate,
      slot.budget_paise
    );
    budgetState = {
      ledgerId:         ledger.id,
      slotId:           slot.id,
      totalBudgetPaise: ledger.total_budget_paise,
      spentPaise:       ledger.spent_paise,
      gameCount:        ledger.game_count,
    };
    await cacheRepository.setBudgetState(slot.id, slotDate, budgetState);
  }

  return { slot, ledger: budgetState };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — GAME START
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Start a new Stake Mine game session.
 *
 * Steps:
 *  1. Validate player (active status, no active game)
 *  2. Load effective config
 *  3. Validate bet and mine count against config
 *  4. Check balance
 *  5. Load slot budget
 *  6. Generate ALL mine positions (CSPRNG, immutable for game lifetime)
 *  7. Debit wallet + persist game in MySQL (single transaction)
 *  8. Store game state in Redis
 *  9. Set active game pointer
 * 10. Return board WITHOUT mine positions
 *
 * @param {number} userId
 * @param {number} betAmountPaise
 * @param {number} mineCount
 * @returns {Promise<Object>} Game start response
 */
async function startGame(userId, betAmountPaise, mineCount) {
  // ── 1. Load player ───────────────────────────────────────────────────────
  const player = await userRepository.findById(userId);
  if (!player) {
    const err = new Error('Player not found');
    err.statusCode = 404;
    throw err;
  }
  if (player.status !== 'ACTIVE') {
    const err = new Error('Your account has been suspended');
    err.statusCode = 403;
    throw err;
  }

  // ── 2. Load effective config ─────────────────────────────────────────────
  const config = await configService.loadEffectiveConfig(userId);
  const boardSize          = config.board_size          || 25;
  const minBetPaise        = config.min_bet_paise       || 100;
  const maxBetPaise        = config.max_bet_paise       || 1000000;
  const minMines           = config.min_mines           || 1;
  const maxMines           = config.max_mines           || 24;
  const gameExpirySeconds  = config.game_expiry_seconds || 3600;
  const houseEdge          = config.house_edge          || 0.05;

  // ── 3. Validate bet & mines ──────────────────────────────────────────────
  if (!Number.isInteger(betAmountPaise) || betAmountPaise < minBetPaise || betAmountPaise > maxBetPaise) {
    const err = new Error(
      `Bet must be between ₹${minBetPaise / 100} and ₹${maxBetPaise / 100}`
    );
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(mineCount) || mineCount < minMines || mineCount > maxMines) {
    const err = new Error(`Mine count must be between ${minMines} and ${maxMines}`);
    err.statusCode = 400;
    throw err;
  }
  // Ensure at least one safe cell
  if (mineCount >= boardSize) {
    const err = new Error('Mine count must be less than total cells');
    err.statusCode = 400;
    throw err;
  }

  // ── 4. Check balance ─────────────────────────────────────────────────────
  const balancePaise = await userRepository.getBalance(userId);
  if (balancePaise < betAmountPaise) {
    const err = new Error(
      `Insufficient balance. Have: ₹${(balancePaise / 100).toFixed(2)}, ` +
      `Need: ₹${(betAmountPaise / 100).toFixed(2)}`
    );
    err.statusCode = 402;
    throw err;
  }

  // ── 5. Check for existing active game ───────────────────────────────────
  const activeGameUuid = await cacheRepository.getActiveGamePointer(userId);
  if (activeGameUuid) {
    const cachedGame = await cacheRepository.getGameState(activeGameUuid);
    const err = new Error('You already have an active game. Please finish it first.');
    err.statusCode = 409;
    err.activeGame = cachedGame
      ? _sanitizeGameState(cachedGame)
      : { game_uuid: activeGameUuid };
    throw err;
  }

  // Also check MySQL (Redis may have expired but game still ACTIVE in DB)
  const dbActiveGame = await gameRepository.findActiveGameByUserId(userId);
  if (dbActiveGame) {
    const err = new Error('You already have an active game. Please finish it first.');
    err.statusCode = 409;
    err.activeGame = _sanitizeGameState(_buildGameStateFromDb(dbActiveGame));
    throw err;
  }

  // ── 6. Load slot budget (informational — does not block game start) ──────
  const { slot, ledger: budgetState } = await _loadSlotAndBudget();

  // ── 7. Generate mine positions (CSPRNG) ──────────────────────────────────
  // This is the ONLY place mines are generated. They never change after this.
  const minePositions = generateMinePositions(boardSize, mineCount);

  // ── 8. Prepare game data ─────────────────────────────────────────────────
  const gameUuid     = uuidv4();
  const now          = new Date();
  const expiresAt    = new Date(now.getTime() + gameExpirySeconds * 1000);
  const configSnapshot = { boardSize, minMines, maxMines, houseEdge, gameExpirySeconds };

  // ── 9. MySQL Transaction: debit wallet + insert game ────────────────────
  const connection = await pool.getConnection();
  let gameRecord;

  try {
    await connection.beginTransaction();

    // Debit the bet from the player's wallet (atomic — fails if balance < bet)
    await userRepository.adjustBalance(userId, -betAmountPaise, connection);

    // Insert the game session record
    gameRecord = await gameRepository.createGame(
      {
        game_uuid:        gameUuid,
        user_id:          userId,
        slot_ledger_id:   budgetState?.ledgerId || null,
        bet_amount_paise: betAmountPaise,
        mine_count:       mineCount,
        board_size:       boardSize,
        mine_positions:   minePositions,
        config_snapshot:  configSnapshot,
        expires_at:       expiresAt,
      },
      connection
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // ── 10. Build in-memory game state for Redis ─────────────────────────────
  const gameState = {
    game_uuid:          gameUuid,
    user_id:            userId,
    status:             'ACTIVE',
    bet_amount_paise:   betAmountPaise,
    mine_count:         mineCount,
    board_size:         boardSize,
    mine_positions:     minePositions,   // Stored in Redis — NEVER sent to client
    revealed_cells:     [],
    current_multiplier: 1.0,
    house_edge:         houseEdge,
    slot_id:            slot?.id || null,
    ledger_id:          budgetState?.ledgerId || null,
    started_at:         now.toISOString(),
    expires_at:         expiresAt.toISOString(),
  };

  // ── 11. Cache game state in Redis ─────────────────────────────────────────
  await cacheRepository.setGameState(gameUuid, gameState, gameExpirySeconds);
  await cacheRepository.setActiveGamePointer(userId, gameUuid, gameExpirySeconds);

  logger.info(
    `[Game] Started: uuid=${gameUuid} user=${userId} ` +
    `bet=${betAmountPaise}p mines=${mineCount}/${boardSize}`
  );

  // ── 12. Return board state WITHOUT mine positions ─────────────────────────
  return {
    game_uuid:          gameUuid,
    board_size:         boardSize,
    total_cells:        boardSize,
    mine_count:         mineCount,
    bet_amount_paise:   betAmountPaise,
    bet_formatted:      `₹${(betAmountPaise / 100).toFixed(2)}`,
    current_multiplier: '1.0000',
    status:             'ACTIVE',
    revealed_cells:     [],
    expires_at:         expiresAt.toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — REVEAL CELL
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Reveal a cell on the board.
 *
 * CRITICAL: This function only CHECKS whether the selected cell is in
 * mine_positions. It does NOT generate or place mines. Mines were
 * generated at game start and are immutable.
 *
 * @param {number} userId
 * @param {string} gameUuid
 * @param {number} cellIndex  Integer in [0, boardSize)
 * @returns {Promise<Object>} Reveal result
 */
async function revealCell(userId, gameUuid, cellIndex) {
  // ── 1. Idempotency check ─────────────────────────────────────────────────
  const idempotentResult = await cacheRepository.getRevealIdempotency(gameUuid, cellIndex);
  if (idempotentResult) {
    logger.debug(`[Game] Idempotent reveal: game=${gameUuid} cell=${cellIndex}`);
    return idempotentResult;
  }

  // ── 2. Load game state (Redis primary, MySQL fallback) ───────────────────
  let gameState = await cacheRepository.getGameState(gameUuid);

  if (!gameState) {
    // Recovery path: Redis miss — reload from MySQL
    logger.warn(`[Game] Redis miss for game ${gameUuid} — recovering from MySQL`);
    const dbGame = await gameRepository.findActiveGameByUuid(gameUuid);
    if (!dbGame) {
      const err = new Error('Game not found or already ended');
      err.statusCode = 404;
      throw err;
    }
    // Rebuild game state from DB record
    gameState = _buildGameStateFromDb(dbGame);
    // Recache (compute remaining TTL)
    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(gameState.expires_at) - Date.now()) / 1000)
    );
    if (remainingSeconds > 0) {
      await cacheRepository.setGameState(gameUuid, gameState, remainingSeconds);
    }
  }

  // ── 3. Ownership check ───────────────────────────────────────────────────
  if (gameState.user_id !== userId) {
    const err = new Error('Unauthorized: this game does not belong to you');
    err.statusCode = 403;
    throw err;
  }

  // ── 4. Status check ──────────────────────────────────────────────────────
  if (gameState.status !== 'ACTIVE') {
    const err = new Error(`Game is already ${gameState.status}`);
    err.statusCode = 409;
    throw err;
  }

  // ── 5. Expiry check ──────────────────────────────────────────────────────
  if (new Date(gameState.expires_at) < new Date()) {
    await _expireGame(gameState);
    const err = new Error('Game has expired');
    err.statusCode = 410;
    throw err;
  }

  // ── 6. Cell range check ──────────────────────────────────────────────────
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= gameState.board_size) {
    const err = new Error(`Cell index must be between 0 and ${gameState.board_size - 1}`);
    err.statusCode = 400;
    throw err;
  }

  // ── 7. Already-revealed check ────────────────────────────────────────────
  const revealedCells = Array.isArray(gameState.revealed_cells)
    ? gameState.revealed_cells
    : JSON.parse(gameState.revealed_cells || '[]');

  if (revealedCells.includes(cellIndex)) {
    const err = new Error('Cell has already been revealed');
    err.statusCode = 409;
    throw err;
  }

  // ── 8. CHECK: Is this cell a mine? ──────────────────────────────────────
  // This is the ONLY decision: is cellIndex in the pre-generated mine_positions?
  const minePositions = Array.isArray(gameState.mine_positions)
    ? gameState.mine_positions
    : JSON.parse(gameState.mine_positions || '[]');

  const isMine = minePositions.includes(cellIndex);

  let result;

  if (isMine) {
    // ── MINE HIT → Game Over ─────────────────────────────────────────────
    result = await _handleMineHit(gameState, cellIndex, minePositions);
  } else {
    // ── SAFE REVEAL ──────────────────────────────────────────────────────
    result = await _handleSafeReveal(gameState, cellIndex, revealedCells, minePositions);
  }

  // ── 9. Store idempotency key ─────────────────────────────────────────────
  await cacheRepository.setRevealIdempotency(gameUuid, cellIndex, result);

  return result;
}

/**
 * Handle a mine hit — settle the game as LOST.
 */
async function _handleMineHit(gameState, cellIndex, minePositions) {
  // Update Redis immediately (mark as LOST)
  const updatedState = { ...gameState, status: 'LOST' };
  // Clear game from Redis
  await cacheRepository.deleteGameState(gameState.game_uuid);
  await cacheRepository.deleteActiveGamePointer(gameState.user_id);

  // Settle in MySQL (async — game is already done)
  try {
    await gameRepository.settleGameLost(gameState.game_uuid);
    await gameRepository.insertHistory({
      game_uuid:         gameState.game_uuid,
      user_id:           gameState.user_id,
      bet_amount_paise:  gameState.bet_amount_paise,
      payout_paise:      0,
      profit_loss_paise: -gameState.bet_amount_paise,
      mine_count:        gameState.mine_count,
      cells_revealed:    Array.isArray(gameState.revealed_cells)
        ? gameState.revealed_cells.length
        : 0,
      final_multiplier:  gameState.current_multiplier,
      outcome:           'LOSS',
      slot_id:           gameState.slot_id,
    });
  } catch (dbErr) {
    logger.error(`[Game] Failed to persist loss for ${gameState.game_uuid}: ${dbErr.message}`);
  }

  logger.info(
    `[Game] MINE HIT: uuid=${gameState.game_uuid} cell=${cellIndex} user=${gameState.user_id}`
  );

  return {
    result:            'mine',
    cell_index:        cellIndex,
    mine_positions:    minePositions,  // Reveal all mines after game over
    revealed_cells:    gameState.revealed_cells || [],
    final_multiplier:  parseFloat(gameState.current_multiplier).toFixed(4),
    payout:            0,
    payout_formatted:  '₹0.00',
    status:            'LOST',
    message:           '💥 BOOM! You hit a mine!',
  };
}

/**
 * Handle a safe reveal — update state and return new multiplier.
 */
async function _handleSafeReveal(gameState, cellIndex, revealedCells, minePositions) {
  const newRevealedCells = [...revealedCells, cellIndex];
  const revealsCompleted = newRevealedCells.length;

  // Compute new multiplier
  const houseEdge         = gameState.house_edge || 0.05;
  const newMultiplier     = computeMultiplier(
    revealsCompleted,
    gameState.mine_count,
    gameState.board_size,
    houseEdge
  );

  // Check if all safe cells have been revealed (auto-win condition)
  const safeCells         = gameState.board_size - gameState.mine_count;
  const allSafeRevealed   = revealsCompleted >= safeCells;

  // Keep status ACTIVE so cashout settlement can run (never mark settled before pay)
  const updatedState = {
    ...gameState,
    revealed_cells:     newRevealedCells,
    current_multiplier: newMultiplier,
    status:             'ACTIVE',
  };
  await cacheRepository.setGameState(gameState.game_uuid, updatedState);

  // Persist reveal state before any auto-cashout settlement
  try {
    await gameRepository.updateRevealState(
      gameState.game_uuid,
      newRevealedCells,
      newMultiplier
    );
  } catch (err) {
    logger.error(`[Game] MySQL reveal update failed: ${err.message}`);
  }

  const currentPayoutPaise = Math.floor(gameState.bet_amount_paise * newMultiplier);

  logger.debug(
    `[Game] Safe reveal: uuid=${gameState.game_uuid} cell=${cellIndex} ` +
    `multiplier=${newMultiplier} reveals=${revealsCompleted}`
  );

  // If all safe cells are revealed — settle via the normal cashout path
  if (allSafeRevealed) {
    const cashoutResult = await cashout(gameState.user_id, gameState.game_uuid);
    return {
      result:                  'safe',
      cell_index:              cellIndex,
      reveal_count:            revealsCompleted,
      current_multiplier:      cashoutResult.final_multiplier,
      current_payout_paise:    cashoutResult.payout_paise,
      current_payout_formatted:cashoutResult.payout_formatted,
      remaining_cells:         gameState.mine_count,
      can_cashout:             false,
      status:                  'CASHED_OUT',
      auto_cashout:            true,
      mine_positions:          cashoutResult.mine_positions,
      new_balance_paise:       cashoutResult.new_balance_paise,
      payout_paise:            cashoutResult.payout_paise,
      payout_formatted:        cashoutResult.payout_formatted,
      message:                 '🏆 You revealed all safe cells! Auto-cashed out.',
    };
  }

  return {
    result:                  'safe',
    cell_index:              cellIndex,
    reveal_count:            revealsCompleted,
    current_multiplier:      newMultiplier.toFixed(4),
    current_payout_paise:    currentPayoutPaise,
    current_payout_formatted:`₹${(currentPayoutPaise / 100).toFixed(2)}`,
    remaining_cells:         gameState.board_size - revealsCompleted,
    can_cashout:             true,
    status:                  'ACTIVE',
    message:                 '💎 Safe! Keep going or cash out.',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — CASHOUT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Cash out the current game at the current multiplier.
 *
 * Security:
 *   - Acquires distributed lock (Redis SET NX) before reading state.
 *   - MySQL UPDATE WHERE status='ACTIVE' ensures only one cashout succeeds.
 *   - Lock is released atomically via Lua script.
 *
 * @param {number} userId
 * @param {string} gameUuid
 * @returns {Promise<Object>} Cashout result with payout
 */
async function cashout(userId, gameUuid) {
  // ── 1. Load game state ───────────────────────────────────────────────────
  let gameState = await cacheRepository.getGameState(gameUuid);

  if (!gameState) {
    // Recovery: check MySQL
    const dbGame = await gameRepository.findGameByUuid(gameUuid);
    if (!dbGame) {
      const err = new Error('Game not found');
      err.statusCode = 404;
      throw err;
    }
    if (dbGame.status !== 'ACTIVE') {
      const err = new Error(`Game is already ${dbGame.status}`);
      err.statusCode = 409;
      err.finalState = _sanitizeGameState(dbGame);
      throw err;
    }
    gameState = _buildGameStateFromDb(dbGame);
  }

  // ── 2. Ownership check ───────────────────────────────────────────────────
  if (gameState.user_id !== userId) {
    const err = new Error('Unauthorized');
    err.statusCode = 403;
    throw err;
  }

  // ── 3. Status check ──────────────────────────────────────────────────────
  if (gameState.status !== 'ACTIVE') {
    const err = new Error(`Game is already ${gameState.status}`);
    err.statusCode = 409;
    throw err;
  }

  // ── 4. Must have at least one reveal ─────────────────────────────────────
  const revealedCells = Array.isArray(gameState.revealed_cells)
    ? gameState.revealed_cells
    : JSON.parse(gameState.revealed_cells || '[]');

  if (revealedCells.length === 0) {
    const err = new Error('You must reveal at least one cell before cashing out');
    err.statusCode = 400;
    throw err;
  }

  // ── 5. Acquire distributed lock ──────────────────────────────────────────
  const lockValue = uuidv4();
  const lockAcquired = await cacheRepository.acquireCashoutLock(gameUuid, lockValue);

  if (!lockAcquired) {
    const err = new Error('A cashout is already in progress. Please wait and retry.');
    err.statusCode = 429;
    throw err;
  }

  try {
    // ── 6. Re-read state under lock ─────────────────────────────────────────
    gameState = await cacheRepository.getGameState(gameUuid);
    if (!gameState || gameState.status !== 'ACTIVE') {
      const err = new Error('Game is already settled (concurrent cashout)');
      err.statusCode = 409;
      throw err;
    }

    // ── 7. Compute payout ────────────────────────────────────────────────────
    const finalMultiplier = parseFloat(gameState.current_multiplier) || 1.0;
    const payoutPaise     = Math.floor(gameState.bet_amount_paise * finalMultiplier);
    const netWinningPaise = payoutPaise - gameState.bet_amount_paise;

    // ── 8. MySQL Transaction: credit wallet + settle game + insert history ───
    const connection = await pool.getConnection();
    let newBalancePaise;

    try {
      await connection.beginTransaction();

      // 8a. Credit wallet
      newBalancePaise = await userRepository.adjustBalance(userId, payoutPaise, connection);

      // 8b. Settle game — conditional on status=ACTIVE (prevents double settlement)
      const rowsAffected = await gameRepository.settleGameCashout(
        gameUuid,
        payoutPaise,
        finalMultiplier,
        connection
      );

      if (rowsAffected === 0) {
        // Another process settled this game first — rollback
        await connection.rollback();
        const err = new Error('Game was already settled by another request');
        err.statusCode = 409;
        throw err;
      }

      // 8c. Insert history record
      await gameRepository.insertHistory(
        {
          game_uuid:         gameUuid,
          user_id:           userId,
          bet_amount_paise:  gameState.bet_amount_paise,
          payout_paise:      payoutPaise,
          profit_loss_paise: netWinningPaise,
          mine_count:        gameState.mine_count,
          cells_revealed:    revealedCells.length,
          final_multiplier:  finalMultiplier,
          outcome:           'CASHOUT',
          slot_id:           gameState.slot_id,
        },
        connection
      );

      // 8d. Update slot budget ledger (only net winnings count toward budget)
      if (gameState.ledger_id && netWinningPaise > 0) {
        await configRepository.incrementBudgetSpent(
          gameState.ledger_id,
          netWinningPaise,
          connection
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    // ── 9. Clear Redis ───────────────────────────────────────────────────────
    await cacheRepository.deleteGameState(gameUuid);
    await cacheRepository.deleteActiveGamePointer(userId);

    // Update budget cache
    if (gameState.slot_id && netWinningPaise > 0) {
      const today = new Date().toISOString().split('T')[0];
      await cacheRepository.incrementBudgetSpent(gameState.slot_id, today, netWinningPaise);
    }

    const minePositions = Array.isArray(gameState.mine_positions)
      ? gameState.mine_positions
      : JSON.parse(gameState.mine_positions || '[]');

    logger.info(
      `[Game] CASHOUT: uuid=${gameUuid} user=${userId} ` +
      `payout=${payoutPaise}p multiplier=${finalMultiplier}`
    );

    return {
      game_uuid:              gameUuid,
      status:                 'CASHED_OUT',
      bet_amount_paise:       gameState.bet_amount_paise,
      bet_formatted:          `₹${(gameState.bet_amount_paise / 100).toFixed(2)}`,
      final_multiplier:       finalMultiplier.toFixed(4),
      payout_paise:           payoutPaise,
      payout_formatted:       `₹${(payoutPaise / 100).toFixed(2)}`,
      net_winning_paise:      netWinningPaise,
      net_winning_formatted:  `₹${(netWinningPaise / 100).toFixed(2)}`,
      new_balance_paise:      newBalancePaise,
      new_balance_formatted:  `₹${(newBalancePaise / 100).toFixed(2)}`,
      mine_positions:         minePositions,
      revealed_cells:         revealedCells,
      message:                `🎉 Cashed out! You won ₹${(payoutPaise / 100).toFixed(2)}`,
    };
  } finally {
    // Always release lock — even if an error is thrown
    await cacheRepository.releaseCashoutLock(gameUuid, lockValue);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — GAME STATUS & HISTORY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get the player's currently active game (for page refresh / reconnect).
 * Checks Redis pointer first, then MySQL.
 *
 * @param {number} userId
 * @returns {Promise<Object|null>} Sanitized active game, or null
 */
async function getActiveGame(userId) {
  const activeGameUuid = await cacheRepository.getActiveGamePointer(userId);

  if (activeGameUuid) {
    let gameState = await cacheRepository.getGameState(activeGameUuid);
    if (!gameState) {
      const dbGame = await gameRepository.findActiveGameByUuid(activeGameUuid);
      if (dbGame) {
        gameState = _buildGameStateFromDb(dbGame);
        const remainingSeconds = Math.max(
          0,
          Math.floor((new Date(gameState.expires_at) - Date.now()) / 1000)
        );
        if (remainingSeconds > 0) {
          await cacheRepository.setGameState(activeGameUuid, gameState, remainingSeconds);
        }
      }
    }

    if (gameState && gameState.status === 'ACTIVE' && gameState.user_id === userId) {
      if (new Date(gameState.expires_at) < new Date()) {
        await _expireGame(gameState);
        return null;
      }
      return _sanitizeGameState(gameState);
    }
  }

  const dbActiveGame = await gameRepository.findActiveGameByUserId(userId);
  if (!dbActiveGame) return null;

  const gameState = _buildGameStateFromDb(dbActiveGame);
  if (new Date(gameState.expires_at) < new Date()) {
    await _expireGame(gameState);
    return null;
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(gameState.expires_at) - Date.now()) / 1000)
  );
  if (remainingSeconds > 0) {
    await cacheRepository.setGameState(gameState.game_uuid, gameState, remainingSeconds);
    await cacheRepository.setActiveGamePointer(userId, gameState.game_uuid, remainingSeconds);
  }

  return _sanitizeGameState(gameState);
}

/**
 * Get the current state of a game (for page refresh / reconnect).
 * Loads from Redis first, falls back to MySQL.
 *
 * @param {number} userId
 * @param {string} gameUuid
 * @returns {Promise<Object>}
 */
async function getGameState(userId, gameUuid) {
  let gameState = await cacheRepository.getGameState(gameUuid);

  if (!gameState) {
    const dbGame = await gameRepository.findGameByUuid(gameUuid);
    if (!dbGame) {
      const err = new Error('Game not found');
      err.statusCode = 404;
      throw err;
    }
    gameState = _buildGameStateFromDb(dbGame);
  }

  if (gameState.user_id !== userId) {
    const err = new Error('Unauthorized');
    err.statusCode = 403;
    throw err;
  }

  return _sanitizeGameState(gameState);
}

/**
 * Get paginated game history for a player.
 *
 * @param {number} userId
 * @param {number} page    1-indexed
 * @param {number} limit
 * @returns {Promise<Object>}
 */
async function getGameHistory(userId, page = 1, limit = 20) {
  const offset   = (page - 1) * limit;
  const [games, total] = await Promise.all([
    gameRepository.getHistory(userId, limit, offset),
    gameRepository.countHistory(userId),
  ]);

  return {
    games: games.map((g) => ({
      ...g,
      bet_formatted:     `₹${(g.bet_amount_paise / 100).toFixed(2)}`,
      payout_formatted:  `₹${(g.payout_paise     / 100).toFixed(2)}`,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getFairnessInfo(userId) {
  const config = await configService.loadEffectiveConfig(userId);
  return {
    model: 'Pre-generated immutable mine board',
    board_size: config.board_size || 25,
    house_edge: config.house_edge || 0.05,
    explanation: [
      'Mine positions are generated once at round start using a cryptographically secure source.',
      'Reveals only verify whether the chosen cell is already part of that fixed mine set.',
      'The board is never rearranged after the round begins.',
      'Displayed multipliers come from safe reveal probability adjusted by the configured house edge.',
    ],
    fairness_note:
      'This game uses a locked board per round. Player choices influence only when to stop, not how the board is generated after the fact.',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — PRIVATE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build a Redis-compatible game state object from a MySQL game_sessions row.
 * Used for crash recovery when Redis is cold.
 */
function _buildGameStateFromDb(dbRow) {
  const configSnapshot =
    typeof dbRow.config_snapshot === 'string'
      ? JSON.parse(dbRow.config_snapshot || '{}')
      : (dbRow.config_snapshot || {});

  return {
    game_uuid:          dbRow.game_uuid,
    user_id:            dbRow.user_id,
    status:             dbRow.status,
    bet_amount_paise:   dbRow.bet_amount_paise,
    mine_count:         dbRow.mine_count,
    board_size:         dbRow.board_size,
    mine_positions:     typeof dbRow.mine_positions === 'string'
      ? JSON.parse(dbRow.mine_positions)
      : dbRow.mine_positions,
    revealed_cells:     typeof dbRow.revealed_cells === 'string'
      ? JSON.parse(dbRow.revealed_cells)
      : (dbRow.revealed_cells || []),
    current_multiplier: parseFloat(dbRow.current_multiplier) || 1.0,
    house_edge:         configSnapshot.houseEdge || 0.05,
    slot_id:            null,
    ledger_id:          dbRow.slot_ledger_id,
    started_at:         dbRow.started_at,
    expires_at:         dbRow.expires_at,
  };
}

/**
 * Remove mine_positions from a game state object before sending to client.
 * Mine positions are NEVER exposed while the game is ACTIVE.
 */
function _sanitizeGameState(gameState) {
  const sanitized = { ...gameState };
  // Only reveal mine positions after game is terminal
  if (sanitized.status === 'ACTIVE') {
    delete sanitized.mine_positions;
    delete sanitized.house_edge;
  }
  return sanitized;
}

/**
 * Mark a game as expired (called when expiry check fails).
 */
async function _expireGame(gameState) {
  try {
    await gameRepository.settleGameExpired(gameState.game_uuid);
    await cacheRepository.deleteGameState(gameState.game_uuid);
    await cacheRepository.deleteActiveGamePointer(gameState.user_id);
    await gameRepository.insertHistory({
      game_uuid:         gameState.game_uuid,
      user_id:           gameState.user_id,
      bet_amount_paise:  gameState.bet_amount_paise,
      payout_paise:      0,
      profit_loss_paise: -gameState.bet_amount_paise,
      mine_count:        gameState.mine_count,
      cells_revealed:    (gameState.revealed_cells || []).length,
      final_multiplier:  gameState.current_multiplier || 1.0,
      outcome:           'LOSS',
      slot_id:           gameState.slot_id,
    });
  } catch (err) {
    logger.error(`[Game] Failed to expire game ${gameState.game_uuid}: ${err.message}`);
  }
}

module.exports = {
  startGame,
  revealCell,
  cashout,
  getActiveGame,
  getGameState,
  getGameHistory,
  getFairnessInfo,
  // Export for testing
  generateMinePositions,
  computeMultiplier,
};
