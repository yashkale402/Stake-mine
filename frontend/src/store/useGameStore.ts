import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveGame {
  game_uuid: string;
  board_size: number;
  total_cells: number;
  mine_count: number;
  bet_amount_paise: number;
  bet_formatted?: string;
  current_multiplier: string;
  status: 'ACTIVE' | 'CASHED_OUT' | 'LOST' | 'EXPIRED';
  revealed_cells: number[];
  mine_positions?: number[];
  expires_at?: string;
  current_payout_paise?: number;
  message?: string;
}

interface GameState {
  activeGame: ActiveGame | null;
  betAmountRupees: number;
  mineCount: number;
  isLoading: boolean;
  error: string | null;
  lastResultMessage: string | null;

  setActiveGame: (game: ActiveGame | null) => void;
  setBetAmountRupees: (amount: number) => void;
  setMineCount: (count: number) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastResultMessage: (message: string | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      activeGame: null,
      betAmountRupees: 10,
      mineCount: 3,
      isLoading: false,
      error: null,
      lastResultMessage: null,

      setActiveGame: (game) =>
        set({
          activeGame: game
            ? { ...game, revealed_cells: Array.isArray(game.revealed_cells) ? game.revealed_cells : [] }
            : null,
        }),
      setBetAmountRupees: (amount) => set({ betAmountRupees: amount }),
      setMineCount: (count) => set({ mineCount: count }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setLastResultMessage: (message) => set({ lastResultMessage: message }),
      resetGame: () => set({ activeGame: null, error: null, lastResultMessage: null }),
    }),
    {
      name: 'stake-game-prefs',
      // Only persist user preferences, not transient state
      partialize: (state) => ({
        betAmountRupees: state.betAmountRupees,
        mineCount: state.mineCount,
      }),
    }
  )
);
