import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface FinanceiroContextValue {
  taxas: Taxa[];
  pagamentos: Pagamento[];
  multaConfig: MultaConfig;
  mensagens: MensagemFinanceira[];
  rupes: RUPEGerado[];
  bloqueados: string[];
  isLoading: boolean;
  addTaxa: (t: Omit<Taxa, 'id'>) => Promise<void>;
  updateTaxa: (id: string, t: Partial<Taxa>) => Promise<void>;
  deleteTaxa: (id: string) => Promise<void>;
  addPagamento: (p: Omit<Pagamento, 'id' | 'createdAt'>) => Promise<void>;
  updatePagamento: (id: string, p: Partial<Pagamento>) => Promise<void>;
  deletePagamento: (id: string) => Promise<void>;
  getTotalRecebido: (anoAcademico?: string) => number;
  getTotalPendente: (anoAcademico?: string) => number;
  getPagamentosAluno: (alunoId: string) => Pagamento[];
  getTaxasByNivel: (nivel: string, anoAcademico?: string) => Taxa[];
  updateMultaConfig: (cfg: Partial<MultaConfig>) => Promise<void>;
  bloquearAluno: (alunoId: string) => Promise<void>;
  desbloquearAluno: (alunoId: string) => Promise<void>;
  isAlunoBloqueado: (alunoId: string) => boolean;
  enviarMensagem: (alunoId: string, texto: string, remetente: string, tipo?: MensagemFinanceira['tipo']) => Promise<void>;
  getMensagensAluno: (alunoId: string) => MensagemFinanceira[];
  marcarMensagemLida: (id: string) => Promise<void>;
  gerarRUPE: (alunoId: string, taxaId: string, valor: number) => Promise<RUPEGerado>;
  getRUPEsAluno: (alunoId: string) => RUPEGerado[];
  getMesesEmAtraso: (alunoId: string, anoAtual: string) => number;
  calcularMulta: (valorPropina: number, mesesAtraso: number) => number;
  getUnreadMensagensAluno: (alunoId: string) => number;
}

const FinanceiroContext = createContext<FinanceiroContextValue | null>(null);

const STORAGE_TAXAS = '@sgaa_taxas';
const STORAGE_PAGAMENTOS = '@sgaa_pagamentos';
const STORAGE_MULTA_CONFIG = '@sgaa_multa_config';
const STORAGE_MENSAGENS = '@sgaa_mensagens_financeiras';
const STORAGE_RUPES = '@sgaa_rupes';
const STORAGE_BLOQUEADOS = '@sgaa_bloqueados_financeiros';

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function formatAOA(valor: number): string {
  return valor.toLocaleString('pt-AO') + ' AOA';
}

const DEFAULT_MULTA_CONFIG: MultaConfig = {
  percentagem: 10,
  diasCarencia: 5,
  ativo: true,
};

