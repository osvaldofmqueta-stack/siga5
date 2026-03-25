import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, Modal, FlatList, ActivityIndicator,
  BackHandler,
} from 'react-native';
import * as XLSX from 'xlsx';
import { useConfig } from '@/context/ConfigContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';

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
}

type AvalKey = 'aval1' | 'aval2' | 'aval3' | 'aval4' | 'aval5' | 'aval6' | 'aval7' | 'aval8';
const ALL_AVAL_KEYS: AvalKey[] = ['aval1', 'aval2', 'aval3', 'aval4', 'aval5', 'aval6', 'aval7', 'aval8'];

function calcMac(avais: number[]): number {
  const vals = avais.filter(v => v > 0);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function calcMt1(mac: number, pp1: number): number {
  return Math.round((mac * 0.3 + pp1 * 0.7) * 10) / 10;
}

function calcNF(mt1: number, ppt: number): number {
  return Math.round((mt1 * 0.6 + ppt * 0.4) * 10) / 10;
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

  const [turmaId, setTurmaId] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [trimestre, setTrimestre] = useState<Trimestre>(1);
  const [step, setStep] = useState<'selecao' | 'pauta'>('selecao');
  const [notasForms, setNotasForms] = useState<NotaForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSolicitModal, setShowSolicitModal] = useState(false);
  const [motivoSolicidade, setMotivoSolicidade] = useState('');
  const [editingAlunoId, setEditingAlunoId] = useState<string | null>(null);

  const [showTurmaList, setShowTurmaList] = useState(false);
  const [showDiscList, setShowDiscList] = useState(false);

  const prof = useMemo(() => professores.find(p => p.email === user?.email), [professores, user]);
  const minhasTurmas = useMemo(() => prof ? turmas.filter(t => prof.turmasIds.includes(t.id) && t.ativo) : [], [prof, turmas]);
  const turmaAtual = minhasTurmas.find(t => t.id === turmaId);

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
          Alert.alert(
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
    if (!turmaId || !disciplina || !prof) return;

    const notasExistentes = notas.filter(n =>
      n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === trimestre
    );

    const forms: NotaForm[] = alunosDaTurma.map(aluno => {
      const nota = notasExistentes.find(n => n.alunoId === aluno.id);
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
      };
    });

    setNotasForms(forms);
    setStep('pauta');
  }

  function updateNotaForm(alunoId: string, field: keyof NotaForm, value: string) {
    setNotasForms(prev => prev.map(f => f.alunoId === alunoId ? { ...f, [field]: value } : f));
  }

  async function guardarNotas() {
    if (!prof || !turmaAtual) return;
    setSaving(true);
    try {
      const notasExistentes = notas.filter(n =>
        n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === trimestre
      );

      const numAvais = config.numAvaliacoes ?? 4;
      const activeAvalKeys = ALL_AVAL_KEYS.slice(0, numAvais);

      for (const form of notasForms) {
        const avalValues = activeAvalKeys.map(k => parseNum(form[k]));
        const pp = parseNum(form.pp1);
        const ppt = parseNum(form.ppt);
        const mac = calcMac(avalValues);
        const mt1 = calcMt1(mac, pp);
        const nf = calcNF(mt1, ppt);

        const notaExistente = notasExistentes.find(n => n.alunoId === form.alunoId);
        const notaData: Record<string, unknown> = {
          alunoId: form.alunoId,
          turmaId,
          disciplina,
          trimestre,
          pp1: pp, ppt, mac1: mac, mt1, nf, mac,
          anoLetivo: anoSelecionado?.ano || '2025',
          professorId: prof.id,
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
          professorId: prof.id,
          status: 'aberta',
          anoLetivo: anoSelecionado?.ano || '2025',
        });
      }

      Alert.alert('Notas guardadas', 'As notas foram guardadas com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível guardar as notas.');
    } finally {
      setSaving(false);
    }
  }

  async function fecharPauta() {
    if (!pautaAtual) {
      Alert.alert('Aviso', 'Guarde as notas primeiro antes de fechar a pauta.');
      return;
    }
    Alert.alert(
      'Fechar Pauta',
      `Tem a certeza que deseja fechar a pauta de ${disciplina} — ${turmaAtual?.nome} — ${trimestre}º Trimestre?\n\nApós o fecho, as notas não poderão ser alteradas sem autorização.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fechar Pauta',
          style: 'destructive',
          onPress: async () => {
            await updatePauta(pautaAtual.id, {
              status: 'fechada',
              dataFecho: new Date().toISOString(),
            });
            await addNotificacao({
              titulo: 'Pauta Fechada',
              mensagem: `Pauta de ${disciplina} (${turmaAtual?.nome}) — ${trimestre}º Trimestre foi fechada com sucesso.`,
              tipo: 'sucesso',
              data: new Date().toISOString(),
            });
            Alert.alert('Pauta Fechada', 'A pauta foi fechada com sucesso. Para reabrir, será necessária autorização.');
          },
        },
      ]
    );
  }

  async function solicitarReabertura() {
    if (!pautaAtual || !prof) return;
    if (!motivoSolicidade.trim()) {
      Alert.alert('Obrigatório', 'Indique o motivo do pedido de reabertura.');
      return;
    }
    await addSolicitacao({
      pautaId: pautaAtual.id,
      turmaId,
      turmaNome: turmaAtual?.nome || '',
      disciplina,
      trimestre,
      professorId: prof.id,
      professorNome: `${prof.nome} ${prof.apelido}`,
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
    Alert.alert('Pedido Enviado', 'A sua solicitação de reabertura foi enviada. Aguarde a aprovação.');
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
      Alert.alert('Atenção', 'Selecione a turma e disciplina antes de exportar.');
      return;
    }
    if (Platform.OS !== 'web') {
      Alert.alert('Indisponível', 'A exportação Excel está disponível na versão web do sistema.');
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
      Alert.alert('Atenção', 'Selecione a turma e disciplina antes de enviar a mini-pauta.');
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
      Alert.alert('Indisponível', 'A impressão da mini-pauta está disponível na versão web do sistema.');
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
  const pautaStatusLabel = isPautaFechada ? 'Fechada' : isPendente ? 'Aguarda Reabertura' : pautaAtual ? 'Aberta' : 'Não Lançada';

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
                  <Text style={styles.dropdownSub}>{t.nivel} · {t.turno}</Text>
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
                    {alunosDaTurma.length} alunos · {notas.filter(n => n.turmaId === turmaId && n.disciplina === disciplina && n.trimestre === trimestre).length} notas lançadas
                  </Text>
                )}
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

          {/* My Pautas History */}
          {prof && pautas.filter(p => p.professorId === prof.id).length > 0 && (
            <>
              <Text style={styles.histTitle}>Minhas Pautas</Text>
              {pautas.filter(p => p.professorId === prof.id).map(p => {
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

  return (
    <View style={styles.container}>
      <TopBar
        title={`Pauta · ${disciplina}`}
        subtitle={`${turmaAtual?.nome || ''} · ${trimestre}º Trimestre`}
      />

      {/* Status Bar */}
      <View style={[styles.pautaStatusBar, { backgroundColor: pautaStatusColor + '18' }]}>
        <View style={[styles.statusDot, { backgroundColor: pautaStatusColor }]} />
        <Text style={[styles.pautaStatusText, { color: pautaStatusColor }]}>
          {pautaStatusLabel}
        </Text>
        {isPautaFechada && (
          <TouchableOpacity
            style={styles.reaberturaBtn}
            onPress={() => temSolicPendente
              ? Alert.alert('Aguardar', 'Já existe um pedido de reabertura pendente.')
              : setShowSolicitModal(true)
            }
          >
            <Ionicons name="lock-open" size={14} color={Colors.warning} />
            <Text style={styles.reaberturaBtnText}>
              {temSolicPendente ? 'Pedido Enviado' : 'Solicitar Reabertura'}
            </Text>
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
            Alert.alert('Pauta Aberta', 'A pauta está em edição. Deseja sair?', [
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

      {/* Grade Fields Legend */}
      {(() => {
        const nAval = config.numAvaliacoes ?? 4;
        return (
          <View style={styles.legendaBar}>
            <Text style={[styles.legendaCol, { width: 44 }]}>Nº</Text>
            <Text style={[styles.legendaCol, { flex: 1 }]}>Aluno</Text>
            {ALL_AVAL_KEYS.slice(0, nAval).map((_, i) => (
              <Text key={i} style={styles.legendaCol}>A{i + 1}</Text>
            ))}
            <Text style={styles.legendaCol}>PP</Text>
            <Text style={styles.legendaCol}>PT</Text>
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
          const ppt = parseNum(form.ppt);
          const mac = calcMac(avalValues);
          const mt1 = calcMt1(mac, pp);
          const nf = calcNF(mt1, ppt);
          const nfColor = nf >= 10 ? Colors.success : nf > 0 ? Colors.danger : Colors.textMuted;
          const isEditing = editingAlunoId === aluno.id;
          const editFields = [...activeKeys, 'pp1' as const, 'ppt' as const] as Array<keyof NotaForm>;
          const displayValues = [...activeKeys.map(k => form[k]), form.pp1, form.ppt];

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
                {isEditing && (
                  <Text style={styles.rowMac}>MAC={mac > 0 ? mac.toFixed(1) : '—'} · MT1={mt1 > 0 ? mt1.toFixed(1) : '—'}</Text>
                )}
              </View>
              {isEditing && !isPautaFechada ? (
                <>
                  {editFields.map(field => (
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
                  ))}
                </>
              ) : (
                <>
                  {displayValues.map((v, i) => (
                    <View key={i} style={styles.gradeCell}>
                      <Text style={styles.gradeCellText}>{v || '—'}</Text>
                    </View>
                  ))}
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
                <TouchableOpacity style={styles.fecharBtn} onPress={fecharPauta}>
                  <Ionicons name="lock-closed" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Fechar Pauta</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%', width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  modalTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  closeBtn: { padding: 4 },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  solicitBtn: { backgroundColor: Colors.warning, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  solicitBtnDisabled: { opacity: 0.4 },
});
