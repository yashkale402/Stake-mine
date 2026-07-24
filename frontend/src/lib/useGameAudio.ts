'use client';

import { useEffect, useRef } from 'react';

interface Args {
  activeGame: {
    status?: string;
    revealed_cells?: number[];
  } | null;
  isLoading: boolean;
}

export function useGameAudio({ activeGame, isLoading }: Args) {
  const lastStatusRef = useRef<string | undefined>(activeGame?.status);
  const lastRevealCountRef = useRef<number>(activeGame?.revealed_cells?.length || 0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentRevealCount = activeGame?.revealed_cells?.length || 0;
    const previousRevealCount = lastRevealCountRef.current;

    if (currentRevealCount > previousRevealCount && activeGame?.status === 'ACTIVE') {
      playTone(740, 0.06, 'triangle', 0.025);
    }

    const previousStatus = lastStatusRef.current;
    const nextStatus = activeGame?.status;

    if (previousStatus !== nextStatus) {
      if (nextStatus === 'LOST') {
        playTone(180, 0.18, 'sawtooth', 0.04);
      } else if (nextStatus === 'CASHED_OUT') {
        playTone(520, 0.08, 'triangle', 0.03);
        window.setTimeout(() => playTone(780, 0.12, 'triangle', 0.03), 90);
      }
    }

    if (isLoading && nextStatus === 'ACTIVE') {
      playTone(340, 0.03, 'sine', 0.01);
    }

    lastRevealCountRef.current = currentRevealCount;
    lastStatusRef.current = nextStatus;
  }, [activeGame, isLoading]);
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  gainValue: number
) {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.stop(ctx.currentTime + duration);

  window.setTimeout(() => {
    void ctx.close().catch(() => {});
  }, Math.max(200, duration * 1000 + 50));
}
