import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

export type TipoTaxa = 'propina' | 'matricula' | 'material' | 'exame' | 'multa' | 'outro';
export type FrequenciaTaxa = 'mensal' | 'trimestral' | 'anual' | 'unica';
export type StatusPagamento = 'pago' | 'pendente' | 'cancelado';
export type MetodoPagamento = 'dinheiro' | 'transferencia' | 'multicaixa';

export interface Taxa {
  id: string;
  tipo: TipoTaxa;
  descricao: string;
  valor: number;
  frequencia: FrequenciaTaxa;
  nivel: string;
  anoAcademico: string;
  ativo: boolean;
}

export interface Pagamento {
  id: string;
  alunoId: string;
  taxaId: string;
  valor: number;
  data: string;
  mes?: number;
  trimestre?: number;
  ano: string;
  status: StatusPagamento;
  metodoPagamento: MetodoPagamento;
  referencia?: string;
  observacao?: string;
  createdAt: string;
}

export interface MultaConfig {
  percentagem: number;
  diasCarencia: number;
  ativo: boolean;
  dataLimitePagamento?: number;
  diaInicioMulta?: number;
  valorPorDia?: number;
}

export interface IsencaoMulta {
  id: string;
  alunoId: string;
  solicitadoPor: string;
  justificativa: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  aprovadoPor?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MensagemFinanceira {
  id: string;
  alunoId: string;
  remetente: string;
  texto: string;
  data: string;
  lida: boolean;
  tipo: 'aviso' | 'bloqueio' | 'rupe' | 'geral';
}

export interface RUPEGerado {
  id: string;
  alunoId: string;
  taxaId: string;
  valor: number;
  referencia: string;
  dataGeracao: string;
  dataValidade: string;
  status: 'ativo' | 'pago' | 'expirado';
}

export interface SaldoAluno {
  id: string;
  alunoId: string;
  saldo: number;
  dataProximaCobranca?: string;
  observacoes?: string;
  updatedAt: string;
}

export interface MovimentoSaldo {
  id: string;
  alunoId: string;
  tipo: 'credito' | 'debito' | 'transferencia_in' | 'transferencia_out' | 'pagamento_excesso';
  valor: number;
  descricao: string;
  pagamentoId?: string;
  criadoPor?: string;
  createdAt: string;
}

interface FinanceiroContextValue {
  taxas: Taxa[];
  pagamentos: Pagamento[];
  multaConfig: MultaConfig;
  mensagens: MensagemFinanceira[];
  rupes: RUPEGerado[];
  bloqueados: string[];
  acessoLiberado: string[];
  saldos: SaldoAluno[];
  movimentosSaldo: MovimentoSaldo[];
  isencoes: IsencaoMulta[];
  isLoading: boolean;
  addTaxa: (t: Omit<Taxa, 'id'>) => Promise<void>;
  updateTaxa: (id: string, t: Partial<Taxa>) => Promise<void>;
  deleteTaxa: (id: string) => Promise<void>;
  addPagamento: (p: Omit<Pagamento, 'id' | 'createdAt'>) => Promise<void>;
  addPagamentoSelf: (p: Omit<Pagamento, 'id' | 'createdAt'>) => Promise<Pagamento>;
  updatePagamento: (id: string, p: Partial<Pagamento>) => Promise<void>;
  deletePagamento: (id: string) => Promise<void>;
  transferirPagamento: (pagamentoId: string, destino: 'saldo' | string, criadoPor?: string) => Promise<void>;
  getTotalRecebido: (anoAcademico?: string) => number;
  getTotalPendente: (anoAcademico?: string) => number;
  getPagamentosAluno: (alunoId: string) => Pagamento[];
  getTaxasByNivel: (nivel: string, anoAcademico?: string) => Taxa[];
  updateMultaConfig: (cfg: Partial<MultaConfig>) => Promise<void>;
  bloquearAluno: (alunoId: string) => Promise<void>;
  desbloquearAluno: (alunoId: string) => Promise<void>;
  isAlunoBloqueado: (alunoId: string) => boolean;
  togglePermitirAcessoPortal: (alunoId: string, valor: boolean) => Promise<void>;
  enviarMensagem: (alunoId: string, texto: string, remetente: string, tipo?: MensagemFinanceira['tipo']) => Promise<void>;
  getMensagensAluno: (alunoId: string) => MensagemFinanceira[];
  marcarMensagemLida: (id: string) => Promise<void>;
  gerarRUPE: (alunoId: string, taxaId: string, valor: number) => Promise<RUPEGerado>;
  getRUPEsAluno: (alunoId: string) => RUPEGerado[];
  getMesesEmAtraso: (alunoId: string, anoAtual: string) => number;
  calcularMulta: (valorPropina: number, mesesAtraso: number) => number;
  getMultaAluno: (alunoId: string, valorPropina: number, mesesAtraso: number) => { valor: number; isento: boolean };
  getUnreadMensagensAluno: (alunoId: string) => number;
  getSaldoAluno: (alunoId: string) => SaldoAluno | null;
  getMovimentosAluno: (alunoId: string) => MovimentoSaldo[];
  creditarSaldo: (alunoId: string, valor: number, descricao: string, dataProximaCobranca?: string, observacoes?: string, criadoPor?: string) => Promise<SaldoAluno>;
  debitarSaldo: (alunoId: string, valor: number, descricao: string, criadoPor?: string) => Promise<SaldoAluno>;
  solicitarIsencaoMulta: (alunoId: string, justificativa: string, solicitadoPor: string) => Promise<void>;
  responderIsencaoMulta: (id: string, status: 'aprovado' | 'rejeitado', aprovadoPor: string) => Promise<void>;
  getIsencaoAluno: (alunoId: string) => IsencaoMulta | null;
}

const FinanceiroContext = createContext<FinanceiroContextValue | null>(null);

const DEFAULT_MULTA_CONFIG: MultaConfig = {
  percentagem: 10,
  diasCarencia: 5,
  ativo: true,
  diaInicioMulta: 10,
  valorPorDia: 0,
};

export function formatAOA(valor: number): string {
  return valor.toLocaleString('pt-AO') + ' AOA';
}

export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [multaConfig, setMultaConfig] = useState<MultaConfig>(DEFAULT_MULTA_CONFIG);
  const [mensagens, setMensagens] = useState<MensagemFinanceira[]>([]);
  const [rupes, setRupes] = useState<RUPEGerado[]>([]);
  const [bloqueados, setBloqueados] = useState<string[]>([]);
  const [acessoLiberado, setAcessoLiberado] = useState<string[]>([]);
  const [saldos, setSaldos] = useState<SaldoAluno[]>([]);
  const [movimentosSaldo, setMovimentosSaldo] = useState<MovimentoSaldo[]>([]);
  const [isencoes, setIsencoes] = useState<IsencaoMulta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) loadData();
    else setIsLoading(false);
  }, [isAuthenticated]);

  async function loadData() {
    try {
      const [t, p, msg, r, alunos, cfg, s, mv, isen] = await Promise.all([
        api.get<Taxa[]>('/api/taxas'),
        api.get<Pagamento[]>('/api/pagamentos'),
        api.get<MensagemFinanceira[]>('/api/mensagens-financeiras'),
        api.get<RUPEGerado[]>('/api/rupes'),
        api.get<Array<{ id: string; bloqueado: boolean }>>('/api/alunos'),
        api.get<Record<string, unknown>>('/api/config'),
        api.get<SaldoAluno[]>('/api/saldo-alunos').catch(() => [] as SaldoAluno[]),
        api.get<MovimentoSaldo[]>('/api/movimentos-saldo').catch(() => [] as MovimentoSaldo[]),
        api.get<IsencaoMulta[]>('/api/multa-isencoes').catch(() => [] as IsencaoMulta[]),
      ]);
      setTaxas(t);
      setPagamentos(p);
      setMensagens(msg);
      setRupes(r);
      setBloqueados(alunos.filter(a => a.bloqueado).map(a => a.id));
      setAcessoLiberado(alunos.filter(a => (a as any).permitirAcessoComPendencia).map(a => a.id));
      setSaldos(s);
      setMovimentosSaldo(mv);
      setIsencoes(isen);
      if (cfg.multaConfig) {
        setMultaConfig({ ...DEFAULT_MULTA_CONFIG, ...(cfg.multaConfig as Partial<MultaConfig>) });
      }
    } catch (e) {
      console.error('FinanceiroContext load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function addTaxa(t: Omit<Taxa, 'id'>) {
    const novo = await api.post<Taxa>('/api/taxas', t);
    setTaxas(prev => [novo, ...prev]);
  }

  async function updateTaxa(id: string, t: Partial<Taxa>) {
    const updated = await api.put<Taxa>(`/api/taxas/${id}`, t);
    setTaxas(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function deleteTaxa(id: string) {
    await api.delete(`/api/taxas/${id}`);
    setTaxas(prev => prev.filter(x => x.id !== id));
  }

  async function addPagamento(p: Omit<Pagamento, 'id' | 'createdAt'>) {
    const novo = await api.post<Pagamento>('/api/pagamentos', p);
    setPagamentos(prev => [novo, ...prev]);
  }

  async function addPagamentoSelf(p: Omit<Pagamento, 'id' | 'createdAt'>): Promise<Pagamento> {
    const novo = await api.post<Pagamento>('/api/pagamentos/self', p);
    setPagamentos(prev => [novo, ...prev]);
    return novo;
  }

  async function updatePagamento(id: string, p: Partial<Pagamento>) {
    const updated = await api.put<Pagamento>(`/api/pagamentos/${id}`, p);
    setPagamentos(prev => prev.map(x => x.id === id ? updated : x));
  }

  async function deletePagamento(id: string) {
    await api.delete(`/api/pagamentos/${id}`);
    setPagamentos(prev => prev.filter(x => x.id !== id));
  }

  function getTotalRecebido(anoAcademico?: string) {
    return pagamentos
      .filter(p => p.status === 'pago' && (!anoAcademico || p.ano === anoAcademico))
      .reduce((s, p) => s + p.valor, 0);
  }

  function getTotalPendente(anoAcademico?: string) {
    return pagamentos
      .filter(p => p.status === 'pendente' && (!anoAcademico || p.ano === anoAcademico))
      .reduce((s, p) => s + p.valor, 0);
  }

  function getPagamentosAluno(alunoId: string) {
    return pagamentos.filter(p => p.alunoId === alunoId);
  }

  function getTaxasByNivel(nivel: string, anoAcademico?: string) {
    return taxas.filter(t => (t.nivel === nivel || t.nivel === 'Todos') && (!anoAcademico || t.anoAcademico === anoAcademico) && t.ativo);
  }

  async function updateMultaConfig(cfg: Partial<MultaConfig>) {
    const updated = { ...multaConfig, ...cfg };
    setMultaConfig(updated);
    await api.put('/api/config', { multaConfig: updated });
  }

  async function bloquearAluno(alunoId: string) {
    if (bloqueados.includes(alunoId)) return;
    await api.put(`/api/alunos/${alunoId}`, { bloqueado: true });
    setBloqueados(prev => [...prev, alunoId]);
  }

  async function desbloquearAluno(alunoId: string) {
    await api.put(`/api/alunos/${alunoId}`, { bloqueado: false });
    setBloqueados(prev => prev.filter(id => id !== alunoId));
  }

  function isAlunoBloqueado(alunoId: string) {
    if (acessoLiberado.includes(alunoId)) return false;
    return bloqueados.includes(alunoId);
  }

  async function togglePermitirAcessoPortal(alunoId: string, valor: boolean) {
    await api.patch(`/api/alunos/${alunoId}/permitir-acesso-pendencia`, { permitirAcessoComPendencia: valor });
    if (valor) {
      setAcessoLiberado(prev => prev.includes(alunoId) ? prev : [...prev, alunoId]);
    } else {
      setAcessoLiberado(prev => prev.filter(id => id !== alunoId));
    }
  }

  async function enviarMensagem(alunoId: string, texto: string, remetente: string, tipo: MensagemFinanceira['tipo'] = 'geral') {
    const nova = await api.post<MensagemFinanceira>('/api/mensagens-financeiras', {
      alunoId, remetente, texto,
      data: new Date().toISOString(),
      lida: false,
      tipo,
    });
    setMensagens(prev => [nova, ...prev]);
  }

  function getMensagensAluno(alunoId: string) {
    return mensagens.filter(m => m.alunoId === alunoId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  async function marcarMensagemLida(id: string) {
    await api.put(`/api/mensagens-financeiras/${id}`, { lida: true });
    setMensagens(prev => prev.map(m => m.id === id ? { ...m, lida: true } : m));
  }

  function getUnreadMensagensAluno(alunoId: string) {
    return mensagens.filter(m => m.alunoId === alunoId && !m.lida).length;
  }

  async function gerarRUPE(alunoId: string, taxaId: string, valor: number): Promise<RUPEGerado> {
    const dataGeracao = new Date();
    const dataValidade = new Date(dataGeracao);
    dataValidade.setDate(dataValidade.getDate() + 15);

    const seq = String(rupes.length + 1).padStart(4, '0');
    const referencia = `RUPE-${dataGeracao.getFullYear()}-${String(dataGeracao.getMonth() + 1).padStart(2, '0')}-${seq}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const novo = await api.post<RUPEGerado>('/api/rupes', {
      alunoId, taxaId, valor, referencia,
      dataGeracao: dataGeracao.toISOString(),
      dataValidade: dataValidade.toISOString(),
      status: 'ativo',
    });
    setRupes(prev => [novo, ...prev]);
    return novo;
  }

  function getRUPEsAluno(alunoId: string) {
    return rupes.filter(r => r.alunoId === alunoId).sort((a, b) => new Date(b.dataGeracao).getTime() - new Date(a.dataGeracao).getTime());
  }

  function getMesesEmAtraso(alunoId: string, anoAtual: string): number {
    const taxasPropina = taxas.filter(t => t.tipo === 'propina' && t.ativo && t.anoAcademico === anoAtual);
    if (taxasPropina.length === 0) return 0;

    const pagsAluno = pagamentos.filter(p => p.alunoId === alunoId && p.ano === anoAtual && p.status !== 'cancelado');
    const mesesPagos = new Set(pagsAluno.filter(p => p.status === 'pago').map(p => p.mes));
    const mesesPendentes = pagsAluno.filter(p => p.status === 'pendente').map(p => p.mes);

    const mesAtual = new Date().getMonth() + 1;
    const mesesLetivos = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const mesesPassados = mesesLetivos.filter(m => m <= mesAtual);

    let atraso = 0;
    for (const m of mesesPassados) {
      const pago = mesesPagos.has(m);
      const pendente = mesesPendentes.includes(m);
      if (!pago && !pendente) atraso++;
    }
    return atraso;
  }

  function calcularMulta(valorPropina: number, mesesAtraso: number): number {
    if (!multaConfig.ativo || mesesAtraso === 0) return 0;
    if ((multaConfig.valorPorDia || 0) > 0) {
      const hoje = new Date();
      const diaInicio = multaConfig.diaInicioMulta || 10;
      const diasDesdeInicio = Math.max(0, hoje.getDate() - diaInicio);
      return Math.round((multaConfig.valorPorDia || 0) * (diasDesdeInicio + mesesAtraso * 30));
    }
    return Math.round(valorPropina * (multaConfig.percentagem / 100) * mesesAtraso);
  }

  function getMultaAluno(alunoId: string, valorPropina: number, mesesAtraso: number): { valor: number; isento: boolean } {
    const isencao = isencoes.find(i => i.alunoId === alunoId && i.status === 'aprovado');
    if (isencao) return { valor: 0, isento: true };
    return { valor: calcularMulta(valorPropina, mesesAtraso), isento: false };
  }

  function getIsencaoAluno(alunoId: string): IsencaoMulta | null {
    return isencoes.find(i => i.alunoId === alunoId) || null;
  }

  async function solicitarIsencaoMulta(alunoId: string, justificativa: string, solicitadoPor: string): Promise<void> {
    const nova = await api.post<IsencaoMulta>('/api/multa-isencoes', { alunoId, justificativa, solicitadoPor });
    setIsencoes(prev => {
      const sem = prev.filter(i => i.alunoId !== alunoId);
      return [nova, ...sem];
    });
  }

  async function responderIsencaoMulta(id: string, status: 'aprovado' | 'rejeitado', aprovadoPor: string): Promise<void> {
    const updated = await api.put<IsencaoMulta>(`/api/multa-isencoes/${id}`, { status, aprovadoPor });
    setIsencoes(prev => prev.map(i => i.id === id ? updated : i));
  }

  function getSaldoAluno(alunoId: string): SaldoAluno | null {
    return saldos.find(s => s.alunoId === alunoId) || null;
  }

  function getMovimentosAluno(alunoId: string): MovimentoSaldo[] {
    return movimentosSaldo.filter(m => m.alunoId === alunoId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async function creditarSaldo(alunoId: string, valor: number, descricao: string, dataProximaCobranca?: string, observacoes?: string, criadoPor?: string): Promise<SaldoAluno> {
    const result = await api.post<SaldoAluno>(`/api/saldo-alunos/${alunoId}/creditar`, { valor, descricao, dataProximaCobranca, observacoes, criadoPor });
    setSaldos(prev => {
      const idx = prev.findIndex(s => s.alunoId === alunoId);
      if (idx >= 0) return prev.map((s, i) => i === idx ? result : s);
      return [result, ...prev];
    });
    const novoMov: MovimentoSaldo = { id: Date.now().toString(), alunoId, tipo: 'credito', valor, descricao, criadoPor, createdAt: new Date().toISOString() };
    setMovimentosSaldo(prev => [novoMov, ...prev]);
    return result;
  }

  async function debitarSaldo(alunoId: string, valor: number, descricao: string, criadoPor?: string): Promise<SaldoAluno> {
    const result = await api.post<SaldoAluno>(`/api/saldo-alunos/${alunoId}/debitar`, { valor, descricao, criadoPor });
    setSaldos(prev => prev.map(s => s.alunoId === alunoId ? result : s));
    const novoMov: MovimentoSaldo = { id: Date.now().toString(), alunoId, tipo: 'debito', valor, descricao, criadoPor, createdAt: new Date().toISOString() };
    setMovimentosSaldo(prev => [novoMov, ...prev]);
    return result;
  }

  async function transferirPagamento(pagamentoId: string, destino: 'saldo' | string, criadoPor?: string): Promise<void> {
    const result = await api.post<{ pagamento: Pagamento; saldo?: SaldoAluno; novoPagamento?: Pagamento }>(
      `/api/pagamentos/${pagamentoId}/transferir`, { destino, criadoPor }
    );
    setPagamentos(prev => prev.map(p => p.id === pagamentoId ? { ...p, status: 'cancelado' } : p));
    if (result.saldo) {
      setSaldos(prev => {
        const idx = prev.findIndex(s => s.alunoId === result.saldo!.alunoId);
        if (idx >= 0) return prev.map((s, i) => i === idx ? result.saldo! : s);
        return [result.saldo!, ...prev];
      });
      const alunoId = result.pagamento.alunoId;
      const novoMov: MovimentoSaldo = { id: Date.now().toString(), alunoId, tipo: 'credito', valor: result.pagamento.valor, descricao: 'Pagamento transferido para saldo', pagamentoId, criadoPor, createdAt: new Date().toISOString() };
      setMovimentosSaldo(prev => [novoMov, ...prev]);
    }
    if (result.novoPagamento) {
      setPagamentos(prev => [result.novoPagamento!, ...prev]);
    }
  }

  const value = useMemo<FinanceiroContextValue>(() => ({
    taxas, pagamentos, multaConfig, mensagens, rupes, bloqueados, acessoLiberado, saldos, movimentosSaldo, isencoes, isLoading,
    addTaxa, updateTaxa, deleteTaxa,
    addPagamento, addPagamentoSelf, updatePagamento, deletePagamento, transferirPagamento,
    getTotalRecebido, getTotalPendente, getPagamentosAluno, getTaxasByNivel,
    updateMultaConfig,
    bloquearAluno, desbloquearAluno, isAlunoBloqueado, togglePermitirAcessoPortal,
    enviarMensagem, getMensagensAluno, marcarMensagemLida, getUnreadMensagensAluno,
    gerarRUPE, getRUPEsAluno,
    getMesesEmAtraso, calcularMulta, getMultaAluno,
    getSaldoAluno, getMovimentosAluno, creditarSaldo, debitarSaldo,
    solicitarIsencaoMulta, responderIsencaoMulta, getIsencaoAluno,
  }), [taxas, pagamentos, multaConfig, mensagens, rupes, bloqueados, acessoLiberado, saldos, movimentosSaldo, isencoes, isLoading]);

  return <FinanceiroContext.Provider value={value}>{children}</FinanceiroContext.Provider>;
}

export function useFinanceiro() {
  const ctx = useContext(FinanceiroContext);
  if (!ctx) throw new Error('useFinanceiro must be used within FinanceiroProvider');
  return ctx;
}
