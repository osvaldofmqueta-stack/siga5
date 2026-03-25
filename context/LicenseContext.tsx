import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TipoPlano = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'avaliacao';

export interface CodigoAtivacao {
  id: string;
  codigo: string;
  plano: TipoPlano;
  diasValidade: number;
  saldoCreditos: number;
  dataGeracao: string;
  dataExpiracaoCodigo: string;
  usado: boolean;
  usadoPor?: string;
  usadoEm?: string;
  notas?: string;
}

export interface LicencaAtiva {
  codigoUsado: string;
  plano: TipoPlano;
  dataAtivacao: string;
  dataExpiracao: string;
  saldo: number;
  escolaNome: string;
}

interface LicenseContextValue {
  licenca: LicencaAtiva | null;
  codigosGerados: CodigoAtivacao[];
  isLicencaValida: boolean;
  diasRestantes: number;
  isLoading: boolean;
  ativarLicenca: (codigo: string, escolaNome: string) => Promise<{ sucesso: boolean; mensagem: string }>;
  gerarCodigo: (plano: TipoPlano, saldo: number, notas?: string) => Promise<CodigoAtivacao>;
  revogarCodigo: (id: string) => Promise<void>;
  adicionarSaldo: (valor: number) => Promise<void>;
  consumirSaldo: (valor: number) => Promise<boolean>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

const STORAGE_LICENCA = '@sgaa_licenca';
const STORAGE_CODIGOS = '@sgaa_codigos_ceo';

export const PLANO_DIAS: Record<TipoPlano, number> = {
  avaliacao: 30,
  mensal: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

export const PLANO_LABEL: Record<TipoPlano, string> = {
  avaliacao: 'Avaliação',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

function genCodigo(plano: TipoPlano): string {
  const prefixo = 'SIGE';
  const tipo = plano.substring(0, 3).toUpperCase();
  const rand =
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefixo}-${tipo}-${rand}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function diasAte(dataExpiracao: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dataExpiracao);
  exp.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const LICENCA_AVALIACAO: LicencaAtiva = {
  codigoUsado: 'AVALIACAO',
  plano: 'avaliacao',
  dataAtivacao: today(),
  dataExpiracao: addDays(today(), 30),
  saldo: 100,
  escolaNome: '',
};

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [licenca, setLicenca] = useState<LicencaAtiva | null>(null);
  const [codigosGerados, setCodigosGerados] = useState<CodigoAtivacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [rawLic, rawCod] = await Promise.all([
        AsyncStorage.getItem(STORAGE_LICENCA),
        AsyncStorage.getItem(STORAGE_CODIGOS),
      ]);
      const codigosIniciais = rawCod ? JSON.parse(rawCod) : [];
      setCodigosGerados(codigosIniciais);
      if (!rawCod) await AsyncStorage.setItem(STORAGE_CODIGOS, JSON.stringify(codigosIniciais));

      // Se existe uma licença ativa (código de ativação usado), usa essa
      if (rawLic) {
        const licLocal: LicencaAtiva = JSON.parse(rawLic);
        // Só usa a licença local se não for a licença de avaliação padrão
        if (licLocal.codigoUsado !== 'AVALIACAO') {
          setLicenca(licLocal);
          setIsLoading(false);
          return;
        }
      }

      // Para a licença de avaliação, usa as datas guardadas no servidor
      // Isso garante que a contagem é precisa e não reset ao mudar de browser
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          if (config.licencaAtivacao && config.licencaExpiracao) {
            const licencaServidor: LicencaAtiva = {
              codigoUsado: 'AVALIACAO',
              plano: (config.licencaPlano as TipoPlano) || 'avaliacao',
              dataAtivacao: config.licencaAtivacao,
              dataExpiracao: config.licencaExpiracao,
              saldo: 100,
              escolaNome: config.nomeEscola || '',
            };
            setLicenca(licencaServidor);
            await AsyncStorage.setItem(STORAGE_LICENCA, JSON.stringify(licencaServidor));
            setIsLoading(false);
            return;
          }
        }
      } catch { /* fallback para local se servidor não responder */ }

