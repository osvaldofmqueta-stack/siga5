import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from './AuthContext';

export interface StoredUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  escola: string;
  ativo: boolean;
  criadoEm: string;
}

interface UsersContextValue {
  users: StoredUser[];
  isLoading: boolean;
  addUser: (u: Omit<StoredUser, 'id' | 'criadoEm'>) => Promise<StoredUser>;
  updateUser: (id: string, u: Partial<StoredUser>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  findByCredentials: (email: string, senha: string) => StoredUser | null;
  changePassword: (id: string, novaSenha: string) => Promise<void>;
}

const UsersContext = createContext<UsersContextValue | null>(null);

export const STORAGE_USERS = '@sgaa_users';
const USERS_SEED_KEY = '@sgaa_users_seed_v1';

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

const SEED_PROFESSOR_USER: StoredUser = {
  id: 'usr_prof_demo_001',
  nome: 'António Mendes da Silva',
  email: 'antonio.mendes@sige.ao',
  senha: 'Prof@2025',
  role: 'professor',
  escola: 'Escola Secundária 1.º de Agosto',
  ativo: true,
  criadoEm: new Date().toISOString().split('T')[0],
};

async function seedUsers(current: StoredUser[]): Promise<StoredUser[]> {
  const seeded = await AsyncStorage.getItem(USERS_SEED_KEY);
  if (seeded) return current;

  const exists = current.some(u => u.id === SEED_PROFESSOR_USER.id);
  const updated = exists ? current : [...current, SEED_PROFESSOR_USER];
  if (!exists) {
    await AsyncStorage.setItem(STORAGE_USERS, JSON.stringify(updated));
  }
  await AsyncStorage.setItem(USERS_SEED_KEY, '1');
  return updated;
}

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_USERS);
      const parsed: StoredUser[] = raw ? JSON.parse(raw) : [];
      const seeded = await seedUsers(parsed);
      setUsers(seeded);
    } catch (e) {
      console.error('UsersContext load error', e);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function persist(data: StoredUser[]) {
    await AsyncStorage.setItem(STORAGE_USERS, JSON.stringify(data));
  }

  async function addUser(u: Omit<StoredUser, 'id' | 'criadoEm'>): Promise<StoredUser> {
    const novo: StoredUser = { ...u, id: genId(), criadoEm: today() };
    const updated = [...users, novo];
    setUsers(updated);
    await persist(updated);
    return novo;
  }

  async function updateUser(id: string, u: Partial<StoredUser>) {
    const updated = users.map(x => x.id === id ? { ...x, ...u } : x);
    setUsers(updated);
    await persist(updated);
  }

  async function deleteUser(id: string) {
    const updated = users.filter(x => x.id !== id);
    setUsers(updated);
    await persist(updated);
  }

  function findByCredentials(email: string, senha: string): StoredUser | null {
    return users.find(u =>
      u.email.toLowerCase() === email.toLowerCase() && u.senha === senha && u.ativo
    ) || null;
  }

  async function changePassword(id: string, novaSenha: string) {
    await updateUser(id, { senha: novaSenha });
  }

  const value = useMemo<UsersContextValue>(() => ({
    users, isLoading,
    addUser, updateUser, deleteUser, findByCredentials, changePassword,
  }), [users, isLoading]);

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error('useUsers must be used within UsersProvider');
  return ctx;
}
