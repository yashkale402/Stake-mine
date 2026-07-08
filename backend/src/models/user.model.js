/**
 * user.model.js
 * ──────────────────────────────────────────────────────────────────────────────
 * User model definition / schema reference.
 *
 * In this project we use raw SQL (no ORM), so this file documents
 * the shape of a user object as returned from MySQL.
 *
 * MySQL schema (see mysql/init.sql):
 *   id          INT AUTO_INCREMENT PRIMARY KEY
 *   username    VARCHAR(100) NOT NULL
 *   email       VARCHAR(100) UNIQUE
 *   balance     DECIMAL(10,2) DEFAULT 1000.00
 *   created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *
 * TODO: If an ORM (e.g. Sequelize, Prisma) is adopted later,
 *       move the model definition here.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * @typedef {Object} User
 * @property {number}  id
 * @property {string}  username
 * @property {string}  email
 * @property {number}  balance
 * @property {Date}    created_at
 */

module.exports = {}; // Placeholder — no ORM model needed currently
