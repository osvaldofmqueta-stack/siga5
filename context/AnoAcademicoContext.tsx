import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Trimestre {
  numero: 1 | 2 | 3;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

export interface AnoAcademico {
  id: string;
  ano: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  trimestres: Trimestre[];
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

const STORAGE_KEY = '@sgaa_anos_academicos';

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function AnoAcademicoProvider({ children }: { children: ReactNode }) {
  const [anos, setAnos] = useState<AnoAcademico[]>([]);
  const [anoSelecionado, setAnoSelecionadoState] = useState<AnoAcademico | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnos();
  }, []);

  async function loadAnos() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const data: AnoAcademico[] = raw ? JSON.parse(raw) : [];
      setAnos(data);
      const active = data.find(a => a.ativo) || data[data.length - 1] || null;
      setAnoSelecionadoState(active);
    } catch (e) {
      setAnos([]);
      setAnoSelecionadoState(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function persist(data: AnoAcademico[]) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async function addAno(a: Omit<AnoAcademico, 'id'>) {
    const novo: AnoAcademico = { ...a, id: genId() };
    const updated = [...anos, novo];
    setAnos(updated);
    if (!anoSelecionado) setAnoSelecionadoState(novo);
    await persist(updated);
  }

  async function updateAno(id: string, a: Partial<AnoAcademico>) {
    const updated = anos.map(x => x.id === id ? { ...x, ...a } : x);
    setAnos(updated);
    if (anoSelecionado?.id === id) setAnoSelecionadoState({ ...anoSelecionado, ...a });
    await persist(updated);
  }

  async function deleteAno(id: string) {
    const updated = anos.filter(x => x.id !== id);
    setAnos(updated);
    await persist(updated);
  }

  async function ativarAno(id: string) {
    const updated = anos.map(x => ({ ...x, ativo: x.id === id }));
    setAnos(updated);
    const activated = updated.find(x => x.id === id) || null;
    setAnoSelecionadoState(activated);
    await persist(updated);
  }

  function setAnoSelecionado(ano: AnoAcademico) {
    setAnoSelecionadoState(ano);
  }

  const anoAtivo = useMemo(() => anos.find(a => a.ativo) || null, [anos]);
  const trimestreAtual = useMemo(() => {
    const ano = anoSelecionado;
    if (!ano) return null;
    return ano.trimestres.find(t => t.ativo) || ano.trimestres[0] || null;
  }, [anoSelecionado]);

  const value = useMemo<AnoAcademicoContextValue>(() => ({
    anos, anoAtivo, anoSelecionado, setAnoSelecionado,
    addAno, updateAno, deleteAno, ativarAno,
    isLoading, trimestreAtual,
  }), [anos, anoAtivo, anoSelecionado, isLoading, trimestreAtual]);

  return <AnoAcademicoContext.Provider value={value}>{children}</AnoAcademicoContext.Provider>;
}

export function useAnoAcademico() {
  const ctx = useContext(AnoAcademicoContext);
  if (!ctx) throw new Error('useAnoAcademico must be used within AnoAcademicoProvider');
  return ctx;
}
