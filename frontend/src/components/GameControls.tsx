'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';
import toast from 'react-hot-toast';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameExpiry } from '@/lib/useGameExpiry';
import api from '@/lib/api';
import {
  Bomb, Play, HandCoins, AlertCircle, RotateCcw, Sparkles, TimerReset, Clock,
} from 'lucide-react';

// Animated number that springs to new value
function AnimatedNumber({ value, prefix = '', suffix = '', className = '' }: {
  value: number; prefix?: string; suffix?: string; className?: string;
}) {
  const motionVal = useMotionValue(value);
  const spring = useSpring(motionVal, { stiffness: 120, damping: 18 });
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(2)}${suffix}`);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => { motionVal.set(value); }, [value, motionVal]);
  useEffect(() => {
    return display.on('change', (v) => { if (ref.current) ref.current.textContent = v; });
  }, [display]);

  return <span ref={ref} className={className}>{`${prefix}${value.toFixed(2)}${suffix}`}</span>;
}

export default function GameControls() {
  const {
    activeGame, setActiveGame,
    betAmountRupees, setBetAmountRupees,
    mineCount, setMineCount,
    isLoading, setIsLoading,
    error, setError,
    lastResultMessage, setLastResultMessage,
    resetGame,
  } = useGameStore();
  const { user, updateBalance } = useAuthStore();
  const secondsLeft = useGameExpiry(activeGame?.status === 'ACTIVE' ? activeGame?.expires_at : undefined);

  const isGameActive = activeGame?.status === 'ACTIVE';
  const isTerminal = activeGame?.status === 'CASHED_OUT' || activeGame?.status === 'LOST';
  const hasRevealedCells = (activeGame?.revealed_cells?.length || 0) > 0;

  const multiplier = parseFloat(String(activeGame?.current_multiplier || '1'));
  const currentPayoutRupees = activeGame
    ? ((activeGame.current_payout_paise ?? activeGame.bet_amount_paise * multiplier) / 100)
    : 0;
  const balanceRupees = user ? user.balance_paise / 100 : 0;
  const revealProgress = activeGame
    ? Math.round((activeGame.revealed_cells.length / Math.max(1, activeGame.board_size - activeGame.mine_count)) * 100)
    : 0;

  // Show toasts for result messages
  const prevMessage = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResultMessage || lastResultMessage === prevMessage.current) return;
    prevMessage.current = lastResultMessage;
    if (activeGame?.status === 'CASHED_OUT') {
      toast.success(lastResultMessage, { icon: '💰', duration: 4000 });
    } else if (activeGame?.status === 'LOST') {
      toast.error(lastResultMessage, { icon: '💣', duration: 4000 });
    } else {
      toast(lastResultMessage, { duration: 2500 });
    }
  }, [lastResultMessage, activeGame?.status]);

  // Warn when expiry is close
  useEffect(() => {
    if (secondsLeft === 60) toast('⏱ 1 minute left — cash out soon!', { duration: 4000 });
    if (secondsLeft === 15) toast.error('⚠️ 15 seconds! Cash out now!', { duration: 5000 });
  }, [secondsLeft]);

  const handleStartGame = async () => {
    if (!user) return;
    if (betAmountRupees <= 0) { setError('Bet amount must be greater than Rs 0'); return; }

    setIsLoading(true);
    setError(null);
    setLastResultMessage(null);

    try {
      const res: any = await api.post('/game/start', {
        betAmountPaise: Math.round(betAmountRupees * 100),
        mineCount,
      });
      setActiveGame(res.data);
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
          bet_amount_paise: g.bet_amount_paise || Math.round(betAmountRupees * 100),
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
      const res: any = await api.post('/game/cashout', { gameUuid: activeGame.game_uuid });
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
      if (data.new_balance_paise !== undefined) updateBalance(data.new_balance_paise);
    } catch (err: any) {
      setError(err.message || 'Cashout failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Cashout button urgency: pulses faster as multiplier grows
  const cashoutPulseSpeed = Math.max(0.5, 2.5 - (multiplier - 1) * 0.3);

  return (
    <div className="panel flex h-full flex-col justify-between p-5 sm:p-6">
      <div>
        {/* Header */}
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stake-accent/15 text-stake-accent">
            <Bomb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Game Config</h2>
            <p className="text-xs text-stake-text">
              Balance Rs <AnimatedNumber value={balanceRupees} />
            </p>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-start gap-2 rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-sm text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Amount */}
        <div className="mb-4">
          <label className="label-caps mb-2 block">Bet Amount (Rs)</label>
          <div className="relative">
            <input
              type="number" min={1} step={1}
              disabled={isGameActive}
              value={betAmountRupees}
              onChange={(e) => setBetAmountRupees(Math.max(1, parseFloat(e.target.value) || 0))}
              className="input-field pr-24"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              <button type="button" disabled={isGameActive}
                onClick={() => setBetAmountRupees(Math.max(1, Math.floor(betAmountRupees / 2)))}
                className="rounded-lg bg-stake-cardHover px-2.5 py-1.5 text-xs font-semibold text-stake-text transition hover:text-white disabled:opacity-50">
                1/2
              </button>
              <button type="button" disabled={isGameActive}
                onClick={() => setBetAmountRupees(Number((betAmountRupees * 2).toFixed(2)))}
                className="rounded-lg bg-stake-cardHover px-2.5 py-1.5 text-xs font-semibold text-stake-text transition hover:text-white disabled:opacity-50">
                2x
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[10, 50, 100, 500].map((amt) => (
              <button key={amt} type="button" disabled={isGameActive}
                onClick={() => setBetAmountRupees(amt)}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  betAmountRupees === amt
                    ? 'border-stake-accent/50 bg-stake-accent/10 text-stake-accent'
                    : 'border-white/5 bg-stake-dark text-stake-text hover:text-white'
                }`}>
                Rs {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Mines */}
        <div className="mb-5">
          <label className="label-caps mb-2 block">Mines</label>
          <select disabled={isGameActive} value={mineCount}
            onChange={(e) => setMineCount(parseInt(e.target.value, 10))}
            className="input-field appearance-none">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m} {m === 1 ? 'Mine' : 'Mines'} - {25 - m} Gems</option>
            ))}
          </select>
        </div>

        {/* Live stats */}
        <AnimatePresence>
          {isGameActive && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="panel-inset mb-5 space-y-3 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="label-caps">Multiplier</span>
                <motion.span
                  key={activeGame?.current_multiplier}
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className="font-display text-xl font-extrabold text-stake-accent"
                >
                  {activeGame?.current_multiplier}x
                </motion.span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center justify-between">
                <span className="label-caps">Payout</span>
                <span className="font-display text-xl font-extrabold text-stake-gold">
                  Rs <AnimatedNumber value={currentPayoutRupees} />
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-stake-text">
                <span>Revealed</span>
                <span className="font-semibold text-white">
                  {activeGame?.revealed_cells.length} / {(activeGame?.board_size ?? 25) - (activeGame?.mine_count ?? 0)}
                </span>
              </div>

              {/* Expiry timer */}
              {secondsLeft !== null && (
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                  secondsLeft <= 30 ? 'text-rose-400' : secondsLeft <= 60 ? 'text-stake-gold' : 'text-stake-text'
                }`}>
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {secondsLeft <= 0 ? 'Expired' : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} left`}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <AnimatePresence>
          {isGameActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-5 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="label-caps flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-stake-accent" />
                  Session Momentum
                </span>
                <span className="text-xs font-semibold text-white">{revealProgress}% clear</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#00e701_0%,#8df76f_50%,#f5c542_100%)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${revealProgress}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-stake-text">
                <span className="flex items-center gap-1">
                  <TimerReset className="h-3.5 w-3.5" />
                  Keep a streak alive for stronger cashout pressure
                </span>
                <span>{activeGame?.revealed_cells.length} picks</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {isTerminal ? (
          <motion.button
            type="button" onClick={resetGame}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-5 w-5" /> Play Again
          </motion.button>
        ) : !isGameActive ? (
          <motion.button
            type="button" onClick={handleStartGame} disabled={isLoading}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Play className="h-5 w-5 fill-current" />
            {isLoading ? 'Starting...' : 'Bet & Play'}
          </motion.button>
        ) : (
          <motion.button
            type="button" onClick={handleCashout}
            disabled={isLoading || !hasRevealedCells}
            animate={hasRevealedCells ? {
              boxShadow: [
                '0 0 24px rgba(245,197,66,0.28)',
                `0 0 ${20 + multiplier * 8}px rgba(245,197,66,0.65)`,
                '0 0 24px rgba(245,197,66,0.28)',
              ],
            } : {}}
            transition={{ duration: cashoutPulseSpeed, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
            className="btn-gold flex items-center justify-center gap-2"
          >
            <HandCoins className="h-6 w-6" />
            {isLoading ? 'Cashing out...' : `Cashout Rs ${currentPayoutRupees.toFixed(2)}`}
          </motion.button>
        )}
      </div>
    </div>
  );
}
