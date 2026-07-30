'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { Bomb, Wallet, LogOut, History, Settings, X, Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { cleanupSocket } from '@/lib/socket';
import { isMuted, setMuted } from '@/lib/useGameAudio';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, initAuth, logout, updateUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const prevBalance = useRef<number | null>(null);

  useEffect(() => {
    setMutedState(isMuted());
    const handler = () => setMutedState(isMuted());
    window.addEventListener('audio_mute_change', handler);
    return () => window.removeEventListener('audio_mute_change', handler);
  }, []);

  const toggleMute = () => setMuted(!muted);

  useEffect(() => { setMounted(true); initAuth(); }, [initAuth]);

  useEffect(() => {
    if (mounted && isAuthenticated && !user) {
      api.get('/auth/me').then((res: any) => updateUser(res.data)).catch(() => logout());
    }
  }, [mounted, isAuthenticated, user, updateUser, logout]);

  // Flash balance when it changes
  useEffect(() => {
    if (!user) return;
    if (prevBalance.current !== null && prevBalance.current !== user.balance_paise) {
      setBalanceFlash(true);
      setTimeout(() => setBalanceFlash(false), 800);
    }
    prevBalance.current = user.balance_paise;
  }, [user?.balance_paise]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(depositAmount);
    if (!rupees || rupees <= 0) return;
    setLoading(true);
    try {
      const res: any = await api.post('/users/deposit', { amountPaise: Math.round(rupees * 100) });
      updateUser({ ...user!, balance_paise: res.data.balance_paise });
      setShowDepositModal(false);
      setDepositAmount('');
    } catch (err: any) {
      alert(err.message || 'Deposit failed');
    } finally { setLoading(false); }
  };

  const isAdmin = user?.role === 'ADMIN';

  const navLink = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = pathname === href;
    return (
      <Link href={href} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
        active ? 'bg-stake-accent/10 text-stake-accent' : 'text-stake-text hover:bg-white/[0.05] hover:text-white'
      }`}>
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#0e1e2d]/85 text-white backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <Link href={isAdmin ? '/admin' : '/'} className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stake-accent/12 text-stake-accent ring-1 ring-stake-accent/20 transition group-hover:bg-stake-accent/22 group-hover:ring-stake-accent/40">
              <Bomb className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight">
              <span className="text-white">STAKE</span>
              <span className="text-stake-accent"> MINE</span>
            </span>
          </Link>

          {!mounted ? (
            <div className="h-9 w-28 animate-pulse rounded-lg bg-white/[0.05]" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {!isAdmin && (
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#080f18]/80 px-2.5 py-1.5">
                  <Wallet className="h-4 w-4 text-stake-gold" />
                  <span className={`font-display text-sm font-bold text-stake-gold transition-all ${balanceFlash ? 'animate-balance-flash' : ''}`}>
                    Rs {(user.balance_paise / 100).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDepositModal(true)}
                    className="rounded-lg bg-stake-accent px-2.5 py-1 text-xs font-bold text-stake-dark transition hover:bg-[#00ff02] hover:shadow-[0_0_12px_rgba(0,231,1,0.4)]"
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
                  type="button" onClick={toggleMute}
                  className="rounded-lg p-2 text-stake-text transition hover:bg-white/[0.05] hover:text-white"
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => { logout(); cleanupSocket(); useGameStore.getState().resetGame(); router.push('/login'); }}
                  className="rounded-lg p-2 text-stake-text transition hover:bg-white/[0.05] hover:text-rose-400"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </nav>
            </div>
          ) : (
            <Link href="/login" className="rounded-xl bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]">
              Log In
            </Link>
          )}
        </div>
      </header>

      {/* Deposit modal */}
      <AnimatePresence>
        {showDepositModal && !isAdmin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="panel w-full max-w-md p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                  <Wallet className="text-stake-gold" /> Quick Deposit
                </h3>
                <button type="button" onClick={() => setShowDepositModal(false)}
                  className="rounded-lg p-1.5 text-stake-text hover:bg-white/[0.05] hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleDeposit}>
                <label className="label-caps mb-2 block">Amount (Rs)</label>
                <input
                  type="number" min="10" max="1000000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="input-field mb-4" required
                />
                <div className="mb-6 grid grid-cols-4 gap-2">
                  {[100, 500, 1000, 5000].map((amt) => (
                    <button key={amt} type="button" onClick={() => setDepositAmount(String(amt))}
                      className="rounded-lg border border-white/[0.05] bg-[#080f18] py-1.5 text-sm text-stake-text transition hover:border-stake-accent/30 hover:text-white">
                      +Rs {amt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowDepositModal(false)}
                    className="flex-1 rounded-xl bg-white/[0.05] py-2.5 font-semibold text-white transition hover:bg-white/[0.1]">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1 !py-2.5">
                    {loading ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
