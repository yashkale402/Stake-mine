/**
 * user.service.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Business-logic layer for user operations.
 *
 * Responsibilities:
 *   - Validate input data.
 *   - Orchestrate calls to the repository layer.
 *   - Handle Redis caching (read-through pattern).
 *   - Throw structured errors that the controller can catch.
 *
 * Caching Strategy (Read-Through):
 *   1. Check Redis for cached user data.
 *   2. On cache HIT  → return cached data immediately.
 *   3. On cache MISS → fetch from MySQL, store in Redis, then return.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const userRepository = require('../repositories/user.repository');
const redisClient    = require('../config/redis');
const env            = require('../config/env');
const logger         = require('../logger/logger');

/** Redis key prefix for user cache entries */
const CACHE_PREFIX = 'user:';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a namespaced Redis cache key for a user ID.
 * @param {number|string} id
 */
const cacheKey = (id) => `${CACHE_PREFIX}${id}`;

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * Get all users.
 * (Not cached individually — full-list caching is omitted to keep it simple.)
 * @returns {Promise<Array>}
 */
async function getAllUsers() {
  return userRepository.findAll();
}

/**
 * Get a single user by ID with Redis caching.
 *
 * @param {number|string} id
 * @returns {Promise<Object>}
 * @throws {Error} 404 if user not found
 */
async function getUserById(id) {
  const key = cacheKey(id);

  // ── 1. Check Redis cache ─────────────────────────────────────────────────
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      logger.debug(`[UserService] Cache HIT for user ${id}`);
      return JSON.parse(cached);
    }
    logger.debug(`[UserService] Cache MISS for user ${id} — fetching from MySQL`);
  } catch (redisErr) {
    // Redis failure should NOT break the request — degrade gracefully
    logger.error(`[UserService] Redis GET error: ${redisErr.message}`);
  }

  // ── 2. Fetch from MySQL ──────────────────────────────────────────────────
  const user = await userRepository.findById(id);

  if (!user) {
    const err = new Error(`User with ID ${id} not found`);
    err.statusCode = 404;
    throw err;
  }

  // ── 3. Store in Redis for future requests ────────────────────────────────
  try {
    await redisClient.set(key, JSON.stringify(user), { EX: env.REDIS_CACHE_TTL });
    logger.debug(`[UserService] Cached user ${id} for ${env.REDIS_CACHE_TTL}s`);
  } catch (redisErr) {
    logger.error(`[UserService] Redis SET error: ${redisErr.message}`);
  }

  return user;
}

/**
 * Create a new user.
 *
 * @param {{ username: string, email: string, balance?: number }} data
 * @returns {Promise<Object>} Created user
 * @throws {Error} 409 if email already exists
 */
async function createUser({ username, email, balance }) {
  // ── Trim string inputs to catch whitespace-only values ───────────────────
  const trimmedUsername = (username || '').trim();
  const trimmedEmail    = (email    || '').trim().toLowerCase();

  // ── Validate required fields ─────────────────────────────────────────────
  if (!trimmedUsername) {
    const err = new Error('username is required and must not be blank');
    err.statusCode = 400;
    throw err;
  }

  if (!trimmedEmail) {
    const err = new Error('email is required and must not be blank');
    err.statusCode = 400;
    throw err;
  }

  // ── Basic email format check (no library needed) ─────────────────────────
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    const err = new Error('email format is invalid');
    err.statusCode = 400;
    throw err;
  }

  // ── Validate balance if provided ─────────────────────────────────────────
  if (balance !== undefined && balance !== null) {
    const parsedBalance = Number(balance);
    if (Number.isNaN(parsedBalance) || parsedBalance < 0) {
      const err = new Error('balance must be a non-negative number');
      err.statusCode = 400;
      throw err;
    }
  }

  // ── Check for duplicate email → 409 Conflict ────────────────────────────
  const existing = await userRepository.findByEmail(trimmedEmail);
  if (existing) {
    const err = new Error(`Email '${trimmedEmail}' is already registered`);
    err.statusCode = 409;
    throw err;
  }

  const newUser = await userRepository.create({
    username: trimmedUsername,
    email: trimmedEmail,
    balance,
  });

  // Cache the newly created user immediately
  try {
    await redisClient.set(
      cacheKey(newUser.id),
      JSON.stringify(newUser),
      { EX: env.REDIS_CACHE_TTL }
    );
  } catch (redisErr) {
    logger.error(`[UserService] Redis SET error after create: ${redisErr.message}`);
  }

  return newUser;
}

module.exports = { getAllUsers, getUserById, createUser };
