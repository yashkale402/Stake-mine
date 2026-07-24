/**
 * user.controller.js
 * HTTP controller for user, wallet, and engagement endpoints.
 */

'use strict';

const userService = require('../services/user.service');
const { success } = require('../utils/response.helper');

async function getProfile(req, res, next) {
  try {
    const user = await userService.getUserById(req.user.id);
    res.status(200).json(success(user));
  } catch (err) {
    next(err);
  }
}

async function deposit(req, res, next) {
  try {
    const userId = req.user.id;
    const { amountPaise } = req.body;
    const result = await userService.deposit(userId, Number(amountPaise));
    res.status(200).json(success(result, 'Deposit successful'));
  } catch (err) {
    next(err);
  }
}

async function getEngagement(req, res, next) {
  try {
    const result = await userService.getPlayerEngagement(req.user.id);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

async function claimDailyReward(req, res, next) {
  try {
    const result = await userService.claimDailyReward(req.user.id);
    res.status(200).json(success(result, 'Daily reward claimed'));
  } catch (err) {
    next(err);
  }
}

async function getLeaderboard(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const result = await userService.getLeaderboard(limit);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  deposit,
  getEngagement,
  claimDailyReward,
  getLeaderboard,
};
