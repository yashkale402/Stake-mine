'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import GameControls from '@/components/GameControls';
import GameBoard from '@/components/GameBoard';
import PlayerExperiencePanel, { EngagementPayload } from '@/components/PlayerExperiencePanel';
import TrustPanel from '@/components/TrustPanel';
import api from '@/lib/api';
import { useGameAudio } from '@/lib/useGameAudio';
import { Sparkles } from 'lucide-react';

interface FairnessPayload {
  model: string;
  board_size: number;
  house_edge: number;
  explanation: string[];
  fairness_note: string;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  total_games: number;
  biggest_cashout_formatted: string;
  net_profit_formatted: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, updateBalance, user, updateUser } = useAuthStore();
  const { activeGame, setActiveGame, setLastResultMessage, isLoading } = useGameStore();
  const [mounted, setMounted] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [engagement, setEngagement] = useState<EngagementPayload | null>(null);
  const [fairness, setFairness] = useState<FairnessPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [claimingReward, setClaimingReward] = useState(false);

  useGameAudio({ activeGame, isLoading });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && isHydrated && isAuthenticated && user?.role === 'ADMIN') {
      router.replace('/admin');
    }
  }, [mounted, isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (!mounted || !isAuthenticated || activeGame) return;

    let cancelled = false;
    setRestoring(true);

    api
      .get('/game/active')
      .then((res: any) => {
        if (cancelled) return;
        const game = res?.data;
        if (game && game.status === 'ACTIVE') {
          setActiveGame({
            game_uuid: game.game_uuid,
            board_size: game.board_size,
            total_cells: game.board_size,
            mine_count: game.mine_count,
            bet_amount_paise: game.bet_amount_paise,
            current_multiplier: String(game.current_multiplier ?? '1.0000'),
            status: 'ACTIVE',
            revealed_cells: game.revealed_cells || [],
            expires_at: game.expires_at,
            current_payout_paise: Math.floor(
              game.bet_amount_paise * parseFloat(String(game.current_multiplier || 1))
            ),
          });
          setLastResultMessage('Session restored - continue your game.');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mounted, isAuthenticated, activeGame, setActiveGame, setLastResultMessage]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;

    const loadExperience = () => {
      Promise.all([
        api.get('/auth/me'),
        api.get('/users/engagement'),
        api.get('/game/fairness'),
        api.get('/users/leaderboard?limit=8'),
      ])
        .then(([meRes, engagementRes, fairnessRes, leaderboardRes]: any[]) => {
          if (meRes?.data?.balance_paise !== undefined) {
            updateBalance(meRes.data.balance_paise);
            updateUser(meRes.data);
          }
          setEngagement(engagementRes?.data || null);
          setFairness(fairnessRes?.data || null);
          setLeaderboard(leaderboardRes?.data || []);
        })
        .catch(() => {});
    };

    loadExperience();

    const handleFocus = () => loadExperience();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, [mounted, isAuthenticated, updateBalance, updateUser]);

  const handleClaimDailyReward = async () => {
    setClaimingReward(true);
    try {
      const res: any = await api.post('/users/daily-reward/claim', {});
      if (res?.data?.balance_paise !== undefined && user) {
        updateUser({ ...user, balance_paise: res.data.balance_paise });
      }
      const refreshed: any = await api.get('/users/engagement');
      setEngagement(refreshed?.data || null);
      setLastResultMessage(`Daily reward claimed: ${res.data.reward_formatted}`);
    } catch (err) {
      // Let the existing game-level messaging handle failures quietly.
    } finally {
      setClaimingReward(false);
    }
  };

  if (!mounted || !isHydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-stake-text">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stake-accent border-t-transparent" />
          <span className="font-display tracking-wide">Loading Stake Mine...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role === 'ADMIN') return null;

  const isTerminal =
    activeGame && (activeGame.status === 'CASHED_OUT' || activeGame.status === 'LOST');

  return (
    <div className="flex flex-col gap-5 animate-float-in">
      <div className="hero-shell flex flex-col gap-4 overflow-hidden rounded-[28px] border border-white/8 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <p className="label-caps mb-1 flex items-center gap-1.5 text-stake-accent">
            <Sparkles className="h-3.5 w-3.5" /> Live Mines Session
          </p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            Pick gems. Dodge mines. Cash out.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stake-text">
            This first upgrade pass adds tutorial guidance, trust details, progression, rewards, missions, and leaderboard feedback on top of the core game.
          </p>
        </div>
        {restoring && (
          <span className="rounded-full border border-stake-accent/20 bg-stake-accent/10 px-3 py-1 text-xs text-stake-text">
            Restoring active session...
          </span>
        )}
      </div>

      {isTerminal && (
        <div
          className={`rounded-2xl border px-4 py-3 text-center font-display text-lg font-bold ${
            activeGame.status === 'CASHED_OUT'
              ? 'border-emerald-500/40 bg-emerald-950/50 text-stake-accent'
              : 'border-rose-500/40 bg-rose-950/50 text-rose-300'
          }`}
        >
          {activeGame.status === 'CASHED_OUT'
            ? `Cashed out at ${activeGame.current_multiplier}x`
            : 'Boom - you hit a mine. Try another round.'}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-4 xl:col-span-3">
          <GameControls />
        </div>
        <div className="lg:col-span-8 xl:col-span-9">
          <GameBoard />
        </div>
      </div>

      <PlayerExperiencePanel
        engagement={engagement}
        claimingReward={claimingReward}
        onClaimDailyReward={handleClaimDailyReward}
      />

      <TrustPanel fairness={fairness} leaderboard={leaderboard} />
    </div>
  );
}
