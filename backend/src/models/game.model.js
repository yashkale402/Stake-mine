/**
 * game.model.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Game model definition / schema reference.
 *
 * MySQL schema (see mysql/init.sql):
 *   id          INT AUTO_INCREMENT PRIMARY KEY
 *   user_id     INT (FK → users.id)
 *   bet_amount  DECIMAL(10,2)
 *   mines       INT
 *   result      VARCHAR(20)   — 'won' | 'lost' | 'active'
 *   payout      DECIMAL(10,2)
 *   created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *
 * TODO: Extend this when game logic is implemented.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * @typedef {Object} Game
 * @property {number}  id
 * @property {number}  user_id
 * @property {number}  bet_amount
 * @property {number}  mines
 * @property {string}  result     — 'won' | 'lost' | 'active'
 * @property {number}  payout
 * @property {Date}    created_at
 */

module.exports = {}; // Placeholder — no ORM model needed currently
