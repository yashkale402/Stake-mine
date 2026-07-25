'use client';

import React from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import {
  Bomb,
  Play,
  HandCoins,
  AlertCircle,
  RotateCcw,
  Sparkles,
  TimerReset,
} from 'lucide-react';

export default function GameControls() {
  const {
    activeGame,
    setActiveGame,
    betAmountRupees,
    setBetAmountRupees,
    mineCount,
    setMineCount,
    isLoading,
    setIsLoading,
    error,
    setError,
    lastResultMessage,
    setLastResultMessage,
    resetGame,
  } = useGameStore();

  const { user, updateBalance } = useAuthStore();

  const isGameActive = activeGame?.status === 'ACTIVE';
  const isTerminal =
    activeGame?.status === 'CASHED_OUT' || activeGame?.status === 'LOST';
  const hasRevealedCells = (activeGame?.revealed_cells?.length || 0) > 0;

  const handleStartGame = async () => {
    if (!user) return;
    if (betAmountRupees <= 0) {
      setError('Bet amount must be greater than Rs 0');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastResultMessage(null);

    try {
      const betAmountPaise = Math.round(betAmountRupees * 100);
      const res: any = await api.post('/game/start', {
        betAmountPaise,
        mineCount,
      });

      setActiveGame(res.data);
      // Fetch real balance from server instead of estimating
      api.get('/auth/me').then((meRes: any) => {
        if (meRes?.data?.balance_paise !== undefined) updateBalance(meRes.data.balance_paise);
      }).catch(() => {});
    } catch (err: any) {
      if (err.activeGame?.game_uuid) {
        const g = err.activeGame;
        setActiveGame({
          game_uuid: g.game_uuid,
          board_size: g.board_size || 25,
          total_cells: g.board_size || 25,
          mine_count: g.mine_count || mineCount,
          bet_amount_paise: g.bet_amount_paise || betAmountPaiseFallback(betAmountRupees),
          current_multiplier: String(g.current_multiplier ?? '1.0000'),
          status: 'ACTIVE',
          revealed_cells: g.revealed_cells || [],
          expires_at: g.expires_at,
        });
        setLastResultMessage('Resumed your unfinished game.');
        setError(null);
      } else {
        setError(err.message || 'Failed to start game');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCashout = async () => {
    if (!activeGame || !isGameActive) return;

    setIsLoading(true);
    setError(null);

    try {
      const res: any = await api.post('/game/cashout', {
        gameUuid: activeGame.game_uuid,
      });

      const data = res.data;
      setActiveGame({
        ...activeGame,
        status: 'CASHED_OUT',
        mine_positions: data.mine_positions,
        current_multiplier: data.final_multiplier || activeGame.current_multiplier,
        current_payout_paise: data.payout_paise,
        message: data.message,
      });
      setLastResultMessage(data.message || 'Cashed out!');

      if (data.new_balance_paise !== undefined) {
        updateBalance(data.new_balance_paise);
      }
    } catch (err: any) {
      setError(err.message || 'Cashout failed');
    } finally {
      setIsLoading(false);
    }
  };

  const currentPayoutRupees = activeGame
    ? (
        ((activeGame.current_payout_paise ??
          activeGame.bet_amount_paise * parseFloat(String(activeGame.current_multiplier || 1))) /
          100)
      ).toFixed(2)
    : '0.00';

  const balanceRupees = user ? (user.balance_paise / 100).toFixed(2) : '0.00';
  const revealProgress = activeGame
    ? Math.round((activeGame.revealed_cells.length / Math.max(1, 25 - activeGame.mine_count)) * 100)
    : 0;

  return (
    <div className="panel flex h-full flex-col justify-between p-5 sm:p-6">
      <div>
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stake-accent/15 text-stake-accent">
            <Bomb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Game Config</h2>
            <p className="text-xs text-stake-text">Balance Rs {balanceRupees}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-sm text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {lastResultMessage && !error && (
          <div className="mb-4 rounded-xl border border-white/10 bg-stake-dark/60 p-3 text-sm text-stake-text">
            {lastResultMessage}
          </div>
        )}

        <div className="mb-4">
          <label className="label-caps mb-2 block">Bet Amount (Rs)</label>
          <div className="relative">
            <input
              type="number"
              min={1}
              step={1}
              disabled={isGameActive}
              value={betAmountRupees}
              onChange={(e) => setBetAmountRupees(Math.max(1, parseFloat(e.target.value) || 0))}
              className="input-field pr-24"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              <button
                type="button"
                disabled={isGameActive}
                onClick={() => setBetAmountRupees(Math.max(1, Math.floor(betAmountRupees / 2)))}
                className="rounded-lg bg-stake-cardHover px-2.5 py-1.5 text-xs font-semibold text-stake-text transition hover:text-white disabled:opacity-50"
              >
                1/2
              </button>
              <button
                type="button"
                disabled={isGameActive}
                onClick={() => setBetAmountRupees(Number((betAmountRupees * 2).toFixed(2)))}
                className="rounded-lg bg-stake-cardHover px-2.5 py-1.5 text-xs font-semibold text-stake-text transition hover:text-white disabled:opacity-50"
              >
                2x
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[10, 50, 100, 500].map((amt) => (
              <button
                key={amt}
                type="button"
                disabled={isGameActive}
                onClick={() => setBetAmountRupees(amt)}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  betAmountRupees === amt
                    ? 'border-stake-accent/50 bg-stake-accent/10 text-stake-accent'
                    : 'border-white/5 bg-stake-dark text-stake-text hover:text-white'
                }`}
              >
                Rs {amt}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="label-caps mb-2 block">Mines</label>
          <select
            disabled={isGameActive}
            value={mineCount}
            onChange={(e) => setMineCount(parseInt(e.target.value, 10))}
            className="input-field appearance-none"
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? 'Mine' : 'Mines'} - {25 - m} Gems
              </option>
            ))}
          </select>
        </div>

        {isGameActive && (
          <div className="panel-inset mb-5 space-y-3 p-4 animate-multiplier-pop">
            <div className="flex items-center justify-between">
              <span className="label-caps">Multiplier</span>
              <span className="font-display text-xl font-extrabold text-stake-accent">
                {activeGame.current_multiplier}x
              </span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <span className="label-caps">Payout</span>
              <span className="font-display text-xl font-extrabold text-stake-gold">
                Rs {currentPayoutRupees}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-stake-text">
              <span>Revealed</span>
              <span className="font-semibold text-white">
                {activeGame.revealed_cells.length} / {25 - activeGame.mine_count}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {isGameActive && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="label-caps flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-stake-accent" />
                Session Momentum
              </span>
              <span className="text-xs font-semibold text-white">{revealProgress}% clear</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="animate-progress-sheen h-full rounded-full bg-[linear-gradient(90deg,#00e701_0%,#8df76f_50%,#f5c542_100%)] transition-all duration-500"
                style={{ width: `${revealProgress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-stake-text">
              <span className="flex items-center gap-1">
                <TimerReset className="h-3.5 w-3.5" />
                Keep a streak alive for stronger cashout pressure
              </span>
              <span>{activeGame.revealed_cells.length} picks</span>
            </div>
          </div>
        )}

        {isTerminal ? (
          <button type="button" onClick={resetGame} className="btn-primary flex items-center justify-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Play Again
          </button>
        ) : !isGameActive ? (
          <button
            type="button"
            onClick={handleStartGame}
            disabled={isLoading}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Play className="h-5 w-5 fill-current" />
            {isLoading ? 'Starting...' : 'Bet & Play'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCashout}
            disabled={isLoading || !hasRevealedCells}
            className="btn-gold flex items-center justify-center gap-2"
          >
            <HandCoins className="h-6 w-6" />
            {isLoading ? 'Cashing out...' : `Cashout Rs ${currentPayoutRupees}`}
          </button>
        )}
      </div>
    </div>
  );
}

function betAmountPaiseFallback(rupees: number) {
  return Math.round(rupees * 100);
}
