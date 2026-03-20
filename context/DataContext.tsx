import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Aluno {
  id: string;
  numeroMatricula: string;
  nome: string;
  apelido: string;
  dataNascimento: string;
  genero: 'M' | 'F';
  provincia: string;
  municipio: string;
  turmaId: string;
  nomeEncarregado: string;
  telefoneEncarregado: string;
  ativo: boolean;
  foto?: string;
  createdAt: string;
}

export interface Professor {
  id: string;
  numeroProfessor: string;
  nome: string;
  apelido: string;
  disciplinas: string[];
  turmasIds: string[];
  telefone: string;
  email: string;
  habilitacoes: string;
  ativo: boolean;
  createdAt: string;
}

export interface Turma {
  id: string;
  nome: string;
  classe: string;
  turno: 'Manhã' | 'Tarde' | 'Noite';
  anoLetivo: string;
  nivel: 'Primário' | 'I Ciclo' | 'II Ciclo';
  professorId: string;
  sala: string;
  capacidade: number;
  ativo: boolean;
}

export interface NotaLancamentos {
  aval1: boolean;
  aval2: boolean;
  aval3: boolean;
  aval4: boolean;
  pp1: boolean;
  ppt: boolean;
}

export interface Nota {
  id: string;
  alunoId: string;
  turmaId: string;
  disciplina: string;
  trimestre: 1 | 2 | 3;
  aval1: number;
  aval2: number;
  aval3: number;
  aval4: number;
  mac1: number;
  pp1: number;
  ppt: number;
  mt1: number;
  nf: number;
  mac: number;
  anoLetivo: string;
  professorId: string;
  data: string;
  lancamentos?: NotaLancamentos;
}

export interface Presenca {
  id: string;
  alunoId: string;
  turmaId: string;
  disciplina: string;
  data: string;
  status: 'P' | 'F' | 'J';
  observacao?: string;
}

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  data: string;
  hora: string;
  tipo: 'Académico' | 'Cultural' | 'Desportivo' | 'Exame' | 'Feriado' | 'Reunião';
  local: string;
  turmasIds: string[];
  createdAt: string;
}

