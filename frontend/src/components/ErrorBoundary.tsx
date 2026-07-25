'use client';

import React from 'react';

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'Something went wrong' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <p className="font-display text-xl font-bold text-rose-400">Something went wrong</p>
          <p className="text-sm text-stake-text">{this.state.message}</p>
          <button
            className="rounded-xl bg-stake-accent px-5 py-2.5 text-sm font-bold text-stake-dark"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
