'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { Bomb, Lock, Mail, Shield, User as UserIcon } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, isHydrated, initAuth } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [loginMode, setLoginMode] = useState<'PLAYER' | 'ADMIN'>('PLAYER');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('yash@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace('/');
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (loginMode === 'ADMIN') {
      setIsRegister(false);
      setEmail('admin@stake.mine');
      setPassword('password123');
      return;
    }

    if (!isRegister) {
      setEmail('yash@example.com');
      setPassword('password123');
    }
  }, [isRegister, loginMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? { username, email, password } : { email, password };

      const res: any = await api.post(endpoint, payload);
      setAuth(res.data.user, res.data.token);
      router.push(res.data.user?.role === 'ADMIN' ? '/admin' : '/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 rounded-full bg-stake-accent/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-stake-gold/10 blur-3xl" />
        <div className="absolute left-8 top-1/3 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl animate-orbit-slow" />
      </div>

      <div className="panel relative w-full max-w-md p-8 animate-float-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-stake-accent/20 bg-stake-accent/10">
            <Bomb className="h-8 w-8 text-stake-accent" />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            STAKE <span className="text-stake-accent">MINE</span>
          </h1>
          <p className="mt-2 text-sm text-stake-text">
            {loginMode === 'ADMIN'
              ? 'Secure access for operations and game controls.'
              : isRegister
                ? 'Create your player account'
                : 'Welcome back - ready to play?'}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-stake-dark/70 p-1.5">
          <button
            type="button"
            onClick={() => setLoginMode('PLAYER')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              loginMode === 'PLAYER'
                ? 'bg-stake-accent text-stake-dark'
                : 'text-stake-text hover:text-white'
            }`}
          >
            Player Panel
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('ADMIN')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              loginMode === 'ADMIN'
                ? 'bg-stake-gold text-stake-dark'
                : 'text-stake-text hover:text-white'
            }`}
          >
            Admin Panel
          </button>
        </div>

        {loginMode === 'ADMIN' && (
          <div className="mb-5 rounded-2xl border border-stake-gold/20 bg-stake-gold/10 p-3 text-sm text-stake-bright">
            <div className="mb-1 flex items-center gap-2 font-semibold text-stake-gold">
              <Shield className="h-4 w-4" />
              Admin demo access
            </div>
            <p className="text-stake-text">
              ID: <span className="font-semibold text-white">admin@stake.mine</span>
            </p>
            <p className="text-stake-text">
              Password: <span className="font-semibold text-white">password123</span>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-rose-800/60 bg-rose-950/50 p-3 text-center text-sm text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && loginMode === 'PLAYER' && (
            <div>
              <label className="label-caps mb-1.5 block">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Yash"
                  className="input-field pl-10"
                />
              </div>
            </div>
          )}

          <div>
            <label className="label-caps mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yash@example.com"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="label-caps mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="........"
                className="input-field pl-10"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading
              ? 'Processing...'
              : loginMode === 'ADMIN'
                ? 'Log In To Admin'
                : isRegister
                  ? 'Create Account'
                  : 'Log In & Play'}
          </button>
        </form>

        {loginMode === 'PLAYER' && (
          <div className="mt-6 text-center text-sm text-stake-text">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="ml-1 font-bold text-stake-accent hover:underline"
            >
              {isRegister ? 'Log In' : 'Register'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
