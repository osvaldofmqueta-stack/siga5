import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Pauta {
  id: string;
  turmaId: string;
  disciplina: string;
  trimestre: 1 | 2 | 3;
  professorId: string;
  status: 'aberta' | 'fechada' | 'pendente_abertura' | 'rejeitada';
  anoLetivo: string;
  dataFecho?: string;
  createdAt: string;
}

export interface SolicitacaoAbertura {
  id: string;
  pautaId: string;
  turmaId: string;
  turmaNome: string;
  disciplina: string;
  trimestre: 1 | 2 | 3;
  professorId: string;
  professorNome: string;
  motivo: string;
  status: 'pendente' | 'aprovada' | 'rejeitada';
  createdAt: string;
  respondidoEm?: string;
  observacao?: string;
}

export interface Mensagem {
  id: string;
  remetenteId: string;
  remetenteNome: string;
  tipo: 'turma' | 'privada';
  turmaId?: string;
  turmaNome?: string;
  destinatarioId?: string;
  destinatarioNome?: string;
  destinatarioTipo?: 'professor' | 'aluno';
  assunto: string;
  corpo: string;
  lidaPor: string[];
  createdAt: string;
}

export interface Material {
  id: string;
  professorId: string;
  turmaId: string;
  turmaNome: string;
  disciplina: string;
  titulo: string;
  descricao: string;
  tipo: 'texto' | 'link' | 'resumo' | 'pdf' | 'docx' | 'ppt';
  conteudo: string;
  nomeArquivo?: string;
  tamanhoArquivo?: number;
  createdAt: string;
}

export interface Sumario {
  id: string;
  professorId: string;
  professorNome: string;
  turmaId: string;
  turmaNome: string;
  disciplina: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  numeroAula: number;
  conteudo: string;
  status: 'pendente' | 'aceite' | 'rejeitado';
  observacaoRH?: string;
  createdAt: string;
}

export interface CalendarioProva {
  id: string;
  titulo: string;
  descricao: string;
  turmasIds: string[];
  disciplina: string;
  data: string;
  hora: string;
  tipo: 'teste' | 'exame' | 'trabalho' | 'prova_oral';
  publicado: boolean;
  createdAt: string;
}

