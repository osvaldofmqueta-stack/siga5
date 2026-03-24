import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, RefreshControl
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/StatCard';
import TopBar from '@/components/TopBar';
import { BarChart, PieChart } from '@/components/Charts';

const { width } = Dimensions.get('window');
const CHART_WIDTH = Math.min(width - 64, 340);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function calcApprovalRate(notas: any[]) {
  if (!notas.length) return 0;
  const approved = notas.filter(n => n.mac >= 10).length;
  return Math.round((approved / notas.length) * 100);
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { alunos, professores, turmas, notas, eventos, presencas, isLoading } = useData();

  const stats = useMemo(() => ({
    totalAlunos: alunos.filter(a => a.ativo).length,
    totalProfessores: professores.filter(p => p.ativo).length,
    totalTurmas: turmas.filter(t => t.ativo).length,
    totalEventos: eventos.length,
    taxaAprovacao: calcApprovalRate(notas),
    mediaGeral: notas.length ? (notas.reduce((s, n) => s + n.mac, 0) / notas.length).toFixed(1) : '0',
  }), [alunos, professores, turmas, notas, eventos]);

  const nivelData = useMemo(() => {
    const primario = alunos.filter(a => {
      const t = turmas.find(t => t.id === a.turmaId);
      return t?.nivel === 'Primário';
    }).length;
    const ciclo1 = alunos.filter(a => {
      const t = turmas.find(t => t.id === a.turmaId);
      return t?.nivel === 'I Ciclo';
    }).length;
    const ciclo2 = alunos.filter(a => {
      const t = turmas.find(t => t.id === a.turmaId);
      return t?.nivel === 'II Ciclo';
    }).length;
    return [
      { label: 'Primário', value: primario, color: Colors.info },
      { label: 'I Ciclo', value: ciclo1, color: Colors.gold },
      { label: 'II Ciclo', value: ciclo2, color: Colors.accent },
    ];
  }, [alunos, turmas]);

  const notasBar = useMemo(() => {
    const disciplinas = [...new Set(notas.map(n => n.disciplina))].slice(0, 5);
    return disciplinas.map((d, i) => {
      const disciplinaNotas = notas.filter(n => n.disciplina === d);
      const media = disciplinaNotas.reduce((s, n) => s + n.mac, 0) / disciplinaNotas.length;
      const colors = [Colors.gold, Colors.accent, Colors.info, Colors.success, Colors.warning];
      return { label: d.substring(0, 4), value: parseFloat(media.toFixed(1)), color: colors[i % colors.length] };
    });
  }, [notas]);

  const proximosEventos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return eventos.filter(e => e.data >= today).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
  }, [eventos]);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const eventoTypeColor = (tipo: string) => {
    const map: Record<string, string> = {
      'Académico': Colors.info, 'Cultural': Colors.gold, 'Desportivo': Colors.success,
      'Exame': Colors.danger, 'Feriado': Colors.warning, 'Reunião': Colors.textSecondary,
    };
    return map[tipo] || Colors.textMuted;
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Dashboard" subtitle={user?.nome ? `${getGreeting()}, ${user.nome.split(' ')[0]}` : getGreeting()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} colors={[Colors.gold]} tintColor={Colors.gold} />}
      >
        <View style={styles.statsGrid}>
          <StatCard label="Alunos" value={stats.totalAlunos} icon={<Ionicons name="people" size={22} color={Colors.info} />} color={Colors.info} subtitle="Matriculados" delay={0} onPress={() => router.push('/(main)/alunos')} />
          <StatCard label="Professores" value={stats.totalProfessores} icon={<FontAwesome5 name="chalkboard-teacher" size={18} color={Colors.gold} />} color={Colors.gold} subtitle="Activos" delay={80} onPress={() => router.push('/(main)/professores')} />
          <StatCard label="Turmas" value={stats.totalTurmas} icon={<MaterialIcons name="class" size={22} color={Colors.success} />} color={Colors.success} subtitle="Activas" delay={160} onPress={() => router.push('/(main)/turmas')} />
          <StatCard label="Aprovação" value={`${stats.taxaAprovacao}%`} icon={<Ionicons name="checkmark-circle" size={22} color={Colors.accent} />} color={Colors.accent} subtitle="Taxa global" delay={240} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.gold }]} />
              <Text style={styles.sectionTitle}>Desempenho por Disciplina</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(main)/relatorios')}>
              <Text style={styles.seeAll}>Ver mais</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartCard}>
            {notasBar.length > 0 ? (
              <BarChart data={notasBar} maxValue={20} height={180} width={CHART_WIDTH} />
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyChartText}>Sem dados de notas</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.info }]} />
              <Text style={styles.sectionTitle}>Alunos por Nível</Text>
            </View>
          </View>
          <View style={styles.chartCard}>
            <PieChart data={nivelData} size={160} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.sectionTitle}>Próximos Eventos</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(main)/eventos')}>
              <Text style={styles.seeAll}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          {proximosEventos.length === 0 ? (
            <View style={styles.emptyEvents}>
              <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyEventsText}>Sem eventos próximos</Text>
            </View>
          ) : (
            proximosEventos.map(evento => (
              <TouchableOpacity key={evento.id} style={styles.eventCard} activeOpacity={0.7} onPress={() => router.push('/(main)/eventos')}>
                <View style={[styles.eventTypeBar, { backgroundColor: eventoTypeColor(evento.tipo) }]} />
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle} numberOfLines={1}>{evento.titulo}</Text>
                  <Text style={styles.eventDate}>
                    <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} /> {evento.data} · {evento.hora}
                  </Text>
                </View>
                <View style={[styles.eventTypeBadge, { backgroundColor: `${eventoTypeColor(evento.tipo)}18` }]}>
                  <Text style={[styles.eventTypeText, { color: eventoTypeColor(evento.tipo) }]}>{evento.tipo}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.qaTitle}>Acções Rápidas</Text>
          <View style={styles.qaGrid}>
            {[
              { label: 'Novo Aluno', icon: 'person-add', route: '/(main)/alunos', color: Colors.info },
              { label: 'Lançar Notas', icon: 'document-text', route: '/(main)/notas', color: Colors.gold },
              { label: 'Desempenho', icon: 'stats-chart', route: '/(main)/desempenho', color: '#8B5CF6' },
              { label: 'Marcar Presenças', icon: 'qr-code', route: '/(main)/presencas', color: Colors.success },
              { label: 'Novo Evento', icon: 'calendar', route: '/(main)/eventos', color: Colors.accent },
            ].map(qa => (
              <TouchableOpacity
                key={qa.label}
                style={[styles.qaButton, { borderColor: `${qa.color}30` }]}
                onPress={() => router.push(qa.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.qaIcon, { backgroundColor: `${qa.color}18` }]}>
                  <Ionicons name={qa.icon as any} size={22} color={qa.color} />
                </View>
                <Text style={styles.qaLabel}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.gold,
  },
  chartCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
  },
  emptyChart: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyChartText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  emptyEvents: {
    alignItems: 'center',
    padding: 28,
    gap: 8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyEventsText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    gap: 12,
  },
  eventTypeBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  eventContent: {
    flex: 1,
    paddingVertical: 12,
    gap: 3,
  },
  eventTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  eventDate: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  eventTypeBadge: {
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventTypeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  quickActions: {
    gap: 10,
  },
  qaTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  qaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  qaButton: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  qaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
