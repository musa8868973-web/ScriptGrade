/**
 * Central Axios client for the ScriptGrade gateway.
 *
 * - Base URL resolves from `EXPO_PUBLIC_API_BASE_URL` (README Step 2), with
 *   sensible per-platform dev fallbacks (`10.0.2.2` reaches the host machine
 *   from the Android emulator; iOS simulator and Expo web use localhost).
 * - A request interceptor attaches `Authorization: Bearer <token>` to every
 *   call; the token itself lives in expo-secure-store (see hooks/useAuth.ts)
 *   and is mirrored here in-memory so interceptors stay synchronous.
 * - A response interceptor normalizes every failure into `NormalizedApiError`
 *   matching the backend's standardized envelope (`{"error": {...}}`) and
 *   broadcasts 401s so the auth hook can force sign-out.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { Platform } from 'react-native';

import { ApiErrorEnvelope } from './types';

const DEV_FALLBACK_BASE_URL =
  Platform.select({
    android: 'http://10.0.2.2:8000/api/v1',
    default: 'http://localhost:8000/api/v1',
  }) ?? 'http://localhost:8000/api/v1';

export const API_BASE_URL: string = (() => {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEV_FALLBACK_BASE_URL;
})();

// ---------------------------------------------------------------------------
// Auth token holder (mirrored from SecureStore by the auth hook)
// ---------------------------------------------------------------------------
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

// ---------------------------------------------------------------------------
// 401 broadcast (registered by the auth hook to force sign-out)
// ---------------------------------------------------------------------------
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------
export interface NormalizedApiError {
  status: number | null;
  code: string;
  message: string;
  requestId?: string;
  isNetworkError: boolean;
  isTimeout: boolean;
}

const NORMALIZED_MARKER = '__scriptgrade_normalized__';
type MaybeNormalized = NormalizedApiError & { [NORMALIZED_MARKER]?: true };

export function normalizeApiError(error: unknown): NormalizedApiError {
  const flagged = error as MaybeNormalized;
  if (flagged && flagged[NORMALIZED_MARKER]) {
    return flagged;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorEnvelope>;
    if (axiosError.code === 'ERR_CANCELED') {
      return markNormalized({
        status: null,
        code: 'canceled',
        message: 'The request was canceled.',
        isNetworkError: false,
        isTimeout: false,
      });
    }
    if (axiosError.code === 'ECONNABORTED') {
      return markNormalized({
        status: null,
        code: 'timeout',
        message: 'The server took too long to respond. Please try again.',
        isNetworkError: false,
        isTimeout: true,
      });
    }
    const response = axiosError.response;
    if (!response) {
      return markNormalized({
        status: null,
        code: 'network_error',
        message:
          'Cannot reach the ScriptGrade server. Check your connection and API URL.',
        isNetworkError: true,
        isTimeout: false,
      });
    }
    const envelope = response.data?.error;
    return markNormalized({
      status: response.status,
      code: envelope?.code ?? `http_${response.status}`,
      message:
        envelope?.message ??
        `Request failed with status ${response.status}.`,
      requestId: envelope?.request_id,
      isNetworkError: false,
      isTimeout: false,
    });
  }

  return markNormalized({
    status: null,
    code: 'unexpected_error',
    message:
      error instanceof Error ? error.message : 'An unexpected error occurred.',
    isNetworkError: false,
    isTimeout: false,
  });
}

function markNormalized(error: NormalizedApiError): NormalizedApiError {
  (error as MaybeNormalized)[NORMALIZED_MARKER] = true;
  return error;
}

// ---------------------------------------------------------------------------
// Axios instance + interceptors
// ---------------------------------------------------------------------------
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.set('Authorization', `Bearer ${authToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      unauthorizedHandler
    ) {
      unauthorizedHandler();
    }
    return Promise.reject(normalizeApiError(error));
  },
);
