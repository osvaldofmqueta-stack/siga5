import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/context/UsersContext';
import { useData } from '@/context/DataContext';
import { useRegistro } from '@/context/RegistroContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import TopBar from '@/components/TopBar';
import { api } from '@/lib/api';

const { width } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────────────
type RoleFilter = 'todos' | 'secretaria' | 'professor' | 'financeiro' | 'aluno' | 'admin';
type TabKey = 'visao' | 'utilizadores' | 'secretaria' | 'academico' | 'financeiro';

const ROLE_LABEL: Record<string, string> = {
  ceo: 'CEO', pca: 'PCA', admin: 'Administrador', director: 'Director',
  secretaria: 'Secretaria', professor: 'Professor', aluno: 'Aluno',
  financeiro: 'Financeiro', encarregado: 'Encarregado',
};

const ROLE_COLOR: Record<string, string> = {
  ceo: '#FFD700', pca: '#9B59B6', admin: '#E67E22', director: Colors.info,
  secretaria: Colors.gold, professor: '#3498DB', aluno: Colors.success,
  financeiro: '#2ECC71', encarregado: Colors.textSecondary,
};

const ROLE_ICON: Record<string, string> = {
  ceo: 'crown', pca: 'diamond', admin: 'shield-checkmark', director: 'briefcase',
  secretaria: 'file-tray-full', professor: 'school', aluno: 'person',
  financeiro: 'cash', encarregado: 'people',
};

