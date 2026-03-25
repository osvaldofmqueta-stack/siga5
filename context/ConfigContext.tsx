import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { api } from '../lib/api';

export interface FlashScreenConfig {
  ativa: boolean;
  titulo: string;
  mensagem: string;
  imagemUrl: string;
  duracao: number;
  bgColor: string;
  dataInicio: string;
  dataFim: string;
}

export interface ConfigGeral {
  nomeEscola: string;
  logoUrl?: string;
  pp1Habilitado: boolean;
  pptHabilitado: boolean;
  notaMinimaAprovacao: number;
  maxAlunosTurma: number;
  numAvaliacoes: number;
  macMin: number;
  macMax: number;
  horarioFuncionamento: string;
  flashScreen: FlashScreenConfig;
  directorGeral?: string;
  directorPedagogico?: string;
  directorProvincialEducacao?: string;
  // Dados bancários / pagamento
  numeroEntidade?: string;
  iban?: string;
  nomeBeneficiario?: string;
  bancoTransferencia?: string;
  telefoneMulticaixaExpress?: string;
  nib?: string;
  // Prazos de lançamento de notas por trimestre (YYYY-MM-DD)
  prazosLancamento?: { t1?: string; t2?: string; t3?: string };
}

const DEFAULT_FLASH: FlashScreenConfig = {
  ativa: false,
  titulo: '',
  mensagem: '',
  imagemUrl: '',
  duracao: 5,
  bgColor: '#0A1628',
  dataInicio: '',
  dataFim: '',
};

const DEFAULT_CONFIG: ConfigGeral = {
  nomeEscola: 'Escola Secundária N.º 1 de Luanda',
  pp1Habilitado: true,
  pptHabilitado: true,
  notaMinimaAprovacao: 10,
  maxAlunosTurma: 35,
  numAvaliacoes: 4,
  macMin: 1,
  macMax: 5,
  horarioFuncionamento: 'Seg-Sex: 07:00-19:00 | Sáb: 07:00-13:00',
  flashScreen: DEFAULT_FLASH,
};

interface ConfigContextValue {
  config: ConfigGeral;
  updateConfig: (updates: Partial<ConfigGeral>) => Promise<void>;
  updateFlashScreen: (updates: Partial<FlashScreenConfig>) => Promise<void>;
  isLoading: boolean;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigGeral>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, unknown>>('/api/config')
      .then(raw => {
        const parsed: ConfigGeral = {
          nomeEscola: (raw.nomeEscola as string) || DEFAULT_CONFIG.nomeEscola,
          logoUrl: raw.logoUrl as string | undefined,
          pp1Habilitado: raw.pp1Habilitado !== undefined ? Boolean(raw.pp1Habilitado) : DEFAULT_CONFIG.pp1Habilitado,
          pptHabilitado: raw.pptHabilitado !== undefined ? Boolean(raw.pptHabilitado) : DEFAULT_CONFIG.pptHabilitado,
          notaMinimaAprovacao: (raw.notaMinimaAprovacao as number) ?? DEFAULT_CONFIG.notaMinimaAprovacao,
          maxAlunosTurma: (raw.maxAlunosTurma as number) ?? DEFAULT_CONFIG.maxAlunosTurma,
          numAvaliacoes: (raw.numAvaliacoes as number) ?? DEFAULT_CONFIG.numAvaliacoes,
          macMin: (raw.macMin as number) ?? DEFAULT_CONFIG.macMin,
          macMax: (raw.macMax as number) ?? DEFAULT_CONFIG.macMax,
          horarioFuncionamento: (raw.horarioFuncionamento as string) || DEFAULT_CONFIG.horarioFuncionamento,
          flashScreen: { ...DEFAULT_FLASH, ...((raw.flashScreen as Partial<FlashScreenConfig>) || {}) },
          directorGeral: (raw.directorGeral as string) || undefined,
          directorPedagogico: (raw.directorPedagogico as string) || undefined,
          directorProvincialEducacao: (raw.directorProvincialEducacao as string) || undefined,
          numeroEntidade: (raw.numeroEntidade as string) || undefined,
          iban: (raw.iban as string) || undefined,
          nomeBeneficiario: (raw.nomeBeneficiario as string) || undefined,
          bancoTransferencia: (raw.bancoTransferencia as string) || undefined,
          telefoneMulticaixaExpress: (raw.telefoneMulticaixaExpress as string) || undefined,
          nib: (raw.nib as string) || undefined,
          prazosLancamento: (raw.prazosLancamento as { t1?: string; t2?: string; t3?: string }) || undefined,
        };
        setConfig(parsed);
      })
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setIsLoading(false));
  }, []);

  async function updateConfig(updates: Partial<ConfigGeral>) {
    const next = { ...config, ...updates };
    setConfig(next);
    await api.put('/api/config', next);
  }

  async function updateFlashScreen(updates: Partial<FlashScreenConfig>) {
    const next = { ...config, flashScreen: { ...config.flashScreen, ...updates } };
    setConfig(next);
    await api.put('/api/config', next);
  }

  const value = useMemo<ConfigContextValue>(
    () => ({ config, updateConfig, updateFlashScreen, isLoading }),
    [config, isLoading]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
