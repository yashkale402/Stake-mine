'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';
import toast from 'react-hot-toast';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameExpiry } from '@/lib/useGameExpiry';
import api from '@/lib/api';
import { Bomb, Play, HandCoins, AlertCircle, RotateCcw, Sparkles, TimerReset, Clock } from 'lucide-react';

// ─── Animated spring number ───────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', className = '' }: {
  value: number; prefix?: string; suffix?: string; className?: string;
}) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 110, damping: 16 });
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(2)}${suffix}`);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { mv.set(value); }, [value, mv]);
  useEffect(() => display.on('change', (v) => { if (ref.current) ref.current.textContent = v; }), [display]);
  return <span ref={ref} className={className}>{`${prefix}${value.toFixed(2)}${suffix}`}</span>;
}

// ─── Risk-o-meter ─────────────────────────────────────────────────────────────
function RiskMeter({ mineCount }: { mineCount: number }) {
  const pct = Math.round((mineCount / 24) * 100);
  const color = pct < 30 ? '#00e701' : pct < 60 ? '#f5c542' : '#ff4d6d';
  const label = pct < 30 ? 'Low Risk' : pct < 60 ? 'Medium Risk' : 'High Risk';
  return (
    <div className="mb-4 rounded-xl border border-white/[0.05] bg-[#080f18]/80 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="label-caps">Risk Level</span>
        <span className="text-xs font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="risk-bar-fill h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, #00e701, ${color})` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-stake-text">
        <span>Safe</span><span>Extreme</span>
      </div>
    </div>
  );
}

