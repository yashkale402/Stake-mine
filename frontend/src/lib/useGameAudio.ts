'use client';

import { useEffect, useRef } from 'react';

interface Args {
  activeGame: { status?: string; revealed_cells?: number[] } | null;
  isLoading: boolean;
}

// ─── Global mute ─────────────────────────────────────────────────────────────
export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('audio_muted') === 'true';
}
export function setMuted(value: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('audio_muted', String(value));
  window.dispatchEvent(new Event('audio_mute_change'));
}

// ─── Shared AudioContext (one per page, avoids suspended-state failures) ─────
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) _ctx = new AC();
  return _ctx;
}

// Resume the context (required after any user gesture on Chrome/Safari)
async function resumeCtx(): Promise<AudioContext | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

// Unlock AudioContext on first user interaction so subsequent sounds play instantly
if (typeof window !== 'undefined') {
  const unlock = () => {
    resumeCtx();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

// ─── Tone player ─────────────────────────────────────────────────────────────
async function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  gainValue: number
) {
  if (isMuted()) return;
  const ctx = await resumeCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.stop(ctx.currentTime + duration);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGameAudio({ activeGame, isLoading }: Args) {
  const lastStatusRef = useRef<string | undefined>(activeGame?.status);
  const lastRevealCountRef = useRef<number>(activeGame?.revealed_cells?.length || 0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentRevealCount = activeGame?.revealed_cells?.length || 0;
    const previousRevealCount = lastRevealCountRef.current;

    // Gem reveal sound
    if (currentRevealCount > previousRevealCount && activeGame?.status === 'ACTIVE') {
      void playTone(740, 0.06, 'triangle', 0.06);
    }

    const previousStatus = lastStatusRef.current;
    const nextStatus = activeGame?.status;

    if (previousStatus !== nextStatus) {
      if (nextStatus === 'LOST') {
        void playTone(180, 0.18, 'sawtooth', 0.1);
      } else if (nextStatus === 'CASHED_OUT') {
        void playTone(520, 0.08, 'triangle', 0.08);
        window.setTimeout(() => void playTone(780, 0.12, 'triangle', 0.1), 90);
      }
    }

    if (isLoading && nextStatus === 'ACTIVE') {
      void playTone(340, 0.03, 'sine', 0.04);
    }

    lastRevealCountRef.current = currentRevealCount;
    lastStatusRef.current = nextStatus;
  }, [activeGame, isLoading]);
}
