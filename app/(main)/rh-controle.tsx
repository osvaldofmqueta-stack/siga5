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
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useNotificacoes, timeAgo } from '@/context/NotificacoesContext';
import { webAlert } from '@/utils/webAlert';
import {
  DEPARTAMENTOS,
  CARGOS,
  CARGOS_POR_DEPARTAMENTO,
  DepartamentoKey,
  CargoInfo,
  getCargoById,
  getDepartamentoByKey,
} from '@/shared/departamentos';
import { api } from '@/lib/api';
import { consultarNIF } from '@/lib/nifLookup';
import DatePickerField from '@/components/DatePickerField';
import DateInput from '@/components/DateInput';

type Tab = 'pessoal' | 'sumarios' | 'solicitacoes' | 'calendario';
type SumFiltro = 'todos' | 'pendente' | 'aceite' | 'rejeitado';

interface SubsidioItem {
  id: string;
  nome: string;
  percentagem: number;
}

interface Funcionario {
  id: string;
  nome: string;
  apelido: string;
  dataNascimento: string;
  genero: string;
  bi: string;
  nif: string;
  telefone: string;
  email: string;
  foto?: string;
  provincia: string;
  municipio: string;
  morada: string;
  departamento: DepartamentoKey;
  seccao: string;
  cargo: string;
  especialidade: string;
  tipoContrato: string;
  dataContratacao: string;
  dataFimContrato?: string;
  habilitacoes: string;
  salarioBase: number;
  subsidioAlimentacao: number;
  subsidioTransporte: number;
  subsidioHabitacao: number;
  outrosSubsidios: number;
  subsidios?: SubsidioItem[];
  utilizadorId?: string;
  professorId?: string;
  ativo: boolean;
  observacoes: string;
  createdAt: string;
}

const TIPO_CONTRATO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'contratado', label: 'Contratado' },
  { id: 'prestacao_servicos', label: 'Prestação de Serviços' },
  { id: 'temporario', label: 'Temporário' },
  { id: 'bolseiro', label: 'Bolseiro' },
];

const GENERO = [
  { id: 'M', label: 'Masculino' },
  { id: 'F', label: 'Feminino' },
];

const DEPT_COLORS: Record<DepartamentoKey, string> = {
  direcao: '#6C5CE7',
  pedagogico: '#0984E3',
  administrativo: '#00B894',
  financeiro: '#FDCB6E',
  rh: '#E17055',
  biblioteca: '#A29BFE',
  servicos_gerais: '#74B9FF',
};

const DEPT_ICONS: Record<DepartamentoKey, string> = {
  direcao: 'shield-star',
  pedagogico: 'school',
  administrativo: 'briefcase',
  financeiro: 'cash-multiple',
  rh: 'account-group',
  biblioteca: 'bookshelf',
  servicos_gerais: 'tools',
};

function emptyFuncionario(): Partial<Funcionario> {
  return {
    nome: '', apelido: '', dataNascimento: '', genero: 'M',
    bi: '', nif: '', telefone: '', email: '',
    provincia: 'Luanda', municipio: '', morada: '',
    departamento: 'pedagogico', seccao: '', cargo: 'professor_i_ciclo',
    especialidade: '', tipoContrato: 'efectivo',
    dataContratacao: '', dataFimContrato: '',
    habilitacoes: '', salarioBase: 0,
    subsidioAlimentacao: 0, subsidioTransporte: 0,
    subsidioHabitacao: 0, outrosSubsidios: 0,
    ativo: true, observacoes: '',
  };
}

