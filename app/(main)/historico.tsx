import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Dimensions, Modal, Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { LineChart } from '@/components/Charts';
import { useData } from '@/context/DataContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

type ViewMode = 'aluno' | 'turma';

const TRIMESTRE_COLORS: Record<number, string> = {
  1: Colors.info,
  2: Colors.warning,
  3: Colors.success,
};

function SituacaoBadge({ situacao }: { situacao: string }) {
  const config = {
    'Em curso': { color: Colors.info, bg: Colors.info + '22' },
    'Aprovado': { color: Colors.success, bg: Colors.success + '22' },
    'Reprovado': { color: Colors.accent, bg: Colors.accent + '22' },
    'Transferido': { color: Colors.warning, bg: Colors.warning + '22' },
  }[situacao] || { color: Colors.textMuted, bg: Colors.border };
  return (
    <View style={[styles.situacaoBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.situacaoText, { color: config.color }]}>{situacao}</Text>
    </View>
  );
}

function notaEfetivaDisplay(n: any): number {
  if (n.nf != null && n.nf > 0) return n.nf;
  if (n.mt1 != null && n.mt1 > 0) return n.mt1;
  if (n.mac1 != null && n.mac1 > 0) return n.mac1;
  if (n.mac != null && n.mac > 0) return n.mac;
  const avals = [n.aval1, n.aval2, n.aval3, n.aval4, n.aval5, n.aval6, n.aval7, n.aval8]
    .filter((v): v is number => v != null && v > 0);
  if (avals.length > 0) return avals.reduce((s: number, v: number) => s + v, 0) / avals.length;
  return 0;
}

function isNotaLancada(n: any): boolean {
  return !!(n.lancado || (n.nf != null && n.nf > 0) || (n.mt1 != null && n.mt1 > 0));
}

