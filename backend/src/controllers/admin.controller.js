/**
 * admin.controller.js
 * HTTP controller for admin configuration, analytics, and player visibility.
 */

'use strict';

const configService = require('../services/config.service');
const configRepository = require('../repositories/config.repository');
const userRepository = require('../repositories/user.repository');
const gameRepository = require('../repositories/game.repository');
const { success } = require('../utils/response.helper');

async function getConfigs(req, res, next) {
  try {
    const configs = await configService.getAllGlobalConfig();
    res.status(200).json(success(configs));
  } catch (err) {
    next(err);
  }
}

async function updateConfig(req, res, next) {
  try {
    const { key, value } = req.body;
    if (!key) {
      const err = new Error('key is required');
      err.statusCode = 400;
      throw err;
    }

    const actor = req.user ? req.user.username : 'admin';
    await configService.setGlobalConfig(key, value, actor);
    res.status(200).json(success({ key, value }, 'Global config updated successfully'));
  } catch (err) {
    next(err);
  }
}

async function getSlots(req, res, next) {
  try {
    const slots = await configRepository.getAllSlots();
    res.status(200).json(success(slots));
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const [userMetrics, gameMetrics, slots, kpis] = await Promise.all([
      userRepository.getAdminUserMetrics(),
      gameRepository.getAdminGameMetrics(),
      configRepository.getAllSlots(),
      gameRepository.getAdminKpis(),
    ]);

    const totalSlotBudgetPaise = slots.reduce(
      (sum, slot) => sum + Number(slot.budget_paise || 0),
      0
    );

    res.status(200).json(
      success({
        userMetrics,
        gameMetrics,
        slotMetrics: {
          total_slots: slots.length,
          total_budget_paise: totalSlotBudgetPaise,
        },
        kpis,
        experiments: [
          { id: 'cashout-cta-copy', status: 'ready', variants: ['standard', 'aggressive'] },
          { id: 'bet-preset-layout', status: 'ready', variants: ['compact', 'highlighted'] },
        ],
      })
    );
  } catch (err) {
    next(err);
  }
}

async function getPlayers(req, res, next) {
  try {
    const players = await userRepository.getRecentPlayers(25);
    res.status(200).json(success(players));
  } catch (err) {
    next(err);
  }
}

async function getConfigHistory(req, res, next) {
  try {
    const logs = await configRepository.getRecentAuditLogs('CONFIG', 25);
    res.status(200).json(success(logs));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getConfigs,
  updateConfig,
  getSlots,
  getSummary,
  getPlayers,
  getConfigHistory,
};
