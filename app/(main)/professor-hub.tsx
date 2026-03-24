import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';

function StatCard({ value, label, color, icon }: { value: string | number; label: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, route, badge, color }: { icon: string; label: string; route: string; badge?: number; color?: string; }) {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.quickAction} onPress={() => router.push(route as any)} activeOpacity={0.7}>
      <View style={[styles.quickActionIcon, { backgroundColor: (color || Colors.info) + '22' }]}>
        <Ionicons name={icon as any} size={24} color={color || Colors.info} />
        {badge !== undefined && badge > 0 && (
          <View style={styles.qaBadge}>
            <Text style={styles.qaBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProfessorHubScreen() {
  const { user } = useAuth();
  const { professores, turmas, alunos, notas, presencas } = useData();
  const { sumarios, pautas, mensagens, solicitacoes, calendarioProvas } = useProfessor();
  const { notificacoes, unreadCount } = useNotificacoes();
  const { anoSelecionado } = useAnoAcademico();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const prof = useMemo(() => professores.find(p => p.email === user?.email), [professores, user]);

  const minhasTurmas = useMemo(() =>
    prof ? turmas.filter(t => prof.turmasIds.includes(t.id) && t.ativo) : [],
    [prof, turmas]
  );

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const meusSumarios = useMemo(() =>
    sumarios.filter(s => s.professorId === prof?.id),
    [sumarios, prof]
  );

  const sumariosMes = useMemo(() =>
    meusSumarios.filter(s => {
      const d = new Date(s.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }),
    [meusSumarios, mesAtual, anoAtual]
  );

  const aulasLecionadas = meusSumarios.filter(s => s.status !== 'rejeitado').length;
  const faltasMes = sumariosMes.filter(s => s.status === 'rejeitado').length;

  const minhasNotas = useMemo(() =>
    notas.filter(n => n.professorId === prof?.id),
    [notas, prof]
  );

  const avaliacoesDadas = minhasNotas.filter(n => n.aval1 > 0 || n.aval2 > 0 || n.aval3 > 0 || n.aval4 > 0).length;
  const provasDadas = minhasNotas.filter(n => n.pp1 > 0 || n.ppt > 0).length;

  const minhasMensagensNaoLidas = useMemo(() =>
    mensagens.filter(m =>
      (m.tipo === 'privada' && m.destinatarioId === prof?.id) ||
      (m.tipo === 'turma' && minhasTurmas.some(t => t.id === m.turmaId))
    ).filter(m => !m.lidaPor.includes(prof?.id || '')).length,
    [mensagens, prof, minhasTurmas]
  );

  const provasPublicadas = useMemo(() =>
    calendarioProvas.filter(p => p.publicado && p.turmasIds.some(tid => minhasTurmas.some(t => t.id === tid))),
    [calendarioProvas, minhasTurmas]
  );

  const solicitacoesPendentes = solicitacoes.filter(s => s.professorId === prof?.id && s.status === 'pendente').length;

  const proximasProvas = provasPublicadas
    .filter(p => new Date(p.data) >= hoje)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 4);

  const tipoProvaColor: Record<string, string> = {
    teste: Colors.info,
    exame: Colors.danger,
    trabalho: Colors.gold,
    prova_oral: Colors.success,
  };

  return (
    <View style={styles.container}>
      <TopBar title="Meu Painel" subtitle={prof ? `Prof. ${prof.nome} ${prof.apelido}` : 'Professor'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>

        {/* Welcome Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerAvatar}>
            <Text style={styles.bannerAvatarText}>
              {user?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || 'P'}
            </Text>
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerGreet}>Bem-vindo,</Text>
            <Text style={styles.bannerName} numberOfLines={1}>{user?.nome}</Text>
            <Text style={styles.bannerSub}>{prof?.disciplinas?.join(' · ') || 'Professor'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(main)/perfil' as any)} style={styles.bannerEdit}>
            <Ionicons name="settings-outline" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Este Mês</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard value={faltasMes} label="Faltas" color={Colors.danger} icon="close-circle" />
          <StatCard value={aulasLecionadas} label="Aulas Dadas" color={Colors.success} icon="school" />
          <StatCard value={provasDadas} label="Provas" color={Colors.gold} icon="document-text" />
          <StatCard value={avaliacoesDadas} label="Avaliações" color={Colors.info} icon="bar-chart" />
          <StatCard value={minhasTurmas.length} label="Turmas" color={Colors.accent} icon="people" />
        </ScrollView>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Acesso Rápido</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon="document-text" label="Pautas & Notas" route="/(main)/professor-pauta" color={Colors.gold} />
          <QuickAction icon="people" label="Minhas Turmas" route="/(main)/professor-turmas" color={Colors.info} />
          <QuickAction icon="stats-chart" label="Desempenho" route="/(main)/desempenho" color="#8B5CF6" />
          <QuickAction icon="chatbubbles" label="Mensagens" route="/(main)/professor-mensagens" badge={minhasMensagensNaoLidas} color={Colors.success} />
          <QuickAction icon="folder-open" label="Materiais" route="/(main)/professor-materiais" color={Colors.accent} />
          <QuickAction icon="clipboard" label="Sumário / Presença" route="/(main)/professor-sumario" badge={meusSumarios.filter(s => s.status === 'pendente').length} color={Colors.warning} />
          <QuickAction icon="time" label="Horário" route="/(main)/horario" color={Colors.primaryLight} />
          <QuickAction icon="notifications" label="Notificações" route="/(main)/notificacoes" badge={unreadCount} color={Colors.accent} />
          <QuickAction icon="person" label="Meu Perfil" route="/(main)/perfil" color={Colors.textSecondary} />
        </View>

        {/* Upcoming Exams */}
        {proximasProvas.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Próximas Provas</Text>
            <View style={styles.provasCard}>
              {proximasProvas.map(prova => {
                const data = new Date(prova.data);
                const diffDays = Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
                const color = tipoProvaColor[prova.tipo] || Colors.info;
                return (
                  <View key={prova.id} style={styles.provaRow}>
                    <View style={[styles.provaColorBar, { backgroundColor: color }]} />
                    <View style={styles.provaInfo}>
                      <Text style={styles.provaTitulo}>{prova.titulo}</Text>
                      <Text style={styles.provaSub}>{prova.disciplina} · {prova.hora}</Text>
                    </View>
                    <View style={styles.provaDate}>
                      <Text style={[styles.provaDateNum, { color }]}>
                        {data.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                      </Text>
                      <Text style={styles.provaDateSub}>em {diffDays}d</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Pending Requests */}
        {solicitacoesPendentes > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/(main)/professor-pauta' as any)}
          >
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={styles.alertText}>
              {solicitacoesPendentes} solicitação(ões) de reabertura pendente(s)
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* Recent Sumarios */}
        {meusSumarios.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sumários Recentes</Text>
            <View style={styles.sumCard}>
              {meusSumarios.slice(-3).reverse().map(s => (
                <View key={s.id} style={styles.sumRow}>
                  <View style={[styles.sumStatus, {
                    backgroundColor: s.status === 'aceite' ? Colors.success + '22'
                      : s.status === 'rejeitado' ? Colors.danger + '22' : Colors.warning + '22'
                  }]}>
                    <Ionicons
                      name={s.status === 'aceite' ? 'checkmark-circle' : s.status === 'rejeitado' ? 'close-circle' : 'time'}
                      size={14}
                      color={s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning}
                    />
                    <Text style={[styles.sumStatusText, {
                      color: s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning
                    }]}>
                      {s.status === 'aceite' ? 'Aceite' : s.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sumDisciplina}>{s.disciplina}</Text>
                    <Text style={styles.sumTurma}>{s.turmaNome} · Aula {s.numeroAula}</Text>
                  </View>
                  <Text style={styles.sumData}>
                    {new Date(s.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 16, padding: 18,
    backgroundColor: Colors.backgroundCard, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  bannerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.gold,
  },
  bannerAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  bannerInfo: { flex: 1 },
  bannerGreet: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  bannerName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  bannerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 2 },
  bannerEdit: { padding: 8 },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginHorizontal: 16, marginTop: 16, marginBottom: 10,
  },
  statsRow: { paddingHorizontal: 16, gap: 10 },
  statCard: {
    width: 100, backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 14,
    borderLeftWidth: 3, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginHorizontal: 16,
  },
  quickAction: {
    width: '22%', minWidth: 72, alignItems: 'center', gap: 8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickActionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  qaBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.accent, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  qaBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  quickActionLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center' },
  provasCard: { marginHorizontal: 16, backgroundColor: Colors.backgroundCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  provaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  provaColorBar: { width: 4, height: 36, borderRadius: 2 },
  provaInfo: { flex: 1 },
  provaTitulo: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  provaSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  provaDate: { alignItems: 'flex-end' },
  provaDateNum: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  provaDateSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 14,
    backgroundColor: Colors.warning + '18', borderRadius: 14,
    borderWidth: 1, borderColor: Colors.warning + '44',
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.warning },
  sumCard: { marginHorizontal: 16, backgroundColor: Colors.backgroundCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sumStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sumStatusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  sumDisciplina: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  sumTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  sumData: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
});
