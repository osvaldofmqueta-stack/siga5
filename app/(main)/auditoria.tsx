import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import TopBar from '@/components/TopBar';

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  userName?: string;
  acao: string;
  modulo: string;
  descricao: string;
  recursoId?: string;
  ipAddress?: string;
  userAgent?: string;
  dados?: unknown;
  criadoEm: string;
}

interface Stats {
  byAcao: { acao: string; total: string }[];
  byModulo: { modulo: string; total: string }[];
}

const ACAO_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  login:         { label: 'Login',        color: '#3498DB', icon: 'log-in-outline' },
  login_falhado: { label: 'Login Falhado', color: '#E74C3C', icon: 'alert-circle-outline' },
  criar:         { label: 'Criação',      color: '#2ECC71', icon: 'add-circle-outline' },
  atualizar:     { label: 'Atualização',  color: '#F39C12', icon: 'create-outline' },
  eliminar:      { label: 'Eliminação',   color: '#E74C3C', icon: 'trash-outline' },
  aprovar:       { label: 'Aprovação',    color: '#27AE60', icon: 'checkmark-circle-outline' },
  rejeitar:      { label: 'Rejeição',     color: '#C0392B', icon: 'close-circle-outline' },
  exportar:      { label: 'Exportação',   color: '#9B59B6', icon: 'download-outline' },
};

