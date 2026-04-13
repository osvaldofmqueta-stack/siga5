import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  BackHandler
} from 'react-native';
import * as XLSX from 'xlsx';
import { useConfig } from '@/context/ConfigContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { webAlert } from '@/utils/webAlert';
import { useEnterToSave } from '@/hooks/useEnterToSave';

type Trimestre = 1 | 2 | 3;

interface NotaForm {
  alunoId: string;
  aval1: string;
  aval2: string;
  aval3: string;
  aval4: string;
  aval5: string;
  aval6: string;
  aval7: string;
  aval8: string;
  pp1: string;
  ppt: string;
  // 3º Trimestre — Classes de Transição (10ª/11ª)
  pg1: string;
  pg2: string;
  // 3º Trimestre — 12ª Classe
  ex1: string;
  ex2: string;
  // Prova de Recuperação (opcional)
  provaRecuperacao: string;
}

// Determina se a classe é de 12ª (usa Exame no 3º Trimestre)
function is12aClasse(classe?: string): boolean {
  if (!classe) return false;
  return classe.includes('12');
}

// Determina se a classe é de transição (10ª ou 11ª — usa Prova Global no 3º Trimestre)
function isClasseTransicao(classe?: string): boolean {
  if (!classe) return false;
  return classe.includes('10') || classe.includes('11');
}

interface PapForm {
  alunoId: string;
  notaEstagio: string;
  notaDefesa: string;
  notasDisciplinas: Record<string, string>;
  notaPAP: number | null;
}

interface SolicAvaliacao {
  id: string;
  professorId: string;
  professorNome: string;
  turmaId: string;
  turmaNome: string;
  disciplina: string;
  trimestre: number;
  tipoAvaliacao: string;
  motivo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  respondidoPor?: string;
  respondidoEm?: string;
  observacao?: string;
  createdAt: string;
}

// Tipos de avaliação que o professor pode solicitar abertura
const TIPOS_AVALIACAO_SOLIC = [
  { key: 'aval1', label: 'Avaliação 1 (A1)' },
  { key: 'aval2', label: 'Avaliação 2 (A2)' },
  { key: 'aval3', label: 'Avaliação 3 (A3)' },
  { key: 'aval4', label: 'Avaliação 4 (A4)' },
  { key: 'aval5', label: 'Avaliação 5 (A5)' },
  { key: 'aval6', label: 'Avaliação 6 (A6)' },
  { key: 'aval7', label: 'Avaliação 7 (A7)' },
  { key: 'aval8', label: 'Avaliação 8 (A8)' },
  { key: 'pp1', label: 'Prova do Professor (PP)' },
];

type AvalKey = 'aval1' | 'aval2' | 'aval3' | 'aval4' | 'aval5' | 'aval6' | 'aval7' | 'aval8';
const ALL_AVAL_KEYS: AvalKey[] = ['aval1', 'aval2', 'aval3', 'aval4', 'aval5', 'aval6', 'aval7', 'aval8'];

