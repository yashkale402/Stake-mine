'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, Medal } from 'lucide-react';

interface Props {
  fairness: {
    model: string; board_size: number; house_edge: number;
    explanation: string[]; fairness_note: string;
  } | null;
  leaderboard: Array<{
    rank: number; username: string; total_games: number;
    biggest_cashout_formatted: string; net_profit_formatted: string;
  }>;
}

const RANK_COLORS = ['#f5c542', '#c0c0c0', '#cd7f32'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

export default function TrustPanel({ fairness, leaderboard }: Props) {
  const houseEdgePct = fairness ? fairness.house_edge * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {/* Fairness */}
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label-caps mb-1 text-stake-accent">Trust & Quality</p>
            <h3 className="font-display text-lg font-bold text-white">Fairness</h3>
          </div>
          <ShieldCheck className="h-5 w-5 text-stake-gold" />
        </div>

        {fairness ? (
          <>
            <div className="mb-4 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-sm">
              <p className="font-semibold text-white">{fairness.model}</p>
              <div className="mt-2 flex gap-4 text-stake-text">
                <span>Board: <strong className="text-white">{fairness.board_size} cells</strong></span>
                <span>House edge: <strong className="text-white">{houseEdgePct.toFixed(2)}%</strong></span>
              </div>
              {/* House edge gauge */}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-stake-text">
                  <span>House Edge</span><span>{houseEdgePct.toFixed(2)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#00e701,#f5c542)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, houseEdgePct * 5)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm text-stake-text">
              {fairness.explanation.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-stake-accent" />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.07] p-3 text-sm text-emerald-100">
              {fairness.fairness_note}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-stake-text">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stake-accent border-t-transparent" />
            Loading fairness details...
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label-caps mb-1 text-stake-accent">Growth Loop</p>
            <h3 className="font-display text-lg font-bold text-white">Leaderboard</h3>
          </div>
          <Sparkles className="h-5 w-5 text-stake-gold" />
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-stake-text">Leaderboard populates as rounds complete.</p>
        ) : (
          <div className="space-y-2.5">
            {leaderboard.map((entry, idx) => (
              <motion.div
                key={`${entry.rank}-${entry.username}`}
                className="animate-leaderboard-in flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 transition-colors hover:bg-white/[0.04]"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                {/* Rank medal */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black"
                  style={{
                    background: idx < 3 ? `${RANK_COLORS[idx]}18` : 'rgba(255,255,255,0.04)',
                    color: idx < 3 ? RANK_COLORS[idx] : 'var(--stake-text)',
                    border: `1px solid ${idx < 3 ? RANK_COLORS[idx] + '30' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {idx < 3 ? RANK_LABELS[idx] : `#${entry.rank}`}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{entry.username}</p>
                  <p className="text-xs text-stake-text">{entry.total_games} rounds</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-stake-accent">{entry.net_profit_formatted}</p>
                  <p className="text-xs text-stake-text">Best {entry.biggest_cashout_formatted}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
