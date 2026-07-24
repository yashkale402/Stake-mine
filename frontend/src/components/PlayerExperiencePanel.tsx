'use client';

import React from 'react';
import { Award, Gift, Flag, Trophy, Zap } from 'lucide-react';

export interface EngagementPayload {
  stats: {
    total_games: number;
    wins: number;
    cashouts: number;
    losses: number;
    win_rate_pct: number;
    total_wagered_paise: number;
    total_paid_paise: number;
    biggest_cashout_paise: number;
    net_profit_paise: number;
    average_multiplier: number;
    current_streak: number;
    best_streak: number;
  };
  tutorial: {
    how_to_play: string[];
    risk_explanation: string;
  };
  first_win_guidance: string;
  progression: {
    level: number;
    title: string;
    xp: number;
    next_level_at: number;
    progress_pct: number;
  };
  daily_reward: {
    available: boolean;
    reward_formatted: string;
    claimed_at: string | null;
    next_claim_at: string;
  };
  missions: Array<{
    id: string;
    title: string;
    description: string;
    progress: number;
    goal: number;
    completed: boolean;
    reward: string;
  }>;
  badges: Array<{
    id: string;
    label: string;
    unlocked: boolean;
  }>;
  limited_time_event: {
    id: string;
    title: string;
    description: string;
    ends_at: string;
    eligible: boolean;
  };
}

interface Props {
  engagement: EngagementPayload | null;
  claimingReward: boolean;
  onClaimDailyReward: () => void;
}

export default function PlayerExperiencePanel({
  engagement,
  claimingReward,
  onClaimDailyReward,
}: Props) {
  if (!engagement) {
    return (
      <div className="panel p-5 text-sm text-stake-text">
        Loading player progression, missions, and reward state...
      </div>
    );
  }

  const { stats, tutorial, progression, daily_reward, missions, badges, limited_time_event } = engagement;

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="label-caps mb-1 text-stake-accent">Onboarding</p>
            <h2 className="font-display text-xl font-bold text-white">How To Play</h2>
          </div>
          <Flag className="h-5 w-5 text-stake-gold" />
        </div>
        <div className="space-y-2 text-sm text-stake-text">
          {tutorial.how_to_play.map((step, index) => (
            <p key={index}>
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-stake-accent/10 text-xs font-bold text-stake-accent">
                {index + 1}
              </span>
              {step}
            </p>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-500/15 bg-amber-500/8 p-3 text-sm text-amber-100">
          <strong className="text-stake-gold">Risk note:</strong> {tutorial.risk_explanation}
        </div>
        <div className="mt-3 rounded-2xl border border-white/6 bg-white/[0.03] p-3 text-sm text-stake-text">
          {engagement.first_win_guidance}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-caps mb-1 text-stake-accent">Progression</p>
              <h3 className="font-display text-lg font-bold text-white">{progression.title}</h3>
            </div>
            <Award className="h-5 w-5 text-stake-gold" />
          </div>
          <p className="text-sm text-stake-text">Level {progression.level}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="animate-progress-sheen h-full rounded-full bg-[linear-gradient(90deg,#00e701_0%,#8df76f_60%,#f5c542_100%)]"
              style={{ width: `${progression.progress_pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-stake-text">
            {progression.xp} rounds played. Next tier at {progression.next_level_at} rounds.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <StatTile label="Win Rate" value={`${stats.win_rate_pct}%`} />
            <StatTile label="Best Streak" value={String(stats.best_streak)} />
            <StatTile label="Biggest Cashout" value={`Rs ${(stats.biggest_cashout_paise / 100).toFixed(2)}`} />
            <StatTile label="Avg Multiplier" value={`${stats.average_multiplier}x`} />
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-caps mb-1 text-stake-accent">Daily Reward</p>
              <h3 className="font-display text-lg font-bold text-white">{daily_reward.reward_formatted}</h3>
            </div>
            <Gift className="h-5 w-5 text-stake-gold" />
          </div>
          <p className="text-sm text-stake-text">
            {daily_reward.available
              ? 'Reward is ready to claim.'
              : `Already claimed. Next claim opens at ${new Date(daily_reward.next_claim_at).toLocaleString()}.`}
          </p>
          <button
            type="button"
            disabled={!daily_reward.available || claimingReward}
            onClick={onClaimDailyReward}
            className="btn-primary mt-4 !py-2.5"
          >
            {claimingReward ? 'Claiming...' : daily_reward.available ? 'Claim Daily Reward' : 'Claimed Today'}
          </button>
          <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-3 text-sm text-stake-text">
            <div className="mb-1 flex items-center gap-2 text-white">
              <Zap className="h-4 w-4 text-stake-accent" />
              {limited_time_event.title}
            </div>
            <p>{limited_time_event.description}</p>
            <p className="mt-2 text-xs text-stake-text">
              Ends {new Date(limited_time_event.ends_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-caps mb-1 text-stake-accent">Missions</p>
              <h3 className="font-display text-lg font-bold text-white">Active Challenges</h3>
            </div>
            <Trophy className="h-5 w-5 text-stake-gold" />
          </div>
          <div className="space-y-3">
            {missions.map((mission) => {
              const percent = mission.goal === 0 ? 0 : Math.min(100, Math.round((mission.progress / mission.goal) * 100));
              return (
                <div key={mission.id} className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{mission.title}</p>
                      <p className="text-sm text-stake-text">{mission.description}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${mission.completed ? 'bg-emerald-950 text-stake-accent' : 'bg-stake-dark text-stake-text'}`}>
                      {mission.completed ? 'Done' : `${mission.progress}/${mission.goal}`}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-stake-accent transition-all duration-300" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-stake-text">Reward: {mission.reward}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4">
            <p className="label-caps mb-1 text-stake-accent">Badges</p>
            <h3 className="font-display text-lg font-bold text-white">Collection</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-2xl border p-3 text-center text-sm ${
                  badge.unlocked
                    ? 'border-stake-accent/25 bg-stake-accent/10 text-white'
                    : 'border-white/6 bg-white/[0.03] text-stake-text'
                }`}
              >
                <Award className={`mx-auto mb-2 h-5 w-5 ${badge.unlocked ? 'text-stake-accent' : 'text-stake-text'}`} />
                <p className="font-semibold">{badge.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
      <p className="label-caps mb-1">{label}</p>
      <p className="font-display text-lg font-bold text-white">{value}</p>
    </div>
  );
}
