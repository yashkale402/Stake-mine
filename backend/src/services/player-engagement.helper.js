'use strict';

function buildPlayerEngagementProfile({
  stats,
  history = [],
  lastDailyRewardAt = null,
  now = new Date(),
}) {
  const totalGames = Number(stats.total_games || 0);
  const wins = Number(stats.wins || 0);
  const cashouts = Number(stats.cashouts || 0);
  const losses = Number(stats.losses || 0);
  const totalWageredPaise = Number(stats.total_wagered_paise || 0);
  const totalPaidPaise = Number(stats.total_paid_paise || 0);
  const biggestCashoutPaise = Number(stats.biggest_cashout_paise || 0);
  const netProfitPaise = Number(stats.net_profit_paise || 0);
  const averageMultiplier = round2(Number(stats.average_multiplier || 0));
  const streaks = calculateStreaks(history);
  const progression = buildProgression(totalGames);
  const dailyReward = resolveDailyReward(lastDailyRewardAt, now);

  return {
    stats: {
      total_games: totalGames,
      wins,
      cashouts,
      losses,
      win_rate_pct: totalGames === 0 ? 0 : round2(((wins + cashouts) / totalGames) * 100),
      total_wagered_paise: totalWageredPaise,
      total_paid_paise: totalPaidPaise,
      biggest_cashout_paise: biggestCashoutPaise,
      net_profit_paise: netProfitPaise,
      average_multiplier: averageMultiplier,
      current_streak: streaks.current,
      best_streak: streaks.best,
    },
    tutorial: {
      how_to_play: [
        'Choose your bet and mine count before the round starts.',
        'Each safe reveal increases the multiplier, but a mine ends the round immediately.',
        'After at least one safe reveal, you can cash out any time and secure the shown payout.',
      ],
      risk_explanation:
        'More mines create higher upside faster, but the board becomes far more punishing. Lower mine counts are the steadier path.',
    },
    first_win_guidance:
      wins + cashouts > 0
        ? 'You already have a result on the board. Use small streaks and earlier cashouts to protect momentum.'
        : 'For your first win, aim for one or two safe reveals and take the first strong cashout instead of overextending.',
    progression,
    daily_reward: dailyReward,
    missions: buildMissions({ totalGames, cashouts, biggestCashoutPaise, streaks, totalWageredPaise }),
    badges: buildBadges({ totalGames, cashouts, biggestCashoutPaise, streaks }),
    limited_time_event: buildLimitedTimeEvent(now, totalGames),
  };
}

function calculateStreaks(history) {
  let best = 0;
  let running = 0;

  for (const item of history) {
    if (item.outcome === 'WIN' || item.outcome === 'CASHOUT') {
      running += 1;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  }

  let current = 0;
  for (const item of history) {
    if (item.outcome === 'WIN' || item.outcome === 'CASHOUT') {
      current += 1;
    } else {
      break;
    }
  }

  return { current, best };
}

function buildProgression(totalGames) {
  const tiers = [
    { level: 1, title: 'Rookie Miner', threshold: 0 },
    { level: 2, title: 'Safe Picker', threshold: 10 },
    { level: 3, title: 'Cashout Scout', threshold: 25 },
    { level: 4, title: 'Risk Reader', threshold: 50 },
    { level: 5, title: 'Vault Runner', threshold: 100 },
  ];

  let current = tiers[0];
  let next = tiers[1];

  for (let i = 0; i < tiers.length; i++) {
    if (totalGames >= tiers[i].threshold) {
      current = tiers[i];
      next = tiers[i + 1] || null;
    }
  }

  const currentBase = current.threshold;
  const nextThreshold = next ? next.threshold : current.threshold;
  const progressPct =
    !next || nextThreshold <= currentBase
      ? 100
      : Math.max(
          0,
          Math.min(100, Math.round(((totalGames - currentBase) / (nextThreshold - currentBase)) * 100))
        );

  return {
    level: current.level,
    title: current.title,
    xp: totalGames,
    next_level_at: nextThreshold,
    progress_pct: progressPct,
  };
}

function resolveDailyReward(lastDailyRewardAt, now) {
  const today = now.toISOString().slice(0, 10);
  const lastClaimDate = lastDailyRewardAt
    ? new Date(lastDailyRewardAt).toISOString().slice(0, 10)
    : null;
  const available = lastClaimDate !== today;
  const rewardPaise = 2500;
  const nextClaimAt = new Date(now);
  nextClaimAt.setDate(nextClaimAt.getDate() + 1);
  nextClaimAt.setHours(0, 0, 0, 0);

  return {
    available,
    reward_paise: rewardPaise,
    reward_formatted: `Rs ${(rewardPaise / 100).toFixed(2)}`,
    claimed_at: lastDailyRewardAt,
    next_claim_at: available ? now.toISOString() : nextClaimAt.toISOString(),
  };
}

function buildMissions({ totalGames, cashouts, biggestCashoutPaise, streaks, totalWageredPaise }) {
  return [
    {
      id: 'first-cashout',
      title: 'First Cashout',
      description: 'Secure one successful cashout.',
      progress: Math.min(cashouts, 1),
      goal: 1,
      completed: cashouts >= 1,
      reward: 'Starter badge',
    },
    {
      id: 'streak-3',
      title: 'Heat Check',
      description: 'Reach a 3-round positive streak.',
      progress: Math.min(streaks.best, 3),
      goal: 3,
      completed: streaks.best >= 3,
      reward: 'Momentum title',
    },
    {
      id: 'big-cashout',
      title: 'Big Cashout',
      description: 'Hit a single cashout of Rs 250 or more.',
      progress: Math.min(biggestCashoutPaise, 25000),
      goal: 25000,
      completed: biggestCashoutPaise >= 25000,
      reward: 'Vault runner flair',
    },
    {
      id: 'volume-1000',
      title: 'Volume Player',
      description: 'Wager Rs 1,000 total.',
      progress: Math.min(totalWageredPaise, 100000),
      goal: 100000,
      completed: totalWageredPaise >= 100000,
      reward: 'Bonus chest',
    },
    {
      id: 'play-10',
      title: 'Round Builder',
      description: 'Complete 10 rounds.',
      progress: Math.min(totalGames, 10),
      goal: 10,
      completed: totalGames >= 10,
      reward: 'XP boost',
    },
  ];
}

function buildBadges({ totalGames, cashouts, biggestCashoutPaise, streaks }) {
  return [
    { id: 'starter', label: 'Starter', unlocked: totalGames >= 1 },
    { id: 'cashout-club', label: 'Cashout Club', unlocked: cashouts >= 5 },
    { id: 'streak-master', label: 'Streak Master', unlocked: streaks.best >= 5 },
    { id: 'high-roller-lite', label: 'High Roller Lite', unlocked: biggestCashoutPaise >= 50000 },
  ];
}

function buildLimitedTimeEvent(now, totalGames) {
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + 3);
  return {
    id: 'gem-rush-weekend',
    title: 'Gem Rush Weekend',
    description:
      totalGames >= 5
        ? 'You are eligible for the weekend showcase. Keep the streak alive for extra recognition.'
        : 'Play 5 rounds before the weekend event ends to unlock bonus visibility on the board.',
    ends_at: endsAt.toISOString(),
    eligible: true,
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  buildPlayerEngagementProfile,
  calculateStreaks,
  resolveDailyReward,
};
