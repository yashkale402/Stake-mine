'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { Bomb, Lock, Mail, Shield, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Floating ambient particle
function AmbientParticle({ x, y, size, delay, color }: {
  x: string; y: string; size: number; delay: number; color: string;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: 'blur(1px)' }}
      animate={{ y: [0, -18, 0], opacity: [0.15, 0.45, 0.15], scale: [1, 1.15, 1] }}
      transition={{ duration: 4 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

const PARTICLES = [
  { x: '12%', y: '20%', size: 6, delay: 0, color: 'rgba(0,231,1,0.7)' },
  { x: '80%', y: '15%', size: 4, delay: 1.2, color: 'rgba(245,197,66,0.7)' },
  { x: '65%', y: '70%', size: 5, delay: 0.6, color: 'rgba(0,231,1,0.5)' },
  { x: '25%', y: '75%', size: 3, delay: 2, color: 'rgba(245,197,66,0.5)' },
  { x: '90%', y: '50%', size: 4, delay: 1.5, color: 'rgba(0,231,1,0.4)' },
  { x: '5%',  y: '55%', size: 5, delay: 0.3, color: 'rgba(245,197,66,0.4)' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, isHydrated, initAuth, user } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [loginMode, setLoginMode] = useState<'PLAYER' | 'ADMIN'>('PLAYER');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { initAuth(); }, [initAuth]);
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    router.replace(user?.role === 'ADMIN' ? '/admin' : '/');
  }, [isHydrated, isAuthenticated, router, user]);
  useEffect(() => {
    if (loginMode === 'ADMIN') { setIsRegister(false); setEmail('admin@stake.mine'); setPassword(''); return; }
    if (!isRegister) { setEmail(''); setPassword(''); }
  }, [isRegister, loginMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? { username, email, password } : { email, password };
      const res: any = await api.post(endpoint, payload);
      setAuth(res.data.user, res.data.token);
      router.push(res.data.user?.role === 'ADMIN' ? '/admin' : '/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center py-8">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full bg-stake-accent/[0.08] blur-3xl" />
        <div className="absolute bottom-8 right-8 h-56 w-56 rounded-full bg-stake-gold/[0.08] blur-3xl" />
        <div className="absolute left-6 top-1/3 h-28 w-28 rounded-full bg-cyan-400/[0.07] blur-2xl animate-orbit-slow" />
        {PARTICLES.map((p, i) => <AmbientParticle key={i} {...p} />)}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="panel relative w-full max-w-md p-8"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-stake-accent/20 bg-stake-accent/10"
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <Bomb className="h-8 w-8 text-stake-accent" />
          </motion.div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            STAKE <span className="text-stake-accent">MINE</span>
          </h1>
          <p className="mt-2 text-sm text-stake-text">
            {loginMode === 'ADMIN' ? 'Secure operations access'
              : isRegister ? 'Create your player account'
              : 'Welcome back — ready to play?'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.05] bg-[#080f18]/80 p-1.5">
          {(['PLAYER', 'ADMIN'] as const).map((mode) => (
            <motion.button
              key={mode}
              type="button"
              onClick={() => setLoginMode(mode)}
              whileTap={{ scale: 0.96 }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                loginMode === mode
                  ? mode === 'PLAYER' ? 'bg-stake-accent text-stake-dark shadow-[0_0_16px_rgba(0,231,1,0.3)]'
                    : 'bg-stake-gold text-stake-dark shadow-[0_0_16px_rgba(245,197,66,0.3)]'
                  : 'text-stake-text hover:text-white'
              }`}
            >
              {mode === 'PLAYER' ? 'Player Panel' : 'Admin Panel'}
            </motion.button>
          ))}
        </div>

        {loginMode === 'ADMIN' && (
          <div className="mb-5 rounded-xl border border-stake-gold/20 bg-stake-gold/[0.08] p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 font-semibold text-stake-gold">
              <Shield className="h-4 w-4" /> Admin access
            </div>
            <p className="text-stake-text">Enter your admin credentials below.</p>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-5 rounded-xl border border-rose-800/50 bg-rose-950/50 p-3 text-center text-sm text-rose-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && loginMode === 'PLAYER' && (
            <div>
              <label className="label-caps mb-1.5 block">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3.5 h-5 w-5 text-stake-text" />
                <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="Yash" className="input-field pl-10" />
              </div>
            </div>
          )}
          <div>
            <label className="label-caps mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-stake-text" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="yash@example.com" className="input-field pl-10" />
            </div>
          </div>
          <div>
            <label className="label-caps mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-stake-text" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="input-field pl-10" />
            </div>
          </div>

          <motion.button
            type="submit" disabled={loading}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="btn-primary mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-stake-dark border-t-transparent" />
                Processing...
              </span>
            ) : loginMode === 'ADMIN' ? 'Log In To Admin'
              : isRegister ? 'Create Account'
              : 'Log In & Play'}
          </motion.button>
        </form>

        {loginMode === 'PLAYER' && (
          <div className="mt-6 text-center text-sm text-stake-text">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); }}
              className="ml-1 font-bold text-stake-accent hover:underline">
              {isRegister ? 'Log In' : 'Register'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
