import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TipoTaxa = 'propina' | 'matricula' | 'material' | 'exame' | 'outro';
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

interface FinanceiroContextValue {
  taxas: Taxa[];
  pagamentos: Pagamento[];
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
}

const FinanceiroContext = createContext<FinanceiroContextValue | null>(null);

const STORAGE_TAXAS = '@sgaa_taxas';
const STORAGE_PAGAMENTOS = '@sgaa_pagamentos';

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function formatAOA(valor: number): string {
  return valor.toLocaleString('pt-AO') + ' AOA';
}


export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [t, p] = await Promise.all([
        AsyncStorage.getItem(STORAGE_TAXAS),
        AsyncStorage.getItem(STORAGE_PAGAMENTOS),
      ]);
      setTaxas(t ? JSON.parse(t) : []);
      setPagamentos(p ? JSON.parse(p) : []);
    } catch (e) {
      setTaxas([]);
      setPagamentos([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function persistTaxas(data: Taxa[]) { await AsyncStorage.setItem(STORAGE_TAXAS, JSON.stringify(data)); }
  async function persistPagamentos(data: Pagamento[]) { await AsyncStorage.setItem(STORAGE_PAGAMENTOS, JSON.stringify(data)); }

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

  const value = useMemo<FinanceiroContextValue>(() => ({
    taxas, pagamentos, isLoading,
    addTaxa, updateTaxa, deleteTaxa,
    addPagamento, updatePagamento, deletePagamento,
    getTotalRecebido, getTotalPendente, getPagamentosAluno, getTaxasByNivel,
  }), [taxas, pagamentos, isLoading]);

  return <FinanceiroContext.Provider value={value}>{children}</FinanceiroContext.Provider>;
}

export function useFinanceiro() {
  const ctx = useContext(FinanceiroContext);
  if (!ctx) throw new Error('useFinanceiro must be used within FinanceiroProvider');
  return ctx;
}
