import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api } from '../lib/api';

export interface Trimestre {
  numero: 1 | 2 | 3;
  dataInicio: string;
  dataFim: string;
  dataInicioExames?: string;
  dataFimExames?: string;
  ativo: boolean;
}

export interface EpocaExameItem {
  dataInicio?: string;
  dataFim?: string;
  observacoes?: string;
}

export interface EpocasExame {
  normal?: EpocaExameItem;
  recurso?: EpocaExameItem;
  especial?: EpocaExameItem;
}

export interface AnoAcademico {
  id: string;
  ano: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  trimestres: Trimestre[];
  epocasExame?: EpocasExame;
}

interface AnoAcademicoContextValue {
  anos: AnoAcademico[];
  anoAtivo: AnoAcademico | null;
  anoSelecionado: AnoAcademico | null;
  setAnoSelecionado: (ano: AnoAcademico) => void;
  addAno: (a: Omit<AnoAcademico, 'id'>) => Promise<void>;
  updateAno: (id: string, a: Partial<AnoAcademico>) => Promise<void>;
  deleteAno: (id: string) => Promise<void>;
  ativarAno: (id: string) => Promise<void>;
  isLoading: boolean;
  trimestreAtual: Trimestre | null;
}

const AnoAcademicoContext = createContext<AnoAcademicoContextValue | null>(null);

export function AnoAcademicoProvider({ children }: { children: ReactNode }) {
  const [anos, setAnos] = useState<AnoAcademico[]>([]);
  const [anoSelecionado, setAnoSelecionadoState] = useState<AnoAcademico | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadAnos(); }, []);

  async function loadAnos() {
    try {
      const data = await api.get<AnoAcademico[]>('/api/anos-academicos');
      setAnos(data);
      const active = data.find(a => a.ativo) || data[data.length - 1] || null;
      setAnoSelecionadoState(active);
    } catch (e) {
      console.error('AnoAcademicoContext load error', e);
      setAnos([]);
      setAnoSelecionadoState(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function addAno(a: Omit<AnoAcademico, 'id'>) {
    const novo = await api.post<AnoAcademico>('/api/anos-academicos', a);
    const updated = [...anos, novo];
    setAnos(updated);
    if (!anoSelecionado) setAnoSelecionadoState(novo);
  }

  async function updateAno(id: string, a: Partial<AnoAcademico>) {
    const updated = await api.put<AnoAcademico>(`/api/anos-academicos/${id}`, a);
    setAnos(prev => prev.map(x => x.id === id ? updated : x));
    if (anoSelecionado?.id === id) setAnoSelecionadoState(updated);
  }

  async function deleteAno(id: string) {
    await api.delete(`/api/anos-academicos/${id}`);
    const updated = anos.filter(x => x.id !== id);
    setAnos(updated);
    if (anoSelecionado?.id === id) {
      const active = updated.find(a => a.ativo) || updated[updated.length - 1] || null;
      setAnoSelecionadoState(active);
    }
  }

  async function ativarAno(id: string) {
    // Desactivar todos, depois activar o escolhido
    await Promise.all(anos.filter(a => a.ativo && a.id !== id).map(a => api.put(`/api/anos-academicos/${a.id}`, { ativo: false })));
    const updated = await api.put<AnoAcademico>(`/api/anos-academicos/${id}`, { ativo: true });
    const newList = anos.map(x => x.id === id ? updated : { ...x, ativo: false });
    setAnos(newList);
    setAnoSelecionadoState(updated);
  }

  const anoAtivo = useMemo(() => anos.find(a => a.ativo) || null, [anos]);

  const trimestreAtual = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const ref = anoAtivo ?? anoSelecionado;
    if (!ref) return null;
    return ref.trimestres.find(t => t.dataInicio <= today && today <= t.dataFim) || null;
  }, [anoAtivo, anoSelecionado]);

  function setAnoSelecionado(ano: AnoAcademico) {
    setAnoSelecionadoState(ano);
  }

  return (
    <AnoAcademicoContext.Provider value={{
      anos, anoAtivo, anoSelecionado, setAnoSelecionado,
      addAno, updateAno, deleteAno, ativarAno,
      isLoading, trimestreAtual,
    }}>
      {children}
    </AnoAcademicoContext.Provider>
  );
}

export function useAnoAcademico(): AnoAcademicoContextValue {
  const ctx = useContext(AnoAcademicoContext);
  if (!ctx) throw new Error('useAnoAcademico must be used within AnoAcademicoProvider');
  return ctx;
}
