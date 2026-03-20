import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  pp1Habilitado: boolean;
  pptHabilitado: boolean;
  notaMinimaAprovacao: number;
  maxAlunosTurma: number;
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
  horarioFuncionamento: 'Seg-Sex: 07:00-19:00 | Sáb: 07:00-13:00',
  flashScreen: DEFAULT_FLASH,
};

interface ConfigContextValue {
  config: ConfigGeral;
  updateConfig: (updates: Partial<ConfigGeral>) => Promise<void>;
  updateFlashScreen: (updates: Partial<FlashScreenConfig>) => Promise<void>;
  isLoading: boolean;
}

const CONFIG_KEY = '@sgaa_config_geral';

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigGeral>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(CONFIG_KEY)
      .then(raw => {
        if (raw) {
          const parsed = JSON.parse(raw);
          setConfig({ ...DEFAULT_CONFIG, ...parsed, flashScreen: { ...DEFAULT_FLASH, ...(parsed.flashScreen || {}) } });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function updateConfig(updates: Partial<ConfigGeral>) {
    const next = { ...config, ...updates };
    setConfig(next);
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  }

  async function updateFlashScreen(updates: Partial<FlashScreenConfig>) {
    const next = { ...config, flashScreen: { ...config.flashScreen, ...updates } };
    setConfig(next);
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(next));
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
