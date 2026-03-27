import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, FlatList, Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { api } from '@/lib/api';
import TopBar from '@/components/TopBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Turma { id: string; nome: string; classe: string; professorId: string; }
interface Aluno { id: string; nome: string; apelido: string; turmaId: string; numeroMatricula: string; }

interface ConfigFalta {
  id: string; turmaId: string; turmaNome?: string; disciplina: string;
  anoLetivo: string; maxFaltasMensais: number; ativo: boolean;
  definidoPor: string; createdAt: string;
}
interface RegistoMensal {
  id: string; alunoId: string; alunoNomeCompleto?: string; turmaNome?: string;
  turmaId: string; disciplina: string; mes: number; ano: number; trimestre: number;
  totalFaltas: number; faltasJustificadas: number; faltasInjustificadas: number;
  status: string; observacao: string; registadoPor: string; dataRegisto: string;
}
interface ExclusaoFalta {
  id: string; alunoId: string; alunoNomeCompleto?: string; turmaNome?: string;
  turmaId: string; disciplina: string; anoLetivo: string; trimestre: number;
  mes: number; ano: number; totalFaltasAcumuladas: number; limiteFaltas: number;
  tipoExclusao: string; motivo: string; status: string; dataExclusao: string;
  registadoPor: string; createdAt: string;
}
interface SolicitacaoProva {
  id: string; alunoId: string; alunoNomeCompleto?: string; turmaId: string; turmaNome?: string;
  disciplina: string; anoLetivo: string; trimestre: number; tipoProva: string;
  dataProvaOriginal: string; dataProvaJustificada?: string; motivo: string;
  status: string; resposta: string; respondidoPor: string; solicitadoPor: string; createdAt: string;
}
interface AnulacaoMatricula {
  id: string; alunoId: string; alunoNome: string; turmaId?: string; turmaNome: string;
  anoLetivo: string; motivo: string; descricao: string; dataAnulacao: string;
  registadoPor: string; status: string; reAdmissaoPermitida: boolean; observacoes: string; createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'config', label: 'Conf. Faltas', icon: 'cog' },
  { key: 'mensal', label: 'Levantamento', icon: 'clipboard-list' },
  { key: 'exclusoes', label: 'Exclusões', icon: 'account-cancel' },
  { key: 'prova', label: 'Prova Justif.', icon: 'file-document-edit' },
  { key: 'anulacao', label: 'Anulação Mat.', icon: 'account-off' },
] as const;

type TabKey = typeof TABS[number]['key'];

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TRIMESTRES = [1, 2, 3];
const TIPOS_PROVA = ['teste','mini_teste','exame','trabalho'] as const;
const MOTIVOS_ANULACAO = ['voluntaria','disciplinar','financeira','faltas','dupla_reprovacao','outro'] as const;

const STATUS_COLORS: Record<string, string> = {
  normal: Colors.success, em_risco: Colors.warning, excluido: Colors.danger,
  pendente: Colors.warning, aprovada: Colors.success, rejeitada: Colors.danger, realizada: Colors.info,
  ativa: Colors.danger, revertida: Colors.success,
};

