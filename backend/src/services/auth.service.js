/**
 * auth.service.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Business logic for player authentication (register / login).
 *
 * Password hashing  → bcryptjs (cost factor 10)
 * Token generation  → jsonwebtoken (JWT)
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const bcrypt         = require('bcryptjs');
const jwt            = require('jsonwebtoken');
const env            = require('../config/env');
const userRepository = require('../repositories/user.repository');
const logger         = require('../logger/logger');

const SALT_ROUNDS = 10;

/**
 * Register a new player.
 *
 * @param {{ username: string, email: string, password: string }} data
 * @returns {Promise<{ user: Object, token: string }>}
 */
async function register({ username, email, password }) {
  // ── Input validation ─────────────────────────────────────────────────────
  const trimUsername = (username || '').trim();
  const trimEmail    = (email    || '').trim().toLowerCase();
  const trimPassword = (password || '').trim();

  if (!trimUsername) {
    const err = new Error('username is required');
    err.statusCode = 400;
    throw err;
  }
  if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
    const err = new Error('A valid email address is required');
    err.statusCode = 400;
    throw err;
  }
  if (!trimPassword || trimPassword.length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.statusCode = 400;
    throw err;
  }

  // ── Duplicate check ──────────────────────────────────────────────────────
  const existing = await userRepository.findByEmail(trimEmail);
  if (existing) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  // ── Hash password ────────────────────────────────────────────────────────
  const password_hash = await bcrypt.hash(trimPassword, SALT_ROUNDS);

  // ── Create user (default balance: ₹100 = 10000 paise) ───────────────────
  const user = await userRepository.create({
    username: trimUsername,
    email:    trimEmail,
    password_hash,
    balance_paise: 10000,
  });

  logger.info(`[Auth] New player registered: ${trimEmail} (id=${user.id})`);

  const token = _signToken(user);
  return { user, token };
}

/**
 * Log in an existing player.
 *
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ user: Object, token: string }>}
 */
async function login({ email, password }) {
  const trimEmail    = (email    || '').trim().toLowerCase();
  const trimPassword = (password || '').trim();

  if (!trimEmail || !trimPassword) {
    const err = new Error('email and password are required');
    err.statusCode = 400;
    throw err;
  }

  // Fetch user INCLUDING password_hash
  const userWithHash = await userRepository.findByEmail(trimEmail);

  if (!userWithHash) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (userWithHash.status === 'SUSPENDED') {
    const err = new Error('Your account has been suspended. Please contact support.');
    err.statusCode = 403;
    throw err;
  }

  // Constant-time compare — prevents timing attacks
  const isMatch = await bcrypt.compare(trimPassword, userWithHash.password_hash);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  // Strip password_hash before returning to client
  const { password_hash: _, ...user } = userWithHash;

  logger.info(`[Auth] Player logged in: ${trimEmail} (id=${user.id})`);

  const token = _signToken(user);
  return { user, token };
}

/**
 * Get the authenticated player's profile.
 *
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Sign a JWT containing the user's id, email, and username.
 * @param {Object} user
 * @returns {string} JWT token
 */
function _signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role || 'PLAYER',
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

module.exports = { register, login, getProfile };
