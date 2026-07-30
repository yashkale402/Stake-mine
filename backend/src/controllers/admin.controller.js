/**
 * admin.controller.js
 * HTTP controller for admin configuration, analytics, and player visibility.
 */

'use strict';

const configService = require('../services/config.service');
const configRepository = require('../repositories/config.repository');
const userRepository = require('../repositories/user.repository');
const gameRepository = require('../repositories/game.repository');
const budgetService = require('../services/budget.service');
const { success } = require('../utils/response.helper');

async function getConfigs(req, res, next) {
  try {
    const configs = await configService.getAllGlobalConfig();
    res.status(200).json(success(configs));
  } catch (err) { next(err); }
}

async function updateConfig(req, res, next) {
  try {
    const { key, value } = req.body;
    if (!key) { const e = new Error('key is required'); e.statusCode = 400; throw e; }
    const actor = req.user?.username || 'admin';
    await configService.setGlobalConfig(key, value, actor);
    res.status(200).json(success({ key, value }, 'Config updated'));
  } catch (err) { next(err); }
}

async function getSlots(req, res, next) {
  try {
    const slots = await configRepository.getAllSlots();
    res.status(200).json(success(slots));
  } catch (err) { next(err); }
}

async function updateSlot(req, res, next) {
  try {
    const { id } = req.params;
    await configRepository.updateSlot(id, req.body, req.user.username);
    await configRepository.insertAuditLog({
      entity_type: 'SLOT', entity_id: id, action: 'SLOT_UPDATE',
      actor: req.user.username, payload: req.body,
    });
    const slots = await configRepository.getAllSlots();
    res.status(200).json(success(slots, 'Slot updated'));
  } catch (err) { next(err); }
}

async function getSummary(req, res, next) {
  try {
    const [userMetrics, gameMetrics, slots, kpis] = await Promise.all([
      userRepository.getAdminUserMetrics(),
      gameRepository.getAdminGameMetrics(),
      configRepository.getAllSlots(),
      gameRepository.getAdminKpis(),
    ]);
    const totalSlotBudgetPaise = slots.reduce((s, slot) => s + Number(slot.budget_paise || 0), 0);
    res.status(200).json(success({
      userMetrics, gameMetrics,
      slotMetrics: { total_slots: slots.length, total_budget_paise: totalSlotBudgetPaise },
      kpis,
      experiments: [
        { id: 'cashout-cta-copy', status: 'ready', variants: ['standard', 'aggressive'] },
        { id: 'bet-preset-layout', status: 'ready', variants: ['compact', 'highlighted'] },
      ],
    }));
  } catch (err) { next(err); }
}

async function getPlayers(req, res, next) {
  try {
    const players = await userRepository.getRecentPlayers(50);
    res.status(200).json(success(players));
  } catch (err) { next(err); }
}

async function getPlayerDetail(req, res, next) {
  try {
    const { id } = req.params;
    const [user, stats, history] = await Promise.all([
      userRepository.findById(Number(id)),
      gameRepository.getPlayerSummaryStats(Number(id)),
      gameRepository.getRecentHistory(Number(id), 10),
    ]);
    if (!user) { const e = new Error('Player not found'); e.statusCode = 404; throw e; }
    res.status(200).json(success({ user, stats, history }));
  } catch (err) { next(err); }
}

async function suspendPlayer(req, res, next) {
  try {
    const { id } = req.params;
    await userRepository.suspendPlayer(Number(id));
    await configRepository.insertAuditLog({
      entity_type: 'USER', entity_id: id, action: 'PLAYER_SUSPEND', actor: req.user.username,
    });
    res.status(200).json(success(null, 'Player suspended'));
  } catch (err) { next(err); }
}

async function activatePlayer(req, res, next) {
  try {
    const { id } = req.params;
    await userRepository.activatePlayer(Number(id));
    await configRepository.insertAuditLog({
      entity_type: 'USER', entity_id: id, action: 'PLAYER_ACTIVATE', actor: req.user.username,
    });
    res.status(200).json(success(null, 'Player activated'));
  } catch (err) { next(err); }
}

async function adjustPlayerBalance(req, res, next) {
  try {
    const { id } = req.params;
    const { amountPaise, reason } = req.body;
    if (!amountPaise) { const e = new Error('amountPaise required'); e.statusCode = 400; throw e; }
    await userRepository.adjustBalance(Number(id), Number(amountPaise));
    await configRepository.insertAuditLog({
      entity_type: 'WALLET', entity_id: id, action: 'ADMIN_BALANCE_ADJUST',
      actor: req.user.username, payload: { amountPaise, reason },
    });
    res.status(200).json(success(null, 'Balance adjusted'));
  } catch (err) { next(err); }
}

async function getSlotBudgetStatus(req, res, next) {
  try {
    const result = await budgetService.getRiskDashboard();
    res.status(200).json(success(result));
  } catch (err) { next(err); }
}

async function getConfigHistory(req, res, next) {
  try {
    const logs = await configRepository.getRecentAuditLogs(null, 50);
    res.status(200).json(success(logs));
  } catch (err) { next(err); }
}

module.exports = {
  getConfigs, updateConfig,
  getSlots, updateSlot,
  getSummary,
  getPlayers, getPlayerDetail, suspendPlayer, activatePlayer, adjustPlayerBalance,
  getSlotBudgetStatus,
  getConfigHistory,
};

