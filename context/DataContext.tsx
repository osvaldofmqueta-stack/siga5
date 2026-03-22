import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '@/lib/query-client';

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
  emailEncarregado?: string;
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
  aval5?: boolean;
  aval6?: boolean;
  aval7?: boolean;
  aval8?: boolean;
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
  aval5?: number;
  aval6?: number;
  aval7?: number;
  aval8?: number;
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

export interface Sala {
  id: string;
  nome: string;
  bloco: string;
  capacidade: number;
  tipo: 'Sala Normal' | 'Laboratório' | 'Sala de Informática' | 'Auditório' | 'Sala de Reunião';
  ativo: boolean;
}

interface DataContextValue {
  alunos: Aluno[];
  professores: Professor[];
  turmas: Turma[];
  salas: Sala[];
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
  addSala: (s: Omit<Sala, 'id'>) => Promise<void>;
  updateSala: (id: string, s: Partial<Sala>) => Promise<void>;
  deleteSala: (id: string) => Promise<void>;
  addNota: (n: Omit<Nota, 'id'>) => Promise<void>;
  updateNota: (id: string, n: Partial<Nota>) => Promise<void>;
  addPresenca: (p: Omit<Presenca, 'id'>) => Promise<void>;
  updatePresenca: (id: string, p: Partial<Presenca>) => Promise<void>;
  deletePresenca: (id: string) => Promise<void>;
  addEvento: (e: Omit<Evento, 'id' | 'createdAt'>) => Promise<void>;
  updateEvento: (id: string, e: Partial<Evento>) => Promise<void>;
  deleteEvento: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const STORAGE_KEYS = {
  alunos:      '@sgaa_alunos',
  professores: '@sgaa_professores',
  turmas:      '@sgaa_turmas',
  salas:       '@sgaa_salas_v1',
  notas:       '@sgaa_notas',
  presencas:   '@sgaa_presencas',
  eventos:     '@sgaa_eventos',
};

const CLEANUP_DEMO_DATA_KEY = '@sgaa_cleanup_demo_data_v1';

const DEMO_PROF_IDS    = new Set(['prof_demo_001']);
const DEMO_TURMA_IDS   = new Set(['turma_demo_10a']);
const DEMO_ALUNO_IDS   = new Set(['aluno_rebeca_001']);
const DEMO_NOTA_PREFIX = 'nota_rebeca_';
const DEMO_PRES_PREFIX = 'pres_rebeca_';
const DEMO_PAG_PREFIX  = 'pag_seed_';
const DEMO_TAXA_IDS    = new Set(['taxa_propina_iicl']);
const DEMO_PAUTA_IDS   = ['pauta_0_t1','pauta_0_t2','pauta_0_t3','pauta_1_t1','pauta_1_t2','pauta_1_t3','pauta_2_t1','pauta_2_t2','pauta_2_t3','pauta_3_t1','pauta_3_t2','pauta_3_t3','pauta_4_t1','pauta_4_t2','pauta_4_t3'];
const DEMO_MSG_IDS     = new Set(['msg_seed_001','msg_seed_002']);
const DEMO_MAT_IDS     = new Set(['mat_seed_001','mat_seed_002']);
const DEMO_SUM_IDS     = new Set(['sum_seed_001','sum_seed_002','sum_seed_003']);
const DEMO_HOR_IDS     = new Set(['hor_001','hor_002','hor_003','hor_004','hor_005','hor_006','hor_007','hor_008','hor_009','hor_010','hor_011','hor_012','hor_013','hor_014','hor_015']);
const DEMO_ANO_IDS     = new Set(['ano_2025_2026']);

async function cleanupDemoData() {
  const done = await AsyncStorage.getItem(CLEANUP_DEMO_DATA_KEY);
  if (done) return;

  async function cleanList<T extends { id: string }>(key: string, filter: (item: T) => boolean) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const items: T[] = JSON.parse(raw);
    const cleaned = items.filter(filter);
    await AsyncStorage.setItem(key, JSON.stringify(cleaned));
  }

  await cleanList<Professor>(STORAGE_KEYS.professores,
    p => !DEMO_PROF_IDS.has(p.id));

  await cleanList<Turma>(STORAGE_KEYS.turmas,
    t => !DEMO_TURMA_IDS.has(t.id));

  await cleanList<Aluno>(STORAGE_KEYS.alunos,
    a => !DEMO_ALUNO_IDS.has(a.id));

  await cleanList<Nota>(STORAGE_KEYS.notas,
    n => !n.id.startsWith(DEMO_NOTA_PREFIX));