interface DataContextValue {
  alunos: Aluno[];
  professores: Professor[];
  turmas: Turma[];
  notas: Nota[];
  presencas: Presenca[];
  eventos: Evento[];
  isLoading: boolean;
  addAluno: (a: Omit<Aluno, 'id' | 'createdAt'>) => Promise<void>;
  updateAluno: (id: string, a: Partial<Aluno>) => Promise<void>;
  deleteAluno: (id: string) => Promise<void>;
  addProfessor: (p: Omit<Professor, 'createdAt'>) => Promise<void>;
  updateProfessor: (id: string, p: Partial<Professor>) => Promise<void>;
  deleteProfessor: (id: string) => Promise<void>;
  addTurma: (t: Omit<Turma, 'id'>) => Promise<void>;
  updateTurma: (id: string, t: Partial<Turma>) => Promise<void>;
  deleteTurma: (id: string) => Promise<void>;
  addNota: (n: Omit<Nota, 'id'>) => Promise<void>;
  updateNota: (id: string, n: Partial<Nota>) => Promise<void>;
  addPresenca: (p: Omit<Presenca, 'id'>) => Promise<void>;
  addEvento: (e: Omit<Evento, 'id' | 'createdAt'>) => Promise<void>;
  updateEvento: (id: string, e: Partial<Evento>) => Promise<void>;
  deleteEvento: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const STORAGE_KEYS = {
  alunos: '@sgaa_alunos',
  professores: '@sgaa_professores',
  turmas: '@sgaa_turmas',
  notas: '@sgaa_notas',
  presencas: '@sgaa_presencas',
  eventos: '@sgaa_eventos',
};

const DATA_VERSION_KEY = '@sgaa_data_v2';
const SEED_VERSION_KEY = '@sgaa_seed_v1';

const SEED_PROFESSOR: Professor = {
  id: 'prof_demo_001',
  numeroProfessor: 'PROF-2025-001',
  nome: 'António',
  apelido: 'Mendes da Silva',
  disciplinas: ['Matemática', 'Física', 'Ciências Naturais'],
  turmasIds: [],
  telefone: '923 456 789',
  email: 'antonio.mendes@sige.ao',
  habilitacoes: 'Licenciatura em Ciências da Educação – Ramo Matemática',
  ativo: true,
  createdAt: new Date().toISOString(),
};

async function seedInitialData() {
  const seeded = await AsyncStorage.getItem(SEED_VERSION_KEY);
  if (seeded) return;

  const existing = await AsyncStorage.getItem(STORAGE_KEYS.professores);
  const professores: Professor[] = existing ? JSON.parse(existing) : [];
  const alreadyExists = professores.some(p => p.id === SEED_PROFESSOR.id);
  if (!alreadyExists) {
    professores.push(SEED_PROFESSOR);
    await AsyncStorage.setItem(STORAGE_KEYS.professores, JSON.stringify(professores));
  }

  await AsyncStorage.setItem(SEED_VERSION_KEY, '1');
}

async function migrateIfNeeded() {
  const version = await AsyncStorage.getItem(DATA_VERSION_KEY);
  if (!version) {
    await AsyncStorage.multiRemove([
      '@sgaa_alunos', '@sgaa_professores', '@sgaa_turmas',
      '@sgaa_notas', '@sgaa_presencas', '@sgaa_eventos',
      '@sgaa_anos_academicos', '@sgaa_horarios',
      '@sgaa_taxas', '@sgaa_pagamentos', '@sgaa_notificacoes',
    ]);
    await AsyncStorage.setItem(DATA_VERSION_KEY, '1');
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      await migrateIfNeeded();
      await seedInitialData();
      const [a, p, t, n, pr, e] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.alunos),
        AsyncStorage.getItem(STORAGE_KEYS.professores),
        AsyncStorage.getItem(STORAGE_KEYS.turmas),
        AsyncStorage.getItem(STORAGE_KEYS.notas),
        AsyncStorage.getItem(STORAGE_KEYS.presencas),
        AsyncStorage.getItem(STORAGE_KEYS.eventos),
      ]);
      setAlunos(a ? JSON.parse(a) : []);
      setProfessores(p ? JSON.parse(p) : []);
      setTurmas(t ? JSON.parse(t) : []);
      setNotas(n ? JSON.parse(n) : []);
      setPresencas(pr ? JSON.parse(pr) : []);
      setEventos(e ? JSON.parse(e) : []);
    } catch (err) {
      console.error('DataContext load error', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function persist<T>(key: string, data: T[]) {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  async function addAluno(a: Omit<Aluno, 'id' | 'createdAt'>) {
    const novo: Aluno = { ...a, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...alunos, novo];
    setAlunos(updated);
    await persist(STORAGE_KEYS.alunos, updated);
  }

  async function updateAluno(id: string, a: Partial<Aluno>) {
    const updated = alunos.map(x => x.id === id ? { ...x, ...a } : x);
    setAlunos(updated);
    await persist(STORAGE_KEYS.alunos, updated);
  }

  async function deleteAluno(id: string) {
    const updated = alunos.filter(x => x.id !== id);
    setAlunos(updated);
    await persist(STORAGE_KEYS.alunos, updated);
  }

  async function addProfessor(p: Omit<Professor, 'createdAt'>) {
    const novo: Professor = { ...p, id: p.id || genId(), createdAt: new Date().toISOString() };
    const updated = [...professores, novo];
    setProfessores(updated);
    await persist(STORAGE_KEYS.professores, updated);
  }

  async function updateProfessor(id: string, p: Partial<Professor>) {
    const updated = professores.map(x => x.id === id ? { ...x, ...p } : x);
    setProfessores(updated);
    await persist(STORAGE_KEYS.professores, updated);
  }

  async function deleteProfessor(id: string) {
    const updated = professores.filter(x => x.id !== id);
    setProfessores(updated);
    await persist(STORAGE_KEYS.professores, updated);
  }

  async function addTurma(t: Omit<Turma, 'id'>) {
    const nova: Turma = { ...t, id: genId() };
    const updated = [...turmas, nova];
    setTurmas(updated);
    await persist(STORAGE_KEYS.turmas, updated);
  }

  async function updateTurma(id: string, t: Partial<Turma>) {
    const updated = turmas.map(x => x.id === id ? { ...x, ...t } : x);
    setTurmas(updated);
    await persist(STORAGE_KEYS.turmas, updated);
  }

  async function deleteTurma(id: string) {
    const updated = turmas.filter(x => x.id !== id);
    setTurmas(updated);
    await persist(STORAGE_KEYS.turmas, updated);
  }

  async function addNota(n: Omit<Nota, 'id'>) {
    const nova: Nota = { ...n, id: genId() };
    const updated = [...notas, nova];
    setNotas(updated);
    await persist(STORAGE_KEYS.notas, updated);
  }

  async function updateNota(id: string, n: Partial<Nota>) {
    const updated = notas.map(x => x.id === id ? { ...x, ...n } : x);
    setNotas(updated);
    await persist(STORAGE_KEYS.notas, updated);
  }

  async function addPresenca(p: Omit<Presenca, 'id'>) {
    const nova: Presenca = { ...p, id: genId() };
    const updated = [...presencas, nova];
    setPresencas(updated);
    await persist(STORAGE_KEYS.presencas, updated);
  }

  async function addEvento(e: Omit<Evento, 'id' | 'createdAt'>) {
    const novo: Evento = { ...e, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...eventos, novo];
    setEventos(updated);
    await persist(STORAGE_KEYS.eventos, updated);
  }

  async function updateEvento(id: string, e: Partial<Evento>) {
    const updated = eventos.map(x => x.id === id ? { ...x, ...e } : x);
    setEventos(updated);
    await persist(STORAGE_KEYS.eventos, updated);
  }

  async function deleteEvento(id: string) {
    const updated = eventos.filter(x => x.id !== id);
    setEventos(updated);
    await persist(STORAGE_KEYS.eventos, updated);
  }

  const value = useMemo<DataContextValue>(() => ({
    alunos, professores, turmas, notas, presencas, eventos, isLoading,
    addAluno, updateAluno, deleteAluno,
    addProfessor, updateProfessor, deleteProfessor,
    addTurma, updateTurma, deleteTurma,
    addNota, updateNota,
    addPresenca,
    addEvento, updateEvento, deleteEvento,
  }), [alunos, professores, turmas, notas, presencas, eventos, isLoading]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
