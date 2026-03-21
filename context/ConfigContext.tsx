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
  horarioFuncionamento: string;
  flashScreen: FlashScreenConfig;
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
          horarioFuncionamento: (raw.horarioFuncionamento as string) || DEFAULT_CONFIG.horarioFuncionamento,
          flashScreen: { ...DEFAULT_FLASH, ...((raw.flashScreen as Partial<FlashScreenConfig>) || {}) },
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
