import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, FlatList, Alert,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';

const DISCIPLINAS_DISPONIVEIS = [
  'Língua Portuguesa', 'Matemática', 'Física', 'Química', 'Biologia',
  'História', 'Geografia', 'Língua Estrangeira I', 'Filosofia', 'Educação Física',
  'Estudo do Meio', 'Educação Artística', 'Educação Moral e Cívica',
];

export default function ProfessorTurmasScreen() {
  const { user } = useAuth();
  const { professores, turmas, alunos, presencas, addPresenca } = useData();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [turmaIdx, setTurmaIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'alunos' | 'presencas' | 'colegas'>('alunos');
  const [disciplinaPresenca, setDisciplinaPresenca] = useState('');
  const [showDiscList, setShowDiscList] = useState(false);

  const hoje = new Date().toISOString().split('T')[0];

  const prof = useMemo(() => professores.find(p => p.email === user?.email), [professores, user]);

  const minhasTurmas = useMemo(() =>
    prof ? turmas.filter(t => prof.turmasIds.includes(t.id) && t.ativo) : [],
    [prof, turmas]
  );

  const turmaAtual = minhasTurmas[turmaIdx] || minhasTurmas[0];

  const alunosDaTurma = useMemo(() =>
    turmaAtual ? alunos.filter(a => a.turmaId === turmaAtual.id && a.ativo) : [],
    [turmaAtual, alunos]
  );

  const alunosFiltrados = useMemo(() =>
    alunosDaTurma.filter(a =>
      `${a.nome} ${a.apelido} ${a.numeroMatricula}`.toLowerCase().includes(search.toLowerCase())
    ),
    [alunosDaTurma, search]
  );

  const colegasDaTurma = useMemo(() => {
    if (!turmaAtual) return [];
    return professores.filter(p => p.id !== prof?.id && p.turmasIds.includes(turmaAtual.id) && p.ativo);
  }, [turmaAtual, professores, prof]);

  const presencasHoje = useMemo(() => {
    if (!turmaAtual || !disciplinaPresenca) return [];
    return presencas.filter(p =>
      p.data === hoje && p.turmaId === turmaAtual.id && p.disciplina === disciplinaPresenca
    );
  }, [presencas, hoje, turmaAtual, disciplinaPresenca]);

  function getAlunoStatus(alunoId: string): 'P' | 'F' | 'J' | null {
    const p = presencasHoje.find(p => p.alunoId === alunoId);
    return p ? p.status : null;
  }

  async function marcar(alunoId: string, status: 'P' | 'F' | 'J') {
    if (!turmaAtual || !disciplinaPresenca) {
      Alert.alert('Atenção', 'Selecione uma disciplina antes de marcar presenças.');
      return;
    }
    const existing = presencasHoje.find(p => p.alunoId === alunoId);
    if (existing) return;
    await addPresenca({ alunoId, turmaId: turmaAtual.id, disciplina: disciplinaPresenca, data: hoje, status });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function marcarTodos(status: 'P' | 'F') {
    if (!turmaAtual || !disciplinaPresenca) {
      Alert.alert('Atenção', 'Selecione uma disciplina antes de marcar presenças.');
      return;
    }
    for (const aluno of alunosDaTurma) {
      const existing = presencasHoje.find(p => p.alunoId === aluno.id);
      if (!existing) {
        await addPresenca({ alunoId: aluno.id, turmaId: turmaAtual.id, disciplina: disciplinaPresenca, data: hoje, status });
      }
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function getPresencaStats(alunoId: string) {
    const pr = presencas.filter(p => p.alunoId === alunoId && (!turmaAtual || p.turmaId === turmaAtual.id));
    const total = pr.length;
    const presentes = pr.filter(p => p.status === 'P').length;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 100;
    return { total, presentes, pct };
  }

  const statusColors = { P: Colors.success, F: Colors.danger, J: Colors.warning };
  const presentesHoje = presencasHoje.filter(p => p.status === 'P').length;
  const faltasHoje = presencasHoje.filter(p => p.status === 'F').length;
  const justificadasHoje = presencasHoje.filter(p => p.status === 'J').length;
  const discProf = prof?.disciplinas || DISCIPLINAS_DISPONIVEIS;

  if (!prof) {
    return (
      <View style={styles.container}>
        <TopBar title="Minhas Turmas" subtitle="Dados do professor" />
        <View style={styles.empty}>
          <Ionicons name="warning-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Perfil de professor não encontrado</Text>
          <Text style={styles.emptySub}>O seu e-mail não está associado a nenhum professor no sistema.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="Minhas Turmas" subtitle={`${minhasTurmas.length} turma(s) atribuída(s)`} />

      {minhasTurmas.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome5 name="chalkboard-teacher" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Sem turmas atribuídas</Text>
          <Text style={styles.emptySub}>Contacte o administrador para ser adicionado a uma turma.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.turmaTabs}>
            <View style={styles.turmaTabsInner}>
              {minhasTurmas.map((t, i) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.turmaTab, turmaIdx === i && styles.turmaTabActive]}
                  onPress={() => setTurmaIdx(i)}
                >
                  <Text style={[styles.turmaTabText, turmaIdx === i && styles.turmaTabTextActive]}>{t.nome}</Text>
                  <View style={[styles.turmaTabBadge, turmaIdx === i && styles.turmaTabBadgeActive]}>
                    <Text style={[styles.turmaTabBadgeText, turmaIdx === i && styles.turmaTabBadgeTextActive]}>
                      {alunos.filter(a => a.turmaId === t.id && a.ativo).length}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {turmaAtual && (
            <View style={styles.infoBar}>
              <View style={styles.infoBadge}>
                <MaterialIcons name="class" size={12} color={Colors.gold} />
                <Text style={styles.infoText}>{turmaAtual.nivel}</Text>
              </View>
              <View style={styles.infoBadge}>
                <Ionicons name="time" size={12} color={Colors.info} />
                <Text style={styles.infoText}>{turmaAtual.turno}</Text>
              </View>
              <View style={styles.infoBadge}>
                <Ionicons name="location" size={12} color={Colors.textMuted} />
                <Text style={styles.infoText}>{turmaAtual.sala}</Text>
              </View>
              <View style={styles.infoBadge}>
                <Ionicons name="people" size={12} color={Colors.success} />
                <Text style={styles.infoText}>{alunosDaTurma.length} alunos</Text>
              </View>
            </View>
          )}

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'alunos' && styles.tabBtnActive]}
              onPress={() => setTab('alunos')}
            >
              <Ionicons name="people" size={15} color={tab === 'alunos' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.tabText, tab === 'alunos' && styles.tabTextActive]}>Alunos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'presencas' && styles.tabBtnActive]}
              onPress={() => setTab('presencas')}
            >
              <Ionicons name="checkmark-circle" size={15} color={tab === 'presencas' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.tabText, tab === 'presencas' && styles.tabTextActive]}>Presenças</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'colegas' && styles.tabBtnActive]}
              onPress={() => setTab('colegas')}
            >
              <FontAwesome5 name="chalkboard-teacher" size={13} color={tab === 'colegas' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.tabText, tab === 'colegas' && styles.tabTextActive]}>Colegas</Text>
            </TouchableOpacity>
          </View>

          {tab === 'alunos' && (
            <>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pesquisar aluno..."
                  placeholderTextColor={Colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <FlatList
                data={alunosFiltrados}
                keyExtractor={a => a.id}
                contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Nenhum aluno encontrado</Text>
                  </View>
                }
                renderItem={({ item: aluno, index }) => {
                  const stats = getPresencaStats(aluno.id);
                  const pctColor = stats.pct >= 75 ? Colors.success : stats.pct >= 50 ? Colors.warning : Colors.danger;
                  return (
                    <View style={styles.alunoCard}>
                      <View style={styles.alunoNum}>
                        <Text style={styles.alunoNumText}>{String(index + 1).padStart(2, '0')}</Text>
                      </View>
                      <View style={styles.alunoAvatar}>
                        <Text style={styles.alunoAvatarText}>
                          {aluno.nome[0]}{aluno.apelido[0]}
                        </Text>
                      </View>
                      <View style={styles.alunoInfo}>
                        <Text style={styles.alunoNome}>{aluno.nome} {aluno.apelido}</Text>
                        <Text style={styles.alunoMatricula}>{aluno.numeroMatricula}</Text>
                      </View>
                      <View style={styles.alunoStats}>
                        <View style={[styles.pctBadge, { backgroundColor: pctColor + '22' }]}>
                          <Text style={[styles.pctText, { color: pctColor }]}>{stats.pct}%</Text>
                        </View>
                        <Text style={styles.pctLabel}>presença</Text>
                      </View>
                    </View>
                  );
                }}
              />
            </>
          )}

          {tab === 'presencas' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
              <View style={styles.presencaHeader}>
                <Ionicons name="calendar" size={14} color={Colors.gold} />
                <Text style={styles.presencaData}>Hoje: {hoje}</Text>
              </View>

              <View style={styles.discSelector}>
                <Text style={styles.discLabel}>Disciplina *</Text>
                <TouchableOpacity
                  style={styles.discBtn}
                  onPress={() => setShowDiscList(v => !v)}
                >
                  <Text style={disciplinaPresenca ? styles.discBtnVal : styles.discBtnPlaceholder}>
                    {disciplinaPresenca || 'Selecionar disciplina...'}
                  </Text>
                  <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
                </TouchableOpacity>
                {showDiscList && (
                  <View style={styles.discList}>
                    {discProf.map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.discItem, disciplinaPresenca === d && styles.discItemActive]}
                        onPress={() => { setDisciplinaPresenca(d); setShowDiscList(false); }}
                      >
                        <Text style={[styles.discItemText, disciplinaPresenca === d && { color: Colors.gold }]}>{d}</Text>
                        {disciplinaPresenca === d && <Ionicons name="checkmark" size={14} color={Colors.gold} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {disciplinaPresenca ? (
                <>
                  <View style={styles.statsBar}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statNum, { color: Colors.success }]}>{presentesHoje}</Text>
                      <Text style={styles.statLbl}>Presentes</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statNum, { color: Colors.danger }]}>{faltasHoje}</Text>
                      <Text style={styles.statLbl}>Faltas</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statNum, { color: Colors.warning }]}>{justificadasHoje}</Text>
                      <Text style={styles.statLbl}>Justific.</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statNum, { color: Colors.textSecondary }]}>{alunosDaTurma.length}</Text>
                      <Text style={styles.statLbl}>Total</Text>
                    </View>
                  </View>

                  <View style={styles.bulkRow}>
                    <TouchableOpacity style={[styles.bulkBtn, { borderColor: Colors.success + '55' }]} onPress={() => marcarTodos('P')}>
                      <Ionicons name="checkmark-done" size={14} color={Colors.success} />
                      <Text style={[styles.bulkBtnText, { color: Colors.success }]}>Todos Presentes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.bulkBtn, { borderColor: Colors.danger + '55' }]} onPress={() => marcarTodos('F')}>
                      <Ionicons name="close" size={14} color={Colors.danger} />
                      <Text style={[styles.bulkBtnText, { color: Colors.danger }]}>Todos Faltaram</Text>
                    </TouchableOpacity>
                  </View>

                  {alunosDaTurma.map((aluno, index) => {
                    const status = getAlunoStatus(aluno.id);
                    const statusColor = status ? statusColors[status] : Colors.textMuted;
                    return (
                      <View key={aluno.id} style={[styles.presRow, { borderLeftColor: status ? statusColors[status] : Colors.border, borderLeftWidth: status ? 3 : 1 }]}>
                        <View style={[styles.presInitials, { backgroundColor: status ? statusColor + '22' : Colors.surface }]}>
                          <Text style={[styles.presInitialsText, { color: status ? statusColor : Colors.textMuted }]}>
                            {aluno.nome[0]}{aluno.apelido[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.presNome}>{aluno.nome} {aluno.apelido}</Text>
                          <Text style={styles.presMat}>{aluno.numeroMatricula}</Text>
                        </View>
                        <View style={styles.presBtns}>
                          {(['P', 'F', 'J'] as const).map(s => (
                            <TouchableOpacity
                              key={s}
                              style={[styles.presBtn, status === s && { backgroundColor: statusColors[s] }]}
                              onPress={() => marcar(aluno.id, s)}
                              disabled={!!status}
                            >
                              <Text style={[styles.presBtnText, status === s && { color: '#fff' }]}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : (
                <View style={styles.empty}>
                  <Ionicons name="checkmark-circle-outline" size={52} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>Selecione uma disciplina</Text>
                  <Text style={styles.emptySub}>Escolha a disciplina para marcar as presenças de hoje.</Text>
                </View>
              )}
            </ScrollView>
          )}

          {tab === 'colegas' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}>
              {colegasDaTurma.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Sem outros professores nesta turma</Text>
                </View>
              ) : (
                colegasDaTurma.map(p => (
                  <View key={p.id} style={styles.colegaCard}>
                    <View style={styles.colegaAvatar}>
                      <Text style={styles.colegaAvatarText}>{p.nome[0]}{p.apelido[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.colegaNome}>{p.nome} {p.apelido}</Text>
                      <Text style={styles.colegaDisciplinas}>{p.disciplinas.join(' · ')}</Text>
                      <Text style={styles.colegaEmail}>{p.email}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.msgBtn}
                      onPress={() => router.push('/(main)/professor-mensagens' as any)}
                    >
                      <Ionicons name="chatbubble-ellipses" size={18} color={Colors.info} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  turmaTabs: { maxHeight: 54, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  turmaTabsInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  turmaTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface },
  turmaTabActive: { backgroundColor: Colors.accent },
  turmaTabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  turmaTabTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  turmaTabBadge: { backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  turmaTabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  turmaTabBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  turmaTabBadgeTextActive: { color: '#fff' },
  infoBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.backgroundCard },
  infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  infoText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, marginBottom: 4, backgroundColor: Colors.surface, borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10 },
  tabBtnActive: { backgroundColor: Colors.backgroundCard },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, marginBottom: 4, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  alunoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  alunoNum: { width: 28, alignItems: 'center' },
  alunoNumText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  alunoAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  alunoAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.gold },
  alunoInfo: { flex: 1 },
  alunoNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  alunoMatricula: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  alunoStats: { alignItems: 'center' },
  pctBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pctText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  pctLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  presencaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  presencaData: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  discSelector: { marginHorizontal: 16, marginBottom: 8 },
  discLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.7 },
  discBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.border },
  discBtnVal: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  discBtnPlaceholder: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  discList: { backgroundColor: Colors.surface, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border, maxHeight: 200 },
  discItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  discItemActive: { backgroundColor: Colors.gold + '11' },
  discItemText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  statsBar: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  bulkRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  bulkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1, backgroundColor: Colors.backgroundCard },
  bulkBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  presRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginHorizontal: 16, marginBottom: 8 },
  presInitials: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  presInitialsText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  presNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  presMat: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  presBtns: { flexDirection: 'row', gap: 5 },
  presBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  presBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  colegaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  colegaAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.info + '33', alignItems: 'center', justifyContent: 'center' },
  colegaAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.info },
  colegaNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  colegaDisciplinas: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 2 },
  colegaEmail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  msgBtn: { padding: 10, backgroundColor: Colors.info + '22', borderRadius: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, minHeight: 200 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
});
