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
const SEED_V2_KEY = '@sgaa_seed_v2';

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

async function seedStudentData() {
  const seeded = await AsyncStorage.getItem(SEED_V2_KEY);
  if (seeded) return;

  const ANO_ID = 'ano_2025_2026';
  const TURMA_ID = 'turma_demo_10a';
  const ALUNO_ID = 'aluno_rebeca_001';
  const PROF_ID = 'prof_demo_001';
  const ANO_LETIVO = '2025/2026';

  const DISCIPLINAS = ['Matemática', 'Língua Portuguesa', 'Física', 'Química', 'Biologia'];

  /* ── Academic Year ─────────────────────────────────────────── */
  const anosRaw = await AsyncStorage.getItem('@sgaa_anos_academicos');
  const anos: any[] = anosRaw ? JSON.parse(anosRaw) : [];
  if (!anos.find(a => a.id === ANO_ID)) {
    anos.push({
      id: ANO_ID,
      ano: ANO_LETIVO,
      dataInicio: '2025-09-01',
      dataFim: '2026-07-31',
      ativo: true,
      trimestres: [
        { numero: 1, dataInicio: '2025-09-01', dataFim: '2025-11-30', ativo: false },
        { numero: 2, dataInicio: '2026-01-05', dataFim: '2026-03-31', ativo: false },
        { numero: 3, dataInicio: '2026-04-07', dataFim: '2026-07-31', ativo: true },
      ],
    });
    await AsyncStorage.setItem('@sgaa_anos_academicos', JSON.stringify(anos));
  }

  /* ── Turma ─────────────────────────────────────────────────── */
  const turmasRaw = await AsyncStorage.getItem(STORAGE_KEYS.turmas);
  const turmas: Turma[] = turmasRaw ? JSON.parse(turmasRaw) : [];
  if (!turmas.find(t => t.id === TURMA_ID)) {
    turmas.push({
      id: TURMA_ID, nome: '10ª A', classe: '10', turno: 'Manhã',
      anoLetivo: ANO_LETIVO, nivel: 'II Ciclo', professorId: PROF_ID,
      sala: 'Sala 15', capacidade: 35, ativo: true,
    });
    await AsyncStorage.setItem(STORAGE_KEYS.turmas, JSON.stringify(turmas));
  }

  /* ── Professor: add turma ──────────────────────────────────── */
  const profsRaw = await AsyncStorage.getItem(STORAGE_KEYS.professores);
  const profs: Professor[] = profsRaw ? JSON.parse(profsRaw) : [];
  const updatedProfs = profs.map(p =>
    p.id === PROF_ID && !p.turmasIds.includes(TURMA_ID)
      ? { ...p, turmasIds: [...p.turmasIds, TURMA_ID] }
      : p
  );
  await AsyncStorage.setItem(STORAGE_KEYS.professores, JSON.stringify(updatedProfs));

  /* ── Student Rebeca ────────────────────────────────────────── */
  const alunosRaw = await AsyncStorage.getItem(STORAGE_KEYS.alunos);
  const alunos: Aluno[] = alunosRaw ? JSON.parse(alunosRaw) : [];
  if (!alunos.find(a => a.id === ALUNO_ID)) {
    alunos.push({
      id: ALUNO_ID, numeroMatricula: 'AL-2025-001',
      nome: 'Rebeca', apelido: 'Chinawandela Queta',
      dataNascimento: '2008-03-15', genero: 'F',
      provincia: 'Luanda', municipio: 'Luanda',
      turmaId: TURMA_ID,
      nomeEncarregado: 'Maria Chinawandela Queta',
      telefoneEncarregado: '924 123 456',
      ativo: true, createdAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(STORAGE_KEYS.alunos, JSON.stringify(alunos));
  }

  /* ── Notas ─────────────────────────────────────────────────── */
  const notasRaw = await AsyncStorage.getItem(STORAGE_KEYS.notas);
  const notas: Nota[] = notasRaw ? JSON.parse(notasRaw) : [];

  type NotaSeed = { disc: string; t: 1|2|3; a1: number; a2: number; a3: number; a4: number; mac1: number; pp1: number; ppt: number; mt1: number; nf: number };
  const notasData: NotaSeed[] = [
    { disc: 'Matemática',        t: 1, a1: 12, a2: 14, a3: 13, a4: 15, mac1: 13.5, pp1: 14, ppt: 13, mt1: 13.6, nf: 13.6 },
    { disc: 'Língua Portuguesa', t: 1, a1: 16, a2: 17, a3: 15, a4: 18, mac1: 16.5, pp1: 17, ppt: 16, mt1: 16.6, nf: 16.6 },
    { disc: 'Física',            t: 1, a1: 10, a2: 11, a3:  9, a4: 12, mac1: 10.5, pp1: 11, ppt: 10, mt1: 10.6, nf: 10.6 },
    { disc: 'Química',           t: 1, a1: 14, a2: 15, a3: 16, a4: 14, mac1: 14.75, pp1: 15, ppt: 14, mt1: 14.8, nf: 14.8 },
    { disc: 'Biologia',          t: 1, a1: 17, a2: 18, a3: 16, a4: 19, mac1: 17.5, pp1: 18, ppt: 17, mt1: 17.6, nf: 17.6 },
    { disc: 'Matemática',        t: 2, a1: 13, a2: 15, a3: 14, a4: 16, mac1: 14.5, pp1: 15, ppt: 14, mt1: 14.6, nf: 14.6 },
    { disc: 'Língua Portuguesa', t: 2, a1: 17, a2: 18, a3: 16, a4: 17, mac1: 17,   pp1: 18, ppt: 17, mt1: 17.2, nf: 17.2 },
    { disc: 'Física',            t: 2, a1: 11, a2: 12, a3: 10, a4: 13, mac1: 11.5, pp1: 12, ppt: 11, mt1: 11.6, nf: 11.6 },
    { disc: 'Química',           t: 2, a1: 15, a2: 16, a3: 14, a4: 15, mac1: 15,   pp1: 15, ppt: 15, mt1: 15,   nf: 15 },
    { disc: 'Biologia',          t: 2, a1: 18, a2: 19, a3: 17, a4: 18, mac1: 18,   pp1: 18, ppt: 17, mt1: 17.8, nf: 17.8 },
    { disc: 'Matemática',        t: 3, a1: 14, a2: 15, a3:  0, a4:  0, mac1:  0,   pp1:  0, ppt:  0, mt1:  0,   nf:  0 },
    { disc: 'Língua Portuguesa', t: 3, a1: 16, a2: 17, a3:  0, a4:  0, mac1:  0,   pp1:  0, ppt:  0, mt1:  0,   nf:  0 },
    { disc: 'Física',            t: 3, a1:  0, a2:  0, a3:  0, a4:  0, mac1:  0,   pp1:  0, ppt:  0, mt1:  0,   nf:  0 },
    { disc: 'Química',           t: 3, a1:  0, a2:  0, a3:  0, a4:  0, mac1:  0,   pp1:  0, ppt:  0, mt1:  0,   nf:  0 },
    { disc: 'Biologia',          t: 3, a1:  0, a2:  0, a3:  0, a4:  0, mac1:  0,   pp1:  0, ppt:  0, mt1:  0,   nf:  0 },
  ];

  notasData.forEach((nd, i) => {
    const id = `nota_rebeca_${i}`;
    if (!notas.find(n => n.id === id)) {
      notas.push({
        id, alunoId: ALUNO_ID, turmaId: TURMA_ID,
        disciplina: nd.disc, trimestre: nd.t,
        aval1: nd.a1, aval2: nd.a2, aval3: nd.a3, aval4: nd.a4,
        mac1: nd.mac1, pp1: nd.pp1, ppt: nd.ppt, mt1: nd.mt1,
        nf: nd.nf, mac: nd.mac1,
        anoLetivo: ANO_LETIVO, professorId: PROF_ID,
        data: new Date().toISOString(),
        lancamentos: {
          aval1: nd.a1 > 0, aval2: nd.a2 > 0, aval3: nd.a3 > 0, aval4: nd.a4 > 0,
          pp1: nd.pp1 > 0, ppt: nd.ppt > 0,
        },
      });
    }
  });
  await AsyncStorage.setItem(STORAGE_KEYS.notas, JSON.stringify(notas));

  /* ── Presencas ─────────────────────────────────────────────── */
  const presRaw = await AsyncStorage.getItem(STORAGE_KEYS.presencas);
  const presencas: Presenca[] = presRaw ? JSON.parse(presRaw) : [];
  const presStatus: ('P' | 'F' | 'J')[] = ['P','P','P','P','P','P','P','P','F','P','P','P','J','P','P','P','P','P','F','P','P','P','P','P','P'];
  presStatus.forEach((st, i) => {
    const id = `pres_rebeca_${i}`;
    if (!presencas.find(p => p.id === id)) {
      const d = new Date('2026-02-01');
      d.setDate(d.getDate() + i);
      presencas.push({
        id, alunoId: ALUNO_ID, turmaId: TURMA_ID,
        disciplina: DISCIPLINAS[i % DISCIPLINAS.length],
        data: d.toISOString().split('T')[0],
        status: st,
      });
    }
  });
  await AsyncStorage.setItem(STORAGE_KEYS.presencas, JSON.stringify(presencas));

  /* ── Pautas ─────────────────────────────────────────────────── */
  const pautasRaw = await AsyncStorage.getItem('@sgaa_pautas');
  const pautas: any[] = pautasRaw ? JSON.parse(pautasRaw) : [];
  DISCIPLINAS.forEach((disc, di) => {
    ([1, 2, 3] as const).forEach(t => {
      const id = `pauta_${di}_t${t}`;
      if (!pautas.find(p => p.id === id)) {
        pautas.push({
          id, turmaId: TURMA_ID, disciplina: disc, trimestre: t,
          professorId: PROF_ID,
          status: t < 3 ? 'fechada' : 'aberta',
          anoLetivo: ANO_LETIVO,
          ...(t < 3 ? { dataFecho: t === 1 ? '2025-11-30' : '2026-03-31' } : {}),
          createdAt: new Date().toISOString(),
        });
      }
    });
  });
  await AsyncStorage.setItem('@sgaa_pautas', JSON.stringify(pautas));

  /* ── Mensagens ─────────────────────────────────────────────── */
  const msgsRaw = await AsyncStorage.getItem('@sgaa_mensagens_prof');
  const msgs: any[] = msgsRaw ? JSON.parse(msgsRaw) : [];
  if (!msgs.find(m => m.id === 'msg_seed_001')) {
    msgs.push({
      id: 'msg_seed_001', remetenteId: PROF_ID,
      remetenteNome: 'António Mendes da Silva',
      tipo: 'turma', turmaId: TURMA_ID, turmaNome: '10ª A',
      assunto: 'Teste de Matemática — Semana 13',
      corpo: 'Informo que na próxima semana realizaremos o teste do 3.º trimestre de Matemática. O conteúdo abrange equações do 2.º grau, funções e trigonometria. Estudem com antecedência. Bom estudo!',
      lidaPor: [], createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  if (!msgs.find(m => m.id === 'msg_seed_002')) {
    msgs.push({
      id: 'msg_seed_002', remetenteId: PROF_ID,
      remetenteNome: 'António Mendes da Silva',
      tipo: 'privada', destinatarioId: ALUNO_ID,
      destinatarioNome: 'Rebeca Chinawandela Queta',
      destinatarioTipo: 'aluno',
      assunto: 'Parabéns pelo desempenho!',
      corpo: 'Cara Rebeca, quero felicitar-te pelo excelente desempenho no 2.º trimestre. A tua dedicação e esforço são exemplares. Continua assim! Se precisares de apoio no 3.º trimestre, estou disponível.',
      lidaPor: [], createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  await AsyncStorage.setItem('@sgaa_mensagens_prof', JSON.stringify(msgs));

  /* ── Materiais ─────────────────────────────────────────────── */
  const matsRaw = await AsyncStorage.getItem('@sgaa_materiais');
  const mats: any[] = matsRaw ? JSON.parse(matsRaw) : [];
  if (!mats.find(m => m.id === 'mat_seed_001')) {
    mats.push({
      id: 'mat_seed_001', professorId: PROF_ID, turmaId: TURMA_ID,
      turmaNome: '10ª A', disciplina: 'Matemática',
      titulo: 'Exercícios de Equações do 2.º Grau',
      descricao: 'Lista de exercícios para preparação do teste do 3.º trimestre.',
      tipo: 'resumo',
      conteudo: 'EQUAÇÕES DO 2.º GRAU\n\nFórmula resolvente: x = (-b ± √(b²-4ac)) / 2a\n\nExercícios:\n1. x² - 5x + 6 = 0\n2. 2x² + 3x - 2 = 0\n3. x² - 4 = 0\n4. 3x² - 12x + 9 = 0\n5. x² + 2x + 1 = 0\n\nFunções Quadráticas:\nf(x) = ax² + bx + c\nVértice: V = (-b/2a, -Δ/4a)',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  if (!mats.find(m => m.id === 'mat_seed_002')) {
    mats.push({
      id: 'mat_seed_002', professorId: PROF_ID, turmaId: TURMA_ID,
      turmaNome: '10ª A', disciplina: 'Física',
      titulo: 'Resumo de Cinemática',
      descricao: 'Conceitos fundamentais de cinemática para o 3.º trimestre.',
      tipo: 'resumo',
      conteudo: 'CINEMÁTICA\n\nMovimento Rectilíneo Uniforme (MRU):\n- Velocidade constante\n- s = s₀ + v·t\n\nMovimento Rectilíneo Uniformemente Variado (MRUV):\n- Aceleração constante\n- v = v₀ + a·t\n- s = s₀ + v₀·t + ½a·t²\n- v² = v₀² + 2a·Δs\n\nQueda Livre:\n- a = g ≈ 9,8 m/s²\n- h = ½g·t²',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  await AsyncStorage.setItem('@sgaa_materiais', JSON.stringify(mats));

  /* ── Sumários ─────────────────────────────────────────────── */
  const sumsRaw = await AsyncStorage.getItem('@sgaa_sumarios');
  const sums: any[] = sumsRaw ? JSON.parse(sumsRaw) : [];
  const sumsSeed = [
    { id: 'sum_seed_001', disc: 'Matemática', data: '2026-03-18', hi: '07:00', hf: '07:45', n: 42, c: 'Equações do 2.º grau — fórmula resolvente e discriminante. Resolução de exercícios práticos.' },
    { id: 'sum_seed_002', disc: 'Física', data: '2026-03-19', hi: '07:45', hf: '08:30', n: 38, c: 'Cinemática: MRUV — equações do movimento e exercícios de aplicação.' },
    { id: 'sum_seed_003', disc: 'Biologia', data: '2026-03-20', hi: '08:30', hf: '09:15', n: 35, c: 'Sistema nervoso humano: estrutura e funcionamento do neurônio.' },
  ];
  sumsSeed.forEach(s => {
    if (!sums.find(x => x.id === s.id)) {
      sums.push({
        id: s.id, professorId: PROF_ID, professorNome: 'António Mendes da Silva',
        turmaId: TURMA_ID, turmaNome: '10ª A', disciplina: s.disc,
        data: s.data, horaInicio: s.hi, horaFim: s.hf, numeroAula: s.n,
        conteudo: s.c, status: 'aceite', createdAt: new Date().toISOString(),
      });
    }
  });
  await AsyncStorage.setItem('@sgaa_sumarios', JSON.stringify(sums));

  /* ── Horários ─────────────────────────────────────────────── */
  const horRaw = await AsyncStorage.getItem('@sgaa_horarios');
  const hors: any[] = horRaw ? JSON.parse(horRaw) : [];
  const horSeed = [
    { id: 'hor_001', dia: 0, per: 1, disc: 'Matemática',        sala: '15' },
    { id: 'hor_002', dia: 0, per: 2, disc: 'Língua Portuguesa', sala: '15' },
    { id: 'hor_003', dia: 0, per: 3, disc: 'Física',            sala: '15' },
    { id: 'hor_004', dia: 1, per: 1, disc: 'Química',           sala: '15' },
    { id: 'hor_005', dia: 1, per: 2, disc: 'Biologia',          sala: '15' },
    { id: 'hor_006', dia: 1, per: 3, disc: 'Matemática',        sala: '15' },
    { id: 'hor_007', dia: 2, per: 1, disc: 'Língua Portuguesa', sala: '15' },
    { id: 'hor_008', dia: 2, per: 2, disc: 'Física',            sala: '15' },
    { id: 'hor_009', dia: 2, per: 3, disc: 'Química',           sala: '15' },
    { id: 'hor_010', dia: 3, per: 1, disc: 'Biologia',          sala: '15' },
    { id: 'hor_011', dia: 3, per: 2, disc: 'Matemática',        sala: '15' },
    { id: 'hor_012', dia: 3, per: 3, disc: 'Língua Portuguesa', sala: '15' },
    { id: 'hor_013', dia: 4, per: 1, disc: 'Física',            sala: '15' },
    { id: 'hor_014', dia: 4, per: 2, disc: 'Biologia',          sala: '15' },
    { id: 'hor_015', dia: 4, per: 3, disc: 'Química',           sala: '15' },
  ];
  const PERIODOS_MAP: Record<number, { inicio: string; fim: string }> = {
    1: { inicio: '07:00', fim: '07:45' }, 2: { inicio: '07:45', fim: '08:30' },
    3: { inicio: '08:30', fim: '09:15' }, 4: { inicio: '09:45', fim: '10:30' },
  };
  horSeed.forEach(h => {
    if (!hors.find(x => x.id === h.id)) {
      const p = PERIODOS_MAP[h.per];
      hors.push({
        id: h.id, turmaId: TURMA_ID, disciplina: h.disc,
        professorId: PROF_ID, professorNome: 'António Mendes da Silva',
        diaSemana: h.dia, periodo: h.per,
        horaInicio: p.inicio, horaFim: p.fim,
        sala: h.sala, anoAcademico: ANO_LETIVO,
      });
    }
  });
  await AsyncStorage.setItem('@sgaa_horarios', JSON.stringify(hors));

  /* ── Taxas (Propina) ────────────────────────────────────────── */
  const taxasRaw = await AsyncStorage.getItem('@sgaa_taxas');
  const taxas: any[] = taxasRaw ? JSON.parse(taxasRaw) : [];
  if (!taxas.find(t => t.id === 'taxa_propina_iicl')) {
    taxas.push({
      id: 'taxa_propina_iicl',
      tipo: 'propina', descricao: 'Propina Mensal — II Ciclo',
      valor: 15000, frequencia: 'mensal',
      nivel: 'II Ciclo', anoAcademico: ANO_LETIVO, ativo: true,
    });
  }
  await AsyncStorage.setItem('@sgaa_taxas', JSON.stringify(taxas));

  /* ── Pagamentos ─────────────────────────────────────────────── */
  const pagsRaw = await AsyncStorage.getItem('@sgaa_pagamentos');
  const pags: any[] = pagsRaw ? JSON.parse(pagsRaw) : [];
  const pagsSeed = [
    { id: 'pag_seed_001', mes: 9,  status: 'pago',     ref: 'RUPE-821045', data: '2025-09-05' },
    { id: 'pag_seed_002', mes: 10, status: 'pago',     ref: 'RUPE-934712', data: '2025-10-07' },
    { id: 'pag_seed_003', mes: 11, status: 'pago',     ref: 'MCX-312894',  data: '2025-11-04' },
    { id: 'pag_seed_004', mes: 1,  status: 'pago',     ref: 'RUPE-541208', data: '2026-01-10' },
    { id: 'pag_seed_005', mes: 2,  status: 'pago',     ref: 'MCX-678231',  data: '2026-02-06' },
    { id: 'pag_seed_006', mes: 3,  status: 'pendente', ref: '',            data: '2026-03-01' },
  ];
  pagsSeed.forEach(p => {
    if (!pags.find(x => x.id === p.id)) {
      pags.push({
        id: p.id, alunoId: ALUNO_ID, taxaId: 'taxa_propina_iicl',
        valor: 15000, data: p.data, mes: p.mes, trimestre: 1,
        ano: ANO_LETIVO, status: p.status,
        metodoPagamento: p.ref.startsWith('MCX') ? 'multicaixa' : 'transferencia',
        referencia: p.ref,
        observacao: `Propina Mensal — Mês ${p.mes}`,
        createdAt: new Date().toISOString(),
      });
    }
  });
  await AsyncStorage.setItem('@sgaa_pagamentos', JSON.stringify(pags));

  await AsyncStorage.setItem(SEED_V2_KEY, '1');
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
      await seedStudentData();
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
