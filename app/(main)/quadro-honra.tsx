import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { api } from '@/lib/api';
import TopBar from '@/components/TopBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuadroEntry {
  id: string;
  alunoId: string;
  alunoNome: string;
  alunoNomeCompleto?: string;
  numeroMatricula?: string;
  foto?: string;
  turmaId: string;
  turmaNome: string;
  classe?: string;
  anoLetivo: string;
  trimestre?: number;
  mediaGeral: number;
  posicaoClasse: number;
  posicaoGeral?: number;
  melhorEscola: boolean;
  mencionado: string;
  publicado: boolean;
  geradoPor: string;
  createdAt: string;
}

interface Turma { id: string; nome: string; classe: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const MENCAO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  excelencia: { label: 'Excelência', color: '#FFD700', bg: '#FFD70025', icon: 'trophy' },
  louvor:     { label: 'Louvor',     color: Colors.gold, bg: Colors.gold + '20', icon: 'star' },
  honra:      { label: 'Honra',      color: Colors.info,  bg: Colors.info + '20',  icon: 'ribbon' },
  '':         { label: 'Destaque',   color: Colors.textSecondary, bg: Colors.border, icon: 'account-star' },
};

const TRIMESTRE_LABELS: Record<number, string> = { 1: '1º Trimestre', 2: '2º Trimestre', 3: '3º Trimestre' };

function medaColor(m: number) {
  if (m >= 18) return '#FFD700';
  if (m >= 15) return Colors.gold;
  if (m >= 14) return Colors.success;
  if (m >= 10) return Colors.info;
  return Colors.danger;
}

function posicaoLabel(p: number) {
  if (p === 1) return '🥇';
  if (p === 2) return '🥈';
  if (p === 3) return '🥉';
  return `${p}º`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QuadroHonraScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { anoAtivo } = useAnoAcademico();
  const { turmas: allTurmas } = useData();

  const [entries, setEntries] = useState<QuadroEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [filtroTrimestre, setFiltroTrimestre] = useState<number | null>(null);
  const [filtroTurma, setFiltroTurma] = useState('');
  const [viewMode, setViewMode] = useState<'geral' | 'classe'>('geral');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const anoLetivo = anoAtivo?.ano || '';
  const turmas: Turma[] = (allTurmas || []) as Turma[];

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!anoLetivo) return;
    setLoading(true);
    try {
      let url = `/api/quadro-honra?anoLetivo=${encodeURIComponent(anoLetivo)}`;
      if (filtroTrimestre !== null) url += `&trimestre=${filtroTrimestre}`;
      if (filtroTurma) url += `&turmaId=${filtroTurma}`;
      const data = await api.get<QuadroEntry[]>(url);
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [anoLetivo, filtroTrimestre, filtroTurma]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Generate Honor Roll ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setShowConfirmModal(false);
    setGenerating(true);
    try {
      const result = await api.post<{ gerados: number }>('/api/quadro-honra/gerar', {
        anoLetivo,
        trimestre: filtroTrimestre,
        geradoPor: user?.nome || 'Sistema',
      });
      Alert.alert('Quadro de Honra Gerado', `${result.gerados} aluno(s) classificado(s) com sucesso.`);
      fetchData();
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Limpar Quadro de Honra',
      `Tem a certeza que deseja eliminar o quadro de honra de ${anoLetivo}${filtroTrimestre ? ` — ${TRIMESTRE_LABELS[filtroTrimestre]}` : ''}?`,
      [
        { text: 'Cancelar' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              let url = `/api/quadro-honra?anoLetivo=${encodeURIComponent(anoLetivo)}`;
              if (filtroTrimestre !== null) url += `&trimestre=${filtroTrimestre}`;
              await api.delete(url);
              fetchData();
            } catch (e) { Alert.alert('Erro', (e as Error).message); }
          },
        },
      ]
    );
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const melhorEscola = useMemo(() => entries.find(e => e.melhorEscola), [entries]);

  const porClasse = useMemo(() => {
    const map: Record<string, QuadroEntry[]> = {};
    for (const e of entries) {
      const key = e.turmaNome;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    // Sort each class by posicaoClasse
    for (const k in map) map[k].sort((a, b) => a.posicaoClasse - b.posicaoClasse);
    return map;
  }, [entries]);

  const entriesGeralSorted = useMemo(() =>
    [...entries].sort((a, b) => (a.posicaoGeral ?? 999) - (b.posicaoGeral ?? 999)),
  [entries]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TopBar title="Quadro de Honra" subtitle={`Melhores alunos — ${anoLetivo}`} />

      {/* Controls */}
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {/* Trimestre filter */}
          <TouchableOpacity
            style={[styles.chip, filtroTrimestre === null && styles.chipActive]}
            onPress={() => setFiltroTrimestre(null)}
          >
            <Text style={[styles.chipText, filtroTrimestre === null && styles.chipTextActive]}>Anual</Text>
          </TouchableOpacity>
          {[1, 2, 3].map(t => (
            <TouchableOpacity key={t} style={[styles.chip, filtroTrimestre === t && styles.chipActive]}
              onPress={() => setFiltroTrimestre(t)}>
              <Text style={[styles.chipText, filtroTrimestre === t && styles.chipTextActive]}>{t}º Trim.</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          {/* View mode */}
          <TouchableOpacity style={[styles.chip, viewMode === 'geral' && styles.chipActive]}
            onPress={() => setViewMode('geral')}>
            <MaterialCommunityIcons name="format-list-numbered" size={14} color={viewMode === 'geral' ? Colors.gold : Colors.textSecondary} />
            <Text style={[styles.chipText, viewMode === 'geral' && styles.chipTextActive]}>Geral</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, viewMode === 'classe' && styles.chipActive]}
            onPress={() => setViewMode('classe')}>
            <MaterialCommunityIcons name="google-classroom" size={14} color={viewMode === 'classe' ? Colors.gold : Colors.textSecondary} />
            <Text style={[styles.chipText, viewMode === 'classe' && styles.chipTextActive]}>Por Classe</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Action buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.generateBtn} onPress={() => setShowConfirmModal(true)} disabled={generating}>
          {generating ? (
            <ActivityIndicator size="small" color={Colors.primaryDark} />
          ) : (
            <>
              <MaterialCommunityIcons name="refresh" size={18} color={Colors.primaryDark} />
              <Text style={styles.generateBtnText}>Gerar Quadro</Text>
            </>
          )}
        </TouchableOpacity>
        {entries.length > 0 && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>A calcular classificações...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="trophy-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sem dados no Quadro de Honra</Text>
          <Text style={styles.emptySubtitle}>
            Prima "Gerar Quadro" para calcular as classificações com base nas notas lançadas.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          {/* Melhor da Escola destaque */}
          {melhorEscola && (
            <MelhorEscolaCard entry={melhorEscola} />
          )}

          {/* Summary stats */}
          <View style={styles.statsRow}>
            <StatBox label="Alunos" value={entries.length} color={Colors.info} />
            <StatBox label="Turmas" value={Object.keys(porClasse).length} color={Colors.gold} />
            <StatBox label="Excelência" value={entries.filter(e => e.mencionado === 'excelencia').length} color="#FFD700" />
            <StatBox label="Louvor" value={entries.filter(e => e.mencionado === 'louvor').length} color={Colors.gold} />
          </View>

          {viewMode === 'geral' ? (
            <GeralView entries={entriesGeralSorted} />
          ) : (
            <ClasseView porClasse={porClasse} />
          )}
        </ScrollView>
      )}

      {/* Confirm Generate Modal */}
      {showConfirmModal && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setShowConfirmModal(false)}>
          <View style={styles.overlay}>
            <View style={styles.confirmModal}>
              <MaterialCommunityIcons name="trophy" size={48} color={Colors.gold} />
              <Text style={styles.confirmTitle}>Gerar Quadro de Honra</Text>
              <Text style={styles.confirmText}>
                Isto irá calcular as classificações de todos os alunos com notas lançadas em{' '}
                <Text style={{ color: Colors.gold, fontWeight: '700' }}>{anoLetivo}</Text>
                {filtroTrimestre ? ` — ${TRIMESTRE_LABELS[filtroTrimestre]}` : ' (anual)'}.{'\n\n'}
                Os dados existentes para este período serão substituídos.
              </Text>
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowConfirmModal(false)}>
                  <Text style={styles.confirmCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmOk} onPress={handleGenerate}>
                  <Text style={styles.confirmOkText}>Gerar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Melhor da Escola Card ────────────────────────────────────────────────────