export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [multaConfig, setMultaConfig] = useState<MultaConfig>(DEFAULT_MULTA_CONFIG);
  const [mensagens, setMensagens] = useState<MensagemFinanceira[]>([]);
  const [rupes, setRupes] = useState<RUPEGerado[]>([]);
  const [bloqueados, setBloqueados] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [t, p, mc, msg, r, bl] = await Promise.all([
        AsyncStorage.getItem(STORAGE_TAXAS),
        AsyncStorage.getItem(STORAGE_PAGAMENTOS),
        AsyncStorage.getItem(STORAGE_MULTA_CONFIG),
        AsyncStorage.getItem(STORAGE_MENSAGENS),
        AsyncStorage.getItem(STORAGE_RUPES),
        AsyncStorage.getItem(STORAGE_BLOQUEADOS),
      ]);
      setTaxas(t ? JSON.parse(t) : []);
      setPagamentos(p ? JSON.parse(p) : []);
      setMultaConfig(mc ? JSON.parse(mc) : DEFAULT_MULTA_CONFIG);
      setMensagens(msg ? JSON.parse(msg) : []);
      setRupes(r ? JSON.parse(r) : []);
      setBloqueados(bl ? JSON.parse(bl) : []);
    } catch (e) {
      setTaxas([]);
      setPagamentos([]);
      setMultaConfig(DEFAULT_MULTA_CONFIG);
      setMensagens([]);
      setRupes([]);
      setBloqueados([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function persistTaxas(data: Taxa[]) { await AsyncStorage.setItem(STORAGE_TAXAS, JSON.stringify(data)); }
  async function persistPagamentos(data: Pagamento[]) { await AsyncStorage.setItem(STORAGE_PAGAMENTOS, JSON.stringify(data)); }
  async function persistMensagens(data: MensagemFinanceira[]) { await AsyncStorage.setItem(STORAGE_MENSAGENS, JSON.stringify(data)); }
  async function persistRupes(data: RUPEGerado[]) { await AsyncStorage.setItem(STORAGE_RUPES, JSON.stringify(data)); }
  async function persistBloqueados(data: string[]) { await AsyncStorage.setItem(STORAGE_BLOQUEADOS, JSON.stringify(data)); }

  async function addTaxa(t: Omit<Taxa, 'id'>) {
    const novo: Taxa = { ...t, id: genId() };
    const updated = [...taxas, novo];
    setTaxas(updated);
    await persistTaxas(updated);
  }

  async function updateTaxa(id: string, t: Partial<Taxa>) {
    const updated = taxas.map(x => x.id === id ? { ...x, ...t } : x);
    setTaxas(updated);
    await persistTaxas(updated);
  }

  async function deleteTaxa(id: string) {
    const updated = taxas.filter(x => x.id !== id);
    setTaxas(updated);
    await persistTaxas(updated);
  }

  async function addPagamento(p: Omit<Pagamento, 'id' | 'createdAt'>) {
    const novo: Pagamento = { ...p, id: genId(), createdAt: new Date().toISOString() };
    const updated = [...pagamentos, novo];
    setPagamentos(updated);
    await persistPagamentos(updated);
  }

  async function updatePagamento(id: string, p: Partial<Pagamento>) {
    const updated = pagamentos.map(x => x.id === id ? { ...x, ...p } : x);
    setPagamentos(updated);
    await persistPagamentos(updated);
  }

  async function deletePagamento(id: string) {
    const updated = pagamentos.filter(x => x.id !== id);
    setPagamentos(updated);
    await persistPagamentos(updated);
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
    await AsyncStorage.setItem(STORAGE_MULTA_CONFIG, JSON.stringify(updated));
  }

  async function bloquearAluno(alunoId: string) {
    if (bloqueados.includes(alunoId)) return;
    const updated = [...bloqueados, alunoId];
    setBloqueados(updated);
    await persistBloqueados(updated);
  }

  async function desbloquearAluno(alunoId: string) {
    const updated = bloqueados.filter(id => id !== alunoId);
    setBloqueados(updated);
    await persistBloqueados(updated);
  }

  function isAlunoBloqueado(alunoId: string) {
    return bloqueados.includes(alunoId);
  }

  async function enviarMensagem(alunoId: string, texto: string, remetente: string, tipo: MensagemFinanceira['tipo'] = 'geral') {
    const nova: MensagemFinanceira = {
      id: genId(),
      alunoId,
      remetente,
      texto,
      data: new Date().toISOString(),
      lida: false,
      tipo,
    };
    const updated = [...mensagens, nova];
    setMensagens(updated);
    await persistMensagens(updated);
  }

  function getMensagensAluno(alunoId: string) {
    return mensagens.filter(m => m.alunoId === alunoId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  async function marcarMensagemLida(id: string) {
    const updated = mensagens.map(m => m.id === id ? { ...m, lida: true } : m);
    setMensagens(updated);
    await persistMensagens(updated);
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

    const novo: RUPEGerado = {
      id: genId(),
      alunoId,
      taxaId,
      valor,
      referencia,
      dataGeracao: dataGeracao.toISOString(),
      dataValidade: dataValidade.toISOString(),
      status: 'ativo',
    };
    const updated = [...rupes, novo];
    setRupes(updated);
    await persistRupes(updated);
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
    return Math.round(valorPropina * (multaConfig.percentagem / 100) * mesesAtraso);
  }

  const value = useMemo<FinanceiroContextValue>(() => ({
    taxas, pagamentos, multaConfig, mensagens, rupes, bloqueados, isLoading,
    addTaxa, updateTaxa, deleteTaxa,
    addPagamento, updatePagamento, deletePagamento,
    getTotalRecebido, getTotalPendente, getPagamentosAluno, getTaxasByNivel,
    updateMultaConfig,
    bloquearAluno, desbloquearAluno, isAlunoBloqueado,
    enviarMensagem, getMensagensAluno, marcarMensagemLida, getUnreadMensagensAluno,
    gerarRUPE, getRUPEsAluno,
    getMesesEmAtraso, calcularMulta,
  }), [taxas, pagamentos, multaConfig, mensagens, rupes, bloqueados, isLoading]);

  return <FinanceiroContext.Provider value={value}>{children}</FinanceiroContext.Provider>;
}

export function useFinanceiro() {
  const ctx = useContext(FinanceiroContext);
  if (!ctx) throw new Error('useFinanceiro must be used within FinanceiroProvider');
  return ctx;
}
