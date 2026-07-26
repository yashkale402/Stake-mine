'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { History as HistoryIcon, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

interface HistoryRecord {
  game_uuid: string;
  bet_amount_paise: number;
  bet_formatted: string;
  payout_paise: number;
  payout_formatted: string;
  profit_loss_paise: number;
  mine_count: number;
  cells_revealed: number;
  final_multiplier: string;
  outcome: 'WIN' | 'LOSS' | 'CASHOUT';
  played_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 20;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, isHydrated, isAuthenticated, router]);

  const fetchHistory = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.get(`/game/history?limit=${LIMIT}&page=${p}`);
      setHistory(res.data?.games || []);
      setTotalPages(res.data?.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (mounted && isHydrated && isAuthenticated) {
      fetchHistory(page);
    }
  }, [mounted, isHydrated, isAuthenticated, page, fetchHistory]);

  if (!mounted || !isHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-stake-text">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stake-accent border-t-transparent" />
          Loading history…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-5xl animate-float-in py-2">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="label-caps mb-1 text-stake-accent">Records</p>
          <h1 className="font-display text-2xl font-extrabold text-white">Game History</h1>
        </div>
        <button
          type="button"
          onClick={() => fetchHistory(page)}
          className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-stake-card px-3 py-2 text-sm text-stake-text transition hover:text-white"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="panel p-10 text-center text-stake-text">Loading history…</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-800/60 bg-rose-950/50 p-4 text-center text-rose-300">
          {error}
        </div>
      ) : history.length === 0 ? (
        <div className="panel p-12 text-center text-stake-text">
          No games yet. Head to the board and place your first bet.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/5 bg-stake-dark/60 text-[11px] uppercase tracking-wider text-stake-text">
                  <th className="p-4">Game</th>
                  <th className="p-4">Bet</th>
                  <th className="p-4">Mines</th>
                  <th className="p-4">Revealed</th>
                  <th className="p-4">Multiplier</th>
                  <th className="p-4">Payout</th>
                  <th className="p-4">Outcome</th>
                  <th className="p-4">Played</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-medium">
                {history.map((item) => {
                  const isProfit = item.profit_loss_paise > 0;
                  return (
                    <tr key={item.game_uuid} className="transition hover:bg-white/[0.02]">
                      <td className="p-4 font-mono text-xs text-gray-400">
                        {item.game_uuid.substring(0, 8)}…
                      </td>
                      <td className="p-4 font-bold text-white">{item.bet_formatted}</td>
                      <td className="p-4 text-stake-text">{item.mine_count}</td>
                      <td className="p-4 text-stake-text">{item.cells_revealed}</td>
                      <td className="p-4 font-bold text-stake-gold">{item.final_multiplier}x</td>
                      <td className="p-4 font-bold">
                        <span
                          className={`flex items-center gap-1 ${
                            isProfit ? 'text-stake-accent' : 'text-rose-400'
                          }`}
                        >
                          {isProfit ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                          {item.payout_formatted}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                            item.outcome === 'CASHOUT' || item.outcome === 'WIN'
                              ? 'border border-emerald-800 bg-emerald-950 text-stake-accent'
                              : 'border border-rose-800 bg-rose-950 text-rose-300'
                          }`}
                        >
                          {item.outcome}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-400">
                        {new Date(item.played_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
              <span className="text-xs text-stake-text">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-lg border border-white/5 bg-stake-dark px-3 py-1.5 text-xs font-semibold text-stake-text transition hover:text-white disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border border-white/5 bg-stake-dark px-3 py-1.5 text-xs font-semibold text-stake-text transition hover:text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
