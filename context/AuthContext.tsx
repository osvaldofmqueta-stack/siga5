import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'ceo' | 'pca' | 'admin' | 'director' | 'secretaria' | 'professor' | 'aluno';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  escola: string;
  avatar?: string;
  biometricEnabled: boolean;
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

const STORAGE_KEY = '@sgaa_user';
const LAST_USER_KEY = '@sgaa_last_user';

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
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  async function updateUser(updates: Partial<AuthUser>) {
    if (!user) return;
    const updated = { ...user, ...updates };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(updated));
    setUser(updated);
    setLastUser(updated);
  }

  async function setBiometric(enabled: boolean) {
    await updateUser({ biometricEnabled: enabled });
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

export const AUTHORIZED_APPROVER_ROLES: UserRole[] = ['ceo', 'pca', 'admin', 'director'];
