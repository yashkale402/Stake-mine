/**
 * user.service.js
 * Business-logic layer for user profile, wallet, and engagement operations.
 */

'use strict';

const userRepository = require('../repositories/user.repository');
const configRepository = require('../repositories/config.repository');
const gameRepository = require('../repositories/game.repository');
const { buildPlayerEngagementProfile } = require('./player-engagement.helper');
const logger = require('../logger/logger');

async function getAllUsers() {
  return userRepository.findAll();
}

async function getUserById(id) {
  const user = await userRepository.findById(id);
  if (!user) {
    const err = new Error(`User with ID ${id} not found`);
    err.statusCode = 404;
    throw err;
  }
  return user;
}

async function deposit(userId, amountPaise) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    const err = new Error('Deposit amount must be a positive integer in paise');
    err.statusCode = 400;
    throw err;
  }

  const newBalance = await userRepository.adjustBalance(userId, amountPaise);

  await configRepository.insertAuditLog({
    entity_type: 'WALLET',
    entity_id: String(userId),
    action: 'DEPOSIT',
    actor: String(userId),
    payload: { amountPaise, newBalance },
  });

  logger.info(`[Wallet] User ${userId} deposited Rs ${amountPaise / 100}. New balance: Rs ${newBalance / 100}`);
  return { balance_paise: newBalance, balance_formatted: `Rs ${(newBalance / 100).toFixed(2)}` };
}

async function getPlayerEngagement(userId) {
  const [stats, history, lastRewardLog] = await Promise.all([
    gameRepository.getPlayerSummaryStats(userId),
    gameRepository.getRecentHistory(userId, 20),
    configRepository.getLatestAuditLogForActorAction(userId, 'DAILY_REWARD_CLAIM'),
  ]);

  return buildPlayerEngagementProfile({
    stats,
    history,
    lastDailyRewardAt: lastRewardLog?.created_at || null,
  });
}

async function claimDailyReward(userId) {
  const profile = await getPlayerEngagement(userId);
  if (!profile.daily_reward.available) {
    const err = new Error('Daily reward already claimed today');
    err.statusCode = 409;
    throw err;
  }

  const rewardPaise = profile.daily_reward.reward_paise;
  const newBalance = await userRepository.adjustBalance(userId, rewardPaise);

  await configRepository.insertAuditLog({
    entity_type: 'WALLET',
    entity_id: String(userId),
    action: 'DAILY_REWARD_CLAIM',
    actor: String(userId),
    payload: { rewardPaise, newBalance },
  });

  return {
    reward_paise: rewardPaise,
    reward_formatted: `Rs ${(rewardPaise / 100).toFixed(2)}`,
    balance_paise: newBalance,
    balance_formatted: `Rs ${(newBalance / 100).toFixed(2)}`,
  };
}

async function getLeaderboard(limit = 10) {
  const rows = await gameRepository.getLeaderboard(limit);
  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    total_games: Number(row.total_games || 0),
    biggest_cashout_paise: Number(row.biggest_cashout_paise || 0),
    biggest_cashout_formatted: `Rs ${(Number(row.biggest_cashout_paise || 0) / 100).toFixed(2)}`,
    net_profit_paise: Number(row.net_profit_paise || 0),
    net_profit_formatted: `Rs ${(Number(row.net_profit_paise || 0) / 100).toFixed(2)}`,
  }));
}

module.exports = {
  getAllUsers,
  getUserById,
  deposit,
  getPlayerEngagement,
  claimDailyReward,
  getLeaderboard,
};
