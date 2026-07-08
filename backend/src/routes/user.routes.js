/**
 * user.routes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Route definitions for /api/v1/users
 * ──────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { Router } = require('express');
const userController = require('../controllers/user.controller');

const router = Router();

// GET  /api/v1/users        → list all users
router.get('/', userController.getAllUsers);

// GET  /api/v1/users/:id    → get single user (with Redis cache)
router.get('/:id', userController.getUserById);

// POST /api/v1/users        → create new user
router.post('/', userController.createUser);

module.exports = router;
