'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { Bomb, Wallet, LogOut, History, Settings, X, Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { isMuted, setMuted } from '@/lib/useGameAudio';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, initAuth, logout, updateUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
    const handler = () => setMutedState(isMuted());
    window.addEventListener('audio_mute_change', handler);
    return () => window.removeEventListener('audio_mute_change', handler);
  }, []);

  const toggleMute = () => setMuted(!muted);

  useEffect(() => {
    setMounted(true);
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (mounted && isAuthenticated && !user) {
      api
        .get('/auth/me')
        .then((res: any) => {
          updateUser(res.data);
        })
        .catch(() => {
          logout();
        });
    }
  }, [mounted, isAuthenticated, user, updateUser, logout]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(depositAmount);
    if (!rupees || rupees <= 0) return;

    setLoading(true);
    try {
      const amountPaise = Math.round(rupees * 100);
      const res: any = await api.post('/users/deposit', { amountPaise });
      updateUser({
        ...user!,
        balance_paise: res.data.balance_paise,
      });
      setShowDepositModal(false);
      setDepositAmount('');
    } catch (err: any) {
      alert(err.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  const navLink = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
          active
            ? 'bg-stake-accent/10 text-stake-accent'
            : 'text-stake-text hover:bg-stake-cardHover hover:text-white'
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-stake-card/80 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href={isAdmin ? '/admin' : '/'} className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stake-accent/15 text-stake-accent transition group-hover:bg-stake-accent/25">
              <Bomb className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight">
              <span className="text-white">STAKE</span>
              <span className="text-stake-accent"> MINE</span>
            </span>
          </Link>

          {!mounted ? (
            <div className="h-9 w-28 animate-pulse rounded-lg bg-white/5" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {!isAdmin && (
                <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-stake-dark/80 px-2.5 py-1.5">
                  <Wallet className="h-4 w-4 text-stake-gold" />
                  <span className="font-display text-sm font-bold text-stake-gold">
                    Rs {(user.balance_paise / 100).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDepositModal(true)}
                    className="rounded-lg bg-stake-accent px-2.5 py-1 text-xs font-bold text-stake-dark transition hover:bg-stake-accentHover"
                  >
                    Deposit
                  </button>
                </div>
              )}

              {isAdmin && (
                <div className="rounded-xl border border-stake-gold/20 bg-stake-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-stake-gold">
                  Admin Mode
                </div>
              )}

              <nav className="flex items-center gap-1">
                {!isAdmin && navLink('/history', 'History', History)}
                {isAdmin && navLink('/admin', 'Admin', Settings)}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="rounded-lg p-2 text-stake-text transition hover:bg-stake-cardHover hover:text-white"
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    useGameStore.getState().resetGame();
                    router.push('/login');
                  }}
                  className="rounded-lg p-2 text-stake-text transition hover:bg-stake-cardHover hover:text-stake-danger"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </nav>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-stake-cardHover px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#274556]"
            >
              Log In
            </Link>
          )}
        </div>
      </header>

      {showDepositModal && !isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-6 animate-float-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                <Wallet className="text-stake-gold" /> Quick Deposit
              </h3>
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                className="rounded-lg p-1.5 text-stake-text hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleDeposit}>
              <label className="label-caps mb-2 block">Amount (Rs)</label>
              <input
                type="number"
                min="10"
                max="1000000"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="e.g. 500"
                className="input-field mb-4"
                required
              />
              <div className="mb-6 grid grid-cols-4 gap-2">
                {[100, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(String(amt))}
                    className="rounded-lg border border-white/5 bg-stake-dark py-1.5 text-sm text-stake-text transition hover:border-stake-accent/40 hover:text-white"
                  >
                    +Rs {amt}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 rounded-xl bg-white/5 py-2.5 font-semibold text-white transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 !py-2.5">
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
