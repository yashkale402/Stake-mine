import { create } from 'zustand';
import api from '@/lib/api';

export interface User {
  id: number;
  username: string;
  email: string;
  balance_paise: number;
  role: 'PLAYER' | 'ADMIN';
  status: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  initAuth: () => Promise<void>;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  updateBalance: (balancePaise: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,

  initAuth: async () => {
    if (typeof window === 'undefined') {
      set({ isHydrated: true });
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      set({ token: null, isAuthenticated: false, isHydrated: true });
      return;
    }
    // Token exists — fetch the user object immediately so user is never null after refresh
    try {
      const res: any = await api.get('/auth/me');
      set({ token, user: res.data, isAuthenticated: true, isHydrated: true });
    } catch {
      // Token invalid/expired — clear it
      localStorage.removeItem('token');
      set({ token: null, user: null, isAuthenticated: false, isHydrated: true });
    }
  },

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
    set({ user, token, isAuthenticated: true, isHydrated: true });
  },

  updateUser: (user) => set({ user }),

  updateBalance: (balancePaise) =>
    set((state) => ({
      user: state.user ? { ...state.user, balance_paise: balancePaise } : null,
    })),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
  },
}));
