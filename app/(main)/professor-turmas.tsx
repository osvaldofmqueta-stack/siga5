import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, FlatList,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';

export default function ProfessorTurmasScreen() {
  const { user } = useAuth();
  const { professores, turmas, alunos, presencas } = useData();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [turmaIdx, setTurmaIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'alunos' | 'colegas'>('alunos');

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

  function getPresencaStats(alunoId: string) {
    const pr = presencas.filter(p => p.alunoId === alunoId && (!turmaAtual || p.turmaId === turmaAtual.id));
    const total = pr.length;
    const presentes = pr.filter(p => p.status === 'P').length;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 100;
    return { total, presentes, pct };
  }

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
          {/* Turma Selector */}
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

          {/* Turma Info */}
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

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'alunos' && styles.tabBtnActive]}
              onPress={() => setTab('alunos')}
            >
              <Ionicons name="people" size={16} color={tab === 'alunos' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.tabText, tab === 'alunos' && styles.tabTextActive]}>
                Alunos ({alunosDaTurma.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'colegas' && styles.tabBtnActive]}
              onPress={() => setTab('colegas')}
            >
              <FontAwesome5 name="chalkboard-teacher" size={14} color={tab === 'colegas' ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.tabText, tab === 'colegas' && styles.tabTextActive]}>
                Colegas ({colegasDaTurma.length})
              </Text>
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
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  tabBtnActive: { backgroundColor: Colors.backgroundCard },
  tabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
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
  colegaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  colegaAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.info + '33', alignItems: 'center', justifyContent: 'center' },
  colegaAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.info },
  colegaNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  colegaDisciplinas: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 2 },
  colegaEmail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  msgBtn: { padding: 10, backgroundColor: Colors.info + '22', borderRadius: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
});
