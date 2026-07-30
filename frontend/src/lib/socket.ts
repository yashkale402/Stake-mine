import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/useGameStore';

let socket: Socket | null = null;
let reconnectAttempts = 0;
let pollingIntervalId: number | null = null;
let isConnected = false;

const BACKOFF_BASE_MS = 500;
const MAX_BACKOFF_MS = 10_000;
const POLLING_INTERVAL_MS = 5000;

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function startPolling() {
  stopPolling();
  void fetchActiveGame();
  pollingIntervalId = window.setInterval(() => {
    if (!isConnected) {
      void fetchActiveGame();
    }
  }, POLLING_INTERVAL_MS);
}

function stopPolling() {
  if (pollingIntervalId !== null) {
    window.clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
}

async function fetchActiveGame() {
  try {
    const token = getToken();
    if (!token) return;
    const response = await fetch('/api/v1/game/active', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return;
    const result = await response.json();
    const game = result?.data;
    if (game && game.status === 'ACTIVE') {
      useGameStore.getState().setActiveGame({
        game_uuid: game.game_uuid,
        board_size: game.board_size,
        total_cells: game.board_size,
        mine_count: game.mine_count,
        bet_amount_paise: game.bet_amount_paise,
        current_multiplier: String(game.current_multiplier ?? '1.0000'),
        status: 'ACTIVE',
        revealed_cells: game.revealed_cells || [],
        expires_at: game.expires_at,
      });
    }
  } catch {
    // Ignore polling failures; keep retrying.
  }
}

function connectSocket() {
  if (typeof window === 'undefined') return;
  if (socket && socket.connected) return;

  const token = getToken();
  if (!token) {
    return;
  }

  socket = io({
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelayMax: MAX_BACKOFF_MS,
    autoConnect: true,
  });

  socket.on('connect', () => {
    reconnectAttempts = 0;
    isConnected = true;
    stopPolling();
  });

  socket.on('disconnect', () => {
    isConnected = false;
    startPolling();
  });

  socket.on('connect_error', () => {
    reconnectAttempts += 1;
    isConnected = false;
    startPolling();
  });

  socket.on('reconnect_failed', () => {
    isConnected = false;
    startPolling();
  });

  socket.on('game:update', (game) => {
    if (!game || !game.game_uuid) return;
    const currentGame = useGameStore.getState().activeGame;
    if (currentGame && currentGame.game_uuid === game.game_uuid && currentGame.status === game.status) {
      // Avoid duplicate updates for same state
      return;
    }
    useGameStore.getState().setActiveGame(game);
  });
}

function disconnectSocket() {
  if (socket) {
    socket.off('connect');
    socket.off('disconnect');
    socket.off('connect_error');
    socket.off('reconnect_failed');
    socket.off('game:update');
    socket.disconnect();
    socket = null;
  }
  isConnected = false;
  stopPolling();
}

export function initSocket() {
  connectSocket();
}

export function cleanupSocket() {
  disconnectSocket();
}

export function ensureSocketConnected() {
  if (!socket || !socket.connected) {
    connectSocket();
  }
}

export function resetSocket() {
  disconnectSocket();
  connectSocket();
}
