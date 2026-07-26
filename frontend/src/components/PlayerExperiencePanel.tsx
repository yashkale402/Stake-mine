'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Award, Gift, Flag, Trophy, Zap,
  Star, Shield, Flame, Target, Crown, Swords,
} from 'lucide-react';

export interface EngagementPayload {
  stats: {
    total_games: number; wins: number; cashouts: number; losses: number;
    win_rate_pct: number; total_wagered_paise: number; total_paid_paise: number;
    biggest_cashout_paise: number; net_profit_paise: number;
    average_multiplier: number; current_streak: number; best_streak: number;
  };
  tutorial: { how_to_play: string[]; risk_explanation: string; };
  first_win_guidance: string;
  progression: { level: number; title: string; xp: number; next_level_at: number; progress_pct: number; };
  daily_reward: { available: boolean; reward_formatted: string; claimed_at: string | null; next_claim_at: string; };
  missions: Array<{ id: string; title: string; description: string; progress: number; goal: number; completed: boolean; reward: string; }>;
  badges: Array<{ id: string; label: string; unlocked: boolean; }>;
  limited_time_event: { id: string; title: string; description: string; ends_at: string; eligible: boolean; };
}

interface Props {
  engagement: EngagementPayload | null;
  claimingReward: boolean;
  onClaimDailyReward: () => void;
}

// ─── SVG ring progress ────────────────────────────────────────────────────────
function RingProgress({ pct, size = 56, stroke = 4, color = '#00e701' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        className="ring-progress"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
    </svg>
  );
}

