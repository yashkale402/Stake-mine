'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { Gem, Bomb, Sparkles } from 'lucide-react';

// ─── Particle burst on mine hit ──────────────────────────────────────────────
function ParticleBurst({ x, y }: { x: number; y: number }) {
  const particles = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * 360;
    const dist = 28 + Math.random() * 22;
    const dx = Math.cos((angle * Math.PI) / 180) * dist;
    const dy = Math.sin((angle * Math.PI) / 180) * dist;
    const colors = ['#ff4d6d', '#ff8fa3', '#ffb3c1', '#f5c542'];
    return { dx, dy, color: colors[i % colors.length], delay: i * 0.03 };
  });

  return (
    <>
      {particles.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: x,
            top: y,
            width: 6 + Math.random() * 4,
            height: 6 + Math.random() * 4,
            background: p.color,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

// ─── Safe gem sparkle ────────────────────────────────────────────────────────
function GemSparkle({ x, y }: { x: number; y: number }) {
  return (
    <>
      {[...Array(5)].map((_, i) => {
        const angle = (i / 5) * 360;
        const dist = 18 + Math.random() * 12;
        return (
          <span
            key={i}
            className="particle"
            style={{
              left: x,
              top: y,
              width: 4,
              height: 4,
              background: i % 2 === 0 ? '#00e701' : '#f5c542',
              '--dx': `${Math.cos((angle * Math.PI) / 180) * dist}px`,
              '--dy': `${Math.sin((angle * Math.PI) / 180) * dist}px`,
              animationDelay: `${i * 0.04}s`,
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}

export default function GameBoard() {
  const { activeGame, setActiveGame, isLoading, setIsLoading, setError, setLastResultMessage } = useGameStore();
  const { updateBalance } = useAuthStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const [shaking, setShaking] = useState(false);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; type: 'mine' | 'gem' }>>([]);
  const burstId = useRef(0);

  const boardSize = activeGame?.board_size || 25;
  const revealed = activeGame?.revealed_cells || [];
  const isGameActive = activeGame?.status === 'ACTIVE';
  const isGameOver = activeGame?.status === 'LOST' || activeGame?.status === 'CASHED_OUT';
  const safePicks = revealed.filter((i) => !activeGame?.mine_positions?.includes(i)).length;

  const spawnBurst = useCallback((tileIndex: number, type: 'mine' | 'gem') => {
    if (!boardRef.current) return;
    const board = boardRef.current;
    const tiles = board.querySelectorAll('[data-tile]');
    const tile = tiles[tileIndex] as HTMLElement;
    if (!tile) return;
    const br = board.getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    const x = tr.left - br.left + tr.width / 2;
    const y = tr.top - br.top + tr.height / 2;
    const id = ++burstId.current;
    setBursts((prev) => [...prev, { id, x, y, type }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 800);
  }, []);

  const handleTileClick = async (index: number) => {
    if (!activeGame || !isGameActive || isLoading) return;
    if (revealed.includes(index)) return;

    setIsLoading(true);
    setError(null);

    try {
      const res: any = await api.post('/game/reveal', {
        gameUuid: activeGame.game_uuid,
        cellIndex: index,
      });
      const data = res.data;

      if (data.result === 'mine') {
        spawnBurst(index, 'mine');
        setShaking(true);
        setTimeout(() => setShaking(false), 520);
        setActiveGame({
          ...activeGame,
          status: 'LOST',
          mine_positions: data.mine_positions,
          revealed_cells: [...revealed, index],
          message: data.message,
        });
        setLastResultMessage(data.message || 'You hit a mine!');
      } else {
        spawnBurst(index, 'gem');
        setActiveGame({
          ...activeGame,
          revealed_cells: [...revealed, index],
          current_multiplier: data.current_multiplier,
          current_payout_paise: data.current_payout_paise,
          status: data.status || 'ACTIVE',
          mine_positions: data.mine_positions || activeGame.mine_positions,
          message: data.message,
        });
        setLastResultMessage(data.message || null);
        if (data.new_balance_paise !== undefined) updateBalance(data.new_balance_paise);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reveal tile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel board-glow p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="label-caps">Minefield</p>
          <p className="mt-0.5 text-sm text-white/75">
            {activeGame
              ? `${activeGame.mine_count} mines · ${boardSize - activeGame.mine_count} gems`
              : 'Place a bet to unlock the board'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {activeGame?.status === 'ACTIVE' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 rounded-full border border-stake-accent/30 bg-stake-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-stake-accent"
              >
                <span className="animate-live-dot h-1.5 w-1.5 rounded-full bg-stake-accent" />
                Live
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {safePicks > 0 && (
              <motion.div
                key={safePicks}
                initial={{ opacity: 0, y: -6, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white"
              >
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-stake-gold" />
                  {safePicks} safe
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className={`board-stage relative mx-auto max-w-[520px] rounded-[28px] border border-white/[0.05] p-3 sm:p-4 ${shaking ? 'animate-board-shake' : ''}`}
      >
        {/* Particle layer */}
        {bursts.map((b) =>
          b.type === 'mine'
            ? <ParticleBurst key={b.id} x={b.x} y={b.y} />
            : <GemSparkle key={b.id} x={b.x} y={b.y} />
        )}

        <motion.div
          className="mx-auto grid aspect-square w-full max-w-[460px] grid-cols-5 gap-2 sm:gap-2.5"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.022 } } }}
        >
          {Array.from({ length: boardSize }).map((_, index) => {
            const isRevealed = revealed.includes(index);
            const isMine = !!activeGame?.mine_positions?.includes(index);
            return (
              <Tile
                key={index}
                index={index}
                isRevealed={isRevealed}
                isMine={isMine}
                isGameActive={isGameActive}
                isGameOver={isGameOver}
                isLoading={isLoading}
                onClick={() => handleTileClick(index)}
              />
            );
          })}
        </motion.div>
      </div>

      {!activeGame && (
        <p className="mt-5 text-center text-sm text-stake-text">
          Configure your bet on the left, then hit{' '}
          <span className="font-semibold text-stake-accent">Bet & Play</span>
        </p>
      )}
    </div>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────
interface TileProps {
  index: number;
  isRevealed: boolean;
  isMine: boolean;
  isGameActive: boolean;
  isGameOver: boolean;
  isLoading: boolean;
  onClick: () => void;
}

function Tile({ index, isRevealed, isMine, isGameActive, isGameOver, isLoading, onClick }: TileProps) {
  const canClick = isGameActive && !isRevealed && !isLoading;

  const entranceVariants = {
    hidden: { opacity: 0, scale: 0.65, rotateX: 22 },
    visible: {
      opacity: 1, scale: 1, rotateX: 0,
      transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
    },
  };

  // Revealed tile — 3D flip via CSS class
  if (isRevealed) {
    return (
      <motion.div
        data-tile={index}
        variants={entranceVariants}
        className="tile-wrapper aspect-square"
      >
        <div className="tile-inner flipped w-full h-full">
          {/* Front (unrevealed face — hidden after flip) */}
          <div className="tile-face tile-front border border-white/[0.07] bg-gradient-to-b from-[#152840] to-[#0d1e2e]" />
          {/* Back (revealed face) */}
          <div
            className={`tile-face tile-back ${
              isMine
                ? 'border border-rose-500/50 bg-gradient-to-b from-[#2e0a14] to-[#1a0609] shadow-[0_0_18px_rgba(255,77,109,0.3)]'
                : 'border border-emerald-400/35 bg-gradient-to-b from-[#0a2e1a] to-[#061a10] shadow-[0_0_20px_rgba(0,231,1,0.25)]'
            }`}
          >
            {isMine ? (
              <Bomb className="animate-bomb-shake h-7 w-7 text-rose-400 sm:h-8 sm:w-8" />
            ) : (
              <Gem className="animate-gem-pulse h-7 w-7 text-stake-accent sm:h-8 sm:w-8" />
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Game over — show unrevealed mines dimly
  if (isGameOver && isMine) {
    return (
      <motion.div
        data-tile={index}
        className="flex aspect-square select-none items-center justify-center rounded-xl border border-rose-900/30 bg-rose-950/30 opacity-75"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        transition={{ delay: index * 0.012 }}
      >
        <Bomb className="h-5 w-5 text-rose-500/70 sm:h-6 sm:w-6" />
      </motion.div>
    );
  }

  // Unrevealed / interactive
  return (
    <motion.button
      data-tile={index}
      type="button"
      disabled={!canClick}
      onClick={onClick}
      variants={entranceVariants}
      whileHover={canClick ? { y: -3, scale: 1.05, transition: { duration: 0.1 } } : {}}
      whileTap={canClick ? { scale: 0.91 } : {}}
      aria-label={`Tile ${index + 1}`}
      className={`relative flex aspect-square select-none items-center justify-center rounded-xl
        bg-gradient-to-b from-[#152840] to-[#0d1e2e]
        border border-white/[0.06]
        shadow-[inset_0_-3px_0_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]
        transition-shadow duration-150
        ${canClick ? 'cursor-pointer hover:border-white/[0.12] hover:shadow-[inset_0_-3px_0_rgba(0,0,0,0.4),0_0_12px_rgba(0,231,1,0.08)]' : 'cursor-not-allowed opacity-50'}
        ${isLoading ? 'animate-tile-breath' : ''}
      `}
    >
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/[0.035]" />
      {canClick && <span className="tile-scan pointer-events-none absolute inset-x-[20%] top-0 h-full rounded-full" />}
    </motion.button>
  );
}
