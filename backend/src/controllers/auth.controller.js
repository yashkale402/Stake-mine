/**
 * auth.controller.js
 * ──────────────────────────────────────────────────────────────────────────────
 * HTTP controller for user registration, login, and profile lookup.
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const authService = require('../services/auth.service');
const { success } = require('../utils/response.helper');

/**
 * POST /api/v1/auth/register
 */
async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const result = await authService.register({ username, email, password });
    res.status(201).json(success(result, 'Registration successful'));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json(success(result, 'Login successful'));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 */
async function getProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const user = await authService.getProfile(userId);
    res.status(200).json(success(user));
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getProfile };
