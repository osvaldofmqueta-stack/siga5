import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api } from '../lib/api';

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
        api.get<Pauta[]>('/api/pautas'),
        api.get<SolicitacaoAbertura[]>('/api/solicitacoes-abertura'),
        api.get<Mensagem[]>('/api/mensagens'),
        api.get<Material[]>('/api/materiais'),
        api.get<Sumario[]>('/api/sumarios'),
        api.get<CalendarioProva[]>('/api/calendario-provas'),
      ]);
      setPautas(p);
      setSolicitacoes(s);
      setMensagens(m);
      setMateriais(mat);
      setSumarios(sum);
      setCalendarioProvas(cal);
    } catch (e) {
      console.error('ProfessorContext load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function addPauta(p: Omit<Pauta, 'id' | 'createdAt'>): Promise<Pauta> {
    const nova = await api.post<Pauta>('/api/pautas', p);
    setPautas(prev => [nova, ...prev]);
    return nova;
  }

  async function updatePauta(id: string, p: Partial<Pauta>) {
    const updated = await api.put<Pauta>(`/api/pautas/${id}`, p);
    setPautas(prev => prev.map(x => x.id === id ? updated : x));
  }

  function getPautaByKey(turmaId: string, disciplina: string, trimestre: 1 | 2 | 3): Pauta | undefined {
    return pautas.find(p => p.turmaId === turmaId && p.disciplina === disciplina && p.trimestre === trimestre);
  }

  async function addSolicitacao(s: Omit<SolicitacaoAbertura, 'id' | 'createdAt'>) {
    const nova = await api.post<SolicitacaoAbertura>('/api/solicitacoes-abertura', s);
    setSolicitacoes(prev => [nova, ...prev]);
  }

  async function updateSolicitacao(id: string, s: Partial<SolicitacaoAbertura>) {
    const updated = await api.put<SolicitacaoAbertura>(`/api/solicitacoes-abertura/${id}`, s);
    setSolicitacoes(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function addMensagem(m: Omit<Mensagem, 'id' | 'createdAt' | 'lidaPor'>) {
    const nova = await api.post<Mensagem>('/api/mensagens', { ...m, lidaPor: [m.remetenteId] });
    setMensagens(prev => [nova, ...prev]);
  }

  async function marcarMensagemLida(id: string, userId: string) {
    const msg = mensagens.find(x => x.id === id);
    if (!msg || msg.lidaPor.includes(userId)) return;
    const novaLidaPor = [...msg.lidaPor, userId];
    const updated = await api.put<Mensagem>(`/api/mensagens/${id}`, { lidaPor: novaLidaPor });
    setMensagens(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function addMaterial(m: Omit<Material, 'id' | 'createdAt'>) {
    const novo = await api.post<Material>('/api/materiais', m);
    setMateriais(prev => [novo, ...prev]);
  }

  async function deleteMaterial(id: string) {
    await api.delete(`/api/materiais/${id}`);
    setMateriais(prev => prev.filter(x => x.id !== id));
  }

  async function addSumario(s: Omit<Sumario, 'id' | 'createdAt'>) {
    const novo = await api.post<Sumario>('/api/sumarios', s);
    setSumarios(prev => [novo, ...prev]);
  }

  async function updateSumario(id: string, s: Partial<Sumario>) {
    const updated = await api.put<Sumario>(`/api/sumarios/${id}`, s);
    setSumarios(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function addCalendarioProva(c: Omit<CalendarioProva, 'id' | 'createdAt'>) {
    const nova = await api.post<CalendarioProva>('/api/calendario-provas', c);
    setCalendarioProvas(prev => [nova, ...prev]);
  }

  async function updateCalendarioProva(id: string, c: Partial<CalendarioProva>) {
    const updated = await api.put<CalendarioProva>(`/api/calendario-provas/${id}`, c);
    setCalendarioProvas(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function deleteCalendarioProva(id: string) {
    await api.delete(`/api/calendario-provas/${id}`);
    setCalendarioProvas(prev => prev.filter(x => x.id !== id));
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