function calcMac(avais: number[]): number {
  const vals = avais.filter(v => v > 0);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

// Nota Trimestral = MAC * percMac% + PP * percPp%
function calcNT(mac: number, pp: number, percMac: number, percPp: number): number {
  return Math.round((mac * (percMac / 100) + pp * (percPp / 100)) * 10) / 10;
}

// Nota Final para T1 e T2: NT * percNt% + PT * percPt%
function calcNF_T1T2(nt: number, pt: number, percNt: number, percPt: number): number {
  return Math.round((nt * (percNt / 100) + pt * (percPt / 100)) * 10) / 10;
}

// Nota Final para T3 — Classes de Transição (10ª/11ª): NT * (100-2*percPg)% + PG1 * percPg% + PG2 * percPg%
function calcNF_T3Transicao(nt: number, pg1: number, pg2: number, percPg: number): number {
  const pPg = percPg / 100;
  const pNt = Math.max(0, 1 - 2 * pPg);
  return Math.round((nt * pNt + pg1 * pPg + pg2 * pPg) * 10) / 10;
}

// Nota Final para T3 — 12ª Classe: NT * (100-2*percExame)% + EX1 * percExame% + EX2 * percExame%
function calcNF_T3Exame(nt: number, ex1: number, ex2: number, percExame: number): number {
  const pEx = percExame / 100;
  const pNt = Math.max(0, 1 - 2 * pEx);
  return Math.round((nt * pNt + ex1 * pEx + ex2 * pEx) * 10) / 10;
}

// Compat: legado calcMt1 (mantido para mini-pauta)
function calcMt1(mac: number, pp1: number): number {
  return Math.round((mac * 0.3 + pp1 * 0.7) * 10) / 10;
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : Math.min(20, Math.max(0, n));
}

export default function ProfessorPautaScreen() {
  const { user } = useAuth();
  const { professores, turmas, alunos, notas, addNota, updateNota } = useData();
  const { pautas, solicitacoes, addPauta, updatePauta, getPautaByKey, addSolicitacao } = useProfessor();
  const { addNotificacao } = useNotificacoes();
  const { anoSelecionado } = useAnoAcademico();
  const { config } = useConfig();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const params = useLocalSearchParams<{ turmaId?: string; disciplina?: string; trimestre?: string }>();

  const [turmaId, setTurmaId] = useState(params.turmaId ? decodeURIComponent(params.turmaId) : '');
  const [disciplina, setDisciplina] = useState(params.disciplina ? decodeURIComponent(params.disciplina) : '');
  const [trimestre, setTrimestre] = useState<Trimestre>(params.trimestre ? (parseInt(params.trimestre) as Trimestre) : 1);
  const [step, setStep] = useState<'selecao' | 'pauta' | 'pap'>(
    params.turmaId && params.disciplina ? 'pauta' : 'selecao'
  );
  const [notasForms, setNotasForms] = useState<NotaForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSolicitModal, setShowSolicitModal] = useState(false);
  const [motivoSolicidade, setMotivoSolicidade] = useState('');
  const [editingAlunoId, setEditingAlunoId] = useState<string | null>(null);
  const [lancadoSet, setLancadoSet] = useState<Set<string>>(new Set());

  const [showTurmaList, setShowTurmaList] = useState(false);
  const [showDiscList, setShowDiscList] = useState(false);

  // PAP state
  const [papForms, setPapForms] = useState<PapForm[]>([]);
  const [papSaving, setPapSaving] = useState(false);

  // Tracks which fields are already saved/locked per student (alunoId → Set of field names)
  const [savedFields, setSavedFields] = useState<Record<string, Set<string>>>({});

  // Grade launch control — solicitacoes de avaliacao
  const [solicitacoesAvaliacao, setSolicitacoesAvaliacao] = useState<SolicAvaliacao[]>([]);
  const [showSolicAvalModal, setShowSolicAvalModal] = useState(false);
  const [solicAvalTipo, setSolicAvalTipo] = useState('');
  const [solicAvalMotivo, setSolicAvalMotivo] = useState('');
  const [sendingSolicAval, setSendingSolicAval] = useState(false);

  const prof = useMemo(() => professores.find(p => p.email === user?.email), [professores, user]);

  const isPrivilegedRole = !!user?.role && ['ceo', 'pca', 'admin', 'director', 'chefe_secretaria', 'pedagogico'].includes(user.role);

  // ── Grade Launch Control helpers ──────────────────────────────────────────
  const loadSolicAvaliacao = useCallback(async () => {
    if (!turmaId || !disciplina) return;
    try {
      const p = new URLSearchParams({ turmaId, disciplina, trimestre: String(trimestre) });
      const r = await fetch(`/api/solicitacoes-avaliacao?${p.toString()}`);
      if (r.ok) setSolicitacoesAvaliacao(await r.json());
    } catch {}
  }, [turmaId, disciplina, trimestre]);

  useEffect(() => {
    if (step === 'pauta') loadSolicAvaliacao();
  }, [step, loadSolicAvaliacao]);

  // Fields approved by privileged roles for this professor/turma/disciplina/trimestre
  const camposAprovados = useMemo(() => {
    if (isPrivilegedRole) return new Set<string>(['*']);
    return new Set(solicitacoesAvaliacao.filter(s => s.status === 'aprovado').map(s => s.tipoAvaliacao));
  }, [solicitacoesAvaliacao, isPrivilegedRole]);

  // Provas (pp1, ppt, pg1, pg2, ex1, ex2, provaRecuperacao) follow global calendar
  const PROVA_FIELDS = new Set(['pp1', 'ppt', 'pg1', 'pg2', 'ex1', 'ex2', 'provaRecuperacao']);

  function isAvalFieldOpen(field: string): boolean {
    if (isPrivilegedRole) return true;
    if (camposAprovados.has('*')) return true;
    if (PROVA_FIELDS.has(field)) return config.avaliacaoPeriodoAtivo === true;
    return camposAprovados.has(field);
  }

  async function submitSolicAvaliacao() {
    if (!prof || !turmaAtual || !solicAvalTipo) return;
    setSendingSolicAval(true);
    try {
      const r = await fetch('/api/solicitacoes-avaliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professorId: prof.id,
          professorNome: `${prof.nome} ${prof.apelido}`.trim(),
          turmaId,
          turmaNome: turmaAtual.nome,
          disciplina,
          trimestre,
          tipoAvaliacao: solicAvalTipo,
          motivo: solicAvalMotivo,
        }),
      });
      if (r.ok) {
        await loadSolicAvaliacao();
        setShowSolicAvalModal(false);
        setSolicAvalTipo('');
        setSolicAvalMotivo('');
        webAlert('Solicitação Enviada', 'O pedido de abertura foi enviado. Aguarde aprovação do responsável.');
      }
    } catch {
      webAlert('Erro', 'Não foi possível enviar a solicitação.');
    } finally {
      setSendingSolicAval(false);
    }
  }

  const minhasTurmas = useMemo(() => {
    if (isPrivilegedRole) return turmas.filter(t => t.ativo);
    return prof ? turmas.filter(t => prof.turmasIds.includes(t.id) && t.ativo) : [];
  }, [prof, turmas, isPrivilegedRole]);

  const turmaAtual = turmas.find(t => t.id === turmaId);

  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  useEffect(() => {
    if (!turmaId) {
      setDisciplinas(prof?.disciplinas || []);
      return;
    }
    fetch(`/api/turmas/${turmaId}/disciplinas`)
      .then(r => r.json())
      .then((list: { nome: string }[]) => {
        if (list && list.length > 0) {
          setDisciplinas(list.map(d => d.nome));
        } else {
          setDisciplinas(prof?.disciplinas || []);
        }
      })
      .catch(() => { setDisciplinas(prof?.disciplinas || []); });
  }, [turmaId, prof]);

  const alunosDaTurma = useMemo(() =>
    turmaId ? alunos.filter(a => a.turmaId === turmaId && a.ativo) : [],
    [turmaId, alunos]
  );

  const pautaAtual = useMemo(() =>
    turmaId && disciplina ? getPautaByKey(turmaId, disciplina, trimestre) : undefined,
    [pautas, turmaId, disciplina, trimestre]
  );

  const isPautaFechada = pautaAtual?.status === 'fechada';
  const isPendente = pautaAtual?.status === 'pendente_abertura';

  // PAP derived values — only for Técnico-Profissional courses
  const is13Classe = turmaAtual?.classe === '13ª Classe' || turmaAtual?.classe === '13';
  const isTecnicoProfissional = turmaAtual?.tipoEnsino === 'Técnico-Profissional';
  const isPapMode = is13Classe && config.papHabilitado && isTecnicoProfissional;
  const classeAtual = turmaAtual?.classe;
  const useProvGlobal = trimestre === 3 && isClasseTransicao(classeAtual);
  const useExame = trimestre === 3 && is12aClasse(classeAtual);
  const papDiscContribuintes: string[] = config.papDisciplinasContribuintes || [];
  const showEstagioField = !config.estagioComoDisciplina;

  function calcPapNota(form: PapForm): number | null {
    const defesa = parseFloat(form.notaDefesa.replace(',', '.'));
    if (isNaN(defesa)) return null;
    let soma = Math.min(20, Math.max(0, defesa));
    let divisor = 1; // start with defesa as 1 component
    // Always include estágio if present
    const e = parseFloat(form.notaEstagio.replace(',', '.'));
    if (!isNaN(e)) { soma += Math.min(20, Math.max(0, e)); divisor++; }
    // Add avg of contributing disciplines if any are filled
    const discVals = papDiscContribuintes.map(nome => {
      const v = parseFloat((form.notasDisciplinas[nome] || '').replace(',', '.'));
      return isNaN(v) ? null : Math.min(20, Math.max(0, v));
    }).filter((v): v is number => v !== null);
    if (discVals.length > 0) { soma += discVals.reduce((a, b) => a + b, 0) / discVals.length; divisor++; }
    return Math.round((soma / divisor) * 10) / 10;
  }

  function updatePapForm(alunoId: string, field: 'notaEstagio' | 'notaDefesa', value: string) {
    setPapForms(prev => prev.map(f => {
      if (f.alunoId !== alunoId) return f;
      const updated = { ...f, [field]: value };
      return { ...updated, notaPAP: calcPapNota(updated) };
    }));
  }

  function updatePapDisc(alunoId: string, discNome: string, value: string) {
    setPapForms(prev => prev.map(f => {
      if (f.alunoId !== alunoId) return f;
      const updated = { ...f, notasDisciplinas: { ...f.notasDisciplinas, [discNome]: value } };
      return { ...updated, notaPAP: calcPapNota(updated) };
    }));
  }

  async function iniciarPAP() {
    if (!turmaId || !prof) return;
    const anoLetivo = anoSelecionado?.ano || '2025';
    let existingPap: Record<string, { notaEstagio?: number; notaDefesa?: number; notasDisciplinas?: { nome: string; nota: number }[] }> = {};
    try {
      const resp = await fetch(`/api/pap-alunos?turmaId=${turmaId}&anoLetivo=${anoLetivo}`);
      if (resp.ok) {
        const data: { alunoId: string; notaEstagio?: number; notaDefesa?: number; notasDisciplinas?: { nome: string; nota: number }[] }[] = await resp.json();
        data.forEach(r => { existingPap[r.alunoId] = r; });
      }
    } catch {}

    const forms: PapForm[] = alunosDaTurma.map(aluno => {
      const ex = existingPap[aluno.id];
      const notasDisciplinas: Record<string, string> = {};
      papDiscContribuintes.forEach(nome => {
        const found = ex?.notasDisciplinas?.find((d: { nome: string; nota: number }) => d.nome === nome);
        notasDisciplinas[nome] = found ? String(found.nota) : '';
      });

      // When estágio is treated as a curriculum discipline, auto-load its NF from regular notas
      let notaEstagioValue = ex?.notaEstagio != null ? String(ex.notaEstagio) : '';
      if (config.estagioComoDisciplina) {
        const estagioNota = notas
          .filter(n =>
            n.alunoId === aluno.id &&
            n.turmaId === turmaId &&
            (n.disciplina.toLowerCase().includes('estágio') || n.disciplina.toLowerCase().includes('estagio'))
          )
          .sort((a, b) => ((b.nf ?? 0) - (a.nf ?? 0)))[0];
        if (estagioNota && (estagioNota.nf ?? 0) > 0) {
          notaEstagioValue = String(estagioNota.nf);
        }
      }

      const form: PapForm = {
        alunoId: aluno.id,
        notaEstagio: notaEstagioValue,
        notaDefesa: ex?.notaDefesa != null ? String(ex.notaDefesa) : '',
        notasDisciplinas,
        notaPAP: null,
      };
      form.notaPAP = calcPapNota(form);
      return form;
    });
    setPapForms(forms);
    setStep('pap');
  }

  async function guardarPAP() {
    if (!prof || !turmaAtual) return;
    setPapSaving(true);
    try {
      const anoLetivo = anoSelecionado?.ano || '2025';
      for (const form of papForms) {
        const disciplinasArr = papDiscContribuintes.map(nome => {
          const v = parseFloat((form.notasDisciplinas[nome] || '').replace(',', '.'));
          return { nome, nota: isNaN(v) ? 0 : Math.min(20, Math.max(0, v)) };
        }).filter(d => d.nota > 0);

        const estagio = parseFloat(form.notaEstagio.replace(',', '.'));
        const defesa = parseFloat(form.notaDefesa.replace(',', '.'));

        await fetch('/api/pap-alunos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alunoId: form.alunoId,
            turmaId,
            anoLetivo,
            professorId: prof.id,
            notaEstagio: isNaN(estagio) ? null : Math.min(20, Math.max(0, estagio)),
            notaDefesa: isNaN(defesa) ? null : Math.min(20, Math.max(0, defesa)),
            notasDisciplinas: disciplinasArr,
          }),
        });
      }
      webAlert('PAP Guardado', 'As notas PAP foram guardadas com sucesso.');
    } catch {
      webAlert('Erro', 'Não foi possível guardar as notas PAP.');
    } finally {
      setPapSaving(false);
    }
  }
  const temSolicPendente = solicitacoes.some(s => s.pautaId === pautaAtual?.id && s.status === 'pendente');

  // Verificar prazo de lançamento configurado pela direcção
  const prazoKey = `t${trimestre}` as 't1' | 't2' | 't3';
  const prazoData = config.prazosLancamento?.[prazoKey];
  const isPrazoExpirado = prazoData ? new Date() > new Date(prazoData + 'T23:59:59') : false;
  const isEditavel = !isPautaFechada && !isPendente && !isPrazoExpirado;

  // Block hardware back if pauta is aberta with unsaved changes
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (step === 'pauta' && pautaAtual?.status === 'aberta') {
          webAlert(
            'Pauta em Edição',
            'A pauta está aberta. Deseja fechar antes de sair?',
            [
              { text: 'Continuar a editar', style: 'cancel' },
              { text: 'Sair sem fechar', style: 'destructive', onPress: () => setStep('selecao') },
            ]
          );
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [step, pautaAtual])
  );

  function iniciarPauta() {
    if (!turmaId || !disciplina || (!prof && !isPrivilegedRole)) return;

    const notasExistentes = notas.filter(n =>
      n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === trimestre
    );

    // If the pauta was officially reopened (approved solicitation exists), unlock all fields
    const wasReopened = pautaAtual && solicitacoes.some(
      s => s.pautaId === pautaAtual.id && s.status === 'aprovada'
    );

    const newSavedFields: Record<string, Set<string>> = {};

    const forms: NotaForm[] = alunosDaTurma.map(aluno => {
      const nota = notasExistentes.find(n => n.alunoId === aluno.id);

      if (nota && !wasReopened) {
        const locked = new Set<string>();
        ALL_AVAL_KEYS.forEach(k => {
          const v = nota[k as keyof typeof nota] as number | null | undefined;
          if (v !== null && v !== undefined && v > 0) locked.add(k);
        });
        if (nota.pp1 !== null && nota.pp1 !== undefined && nota.pp1 > 0) locked.add('pp1');
        if (nota.ppt !== null && nota.ppt !== undefined && nota.ppt > 0) locked.add('ppt');
        if ((nota as any).pg1 > 0) locked.add('pg1');
        if ((nota as any).pg2 > 0) locked.add('pg2');
        if ((nota as any).ex1 > 0) locked.add('ex1');
        if ((nota as any).ex2 > 0) locked.add('ex2');
        if ((nota as any).provaRecuperacao > 0) locked.add('provaRecuperacao');
        newSavedFields[aluno.id] = locked;
      }

      return {
        alunoId: aluno.id,
        aval1: nota ? String(nota.aval1 ?? '') : '',
        aval2: nota ? String(nota.aval2 ?? '') : '',
        aval3: nota ? String(nota.aval3 ?? '') : '',
        aval4: nota ? String(nota.aval4 ?? '') : '',
        aval5: nota ? String(nota.aval5 ?? '') : '',
        aval6: nota ? String(nota.aval6 ?? '') : '',
        aval7: nota ? String(nota.aval7 ?? '') : '',
        aval8: nota ? String(nota.aval8 ?? '') : '',
        pp1: nota ? String(nota.pp1) : '',
        ppt: nota ? String(nota.ppt) : '',
        pg1: nota ? String((nota as any).pg1 ?? '') : '',
        pg2: nota ? String((nota as any).pg2 ?? '') : '',
        ex1: nota ? String((nota as any).ex1 ?? '') : '',
        ex2: nota ? String((nota as any).ex2 ?? '') : '',
        provaRecuperacao: nota ? String((nota as any).provaRecuperacao ?? '') : '',
      };
    });

    setSavedFields(newSavedFields);
    setNotasForms(forms);

    const initialLancado = new Set<string>(
      notasExistentes.filter(n => n.lancado).map(n => n.alunoId)
    );
    setLancadoSet(initialLancado);

    setStep('pauta');
  }

  function updateNotaForm(alunoId: string, field: keyof NotaForm, value: string) {
    setNotasForms(prev => prev.map(f => f.alunoId === alunoId ? { ...f, [field]: value } : f));
  }

  async function guardarNotas() {
    const lancadorId = prof?.id || user?.id || '';
    if (!lancadorId || !turmaAtual) return;
    setSaving(true);
    try {
      const notasExistentes = notas.filter(n =>
        n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === trimestre
      );

      const numAvais = config.numAvaliacoes ?? 4;
      const activeAvalKeys = ALL_AVAL_KEYS.slice(0, numAvais);
      const pMac = config.percMac ?? 30;
      const pPp = config.percPp ?? 70;
      const pNt = config.percNt ?? 60;
      const pPt = config.percPt ?? 40;
      const pPg = config.percPg ?? 40;
      const pEx = config.percExame ?? 40;

      for (const form of notasForms) {
        const alunoSaved = savedFields[form.alunoId] || new Set<string>();
        const notaExistente = notasExistentes.find(n => n.alunoId === form.alunoId);

        const avalValues = activeAvalKeys.map(k => {
          if (alunoSaved.has(k)) {
            return notaExistente ? (notaExistente[k as keyof typeof notaExistente] as number ?? 0) : parseNum(form[k]);
          }
          return parseNum(form[k]);
        });
        const pp = alunoSaved.has('pp1')
          ? (notaExistente?.pp1 ?? parseNum(form.pp1))
          : parseNum(form.pp1);

        const getField = (field: string, formVal: string) => {
          if (alunoSaved.has(field)) return (notaExistente as any)?.[field] ?? parseNum(formVal);
          return parseNum(formVal);
        };

        const mac = calcMac(avalValues);
        const nt = calcNT(mac, pp, pMac, pPp);

        let nf = 0;
        let ppt = 0;
        let pg1Val = 0, pg2Val = 0, ex1Val = 0, ex2Val = 0;

        if (useProvGlobal) {
          // 3º Trimestre — 10ª/11ª Classe: PP + PG1 + PG2
          pg1Val = getField('pg1', form.pg1);
          pg2Val = getField('pg2', form.pg2);
          nf = calcNF_T3Transicao(nt, pg1Val, pg2Val, pPg);
          ppt = 0;
        } else if (useExame) {
          // 3º Trimestre — 12ª Classe: PP + EX1 + EX2
          ex1Val = getField('ex1', form.ex1);
          ex2Val = getField('ex2', form.ex2);
          nf = calcNF_T3Exame(nt, ex1Val, ex2Val, pEx);
          ppt = 0;
        } else {
          // T1 e T2 (todas as classes) ou T3 sem classe especial: PP + PT
          ppt = getField('ppt', form.ppt);
          nf = calcNF_T1T2(nt, ppt, pNt, pPt);
        }

        const provaRec = getField('provaRecuperacao', form.provaRecuperacao);
        const mt1 = nt;

        const notaData: Record<string, unknown> = {
          alunoId: form.alunoId,
          turmaId,
          disciplina,
          trimestre,
          pp1: pp, ppt, mac1: mac, mt1, nf, mac,
          pg1: pg1Val, pg2: pg2Val,
          ex1: ex1Val, ex2: ex2Val,
          provaRecuperacao: provaRec,
          anoLetivo: anoSelecionado?.ano || '2025',
          professorId: lancadorId,
          data: new Date().toISOString().split('T')[0],
        };
        ALL_AVAL_KEYS.forEach((k, i) => {
          notaData[k] = i < numAvais ? avalValues[i] : 0;
        });

        if (notaExistente) {
          await updateNota(notaExistente.id, notaData);
        } else {
          await addNota(notaData);
        }
      }

      if (!pautaAtual) {
        await addPauta({
          turmaId,
          disciplina,
          trimestre,
          professorId: lancadorId,
          status: 'aberta',
          anoLetivo: anoSelecionado?.ano || '2025',
        });
      }

      webAlert('Notas guardadas', 'As notas foram guardadas com sucesso.');
    } catch (e) {
      webAlert('Erro', 'Não foi possível guardar as notas.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleLancado(alunoId: string) {
    const notaExistente = notas.find(n =>
      n.alunoId === alunoId && n.turmaId === turmaId &&
      n.disciplina === disciplina && n.trimestre === trimestre
    );
    if (!notaExistente) {
      webAlert('Aviso', 'Guarde as notas deste aluno antes de marcar como Publicado.');
      return;
    }
    const novoValor = !lancadoSet.has(alunoId);
    try {
      const resp = await fetch(`/api/notas/${notaExistente.id}/lancado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lancado: novoValor }),
      });
      if (!resp.ok) throw new Error('Falha na resposta do servidor');
      setLancadoSet(prev => {
        const next = new Set(prev);
        if (novoValor) next.add(alunoId); else next.delete(alunoId);
        return next;
      });
    } catch {
      webAlert('Erro', 'Não foi possível actualizar o estado de publicação.');
    }
  }

  async function fecharPauta() {
    if (!pautaAtual) {
      webAlert('Aviso', 'Guarde as notas primeiro antes de submeter a pauta.');
      return;
    }
    const totalAlunos = alunosDaTurma.length;
    const notasLancadas = notas.filter(n => n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === trimestre).length;
    const faltando = totalAlunos - notasLancadas;
    const avisoFaltando = faltando > 0
      ? `\n\n⚠️ Atenção: ${faltando} aluno(s) ainda não têm nota lançada.`
      : '\n\n✅ Todos os alunos têm notas lançadas.';
    webAlert(
      'Submeter Pauta',
      `Tem a certeza que deseja submeter e encerrar a pauta de ${disciplina} — ${turmaAtual?.nome} — ${trimestre}º Trimestre?${avisoFaltando}\n\nApós a submissão, as notas ficam encerradas e não poderão ser alteradas sem autorização da direcção.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Submeter Pauta',
          style: 'destructive',
          onPress: async () => {
            await updatePauta(pautaAtual.id, {
              status: 'fechada',
              dataFecho: new Date().toISOString(),
            });
            await addNotificacao({
              titulo: 'Pauta Submetida',
              mensagem: `Pauta de ${disciplina} (${turmaAtual?.nome}) — ${trimestre}º Trimestre foi submetida e encerrada com sucesso.`,
              tipo: 'sucesso',
              data: new Date().toISOString(),
            });
            webAlert('Pauta Submetida', 'A pauta foi submetida e encerrada com sucesso. Para reabrir, será necessário solicitar autorização à direcção.');
          },
        },
      ]
    );
  }

  async function solicitarReabertura() {
    if (!pautaAtual) return;
    const solicitanteId = prof?.id || user?.id || '';
    const solicitanteNome = prof ? `${prof.nome} ${prof.apelido}` : (user?.nome || 'Utilizador');
    if (!solicitanteId) return;
    if (!motivoSolicidade.trim()) {
      webAlert('Obrigatório', 'Indique o motivo do pedido de reabertura.');
      return;
    }
    await addSolicitacao({
      pautaId: pautaAtual.id,
      turmaId,
      turmaNome: turmaAtual?.nome || '',
      disciplina,
      trimestre,
      professorId: solicitanteId,
      professorNome: solicitanteNome,
      motivo: motivoSolicidade,
      status: 'pendente',
    });
    await updatePauta(pautaAtual.id, { status: 'pendente_abertura' });
    await addNotificacao({
      titulo: 'Solicitação Enviada',
      mensagem: `Pedido de reabertura da pauta de ${disciplina} (${turmaAtual?.nome}) enviado à direcção.`,
      tipo: 'aviso',
      data: new Date().toISOString(),
    });
    setMotivoSolicidade('');
    setShowSolicitModal(false);
    webAlert('Pedido Enviado', 'A sua solicitação de reabertura foi enviada. Aguarde a aprovação.');
  }

  function gerarHtmlMiniPauta(): string {
    const nomeEscola = config?.nomeEscola || 'Escola';
    const logoUrl = config?.logoUrl || '';
    const anoLetivo = anoSelecionado?.ano || '20__/20__';
    const profNome = prof ? `${prof.nome} ${prof.apelido}` : '____________________';
    const turmaObj = minhasTurmas.find(t => t.id === turmaId);
    const turmaNome = turmaObj?.nome || '—';
    const nivelClasse = turmaObj?.classe || '—';

    const rows = alunosDaTurma.map((aluno, idx) => {
      const get = (tr: number) => {
        const n = notas.find(n => n.alunoId === aluno.id && n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === tr);
        return n ? { mac: n.mac ?? n.mac1 ?? 0, npp: n.pp1 ?? 0, npt: n.ppt ?? 0, mt: n.mt1 ?? 0 } : null;
      };
      const t1 = get(1); const t2 = get(2); const t3 = get(3);
      const mts = [t1?.mt, t2?.mt, t3?.mt].filter((v): v is number => !!v && v > 0);
      const mfd = mts.length ? Math.round((mts.reduce((a, b) => a + b, 0) / mts.length) * 10) / 10 : null;
      const aprovado = mfd !== null ? (mfd >= (config?.notaMinimaAprovacao ?? 10) ? 'Aprovado' : 'Reprovado') : '';
      const fmt = (v: number | null | undefined) => v && v > 0 ? v.toFixed(1) : '';
      const bgEven = idx % 2 === 0 ? '#f9f9f0' : '#ffffff';
      return `<tr style="background:${bgEven}">
        <td style="text-align:center;font-size:11px;">${String(idx + 1).padStart(2, '0')}</td>
        <td style="font-size:11px;padding-left:4px;">${aluno.nome} ${aluno.apelido}</td>
        <td class="nc">${fmt(t1?.mac)}</td><td class="nc">${fmt(t1?.npp)}</td><td class="nc">${fmt(t1?.npt)}</td><td class="nc bold">${fmt(t1?.mt)}</td>
        <td class="nc">${fmt(t2?.mac)}</td><td class="nc">${fmt(t2?.npp)}</td><td class="nc">${fmt(t2?.npt)}</td><td class="nc bold">${fmt(t2?.mt)}</td>
        <td class="nc">${fmt(t3?.mac)}</td><td class="nc">${fmt(t3?.npp)}</td><td class="nc">${fmt(t3?.npt)}</td><td class="nc bold">${fmt(t3?.mt)}</td>
        <td class="nc bold" style="color:${mfd !== null && mfd >= (config?.notaMinimaAprovacao ?? 10) ? '#155724' : mfd !== null ? '#721c24' : '#000'};">${mfd !== null ? mfd.toFixed(1) : ''}</td>
        <td style="font-size:10px;text-align:center;">${aprovado}</td>
      </tr>`;
    });

    const emptyRows = Array.from({ length: Math.max(0, 45 - alunosDaTurma.length) }, (_, i) => {
      const bg = (alunosDaTurma.length + i) % 2 === 0 ? '#f9f9f0' : '#ffffff';
      return `<tr style="background:${bg};height:22px;"><td></td><td></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td></tr>`;
    });

    const dataHoje = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });

    return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Mini-Pauta · ${disciplina} · ${turmaNome}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Times New Roman',serif;background:#fff;color:#000;padding:16px 20px;font-size:12px;}
  .header{text-align:center;margin-bottom:10px;}
  .header img{width:70px;height:70px;object-fit:contain;margin-bottom:4px;}
  .header p{font-size:12px;line-height:1.5;}
  .header .title{font-size:16px;font-weight:bold;margin:4px 0;}
  .header .escola{font-size:13px;font-weight:bold;text-transform:uppercase;margin:2px 0;}
  .meta{display:flex;gap:16px;font-size:11px;font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin-bottom:0;}
  table{width:100%;border-collapse:collapse;font-size:10px;}
  th,td{border:1px solid #333;padding:2px 3px;}
  th{background:#c6efce;font-size:9px;font-weight:bold;text-align:center;white-space:nowrap;}
  th.hdr-tri{background:#1a6b3c;color:#fff;font-size:10px;}
  td.nc{text-align:center;font-size:10px;}
  td.bold{font-weight:bold;}
  .footer{margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;}
  .sig{text-align:center;}
  .sig-line{border-top:1px solid #000;margin-top:40px;padding-top:4px;font-size:11px;min-width:200px;}
  @media print{
    body{padding:8px 12px;}
    @page{size:A4 landscape;margin:8mm;}
    .no-print{display:none;}
  }
</style>
</head><body>
<div class="header">
  ${logoUrl ? `<img src="${logoUrl}" alt="Logo"/>` : ''}
  <p>REPÚBLICA DE ANGOLA</p>
  <p>MINISTÉRIO DA EDUCAÇÃO</p>
  <p class="title">MINI-PAUTA</p>
  <p class="escola">${nomeEscola}</p>
</div>
<div class="meta">
  <span>DISCIPLINA: <u>${disciplina}</u></span>
  <span>${nivelClasse}ª CLASSE</span>
  <span>TURMA: <u>${turmaNome}</u></span>
  <span>ANO LECTIVO: <u style="color:#c00;">${anoLetivo}</u></span>
</div>
<table>
  <thead>
    <tr>
      <th rowspan="2" style="width:28px;">Nº</th>
      <th rowspan="2" style="min-width:120px;text-align:left;">NOME COMPLETO</th>
      <th colspan="4" class="hdr-tri">1º TRIMESTRE</th>
      <th colspan="4" class="hdr-tri">2º TRIMESTRE</th>
      <th colspan="4" class="hdr-tri">3º TRIMESTRE</th>
      <th rowspan="2" style="width:32px;">MFD</th>
      <th rowspan="2" style="width:60px;">OBSERVAÇÃO</th>
    </tr>
    <tr>
      <th>MAC</th><th>NPP</th><th>NPT</th><th>MT1</th>
      <th>MAC</th><th>NPP</th><th>NPT</th><th>MT2</th>
      <th>MAC</th><th>NPP</th><th>NPT</th><th>MT3</th>
    </tr>
  </thead>
  <tbody>
    ${rows.join('\n')}
    ${emptyRows.join('\n')}
  </tbody>
</table>
<div class="footer">
  <span style="font-size:11px;">${nomeEscola}, ${dataHoje}.</span>
  <div class="sig">
    <div class="sig-line">O PROFESSOR<br/><strong>${profNome}</strong></div>
  </div>
</div>
<div class="no-print" style="text-align:center;margin-top:16px;">
  <button onclick="window.print()" style="padding:10px 32px;font-size:14px;background:#1a6b3c;color:#fff;border:none;border-radius:6px;cursor:pointer;">Imprimir / Guardar PDF</button>
</div>
</body></html>`;
  }

  function gerarExcelMiniPauta() {
    if (!turmaId || !disciplina) {
      webAlert('Atenção', 'Selecione a turma e disciplina antes de exportar.');
      return;
    }
    if (Platform.OS !== 'web') {
      webAlert('Indisponível', 'A exportação Excel está disponível na versão web do sistema.');
      return;
    }
    const turmaObj = minhasTurmas.find(t => t.id === turmaId);
    const turmaNome = turmaObj?.nome || '—';
    const nivelClasse = turmaObj?.classe || '—';
    const anoLetivo = anoSelecionado?.ano || '20__/20__';
    const profNome = prof ? `${prof.nome} ${prof.apelido}` : '—';
    const escola = config?.nomeEscola || 'Escola';
    const now = new Date();

    const header1 = ['REPÚBLICA DE ANGOLA — MINISTÉRIO DA EDUCAÇÃO'];
    const header2 = [`MINI-PAUTA — ${disciplina} — ${nivelClasse}ª Classe — Turma ${turmaNome}`];
    const header3 = [`Escola: ${escola}   Ano Lectivo: ${anoLetivo}   Professor(a): ${profNome}   Data: ${now.toLocaleDateString('pt-AO')}`];
    const emptyRow: string[] = [];
    const colHeader = ['Nº', 'Nome Completo', 'MAC T1', 'NPP T1', 'NPT T1', 'MT1', 'MAC T2', 'NPP T2', 'NPT T2', 'MT2', 'MAC T3', 'NPP T3', 'NPT T3', 'MT3', 'MFD', 'Observação'];

    const dataRows = alunosDaTurma.map((aluno, idx) => {
      const get = (tr: number) => {
        const n = notas.find(n => n.alunoId === aluno.id && n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === tr);
        return n ? { mac: n.mac ?? n.mac1 ?? 0, npp: n.pp1 ?? 0, npt: n.ppt ?? 0, mt: n.mt1 ?? 0 } : null;
      };
      const t1 = get(1); const t2 = get(2); const t3 = get(3);
      const mts = [t1?.mt, t2?.mt, t3?.mt].filter((v): v is number => !!v && v > 0);
      const mfd = mts.length ? Math.round((mts.reduce((a, b) => a + b, 0) / mts.length) * 10) / 10 : '';
      const fmt = (v: number | null | undefined) => v && v > 0 ? v : '';
      const aprovado = typeof mfd === 'number' ? (mfd >= (config?.notaMinimaAprovacao ?? 10) ? 'Aprovado' : 'Reprovado') : '';
      return [
        idx + 1, `${aluno.nome} ${aluno.apelido}`,
        fmt(t1?.mac), fmt(t1?.npp), fmt(t1?.npt), fmt(t1?.mt),
        fmt(t2?.mac), fmt(t2?.npp), fmt(t2?.npt), fmt(t2?.mt),
        fmt(t3?.mac), fmt(t3?.npp), fmt(t3?.npt), fmt(t3?.mt),
        mfd, aprovado,
      ];
    });

    const wb = XLSX.utils.book_new();
    const wsData = [header1, header2, header3, emptyRow, colHeader, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 15 } },
    ];
    ws['!cols'] = [{ wch: 5 }, { wch: 30 }, ...Array(14).fill({ wch: 8 })];
    XLSX.utils.book_append_sheet(wb, ws, 'Mini-Pauta');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mini_Pauta_${disciplina}_${turmaNome}_${anoLetivo}.xlsx`.replace(/\//g, '-');
    a.click();
    URL.revokeObjectURL(url);
  }

  async function enviarMiniPauta() {
    if (!turmaId || !disciplina) {
      webAlert('Atenção', 'Selecione a turma e disciplina antes de enviar a mini-pauta.');
      return;
    }
    if (Platform.OS === 'web') {
      const html = gerarHtmlMiniPauta();
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } else {
      webAlert('Indisponível', 'A impressão da mini-pauta está disponível na versão web do sistema.');
    }
    const turmaObj = minhasTurmas.find(t => t.id === turmaId);
    await addNotificacao({
      titulo: 'Mini-Pauta Enviada para Revisão',
      mensagem: `Prof. ${prof ? `${prof.nome} ${prof.apelido}` : ''} enviou a Mini-Pauta de ${disciplina} (${turmaObj?.nome || turmaId}) — pronta para visualizar e imprimir.`,
      tipo: 'info',
      data: new Date().toISOString(),
    });
  }

  const pautaStatusColor = isPautaFechada ? Colors.danger : isPendente ? Colors.warning : pautaAtual ? Colors.success : Colors.textMuted;
  const pautaStatusLabel = isPautaFechada ? 'Submetida e Encerrada' : isPendente ? 'Aguarda Reabertura' : pautaAtual ? 'Aberta (Em Lançamento)' : 'Não Iniciada';

  // Count of students with grades entered for this pauta/trimestre
  const notasLancadasCount = notas.filter(n => n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === trimestre).length;
  const totalAlunosCount = alunosDaTurma.length;
  const pautaCompleta = notasLancadasCount >= totalAlunosCount && totalAlunosCount > 0;

  useEnterToSave(solicitarReabertura, showSolicitModal);

  if (step === 'selecao') {
    return (
      <View style={styles.container}>
        <TopBar title="Pautas" subtitle="Gestão de notas por turma e disciplina" />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={Colors.info} />
            <Text style={styles.infoCardText}>
              Selecione a turma, disciplina e trimestre para lançar ou consultar as notas. Após o lançamento, feche a pauta para validar as avaliações.
            </Text>
          </View>

          {/* Turma */}
          <Text style={styles.fieldLabel}>Turma</Text>
          <TouchableOpacity style={styles.selector} onPress={() => { setShowTurmaList(v => !v); setShowDiscList(false); }}>
            <Text style={turmaId ? styles.selectorValue : styles.selectorPlaceholder}>
              {turmaId ? minhasTurmas.find(t => t.id === turmaId)?.nome : 'Selecionar turma...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {showTurmaList && (
            <View style={styles.dropdownList}>
              {minhasTurmas.length === 0 ? (
                <View style={styles.dropdownEmpty}>
                  <Text style={styles.dropdownEmptyText}>Sem turmas atribuídas</Text>
                </View>
              ) : minhasTurmas.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.dropdownItem, turmaId === t.id && styles.dropdownItemActive]}
                  onPress={() => { setTurmaId(t.id); setShowTurmaList(false); }}
                >
                  <Text style={[styles.dropdownText, turmaId === t.id && { color: Colors.gold }]}>{t.nome}</Text>
                  <Text style={styles.dropdownSub}>
                    {t.classe} · {t.turno}{t.sala ? ` · Sala ${t.sala}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Disciplina */}
          <Text style={styles.fieldLabel}>Disciplina</Text>
          <TouchableOpacity style={styles.selector} onPress={() => { setShowDiscList(v => !v); setShowTurmaList(false); }}>
            <Text style={disciplina ? styles.selectorValue : styles.selectorPlaceholder}>
              {disciplina || 'Selecionar disciplina...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {showDiscList && (
            <View style={styles.dropdownList}>
              {disciplinas.map(d => (
                <TouchableOpacity key={d} style={[styles.dropdownItem, disciplina === d && styles.dropdownItemActive]}
                  onPress={() => { setDisciplina(d); setShowDiscList(false); }}>
                  <Text style={[styles.dropdownText, disciplina === d && { color: Colors.gold }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Trimestre */}
          <Text style={styles.fieldLabel}>Trimestre</Text>
          <View style={styles.trimestreRow}>
            {([1, 2, 3] as Trimestre[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.trimestreBtn, trimestre === t && styles.trimestreBtnActive]}
                onPress={() => setTrimestre(t)}
              >
                <Text style={[styles.trimestreBtnText, trimestre === t && styles.trimestreBtnTextActive]}>{t}º Trimestre</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pauta Status Preview */}
          {turmaId && disciplina && (
            <View style={[styles.statusPreview, { borderColor: pautaStatusColor + '44', backgroundColor: pautaStatusColor + '11' }]}>
              <View style={[styles.statusDot, { backgroundColor: pautaStatusColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusPreviewLabel, { color: pautaStatusColor }]}>
                  Estado da Pauta: {pautaStatusLabel}
                </Text>
                {pautaAtual && (
                  <Text style={styles.statusPreviewSub}>
                    {notasLancadasCount}/{totalAlunosCount} alunos com notas lançadas{pautaCompleta ? ' ✓' : ''}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Aviso PAP para 13ª Classe */}
          {isPapMode && (
            <View style={{ flexDirection: 'row', gap: 8, backgroundColor: Colors.gold + '18', borderRadius: 12, borderWidth: 1, borderColor: Colors.gold + '44', padding: 12, marginTop: 14 }}>
              <Ionicons name="ribbon-outline" size={18} color={Colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold, marginBottom: 2 }}>Turma de 13ª Classe — PAP Habilitado</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 16 }}>
                  Para além do lançamento de notas disciplinar, pode lançar as notas do Estágio Curricular, Defesa e{papDiscContribuintes.length > 0 ? ` disciplinas contribuintes (${papDiscContribuintes.join(', ')})` : ''} para calcular a Nota PAP automaticamente.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.openBtn, (!turmaId || !disciplina) && styles.openBtnDisabled]}
            onPress={iniciarPauta}
            disabled={!turmaId || !disciplina}
          >
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.openBtnText}>
              {pautaAtual ? (isPautaFechada ? 'Ver Pauta Fechada' : 'Continuar Lançamento') : 'Iniciar Lançamento'}
            </Text>
          </TouchableOpacity>

          {/* Botão PAP — apenas para 13ª Classe com PAP habilitado */}
          {isPapMode && turmaId && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.gold + '22', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: Colors.gold + '55', marginTop: 10 }}
              onPress={iniciarPAP}
            >
              <Ionicons name="ribbon" size={20} color={Colors.gold} />
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.gold }}>Lançamento PAP — Estágio & Defesa</Text>
            </TouchableOpacity>
          )}

          {/* My Pautas History */}
          {(isPrivilegedRole ? pautas : pautas.filter(p => p.professorId === prof?.id)).length > 0 && (
            <>
              <Text style={styles.histTitle}>{isPrivilegedRole ? 'Todas as Pautas' : 'Minhas Pautas'}</Text>
              {(isPrivilegedRole ? pautas : pautas.filter(p => p.professorId === prof?.id)).map(p => {
                const turma = turmas.find(t => t.id === p.turmaId);
                const sc = p.status === 'fechada' ? Colors.danger : p.status === 'pendente_abertura' ? Colors.warning : Colors.success;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.histCard, { borderLeftColor: sc, borderLeftWidth: 3 }]}
                    onPress={() => {
                      setTurmaId(p.turmaId);
                      setDisciplina(p.disciplina);
                      setTrimestre(p.trimestre);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histDisciplina}>{p.disciplina}</Text>
                      <Text style={styles.histTurma}>{turma?.nome || '—'} · {p.trimestre}º Trimestre</Text>
                    </View>
                    <View style={[styles.histStatus, { backgroundColor: sc + '22' }]}>
                      <Text style={[styles.histStatusText, { color: sc }]}>
                        {p.status === 'fechada' ? 'Fechada' : p.status === 'pendente_abertura' ? 'Pendente' : 'Aberta'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ====== PASSO PAP ======
  if (step === 'pap') {
    return (
      <View style={styles.container}>
        <TopBar
          title="Lançamento PAP"
          subtitle={`${turmaAtual?.nome || ''} · Prova de Aptidão Profissional`}
        />

        {/* Header PAP */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.gold + '18', borderBottomWidth: 1, borderBottomColor: Colors.gold + '33' }}>
          <Ionicons name="ribbon" size={18} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold }}>
              Nota PAP = (Estágio + Defesa{papDiscContribuintes.length > 0 ? ' + Média Disciplinas' : ''}) ÷ 3
            </Text>
            {config.estagioComoDisciplina && (
              <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.gold + 'BB', marginTop: 2 }}>
                Estágio carregado automaticamente da pauta curricular
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setStep('selecao')} style={{ padding: 6 }}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Banner: estágio como disciplina */}
        {config.estagioComoDisciplina && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.info + '15', borderBottomWidth: 1, borderBottomColor: Colors.info + '33' }}>
            <Ionicons name="school-outline" size={15} color={Colors.info} />
            <Text style={{ flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.info, lineHeight: 15 }}>
              Estágio como disciplina curricular — nota carregada automaticamente da pauta regular. Apenas a Defesa precisa de ser lançada.
            </Text>
          </View>
        )}

        {/* Legenda */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          <Text style={{ width: 44, fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textAlign: 'center' }}>Nº</Text>
          <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted }}>Aluno</Text>
          <Text style={{ width: 52, fontSize: 9, fontFamily: 'Inter_700Bold', color: config.estagioComoDisciplina ? Colors.info : Colors.textMuted, textAlign: 'center' }}>
            {config.estagioComoDisciplina ? 'Est.(Auto)' : 'Estágio'}
          </Text>
          <Text style={{ width: 52, fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textAlign: 'center' }}>Defesa</Text>
          {papDiscContribuintes.map(d => (
            <Text key={d} style={{ width: 52, fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textAlign: 'center' }} numberOfLines={2}>{d}</Text>
          ))}
          <Text style={{ width: 52, fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.gold, textAlign: 'center' }}>PAP</Text>
        </View>

        <FlatList
          data={papForms}
          keyExtractor={f => f.alunoId}
          contentContainerStyle={{ paddingBottom: bottomInset + 100 }}
          renderItem={({ item: form, index }) => {
            const aluno = alunos.find(a => a.id === form.alunoId);
            if (!aluno) return null;
            const isEditing = editingAlunoId === aluno.id;
            const papColor = form.notaPAP !== null
              ? (form.notaPAP >= (config.notaMinimaAprovacao ?? 10) ? Colors.success : Colors.danger)
              : Colors.textMuted;

            return (
              <TouchableOpacity
                style={[styles.alunoRow, isEditing && styles.alunoRowEditing]}
                onPress={() => setEditingAlunoId(isEditing ? null : aluno.id)}
                activeOpacity={0.85}
              >
                <View style={styles.rowCell44}>
                  <Text style={styles.rowNum}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={styles.rowFlex}>
                  <Text style={styles.rowNome} numberOfLines={1}>{aluno.nome} {aluno.apelido}</Text>
                </View>
                {isEditing ? (
                  <>
                    {/* Estágio: read-only if auto-loaded from curriculum, editable otherwise */}
                    {config.estagioComoDisciplina ? (
                      <View style={{ width: 52, alignItems: 'center', backgroundColor: Colors.info + '22', borderRadius: 6, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.info }}>
                          {form.notaEstagio || '—'}
                        </Text>
                        <Text style={{ fontSize: 8, fontFamily: 'Inter_400Regular', color: Colors.info + 'AA' }}>Auto</Text>
                      </View>
                    ) : (
                      <TextInput
                        style={[styles.gradeInput, { width: 52 }]}
                        value={form.notaEstagio}
                        onChangeText={v => updatePapForm(aluno.id, 'notaEstagio', v)}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={Colors.textMuted}
                      />
                    )}
                    <TextInput
                      style={[styles.gradeInput, { width: 52 }]}
                      value={form.notaDefesa}
                      onChangeText={v => updatePapForm(aluno.id, 'notaDefesa', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={Colors.textMuted}
                    />
                    {papDiscContribuintes.map(discNome => (
                      <TextInput
                        key={discNome}
                        style={[styles.gradeInput, { width: 52 }]}
                        value={form.notasDisciplinas[discNome] || ''}
                        onChangeText={v => updatePapDisc(aluno.id, discNome, v)}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={Colors.textMuted}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    {/* Estágio display — always shown */}
                    <View style={{ width: 52, alignItems: 'center' }}>
                      <Text style={[styles.gradeCellText, config.estagioComoDisciplina && form.notaEstagio ? { color: Colors.info } : {}]}>
                        {form.notaEstagio || '—'}
                      </Text>
                    </View>
                    <View style={{ width: 52, alignItems: 'center' }}>
                      <Text style={styles.gradeCellText}>{form.notaDefesa || '—'}</Text>
                    </View>
                    {papDiscContribuintes.map(discNome => (
                      <View key={discNome} style={{ width: 52, alignItems: 'center' }}>
                        <Text style={styles.gradeCellText}>{form.notasDisciplinas[discNome] || '—'}</Text>
                      </View>
                    ))}
                  </>
                )}
                {/* Nota PAP — sempre visível */}
                <View style={{ width: 52, alignItems: 'center', backgroundColor: form.notaPAP !== null ? papColor + '22' : 'transparent', borderRadius: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: papColor }}>
                    {form.notaPAP !== null ? form.notaPAP.toFixed(1) : '—'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Bottom bar PAP */}
        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 8 }]}>
          {papSaving ? (
            <ActivityIndicator color={Colors.gold} />
          ) : (
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.gold }]} onPress={guardarPAP}>
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Guardar Notas PAP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        title={`Pauta · ${disciplina}`}
        subtitle={`${turmaAtual?.nome || ''} · ${trimestre}º Trimestre`}
      />

      {/* Status Bar */}
      <View style={[styles.pautaStatusBar, { backgroundColor: pautaStatusColor + '18' }]}>
        <View style={[styles.statusDot, { backgroundColor: pautaStatusColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.pautaStatusText, { color: pautaStatusColor }]}>
            {pautaStatusLabel}
          </Text>
          {!isPautaFechada && !isPendente && pautaAtual && (
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: pautaCompleta ? Colors.success : Colors.textMuted, marginTop: 1 }}>
              {notasLancadasCount}/{totalAlunosCount} notas lançadas{pautaCompleta ? ' — pronta para submeter' : ''}
            </Text>
          )}
        </View>
        {isPautaFechada && (
          <TouchableOpacity
            style={styles.reaberturaBtn}
            onPress={() => temSolicPendente
              ? webAlert('Aguardar', 'Já existe um pedido de reabertura pendente.')
              : setShowSolicitModal(true)
            }
          >
            <Ionicons name="lock-open" size={14} color={Colors.warning} />
            <Text style={styles.reaberturaBtnText}>
              {temSolicPendente ? 'Pedido Enviado' : 'Solicitar Reabertura'}
            </Text>
          </TouchableOpacity>
        )}
        {!isPautaFechada && !isPrivilegedRole && (
          <TouchableOpacity
            style={styles.solicitAvalBtn}
            onPress={() => setShowSolicAvalModal(true)}
          >
            <Ionicons name="key-outline" size={13} color={Colors.info} />
            <Text style={styles.solicitAvalBtnText}>Solicitar Campo</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.miniPautaBtn, { backgroundColor: '#0d2e0d', borderWidth: 1, borderColor: '#1a7a1a' }]} onPress={gerarExcelMiniPauta}>
          <Ionicons name="document-outline" size={14} color="#4ade80" />
          <Text style={[styles.miniPautaBtnText, { color: '#4ade80' }]}>Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.miniPautaBtn} onPress={enviarMiniPauta}>
          <Ionicons name="print-outline" size={14} color={Colors.info} />
          <Text style={styles.miniPautaBtnText}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          if (pautaAtual?.status === 'aberta') {
            webAlert('Pauta Aberta', 'A pauta está em edição. Deseja sair?', [
              { text: 'Continuar', style: 'cancel' },
              { text: 'Sair', onPress: () => setStep('selecao') },
            ]);
          } else {
            setStep('selecao');
          }
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Banner: Prazo de Lançamento Expirado */}
      {isPrazoExpirado && !isPautaFechada && (
        <View style={styles.prazoBanner}>
          <Ionicons name="time-outline" size={16} color={Colors.danger} />
          <Text style={styles.prazoBannerText}>
            Prazo encerrado em {prazoData ? new Date(prazoData + 'T12:00:00').toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}. O lançamento de notas está bloqueado.
          </Text>
        </View>
      )}

      {/* Banner: Grade Launch Control — status dos campos aprovados */}
      {!isPrivilegedRole && !isPautaFechada && solicitacoesAvaliacao.length > 0 && (
        <View style={styles.lanchControlBanner}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.info} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lanchControlTitle}>Campos Aprovados</Text>
            <Text style={styles.lanchControlSub} numberOfLines={2}>
              {solicitacoesAvaliacao.filter(s => s.status === 'aprovado').length > 0
                ? solicitacoesAvaliacao.filter(s => s.status === 'aprovado')
                    .map(s => TIPOS_AVALIACAO_SOLIC.find(t => t.key === s.tipoAvaliacao)?.label ?? s.tipoAvaliacao)
                    .join(', ')
                : 'Nenhum campo aprovado ainda'}
              {solicitacoesAvaliacao.filter(s => s.status === 'pendente').length > 0 &&
                ` · ${solicitacoesAvaliacao.filter(s => s.status === 'pendente').length} pedido(s) pendente(s)`}
            </Text>
          </View>
        </View>
      )}
      {!isPrivilegedRole && !isPautaFechada && solicitacoesAvaliacao.length === 0 && (
        <View style={[styles.lanchControlBanner, { backgroundColor: Colors.warning + '12', borderBottomColor: Colors.warning + '33' }]}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.warning} />
          <Text style={[styles.lanchControlTitle, { color: Colors.warning, flex: 1 }]}>
            Lançamento bloqueado — solicite abertura de campo para inserir notas
          </Text>
        </View>
      )}

      {/* Banner especial para T3 Classe de Transição ou 12ª Classe */}
      {(useProvGlobal || useExame) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: useExame ? Colors.danger + '18' : Colors.info + '15', borderBottomWidth: 1, borderBottomColor: useExame ? Colors.danger + '33' : Colors.info + '33' }}>
          <Ionicons name={useExame ? 'school-outline' : 'ribbon-outline'} size={15} color={useExame ? Colors.danger : Colors.info} />
          <Text style={{ flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: useExame ? Colors.danger : Colors.info, lineHeight: 15 }}>
            {useExame
              ? `3º Trimestre · 12ª Classe — Exame (EX1 + EX2 substituem PT). NT=${config.percExame ?? 40}% cada exame.`
              : `3º Trimestre · Classe de Transição — Prova Global (PG1 + PG2 substituem PT). ${config.percPg ?? 40}% cada PG.`}
          </Text>
        </View>
      )}

      {/* Grade Fields Legend */}
      {(() => {
        const nAval = config.numAvaliacoes ?? 4;
        function LegendCol({ fieldKey, label, color }: { fieldKey: string; label: string; color?: string }) {
          const isOpen = isAvalFieldOpen(fieldKey);
          const isPending = !isPrivilegedRole && solicitacoesAvaliacao.some(s => s.tipoAvaliacao === fieldKey && s.status === 'pendente');
          const lockIcon = isPending ? 'hourglass-outline' : 'lock-closed';
          const lockColor = isPending ? Colors.warning : Colors.textMuted + '99';
          return (
            <TouchableOpacity
              style={[styles.legendaCol, { alignItems: 'center' }]}
              onPress={() => {
                if (isPrivilegedRole || isOpen) return;
                if (isPending) { webAlert('Pendente', 'Já existe um pedido de abertura para este campo. Aguarde aprovação.'); return; }
                if (PROVA_FIELDS.has(fieldKey)) { webAlert('Período Fechado', 'O lançamento de provas está controlado pelo calendário da direcção. Aguarde a abertura do período.'); return; }
                setSolicAvalTipo(fieldKey);
                setSolicAvalMotivo('');
                setShowSolicAvalModal(true);
              }}
              activeOpacity={isOpen || isPrivilegedRole ? 1 : 0.7}
            >
              <Text style={[styles.legendaColText, { color: color ?? (isOpen || isPrivilegedRole ? Colors.textSecondary : Colors.textMuted + '88') }]}>{label}</Text>
              {!isPrivilegedRole && (
                <Ionicons
                  name={isOpen ? 'unlock' : (lockIcon as any)}
                  size={7}
                  color={isOpen ? Colors.success + 'CC' : lockColor}
                  style={{ marginTop: 1 }}
                />
              )}
            </TouchableOpacity>
          );
        }
        return (
          <View style={styles.legendaBar}>
            <Text style={[styles.legendaCol, { width: 44 }]}>Nº</Text>
            <Text style={[styles.legendaCol, { flex: 1 }]}>Aluno</Text>
            {ALL_AVAL_KEYS.slice(0, nAval).map((key, i) => (
              <LegendCol key={key} fieldKey={key} label={`A${i + 1}`} />
            ))}
            <LegendCol fieldKey="pp1" label="PP" />
            {useProvGlobal ? (
              <>
                <LegendCol fieldKey="pg1" label="PG1" color={Colors.info} />
                <LegendCol fieldKey="pg2" label="PG2" color={Colors.info} />
              </>
            ) : useExame ? (
              <>
                <LegendCol fieldKey="ex1" label="EX1" color={Colors.danger} />
                <LegendCol fieldKey="ex2" label="EX2" color={Colors.danger} />
              </>
            ) : (
              <LegendCol fieldKey="ppt" label="PT" />
            )}
            {config.provaRecuperacaoHabilitada && (
              <LegendCol fieldKey="provaRecuperacao" label="REC" color={Colors.warning} />
            )}
            <Text style={[styles.legendaCol, { color: Colors.gold }]}>NF</Text>
          </View>
        );
      })()}

      <FlatList
        data={notasForms}
        keyExtractor={f => f.alunoId}
        contentContainerStyle={{ paddingBottom: bottomInset + 140 }}
        renderItem={({ item: form, index }) => {
          const aluno = alunos.find(a => a.id === form.alunoId);
          if (!aluno) return null;
          const nAval = config.numAvaliacoes ?? 4;
          const activeKeys = ALL_AVAL_KEYS.slice(0, nAval);
          const avalValues = activeKeys.map(k => parseNum(form[k]));
          const pp = parseNum(form.pp1);
          const mac = calcMac(avalValues);
          const nt = calcNT(mac, pp, config.percMac ?? 30, config.percPp ?? 70);
          let nf = 0;
          if (useProvGlobal) {
            nf = calcNF_T3Transicao(nt, parseNum(form.pg1), parseNum(form.pg2), config.percPg ?? 40);
          } else if (useExame) {
            nf = calcNF_T3Exame(nt, parseNum(form.ex1), parseNum(form.ex2), config.percExame ?? 40);
          } else {
            nf = calcNF_T1T2(nt, parseNum(form.ppt), config.percNt ?? 60, config.percPt ?? 40);
          }
          const nfColor = nf >= 10 ? Colors.success : nf > 0 ? Colors.danger : Colors.textMuted;
          const isEditing = editingAlunoId === aluno.id;
          const extraFields: Array<keyof NotaForm> = useProvGlobal
            ? ['pg1', 'pg2']
            : useExame
              ? ['ex1', 'ex2']
              : ['ppt'];
          const recFields: Array<keyof NotaForm> = config.provaRecuperacaoHabilitada ? ['provaRecuperacao'] : [];
          const editFields = [...activeKeys, 'pp1' as const, ...extraFields, ...recFields] as Array<keyof NotaForm>;
          const displayValues = [...activeKeys.map(k => form[k]), form.pp1, ...extraFields.map(k => form[k]), ...recFields.map(k => form[k])];
          const alunoSavedFields = savedFields[aluno.id] || new Set<string>();
          const hasAnySavedField = alunoSavedFields.size > 0;

          return (
            <TouchableOpacity
              style={[
                styles.alunoRow,
                isEditing && styles.alunoRowEditing,
                hasAnySavedField && !isEditing && styles.alunoRowSubmitted,
              ]}
              onPress={() => setEditingAlunoId(isEditing ? null : aluno.id)}
              activeOpacity={0.85}
            >
              <View style={styles.rowCell44}>
                <Text style={styles.rowNum}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <View style={styles.rowFlex}>
                <Text style={[styles.rowNome, hasAnySavedField && !isEditing && { color: Colors.textMuted }]} numberOfLines={1}>
                  {aluno.nome} {aluno.apelido}
                </Text>
                {isEditing && (
                  <Text style={styles.rowMac}>MAC={mac > 0 ? mac.toFixed(1) : '—'} · NT={nt > 0 ? nt.toFixed(1) : '—'}</Text>
                )}
                {hasAnySavedField && !isEditing && (
                  <View style={styles.lancadoBadgeRow}>
                    <View style={styles.lancadoBadge}>
                      <Ionicons name="checkmark-circle" size={10} color={Colors.success} />
                      <Text style={styles.lancadoBadgeText}>Lançado</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.lancadoVisBtn, lancadoSet.has(aluno.id) && styles.lancadoVisBtnActive]}
                      onPress={() => toggleLancado(aluno.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name={lancadoSet.has(aluno.id) ? 'eye' : 'eye-off-outline'}
                        size={10}
                        color={lancadoSet.has(aluno.id) ? Colors.success : Colors.textMuted}
                      />
                      <Text style={[styles.lancadoVisBtnText, { color: lancadoSet.has(aluno.id) ? Colors.success : Colors.textMuted }]}>
                        {lancadoSet.has(aluno.id) ? 'Publicado' : 'Oculto'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {isEditing && !isPautaFechada ? (
                <>
                  {editFields.map(field => {
                    const isFieldLocked = alunoSavedFields.has(field);
                    const isOpen = isAvalFieldOpen(field);
                    if (isFieldLocked) {
                      return (
                        <TouchableOpacity
                          key={field}
                          style={styles.gradeLocked}
                          onPress={() => webAlert(
                            'Avaliação Bloqueada',
                            'Esta avaliação já foi lançada e está bloqueada. Para corrigir, solicite a reabertura da pauta à direcção.',
                            [{ text: 'OK', style: 'cancel' }]
                          )}
                        >
                          <Ionicons name="lock-closed" size={9} color={Colors.textMuted} style={{ marginBottom: 1 }} />
                          <Text style={styles.gradeLockedText}>{form[field] || '—'}</Text>
                        </TouchableOpacity>
                      );
                    }
                    if (!isOpen) {
                      const isPendente = solicitacoesAvaliacao.some(s => s.tipoAvaliacao === field && s.status === 'pendente');
                      return (
                        <TouchableOpacity
                          key={field}
                          style={[styles.gradeLocked, { borderColor: isPendente ? Colors.warning + '88' : Colors.border, backgroundColor: isPendente ? Colors.warning + '11' : Colors.border + '44' }]}
                          onPress={() => {
                            if (isPendente) { webAlert('Aguardando Aprovação', 'O seu pedido de abertura está pendente. Aguarde a aprovação do responsável.'); return; }
                            if (PROVA_FIELDS.has(field)) { webAlert('Período Fechado', 'O período de lançamento de provas ainda não foi aberto pela direcção.'); return; }
                            setSolicAvalTipo(field);
                            setSolicAvalMotivo('');
                            setShowSolicAvalModal(true);
                          }}
                        >
                          <Ionicons name={isPendente ? 'hourglass-outline' : 'lock-closed'} size={9} color={isPendente ? Colors.warning : Colors.textMuted} style={{ marginBottom: 1 }} />
                          <Text style={[styles.gradeLockedText, { color: isPendente ? Colors.warning : Colors.textMuted + '99' }]}>—</Text>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TextInput
                        key={field}
                        style={styles.gradeInput}
                        value={form[field]}
                        onChangeText={v => updateNotaForm(aluno.id, field, v)}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={Colors.textMuted}
                        editable={!isPautaFechada}
                      />
                    );
                  })}
                </>
              ) : (
                <>
                  {displayValues.map((v, i) => {
                    const fieldKey = editFields[i];
                    const isFieldLocked = alunoSavedFields.has(fieldKey);
                    return (
                      <View key={i} style={[styles.gradeCell, isFieldLocked && styles.gradeCellLocked]}>
                        <Text style={[styles.gradeCellText, isFieldLocked && styles.gradeCellLockedText]}>{v || '—'}</Text>
                      </View>
                    );
                  })}
                </>
              )}
              <View style={styles.nfCell}>
                <Text style={[styles.nfText, { color: nfColor }]}>
                  {nf > 0 ? nf.toFixed(1) : '—'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom Actions */}
      {isEditavel && (
        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 8 }]}>
          {saving ? (
            <ActivityIndicator color={Colors.gold} />
          ) : (
            <>
              <TouchableOpacity style={styles.saveBtn} onPress={guardarNotas}>
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Guardar Notas</Text>
              </TouchableOpacity>
              {pautaAtual && (
                <TouchableOpacity
                  style={[styles.fecharBtn, pautaCompleta && { backgroundColor: Colors.success }]}
                  onPress={fecharPauta}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {pautaCompleta ? 'Submeter Pauta ✓' : 'Submeter Pauta'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Solicitar Abertura de Campo de Avaliação Modal */}
      <Modal visible={showSolicAvalModal} transparent animationType="slide" onRequestClose={() => setShowSolicAvalModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Ionicons name="key-outline" size={20} color={Colors.info} style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Solicitar Abertura de Campo</Text>
              <TouchableOpacity onPress={() => setShowSolicAvalModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Selecione o campo de avaliação que pretende abrir para lançamento de notas.
              O pedido será enviado para aprovação do responsável.
            </Text>

            <Text style={styles.fieldLabel}>Campo de Avaliação</Text>
            <ScrollView style={{ maxHeight: 200, marginBottom: 4 }}>
              {TIPOS_AVALIACAO_SOLIC.slice(0, (config.numAvaliacoes ?? 4) + 1).map(tipo => {
                const existente = solicitacoesAvaliacao.find(s => s.tipoAvaliacao === tipo.key);
                const isAprovado = existente?.status === 'aprovado';
                const isPendente = existente?.status === 'pendente';
                return (
                  <TouchableOpacity
                    key={tipo.key}
                    style={[
                      styles.tipoAvalItem,
                      solicAvalTipo === tipo.key && styles.tipoAvalItemActive,
                      (isAprovado || isPendente) && styles.tipoAvalItemDisabled,
                    ]}
                    onPress={() => { if (!isAprovado && !isPendente) setSolicAvalTipo(tipo.key); }}
                    activeOpacity={(isAprovado || isPendente) ? 1 : 0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tipoAvalLabel, solicAvalTipo === tipo.key && { color: Colors.info }]}>
                        {tipo.label}
                      </Text>
                      {(isAprovado || isPendente) && (
                        <Text style={[styles.tipoAvalStatus, { color: isAprovado ? Colors.success : Colors.warning }]}>
                          {isAprovado ? '✓ Já aprovado' : '⏳ Pedido pendente'}
                        </Text>
                      )}
                    </View>
                    {solicAvalTipo === tipo.key && !isAprovado && !isPendente && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.info} />
                    )}
                    {isAprovado && <Ionicons name="checkmark-circle" size={18} color={Colors.success} />}
                    {isPendente && <Ionicons name="hourglass-outline" size={18} color={Colors.warning} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>Motivo (opcional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Descreva brevemente o motivo do pedido..."
              placeholderTextColor={Colors.textMuted}
              value={solicAvalMotivo}
              onChangeText={setSolicAvalMotivo}
              multiline
            />
            {sendingSolicAval ? (
              <ActivityIndicator color={Colors.info} style={{ marginTop: 16 }} />
            ) : (
              <TouchableOpacity
                style={[styles.solicitBtn, { backgroundColor: Colors.info }, !solicAvalTipo && styles.solicitBtnDisabled]}
                onPress={submitSolicAvaliacao}
                disabled={!solicAvalTipo}
              >
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Enviar Pedido de Abertura</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Solicitar Reabertura Modal */}
      <Modal visible={showSolicitModal} transparent animationType="slide" onRequestClose={() => setShowSolicitModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitar Reabertura</Text>
              <TouchableOpacity onPress={() => setShowSolicitModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              A pauta de {disciplina} ({turmaAtual?.nome}) está fechada. Indique o motivo para solicitar reabertura à direcção.
            </Text>
            <Text style={styles.fieldLabel}>Motivo do Pedido</Text>
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Descreva o motivo (ex: erro de lançamento, nota em falta)..."
              placeholderTextColor={Colors.textMuted}
              value={motivoSolicidade}
              onChangeText={setMotivoSolicidade}
              multiline
            />
            <TouchableOpacity
              style={[styles.solicitBtn, !motivoSolicidade.trim() && styles.solicitBtnDisabled]}
              onPress={solicitarReabertura}
              disabled={!motivoSolicidade.trim()}
            >
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Enviar Solicitação</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CELL_W = 38;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, backgroundColor: Colors.info + '11', borderRadius: 14, borderWidth: 1, borderColor: Colors.info + '33', marginBottom: 16 },
  infoCardText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 20 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  selector: { backgroundColor: Colors.backgroundCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border },
  selectorValue: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  selectorPlaceholder: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  dropdownList: { backgroundColor: Colors.backgroundCard, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border, maxHeight: 200, overflow: 'hidden' },
  dropdownEmpty: { padding: 14 },
  dropdownEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemActive: { backgroundColor: 'rgba(240,165,0,0.1)' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  dropdownSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  trimestreRow: { flexDirection: 'row', gap: 10 },
  trimestreBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.backgroundCard, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  trimestreBtnActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent + '66' },
  trimestreBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  trimestreBtnTextActive: { color: Colors.accent, fontFamily: 'Inter_600SemiBold' },
  statusPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusPreviewLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  statusPreviewSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  openBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, marginBottom: 8 },
  openBtnDisabled: { opacity: 0.4 },
  openBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  histTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  histCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  histDisciplina: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  histTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  histStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  histStatusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  pautaStatusBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pautaStatusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  prazoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger + '18', borderBottomWidth: 1, borderBottomColor: Colors.danger + '33', paddingHorizontal: 16, paddingVertical: 10 },
  prazoBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.danger },
  reaberturaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warning + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  reaberturaBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.warning },
  miniPautaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.info + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  miniPautaBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  backBtn: { padding: 6 },
  legendaBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  legendaCol: { width: CELL_W, fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textAlign: 'center' },
  alunoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  alunoRowEditing: { backgroundColor: Colors.gold + '0D' },
  alunoRowSubmitted: { backgroundColor: Colors.success + '08', borderLeftWidth: 2, borderLeftColor: Colors.success + '44' },
  lancadoBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  lancadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lancadoBadgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.success },
  lancadoVisBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.border + '33' },
  lancadoVisBtnActive: { borderColor: Colors.success + '66', backgroundColor: Colors.success + '18' },
  lancadoVisBtnText: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  gradeLocked: { width: CELL_W, height: 32, backgroundColor: Colors.border + '55', borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  gradeLockedText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textAlign: 'center' },
  gradeCellLocked: { backgroundColor: Colors.success + '0A', borderRadius: 4 },
  gradeCellLockedText: { color: Colors.success, fontFamily: 'Inter_600SemiBold' },
  rowCell44: { width: 44, alignItems: 'center' },
  rowNum: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  rowFlex: { flex: 1 },
  rowNome: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text },
  rowMac: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 2 },
  gradeInput: { width: CELL_W, height: 32, backgroundColor: Colors.surface, borderRadius: 6, paddingHorizontal: 4, fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text, borderWidth: 1, borderColor: Colors.gold + '55', textAlign: 'center' },
  gradeCell: { width: CELL_W, alignItems: 'center' },
  gradeCellText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  nfCell: { width: CELL_W, alignItems: 'center' },
  nfText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: Colors.primaryDark, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14 },
  fecharBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.danger, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%', width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  modalTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  closeBtn: { padding: 4 },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  solicitBtn: { backgroundColor: Colors.warning, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  solicitBtnDisabled: { opacity: 0.4 },
  // Grade Launch Control
  solicitAvalBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.info + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  solicitAvalBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  lanchControlBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.info + '12', borderBottomWidth: 1, borderBottomColor: Colors.info + '33' },
  lanchControlTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  lanchControlSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.info + 'BB', marginTop: 2 },
  tipoAvalItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, backgroundColor: Colors.surface },
  tipoAvalItemActive: { borderColor: Colors.info + '88', backgroundColor: Colors.info + '15' },
  tipoAvalItemDisabled: { opacity: 0.6 },
  tipoAvalLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  tipoAvalStatus: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 2 },
  legendaColText: { fontSize: 10, fontFamily: 'Inter_700Bold', textAlign: 'center' },
});
