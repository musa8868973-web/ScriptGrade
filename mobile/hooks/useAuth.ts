/**
 * Secure authentication hook.
 *
 * - JWT access tokens and the signed-in user profile are persisted in
 *   `expo-secure-store` (hardware-backed Keychain on iOS, Keystore on
 *   Android). On Expo web — where SecureStore is unsupported — an
 *   in-memory fallback keeps the hook functional for development without
 *   ever crashing.
 * - The token is mirrored into `lib/api.ts` via `setAuthToken`, so the
 *   Axios request interceptor attaches `Authorization: Bearer <token>`
 *   to every API call, including multipart uploads.
 * - Any 401 surfaced by the response interceptor forces a local sign-out
 *   (stale/expired token cleanup) through `registerUnauthorizedHandler`.
 *
 * The store is a module-level `useSyncExternalStore` source so this file
 * stays pure TypeScript (no JSX / no Context provider required).
 */

import { useCallback, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  api,
  getAuthToken,
  normalizeApiError,
  NormalizedApiError,
  registerUnauthorizedHandler,
  setAuthToken,
} from '../lib/api';
import { resetSession } from '../lib/captureStore';
import { TokenResponse, TokenUser } from '../lib/types';

const KEY_JWT = 'scriptgrade.jwt';
const KEY_USER = 'scriptgrade.user';

// ---------------------------------------------------------------------------
// Persistence layer (SecureStore with web fallback)
// ---------------------------------------------------------------------------
const memoryFallback = new Map<string, string>();
const useSecureStore = Platform.OS !== 'web';

async function persistValue(key: string, value: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.setItemAsync(key, value);
  } else {
    memoryFallback.set(key, value);
  }
}

async function readPersistedValue(key: string): Promise<string | null> {
  if (useSecureStore) {
    return SecureStore.getItemAsync(key);
  }
  return memoryFallback.has(key) ? (memoryFallback.get(key) as string) : null;
}

async function deletePersistedValue(key: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(key);
  } else {
    memoryFallback.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Module-level auth store
// ---------------------------------------------------------------------------
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: TokenUser | null;
}

type Listener = () => void;

let state: AuthState = { status: 'loading', token: null, user: null };
const listeners = new Set<Listener>();
let hydrationStarted = false;
let unauthorizedHandlerRegistered = false;

function emit(next: AuthState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return state;
}

function parseStoredUser(raw: string | null): TokenUser | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as TokenUser;
    if (
      parsed &&
      typeof parsed.user_id === 'string' &&
      typeof parsed.email === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Load the persisted credentials once at app start. Safe to call on every
 * render of the root layout — subsequent calls are no-ops.
 */
export function hydrateAuth(): void {
  if (hydrationStarted) {
    return;
  }
  hydrationStarted = true;
  void (async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        readPersistedValue(KEY_JWT),
        readPersistedValue(KEY_USER),
      ]);
      const user = parseStoredUser(storedUser);
      if (storedToken && user) {
        setAuthToken(storedToken);
        emit({ status: 'signedIn', token: storedToken, user });
      } else {
        // Partial or corrupt payload — clear everything to a known state.
        if (storedToken || storedUser) {
          await Promise.all([
            deletePersistedValue(KEY_JWT),
            deletePersistedValue(KEY_USER),
          ]);
        }
        setAuthToken(null);
        emit({ status: 'signedOut', token: null, user: null });
      }
    } catch {
      setAuthToken(null);
      emit({ status: 'signedOut', token: null, user: null });
    }
  })();
}

async function performSignOut(): Promise<void> {
  try {
    await Promise.all([
      deletePersistedValue(KEY_JWT),
      deletePersistedValue(KEY_USER),
    ]);
  } catch {
    // Best effort — local state is cleared regardless.
  }
  setAuthToken(null);
  resetSession();
  emit({ status: 'signedOut', token: null, user: null });
}

function ensureUnauthorizedHandler(): void {
  if (unauthorizedHandlerRegistered) {
    return;
  }
  unauthorizedHandlerRegistered = true;
  registerUnauthorizedHandler(() => {
    // Token was rejected by the gateway — drop local credentials.
    void performSignOut();
  });
}

export interface SignInResult {
  ok: boolean;
  error: NormalizedApiError | null;
}

async function performSignIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const trimmedEmail = email.trim().toLowerCase();
  try {
    const response = await api.post<TokenResponse>('/auth/login', {
      email: trimmedEmail,
      password,
    });
    const { access_token, user } = response.data;
    setAuthToken(access_token);
    try {
      await Promise.all([
        persistValue(KEY_JWT, access_token),
        persistValue(KEY_USER, JSON.stringify(user)),
      ]);
    } catch {
      // Persistence failure must not block sign-in; the in-memory token
      // remains authoritative for this session.
    }
    emit({ status: 'signedIn', token: access_token, user });
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: normalizeApiError(error) };
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseAuth {
  status: AuthStatus;
  token: string | null;
  user: TokenUser | null;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuth {
  ensureUnauthorizedHandler();
  hydrateAuth();

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const signIn = useCallback(
    (email: string, password: string) => performSignIn(email, password),
    [],
  );
  const signOut = useCallback(() => performSignOut(), []);

  return {
    status: snapshot.status,
    token: snapshot.token ?? getAuthToken(),
    user: snapshot.user,
    isSignedIn: snapshot.status === 'signedIn',
    signIn,
    signOut,
  };
}
