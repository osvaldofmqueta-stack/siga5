import React, {
  createContext, useContext, useState, useCallback, useEffect, ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { getAuthToken } from './AuthContext';

export interface ChatMsg {
  id: string;
  remetenteId: string;
  remetenteNome: string;
  remetenteRole: string;
  destinatarioId: string;
  destinatarioNome: string;
  destinatarioRole: string;
  corpo: string;
  lida: boolean;
  createdAt: string;
}

interface Conversation {
  userId: string;
  userName: string;
  userRole: string;
  lastMsg: ChatMsg;
  unread: number;
  msgs: ChatMsg[];
}

interface ChatInternoCtx {
  mensagens: ChatMsg[];
  conversations: Conversation[];
  unreadTotal: number;
  isLoading: boolean;
  loadMensagens: () => Promise<void>;
  sendMensagem: (destinatarioId: string, destinatarioNome: string, destinatarioRole: string, corpo: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markConversationRead: (otherUserId: string) => Promise<void>;
}

const Ctx = createContext<ChatInternoCtx | null>(null);

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data as T;
}

export function ChatInternoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMensagens = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await req<ChatMsg[]>('/api/chat-interno');
      setMensagens(data);
    } catch {
      // silently ignore
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadMensagens();
    const interval = setInterval(loadMensagens, 15000);
    return () => clearInterval(interval);
  }, [user, loadMensagens]);

  const conversations: Conversation[] = React.useMemo(() => {
    if (!user) return [];
    const map = new Map<string, { msgs: ChatMsg[]; user: { id: string; name: string; role: string } }>();

    for (const m of mensagens) {
      const otherId = m.remetenteId === user.id ? m.destinatarioId : m.remetenteId;
      const otherName = m.remetenteId === user.id ? m.destinatarioNome : m.remetenteNome;
      const otherRole = m.remetenteId === user.id ? m.destinatarioRole : m.remetenteRole;
      if (!map.has(otherId)) {
        map.set(otherId, { msgs: [], user: { id: otherId, name: otherName, role: otherRole } });
      }
      map.get(otherId)!.msgs.push(m);
    }

    return Array.from(map.values()).map(({ msgs, user: u }) => {
      const sorted = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const unread = sorted.filter(m => !m.lida && m.destinatarioId === user.id).length;
      return {
        userId: u.id,
        userName: u.name,
        userRole: u.role,
        lastMsg: sorted[sorted.length - 1],
        unread,
        msgs: sorted,
      };
    }).sort((a, b) => new Date(b.lastMsg.createdAt).getTime() - new Date(a.lastMsg.createdAt).getTime());
  }, [mensagens, user]);

  const unreadTotal = React.useMemo(
    () => mensagens.filter(m => !m.lida && m.destinatarioId === user?.id).length,
    [mensagens, user],
  );

  const sendMensagem = useCallback(async (
    destinatarioId: string,
    destinatarioNome: string,
    destinatarioRole: string,
    corpo: string,
  ) => {
    if (!user) return;
    const nova = await req<ChatMsg>('/api/chat-interno', {
      method: 'POST',
      body: JSON.stringify({
        destinatarioId,
        destinatarioNome,
        destinatarioRole,
        corpo,
        remetenteNome: user.nome,
        remetenteRole: user.role,
      }),
    });
    setMensagens(prev => [...prev, nova]);
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    try {
      const updated = await req<ChatMsg>(`/api/chat-interno/${id}/ler`, { method: 'PUT' });
      setMensagens(prev => prev.map(m => m.id === id ? updated : m));
    } catch {
      // ignore
    }
  }, []);

  const markConversationRead = useCallback(async (otherUserId: string) => {
    const toMark = mensagens.filter(m => !m.lida && m.remetenteId === otherUserId && m.destinatarioId === user?.id);
    for (const m of toMark) {
      await markRead(m.id);
    }
  }, [mensagens, markRead, user]);

  return (
    <Ctx.Provider value={{ mensagens, conversations, unreadTotal, isLoading, loadMensagens, sendMensagem, markRead, markConversationRead }}>
      {children}
    </Ctx.Provider>
  );
}

export function useChatInterno() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChatInterno must be used within ChatInternoProvider');
  return ctx;
}
