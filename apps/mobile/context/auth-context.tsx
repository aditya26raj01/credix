import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  AuthTokens,
  AuthUser,
  exchangeGoogleIdToken,
  getMe,
  logout,
  refreshTokens,
} from '@/services/auth-service';
import { ApiError } from '@/services/http-client';

type AuthContextValue = {
  isHydrating: boolean;
  isSigningIn: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  authError: string | null;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  authorizedFetch: <T>(input: (accessToken: string) => Promise<T>) => Promise<T>;
};

const STORAGE_KEYS = {
  accessToken: 'credix.accessToken',
  refreshToken: 'credix.refreshToken',
  user: 'credix.user',
};

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage.getItem(key);
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage.setItem(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignore storage write failures and keep in-memory state as source of truth.
  }
}

async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage.removeItem(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore storage delete failures; sign-out still clears in-memory state.
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

type PersistedAuth = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [auth, setAuth] = useState<PersistedAuth | null>(null);

  const persistAuth = useCallback(async (tokens: AuthTokens) => {
    await Promise.all([
      setStoredValue(STORAGE_KEYS.accessToken, tokens.accessToken),
      setStoredValue(STORAGE_KEYS.refreshToken, tokens.refreshToken),
      setStoredValue(STORAGE_KEYS.user, JSON.stringify(tokens.user)),
    ]);

    setAuth({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    });
  }, []);

  const clearAuth = useCallback(async () => {
    await Promise.all([
      deleteStoredValue(STORAGE_KEYS.accessToken),
      deleteStoredValue(STORAGE_KEYS.refreshToken),
      deleteStoredValue(STORAGE_KEYS.user),
    ]);
    setAuth(null);
  }, []);

  useEffect(() => {
    async function hydrate() {
      try {
        const [accessToken, refreshToken, userRaw] = await Promise.all([
          getStoredValue(STORAGE_KEYS.accessToken),
          getStoredValue(STORAGE_KEYS.refreshToken),
          getStoredValue(STORAGE_KEYS.user),
        ]);

        if (!accessToken || !refreshToken || !userRaw) {
          setIsHydrating(false);
          return;
        }

        const parsedUser = JSON.parse(userRaw) as AuthUser | null;
        if (!parsedUser || !parsedUser.id || !parsedUser.email) {
          await clearAuth();
          return;
        }

        try {
          const refreshed = await refreshTokens(refreshToken);
          await persistAuth(refreshed);
        } catch {
          const me = await getMe(accessToken);
          setAuth({ accessToken, refreshToken, user: me });
          await setStoredValue(STORAGE_KEYS.user, JSON.stringify(me));
        }
      } catch {
        await clearAuth();
      } finally {
        setIsHydrating(false);
      }
    }

    void hydrate();
  }, [clearAuth, persistAuth]);

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      setIsSigningIn(true);
      setAuthError(null);
      try {
        const tokens = await exchangeGoogleIdToken({
          idToken,
          deviceInfo: `${Platform.OS}-${String(Platform.Version)}`,
        });
        await persistAuth(tokens);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to continue with Google right now.';
        setAuthError(message);
        throw error;
      } finally {
        setIsSigningIn(false);
      }
    },
    [persistAuth],
  );

  const signOut = useCallback(async () => {
    try {
      if (auth?.refreshToken) {
        await logout(auth.refreshToken);
      }
    } finally {
      await clearAuth();
    }
  }, [auth?.refreshToken, clearAuth]);

  const authorizedFetch = useCallback(
    async <T,>(input: (accessToken: string) => Promise<T>): Promise<T> => {
      if (!auth) {
        throw new Error('Not authenticated');
      }

      try {
        return await input(auth.accessToken);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const rotated = await refreshTokens(auth.refreshToken);
        await persistAuth(rotated);
        return input(rotated.accessToken);
      }
    },
    [auth, persistAuth],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isHydrating,
      isSigningIn,
      isAuthenticated: Boolean(auth?.accessToken && auth?.refreshToken),
      user: auth?.user ?? null,
      authError,
      signInWithGoogle,
      signOut,
      authorizedFetch,
    }),
    [
      auth?.accessToken,
      auth?.refreshToken,
      auth?.user,
      authError,
      authorizedFetch,
      isHydrating,
      isSigningIn,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
