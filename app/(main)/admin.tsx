import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import DatePickerField from '@/components/DatePickerField';
import { useAnoAcademico, type AnoAcademico } from '@/context/AnoAcademicoContext';
import { useAuth, UserRole, AUTHORIZED_APPROVER_ROLES } from '@/context/AuthContext';
import { useUsers } from '@/context/UsersContext';
import { useData } from '@/context/DataContext';
import { useRegistro, SolicitacaoRegistro } from '@/context/RegistroContext';
import { useConfig } from '@/context/ConfigContext';
import GestaoAcessosPanel from '@/components/GestaoAcessosPanel';
import { alertSucesso, alertErro } from '@/utils/toast';
import { useLookup } from '@/hooks/useLookup';
import { webAlert } from '@/utils/webAlert';
import { api } from '@/lib/api';


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
  nome: '',
  codigoMED: '',
  morada: '',
  municipio: '',
  provincia: '',
  telefone: '',
  email: '',
  directorGeral: '',
  subdirectorPedagogico: '',
  maxAlunosTurma: '35',
  horarioFuncionamento: 'Seg-Sex: 07:00-19:00 | Sáb: 07:00-13:00',
};

const AREAS_FORMACAO_DEFAULT = [
  'Ciências e Tecnologia',
  'Ciências Económicas, Jurídicas e Sociais',
  'Humanidades',
  'Artes',
  'Ciências de Informação e Comunicação',
  'Formação de Professores',
];

interface Curso {
  id: string; nome: string; codigo: string; areaFormacao: string; descricao: string; ativo: boolean;
  cargaHoraria?: number; duracao?: string; ementa?: string; portaria?: string;
}

const SECTION_COLORS: Record<string, string> = {
  matriculas: Colors.warning,
  cursos: '#A78BFA',
  disciplinas: '#22D3EE',
  escola: Colors.info,
  anos: '#9B59B6',
  usuarios: Colors.gold,
  acessos: '#8B5CF6',
  config: Colors.success,
  comunicacoes: Colors.accent,
  seguranca: Colors.danger,
  reabertura: Colors.warning,
};