function MelhorEscolaCard({ entry }: { entry: QuadroEntry }) {
  return (
    <View style={styles.bestCard}>
      <View style={styles.bestCardBg} />
      <View style={styles.bestCardContent}>
        <MaterialCommunityIcons name="trophy" size={36} color="#FFD700" />
        <View style={styles.bestCardText}>
          <Text style={styles.bestCardLabel}>🏆 Melhor Aluno da Escola</Text>
          <Text style={styles.bestCardName}>{entry.alunoNomeCompleto || entry.alunoNome}</Text>
          <Text style={styles.bestCardSub}>{entry.turmaNome} · {entry.classe}</Text>
          <Text style={styles.bestCardMedia}>
            Média: <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: '900' }}>{entry.mediaGeral.toFixed(1)}</Text>
            <Text style={{ fontSize: 14, color: Colors.textSecondary }}> / 20</Text>
          </Text>
        </View>
      </View>
      {entry.mencionado ? (
        <View style={[styles.mencaoBadge, { backgroundColor: '#FFD70030' }]}>
          <Text style={[styles.mencaoBadgeText, { color: '#FFD700' }]}>
            {MENCAO_CONFIG[entry.mencionado]?.label || 'Destaque'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Geral View ───────────────────────────────────────────────────────────────

function GeralView({ entries }: { entries: QuadroEntry[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Classificação Geral</Text>
      {entries.map((entry, idx) => (
        <EntryCard key={entry.id} entry={entry} showGeral />
      ))}
    </View>
  );
}

// ─── Por Classe View ──────────────────────────────────────────────────────────

function ClasseView({ porClasse }: { porClasse: Record<string, QuadroEntry[]> }) {
  const classNames = Object.keys(porClasse).sort();
  return (
    <View style={styles.section}>
      {classNames.map(classe => (
        <View key={classe} style={styles.classeSection}>
          <View style={styles.classeSectionHeader}>
            <MaterialCommunityIcons name="google-classroom" size={18} color={Colors.gold} />
            <Text style={styles.classeSectionTitle}>{classe}</Text>
            <View style={styles.classeBadge}>
              <Text style={styles.classeBadgeText}>{porClasse[classe].length} alunos</Text>
            </View>
          </View>
          {porClasse[classe].map(entry => (
            <EntryCard key={entry.id} entry={entry} showGeral={false} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, showGeral }: { entry: QuadroEntry; showGeral: boolean }) {
  const mencao = MENCAO_CONFIG[entry.mencionado] || MENCAO_CONFIG[''];
  const pos = showGeral ? entry.posicaoGeral ?? entry.posicaoClasse : entry.posicaoClasse;
  const isTop3 = pos <= 3;
  const isFirst = pos === 1;

  return (
    <View style={[styles.entryCard, isFirst && !showGeral && styles.entryCardFirst, entry.melhorEscola && showGeral && styles.entryCardBest]}>
      {/* Position */}
      <View style={[styles.posBox, isFirst && { backgroundColor: '#FFD70030' }]}>
        <Text style={[styles.posText, { color: isTop3 ? medaColor(entry.mediaGeral) : Colors.textSecondary }]}>
          {posicaoLabel(pos)}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.entryInfo}>
        <Text style={[styles.entryName, entry.melhorEscola && showGeral && { color: '#FFD700' }]}>
          {entry.alunoNomeCompleto || entry.alunoNome}
          {entry.melhorEscola && showGeral ? ' 🏆' : ''}
        </Text>
        <Text style={styles.entrySub}>
          {showGeral ? entry.turmaNome : `Nº ${entry.numeroMatricula || '—'}`}
          {entry.classe ? ` · ${entry.classe}` : ''}
        </Text>
        {entry.mencionado ? (
          <View style={[styles.mencaoBadgeSm, { backgroundColor: mencao.bg }]}>
            <Text style={[styles.mencaoBadgeSmText, { color: mencao.color }]}>{mencao.label}</Text>
          </View>
        ) : null}
      </View>

      {/* Media */}
      <View style={styles.mediaBox}>
        <Text style={[styles.mediaValue, { color: medaColor(entry.mediaGeral) }]}>
          {entry.mediaGeral.toFixed(1)}
        </Text>
        <Text style={styles.mediaLabel}>/ 20</Text>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBox, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  controls: { backgroundColor: Colors.backgroundCard, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginRight: 6 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.gold },
  chipText: { fontSize: 12, color: Colors.textSecondary },
  chipTextActive: { color: Colors.gold, fontWeight: '700' },
  divider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },

  actionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  generateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, borderRadius: 10, paddingVertical: 10 },
  generateBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark },
  deleteBtn: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.danger + '60' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  content: { flex: 1 },

  // Best of school card
  bestCard: { margin: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.backgroundCard, borderWidth: 1.5, borderColor: '#FFD70060' },
  bestCardBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFD70008' },
  bestCardContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  bestCardText: { flex: 1, gap: 3 },
  bestCardLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  bestCardName: { fontSize: 18, fontWeight: '900', color: '#FFD700' },
  bestCardSub: { fontSize: 13, color: Colors.textSecondary },
  bestCardMedia: { fontSize: 14, color: Colors.text, marginTop: 4 },
  mencaoBadge: { margin: 12, marginTop: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  mencaoBadgeText: { fontSize: 13, fontWeight: '700' },

  // Stats row
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  statBox: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 10, padding: 12, alignItems: 'center', borderTopWidth: 3 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  // Section
  section: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12, marginTop: 4 },

  // Classe section
  classeSection: { marginBottom: 20 },
  classeSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  classeSectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  classeBadge: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  classeBadgeText: { fontSize: 11, color: Colors.gold, fontWeight: '700' },

  // Entry card
  entryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  entryCardFirst: { borderColor: '#FFD70050', backgroundColor: Colors.backgroundCard },
  entryCardBest: { borderColor: '#FFD70060', borderWidth: 1.5 },

  posBox: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundElevated },
  posText: { fontSize: 14, fontWeight: '900' },

  entryInfo: { flex: 1, gap: 3 },
  entryName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  entrySub: { fontSize: 12, color: Colors.textSecondary },

  mencaoBadgeSm: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 2 },
  mencaoBadgeSmText: { fontSize: 10, fontWeight: '700' },

  mediaBox: { alignItems: 'center' },
  mediaValue: { fontSize: 20, fontWeight: '900' },
  mediaLabel: { fontSize: 10, color: Colors.textMuted },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmModal: { backgroundColor: Colors.backgroundCard, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  confirmText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  confirmCancelText: { fontSize: 14, color: Colors.text },
  confirmOk: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.gold, alignItems: 'center' },
  confirmOkText: { fontSize: 14, fontWeight: '800', color: Colors.primaryDark },
});
