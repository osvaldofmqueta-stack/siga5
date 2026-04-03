import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api } from '../lib/api';

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
  load: () => Promise<void>;
  addNotificacao: (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => Promise<void>;
  marcarLida: (id: string) => Promise<void>;
  marcarTodasLidas: () => Promise<void>;
  deletarNotificacao: (id: string) => Promise<void>;
  limparTodas: () => Promise<void>;
}

const NotificacoesContext = createContext<NotificacoesContextValue | null>(null);

export function timeAgo(dateStr: string): string {
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

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<Notificacao[]>('/api/notificacoes');
      setNotificacoes(data);
    } catch (e) {
      console.error('NotificacoesContext load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function addNotificacao(n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) {
    const nova = await api.post<Notificacao>('/api/notificacoes', { ...n, lida: false });
    setNotificacoes(prev => [nova, ...prev]);
  }

  async function marcarLida(id: string) {
    await api.put(`/api/notificacoes/${id}`, { lida: true });
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  }

  async function marcarTodasLidas() {
    const unread = notificacoes.filter(n => !n.lida);
    await Promise.all(unread.map(n => api.put(`/api/notificacoes/${n.id}`, { lida: true })));
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  }

  async function deletarNotificacao(id: string) {
    await api.delete(`/api/notificacoes/${id}`);
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  }

  async function limparTodas() {
    await api.delete('/api/notificacoes');
    setNotificacoes([]);
  }

  const unreadCount = useMemo(() => notificacoes.filter(n => !n.lida).length, [notificacoes]);

  return (
    <NotificacoesContext.Provider value={{
      notificacoes, unreadCount, isLoading,
      load,
      addNotificacao, marcarLida, marcarTodasLidas,
      deletarNotificacao, limparTodas,
    }}>
      {children}
    </NotificacoesContext.Provider>
  );
}

export function useNotificacoes(): NotificacoesContextValue {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) throw new Error('useNotificacoes must be used within NotificacoesProvider');
  return ctx;
}
