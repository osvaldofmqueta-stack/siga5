import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { api } from '../lib/api';
import { showToast } from '../utils/toast';

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

export interface IrtEscalao {
  max: number | null;
  taxa: number;
  baseFixa: number;
  limiteAnterior: number;
}

export interface ConfigGeral {
  nomeEscola: string;
  codigoMED?: string;
  morada?: string;
  municipio?: string;
  provincia?: string;
  telefoneEscola?: string;
  emailEscola?: string;
  subdirectorPedagogico?: string;
  logoUrl?: string;
  pp1Habilitado: boolean;
  pptHabilitado: boolean;
  notaMinimaAprovacao: number;
  maxAlunosTurma: number;
  minTurmasProfessor: number;
  maxTurmasProfessor: number;
  maxDisciplinasPorProfessor: number;
  numAvaliacoes: number;
  macMin: number;
  macMax: number;
  horarioFuncionamento: string;
  flashScreen: FlashScreenConfig;
  directorGeral?: string;
  directorPedagogico?: string;
  directorProvincialEducacao?: string;
  propinaHabilitada: boolean;
  numeroEntidade?: string;
  iban?: string;
  nomeBeneficiario?: string;
  bancoTransferencia?: string;
  telefoneMulticaixaExpress?: string;
  nib?: string;
  prazosLancamento?: { t1?: string; t2?: string; t3?: string };
  // Taxas salariais
  inssEmpPerc: number;
  inssPatrPerc: number;
  irtTabela: IrtEscalao[];
  // Meses do ano académico (números: 9=Set, 10=Out, ...)
  mesesAnoAcademico: number[];
  // Exame Antecipado — alunos com negativa em disciplina terminal podem fazer exame sem arrastar para o próximo ano
  exameAntecipadoHabilitado: boolean;
  // PAP — Prova de Aptidão Profissional (13ª Classe)
  papHabilitado: boolean;
  estagioComoDisciplina: boolean;
  papDisciplinasContribuintes: string[];
  inscricoesAbertas: boolean;
  inscricaoDataInicio?: string;
  inscricaoDataFim?: string;
  exclusaoDuasReprovacoes: boolean;
  // Visibilidade global das notas no portal do estudante
  notasVisiveis: boolean;
  // Schedule periods stored in DB (replaces AsyncStorage)
  periodosHorario?: { numero: number; inicio: string; fim: string }[];
  // Last backup timestamp stored in DB (replaces localStorage)
  ultimoBackup?: string;
  // Período de avaliação distribuída de professores
  avaliacaoPeriodoAtivo: boolean;
  avaliacaoPeriodoInicio?: string;
  avaliacaoPeriodoFim?: string;
  avaliacaoPeriodoLabel?: string;
  // Pagamentos Online — EMIS/Multicaixa
  emisHabilitado?: boolean;
  emisAmbiente?: 'sandbox' | 'producao';
  emisProvedor?: string;
  emisProvedorCustomCode?: string;
  emisEntidadeId?: string;
  emisApiKey?: string;
  emisApiUrl?: string;
  emisPrazoPagamento?: number;
  emisNotificarSMS?: boolean;
  // ─── Sistema de Avaliação — Percentagens das Provas ───────────────────────
  percMac: number;        // % do MAC na Nota Trimestral (default 30)
  percPp: number;         // % da PP na Nota Trimestral (default 70)
  percNt: number;         // % da NT na NF para T1/T2 (default 60)
  percPt: number;         // % da PT na NF para T1/T2 (default 40)
  percPg: number;         // % de cada Prova Global na NF para T3 10ª/11ª (default 40)
  percExame: number;      // % de cada Exame na NF para T3 12ª Classe (default 40)
  provaRecuperacaoHabilitada: boolean;
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

const DEFAULT_IRT: IrtEscalao[] = [
  { max: 70000,    taxa: 0,    baseFixa: 0,      limiteAnterior: 0 },
  { max: 100000,   taxa: 0.10, baseFixa: 0,      limiteAnterior: 70000 },
  { max: 150000,   taxa: 0.13, baseFixa: 3000,   limiteAnterior: 100000 },
  { max: 200000,   taxa: 0.16, baseFixa: 9500,   limiteAnterior: 150000 },
  { max: 300000,   taxa: 0.18, baseFixa: 17500,  limiteAnterior: 200000 },
  { max: 500000,   taxa: 0.19, baseFixa: 35500,  limiteAnterior: 300000 },
  { max: 1000000,  taxa: 0.20, baseFixa: 73500,  limiteAnterior: 500000 },
  { max: null,     taxa: 0.25, baseFixa: 173500, limiteAnterior: 1000000 },
];

const DEFAULT_CONFIG: ConfigGeral = {
  nomeEscola: 'Escola QUETA',
  propinaHabilitada: true,
  pp1Habilitado: true,
  pptHabilitado: true,
  notaMinimaAprovacao: 10,
  maxAlunosTurma: 35,
  minTurmasProfessor: 1,
  maxTurmasProfessor: 8,
  maxDisciplinasPorProfessor: 5,
  numAvaliacoes: 4,
  macMin: 1,
  macMax: 5,
  horarioFuncionamento: 'Seg-Sex: 07:00-19:00 | Sáb: 07:00-13:00',
  flashScreen: DEFAULT_FLASH,
  inssEmpPerc: 3,
  inssPatrPerc: 8,
  irtTabela: DEFAULT_IRT,
  mesesAnoAcademico: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7],
  exameAntecipadoHabilitado: false,
  papHabilitado: false,
  estagioComoDisciplina: false,
  papDisciplinasContribuintes: [],
  inscricoesAbertas: false,
  exclusaoDuasReprovacoes: false,
  notasVisiveis: false,
  avaliacaoPeriodoAtivo: false,
  percMac: 30,
  percPp: 70,
  percNt: 60,
  percPt: 40,
  percPg: 40,
  percExame: 40,
  provaRecuperacaoHabilitada: false,
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
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<Record<string, unknown>>('/api/config')
      .then(raw => {
        const parsed: ConfigGeral = {
          nomeEscola: (raw.nomeEscola as string) || DEFAULT_CONFIG.nomeEscola,
          codigoMED: (raw.codigoMED as string) || undefined,
          morada: (raw.morada as string) || undefined,
          municipio: (raw.municipio as string) || undefined,
          provincia: (raw.provincia as string) || undefined,
          telefoneEscola: (raw.telefoneEscola as string) || undefined,
          emailEscola: (raw.emailEscola as string) || undefined,
          subdirectorPedagogico: (raw.subdirectorPedagogico as string) || undefined,
          logoUrl: raw.logoUrl as string | undefined,
          propinaHabilitada: raw.propinaHabilitada !== undefined ? Boolean(raw.propinaHabilitada) : DEFAULT_CONFIG.propinaHabilitada,
          pp1Habilitado: raw.pp1Habilitado !== undefined ? Boolean(raw.pp1Habilitado) : DEFAULT_CONFIG.pp1Habilitado,
          pptHabilitado: raw.pptHabilitado !== undefined ? Boolean(raw.pptHabilitado) : DEFAULT_CONFIG.pptHabilitado,
          notaMinimaAprovacao: (raw.notaMinimaAprovacao as number) ?? DEFAULT_CONFIG.notaMinimaAprovacao,
          maxAlunosTurma: (raw.maxAlunosTurma as number) ?? DEFAULT_CONFIG.maxAlunosTurma,
          minTurmasProfessor: (raw.minTurmasProfessor as number) ?? DEFAULT_CONFIG.minTurmasProfessor,
          maxTurmasProfessor: (raw.maxTurmasProfessor as number) ?? DEFAULT_CONFIG.maxTurmasProfessor,
          maxDisciplinasPorProfessor: (raw.maxDisciplinasPorProfessor as number) ?? DEFAULT_CONFIG.maxDisciplinasPorProfessor,
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
          inssEmpPerc: (raw.inssEmpPerc as number) ?? DEFAULT_CONFIG.inssEmpPerc,
          inssPatrPerc: (raw.inssPatrPerc as number) ?? DEFAULT_CONFIG.inssPatrPerc,
          irtTabela: Array.isArray(raw.irtTabela) && (raw.irtTabela as any[]).length > 0
            ? (raw.irtTabela as IrtEscalao[])
            : DEFAULT_IRT,
          mesesAnoAcademico: Array.isArray(raw.mesesAnoAcademico) && (raw.mesesAnoAcademico as any[]).length > 0
            ? (raw.mesesAnoAcademico as number[])
            : DEFAULT_CONFIG.mesesAnoAcademico,
          exameAntecipadoHabilitado: raw.exameAntecipadoHabilitado !== undefined ? Boolean(raw.exameAntecipadoHabilitado) : DEFAULT_CONFIG.exameAntecipadoHabilitado,
          papHabilitado: raw.papHabilitado !== undefined ? Boolean(raw.papHabilitado) : DEFAULT_CONFIG.papHabilitado,
          estagioComoDisciplina: raw.estagioComoDisciplina !== undefined ? Boolean(raw.estagioComoDisciplina) : DEFAULT_CONFIG.estagioComoDisciplina,
          papDisciplinasContribuintes: Array.isArray(raw.papDisciplinasContribuintes)
            ? (raw.papDisciplinasContribuintes as string[])
            : DEFAULT_CONFIG.papDisciplinasContribuintes,
          inscricoesAbertas: raw.inscricoesAbertas !== undefined ? Boolean(raw.inscricoesAbertas) : DEFAULT_CONFIG.inscricoesAbertas,
          inscricaoDataInicio: (raw.inscricaoDataInicio as string) || undefined,
          inscricaoDataFim: (raw.inscricaoDataFim as string) || undefined,
          exclusaoDuasReprovacoes: raw.exclusaoDuasReprovacoes !== undefined ? Boolean(raw.exclusaoDuasReprovacoes) : DEFAULT_CONFIG.exclusaoDuasReprovacoes,
          notasVisiveis: raw.notasVisiveis !== undefined ? Boolean(raw.notasVisiveis) : DEFAULT_CONFIG.notasVisiveis,
          periodosHorario: Array.isArray(raw.periodosHorario) ? (raw.periodosHorario as { numero: number; inicio: string; fim: string }[]) : undefined,
          ultimoBackup: (raw.ultimoBackup as string) || undefined,
          avaliacaoPeriodoAtivo: raw.avaliacaoPeriodoAtivo !== undefined ? Boolean(raw.avaliacaoPeriodoAtivo) : false,
          avaliacaoPeriodoInicio: (raw.avaliacaoPeriodoInicio as string) || undefined,
          avaliacaoPeriodoFim: (raw.avaliacaoPeriodoFim as string) || undefined,
          avaliacaoPeriodoLabel: (raw.avaliacaoPeriodoLabel as string) || undefined,
          emisHabilitado: raw.emisHabilitado !== undefined ? Boolean(raw.emisHabilitado) : false,
          emisAmbiente: ((raw.emisAmbiente as string) === 'producao' ? 'producao' : 'sandbox') as 'sandbox' | 'producao',
          emisProvedor: (raw.emisProvedor as string) || undefined,
          emisProvedorCustomCode: (raw.emisProvedorCustomCode as string) || undefined,
          emisEntidadeId: (raw.emisEntidadeId as string) || undefined,
          emisApiKey: (raw.emisApiKey as string) || undefined,
          emisApiUrl: (raw.emisApiUrl as string) || undefined,
          emisPrazoPagamento: (raw.emisPrazoPagamento as number) ?? 24,
          emisNotificarSMS: raw.emisNotificarSMS !== undefined ? Boolean(raw.emisNotificarSMS) : true,
          percMac: (raw.percMac as number) ?? DEFAULT_CONFIG.percMac,
          percPp: (raw.percPp as number) ?? DEFAULT_CONFIG.percPp,
          percNt: (raw.percNt as number) ?? DEFAULT_CONFIG.percNt,
          percPt: (raw.percPt as number) ?? DEFAULT_CONFIG.percPt,
          percPg: (raw.percPg as number) ?? DEFAULT_CONFIG.percPg,
          percExame: (raw.percExame as number) ?? DEFAULT_CONFIG.percExame,
          provaRecuperacaoHabilitada: raw.provaRecuperacaoHabilitada !== undefined ? Boolean(raw.provaRecuperacaoHabilitada) : DEFAULT_CONFIG.provaRecuperacaoHabilitada,
        };
        setConfig(parsed);
      })
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setIsLoading(false));
  }, []);

  async function updateConfig(updates: Partial<ConfigGeral>) {
    const next = { ...config, ...updates };
    setConfig(next);
    try {
      await api.put('/api/config', next);
      // Debounce: só mostra o toast depois de 700ms sem nova alteração
      if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
      saveToastTimer.current = setTimeout(() => {
        showToast('Configuração guardada com sucesso', 'success');
      }, 700);
    } catch {
      showToast('Erro ao guardar configuração — verifique a ligação', 'error');
    }
  }

  async function updateFlashScreen(updates: Partial<FlashScreenConfig>) {
    const next = { ...config, flashScreen: { ...config.flashScreen, ...updates } };
    setConfig(next);
    try {
      await api.put('/api/config', next);
      if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
      saveToastTimer.current = setTimeout(() => {
        showToast('Configuração guardada com sucesso', 'success');
      }, 700);
    } catch {
      showToast('Erro ao guardar configuração — verifique a ligação', 'error');
    }
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

export function calcIRT(base: number, tabela: IrtEscalao[]): number {
  if (!tabela || tabela.length === 0) return 0;
  for (const escalao of tabela) {
    if (escalao.max === null || base <= escalao.max) {
      if (escalao.taxa === 0) return 0;
      return escalao.baseFixa + (base - escalao.limiteAnterior) * escalao.taxa;
    }
  }
  return 0;
}
