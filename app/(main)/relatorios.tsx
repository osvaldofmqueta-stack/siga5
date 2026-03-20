import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useData } from '@/context/DataContext';
import TopBar from '@/components/TopBar';
import { BarChart, LineChart, PieChart } from '@/components/Charts';

const { width } = Dimensions.get('window');
const CHART_W = Math.min(width - 64, 340);

function MetricCard({ label, value, color, icon, desc }: any) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}15` }]}>
        {icon}
      </View>
      <View style={styles.metricContent}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
        {desc && <Text style={styles.metricDesc}>{desc}</Text>}
      </View>
    </View>
  );
}

export default function RelatoriosScreen() {
  const { alunos, professores, turmas, notas, presencas } = useData();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'geral' | 'notas' | 'presencas'>('geral');
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const geralStats = useMemo(() => {
    const totalAlunos = alunos.filter(a => a.ativo).length;
    const totalProfs = professores.filter(p => p.ativo).length;
    const totalTurmas = turmas.filter(t => t.ativo).length;
    const aprovados = notas.filter(n => n.mac >= 10).length;
    const reprovados = notas.filter(n => n.mac < 10).length;
    const taxaAprovacao = notas.length ? Math.round((aprovados / notas.length) * 100) : 0;
    const mediaGeral = notas.length ? (notas.reduce((s, n) => s + n.mac, 0) / notas.length) : 0;

    const generoM = alunos.filter(a => a.genero === 'M').length;
    const generoF = alunos.filter(a => a.genero === 'F').length;

    return { totalAlunos, totalProfs, totalTurmas, aprovados, reprovados, taxaAprovacao, mediaGeral: parseFloat(mediaGeral.toFixed(1)), generoM, generoF };
  }, [alunos, professores, turmas, notas]);

  const notasStats = useMemo(() => {
    const disciplinas = [...new Set(notas.map(n => n.disciplina))];
    const disciplinaData = disciplinas.map((d, i) => {
      const disciplinaNotas = notas.filter(n => n.disciplina === d);
      const media = disciplinaNotas.reduce((s, n) => s + n.mac, 0) / disciplinaNotas.length;
      const taxa = Math.round((disciplinaNotas.filter(n => n.mac >= 10).length / disciplinaNotas.length) * 100);
      const colors = [Colors.gold, Colors.accent, Colors.info, Colors.success, Colors.warning];
      return { disciplina: d, media: parseFloat(media.toFixed(1)), taxa, color: colors[i % colors.length], label: d.substring(0, 4) };
    });

    const classesData = turmas.map((t, i) => {
      const turmaAlunos = alunos.filter(a => a.turmaId === t.id).map(a => a.id);
      const turmaNotas = notas.filter(n => turmaAlunos.includes(n.alunoId));
      const media = turmaNotas.length ? turmaNotas.reduce((s, n) => s + n.mac, 0) / turmaNotas.length : 0;
      const colors = [Colors.info, Colors.gold, Colors.success, Colors.accent];
      return { label: t.nome, value: parseFloat(media.toFixed(1)), color: colors[i % colors.length] };
    });

    const trimestreData = [1, 2, 3].map(t => {
      const tNotas = notas.filter(n => n.trimestre === t);
      const media = tNotas.length ? tNotas.reduce((s, n) => s + n.mac, 0) / tNotas.length : 0;
      return { label: `T${t}`, value: parseFloat(media.toFixed(1)) };
    });

    return { disciplinaData, classesData, trimestreData };
  }, [notas, turmas, alunos]);

  const presencaStats = useMemo(() => {
    const totalPresencas = presencas.length;
    const presentes = presencas.filter(p => p.status === 'P').length;
    const faltas = presencas.filter(p => p.status === 'F').length;
    const justificadas = presencas.filter(p => p.status === 'J').length;
    const taxaPresenca = totalPresencas ? Math.round((presentes / totalPresencas) * 100) : 0;

    return { totalPresencas, presentes, faltas, justificadas, taxaPresenca };
  }, [presencas]);

  const renderGeral = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.metricsGrid}>
        <MetricCard label="Total de Alunos" value={geralStats.totalAlunos} color={Colors.info} icon={<Ionicons name="people" size={20} color={Colors.info} />} />
        <MetricCard label="Professores" value={geralStats.totalProfs} color={Colors.gold} icon={<Ionicons name="person" size={20} color={Colors.gold} />} />
        <MetricCard label="Turmas Activas" value={geralStats.totalTurmas} color={Colors.success} icon={<Ionicons name="library" size={20} color={Colors.success} />} />
        <MetricCard label="Taxa de Aprovação" value={`${geralStats.taxaAprovacao}%`} color={Colors.accent} icon={<Ionicons name="checkmark-circle" size={20} color={Colors.accent} />} />
        <MetricCard label="Média Geral" value={`${geralStats.mediaGeral}/20`} color={Colors.warning} icon={<Ionicons name="stats-chart" size={20} color={Colors.warning} />} desc="Escala 0–20" />
        <MetricCard label="Aprovados" value={geralStats.aprovados} color={Colors.success} icon={<Ionicons name="school" size={20} color={Colors.success} />} />
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Distribuição por Género</Text>
        <View style={styles.chartCard}>
          <PieChart
            data={[
              { label: 'Masculino', value: geralStats.generoM, color: Colors.info },
              { label: 'Feminino', value: geralStats.generoF, color: Colors.accent },
            ]}
            size={160}
          />
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Alunos por Nível</Text>
        <View style={styles.chartCard}>
          <PieChart
            data={[
              { label: 'Primário', value: alunos.filter(a => turmas.find(t => t.id === a.turmaId)?.nivel === 'Primário').length, color: Colors.success },
              { label: 'I Ciclo', value: alunos.filter(a => turmas.find(t => t.id === a.turmaId)?.nivel === 'I Ciclo').length, color: Colors.gold },
              { label: 'II Ciclo', value: alunos.filter(a => turmas.find(t => t.id === a.turmaId)?.nivel === 'II Ciclo').length, color: Colors.accent },
            ]}
            size={160}
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderNotas = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Média por Disciplina</Text>
        <View style={styles.chartCard}>
          <BarChart data={notasStats.disciplinaData.map(d => ({ label: d.label, value: d.media, color: d.color }))} maxValue={20} height={180} width={CHART_W} />
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Média por Turma</Text>
        <View style={styles.chartCard}>
          <BarChart data={notasStats.classesData} maxValue={20} height={160} width={CHART_W} />
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Evolução Trimestral</Text>
        <View style={styles.chartCard}>
          <LineChart data={notasStats.trimestreData} color={Colors.gold} height={150} width={CHART_W} />
        </View>
      </View>

      <View style={styles.disciplinaList}>
        {notasStats.disciplinaData.map(d => (
          <View key={d.disciplina} style={styles.disciplinaRow}>
            <View style={[styles.disciplinaDot, { backgroundColor: d.color }]} />
            <Text style={styles.disciplinaNome}>{d.disciplina}</Text>
            <View style={styles.disciplinaRight}>
              <Text style={[styles.disciplinaMedia, { color: d.color }]}>{d.media}/20</Text>
              <Text style={styles.disciplinaTaxa}>{d.taxa}% aprovação</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderPresencas = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.metricsGrid}>
        <MetricCard label="Taxa de Presença" value={`${presencaStats.taxaPresenca}%`} color={Colors.success} icon={<Ionicons name="checkmark-circle" size={20} color={Colors.success} />} />
        <MetricCard label="Total Registos" value={presencaStats.totalPresencas} color={Colors.info} icon={<Ionicons name="list" size={20} color={Colors.info} />} />
        <MetricCard label="Presenças" value={presencaStats.presentes} color={Colors.success} icon={<Ionicons name="person" size={20} color={Colors.success} />} />
        <MetricCard label="Faltas" value={presencaStats.faltas} color={Colors.danger} icon={<Ionicons name="close-circle" size={20} color={Colors.danger} />} />
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Registo de Presenças</Text>
        <View style={styles.chartCard}>
          <PieChart
            data={[
              { label: 'Presentes', value: presencaStats.presentes, color: Colors.success },
              { label: 'Faltas', value: presencaStats.faltas, color: Colors.danger },
              { label: 'Justificadas', value: presencaStats.justificadas, color: Colors.warning },
            ]}
            size={160}
          />
        </View>
      </View>

      {presencaStats.totalPresencas === 0 && (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={36} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Sem registos de presenças ainda.</Text>
          <Text style={styles.emptySubtext}>Use o módulo de Presenças para registar faltas e presenças.</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <TopBar title="Relatórios" subtitle="Análise académica" />

      <View style={styles.tabs}>
        {(['geral', 'notas', 'presencas'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'geral' ? 'Geral' : tab === 'notas' ? 'Notas' : 'Presenças'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1, paddingBottom: bottomPad }}>
        {activeTab === 'geral' && renderGeral()}
        {activeTab === 'notas' && renderNotas()}
        {activeTab === 'presencas' && renderPresencas()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  tabs: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, marginHorizontal: 16, marginVertical: 10, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  tabTextActive: { color: Colors.text },
  tabContent: { padding: 16, gap: 16 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flex: 1, minWidth: '44%', backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricContent: { flex: 1 },
  metricValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  metricLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  metricDesc: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  chartSection: { gap: 8 },
  chartTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  chartCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, alignItems: 'center' },
  disciplinaList: { gap: 8 },
  disciplinaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 10 },
  disciplinaDot: { width: 10, height: 10, borderRadius: 5 },
  disciplinaNome: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  disciplinaRight: { alignItems: 'flex-end', gap: 2 },
  disciplinaMedia: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  disciplinaTaxa: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  empty: { alignItems: 'center', gap: 8, paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  emptySubtext: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
});
