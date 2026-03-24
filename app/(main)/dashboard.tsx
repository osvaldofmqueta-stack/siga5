import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import TopBar from '@/components/TopBar';
import { BarChart, PieChart, DonutChart } from '@/components/Charts';
import { apiRequest } from '@/lib/query-client';

const { width } = Dimensions.get('window');
const CHART_W = Math.min(width - 64, 360);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function SectionTitle({ label, color, action, actionLabel }: { label: string; color: string; action?: () => void; actionLabel?: string }) {
  return (
    <View style={st.sectionHeader}>
      <View style={st.sectionTitleRow}>
        <View style={[st.sectionBar, { backgroundColor: color }]} />
        <Text style={st.sectionLabel}>{label}</Text>
      </View>
      {action && (
        <TouchableOpacity onPress={action}>
          <Text style={[st.seeAll, { color }]}>{actionLabel ?? 'Ver mais'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function KpiCard({ label, value, sub, color, icon, onPress }: {
  label: string; value: string | number; sub?: string; color: string; icon: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[st.kpiCard, { borderTopColor: color }]}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
    >
      <View style={[st.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[st.kpiValue, { color }]}>{value}</Text>
      <Text style={st.kpiLabel}>{label}</Text>
      {sub ? <Text style={st.kpiSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

function GenderBar({ masculino, feminino, total }: { masculino: number; feminino: number; total: number }) {
  if (total === 0) return null;
  const mPct = Math.round((masculino / total) * 100);
  const fPct = 100 - mPct;
  return (
    <View style={st.genderWrap}>
      <View style={st.genderBarRow}>
        <View style={[st.genderSegM, { flex: masculino || 0.001 }]} />
        <View style={[st.genderSegF, { flex: feminino || 0.001 }]} />
      </View>
      <View style={st.genderLegRow}>
        <View style={st.genderLegItem}>
          <View style={[st.genderDot, { backgroundColor: Colors.info }]} />
          <Text style={st.genderTxt}>Masculino {mPct}% ({masculino})</Text>
        </View>
        <View style={st.genderLegItem}>
          <View style={[st.genderDot, { backgroundColor: '#EC4899' }]} />
          <Text style={st.genderTxt}>Feminino {fPct}% ({feminino})</Text>
        </View>
      </View>
    </View>
  );
}

interface Registro {
  id: string;
  status: string;
  matriculaCompleta?: boolean;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { alunos, professores, turmas, notas, eventos, presencas, isLoading } = useData();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loadingReg, setLoadingReg] = useState(false);

  useEffect(() => {
    setLoadingReg(true);
    apiRequest('GET', '/api/registros')
      .then(r => r.json())
      .then((data: Registro[]) => setRegistros(Array.isArray(data) ? data : []))
      .catch(() => setRegistros([]))
      .finally(() => setLoadingReg(false));
  }, []);

  const alunosAtivos = useMemo(() => alunos.filter(a => a.ativo), [alunos]);
  const profsAtivos   = useMemo(() => professores.filter(p => p.ativo), [professores]);
  const turmasAtivas  = useMemo(() => turmas.filter(t => t.ativo), [turmas]);

  const kpi = useMemo(() => {
    const totalCap = turmasAtivas.reduce((s, t) => s + (t.capacidade || 0), 0);
    const taxaOcupacao = totalCap > 0 ? Math.round((alunosAtivos.length / totalCap) * 100) : 0;
    const taxaAprov = notas.length
      ? Math.round((notas.filter(n => (n.nf > 0 ? n.nf : n.mac) >= 10).length / notas.length) * 100)
      : 0;
    const mediaGeral = notas.length
      ? (notas.reduce((s, n) => s + (n.nf > 0 ? n.nf : n.mac), 0) / notas.length).toFixed(1)
      : '—';
    const masculino = alunosAtivos.filter(a => a.genero === 'M').length;
    const feminino  = alunosAtivos.filter(a => a.genero === 'F').length;
    return { totalCap, taxaOcupacao, taxaAprov, mediaGeral, masculino, feminino };
  }, [alunosAtivos, turmasAtivas, notas]);

  const matriculasPorNivel = useMemo(() => {
    const mapa: Record<string, number> = {};
    alunosAtivos.forEach(a => {
      const t = turmasAtivas.find(t => t.id === a.turmaId);
      const nivel = t?.nivel ?? 'Sem Turma';
      mapa[nivel] = (mapa[nivel] || 0) + 1;
    });
    const COLORS: Record<string, string> = {
      'Primário': Colors.success, 'I Ciclo': Colors.info, 'II Ciclo': '#8B5CF6', 'Sem Turma': Colors.textMuted,
    };
    return Object.entries(mapa).map(([label, value]) => ({ label, value, color: COLORS[label] ?? Colors.gold }));
  }, [alunosAtivos, turmasAtivas]);

  const alunosPorTurno = useMemo(() => {
    const mapa: Record<string, number> = { 'Manhã': 0, 'Tarde': 0, 'Noite': 0 };
    alunosAtivos.forEach(a => {
      const t = turmasAtivas.find(t => t.id === a.turmaId);
      const turno = t?.turno ?? 'Manhã';
      mapa[turno] = (mapa[turno] || 0) + 1;
    });
    const COLORS: Record<string, string> = { 'Manhã': Colors.gold, 'Tarde': Colors.info, 'Noite': '#8B5CF6' };
    return Object.entries(mapa)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value, color: COLORS[label] ?? Colors.textMuted }));
  }, [alunosAtivos, turmasAtivas]);

  const ocupacaoPorTurma = useMemo(() => {
    return turmasAtivas
      .map(t => {
        const count = alunosAtivos.filter(a => a.turmaId === t.id).length;
        const cap   = t.capacidade || 30;
        return { nome: t.nome, count, cap, pct: Math.min(count / cap, 1) };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [turmasAtivas, alunosAtivos]);

  const estadosAdmissao = useMemo(() => {
    if (!registros.length) return [];
    const mapa: Record<string, number> = {};
    registros.forEach(r => { mapa[r.status] = (mapa[r.status] || 0) + 1; });
    const CONFIG: Record<string, { label: string; color: string }> = {
      pendente:           { label: 'Pendente',     color: Colors.warning },
      aprovado:           { label: 'Aprovado',      color: Colors.info },
      admitido:           { label: 'Admitido',      color: Colors.success },
      matriculado:        { label: 'Matriculado',   color: '#8B5CF6' },
      rejeitado:          { label: 'Rejeitado',     color: Colors.danger },
      reprovado_admissao: { label: 'Reprovado',     color: Colors.textMuted },
    };
    return Object.entries(mapa)
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({
        label: CONFIG[status]?.label ?? status,
        value,
        color: CONFIG[status]?.color ?? Colors.gold,
      }));
  }, [registros]);

  const desempenhoPorDisciplina = useMemo(() => {
    const discs = [...new Set(notas.map(n => n.disciplina))].slice(0, 6);
    const COLORS = [Colors.gold, Colors.accent, Colors.info, Colors.success, Colors.warning, '#8B5CF6'];
    return discs.map((d, i) => {
      const dn = notas.filter(n => n.disciplina === d);
      const media = dn.reduce((s, n) => s + (n.nf > 0 ? n.nf : n.mac), 0) / dn.length;
      return { label: d.length > 6 ? d.substring(0, 6) : d, value: parseFloat(media.toFixed(1)), color: COLORS[i % COLORS.length] };
    });
  }, [notas]);

  const presencaSemana = useMemo(() => {
    const hoje = new Date();
    const semAgo = new Date(hoje); semAgo.setDate(hoje.getDate() - 7);
    const recentes = presencas.filter(p => {
      const d = new Date(p.data);
      return d >= semAgo && d <= hoje;
    });
    const total = recentes.length;
    const presentes = recentes.filter(p => p.status === 'P').length;
    const faltas    = recentes.filter(p => p.status === 'F').length;
    const justif    = recentes.filter(p => p.status === 'J').length;
    const taxaP = total > 0 ? Math.round((presentes / total) * 100) : 0;
    return { total, presentes, faltas, justif, taxaP };
  }, [presencas]);

  const proximosEventos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return eventos.filter(e => e.data >= today).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
  }, [eventos]);

  const eventoTypeColor = (tipo: string) => ({
    'Académico': Colors.info, 'Cultural': Colors.gold, 'Desportivo': Colors.success,
    'Exame': Colors.danger, 'Feriado': Colors.warning, 'Reunião': Colors.textSecondary,
  }[tipo] || Colors.textMuted);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const isFinanceRole = ['pca', 'ceo', 'admin', 'financeiro'].includes(user?.role || '');

  const QUICK_ACTIONS_FINANCE = [
    { label: 'Financeiro',   icon: 'cash',            route: '/(main)/financeiro', color: Colors.success },
    { label: 'Propinas',     icon: 'wallet',           route: '/(main)/financeiro', color: Colors.info },
    { label: 'Pagamentos',   icon: 'receipt',          route: '/(main)/financeiro', color: Colors.gold },
    { label: 'Em Atraso',    icon: 'alert-circle',     route: '/(main)/financeiro', color: Colors.danger },
    { label: 'Rubricas',     icon: 'pricetag',         route: '/(main)/financeiro', color: '#8B5CF6' },
    { label: 'Relatórios',   icon: 'bar-chart',        route: '/(main)/financeiro', color: Colors.warning },
  ];

  const QUICK_ACTIONS_ACADEMIC = [
    { label: 'Novo Aluno',   icon: 'person-add',   route: '/(main)/alunos',    color: Colors.info },
    { label: 'Lançar Notas', icon: 'document-text', route: '/(main)/notas',     color: Colors.gold },
    { label: 'Desempenho',   icon: 'stats-chart',   route: '/(main)/desempenho',color: '#8B5CF6' },
    { label: 'Presenças',    icon: 'qr-code',       route: '/(main)/presencas', color: Colors.success },
    { label: 'Eventos',      icon: 'calendar',      route: '/(main)/eventos',   color: Colors.accent },
    { label: 'Relatórios',   icon: 'bar-chart',     route: '/(main)/relatorios',color: Colors.warning },
  ];

  const QUICK_ACTIONS = isFinanceRole ? QUICK_ACTIONS_FINANCE : QUICK_ACTIONS_ACADEMIC;

  const refreshing = isLoading || loadingReg;

  return (
    <View style={st.screen}>
      <TopBar
        title="Painel Principal"
        subtitle={user?.nome ? `${getGreeting()}, ${user.nome.split(' ')[0]}` : getGreeting()}
      />
      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} colors={[Colors.gold]} tintColor={Colors.gold} />}
      >

        {/* ── KPIs principais ───────────────────────────────── */}
        <View style={st.kpiGrid}>
          <KpiCard label="Alunos" value={alunosAtivos.length} sub="Matriculados" color={Colors.info} icon="people" onPress={() => router.push('/(main)/alunos')} />
          <KpiCard label="Professores" value={profsAtivos.length} sub="Activos" color={Colors.gold} icon="school" onPress={() => router.push('/(main)/professores')} />
          <KpiCard label="Turmas" value={turmasAtivas.length} sub="Activas" color={Colors.success} icon="layers" onPress={() => router.push('/(main)/turmas')} />
          <KpiCard label="Ocupação" value={`${kpi.taxaOcupacao}%`} sub={`${alunosAtivos.length} / ${kpi.totalCap} vagas`} color={kpi.taxaOcupacao >= 90 ? Colors.danger : kpi.taxaOcupacao >= 70 ? Colors.warning : Colors.success} icon="business" />
          <KpiCard label="Aprovação" value={`${kpi.taxaAprov}%`} sub="Taxa global" color={kpi.taxaAprov >= 70 ? Colors.success : kpi.taxaAprov >= 50 ? Colors.warning : Colors.danger} icon="checkmark-circle" onPress={() => router.push('/(main)/desempenho')} />
          <KpiCard label="Média Geral" value={kpi.mediaGeral} sub="Escala 0–20" color={Colors.accent} icon="ribbon" onPress={() => router.push('/(main)/desempenho')} />
        </View>

        {/* ── Estado de Matrículas ──────────────────────────── */}
        <View style={st.section}>
          <SectionTitle label="Estado de Matrículas" color={Colors.info} action={() => router.push('/(main)/alunos')} actionLabel="Ver alunos" />
          <View style={st.card}>
            <View style={st.matriculaResumo}>
              <View style={st.matriculaResumoItem}>
                <Text style={[st.matriculaBig, { color: Colors.success }]}>{alunosAtivos.length}</Text>
                <Text style={st.matriculaSmall}>Matrículas Activas</Text>
              </View>
              <View style={st.matriculaDivider} />
              <View style={st.matriculaResumoItem}>
                <Text style={[st.matriculaBig, { color: Colors.textMuted }]}>{Math.max(0, kpi.totalCap - alunosAtivos.length)}</Text>
                <Text style={st.matriculaSmall}>Vagas Disponíveis</Text>
              </View>
              <View style={st.matriculaDivider} />
              <View style={st.matriculaResumoItem}>
                <Text style={[st.matriculaBig, { color: Colors.gold }]}>{kpi.totalCap}</Text>
                <Text style={st.matriculaSmall}>Capacidade Total</Text>
              </View>
            </View>

            <View style={st.ocupacaoBarraWrap}>
              <View style={[st.ocupacaoBarra, { flex: alunosAtivos.length || 0.001, backgroundColor: Colors.success }]} />
              <View style={[st.ocupacaoBarra, { flex: Math.max(kpi.totalCap - alunosAtivos.length, 0.001), backgroundColor: Colors.border }]} />
            </View>
            <Text style={st.ocupacaoLegenda}>
              {kpi.taxaOcupacao}% das vagas preenchidas · {Math.max(0, kpi.totalCap - alunosAtivos.length)} vagas livres
            </Text>

            <View style={st.cardDivider} />
            <Text style={st.subCardTitle}>Distribuição por Género</Text>
            <GenderBar masculino={kpi.masculino} feminino={kpi.feminino} total={alunosAtivos.length} />

            {matriculasPorNivel.length > 0 && (
              <>
                <View style={st.cardDivider} />
                <Text style={st.subCardTitle}>Alunos por Nível de Ensino</Text>
                <View style={st.nivelChipsRow}>
                  {matriculasPorNivel.map(n => (
                    <View key={n.label} style={[st.nivelChip, { borderColor: n.color + '55', backgroundColor: n.color + '11' }]}>
                      <Text style={[st.nivelChipVal, { color: n.color }]}>{n.value}</Text>
                      <Text style={[st.nivelChipLabel, { color: n.color }]}>{n.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Gráfico Donut: Alunos por Turno ──────────────── */}
        {alunosPorTurno.length > 0 && (
          <View style={st.section}>
            <SectionTitle label="Alunos por Turno" color={Colors.gold} />
            <View style={[st.card, { alignItems: 'center' }]}>
              <DonutChart
                data={alunosPorTurno}
                size={180}
                thickness={32}
                centerLabel={String(alunosAtivos.length)}
                centerSub="alunos"
              />
            </View>
          </View>
        )}

        {/* ── Gráfico Donut: Nível de Ensino ────────────────── */}
        {matriculasPorNivel.some(n => n.value > 0) && (
          <View style={st.section}>
            <SectionTitle label="Distribuição por Nível" color={Colors.success} />
            <View style={[st.card, { alignItems: 'center' }]}>
              <DonutChart
                data={matriculasPorNivel.filter(n => n.value > 0)}
                size={180}
                thickness={32}
                centerLabel={String(alunosAtivos.length)}
                centerSub="total"
              />
            </View>
          </View>
        )}

        {/* ── Estados de Admissão ───────────────────────────── */}
        {estadosAdmissao.length > 0 && (
          <View style={st.section}>
            <SectionTitle label="Processo de Admissão" color='#8B5CF6' action={() => router.push('/(main)/admissao' as any)} actionLabel="Ver admissões" />
            <View style={st.card}>
              <View style={st.admissaoSummary}>
                {estadosAdmissao.map(e => (
                  <View key={e.label} style={[st.admissaoChip, { backgroundColor: e.color + '18', borderColor: e.color + '44' }]}>
                    <Text style={[st.admissaoVal, { color: e.color }]}>{e.value}</Text>
                    <Text style={[st.admissaoLbl, { color: e.color }]}>{e.label}</Text>
                  </View>
                ))}
              </View>
              <View style={st.cardDivider} />
              <DonutChart
                data={estadosAdmissao}
                size={180}
                thickness={30}
                centerLabel={String(registros.length)}
                centerSub="pedidos"
              />
            </View>
          </View>
        )}

        {/* ── Taxa de Ocupação por Turma ───────────────────── */}
        {ocupacaoPorTurma.length > 0 && (
          <View style={st.section}>
            <SectionTitle label="Taxa de Ocupação por Turma" color={Colors.warning} action={() => router.push('/(main)/turmas')} actionLabel="Ver turmas" />
            <View style={st.card}>
              {ocupacaoPorTurma.map((t, idx) => {
                const cor = t.pct >= 0.9 ? Colors.danger : t.pct >= 0.7 ? Colors.warning : Colors.success;
                return (
                  <View key={t.nome} style={[st.ocupRow, idx > 0 && { marginTop: 10 }]}>
                    <Text style={st.ocupNome} numberOfLines={1}>{t.nome}</Text>
                    <View style={st.ocupBarWrap}>
                      <View style={[st.ocupBarFill, { width: `${Math.round(t.pct * 100)}%` as any, backgroundColor: cor }]} />
                    </View>
                    <Text style={[st.ocupPct, { color: cor }]}>{t.count}/{t.cap}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Presenças da Semana ───────────────────────────── */}
        <View style={st.section}>
          <SectionTitle label="Presenças (Últimos 7 dias)" color={Colors.success} action={() => router.push('/(main)/presencas')} actionLabel="Ver detalhes" />
          <View style={st.card}>
            {presencaSemana.total === 0 ? (
              <View style={st.emptySmall}>
                <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
                <Text style={st.emptySmallText}>Sem registos de presença neste período</Text>
              </View>
            ) : (
              <>
                <View style={st.presencaResumo}>
                  <View style={st.presencaItem}>
                    <Text style={[st.presencaVal, { color: Colors.success }]}>{presencaSemana.presentes}</Text>
                    <Text style={st.presencaLbl}>Presentes</Text>
                  </View>
                  <View style={st.presencaItem}>
                    <Text style={[st.presencaVal, { color: Colors.danger }]}>{presencaSemana.faltas}</Text>
                    <Text style={st.presencaLbl}>Faltas</Text>
                  </View>
                  <View style={st.presencaItem}>
                    <Text style={[st.presencaVal, { color: Colors.warning }]}>{presencaSemana.justif}</Text>
                    <Text style={st.presencaLbl}>Justif.</Text>
                  </View>
                  <View style={st.presencaItem}>
                    <Text style={[st.presencaVal, { color: Colors.gold }]}>{presencaSemana.taxaP}%</Text>
                    <Text style={st.presencaLbl}>Assiduidade</Text>
                  </View>
                </View>
                <View style={st.presencaBarra}>
                  {presencaSemana.presentes > 0 && (
                    <View style={[st.presencaBarSeg, { flex: presencaSemana.presentes, backgroundColor: Colors.success }]} />
                  )}
                  {presencaSemana.justif > 0 && (
                    <View style={[st.presencaBarSeg, { flex: presencaSemana.justif, backgroundColor: Colors.warning }]} />
                  )}
                  {presencaSemana.faltas > 0 && (
                    <View style={[st.presencaBarSeg, { flex: presencaSemana.faltas, backgroundColor: Colors.danger }]} />
                  )}
                </View>
                <View style={st.cardDivider} />
                <DonutChart
                  data={[
                    { label: 'Presentes', value: presencaSemana.presentes, color: Colors.success },
                    { label: 'Justif.', value: presencaSemana.justif, color: Colors.warning },
                    { label: 'Faltas', value: presencaSemana.faltas, color: Colors.danger },
                  ].filter(d => d.value > 0)}
                  size={160}
                  thickness={26}
                  centerLabel={`${presencaSemana.taxaP}%`}
                  centerSub="assiduidade"
                />
              </>
            )}
          </View>
        </View>

        {/* ── Desempenho por Disciplina ─────────────────────── */}
        <View style={st.section}>
          <SectionTitle label="Médias por Disciplina" color={Colors.gold} action={() => router.push('/(main)/desempenho')} actionLabel="Ver desempenho" />
          <View style={[st.card, { alignItems: 'center' }]}>
            {desempenhoPorDisciplina.length > 0 ? (
              <BarChart data={desempenhoPorDisciplina} maxValue={20} height={180} width={CHART_W} />
            ) : (
              <View style={st.emptySmall}>
                <Ionicons name="bar-chart-outline" size={32} color={Colors.textMuted} />
                <Text style={st.emptySmallText}>Sem notas lançadas</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Próximos Eventos ──────────────────────────────── */}
        <View style={st.section}>
          <SectionTitle label="Próximos Eventos" color={Colors.accent} action={() => router.push('/(main)/eventos')} actionLabel="Ver todos" />
          {proximosEventos.length === 0 ? (
            <View style={[st.card, st.emptySmall]}>
              <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
              <Text style={st.emptySmallText}>Sem eventos programados</Text>
            </View>
          ) : (
            proximosEventos.map(evento => (
              <TouchableOpacity
                key={evento.id}
                style={st.eventCard}
                activeOpacity={0.7}
                onPress={() => router.push('/(main)/eventos')}
              >
                <View style={[st.eventBar, { backgroundColor: eventoTypeColor(evento.tipo) }]} />
                <View style={st.eventBody}>
                  <Text style={st.eventTitle} numberOfLines={1}>{evento.titulo}</Text>
                  <Text style={st.eventDate}>{evento.data} · {evento.hora} · {evento.local}</Text>
                </View>
                <View style={[st.eventBadge, { backgroundColor: eventoTypeColor(evento.tipo) + '22' }]}>
                  <Text style={[st.eventBadgeText, { color: eventoTypeColor(evento.tipo) }]}>{evento.tipo}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Acções Rápidas ────────────────────────────────── */}
        <View style={st.section}>
          <SectionTitle label={isFinanceRole ? 'Acesso Financeiro Rápido' : 'Acções Rápidas'} color={isFinanceRole ? Colors.success : Colors.primaryLight} />
          <View style={st.qaGrid}>
            {QUICK_ACTIONS.map(qa => (
              <TouchableOpacity
                key={qa.label}
                style={[st.qaBtn, { borderColor: qa.color + '33' }]}
                onPress={() => router.push(qa.route as any)}
                activeOpacity={0.7}
              >
                <View style={[st.qaIcon, { backgroundColor: qa.color + '1A' }]}>
                  <Ionicons name={qa.icon as any} size={22} color={qa.color} />
                </View>
                <Text style={st.qaLabel}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBar: { width: 4, height: 18, borderRadius: 2 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  seeAll: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  card: { backgroundColor: Colors.backgroundCard, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  cardDivider: { height: 1, backgroundColor: Colors.border },
  subCardTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flex: 1, minWidth: (width - 52) / 3, backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, padding: 12, gap: 2, alignItems: 'center' },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kpiValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center' },
  kpiSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  matriculaResumo: { flexDirection: 'row', alignItems: 'center' },
  matriculaResumoItem: { flex: 1, alignItems: 'center', gap: 2 },
  matriculaDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  matriculaBig: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  matriculaSmall: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  ocupacaoBarraWrap: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  ocupacaoBarra: { borderRadius: 4 },
  ocupacaoLegenda: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  genderWrap: { gap: 8 },
  genderBarRow: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  genderSegM: { backgroundColor: Colors.info, borderRadius: 4 },
  genderSegF: { backgroundColor: '#EC4899', borderRadius: 4 },
  genderLegRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  genderLegItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  genderDot: { width: 8, height: 8, borderRadius: 4 },
  genderTxt: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  nivelChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nivelChip: { flex: 1, minWidth: 80, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  nivelChipVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  nivelChipLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  admissaoSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  admissaoChip: { flex: 1, minWidth: 80, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  admissaoVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  admissaoLbl: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  ocupRow: { gap: 4 },
  ocupNome: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  ocupBarWrap: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  ocupBarFill: { height: '100%', borderRadius: 4 },
  ocupPct: { fontSize: 11, fontFamily: 'Inter_700Bold', alignSelf: 'flex-end' },

  presencaResumo: { flexDirection: 'row' },
  presencaItem: { flex: 1, alignItems: 'center', gap: 2 },
  presencaVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  presencaLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  presencaBarra: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  presencaBarSeg: { borderRadius: 4 },

  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  eventBar: { width: 4, alignSelf: 'stretch' },
  eventBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 3 },
  eventTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  eventDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  eventBadge: { marginRight: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  eventBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaBtn: { flex: 1, minWidth: '30%', backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  qaIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },

  emptySmall: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptySmallText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
});