// ─── Badge icon map ───────────────────────────────────────────────────────────
const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_win: Star, streak: Flame, big_cashout: Crown,
  veteran: Shield, sharpshooter: Target, warrior: Swords,
};
function BadgeIcon({ id, className }: { id: string; className?: string }) {
  const Icon = BADGE_ICONS[id] || Award;
  return <Icon className={className} />;
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-stake-accent/20 bg-stake-accent/[0.06]' : 'border-white/[0.05] bg-white/[0.025]'}`}>
      <p className="label-caps mb-1">{label}</p>
      <p className={`font-display text-lg font-bold ${accent ? 'text-stake-accent' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function PlayerExperiencePanel({ engagement, claimingReward, onClaimDailyReward }: Props) {
  if (!engagement) {
    return (
      <div className="panel p-5">
        <div className="flex items-center gap-3 text-sm text-stake-text">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-stake-accent border-t-transparent" />
          Loading player data...
        </div>
      </div>
    );
  }

  const { stats, tutorial, progression, daily_reward, missions, badges, limited_time_event } = engagement;

  return (
    <div className="space-y-5">
      {/* How to play */}
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label-caps mb-1 text-stake-accent">Onboarding</p>
            <h2 className="font-display text-xl font-bold text-white">How To Play</h2>
          </div>
          <Flag className="h-5 w-5 text-stake-gold" />
        </div>
        <div className="space-y-2.5 text-sm text-stake-text">
          {tutorial.how_to_play.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stake-accent/12 text-[10px] font-bold text-stake-accent">
                {i + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.07] p-3 text-sm text-amber-100">
          <strong className="text-stake-gold">Risk note:</strong> {tutorial.risk_explanation}
        </div>
        <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-sm text-stake-text">
          {engagement.first_win_guidance}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Progression */}
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-caps mb-1 text-stake-accent">Progression</p>
              <h3 className="font-display text-lg font-bold text-white">{progression.title}</h3>
            </div>
            <div className="relative flex items-center justify-center">
              <RingProgress pct={progression.progress_pct} />
              <span className="absolute font-display text-xs font-bold text-white">{progression.level}</span>
            </div>
          </div>
          <div className="mb-1 flex justify-between text-xs text-stake-text">
            <span>Level {progression.level}</span>
            <span>{progression.xp} / {progression.next_level_at} rounds</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#00e701_0%,#8df76f_60%,#f5c542_100%)] animate-progress-sheen"
              initial={{ width: 0 }}
              animate={{ width: `${progression.progress_pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
            <StatTile label="Win Rate" value={`${stats.win_rate_pct}%`} accent />
            <StatTile label="Best Streak" value={String(stats.best_streak)} />
            <StatTile label="Biggest Cashout" value={`Rs ${(stats.biggest_cashout_paise / 100).toFixed(2)}`} />
            <StatTile label="Avg Multiplier" value={`${stats.average_multiplier}x`} accent />
          </div>
        </div>

        {/* Daily reward */}
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-caps mb-1 text-stake-accent">Daily Reward</p>
              <h3 className="font-display text-lg font-bold text-white">{daily_reward.reward_formatted}</h3>
            </div>
            <Gift className={`h-5 w-5 ${daily_reward.available ? 'text-stake-gold animate-orbit-slow' : 'text-stake-text'}`} />
          </div>
          <p className="text-sm text-stake-text">
            {daily_reward.available
              ? 'Your daily reward is ready.'
              : `Next claim: ${new Date(daily_reward.next_claim_at).toLocaleString()}`}
          </p>
          <motion.button
            type="button"
            disabled={!daily_reward.available || claimingReward}
            onClick={onClaimDailyReward}
            whileHover={daily_reward.available ? { scale: 1.02 } : {}}
            whileTap={daily_reward.available ? { scale: 0.97 } : {}}
            className="btn-primary mt-4 !py-2.5"
          >
            {claimingReward ? 'Claiming...' : daily_reward.available ? '🎁 Claim Daily Reward' : 'Claimed Today'}
          </motion.button>

          {/* Limited time event */}
          <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-sm text-stake-text">
            <div className="mb-1 flex items-center gap-2 font-semibold text-white">
              <Zap className="h-4 w-4 text-stake-accent" />
              {limited_time_event.title}
            </div>
            <p>{limited_time_event.description}</p>
            <p className="mt-1.5 text-xs">Ends {new Date(limited_time_event.ends_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Missions */}
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-caps mb-1 text-stake-accent">Missions</p>
              <h3 className="font-display text-lg font-bold text-white">Active Challenges</h3>
            </div>
            <Trophy className="h-5 w-5 text-stake-gold" />
          </div>
          <div className="space-y-3">
            {missions.map((m, idx) => {
              const pct = m.goal === 0 ? 0 : Math.min(100, Math.round((m.progress / m.goal) * 100));
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <RingProgress pct={pct} size={36} stroke={3} color={m.completed ? '#00e701' : '#f5c542'} />
                      <div>
                        <p className="font-semibold text-white">{m.title}</p>
                        <p className="text-xs text-stake-text">{m.description}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      m.completed ? 'bg-emerald-950 text-stake-accent' : 'bg-[#080f18] text-stake-text'
                    }`}>
                      {m.completed ? '✓ Done' : `${m.progress}/${m.goal}`}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stake-text">Reward: {m.reward}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Badges */}
        <div className="panel p-5">
          <div className="mb-4">
            <p className="label-caps mb-1 text-stake-accent">Badges</p>
            <h3 className="font-display text-lg font-bold text-white">Collection</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {badges.map((badge, idx) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05, type: 'spring', stiffness: 260, damping: 20 }}
                className={`rounded-xl border p-3 text-center text-sm transition-all ${
                  badge.unlocked
                    ? 'border-stake-accent/25 bg-stake-accent/[0.07] shadow-[0_0_14px_rgba(0,231,1,0.1)]'
                    : 'border-white/[0.05] bg-white/[0.02] opacity-50 grayscale'
                }`}
              >
                <BadgeIcon
                  id={badge.id}
                  className={`mx-auto mb-2 h-5 w-5 ${badge.unlocked ? 'text-stake-accent' : 'text-stake-text'}`}
                />
                <p className={`text-xs font-semibold ${badge.unlocked ? 'text-white' : 'text-stake-text'}`}>
                  {badge.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
