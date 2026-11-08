import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AUTH_STORAGE_KEY,
  purgeLegacyAuthToken,
  sanitizePersistedAuth,
} from '@/lib/auth-persist';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string;
}

// The access token lives only in the httpOnly cookie set by the API. It is not
// kept in state or in localStorage, where injected script could read it.
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
}

if (typeof window !== 'undefined') {
  purgeLegacyAuthToken(window.localStorage);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: 1,
      // Only the profile (for display) is persisted; the API cookie remains the source of truth.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      migrate: (persisted) => sanitizePersistedAuth(persisted),
    }
  )
);