const ACOES = ['', 'login', 'login_falhado', 'criar', 'atualizar', 'eliminar', 'aprovar', 'rejeitar', 'exportar'];
const MODULOS = ['', 'Autenticação', 'Alunos', 'Professores', 'Turmas', 'Notas', 'Presenças', 'Taxas', 'Pagamentos',
                 'RUPEs', 'Pautas', 'Sumários', 'Utilizadores', 'Admissão', 'Folhas de Salários'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function AcaoBadge({ acao }: { acao: string }) {
  const info = ACAO_LABELS[acao] ?? { label: acao, color: '#7F8C8D', icon: 'ellipse-outline' };
  return (
    <View style={[styles.badge, { backgroundColor: `${info.color}22`, borderColor: `${info.color}55` }]}>
      <Ionicons name={info.icon as any} size={11} color={info.color} />
      <Text style={[styles.badgeText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const info = ACAO_LABELS[log.acao];

  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.logRow} activeOpacity={0.8}>
      <View style={[styles.logColorBar, { backgroundColor: info?.color ?? '#7F8C8D' }]} />
      <View style={styles.logContent}>
        <View style={styles.logHeader}>
          <AcaoBadge acao={log.acao} />
          <View style={styles.modulePill}>
            <Text style={styles.modulePillText}>{log.modulo}</Text>
          </View>
          <Text style={styles.logTime}>{formatDate(log.criadoEm)}</Text>
        </View>

        <Text style={styles.logDesc}>{log.descricao}</Text>

        <View style={styles.logMeta}>
          <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.logMetaText}>
            {log.userName ?? log.userEmail}
            <Text style={styles.logMetaRole}> ({log.userRole})</Text>
          </Text>
        </View>

        {expanded && (
          <View style={styles.logExpanded}>
            <View style={styles.expandedRow}>
              <Text style={styles.expandedLabel}>Email</Text>
              <Text style={styles.expandedValue}>{log.userEmail}</Text>
            </View>
            {log.recursoId && (
              <View style={styles.expandedRow}>
                <Text style={styles.expandedLabel}>ID do Recurso</Text>
                <Text style={styles.expandedValue}>{log.recursoId}</Text>
              </View>
            )}
            {log.ipAddress && (
              <View style={styles.expandedRow}>
                <Text style={styles.expandedLabel}>Endereço IP</Text>
                <Text style={styles.expandedValue}>{log.ipAddress}</Text>
              </View>
            )}
            {log.userAgent && (
              <View style={styles.expandedRow}>
                <Text style={styles.expandedLabel}>Agente</Text>
                <Text style={[styles.expandedValue, { fontSize: 10 }]} numberOfLines={2}>{log.userAgent}</Text>
              </View>
            )}
            {log.dados && (
              <View style={styles.expandedRow}>
                <Text style={styles.expandedLabel}>Dados</Text>
                <Text style={[styles.expandedValue, styles.codeText]} numberOfLines={5}>
                  {JSON.stringify(log.dados, null, 2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={Colors.textMuted}
        style={{ marginTop: 4 }}
      />
    </TouchableOpacity>
  );
}

export default function AuditoriaScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [filterAcao, setFilterAcao] = useState('');
  const [filterModulo, setFilterModulo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const allowedRoles = ['ceo', 'pca', 'admin', 'director', 'chefe_secretaria'];
  const hasAccess = user && allowedRoles.includes(user.role);

  const fetchLogs = useCallback(async (p = 1, isRefresh = false) => {
    if (!hasAccess) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (search)       params.set('search', search);
      if (filterAcao)   params.set('acao', filterAcao);
      if (filterModulo) params.set('modulo', filterModulo);

      const data = await api.get<{ logs: AuditLog[]; total: number; pages: number }>(`/api/audit-logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } catch (e) {
      console.error('Audit fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasAccess, search, filterAcao, filterModulo]);

  const fetchStats = useCallback(async () => {
    if (!hasAccess) return;
    try {
      const data = await api.get<Stats>('/api/audit-logs/stats');
      setStats(data);
    } catch { /* silent */ }
  }, [hasAccess]);

  useEffect(() => { fetchLogs(1); fetchStats(); }, [fetchLogs, fetchStats]);

  const totalByAcao = useMemo(() => {
    const map: Record<string, number> = {};
    stats?.byAcao.forEach(r => { map[r.acao] = parseInt(r.total); });
    return map;
  }, [stats]);

  const exportCSV = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const header = ['Data/Hora', 'Utilizador', 'Email', 'Cargo', 'Ação', 'Módulo', 'Descrição', 'IP', 'ID Recurso'];
    const rows = logs.map(l => [
      formatDate(l.criadoEm),
      l.userName ?? '',
      l.userEmail,
      l.userRole,
      l.acao,
      l.modulo,
      l.descricao,
      l.ipAddress ?? '',
      l.recursoId ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <TopBar title="Auditoria" />
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.accessDeniedText}>Acesso Restrito</Text>
          <Text style={styles.accessDeniedSub}>Apenas administradores têm acesso ao audit log.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <TopBar title="Auditoria do Sistema" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLogs(1, true)} tintColor={Colors.gold} />}
      >
        {/* Stats Row */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{total}</Text>
              <Text style={styles.statLabel}>Total de Eventos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: Colors.info }]}>{totalByAcao['login'] ?? 0}</Text>
              <Text style={styles.statLabel}>Logins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: Colors.success }]}>{totalByAcao['criar'] ?? 0}</Text>
              <Text style={styles.statLabel}>Criações</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: Colors.danger }]}>{totalByAcao['eliminar'] ?? 0}</Text>
              <Text style={styles.statLabel}>Eliminações</Text>
            </View>
          </View>
        )}

        {/* Search + Filter Bar */}
        <View style={styles.searchBar}>
          <View style={styles.searchInput}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchText}
              placeholder="Pesquisar por utilizador, descrição..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => fetchLogs(1)}
              returnKeyType="search"
            />
            {search ? (
              <TouchableOpacity onPress={() => { setSearch(''); fetchLogs(1); }}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(!showFilters)}>
            <Ionicons name="options-outline" size={18} color={showFilters ? Colors.gold : Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterBtn} onPress={exportCSV}>
            <Ionicons name="download-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filtersTitle}>Filtros</Text>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Ação</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {ACOES.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.pill, filterAcao === a && styles.pillActive]}
                    onPress={() => { setFilterAcao(a); fetchLogs(1); }}
                  >
                    <Text style={[styles.pillText, filterAcao === a && styles.pillTextActive]}>
                      {a === '' ? 'Todas' : (ACAO_LABELS[a]?.label ?? a)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Módulo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {MODULOS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pill, filterModulo === m && styles.pillActive]}
                    onPress={() => { setFilterModulo(m); fetchLogs(1); }}
                  >
                    <Text style={[styles.pillText, filterModulo === m && styles.pillTextActive]}>
                      {m === '' ? 'Todos' : m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Results count */}
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {total} {total === 1 ? 'evento encontrado' : 'eventos encontrados'}
          </Text>
          <Text style={styles.resultsPage}>Página {page}/{pages}</Text>
        </View>

        {/* Log List */}
        {loading ? (
          <ActivityIndicator color={Colors.gold} size="large" style={{ marginTop: 40 }} />
        ) : logs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum evento encontrado</Text>
          </View>
        ) : (
          <>
            {logs.map(log => <LogRow key={log.id} log={log} />)}

            {/* Pagination */}
            {pages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                  onPress={() => fetchLogs(page - 1)}
                  disabled={page === 1}
                >
                  <Ionicons name="chevron-back" size={18} color={page === 1 ? Colors.textMuted : Colors.text} />
                  <Text style={[styles.pageBtnText, page === 1 && { color: Colors.textMuted }]}>Anterior</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicator}>{page} / {pages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page === pages && styles.pageBtnDisabled]}
                  onPress={() => fetchLogs(page + 1)}
                  disabled={page === pages}
                >
                  <Text style={[styles.pageBtnText, page === pages && { color: Colors.textMuted }]}>Próxima</Text>
                  <Ionicons name="chevron-forward" size={18} color={page === pages ? Colors.textMuted : Colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statNumber: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text, lineHeight: 28 },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 2 },

  searchBar: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  searchInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.backgroundCard, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchText: { flex: 1, color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 14 },
  filterBtn: {
    backgroundColor: Colors.backgroundCard, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },

  filtersPanel: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  filtersTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  filterRow: { marginBottom: 10 },
  filterLabel: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginBottom: 6 },
  pillScroll: { flexGrow: 0 },
  pill: {
    backgroundColor: Colors.backgroundElevated, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    marginRight: 6, borderWidth: 1, borderColor: Colors.border,
  },
  pillActive: { backgroundColor: `${Colors.gold}22`, borderColor: Colors.gold },
  pillText: { fontSize: 12, color: Colors.textSecondary, fontFamily: 'Inter_400Regular' },
  pillTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  resultsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resultsText: { fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  resultsPage: { fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },

  logRow: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', overflow: 'hidden',
  },
  logColorBar: { width: 4 },
  logContent: { flex: 1, padding: 12 },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  logTime: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginLeft: 'auto' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  modulePill: { backgroundColor: Colors.backgroundElevated, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  modulePillText: { fontSize: 10, color: Colors.textSecondary, fontFamily: 'Inter_400Regular' },

  logDesc: { fontSize: 13, color: Colors.text, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logMetaText: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  logMetaRole: { color: Colors.textMuted, fontStyle: 'italic' },

  logExpanded: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: 6,
  },
  expandedRow: { flexDirection: 'row', gap: 10 },
  expandedLabel: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_600SemiBold', width: 90, flexShrink: 0 },
  expandedValue: { flex: 1, fontSize: 11, color: Colors.textSecondary, fontFamily: 'Inter_400Regular' },
  codeText: { fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter_400Regular', fontSize: 10, backgroundColor: Colors.backgroundElevated, padding: 6, borderRadius: 4 },

  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, color: Colors.text, fontFamily: 'Inter_500Medium' },
  pageIndicator: { fontSize: 13, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },

  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  accessDeniedText: { fontSize: 20, color: Colors.text, fontFamily: 'Inter_700Bold' },
  accessDeniedSub: { fontSize: 14, color: Colors.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
