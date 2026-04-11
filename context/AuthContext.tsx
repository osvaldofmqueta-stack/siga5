import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'ceo' | 'pca' | 'admin' | 'director' | 'chefe_secretaria' | 'secretaria' | 'professor' | 'diretor_turma' | 'subdiretor_administrativo' | 'aluno' | 'financeiro' | 'encarregado' | 'rh' | 'pedagogico';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  escola: string;
  telefone?: string;
  avatar?: string;
  biometricEnabled: boolean;
  alunoId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  lastUser: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
  clearLastUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = '@siga_user';
const LAST_USER_KEY = '@siga_last_user';
const TOKEN_KEY = '@siga_token';

export async function saveAuthToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  try { return await AsyncStorage.getItem(TOKEN_KEY); }
  catch { return null; }
}

export async function clearAuthToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// Fields that are persisted server-side (not device-local)
const SERVER_FIELDS: (keyof AuthUser)[] = ['nome', 'email', 'telefone', 'escola', 'avatar'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [lastUser, setLastUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const [raw, lastRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(LAST_USER_KEY),
      ]);
      if (raw) setUser(JSON.parse(raw));
      if (lastRaw) setLastUser(JSON.parse(lastRaw));
    } catch (e) {
      console.error('Failed to load user', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(authUser: AuthUser) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    await AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(authUser));
    setUser(authUser);
    setLastUser(authUser);
  }

  async function logout() {
    await AsyncStorage.multiRemove([STORAGE_KEY, LAST_USER_KEY, TOKEN_KEY]);
    setUser(null);
    setLastUser(null);
  }

  async function updateUser(updates: Partial<AuthUser>) {
    if (!user) return;
    const updated = { ...user, ...updates };

    // Determine which fields need to be persisted to the server
    const serverUpdates: Record<string, unknown> = {};
    for (const field of SERVER_FIELDS) {
      if (field in updates) serverUpdates[field] = updates[field];
    }

    // Call the server API if there are server-side fields to update
    if (Object.keys(serverUpdates).length > 0) {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const res = await fetch('/api/perfil', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(serverUpdates),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any)?.error || 'Erro ao actualizar perfil.');
        }
      } catch (apiErr) {
        console.warn('[AuthContext] updateUser API error:', apiErr);
        throw apiErr;
      }
    }

    // Update local storage and state
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(updated));
    setUser(updated);
    setLastUser(updated);
  }

  async function setBiometric(enabled: boolean) {
    if (!user) return;
    const updated = { ...user, biometricEnabled: enabled };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(updated));
    setUser(updated);
    setLastUser(updated);
  }

  async function clearLastUser() {
    await AsyncStorage.removeItem(LAST_USER_KEY);
    setLastUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      lastUser,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      updateUser,
      setBiometric,
      clearLastUser,
    }),
    [user, lastUser, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const AUTHORIZED_APPROVER_ROLES: UserRole[] = ['ceo', 'pca', 'admin', 'director', 'chefe_secretaria'];
