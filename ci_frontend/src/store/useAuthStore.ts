import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string;
  fullName?: string;
  role: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

// Retrieve initial values from localStorage to support persistent sessions
const cachedUser = localStorage.getItem('ci_user');
const cachedAccess = localStorage.getItem('ci_access_token');
const cachedRefresh = localStorage.getItem('ci_refresh_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: cachedUser ? JSON.parse(cachedUser) : null,
  accessToken: cachedAccess || null,
  refreshToken: cachedRefresh || null,
  isAuthenticated: !!cachedAccess,

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('ci_user', JSON.stringify(user));
    localStorage.setItem('ci_access_token', accessToken);
    localStorage.setItem('ci_refresh_token', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('ci_user');
    localStorage.removeItem('ci_access_token');
    localStorage.removeItem('ci_refresh_token');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
    // Force a hard redirect to login page if we are in the browser
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('ci_access_token', accessToken);
    localStorage.setItem('ci_refresh_token', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },
}));
