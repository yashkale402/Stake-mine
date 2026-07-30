'use strict';

const gameRepository = require('../repositories/game.repository');

/**
 * Simple player profiling used by the quote engine.
 * Returns one of: NEW_PLAYER, NORMAL, HIGH_ROLLER, LOSS_RECOVERY
 */
async function getPlayerProfile(userId) {
  const stats = await gameRepository.getPlayerSummaryStats(userId);
  const totalGames = Number(stats?.total_games || 0);
  const netProfit = Number(stats?.net_profit_paise || 0);
  const avgBet = Number(stats?.total_wagered_paise || 0) / Math.max(1, totalGames);

  // Heuristics
  if (totalGames < 5) return 'NEW_PLAYER';
  if (netProfit > 1000000) return 'HIGH_ROLLER'; // > ₹10,000 profit

  const losses = await gameRepository.getConsecutiveLosses(userId);
  if (losses >= 3) return 'LOSS_RECOVERY';

  return 'NORMAL';
}

module.exports = { getPlayerProfile };
