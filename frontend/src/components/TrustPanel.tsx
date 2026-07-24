'use client';

import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface Props {
  fairness: {
    model: string;
    board_size: number;
    house_edge: number;
    explanation: string[];
    fairness_note: string;
  } | null;
  leaderboard: Array<{
    rank: number;
    username: string;
    total_games: number;
    biggest_cashout_formatted: string;
    net_profit_formatted: string;
  }>;
}

export default function TrustPanel({ fairness, leaderboard }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
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
            <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3 text-sm text-stake-text">
              <p className="font-semibold text-white">{fairness.model}</p>
              <p className="mt-1">Board size: {fairness.board_size} cells</p>
              <p>Configured house edge: {(fairness.house_edge * 100).toFixed(2)}%</p>
            </div>
            <div className="mt-4 space-y-2 text-sm text-stake-text">
              {fairness.explanation.map((point, index) => (
                <p key={index}>
                  <span className="mr-2 text-stake-accent">•</span>
                  {point}
                </p>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-3 text-sm text-emerald-100">
              {fairness.fairness_note}
            </div>
          </>
        ) : (
          <p className="text-sm text-stake-text">Loading fairness details...</p>
        )}
      </div>

      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label-caps mb-1 text-stake-accent">Growth Loop</p>
            <h3 className="font-display text-lg font-bold text-white">Leaderboard</h3>
          </div>
          <Sparkles className="h-5 w-5 text-stake-gold" />
        </div>

        <div className="space-y-3">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-stake-text">Leaderboard will populate as rounds are completed.</p>
          ) : (
            leaderboard.map((entry) => (
              <div key={`${entry.rank}-${entry.username}`} className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                <div>
                  <p className="font-semibold text-white">
                    #{entry.rank} {entry.username}
                  </p>
                  <p className="text-xs text-stake-text">{entry.total_games} rounds played</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-stake-accent">{entry.net_profit_formatted}</p>
                  <p className="text-xs text-stake-text">Best {entry.biggest_cashout_formatted}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
