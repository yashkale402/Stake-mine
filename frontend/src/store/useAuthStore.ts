import { create } from 'zustand';

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
  initAuth: () => void;
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

  initAuth: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      set({ token, isAuthenticated: !!token, isHydrated: true });
    } else {
      set({ isHydrated: true });
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