      // Fallback: usa licença de avaliação local (sem contagem precisa)
      const licencaInicial = rawLic ? JSON.parse(rawLic) : LICENCA_AVALIACAO;
      setLicenca(licencaInicial);
      if (!rawLic) await AsyncStorage.setItem(STORAGE_LICENCA, JSON.stringify(licencaInicial));
    } catch (e) {
      console.error('LicenseContext load error', e);
      setLicenca(LICENCA_AVALIACAO);
    } finally {
      setIsLoading(false);
    }
  }

  const isLicencaValida = useMemo(() => {
    if (!licenca) return false;
    return diasAte(licenca.dataExpiracao) >= 0;
  }, [licenca]);

  const diasRestantes = useMemo(() => {
    if (!licenca) return 0;
    return Math.max(0, diasAte(licenca.dataExpiracao));
  }, [licenca]);

  async function ativarLicenca(codigo: string, escolaNome: string): Promise<{ sucesso: boolean; mensagem: string }> {
    const codigoLimpo = codigo.trim().toUpperCase();
    const cod = codigosGerados.find(c => c.codigo === codigoLimpo);

    if (!cod) return { sucesso: false, mensagem: 'Código de activação inválido. Verifique e tente novamente.' };
    if (cod.usado) return { sucesso: false, mensagem: 'Este código já foi utilizado.' };
    if (diasAte(cod.dataExpiracaoCodigo) < 0) return { sucesso: false, mensagem: 'Este código expirou. Contacte o suporte SIGE.' };

    const novaLicenca: LicencaAtiva = {
      codigoUsado: codigoLimpo,
      plano: cod.plano,
      dataAtivacao: today(),
      dataExpiracao: addDays(today(), cod.diasValidade),
      saldo: cod.saldoCreditos,
      escolaNome,
    };

    const codigosActualizados = codigosGerados.map(c =>
      c.id === cod.id ? { ...c, usado: true, usadoPor: escolaNome, usadoEm: today() } : c
    );

    await Promise.all([
      AsyncStorage.setItem(STORAGE_LICENCA, JSON.stringify(novaLicenca)),
      AsyncStorage.setItem(STORAGE_CODIGOS, JSON.stringify(codigosActualizados)),
    ]);
    setLicenca(novaLicenca);
    setCodigosGerados(codigosActualizados);

    return { sucesso: true, mensagem: `Licença activada! ${PLANO_LABEL[cod.plano]} — válida até ${novaLicenca.dataExpiracao}.` };
  }

  async function gerarCodigo(plano: TipoPlano, saldo: number, notas?: string): Promise<CodigoAtivacao> {
    const novo: CodigoAtivacao = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      codigo: genCodigo(plano),
      plano,
      diasValidade: PLANO_DIAS[plano],
      saldoCreditos: saldo,
      dataGeracao: today(),
      dataExpiracaoCodigo: addDays(today(), 30),
      usado: false,
      notas: notas || '',
    };
    const updated = [...codigosGerados, novo];
    setCodigosGerados(updated);
    await AsyncStorage.setItem(STORAGE_CODIGOS, JSON.stringify(updated));
    return novo;
  }

  async function revogarCodigo(id: string) {
    const updated = codigosGerados.filter(c => c.id !== id);
    setCodigosGerados(updated);
    await AsyncStorage.setItem(STORAGE_CODIGOS, JSON.stringify(updated));
  }

  async function adicionarSaldo(valor: number) {
    if (!licenca) return;
    const updated = { ...licenca, saldo: licenca.saldo + valor };
    setLicenca(updated);
    await AsyncStorage.setItem(STORAGE_LICENCA, JSON.stringify(updated));
  }

  async function consumirSaldo(valor: number): Promise<boolean> {
    if (!licenca || licenca.saldo < valor) return false;
    const updated = { ...licenca, saldo: licenca.saldo - valor };
    setLicenca(updated);
    await AsyncStorage.setItem(STORAGE_LICENCA, JSON.stringify(updated));
    return true;
  }

  const value = useMemo<LicenseContextValue>(() => ({
    licenca, codigosGerados, isLicencaValida, diasRestantes, isLoading,
    ativarLicenca, gerarCodigo, revogarCodigo, adicionarSaldo, consumirSaldo,
  }), [licenca, codigosGerados, isLicencaValida, diasRestantes, isLoading]);

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
}

export { diasAte, today, addDays };