  await cleanList<Presenca>(STORAGE_KEYS.presencas,
    p => !p.id.startsWith(DEMO_PRES_PREFIX));

  await cleanList<any>('@sgaa_taxas',
    t => !DEMO_TAXA_IDS.has(t.id));

  await cleanList<any>('@sgaa_pagamentos',
    p => !p.id.startsWith(DEMO_PAG_PREFIX));

  await cleanList<any>('@sgaa_pautas',
    p => !DEMO_PAUTA_IDS.includes(p.id));

  await cleanList<any>('@sgaa_mensagens_prof',
    m => !DEMO_MSG_IDS.has(m.id));

  await cleanList<any>('@sgaa_materiais',
    m => !DEMO_MAT_IDS.has(m.id));

  await cleanList<any>('@sgaa_sumarios',
    s => !DEMO_SUM_IDS.has(s.id));

  await cleanList<any>('@sgaa_horarios',
    h => !DEMO_HOR_IDS.has(h.id));

  await cleanList<any>('@sgaa_anos_academicos',
    a => !DEMO_ANO_IDS.has(a.id));

  await AsyncStorage.multiRemove([
    '@sgaa_data_v2',
    '@sgaa_seed_v1',
    '@sgaa_seed_v2',
  ]);

  await AsyncStorage.setItem(CLEANUP_DEMO_DATA_KEY, '1');
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [alunos, setAlunos]           = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas]           = useState<Turma[]>([]);
  const [salas, setSalas]             = useState<Sala[]>([]);
  const [notas, setNotas]             = useState<Nota[]>([]);
  const [presencas, setPresencas]     = useState<Presenca[]>([]);
  const [eventos, setEventos]         = useState<Evento[]>([]);
  const [isLoading, setIsLoading]     = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      await cleanupDemoData();

      // Carrega cache local (fallback)
      const [aRaw, pRaw, tRaw, sRaw, nRaw, prRaw, eRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.alunos),
        AsyncStorage.getItem(STORAGE_KEYS.professores),
        AsyncStorage.getItem(STORAGE_KEYS.turmas),
        AsyncStorage.getItem(STORAGE_KEYS.salas),
        AsyncStorage.getItem(STORAGE_KEYS.notas),
        AsyncStorage.getItem(STORAGE_KEYS.presencas),
        AsyncStorage.getItem(STORAGE_KEYS.eventos),
      ]);

      const cached = {
        alunos: aRaw ? (JSON.parse(aRaw) as Aluno[]) : [],
        professores: pRaw ? (JSON.parse(pRaw) as Professor[]) : [],
        turmas: tRaw ? (JSON.parse(tRaw) as Turma[]) : [],
        salas: sRaw ? (JSON.parse(sRaw) as Sala[]) : [],
        notas: nRaw ? (JSON.parse(nRaw) as Nota[]) : [],
        presencas: prRaw ? (JSON.parse(prRaw) as Presenca[]) : [],
        eventos: eRaw ? (JSON.parse(eRaw) as Evento[]) : [],
      };

      // Tenta sincronizar com o banco
      try {
        const [aApiRes, pApiRes, tApiRes, sApiRes, nApiRes, prApiRes, eApiRes] = await Promise.all([
          apiRequest('GET', '/api/alunos'),
          apiRequest('GET', '/api/professores'),
          apiRequest('GET', '/api/turmas'),
          apiRequest('GET', '/api/salas'),
          apiRequest('GET', '/api/notas'),
          apiRequest('GET', '/api/presencas'),
          apiRequest('GET', '/api/eventos'),
        ]);

        const [aApi, pApi, tApi, sApi, nApi, prApi, eApi] = await Promise.all([
          aApiRes.json() as Promise<Aluno[]>,
          pApiRes.json() as Promise<Professor[]>,
          tApiRes.json() as Promise<Turma[]>,
          sApiRes.json() as Promise<Sala[]>,
          nApiRes.json() as Promise<Nota[]>,
          prApiRes.json() as Promise<Presenca[]>,
          eApiRes.json() as Promise<Evento[]>,
        ]);

        setAlunos(aApi);
        setProfessores(pApi);
        setTurmas(tApi);
        setSalas(sApi);
        setNotas(nApi);
        setPresencas(prApi);
        setEventos(eApi);

        // Atualiza cache
        await Promise.all([
          persist(STORAGE_KEYS.alunos, aApi),
          persist(STORAGE_KEYS.professores, pApi),
          persist(STORAGE_KEYS.turmas, tApi),
          persist(STORAGE_KEYS.salas, sApi),
          persist(STORAGE_KEYS.notas, nApi),
          persist(STORAGE_KEYS.presencas, prApi),
          persist(STORAGE_KEYS.eventos, eApi),
        ]);
        return;
      } catch (apiErr) {
        // Se o servidor/rota não estiver pronto, usa o cache local
        console.warn('API sync failed, using AsyncStorage cache', apiErr);
      }

      // Fallback: usa cache
      setAlunos(cached.alunos);
      setProfessores(cached.professores);
      setTurmas(cached.turmas);
      setSalas(cached.salas);
      setNotas(cached.notas);
      setPresencas(cached.presencas);
      setEventos(cached.eventos);
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
    try {
      await apiRequest('POST', '/api/alunos', novo);
    } catch (e) {
      console.warn('Falha ao gravar aluno no banco', e);
    }
  }

  async function updateAluno(id: string, a: Partial<Aluno>) {
    const updated = alunos.map(x => x.id === id ? { ...x, ...a } : x);
    setAlunos(updated);
    await persist(STORAGE_KEYS.alunos, updated);
    try {
      const row = updated.find(x => x.id === id);
      if (row) await apiRequest('PUT', `/api/alunos/${id}`, row);
    } catch (e) {
      console.warn('Falha ao atualizar aluno no banco', e);
    }
  }

  async function deleteAluno(id: string) {
    const updated = alunos.filter(x => x.id !== id);
    setAlunos(updated);
    await persist(STORAGE_KEYS.alunos, updated);
    try {
      await apiRequest('DELETE', `/api/alunos/${id}`);
    } catch (e) {
      console.warn('Falha ao remover aluno no banco', e);
    }
  }

  async function addProfessor(p: Omit<Professor, 'createdAt'>) {
    const novo: Professor = { ...p, id: p.id || genId(), createdAt: new Date().toISOString() };
    const updated = [...professores, novo];
    setProfessores(updated);
    await persist(STORAGE_KEYS.professores, updated);
    try {
      await apiRequest('POST', '/api/professores', novo);
    } catch (e) {
      console.warn('Falha ao gravar professor no banco', e);
    }
  }

  async function updateProfessor(id: string, p: Partial<Professor>) {
    const updated = professores.map(x => x.id === id ? { ...x, ...p } : x);
    setProfessores(updated);
    await persist(STORAGE_KEYS.professores, updated);
    try {
      const row = updated.find(x => x.id === id);
      if (row) await apiRequest('PUT', `/api/professores/${id}`, row);
    } catch (e) {
      console.warn('Falha ao atualizar professor no banco', e);
    }
  }

  async function deleteProfessor(id: string) {
    const updated = professores.filter(x => x.id !== id);
    setProfessores(updated);
    await persist(STORAGE_KEYS.professores, updated);
    try {
      await apiRequest('DELETE', `/api/professores/${id}`);
    } catch (e) {
      console.warn('Falha ao remover professor no banco', e);
    }
  }

  async function addTurma(t: Omit<Turma, 'id'>) {
    const nova: Turma = { ...t, id: genId() };
    const updated = [...turmas, nova];
    setTurmas(updated);
    await persist(STORAGE_KEYS.turmas, updated);
    try {
      await apiRequest('POST', '/api/turmas', nova);
    } catch (e) {
      console.warn('Falha ao gravar turma no banco', e);
    }
  }

  async function updateTurma(id: string, t: Partial<Turma>) {
    const updated = turmas.map(x => x.id === id ? { ...x, ...t } : x);
    setTurmas(updated);
    await persist(STORAGE_KEYS.turmas, updated);
    try {
      const row = updated.find(x => x.id === id);
      if (row) await apiRequest('PUT', `/api/turmas/${id}`, row);
    } catch (e) {
      console.warn('Falha ao atualizar turma no banco', e);
    }
  }

  async function deleteTurma(id: string) {
    const updated = turmas.filter(x => x.id !== id);
    setTurmas(updated);
    await persist(STORAGE_KEYS.turmas, updated);
    try {
      await apiRequest('DELETE', `/api/turmas/${id}`);
    } catch (e) {
      console.warn('Falha ao remover turma no banco', e);
    }
  }

  async function addSala(s: Omit<Sala, 'id'>) {
    const nova: Sala = { ...s, id: genId() };
    const updated = [...salas, nova];
    setSalas(updated);
    await persist(STORAGE_KEYS.salas, updated);
    try {
      await apiRequest('POST', '/api/salas', nova);
    } catch (e) {
      console.warn('Falha ao gravar sala no banco', e);
    }
  }

  async function updateSala(id: string, s: Partial<Sala>) {
    const updated = salas.map(x => x.id === id ? { ...x, ...s } : x);
    setSalas(updated);
    await persist(STORAGE_KEYS.salas, updated);
    try {
      const row = updated.find(x => x.id === id);
      if (row) await apiRequest('PUT', `/api/salas/${id}`, row);
    } catch (e) {
      console.warn('Falha ao atualizar sala no banco', e);
    }
  }

  async function deleteSala(id: string) {
    const updated = salas.filter(x => x.id !== id);
    setSalas(updated);
    await persist(STORAGE_KEYS.salas, updated);
    try {
      await apiRequest('DELETE', `/api/salas/${id}`);
    } catch (e) {
      console.warn('Falha ao remover sala no banco', e);
    }
  }

  async function addNota(n: Omit<Nota, 'id'>) {
    const nova: Nota = { ...n, id: genId() };
    const updated = [...notas, nova];
    setNotas(updated);
    await persist(STORAGE_KEYS.notas, updated);
    try {
      await apiRequest('POST', '/api/notas', nova);
    } catch (e) {
      console.warn('Falha ao gravar nota no banco', e);
    }
  }

  async function updateNota(id: string, n: Partial<Nota>) {
    const updated = notas.map(x => x.id === id ? { ...x, ...n } : x);
    setNotas(updated);
    await persist(STORAGE_KEYS.notas, updated);
    try {
      const row = updated.find(x => x.id === id);
      if (row) await apiRequest('PUT', `/api/notas/${id}`, row);
    } catch (e) {
      console.warn('Falha ao atualizar nota no banco', e);
    }
  }

  async function addPresenca(p: Omit<Presenca, 'id'>) {
    const nova: Presenca = { ...p, id: genId() };
    const updated = [...presencas, nova];
    setPresencas(updated);
    await persist(STORAGE_KEYS.presencas, updated);
    try {
      await apiRequest('POST', '/api/presencas', nova);
    } catch (e) {
      console.warn('Falha ao gravar presença no banco', e);
    }
  }

  async function updatePresenca(id: string, p: Partial<Presenca>) {
    const updated = presencas.map(x => x.id === id ? { ...x, ...p } : x);
    setPresencas(updated);
    await persist(STORAGE_KEYS.presencas, updated);
    try {
      const row = updated.find(x => x.id === id);
      if (row) await apiRequest('PUT', `/api/presencas/${id}`, row);
    } catch (e) {
      console.warn('Falha ao atualizar presença no banco', e);
    }
  }

  async function deletePresenca(id: string) {
    const updated = presencas.filter(x => x.id !== id);
    setPresencas(updated);
    await persist(STORAGE_KEYS.presencas, updated);
    try {
      await apiRequest('DELETE', `/api/presencas/${id}`);
    } catch (e) {
      console.warn('Falha ao remover presença no banco', e);
    }
  }

  async function addEvento(e: Omit<Evento, 'id' | 'createdAt'>) {
    const novo: Evento = { ...e, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...eventos, novo];
    setEventos(updated);
    await persist(STORAGE_KEYS.eventos, updated);
    try {
      await apiRequest('POST', '/api/eventos', novo);
    } catch (e) {
      console.warn('Falha ao gravar evento no banco', e);
    }
  }

  async function updateEvento(id: string, e: Partial<Evento>) {
    const updated = eventos.map(x => x.id === id ? { ...x, ...e } : x);
    setEventos(updated);
    await persist(STORAGE_KEYS.eventos, updated);
    try {
      const row = updated.find(x => x.id === id);
      if (row) await apiRequest('PUT', `/api/eventos/${id}`, row);
    } catch (e) {
      console.warn('Falha ao atualizar evento no banco', e);
    }
  }

  async function deleteEvento(id: string) {
    const updated = eventos.filter(x => x.id !== id);
    setEventos(updated);
    await persist(STORAGE_KEYS.eventos, updated);
    try {
      await apiRequest('DELETE', `/api/eventos/${id}`);
    } catch (e) {
      console.warn('Falha ao remover evento no banco', e);
    }
  }

  const value = useMemo<DataContextValue>(() => ({
    alunos, professores, turmas, salas, notas, presencas, eventos, isLoading,
    addAluno, updateAluno, deleteAluno,
    addProfessor, updateProfessor, deleteProfessor,
    addTurma, updateTurma, deleteTurma,
    addSala, updateSala, deleteSala,
    addNota, updateNota,
    addPresenca, updatePresenca, deletePresenca,
    addEvento, updateEvento, deleteEvento,
  }), [alunos, professores, turmas, salas, notas, presencas, eventos, isLoading]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
