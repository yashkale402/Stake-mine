/**
 * user.controller.js
 * ──────────────────────────────────────────────────────────────────────────────
 * HTTP layer for user endpoints.
 *
 * Responsibilities:
 *   - Parse and validate HTTP request data (body, params, query).
 *   - Call the service layer.
 *   - Format and send the HTTP response.
 *   - Pass errors to next() so the global error handler deals with them.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const userService = require('../services/user.service');

/**
 * GET /api/v1/users
 * Returns a list of all users.
 */
async function getAllUsers(req, res, next) {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/users/:id
 * Returns a single user by ID (with Redis caching).
 */
async function getUserById(req, res, next) {
  try {
    const { id } = req.params;

    // Basic sanity check before hitting the DB
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      const err = new Error('User ID must be a positive integer');
      err.statusCode = 400;
      return next(err);
    }

    const user = await userService.getUserById(id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/users
 * Creates a new user.
 *
 * Expected body: { username, email, balance? }
 */
async function createUser(req, res, next) {
  try {
    const { username, email, balance } = req.body;
    const user = await userService.createUser({ username, email, balance });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllUsers, getUserById, createUser };