// ─── Multiplier sparkline ─────────────────────────────────────────────────────
function MultiplierSparkline({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const max = Math.max(...history);
  const min = Math.min(...history);
  const range = max - min || 1;
  const W = 120, H = 32;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} className="overflow-visible">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00e701" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f5c542" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="url(#spark-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      {(() => {
        const last = history[history.length - 1];
        const x = W;
        const y = H - ((last - min) / range) * (H - 4) - 2;
        return <circle cx={x} cy={y} r="3" fill="#f5c542" />;
      })()}
    </svg>
  );
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

  // Track multiplier history for sparkline
  const multiplierHistory = useRef<number[]>([1]);
  useEffect(() => {
    if (!isGameActive) { multiplierHistory.current = [1]; return; }
    const last = multiplierHistory.current[multiplierHistory.current.length - 1];
    if (multiplier !== last) multiplierHistory.current = [...multiplierHistory.current, multiplier];
  }, [multiplier, isGameActive]);

  // Toasts
  const prevMessage = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResultMessage || lastResultMessage === prevMessage.current) return;
    prevMessage.current = lastResultMessage;
    if (activeGame?.status === 'CASHED_OUT') toast.success(lastResultMessage, { icon: '💰', duration: 4000 });
    else if (activeGame?.status === 'LOST') toast.error(lastResultMessage, { icon: '💣', duration: 4000 });
    else toast(lastResultMessage, { duration: 2500 });
  }, [lastResultMessage, activeGame?.status]);

  useEffect(() => {
    if (secondsLeft === 60) toast('⏱ 1 minute left — cash out soon!', { duration: 4000 });
    if (secondsLeft === 15) toast.error('⚠️ 15 seconds! Cash out now!', { duration: 5000 });
  }, [secondsLeft]);

  const handleStartGame = async () => {
    if (!user) return;
    if (betAmountRupees <= 0) { setError('Bet amount must be greater than Rs 0'); return; }
    setIsLoading(true); setError(null); setLastResultMessage(null);
    try {
      const res: any = await api.post('/game/start', {
        betAmountPaise: Math.round(betAmountRupees * 100),
        mineCount,
      });
      setActiveGame(res.data);
      api.get('/auth/me').then((r: any) => {
        if (r?.data?.balance_paise !== undefined) updateBalance(r.data.balance_paise);
      }).catch(() => {});
    } catch (err: any) {
      if (err.activeGame?.game_uuid) {
        const g = err.activeGame;
        setActiveGame({
          game_uuid: g.game_uuid, board_size: g.board_size || 25, total_cells: g.board_size || 25,
          mine_count: g.mine_count || mineCount, bet_amount_paise: g.bet_amount_paise || Math.round(betAmountRupees * 100),
          current_multiplier: String(g.current_multiplier ?? '1.0000'), status: 'ACTIVE',
          revealed_cells: g.revealed_cells || [], expires_at: g.expires_at,
        });
        setLastResultMessage('Resumed your unfinished game.'); setError(null);
      } else {
        setError(err.message || 'Failed to start game');
      }
    } finally { setIsLoading(false); }
  };

  const handleCashout = async () => {
    if (!activeGame || !isGameActive) return;
    setIsLoading(true); setError(null);
    try {
      const res: any = await api.post('/game/cashout', { gameUuid: activeGame.game_uuid });
      const data = res.data;
      setActiveGame({
        ...activeGame, status: 'CASHED_OUT', mine_positions: data.mine_positions,
        current_multiplier: data.final_multiplier || activeGame.current_multiplier,
        current_payout_paise: data.payout_paise, message: data.message,
      });
      setLastResultMessage(data.message || 'Cashed out!');
      if (data.new_balance_paise !== undefined) updateBalance(data.new_balance_paise);
    } catch (err: any) {
      setError(err.message || 'Cashout failed');
    } finally { setIsLoading(false); }
  };

  // Cashout glow intensity scales with multiplier
  const glowSize = Math.min(60, 24 + (multiplier - 1) * 10);
  const cashoutPulseSpeed = Math.max(0.45, 2.4 - (multiplier - 1) * 0.28);

  return (
    <div className="panel flex h-full flex-col justify-between p-5 sm:p-6">
      <div>
        {/* Header */}
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stake-accent/12 text-stake-accent ring-1 ring-stake-accent/20">
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
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-start gap-2 rounded-xl border border-rose-800/50 bg-rose-950/50 p-3 text-sm text-rose-300"
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
              type="number" min={1} step={1} disabled={isGameActive}
              value={betAmountRupees}
              onChange={(e) => setBetAmountRupees(Math.max(1, parseFloat(e.target.value) || 0))}
              className="input-field pr-24"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              {[['1/2', () => setBetAmountRupees(Math.max(1, Math.floor(betAmountRupees / 2)))], ['2x', () => setBetAmountRupees(Number((betAmountRupees * 2).toFixed(2)))]].map(([label, fn]) => (
                <button key={label as string} type="button" disabled={isGameActive}
                  onClick={fn as () => void}
                  className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs font-semibold text-stake-text transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40">
                  {label as string}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[10, 50, 100, 500].map((amt) => (
              <button key={amt} type="button" disabled={isGameActive}
                onClick={() => setBetAmountRupees(amt)}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                  betAmountRupees === amt
                    ? 'border-stake-accent/50 bg-stake-accent/10 text-stake-accent shadow-[0_0_10px_rgba(0,231,1,0.15)]'
                    : 'border-white/[0.05] bg-[#080f18] text-stake-text hover:text-white'
                }`}>
                Rs {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Mines */}
        <div className="mb-4">
          <label className="label-caps mb-2 block">Mines</label>
          <select disabled={isGameActive} value={mineCount}
            onChange={(e) => setMineCount(parseInt(e.target.value, 10))}
            className="input-field appearance-none">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m} {m === 1 ? 'Mine' : 'Mines'} — {25 - m} Gems</option>
            ))}
          </select>
        </div>

        {/* Risk meter — only when not in active game */}
        {!isGameActive && <RiskMeter mineCount={mineCount} />}

        {/* Live stats */}
        <AnimatePresence>
          {isGameActive && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="panel-inset mb-4 overflow-hidden p-0"
            >
              {/* Multiplier row — full-width hero */}
              <div className="relative flex items-center justify-between gap-2 border-b border-white/[0.05] px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="label-caps">Multiplier</span>
                  <MultiplierSparkline history={multiplierHistory.current} />
                </div>
                <motion.span
                  key={activeGame?.current_multiplier}
                  initial={{ scale: 0.7, opacity: 0, y: -6 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                  className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-stake-accent drop-shadow-[0_0_12px_rgba(0,231,1,0.55)]"
                >
                  {activeGame?.current_multiplier}x
                </motion.span>
              </div>

              {/* Payout row */}
              <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
                <span className="label-caps">Payout</span>
                <span className="font-display text-2xl font-extrabold text-stake-gold drop-shadow-[0_0_10px_rgba(245,197,66,0.45)]">
                  Rs <AnimatedNumber value={currentPayoutRupees} />
                </span>
              </div>

              {/* Revealed + Timer row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="label-caps">Revealed</span>
                  <span className="font-display text-base font-bold text-white">
                    {activeGame?.revealed_cells.length}
                    <span className="text-stake-text font-normal"> / {(activeGame?.board_size ?? 25) - (activeGame?.mine_count ?? 0)}</span>
                  </span>
                </div>
                {secondsLeft !== null && (
                  <motion.div
                    animate={secondsLeft <= 15 ? { scale: [1, 1.06, 1] } : {}}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                      secondsLeft <= 15
                        ? 'border-rose-500/40 bg-rose-950/60 text-rose-400'
                        : secondsLeft <= 60
                        ? 'border-amber-500/30 bg-amber-950/40 text-stake-gold'
                        : 'border-white/[0.06] bg-white/[0.03] text-stake-text'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {secondsLeft <= 0 ? 'Expired' : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <AnimatePresence>
          {isGameActive && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ delay: 0.08 }}
              className="mb-4 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="label-caps flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-stake-accent" />
                  Momentum
                </span>
                <motion.span
                  key={revealProgress}
                  initial={{ scale: 1.3, color: '#00e701' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  transition={{ duration: 0.35 }}
                  className="text-xs font-bold text-white"
                >
                  {revealProgress}%
                </motion.span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#00e701_0%,#8df76f_50%,#f5c542_100%)] animate-progress-sheen"
                  initial={{ width: 0 }}
                  animate={{ width: `${revealProgress}%` }}
                  transition={{ type: 'spring', stiffness: 75, damping: 18 }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-stake-text">
                <span className="flex items-center gap-1">
                  <TimerReset className="h-3.5 w-3.5" />
                  {activeGame?.revealed_cells.length} picks
                </span>
                <span>{(activeGame?.board_size ?? 25) - (activeGame?.mine_count ?? 0) - (activeGame?.revealed_cells.length ?? 0)} remaining</span>
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
                `0 0 24px rgba(245,197,66,0.3)`,
                `0 0 ${glowSize}px rgba(245,197,66,0.7)`,
                `0 0 24px rgba(245,197,66,0.3)`,
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
