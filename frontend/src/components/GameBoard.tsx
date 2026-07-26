'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { Gem, Bomb, Sparkles } from 'lucide-react';

export default function GameBoard() {
  const {
    activeGame,
    setActiveGame,
    isLoading,
    setIsLoading,
    setError,
    setLastResultMessage,
  } = useGameStore();
  const { updateBalance } = useAuthStore();
  const [boardScope, animateBoard] = useAnimate();

  const boardSize = activeGame?.board_size || 25;
  const revealed = activeGame?.revealed_cells || [];
  const isGameActive = activeGame?.status === 'ACTIVE';
  const isGameOver = activeGame?.status === 'LOST' || activeGame?.status === 'CASHED_OUT';
  const safePicks = revealed.filter(
    (index) => !activeGame?.mine_positions?.includes(index)
  ).length;

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
        // Shake the board
        animateBoard(boardScope.current, {
          x: [0, -10, 10, -8, 8, -4, 4, 0],
        }, { duration: 0.45, ease: 'easeOut' });

        setActiveGame({
          ...activeGame,
          status: 'LOST',
          mine_positions: data.mine_positions,
          revealed_cells: [...revealed, index],
          message: data.message,
        });
        setLastResultMessage(data.message || 'You hit a mine!');
      } else {
        const nextRevealed = [...revealed, index];
        setActiveGame({
          ...activeGame,
          revealed_cells: nextRevealed,
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
          <p className="mt-0.5 text-sm text-white/80">
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
                className="rounded-full border border-stake-accent/30 bg-stake-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-stake-accent"
              >
                Live
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {safePicks > 0 && (
              <motion.div
                key={safePicks}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white"
              >
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-stake-gold" />
                  {safePicks} safe picks
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Board */}
      <div
        ref={boardScope}
        className="board-stage mx-auto max-w-[520px] rounded-[30px] border border-white/6 p-3 sm:p-4"
      >
        <motion.div
          className="mx-auto grid aspect-square w-full max-w-[460px] grid-cols-5 gap-2 sm:gap-2.5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.025 } },
          }}
        >
          {Array.from({ length: boardSize }).map((_, index) => {
            const isRevealed = revealed.includes(index);
            const isMine = activeGame?.mine_positions?.includes(index);

            return (
              <Tile
                key={index}
                index={index}
                isRevealed={isRevealed}
                isMine={!!isMine}
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

// ─── Tile ────────────────────────────────────────────────────────────────────

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

  // Stagger entrance when board mounts
  const entranceVariants = {
    hidden: { opacity: 0, scale: 0.7, rotateX: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      rotateX: 0,
      transition: { type: 'spring' as const, stiffness: 260, damping: 20 },
    },
  };

  if (isRevealed) {
    return (
      <motion.div
        className={`relative flex aspect-square select-none items-center justify-center rounded-xl ${
          isMine
            ? 'border border-rose-500/50 bg-gradient-to-b from-rose-900 to-rose-950'
            : 'border border-emerald-400/40 bg-gradient-to-b from-emerald-900/90 to-emerald-950 shadow-[0_0_18px_rgba(0,231,1,0.22)]'
        }`}
        initial={{ scale: 0.6, rotateY: 90, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      >
        {isMine ? (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Bomb className="h-7 w-7 text-rose-400 sm:h-8 sm:w-8" />
          </motion.div>
        ) : (
          <motion.div
            animate={{ filter: ['drop-shadow(0 0 6px rgba(0,231,1,0.35))', 'drop-shadow(0 0 14px rgba(0,231,1,0.75))', 'drop-shadow(0 0 6px rgba(0,231,1,0.35))'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Gem className="h-7 w-7 text-stake-accent sm:h-8 sm:w-8" />
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (isGameOver && isMine) {
    return (
      <motion.div
        className="relative flex aspect-square select-none items-center justify-center rounded-xl border border-rose-900/40 bg-rose-950/40 opacity-90"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ delay: index * 0.015 }}
      >
        <Bomb className="h-6 w-6 text-rose-400/80 sm:h-7 sm:w-7" />
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      disabled={!canClick}
      onClick={onClick}
      variants={entranceVariants}
      whileHover={canClick ? { y: -2, scale: 1.04, transition: { duration: 0.12 } } : {}}
      whileTap={canClick ? { scale: 0.93 } : {}}
      aria-label={`Tile ${index + 1}`}
      className={`relative flex aspect-square select-none items-center justify-center rounded-xl bg-gradient-to-b from-stake-cardHover to-[#162a38] shadow-tile transition-shadow duration-150 disabled:cursor-not-allowed ${
        !isGameActive ? 'cursor-not-allowed border border-white/5 bg-stake-dark/60 opacity-55' : 'cursor-pointer'
      } ${isLoading ? 'animate-tile-breath' : ''}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/[0.04]" />
      <span className="tile-scan pointer-events-none absolute inset-x-[18%] top-0 h-full rounded-full" />
    </motion.button>
  );
}
