'use client';

import React from 'react';
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

  const boardSize = activeGame?.board_size || 25;
  const revealed = activeGame?.revealed_cells || [];
  const isGameActive = activeGame?.status === 'ACTIVE';
  const isGameOver =
    activeGame?.status === 'LOST' || activeGame?.status === 'CASHED_OUT';
  const safePicks = revealed.filter((index) => !activeGame?.mine_positions?.includes(index)).length;

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

        if (data.new_balance_paise !== undefined) {
          updateBalance(data.new_balance_paise);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reveal tile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel board-glow p-4 sm:p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="label-caps">Minefield</p>
          <p className="mt-0.5 text-sm text-white/80">
            {activeGame
              ? `${activeGame.mine_count} mines - ${boardSize - activeGame.mine_count} gems`
              : 'Place a bet to unlock the board'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeGame?.status === 'ACTIVE' && (
            <div className="rounded-full border border-stake-accent/30 bg-stake-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-stake-accent">
              Live
            </div>
          )}
          {safePicks > 0 && (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-stake-gold" />
                {safePicks} safe picks
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="board-stage mx-auto max-w-[520px] rounded-[30px] border border-white/6 p-3 sm:p-4">
        <div className="mx-auto grid aspect-square w-full max-w-[460px] grid-cols-5 gap-2 sm:gap-2.5">
          {Array.from({ length: boardSize }).map((_, index) => {
            const isRevealed = revealed.includes(index);
            const isMinePosition = activeGame?.mine_positions?.includes(index);
            const delay = `${(index % 5) * 30 + Math.floor(index / 5) * 20}ms`;

            let cellContent: React.ReactNode = null;
            let cellStyle =
              'bg-gradient-to-b from-stake-cardHover to-[#162a38] shadow-tile hover:-translate-y-0.5 hover:shadow-tile-hover hover:brightness-110 active:translate-y-0 active:shadow-none animate-tile-idle cursor-pointer';
            let animClass = '';

            if (isRevealed) {
              if (isMinePosition) {
                cellStyle =
                  'border border-rose-500/50 bg-gradient-to-b from-rose-900 to-rose-950';
                cellContent = (
                  <Bomb className="h-7 w-7 animate-bomb-pulse text-rose-400 sm:h-8 sm:w-8" />
                );
                animClass = 'animate-reveal-mine';
              } else {
                cellStyle =
                  'border border-emerald-400/40 bg-gradient-to-b from-emerald-900/90 to-emerald-950 shadow-[0_0_18px_rgba(0,231,1,0.22)]';
                cellContent = (
                  <Gem className="h-7 w-7 animate-gem-shine text-stake-accent sm:h-8 sm:w-8" />
                );
                animClass = 'animate-reveal-safe';
              }
            } else if (isGameOver && isMinePosition) {
              cellStyle = 'border border-rose-900/40 bg-rose-950/40 opacity-90';
              cellContent = <Bomb className="h-6 w-6 text-rose-400/80 sm:h-7 sm:w-7" />;
            } else if (!isGameActive) {
              cellStyle =
                'cursor-not-allowed border border-white/5 bg-stake-dark/60 opacity-55';
            }

            return (
              <button
                key={index}
                type="button"
                disabled={!isGameActive || isRevealed || isLoading}
                onClick={() => handleTileClick(index)}
                style={{ animationDelay: !activeGame ? delay : undefined }}
                aria-label={`Tile ${index + 1}`}
                className={`relative flex aspect-square select-none items-center justify-center rounded-xl transition-all duration-150 ${cellStyle} ${animClass} ${isLoading ? 'animate-tile-breath' : ''} disabled:cursor-not-allowed`}
              >
                {cellContent}
                {!isRevealed && isGameActive && (
                  <>
                    <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/[0.04]" />
                    <span className="tile-scan pointer-events-none absolute inset-x-[18%] top-0 h-full rounded-full" />
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!activeGame && (
        <p className="mt-5 text-center text-sm text-stake-text">
          Configure your bet on the left, then hit <span className="font-semibold text-stake-accent">Bet & Play</span>
        </p>
      )}
    </div>
  );
}