function NotasPorTrimestreTable({ notasAno }: { notasAno: any[] }) {
  const trimestres = [1, 2, 3] as const;
  const trimestresComNotas = trimestres.filter(t => notasAno.some(n => n.trimestre === t));

  if (trimestresComNotas.length === 0) return null;

  return (
    <View style={styles.trimestresContainer}>
      {trimestresComNotas.map(t => {
        const notasTrim = notasAno.filter((n: any) => n.trimestre === t);
        const notasComValor = notasTrim.filter((n: any) => notaEfetivaDisplay(n) > 0);
        const mediaTrim = notasComValor.length > 0
          ? notasComValor.reduce((s: number, n: any) => s + notaEfetivaDisplay(n), 0) / notasComValor.length
          : 0;
        const cor = TRIMESTRE_COLORS[t];
        const todasLancadas = notasTrim.every((n: any) => isNotaLancada(n));

        return (
          <View key={t} style={styles.trimestreBlock}>
            {/* Header do Trimestre */}
            <View style={[styles.trimestreBlockHeader, { borderLeftColor: cor }]}>
              <View style={styles.trimestreBlockHeaderLeft}>
                <View style={[styles.trimestreDot, { backgroundColor: cor }]} />
                <Text style={[styles.trimestreBlockTitle, { color: cor }]}>{t}º Trimestre</Text>
                {!todasLancadas && (
                  <View style={{ backgroundColor: Colors.warning + '25', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.warning }}>Em Lançamento</Text>
                  </View>
                )}
              </View>
              <View style={[styles.mediaTriBadge, { backgroundColor: cor + '20', borderColor: cor + '50' }]}>
                <Text style={[styles.mediaTriText, { color: cor }]}>
                  Média: {mediaTrim > 0 ? mediaTrim.toFixed(1) : '—'}
                </Text>
              </View>
            </View>

            {/* Tabela de notas do trimestre */}
            <View style={styles.notasTable}>
              <View style={styles.notasTableHeader}>
                <Text style={[styles.notasCol, { flex: 1 }]}>Disciplina</Text>
                <Text style={[styles.notasCol, { width: 40, textAlign: 'center' }]}>MAC</Text>
                <Text style={[styles.notasCol, { width: 34, textAlign: 'center' }]}>PP</Text>
                <Text style={[styles.notasCol, { width: 34, textAlign: 'center' }]}>PT</Text>
                <Text style={[styles.notasCol, { width: 44, textAlign: 'center' }]}>NF</Text>
              </View>
              {notasTrim.map((n: any) => {
                const nfVal = notaEfetivaDisplay(n);
                const lancada = isNotaLancada(n);
                const mac1Val = n.mac1 != null ? n.mac1 : (n.mac != null ? n.mac : null);
                return (
                  <View key={n.id} style={styles.notasRow}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.notasCell, { flex: 1 }]} numberOfLines={1}>{n.disciplina}</Text>
                      {!lancada && (
                        <View style={{ backgroundColor: Colors.warning + '20', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 8, fontFamily: 'Inter_600SemiBold', color: Colors.warning }}>Parcial</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.notasCell, { width: 40, textAlign: 'center' }]}>
                      {mac1Val != null && mac1Val > 0 ? mac1Val.toFixed(1) : '—'}
                    </Text>
                    <Text style={[styles.notasCell, { width: 34, textAlign: 'center' }]}>
                      {n.pp1 != null && n.pp1 > 0 ? n.pp1.toFixed(1) : '—'}
                    </Text>
                    <Text style={[styles.notasCell, { width: 34, textAlign: 'center' }]}>
                      {n.ppt != null && n.ppt > 0 ? n.ppt.toFixed(1) : '—'}
                    </Text>
                    <Text style={[
                      styles.notasCell,
                      {
                        width: 44, textAlign: 'center',
                        color: !lancada ? Colors.warning : (nfVal >= 10 ? Colors.success : Colors.accent),
                        fontFamily: 'Inter_700Bold',
                      }
                    ]}>
                      {nfVal > 0 ? nfVal.toFixed(1) : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function HistoricoScreen() {
  const { alunos, turmas, notas, presencas } = useData();
  const { anos, anoSelecionado } = useAnoAcademico();
  const { user } = useAuth();

  const isAlunoRole = user?.role === 'aluno';

  const [viewMode, setViewMode] = useState<ViewMode>('aluno');
  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(null);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [showAlunoSelector, setShowAlunoSelector] = useState(false);
  const [showTurmaSelector, setShowTurmaSelector] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const alunosAtivos = alunos.filter(a => a.ativo);
  const turmasAtivas = turmas.filter(t => t.ativo);

  // Set initial turma when turmas load (fix async race condition)
  useEffect(() => {
    if (turmasAtivas.length > 0 && !selectedTurmaId) {
      setSelectedTurmaId(turmasAtivas[0].id);
    }
  }, [turmasAtivas]);

  // Auto-select student for aluno role
  useEffect(() => {
    if (isAlunoRole && user && alunos.length > 0 && !selectedAlunoId) {
      const primeiroNome = user.nome?.split(' ')[0]?.toLowerCase() || '';
      const alunoLogado = alunos.find(a =>
        a.nome.toLowerCase().includes(primeiroNome) ||
        `${a.nome} ${a.apelido}`.toLowerCase().includes(user.nome?.toLowerCase() || '')
      );
      if (alunoLogado) setSelectedAlunoId(alunoLogado.id);
    }
  }, [isAlunoRole, user, alunos]);

  const selectedAluno = alunos.find(a => a.id === selectedAlunoId) || null;
  const selectedTurma = turmas.find(t => t.id === selectedTurmaId) || null;

  // Helper: get the best available grade value from a nota (handles partial/in-progress entries)
  function notaEfetiva(n: any): number {
    if (n.nf != null && n.nf > 0) return n.nf;
    if (n.mt1 != null && n.mt1 > 0) return n.mt1;
    if (n.mac1 != null && n.mac1 > 0) return n.mac1;
    if (n.mac != null && n.mac > 0) return n.mac;
    // Fallback: average any individual assessments that exist
    const avals = [n.aval1, n.aval2, n.aval3, n.aval4, n.aval5, n.aval6, n.aval7, n.aval8]
      .filter((v): v is number => v != null && v > 0);
    if (avals.length > 0) return avals.reduce((s, v) => s + v, 0) / avals.length;
    return 0;
  }

  // Helper: get turma name for a student — also tries note-based lookup as fallback
  function getTurmaNome(alunoId: string, turmaId: string): string {
    const byId = turmas.find(t => t.id === turmaId);
    if (byId) return byId.nome;
    const notaTurmaId = notas.find(n => n.alunoId === alunoId)?.turmaId;
    const byNota = notaTurmaId ? turmas.find(t => t.id === notaTurmaId) : null;
    return byNota?.nome || '—';
  }

  const historicoAluno = useMemo(() => {
    if (!selectedAluno) return [];
    return anos.map(ano => {
      const notasAno = notas.filter(n => n.alunoId === selectedAluno.id && n.anoLetivo === ano.ano);
      const presAno = presencas.filter(p => p.alunoId === selectedAluno.id);

      // Only count notes that have meaningful grade data for the average
      const notasComValor = notasAno.filter(n => notaEfetiva(n) > 0);
      const mediaGeral = notasComValor.length > 0
        ? notasComValor.reduce((s, n) => s + notaEfetiva(n), 0) / notasComValor.length
        : null;

      const presencasPct = presAno.length > 0
        ? Math.round((presAno.filter(p => p.status === 'P').length / presAno.length) * 100)
        : 100;

      // Situação: if there are any notes (even partial), show "Em curso" until year ends
      const anoAtivo = ano.ativo;
      const aprovado = mediaGeral !== null ? mediaGeral >= 10 : null;
      const situacao = anoAtivo
        ? 'Em curso'
        : (mediaGeral === null ? 'Em curso' : aprovado ? 'Aprovado' : 'Reprovado');

      const trimestresResumo = [1, 2, 3].map(t => {
        const notasTrim = notasAno.filter(n => n.trimestre === t);
        const comValor = notasTrim.filter(n => notaEfetiva(n) > 0);
        const mediaTrim = comValor.length > 0
          ? comValor.reduce((s, n) => s + notaEfetiva(n), 0) / comValor.length
          : null;
        return { trimestre: t, notas: notasTrim, media: mediaTrim };
      });

      return { ano, notasAno, mediaGeral, presencasPct, aprovado, situacao, trimestresResumo };
    });
  }, [selectedAluno, notas, presencas, anos]);

  const chartData = useMemo(() => {
    return historicoAluno
      .filter(h => h.mediaGeral !== null && h.mediaGeral > 0)
      .map(h => ({ label: h.ano.ano.slice(2), value: parseFloat((h.mediaGeral || 0).toFixed(1)) }));
  }, [historicoAluno]);

  const turmaAlunos = useMemo(() => {
    if (!selectedTurma) return [];

    // Build set of alunoIds that have notas for this turma — fallback for turmaId mismatch
    const alunoIdsViaNotas = new Set(
      notas
        .filter(n => n.turmaId === selectedTurma.id && (!anoSelecionado || n.anoLetivo === anoSelecionado.ano))
        .map(n => n.alunoId)
    );

    // Find students by direct turmaId OR via their notas
    const alunosDaTurma = alunos.filter(a =>
      a.ativo && (a.turmaId === selectedTurma.id || alunoIdsViaNotas.has(a.id))
    );

    return alunosDaTurma.map(aluno => {
      const notasAluno = notas.filter(n => n.alunoId === aluno.id && (!anoSelecionado || n.anoLetivo === anoSelecionado.ano));
      const notasComValor = notasAluno.filter(n => notaEfetiva(n) > 0);
      const media = notasComValor.length > 0
        ? notasComValor.reduce((s, n) => s + notaEfetiva(n), 0) / notasComValor.length
        : 0;
      const presAluno = presencas.filter(p => p.alunoId === aluno.id);
      const faltas = presAluno.filter(p => p.status === 'F').length;
      const situacao = notasAluno.length === 0
        ? 'Em curso'
        : (anoSelecionado?.ativo ? 'Em curso' : (media >= 10 ? 'Aprovado' : 'Reprovado'));

      const porTrimestre = [1, 2, 3].map(t => {
        const nt = notasAluno.filter(n => n.trimestre === t);
        const comValor = nt.filter(n => notaEfetiva(n) > 0);
        const med = comValor.length > 0 ? comValor.reduce((s, n) => s + notaEfetiva(n), 0) / comValor.length : null;
        return { trimestre: t, media: med };
      });

      return { aluno, media, faltas, situacao, porTrimestre };
    }).sort((a, b) => b.media - a.media);
  }, [selectedTurma, alunos, notas, presencas, anoSelecionado]);

  const totalAlunos = turmaAlunos.length;
  const aprovados = turmaAlunos.filter(x => x.situacao === 'Aprovado').length;
  const reprovados = turmaAlunos.filter(x => x.situacao === 'Reprovado').length;
  const mediaTurma = turmaAlunos.length > 0 ? turmaAlunos.reduce((s, x) => s + x.media, 0) / turmaAlunos.length : 0;

  function handlePrintPreview() {
    if (Platform.OS !== 'web') return;
    const iframe = document.getElementById('hist-pdf-iframe') as HTMLIFrameElement | null;
    if (iframe?.contentWindow) iframe.contentWindow.print();
  }

  function abrirPDF() {
    if (!selectedAlunoId) return;
    setPreviewUrl(`/api/pdf/historico-academico/${selectedAlunoId}?autoprint=false`);
  }

  return (
    <View style={styles.container}>

      {/* ── A4 Preview Modal ─────────────────────────────────────────────── */}
      {Platform.OS === 'web' && (
        <Modal
          visible={!!previewUrl}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setPreviewUrl(null)}
        >
          <View style={styles.previewModal}>
            <View style={styles.previewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle}>Histórico Académico</Text>
                <Text style={styles.previewSub}>Formato A4 · Pré-visualização antes de imprimir</Text>
              </View>
              <TouchableOpacity style={styles.previewPrintBtn} onPress={handlePrintPreview}>
                <Ionicons name="print-outline" size={16} color="#fff" />
                <Text style={styles.previewPrintTxt}>Imprimir / PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewUrl(null)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.previewBody}>
              {previewUrl && (
                <iframe
                  id="hist-pdf-iframe"
                  src={previewUrl}
                  style={{ flex: 1, border: 'none', width: '100%', height: '100%', minHeight: 600, background: '#f0f0f0' } as any}
                  title="Histórico Académico"
                />
              )}
            </View>
          </View>
        </Modal>
      )}

      <TopBar title="Histórico Académico" subtitle={anoSelecionado?.ano || ''} />

      {/* Aviso de somente-leitura */}
      <View style={styles.readOnlyBanner}>
        <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
        <Text style={styles.readOnlyText}>
          Registo permanente e imutável — cresce automaticamente com a actividade académica
        </Text>
      </View>

      {!isAlunoRole && (
        <View style={styles.viewModeRow}>
          <TouchableOpacity style={[styles.modeBtn, viewMode === 'aluno' && styles.modeBtnActive]} onPress={() => setViewMode('aluno')}>
            <Ionicons name="person" size={15} color={viewMode === 'aluno' ? Colors.gold : Colors.textSecondary} />
            <Text style={[styles.modeBtnText, viewMode === 'aluno' && styles.modeBtnTextActive]}>Por Aluno</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, viewMode === 'turma' && styles.modeBtnActive]} onPress={() => setViewMode('turma')}>
            <MaterialIcons name="class" size={15} color={viewMode === 'turma' ? Colors.gold : Colors.textSecondary} />
            <Text style={[styles.modeBtnText, viewMode === 'turma' && styles.modeBtnTextActive]}>Por Turma</Text>
          </TouchableOpacity>
        </View>
      )}

      {(viewMode === 'aluno' || isAlunoRole) && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Selector — apenas visível para utilizadores não-aluno */}
          {!isAlunoRole && (
            <>
              <TouchableOpacity style={styles.selector} onPress={() => setShowAlunoSelector(v => !v)}>
                <Ionicons name="person" size={18} color={Colors.gold} />
                <Text style={selectedAluno ? styles.selectorVal : styles.selectorPlaceholder}>
                  {selectedAluno ? `${selectedAluno.nome} ${selectedAluno.apelido}` : 'Selecionar aluno...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>

              {showAlunoSelector && (
                <View style={styles.dropdownList}>
                  {alunosAtivos.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.dropdownItem, selectedAlunoId === a.id && styles.dropdownActive]}
                      onPress={() => { setSelectedAlunoId(a.id); setShowAlunoSelector(false); }}
                    >
                      <Text style={[styles.dropdownText, selectedAlunoId === a.id && styles.dropdownTextActive]}>
                        {a.nome} {a.apelido}
                      </Text>
                      <Text style={styles.dropdownSub}>{getTurmaNome(a.id, a.turmaId)} — {a.numeroMatricula}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {!selectedAluno && (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={52} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{isAlunoRole ? 'A carregar histórico...' : 'Selecione um aluno'}</Text>
              <Text style={styles.emptyMsg}>{isAlunoRole ? 'O seu histórico académico aparecerá aqui.' : 'Escolha um aluno para ver o seu histórico académico completo por trimestre.'}</Text>
            </View>
          )}

          {selectedAluno && (
            <>
              {/* Profile Card */}
              <View style={styles.alunoCard}>
                <View style={styles.alunoAvatar}>
                  <Text style={styles.alunoAvatarText}>{selectedAluno.nome[0]}{selectedAluno.apelido[0]}</Text>
                </View>
                <View style={styles.alunoInfo}>
                  <Text style={styles.alunoNome}>{selectedAluno.nome} {selectedAluno.apelido}</Text>
                  <Text style={styles.alunoMatricula}>{selectedAluno.numeroMatricula}</Text>
                  <Text style={styles.alunoTurma}>{getTurmaNome(selectedAluno.id, selectedAluno.turmaId)}</Text>
                </View>
                <View style={styles.alunoCardRight}>
                  <SituacaoBadge situacao={historicoAluno.find(h => h.ano.ativo)?.situacao || 'Em curso'} />
                  {Platform.OS === 'web' && (
                    <TouchableOpacity style={styles.pdfBtn} onPress={abrirPDF} activeOpacity={0.8}>
                      <Ionicons name="document-text-outline" size={14} color={Colors.gold} />
                      <Text style={styles.pdfBtnText}>Ver / Imprimir</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Stats globais */}
              {(() => {
                const notasTodas = notas.filter(n => n.alunoId === selectedAluno.id);
                const notasComValorGlobal = notasTodas.filter(n => notaEfetiva(n) > 0);
                const mediaGlobal = notasComValorGlobal.length > 0
                  ? notasComValorGlobal.reduce((s, n) => s + notaEfetiva(n), 0) / notasComValorGlobal.length
                  : 0;
                const presAluno = presencas.filter(p => p.alunoId === selectedAluno.id);
                const totalFaltas = presAluno.filter(p => p.status === 'F').length;
                const anosComNotas = new Set(notasTodas.filter(n => notaEfetiva(n) > 0).map(n => n.anoLetivo)).size;
                return (
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={[styles.statVal, { color: Colors.gold }]}>{mediaGlobal.toFixed(1)}</Text>
                      <Text style={styles.statLbl}>Média Global</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statVal, { color: Colors.info }]}>{anosComNotas}</Text>
                      <Text style={styles.statLbl}>Anos Lectivos</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statVal, { color: totalFaltas > 15 ? Colors.accent : Colors.success }]}>{totalFaltas}</Text>
                      <Text style={styles.statLbl}>Faltas</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Gráfico de Evolução */}
              {chartData.length >= 2 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Evolução das Notas</Text>
                  <LineChart
                    data={chartData}
                    color={Colors.gold}
                    height={140}
                    width={width - 64}
                  />
                </View>
              )}

              {/* Histórico por Ano e Trimestre */}
              <Text style={styles.timelineTitle}>Histórico por Ano</Text>
              {historicoAluno.map(h => (
                <View key={h.ano.id} style={[styles.anoCard, h.ano.ativo && styles.anoCardActive]}>
                  <View style={styles.anoCardHeader}>
                    <View style={styles.anoNumRow}>
                      <Text style={[styles.anoNum, h.ano.ativo && { color: Colors.gold }]}>{h.ano.ano}</Text>
                      {h.ano.ativo && <View style={styles.ativoBadge}><Text style={styles.ativoText}>Actual</Text></View>}
                    </View>
                    <SituacaoBadge situacao={h.situacao} />
                  </View>

                  {/* Resumo do ano */}
                  <View style={styles.anoStats}>
                    <View style={styles.anoStatItem}>
                      <Text style={styles.anoStatLabel}>Média Geral</Text>
                      <Text style={[styles.anoStatValue, { color: h.mediaGeral !== null ? (h.mediaGeral >= 10 ? Colors.success : Colors.accent) : Colors.textMuted }]}>
                        {h.mediaGeral !== null ? h.mediaGeral.toFixed(1) : '—'}
                      </Text>
                    </View>
                    <View style={styles.anoStatItem}>
                      <Text style={styles.anoStatLabel}>Presenças</Text>
                      <Text style={[styles.anoStatValue, { color: h.presencasPct >= 75 ? Colors.success : Colors.warning }]}>
                        {h.presencasPct}%
                      </Text>
                    </View>
                    <View style={styles.anoStatItem}>
                      <Text style={styles.anoStatLabel}>Avaliações</Text>
                      <Text style={[styles.anoStatValue, { color: Colors.info }]}>{h.notasAno.length}</Text>
                    </View>
                  </View>

                  {/* Resumo por trimestre (mini pills) */}
                  {h.notasAno.length > 0 && (
                    <View style={styles.trimestresPills}>
                      {h.trimestresResumo.filter(tr => tr.notas.length > 0).map(tr => (
                        <View key={tr.trimestre} style={[styles.trimPill, { borderColor: TRIMESTRE_COLORS[tr.trimestre] + '60', backgroundColor: TRIMESTRE_COLORS[tr.trimestre] + '12' }]}>
                          <Text style={[styles.trimPillLabel, { color: TRIMESTRE_COLORS[tr.trimestre] }]}>
                            {tr.trimestre}º Tri
                          </Text>
                          <Text style={[styles.trimPillVal, { color: tr.media !== null ? (tr.media >= 10 ? Colors.success : Colors.accent) : Colors.textMuted }]}>
                            {tr.media !== null ? tr.media.toFixed(1) : '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Notas detalhadas por trimestre */}
                  {h.notasAno.length > 0 && (
                    <NotasPorTrimestreTable notasAno={h.notasAno} />
                  )}

                  {h.notasAno.length === 0 && (
                    <View style={styles.semNotas}>
                      <Ionicons name="document-outline" size={20} color={Colors.textMuted} style={{ marginBottom: 4 }} />
                      <Text style={styles.semNotasText}>
                        {h.ano.ativo ? 'Nenhuma nota lançada ainda neste ano lectivo.' : 'Sem notas registadas neste ano.'}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {viewMode === 'turma' && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.selector} onPress={() => setShowTurmaSelector(v => !v)}>
            <MaterialIcons name="class" size={18} color={Colors.gold} />
            <Text style={selectedTurma ? styles.selectorVal : styles.selectorPlaceholder}>
              {selectedTurma ? `${selectedTurma.nome} — ${selectedTurma.nivel}` : 'Selecionar turma...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {showTurmaSelector && (
            <View style={styles.dropdownList}>
              {turmasAtivas.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.dropdownItem, selectedTurmaId === t.id && styles.dropdownActive]}
                  onPress={() => { setSelectedTurmaId(t.id); setShowTurmaSelector(false); }}
                >
                  <Text style={[styles.dropdownText, selectedTurmaId === t.id && styles.dropdownTextActive]}>{t.nome}</Text>
                  <Text style={styles.dropdownSub}>{t.nivel} — {t.turno}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedTurma && (
            <>
              <View style={styles.turmaStatsRow}>
                <View style={styles.turmaStatCard}>
                  <Text style={[styles.turmaStatVal, { color: Colors.info }]}>{totalAlunos}</Text>
                  <Text style={styles.turmaStatLbl}>Alunos</Text>
                </View>
                <View style={styles.turmaStatCard}>
                  <Text style={[styles.turmaStatVal, { color: Colors.success }]}>{aprovados}</Text>
                  <Text style={styles.turmaStatLbl}>Aprovados</Text>
                </View>
                <View style={styles.turmaStatCard}>
                  <Text style={[styles.turmaStatVal, { color: Colors.accent }]}>{reprovados}</Text>
                  <Text style={styles.turmaStatLbl}>Reprovados</Text>
                </View>
                <View style={styles.turmaStatCard}>
                  <Text style={[styles.turmaStatVal, { color: Colors.gold }]}>{mediaTurma.toFixed(1)}</Text>
                  <Text style={styles.turmaStatLbl}>Média</Text>
                </View>
              </View>

              {/* Cabeçalho da tabela com trimestres */}
              <View style={styles.turmaTableHeader}>
                <Text style={[styles.turmaTableCol, { flex: 1 }]}>Aluno</Text>
                <Text style={[styles.turmaTableCol, { width: 36, textAlign: 'center', color: TRIMESTRE_COLORS[1] }]}>T1</Text>
                <Text style={[styles.turmaTableCol, { width: 36, textAlign: 'center', color: TRIMESTRE_COLORS[2] }]}>T2</Text>
                <Text style={[styles.turmaTableCol, { width: 36, textAlign: 'center', color: TRIMESTRE_COLORS[3] }]}>T3</Text>
                <Text style={[styles.turmaTableCol, { width: 50, textAlign: 'center' }]}>Média</Text>
                <Text style={[styles.turmaTableCol, { width: 70, textAlign: 'right' }]}>Situação</Text>
              </View>
            </>
          )}

          <FlatList
            data={turmaAlunos}
            keyExtractor={item => item.aluno.id}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.turmaAlunoRow, index % 2 === 0 && styles.turmaAlunoRowAlt]}
                onPress={() => { setSelectedAlunoId(item.aluno.id); setViewMode('aluno'); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.turmaAlunoNome}>{item.aluno.nome} {item.aluno.apelido}</Text>
                  <Text style={styles.turmaAlunoMat}>{item.aluno.numeroMatricula}</Text>
                </View>
                {item.porTrimestre.map(pt => (
                  <Text
                    key={pt.trimestre}
                    style={[
                      styles.turmaTrimMedia,
                      { width: 36, color: pt.media !== null ? (pt.media >= 10 ? Colors.success : Colors.accent) : Colors.textMuted },
                    ]}
                  >
                    {pt.media !== null ? pt.media.toFixed(1) : '—'}
                  </Text>
                ))}
                <Text style={[styles.turmaAlunoMedia, { width: 50, color: item.media >= 10 ? Colors.success : Colors.accent }]}>
                  {item.media > 0 ? item.media.toFixed(1) : '—'}
                </Text>
                <View style={{ width: 70, alignItems: 'flex-end' }}>
                  <SituacaoBadge situacao={item.situacao} />
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.border + '80', borderBottomWidth: 1, borderBottomColor: Colors.border },
  readOnlyText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontStyle: 'italic' },
  viewModeRow: { flexDirection: 'row', backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  modeBtnActive: { borderBottomColor: Colors.gold },
  modeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  modeBtnTextActive: { color: Colors.gold },
  scroll: { flex: 1 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 0, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  selectorVal: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  selectorPlaceholder: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  dropdownList: { marginHorizontal: 16, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, maxHeight: 200 },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownActive: { backgroundColor: 'rgba(240,165,0,0.1)' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  dropdownTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  dropdownSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 16, marginBottom: 6 },
  emptyMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  alunoCard: { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 0, gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14 },
  alunoAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  alunoAvatarText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  alunoInfo: { flex: 1 },
  alunoNome: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoMatricula: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  alunoTurma: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.gold },
  situacaoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  situacaoText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', padding: 16, paddingBottom: 0, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  chartCard: { margin: 16, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 16 },
  chartTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  timelineTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  anoCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14 },
  anoCardActive: { borderWidth: 1, borderColor: Colors.gold + '44' },
  anoCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  anoNumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  anoNum: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  ativoBadge: { backgroundColor: Colors.gold + '33', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ativoText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  anoStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  anoStatItem: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 10, alignItems: 'center' },
  anoStatLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 3 },
  anoStatValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },

  trimestresPills: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  trimPill: { flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 8 },
  trimPillLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  trimPillVal: { fontSize: 16, fontFamily: 'Inter_700Bold' },

  trimestresContainer: { gap: 10 },
  trimestreBlock: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  trimestreBlockHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderLeftWidth: 3,
  },
  trimestreBlockHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trimestreDot: { width: 8, height: 8, borderRadius: 4 },
  trimestreBlockTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  mediaTriBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  mediaTriText: { fontSize: 11, fontFamily: 'Inter_700Bold' },

  notasTable: { backgroundColor: Colors.surface, overflow: 'hidden' },
  notasTableHeader: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.primaryLight },
  notasCol: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  notasRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  notasCell: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text },

  semNotas: { paddingVertical: 12, alignItems: 'center' },
  semNotasText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  turmaStatsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  turmaStatCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 10, alignItems: 'center' },
  turmaStatVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  turmaStatLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  turmaTableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surface },
  turmaTableCol: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  turmaAlunoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  turmaAlunoRowAlt: { backgroundColor: 'rgba(26,43,95,0.3)' },
  turmaAlunoNome: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  turmaAlunoMat: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  turmaAlunoMedia: { fontSize: 15, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  turmaTrimMedia: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },

  alunoCardRight: { alignItems: 'flex-end', gap: 8 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.gold + '18', borderWidth: 1, borderColor: Colors.gold + '50', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pdfBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.gold },

  previewModal: { flex: 1, backgroundColor: Colors.background },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  previewTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  previewSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  previewPrintBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a2b5f', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  previewPrintTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  previewCloseBtn: { padding: 6 },
  previewBody: { flex: 1 },
});
