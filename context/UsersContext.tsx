import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api } from '../lib/api';
import { UserRole, useAuth } from './AuthContext';

export interface StoredUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  escola: string;
  ativo: boolean;
  alunoId?: string;
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

export function UsersProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) load();
    else setIsLoading(false);
  }, [isAuthenticated]);

  async function load() {
    try {
      const data = await api.get<StoredUser[]>('/api/utilizadores');
      setUsers(data);
    } catch (e) {
      console.error('UsersContext load error', e);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function addUser(u: Omit<StoredUser, 'id' | 'criadoEm'>): Promise<StoredUser> {
    const novo = await api.post<StoredUser>('/api/utilizadores', u);
    setUsers(prev => [...prev, novo]);
    return novo;
  }

  async function updateUser(id: string, u: Partial<StoredUser>) {
    const updated = await api.put<StoredUser>(`/api/utilizadores/${id}`, u);
    setUsers(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function deleteUser(id: string) {
    await api.delete(`/api/utilizadores/${id}`);
    setUsers(prev => prev.filter(x => x.id !== id));
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
