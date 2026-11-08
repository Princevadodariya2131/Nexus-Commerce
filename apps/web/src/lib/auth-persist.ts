/**
 * Browser persistence rules for the auth store.
 *
 * Authentication is carried by httpOnly cookies set by the API; JavaScript never
 * needs the access token. Older versions of the app persisted it in localStorage
 * under 'nexus-auth', where any injected script could read it, so every load
 * strips it from storage.
 */
export const AUTH_STORAGE_KEY = 'nexus-auth';

export interface PersistedAuthUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string;
}

export interface PersistedAuthState {
  user: PersistedAuthUser | null;
  isAuthenticated: boolean;
}

/** Keep only the fields that are safe to persist (drops accessToken and anything unknown). */
export function sanitizePersistedAuth(state: unknown): PersistedAuthState {
  const source = (state && typeof state === 'object' ? state : {}) as Record<string, unknown>;
  const user = source.user && typeof source.user === 'object' ? (source.user as PersistedAuthUser) : null;
  return { user, isAuthenticated: Boolean(user) && source.isAuthenticated === true };
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Removes a token persisted by an older version; safe to call on every page load. */
export function purgeLegacyAuthToken(storage: StorageLike | undefined | null): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown>; version?: number };
    if (!parsed || typeof parsed !== 'object' || !parsed.state || !('accessToken' in parsed.state)) {
      return false;
    }
    delete parsed.state.accessToken;
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}
