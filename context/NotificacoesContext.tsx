import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TipoNotificacao = 'info' | 'aviso' | 'urgente' | 'sucesso';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: TipoNotificacao;
  data: string;
  lida: boolean;
  link?: string;
  createdAt: string;
}

interface NotificacoesContextValue {
  notificacoes: Notificacao[];
  unreadCount: number;
  isLoading: boolean;
  addNotificacao: (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => Promise<void>;
  marcarLida: (id: string) => Promise<void>;
  marcarTodasLidas: () => Promise<void>;
  deletarNotificacao: (id: string) => Promise<void>;
  limparTodas: () => Promise<void>;
}

const NotificacoesContext = createContext<NotificacoesContextValue | null>(null);

const STORAGE_KEY = '@sgaa_notificacoes';

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days === 1) return 'Ontem';
  return `há ${days} dias`;
}


export { timeAgo };

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotificacoes();
  }, []);

  async function loadNotificacoes() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      setNotificacoes(data);
    } catch (e) {
      setNotificacoes([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function persist(data: Notificacao[]) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async function addNotificacao(n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) {
    const nova: Notificacao = { ...n, id: genId(), lida: false, createdAt: new Date().toISOString() };
    const updated = [nova, ...notificacoes];
    setNotificacoes(updated);
    await persist(updated);
  }

  async function marcarLida(id: string) {
    const updated = notificacoes.map(n => n.id === id ? { ...n, lida: true } : n);
    setNotificacoes(updated);
    await persist(updated);
  }

  async function marcarTodasLidas() {
    const updated = notificacoes.map(n => ({ ...n, lida: true }));
    setNotificacoes(updated);
    await persist(updated);
  }

  async function deletarNotificacao(id: string) {
    const updated = notificacoes.filter(n => n.id !== id);
    setNotificacoes(updated);
    await persist(updated);
  }

  async function limparTodas() {
    setNotificacoes([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  const unreadCount = useMemo(() => notificacoes.filter(n => !n.lida).length, [notificacoes]);

  const value = useMemo<NotificacoesContextValue>(() => ({
    notificacoes, unreadCount, isLoading,
    addNotificacao, marcarLida, marcarTodasLidas, deletarNotificacao, limparTodas,
  }), [notificacoes, unreadCount, isLoading]);

  return <NotificacoesContext.Provider value={value}>{children}</NotificacoesContext.Provider>;
}

export function useNotificacoes() {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) throw new Error('useNotificacoes must be used within NotificacoesProvider');
  return ctx;
}
