import React, { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, Platform, Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import DatePickerField from '@/components/DatePickerField';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useAuth, UserRole, AUTHORIZED_APPROVER_ROLES } from '@/context/AuthContext';
import { useUsers } from '@/context/UsersContext';
import { useData } from '@/context/DataContext';
import { useRegistro, SolicitacaoRegistro } from '@/context/RegistroContext';
import { useConfig } from '@/context/ConfigContext';
import GestaoAcessosPanel from '@/components/GestaoAcessosPanel';

const ESCOLA_STORAGE = '@sgaa_escola_config';

interface EscolaConfig {
  nome: string;
  codigoMED: string;
  morada: string;
  municipio: string;
  provincia: string;
  telefone: string;
  email: string;
  directorGeral: string;
  subdirectorPedagogico: string;
  maxAlunosTurma: string;
  horarioFuncionamento: string;
}

const DEFAULT_ESCOLA: EscolaConfig = {
  nome: 'Escola Secundária N.º 1 de Luanda',
  codigoMED: 'MED-LDA-001',
  morada: 'Rua da Missão, N.º 45',
  municipio: 'Luanda',
  provincia: 'Luanda',
  telefone: '+244 222 000 001',
  email: 'escola1luanda@med.gov.ao',
  directorGeral: 'Prof. António Mbemba',
  subdirectorPedagogico: 'Prof.ª Maria Kiala',
  maxAlunosTurma: '35',
  horarioFuncionamento: 'Seg-Sex: 07:00-19:00 | Sáb: 07:00-13:00',
};

const AREAS_FORMACAO = [
  'Ciências Físicas e Biológicas',
  'Ciências Económicas e Jurídicas',
  'Humanidades',
  'Artes Visuais',
  'Ciências de Informática',
  'Formação de Professores',
  'Outro',
];

interface Curso {
  id: string; nome: string; codigo: string; areaFormacao: string; descricao: string; ativo: boolean;
}

const SECTION_COLORS: Record<string, string> = {
  matriculas: Colors.warning,
  cursos: '#A78BFA',
  escola: Colors.info,
  anos: '#9B59B6',
  usuarios: Colors.gold,
  acessos: '#8B5CF6',
  config: Colors.success,
  comunicacoes: Colors.accent,
  seguranca: Colors.danger,
};

const GROUPS = [
  {
    key: 'academico',
    label: 'Académico',
    icon: 'school' as const,
    color: Colors.warning,
    sections: ['matriculas', 'cursos', 'anos'],
  },
  {
    key: 'pessoal',
    label: 'Pessoal & Acesso',
    icon: 'people' as const,
    color: '#8B5CF6',
    sections: ['usuarios', 'acessos'],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: 'construct' as const,
    color: Colors.info,
    sections: ['escola', 'config', 'comunicacoes', 'seguranca'],
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  ceo: 'CEO', pca: 'PCA', admin: 'Administrador', director: 'Director',
  chefe_secretaria: 'Chefe de Secretaria',
  secretaria: 'Secretaria', professor: 'Professor', aluno: 'Aluno',
  financeiro: 'Financeiro', encarregado: 'Encarregado', rh: 'Recursos Humanos',
};
const ROLE_COLOR: Record<UserRole, string> = {
  ceo: '#FFD700', pca: '#9B59B6', admin: '#E67E22', director: Colors.accent,
  chefe_secretaria: '#E11D48',
  secretaria: Colors.gold, professor: Colors.info, aluno: Colors.success,
  financeiro: '#10B981', encarregado: '#F97316', rh: '#06B6D4',
};

function SectionHeader({ title, icon, color }: { title: string; icon: string; color?: string }) {
  const c = color || Colors.gold;
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionHeaderIcon, { backgroundColor: c + '20' }]}>
        <Ionicons name={icon as any} size={14} color={c} />
      </View>
      <Text style={[styles.sectionHeaderText, { color: Colors.text }]}>{title}</Text>
      <View style={[styles.sectionHeaderLine, { backgroundColor: c + '30' }]} />
    </View>
  );
}

