import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useData } from '@/context/DataContext';
import ExportMenu from '@/components/ExportMenu';
import { useProfessor } from '@/context/ProfessorContext';
import { useNotificacoes, timeAgo } from '@/context/NotificacoesContext';
import { api } from '@/lib/api';
import { webAlert } from '@/utils/webAlert';

type Tab = 'painel' | 'professores' | 'sumarios' | 'solicitacoes' | 'calendario' | 'pautas';
type SumarioFiltro = 'pendente' | 'aceite' | 'rejeitado' | 'todos';

interface HorarioItem {
  id: string;
  turmaId: string;
  disciplina: string;
  professorId?: string;
  professorNome: string;
  diaSemana: number;
  periodo: number;
  horaInicio: string;
  horaFim: string;
  sala: string;
  anoAcademico: string;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function RHHubScreen() {
  const { user } = useAuth();
  const { config } = useConfig();
  const router = useRouter();
  const { professores, turmas } = useData();
  const {
    sumarios, updateSumario,
    solicitacoes, updateSolicitacao, updatePauta,
    pautas, calendarioProvas, addCalendarioProva, updateCalendarioProva, deleteCalendarioProva,
    isLoading: profLoading,
  } = useProfessor();
  const { addNotificacao } = useNotificacoes();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>('painel');
  const [refreshing, setRefreshing] = useState(false);

  // Sumários
  const [selectedSumario, setSelectedSumario] = useState<string | null>(null);
  const [sumFiltro, setSumFiltro] = useState<SumarioFiltro>('pendente');
  const [sumSearch, setSumSearch] = useState('');
  const [observacao, setObservacao] = useState('');

  // Solicitações
  const [selectedSolicitude, setSelectedSolicitude] = useState<string | null>(null);

  // Calendário
  const [showProvaForm, setShowProvaForm] = useState(false);
  const [editingProva, setEditingProva] = useState<string | null>(null);
  const [provaTitulo, setProvaTitulo] = useState('');
  const [provaDesc, setProvaDesc] = useState('');
  const [provaDisciplina, setProvaDisciplina] = useState('');
  const [provaData, setProvaData] = useState('');
  const [provaHora, setProvaHora] = useState('');
  const [provaTipo, setProvaTipo] = useState<'teste' | 'exame' | 'trabalho' | 'prova_oral'>('teste');
  const [provaTurmasIds, setProvaTurmasIds] = useState<string[]>([]);

  // Professores
  const [profSearch, setProfSearch] = useState('');
  const [selectedProfId, setSelectedProfId] = useState<string | null>(null);
  const [profFiltro, setProfFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos');

  // Horários (carregados via API)
  const [horarios, setHorarios] = useState<HorarioItem[]>([]);
  const [horariosLoading, setHorariosLoading] = useState(false);

  const isRH = ['secretaria', 'admin', 'director', 'ceo', 'pca', 'chefe_secretaria', 'rh'].includes(user?.role ?? '');

  useEffect(() => {
    if (tab === 'painel') loadHorarios();
  }, [tab]);

  async function loadHorarios() {
    try {
      setHorariosLoading(true);
      const data = await api.get<HorarioItem[]>('/api/horarios');
      setHorarios(data);
    } catch {
      setHorarios([]);
    } finally {
      setHorariosLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHorarios();
    setRefreshing(false);
  }, []);

  // ─── Computed metrics ────────────────────────────────────────────────────────
  const profAtivos = useMemo(() => professores.filter(p => p.ativo), [professores]);
  const profInativos = useMemo(() => professores.filter(p => !p.ativo), [professores]);
  const sumPendentes = useMemo(() => sumarios.filter(s => s.status === 'pendente'), [sumarios]);
  const sumAceites = useMemo(() => sumarios.filter(s => s.status === 'aceite'), [sumarios]);
  const sumRejeitados = useMemo(() => sumarios.filter(s => s.status === 'rejeitado'), [sumarios]);
  const solPendentes = useMemo(() => solicitacoes.filter(s => s.status === 'pendente'), [solicitacoes]);
  const provasPublicadas = useMemo(() => calendarioProvas.filter(p => p.publicado), [calendarioProvas]);
  const pautasFechadas = useMemo(() => pautas.filter(p => p.status === 'fechada'), [pautas]);
  const pautasAbertas = useMemo(() => pautas.filter(p => p.status === 'aberta'), [pautas]);

  // Professor performance map: profId → { total, aceites, rejeitados, pendentes }
  const profPerformance = useMemo(() => {
    const map: Record<string, { total: number; aceites: number; rejeitados: number; pendentes: number }> = {};
    sumarios.forEach(s => {
      if (!map[s.professorId]) map[s.professorId] = { total: 0, aceites: 0, rejeitados: 0, pendentes: 0 };
      map[s.professorId].total++;
      if (s.status === 'aceite') map[s.professorId].aceites++;
      else if (s.status === 'rejeitado') map[s.professorId].rejeitados++;
      else map[s.professorId].pendentes++;
    });
    return map;
  }, [sumarios]);

  // Filtered professors
  const profFiltrados = useMemo(() => {
    return professores
      .filter(p => {
        if (profFiltro === 'ativo') return p.ativo;
        if (profFiltro === 'inativo') return !p.ativo;
        return true;
      })
      .filter(p => {
        if (!profSearch.trim()) return true;
        const q = profSearch.toLowerCase();
        return (
          p.nome.toLowerCase().includes(q) ||
          p.apelido.toLowerCase().includes(q) ||
          (p.disciplinas as string[]).some((d: string) => d.toLowerCase().includes(q))
        );
      });
  }, [professores, profSearch, profFiltro]);

  // Filtered sumários
  const sumFiltrados = useMemo(() => {
    return sumarios
      .filter(s => sumFiltro === 'todos' || s.status === sumFiltro)
      .filter(s => {
        if (!sumSearch.trim()) return true;
        const q = sumSearch.toLowerCase();
        return s.professorNome.toLowerCase().includes(q) || s.disciplina.toLowerCase().includes(q) || s.turmaNome.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sumarios, sumFiltro, sumSearch]);

  const sumarioSelecionado = sumarios.find(s => s.id === selectedSumario);
  const solicitSelecionada = solicitacoes.find(s => s.id === selectedSolicitude);
  const profSelecionado = professores.find(p => p.id === selectedProfId);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  async function aceitarSumario() {
    if (!sumarioSelecionado) return;
    await updateSumario(sumarioSelecionado.id, { status: 'aceite', observacaoRH: observacao || undefined });
    await addNotificacao({
      titulo: 'Sumário Aceite',
      mensagem: `O sumário da aula ${sumarioSelecionado.numeroAula} de ${sumarioSelecionado.disciplina} foi aceite.`,
      tipo: 'sucesso', data: new Date().toISOString(),
    });
    setSelectedSumario(null); setObservacao('');
  }

  async function rejeitarSumario() {
    if (!sumarioSelecionado) return;
    if (!observacao.trim()) { webAlert('Obrigatório', 'Indique o motivo da rejeição.'); return; }
    await updateSumario(sumarioSelecionado.id, { status: 'rejeitado', observacaoRH: observacao });
    await addNotificacao({
      titulo: 'Sumário Rejeitado',
      mensagem: `O sumário da aula ${sumarioSelecionado.numeroAula} de ${sumarioSelecionado.disciplina} foi rejeitado. Motivo: ${observacao}`,
      tipo: 'aviso', data: new Date().toISOString(),
    });
    setSelectedSumario(null); setObservacao('');
  }

  async function aprovarSolicitacao() {
    if (!solicitSelecionada) return;
    await updateSolicitacao(solicitSelecionada.id, { status: 'aprovada', respondidoEm: new Date().toISOString(), observacao });
    await updatePauta(solicitSelecionada.pautaId, { status: 'aberta' });
    await addNotificacao({
      titulo: 'Reabertura Aprovada',
      mensagem: `A solicitação de reabertura da pauta de ${solicitSelecionada.disciplina} (${solicitSelecionada.turmaNome}) foi aprovada.`,
      tipo: 'sucesso', data: new Date().toISOString(),
    });
    setSelectedSolicitude(null); setObservacao('');
  }

  async function rejeitarSolicitacao() {
    if (!solicitSelecionada) return;
    await updateSolicitacao(solicitSelecionada.id, { status: 'rejeitada', respondidoEm: new Date().toISOString(), observacao });
    await addNotificacao({
      titulo: 'Reabertura Rejeitada',
      mensagem: `A solicitação de reabertura da pauta de ${solicitSelecionada.disciplina} foi rejeitada.`,
      tipo: 'aviso', data: new Date().toISOString(),
    });
    setSelectedSolicitude(null); setObservacao('');
  }

  async function publicarProva() {
    if (!provaTitulo || !provaData || !provaDisciplina) {
      webAlert('Campos obrigatórios', 'Preencha título, disciplina e data.'); return;
    }
    if (editingProva) {
      await updateCalendarioProva(editingProva, {
        titulo: provaTitulo, descricao: provaDesc, disciplina: provaDisciplina,
        data: provaData, hora: provaHora, tipo: provaTipo, turmasIds: provaTurmasIds, publicado: true,
      });
    } else {
      await addCalendarioProva({
        titulo: provaTitulo, descricao: provaDesc, disciplina: provaDisciplina,
        data: provaData, hora: provaHora, tipo: provaTipo, turmasIds: provaTurmasIds, publicado: false,
      });
    }
    await addNotificacao({
      titulo: 'Nova Prova no Calendário',
      mensagem: `${provaTitulo} de ${provaDisciplina} agendada para ${provaData}.`,
      tipo: 'aviso', data: new Date().toISOString(),
    });
    setShowProvaForm(false); resetProvaForm();
  }

  function resetProvaForm() {
    setProvaTitulo(''); setProvaDesc(''); setProvaDisciplina('');
    setProvaData(''); setProvaHora(''); setProvaTurmasIds([]); setEditingProva(null);
  }

  async function publicarToggle(id: string, publicado: boolean) {
    await updateCalendarioProva(id, { publicado });
    if (publicado) {
      const prova = calendarioProvas.find(p => p.id === id);
      await addNotificacao({
        titulo: 'Prova Publicada',
        mensagem: `${prova?.titulo} de ${prova?.disciplina} foi publicada.`,
        tipo: 'info', data: new Date().toISOString(),
      });
    }
  }

  const tipoProvaColor: Record<string, string> = {
    teste: Colors.info, exame: Colors.danger, trabalho: Colors.gold, prova_oral: Colors.success,
  };

  // ─── Access Guard ─────────────────────────────────────────────────────────────
  if (!isRH) {
    return (
      <View style={styles.container}>
        <TopBar title="Hub de Recursos Humanos" subtitle="Acesso restrito" />
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Acesso Restrito</Text>
          <Text style={styles.emptySub}>Esta área é exclusiva para Secretaria, Administração e Direcção.</Text>
        </View>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <TopBar title="Recursos Humanos" subtitle="Gestão integrada do pessoal docente" />

      {/* KPI strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll}>
        <View style={styles.kpiRow}>
          <KPIChip label="Prof. Activos" value={profAtivos.length} color={Colors.success} icon="people" />
          <KPIChip label="Sumários Pend." value={sumPendentes.length} color={Colors.warning} icon="clipboard-outline" />
          <KPIChip label="Solicitações" value={solPendentes.length} color={Colors.accent} icon="document-text-outline" />
          <KPIChip label="Provas Publ." value={provasPublicadas.length} color={Colors.info} icon="calendar-outline" />
          <KPIChip label="Pautas Fech." value={pautasFechadas.length} color={Colors.gold} icon="lock-closed-outline" />
          <KPIChip label="Turmas" value={turmas.length} color={Colors.primaryLight} icon="school-outline" />
        </View>
      </ScrollView>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabRow}>
          {([ 
            { key: 'painel',       label: 'Painel',        icon: 'grid-outline' },
            { key: 'professores',  label: 'Professores',   icon: 'people-outline' },
            { key: 'sumarios',     label: `Sumários (${sumPendentes.length})`, icon: 'clipboard-outline' },
            { key: 'solicitacoes', label: `Solicitações (${solPendentes.length})`, icon: 'document-text-outline' },
            { key: 'calendario',   label: 'Calendário',    icon: 'calendar-outline' },
            { key: 'pautas',       label: 'Pautas',        icon: 'lock-closed-outline' },
          ] as { key: Tab; label: string; icon: any }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons name={t.icon} size={14} color={tab === t.key ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── PAINEL ─────────────────────────────────────────────────────────── */}
      {tab === 'painel' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          {/* Activity chart */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Sumários por Estado</Text>
            <View style={styles.barGroup}>
              <BarStat label="Pendentes" value={sumPendentes.length} total={sumarios.length} color={Colors.warning} />
              <BarStat label="Aceites" value={sumAceites.length} total={sumarios.length} color={Colors.success} />
              <BarStat label="Rejeitados" value={sumRejeitados.length} total={sumarios.length} color={Colors.danger} />
            </View>
          </View>

          {/* Top professors by sumários */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Professores Mais Activos (Sumários)</Text>
            {professores
              .filter(p => profPerformance[p.id]?.total > 0)
              .sort((a, b) => (profPerformance[b.id]?.total ?? 0) - (profPerformance[a.id]?.total ?? 0))
              .slice(0, 5)
              .map((p, i) => {
                const perf = profPerformance[p.id] ?? { total: 0, aceites: 0, rejeitados: 0, pendentes: 0 };
                const taxa = perf.total > 0 ? Math.round((perf.aceites / perf.total) * 100) : 0;
                return (
                  <View key={p.id} style={styles.profRankRow}>
                    <View style={[styles.rankBadge, { backgroundColor: i === 0 ? Colors.gold + '30' : Colors.surface }]}>
                      <Text style={[styles.rankNum, { color: i === 0 ? Colors.gold : Colors.textSecondary }]}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profRankName}>{p.nome} {p.apelido}</Text>
                      <Text style={styles.profRankSub}>{(p.disciplinas as string[]).join(', ')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.profRankTotal, { color: Colors.success }]}>{taxa}% taxa</Text>
                      <Text style={styles.profRankSub}>{perf.total} sumário(s)</Text>
                    </View>
                  </View>
                );
              })}
            {professores.filter(p => profPerformance[p.id]?.total > 0).length === 0 && (
              <Text style={styles.emptySmall}>Nenhum sumário registado ainda.</Text>
            )}
          </View>

          {/* Solicitações pendentes rápidas */}
          {solPendentes.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Solicitações Pendentes</Text>
              {solPendentes.slice(0, 3).map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.quickItem}
                  onPress={() => { setSelectedSolicitude(s.id); setObservacao(''); setTab('solicitacoes'); }}
                >
                  <View style={[styles.quickDot, { backgroundColor: Colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickTitle}>{s.professorNome}</Text>
                    <Text style={styles.quickSub}>{s.disciplina} · {s.turmaNome} · T{s.trimestre}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
              {solPendentes.length > 3 && (
                <TouchableOpacity onPress={() => setTab('solicitacoes')}>
                  <Text style={styles.verMais}>Ver todas ({solPendentes.length}) →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Pautas rápido */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Estado das Pautas</Text>
            <View style={styles.pautaQuickRow}>
              <View style={styles.pautaQuickItem}>
                <Text style={[styles.pautaQuickNum, { color: Colors.success }]}>{pautasAbertas.length}</Text>
                <Text style={styles.pautaQuickLabel}>Abertas</Text>
              </View>
              <View style={styles.pautaQuickItem}>
                <Text style={[styles.pautaQuickNum, { color: Colors.gold }]}>{pautasFechadas.length}</Text>
                <Text style={styles.pautaQuickLabel}>Fechadas</Text>
              </View>
              <View style={styles.pautaQuickItem}>
                <Text style={[styles.pautaQuickNum, { color: Colors.warning }]}>
                  {pautas.filter(p => p.status === 'pendente_abertura').length}
                </Text>
                <Text style={styles.pautaQuickLabel}>Pend. Abertura</Text>
              </View>
              <View style={styles.pautaQuickItem}>
                <Text style={[styles.pautaQuickNum, { color: Colors.danger }]}>
                  {pautas.filter(p => p.status === 'rejeitada').length}
                </Text>
                <Text style={styles.pautaQuickLabel}>Rejeitadas</Text>
              </View>
            </View>
          </View>

          {/* Horário por professor */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Carga Horária por Professor</Text>
            {horariosLoading ? (
              <ActivityIndicator color={Colors.gold} />
            ) : professores.filter(p => p.ativo).map(p => {
              const aulas = horarios.filter(h => h.professorId === p.id || h.professorNome === `${p.nome} ${p.apelido}`);
              if (aulas.length === 0) return null;
              return (
                <View key={p.id} style={styles.cargaRow}>
                  <FontAwesome5 name="chalkboard-teacher" size={14} color={Colors.gold} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.cargaNome}>{p.nome} {p.apelido}</Text>
                    <Text style={styles.cargaSub}>{aulas.length} aula(s) semanais</Text>
                  </View>
                  <View style={[styles.cargaBadge, { backgroundColor: Colors.info + '22' }]}>
                    <Text style={[styles.cargaBadgeText, { color: Colors.info }]}>{aulas.length}h</Text>
                  </View>
                </View>
              );
            })}
            {horarios.length === 0 && !horariosLoading && (
              <Text style={styles.emptySmall}>Sem horários configurados.</Text>
            )}
          </View>

          {/* Payroll quick access */}
          <TouchableOpacity
            style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}
            onPress={() => router.push('/(main)/rh-payroll' as never)}
            activeOpacity={0.8}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="cash-multiple" size={24} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Folha de Salários</Text>
              <Text style={styles.emptySmall}>Processamento salarial · INSS · IRT Angola</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── PROFESSORES ────────────────────────────────────────────────────── */}
      {tab === 'professores' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar professor ou disciplina..."
              placeholderTextColor={Colors.textMuted}
              value={profSearch}
              onChangeText={setProfSearch}
            />
            {profSearch.length > 0 && (
              <TouchableOpacity onPress={() => setProfSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            <ExportMenu
              title="Quadro de Pessoal Docente"
              columns={[
                { header: 'Nº Professor', key: 'numero', width: 14 },
                { header: 'Nome Completo', key: 'nome', width: 26 },
                { header: 'Disciplinas', key: 'disciplinas', width: 30 },
                { header: 'Habilitações', key: 'habilitacoes', width: 20 },
                { header: 'Turmas', key: 'turmas', width: 22 },
                { header: 'Nº Turmas', key: 'numTurmas', width: 10 },
                { header: 'Telefone', key: 'telefone', width: 16 },
                { header: 'Estado', key: 'estado', width: 10 },
              ]}
              rows={profFiltrados.map(p => ({
                numero: p.numeroProfessor,
                nome: `${p.nome} ${p.apelido}`,
                disciplinas: (p.disciplinas as string[]).join(', '),
                habilitacoes: p.habilitacoes,
                turmas: turmas.filter(t => (p.turmasIds as string[]).includes(t.id)).map(t => t.nome).join(', '),
                numTurmas: turmas.filter(t => (p.turmasIds as string[]).includes(t.id)).length,
                telefone: p.telefone ?? '',
                estado: p.ativo ? 'Activo' : 'Inactivo',
              }))}
              school={{ nomeEscola: config?.nomeEscola ?? 'Escola', directorGeral: config?.directorGeral }}
              filename="quadro_pessoal_docente"
              landscape
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <View style={styles.filterInner}>
              {(['todos', 'ativo', 'inativo'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterBtn, profFiltro === f && styles.filterBtnActive]}
                  onPress={() => setProfFiltro(f)}
                >
                  <Text style={[styles.filterText, profFiltro === f && styles.filterTextActive]}>
                    {f === 'todos' ? `Todos (${professores.length})` : f === 'ativo' ? `Activos (${profAtivos.length})` : `Inactivos (${profInativos.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <FlatList
            data={profFiltrados}
            keyExtractor={p => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Nenhum professor encontrado</Text>
              </View>
            }
            renderItem={({ item: p }) => {
              const perf = profPerformance[p.id] ?? { total: 0, aceites: 0, rejeitados: 0, pendentes: 0 };
              const turmasProf = turmas.filter(t => (p.turmasIds as string[]).includes(t.id));
              const taxa = perf.total > 0 ? Math.round((perf.aceites / perf.total) * 100) : null;
              return (
                <TouchableOpacity
                  style={[styles.card, !p.ativo && { opacity: 0.6 }]}
                  onPress={() => setSelectedProfId(p.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.profCardTop}>
                    <View style={styles.profAvatar}>
                      <Text style={styles.profAvatarText}>{p.nome[0]}{p.apelido[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.profCardName}>{p.nome} {p.apelido}</Text>
                        <View style={[styles.statusPill, { backgroundColor: p.ativo ? Colors.success + '22' : Colors.danger + '22' }]}>
                          <Text style={[styles.statusPillText, { color: p.ativo ? Colors.success : Colors.danger }]}>
                            {p.ativo ? 'Activo' : 'Inactivo'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.profCardDis}>{(p.disciplinas as string[]).join(' · ')}</Text>
                      <Text style={styles.profCardSub}>{p.habilitacoes}</Text>
                    </View>
                  </View>
                  <View style={styles.profCardStats}>
                    <ProfStat label="Turmas" value={turmasProf.length} color={Colors.info} />
                    <ProfStat label="Sumários" value={perf.total} color={Colors.warning} />
                    <ProfStat label="Aceites" value={perf.aceites} color={Colors.success} />
                    <ProfStat label="Taxa" value={taxa !== null ? `${taxa}%` : 'N/A'} color={taxa !== null && taxa >= 80 ? Colors.success : Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ── SUMÁRIOS ───────────────────────────────────────────────────────── */}
      {tab === 'sumarios' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar professor, disciplina ou turma..."
              placeholderTextColor={Colors.textMuted}
              value={sumSearch}
              onChangeText={setSumSearch}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <View style={styles.filterInner}>
              {(['pendente', 'aceite', 'rejeitado', 'todos'] as SumarioFiltro[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterBtn, sumFiltro === f && styles.filterBtnActive]}
                  onPress={() => setSumFiltro(f)}
                >
                  <Text style={[styles.filterText, sumFiltro === f && styles.filterTextActive]}>
                    {f === 'pendente' ? `Pendentes (${sumPendentes.length})` : f === 'aceite' ? `Aceites (${sumAceites.length})` : f === 'rejeitado' ? `Rejeitados (${sumRejeitados.length})` : `Todos (${sumarios.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <FlatList
            data={sumFiltrados}
            keyExtractor={s => s.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Nenhum sumário</Text>
              </View>
            }
            renderItem={({ item: s }) => {
              const sc = s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning;
              return (
                <TouchableOpacity
                  style={[styles.card, { borderLeftColor: sc, borderLeftWidth: 3 }]}
                  onPress={() => { setSelectedSumario(s.id); setObservacao(s.observacaoRH ?? ''); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{s.professorNome}</Text>
                      <Text style={styles.cardSub}>{s.disciplina} · {s.turmaNome} · Aula {s.numeroAula}</Text>
                      <Text style={styles.cardDate}>{s.data} · {s.horaInicio}–{s.horaFim}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                      <Text style={[styles.statusText, { color: sc }]}>
                        {s.status === 'aceite' ? 'Aceite' : s.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardConteudo} numberOfLines={2}>{s.conteudo}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ── SOLICITAÇÕES ───────────────────────────────────────────────────── */}
      {tab === 'solicitacoes' && (
        <FlatList
          data={[...solicitacoes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma solicitação</Text>
            </View>
          }
          renderItem={({ item: sol }) => {
            const sc = sol.status === 'aprovada' ? Colors.success : sol.status === 'rejeitada' ? Colors.danger : Colors.warning;
            return (
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: sc, borderLeftWidth: 3 }]}
                onPress={() => { if (sol.status === 'pendente') { setSelectedSolicitude(sol.id); setObservacao(''); }}}
                activeOpacity={sol.status === 'pendente' ? 0.8 : 1}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{sol.professorNome}</Text>
                    <Text style={styles.cardSub}>{sol.disciplina} · {sol.turmaNome} · T{sol.trimestre}</Text>
                    <Text style={styles.cardDate}>{timeAgo(sol.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                    <Text style={[styles.statusText, { color: sc }]}>
                      {sol.status === 'aprovada' ? 'Aprovada' : sol.status === 'rejeitada' ? 'Rejeitada' : 'Pendente'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardConteudo} numberOfLines={2}>Motivo: {sol.motivo}</Text>
                {sol.observacao && <Text style={[styles.cardConteudo, { color: Colors.textMuted, marginTop: 4 }]} numberOfLines={1}>Resposta: {sol.observacao}</Text>}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── CALENDÁRIO ─────────────────────────────────────────────────────── */}
      {tab === 'calendario' && (
        <>
          <FlatList
            data={[...calendarioProvas].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())}
            keyExtractor={p => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 90 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Nenhuma prova agendada</Text>
              </View>
            }
            renderItem={({ item: prova }) => {
              const color = tipoProvaColor[prova.tipo] || Colors.info;
              const turmasProva = turmas.filter(t => prova.turmasIds.includes(t.id));
              return (
                <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <View style={[styles.tipoBadge, { backgroundColor: color + '22' }]}>
                          <Text style={[styles.tipoText, { color }]}>{prova.tipo === 'prova_oral' ? 'Oral' : prova.tipo.charAt(0).toUpperCase() + prova.tipo.slice(1)}</Text>
                        </View>
                        <Text style={styles.cardTitle}>{prova.titulo}</Text>
                      </View>
                      <Text style={styles.cardSub}>{prova.disciplina}</Text>
                      <Text style={styles.cardDate}>{prova.data} às {prova.hora}</Text>
                      {turmasProva.length > 0 && (
                        <Text style={styles.cardDate}>Turmas: {turmasProva.map(t => t.nome).join(', ')}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.publishBtn, { backgroundColor: prova.publicado ? Colors.success + '22' : Colors.surface }]}
                        onPress={() => publicarToggle(prova.id, !prova.publicado)}
                      >
                        <Ionicons name={prova.publicado ? 'eye' : 'eye-off-outline'} size={13} color={prova.publicado ? Colors.success : Colors.textMuted} />
                        <Text style={[styles.publishText, { color: prova.publicado ? Colors.success : Colors.textMuted }]}>
                          {prova.publicado ? 'Publicado' : 'Rascunho'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => webAlert('Eliminar', 'Eliminar esta prova?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => deleteCalendarioProva(prova.id) },
                      ])}>
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {prova.descricao ? <Text style={styles.cardConteudo} numberOfLines={2}>{prova.descricao}</Text> : null}
                </View>
              );
            }}
          />
          <TouchableOpacity style={styles.fab} onPress={() => setShowProvaForm(true)}>
            <LinearGradient colors={[Colors.gold, '#C87E00']} style={styles.fabGrad}>
              <Ionicons name="add" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* ── PAUTAS ─────────────────────────────────────────────────────────── */}
      {tab === 'pautas' && (
        <FlatList
          data={[...pautas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma pauta registada</Text>
            </View>
          }
          renderItem={({ item: pauta }) => {
            const turma = turmas.find(t => t.id === pauta.turmaId);
            const prof = professores.find(p => p.id === pauta.professorId);
            const sc = pauta.status === 'aberta' ? Colors.success : pauta.status === 'fechada' ? Colors.gold : pauta.status === 'pendente_abertura' ? Colors.warning : Colors.danger;
            const solPauta = solicitacoes.find(s => s.pautaId === pauta.id && s.status === 'pendente');
            return (
              <View style={[styles.card, { borderLeftColor: sc, borderLeftWidth: 3 }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{pauta.disciplina}</Text>
                    <Text style={styles.cardSub}>{turma?.nome ?? '—'} · T{pauta.trimestre} · {pauta.anoLetivo}</Text>
                    <Text style={styles.cardDate}>{prof ? `${prof.nome} ${prof.apelido}` : '—'}</Text>
                    {pauta.dataFecho && <Text style={styles.cardDate}>Fechada em: {pauta.dataFecho}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                      <Text style={[styles.statusText, { color: sc }]}>
                        {pauta.status === 'aberta' ? 'Aberta' : pauta.status === 'fechada' ? 'Fechada' : pauta.status === 'pendente_abertura' ? 'Pend. Abertura' : 'Rejeitada'}
                      </Text>
                    </View>
                    {solPauta && (
                      <TouchableOpacity
                        style={styles.solicitBtn}
                        onPress={() => { setSelectedSolicitude(solPauta.id); setObservacao(''); setTab('solicitacoes'); }}
                      >
                        <Text style={styles.solicitBtnText}>Ver Solicitação</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ═══════════════════════ MODALS ═══════════════════════════════════════ */}

      {/* Professor Detail Modal */}
      <Modal visible={!!selectedProfId} transparent animationType="slide" onRequestClose={() => setSelectedProfId(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Perfil do Professor</Text>
              <TouchableOpacity onPress={() => setSelectedProfId(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {profSelecionado && (() => {
              const perf = profPerformance[profSelecionado.id] ?? { total: 0, aceites: 0, rejeitados: 0, pendentes: 0 };
              const turmasProf = turmas.filter(t => (profSelecionado.turmasIds as string[]).includes(t.id));
              const sumProf = sumarios.filter(s => s.professorId === profSelecionado.id).slice(0, 5);
              const taxa = perf.total > 0 ? Math.round((perf.aceites / perf.total) * 100) : 0;
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Avatar block */}
                  <View style={styles.profModalAvatar}>
                    <View style={styles.profAvatarLarge}>
                      <Text style={styles.profAvatarLargeText}>{profSelecionado.nome[0]}{profSelecionado.apelido[0]}</Text>
                    </View>
                    <Text style={styles.profModalName}>{profSelecionado.nome} {profSelecionado.apelido}</Text>
                    <View style={[styles.statusPill, { backgroundColor: profSelecionado.ativo ? Colors.success + '22' : Colors.danger + '22', alignSelf: 'center', marginTop: 4 }]}>
                      <Text style={[styles.statusPillText, { color: profSelecionado.ativo ? Colors.success : Colors.danger }]}>
                        {profSelecionado.ativo ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>

                  <LabelValue label="Nº Professor" value={profSelecionado.numeroProfessor} />
                  <LabelValue label="Email" value={profSelecionado.email} />
                  <LabelValue label="Telefone" value={profSelecionado.telefone} />
                  <LabelValue label="Habilitações" value={profSelecionado.habilitacoes} />
                  <LabelValue label="Disciplinas" value={(profSelecionado.disciplinas as string[]).join(', ')} />
                  <LabelValue label="Turmas Atribuídas" value={turmasProf.length > 0 ? turmasProf.map(t => `${t.nome} (${t.classe})`).join(', ') : 'Nenhuma'} />

                  {/* Performance */}
                  <Text style={[styles.reviewLabel, { marginTop: 16 }]}>Desempenho — Sumários</Text>
                  <View style={styles.perfRow}>
                    <PerfBlock label="Total" value={perf.total} color={Colors.textSecondary} />
                    <PerfBlock label="Aceites" value={perf.aceites} color={Colors.success} />
                    <PerfBlock label="Rejeitados" value={perf.rejeitados} color={Colors.danger} />
                    <PerfBlock label="Taxa" value={`${taxa}%`} color={taxa >= 80 ? Colors.success : Colors.warning} />
                  </View>

                  {/* Recent sumários */}
                  {sumProf.length > 0 && (
                    <>
                      <Text style={[styles.reviewLabel, { marginTop: 16 }]}>Últimos Sumários</Text>
                      {sumProf.map(s => {
                        const sc = s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning;
                        return (
                          <View key={s.id} style={[styles.sumMiniCard, { borderLeftColor: sc, borderLeftWidth: 2 }]}>
                            <Text style={styles.sumMiniTitle}>{s.disciplina} · {s.turmaNome} · Aula {s.numeroAula}</Text>
                            <Text style={styles.sumMiniSub}>{s.data} · <Text style={{ color: sc }}>{s.status}</Text></Text>
                          </View>
                        );
                      })}
                    </>
                  )}
                  <View style={{ height: 16 }} />
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Sumário Review Modal */}
      <Modal visible={!!selectedSumario} transparent animationType="slide" onRequestClose={() => setSelectedSumario(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Validar Sumário</Text>
              <TouchableOpacity onPress={() => { setSelectedSumario(null); setObservacao(''); }} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {sumarioSelecionado && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <LabelValue label="Professor" value={sumarioSelecionado.professorNome} />
                <LabelValue label="Turma / Disciplina" value={`${sumarioSelecionado.turmaNome} · ${sumarioSelecionado.disciplina}`} />
                <LabelValue label="Data / Horário" value={`${sumarioSelecionado.data} · ${sumarioSelecionado.horaInicio}–${sumarioSelecionado.horaFim} · Aula ${sumarioSelecionado.numeroAula}`} />
                <Text style={styles.reviewLabel}>Conteúdo Lecionado</Text>
                <View style={styles.conteudoBox}>
                  <Text style={styles.conteudoText}>{sumarioSelecionado.conteudo}</Text>
                </View>
                <Text style={styles.fieldLabel}>Observação {sumarioSelecionado.status === 'pendente' ? '(obrigatória na rejeição)' : ''}</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Escreva uma observação..."
                  placeholderTextColor={Colors.textMuted}
                  value={observacao}
                  onChangeText={setObservacao}
                  multiline
                  editable={sumarioSelecionado.status === 'pendente'}
                />
                {sumarioSelecionado.status === 'pendente' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={rejeitarSumario}>
                      <Ionicons name="close-circle" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Rejeitar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={aceitarSumario}>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Aceitar</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={{ height: 16 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Solicitação Review Modal */}
      <Modal visible={!!selectedSolicitude} transparent animationType="slide" onRequestClose={() => setSelectedSolicitude(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitação de Reabertura</Text>
              <TouchableOpacity onPress={() => { setSelectedSolicitude(null); setObservacao(''); }} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {solicitSelecionada && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <LabelValue label="Professor" value={solicitSelecionada.professorNome} />
                <LabelValue label="Pauta" value={`${solicitSelecionada.disciplina} · ${solicitSelecionada.turmaNome} · Trimestre ${solicitSelecionada.trimestre}`} />
                <Text style={styles.reviewLabel}>Motivo do Pedido</Text>
                <View style={styles.conteudoBox}>
                  <Text style={styles.conteudoText}>{solicitSelecionada.motivo}</Text>
                </View>
                <Text style={styles.fieldLabel}>Resposta / Observação</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Escreva uma resposta..."
                  placeholderTextColor={Colors.textMuted}
                  value={observacao}
                  onChangeText={setObservacao}
                  multiline
                  editable={solicitSelecionada.status === 'pendente'}
                />
                {solicitSelecionada.status === 'pendente' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={rejeitarSolicitacao}>
                      <Ionicons name="close-circle" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Rejeitar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={aprovarSolicitacao}>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Aprovar</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={{ height: 16 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Nova Prova Modal */}
      <Modal visible={showProvaForm} transparent animationType="slide" onRequestClose={() => { setShowProvaForm(false); resetProvaForm(); }}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agendar Prova / Avaliação</Text>
              <TouchableOpacity onPress={() => { setShowProvaForm(false); resetProvaForm(); }} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Tipo de Avaliação</Text>
              <View style={styles.tipoRow}>
                {(['teste', 'exame', 'trabalho', 'prova_oral'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tipoBtn, provaTipo === t && { borderColor: tipoProvaColor[t] }, { borderWidth: 1.5, borderColor: provaTipo === t ? tipoProvaColor[t] : 'transparent', backgroundColor: provaTipo === t ? tipoProvaColor[t] + '22' : Colors.surface }]}
                    onPress={() => setProvaTipo(t)}
                  >
                    <Text style={[styles.tipoBtnText, provaTipo === t && { color: tipoProvaColor[t] }]}>
                      {t === 'prova_oral' ? 'Oral' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Título *</Text>
              <TextInput style={styles.input} placeholder="Ex: Teste do 1º Trimestre" placeholderTextColor={Colors.textMuted} value={provaTitulo} onChangeText={setProvaTitulo} />
              <Text style={styles.fieldLabel}>Disciplina *</Text>
              <TextInput style={styles.input} placeholder="Ex: Matemática" placeholderTextColor={Colors.textMuted} value={provaDisciplina} onChangeText={setProvaDisciplina} />
              <Text style={styles.fieldLabel}>Data * (AAAA-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="2025-06-15" placeholderTextColor={Colors.textMuted} value={provaData} onChangeText={setProvaData} />
              <Text style={styles.fieldLabel}>Hora</Text>
              <TextInput style={styles.input} placeholder="08:00" placeholderTextColor={Colors.textMuted} value={provaHora} onChangeText={setProvaHora} />
              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} placeholder="Informações adicionais..." placeholderTextColor={Colors.textMuted} value={provaDesc} onChangeText={setProvaDesc} multiline />
              <Text style={styles.fieldLabel}>Turmas</Text>
              <View style={styles.turmasGrid}>
                {turmas.map(t => {
                  const sel = provaTurmasIds.includes(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.turmaBadge, sel && styles.turmaBadgeActive]}
                      onPress={() => setProvaTurmasIds(prev => sel ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                    >
                      <Text style={[styles.turmaBadgeText, sel && styles.turmaBadgeTextActive]}>{t.nome}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={publicarProva}>
                <Text style={styles.saveBtnText}>{editingProva ? 'Actualizar' : 'Agendar Prova'}</Text>
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KPIChip({ label, value, color, icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <View style={[kpiStyles.chip, { borderColor: color + '40' }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
    </View>
  );
}

function BarStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={[barStyles.val, { color }]}>{value}</Text>
      </View>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ProfStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={profStyles.stat}>
      <Text style={[profStyles.statVal, { color }]}>{value}</Text>
      <Text style={profStyles.statLabel}>{label}</Text>
    </View>
  );
}

function PerfBlock({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={perfStyles.block}>
      <Text style={[perfStyles.val, { color }]}>{value}</Text>
      <Text style={perfStyles.label}>{label}</Text>
    </View>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const kpiStyles = StyleSheet.create({
  chip: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, backgroundColor: Colors.surface, marginRight: 8, minWidth: 80 },
  value: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  label: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
});

const barStyles = StyleSheet.create({
  label: { fontSize: 12, color: Colors.textSecondary },
  val: { fontSize: 12, fontWeight: '700' },
  track: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});

const profStyles = StyleSheet.create({
  stat: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});

const perfStyles = StyleSheet.create({
  block: { alignItems: 'center', flex: 1, backgroundColor: Colors.surface, borderRadius: 10, paddingVertical: 10 },
  val: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  kpiScroll: { maxHeight: 90, backgroundColor: Colors.backgroundCard },
  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },

  tabScroll: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 4 },
  tabActive: { backgroundColor: Colors.gold + '20' },
  tabText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Colors.gold, fontWeight: '700' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },

  filterRow: { maxHeight: 44 },
  filterInner: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  filterBtnActive: { backgroundColor: Colors.gold + '22', borderWidth: 1, borderColor: Colors.gold },
  filterText: { fontSize: 12, color: Colors.textSecondary },
  filterTextActive: { color: Colors.gold, fontWeight: '700' },

  card: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  cardSub: { fontSize: 12, color: Colors.textSecondary },
  cardDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  cardConteudo: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  tipoBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tipoText: { fontSize: 10, fontWeight: '700' },

  sectionCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  barGroup: {},

  profRankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rankBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rankNum: { fontSize: 12, fontWeight: '700' },
  profRankName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  profRankSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  profRankTotal: { fontSize: 13, fontWeight: '700' },

  quickItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  quickDot: { width: 8, height: 8, borderRadius: 4 },
  quickTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  quickSub: { fontSize: 11, color: Colors.textMuted },
  verMais: { marginTop: 8, fontSize: 12, color: Colors.gold, fontWeight: '600' },

  pautaQuickRow: { flexDirection: 'row' },
  pautaQuickItem: { flex: 1, alignItems: 'center' },
  pautaQuickNum: { fontSize: 24, fontWeight: '800' },
  pautaQuickLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  cargaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cargaNome: { fontSize: 13, fontWeight: '600', color: Colors.text },
  cargaSub: { fontSize: 11, color: Colors.textMuted },
  cargaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  cargaBadgeText: { fontSize: 12, fontWeight: '700' },

  profCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  profAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  profAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.gold },
  profCardName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  profCardDis: { fontSize: 12, color: Colors.gold, marginTop: 2 },
  profCardSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  profCardStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  publishText: { fontSize: 11, fontWeight: '600' },

  solicitBtn: { backgroundColor: Colors.info + '22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  solicitBtnText: { fontSize: 10, color: Colors.info, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  emptySmall: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', padding: 12 },

  fab: { position: 'absolute', bottom: 28, right: 20 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  closeBtn: { padding: 4 },

  reviewLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 12, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewValue: { fontSize: 14, color: Colors.text, fontWeight: '600' },

  conteudoBox: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border },
  conteudoText: { fontSize: 13, color: Colors.text, lineHeight: 20 },

  fieldLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, borderWidth: 1, borderColor: Colors.border, fontSize: 14 },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.danger, borderRadius: 12, paddingVertical: 13 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 13 },
  actionBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  profModalAvatar: { alignItems: 'center', paddingBottom: 16 },
  profAvatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  profAvatarLargeText: { fontSize: 26, fontWeight: '800', color: Colors.gold },
  profModalName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  perfRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  sumMiniCard: { backgroundColor: Colors.surface, borderRadius: 8, padding: 10, marginBottom: 6 },
  sumMiniTitle: { fontSize: 12, color: Colors.text, fontWeight: '600' },
  sumMiniSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tipoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  tipoBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  turmasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  turmaBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  turmaBadgeActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  turmaBadgeText: { fontSize: 12, color: Colors.textMuted },
  turmaBadgeTextActive: { color: Colors.gold, fontWeight: '700' },

  saveBtn: { backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