const GROUPS = [
  {
    key: 'academico',
    label: 'Académico',
    icon: 'school' as const,
    color: Colors.warning,
    sections: ['matriculas', 'cursos', 'disciplinas', 'anos', 'reabertura'],
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
  const router = useRouter();
  const { section: paramSection, group: paramGroup } = useLocalSearchParams<{ section?: string; group?: string }>();
  const { anos, addAno, updateAno, ativarAno, deleteAno } = useAnoAcademico();
  const { user } = useAuth();
  const { users, addUser, deleteUser } = useUsers();
  const { addProfessor } = useData();
  const { pendentes, aprovadas, rejeitadas, aprovarSolicitacao, rejeitarSolicitacao, deletarSolicitacao } = useRegistro();
  const { config, updateConfig, updateFlashScreen } = useConfig();
  const { values: areasFormacao } = useLookup('areas_curso', AREAS_FORMACAO_DEFAULT);

  // ── Backup & Export ───────────────────────────────────────
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportTabela, setExportTabela] = useState('alunos');

  // ultimoBackup is stored in DB config (not localStorage)
  const ultimoBackup = config?.ultimoBackup ?? null;

  async function handleBackup() {
    if (backupLoading) return;
    setBackupLoading(true);
    try {
      const { getAuthToken } = await import('@/context/AuthContext');
      const { getApiUrl } = await import('@/lib/query-client');
      const token = await getAuthToken();
      const url = new URL('/api/admin/backup', getApiUrl()).toString();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const link = document.createElement('a');
      const filename = `sige-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const agora = new Date().toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      // Save last backup timestamp to database config
      await updateConfig({ ultimoBackup: agora } as never);
      alertSucesso('Backup concluído', `Ficheiro ${filename} descarregado com sucesso.`);
    } catch (e: any) {
      alertErro('Erro no Backup', e.message ?? 'Ocorreu um erro ao gerar o backup.');
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleExportCSV() {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      const { getAuthToken } = await import('@/context/AuthContext');
      const { getApiUrl } = await import('@/lib/query-client');
      const token = await getAuthToken();
      const url = new URL(`/api/admin/export-csv?tabela=${exportTabela}`, getApiUrl()).toString();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const link = document.createElement('a');
      const filename = `sige-${exportTabela}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      alertSucesso('Exportação concluída', `Ficheiro ${filename} descarregado com sucesso.`);
    } catch (e: any) {
      alertErro('Erro na Exportação', e.message ?? 'Ocorreu um erro ao exportar os dados.');
    } finally {
      setExportLoading(false);
    }
  }

  // ── Reabertura de Campos de Notas ─────────────────────────
  interface ReaNotaRow {
    id: string; alunoId: string; turmaId: string; disciplina: string; trimestre: number;
    pedidosReabertura: any[]; alunoNome?: string; alunoApelido?: string; turmaNome?: string;
  }
  const [activeSection, setActiveSection] = useState<string>(paramSection || 'matriculas');

  const [reaNotas, setReaNotas] = useState<ReaNotaRow[]>([]);
  const [reaLoading, setReaLoading] = useState(false);
  const [reaResponding, setReaResponding] = useState<string | null>(null);
  const [reaObsModal, setReaObsModal] = useState<{ notaId: string; pedidoId: string; decisao: 'aprovada' | 'rejeitada'; label: string } | null>(null);
  const [reaObs, setReaObs] = useState('');

  const reaPendentes = useMemo(() =>
    reaNotas.flatMap(n => (n.pedidosReabertura || []).filter((p: any) => p.status === 'pendente').map((p: any) => ({ ...p, _notaId: n.id, _nota: n }))),
    [reaNotas]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeSection === 'reabertura') fetchReabertura();
  }, [activeSection]);

  async function fetchReabertura() {
    setReaLoading(true);
    try {
      const list = await api.get<ReaNotaRow[]>('/api/notas/reabertura-pendentes');
      setReaNotas(list);
    } catch { setReaNotas([]); }
    finally { setReaLoading(false); }
  }

  async function responderReabertura(notaId: string, pedidoId: string, decisao: 'aprovada' | 'rejeitada', observacao: string) {
    setReaResponding(pedidoId);
    try {
      await api.put(`/api/notas/${notaId}/responder-reabertura`, { pedidoId, decisao, observacao });
      alertSucesso(decisao === 'aprovada' ? 'Aprovado' : 'Rejeitado', `O pedido foi ${decisao === 'aprovada' ? 'aprovado' : 'rejeitado'} com sucesso.`);
      setReaObsModal(null);
      setReaObs('');
      await fetchReabertura();
    } catch { webAlert('Erro', 'Não foi possível responder ao pedido.'); }
    finally { setReaResponding(null); }
  }

  const SISTEMA_SECS = ['escola', 'config', 'comunicacoes', 'seguranca'];
  const [sistemaFullPage, setSistemaFullPage] = useState(false);

  const [escola, setEscola] = useState<EscolaConfig>(DEFAULT_ESCOLA);
  const [editEscola, setEditEscola] = useState(false);
  const [tempEscola, setTempEscola] = useState<EscolaConfig>(DEFAULT_ESCOLA);

  const [cursosList, setCursosList] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [showCursoForm, setShowCursoForm] = useState(false);
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null);
  const [savingCurso, setSavingCurso] = useState(false);
  const [cursoForm, setCursoForm] = useState({ nome: '', codigo: '', areaFormacao: AREAS_FORMACAO_DEFAULT[0], descricao: '', cargaHoraria: '', duracao: '', ementa: '', portaria: '' });
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [relatorioData, setRelatorioData] = useState<any[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  interface DisciplinaCat { id: string; nome: string; codigo: string; area: string; ativo: boolean; }
  interface DiscMeta { cargaHoraria: number; obrigatoria: boolean; }
  const [gDiscCurso, setGDiscCurso] = useState<Curso | null>(null);
  const [gDiscCatalogo, setGDiscCatalogo] = useState<DisciplinaCat[]>([]);
  const [gDiscSelected, setGDiscSelected] = useState<string[]>([]);
  const [gDiscMeta, setGDiscMeta] = useState<Record<string, DiscMeta>>({});
  const [gDiscSaving, setGDiscSaving] = useState(false);

  async function abrirGestaoDisciplinas(c: Curso) {
    setGDiscCurso(c);
    setGDiscSelected([]);
    setGDiscCatalogo([]);
    setGDiscMeta({});
    try {
      const [catRes, selRes] = await Promise.all([
        fetch('/api/disciplinas'),
        fetch(`/api/cursos/${c.id}/disciplinas`),
      ]);
      const cat: DisciplinaCat[] = catRes.ok ? await catRes.json() : [];
      const sel: { disciplinaId: string; cargaHoraria: number; obrigatoria: boolean }[] = selRes.ok ? await selRes.json() : [];
      setGDiscCatalogo(cat.filter(d => d.ativo));
      setGDiscSelected(sel.map(s => s.disciplinaId));
      const meta: Record<string, DiscMeta> = {};
      sel.forEach(s => { meta[s.disciplinaId] = { cargaHoraria: s.cargaHoraria || 0, obrigatoria: s.obrigatoria !== false }; });
      setGDiscMeta(meta);
    } catch {}
  }

  function toggleGDisc(id: string) {
    setGDiscSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function setDiscCarga(id: string, val: string) {
    const n = parseInt(val) || 0;
    setGDiscMeta(prev => ({ ...prev, [id]: { ...(prev[id] || { obrigatoria: true }), cargaHoraria: n } }));
  }

  function toggleDiscObrig(id: string) {
    setGDiscMeta(prev => ({ ...prev, [id]: { ...(prev[id] || { cargaHoraria: 0 }), obrigatoria: !(prev[id]?.obrigatoria !== false) } }));
  }

  async function guardarDiscCurso() {
    if (!gDiscCurso) return;
    setGDiscSaving(true);
    try {
      const disciplinas = gDiscSelected.map(did => ({
        disciplinaId: did,
        cargaHoraria: gDiscMeta[did]?.cargaHoraria || 0,
        obrigatoria: gDiscMeta[did]?.obrigatoria !== false,
      }));
      const res = await fetch(`/api/cursos/${gDiscCurso.id}/disciplinas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disciplinas }),
      });
      if (!res.ok) throw new Error('Erro ao guardar');
      alertSucesso('Matriz actualizada', `A matriz curricular do curso "${gDiscCurso.nome}" foi actualizada. As disciplinas removidas foram preservadas no histórico.`);
      setGDiscCurso(null);
    } catch (e: any) { alertErro('Erro', e.message); }
    setGDiscSaving(false);
  }

  async function abrirRelatorio() {
    setShowRelatorio(true);
    setLoadingRelatorio(true);
    try {
      const res = await fetch('/api/cursos/relatorio');
      if (res.ok) setRelatorioData(await res.json());
    } catch {}
    setLoadingRelatorio(false);
  }

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
    setCursoForm({ nome: '', codigo: '', areaFormacao: areasFormacao[0] || AREAS_FORMACAO_DEFAULT[0], descricao: '', cargaHoraria: '', duracao: '', ementa: '', portaria: '' });
    setShowNovoAno(false); // Garantir que outros modais estão fechados
    setShowCursoForm(true);
  }

  function abrirEditarCurso(c: Curso) {
    setEditingCurso(c);
    setCursoForm({ nome: c.nome, codigo: c.codigo, areaFormacao: c.areaFormacao, descricao: c.descricao, cargaHoraria: String(c.cargaHoraria || ''), duracao: c.duracao || '', ementa: c.ementa || '', portaria: c.portaria || '' });
    setShowCursoForm(true);
  }

  async function salvarCurso() {
    if (!cursoForm.nome.trim()) { webAlert('Campo obrigatório', 'Introduza o nome do curso.'); return; }
    if (!cursoForm.areaFormacao.trim()) { webAlert('Campo obrigatório', 'Introduza a área de formação do curso.'); return; }
    setSavingCurso(true);
    try {
      const method = editingCurso ? 'PUT' : 'POST';
      const url = editingCurso ? `/api/cursos/${editingCurso.id}` : '/api/cursos';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cursoForm, cargaHoraria: parseInt(cursoForm.cargaHoraria) || 0, ativo: true }),
      });
      if (!res.ok) throw new Error('Erro ao guardar');
      await fetchCursos();
      setShowCursoForm(false);
      alertSucesso(editingCurso ? 'Curso actualizado' : 'Curso criado', editingCurso ? 'O curso foi actualizado com sucesso.' : 'O novo curso foi criado com sucesso.');
    } catch (e: any) { alertErro('Erro', e.message); }
    setSavingCurso(false);
  }

  async function deleteCurso(id: string) {
    try {
      const res = await fetch(`/api/cursos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao eliminar curso');
      }
      await fetchCursos();
      alertSucesso('Curso eliminado', 'O curso foi removido com sucesso.');
    } catch (e) {
      console.error('Erro ao eliminar curso:', e);
      webAlert('Erro', (e as Error).message);
    }
  }

  async function toggleCursoAtivo(c: Curso) {
    try {
      const res = await fetch(`/api/cursos/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, ativo: !c.ativo }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar status do curso');
      await fetchCursos();
    } catch (e) {
      console.error('Erro ao alternar status do curso:', e);
      webAlert('Erro', 'Não foi possível atualizar o estado do curso.');
    }
  }

  const [showNovoAno, setShowNovoAno] = useState(false);
  const [showNovoUser, setShowNovoUser] = useState(false);
  const [formAno, setFormAno] = useState({ ano: '', dataInicio: '', dataFim: '' });
  const [modalAnoDuplicado, setModalAnoDuplicado] = useState<{ visible: boolean; anoExistente: string }>({ visible: false, anoExistente: '' });
  const [confirmDeleteAno, setConfirmDeleteAno] = useState<{ visible: boolean; ano: AnoAcademico | null; loading: boolean; erro: string | null }>({ visible: false, ano: null, loading: false, erro: null });
  const [formUser, setFormUser] = useState({ nome: '', email: '', role: 'professor' as UserRole, senha: '', numeroProfessor: '', telefone: '', habilitacoes: '' });
  const [activeGroup, setActiveGroup] = useState<string>(paramGroup || 'academico');

  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current && paramSection) {
      setActiveSection(paramSection);
      if (paramGroup) setActiveGroup(paramGroup);
      initialised.current = true;
    }
  }, [paramSection, paramGroup]);

  const cursosFetched = useRef(false);
  useEffect(() => {
    if (activeSection === 'cursos' && !cursosFetched.current) {
      cursosFetched.current = true;
      fetchCursos();
    }
    if (activeSection !== 'cursos') {
      cursosFetched.current = false;
    }
  }, [activeSection]);

  const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoRegistro | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [matriculasTab, setMatriculasTab] = useState<'pendente' | 'aprovado' | 'rejeitado'>('pendente');
  const [papDiscInput, setPapDiscInput] = useState('');
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
  const [emisTesting, setEmisTesting] = useState(false);
  const [emisTestResult, setEmisTestResult] = useState<{ sucesso: boolean; mensagem: string } | null>(null);

  const isApprover = user && AUTHORIZED_APPROVER_ROLES.includes(user.role);

  useEffect(() => {
    setEscola({
      nome: config.nomeEscola || '',
      codigoMED: config.codigoMED || '',
      morada: config.morada || '',
      municipio: config.municipioEscola || '',
      provincia: config.provinciaEscola || '',
      telefone: config.telefoneEscola || '',
      email: config.emailEscola || '',
      directorGeral: config.directorGeral || '',
      subdirectorPedagogico: config.directorPedagogico || '',
      maxAlunosTurma: String(config.maxAlunosTurma || 35),
      horarioFuncionamento: config.horarioFuncionamento || '',
    });
  }, [config]);

  async function testarLigacaoEmis() {
    if (!config.numeroEntidade?.trim()) {
      alertErro('Campo obrigatório', 'Preencha o Número de Entidade primeiro.');
      return;
    }
    setEmisTesting(true);
    setEmisTestResult(null);
    try {
      const result = await api.post<{ sucesso: boolean; mensagem: string }>('/api/emis/testar-ligacao', {
        entidadeId: config.numeroEntidade,
        apiKey: config.emisApiKey,
        apiUrl: config.emisApiUrl,
        ambiente: config.emisAmbiente || 'sandbox',
      });
      setEmisTestResult(result);
    } catch { setEmisTestResult({ sucesso: false, mensagem: 'Erro de rede ao testar a ligação.' }); }
    finally { setEmisTesting(false); }
  }

  async function salvarEscola() {
    await updateConfig({
      nomeEscola: tempEscola.nome,
      codigoMED: tempEscola.codigoMED || undefined,
      morada: tempEscola.morada || undefined,
      municipioEscola: tempEscola.municipio || undefined,
      provinciaEscola: tempEscola.provincia || undefined,
      telefoneEscola: tempEscola.telefone || undefined,
      emailEscola: tempEscola.email || undefined,
      directorGeral: tempEscola.directorGeral || undefined,
      directorPedagogico: tempEscola.subdirectorPedagogico || undefined,
      maxAlunosTurma: parseInt(tempEscola.maxAlunosTurma) || 35,
      horarioFuncionamento: tempEscola.horarioFuncionamento,
    });
    setEscola(tempEscola);
    setEditEscola(false);
    alertSucesso('Escola actualizada', 'Os dados da escola foram guardados na base de dados.');
  }

  async function criarUser() {
    if (!formUser.nome.trim() || !formUser.email.trim() || !formUser.senha.trim()) {
      webAlert('Erro', 'Nome, email e senha são obrigatórios.');
      return;
    }
    if (users.some(u => u.email.toLowerCase() === formUser.email.toLowerCase().trim())) {
      webAlert('Erro', 'Já existe um utilizador com este email.');
      return;
    }

    try {
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
          telefone: formUser.telefone.trim(),
          email: formUser.email.toLowerCase().trim(),
          habilitacoes: formUser.habilitacoes.trim(),
          ativo: true,
        });
      }
      setShowNovoUser(false);
      setFormUser({ nome: '', email: '', role: 'professor', senha: '', numeroProfessor: '', telefone: '', habilitacoes: '' });
      alertSucesso('Utilizador criado', `${formUser.nome} foi criado com sucesso no sistema.`);
    } catch (e) {
      console.error('Erro ao criar utilizador:', e);
      webAlert('Erro', 'Não foi possível criar o utilizador. Verifique os dados e tente novamente.');
    }
  }

  function confirmarEliminarUser(id: string, nome: string) {
    webAlert(
      'Eliminar Utilizador',
      `Deseja eliminar o utilizador "${nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteUser(id) },
      ]
    );
  }

  async function criarAno() {
    console.log("Tentando criar ano:", formAno);
    if (!formAno.ano || !formAno.dataInicio || !formAno.dataFim) {
      webAlert('Erro', 'Preencha todos os campos.');
      return;
    }

    try {
      console.log("Chamando addAno...");
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
      console.log("addAno concluído com sucesso.");
      setShowNovoAno(false);
      setFormAno({ ano: '', dataInicio: '', dataFim: '' });
      alertSucesso('Ano académico criado', `O ano lectivo ${formAno.ano} foi criado com sucesso.`);
    } catch (e) {
      console.error('Erro ao criar ano académico:', e);
      const msg = (e as Error).message || '';
      if (msg.includes('409') || msg.includes('ANO_DUPLICADO') || msg.includes('Já existe')) {
        setShowNovoAno(false);
        setModalAnoDuplicado({ visible: true, anoExistente: formAno.ano });
      } else {
        webAlert('Erro', 'Não foi possível criar o ano académico: ' + msg);
      }
    }
  }

  async function handleDeleteAnoConfirm() {
    if (!confirmDeleteAno.ano) return;
    setConfirmDeleteAno(p => ({ ...p, loading: true, erro: null }));
    try {
      await deleteAno(confirmDeleteAno.ano.id);
      setConfirmDeleteAno({ visible: false, ano: null, loading: false, erro: null });
      alertSucesso('Ano eliminado', `O ano académico ${confirmDeleteAno.ano.ano} foi eliminado com sucesso.`);
    } catch (e) {
      const msg = (e as Error).message || '';
      let erroLegivel = 'Não foi possível eliminar o ano académico.';
      if (msg.includes('turmas') || msg.includes('vinculadas')) {
        erroLegivel = `O ano "${confirmDeleteAno.ano.ano}" possui turmas vinculadas e não pode ser eliminado. Elimine primeiro todas as turmas deste ano.`;
      } else if (msg.includes('400') || msg.includes('409')) {
        try { erroLegivel = JSON.parse(msg.slice(msg.indexOf('{'))).error; } catch { /* usa msg padrão */ }
      }
      setConfirmDeleteAno(p => ({ ...p, loading: false, erro: erroLegivel }));
    }
  }

  function handleAprovar(s: SolicitacaoRegistro) {
    webAlert(
      'Aprovar Matrícula',
      `Aprovar a solicitação de "${s.nomeCompleto}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: async () => {
            await aprovarSolicitacao(s.id, user?.nome || 'Administrador');
            setSelectedSolicitacao(null);
            alertSucesso('Matrícula aprovada', `A matrícula de ${s.nomeCompleto} foi aprovada com sucesso.`);
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
      webAlert('Motivo obrigatório', 'Indique o motivo da rejeição.'); return;
    }
    await rejeitarSolicitacao(selectedSolicitacao.id, user?.nome || 'Administrador', motivoRejeicao.trim());
    setShowRejeitar(false);
    setSelectedSolicitacao(null);
    webAlert('Rejeitado', 'A solicitação foi rejeitada.');
  }

  const allSections = [
    { key: 'matriculas', label: 'Matrículas', icon: 'person-add', badge: pendentes.length },
    { key: 'cursos', label: 'Cursos', icon: 'library' },
    { key: 'disciplinas', label: 'Disciplinas', icon: 'book' },
    { key: 'escola', label: 'Escola', icon: 'school' },
    { key: 'anos', label: 'Ano Académico', icon: 'calendar' },
    { key: 'reabertura', label: 'Reabertura Notas', icon: 'lock-open', badge: reaPendentes.length > 0 ? reaPendentes.length : undefined },
    { key: 'usuarios', label: 'Utilizadores', icon: 'people' },
    { key: 'acessos', label: 'Acessos', icon: 'key' },
    { key: 'config', label: 'Configurações', icon: 'settings' },
    { key: 'comunicacoes', label: 'Comunicações', icon: 'megaphone' },
    { key: 'seguranca', label: 'Segurança', icon: 'shield-checkmark' },
  ];

  const currentSolicitacoes = matriculasTab === 'pendente' ? pendentes : matriculasTab === 'aprovado' ? aprovadas : rejeitadas;

  return (
    <View style={styles.container}>
      <TopBar title="Super Admin" subtitle="Gestão do Sistema QUETA" />

      {/* ── Hero Banner ───────────────────────────────────── */}
      {!sistemaFullPage && (
      <LinearGradient
        colors={['#1A0A2E', '#0D1F35', '#1A1030']}
        style={styles.heroBanner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroLeft}>
          <LinearGradient colors={['#4A90D9', '#8B0000']} style={styles.heroIconWrap}>
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
      )}

      {/* ── Sistema Full-Page compact header ──────────────── */}
      {sistemaFullPage && (() => {
        const sec = allSections.find(s => s.key === activeSection);
        const secColor = SECTION_COLORS[activeSection] || Colors.gold;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <TouchableOpacity
              onPress={() => { setSistemaFullPage(false); setActiveSection(''); }}
              style={{ padding: 4 }}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.gold} />
            </TouchableOpacity>
            {sec && <Ionicons name={sec.icon as any} size={16} color={secColor} />}
            <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', color: Colors.text, fontSize: 15 }}>
              {sec?.label ?? 'Sistema'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted }}>
              Sistema
            </Text>
          </View>
        );
      })()}

      {/* ── Group Navigation (Level 1) ────────────────────── */}
      {!sistemaFullPage && (
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
              onPress={() => { setActiveGroup(g.key); setActiveSection(g.sections[0]); setSistemaFullPage(false); }}
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
      )}

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
                onPress={() => { setActiveSection(sk); if (SISTEMA_SECS.includes(sk)) setSistemaFullPage(true); }}
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
                          onPress={() => webAlert('Eliminar', 'Eliminar este registo?', [
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
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.3)', borderWidth: 1 }]}
                  onPress={abrirRelatorio}
                >
                  <Ionicons name="document-text-outline" size={15} color="#22D3EE" />
                  <Text style={[styles.editBtnText, { color: '#22D3EE' }]}>Relatório</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: '#A78BFA22', borderColor: '#A78BFA55', borderWidth: 1 }]}
                  onPress={() => abrirNovoCurso()}
                >
                  <Ionicons name="add" size={15} color="#A78BFA" />
                  <Text style={[styles.editBtnText, { color: '#A78BFA' }]}>Novo Curso</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', padding: 12, marginBottom: 4 }}>
              <Ionicons name="information-circle-outline" size={16} color="#A78BFA" />
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1, lineHeight: 18 }}>
                Os cursos parametrizados aqui são disponibilizados apenas para inscrições da <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#A78BFA' }}>10ª Classe (II Ciclo)</Text>. Organize-os por Área de Formação.
              </Text>
            </View>

            <View style={{ gap: 4 }}>
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
                      {`Toque em "Novo Curso" para adicionar o primeiro curso para a 10ª Classe.`}
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
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                            {!!c.codigo && (
                              <View style={{ backgroundColor: 'rgba(167,139,250,0.18)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#A78BFA' }}>{c.codigo}</Text>
                              </View>
                            )}
                            {!!c.duracao && (
                              <View style={{ backgroundColor: 'rgba(34,211,238,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#22D3EE' }}>{c.duracao}</Text>
                              </View>
                            )}
                            {!!c.cargaHoraria && (
                              <View style={{ backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.gold }}>{c.cargaHoraria}h</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{c.nome}</Text>
                          {!!c.portaria && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 }}>Portaria: {c.portaria}</Text>}
                          {!!c.descricao && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 }} numberOfLines={1}>{c.descricao}</Text>}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity onPress={() => abrirGestaoDisciplinas(c)} style={[styles.exportBtn, { padding: 8, marginBottom: 0, minWidth: 0, borderColor: Colors.info + '44', backgroundColor: Colors.info + '11' }]}>
                            <Ionicons name="book-outline" size={15} color={Colors.info} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => abrirEditarCurso(c)} style={[styles.exportBtn, { padding: 8, marginBottom: 0, minWidth: 0, borderColor: Colors.gold + '44' }]}>
                            <Ionicons name="pencil-outline" size={15} color={Colors.gold} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => {
                            webAlert('Opções do Curso', `O que deseja fazer com "${c.nome}"?`, [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: c.ativo ? 'Desactivar' : 'Activar', onPress: () => toggleCursoAtivo(c) },
                              { text: 'Eliminar permanentemente', style: 'destructive', onPress: () => deleteCurso(c.id) },
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
          </View>
        )}

        {/* DISCIPLINAS */}
        {activeSection === 'disciplinas' && (
          <View style={styles.card}>
            <SectionHeader title="Catálogo de Disciplinas" icon="book" color="#22D3EE" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,211,238,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,211,238,0.2)', padding: 12, marginBottom: 16 }}>
              <Ionicons name="information-circle-outline" size={16} color="#22D3EE" />
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1, lineHeight: 18 }}>
                Aqui gere o catálogo central de disciplinas do sistema. Depois de criar as disciplinas, associe-as aos cursos na secção <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#A78BFA' }}>Cursos</Text>.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(main)/disciplinas' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(34,211,238,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)', padding: 18 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(34,211,238,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="book" size={22} color="#22D3EE" />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text }}>Gerir Disciplinas</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 }}>Criar, editar e organizar o catálogo de disciplinas</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#22D3EE" />
            </TouchableOpacity>
            <View style={{ marginTop: 12, gap: 8 }}>
              {[
                { icon: 'add-circle-outline', color: '#22D3EE', text: 'Adicionar novas disciplinas ao catálogo' },
                { icon: 'layers-outline', color: '#A78BFA', text: 'Organizar por área de conhecimento' },
                { icon: 'link-outline', color: Colors.success, text: 'Depois associe as disciplinas a cada Curso (secção Cursos)' },
                { icon: 'grid-outline', color: Colors.warning, text: 'As disciplinas aparecem automaticamente nas turmas e na grelha curricular' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 }}>
                  <Ionicons name={item.icon as any} size={15} color={item.color} style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1, lineHeight: 18 }}>{item.text}</Text>
                </View>
              ))}
            </View>
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
                  {ano.ativo ? (
                    <TouchableOpacity
                      style={[styles.ativarBtn, { backgroundColor: Colors.warning + '22' }]}
                      onPress={() => webAlert('Desactivar Ano', `Deseja desactivar o ano ${ano.ano}? Isso pode limitar algumas funcionalidades até que outro ano seja activado.`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Desactivar', onPress: () => updateAno(ano.id, { ativo: false }) },
                      ])}
                    >
                      <Text style={[styles.ativarText, { color: Colors.warning }]}>Desactivar</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.ativarBtn}
                      onPress={() => webAlert('Activar Ano', `Activar ${ano.ano}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Activar', onPress: () => ativarAno(ano.id) },
                      ])}
                    >
                      <Text style={styles.ativarText}>Activar</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    onPress={() => setConfirmDeleteAno({ visible: true, ano, loading: false, erro: null })}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                  </TouchableOpacity>
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

            {/* ── MASTER SWITCH: PROPINAS ── */}
            <View style={[styles.card, { borderWidth: 2, borderColor: config.propinaHabilitada ? Colors.success + '60' : Colors.danger + '60' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: config.propinaHabilitada ? Colors.success + '20' : Colors.danger + '20' }}>
                  <Ionicons name="cash" size={24} color={config.propinaHabilitada ? Colors.success : Colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text }}>Propinas e Pagamentos</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                    Controla se esta escola cobra propinas. Quando desactivado, todos os alertas de dívida, cálculos de atraso e opções de pagamento são removidos do sistema.
                  </Text>
                </View>
              </View>

              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.propinaHabilitada ? Colors.success + '22' : Colors.danger + '22' }]}>
                    <Ionicons name={config.propinaHabilitada ? 'checkmark-circle' : 'close-circle'} size={18} color={config.propinaHabilitada ? Colors.success : Colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Cobrança de Propinas</Text>
                    <Text style={[styles.configToggleDesc, { color: config.propinaHabilitada ? Colors.success : Colors.danger }]}>
                      {config.propinaHabilitada
                        ? 'ACTIVO — A escola cobra propinas mensais'
                        : 'INACTIVO — Esta escola não cobra propinas'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={config.propinaHabilitada}
                  onValueChange={v => updateConfig({ propinaHabilitada: v })}
                  trackColor={{ false: Colors.danger + '88', true: Colors.success + '88' }}
                  thumbColor={config.propinaHabilitada ? Colors.success : Colors.danger}
                />
              </View>

              {!config.propinaHabilitada && (
                <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, backgroundColor: Colors.warning + '18', borderRadius: 10, padding: 12, alignItems: 'flex-start' }}>
                  <Ionicons name="information-circle" size={16} color={Colors.warning} />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.warning, flex: 1, lineHeight: 16 }}>
                    Com as propinas desactivadas: os encarregados não verão alertas de dívida, o portal financeiro não mostrará cálculos de atraso, e o boletim de propinas indicará que a escola não cobra mensalidades.
                  </Text>
                </View>
              )}
            </View>

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
                    webAlert(
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

              {/* Datas do período */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Data de Início</Text>
                  <TextInput
                    style={styles.input}
                    value={config.inscricaoDataInicio ?? ''}
                    onChangeText={v => updateConfig({ inscricaoDataInicio: v || undefined })}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Data de Fim</Text>
                  <TextInput
                    style={styles.input}
                    value={config.inscricaoDataFim ?? ''}
                    onChangeText={v => updateConfig({ inscricaoDataFim: v || undefined })}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>
                As datas são exibidas no ecrã de Login quando as inscrições estão abertas.
              </Text>
            </View>

            {/* ── Avaliação de Professores — Período ───────────────────────── */}
            <View style={styles.card}>
              <SectionHeader title="Avaliação de Professores" icon="star" />
              <Text style={styles.configSectionDesc}>
                Abre ou fecha o período de avaliação distribuída. Quando activo, secretaria, RH e alunos podem submeter as suas avaliações. Ao abrir, são enviadas notificações automáticas.
              </Text>

              {/* Toggle abrir/fechar período */}
              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.avaliacaoPeriodoAtivo ? Colors.success + '22' : Colors.border }]}>
                    <MaterialCommunityIcons name="star-check-outline" size={18} color={config.avaliacaoPeriodoAtivo ? Colors.success : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Período de Avaliação</Text>
                    <Text style={styles.configToggleDesc}>
                      {config.avaliacaoPeriodoAtivo
                        ? `Aberto — ${config.avaliacaoPeriodoLabel || 'Avaliação em curso'}`
                        : 'Fechado — avaliações não aceites'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={!!config.avaliacaoPeriodoAtivo}
                  onValueChange={async (v) => {
                    await updateConfig({ avaliacaoPeriodoAtivo: v });
                    if (v) {
                      webAlert('Período Aberto', 'O período de avaliação de professores foi aberto. As notificações serão enviadas.');
                      try {
                        await api.post('/api/avaliacoes-parciais/notificar', { periodoLabel: config.avaliacaoPeriodoLabel || 'Avaliação de Professores' });
                      } catch (_) {}
                    } else {
                      webAlert('Período Fechado', 'O período de avaliação de professores foi encerrado.');
                    }
                  }}
                  thumbColor={config.avaliacaoPeriodoAtivo ? Colors.success : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: Colors.success + '55' }}
                />
              </View>

              {/* Label do período */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.configToggleLabel, { marginBottom: 4 }]}>Designação do Período</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  value={config.avaliacaoPeriodoLabel ?? ''}
                  onChangeText={t => updateConfig({ avaliacaoPeriodoLabel: t })}
                  placeholder="Ex: Avaliação 1º Trimestre 2025"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Data início e fim */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.configToggleLabel, { marginBottom: 4 }]}>Data de Início</Text>
                  <TextInput
                    style={styles.input}
                    value={config.avaliacaoPeriodoInicio ?? ''}
                    onChangeText={t => updateConfig({ avaliacaoPeriodoInicio: t })}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.configToggleLabel, { marginBottom: 4 }]}>Data de Fim</Text>
                  <TextInput
                    style={styles.input}
                    value={config.avaliacaoPeriodoFim ?? ''}
                    onChangeText={t => updateConfig({ avaliacaoPeriodoFim: t })}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* Exclusão por Dupla Reprovação */}
            <View style={styles.card}>
              <SectionHeader title="Exclusão por Dupla Reprovação" icon="close-circle" />
              <Text style={styles.configSectionDesc}>
                Quando activo, alunos que reprovem na mesma classe duas vezes ficam automaticamente sujeitos a exclusão (anulação de matrícula).
              </Text>
              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.exclusaoDuasReprovacoes ? Colors.danger + '22' : Colors.border }]}>
                    <MaterialCommunityIcons name="account-cancel" size={18} color={config.exclusaoDuasReprovacoes ? Colors.danger : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Dupla Reprovação → Exclusão</Text>
                    <Text style={styles.configToggleDesc}>
                      {config.exclusaoDuasReprovacoes
                        ? 'Activo — dupla reprovação gera exclusão automática'
                        : 'Inactivo — dupla reprovação não gera exclusão'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={!!config.exclusaoDuasReprovacoes}
                  onValueChange={v => {
                    updateConfig({ exclusaoDuasReprovacoes: v });
                    webAlert(
                      v ? 'Exclusão por Dupla Reprovação Activada' : 'Exclusão por Dupla Reprovação Desactivada',
                      v
                        ? 'Alunos que reprovem duas vezes na mesma classe serão sujeitos a exclusão automática.'
                        : 'A regra de exclusão por dupla reprovação foi desactivada.',
                    );
                  }}
                  thumbColor={config.exclusaoDuasReprovacoes ? Colors.danger : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: Colors.danger + '55' }}
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
                    webAlert(
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
                    webAlert(
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

              <View style={[styles.configToggleRow, { marginTop: 8 }]}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.notasVisiveis ? Colors.success + '22' : Colors.border }]}>
                    <Ionicons name={config.notasVisiveis ? 'eye-outline' : 'eye-off-outline'} size={18} color={config.notasVisiveis ? Colors.success : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Visibilidade das Notas no Portal</Text>
                    <Text style={styles.configToggleDesc}>
                      {config.notasVisiveis
                        ? 'Activada — os estudantes podem ver as notas lançadas'
                        : 'Desactivada — as notas não são visíveis no portal do estudante'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={config.notasVisiveis}
                  onValueChange={v => {
                    updateConfig({ notasVisiveis: v });
                    webAlert(
                      v ? 'Notas Visíveis' : 'Notas Ocultadas',
                      v
                        ? 'Os estudantes já podem consultar as notas lançadas no portal.'
                        : 'As notas foram ocultadas do portal do estudante.',
                    );
                  }}
                  thumbColor={config.notasVisiveis ? Colors.success : Colors.textMuted}
                  trackColor={{ false: Colors.border, true: Colors.success + '55' }}
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

            {/* Prazos de Lançamento de Notas */}
            <View style={styles.card}>
              <SectionHeader title="Prazos de Lançamento de Notas" icon="calendar" color={Colors.warning} />
              <Text style={styles.configSectionDesc}>
                Define a data limite para os professores lançarem as notas de cada trimestre. Após a data definida, o sistema bloqueia automaticamente o lançamento.
              </Text>

              {([
                { key: 't1' as const, label: '1º Trimestre', icon: 'calendar-outline' },
                { key: 't2' as const, label: '2º Trimestre', icon: 'calendar-outline' },
                { key: 't3' as const, label: '3º Trimestre', icon: 'calendar-outline' },
              ] as const).map(({ key, label }) => {
                const valor = config.prazosLancamento?.[key] || '';
                const expirado = valor ? new Date() > new Date(valor + 'T23:59:59') : false;
                return (
                  <View key={key} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={styles.configFieldLabel}>{label}</Text>
                      {valor ? (
                        <View style={[styles.statusBadge ?? {}, {
                          backgroundColor: expirado ? Colors.danger + '22' : Colors.success + '22',
                          paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
                        }]}>
                          <Text style={{ fontSize: 10, color: expirado ? Colors.danger : Colors.success, fontFamily: 'Inter_600SemiBold' }}>
                            {expirado ? 'Prazo Encerrado' : 'Prazo Activo'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <DatePickerField
                      label=""
                      value={valor}
                      onChange={v => {
                        updateConfig({
                          prazosLancamento: {
                            ...config.prazosLancamento,
                            [key]: v,
                          },
                        });
                      }}
                    />
                    {valor ? (
                      <TouchableOpacity
                        onPress={() => {
                          webAlert(
                            'Remover Prazo',
                            `Deseja remover a data limite do ${label}? Os professores poderão lançar notas sem restrição de prazo.`,
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Remover',
                                style: 'destructive',
                                onPress: () => updateConfig({
                                  prazosLancamento: { ...config.prazosLancamento, [key]: undefined },
                                }),
                              },
                            ]
                          );
                        }}
                        style={{ marginTop: 4 }}
                      >
                        <Text style={{ fontSize: 11, color: Colors.danger, fontFamily: 'Inter_500Medium' }}>
                          Remover prazo do {label}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}

              <View style={[styles.configWarnBox ?? {}, { marginTop: 8, flexDirection: 'row', gap: 8, backgroundColor: Colors.warning + '18', padding: 12, borderRadius: 10, alignItems: 'flex-start' }]}>
                <Ionicons name="information-circle" size={16} color={Colors.warning} />
                <Text style={{ fontSize: 11, color: Colors.warning, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 16 }}>
                  Quando o prazo expira, os professores vêem a pauta em modo de leitura e podem solicitar reabertura à direcção.
                </Text>
              </View>
            </View>

            {/* PAP — 13ª Classe */}
            <View style={styles.card}>
              <SectionHeader title="PAP — 13ª Classe / Ensino Técnico-Profissional" icon="ribbon" color={Colors.gold} />
              <Text style={styles.configSectionDesc}>
                Configure a Prova de Aptidão Profissional (PAP) para turmas da 13ª Classe. A Nota PAP é calculada automaticamente: (Estágio + Defesa + Média das Disciplinas) ÷ 3. Esta nota consta no certificado do aluno.
              </Text>

              {/* Toggle PAP habilitado */}
              <View style={styles.configToggleRow}>
                <View style={[styles.configToggleIcon, { backgroundColor: config.papHabilitado ? Colors.gold + '22' : Colors.border }]}>
                  <Ionicons name="ribbon-outline" size={18} color={config.papHabilitado ? Colors.gold : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configToggleLabel}>PAP Habilitado</Text>
                  <Text style={styles.configToggleSub}>
                    {config.papHabilitado ? 'Activo — professores da 13ª Classe têm acesso ao lançamento PAP' : 'Desactivado — a 13ª Classe segue o regime normal'}
                  </Text>
                </View>
                <Switch
                  value={config.papHabilitado}
                  onValueChange={v => updateConfig({ papHabilitado: v })}
                  trackColor={{ false: Colors.border, true: Colors.gold + '55' }}
                  thumbColor={config.papHabilitado ? Colors.gold : Colors.textMuted}
                />
              </View>

              {/* Toggle estágio como disciplina — sempre visível */}
              <View style={[styles.configToggleRow, { marginTop: 8 }]}>
                <View style={[styles.configToggleIcon, { backgroundColor: config.estagioComoDisciplina ? Colors.info + '22' : Colors.border }]}>
                  <Ionicons name="school-outline" size={18} color={config.estagioComoDisciplina ? Colors.info : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configToggleLabel}>Estágio como Disciplina no Plano Curricular</Text>
                  <Text style={styles.configToggleSub}>
                    {config.estagioComoDisciplina
                      ? 'Activo — o estágio aparece como disciplina normal na pauta e no plano curricular'
                      : 'Desactivado — o estágio tem campo próprio no lançamento PAP (campo "Nota do Estágio")'}
                  </Text>
                </View>
                <Switch
                  value={config.estagioComoDisciplina}
                  onValueChange={v => updateConfig({ estagioComoDisciplina: v })}
                  trackColor={{ false: Colors.border, true: Colors.info + '55' }}
                  thumbColor={config.estagioComoDisciplina ? Colors.info : Colors.textMuted}
                />
              </View>

              {config.papHabilitado && (
                <>
                  {/* Disciplinas contribuintes */}
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.configFieldLabel}>Disciplinas Contribuintes para a Nota PAP</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 10, lineHeight: 16 }}>
                      Defina as disciplinas cuja nota final entra no cálculo da PAP (além do Estágio e Defesa). A média dessas notas é usada como terceiro componente da fórmula.{'\n'}
                      Deixe vazio se apenas o Estágio e a Defesa contribuem para a PAP.
                    </Text>

                    {/* Lista de disciplinas actuais */}
                    <View style={{ gap: 6, marginBottom: 10 }}>
                      {(config.papDisciplinasContribuintes || []).map((disc, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gold + '12', borderRadius: 10, borderWidth: 1, borderColor: Colors.gold + '33', paddingHorizontal: 12, paddingVertical: 8 }}>
                          <Ionicons name="book-outline" size={14} color={Colors.gold} style={{ marginRight: 8 }} />
                          <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text }}>{disc}</Text>
                          <TouchableOpacity onPress={() => {
                            const nova = (config.papDisciplinasContribuintes || []).filter((_, j) => j !== i);
                            updateConfig({ papDisciplinasContribuintes: nova });
                          }}>
                            <Ionicons name="close-circle" size={18} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {(config.papDisciplinasContribuintes || []).length === 0 && (
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontStyle: 'italic' }}>
                          Nenhuma disciplina configurada — apenas Estágio e Defesa entram na fórmula.
                        </Text>
                      )}
                    </View>

                    {/* Input para adicionar disciplina */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={papDiscInput}
                        onChangeText={setPapDiscInput}
                        placeholder="Nome da disciplina (ex: Informática)"
                        placeholderTextColor={Colors.textMuted}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const nome = papDiscInput.trim();
                          if (!nome) return;
                          if ((config.papDisciplinasContribuintes || []).includes(nome)) {
                            webAlert('Aviso', 'Esta disciplina já foi adicionada.');
                            return;
                          }
                          updateConfig({ papDisciplinasContribuintes: [...(config.papDisciplinasContribuintes || []), nome] });
                          setPapDiscInput('');
                        }}
                      />
                      <TouchableOpacity
                        style={{ backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => {
                          const nome = papDiscInput.trim();
                          if (!nome) return;
                          if ((config.papDisciplinasContribuintes || []).includes(nome)) {
                            webAlert('Aviso', 'Esta disciplina já foi adicionada.');
                            return;
                          }
                          updateConfig({ papDisciplinasContribuintes: [...(config.papDisciplinasContribuintes || []), nome] });
                          setPapDiscInput('');
                        }}
                      >
                        <Ionicons name="add" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Info box */}
                  <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, backgroundColor: Colors.info + '12', borderRadius: 10, padding: 12, alignItems: 'flex-start' }}>
                    <Ionicons name="information-circle" size={16} color={Colors.info} />
                    <Text style={{ fontSize: 11, color: Colors.info, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 16 }}>
                      Fórmula da Nota PAP:{'\n'}
                      • Sem disciplinas: (Estágio + Defesa) ÷ 2{'\n'}
                      • Com disciplinas: (Estágio + Defesa + Média_Disciplinas) ÷ 3{'\n'}
                      A nota PAP é calculada automaticamente ao lançar as notas.
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Exame Antecipado */}
            <View style={styles.card}>
              <SectionHeader title="Exame Antecipado" icon="time" color={Colors.warning} />
              <Text style={styles.configSectionDesc}>
                Permite que alunos com negativa numa disciplina terminal façam exame antecipado no mesmo ano lectivo, evitando arrastar a reprovação para o ano subsequente. Funcionalidade prevista na política educacional — pode ser activada ou desactivada conforme as directrizes do MED.
              </Text>

              <View style={styles.configToggleRow}>
                <View style={[styles.configToggleIcon, { backgroundColor: config.exameAntecipadoHabilitado ? Colors.warning + '22' : Colors.border }]}>
                  <Ionicons name="time-outline" size={18} color={config.exameAntecipadoHabilitado ? Colors.warning : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configToggleLabel}>Exame Antecipado Habilitado</Text>
                  <Text style={styles.configToggleSub}>
                    {config.exameAntecipadoHabilitado
                      ? 'Activo — alunos com negativa em disciplinas terminais podem solicitar exame antecipado no mesmo ano'
                      : 'Desactivado — alunos transitam com negativa para o ano subsequente (regime normal)'}
                  </Text>
                </View>
                <Switch
                  value={config.exameAntecipadoHabilitado}
                  onValueChange={v => {
                    updateConfig({ exameAntecipadoHabilitado: v });
                    webAlert(
                      v ? 'Exame Antecipado Activado' : 'Exame Antecipado Desactivado',
                      v
                        ? 'Os alunos com negativa em disciplinas terminais poderão solicitar exame antecipado para não arrastar a negativa.'
                        : 'O regime de exame antecipado foi desactivado. Os alunos seguem o regime normal.',
                    );
                  }}
                  trackColor={{ false: Colors.border, true: Colors.warning + '55' }}
                  thumbColor={config.exameAntecipadoHabilitado ? Colors.warning : Colors.textMuted}
                />
              </View>

              <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, backgroundColor: Colors.warning + '12', borderRadius: 10, padding: 12, alignItems: 'flex-start' }}>
                <Ionicons name="information-circle" size={16} color={Colors.warning} />
                <Text style={{ fontSize: 11, color: Colors.warning, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 16 }}>
                  Aplica-se a disciplinas terminais (ex: 10ª ou 11ª Classe). Quando activo, o aluno com nota final negativa nessas disciplinas não vai para o próximo ano com negativa — solicita exame antecipado para resolver a situação no corrente ano lectivo.
                </Text>
              </View>
            </View>

            {/* NOVA SECÇÃO — Pagamentos Online / EMIS */}
            <View style={[styles.card, { borderWidth: 2, borderColor: config.emisHabilitado ? '#10B981' + '60' : Colors.textMuted + '30' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <LinearGradient colors={['#10B981', '#059669']} style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="card" size={24} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text }}>Pagamentos Online (EMIS / Multicaixa)</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                    O estudante recebe uma referência bancária (RUPE), paga em qualquer ATM ou Multicaixa Express e o sistema marca automaticamente como Pago.
                  </Text>
                </View>
              </View>

              {/* Toggle Activar */}
              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: config.emisHabilitado ? '#10B981' + '22' : Colors.danger + '22' }]}>
                    <Ionicons name={config.emisHabilitado ? 'checkmark-circle' : 'close-circle'} size={18} color={config.emisHabilitado ? '#10B981' : Colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Pagamentos Online</Text>
                    <Text style={[styles.configToggleDesc, { color: config.emisHabilitado ? '#10B981' : Colors.danger }]}>
                      {config.emisHabilitado ? 'ACTIVO — Referências geradas automaticamente via API' : 'INACTIVO — Modo manual (referências locais)'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={!!config.emisHabilitado}
                  onValueChange={v => updateConfig({ emisHabilitado: v } as never)}
                  trackColor={{ false: Colors.danger + '88', true: '#10B981' + '88' }}
                  thumbColor={config.emisHabilitado ? '#10B981' : Colors.danger}
                />
              </View>
            </View>

            {/* Info: Como obter credenciais */}
            <View style={[styles.card, { backgroundColor: Colors.info + '0D', borderColor: Colors.info + '30', borderWidth: 1 }]}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name="information-circle" size={20} color={Colors.info} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.info, marginBottom: 6 }}>Como obter as credenciais?</Text>
                  {[
                    '1. Dirija-se ao seu banco parceiro (BFA, BAI, BPC, BIC, etc.) ou à AGT.',
                    '2. Solicite a adesão ao serviço de cobrança por referência bancária / EMIS.',
                    '3. Receberá um Número de Entidade e credenciais de API (API Key + URL).',
                    '4. Preencha os campos abaixo, teste a ligação e active em Produção.',
                  ].map((t, i) => (
                    <Text key={i} style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 }}>{t}</Text>
                  ))}
                </View>
              </View>
            </View>

            {/* Ambiente */}
            <View style={styles.card}>
              <SectionHeader title="Ambiente" icon="globe-outline" color="#10B981" />
              <Text style={[styles.configSectionDesc, { marginBottom: 10 }]}>
                Use Sandbox para testes. Mude para Produção apenas quando tiver as credenciais reais.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['sandbox', 'producao'] as const).map(amb => (
                  <TouchableOpacity
                    key={amb}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: (config.emisAmbiente || 'sandbox') === amb ? (amb === 'sandbox' ? Colors.warning : '#10B981') : Colors.surface, backgroundColor: (config.emisAmbiente || 'sandbox') === amb ? (amb === 'sandbox' ? Colors.warning + '15' : '#10B981' + '15') : Colors.surface }}
                    onPress={() => updateConfig({ emisAmbiente: amb } as never)}
                  >
                    <Ionicons name={amb === 'sandbox' ? 'construct-outline' : 'shield-checkmark'} size={16} color={(config.emisAmbiente || 'sandbox') === amb ? (amb === 'sandbox' ? Colors.warning : '#10B981') : Colors.textMuted} />
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: (config.emisAmbiente || 'sandbox') === amb ? (amb === 'sandbox' ? Colors.warning : '#10B981') : Colors.textMuted }}>
                      {amb === 'sandbox' ? 'Sandbox (Teste)' : 'Produção'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {config.emisAmbiente === 'producao' && (
                <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, backgroundColor: Colors.warning + '18', borderRadius: 10, padding: 12, alignItems: 'flex-start' }}>
                  <Ionicons name="warning" size={14} color={Colors.warning} />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.warning, flex: 1, lineHeight: 16 }}>
                    Modo Produção activo. As referências geradas serão cobradas em ATM e Multicaixa Express reais.
                  </Text>
                </View>
              )}
            </View>

            {/* Banco / Provedor */}
            <View style={styles.card}>
              <SectionHeader title="Banco / Provedor" icon="business" color="#10B981" />
              <Text style={[styles.configSectionDesc, { marginBottom: 10 }]}>Banco com que a escola tem contrato para cobrança por referência.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {['BFA', 'BAI', 'BPC', 'BIC', 'ATL', 'EMIS', 'BCI', 'Outro'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: config.emisProvedor === p ? '#10B981' : Colors.surface, backgroundColor: config.emisProvedor === p ? '#10B981' + '20' : Colors.surface }}
                    onPress={() => updateConfig({ emisProvedor: p, bancoTransferencia: p } as never)}
                  >
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: config.emisProvedor === p ? '#10B981' : Colors.textMuted }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.configFieldLabel}>Nome completo do banco (para recibos)</Text>
              <TextInput
                style={[styles.input, { marginTop: 6 }]}
                value={config.bancoTransferencia || ''}
                onChangeText={v => updateConfig({ bancoTransferencia: v })}
                placeholder="Ex: Banco de Fomento Angola (BFA)"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Credenciais de API */}
            <View style={styles.card}>
              <SectionHeader title="Credenciais de API" icon="key" color={Colors.gold} />
              <Text style={[styles.configSectionDesc, { marginBottom: 10 }]}>Dados fornecidos pelo banco após adesão ao serviço de cobrança.</Text>

              <Text style={styles.configFieldLabel}>Nome do Beneficiário *</Text>
              <TextInput
                style={[styles.input, { marginTop: 6, marginBottom: 12 }]}
                value={config.nomeBeneficiario || ''}
                onChangeText={v => updateConfig({ nomeBeneficiario: v })}
                placeholder="Ex: Escola Secundária N.º 1 de Luanda"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.configFieldLabel}>Número de Entidade *</Text>
              <TextInput
                style={[styles.input, { marginTop: 6, marginBottom: 12 }]}
                value={config.numeroEntidade || ''}
                onChangeText={v => updateConfig({ numeroEntidade: v })}
                placeholder="Ex: 12345"
                keyboardType="number-pad"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.configFieldLabel}>API Key / Token</Text>
              <TextInput
                style={[styles.input, { marginTop: 6, marginBottom: 12 }]}
                value={config.emisApiKey || ''}
                onChangeText={v => updateConfig({ emisApiKey: v } as never)}
                placeholder="Token de autenticação fornecido pelo banco"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />

              <Text style={styles.configFieldLabel}>URL da API</Text>
              <TextInput
                style={[styles.input, { marginTop: 6, marginBottom: 4 }]}
                value={config.emisApiUrl || ''}
                onChangeText={v => updateConfig({ emisApiUrl: v } as never)}
                placeholder="https://api.banco.ao/cobranca/v1/"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 12 }}>
                Em Sandbox pode deixar vazio — o sistema usa o endpoint de teste.
              </Text>

              <Text style={styles.configFieldLabel}>IBAN</Text>
              <TextInput
                style={[styles.input, { marginTop: 6, marginBottom: 12 }]}
                value={config.iban || ''}
                onChangeText={v => updateConfig({ iban: v })}
                placeholder="Ex: AO06.0040.0000.0000.1234.1019.2"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.configFieldLabel}>NIB (alternativo)</Text>
              <TextInput
                style={[styles.input, { marginTop: 6 }]}
                value={config.nib || ''}
                onChangeText={v => updateConfig({ nib: v })}
                placeholder="Ex: 000400001234101920"
                keyboardType="number-pad"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Multicaixa Express */}
            <View style={styles.card}>
              <SectionHeader title="Multicaixa Express" icon="phone-portrait" color={Colors.success} />
              <Text style={[styles.configSectionDesc, { marginBottom: 10 }]}>
                Pagamento directo por telemóvel — o encarregado aprova o pagamento no Multicaixa Express.
              </Text>
              <Text style={styles.configFieldLabel}>Número de Telemóvel (Multicaixa Express)</Text>
              <TextInput
                style={[styles.input, { marginTop: 6 }]}
                value={config.telefoneMulticaixaExpress || ''}
                onChangeText={v => updateConfig({ telefoneMulticaixaExpress: v })}
                placeholder="Ex: 923 456 789"
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textMuted}
              />
              {config.telefoneMulticaixaExpress ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.success }}>Multicaixa Express activo.</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 8 }}>Deixe em branco para desactivar.</Text>
              )}
            </View>

            {/* Comportamento */}
            <View style={styles.card}>
              <SectionHeader title="Comportamento" icon="settings" color={Colors.info} />

              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 8 }}>Prazo de Pagamento (horas)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[12, 24, 48, 72].map(h => (
                  <TouchableOpacity
                    key={h}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: (config.emisPrazoPagamento ?? 24) === h ? Colors.info : Colors.surface, backgroundColor: (config.emisPrazoPagamento ?? 24) === h ? Colors.info + '20' : Colors.surface, alignItems: 'center' }}
                    onPress={() => updateConfig({ emisPrazoPagamento: h } as never)}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: (config.emisPrazoPagamento ?? 24) === h ? Colors.info : Colors.textMuted }}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 6, marginBottom: 14 }}>
                O estudante terá {config.emisPrazoPagamento ?? 24} horas para pagar após receber a referência.
              </Text>

              <View style={styles.configToggleRow}>
                <View style={styles.configToggleLeft}>
                  <View style={[styles.configToggleIcon, { backgroundColor: Colors.info + '22' }]}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={Colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configToggleLabel}>Notificar por SMS</Text>
                    <Text style={styles.configToggleDesc}>Enviar referência de pagamento por SMS ao encarregado</Text>
                  </View>
                </View>
                <Switch
                  value={!!config.emisNotificarSMS}
                  onValueChange={v => updateConfig({ emisNotificarSMS: v } as never)}
                  trackColor={{ false: Colors.textMuted + '44', true: Colors.info + '88' }}
                  thumbColor={config.emisNotificarSMS ? Colors.info : Colors.textMuted}
                />
              </View>
            </View>

            {/* Webhook — Confirmação Automática */}
            <View style={[styles.card, { backgroundColor: '#10B981' + '08', borderColor: '#10B981' + '40', borderWidth: 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ionicons name="flash" size={18} color="#10B981" />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#10B981' }}>Confirmação Automática de Pagamento</Text>
              </View>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
                Quando o estudante paga no ATM ou Multicaixa Express, o banco notifica este sistema automaticamente (webhook) e o estado é marcado como <Text style={{ fontFamily: 'Inter_700Bold', color: '#10B981' }}>Pago</Text> em todas as rubricas correspondentes — sem intervenção manual.
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 6 }}>URL DO WEBHOOK — forneça ao seu banco</Text>
              <View style={{ backgroundColor: Colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: Colors.surface }}>
                <Text selectable style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text, letterSpacing: 0.3 }}>
                  [URL-DO-SISTEMA]/api/emis/webhook
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 8 }}>
                Configure este URL no portal do seu banco como "URL de notificação de pagamento" ou "Webhook URL". O banco chamará este endereço assim que o pagamento for confirmado.
              </Text>
            </View>

            {/* Testar Ligação */}
            <View style={styles.card}>
              <SectionHeader title="Testar Ligação" icon="wifi" color="#10B981" />
              <Text style={[styles.configSectionDesc, { marginBottom: 12 }]}>
                Verifica se as credenciais e o URL estão correctos antes de activar em Produção.
              </Text>

              {emisTestResult && (
                <View style={{ marginBottom: 12, flexDirection: 'row', gap: 10, padding: 12, borderRadius: 10, backgroundColor: emisTestResult.sucesso ? '#10B981' + '18' : Colors.danger + '18', borderWidth: 1, borderColor: emisTestResult.sucesso ? '#10B981' + '55' : Colors.danger + '55', alignItems: 'flex-start' }}>
                  <Ionicons name={emisTestResult.sucesso ? 'checkmark-circle' : 'close-circle'} size={18} color={emisTestResult.sucesso ? '#10B981' : Colors.danger} />
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: emisTestResult.sucesso ? '#10B981' : Colors.danger, lineHeight: 18 }}>
                    {emisTestResult.mensagem}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.info + 'DD', opacity: emisTesting ? 0.6 : 1 }]}
                onPress={testarLigacaoEmis}
                disabled={emisTesting}
              >
                <Ionicons name={emisTesting ? 'hourglass' : 'wifi'} size={17} color="#fff" />
                <Text style={styles.saveBtnText}>{emisTesting ? 'A testar...' : 'Testar Ligação API'}</Text>
              </TouchableOpacity>
            </View>

            {/* Estado actual */}
            <View style={[styles.card, { backgroundColor: Colors.surface }]}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>ESTADO ACTUAL DA INTEGRAÇÃO</Text>
              {[
                { label: 'Estado', value: config.emisHabilitado ? 'Activo' : 'Inactivo', color: config.emisHabilitado ? '#10B981' : Colors.danger },
                { label: 'Ambiente', value: config.emisAmbiente === 'producao' ? 'Produção' : 'Sandbox (Teste)', color: config.emisAmbiente === 'producao' ? '#10B981' : Colors.warning },
                { label: 'Banco / Provedor', value: config.emisProvedor || config.bancoTransferencia || 'Não definido' },
                { label: 'Entidade', value: config.numeroEntidade || 'Não configurado' },
                { label: 'API Key', value: config.emisApiKey ? '••••••••' + (config.emisApiKey as string).slice(-4) : 'Não configurada' },
                { label: 'Prazo Pagamento', value: `${config.emisPrazoPagamento ?? 24} horas` },
                { label: 'Notif. SMS', value: config.emisNotificarSMS ? 'Activo' : 'Inactivo' },
                { label: 'Multicaixa Express', value: config.telefoneMulticaixaExpress || 'Não configurado' },
              ].map(row => (
                <View key={row.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={[styles.infoValue, row.color ? { color: row.color } : {}]}>{row.value}</Text>
                </View>
              ))}
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
                    webAlert('Erro', 'O título é obrigatório.'); return;
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
              { label: 'Último Backup', value: ultimoBackup ?? 'Nenhum backup manual feito', valueColor: ultimoBackup ? Colors.success : undefined },
              { label: 'Tipo de Backup', value: 'Manual (download directo)' },
              { label: 'Versão do Sistema', value: 'QUETA v1.0.0' },
              { label: 'Base de Dados', value: 'Operacional', valueColor: Colors.success },
              { label: 'Destino do Backup', value: 'Ficheiro local (descarregamento)' },
            ].map(row => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={[styles.infoValue, row.valueColor ? { color: row.valueColor } : {}]}>{row.value}</Text>
              </View>
            ))}

            <Text style={{ fontFamily: 'Inter_500Medium', color: Colors.textMuted, fontSize: 12, marginTop: 16, marginBottom: 6 }}>
              EXPORTAR TABELA ESPECÍFICA (CSV)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {['alunos', 'funcionarios', 'utilizadores', 'notas', 'presencas', 'pagamentos', 'turmas'].map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setExportTabela(t)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
                    borderColor: exportTabela === t ? Colors.gold : Colors.border,
                    backgroundColor: exportTabela === t ? Colors.gold + '22' : 'transparent',
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: exportTabela === t ? Colors.gold : Colors.textMuted, textTransform: 'capitalize' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.exportBtn, exportLoading && { opacity: 0.6 }]}
              onPress={handleExportCSV}
              disabled={exportLoading}
            >
              <Ionicons name="download-outline" size={17} color={Colors.gold} />
              <Text style={styles.exportText}>{exportLoading ? 'A exportar...' : `Exportar "${exportTabela}" (CSV)`}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtn, { borderColor: Colors.info + '44', backgroundColor: Colors.info + '11' }, backupLoading && { opacity: 0.6 }]}
              onPress={handleBackup}
              disabled={backupLoading}
            >
              <Ionicons name="cloud-download-outline" size={17} color={Colors.info} />
              <Text style={[styles.exportText, { color: Colors.info }]}>{backupLoading ? 'A gerar backup...' : 'Descarregar Backup Completo (JSON)'}</Text>
            </TouchableOpacity>
            <Text style={{ fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontSize: 11, marginTop: 8 }}>
              O backup inclui todas as tabelas do sistema e é guardado como ficheiro JSON no seu dispositivo.
            </Text>
          </View>
        )}

        {/* REABERTURA DE CAMPOS DE NOTAS */}
        {activeSection === 'reabertura' && (
          <View style={[styles.card, { gap: 12 }]}>
            <View style={styles.cardHeaderRow}>
              <SectionHeader title="Pedidos de Reabertura de Notas" icon="lock-open" color={Colors.warning} />
              <TouchableOpacity onPress={fetchReabertura} style={{ padding: 6 }}>
                <Ionicons name="refresh" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {reaLoading ? (
              <Text style={{ textAlign: 'center', color: Colors.textMuted, paddingVertical: 24, fontFamily: 'Inter_400Regular' }}>A carregar pedidos...</Text>
            ) : reaPendentes.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.text, fontSize: 15, marginTop: 10 }}>Sem pedidos pendentes</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontSize: 13, marginTop: 4 }}>Todos os pedidos foram tratados.</Text>
              </View>
            ) : (
              reaPendentes.map((p: any) => {
                const nota: any = p._nota;
                const alunoNome = `${nota.alunoNome || ''} ${nota.alunoApelido || ''}`.trim() || nota.alunoId;
                const isRes = reaResponding === p.id;
                const campoLabel = p.campo.startsWith('aval') ? `AVAL ${p.campo.replace('aval', '')}` : p.campo === 'pp1' ? 'PP' : p.campo === 'ppt' ? 'PT' : p.campo;
                const dt = p.criadoEm ? new Date(p.criadoEm).toLocaleDateString('pt-PT') : '';
                return (
                  <View key={p.id} style={{ backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.warning + '44', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Ionicons name="lock-closed" size={14} color={Colors.warning} />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: Colors.text, fontSize: 14, flex: 1 }}>{alunoNome}</Text>
                      <View style={{ backgroundColor: Colors.warning + '25', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', color: Colors.warning, fontSize: 11 }}>{campoLabel}</Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontSize: 12 }}>
                      {nota.disciplina} · T{nota.trimestre} · {nota.turmaNome || nota.turmaId} {dt ? `· ${dt}` : ''}
                    </Text>
                    {p.professorNome && (
                      <Text style={{ fontFamily: 'Inter_400Regular', color: Colors.textSecondary, fontSize: 12 }}>Professor: {p.professorNome}</Text>
                    )}
                    <View style={{ backgroundColor: Colors.background, borderRadius: 8, padding: 10 }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, fontSize: 10, marginBottom: 4 }}>MOTIVO</Text>
                      <Text style={{ fontFamily: 'Inter_400Regular', color: Colors.text, fontSize: 13 }}>{p.motivo}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                      <TouchableOpacity
                        style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.success + '20', borderWidth: 1, borderColor: Colors.success + '60' }, isRes && { opacity: 0.5 }]}
                        onPress={() => setReaObsModal({ notaId: p._notaId, pedidoId: p.id, decisao: 'aprovada', label: `${alunoNome} — ${campoLabel}` })}
                        disabled={isRes}
                      >
                        <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                        <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.success, fontSize: 13 }}>Aprovar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.danger + '15', borderWidth: 1, borderColor: Colors.danger + '55' }, isRes && { opacity: 0.5 }]}
                        onPress={() => setReaObsModal({ notaId: p._notaId, pedidoId: p.id, decisao: 'rejeitada', label: `${alunoNome} — ${campoLabel}` })}
                        disabled={isRes}
                      >
                        <Ionicons name="close-circle" size={15} color={Colors.danger} />
                        <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.danger, fontSize: 13 }}>Rejeitar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal Observação Reabertura */}
      <Modal visible={!!reaObsModal} transparent animationType="fade" onRequestClose={() => setReaObsModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 400, width: '90%' }]}>
            <View style={styles.modalHeader}>
              <Ionicons name={reaObsModal?.decisao === 'aprovada' ? 'checkmark-circle' : 'close-circle'} size={20} color={reaObsModal?.decisao === 'aprovada' ? Colors.success : Colors.danger} />
              <Text style={[styles.modalTitle, { flex: 1 }]}>{reaObsModal?.decisao === 'aprovada' ? 'Aprovar Reabertura' : 'Rejeitar Reabertura'}</Text>
              <TouchableOpacity onPress={() => setReaObsModal(null)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.text, fontSize: 13, marginBottom: 6 }}>{reaObsModal?.label}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>Observação opcional (para comunicar ao professor):</Text>
            <TextInput
              style={styles.input}
              placeholder="Observação..."
              placeholderTextColor={Colors.textMuted}
              value={reaObs}
              onChangeText={setReaObs}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setReaObsModal(null)}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 2, backgroundColor: reaObsModal?.decisao === 'aprovada' ? Colors.success : Colors.danger }]}
                onPress={() => reaObsModal && responderReabertura(reaObsModal.notaId, reaObsModal.pedidoId, reaObsModal.decisao, reaObs)}
                disabled={reaResponding !== null}
              >
                <Text style={styles.saveBtnText}>{reaResponding ? 'A processar...' : reaObsModal?.decisao === 'aprovada' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Modal Criar / Editar Curso */}
      <Modal visible={showCursoForm} transparent animationType="slide" onRequestClose={() => setShowCursoForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCurso ? 'Editar Curso' : 'Novo Curso'}</Text>
              <TouchableOpacity onPress={() => setShowCursoForm(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <View style={{ gap: 14 }}>
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
                    placeholder="Ex: CT, CEJS, HUM, ART..."
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Área de Formação *</Text>
                  <View style={{ gap: 8 }}>
                    {areasFormacao.map(a => (
                      <TouchableOpacity
                        key={a}
                        onPress={() => setCursoForm(f => ({ ...f, areaFormacao: a }))}
                        style={[
                          { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', gap: 10 },
                          cursoForm.areaFormacao === a && { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: '#A78BFA' },
                        ]}
                      >
                        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: cursoForm.areaFormacao === a ? '#A78BFA' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                          {cursoForm.areaFormacao === a && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#A78BFA' }} />}
                        </View>
                        <Text style={[
                          { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
                          cursoForm.areaFormacao === a && { color: '#A78BFA', fontFamily: 'Inter_600SemiBold' },
                        ]}>{a}</Text>
                      </TouchableOpacity>
                    ))}
                    {(() => {
                      const isCustom = !!cursoForm.areaFormacao && !areasFormacao.includes(cursoForm.areaFormacao);
                      return (
                        <>
                          <TouchableOpacity
                            onPress={() => { if (!isCustom) setCursoForm(f => ({ ...f, areaFormacao: '' })); }}
                            style={[
                              { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', gap: 10 },
                              (isCustom || cursoForm.areaFormacao === '') && { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: '#A78BFA' },
                            ]}
                          >
                            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: (isCustom || cursoForm.areaFormacao === '') ? '#A78BFA' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                              {(isCustom || cursoForm.areaFormacao === '') && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#A78BFA' }} />}
                            </View>
                            <Text style={[
                              { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
                              (isCustom || cursoForm.areaFormacao === '') && { color: '#A78BFA', fontFamily: 'Inter_600SemiBold' },
                            ]}>Outra área de formação...</Text>
                          </TouchableOpacity>
                          {(isCustom || cursoForm.areaFormacao === '') && (
                            <TextInput
                              style={[styles.input, { marginTop: 2 }]}
                              value={cursoForm.areaFormacao}
                              onChangeText={v => setCursoForm(f => ({ ...f, areaFormacao: v }))}
                              placeholder="Ex: Ciências da Saúde, Turismo, Agropecuária..."
                              placeholderTextColor={Colors.textMuted}
                              autoFocus
                            />
                          )}
                        </>
                      );
                    })()}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Carga Horária (horas)</Text>
                    <TextInput
                      style={styles.input}
                      value={cursoForm.cargaHoraria}
                      onChangeText={v => setCursoForm(f => ({ ...f, cargaHoraria: v.replace(/[^0-9]/g, '') }))}
                      placeholder="Ex: 2400"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Duração</Text>
                    <TextInput
                      style={styles.input}
                      value={cursoForm.duracao}
                      onChangeText={v => setCursoForm(f => ({ ...f, duracao: v }))}
                      placeholder="Ex: 3 anos"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Portaria / Decreto</Text>
                  <TextInput
                    style={styles.input}
                    value={cursoForm.portaria}
                    onChangeText={v => setCursoForm(f => ({ ...f, portaria: v }))}
                    placeholder="Ex: Portaria nº 123/2024"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Descrição</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 60, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={cursoForm.descricao}
                    onChangeText={v => setCursoForm(f => ({ ...f, descricao: v }))}
                    placeholder="Breve descrição do curso..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Ementa</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={cursoForm.ementa}
                    onChangeText={v => setCursoForm(f => ({ ...f, ementa: v }))}
                    placeholder="Conteúdo programático / ementa do curso..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                </View>
              </View>
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: 16 }]}>
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
        </View>
      </Modal>

      {/* Modal Gerir Matriz Curricular de Curso */}
      <Modal visible={!!gDiscCurso} transparent animationType="slide" onRequestClose={() => setGDiscCurso(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Matriz Curricular — {gDiscCurso?.nome}</Text>
              <TouchableOpacity onPress={() => setGDiscCurso(null)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 8, lineHeight: 18 }}>
              Configure a matriz curricular deste curso. Disciplinas removidas são preservadas no histórico.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', padding: 9, marginBottom: 12 }}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.gold} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, flex: 1, lineHeight: 16 }}>
                Seleccione as disciplinas, defina a carga horária de cada uma e se são obrigatórias.
              </Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {gDiscCatalogo.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                  <Ionicons name="book-outline" size={40} color={Colors.textMuted} />
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' }}>
                    Nenhuma disciplina no catálogo. Adicione disciplinas primeiro.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {gDiscCatalogo.map(d => {
                    const sel = gDiscSelected.includes(d.id);
                    const meta = gDiscMeta[d.id] || { cargaHoraria: 0, obrigatoria: true };
                    return (
                      <View key={d.id} style={{ borderRadius: 10, borderWidth: 1, borderColor: sel ? Colors.success + '55' : Colors.border, backgroundColor: sel ? Colors.success + '08' : Colors.surface, overflow: 'hidden' }}>
                        <TouchableOpacity
                          onPress={() => toggleGDisc(d.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}
                        >
                          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: sel ? Colors.success : Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? Colors.success + '22' : 'transparent' }}>
                            {sel && <Ionicons name="checkmark" size={14} color={Colors.success} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: sel ? Colors.text : Colors.textSecondary }}>{d.nome}</Text>
                            {!!d.codigo && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>{d.codigo} · {d.area}</Text>}
                          </View>
                        </TouchableOpacity>
                        {sel && (
                          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10, alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted, marginBottom: 4 }}>Carga Horária (h)</Text>
                              <TextInput
                                style={[styles.input, { height: 34, fontSize: 12, paddingHorizontal: 10 }]}
                                value={meta.cargaHoraria > 0 ? String(meta.cargaHoraria) : ''}
                                onChangeText={v => setDiscCarga(d.id, v.replace(/[^0-9]/g, ''))}
                                placeholder="0"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="numeric"
                              />
                            </View>
                            <TouchableOpacity
                              onPress={() => toggleDiscObrig(d.id)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: meta.obrigatoria ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: meta.obrigatoria ? '#A78BFA55' : Colors.border }}
                            >
                              <Ionicons name={meta.obrigatoria ? 'lock-closed-outline' : 'lock-open-outline'} size={13} color={meta.obrigatoria ? '#A78BFA' : Colors.textMuted} />
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: meta.obrigatoria ? '#A78BFA' : Colors.textMuted }}>{meta.obrigatoria ? 'Obrigatória' : 'Opcional'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setGDiscCurso(null)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, gDiscSaving && { opacity: 0.6 }]}
                onPress={guardarDiscCurso}
                disabled={gDiscSaving}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>{gDiscSaving ? 'A guardar...' : `Guardar (${gDiscSelected.length} disc.)`}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Relatório de Cursos */}
      <Modal visible={showRelatorio} transparent animationType="slide" onRequestClose={() => setShowRelatorio(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Relatório de Cursos</Text>
              <TouchableOpacity onPress={() => setShowRelatorio(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              {loadingRelatorio ? (
                <Text style={{ textAlign: 'center', color: Colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, paddingVertical: 24 }}>A carregar...</Text>
              ) : relatorioData.length === 0 ? (
                <Text style={{ textAlign: 'center', color: Colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, paddingVertical: 24 }}>Nenhum curso activo.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {/* Totais */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', padding: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#A78BFA' }}>{relatorioData.length}</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary }}>Cursos activos</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', padding: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.gold }}>{relatorioData.reduce((s, c) => s + (c.cargaHoraria || 0), 0)}h</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary }}>Carga total</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(34,211,238,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,211,238,0.25)', padding: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#22D3EE' }}>{relatorioData.reduce((s, c) => s + parseInt(c.numDisciplinas || '0'), 0)}</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary }}>Disciplinas</Text>
                    </View>
                  </View>
                  {relatorioData.map((c: any) => (
                    <View key={c.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                            {!!c.codigo && <View style={{ backgroundColor: 'rgba(167,139,250,0.18)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}><Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#A78BFA' }}>{c.codigo}</Text></View>}
                            {!!c.areaFormacao && <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}><Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>{c.areaFormacao}</Text></View>}
                          </View>
                          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text }}>{c.nome}</Text>
                          {!!c.portaria && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 }}>Portaria: {c.portaria}</Text>}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="time-outline" size={13} color={Colors.gold} />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold }}>{c.cargaHoraria || 0}h carga horária</Text>
                        </View>
                        {!!c.duracao && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="calendar-outline" size={13} color='#22D3EE' />
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#22D3EE' }}>{c.duracao}</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="book-outline" size={13} color={Colors.success} />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.success }}>{c.numDisciplinas || 0} disciplinas na matriz</Text>
                        </View>
                        {parseInt(c.cargaHorariaMatriz || '0') > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="layers-outline" size={13} color={Colors.textMuted} />
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>{c.cargaHorariaMatriz}h na matriz</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            <View style={{ marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRelatorio(false)}>
                <Text style={styles.cancelBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Confirmar Eliminação de Ano */}
      <Modal visible={confirmDeleteAno.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 28 }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.danger + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="trash-outline" size={32} color={Colors.danger} />
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 8 }]}>Eliminar Ano Académico</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 4 }}>
              Tem a certeza que pretende eliminar o ano{' '}
              <Text style={{ fontFamily: 'Inter_700Bold', color: Colors.text }}>{'"'}{confirmDeleteAno.ano?.ano}{'"'}</Text>?
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              Esta acção é irreversível. O ano só pode ser eliminado se não tiver turmas vinculadas.
            </Text>

            {!!confirmDeleteAno.erro && (
              <View style={{ backgroundColor: Colors.danger + '15', borderRadius: 10, padding: 12, marginBottom: 16, width: '100%', flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.danger, lineHeight: 18 }}>{confirmDeleteAno.erro}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1 }]}
                onPress={() => setConfirmDeleteAno({ visible: false, ano: null, loading: false, erro: null })}
                disabled={confirmDeleteAno.loading}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1, backgroundColor: confirmDeleteAno.loading ? Colors.danger + '88' : Colors.danger }]}
                onPress={handleDeleteAnoConfirm}
                disabled={confirmDeleteAno.loading}
              >
                {confirmDeleteAno.loading
                  ? <Text style={styles.saveBtnText}>A eliminar...</Text>
                  : <><Ionicons name="trash-outline" size={14} color="#fff" /><Text style={styles.saveBtnText}>Eliminar</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Ano Duplicado */}
      <Modal visible={modalAnoDuplicado.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 28 }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.warning + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="warning-outline" size={34} color={Colors.warning} />
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 8 }]}>Ano Académico Duplicado</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
              Já existe um ano académico{' '}
              <Text style={{ fontFamily: 'Inter_700Bold', color: Colors.warning }}>{'"'}{modalAnoDuplicado.anoExistente}{'"'}</Text>
              {' '}registado no sistema.
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
              Não é permitido criar dois anos académicos iguais em simultâneo. O histórico académico dos estudantes depende de um único ano activo de cada vez. Por favor elimine o duplicado antes de continuar.
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: Colors.warning, width: '100%' }]}
              onPress={() => setModalAnoDuplicado({ visible: false, anoExistente: '' })}
            >
              <Text style={styles.saveBtnText}>Percebido</Text>
            </TouchableOpacity>
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
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Utilizador</Text>
              <TouchableOpacity onPress={() => setShowNovoUser(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                  <View style={{ backgroundColor: Colors.info + '12', borderWidth: 1, borderColor: Colors.info + '30', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 17 }}>
                      O perfil de professor (disciplinas, turmas, etc.) é criado automaticamente e pode ser completado na secção <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.info }}>Professores</Text> após o registo.
                    </Text>
                  </View>
                  <Text style={styles.fieldLabel}>Nº Professor (opcional)</Text>
                  <TextInput style={styles.input} value={formUser.numeroProfessor} onChangeText={v => setFormUser(f => ({ ...f, numeroProfessor: v }))} placeholder="ex: PROF-001 (gerado automaticamente se vazio)" placeholderTextColor={Colors.textMuted} />
                  <Text style={styles.fieldLabel}>Telefone</Text>
                  <TextInput style={styles.input} value={formUser.telefone} onChangeText={v => setFormUser(f => ({ ...f, telefone: v }))} placeholder="9XX XXX XXX" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
                  <Text style={styles.fieldLabel}>Habilitações Académicas</Text>
                  <TextInput style={styles.input} value={formUser.habilitacoes} onChangeText={v => setFormUser(f => ({ ...f, habilitacoes: v }))} placeholder="ex: Licenciatura em Matemática" placeholderTextColor={Colors.textMuted} />
                </>
              )}
              <TouchableOpacity style={[styles.saveBtn, { marginTop: 8, marginBottom: 4 }]} onPress={criarUser}>
                <Text style={styles.saveBtnText}>Criar Utilizador</Text>
              </TouchableOpacity>
            </ScrollView>
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
  configToggleSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderRadius: 24, padding: 20, maxHeight: '92%', width: '100%', maxWidth: 480 },
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