// ─── Sub-components ──────────────────────────────────────────────────────────
function RolePill({ role }: { role: string }) {
  const color = ROLE_COLOR[role] || Colors.textMuted;
  return (
    <View style={[pill.wrap, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[pill.text, { color }]}>{ROLE_LABEL[role] || role}</Text>
    </View>
  );
}

function StatGradient({ title, value, sub, colors: gc, icon }: {
  title: string; value: string | number; sub?: string;
  colors: [string, string]; icon: string;
}) {
  return (
    <LinearGradient colors={gc} style={sg.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={sg.iconWrap}>
        <Ionicons name={icon as any} size={22} color="#fff" />
      </View>
      <Text style={sg.value}>{value}</Text>
      <Text style={sg.title}>{title}</Text>
      {sub ? <Text style={sg.sub}>{sub}</Text> : null}
    </LinearGradient>
  );
}

function ActivityRow({ icon, color, title, sub, time, badge }: {
  icon: string; color: string; title: string; sub?: string; time?: string; badge?: string;
}) {
  return (
    <View style={ar.row}>
      <View style={[ar.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ar.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={ar.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {time ? <Text style={ar.time}>{time}</Text> : null}
        {badge ? (
          <View style={[ar.badge, { backgroundColor: color + '22' }]}>
            <Text style={[ar.badgeText, { color }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SectionCard({ title, icon, children, onPress, count }: {
  title: string; icon: string; children: React.ReactNode;
  onPress?: () => void; count?: number;
}) {
  return (
    <View style={sc.card}>
      <View style={sc.header}>
        <View style={sc.headerLeft}>
          <View style={sc.iconBox}>
            <Ionicons name={icon as any} size={15} color={Colors.gold} />
          </View>
          <Text style={sc.title}>{title}</Text>
          {count !== undefined && (
            <View style={sc.countBadge}>
              <Text style={sc.countText}>{count}</Text>
            </View>
          )}
        </View>
        {onPress && (
          <TouchableOpacity onPress={onPress} style={sc.action}>
            <Text style={sc.actionText}>Ver tudo</Text>
            <Ionicons name="chevron-forward" size={13} color={Colors.gold} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ControloSupervisaoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { users } = useUsers();
  const { alunos, professores, turmas } = useData();
  const { solicitacoes, pendentes } = useRegistro();
  const { isDesktop } = useBreakpoint();

  const [activeTab, setActiveTab] = useState<TabKey>('visao');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos');
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [presencas, setPresencas] = useState<any[]>([]);
  const [sumarios, setSumarios] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  async function loadApiData() {
    try {
      const [pag, nt, pres, sum] = await Promise.all([
        api.get<any[]>('/api/pagamentos').catch(() => []),
        api.get<any[]>('/api/notas').catch(() => []),
        api.get<any[]>('/api/presencas').catch(() => []),
        api.get<any[]>('/api/sumarios').catch(() => []),
      ]);
      setPagamentos(pag);
      setNotas(nt);
      setPresencas(pres);
      setSumarios(sum);
    } catch {
      // ignore
    }
  }

  useEffect(() => { loadApiData(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadApiData();
    setRefreshing(false);
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalAlunos = alunos.filter(a => a.ativo).length;
    const totalProfessores = professores.length;
    const totalTurmas = turmas.filter(t => t.ativo).length;
    const secretarias = users.filter(u => u.role === 'secretaria').length;
    const financeiros = users.filter(u => u.role === 'financeiro').length;
    const pagamentosTotal = pagamentos.length;
    const pagamentosHoje = pagamentos.filter(p => {
      if (!p.data && !p.dataPagemento && !p.criadoEm) return false;
      const d = p.data || p.dataPagamento || p.criadoEm || '';
      return d.startsWith(new Date().toISOString().split('T')[0]);
    }).length;
    const matriculasPendentes = pendentes.length;

    return {
      totalUsers, totalAlunos, totalProfessores, totalTurmas,
      secretarias, financeiros, pagamentosTotal, pagamentosHoje,
      matriculasPendentes, notasLancadas: notas.length,
      presencasRegistadas: presencas.length, sumarios: sumarios.length,
    };
  }, [users, alunos, professores, turmas, pagamentos, pendentes, notas, presencas, sumarios]);

  // ── Users filtrados ──────────────────────────────────────────────────────
  const usersFiltrados = useMemo(() => {
    if (roleFilter === 'todos') return users;
    return users.filter(u => u.role === roleFilter);
  }, [users, roleFilter]);

  // ── Role distribution ────────────────────────────────────────────────────
  const roleDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach(u => { map[u.role] = (map[u.role] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [users]);

  // ── Tabs config ──────────────────────────────────────────────────────────
  const TABS: { key: TabKey; label: string; icon: string; badge?: number }[] = [
    { key: 'visao', label: 'Visão Geral', icon: 'grid' },
    { key: 'utilizadores', label: 'Utilizadores', icon: 'people', badge: users.length },
    { key: 'secretaria', label: 'Secretaria', icon: 'briefcase' },
    { key: 'academico', label: 'Académico', icon: 'school' },
    { key: 'financeiro', label: 'Financeiro', icon: 'cash', badge: stats.pagamentosHoje || undefined },
  ];

  const roleName = user?.role === 'ceo' ? 'CEO'
    : user?.role === 'pca' ? 'PCA'
    : user?.role === 'admin' ? 'Administrador'
    : 'Director';

  // ── Desktop layout ────────────────────────────────────────────────────────
  function renderContent() {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />}
      >
        {/* ── VISÃO GERAL ─────────────────────────────────────── */}
        {activeTab === 'visao' && (
          <>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatGradient title="Utilizadores" value={stats.totalUsers} sub="no sistema" colors={['#1A2B8A', '#2D4AC0']} icon="people" />
              <StatGradient title="Alunos Activos" value={stats.totalAlunos} sub={`${stats.totalTurmas} turmas`} colors={['#0D6E3F', '#16A55E']} icon="school" />
              <StatGradient title="Professores" value={stats.totalProfessores} sub="corpo docente" colors={['#7C2D90', '#A849C0']} icon="person" />
              <StatGradient title="Matrículas Pendentes" value={stats.matriculasPendentes} sub="por aprovar" colors={['#8B3A00', '#D4600A']} icon="time" />
              <StatGradient title="Notas Lançadas" value={stats.notasLancadas} sub="pautas registadas" colors={['#004D7A', '#008793']} icon="document-text" />
              <StatGradient title="Pagamentos" value={stats.pagamentosTotal} sub={`${stats.pagamentosHoje} hoje`} colors={['#1A6B1A', '#2ECC71']} icon="cash" />
            </View>

            {/* Distribuição de papéis */}
            <SectionCard title="Distribuição de Utilizadores por Perfil" icon="pie-chart">
              <View style={styles.roleDistRow}>
                {roleDistribution.map(([role, count]) => {
                  const color = ROLE_COLOR[role] || Colors.textMuted;
                  const total = users.length || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <View key={role} style={styles.roleDist}>
                      <View style={[styles.roleDistIcon, { backgroundColor: color + '22' }]}>
                        <Ionicons name={(ROLE_ICON[role] || 'person') as any} size={16} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.roleDistTop}>
                          <Text style={styles.roleDistLabel}>{ROLE_LABEL[role] || role}</Text>
                          <Text style={[styles.roleDistCount, { color }]}>{count}</Text>
                        </View>
                        <View style={styles.progressBg}>
                          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
                {roleDistribution.length === 0 && (
                  <View style={styles.emptyBox}>
                    <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
                    <Text style={styles.emptyText}>Nenhum utilizador registado ainda</Text>
                  </View>
                )}
              </View>
            </SectionCard>

            {/* Solicitações de matrícula */}
            {pendentes.length > 0 && (
              <SectionCard title="Matrículas Pendentes de Aprovação" icon="person-add" count={pendentes.length}
                onPress={() => router.push('/(main)/admin' as any)}>
                {pendentes.slice(0, 5).map(s => (
                  <ActivityRow
                    key={s.id}
                    icon="person-add"
                    color={Colors.warning}
                    title={s.nomeCompleto}
                    sub={`${s.nivel} · ${s.classe} · ${s.provincia}`}
                    time={new Date(s.criadoEm).toLocaleDateString('pt-PT')}
                    badge="Pendente"
                  />
                ))}
              </SectionCard>
            )}

            {/* Atalhos de supervisão */}
            <View style={styles.shortcutsGrid}>
              {[
                { label: 'Secretaria', icon: 'briefcase', color: Colors.gold, tab: 'secretaria' as TabKey },
                { label: 'Académico', icon: 'school', color: Colors.info, tab: 'academico' as TabKey },
                { label: 'Financeiro', icon: 'cash', color: Colors.success, tab: 'financeiro' as TabKey },
                { label: 'Utilizadores', icon: 'people', color: '#9B59B6', tab: 'utilizadores' as TabKey },
              ].map(s => (
                <TouchableOpacity key={s.tab} style={styles.shortcut} onPress={() => setActiveTab(s.tab)} activeOpacity={0.8}>
                  <View style={[styles.shortcutIcon, { backgroundColor: s.color + '22' }]}>
                    <Ionicons name={s.icon as any} size={22} color={s.color} />
                  </View>
                  <Text style={styles.shortcutLabel}>{s.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── UTILIZADORES ─────────────────────────────────────── */}
        {activeTab === 'utilizadores' && (
          <>
            {/* Role filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
              {(['todos', 'secretaria', 'professor', 'admin', 'financeiro', 'aluno'] as RoleFilter[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, roleFilter === f && styles.filterChipActive]}
                  onPress={() => setRoleFilter(f)}
                >
                  <Text style={[styles.filterChipText, roleFilter === f && styles.filterChipTextActive]}>
                    {f === 'todos' ? 'Todos' : ROLE_LABEL[f] || f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <SectionCard title={`Utilizadores (${usersFiltrados.length})`} icon="people">
              {usersFiltrados.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="people-outline" size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>Nenhum utilizador nesta categoria</Text>
                </View>
              ) : (
                usersFiltrados.map(u => (
                  <View key={u.id} style={styles.userRow}>
                    <View style={[styles.userAvatar, { backgroundColor: (ROLE_COLOR[u.role] || Colors.textMuted) + '33' }]}>
                      <Text style={[styles.userAvatarText, { color: ROLE_COLOR[u.role] || Colors.textMuted }]}>
                        {u.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{u.nome}</Text>
                      <Text style={styles.userEmail}>{u.email}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <RolePill role={u.role} />
                      <View style={[styles.statusDot, { backgroundColor: u.ativo ? Colors.success : Colors.danger }]}>
                        <Text style={styles.statusDotText}>{u.ativo ? 'Activo' : 'Inactivo'}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </SectionCard>
          </>
        )}

        {/* ── SECRETARIA ───────────────────────────────────────── */}
        {activeTab === 'secretaria' && (
          <>
            <View style={styles.statsGrid}>
              <StatGradient title="Secretarias" value={stats.secretarias} sub="utilizadores" colors={['#7C6200', '#C49A00']} icon="briefcase" />
              <StatGradient title="Matrículas" value={stats.matriculasPendentes} sub="pendentes" colors={['#8B3A00', '#D4600A']} icon="person-add" />
            </View>

            <SectionCard title="Acesso Rápido — Secretaria" icon="flash" onPress={() => router.push('/(main)/secretaria-hub' as any)}>
              {[
                { icon: 'briefcase', color: Colors.gold, title: 'Painel da Secretaria', sub: 'Gestão documental e processos', route: '/(main)/secretaria-hub' },
                { icon: 'newspaper', color: Colors.info, title: 'Editor de Documentos', sub: 'Emitir declarações e certificados', route: '/(main)/editor-documentos' },
                { icon: 'person-add', color: Colors.warning, title: 'Solicitações de Matrícula', sub: `${pendentes.length} pendentes de aprovação`, route: '/(main)/admin' },
                { icon: 'school', color: '#9B59B6', title: 'Gestão Académica', sub: 'Turmas, alunos e professores', route: '/(main)/gestao-academica' },
                { icon: 'newspaper', color: '#F59E0B', title: 'Boletim de Matrícula', sub: 'Impressão de fichas', route: '/(main)/boletim-matricula' },
                { icon: 'cash', color: Colors.success, title: 'Caderneta de Propinas', sub: 'Emissão de boletins', route: '/(main)/boletim-propina' },
              ].map((item, i) => (
                <TouchableOpacity key={i} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
                  <ActivityRow icon={item.icon} color={item.color} title={item.title} sub={item.sub} />
                </TouchableOpacity>
              ))}
            </SectionCard>

            {pendentes.length > 0 && (
              <SectionCard title="Últimas Solicitações de Matrícula" icon="person-add" count={pendentes.length}
                onPress={() => router.push('/(main)/admin' as any)}>
                {solicitacoes.slice(0, 8).map(s => {
                  const colorMap = { pendente: Colors.warning, aprovado: Colors.success, rejeitado: Colors.danger };
                  return (
                    <ActivityRow
                      key={s.id}
                      icon={s.status === 'aprovado' ? 'checkmark-circle' : s.status === 'rejeitado' ? 'close-circle' : 'time'}
                      color={colorMap[s.status]}
                      title={s.nomeCompleto}
                      sub={`${s.nivel} · ${s.classe}`}
                      time={new Date(s.criadoEm).toLocaleDateString('pt-PT')}
                      badge={s.status === 'pendente' ? 'Pendente' : s.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                    />
                  );
                })}
              </SectionCard>
            )}
          </>
        )}

        {/* ── ACADÉMICO ────────────────────────────────────────── */}
        {activeTab === 'academico' && (
          <>
            <View style={styles.statsGrid}>
              <StatGradient title="Alunos Activos" value={stats.totalAlunos} sub="matriculados" colors={['#0D6E3F', '#16A55E']} icon="people" />
              <StatGradient title="Professores" value={stats.totalProfessores} sub="corpo docente" colors={['#004D7A', '#008793']} icon="school" />
              <StatGradient title="Turmas" value={stats.totalTurmas} sub="activas" colors={['#7C2D90', '#A849C0']} icon="grid" />
              <StatGradient title="Notas" value={stats.notasLancadas} sub="lançamentos" colors={['#1A2B8A', '#2D4AC0']} icon="document-text" />
            </View>

            <SectionCard title="Acesso ao Módulo Académico" icon="school">
              {[
                { icon: 'people', color: Colors.info, title: 'Alunos', sub: `${stats.totalAlunos} alunos activos`, route: '/(main)/alunos' },
                { icon: 'person', color: Colors.gold, title: 'Professores', sub: `${stats.totalProfessores} professores`, route: '/(main)/professores' },
                { icon: 'grid', color: '#9B59B6', title: 'Turmas', sub: `${stats.totalTurmas} turmas activas`, route: '/(main)/turmas' },
                { icon: 'document-text', color: Colors.success, title: 'Notas & Pautas', sub: `${stats.notasLancadas} lançamentos registados`, route: '/(main)/notas' },
                { icon: 'checkmark-circle', color: Colors.warning, title: 'Presenças', sub: `${stats.presencasRegistadas} registos`, route: '/(main)/presencas' },
                { icon: 'time', color: Colors.info, title: 'Horário', sub: 'Gestão de horários', route: '/(main)/horario' },
                { icon: 'bar-chart', color: Colors.accent, title: 'Relatórios', sub: 'Análise e estatísticas', route: '/(main)/relatorios' },
              ].map((item, i) => (
                <TouchableOpacity key={i} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
                  <ActivityRow icon={item.icon} color={item.color} title={item.title} sub={item.sub} />
                </TouchableOpacity>
              ))}
            </SectionCard>

            {professores.length > 0 && (
              <SectionCard title="Professores Registados" icon="school" count={professores.length}>
                {professores.slice(0, 6).map(p => (
                  <ActivityRow
                    key={p.id}
                    icon="person"
                    color={Colors.info}
                    title={`${p.nome} ${p.apelido}`}
                    sub={p.disciplinas?.join(', ') || 'Sem disciplinas'}
                    badge={p.ativo ? 'Activo' : 'Inactivo'}
                  />
                ))}
              </SectionCard>
            )}
          </>
        )}

        {/* ── FINANCEIRO ───────────────────────────────────────── */}
        {activeTab === 'financeiro' && (
          <>
            <View style={styles.statsGrid}>
              <StatGradient title="Total Pagamentos" value={stats.pagamentosTotal} sub="registados" colors={['#1A6B1A', '#2ECC71']} icon="cash" />
              <StatGradient title="Hoje" value={stats.pagamentosHoje} sub="pagamentos hoje" colors={['#004D7A', '#008793']} icon="today" />
              <StatGradient title="Financeiros" value={stats.financeiros} sub="utilizadores" colors={['#7C2D90', '#A849C0']} icon="people" />
            </View>

            <SectionCard title="Módulo Financeiro" icon="cash"
              onPress={() => router.push('/(main)/financeiro' as any)}>
              {[
                { icon: 'cash', color: Colors.success, title: 'Gestão Financeira', sub: `${stats.pagamentosTotal} pagamentos registados`, route: '/(main)/financeiro' },
                { icon: 'receipt', color: Colors.gold, title: 'Boletim de Propinas', sub: 'Emissão de cadernetas', route: '/(main)/boletim-propina' },
                { icon: 'bar-chart', color: Colors.info, title: 'Relatórios Financeiros', sub: 'Análise de receitas', route: '/(main)/relatorios' },
              ].map((item, i) => (
                <TouchableOpacity key={i} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
                  <ActivityRow icon={item.icon} color={item.color} title={item.title} sub={item.sub} />
                </TouchableOpacity>
              ))}
            </SectionCard>

            {pagamentos.length > 0 ? (
              <SectionCard title="Últimos Pagamentos Registados" icon="receipt" count={pagamentos.length}>
                {pagamentos.slice(0, 8).map((p, i) => (
                  <ActivityRow
                    key={p.id || i}
                    icon="cash"
                    color={Colors.success}
                    title={p.alunoNome || p.nome || 'Pagamento'}
                    sub={p.descricao || p.tipo || 'Propina'}
                    time={p.data || p.dataPagamento ? new Date(p.data || p.dataPagamento).toLocaleDateString('pt-PT') : undefined}
                    badge={p.valor ? `${p.valor} AOA` : undefined}
                  />
                ))}
              </SectionCard>
            ) : (
              <SectionCard title="Últimos Pagamentos" icon="receipt">
                <View style={styles.emptyBox}>
                  <Ionicons name="cash-outline" size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>Nenhum pagamento registado ainda</Text>
                </View>
              </SectionCard>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Centro de Supervisão"
        subtitle={`${roleName} — Controlo Total do Sistema`}
      />

      {/* Header badge */}
      <LinearGradient
        colors={['#1A2B8A22', '#FFD70010']}
        style={styles.heroBanner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.heroBannerLeft}>
          <MaterialCommunityIcons name="eye-check-outline" size={20} color={Colors.gold} />
          <View>
            <Text style={styles.heroBannerTitle}>Modo Supervisão — {roleName}</Text>
            <Text style={styles.heroBannerSub}>
              Visibilidade completa sobre todos os utilizadores e operações do sistema
            </Text>
          </View>
        </View>
        {pendentes.length > 0 && (
          <TouchableOpacity
            style={styles.alertBtn}
            onPress={() => router.push('/(main)/admin' as any)}
          >
            <Ionicons name="alert-circle" size={14} color={Colors.warning} />
            <Text style={styles.alertBtnText}>{pendentes.length} pendentes</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={14}
              color={activeTab === t.key ? Colors.gold : Colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            {t.badge !== undefined && t.badge > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{t.badge > 99 ? '99+' : t.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {isDesktop ? (
        <View style={styles.desktopLayout}>
          {renderContent()}
        </View>
      ) : (
        renderContent()
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  heroBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.gold + '20',
  },
  heroBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  heroBannerTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.gold, marginBottom: 1 },
  heroBannerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 14 },
  alertBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warning + '20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.warning + '40',
  },
  alertBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.warning },

  tabsScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 7, gap: 6 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: { backgroundColor: Colors.gold + '18', borderColor: Colors.gold + '40' },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  tabBadge: {
    backgroundColor: Colors.gold, borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  tabBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#000' },

  desktopLayout: { flex: 1 },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10,
  },

  filterScroll: { flexGrow: 0, marginTop: 8 },
  filterContent: { paddingHorizontal: 12, gap: 6, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard,
  },
  filterChipActive: { backgroundColor: Colors.gold + '20', borderColor: Colors.gold + '60' },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  filterChipTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  roleDistRow: { gap: 12, paddingTop: 4 },
  roleDist: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleDistIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  roleDistTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  roleDistLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  roleDistCount: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  progressBg: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },

  shortcutsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginTop: 4 },
  shortcut: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    width: '47%',
  },
  shortcutIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  userName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  userEmail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  statusDot: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  statusDotText: { fontSize: 9, fontFamily: 'Inter_500Medium', color: '#fff' },

  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
});

// ─── Pill styles ──────────────────────────────────────────────────────────────
const pill = StyleSheet.create({
  wrap: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  text: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── StatGradient styles ─────────────────────────────────────────────────────
const sg = StyleSheet.create({
  card: {
    flex: 1, minWidth: 140, borderRadius: 16, padding: 16,
    gap: 4, minHeight: 110,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  value: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff' },
  title: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.8)' },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.55)' },
});

// ─── ActivityRow styles ───────────────────────────────────────────────────────
const ar = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  time: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── SectionCard styles ───────────────────────────────────────────────────────
const sc = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginTop: 12,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.gold + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  countBadge: { backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  countText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#000' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.gold },
});
