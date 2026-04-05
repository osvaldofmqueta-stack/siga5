import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TipoPlano = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'avaliacao';
export type TipoNivel = 'prata' | 'ouro' | 'rubi';

export interface CodigoAtivacao {
  id: string;
  codigo: string;
  plano: TipoPlano;
  nivel: TipoNivel;
  diasValidade: number;
  precoPorAluno: number;
  totalAlunos: number;
  valorTotal: number;
  creditoAplicado: number;
  valorFinal: number;
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
  nivel: TipoNivel;
  dataAtivacao: string;
  dataExpiracao: string;
  saldo: number;
  saldoCreditoAcumulado: number;
  escolaNome: string;
}

interface LicenseContextValue {
  licenca: LicencaAtiva | null;
  codigosGerados: CodigoAtivacao[];
  isLicencaValida: boolean;
  diasRestantes: number;
  isLoading: boolean;
  ativarLicenca: (codigo: string, escolaNome: string) => Promise<{ sucesso: boolean; mensagem: string }>;
  gerarCodigo: (
    plano: TipoPlano,
    nivel: TipoNivel,
    precoPorAluno: number,
    totalAlunos: number,
    creditoAplicado: number,
    notas?: string
  ) => Promise<CodigoAtivacao>;
  revogarCodigo: (id: string) => Promise<void>;
  adicionarSaldo: (valor: number) => Promise<void>;
  consumirSaldo: (valor: number) => Promise<boolean>;
  adicionarCreditoAcumulado: (valor: number) => Promise<void>;
  isFeatureAvailableForNivel: (key: string) => boolean;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

const STORAGE_LICENCA = '@siga_licenca';
const STORAGE_CODIGOS = '@siga_codigos_ceo';

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

export const NIVEL_LABEL: Record<TipoNivel, string> = {
  prata: 'Prata',
  ouro: 'Ouro',
  rubi: 'Rubi',
};

export const NIVEL_COLOR: Record<TipoNivel, string> = {
  prata: '#94A3B8',
  ouro: '#F59E0B',
  rubi: '#DC2626',
};

export const NIVEL_EMOJI: Record<TipoNivel, string> = {
  prata: '🥈',
  ouro: '🥇',
  rubi: '💎',
};

export const NIVEL_DESC: Record<TipoNivel, string> = {
  prata: 'Gestão académica básica para escolas em início',
  ouro: 'Funcionalidades intermédias com financeiro e RH',
  rubi: 'Acesso completo a todas as funcionalidades',
};

export const PRECO_POR_ALUNO_DEFAULT = 50;

export const NIVEL_FEATURES: Record<TipoNivel, string[]> = {
  prata: [
    'dashboard',
    'alunos',
    'professores',
    'turmas',
    'salas',
    'notas',
    'presencas',
    'horario',
    'secretaria_hub',
    'admissao',
    'editor_documentos',
    'boletim_matricula',
    'boletim_propina',
    'notificacoes',
    'portal_estudante',
    'gestao_academica',
    'gerar_documento',
    'documentos_hub',
    'professor_hub',
    'professor_turmas',
    'professor_pauta',
    'professor_sumario',
    'professor_mensagens',
    'professor_materiais',
    'eventos',
    'portal_encarregado',
  ],
  ouro: [
    'dashboard',
    'alunos',
    'professores',
    'turmas',
    'salas',
    'notas',
    'presencas',
    'horario',
    'secretaria_hub',
    'admissao',
    'editor_documentos',
    'boletim_matricula',
    'boletim_propina',
    'notificacoes',
    'portal_estudante',
    'gestao_academica',
    'gerar_documento',
    'documentos_hub',
    'professor_hub',
    'professor_turmas',
    'professor_pauta',
    'professor_sumario',
    'professor_mensagens',
    'professor_materiais',
    'eventos',
    'portal_encarregado',
    'ceo_dashboard',
    'financeiro',
    'pagamentos_hub',
    'extrato_propinas',
    'financeiro_relatorios',
    'biblioteca',
    'transferencias',
    'historico',
    'grelha',
    'disciplinas',
    'quadro_honra',
    'exclusoes_faltas',
    'diario_classe',
    'director_turma',
    'relatorio_faltas',
    'chat_interno',
    'calendario_academico',
    'bolsas',
    'desempenho',
    'visao_geral',
    'relatorios',
    'rh_hub',
    'pedagogico',
    'plano_aula',
    'avaliacao_professores',
    'trabalhos_finais',
  ],
  rubi: [
    'dashboard',
    'alunos',
    'professores',
    'turmas',
    'salas',
    'notas',
    'presencas',
    'horario',
    'secretaria_hub',
    'admissao',
    'editor_documentos',
    'boletim_matricula',
    'boletim_propina',
    'notificacoes',
    'portal_estudante',
    'gestao_academica',
    'gerar_documento',
    'documentos_hub',
    'professor_hub',
    'professor_turmas',
    'professor_pauta',
    'professor_sumario',
    'professor_mensagens',
    'professor_materiais',
    'eventos',
    'portal_encarregado',
    'ceo_dashboard',
    'financeiro',
    'pagamentos_hub',
    'extrato_propinas',
    'financeiro_relatorios',
    'biblioteca',
    'transferencias',
    'historico',
    'grelha',
    'disciplinas',
    'quadro_honra',
    'exclusoes_faltas',
    'diario_classe',
    'director_turma',
    'relatorio_faltas',
    'chat_interno',
    'calendario_academico',
    'bolsas',
    'desempenho',
    'visao_geral',
    'relatorios',
    'rh_hub',
    'pedagogico',
    'plano_aula',
    'avaliacao_professores',
    'trabalhos_finais',
    'rh_controle',
    'rh_payroll',
    'auditoria',
    'controlo_supervisao',
    'gestao_acessos',
    'admin',
  ],
};

function genCodigo(nivel: TipoNivel): string {
  const prefixo = 'SIGE';
  const niv = nivel === 'prata' ? 'PRA' : nivel === 'ouro' ? 'OUR' : 'RUB';
  const rand =
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefixo}-${niv}-${rand}`;
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
  nivel: 'rubi',
  dataAtivacao: today(),
  dataExpiracao: addDays(today(), 30),
  saldo: 100,
  saldoCreditoAcumulado: 0,
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

      if (rawLic) {
        const licLocal: LicencaAtiva = JSON.parse(rawLic);
        if (licLocal.codigoUsado !== 'AVALIACAO') {
          if (!licLocal.nivel) licLocal.nivel = 'rubi';
          if (!licLocal.saldoCreditoAcumulado) licLocal.saldoCreditoAcumulado = 0;
          setLicenca(licLocal);
          setIsLoading(false);
          return;
        }
      }

      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          if (config.licencaAtivacao && config.licencaExpiracao) {
            const licencaServidor: LicencaAtiva = {
              codigoUsado: 'AVALIACAO',
              plano: (config.licencaPlano as TipoPlano) || 'avaliacao',
              nivel: (config.licencaNivel as TipoNivel) || 'rubi',
              dataAtivacao: config.licencaAtivacao,
              dataExpiracao: config.licencaExpiracao,
              saldo: 100,
              saldoCreditoAcumulado: config.licencaSaldoCredito || 0,
              escolaNome: config.nomeEscola || '',
            };
            setLicenca(licencaServidor);
            await AsyncStorage.setItem(STORAGE_LICENCA, JSON.stringify(licencaServidor));
            setIsLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }

      const licencaInicial = rawLic ? { ...JSON.parse(rawLic), nivel: 'rubi', saldoCreditoAcumulado: 0 } : LICENCA_AVALIACAO;
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

  function isFeatureAvailableForNivel(key: string): boolean {
    if (!licenca) return false;
    if (licenca.codigoUsado === 'AVALIACAO') return true;
    const nivel = licenca.nivel || 'rubi';
    return NIVEL_FEATURES[nivel]?.includes(key) ?? true;
  }

  async function ativarLicenca(codigo: string, escolaNome: string): Promise<{ sucesso: boolean; mensagem: string }> {
    const codigoLimpo = codigo.trim().toUpperCase();
    const cod = codigosGerados.find(c => c.codigo === codigoLimpo);

    if (!cod) return { sucesso: false, mensagem: 'Código de activação inválido. Verifique e tente novamente.' };
    if (cod.usado) return { sucesso: false, mensagem: 'Este código já foi utilizado.' };
    if (diasAte(cod.dataExpiracaoCodigo) < 0) return { sucesso: false, mensagem: 'Este código expirou. Contacte o suporte QUETA.' };

    const novaLicenca: LicencaAtiva = {
      codigoUsado: codigoLimpo,
      plano: cod.plano,
      nivel: cod.nivel || 'rubi',
      dataAtivacao: today(),
      dataExpiracao: addDays(today(), cod.diasValidade),
      saldo: cod.saldoCreditos,
      saldoCreditoAcumulado: 0,
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

    const nivelLabel = NIVEL_LABEL[novaLicenca.nivel] || 'Rubi';
    return { sucesso: true, mensagem: `Licença activada! Plano ${nivelLabel} ${PLANO_LABEL[cod.plano]} — válida até ${novaLicenca.dataExpiracao}.` };
  }

  async function gerarCodigo(
    plano: TipoPlano,
    nivel: TipoNivel,
    precoPorAluno: number,
    totalAlunos: number,
    creditoAplicado: number,
    notas?: string
  ): Promise<CodigoAtivacao> {
    const valorTotal = precoPorAluno * totalAlunos;
    const valorFinal = Math.max(0, valorTotal - creditoAplicado);

    const novo: CodigoAtivacao = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      codigo: genCodigo(nivel),
      plano,
      nivel,
      diasValidade: PLANO_DIAS[plano],
      precoPorAluno,
      totalAlunos,
      valorTotal,
      creditoAplicado,
      valorFinal,
      saldoCreditos: 0,
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

  async function adicionarCreditoAcumulado(valor: number) {
    if (!licenca) return;
    const updated = { ...licenca, saldoCreditoAcumulado: (licenca.saldoCreditoAcumulado || 0) + valor };
    setLicenca(updated);
    await AsyncStorage.setItem(STORAGE_LICENCA, JSON.stringify(updated));
  }

  const value = useMemo<LicenseContextValue>(() => ({
    licenca, codigosGerados, isLicencaValida, diasRestantes, isLoading,
    ativarLicenca, gerarCodigo, revogarCodigo, adicionarSaldo, consumirSaldo,
    adicionarCreditoAcumulado, isFeatureAvailableForNivel,
  }), [licenca, codigosGerados, isLicencaValida, diasRestantes, isLoading]);

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
}

export { diasAte, today, addDays };