interface ProfessorContextValue {
  pautas: Pauta[];
  solicitacoes: SolicitacaoAbertura[];
  mensagens: Mensagem[];
  materiais: Material[];
  sumarios: Sumario[];
  calendarioProvas: CalendarioProva[];
  isLoading: boolean;
  addPauta: (p: Omit<Pauta, 'id' | 'createdAt'>) => Promise<Pauta>;
  updatePauta: (id: string, p: Partial<Pauta>) => Promise<void>;
  getPautaByKey: (turmaId: string, disciplina: string, trimestre: 1 | 2 | 3) => Pauta | undefined;
  addSolicitacao: (s: Omit<SolicitacaoAbertura, 'id' | 'createdAt'>) => Promise<void>;
  updateSolicitacao: (id: string, s: Partial<SolicitacaoAbertura>) => Promise<void>;
  addMensagem: (m: Omit<Mensagem, 'id' | 'createdAt' | 'lidaPor'>) => Promise<void>;
  marcarMensagemLida: (id: string, userId: string) => Promise<void>;
  addMaterial: (m: Omit<Material, 'id' | 'createdAt'>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  addSumario: (s: Omit<Sumario, 'id' | 'createdAt'>) => Promise<void>;
  updateSumario: (id: string, s: Partial<Sumario>) => Promise<void>;
  addCalendarioProva: (c: Omit<CalendarioProva, 'id' | 'createdAt'>) => Promise<void>;
  updateCalendarioProva: (id: string, c: Partial<CalendarioProva>) => Promise<void>;
  deleteCalendarioProva: (id: string) => Promise<void>;
}

const ProfessorContext = createContext<ProfessorContextValue | null>(null);

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const KEYS = {
  pautas: '@sgaa_pautas',
  solicitacoes: '@sgaa_solicitacoes_abertura',
  mensagens: '@sgaa_mensagens_prof',
  materiais: '@sgaa_materiais',
  sumarios: '@sgaa_sumarios',
  calendarioProvas: '@sgaa_calendario_provas',
};

export function ProfessorProvider({ children }: { children: ReactNode }) {
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAbertura[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [sumarios, setSumarios] = useState<Sumario[]>([]);
  const [calendarioProvas, setCalendarioProvas] = useState<CalendarioProva[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [p, s, m, mat, sum, cal] = await Promise.all([
        AsyncStorage.getItem(KEYS.pautas),
        AsyncStorage.getItem(KEYS.solicitacoes),
        AsyncStorage.getItem(KEYS.mensagens),
        AsyncStorage.getItem(KEYS.materiais),
        AsyncStorage.getItem(KEYS.sumarios),
        AsyncStorage.getItem(KEYS.calendarioProvas),
      ]);
      setPautas(p ? JSON.parse(p) : []);
      setSolicitacoes(s ? JSON.parse(s) : []);
      setMensagens(m ? JSON.parse(m) : []);
      setMateriais(mat ? JSON.parse(mat) : []);
      setSumarios(sum ? JSON.parse(sum) : []);
      setCalendarioProvas(cal ? JSON.parse(cal) : []);
    } catch (e) {
      console.error('ProfessorContext load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function persist<T>(key: string, data: T[]) {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  async function addPauta(p: Omit<Pauta, 'id' | 'createdAt'>): Promise<Pauta> {
    const nova: Pauta = { ...p, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...pautas, nova];
    setPautas(updated);
    await persist(KEYS.pautas, updated);
    return nova;
  }

  async function updatePauta(id: string, p: Partial<Pauta>) {
    const updated = pautas.map(x => x.id === id ? { ...x, ...p } : x);
    setPautas(updated);
    await persist(KEYS.pautas, updated);
  }

  function getPautaByKey(turmaId: string, disciplina: string, trimestre: 1 | 2 | 3): Pauta | undefined {
    return pautas.find(p => p.turmaId === turmaId && p.disciplina === disciplina && p.trimestre === trimestre);
  }

  async function addSolicitacao(s: Omit<SolicitacaoAbertura, 'id' | 'createdAt'>) {
    const nova: SolicitacaoAbertura = { ...s, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...solicitacoes, nova];
    setSolicitacoes(updated);
    await persist(KEYS.solicitacoes, updated);
  }

  async function updateSolicitacao(id: string, s: Partial<SolicitacaoAbertura>) {
    const updated = solicitacoes.map(x => x.id === id ? { ...x, ...s } : x);
    setSolicitacoes(updated);
    await persist(KEYS.solicitacoes, updated);
  }

  async function addMensagem(m: Omit<Mensagem, 'id' | 'createdAt' | 'lidaPor'>) {
    const nova: Mensagem = { ...m, id: genId(), lidaPor: [m.remetenteId], createdAt: new Date().toISOString() };
    const updated = [...mensagens, nova];
    setMensagens(updated);
    await persist(KEYS.mensagens, updated);
  }

  async function marcarMensagemLida(id: string, userId: string) {
    const updated = mensagens.map(x => x.id === id && !x.lidaPor.includes(userId)
      ? { ...x, lidaPor: [...x.lidaPor, userId] } : x);
    setMensagens(updated);
    await persist(KEYS.mensagens, updated);
  }

  async function addMaterial(m: Omit<Material, 'id' | 'createdAt'>) {
    const novo: Material = { ...m, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...materiais, novo];
    setMateriais(updated);
    await persist(KEYS.materiais, updated);
  }

  async function deleteMaterial(id: string) {
    const updated = materiais.filter(x => x.id !== id);
    setMateriais(updated);
    await persist(KEYS.materiais, updated);
  }

  async function addSumario(s: Omit<Sumario, 'id' | 'createdAt'>) {
    const novo: Sumario = { ...s, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...sumarios, novo];
    setSumarios(updated);
    await persist(KEYS.sumarios, updated);
  }

  async function updateSumario(id: string, s: Partial<Sumario>) {
    const updated = sumarios.map(x => x.id === id ? { ...x, ...s } : x);
    setSumarios(updated);
    await persist(KEYS.sumarios, updated);
  }

  async function addCalendarioProva(c: Omit<CalendarioProva, 'id' | 'createdAt'>) {
    const nova: CalendarioProva = { ...c, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...calendarioProvas, nova];
    setCalendarioProvas(updated);
    await persist(KEYS.calendarioProvas, updated);
  }

  async function updateCalendarioProva(id: string, c: Partial<CalendarioProva>) {
    const updated = calendarioProvas.map(x => x.id === id ? { ...x, ...c } : x);
    setCalendarioProvas(updated);
    await persist(KEYS.calendarioProvas, updated);
  }

  async function deleteCalendarioProva(id: string) {
    const updated = calendarioProvas.filter(x => x.id !== id);
    setCalendarioProvas(updated);
    await persist(KEYS.calendarioProvas, updated);
  }

  const value = useMemo<ProfessorContextValue>(() => ({
    pautas, solicitacoes, mensagens, materiais, sumarios, calendarioProvas, isLoading,
    addPauta, updatePauta, getPautaByKey,
    addSolicitacao, updateSolicitacao,
    addMensagem, marcarMensagemLida,
    addMaterial, deleteMaterial,
    addSumario, updateSumario,
    addCalendarioProva, updateCalendarioProva, deleteCalendarioProva,
  }), [pautas, solicitacoes, mensagens, materiais, sumarios, calendarioProvas, isLoading]);

  return <ProfessorContext.Provider value={value}>{children}</ProfessorContext.Provider>;
}

export function useProfessor() {
  const ctx = useContext(ProfessorContext);
  if (!ctx) throw new Error('useProfessor must be used within ProfessorProvider');
  return ctx;
}