export default function RHControleScreen() {
  const { user } = useAuth();
  const { professores, turmas } = useData();
  const {
    sumarios, updateSumario,
    solicitacoes, updateSolicitacao, updatePauta,
    pautas, calendarioProvas, addCalendarioProva, updateCalendarioProva, deleteCalendarioProva,
  } = useProfessor();
  const { addNotificacao } = useNotificacoes();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>('pessoal');
  const [filtro, setFiltro] = useState<SumFiltro>('pendente');
  const [selectedSumario, setSelectedSumario] = useState<string | null>(null);
  const [selectedSolicitude, setSelectedSolicitude] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');

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

  // ── Pessoal ──────────────────────────────────────────────────────────────
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcLoading, setFuncLoading] = useState(false);
  const [funcRefreshing, setFuncRefreshing] = useState(false);
  const [deptFiltro, setDeptFiltro] = useState<DepartamentoKey | 'todos'>('todos');
  const [funcSearch, setFuncSearch] = useState('');
  const [showFuncForm, setShowFuncForm] = useState(false);
  const [editingFunc, setEditingFunc] = useState<Funcionario | null>(null);
  const [funcForm, setFuncForm] = useState<Partial<Funcionario>>(emptyFuncionario());
  const [funcSaving, setFuncSaving] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFunc, setSelectedFunc] = useState<Funcionario | null>(null);
  const [showAcessoModal, setShowAcessoModal] = useState(false);
  const [acessoEmail, setAcessoEmail] = useState('');
  const [acessoSenha, setAcessoSenha] = useState('');
  const [acessoSaving, setAcessoSaving] = useState(false);
  const [formStep, setFormStep] = useState<'pessoal' | 'organizacao' | 'contrato' | 'salarial'>('pessoal');
  const [funcFormErrors, setFuncFormErrors] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [subsidiosCustom, setSubsidiosCustom] = useState<SubsidioItem[]>([]);
  const [nifLookupLoading, setNifLookupLoading] = useState(false);
  const [nifLookupStatus, setNifLookupStatus] = useState<'idle' | 'found' | 'not_found' | 'error'>('idle');
  const [nifFoundName, setNifFoundName] = useState('');

  const isRH = ['rh', 'admin', 'director', 'ceo', 'pca', 'chefe_secretaria'].includes(user?.role ?? '');

  // Load funcionarios
  const loadFuncionarios = useCallback(async (refresh = false) => {
    if (refresh) setFuncRefreshing(true);
    else setFuncLoading(true);
    try {
      const data = await api.get('/api/funcionarios');
      setFuncionarios(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally {
      setFuncLoading(false);
      setFuncRefreshing(false);
    }
  }, []);

  useEffect(() => { if (tab === 'pessoal') loadFuncionarios(); }, [tab]);

  // Filtered funcionarios
  const funcFiltrados = useMemo(() => {
    return funcionarios.filter(f => {
      if (deptFiltro !== 'todos' && f.departamento !== deptFiltro) return false;
      if (funcSearch) {
        const q = funcSearch.toLowerCase();
        const nome = `${f.nome} ${f.apelido}`.toLowerCase();
        if (!nome.includes(q) && !f.bi.toLowerCase().includes(q) && !f.cargo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [funcionarios, deptFiltro, funcSearch]);

  // Grouped by department
  const funcPorDepto = useMemo(() => {
    const groups: Record<string, Funcionario[]> = {};
    for (const f of funcFiltrados) {
      if (!groups[f.departamento]) groups[f.departamento] = [];
      groups[f.departamento].push(f);
    }
    return groups;
  }, [funcFiltrados]);

  function updateField(key: keyof Funcionario, value: any) {
    setFuncForm(prev => ({ ...prev, [key]: value }));
    if (key === 'departamento') {
      const firstCargo = CARGOS_POR_DEPARTAMENTO[value as DepartamentoKey]?.[0];
      if (firstCargo) setFuncForm(prev => ({ ...prev, [key]: value, cargo: firstCargo.id }));
    }
    if (key === 'nif') {
      setNifLookupStatus('idle');
      setNifFoundName('');
    }
  }

  async function lookupNIFFuncionario(nif: string) {
    if (!nif?.trim() || nif.trim().length < 9) return;
    setNifLookupLoading(true);
    setNifLookupStatus('idle');
    setNifFoundName('');
    try {
      const data = await consultarNIF(nif);
      if (data) {
        const parts = data.nome.trim().split(/\s+/);
        const nome = parts[0] || '';
        const apelido = parts.slice(1).join(' ') || '';
        setFuncForm(prev => ({ ...prev, nome, apelido }));
        setNifFoundName(data.nome);
        setNifLookupStatus('found');
      } else {
        setNifLookupStatus('not_found');
      }
    } catch {
      setNifLookupStatus('error');
    } finally {
      setNifLookupLoading(false);
    }
  }

  function validarNIForBI(v: string): boolean {
    return /^\d{9}[A-Z]{2}\d{3}$/.test(v.trim().toUpperCase());
  }

  const FUNC_STEPS = ['pessoal', 'organizacao', 'contrato', 'salarial'] as const;

  function validateFuncStep(step: typeof formStep): boolean {
    const erros: Record<string, string> = {};

    if (step === 'pessoal') {
      if (!funcForm.nome?.trim()) erros.nome = 'O nome é obrigatório.';
      if (funcForm.bi?.trim() && !validarNIForBI(funcForm.bi)) erros.bi = 'BI inválido. Formato: 9 dígitos + 2 letras + 3 dígitos (ex: 000000000LA000).';
      if (funcForm.nif?.trim() && !validarNIForBI(funcForm.nif)) erros.nif = 'NIF inválido. Formato: 9 dígitos + 2 letras + 3 dígitos (ex: 003519344HA042).';
    } else if (step === 'organizacao') {
      if (!funcForm.departamento) erros.departamento = 'Seleccione o departamento.';
      if (!funcForm.cargo) erros.cargo = 'Seleccione o cargo.';
    } else if (step === 'contrato') {
      if (!funcForm.tipoContrato) erros.tipoContrato = 'Seleccione o tipo de vínculo.';
    }

    setFuncFormErrors(erros);
    const valid = Object.keys(erros).length === 0;
    if (valid) setCompletedSteps(prev => new Set([...prev, step]));
    return valid;
  }

  function handleFuncNext() {
    if (validateFuncStep(formStep)) {
      const idx = FUNC_STEPS.indexOf(formStep);
      setFormStep(FUNC_STEPS[Math.min(FUNC_STEPS.length - 1, idx + 1)]);
      setFuncFormErrors({});
    }
  }

  function handleStepTabClick(stepId: typeof formStep) {
    const targetIdx = FUNC_STEPS.indexOf(stepId);
    const currentIdx = FUNC_STEPS.indexOf(formStep);
    if (targetIdx === currentIdx) return;
    if (targetIdx < currentIdx) {
      setFormStep(stepId);
      setFuncFormErrors({});
    }
    // Forward navigation is blocked — use the "Próximo" button to advance
  }

  async function saveFuncionario() {
    if (!funcForm.nome?.trim() || !funcForm.departamento || !funcForm.cargo) {
      webAlert('Campos obrigatórios', 'Preencha o nome, departamento e cargo.');
      return;
    }
    if (funcForm.bi?.trim() && !validarNIForBI(funcForm.bi)) {
      webAlert('BI inválido', 'O Bilhete de Identidade deve ter o formato: 9 dígitos + 2 letras + 3 dígitos (ex: 000000000LA000).');
      return;
    }
    if (funcForm.nif?.trim() && !validarNIForBI(funcForm.nif)) {
      webAlert('NIF inválido', 'O NIF deve ter o formato: 9 dígitos + 2 letras + 3 dígitos (ex: 003519344HA042).');
      return;
    }
    setFuncSaving(true);
    try {
      const salBase = funcForm.salarioBase ?? 0;
      const totalSubsidios = subsidiosCustom.reduce((sum, s) => sum + (salBase * s.percentagem / 100), 0);
      const payload = {
        ...funcForm,
        subsidioAlimentacao: 0,
        subsidioTransporte: 0,
        subsidioHabitacao: 0,
        outrosSubsidios: Math.round(totalSubsidios),
        subsidios: subsidiosCustom,
      };
      if (editingFunc) {
        await api.put(`/api/funcionarios/${editingFunc.id}`, payload);
      } else {
        await api.post('/api/funcionarios', payload);
      }
      setShowFuncForm(false);
      setEditingFunc(null);
      setFuncForm(emptyFuncionario());
      setSubsidiosCustom([]);
      setFormStep('pessoal');
      await loadFuncionarios();
    } catch (e: any) {
      webAlert('Erro', e.message || 'Erro ao guardar funcionário.');
    } finally {
      setFuncSaving(false);
    }
  }

  async function deleteFuncionario(id: string) {
    webAlert('Confirmar', 'Eliminar este funcionário do registo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await api.delete(`/api/funcionarios/${id}`);
          setShowDetailModal(false);
          setSelectedFunc(null);
          await loadFuncionarios();
        }
      }
    ]);
  }

  async function criarAcesso() {
    if (!selectedFunc) return;
    if (!acessoEmail.trim() || !acessoSenha.trim()) {
      webAlert('Campos obrigatórios', 'Preencha o email e a senha de acesso.');
      return;
    }
    setAcessoSaving(true);
    try {
      const cargo = getCargoById(selectedFunc.cargo);
      await api.post(`/api/funcionarios/${selectedFunc.id}/criar-acesso`, {
        email: acessoEmail,
        senha: acessoSenha,
        role: cargo?.role || 'secretaria',
      });
      webAlert('Sucesso', 'Acesso ao sistema criado com sucesso.');
      setShowAcessoModal(false);
      setAcessoEmail('');
      setAcessoSenha('');
      await loadFuncionarios();
    } catch (e: any) {
      webAlert('Erro', e.message || 'Erro ao criar acesso.');
    } finally {
      setAcessoSaving(false);
    }
  }

  // ── Sumários ──────────────────────────────────────────────────────────────
  const sumariosOrdenados = useMemo(() =>
    [...sumarios]
      .filter(s => filtro === 'todos' || s.status === filtro)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sumarios, filtro]);

  const solicitacoesPendentes = useMemo(() =>
    solicitacoes.filter(s => s.status === 'pendente')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [solicitacoes]);

  const sumarioSelecionado = sumarios.find(s => s.id === selectedSumario);
  const solicitSelecionada = solicitacoes.find(s => s.id === selectedSolicitude);

  async function aceitarSumario() {
    if (!sumarioSelecionado) return;
    await updateSumario(sumarioSelecionado.id, { status: 'aceite', observacaoRH: observacao || undefined });
    setSelectedSumario(null);
    setObservacao('');
  }

  async function rejeitarSumario() {
    if (!sumarioSelecionado) return;
    if (!observacao.trim()) { webAlert('Obrigatório', 'Indique o motivo da rejeição.'); return; }
    await updateSumario(sumarioSelecionado.id, { status: 'rejeitado', observacaoRH: observacao });
    setSelectedSumario(null);
    setObservacao('');
  }

  async function aprovarSolicitacao() {
    if (!solicitSelecionada) return;
    await updateSolicitacao(solicitSelecionada.id, { status: 'aprovada', respondidoEm: new Date().toISOString(), observacao });
    await updatePauta(solicitSelecionada.pautaId, { status: 'aberta' });
    setSelectedSolicitude(null);
    setObservacao('');
  }

  async function rejeitarSolicitacao() {
    if (!solicitSelecionada) return;
    await updateSolicitacao(solicitSelecionada.id, { status: 'rejeitada', respondidoEm: new Date().toISOString(), observacao });
    setSelectedSolicitude(null);
    setObservacao('');
  }

  // ── Calendário ───────────────────────────────────────────────────────────
  function resetProvaForm() {
    setProvaTitulo(''); setProvaDesc(''); setProvaDisciplina('');
    setProvaData(''); setProvaHora(''); setProvaTurmasIds([]);
    setEditingProva(null);
  }

  async function publicarProva() {
    if (!provaTitulo || !provaData || !provaDisciplina) return;
    if (editingProva) {
      await updateCalendarioProva(editingProva, { titulo: provaTitulo, descricao: provaDesc, disciplina: provaDisciplina, data: provaData, hora: provaHora, tipo: provaTipo, turmasIds: provaTurmasIds, publicado: true });
    } else {
      await addCalendarioProva({ titulo: provaTitulo, descricao: provaDesc, disciplina: provaDisciplina, data: provaData, hora: provaHora, tipo: provaTipo, turmasIds: provaTurmasIds, publicado: false });
    }
    setShowProvaForm(false);
    resetProvaForm();
  }

  async function publicarToggle(id: string, publicado: boolean) {
    await updateCalendarioProva(id, { publicado });
  }

  if (!isRH) {
    return (
      <View style={styles.container}>
        <TopBar title="Controlo RH" subtitle="Acesso restrito" />
        <View style={styles.empty}>
          <Ionicons name="lock-closed" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Acesso Restrito</Text>
          <Text style={styles.emptySub}>Esta área é exclusiva para o departamento de RH e Direcção.</Text>
        </View>
      </View>
    );
  }

  const tipoProvaColor: Record<string, string> = { teste: Colors.info, exame: Colors.danger, trabalho: Colors.gold, prova_oral: Colors.success };

  const cargosForForm = funcForm.departamento
    ? (CARGOS_POR_DEPARTAMENTO[funcForm.departamento as DepartamentoKey] || [])
    : [];

  return (
    <View style={styles.container}>
      <TopBar title="Controlo RH" subtitle="Pessoal, sumários e calendário" />

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.gold }]}>{funcionarios.filter(f => f.ativo).length}</Text>
          <Text style={styles.statLabel}>Funcionários</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.warning }]}>{sumarios.filter(s => s.status === 'pendente').length}</Text>
          <Text style={styles.statLabel}>Sumários</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.accent }]}>{solicitacoesPendentes.length}</Text>
          <Text style={styles.statLabel}>Solicitações</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.info }]}>{calendarioProvas.filter(p => p.publicado).length}</Text>
          <Text style={styles.statLabel}>Provas</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabRow}>
          {([
            { id: 'pessoal', label: 'Pessoal', icon: 'people' },
            { id: 'sumarios', label: `Sumários (${sumarios.filter(s => s.status === 'pendente').length})`, icon: 'document-text' },
            { id: 'solicitacoes', label: `Solicitações (${solicitacoesPendentes.length})`, icon: 'mail' },
            { id: 'calendario', label: 'Cal. Provas', icon: 'calendar' },
          ] as const).map(t => (
            <TouchableOpacity key={t.id} style={[styles.tab, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id as Tab)}>
              <Ionicons name={t.icon as any} size={14} color={tab === t.id ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── PESSOAL TAB ────────────────────────────────────────────────── */}
      {tab === 'pessoal' && (
        <View style={{ flex: 1 }}>
          {/* Search + Dept Filter */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Pesquisar funcionário..."
                placeholderTextColor={Colors.textMuted}
                value={funcSearch}
                onChangeText={setFuncSearch}
              />
              {funcSearch ? (
                <TouchableOpacity onPress={() => setFuncSearch('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Department pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deptScroll}>
            <View style={styles.deptRow}>
              <TouchableOpacity
                style={[styles.deptPill, deptFiltro === 'todos' && styles.deptPillActive]}
                onPress={() => setDeptFiltro('todos')}
              >
                <Text style={[styles.deptPillText, deptFiltro === 'todos' && styles.deptPillTextActive]}>
                  Todos ({funcionarios.filter(f => f.ativo).length})
                </Text>
              </TouchableOpacity>
              {DEPARTAMENTOS.map(d => {
                const count = funcionarios.filter(f => f.departamento === d.key && f.ativo).length;
                const color = DEPT_COLORS[d.key];
                const isActive = deptFiltro === d.key;
                return (
                  <TouchableOpacity
                    key={d.key}
                    style={[styles.deptPill, isActive && { backgroundColor: color + '22', borderColor: color + '66' }]}
                    onPress={() => setDeptFiltro(d.key)}
                  >
                    <MaterialCommunityIcons name={DEPT_ICONS[d.key] as any} size={13} color={isActive ? color : Colors.textMuted} />
                    <Text style={[styles.deptPillText, isActive && { color }]}>
                      {d.label.split(' ')[0]} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {funcLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={Colors.gold} />
            </View>
          ) : funcFiltrados.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-group" size={52} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum funcionário registado</Text>
              <Text style={styles.emptySub}>Clique no botão + para registar o primeiro funcionário</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 90 }}
              refreshControl={<RefreshControl refreshing={funcRefreshing} onRefresh={() => loadFuncionarios(true)} tintColor={Colors.gold} />}
            >
              {deptFiltro === 'todos' ? (
                // Grouped by department
                Object.entries(funcPorDepto).map(([deptKey, funcs]) => {
                  const dept = getDepartamentoByKey(deptKey as DepartamentoKey);
                  const color = DEPT_COLORS[deptKey as DepartamentoKey] || Colors.gold;
                  return (
                    <View key={deptKey} style={{ marginBottom: 20 }}>
                      <View style={styles.deptHeader}>
                        <View style={[styles.deptIconWrap, { backgroundColor: color + '22' }]}>
                          <MaterialCommunityIcons name={DEPT_ICONS[deptKey as DepartamentoKey] as any} size={16} color={color} />
                        </View>
                        <Text style={[styles.deptHeaderText, { color }]}>{dept?.label || deptKey}</Text>
                        <View style={[styles.deptCountBadge, { backgroundColor: color + '33' }]}>
                          <Text style={[styles.deptCountText, { color }]}>{funcs.length}</Text>
                        </View>
                      </View>
                      {funcs.map(f => <FuncCard key={f.id} f={f} onPress={() => { setSelectedFunc(f); setShowDetailModal(true); }} />)}
                    </View>
                  );
                })
              ) : (
                funcFiltrados.map(f => <FuncCard key={f.id} f={f} onPress={() => { setSelectedFunc(f); setShowDetailModal(true); }} />)
              )}
            </ScrollView>
          )}

          {/* FAB */}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => { setEditingFunc(null); setFuncForm(emptyFuncionario()); setSubsidiosCustom([]); setFormStep('pessoal'); setFuncFormErrors({}); setCompletedSteps(new Set()); setNifLookupStatus('idle'); setNifFoundName(''); setShowFuncForm(true); }}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── SUMÁRIOS TAB ────────────────────────────────────────────────── */}
      {tab === 'sumarios' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <View style={styles.filterInner}>
              {(['pendente', 'aceite', 'rejeitado', 'todos'] as const).map(f => (
                <TouchableOpacity key={f} style={[styles.filterBtn, filtro === f && styles.filterBtnActive]} onPress={() => setFiltro(f)}>
                  <Text style={[styles.filterText, filtro === f && styles.filterTextActive]}>
                    {f === 'pendente' ? 'Pendentes' : f === 'aceite' ? 'Aceites' : f === 'rejeitado' ? 'Rejeitados' : 'Todos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <FlatList
            data={sumariosOrdenados}
            keyExtractor={s => s.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Nenhum sumário</Text></View>}
            renderItem={({ item: s }) => {
              const sc = s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning;
              return (
                <TouchableOpacity style={[styles.card, { borderLeftColor: sc, borderLeftWidth: 3 }]} onPress={() => setSelectedSumario(s.id)} activeOpacity={0.8}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{s.professorNome}</Text>
                      <Text style={styles.cardSub}>{s.disciplina} · {s.turmaNome} · Aula {s.numeroAula}</Text>
                      <Text style={styles.cardDate}>{s.data} · {s.horaInicio}–{s.horaFim}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                      <Text style={[styles.statusText, { color: sc }]}>{s.status === 'aceite' ? 'Aceite' : s.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardConteudo} numberOfLines={2}>{s.conteudo}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {/* ── SOLICITAÇÕES TAB ─────────────────────────────────────────────── */}
      {tab === 'solicitacoes' && (
        <FlatList
          data={solicitacoes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Nenhuma solicitação</Text></View>}
          renderItem={({ item: sol }) => {
            const sc = sol.status === 'aprovada' ? Colors.success : sol.status === 'rejeitada' ? Colors.danger : Colors.warning;
            return (
              <TouchableOpacity style={[styles.card, sol.status === 'pendente' && { borderLeftColor: Colors.warning, borderLeftWidth: 3 }]} onPress={() => sol.status === 'pendente' && setSelectedSolicitude(sol.id)} activeOpacity={0.8}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{sol.professorNome}</Text>
                    <Text style={styles.cardSub}>{sol.disciplina} · {sol.turmaNome} · T{sol.trimestre}</Text>
                    <Text style={styles.cardDate}>{timeAgo(sol.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                    <Text style={[styles.statusText, { color: sc }]}>{sol.status === 'aprovada' ? 'Aprovada' : sol.status === 'rejeitada' ? 'Rejeitada' : 'Pendente'}</Text>
                  </View>
                </View>
                <Text style={styles.cardConteudo} numberOfLines={2}>Motivo: {sol.motivo}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── CALENDÁRIO TAB ───────────────────────────────────────────────── */}
      {tab === 'calendario' && (
        <>
          <FlatList
            data={calendarioProvas.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())}
            keyExtractor={p => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 90 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="calendar-blank" size={52} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhuma prova agendada</Text>
              </View>
            }
            renderItem={({ item: prova }) => {
              const color = tipoProvaColor[prova.tipo] || Colors.info;
              return (
                <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{prova.titulo}</Text>
                      <Text style={styles.cardSub}>{prova.disciplina} · {prova.tipo}</Text>
                      <Text style={styles.cardDate}>{prova.data} às {prova.hora}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <TouchableOpacity style={[styles.publishBtn, { backgroundColor: prova.publicado ? Colors.success + '22' : Colors.surface }]} onPress={() => publicarToggle(prova.id, !prova.publicado)}>
                        <Ionicons name={prova.publicado ? 'eye' : 'eye-off'} size={14} color={prova.publicado ? Colors.success : Colors.textMuted} />
                        <Text style={[styles.publishText, { color: prova.publicado ? Colors.success : Colors.textMuted }]}>{prova.publicado ? 'Publicado' : 'Rascunho'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => webAlert('Eliminar', 'Eliminar esta prova?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => deleteCalendarioProva(prova.id) }])}>
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
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MODAL — Registar / Editar Funcionário */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Modal visible={showFuncForm} transparent animationType="slide" onRequestClose={() => { setShowFuncForm(false); }}>
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingFunc ? 'Editar Funcionário' : 'Registar Funcionário'}</Text>
              <TouchableOpacity onPress={() => setShowFuncForm(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Step tabs */}
            <View style={styles.stepRow}>
              {([
                { id: 'pessoal', label: 'Pessoal' },
                { id: 'organizacao', label: 'Cargo' },
                { id: 'contrato', label: 'Contrato' },
                { id: 'salarial', label: 'Salarial' },
              ] as const).map((s, idx) => {
                const isActive = formStep === s.id;
                const isDone = completedSteps.has(s.id) && !isActive;
                const currentIdx = FUNC_STEPS.indexOf(formStep);
                const isLocked = idx > currentIdx && !completedSteps.has(FUNC_STEPS[idx - 1] as typeof formStep);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.stepBtn,
                      isActive && styles.stepBtnActive,
                      isDone && styles.stepBtnDone,
                      isLocked && styles.stepBtnLocked,
                    ]}
                    onPress={() => handleStepTabClick(s.id)}
                  >
                    {isDone
                      ? <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                      : isLocked
                        ? <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />
                        : <Text style={[styles.stepNum, isActive && { color: '#fff' }]}>{idx + 1}</Text>
                    }
                    <Text style={[styles.stepText, isActive && styles.stepTextActive, isDone && { color: Colors.success }, isLocked && { color: Colors.textMuted }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {/* ── Step: Dados Pessoais ── */}
              {formStep === 'pessoal' && (
                <>
                  <FormRow label="Nome *" error={funcFormErrors.nome}>
                    <TextInput style={[styles.input, !!funcFormErrors.nome && styles.inputError]} placeholder="Nome" placeholderTextColor={Colors.textMuted} value={funcForm.nome} onChangeText={v => { updateField('nome', v); if (funcFormErrors.nome) setFuncFormErrors(e => ({ ...e, nome: '' })); }} />
                  </FormRow>
                  <FormRow label="Apelido">
                    <TextInput style={styles.input} placeholder="Apelido" placeholderTextColor={Colors.textMuted} value={funcForm.apelido} onChangeText={v => updateField('apelido', v)} />
                  </FormRow>
                  <FormRow label="Género">
                    <View style={styles.pillRow}>
                      {GENERO.map(g => (
                        <TouchableOpacity key={g.id} style={[styles.pill, funcForm.genero === g.id && styles.pillActive]} onPress={() => updateField('genero', g.id)}>
                          <Text style={[styles.pillText, funcForm.genero === g.id && styles.pillTextActive]}>{g.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </FormRow>
                  <DatePickerField
                    label="Data de Nascimento"
                    value={funcForm.dataNascimento}
                    onChange={v => updateField('dataNascimento', v)}
                    labelStyle={styles.fieldLabel}
                  />
                  <FormRow label="Bilhete de Identidade (BI)" error={funcFormErrors.bi}>
                    <TextInput style={[styles.input, !!funcFormErrors.bi && styles.inputError]} placeholder="000000000LA000" placeholderTextColor={Colors.textMuted} value={funcForm.bi} onChangeText={v => { updateField('bi', v); if (funcFormErrors.bi) setFuncFormErrors(e => ({ ...e, bi: '' })); }} autoCapitalize="characters" />
                  </FormRow>
                  <FormRow label="NIF" error={funcFormErrors.nif}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        style={[styles.input, { flex: 1 }, !!funcFormErrors.nif && styles.inputError]}
                        placeholder="Ex: 003519344HA042"
                        placeholderTextColor={Colors.textMuted}
                        value={funcForm.nif}
                        onChangeText={v => { updateField('nif', v); if (funcFormErrors.nif) setFuncFormErrors(e => ({ ...e, nif: '' })); }}
                        onBlur={() => lookupNIFFuncionario(funcForm.nif ?? '')}
                        autoCapitalize="characters"
                      />
                      <TouchableOpacity
                        style={[styles.nifBtn, nifLookupLoading && { opacity: 0.6 }]}
                        onPress={() => lookupNIFFuncionario(funcForm.nif ?? '')}
                        disabled={nifLookupLoading}
                      >
                        {nifLookupLoading
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Ionicons name="search" size={16} color="#fff" />}
                      </TouchableOpacity>
                    </View>
                    {nifLookupStatus === 'found' && (
                      <View style={styles.nifBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={[styles.nifBadgeText, { color: Colors.success }]}>Dados obtidos: {nifFoundName}</Text>
                      </View>
                    )}
                    {(nifLookupStatus === 'not_found' || nifLookupStatus === 'error') && (
                      <View style={styles.nifBadge}>
                        <Ionicons name="warning-outline" size={14} color={Colors.warning} />
                        <Text style={[styles.nifBadgeText, { color: Colors.warning }]}>NIF não encontrado — preencha manualmente</Text>
                      </View>
                    )}
                  </FormRow>
                  <FormRow label="Telefone">
                    <TextInput style={styles.input} placeholder="+244 9XX XXX XXX" placeholderTextColor={Colors.textMuted} value={funcForm.telefone} onChangeText={v => updateField('telefone', v)} keyboardType="phone-pad" />
                  </FormRow>
                  <FormRow label="Email">
                    <TextInput style={styles.input} placeholder="email@escola.ao" placeholderTextColor={Colors.textMuted} value={funcForm.email} onChangeText={v => updateField('email', v)} keyboardType="email-address" autoCapitalize="none" />
                  </FormRow>
                  <FormRow label="Província">
                    <TextInput style={styles.input} placeholder="Ex: Luanda" placeholderTextColor={Colors.textMuted} value={funcForm.provincia} onChangeText={v => updateField('provincia', v)} />
                  </FormRow>
                  <FormRow label="Município">
                    <TextInput style={styles.input} placeholder="Ex: Belas" placeholderTextColor={Colors.textMuted} value={funcForm.municipio} onChangeText={v => updateField('municipio', v)} />
                  </FormRow>
                  <FormRow label="Morada">
                    <TextInput style={[styles.input, { height: 64, textAlignVertical: 'top' }]} placeholder="Endereço completo" placeholderTextColor={Colors.textMuted} value={funcForm.morada} onChangeText={v => updateField('morada', v)} multiline />
                  </FormRow>
                </>
              )}

              {/* ── Step: Organização ── */}
              {formStep === 'organizacao' && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Text style={styles.sectionLabel}>Departamento *</Text>
                    {!!funcFormErrors.departamento && <Text style={styles.inlineErrorText}>{funcFormErrors.departamento}</Text>}
                  </View>
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {DEPARTAMENTOS.map(d => {
                      const color = DEPT_COLORS[d.key];
                      const isActive = funcForm.departamento === d.key;
                      return (
                        <TouchableOpacity
                          key={d.key}
                          style={[styles.deptOption, isActive && { borderColor: color, backgroundColor: color + '15' }]}
                          onPress={() => { updateField('departamento', d.key); if (funcFormErrors.departamento) setFuncFormErrors(e => ({ ...e, departamento: '' })); }}
                        >
                          <View style={[styles.deptOptionIcon, { backgroundColor: color + '22' }]}>
                            <MaterialCommunityIcons name={DEPT_ICONS[d.key] as any} size={20} color={color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.deptOptionLabel, isActive && { color }]}>{d.label}</Text>
                            <Text style={styles.deptOptionDesc} numberOfLines={1}>{d.descricao}</Text>
                          </View>
                          {isActive && <Ionicons name="checkmark-circle" size={20} color={color} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Text style={styles.sectionLabel}>Cargo / Categoria *</Text>
                    {!!funcFormErrors.cargo && <Text style={styles.inlineErrorText}>{funcFormErrors.cargo}</Text>}
                  </View>
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {cargosForForm.map(c => {
                      const isActive = funcForm.cargo === c.id;
                      const deptColor = DEPT_COLORS[funcForm.departamento as DepartamentoKey] || Colors.gold;
                      const nivelColor = c.nivelAcesso === 'total' ? Colors.danger : c.nivelAcesso === 'operacional' ? Colors.success : c.nivelAcesso === 'limitado' ? Colors.warning : Colors.textMuted;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.cargoOption, isActive && { borderColor: deptColor, backgroundColor: deptColor + '12' }]}
                          onPress={() => { updateField('cargo', c.id); if (funcFormErrors.cargo) setFuncFormErrors(e => ({ ...e, cargo: '' })); }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cargoLabel, isActive && { color: deptColor }]}>{c.label}</Text>
                            <Text style={styles.cargoDesc} numberOfLines={1}>{c.descricao}</Text>
                          </View>
                          <View style={[styles.nivelBadge, { backgroundColor: nivelColor + '22' }]}>
                            <Text style={[styles.nivelText, { color: nivelColor }]}>
                              {c.nivelAcesso === 'total' ? 'Total' : c.nivelAcesso === 'operacional' ? 'Operacional' : c.nivelAcesso === 'limitado' ? 'Limitado' : 'Sem acesso'}
                            </Text>
                          </View>
                          {isActive && <Ionicons name="checkmark-circle" size={18} color={deptColor} style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <FormRow label="Secção / Unidade Orgânica">
                    <TextInput style={styles.input} placeholder="Ex: Secretaria Pedagógica, Arquivo, Tesouraria..." placeholderTextColor={Colors.textMuted} value={funcForm.seccao} onChangeText={v => updateField('seccao', v)} />
                  </FormRow>
                  <FormRow label="Especialidade / Área">
                    <TextInput style={styles.input} placeholder="Ex: Matemática, Gestão, etc." placeholderTextColor={Colors.textMuted} value={funcForm.especialidade} onChangeText={v => updateField('especialidade', v)} />
                  </FormRow>
                  <FormRow label="Habilitações Académicas">
                    <TextInput style={styles.input} placeholder="Ex: Licenciatura em Ciências da Educação" placeholderTextColor={Colors.textMuted} value={funcForm.habilitacoes} onChangeText={v => updateField('habilitacoes', v)} />
                  </FormRow>
                </>
              )}

              {/* ── Step: Contrato ── */}
              {formStep === 'contrato' && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Text style={styles.sectionLabel}>Tipo de Vínculo *</Text>
                    {!!funcFormErrors.tipoContrato && <Text style={styles.inlineErrorText}>{funcFormErrors.tipoContrato}</Text>}
                  </View>
                  <View style={styles.pillRow}>
                    {TIPO_CONTRATO.map(t => (
                      <TouchableOpacity key={t.id} style={[styles.pill, funcForm.tipoContrato === t.id && styles.pillActive]} onPress={() => { updateField('tipoContrato', t.id); if (funcFormErrors.tipoContrato) setFuncFormErrors(e => ({ ...e, tipoContrato: '' })); }}>
                        <Text style={[styles.pillText, funcForm.tipoContrato === t.id && styles.pillTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <FormRow label="Data de Contratação">
                    <DateInput style={styles.input} value={funcForm.dataContratacao} onChangeText={v => updateField('dataContratacao', v)} />
                  </FormRow>
                  <FormRow label="Data de Fim de Contrato (se aplicável)">
                    <DateInput style={styles.input} value={funcForm.dataFimContrato} onChangeText={v => updateField('dataFimContrato', v)} placeholder="DD-MM-AAAA (vazio se sem prazo)" />
                  </FormRow>
                  <FormRow label="Observações">
                    <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Notas sobre o contrato..." placeholderTextColor={Colors.textMuted} value={funcForm.observacoes} onChangeText={v => updateField('observacoes', v)} multiline />
                  </FormRow>
                </>
              )}

              {/* ── Step: Salarial ── */}
              {formStep === 'salarial' && (() => {
                const salBase = funcForm.salarioBase ?? 0;
                const totalSubsidios = subsidiosCustom.reduce((sum, s) => sum + (salBase * s.percentagem / 100), 0);
                const salarioBruto = salBase + totalSubsidios;
                return (
                  <>
                    <Text style={styles.sectionNote}>Os valores são em Kwanzas (AOA). Os subsídios são calculados como percentagem do salário base e alimentam automaticamente o processamento salarial (IRT + INSS).</Text>
                    <FormRow label="Salário Base (AOA)">
                      <TextInput style={styles.input} placeholder="0" placeholderTextColor={Colors.textMuted} value={funcForm.salarioBase?.toString()} onChangeText={v => updateField('salarioBase', parseFloat(v) || 0)} keyboardType="numeric" />
                    </FormRow>

                    {/* ── Dynamic Subsidies ── */}
                    <View style={styles.subsidioSection}>
                      <View style={styles.subsidioHeader}>
                        <Text style={styles.subsidioTitle}>Subsídios</Text>
                        <TouchableOpacity
                          style={styles.subsidioAddBtn}
                          onPress={() => setSubsidiosCustom(prev => [...prev, { id: Date.now().toString(), nome: '', percentagem: 0 }])}
                        >
                          <Ionicons name="add-circle" size={20} color={Colors.gold} />
                          <Text style={styles.subsidioAddText}>Adicionar</Text>
                        </TouchableOpacity>
                      </View>

                      {subsidiosCustom.length === 0 && (
                        <Text style={styles.subsidioEmpty}>Nenhum subsídio adicionado. Clique em "Adicionar" para criar subsídios personalizados.</Text>
                      )}

                      {subsidiosCustom.map((sub, idx) => {
                        const valor = salBase * sub.percentagem / 100;
                        return (
                          <View key={sub.id} style={styles.subsidioRow}>
                            <View style={styles.subsidioRowTop}>
                              <TextInput
                                style={[styles.input, styles.subsidioNomeInput]}
                                placeholder="Nome do subsídio"
                                placeholderTextColor={Colors.textMuted}
                                value={sub.nome}
                                onChangeText={v => setSubsidiosCustom(prev => prev.map((s, i) => i === idx ? { ...s, nome: v } : s))}
                              />
                              <View style={styles.subsidioPercContainer}>
                                <TextInput
                                  style={[styles.input, styles.subsidioPercInput]}
                                  placeholder="0"
                                  placeholderTextColor={Colors.textMuted}
                                  value={sub.percentagem === 0 ? '' : sub.percentagem.toString()}
                                  onChangeText={v => setSubsidiosCustom(prev => prev.map((s, i) => i === idx ? { ...s, percentagem: parseFloat(v) || 0 } : s))}
                                  keyboardType="numeric"
                                />
                                <Text style={styles.subsidioPercSymbol}>%</Text>
                              </View>
                              <TouchableOpacity
                                style={styles.subsidioRemoveBtn}
                                onPress={() => setSubsidiosCustom(prev => prev.filter((_, i) => i !== idx))}
                              >
                                <Ionicons name="trash-outline" size={18} color="#e55" />
                              </TouchableOpacity>
                            </View>
                            {salBase > 0 && (
                              <Text style={styles.subsidioCalc}>
                                {sub.percentagem}% × {salBase.toLocaleString('pt-AO')} AOA = <Text style={styles.subsidioCalcVal}>{Math.round(valor).toLocaleString('pt-AO')} AOA</Text>
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* ── Salary Summary ── */}
                    <View style={styles.totalBox}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Salário Base</Text>
                        <Text style={styles.totalValue}>{salBase.toLocaleString('pt-AO')} AOA</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Subsídios</Text>
                        <Text style={styles.totalValue}>{Math.round(totalSubsidios).toLocaleString('pt-AO')} AOA</Text>
                      </View>
                      <View style={[styles.totalRow, styles.totalRowFinal]}>
                        <Text style={styles.totalLabelBig}>Salário Bruto</Text>
                        <Text style={styles.totalValueBig}>{Math.round(salarioBruto).toLocaleString('pt-AO')} AOA</Text>
                      </View>
                    </View>
                  </>
                );
              })()}

              {/* Nav Buttons */}
              <View style={styles.stepNavRow}>
                {formStep !== 'pessoal' && (
                  <TouchableOpacity style={styles.stepNavBtn} onPress={() => {
                    const steps: typeof formStep[] = ['pessoal', 'organizacao', 'contrato', 'salarial'];
                    const idx = steps.indexOf(formStep);
                    setFormStep(steps[Math.max(0, idx - 1)]);
                  }}>
                    <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
                    <Text style={styles.stepNavText}>Anterior</Text>
                  </TouchableOpacity>
                )}
                {formStep !== 'salarial' ? (
                  <TouchableOpacity style={[styles.stepNavBtn, styles.stepNavBtnPrimary]} onPress={handleFuncNext}>
                    <Text style={[styles.stepNavText, { color: '#fff' }]}>Próximo</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.stepNavBtn, styles.stepNavBtnPrimary, funcSaving && { opacity: 0.6 }]} onPress={saveFuncionario} disabled={funcSaving}>
                    {funcSaving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
                    <Text style={[styles.stepNavText, { color: '#fff' }]}>Guardar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MODAL — Detalhe do Funcionário */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Modal visible={showDetailModal && !!selectedFunc} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            {selectedFunc && (() => {
              const dept = getDepartamentoByKey(selectedFunc.departamento);
              const cargo = getCargoById(selectedFunc.cargo);
              const color = DEPT_COLORS[selectedFunc.departamento] || Colors.gold;
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{selectedFunc.nome} {selectedFunc.apelido}</Text>
                    <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeBtn}>
                      <Ionicons name="close" size={22} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Dept badge */}
                    <View style={[styles.detailDeptBadge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
                      <MaterialCommunityIcons name={DEPT_ICONS[selectedFunc.departamento] as any} size={16} color={color} />
                      <Text style={[styles.detailDeptText, { color }]}>{dept?.label}</Text>
                      <Text style={styles.detailDeptSep}>·</Text>
                      <Text style={[styles.detailDeptText, { color }]}>{cargo?.label}</Text>
                    </View>

                    <DetailRow label="BI" value={selectedFunc.bi || '—'} />
                    <DetailRow label="NIF" value={selectedFunc.nif || '—'} />
                    <DetailRow label="Telefone" value={selectedFunc.telefone || '—'} />
                    <DetailRow label="Email" value={selectedFunc.email || '—'} />
                    <DetailRow label="Data de Nascimento" value={selectedFunc.dataNascimento || '—'} />
                    <DetailRow label="Província / Município" value={selectedFunc.provincia ? `${selectedFunc.provincia} / ${selectedFunc.municipio}` : '—'} />
                    {selectedFunc.seccao ? <DetailRow label="Secção / Unidade" value={selectedFunc.seccao} /> : null}
                    <DetailRow label="Vínculo" value={TIPO_CONTRATO.find(t => t.id === selectedFunc.tipoContrato)?.label || selectedFunc.tipoContrato} />
                    <DetailRow label="Data de Contratação" value={selectedFunc.dataContratacao || '—'} />
                    <DetailRow label="Habilitações" value={selectedFunc.habilitacoes || '—'} />
                    <DetailRow label="Especialidade" value={selectedFunc.especialidade || '—'} />
                    {selectedFunc.salarioBase > 0 && (
                      <DetailRow label="Salário Base" value={`${selectedFunc.salarioBase.toLocaleString('pt-AO')} AOA`} />
                    )}

                    {/* Acesso ao sistema */}
                    {cargo && cargo.nivelAcesso !== 'sem_acesso' && (
                      <View style={styles.acessoCard}>
                        <View style={styles.acessoTop}>
                          <MaterialCommunityIcons name="shield-account" size={18} color={selectedFunc.utilizadorId ? Colors.success : Colors.warning} />
                          <Text style={[styles.acessoTitle, { color: selectedFunc.utilizadorId ? Colors.success : Colors.warning }]}>
                            {selectedFunc.utilizadorId ? 'Acesso ao Sistema Activo' : 'Sem Acesso ao Sistema'}
                          </Text>
                        </View>
                        {!selectedFunc.utilizadorId && (
                          <TouchableOpacity
                            style={styles.criarAcessoBtn}
                            onPress={() => {
                              setAcessoEmail(selectedFunc.email || '');
                              setAcessoSenha('');
                              setShowAcessoModal(true);
                            }}
                          >
                            <Ionicons name="person-add" size={14} color="#fff" />
                            <Text style={styles.criarAcessoText}>Criar Acesso ao Sistema</Text>
                          </TouchableOpacity>
                        )}
                        {selectedFunc.utilizadorId && (
                          <Text style={styles.acessoNote}>
                            Permissões configuradas como: <Text style={{ color: Colors.gold }}>{cargo.role}</Text>
                          </Text>
                        )}
                      </View>
                    )}

                    {selectedFunc.observacoes ? (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.fieldLabel}>Observações</Text>
                        <View style={styles.conteudoBox}>
                          <Text style={styles.conteudoText}>{selectedFunc.observacoes}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Actions */}
                    <View style={[styles.actionRow, { marginTop: 16 }]}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => deleteFuncionario(selectedFunc.id)}>
                        <Ionicons name="trash" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Eliminar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => {
                        setEditingFunc(selectedFunc);
                        setFuncForm(selectedFunc);
                        setFormStep('pessoal');
                        setFuncFormErrors({});
                        setCompletedSteps(new Set(['pessoal', 'organizacao', 'contrato']));
                        // Populate dynamic subsidies from existing data
                        const existingSubs = Array.isArray((selectedFunc as any).subsidios) ? (selectedFunc as any).subsidios : [];
                        if (existingSubs.length > 0) {
                          setSubsidiosCustom(existingSubs);
                        } else {
                          const base = selectedFunc.salarioBase || 0;
                          const migrated: SubsidioItem[] = [];
                          const toPerc = (v: number) => base > 0 ? Math.round((v / base) * 10000) / 100 : 0;
                          if (selectedFunc.subsidioAlimentacao > 0) migrated.push({ id: '1', nome: 'Alimentação', percentagem: toPerc(selectedFunc.subsidioAlimentacao) });
                          if (selectedFunc.subsidioTransporte > 0) migrated.push({ id: '2', nome: 'Transporte', percentagem: toPerc(selectedFunc.subsidioTransporte) });
                          if (selectedFunc.subsidioHabitacao > 0) migrated.push({ id: '3', nome: 'Habitação', percentagem: toPerc(selectedFunc.subsidioHabitacao) });
                          if (selectedFunc.outrosSubsidios > 0) migrated.push({ id: '4', nome: 'Outros', percentagem: toPerc(selectedFunc.outrosSubsidios) });
                          setSubsidiosCustom(migrated);
                        }
                        setShowDetailModal(false);
                        setShowFuncForm(true);
                      }}>
                        <Ionicons name="pencil" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Editar</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MODAL — Criar Acesso ao Sistema */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Modal visible={showAcessoModal} transparent animationType="slide" onRequestClose={() => setShowAcessoModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Acesso ao Sistema</Text>
              <TouchableOpacity onPress={() => setShowAcessoModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionNote}>
                Ao criar o acesso, o funcionário poderá iniciar sessão no SIGA com as permissões do cargo: <Text style={{ color: Colors.gold, fontFamily: 'Inter_600SemiBold' }}>{getCargoById(selectedFunc?.cargo || '')?.label}</Text>
              </Text>
              <Text style={styles.fieldLabel}>Email Institucional *</Text>
              <TextInput style={styles.input} placeholder="funcionario@escola.ao" placeholderTextColor={Colors.textMuted} value={acessoEmail} onChangeText={setAcessoEmail} keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.fieldLabel}>Senha de Acesso *</Text>
              <TextInput style={styles.input} placeholder="Mínimo 8 caracteres" placeholderTextColor={Colors.textMuted} value={acessoSenha} onChangeText={setAcessoSenha} secureTextEntry />
              <TouchableOpacity style={[styles.saveBtn, acessoSaving && { opacity: 0.6 }]} onPress={criarAcesso} disabled={acessoSaving}>
                {acessoSaving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="person-add" size={18} color="#fff" />}
                <Text style={styles.saveBtnText}>Criar Acesso</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL — Sumário Review */}
      <Modal visible={!!selectedSumario} transparent animationType="slide" onRequestClose={() => setSelectedSumario(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Validar Sumário</Text>
              <TouchableOpacity onPress={() => setSelectedSumario(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {sumarioSelecionado && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.reviewLabel}>Professor</Text>
                <Text style={styles.reviewValue}>{sumarioSelecionado.professorNome}</Text>
                <Text style={styles.reviewLabel}>Turma / Disciplina</Text>
                <Text style={styles.reviewValue}>{sumarioSelecionado.turmaNome} · {sumarioSelecionado.disciplina}</Text>
                <Text style={styles.reviewLabel}>Data / Horário</Text>
                <Text style={styles.reviewValue}>{sumarioSelecionado.data} · {sumarioSelecionado.horaInicio}–{sumarioSelecionado.horaFim} · Aula {sumarioSelecionado.numeroAula}</Text>
                <Text style={styles.reviewLabel}>Conteúdo Lecionado</Text>
                <View style={styles.conteudoBox}><Text style={styles.conteudoText}>{sumarioSelecionado.conteudo}</Text></View>
                <Text style={styles.fieldLabel}>Observação (obrigatória na rejeição)</Text>
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Escreva uma observação..." placeholderTextColor={Colors.textMuted} value={observacao} onChangeText={setObservacao} multiline />
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
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL — Solicitação Review */}
      <Modal visible={!!selectedSolicitude} transparent animationType="slide" onRequestClose={() => setSelectedSolicitude(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitação de Reabertura</Text>
              <TouchableOpacity onPress={() => setSelectedSolicitude(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {solicitSelecionada && (
              <ScrollView>
                <Text style={styles.reviewLabel}>Professor</Text>
                <Text style={styles.reviewValue}>{solicitSelecionada.professorNome}</Text>
                <Text style={styles.reviewLabel}>Pauta</Text>
                <Text style={styles.reviewValue}>{solicitSelecionada.disciplina} · {solicitSelecionada.turmaNome} · Trimestre {solicitSelecionada.trimestre}</Text>
                <Text style={styles.reviewLabel}>Motivo do Pedido</Text>
                <View style={styles.conteudoBox}><Text style={styles.conteudoText}>{solicitSelecionada.motivo}</Text></View>
                <Text style={styles.fieldLabel}>Resposta / Observação</Text>
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Escreva uma resposta..." placeholderTextColor={Colors.textMuted} value={observacao} onChangeText={setObservacao} multiline />
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
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL — Nova Prova */}
      <Modal visible={showProvaForm} transparent animationType="slide" onRequestClose={() => { setShowProvaForm(false); resetProvaForm(); }}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agendar Prova</Text>
              <TouchableOpacity onPress={() => { setShowProvaForm(false); resetProvaForm(); }} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['teste', 'exame', 'trabalho', 'prova_oral'] as const).map(t => (
                  <TouchableOpacity key={t} style={[styles.tipoBtn, provaTipo === t && styles.tipoBtnActive, { backgroundColor: provaTipo === t ? tipoProvaColor[t] + '22' : Colors.surface }]} onPress={() => setProvaTipo(t)}>
                    <Text style={[styles.tipoBtnText, provaTipo === t && { color: tipoProvaColor[t] }]}>{t === 'prova_oral' ? 'Oral' : t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Título</Text>
              <TextInput style={styles.input} placeholder="Ex: Teste do 1º Trimestre..." placeholderTextColor={Colors.textMuted} value={provaTitulo} onChangeText={setProvaTitulo} />
              <Text style={styles.fieldLabel}>Disciplina</Text>
              <TextInput style={styles.input} placeholder="Ex: Matemática" placeholderTextColor={Colors.textMuted} value={provaDisciplina} onChangeText={setProvaDisciplina} />
              <Text style={styles.fieldLabel}>Data</Text>
              <DateInput style={styles.input} value={provaData} onChangeText={setProvaData} />
              <Text style={styles.fieldLabel}>Hora</Text>
              <TextInput style={styles.input} placeholder="08:00" placeholderTextColor={Colors.textMuted} value={provaHora} onChangeText={setProvaHora} />
              <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Informações adicionais..." placeholderTextColor={Colors.textMuted} value={provaDesc} onChangeText={setProvaDesc} multiline />
              <Text style={styles.fieldLabel}>Turmas</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {turmas.filter(t => t.ativo).map(t => {
                  const sel = provaTurmasIds.includes(t.id);
                  return (
                    <TouchableOpacity key={t.id} style={[styles.tipoBtn, sel && styles.tipoBtnActive]} onPress={() => setProvaTurmasIds(sel ? provaTurmasIds.filter(id => id !== t.id) : [...provaTurmasIds, t.id])}>
                      <Text style={[styles.tipoBtnText, sel && { color: Colors.gold }]}>{t.nome}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={[styles.saveBtn, (!provaTitulo || !provaData || !provaDisciplina) && styles.saveBtnDisabled]} onPress={publicarProva} disabled={!provaTitulo || !provaData || !provaDisciplina}>
                <Ionicons name="calendar" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Guardar Prova</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FuncCard({ f, onPress }: { f: Funcionario; onPress: () => void }) {
  const cargo = getCargoById(f.cargo);
  const dept = getDepartamentoByKey(f.departamento);
  const color = DEPT_COLORS[f.departamento] || Colors.gold;
  return (
    <TouchableOpacity style={styles.funcCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.funcAvatar, { backgroundColor: color + '22' }]}>
        <Text style={[styles.funcAvatarText, { color }]}>
          {(f.nome?.[0] || '?').toUpperCase()}{(f.apelido?.[0] || '').toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.funcNome}>{f.nome} {f.apelido}</Text>
        <Text style={styles.funcCargo}>{cargo?.label || f.cargo}</Text>
        {f.email ? <Text style={styles.funcEmail} numberOfLines={1}>{f.email}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {f.utilizadorId ? (
          <View style={styles.acessoBadge}>
            <MaterialCommunityIcons name="shield-check" size={11} color={Colors.success} />
            <Text style={[styles.acessoBadgeText, { color: Colors.success }]}>Activo</Text>
          </View>
        ) : cargo && cargo.nivelAcesso !== 'sem_acesso' ? (
          <View style={[styles.acessoBadge, { backgroundColor: Colors.warning + '22' }]}>
            <MaterialCommunityIcons name="shield-off" size={11} color={Colors.warning} />
            <Text style={[styles.acessoBadgeText, { color: Colors.warning }]}>Sem acesso</Text>
          </View>
        ) : (
          <View style={[styles.acessoBadge, { backgroundColor: Colors.textMuted + '22' }]}>
            <Text style={[styles.acessoBadgeText, { color: Colors.textMuted }]}>N/A</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function FormRow({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {!!error && (
        <View style={styles.inlineError}>
          <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  statsBar: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },

  tabScroll: { maxHeight: 48, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  filterRow: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  filterBtnActive: { backgroundColor: Colors.gold + '33', borderWidth: 1, borderColor: Colors.gold + '66' },
  filterText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filterTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  // Search
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },

  // Department pills
  deptScroll: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: Colors.border },
  deptRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, gap: 6 },
  deptPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  deptPillActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  deptPillText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  deptPillTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  // Department group header
  deptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  deptIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  deptHeaderText: { fontSize: 13, fontFamily: 'Inter_700Bold', flex: 1 },
  deptCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  deptCountText: { fontSize: 11, fontFamily: 'Inter_700Bold' },

  // Func card
  funcCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  funcAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  funcAvatarText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  funcNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  funcCargo: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 1 },
  funcEmail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  acessoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.success + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  acessoBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  // NIF lookup
  nifBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  nifBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.surface },
  nifBadgeText: { fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 },

  // Card generic
  card: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 2 },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  cardConteudo: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  publishText: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  closeBtn: { padding: 4 },

  // Form
  stepRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  stepBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  stepBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepBtnDone: { backgroundColor: Colors.success + '18', borderColor: Colors.success },
  stepBtnLocked: { backgroundColor: Colors.surface, borderColor: Colors.border, opacity: 0.6 },
  stepNum: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textSecondary },
  stepText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  stepTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  inputError: { borderColor: Colors.danger, borderWidth: 1, backgroundColor: 'rgba(231,76,60,0.04)' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  inlineErrorText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.danger, flex: 1 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 10 },
  sectionNote: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, backgroundColor: Colors.surface, padding: 10, borderRadius: 8, marginBottom: 14, lineHeight: 18 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent },
  pillText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  pillTextActive: { color: Colors.accent, fontFamily: 'Inter_600SemiBold' },

  // Dept option (form)
  deptOption: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  deptOptionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deptOptionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  deptOptionDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  // Cargo option (form)
  cargoOption: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  cargoLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  cargoDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  nivelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  nivelText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  // Step nav
  stepNavRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, marginBottom: 8 },
  stepNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  stepNavBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepNavText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },

  // Salary preview
  totalBox: { backgroundColor: Colors.primary + '22', borderRadius: 10, padding: 14, marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 10 },
  totalLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  totalValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  totalLabelBig: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  totalValueBig: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.gold },

  // Dynamic subsidies
  subsidioSection: { marginTop: 16, marginBottom: 4 },
  subsidioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  subsidioTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  subsidioAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subsidioAddText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  subsidioEmpty: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  subsidioRow: { backgroundColor: Colors.surface, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  subsidioRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subsidioNomeInput: { flex: 1, marginBottom: 0 },
  subsidioPercContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subsidioPercInput: { width: 64, textAlign: 'center', marginBottom: 0 },
  subsidioPercSymbol: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.textSecondary },
  subsidioRemoveBtn: { padding: 4 },
  subsidioCalc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 6 },
  subsidioCalcVal: { fontFamily: 'Inter_600SemiBold', color: Colors.gold },

  // Detail modal
  detailDeptBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  detailDeptText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  detailDeptSep: { color: Colors.textMuted },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  detailValue: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, flex: 1, textAlign: 'right' },

  // Acesso card
  acessoCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: Colors.border },
  acessoTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  acessoTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  acessoNote: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  criarAcessoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  criarAcessoText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // Review modal
  reviewLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewValue: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  conteudoBox: { backgroundColor: Colors.surface, borderRadius: 8, padding: 12, marginTop: 4 },
  conteudoText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.danger, borderRadius: 10, paddingVertical: 12 },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 12 },
  actionBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  tipoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, marginBottom: 4 },
  tipoBtnActive: { borderColor: Colors.gold + '66' },
  tipoBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
});