function fmtDate(s?: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('pt-AO', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return s; }
}
function today() { return new Date().toISOString().slice(0,10); }
function currentYear() { return new Date().getFullYear(); }
function currentMonth() { return new Date().getMonth() + 1; }

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExclusoesFaltasScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { anoAtivo } = useAnoAcademico();
  const { turmas: allTurmas, alunos: allAlunos } = useData();

  const [activeTab, setActiveTab] = useState<TabKey>('config');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data state
  const [configs, setConfigs] = useState<ConfigFalta[]>([]);
  const [registos, setRegistos] = useState<RegistoMensal[]>([]);
  const [exclusoes, setExclusoes] = useState<ExclusaoFalta[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoProva[]>([]);
  const [anulacoes, setAnulacoes] = useState<AnulacaoMatricula[]>([]);

  // Filters
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroMes, setFiltroMes] = useState(currentMonth());
  const [filtroAno, setFiltroAno] = useState(currentYear());
  const [filtroTrimestre, setFiltroTrimestre] = useState(1);

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRegistoModal, setShowRegistoModal] = useState(false);
  const [showExclusaoModal, setShowExclusaoModal] = useState(false);
  const [showProvaModal, setShowProvaModal] = useState(false);
  const [showAnulacaoModal, setShowAnulacaoModal] = useState(false);
  const [showRespostaModal, setShowRespostaModal] = useState<SolicitacaoProva | null>(null);

  const anoLetivo = anoAtivo?.ano || '';
  const turmas: Turma[] = (allTurmas || []) as Turma[];
  const alunos: Aluno[] = (allAlunos || []) as Aluno[];

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!anoLetivo) return;
    setLoading(true);
    try {
      const [cfgs, regs, excs, sols, anuls] = await Promise.all([
        api.get<ConfigFalta[]>(`/api/configuracoes-falta?anoLetivo=${encodeURIComponent(anoLetivo)}`),
        api.get<RegistoMensal[]>(`/api/registos-falta-mensal?mes=${filtroMes}&ano=${filtroAno}`),
        api.get<ExclusaoFalta[]>(`/api/exclusoes-falta?anoLetivo=${encodeURIComponent(anoLetivo)}`),
        api.get<SolicitacaoProva[]>(`/api/solicitacoes-prova-justificada?anoLetivo=${encodeURIComponent(anoLetivo)}`),
        api.get<AnulacaoMatricula[]>(`/api/anulacoes-matricula?anoLetivo=${encodeURIComponent(anoLetivo)}`),
      ]);
      setConfigs(cfgs);
      setRegistos(regs);
      setExclusoes(excs);
      setSolicitacoes(sols);
      setAnulacoes(anuls);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [anoLetivo, filtroMes, filtroAno]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Derived data ────────────────────────────────────────────────────────────

  const turmasFiltradas = useMemo(() =>
    filtroTurma ? turmas.filter(t => t.id === filtroTurma) : turmas,
  [turmas, filtroTurma]);

  const configsFiltradas = useMemo(() =>
    filtroTurma ? configs.filter(c => c.turmaId === filtroTurma) : configs,
  [configs, filtroTurma]);

  const registosFiltrados = useMemo(() =>
    filtroTurma ? registos.filter(r => r.turmaId === filtroTurma) : registos,
  [registos, filtroTurma]);

  const exclusoesFiltradas = useMemo(() =>
    filtroTurma ? exclusoes.filter(e => e.turmaId === filtroTurma) : exclusoes,
  [exclusoes, filtroTurma]);

  // ── Render Tabs ─────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TopBar title="Exclusões & Faltas" subtitle="Controlo de assiduidade e exclusões" />

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialCommunityIcons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? Colors.gold : Colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {/* Turma filter */}
          <TouchableOpacity
            style={[styles.filterChip, !filtroTurma && styles.filterChipActive]}
            onPress={() => setFiltroTurma('')}
          >
            <Text style={styles.filterChipText}>Todas as turmas</Text>
          </TouchableOpacity>
          {turmas.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.filterChip, filtroTurma === t.id && styles.filterChipActive]}
              onPress={() => setFiltroTurma(t.id)}
            >
              <Text style={styles.filterChipText}>{t.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          {activeTab === 'config' && (
            <ConfigFaltasTab
              configs={configsFiltradas}
              turmas={turmas}
              anoLetivo={anoLetivo}
              userName={user?.nome || ''}
              onAdd={() => setShowConfigModal(true)}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'mensal' && (
            <LevantamentoMensalTab
              registos={registosFiltrados}
              turmas={turmasFiltradas}
              alunos={alunos}
              configs={configs}
              mes={filtroMes}
              ano={filtroAno}
              trimestre={filtroTrimestre}
              setMes={setFiltroMes}
              setAno={setFiltroAno}
              setTrimestre={setFiltroTrimestre}
              userName={user?.nome || ''}
              anoLetivo={anoLetivo}
              onAdd={() => setShowRegistoModal(true)}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'exclusoes' && (
            <ExclusoesTab
              exclusoes={exclusoesFiltradas}
              turmas={turmas}
              alunos={alunos}
              anoLetivo={anoLetivo}
              userName={user?.nome || ''}
              onAdd={() => setShowExclusaoModal(true)}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'prova' && (
            <ProvaJustificadaTab
              solicitacoes={solicitacoes}
              turmas={turmas}
              alunos={alunos}
              anoLetivo={anoLetivo}
              userName={user?.nome || ''}
              onAdd={() => setShowProvaModal(true)}
              onResposta={(s) => setShowRespostaModal(s)}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'anulacao' && (
            <AnulacaoMatriculaTab
              anulacoes={anulacoes}
              turmas={turmas}
              alunos={alunos}
              anoLetivo={anoLetivo}
              userName={user?.nome || ''}
              onAdd={() => setShowAnulacaoModal(true)}
              onRefresh={fetchData}
            />
          )}
        </ScrollView>
      )}

      {/* Modals */}
      {showConfigModal && (
        <ConfigModal
          turmas={turmas}
          anoLetivo={anoLetivo}
          userName={user?.nome || ''}
          userId={user?.id || ''}
          onClose={() => setShowConfigModal(false)}
          onSaved={() => { setShowConfigModal(false); fetchData(); }}
        />
      )}
      {showRegistoModal && (
        <RegistoMensalModal
          turmas={turmas}
          alunos={alunos}
          configs={configs}
          mes={filtroMes}
          ano={filtroAno}
          trimestre={filtroTrimestre}
          userName={user?.nome || ''}
          userId={user?.id || ''}
          anoLetivo={anoLetivo}
          onClose={() => setShowRegistoModal(false)}
          onSaved={() => { setShowRegistoModal(false); fetchData(); }}
        />
      )}
      {showExclusaoModal && (
        <ExclusaoModal
          turmas={turmas}
          alunos={alunos}
          anoLetivo={anoLetivo}
          mes={filtroMes}
          ano={filtroAno}
          trimestre={filtroTrimestre}
          userName={user?.nome || ''}
          userId={user?.id || ''}
          onClose={() => setShowExclusaoModal(false)}
          onSaved={() => { setShowExclusaoModal(false); fetchData(); }}
        />
      )}
      {showProvaModal && (
        <ProvaJustificadaModal
          turmas={turmas}
          alunos={alunos}
          anoLetivo={anoLetivo}
          trimestre={filtroTrimestre}
          userName={user?.nome || ''}
          userId={user?.id || ''}
          onClose={() => setShowProvaModal(false)}
          onSaved={() => { setShowProvaModal(false); fetchData(); }}
        />
      )}
      {showAnulacaoModal && (
        <AnulacaoModal
          turmas={turmas}
          alunos={alunos}
          anoLetivo={anoLetivo}
          userName={user?.nome || ''}
          userId={user?.id || ''}
          onClose={() => setShowAnulacaoModal(false)}
          onSaved={() => { setShowAnulacaoModal(false); fetchData(); }}
        />
      )}
      {showRespostaModal && (
        <RespostaProvaModal
          solicitacao={showRespostaModal}
          userName={user?.nome || ''}
          onClose={() => setShowRespostaModal(null)}
          onSaved={() => { setShowRespostaModal(null); fetchData(); }}
        />
      )}
    </View>
  );
}

// ─── Tab: Configurações de Falta ─────────────────────────────────────────────

function ConfigFaltasTab({ configs, turmas, anoLetivo, userName, onAdd, onRefresh }: {
  configs: ConfigFalta[]; turmas: Turma[]; anoLetivo: string;
  userName: string; onAdd: () => void; onRefresh: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Configurações de Falta por Disciplina</Text>
          <Text style={styles.sectionSubtitle}>Definido pelo Director de Turma</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Definir</Text>
        </TouchableOpacity>
      </View>

      {configs.length === 0 ? (
        <EmptyState icon="cog" text="Nenhuma configuração de falta definida.\nO Director de Turma deve definir o limite de faltas por disciplina." />
      ) : (
        configs.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle}>{c.disciplina === '*' ? 'Todas as disciplinas' : c.disciplina}</Text>
                <Text style={styles.cardSub}>{c.turmaNome || '—'} · {anoLetivo}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: c.ativo ? Colors.success + '30' : Colors.danger + '30' }]}>
                <Text style={[styles.badgeText, { color: c.ativo ? Colors.success : Colors.danger }]}>
                  {c.ativo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
            <View style={styles.cardDetail}>
              <MaterialCommunityIcons name="alert-circle-outline" size={15} color={Colors.warning} />
              <Text style={styles.cardDetailText}>
                Máx. <Text style={{ color: Colors.warning, fontWeight: '700' }}>{c.maxFaltasMensais}</Text> falta(s) por mês
              </Text>
            </View>
            <Text style={styles.cardMeta}>Definido por: {c.definidoPor || '—'}</Text>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Tab: Levantamento Mensal ─────────────────────────────────────────────────

function LevantamentoMensalTab({ registos, turmas, alunos, configs, mes, ano, trimestre,
  setMes, setAno, setTrimestre, userName, anoLetivo, onAdd, onRefresh }: {
  registos: RegistoMensal[]; turmas: Turma[]; alunos: Aluno[]; configs: ConfigFalta[];
  mes: number; ano: number; trimestre: number;
  setMes: (v: number) => void; setAno: (v: number) => void; setTrimestre: (v: number) => void;
  userName: string; anoLetivo: string; onAdd: () => void; onRefresh: () => void;
}) {
  const alunosEmRisco = registos.filter(r => r.status === 'em_risco').length;
  const alunosExcluidos = registos.filter(r => r.status === 'excluido').length;

  return (
    <View style={styles.tabContent}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Registos" value={registos.length} color={Colors.info} icon="clipboard-list" />
        <StatCard label="Em Risco" value={alunosEmRisco} color={Colors.warning} icon="alert" />
        <StatCard label="Excluídos" value={alunosExcluidos} color={Colors.danger} icon="account-cancel" />
      </View>

      {/* Filters */}
      <View style={styles.monthFilter}>
        <Text style={styles.filterLabel}>Mês:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {MESES.map((m, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.filterChipSm, mes === i + 1 && styles.filterChipSmActive]}
              onPress={() => setMes(i + 1)}
            >
              <Text style={[styles.filterChipSmText, mes === i + 1 && { color: Colors.gold }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.monthFilter}>
        <Text style={styles.filterLabel}>Trimestre:</Text>
        {TRIMESTRES.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChipSm, trimestre === t && styles.filterChipSmActive]}
            onPress={() => setTrimestre(t)}
          >
            <Text style={[styles.filterChipSmText, trimestre === t && { color: Colors.gold }]}>{t}º</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{MESES[mes - 1]} {ano}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Registar</Text>
        </TouchableOpacity>
      </View>

      {registos.length === 0 ? (
        <EmptyState icon="clipboard-list" text={`Sem registos de faltas para ${MESES[mes - 1]} ${ano}.`} />
      ) : (
        registos.map(r => {
          const statusColor = STATUS_COLORS[r.status] || Colors.textSecondary;
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>{r.alunoNomeCompleto || r.alunoId}</Text>
                  <Text style={styles.cardSub}>{r.disciplina} · {r.turmaNome}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusColor + '25' }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {r.status === 'normal' ? 'Normal' : r.status === 'em_risco' ? 'Em Risco' : 'Excluído'}
                  </Text>
                </View>
              </View>
              <View style={styles.faltaRow}>
                <FaltaBox label="Total" value={r.totalFaltas} color={Colors.danger} />
                <FaltaBox label="Justif." value={r.faltasJustificadas} color={Colors.success} />
                <FaltaBox label="Injust." value={r.faltasInjustificadas} color={Colors.warning} />
              </View>
              {r.observacao ? <Text style={styles.cardMeta}>{r.observacao}</Text> : null}
              <Text style={styles.cardMeta}>Registado por: {r.registadoPor || '—'} · {fmtDate(r.dataRegisto)}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

// ─── Tab: Exclusões por Falta ─────────────────────────────────────────────────

function ExclusoesTab({ exclusoes, turmas, alunos, anoLetivo, userName, onAdd, onRefresh }: {
  exclusoes: ExclusaoFalta[]; turmas: Turma[]; alunos: Aluno[];
  anoLetivo: string; userName: string; onAdd: () => void; onRefresh: () => void;
}) {
  const TIPO_LABELS: Record<string, string> = {
    exclusao_disciplina: 'Exclusão por Falta', anulacao_matricula: 'Anulação de Matrícula',
    dupla_reprovacao: 'Dupla Reprovação',
  };

  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Exclusões por Falta</Text>
          <Text style={styles.sectionSubtitle}>{exclusoes.length} registo(s) — {anoLetivo}</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.danger }]} onPress={onAdd}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Registar</Text>
        </TouchableOpacity>
      </View>

      {exclusoes.length === 0 ? (
        <EmptyState icon="account-cancel" text={`Sem exclusões registadas para ${anoLetivo}.`} />
      ) : (
        exclusoes.map(e => (
          <View key={e.id} style={[styles.card, e.status === 'anulado' && styles.cardMuted]}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle}>{e.alunoNomeCompleto || e.alunoId}</Text>
                <Text style={styles.cardSub}>{e.disciplina} · {e.turmaNome}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (e.status === 'ativo' ? Colors.danger : Colors.success) + '25' }]}>
                <Text style={[styles.badgeText, { color: e.status === 'ativo' ? Colors.danger : Colors.success }]}>
                  {e.status === 'ativo' ? 'Activo' : 'Anulado'}
                </Text>
              </View>
            </View>
            <View style={styles.cardDetail}>
              <MaterialCommunityIcons name="tag-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.cardDetailText}>{TIPO_LABELS[e.tipoExclusao] || e.tipoExclusao}</Text>
              <Text style={[styles.cardDetailText, { marginLeft: 12 }]}>
                {e.totalFaltasAcumuladas}/{e.limiteFaltas} faltas · {MESES[e.mes - 1]} {e.ano}
              </Text>
            </View>
            {e.motivo ? <Text style={styles.cardMeta}>Motivo: {e.motivo}</Text> : null}
            <Text style={styles.cardMeta}>
              {fmtDate(e.dataExclusao)} · {e.registadoPor}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Tab: Prova Justificada ───────────────────────────────────────────────────

function ProvaJustificadaTab({ solicitacoes, turmas, alunos, anoLetivo, userName, onAdd, onResposta, onRefresh }: {
  solicitacoes: SolicitacaoProva[]; turmas: Turma[]; alunos: Aluno[];
  anoLetivo: string; userName: string;
  onAdd: () => void; onResposta: (s: SolicitacaoProva) => void; onRefresh: () => void;
}) {
  const TIPO_LABELS: Record<string, string> = {
    teste: 'Teste', mini_teste: 'Mini-Teste', exame: 'Exame', trabalho: 'Trabalho',
  };

  return (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <MaterialCommunityIcons name="information-outline" size={18} color={Colors.info} />
        <Text style={styles.infoText}>
          Solicitações de prova justificada ocorrem durante o período de provas até ao início da 1ª semana do trimestre seguinte.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Provas Justificadas</Text>
          <Text style={styles.sectionSubtitle}>{solicitacoes.length} solicitação(ões)</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Solicitar</Text>
        </TouchableOpacity>
      </View>

      {solicitacoes.length === 0 ? (
        <EmptyState icon="file-document-edit" text="Sem solicitações de prova justificada." />
      ) : (
        solicitacoes.map(s => {
          const statusColor = STATUS_COLORS[s.status] || Colors.textSecondary;
          return (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>{s.alunoNomeCompleto || s.alunoId}</Text>
                  <Text style={styles.cardSub}>{s.disciplina} · {TIPO_LABELS[s.tipoProva] || s.tipoProva} · {s.turmaNome}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusColor + '25' }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {s.status === 'pendente' ? 'Pendente' : s.status === 'aprovada' ? 'Aprovada' :
                     s.status === 'rejeitada' ? 'Rejeitada' : 'Realizada'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDetail2}>
                Prova original: {fmtDate(s.dataProvaOriginal)}
                {s.dataProvaJustificada ? `  →  Data marcada: ${fmtDate(s.dataProvaJustificada)}` : ''}
              </Text>
              <Text style={styles.cardMeta}>Motivo: {s.motivo}</Text>
              {s.resposta ? <Text style={styles.cardMeta}>Resposta: {s.resposta}</Text> : null}
              <Text style={styles.cardMeta}>Solicitado por: {s.solicitadoPor} · {fmtDate(s.createdAt)}</Text>
              {s.status === 'pendente' && (
                <TouchableOpacity style={styles.respondBtn} onPress={() => onResposta(s)}>
                  <Text style={styles.respondBtnText}>Responder</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

// ─── Tab: Anulação de Matrícula ───────────────────────────────────────────────

function AnulacaoMatriculaTab({ anulacoes, turmas, alunos, anoLetivo, userName, onAdd, onRefresh }: {
  anulacoes: AnulacaoMatricula[]; turmas: Turma[]; alunos: Aluno[];
  anoLetivo: string; userName: string; onAdd: () => void; onRefresh: () => void;
}) {
  const MOTIVO_LABELS: Record<string, string> = {
    voluntaria: 'Voluntária', disciplinar: 'Disciplinar', financeira: 'Financeira',
    faltas: 'Excesso de Faltas', dupla_reprovacao: 'Dupla Reprovação', outro: 'Outro',
  };

  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Anulações de Matrícula</Text>
          <Text style={styles.sectionSubtitle}>{anulacoes.length} registo(s) — {anoLetivo}</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.danger }]} onPress={onAdd}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Anular</Text>
        </TouchableOpacity>
      </View>

      {anulacoes.length === 0 ? (
        <EmptyState icon="account-off" text={`Sem anulações de matrícula em ${anoLetivo}.`} />
      ) : (
        anulacoes.map(a => (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle}>{a.alunoNome}</Text>
                <Text style={styles.cardSub}>{a.turmaNome || '—'} · {anoLetivo}</Text>
              </View>
              <View style={[styles.badge, {
                backgroundColor: (a.status === 'ativa' ? Colors.danger : Colors.success) + '25'
              }]}>
                <Text style={[styles.badgeText, { color: a.status === 'ativa' ? Colors.danger : Colors.success }]}>
                  {a.status === 'ativa' ? 'Activa' : 'Revertida'}
                </Text>
              </View>
            </View>
            <View style={styles.cardDetail}>
              <MaterialCommunityIcons name="tag-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.cardDetailText}>{MOTIVO_LABELS[a.motivo] || a.motivo}</Text>
            </View>
            {a.descricao ? <Text style={styles.cardMeta}>{a.descricao}</Text> : null}
            <View style={styles.cardRow}>
              <Text style={styles.cardMeta}>{fmtDate(a.dataAnulacao)} · {a.registadoPor}</Text>
              {a.reAdmissaoPermitida && (
                <View style={[styles.badge, { backgroundColor: Colors.info + '20', marginLeft: 8 }]}>
                  <Text style={[styles.badgeText, { color: Colors.info }]}>Re-admissão permitida</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Responsive Modal Shell ───────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  return (
    <Modal visible animationType={isWide ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isWide && styles.overlayWide]}>
        <View style={[styles.modal, isWide && styles.modalWide]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon as any} size={48} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FaltaBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.faltaBox, { borderColor: color + '60' }]}>
      <Text style={[styles.faltaBoxValue, { color }]}>{value}</Text>
      <Text style={styles.faltaBoxLabel}>{label}</Text>
    </View>
  );
}

// ─── Modal: Config Falta ──────────────────────────────────────────────────────

function ConfigModal({ turmas, anoLetivo, userName, userId, onClose, onSaved }: {
  turmas: Turma[]; anoLetivo: string; userName: string; userId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [turmaId, setTurmaId] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [maxFaltas, setMaxFaltas] = useState('3');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!turmaId || !disciplina) return Alert.alert('Erro', 'Seleccione a turma e indique a disciplina.');
    setSaving(true);
    try {
      await api.post('/api/configuracoes-falta', {
        turmaId, disciplina, anoLetivo, maxFaltasMensais: parseInt(maxFaltas) || 3,
        definidoPor: userName, definidoPorId: userId,
      });
      onSaved();
    } catch (e) { Alert.alert('Erro', (e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title="Definir Limite de Faltas" onClose={onClose}>
      <ScrollView>
        <Text style={styles.label}>Turma *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {turmas.map(t => (
            <TouchableOpacity key={t.id} style={[styles.optChip, turmaId === t.id && styles.optChipActive]}
              onPress={() => setTurmaId(t.id)}>
              <Text style={[styles.optChipText, turmaId === t.id && { color: Colors.gold }]}>{t.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.label}>Disciplina * (use * para todas)</Text>
        <TextInput style={styles.input} value={disciplina} onChangeText={setDisciplina}
          placeholder="Ex: Matemática ou *" placeholderTextColor={Colors.textMuted} />
        <Text style={styles.label}>Máx. faltas por mês *</Text>
        <TextInput style={styles.input} value={maxFaltas} onChangeText={setMaxFaltas}
          keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
        </TouchableOpacity>
      </ScrollView>
    </ModalShell>
  );
}

// ─── Modal: Registo Mensal ────────────────────────────────────────────────────

function RegistoMensalModal({ turmas, alunos, configs, mes, ano, trimestre, userName, userId, anoLetivo, onClose, onSaved }: {
  turmas: Turma[]; alunos: Aluno[]; configs: ConfigFalta[];
  mes: number; ano: number; trimestre: number; userName: string; userId: string; anoLetivo: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [totalFaltas, setTotalFaltas] = useState('0');
  const [faltasJust, setFaltasJust] = useState('0');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  const turmaAlunos = useMemo(() => alunos.filter(a => a.turmaId === turmaId), [alunos, turmaId]);
  const faltasInjust = Math.max(0, parseInt(totalFaltas) - parseInt(faltasJust));

  const configTurma = configs.find(c => c.turmaId === turmaId && (c.disciplina === disciplina || c.disciplina === '*'));
  const maxFaltas = configTurma?.maxFaltasMensais ?? 3;
  const status = parseInt(totalFaltas) === 0 ? 'normal' :
    parseInt(totalFaltas) >= maxFaltas ? 'excluido' :
    parseInt(totalFaltas) >= maxFaltas - 1 ? 'em_risco' : 'normal';

  const save = async () => {
    if (!turmaId || !alunoId || !disciplina) return Alert.alert('Erro', 'Preencha todos os campos obrigatórios.');
    setSaving(true);
    try {
      await api.post('/api/registos-falta-mensal', {
        alunoId, turmaId, disciplina, mes, ano, trimestre, anoLetivo,
        totalFaltas: parseInt(totalFaltas) || 0,
        faltasJustificadas: parseInt(faltasJust) || 0,
        faltasInjustificadas: faltasInjust,
        status, observacao, registadoPor: userName, registadoPorId: userId,
        dataRegisto: today(),
      });
      onSaved();
    } catch (e) { Alert.alert('Erro', (e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Levantamento Mensal de Faltas</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.label}>Turma *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {turmas.map(t => (
                <TouchableOpacity key={t.id} style={[styles.optChip, turmaId === t.id && styles.optChipActive]}
                  onPress={() => setTurmaId(t.id)}>
                  <Text style={[styles.optChipText, turmaId === t.id && { color: Colors.gold }]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {turmaId && <>
              <Text style={styles.label}>Aluno *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {turmaAlunos.map(a => (
                  <TouchableOpacity key={a.id} style={[styles.optChip, alunoId === a.id && styles.optChipActive]}
                    onPress={() => setAlunoId(a.id)}>
                    <Text style={[styles.optChipText, alunoId === a.id && { color: Colors.gold }]}>{a.nome} {a.apelido}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>}
            <Text style={styles.label}>Disciplina *</Text>
            <TextInput style={styles.input} value={disciplina} onChangeText={setDisciplina}
              placeholder="Ex: Matemática" placeholderTextColor={Colors.textMuted} />

            {configTurma && (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>Limite: {maxFaltas} falta(s)/mês · Status actual: <Text style={{ color: STATUS_COLORS[status], fontWeight: '700' }}>{status}</Text></Text>
              </View>
            )}

            <Text style={styles.label}>Total de Faltas</Text>
            <TextInput style={styles.input} value={totalFaltas} onChangeText={setTotalFaltas}
              keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Faltas Justificadas</Text>
            <TextInput style={styles.input} value={faltasJust} onChangeText={setFaltasJust}
              keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.infoText}>Faltas Injustificadas: {faltasInjust}</Text>
            <Text style={styles.label}>Observação</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={observacao} onChangeText={setObservacao}
              multiline placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal: Exclusão por Falta ────────────────────────────────────────────────

function ExclusaoModal({ turmas, alunos, anoLetivo, mes, ano, trimestre, userName, userId, onClose, onSaved }: {
  turmas: Turma[]; alunos: Aluno[]; anoLetivo: string;
  mes: number; ano: number; trimestre: number; userName: string; userId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [totalFaltas, setTotalFaltas] = useState('');
  const [limiteFaltas, setLimiteFaltas] = useState('3');
  const [tipoExclusao, setTipoExclusao] = useState('exclusao_disciplina');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const turmaAlunos = useMemo(() => alunos.filter(a => a.turmaId === turmaId), [alunos, turmaId]);

  const TIPOS = [
    { key: 'exclusao_disciplina', label: 'Exclusão por Falta' },
    { key: 'anulacao_matricula', label: 'Anulação de Matrícula' },
    { key: 'dupla_reprovacao', label: 'Dupla Reprovação' },
  ];

  const save = async () => {
    if (!turmaId || !alunoId || !disciplina) return Alert.alert('Erro', 'Preencha todos os campos obrigatórios.');
    setSaving(true);
    try {
      await api.post('/api/exclusoes-falta', {
        alunoId, turmaId, disciplina, anoLetivo, trimestre, mes, ano,
        totalFaltasAcumuladas: parseInt(totalFaltas) || 0,
        limiteFaltas: parseInt(limiteFaltas) || 3,
        tipoExclusao, motivo, registadoPor: userName, registadoPorId: userId,
        dataExclusao: today(),
      });
      onSaved();
    } catch (e) { Alert.alert('Erro', (e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Registar Exclusão</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.label}>Tipo de Exclusão *</Text>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.key} style={[styles.optRow, tipoExclusao === t.key && styles.optRowActive]}
                onPress={() => setTipoExclusao(t.key)}>
                <MaterialCommunityIcons name={tipoExclusao === t.key ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={tipoExclusao === t.key ? Colors.gold : Colors.textSecondary} />
                <Text style={[styles.optRowText, tipoExclusao === t.key && { color: Colors.text }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>Turma *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {turmas.map(t => (
                <TouchableOpacity key={t.id} style={[styles.optChip, turmaId === t.id && styles.optChipActive]}
                  onPress={() => setTurmaId(t.id)}>
                  <Text style={[styles.optChipText, turmaId === t.id && { color: Colors.gold }]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {turmaId && <>
              <Text style={styles.label}>Aluno *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {turmaAlunos.map(a => (
                  <TouchableOpacity key={a.id} style={[styles.optChip, alunoId === a.id && styles.optChipActive]}
                    onPress={() => setAlunoId(a.id)}>
                    <Text style={[styles.optChipText, alunoId === a.id && { color: Colors.gold }]}>{a.nome} {a.apelido}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>}
            <Text style={styles.label}>Disciplina *</Text>
            <TextInput style={styles.input} value={disciplina} onChangeText={setDisciplina}
              placeholder="Ex: Matemática" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Total de Faltas Acumuladas</Text>
            <TextInput style={styles.input} value={totalFaltas} onChangeText={setTotalFaltas}
              keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Limite de Faltas</Text>
            <TextInput style={styles.input} value={limiteFaltas} onChangeText={setLimiteFaltas}
              keyboardType="number-pad" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Motivo / Observação</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={motivo} onChangeText={setMotivo}
              multiline placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.danger }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Registar Exclusão</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal: Prova Justificada ─────────────────────────────────────────────────

function ProvaJustificadaModal({ turmas, alunos, anoLetivo, trimestre, userName, userId, onClose, onSaved }: {
  turmas: Turma[]; alunos: Aluno[]; anoLetivo: string; trimestre: number;
  userName: string; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [tipoProva, setTipoProva] = useState('teste');
  const [dataProvaOriginal, setDataProvaOriginal] = useState(today());
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const turmaAlunos = useMemo(() => alunos.filter(a => a.turmaId === turmaId), [alunos, turmaId]);

  const save = async () => {
    if (!turmaId || !alunoId || !disciplina || !motivo) return Alert.alert('Erro', 'Preencha todos os campos.');
    setSaving(true);
    try {
      await api.post('/api/solicitacoes-prova-justificada', {
        alunoId, turmaId, disciplina, anoLetivo, trimestre, tipoProva,
        dataProvaOriginal, motivo, solicitadoPor: userName, solicitadoPorId: userId,
      });
      onSaved();
    } catch (e) { Alert.alert('Erro', (e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Solicitar Prova Justificada</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.label}>Tipo de Prova *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {TIPOS_PROVA.map(t => (
                <TouchableOpacity key={t} style={[styles.optChip, tipoProva === t && styles.optChipActive]}
                  onPress={() => setTipoProva(t)}>
                  <Text style={[styles.optChipText, tipoProva === t && { color: Colors.gold }]}>
                    {t === 'mini_teste' ? 'Mini-Teste' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Turma *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {turmas.map(t => (
                <TouchableOpacity key={t.id} style={[styles.optChip, turmaId === t.id && styles.optChipActive]}
                  onPress={() => setTurmaId(t.id)}>
                  <Text style={[styles.optChipText, turmaId === t.id && { color: Colors.gold }]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {turmaId && <>
              <Text style={styles.label}>Aluno *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {turmaAlunos.map(a => (
                  <TouchableOpacity key={a.id} style={[styles.optChip, alunoId === a.id && styles.optChipActive]}
                    onPress={() => setAlunoId(a.id)}>
                    <Text style={[styles.optChipText, alunoId === a.id && { color: Colors.gold }]}>{a.nome} {a.apelido}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>}
            <Text style={styles.label}>Disciplina *</Text>
            <TextInput style={styles.input} value={disciplina} onChangeText={setDisciplina}
              placeholder="Ex: Física" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Data da Prova Original *</Text>
            <TextInput style={styles.input} value={dataProvaOriginal} onChangeText={setDataProvaOriginal}
              placeholder="AAAA-MM-DD" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Motivo / Justificação *</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={motivo} onChangeText={setMotivo}
              multiline placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Submeter Solicitação</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal: Resposta a Prova Justificada ──────────────────────────────────────

function RespostaProvaModal({ solicitacao, userName, onClose, onSaved }: {
  solicitacao: SolicitacaoProva; userName: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState<'aprovada' | 'rejeitada'>('aprovada');
  const [resposta, setResposta] = useState('');
  const [dataProvaJustificada, setDataProvaJustificada] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/solicitacoes-prova-justificada/${solicitacao.id}`, {
        status, resposta, respondidoPor: userName,
        respondidoEm: today(), dataProvaJustificada: dataProvaJustificada || null,
      });
      onSaved();
    } catch (e) { Alert.alert('Erro', (e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Responder Solicitação</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={styles.infoCard}>
              <Text style={[styles.infoText, { fontWeight: '700' }]}>{solicitacao.alunoNomeCompleto}</Text>
              <Text style={styles.infoText}>{solicitacao.disciplina} · {solicitacao.tipoProva}</Text>
              <Text style={styles.infoText}>Data original: {fmtDate(solicitacao.dataProvaOriginal)}</Text>
              <Text style={styles.infoText}>Motivo: {solicitacao.motivo}</Text>
            </View>
            <Text style={styles.label}>Decisão *</Text>
            <View style={styles.decisionRow}>
              {(['aprovada', 'rejeitada'] as const).map(s => (
                <TouchableOpacity key={s} style={[styles.decisionBtn,
                  status === s && { backgroundColor: s === 'aprovada' ? Colors.success : Colors.danger }]}
                  onPress={() => setStatus(s)}>
                  <Text style={styles.decisionBtnText}>{s === 'aprovada' ? '✓ Aprovar' : '✗ Rejeitar'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {status === 'aprovada' && <>
              <Text style={styles.label}>Data da Prova Justificada</Text>
              <TextInput style={styles.input} value={dataProvaJustificada} onChangeText={setDataProvaJustificada}
                placeholder="AAAA-MM-DD" placeholderTextColor={Colors.textMuted} />
            </>}
            <Text style={styles.label}>Resposta / Observação</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={resposta} onChangeText={setResposta}
              multiline placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: status === 'aprovada' ? Colors.success : Colors.danger }]}
              onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirmar</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal: Anulação de Matrícula ─────────────────────────────────────────────

function AnulacaoModal({ turmas, alunos, anoLetivo, userName, userId, onClose, onSaved }: {
  turmas: Turma[]; alunos: Aluno[]; anoLetivo: string;
  userName: string; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [motivo, setMotivo] = useState('voluntaria');
  const [descricao, setDescricao] = useState('');
  const [dataAnulacao, setDataAnulacao] = useState(today());
  const [reAdmissaoPermitida, setReAdmissaoPermitida] = useState(false);
  const [saving, setSaving] = useState(false);

  const turmaAlunos = useMemo(() => alunos.filter(a => a.turmaId === turmaId), [alunos, turmaId]);
  const alunoSel = alunos.find(a => a.id === alunoId);
  const turmaSel = turmas.find(t => t.id === turmaId);

  const MOTIVOS_LABEL: Record<string, string> = {
    voluntaria: 'Voluntária', disciplinar: 'Disciplinar', financeira: 'Financeira',
    faltas: 'Excesso de Faltas', dupla_reprovacao: 'Dupla Reprovação', outro: 'Outro',
  };

  const save = async () => {
    if (!alunoId || !turmaId || !motivo) return Alert.alert('Erro', 'Preencha todos os campos obrigatórios.');
    const conf = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Confirmar Anulação',
        `Tem a certeza que deseja anular a matrícula de ${alunoSel?.nome} ${alunoSel?.apelido}? O aluno será marcado como inactivo.`,
        [{ text: 'Cancelar', onPress: () => resolve(false) }, { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) }]
      );
    });
    if (!conf) return;
    setSaving(true);
    try {
      await api.post('/api/anulacoes-matricula', {
        alunoId, alunoNome: `${alunoSel?.nome} ${alunoSel?.apelido}`,
        turmaId, turmaNome: turmaSel?.nome || '', anoLetivo, motivo, descricao,
        dataAnulacao, registadoPor: userName, registadoPorId: userId, reAdmissaoPermitida,
      });
      onSaved();
    } catch (e) { Alert.alert('Erro', (e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Anulação de Matrícula</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={[styles.infoCard, { borderLeftColor: Colors.danger }]}>
              <MaterialCommunityIcons name="alert" size={16} color={Colors.danger} />
              <Text style={[styles.infoText, { color: Colors.danger }]}>Esta acção marca o aluno como inactivo no sistema.</Text>
            </View>
            <Text style={styles.label}>Motivo *</Text>
            {MOTIVOS_ANULACAO.map(m => (
              <TouchableOpacity key={m} style={[styles.optRow, motivo === m && styles.optRowActive]}
                onPress={() => setMotivo(m)}>
                <MaterialCommunityIcons name={motivo === m ? 'radiobox-marked' : 'radiobox-blank'} size={18}
                  color={motivo === m ? Colors.gold : Colors.textSecondary} />
                <Text style={[styles.optRowText, motivo === m && { color: Colors.text }]}>{MOTIVOS_LABEL[m]}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>Turma *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {turmas.map(t => (
                <TouchableOpacity key={t.id} style={[styles.optChip, turmaId === t.id && styles.optChipActive]}
                  onPress={() => setTurmaId(t.id)}>
                  <Text style={[styles.optChipText, turmaId === t.id && { color: Colors.gold }]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {turmaId && <>
              <Text style={styles.label}>Aluno *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {turmaAlunos.map(a => (
                  <TouchableOpacity key={a.id} style={[styles.optChip, alunoId === a.id && styles.optChipActive]}
                    onPress={() => setAlunoId(a.id)}>
                    <Text style={[styles.optChipText, alunoId === a.id && { color: Colors.gold }]}>{a.nome} {a.apelido}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>}
            <Text style={styles.label}>Data de Anulação *</Text>
            <TextInput style={styles.input} value={dataAnulacao} onChangeText={setDataAnulacao}
              placeholder="AAAA-MM-DD" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Descrição / Observações</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={descricao} onChangeText={setDescricao}
              multiline placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.toggleRow} onPress={() => setReAdmissaoPermitida(!reAdmissaoPermitida)}>
              <MaterialCommunityIcons
                name={reAdmissaoPermitida ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22} color={reAdmissaoPermitida ? Colors.success : Colors.textSecondary}
              />
              <Text style={styles.toggleText}>Permitir re-admissão futura</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.danger }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirmar Anulação</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: { maxHeight: 52, backgroundColor: Colors.backgroundCard },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 12, color: Colors.textSecondary },
  tabTextActive: { color: Colors.gold, fontWeight: '600' },

  filterBar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginRight: 6 },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.gold },
  filterChipText: { fontSize: 12, color: Colors.textSecondary },

  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabContent: { padding: 16, gap: 12 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  card: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: Colors.border },
  cardMuted: { opacity: 0.55 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardDetail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardDetailText: { fontSize: 12, color: Colors.textSecondary },
  cardDetail2: { fontSize: 12, color: Colors.textSecondary },
  cardMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  faltaRow: { flexDirection: 'row', gap: 8 },
  faltaBox: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  faltaBoxValue: { fontSize: 18, fontWeight: '800' },
  faltaBoxLabel: { fontSize: 10, color: Colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 10, padding: 12, alignItems: 'center', gap: 4, borderLeftWidth: 3 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textSecondary },

  monthFilter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  filterLabel: { fontSize: 12, color: Colors.textSecondary, minWidth: 60 },
  filterChipSm: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginRight: 4 },
  filterChipSmActive: { backgroundColor: Colors.primary, borderColor: Colors.gold },
  filterChipSmText: { fontSize: 11, color: Colors.textSecondary },

  infoCard: { backgroundColor: Colors.info + '15', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderLeftWidth: 3, borderLeftColor: Colors.info },
  infoText: { fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  respondBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 7, alignItems: 'center', marginTop: 4 },
  respondBtnText: { color: Colors.gold, fontWeight: '700', fontSize: 13 },

  empty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  label: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  optChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginRight: 6, marginBottom: 4 },
  optChipActive: { backgroundColor: Colors.primary, borderColor: Colors.gold },
  optChipText: { fontSize: 12, color: Colors.textSecondary },

  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  optRowActive: {},
  optRowText: { fontSize: 14, color: Colors.textSecondary },

  decisionRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  decisionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.backgroundElevated },
  decisionBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  toggleText: { fontSize: 14, color: Colors.text },
});
