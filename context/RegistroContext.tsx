import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api } from '../lib/api';

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

export function RegistroProvider({ children }: { children: ReactNode }) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRegistro[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<SolicitacaoRegistro[]>('/api/registros');
      setSolicitacoes(data);
    } catch (e) {
      console.error('RegistroContext load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function submeterSolicitacao(data: Omit<SolicitacaoRegistro, 'id' | 'status' | 'criadoEm'>) {
    const nova = await api.post<SolicitacaoRegistro>('/api/registros', { ...data, status: 'pendente' });
    setSolicitacoes(prev => [nova, ...prev]);
  }

  async function aprovarSolicitacao(id: string, avaliadorNome: string) {
    const updated = await api.put<SolicitacaoRegistro>(`/api/registros/${id}`, {
      status: 'aprovado',
      avaliadoEm: new Date().toISOString(),
      avaliadoPor: avaliadorNome,
    });
    setSolicitacoes(prev => prev.map(s => s.id === id ? updated : s));
  }

  async function rejeitarSolicitacao(id: string, avaliadorNome: string, motivo: string) {
    const updated = await api.put<SolicitacaoRegistro>(`/api/registros/${id}`, {
      status: 'rejeitado',
      avaliadoEm: new Date().toISOString(),
      avaliadoPor: avaliadorNome,
      motivoRejeicao: motivo,
    });
    setSolicitacoes(prev => prev.map(s => s.id === id ? updated : s));
  }

  async function deletarSolicitacao(id: string) {
    await api.delete(`/api/registros/${id}`);
    setSolicitacoes(prev => prev.filter(s => s.id !== id));
  }

  const pendentes = useMemo(() => solicitacoes.filter(s => s.status === 'pendente'), [solicitacoes]);
  const aprovadas = useMemo(() => solicitacoes.filter(s => s.status === 'aprovado'), [solicitacoes]);
  const rejeitadas = useMemo(() => solicitacoes.filter(s => s.status === 'rejeitado'), [solicitacoes]);

  return (
    <RegistroContext.Provider value={{
      solicitacoes, isLoading,
      submeterSolicitacao, aprovarSolicitacao, rejeitarSolicitacao, deletarSolicitacao,
      pendentes, aprovadas, rejeitadas,
    }}>
      {children}
    </RegistroContext.Provider>
  );
}

export function useRegistro(): RegistroContextValue {
  const ctx = useContext(RegistroContext);
  if (!ctx) throw new Error('useRegistro must be used within RegistroProvider');
  return ctx;
}
