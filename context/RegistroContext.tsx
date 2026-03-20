import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RegistroStatus = 'pendente' | 'aprovado' | 'rejeitado';

export interface SolicitacaoRegistro {
  id: string;
  nomeCompleto: string;
  dataNascimento: string;
  genero: 'M' | 'F';
  provincia: string;
  municipio: string;
  nivel: string;
  classe: string;
  nomeEncarregado: string;
  telefoneEncarregado: string;
  observacoes: string;
  status: RegistroStatus;
  criadoEm: string;
  avaliadoEm?: string;
  avaliadoPor?: string;
  motivoRejeicao?: string;
}

interface RegistroContextValue {
  solicitacoes: SolicitacaoRegistro[];
  isLoading: boolean;
  submeterSolicitacao: (data: Omit<SolicitacaoRegistro, 'id' | 'status' | 'criadoEm'>) => Promise<void>;
  aprovarSolicitacao: (id: string, avaliadorNome: string) => Promise<void>;
  rejeitarSolicitacao: (id: string, avaliadorNome: string, motivo: string) => Promise<void>;
  deletarSolicitacao: (id: string) => Promise<void>;
  pendentes: SolicitacaoRegistro[];
  aprovadas: SolicitacaoRegistro[];
  rejeitadas: SolicitacaoRegistro[];
}

const RegistroContext = createContext<RegistroContextValue | null>(null);
const STORAGE_KEY = '@sgaa_registros';

function genId(): string {
  return 'reg_' + Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

function now(): string {
  return new Date().toISOString();
}

export function RegistroProvider({ children }: { children: ReactNode }) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRegistro[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setSolicitacoes(JSON.parse(raw));
    } catch (e) {
      console.error('RegistroContext load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function persist(data: SolicitacaoRegistro[]) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async function submeterSolicitacao(data: Omit<SolicitacaoRegistro, 'id' | 'status' | 'criadoEm'>) {
    const nova: SolicitacaoRegistro = {
      ...data,
      id: genId(),
      status: 'pendente',
      criadoEm: now(),
    };
    const updated = [nova, ...solicitacoes];
    setSolicitacoes(updated);
    await persist(updated);
  }

  async function aprovarSolicitacao(id: string, avaliadorNome: string) {
    const updated = solicitacoes.map(s =>
      s.id === id ? { ...s, status: 'aprovado' as RegistroStatus, avaliadoEm: now(), avaliadoPor: avaliadorNome } : s
    );
    setSolicitacoes(updated);
    await persist(updated);
  }

  async function rejeitarSolicitacao(id: string, avaliadorNome: string, motivo: string) {
    const updated = solicitacoes.map(s =>
      s.id === id ? { ...s, status: 'rejeitado' as RegistroStatus, avaliadoEm: now(), avaliadoPor: avaliadorNome, motivoRejeicao: motivo } : s
    );
    setSolicitacoes(updated);
    await persist(updated);
  }

  async function deletarSolicitacao(id: string) {
    const updated = solicitacoes.filter(s => s.id !== id);
    setSolicitacoes(updated);
    await persist(updated);
  }

  const pendentes = useMemo(() => solicitacoes.filter(s => s.status === 'pendente'), [solicitacoes]);
  const aprovadas = useMemo(() => solicitacoes.filter(s => s.status === 'aprovado'), [solicitacoes]);
  const rejeitadas = useMemo(() => solicitacoes.filter(s => s.status === 'rejeitado'), [solicitacoes]);

  const value = useMemo<RegistroContextValue>(() => ({
    solicitacoes, isLoading,
    submeterSolicitacao, aprovarSolicitacao, rejeitarSolicitacao, deletarSolicitacao,
    pendentes, aprovadas, rejeitadas,
  }), [solicitacoes, isLoading, pendentes, aprovadas, rejeitadas]);

  return <RegistroContext.Provider value={value}>{children}</RegistroContext.Provider>;
}

export function useRegistro() {
  const ctx = useContext(RegistroContext);
  if (!ctx) throw new Error('useRegistro must be used within RegistroProvider');
  return ctx;
}