function StatusBadge({ status }: { status: SolicitacaoRegistro['status'] }) {
  const map = {
    pendente: { label: 'Pendente', color: Colors.warning, bg: Colors.warning + '22' },
    aprovado: { label: 'Aprovado', color: Colors.success, bg: Colors.success + '22' },
    rejeitado: { label: 'Rejeitado', color: Colors.danger, bg: Colors.danger + '22' },
  };
  const s = map[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const { section: paramSection, group: paramGroup } = useLocalSearchParams<{ section?: string; group?: string }>();
  const { anos, anoAtivo, addAno, updateAno, ativarAno, deleteAno } = useAnoAcademico();
  const { user } = useAuth();
  const { users, addUser, deleteUser } = useUsers();
  const { addProfessor } = useData();
  const { solicitacoes, pendentes, aprovadas, rejeitadas, aprovarSolicitacao, rejeitarSolicitacao, deletarSolicitacao } = useRegistro();
  const { config, updateConfig, updateFlashScreen } = useConfig();

  const [escola, setEscola] = useState<EscolaConfig>(DEFAULT_ESCOLA);
  const [editEscola, setEditEscola] = useState(false);
  const [tempEscola, setTempEscola] = useState<EscolaConfig>(DEFAULT_ESCOLA);

  const [cursosList, setCursosList] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [showCursoForm, setShowCursoForm] = useState(false);
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null);
  const [savingCurso, setSavingCurso] = useState(false);
  const [cursoForm, setCursoForm] = useState({ nome: '', codigo: '', areaFormacao: AREAS_FORMACAO[0], descricao: '' });

  async function fetchCursos() {
    setLoadingCursos(true);
    try {
      const res = await fetch('/api/cursos');
      if (res.ok) setCursosList(await res.json());
    } catch {}
    setLoadingCursos(false);
  }

  function abrirNovoCurso() {
    setEditingCurso(null);
    setCursoForm({ nome: '', codigo: '', areaFormacao: AREAS_FORMACAO[0], descricao: '' });
    setShowCursoForm(true);
  }

  function abrirEditarCurso(c: Curso) {
    setEditingCurso(c);
    setCursoForm({ nome: c.nome, codigo: c.codigo, areaFormacao: c.areaFormacao, descricao: c.descricao });
    setShowCursoForm(true);
  }

  async function salvarCurso() {
    if (!cursoForm.nome.trim()) { Alert.alert('Campo obrigatório', 'Introduza o nome do curso.'); return; }
    setSavingCurso(true);
    try {
      const method = editingCurso ? 'PUT' : 'POST';
      const url = editingCurso ? `/api/cursos/${editingCurso.id}` : '/api/cursos';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cursoForm, ativo: true }),
      });
      if (!res.ok) throw new Error('Erro ao guardar');
      await fetchCursos();
      setShowCursoForm(false);
      Alert.alert('Sucesso', editingCurso ? 'Curso actualizado.' : 'Curso criado com sucesso.');
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setSavingCurso(false);
  }

  async function toggleCursoAtivo(c: Curso) {
    try {
      await fetch(`/api/cursos/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, ativo: !c.ativo }),
      });
      await fetchCursos();
    } catch {}
  }

  const [showNovoAno, setShowNovoAno] = useState(false);
  const [showNovoUser, setShowNovoUser] = useState(false);
  const [formAno, setFormAno] = useState({ ano: '', dataInicio: '', dataFim: '' });
  const [formUser, setFormUser] = useState({ nome: '', email: '', role: 'professor' as UserRole, senha: '', numeroProfessor: '' });
  const [activeSection, setActiveSection] = useState<string>(paramSection || 'matriculas');
  const [activeGroup, setActiveGroup] = useState<string>(paramGroup || 'academico');

  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current && paramSection) {
      setActiveSection(paramSection);
      if (paramGroup) setActiveGroup(paramGroup);
      initialised.current = true;
    }
  }, [paramSection, paramGroup]);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoRegistro | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [matriculasTab, setMatriculasTab] = useState<'pendente' | 'aprovado' | 'rejeitado'>('pendente');
  const [flashForm, setFlashForm] = useState({
    titulo: config.flashScreen?.titulo || '',
    mensagem: config.flashScreen?.mensagem || '',
    imagemUrl: config.flashScreen?.imagemUrl || '',
    duracao: String(config.flashScreen?.duracao || 5),
    bgColor: config.flashScreen?.bgColor || '#0A1628',
    dataInicio: config.flashScreen?.dataInicio || '',
    dataFim: config.flashScreen?.dataFim || '',
  });
  const [flashSaved, setFlashSaved] = useState(false);

  const isApprover = user && AUTHORIZED_APPROVER_ROLES.includes(user.role);

  useEffect(() => {
    AsyncStorage.getItem(ESCOLA_STORAGE).then(raw => {
      if (raw) setEscola(JSON.parse(raw));
    });
  }, []);

  async function salvarEscola() {
    await AsyncStorage.setItem(ESCOLA_STORAGE, JSON.stringify(tempEscola));
    setEscola(tempEscola);
    setEditEscola(false);
    Alert.alert('Sucesso', 'Dados da escola actualizados.');
  }

  async function criarUser() {
    if (!formUser.nome.trim() || !formUser.email.trim() || !formUser.senha.trim()) {
      Alert.alert('Erro', 'Nome, email e senha são obrigatórios.'); return;
    }
    if (users.some(u => u.email.toLowerCase() === formUser.email.toLowerCase().trim())) {
      Alert.alert('Erro', 'Já existe um utilizador com este email.'); return;
    }
    const novoUser = await addUser({
      nome: formUser.nome.trim(),
      email: formUser.email.toLowerCase().trim(),
      senha: formUser.senha,
      role: formUser.role,
      escola: escola.nome,
      ativo: true,
    });
    if (formUser.role === 'professor') {
      const nomes = formUser.nome.trim().split(' ');
      await addProfessor({
        id: novoUser.id,
        numeroProfessor: formUser.numeroProfessor.trim() || `PROF-${Date.now().toString().slice(-4)}`,
        nome: nomes[0],
        apelido: nomes.slice(1).join(' ') || '',
        disciplinas: [],
        turmasIds: [],
        telefone: '',
        email: formUser.email.toLowerCase().trim(),
        habilitacoes: '',
        ativo: true,
      });
    }
    setShowNovoUser(false);
    setFormUser({ nome: '', email: '', role: 'professor', senha: '', numeroProfessor: '' });
    Alert.alert('Sucesso', `Utilizador ${formUser.nome} criado.`);
  }

  function confirmarEliminarUser(id: string, nome: string) {
    Alert.alert(
      'Eliminar Utilizador',
      `Deseja eliminar o utilizador "${nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteUser(id) },
      ]
    );
  }

  async function criarAno() {
    if (!formAno.ano || !formAno.dataInicio || !formAno.dataFim) {
      Alert.alert('Erro', 'Preencha todos os campos.'); return;
    }
    await addAno({
      ano: formAno.ano,
      dataInicio: formAno.dataInicio,
      dataFim: formAno.dataFim,
      ativo: false,
      trimestres: [
        { numero: 1, dataInicio: formAno.dataInicio, dataFim: formAno.dataInicio, ativo: false },
        { numero: 2, dataInicio: formAno.dataInicio, dataFim: formAno.dataInicio, ativo: false },
        { numero: 3, dataInicio: formAno.dataInicio, dataFim: formAno.dataFim, ativo: false },
      ],
    });
    setShowNovoAno(false);
    setFormAno({ ano: '', dataInicio: '', dataFim: '' });
    Alert.alert('Sucesso', `Ano académico ${formAno.ano} criado.`);
  }

  function handleAprovar(s: SolicitacaoRegistro) {
    Alert.alert(
      'Aprovar Matrícula',
      `Aprovar a solicitação de "${s.nomeCompleto}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: async () => {
            await aprovarSolicitacao(s.id, user?.nome || 'Administrador');
            setSelectedSolicitacao(null);
            Alert.alert('Aprovado', `A matrícula de ${s.nomeCompleto} foi aprovada.`);
          },
        },
      ]
    );
  }

  function handleRejeitar(s: SolicitacaoRegistro) {
    setSelectedSolicitacao(s);
    setMotivoRejeicao('');
    setShowRejeitar(true);
  }

  async function confirmarRejeicao() {
    if (!selectedSolicitacao) return;
    if (!motivoRejeicao.trim()) {
      Alert.alert('Motivo obrigatório', 'Indique o motivo da rejeição.'); return;
    }
    await rejeitarSolicitacao(selectedSolicitacao.id, user?.nome || 'Administrador', motivoRejeicao.trim());
    setShowRejeitar(false);
    setSelectedSolicitacao(null);
    Alert.alert('Rejeitado', 'A solicitação foi rejeitada.');
  }

  const allSections = [
    { key: 'matriculas', label: 'Matrículas', icon: 'person-add', badge: pendentes.length },
    { key: 'cursos', label: 'Cursos', icon: 'library' },
    { key: 'escola', label: 'Escola', icon: 'school' },
    { key: 'anos', label: 'Ano Académico', icon: 'calendar' },
    { key: 'usuarios', label: 'Utilizadores', icon: 'people' },
    { key: 'acessos', label: 'Acessos', icon: 'key' },
    { key: 'config', label: 'Configurações', icon: 'settings' },
    { key: 'comunicacoes', label: 'Comunicações', icon: 'megaphone' },
    { key: 'seguranca', label: 'Segurança', icon: 'shield-checkmark' },
  ];

  const currentSolicitacoes = matriculasTab === 'pendente' ? pendentes : matriculasTab === 'aprovado' ? aprovadas : rejeitadas;

  return (
    <View style={styles.container}>
      <TopBar title="Super Admin" subtitle="Gestão do Sistema SIGA" />

      {/* ── Hero Banner ───────────────────────────────────── */}
      <LinearGradient
        colors={['#1A0A2E', '#0D1B3E', '#1A1030']}
        style={styles.heroBanner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroLeft}>
          <LinearGradient colors={['#CC1A1A', '#8B0000']} style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="shield-crown" size={24} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.heroTitle}>Painel de Administração</Text>
            <Text style={styles.heroSub}>{user?.nome} · {user?.role === 'ceo' ? 'CEO / Super Admin' : user?.role === 'pca' ? 'Presidente do Conselho de Administração' : user?.role === 'director' ? 'Director' : 'Administrador'}</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{users.length}</Text>
            <Text style={styles.heroStatLabel}>Utilizad.</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatNum, pendentes.length > 0 && { color: Colors.warning }]}>{pendentes.length}</Text>
            <Text style={styles.heroStatLabel}>Pendentes</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{anos.length}</Text>
            <Text style={styles.heroStatLabel}>Anos</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Group Navigation (Level 1) ────────────────────── */}
      <View style={styles.groupNav}>
        {GROUPS.map(g => {
          const isActive = activeGroup === g.key;
          const groupBadge = g.sections.reduce((sum, sk) => {
            const s = allSections.find(sec => sec.key === sk);
            return sum + (s?.badge || 0);
          }, 0);
          return (
            <TouchableOpacity
              key={g.key}
              style={[styles.groupCard, isActive && { borderColor: g.color + '66', backgroundColor: g.color + '15' }]}
              onPress={() => { setActiveGroup(g.key); setActiveSection(g.sections[0]); }}
              activeOpacity={0.75}
            >
              <View style={{ position: 'relative', alignSelf: 'center' }}>
                <View style={[styles.groupCardIcon, { backgroundColor: isActive ? g.color + '30' : Colors.surface }]}>
                  <Ionicons name={g.icon} size={20} color={isActive ? g.color : Colors.textMuted} />
                </View>
                {groupBadge > 0 && (
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{groupBadge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.groupCardLabel, isActive && { color: g.color, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>{g.label}</Text>
              <Text style={styles.groupCardCount}>{g.sections.length} secções</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Sub-section Pills (Level 2) ───────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subNavScroll}>
        <View style={styles.subNavRow}>
          {GROUPS.find(g => g.key === activeGroup)?.sections.map(sk => {
            const s = allSections.find(sec => sec.key === sk)!;
            const isActive = activeSection === sk;
            const color = SECTION_COLORS[sk] || Colors.gold;
            return (
              <TouchableOpacity
                key={sk}
                style={[styles.subNavBtn, isActive && { backgroundColor: color + '22', borderColor: color + '55' }]}
                onPress={() => setActiveSection(sk)}
              >
                <Ionicons name={s.icon as any} size={13} color={isActive ? color : Colors.textMuted} />
                <Text style={[styles.subNavText, isActive && { color, fontFamily: 'Inter_700Bold' }]}>{s.label}</Text>
                {s.badge !== undefined && s.badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: Colors.danger }]}>
                    <Text style={styles.badgeText}>{s.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* MATRÍCULAS */}
        {activeSection === 'matriculas' && (
          <View style={[styles.card, { gap: 0 }]}>
            <View style={styles.cardHeaderRow}>
              <SectionHeader title="Solicitações de Matrícula" icon="person-add" color={Colors.warning} />
            </View>

            {!isApprover ? (
              <View style={styles.accessDenied}>
                <Ionicons name="lock-closed-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.accessDeniedTitle}>Acesso Restrito</Text>
                <Text style={styles.accessDeniedText}>Apenas CEO, PCA, Administradores e Directores podem gerir solicitações de matrícula.</Text>
              </View>
            ) : (
              <>
                <View style={styles.matriculasStats}>
                  {[
                    { label: 'Pendentes', count: pendentes.length, color: Colors.warning },
                    { label: 'Aprovadas', count: aprovadas.length, color: Colors.success },
                    { label: 'Rejeitadas', count: rejeitadas.length, color: Colors.danger },
                  ].map(s => (
                    <View key={s.label} style={[styles.matriculaStat, { borderColor: s.color + '33' }]}>
                      <Text style={[styles.matriculaStatNum, { color: s.color }]}>{s.count}</Text>
                      <Text style={styles.matriculaStatLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.tabsRow}>
                  {(['pendente', 'aprovado', 'rejeitado'] as const).map(tab => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.tab, matriculasTab === tab && styles.tabActive]}
                      onPress={() => setMatriculasTab(tab)}
                    >
                      <Text style={[styles.tabText, matriculasTab === tab && styles.tabTextActive]}>
                        {tab === 'pendente' ? 'Pendentes' : tab === 'aprovado' ? 'Aprovadas' : 'Rejeitadas'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {currentSolicitacoes.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={32} color={Colors.textMuted} />
                    <Text style={styles.emptyStateText}>Nenhuma solicitação {matriculasTab === 'pendente' ? 'pendente' : matriculasTab === 'aprovado' ? 'aprovada' : 'rejeitada'}</Text>
                  </View>
                ) : (
                  currentSolicitacoes.map(s => (
                    <View key={s.id} style={styles.solicitacaoCard}>
                      <View style={styles.solicitacaoTop}>
                        <View style={styles.solicitacaoAvatar}>
                          <Text style={styles.solicitacaoAvatarText}>{s.nomeCompleto.charAt(0)}</Text>
                        </View>
                        <View style={styles.solicitacaoInfo}>
                          <Text style={styles.solicitacaoNome}>{s.nomeCompleto}</Text>
                          <Text style={styles.solicitacaoMeta}>{s.nivel} · {s.classe} · {s.provincia}</Text>
                          <Text style={styles.solicitacaoDate}>
                            Submetido em {new Date(s.criadoEm).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        <StatusBadge status={s.status} />
                      </View>

                      <View style={styles.solicitacaoDetails}>
                        {[
                          { label: 'Encarregado', value: s.nomeEncarregado },
                          { label: 'Contacto', value: s.telefoneEncarregado },
                          { label: 'Nascimento', value: s.dataNascimento },
                          s.municipio ? { label: 'Município', value: s.municipio } : null,
                          s.observacoes ? { label: 'Obs.', value: s.observacoes } : null,
                          s.avaliadoPor ? { label: s.status === 'aprovado' ? 'Aprovado por' : 'Rejeitado por', value: s.avaliadoPor } : null,
                          s.motivoRejeicao ? { label: 'Motivo', value: s.motivoRejeicao } : null,
                        ].filter(Boolean).map((row: any) => (
                          <View key={row.label} style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{row.label}</Text>
                            <Text style={styles.detailValue}>{row.value}</Text>
                          </View>
                        ))}
                      </View>

                      {s.status === 'pendente' && (
                        <View style={styles.solicitacaoActions}>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleRejeitar(s)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                            <Text style={styles.rejectBtnText}>Rejeitar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={() => handleAprovar(s)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                            <Text style={styles.approveBtnText}>Aprovar</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {s.status !== 'pendente' && (
                        <TouchableOpacity
                          style={styles.deleteCardBtn}
                          onPress={() => Alert.alert('Eliminar', 'Eliminar este registo?', [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Eliminar', style: 'destructive', onPress: () => deletarSolicitacao(s.id) },
                          ])}
                        >
                          <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
                          <Text style={styles.deleteCardBtnText}>Eliminar registo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {/* CURSOS */}
        {activeSection === 'cursos' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <SectionHeader title="Parametrizar Cursos" icon="library" color="#A78BFA" />
              {!showCursoForm && (
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: '#A78BFA22', borderColor: '#A78BFA55', borderWidth: 1 }]}
                  onPress={() => { abrirNovoCurso(); fetchCursos(); }}
                >
                  <Ionicons name="add" size={15} color="#A78BFA" />
                  <Text style={[styles.editBtnText, { color: '#A78BFA' }]}>Novo Curso</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', padding: 12, marginBottom: 4 }}>
              <Ionicons name="information-circle-outline" size={16} color="#A78BFA" />
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1, lineHeight: 18 }}>
                Os cursos parametrizados aqui são disponibilizados apenas para inscrições da <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#A78BFA' }}>10ª Classe (II Ciclo)</Text>. Organize-os por Área de Formação.
              </Text>
            </View>

            {showCursoForm ? (
              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 }}>
                  {editingCurso ? 'Editar Curso' : 'Novo Curso'}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Nome do Curso *</Text>
                  <TextInput
                    style={styles.input}
                    value={cursoForm.nome}
                    onChangeText={v => setCursoForm(f => ({ ...f, nome: v }))}
                    placeholder="Ex: Ciências e Tecnologia"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Código</Text>
                  <TextInput
                    style={styles.input}
                    value={cursoForm.codigo}
                    onChangeText={v => setCursoForm(f => ({ ...f, codigo: v }))}
                    placeholder="Ex: CT, CEJ, HUM..."
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Área de Formação *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                      {AREAS_FORMACAO.map(a => (
                        <TouchableOpacity
                          key={a}
                          onPress={() => setCursoForm(f => ({ ...f, areaFormacao: a }))}
                          style={[
                            { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
                            cursoForm.areaFormacao === a && { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: '#A78BFA' },
                          ]}
                        >
                          <Text style={[
                            { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
                            cursoForm.areaFormacao === a && { color: '#A78BFA', fontFamily: 'Inter_600SemiBold' },
                          ]}>{a}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Descrição</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={cursoForm.descricao}
                    onChangeText={v => setCursoForm(f => ({ ...f, descricao: v }))}
                    placeholder="Breve descrição do curso..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                </View>

                <View style={[styles.modalActions, { marginTop: 6 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCursoForm(false)}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, savingCurso && { opacity: 0.6 }]}
                    onPress={salvarCurso}
                    disabled={savingCurso}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>{savingCurso ? 'A guardar...' : 'Guardar Curso'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View onLayout={fetchCursos} style={{ gap: 4 }}>
                {loadingCursos && (
                  <Text style={{ color: Colors.textMuted, textAlign: 'center', paddingVertical: 20, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
                    A carregar cursos...
                  </Text>
                )}
                {!loadingCursos && cursosList.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
                    <Ionicons name="school-outline" size={44} color={Colors.textMuted} />
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary }}>Nenhum curso parametrizado</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' }}>
                      Toque em "Novo Curso" para adicionar o primeiro curso para a 10ª Classe.
                    </Text>
                  </View>
                )}
                {Object.entries(
                  cursosList.filter(c => c.ativo).reduce<Record<string, Curso[]>>((acc, c) => {
                    if (!acc[c.areaFormacao]) acc[c.areaFormacao] = [];
                    acc[c.areaFormacao].push(c);
                    return acc;
                  }, {})
                ).map(([area, lista]) => (
                  <View key={area} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                      <Ionicons name="layers-outline" size={13} color="#A78BFA" />
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#A78BFA', flex: 1 }}>{area}</Text>
                      <View style={{ backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#A78BFA' }}>{lista.length}</Text>
                      </View>
                    </View>
                    {lista.map(c => (
                      <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          {!!c.codigo && (
                            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(167,139,250,0.18)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4 }}>
                              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#A78BFA' }}>{c.codigo}</Text>
                            </View>
                          )}
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{c.nome}</Text>
                          {!!c.descricao && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 }} numberOfLines={1}>{c.descricao}</Text>}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity onPress={() => abrirEditarCurso(c)} style={[styles.exportBtn, { padding: 8, marginBottom: 0, minWidth: 0, borderColor: Colors.gold + '44' }]}>
                            <Ionicons name="pencil-outline" size={15} color={Colors.gold} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => {
                            Alert.alert('Desactivar Curso', `Desactivar "${c.nome}"?`, [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Desactivar', style: 'destructive', onPress: () => toggleCursoAtivo(c) },
                            ]);
                          }} style={[styles.exportBtn, { padding: 8, marginBottom: 0, minWidth: 0, borderColor: Colors.danger + '44', backgroundColor: Colors.danger + '11' }]}>
                            <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
                {cursosList.filter(c => !c.ativo).length > 0 && (
                  <View style={{ marginTop: 6, opacity: 0.5 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 8 }}>
                      INACTIVOS ({cursosList.filter(c => !c.ativo).length})
                    </Text>
                    {cursosList.filter(c => !c.ativo).map(c => (
                      <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 12, marginBottom: 6 }}>
                        <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>{c.nome}</Text>
                        <TouchableOpacity onPress={() => toggleCursoAtivo(c)} style={[styles.exportBtn, { padding: 8, marginBottom: 0, minWidth: 0 }]}>
                          <Ionicons name="refresh-outline" size={15} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ESCOLA */}
        {activeSection === 'escola' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <SectionHeader title="Configuração Escolar" icon="school" color={Colors.info} />
              <TouchableOpacity onPress={() => { setTempEscola(escola); setEditEscola(true); }} style={styles.editBtn}>
                <Ionicons name="pencil" size={15} color={Colors.gold} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.escolaLogo}>
              <View style={styles.logoPlaceholder}>
                <Ionicons name="school" size={32} color={Colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.escolaNome}>{escola.nome}</Text>
                <Text style={styles.escolaCodigo}>Código MED: {escola.codigoMED}</Text>
              </View>
            </View>
            {[
              { label: 'Morada', value: escola.morada },
              { label: 'Município', value: escola.municipio },
              { label: 'Província', value: escola.provincia },
              { label: 'Telefone', value: escola.telefone },
              { label: 'Email Institucional', value: escola.email },
              { label: 'Director Geral', value: escola.directorGeral },
              { label: 'Subdirector Pedagógico', value: escola.subdirectorPedagogico },
            ].map(row => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ANOS ACADÉMICOS */}
        {activeSection === 'anos' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <SectionHeader title="Anos Académicos" icon="calendar" color={"#9B59B6"} />
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowNovoAno(true)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Novo</Text>
              </TouchableOpacity>
            </View>
            {anos.map(ano => (
              <View key={ano.id} style={[styles.anoItem, ano.ativo && styles.anoItemActive]}>
                <View style={styles.anoInfo}>
                  <View style={styles.anoTitleRow}>
                    <Text style={[styles.anoNum, ano.ativo && { color: Colors.gold }]}>{ano.ano}</Text>
                    {ano.ativo && <View style={styles.atualBadge}><Text style={styles.atualText}>Activo</Text></View>}
                  </View>
                  <Text style={styles.anoDates}>{ano.dataInicio} — {ano.dataFim}</Text>
                  <View style={styles.trimRow}>
                    {ano.trimestres.map(t => (
                      <View key={t.numero} style={[styles.trimBadge, t.ativo && styles.trimBadgeActive]}>
                        <Text style={[styles.trimText, t.ativo && styles.trimTextActive]}>{t.numero}º Trim.</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.anoActions}>
                  {!ano.ativo && (
                    <TouchableOpacity
                      style={styles.ativarBtn}
                      onPress={() => Alert.alert('Activar Ano', `Activar ${ano.ano}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Activar', onPress: () => ativarAno(ano.id) },
                      ])}
                    >
                      <Text style={styles.ativarText}>Activar</Text>
                    </TouchableOpacity>
                  )}
                  {!ano.ativo && (
                    <TouchableOpacity
                      onPress={() => Alert.alert('Eliminar', `Eliminar ${ano.ano}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => deleteAno(ano.id) },
                      ])}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* UTILIZADORES */}
        {activeSection === 'usuarios' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <SectionHeader title="Gestão de Utilizadores" icon="people" color={Colors.gold} />
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowNovoUser(true)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Novo</Text>
              </TouchableOpacity>
            </View>
            {users.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={30} color={Colors.textMuted} />
                <Text style={styles.emptyStateText}>Nenhum utilizador registado</Text>
              </View>
            )}
            {users.map(u => (
              <View key={u.id} style={styles.userItem}>
                <View style={[styles.userAvatar, { backgroundColor: (ROLE_COLOR[u.role] || Colors.textMuted) + '33' }]}>
                  <Text style={[styles.userAvatarText, { color: ROLE_COLOR[u.role] || Colors.textMuted }]}>
                    {u.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.nome}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLOR[u.role] || Colors.textMuted) + '22' }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLOR[u.role] || Colors.textMuted }]}>{ROLE_LABEL[u.role]}</Text>
                </View>
                <TouchableOpacity style={{ padding: 6, marginLeft: 4 }} onPress={() => confirmarEliminarUser(u.id, u.nome)}>
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* CONFIGURAÇÕES GERAIS */}
        {activeSection === 'config' && (
          <View style={{ gap: 14, paddingBottom: 0 }}>

            {/* Escola / Identidade */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <SectionHeader title="Identidade da Escola" icon="school" />
                <TouchableOpacity onPress={() => setActiveSection('escola')} style={styles.editBtn}>
                  <Ionicons name="pencil" size={15} color={Colors.gold} />
                  <Text style={styles.editBtnText}>Editar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.configEscolaRow}>
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="school" size={26} color={Colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configEscolaNome}>{escola.nome}</Text>
                  <Text style={styles.configEscolaCodigo}>{escola.codigoMED} · {escola.provincia}</Text>
                </View>
              </View>
            </View>

            {/* Período de Inscrições */}
            <View style={styles.card}>
              <SectionHeader title="Período de Inscrições" icon="person-add" />
              <Text style={styles.configSectionDesc}>
                Controla se o botão de solicitação de matrícula está visível no ecrã de Login.
                Apenas o PCA, Administrador ou Director devem activar este período.
              </Text>
              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.inscricoesAbertas ? '#22C55E22' : Colors.border }]}>
                    <Ionicons name="person-add-outline" size={18} color={config.inscricoesAbertas ? '#22C55E' : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Inscrições Online</Text>
                    <Text style={styles.configToggleDesc}>
                      {config.inscricoesAbertas
                        ? 'Abertas — o botão "Solicitar Matrícula" está visível no Login'
                        : 'Fechadas — o botão não aparece no ecrã de Login'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={!!config.inscricoesAbertas}
                  onValueChange={v => {
                    updateConfig({ inscricoesAbertas: v });
                    Alert.alert(
                      v ? 'Inscrições Abertas' : 'Inscrições Fechadas',
                      v
                        ? 'Os encarregados já podem solicitar matrícula pelo ecrã de Login.'
                        : 'O botão de matrícula foi removido do ecrã de Login.',
                    );
                  }}
                  thumbColor={config.inscricoesAbertas ? '#22C55E' : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: '#22C55E55' }}
                />
              </View>
            </View>

            {/* Provas do Trimestre */}
            <View style={styles.card}>
              <SectionHeader title="Provas do Trimestre" icon="document-text" />
              <Text style={styles.configSectionDesc}>
                Activa ou desactiva as provas que são utilizadas no cálculo da nota final de cada trimestre.
              </Text>

              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.pp1Habilitado ? Colors.info + '22' : Colors.border }]}>
                    <Ionicons name="newspaper-outline" size={18} color={config.pp1Habilitado ? Colors.info : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>PP — Prova do Professor</Text>
                    <Text style={styles.configToggleDesc}>
                      {config.pp1Habilitado ? 'Activa — incluída no cálculo da MT1' : 'Desactivada — não entra no cálculo'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={config.pp1Habilitado}
                  onValueChange={v => {
                    updateConfig({ pp1Habilitado: v });
                    Alert.alert(
                      v ? 'PP Activada' : 'PP Desactivada',
                      v
                        ? 'A PP será incluída no cálculo da Média Total (MT1).'
                        : 'A PP não será utilizada no cálculo das notas.',
                    );
                  }}
                  thumbColor={config.pp1Habilitado ? Colors.info : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: Colors.info + '55' }}
                />
              </View>

              <View style={[styles.configToggleRow, { marginTop: 8 }]}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.pptHabilitado ? Colors.accent + '22' : Colors.border }]}>
                    <Ionicons name="clipboard-outline" size={18} color={config.pptHabilitado ? Colors.accent : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>PT — Prova Trimestral</Text>
                    <Text style={styles.configToggleDesc}>
                      {config.pptHabilitado ? 'Activa — incluída no cálculo da MT1' : 'Desactivada — não entra no cálculo'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={config.pptHabilitado}
                  onValueChange={v => {
                    updateConfig({ pptHabilitado: v });
                    Alert.alert(
                      v ? 'PT Activada' : 'PT Desactivada',
                      v
                        ? 'A PT será incluída no cálculo da Média Total (MT1).'
                        : 'A PT não será utilizada no cálculo das notas.',
                    );
                  }}
                  thumbColor={config.pptHabilitado ? Colors.accent : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: Colors.accent + '55' }}
                />
              </View>

              {(!config.pp1Habilitado || !config.pptHabilitado) && (
                <View style={styles.configWarnBox}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.warning} />
                  <Text style={styles.configWarnText}>
                    Com provas desactivadas, o cálculo da MT1 é feito apenas com as avaliações activas.
                  </Text>
                </View>
              )}
            </View>

            {/* Notas e Aprovação */}
            <View style={styles.card}>
              <SectionHeader title="Notas e Aprovação" icon="stats-chart" />

              <View style={styles.configFieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configFieldLabel}>Nota Mínima de Aprovação</Text>
                  <Text style={styles.configFieldDesc}>Valor mínimo para o aluno ser aprovado (0–20)</Text>
                </View>
                <TextInput
                  style={styles.configNumInput}
                  value={String(config.notaMinimaAprovacao)}
                  onChangeText={v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n >= 0 && n <= 20) updateConfig({ notaMinimaAprovacao: n });
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={[styles.configFieldRow, { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configFieldLabel}>Máx. Alunos por Turma</Text>
                  <Text style={styles.configFieldDesc}>Limite de alunos por turma</Text>
                </View>
                <TextInput
                  style={styles.configNumInput}
                  value={String(config.maxAlunosTurma)}
                  onChangeText={v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n > 0) updateConfig({ maxAlunosTurma: n });
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.configFieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configFieldLabel}>Nº de Avaliações Contínuas (MAC)</Text>
                  <Text style={styles.configFieldDesc}>
                    Quantas avaliações (AVAL) por trimestre (1–8). Actualmente: {config.numAvaliacoes ?? 4}
                  </Text>
                </View>
                <View style={styles.avalStepper}>
                  <TouchableOpacity
                    style={[styles.avalStepBtn, (config.numAvaliacoes ?? 4) <= 1 && styles.avalStepBtnDisabled]}
                    onPress={() => {
                      const cur = config.numAvaliacoes ?? 4;
                      if (cur > 1) updateConfig({ numAvaliacoes: cur - 1 });
                    }}
                    disabled={(config.numAvaliacoes ?? 4) <= 1}
                  >
                    <Ionicons name="remove" size={18} color={(config.numAvaliacoes ?? 4) <= 1 ? Colors.textMuted : Colors.text} />
                  </TouchableOpacity>
                  <View style={styles.avalStepValue}>
                    <Text style={styles.avalStepValueText}>{config.numAvaliacoes ?? 4}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.avalStepBtn, (config.numAvaliacoes ?? 4) >= 8 && styles.avalStepBtnDisabled]}
                    onPress={() => {
                      const cur = config.numAvaliacoes ?? 4;
                      if (cur < 8) updateConfig({ numAvaliacoes: cur + 1 });
                    }}
                    disabled={(config.numAvaliacoes ?? 4) >= 8}
                  >
                    <Ionicons name="add" size={18} color={(config.numAvaliacoes ?? 4) >= 8 ? Colors.textMuted : Colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.configFieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configFieldLabel}>Nota Mínima MAC — Média de Avaliação Contínua</Text>
                  <Text style={styles.configFieldDesc}>Valor mínimo aceite para MAC (1–20)</Text>
                </View>
                <TextInput
                  style={styles.configNumInput}
                  value={String(config.macMin ?? 1)}
                  onChangeText={v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n >= 0 && n <= 20) updateConfig({ macMin: n });
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={[styles.configFieldRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configFieldLabel}>Nota Máxima MAC — Média de Avaliação Contínua</Text>
                  <Text style={styles.configFieldDesc}>Valor máximo aceite para MAC (1–20)</Text>
                </View>
                <TextInput
                  style={styles.configNumInput}
                  value={String(config.macMax ?? 5)}
                  onChangeText={v => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n >= 1 && n <= 20) updateConfig({ macMax: n });
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {/* Funcionamento */}
            <View style={styles.card}>
              <SectionHeader title="Funcionamento" icon="time" />
              <View style={styles.configFieldCol}>
                <Text style={styles.configFieldLabel}>Horário de Funcionamento</Text>
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={config.horarioFuncionamento}
                  onChangeText={v => updateConfig({ horarioFuncionamento: v })}
                  placeholderTextColor={Colors.textMuted}
                  placeholder="ex: Seg-Sex: 07:00-19:00"
                />
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sistema de Notas</Text>
                <Text style={styles.infoValue}>Escala 0 – 20 valores</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Idioma do Sistema</Text>
                <Text style={styles.infoValue}>Português (Angola)</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>Fuso Horário</Text>
                <Text style={styles.infoValue}>WAT — África Ocidental (UTC+1)</Text>
              </View>
            </View>

          </View>
        )}

        {/* COMUNICAÇÕES — FLASH SCREEN */}
        {activeSection === 'comunicacoes' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <SectionHeader title="Flash Screen do Sistema" icon="megaphone" />
              <Text style={styles.configSectionDesc}>
                Cria um aviso em ecrã completo que aparece automaticamente a todos os utilizadores quando abrem a aplicação. Ideal para comunicados urgentes, eventos ou avisos institucionais.
              </Text>

              {/* ATIVAR / DESATIVAR */}
              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: Colors.warning + '22' }]}>
                    <Ionicons name="megaphone" size={18} color={Colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Flash Screen Activo</Text>
                    <Text style={styles.configToggleDesc}>
                      {config.flashScreen?.ativa ? 'Os utilizadores verão o aviso ao abrir a app' : 'Nenhum aviso será exibido'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={!!config.flashScreen?.ativa}
                  onValueChange={v => updateFlashScreen({ ativa: v })}
                  trackColor={{ false: Colors.border, true: Colors.warning + '88' }}
                  thumbColor={config.flashScreen?.ativa ? Colors.warning : Colors.textMuted}
                />
              </View>
            </View>

            {/* FORMULÁRIO */}
            <View style={styles.card}>
              <SectionHeader title="Conteúdo do Aviso" icon="create" />

              <Text style={styles.fieldLabel}>Título *</Text>
              <TextInput
                style={styles.input}
                value={flashForm.titulo}
                onChangeText={v => setFlashForm(f => ({ ...f, titulo: v }))}
                placeholder="Ex: Reunião de Pais — Amanhã"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Mensagem</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={flashForm.mensagem}
                onChangeText={v => setFlashForm(f => ({ ...f, mensagem: v }))}
                placeholder="Descrição detalhada do aviso..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>URL da Imagem (opcional)</Text>
              <TextInput
                style={styles.input}
                value={flashForm.imagemUrl}
                onChangeText={v => setFlashForm(f => ({ ...f, imagemUrl: v }))}
                placeholder="https://exemplo.com/imagem.jpg"
                placeholderTextColor={Colors.textMuted}
                keyboardType="url"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Cor de Fundo (HEX)</Text>
              <TextInput
                style={styles.input}
                value={flashForm.bgColor}
                onChangeText={v => setFlashForm(f => ({ ...f, bgColor: v }))}
                placeholder="#0A1628"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                maxLength={7}
              />
            </View>

            {/* TEMPO E DATAS */}
            <View style={styles.card}>
              <SectionHeader title="Tempo e Visibilidade" icon="timer" />

              <View style={styles.configFieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configFieldLabel}>Duração (segundos)</Text>
                  <Text style={styles.configFieldDesc}>O aviso fecha automaticamente após este tempo</Text>
                </View>
                <TextInput
                  style={styles.configNumInput}
                  value={flashForm.duracao}
                  onChangeText={v => setFlashForm(f => ({ ...f, duracao: v }))}
                  keyboardType="number-pad"
                  maxLength={3}
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <DatePickerField
                label="Data de Início"
                value={flashForm.dataInicio}
                onChange={v => setFlashForm(f => ({ ...f, dataInicio: v }))}
              />

              <DatePickerField
                label="Data de Fim"
                value={flashForm.dataFim}
                onChange={v => setFlashForm(f => ({ ...f, dataFim: v }))}
              />

              <View style={[styles.configWarnBox, { marginTop: 14 }]}>
                <Ionicons name="information-circle" size={16} color={Colors.info} />
                <Text style={[styles.configWarnText, { color: Colors.info }]}>
                  O aviso só é exibido uma vez por sessão. Se quiser que volte a aparecer, altere o título ou a data de início.
                </Text>
              </View>

              {flashSaved && (
                <View style={[styles.configWarnBox, { backgroundColor: Colors.success + '18', marginTop: 8 }]}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={[styles.configWarnText, { color: Colors.success }]}>Flash Screen guardado com sucesso!</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 16 }]}
                onPress={async () => {
                  const dur = parseInt(flashForm.duracao);
                  if (!flashForm.titulo.trim()) {
                    Alert.alert('Erro', 'O título é obrigatório.'); return;
                  }
                  await updateFlashScreen({
                    titulo: flashForm.titulo.trim(),
                    mensagem: flashForm.mensagem.trim(),
                    imagemUrl: flashForm.imagemUrl.trim(),
                    duracao: isNaN(dur) || dur < 2 ? 5 : Math.min(dur, 60),
                    bgColor: flashForm.bgColor.trim() || '#0A1628',
                    dataInicio: flashForm.dataInicio.trim(),
                    dataFim: flashForm.dataFim.trim(),
                  });
                  setFlashSaved(true);
                  setTimeout(() => setFlashSaved(false), 3000);
                }}
              >
                <Text style={styles.saveBtnText}>Guardar Flash Screen</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ACESSOS E PERMISSÕES */}
        {activeSection === 'acessos' && (
          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            <GestaoAcessosPanel />
          </View>
        )}

        {/* SEGURANÇA */}
        {activeSection === 'seguranca' && (
          <View style={styles.card}>
            <SectionHeader title="Segurança e Backups" icon="shield-checkmark" color={Colors.danger} />
            {[
              { label: 'Último Backup', value: 'Hoje, 03:00', valueColor: Colors.success },
              { label: 'Tipo de Backup', value: 'Automático (Diário)' },
              { label: 'Versão do Sistema', value: 'SIGE v1.0.0' },
              { label: 'Base de Dados', value: 'Operacional', valueColor: Colors.success },
            ].map(row => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={[styles.infoValue, row.valueColor ? { color: row.valueColor } : {}]}>{row.value}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => Alert.alert('Exportar Dados', 'A funcionalidade de exportação estará disponível na versão 1.1.0.')}
            >
              <Ionicons name="download-outline" size={17} color={Colors.gold} />
              <Text style={styles.exportText}>Exportar Dados (CSV/Excel)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { borderColor: Colors.info + '44', backgroundColor: Colors.info + '11' }]}
              onPress={() => Alert.alert('Backup Manual', 'Backup iniciado. Concluído em breve.')}
            >
              <Ionicons name="cloud-upload-outline" size={17} color={Colors.info} />
              <Text style={[styles.exportText, { color: Colors.info }]}>Executar Backup Manual</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal Editar Escola */}
      <Modal visible={editEscola} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Escola</Text>
              <TouchableOpacity onPress={() => setEditEscola(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(Object.keys(tempEscola) as (keyof EscolaConfig)[]).map(key => (
                <View key={key} style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                  <TextInput
                    style={styles.input}
                    value={tempEscola[key]}
                    onChangeText={v => setTempEscola(e => ({ ...e, [key]: v }))}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={salvarEscola}>
                <Text style={styles.saveBtnText}>Guardar Alterações</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Novo Ano */}
      <Modal visible={showNovoAno} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Ano Académico</Text>
              <TouchableOpacity onPress={() => setShowNovoAno(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Ano</Text>
            <TextInput style={styles.input} value={formAno.ano} onChangeText={v => setFormAno(f => ({ ...f, ano: v }))} placeholder="2026" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            <DatePickerField
              label="Data de Início"
              value={formAno.dataInicio}
              onChange={v => setFormAno(f => ({ ...f, dataInicio: v }))}
            />
            <DatePickerField
              label="Data de Fim"
              value={formAno.dataFim}
              onChange={v => setFormAno(f => ({ ...f, dataFim: v }))}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={criarAno}>
              <Text style={styles.saveBtnText}>Criar Ano Académico</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Novo Utilizador */}
      <Modal visible={showNovoUser} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Utilizador</Text>
              <TouchableOpacity onPress={() => setShowNovoUser(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Nome Completo</Text>
            <TextInput style={styles.input} value={formUser.nome} onChangeText={v => setFormUser(f => ({ ...f, nome: v }))} placeholder="Nome do utilizador" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.input} value={formUser.email} onChangeText={v => setFormUser(f => ({ ...f, email: v }))} placeholder="utilizador@escola.ao" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.fieldLabel}>Função</Text>
            <View style={styles.rolesRow}>
              {(['pca', 'admin', 'director', 'chefe_secretaria', 'secretaria', 'professor', 'financeiro', 'aluno'] as UserRole[]).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, formUser.role === r && { backgroundColor: (ROLE_COLOR[r] || Colors.textMuted) + '33', borderColor: ROLE_COLOR[r] || Colors.textMuted }]}
                  onPress={() => setFormUser(f => ({ ...f, role: r }))}
                >
                  <Text style={[styles.roleBtnText, formUser.role === r && { color: ROLE_COLOR[r] || Colors.textMuted }]}>{ROLE_LABEL[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Senha</Text>
            <TextInput style={styles.input} value={formUser.senha} onChangeText={v => setFormUser(f => ({ ...f, senha: v }))} placeholder="Senha de acesso" placeholderTextColor={Colors.textMuted} secureTextEntry />
            {formUser.role === 'professor' && (
              <>
                <Text style={styles.fieldLabel}>Nº Professor (opcional)</Text>
                <TextInput style={styles.input} value={formUser.numeroProfessor} onChangeText={v => setFormUser(f => ({ ...f, numeroProfessor: v }))} placeholder="ex: PROF-001" placeholderTextColor={Colors.textMuted} />
              </>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={criarUser}>
              <Text style={styles.saveBtnText}>Criar Utilizador</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Rejeitar */}
      <Modal visible={showRejeitar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { borderRadius: 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rejeitar Solicitação</Text>
              <TouchableOpacity onPress={() => setShowRejeitar(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedSolicitacao && (
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 12 }}>
                Rejeitar matrícula de <Text style={{ fontFamily: 'Inter_700Bold', color: Colors.text }}>{selectedSolicitacao.nomeCompleto}</Text>
              </Text>
            )}
            <Text style={styles.fieldLabel}>Motivo da Rejeição *</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
              value={motivoRejeicao}
              onChangeText={setMotivoRejeicao}
              placeholder="Indique o motivo (ex: documentação incompleta, falta de vagas...)"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.danger, marginTop: 16 }]} onPress={confirmarRejeicao}>
              <Text style={styles.saveBtnText}>Confirmar Rejeição</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  heroBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.accent + '30',
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  heroIconWrap: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  heroTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  heroSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  heroStat: { alignItems: 'center', paddingHorizontal: 12 },
  heroStatNum: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold },
  heroStatLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', color: Colors.textMuted, marginTop: 1 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  groupNav: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  groupCard: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: 'transparent',
  },
  groupCardIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  groupCardLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  groupCardCount: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  groupBadge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: Colors.danger, borderRadius: 9, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: Colors.backgroundCard,
  },
  groupBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff' },
  subNavScroll: { flexGrow: 0, maxHeight: 46, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  subNavRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, gap: 6 },
  subNavBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'transparent',
  },
  subNavText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  badge: { backgroundColor: Colors.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  scroll: { flex: 1 },
  card: { margin: 16, marginBottom: 0, backgroundColor: Colors.backgroundCard, borderRadius: 18, padding: 16, gap: 14 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, marginBottom: 4 },
  sectionHeaderIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1 },
  sectionHeaderLine: { height: 1, width: 30, borderRadius: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.gold + '22' },
  editBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.accent },
  addBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  accessDenied: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  accessDeniedTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.textSecondary },
  accessDeniedText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', maxWidth: 280 },
  matriculasStats: { flexDirection: 'row', gap: 8 },
  matriculaStat: { flex: 1, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, alignItems: 'center', gap: 3 },
  matriculaStatNum: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  matriculaStatLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  tabsRow: { flexDirection: 'row', gap: 6, borderRadius: 12, backgroundColor: Colors.surface, padding: 4 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.backgroundElevated },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabTextActive: { color: Colors.text, fontFamily: 'Inter_600SemiBold' },
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyStateText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  solicitacaoCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  solicitacaoTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  solicitacaoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  solicitacaoAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  solicitacaoInfo: { flex: 1, gap: 2 },
  solicitacaoNome: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  solicitacaoMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  solicitacaoDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  solicitacaoDetails: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  detailRow: { flexDirection: 'row', gap: 6 },
  detailLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, width: 90, textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text },
  solicitacaoActions: { flexDirection: 'row', gap: 8 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.danger + '44', backgroundColor: Colors.danger + '11' },
  rejectBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.danger },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.success },
  approveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  deleteCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  deleteCardBtnText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  escolaLogo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: Colors.surface, borderRadius: 12 },
  logoPlaceholder: { width: 54, height: 54, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  escolaNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1, lineHeight: 20 },
  escolaCodigo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  anoItem: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start' },
  anoItemActive: { borderWidth: 1, borderColor: Colors.gold + '44', backgroundColor: 'rgba(240,165,0,0.06)' },
  anoInfo: { flex: 1 },
  anoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  anoNum: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  atualBadge: { backgroundColor: Colors.gold + '33', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  atualText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  anoDates: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 8 },
  trimRow: { flexDirection: 'row', gap: 6 },
  trimBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: Colors.border },
  trimBadgeActive: { backgroundColor: Colors.info + '33' },
  trimText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  trimTextActive: { color: Colors.info },
  anoActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ativarBtn: { backgroundColor: Colors.success + '22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  ativarText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.success },
  deleteBtn: { padding: 6, backgroundColor: Colors.danger + '22', borderRadius: 8 },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  userEmail: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.gold + '44', backgroundColor: Colors.gold + '11', marginTop: 12 },
  exportText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.gold },
  configEscolaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: Colors.surface, borderRadius: 12 },
  configEscolaNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1, lineHeight: 20 },
  configEscolaCodigo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  configSectionDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  configToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  configToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  configToggleIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  configToggleLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  configToggleDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  configWarnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.warning + '18', borderRadius: 10, padding: 12, marginTop: 10 },
  configWarnText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.warning, lineHeight: 17 },
  configFieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  configFieldCol: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  configFieldLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  configFieldDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  configNumInput: { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.gold, textAlign: 'center', minWidth: 60 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  roleBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  roleBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%', width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  inputGroup: { marginBottom: 0 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  avalStepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  avalStepBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  avalStepBtnDisabled: { opacity: 0.35 },
  avalStepValue: { width: 44, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.gold + '55', alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  avalStepValueText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold },
});
