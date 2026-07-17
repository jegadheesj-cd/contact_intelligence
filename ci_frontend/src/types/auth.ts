import type { User } from '../store/useAuthStore';

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  organization?: string | null;
  createdAt: string;
}
