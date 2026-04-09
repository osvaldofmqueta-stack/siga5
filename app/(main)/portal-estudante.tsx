import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFinanceiro, formatAOA } from '@/context/FinanceiroContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useConfig } from '@/context/ConfigContext';
import TopBar from '@/components/TopBar';
import ContinuidadeStatusModal from '@/components/ContinuidadeStatusModal';
import { webAlert } from '@/utils/webAlert';
import { useEnterToSave } from '@/hooks/useEnterToSave';

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'painel', label: 'Painel', icon: 'grid' },
  { key: 'cartao', label: 'Cartão', icon: 'card' },
  { key: 'notas', label: 'Notas', icon: 'document-text' },
  { key: 'faltas', label: 'Faltas', icon: 'calendar' },
  { key: 'diario', label: 'Diário', icon: 'journal' },
  { key: 'mensagens', label: 'Mensagens', icon: 'chatbubbles' },
  { key: 'materiais', label: 'Materiais', icon: 'folder-open' },
  { key: 'horario', label: 'Horário', icon: 'time' },
  { key: 'financeiro', label: 'Financeiro', icon: 'cash' },
  { key: 'historico', label: 'Histórico', icon: 'bar-chart' },
  { key: 'documentos', label: 'Documentos', icon: 'library' },
] as const;

const CARTAO_TAXA_ID = 'cartao_estudante_anual';
const CARTAO_VALOR = 2500;

type TabKey = typeof TABS[number]['key'];


const TIPOS_DOC = [
  'Declaração de Matrícula',
  'Certidão de Notas',
  'Certidão de Frequência',
  'Declaração de Conclusão de Curso',
  'Histórico Escolar',
  'Diploma',
  'Outros',
];

const RUBRICAS = [
  { id: 'decl_matricula', nome: 'Declaração de Matrícula', valor: 500 },
  { id: 'cert_notas', nome: 'Certidão de Notas', valor: 1000 },
  { id: 'cert_freq', nome: 'Certidão de Frequência', valor: 750 },
  { id: 'historico', nome: 'Histórico Escolar', valor: 2000 },
  { id: 'diploma', nome: 'Diploma', valor: 3000 },
  { id: 'outros', nome: 'Outros Documentos', valor: 500 },
];

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const DIAS_FULL = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
const PERIODOS = [
  { numero: 1, inicio: '07:00', fim: '07:45' },
  { numero: 2, inicio: '07:45', fim: '08:30' },
  { numero: 3, inicio: '08:30', fim: '09:15' },
  { numero: 4, inicio: '09:45', fim: '10:30' },
  { numero: 5, inicio: '10:30', fim: '11:15' },
  { numero: 6, inicio: '11:15', fim: '12:00' },
];

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function getStatusDisciplina(nf: number, trimestre: number) {
  if (nf === 0) return { label: 'Sem nota', color: Colors.textMuted, icon: 'help-circle' };
  if (nf >= 10) return { label: 'Aprovado', color: Colors.success, icon: 'checkmark-circle' };
  if (trimestre < 3) return { label: 'Em atraso', color: Colors.warning, icon: 'warning' };
  return { label: 'Reprovado', color: Colors.danger, icon: 'close-circle' };
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon as any} size={16} color={Colors.gold} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NotaCell({ value, max = 20 }: { value: number; max?: number }) {
  const ok = value >= 10;
  const color = value === 0 ? Colors.textMuted : ok ? Colors.success : Colors.danger;
  return (
    <View style={[styles.notaCell, { borderColor: color + '44' }]}>
      <Text style={[styles.notaValue, { color }]}>{value === 0 ? '—' : value.toFixed(0)}</Text>
    </View>
  );
}

export default function PortalEstudanteScreen() {
  const { user, updateUser } = useAuth();
  const { alunos, turmas, notas, presencas, eventos, updateAluno } = useData();
  const {
    taxas, pagamentos, addPagamento, addPagamentoSelf, updatePagamento, getPagamentosAluno, getTaxasByNivel,
    isAlunoBloqueado, acessoLiberado, getMensagensAluno, marcarMensagemLida: marcarMsgFinLida,
    getRUPEsAluno, getMesesEmAtraso, calcularMulta, multaConfig,
  } = useFinanceiro();
  const { mensagens, materiais, sumarios, pautas, marcarMensagemLida } = useProfessor();
  const { anoSelecionado } = useAnoAcademico();
  const { config } = useConfig();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('painel');
  const [trimestreNotas, setTrimestreNotas] = useState<1 | 2 | 3>(1);
  const [showContinuidade, setShowContinuidade] = useState(false);
  const [diaHorario, setDiaHorario] = useState(0);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [reconfirmacoes, setReconfirmacoes] = useState<any[]>([]);
  const [msgFilter, setMsgFilter] = useState<'todas' | 'turma' | 'privada'>('todas');
  const [msgAberta, setMsgAberta] = useState<any>(null);
  const [materialAberto, setMaterialAberto] = useState<any>(null);
  const [showSolicitacaoModal, setShowSolicitacaoModal] = useState(false);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [showPagarPropina, setShowPagarPropina] = useState(false);
  const [showReconfirmacaoModal, setShowReconfirmacaoModal] = useState(false);
  const [solForm, setSolForm] = useState({ tipo: TIPOS_DOC[0], motivo: '', observacao: '' });
  const [pagForm, setPagForm] = useState({ rubricaId: RUBRICAS[0].id, metodo: 'rupe' as 'rupe' | 'multicaixa', referencia: '' });
  const [propinaMes, setPropinaMs] = useState(new Date().getMonth() + 1);
  const [propinaTrimestre, setPropinaTriestre] = useState<1 | 2 | 3>(1);
  const [propMetodo, setPropMetodo] = useState<'rupe' | 'multicaixa'>('rupe');
  const [isLoading, setIsLoading] = useState(false);
  const [taxaParaPagar, setTaxaParaPagar] = useState<any>(null);
  const [metodoPagarTaxa, setMetodoPagarTaxa] = useState<'rupe' | 'multicaixa'>('rupe');
  const [comprovanteInput, setComprovanteInput] = useState('');
  const [showComprModal, setShowComprModal] = useState(false);
  const [comprPagId, setComprPagId] = useState<string | null>(null);
  const [comprPagText, setComprPagText] = useState('');
  const [showPagarCartao, setShowPagarCartao] = useState(false);
  const [cartaoPayStep, setCartaoPayStep] = useState<'metodos' | 'form' | 'done'>('metodos');
  const [cartaoMetodoExt, setCartaoMetodoExt] = useState<'referencia_atm' | 'multicaixa_express' | 'rupe'>('multicaixa_express');
  const [cartaoPhone, setCartaoPhone] = useState('');
  const [cartaoRefGerada, setCartaoRefGerada] = useState<string | null>(null);
  const [documentosEmitidos, setDocumentosEmitidos] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [faltaFiltroDisc, setFaltaFiltroDisc] = useState<string>('todas');
  const [showPhotoChangedModal, setShowPhotoChangedModal] = useState(false);
  const [filtroDiscDiario, setFiltroDiscDiario] = useState<string>('todas');
  const [sumariosDirectos, setSumariosDirectos] = useState<any[] | null>(null);
  const [registosFalta, setRegistosFalta] = useState<any[]>([]);
  const [exclusoesFalta, setExclusoesFalta] = useState<any[]>([]);
  const [showJustModal, setShowJustModal] = useState<{ disciplina: string; registoId?: string } | null>(null);
  const [justMotivo, setJustMotivo] = useState('');
  const [justSaving, setJustSaving] = useState(false);

  const aluno = alunos.find(a =>
    (user?.alunoId && a.id === user.alunoId) ||
    (a.utilizadorId && user?.id && a.utilizadorId === user.id)
  ) ?? alunos.find(a =>
    a.nome.toLowerCase().includes(user?.nome?.split(' ')[0]?.toLowerCase() || '')
  );
  const turmaAluno = aluno ? turmas.find(t => t.id === aluno.turmaId) : null;
  const anoLetivo = anoSelecionado?.ano || new Date().getFullYear().toString();

  const notasAluno = aluno ? notas.filter(n => n.alunoId === aluno.id && n.anoLetivo === anoLetivo) : [];
  const presAluno = aluno ? presencas.filter(p => p.alunoId === aluno.id) : [];
  const pagamentosAluno = aluno ? getPagamentosAluno(aluno.id) : [];
  const isBloqueado   = aluno ? isAlunoBloqueado(aluno.id) : false;
  const msgsFinanceiro = aluno ? getMensagensAluno(aluno.id) : [];
  const rupesAluno    = aluno ? getRUPEsAluno(aluno.id) : [];
  const mesesAtraso   = aluno ? getMesesEmAtraso(aluno.id, anoLetivo) : 0;
  const taxaPropina   = taxas.find(t => t.tipo === 'propina' && t.ativo);
  const multaEstimada = aluno ? calcularMulta(taxaPropina?.valor || 0, mesesAtraso) : 0;
  const mensagensAluno = turmaAluno
    ? mensagens.filter(m =>
        (m.tipo === 'turma' && m.turmaId === turmaAluno.id) ||
        (m.tipo === 'privada' && (m.destinatarioId === aluno?.id || m.remetenteId === aluno?.id))
      )
    : [];
  const materiaisAluno = turmaAluno ? materiais.filter(m => m.turmaId === turmaAluno.id) : [];
  const sumariosAluno = turmaAluno ? sumarios.filter(s => s.turmaId === turmaAluno.id) : [];
  const horariosAluno = turmaAluno ? horarios.filter(h => h.turmaId === turmaAluno.id) : [];
  const taxasNivel = turmaAluno ? getTaxasByNivel(turmaAluno.nivel, anoLetivo) : [];
  const taxasPropina = taxasNivel.filter(t => t.tipo === 'propina');
  const todasTaxasAluno = taxas.filter(t =>
    t.ativo &&
    (t.nivel === turmaAluno?.nivel || t.nivel === '' || t.nivel === 'todos' || t.nivel === 'Todos' || !t.nivel) &&
    (t.anoAcademico === anoLetivo || t.anoAcademico === '' || !t.anoAcademico)
  );
  const eventosAluno = turmaAluno
    ? eventos.filter(e => e.turmasIds.includes(turmaAluno.id) || e.turmasIds.length === 0)
        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    : [];

  const notasTrimestre = notasAluno.filter(n => n.trimestre === trimestreNotas);
  const mediaGeral = notasAluno.length > 0
    ? (notasAluno.reduce((s, n) => s + (n.nf || n.mac || 0), 0) / notasAluno.length).toFixed(1)
    : '—';
  const pctPresenca = presAluno.length > 0
    ? Math.round((presAluno.filter(p => p.status === 'P').length / presAluno.length) * 100)
    : 100;
  const aprovadas = notasAluno.filter(n => n.nf >= 10).length;
  const reprovadas = notasAluno.filter(n => n.nf > 0 && n.nf < 10).length;
  const emAtraso = notasAluno.filter(n => n.nf === 0 && n.trimestre < 3).length;
  const unreadMsgs = mensagensAluno.filter(m => !m.lidaPor.includes(user?.id || '')).length;

  useEffect(() => {
    loadServerData(aluno?.id);
  }, [aluno?.id]);

  useEffect(() => {
    if (aluno?.id) {
      loadDocumentosEmitidos(aluno.id);
    }
  }, [aluno?.id]);

  useEffect(() => {
    if (turmaAluno?.id) {
      fetch(`/api/sumarios/turma/${encodeURIComponent(turmaAluno.id)}`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setSumariosDirectos(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [turmaAluno?.id, activeTab]);

  async function loadDocumentosEmitidos(alunoId: string) {
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/documentos-emitidos/aluno/${alunoId}`);
      if (res.ok) {
        const data = await res.json();
        setDocumentosEmitidos(Array.isArray(data) ? data : []);
      }
    } catch (e) {
    } finally {
      setLoadingDocs(false);
    }
  }

  async function loadServerData(alunoId?: string) {
    try {
      const [horRes, solRes, recRes, regFaltaRes, exclRes] = await Promise.all([
        fetch('/api/horarios'),
        alunoId ? fetch(`/api/solicitacoes-documentos?alunoId=${encodeURIComponent(alunoId)}`) : Promise.resolve(null),
        alunoId ? fetch(`/api/reconfirmacoes-matricula?alunoId=${encodeURIComponent(alunoId)}`) : Promise.resolve(null),
        alunoId ? fetch(`/api/registos-falta-mensal?alunoId=${encodeURIComponent(alunoId)}`) : Promise.resolve(null),
        alunoId ? fetch(`/api/exclusoes-falta?alunoId=${encodeURIComponent(alunoId)}`) : Promise.resolve(null),
      ]);
      if (horRes.ok) {
        const data = await horRes.json();
        setHorarios(Array.isArray(data) ? data : []);
      }
      if (solRes?.ok) {
        const data = await solRes.json();
        setSolicitacoes(Array.isArray(data) ? data : []);
      }
      if (recRes?.ok) {
        const data = await recRes.json();
        setReconfirmacoes(Array.isArray(data) ? data : []);
      }
      if (regFaltaRes?.ok) {
        const data = await regFaltaRes.json();
        setRegistosFalta(Array.isArray(data) ? data : []);
      }
      if (exclRes?.ok) {
        const data = await exclRes.json();
        setExclusoesFalta(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  }

  async function handleSubmitJustificacao() {
    if (!showJustModal || !aluno || !turmaAluno) return;
    if (!justMotivo.trim()) return webAlert('Erro', 'Indique o motivo da justificação.');
    setJustSaving(true);
    try {
      const trimestre = new Date().getMonth() < 4 ? 1 : new Date().getMonth() < 8 ? 2 : 3;
      await fetch('/api/solicitacoes-prova-justificada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alunoId: aluno.id,
          turmaId: turmaAluno.id,
          disciplina: showJustModal.disciplina,
          anoLetivo,
          trimestre,
          tipoProva: 'outro',
          dataProvaOriginal: new Date().toISOString().slice(0, 10),
          motivo: justMotivo.trim(),
          solicitadoPor: `${aluno.nome} ${aluno.apelido}`,
          solicitadoPorId: user?.id || '',
        }),
      });
      webAlert('Sucesso', `Justificação submetida para ${showJustModal.disciplina}. A secretaria irá analisar o seu pedido.`);
      setShowJustModal(null);
      setJustMotivo('');
      if (aluno?.id) loadServerData(aluno.id);
    } catch (e) {
      webAlert('Erro', 'Não foi possível submeter a justificação. Tente novamente.');
    } finally {
      setJustSaving(false);
    }
  }

  async function handlePickPhoto() {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const uri = ev.target?.result as string;
          if (aluno) await updateAluno(aluno.id, { foto: uri });
          await updateUser({ avatar: uri });
          setShowPhotoChangedModal(true);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      webAlert('Permissão necessária', 'Precisamos de acesso à galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      if (aluno) await updateAluno(aluno.id, { foto: uri });
      await updateUser({ avatar: uri });
      setShowPhotoChangedModal(true);
    }
  }

  async function handleSolicitarDocumento() {
    if (!solForm.motivo.trim()) {
      webAlert('Atenção', 'Indique o motivo da solicitação.');
      return;
    }
    try {
      const body = {
        id: genId(),
        alunoId: aluno?.id || '',
        tipo: solForm.tipo,
        motivo: solForm.motivo,
        observacao: solForm.observacao,
        status: 'pendente',
      };
      const res = await fetch('/api/solicitacoes-documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const nova = await res.json();
        setSolicitacoes(prev => [nova, ...prev]);
      }
      setShowSolicitacaoModal(false);
      setSolForm({ tipo: TIPOS_DOC[0], motivo: '', observacao: '' });
      webAlert('Solicitação enviada', 'A sua solicitação de documento foi enviada com sucesso. Acompanhe o estado na lista abaixo.');
    } catch (e) {
      webAlert('Erro', 'Não foi possível enviar a solicitação. Tente novamente.');
    }
  }

  async function registarPagamento(p: Omit<Parameters<typeof addPagamentoSelf>[0], never>) {
    if (user?.role === 'aluno' || user?.alunoId) {
      await addPagamentoSelf(p);
    } else {
      await addPagamento({ ...p, status: 'pendente' as const });
    }
  }

  async function handlePagarDocumento() {
    const rubrica = RUBRICAS.find(r => r.id === pagForm.rubricaId);
    if (!rubrica || !aluno) return;
    const ref = pagForm.metodo === 'rupe'
      ? `RUPE-${Math.floor(Math.random() * 900000 + 100000)}`
      : `MCX-${Math.floor(Math.random() * 900000 + 100000)}`;
    await registarPagamento({
      alunoId: aluno.id,
      taxaId: rubrica.id,
      valor: rubrica.valor,
      data: new Date().toISOString().split('T')[0],
      ano: anoLetivo,
      status: 'pendente',
      metodoPagamento: pagForm.metodo === 'multicaixa' ? 'multicaixa' : 'transferencia',
      referencia: ref,
      observacao: `Pagamento de documento: ${rubrica.nome}`,
    });
    setShowPagamentoModal(false);
    webAlert('Referência Gerada', `Método: ${pagForm.metodo === 'rupe' ? 'RUPE' : 'Multicaixa Express'}\nReferência: ${ref}\nValor: ${formatAOA(rubrica.valor)}\n\nEfetue o pagamento com esta referência.`);
  }

  async function handlePagarPropina() {
    if (!aluno || taxasPropina.length === 0) return;
    const taxa = taxasPropina[0];
    const ref = propMetodo === 'rupe'
      ? `RUPE-PROP-${Math.floor(Math.random() * 900000 + 100000)}`
      : `MCX-PROP-${Math.floor(Math.random() * 900000 + 100000)}`;
    await registarPagamento({
      alunoId: aluno.id,
      taxaId: taxa.id,
      valor: taxa.valor,
      data: new Date().toISOString().split('T')[0],
      mes: propinaMes,
      trimestre: propinaTrimestre,
      ano: anoLetivo,
      status: 'pendente',
      metodoPagamento: propMetodo === 'multicaixa' ? 'multicaixa' : 'transferencia',
      referencia: ref,
      observacao: `Propina - Trimestre ${propinaTrimestre}, Mês ${propinaMes}`,
    });
    setShowPagarPropina(false);
    webAlert('Referência de Propina Gerada', `Método: ${propMetodo === 'rupe' ? 'RUPE' : 'Multicaixa Express'}\nReferência: ${ref}\nValor: ${formatAOA(taxa.valor)}\n\nEfetue o pagamento com esta referência.`);
  }

  async function handlePagarTaxa() {
    if (!aluno || !taxaParaPagar) return;
    const prefix = metodoPagarTaxa === 'rupe' ? 'RUPE' : 'MCX';
    const ref = `${prefix}-${Math.floor(Math.random() * 900000 + 100000)}`;
    const obs = comprovanteInput.trim()
      ? `${taxaParaPagar.descricao} | Comprovativo: ${comprovanteInput.trim()}`
      : taxaParaPagar.descricao;
    await registarPagamento({
      alunoId: aluno.id,
      taxaId: taxaParaPagar.id,
      valor: taxaParaPagar.valor,
      data: new Date().toISOString().split('T')[0],
      ano: anoLetivo,
      status: 'pendente',
      metodoPagamento: metodoPagarTaxa === 'multicaixa' ? 'multicaixa' : 'transferencia',
      referencia: ref,
      observacao: obs,
    });
    setTaxaParaPagar(null);
    setComprovanteInput('');
    webAlert(
      'Referência Gerada',
      `Rubrica: ${taxaParaPagar.descricao}\nMétodo: ${metodoPagarTaxa === 'rupe' ? 'RUPE' : 'Multicaixa Express'}\nReferência: ${ref}\nValor: ${formatAOA(taxaParaPagar.valor)}\n\nEfetue o pagamento com esta referência.`
    );
  }

  async function handleSubmitComprovativo() {
    if (!comprPagId || !comprPagText.trim()) return;
    const pag = pagamentosAluno.find(p => p.id === comprPagId);
    if (!pag) return;
    const novaObs = pag.observacao
      ? pag.observacao.replace(/\s*\|\s*Comprovativo:.*$/, '') + ` | Comprovativo: ${comprPagText.trim()}`
      : `Comprovativo: ${comprPagText.trim()}`;
    await updatePagamento(comprPagId, { observacao: novaObs });
    setShowComprModal(false);
    setComprPagId(null);
    setComprPagText('');
    webAlert('Comprovativo Enviado', 'O seu comprovativo foi registado. O departamento financeiro irá validar o pagamento.');
  }

  function imprimirComprovativo(pag: any) {
    const taxa = taxas.find((t: any) => t.id === pag.taxaId);
    const nomeEscola = config?.nomeEscola || 'Escola';
    const logoUrl = config?.logoUrl || '';
    const morada = (config as any)?.morada || '';
    const telefone = (config as any)?.telefoneEscola || '';
    const emailEscola = (config as any)?.emailEscola || '';
    const nif = (config as any)?.nifEscola || '';
    const nomeAluno = aluno ? `${aluno.nome} ${aluno.apelido}` : (user?.nome || '—');
    const matricula = aluno?.numeroMatricula || '—';
    const turma = turmaAluno ? `${turmaAluno.nome} — ${turmaAluno.classe}ª Classe` : '—';
    const descricao = taxa?.descricao || pag.observacao?.replace(/\s*\|\s*Comprovativo:.*$/, '') || 'Pagamento';
    const valor = formatAOA(pag.valor);
    const dataFormatada = pag.data ? new Date(pag.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const metodo = pag.metodoPagamento === 'multicaixa' ? 'Multicaixa Express' : pag.metodoPagamento === 'rupe' ? 'RUPE / Referência Bancária' : pag.metodoPagamento || '—';
    const referencia = pag.referencia || '—';
    const comprProof = pag.observacao?.match(/Comprovativo:\s*(.+)/)?.[1] || null;
    const recibo = `REC-${pag.id?.toString().slice(-8).toUpperCase() || Date.now().toString().slice(-8)}`;
    const dataEmissao = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8"/>
  <title>Comprovativo de Pagamento — ${recibo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;color:#1a1a2e;padding:30px;}
    .page{max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);}
    .header{background:linear-gradient(135deg,#0D1F35 0%,#1a3060 100%);padding:32px 36px;display:flex;align-items:center;gap:20px;}
    .logo{width:64px;height:64px;border-radius:12px;object-fit:contain;background:#fff;padding:4px;}
    .logo-placeholder{width:64px;height:64px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;font-weight:700;flex-shrink:0;}
    .header-text{flex:1;}
    .header-escola{font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;}
    .header-sub{font-size:12px;color:rgba(255,255,255,0.7);}
    .stamp-bar{background:#C9A84C;padding:10px 36px;display:flex;align-items:center;justify-content:space-between;}
    .stamp-title{font-size:15px;font-weight:700;color:#fff;letter-spacing:1.5px;text-transform:uppercase;}
    .stamp-recibo{font-size:12px;color:rgba(255,255,255,0.85);font-weight:600;}
    .body{padding:32px 36px;}
    .section{margin-bottom:24px;}
    .section-title{font-size:10px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #eee;}
    .row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;}
    .label{font-size:12px;color:#888;min-width:140px;}
    .value{font-size:13px;font-weight:600;color:#1a1a2e;text-align:right;flex:1;}
    .value.big{font-size:22px;font-weight:700;color:#C9A84C;}
    .status-badge{display:inline-block;background:#d4edda;color:#155724;border:1.5px solid #c3e6cb;border-radius:20px;padding:5px 18px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
    .divider{border:none;border-top:1px dashed #ddd;margin:20px 0;}
    .footer{background:#f9f9f9;border-top:1px solid #eee;padding:20px 36px;font-size:11px;color:#999;text-align:center;line-height:1.8;}
    .footer strong{color:#666;}
    .print-actions{text-align:center;padding:24px 36px 32px;gap:12px;display:flex;justify-content:center;}
    .btn{padding:12px 32px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}
    .btn-primary{background:#C9A84C;color:#fff;}
    .btn-secondary{background:#eee;color:#444;}
    .verification{background:#f0f7ff;border:1px solid #cce0ff;border-radius:8px;padding:12px 16px;margin-top:16px;font-size:11px;color:#2563eb;text-align:center;}
    @media print{
      body{background:#fff;padding:0;}
      .page{box-shadow:none;border-radius:0;}
      .print-actions{display:none!important;}
      @page{size:A4;margin:15mm;}
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    ${logoUrl
      ? `<img src="${logoUrl}" class="logo" alt="Logo"/>`
      : `<div class="logo-placeholder">${nomeEscola.charAt(0)}</div>`
    }
    <div class="header-text">
      <div class="header-escola">${nomeEscola}</div>
      <div class="header-sub">${morada || ''}${morada && (telefone || emailEscola) ? ' &nbsp;·&nbsp; ' : ''}${telefone || ''}${nif ? ' &nbsp;·&nbsp; NIF: ' + nif : ''}</div>
    </div>
  </div>

  <div class="stamp-bar">
    <span class="stamp-title">Comprovativo de Pagamento</span>
    <span class="stamp-recibo">${recibo}</span>
  </div>

  <div class="body">
    <div class="section">
      <div class="section-title">Dados do Estudante</div>
      <div class="row"><span class="label">Nome Completo</span><span class="value">${nomeAluno}</span></div>
      <div class="row"><span class="label">N.º Matrícula</span><span class="value">${matricula}</span></div>
      <div class="row"><span class="label">Turma / Classe</span><span class="value">${turma}</span></div>
      <div class="row"><span class="label">Ano Lectivo</span><span class="value">${pag.ano || anoLetivo || '—'}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Detalhes do Pagamento</div>
      <div class="row"><span class="label">Rubrica</span><span class="value">${descricao}${pag.mes ? ' — Mês ' + pag.mes : ''}</span></div>
      <div class="row"><span class="label">Valor Pago</span><span class="value big">${valor}</span></div>
      <div class="row"><span class="label">Data de Pagamento</span><span class="value">${dataFormatada}</span></div>
      <div class="row"><span class="label">Método</span><span class="value">${metodo}</span></div>
      <div class="row"><span class="label">Referência</span><span class="value">${referencia}</span></div>
      ${comprProof ? `<div class="row"><span class="label">Comprovativo</span><span class="value">${comprProof}</span></div>` : ''}
    </div>

    <hr class="divider"/>

    <div class="row" style="align-items:center;">
      <span class="label" style="font-size:13px;font-weight:600;color:#1a1a2e;">Estado</span>
      <span class="status-badge">✓ Quitado</span>
    </div>

    <div class="verification">
      Documento emitido electronicamente em ${dataEmissao} · ${nomeEscola}${nif ? ' · NIF ' + nif : ''}
    </div>
  </div>

  <div class="footer">
    ${emailEscola ? `<strong>Email:</strong> ${emailEscola} &nbsp;&nbsp;` : ''}
    ${telefone ? `<strong>Tel:</strong> ${telefone} &nbsp;&nbsp;` : ''}
    ${morada ? `<strong>Morada:</strong> ${morada}` : ''}
    <br/>Este documento serve como comprovativo oficial de pagamento emitido por ${nomeEscola}.
  </div>

  <div class="print-actions">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">Fechar</button>
  </div>
</div>
</body>
</html>`;

    if (typeof window !== 'undefined') {
      const win = window.open('', '_blank', 'width=760,height=900');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    }
  }

  async function handleReconfirmacao() {
    if (!aluno) return;
    const already = reconfirmacoes.find(r => r.alunoId === aluno.id && r.anoLetivo === anoLetivo);
    if (already) {
      webAlert('Já reconfirmado', 'A sua matrícula para este ano já foi reconfirmada.');
      setShowReconfirmacaoModal(false);
      return;
    }
    try {
      const res = await fetch('/api/reconfirmacoes-matricula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: genId(), alunoId: aluno.id, anoLetivo, status: 'confirmado' }),
      });
      if (res.ok) {
        const nova = await res.json();
        setReconfirmacoes(prev => [nova, ...prev]);
      }
      setShowReconfirmacaoModal(false);
      webAlert('Matrícula Reconfirmada', `A sua matrícula para o ano lectivo ${anoLetivo} foi reconfirmada com sucesso.`);
    } catch (e) {
      webAlert('Erro', 'Não foi possível registar a reconfirmação. Tente novamente.');
    }
  }

  const reconfirmacaoAtual = reconfirmacoes.find(r => r.alunoId === aluno?.id && r.anoLetivo === anoLetivo);
  const solicitacoesAluno = solicitacoes.filter(s => s.alunoId === aluno?.id);
  const pagamentoCartaoAtual = aluno
    ? pagamentosAluno.find(p => p.taxaId === CARTAO_TAXA_ID && p.ano === anoLetivo && p.status === 'pago')
    : null;
  const cartaoValido = !!pagamentoCartaoAtual;

  function abrirModalPagarCartao() {
    setCartaoPayStep('metodos');
    setCartaoMetodoExt('multicaixa_express');
    setCartaoPhone('');
    setCartaoRefGerada(null);
    setShowPagarCartao(true);
  }

  async function handlePagarCartao() {
    if (!aluno) return;
    setIsLoading(true);
    try {
      const ref = `CE-${anoLetivo}-${aluno.numeroMatricula}-${Date.now().toString(36).toUpperCase()}`;
      const metodoMap: Record<typeof cartaoMetodoExt, string> = {
        referencia_atm: 'multicaixa',
        multicaixa_express: 'multicaixa',
        rupe: 'transferencia',
      };
      const observacaoMap: Record<typeof cartaoMetodoExt, string> = {
        referencia_atm: 'Cartão de Estudante Virtual — Pagamento por Referência ATM',
        multicaixa_express: `Cartão de Estudante Virtual — MULTICAIXA Express (${cartaoPhone})`,
        rupe: 'Cartão de Estudante Virtual — RUPE',
      };
      await registarPagamento({
        alunoId: aluno.id,
        taxaId: CARTAO_TAXA_ID,
        valor: CARTAO_VALOR,
        data: new Date().toISOString().split('T')[0],
        ano: anoLetivo,
        status: 'pendente',
        metodoPagamento: metodoMap[cartaoMetodoExt] as any,
        referencia: ref,
        observacao: observacaoMap[cartaoMetodoExt],
      });
      setCartaoRefGerada(ref);
      setCartaoPayStep('done');
    } finally {
      setIsLoading(false);
    }
  }

  // ───── RENDER TABS ─────────────────────────────────────────────

  function renderPainel() {
    const disciplinas = [...new Set(notasAluno.map(n => n.disciplina))];
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionTitle title="Resumo Académico" icon="stats-chart" />
        <View style={styles.statsRow}>
          <StatCard value={mediaGeral} label="Média Geral" color={Colors.gold} />
          <TouchableOpacity onPress={() => setActiveTab('faltas')} activeOpacity={0.75}>
            <StatCard value={`${pctPresenca}%`} label="Presenças ›" color={pctPresenca >= 75 ? Colors.info : Colors.danger} />
          </TouchableOpacity>
          <StatCard value={aprovadas} label="Aprovadas" color={Colors.success} />
          <StatCard value={reprovadas} label="Reprovadas" color={Colors.danger} />
        </View>

        {turmaAluno && (
          <View style={styles.infoCard}>
            <SectionTitle title="Dados de Matrícula" icon="school" />
            <View style={styles.infoRow}><Text style={styles.infoLabel}>N.º Matrícula</Text><Text style={styles.infoVal}>{aluno?.numeroMatricula || '—'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Turma</Text><Text style={styles.infoVal}>{turmaAluno.nome}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Classe</Text><Text style={styles.infoVal}>{turmaAluno.classe}ª Classe</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Nível</Text><Text style={styles.infoVal}>{turmaAluno.nivel}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Turno</Text><Text style={styles.infoVal}>{turmaAluno.turno}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Ano Lectivo</Text><Text style={styles.infoVal}>{anoLetivo}</Text></View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reconfirmação</Text>
              <Badge label={reconfirmacaoAtual ? 'Confirmado' : 'Pendente'} color={reconfirmacaoAtual ? Colors.success : Colors.warning} />
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <SectionTitle title="Estado das Disciplinas" icon="library" />
          {disciplinas.length === 0 && <Text style={styles.emptyText}>Sem disciplinas registadas</Text>}
          {disciplinas.map(disc => {
            const notasDisc = notasAluno.filter(n => n.disciplina === disc);
            const ultimaNota = notasDisc.sort((a, b) => b.trimestre - a.trimestre)[0];
            const status = ultimaNota ? getStatusDisciplina(ultimaNota.nf, ultimaNota.trimestre) : { label: 'Sem nota', color: Colors.textMuted, icon: 'help-circle' };
            return (
              <View key={disc} style={styles.discRow}>
                <View style={styles.discLeft}>
                  <Ionicons name={status.icon as any} size={18} color={status.color} />
                  <Text style={styles.discNome} numberOfLines={1}>{disc}</Text>
                </View>
                <Badge label={status.label} color={status.color} />
              </View>
            );
          })}
        </View>

        {documentosEmitidos.length > 0 && (
          <TouchableOpacity style={styles.infoCard} onPress={() => setActiveTab('documentos')} activeOpacity={0.85}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SectionTitle title="Documentos Emitidos" icon="document-text" />
              <View style={styles.docCountBadge}>
                <Text style={styles.docCountText}>{documentosEmitidos.length}</Text>
              </View>
            </View>
            <View style={styles.docBadgesRow}>
              {[...new Set(documentosEmitidos.map(d => d.tipo))].map(tipo => (
                <View key={tipo} style={styles.docTypeBadge}>
                  <Ionicons name="checkmark-circle" size={11} color={Colors.success} />
                  <Text style={styles.docTypeBadgeText} numberOfLines={1}>{tipo}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.infoHint, { marginTop: 8, color: Colors.gold }]}>Ver histórico completo →</Text>
          </TouchableOpacity>
        )}

        {unreadMsgs > 0 && (
          <TouchableOpacity style={styles.alertCard} onPress={() => setActiveTab('mensagens')}>
            <Ionicons name="chatbubbles" size={20} color={Colors.info} />
            <Text style={styles.alertText}>Tem {unreadMsgs} {unreadMsgs === 1 ? 'mensagem nova' : 'mensagens novas'} do professor</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.info} />
          </TouchableOpacity>
        )}

        {pagamentosAluno.filter(p => p.status === 'pendente').length > 0 && (
          <TouchableOpacity style={[styles.alertCard, { borderColor: Colors.warning + '55' }]} onPress={() => setActiveTab('financeiro')}>
            <Ionicons name="cash" size={20} color={Colors.warning} />
            <Text style={[styles.alertText, { color: Colors.warning }]}>{pagamentosAluno.filter(p => p.status === 'pendente').length} pagamento(s) pendente(s)</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
          </TouchableOpacity>
        )}

        <SectionTitle title="Calendário de Marcos Escolares" icon="calendar" />
        <Text style={styles.infoHint}>Marcos e eventos definidos pela escola para a sua turma</Text>
        {eventosAluno.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Nenhum marco ou evento definido</Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {eventosAluno.map((ev, idx) => {
              const isPast = new Date(ev.data) < new Date();
              const isToday = ev.data === new Date().toISOString().split('T')[0];
              const tipoColor = ev.tipo === 'Exame' ? Colors.danger : ev.tipo === 'Feriado' ? Colors.gold : ev.tipo === 'Reunião' ? Colors.info : ev.tipo === 'Cultural' ? Colors.success : ev.tipo === 'Desportivo' ? Colors.warning : Colors.accent;
              const tipoIcon = ev.tipo === 'Exame' ? 'document-text' : ev.tipo === 'Feriado' ? 'flag' : ev.tipo === 'Reunião' ? 'people' : ev.tipo === 'Cultural' ? 'musical-notes' : ev.tipo === 'Desportivo' ? 'fitness' : 'school';
              return (
                <View key={ev.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: tipoColor, opacity: isPast ? 0.4 : 1 }]}>
                      <Ionicons name={tipoIcon as any} size={12} color="#fff" />
                    </View>
                    {idx < eventosAluno.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={[styles.timelineCard, isPast && { opacity: 0.55 }]}>
                    <View style={styles.timelineCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineTitulo}>{ev.titulo}</Text>
                        {ev.descricao ? <Text style={styles.timelineDesc} numberOfLines={2}>{ev.descricao}</Text> : null}
                      </View>
                      <View style={styles.timelineDateBox}>
                        <Text style={[styles.timelineDateNum, { color: tipoColor }]}>
                          {new Date(ev.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                        </Text>
                        <Text style={styles.timelineHora}>{ev.hora}</Text>
                      </View>
                    </View>
                    <View style={styles.timelineFooter}>
                      <Badge label={ev.tipo} color={tipoColor} />
                      {isToday && <Badge label="Hoje" color={Colors.success} />}
                      {isPast && !isToday && <Badge label="Concluído" color={Colors.textMuted} />}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderCartao() {
    const nomeCompleto = `${aluno?.nome || user?.nome || ''} ${aluno?.apelido || ''}`.trim();
    const matricula = aluno?.numeroMatricula || '—';
    const classeTurma = turmaAluno ? `${turmaAluno.classe}ª Classe — ${turmaAluno.nome}` : '—';
    const periodo = turmaAluno?.turno || '—';
    const qrData = JSON.stringify({ matricula, nome: nomeCompleto, turma: turmaAluno?.nome, ano: anoLetivo, valido: cartaoValido });
    const foto = (user as any)?.avatar || aluno?.foto;
    const initials = nomeCompleto.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.cartaoSectionLabel}>CARTÃO DE ESTUDANTE VIRTUAL</Text>

        {/* ── Card visual ── */}
        <View style={[styles.cartaoCard, cartaoValido && styles.cartaoCardValido]}>
          {/* Header strip */}
          <View style={styles.cartaoHeader}>
            <View>
              <Text style={styles.cartaoSchoolName}>{config.nomeEscola}</Text>
              <Text style={styles.cartaoAnoLetivo}>Ano Lectivo {anoLetivo}</Text>
            </View>
            <View style={[styles.cartaoStatusBadge, cartaoValido ? styles.cartaoStatusValido : styles.cartaoStatusPendente]}>
              <Ionicons name={cartaoValido ? 'checkmark-circle' : 'time'} size={13} color="#fff" />
              <Text style={styles.cartaoStatusText}>{cartaoValido ? 'VÁLIDO' : 'PENDENTE'}</Text>
            </View>
          </View>

          {/* Body */}
          <View style={styles.cartaoBody}>
            {/* Photo */}
            <View style={styles.cartaoFotoWrap}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.cartaoFoto} />
              ) : (
                <View style={styles.cartaoFotoPlaceholder}>
                  <Text style={styles.cartaoFotoInitials}>{initials}</Text>
                </View>
              )}
              {cartaoValido && (
                <View style={styles.cartaoFotoCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.cartaoInfo}>
              <Text style={styles.cartaoNome} numberOfLines={2}>{nomeCompleto}</Text>
              <View style={styles.cartaoInfoRow}>
                <Ionicons name="id-card-outline" size={12} color={Colors.gold} />
                <Text style={styles.cartaoInfoVal}>{matricula}</Text>
              </View>
              <View style={styles.cartaoInfoRow}>
                <Ionicons name="school-outline" size={12} color={Colors.gold} />
                <Text style={styles.cartaoInfoVal}>{classeTurma}</Text>
              </View>
              <View style={styles.cartaoInfoRow}>
                <Ionicons name="time-outline" size={12} color={Colors.gold} />
                <Text style={styles.cartaoInfoVal}>Período: {periodo}</Text>
              </View>
              {aluno?.genero && (
                <View style={styles.cartaoInfoRow}>
                  <Ionicons name="person-outline" size={12} color={Colors.gold} />
                  <Text style={styles.cartaoInfoVal}>{aluno.genero === 'M' ? 'Masculino' : 'Feminino'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* QR Code section */}
          <View style={styles.cartaoQrSection}>
            <View style={[styles.cartaoQrWrap, !cartaoValido && { opacity: 0.4 }]}>
              <QRCode
                value={qrData}
                size={96}
                backgroundColor="transparent"
                color={cartaoValido ? Colors.primary : Colors.textMuted}
              />
            </View>
            <View style={styles.cartaoQrInfo}>
              <Text style={styles.cartaoQrLabel}>QR de Validação</Text>
              <Text style={styles.cartaoQrSub}>
                {cartaoValido
                  ? 'Apresente este código na portaria para confirmar situação regularizada.'
                  : 'Pague o cartão anual para activar o código QR de validação.'}
              </Text>
              {pagamentoCartaoAtual?.referencia && (
                <View style={styles.cartaoRefRow}>
                  <Ionicons name="receipt-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.cartaoRefText}>Ref: {pagamentoCartaoAtual.referencia}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Footer strip */}
          <View style={styles.cartaoFooter}>
            <Text style={styles.cartaoFooterText}>
              {cartaoValido ? `Válido para ${anoLetivo} · Emitido em ${pagamentoCartaoAtual?.data ? new Date(pagamentoCartaoAtual.data).toLocaleDateString('pt-PT') : '—'}` : 'Cartão não pago — situação irregular'}
            </Text>
          </View>
        </View>

        {/* ── Info box ── */}
        <View style={styles.cartaoInfoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
          <Text style={styles.cartaoInfoBoxText}>
            O cartão virtual de estudante tem validade anual ({anoLetivo}). Apresente o QR code na portaria ou em qualquer serviço escolar para confirmar que a sua situação está regularizada.
          </Text>
        </View>

        {/* ── Payment button or already paid ── */}
        {cartaoValido ? (
          <View style={styles.cartaoPagoRow}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <Text style={styles.cartaoPagoText}>Cartão pago e válido para {anoLetivo}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.cartaoPagarBtn} onPress={abrirModalPagarCartao}>
            <Ionicons name="card" size={18} color="#fff" />
            <Text style={styles.cartaoPagarBtnText}>Pagar Cartão de Estudante — {formatAOA(CARTAO_VALOR)}</Text>
          </TouchableOpacity>
        )}

        {/* ── Payment modal ── */}
        <Modal visible={showPagarCartao} transparent animationType="slide" onRequestClose={() => setShowPagarCartao(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { paddingHorizontal: 0, paddingBottom: 0, overflow: 'hidden' }]}>

              {/* ─── STEP 1: Selecção do método ─── */}
              {cartaoPayStep === 'metodos' && (
                <>
                  {/* Header colorido com valor */}
                  <View style={styles.pagHeaderBg}>
                    <Text style={styles.pagHeaderLabel}>Valor a pagar</Text>
                    <Text style={styles.pagHeaderValor}>Kz {CARTAO_VALOR.toLocaleString('pt-AO')}</Text>
                    <Text style={styles.pagHeaderSub}>Cartão de Estudante Virtual · {anoLetivo}</Text>
                  </View>

                  <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                    {/* Prazo */}
                    <View style={styles.pagPrazoRow}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.pagPrazoText}>Devido em {new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                    </View>

                    {/* Opções de pagamento */}
                    {([
                      { key: 'referencia_atm', label: 'Pagamento por Referência', sub: 'ATM / Caixas Multicaixa', icon: 'business-outline' },
                      { key: 'multicaixa_express', label: 'Pague com MULTICAIXA Express', sub: 'Pagamento imediato via app', icon: 'phone-portrait-outline' },
                      { key: 'rupe', label: 'Pagamento por Referência (RUPE)', sub: 'Referência Única de Pagamento', icon: 'receipt-outline' },
                    ] as const).map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={styles.pagMetodoRow}
                        onPress={() => setCartaoMetodoExt(opt.key)}
                        activeOpacity={0.75}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pagMetodoLabel}>{opt.label}</Text>
                          <Text style={styles.pagMetodoSub}>{opt.sub}</Text>
                        </View>
                        <View style={[styles.pagRadio, cartaoMetodoExt === opt.key && styles.pagRadioActive]}>
                          {cartaoMetodoExt === opt.key && <View style={styles.pagRadioDot} />}
                        </View>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                      style={[styles.pagBtnTeal, { marginTop: 20, marginBottom: 16 }]}
                      onPress={() => setCartaoPayStep('form')}
                    >
                      <Text style={styles.pagBtnTealText}>Continuar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ alignItems: 'center', paddingBottom: 16 }} onPress={() => setShowPagarCartao(false)}>
                      <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ─── STEP 2: Formulário do método escolhido ─── */}
              {cartaoPayStep === 'form' && (
                <>
                  <View style={{ paddingHorizontal: 20, paddingTop: 20, alignItems: 'center' }}>
                    {/* Ícone */}
                    <View style={styles.pagFormIconWrap}>
                      <Ionicons
                        name={cartaoMetodoExt === 'multicaixa_express' ? 'phone-portrait-outline' : cartaoMetodoExt === 'rupe' ? 'receipt-outline' : 'business-outline'}
                        size={36}
                        color={Colors.primary}
                      />
                    </View>

                    <Text style={styles.pagFormTitle}>
                      {cartaoMetodoExt === 'multicaixa_express' ? 'Pague com MULTICAIXA Express' :
                       cartaoMetodoExt === 'rupe' ? 'Pagamento por Referência RUPE' :
                       'Pagamento por Referência ATM'}
                    </Text>

                    <View style={styles.pagFormAmountRow}>
                      <Text style={styles.pagFormAmountLabel}>Valor a pagar:</Text>
                      <Text style={styles.pagFormAmount}>Kz {CARTAO_VALOR.toLocaleString('pt-AO')}</Text>
                    </View>

                    {/* MULTICAIXA Express: campo de telefone */}
                    {cartaoMetodoExt === 'multicaixa_express' && (
                      <View style={styles.pagPhoneWrap}>
                        <Text style={styles.pagPhoneLabel}>Número de telefone</Text>
                        <View style={styles.pagPhoneRow}>
                          <Text style={styles.pagPhonePrefix}>+244</Text>
                          <TextInput
                            style={styles.pagPhoneInput}
                            placeholder="9XX XXX XXX"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="phone-pad"
                            value={cartaoPhone}
                            onChangeText={setCartaoPhone}
                            maxLength={9}
                          />
                        </View>
                        <Text style={styles.pagPhoneHint}>Receberá uma notificação na app MULTICAIXA Express para aprovar o pagamento.</Text>
                      </View>
                    )}

                    {/* Referência ATM / RUPE: mostrar instruções */}
                    {cartaoMetodoExt !== 'multicaixa_express' && (
                      <View style={styles.pagRefInfoBox}>
                        <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                        <Text style={styles.pagRefInfoText}>
                          {cartaoMetodoExt === 'referencia_atm'
                            ? 'Será gerada uma referência de pagamento. Dirija-se a qualquer caixa ATM Multicaixa para efectuar o pagamento.'
                            : 'Será gerada uma referência RUPE. Efectue o pagamento em qualquer balcão bancário ou ATM.'}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.pagBtnTeal, { marginTop: 20, marginBottom: 10, width: '100%' }, isLoading && { opacity: 0.6 }]}
                      onPress={handlePagarCartao}
                      disabled={isLoading || (cartaoMetodoExt === 'multicaixa_express' && cartaoPhone.replace(/\s/g, '').length < 9)}
                    >
                      {isLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.pagBtnTealText}>
                            {cartaoMetodoExt === 'multicaixa_express' ? 'Iniciar Pagamento' : 'Gerar Referência'}
                          </Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity style={{ alignItems: 'center', paddingBottom: 20 }} onPress={() => setCartaoPayStep('metodos')}>
                      <Text style={{ color: Colors.textMuted, fontSize: 14 }}>← Voltar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ─── STEP 3: Confirmação ─── */}
              {cartaoPayStep === 'done' && (
                <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: 'center' }}>
                  <View style={[styles.pagFormIconWrap, { backgroundColor: '#e8f8f0' }]}>
                    <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                  </View>
                  <Text style={[styles.pagFormTitle, { marginTop: 12 }]}>Pedido Registado!</Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
                    {cartaoMetodoExt === 'multicaixa_express'
                      ? `Foi enviado um pedido de pagamento para +244 ${cartaoPhone}.\nAprove na app MULTICAIXA Express para concluir.`
                      : 'A sua referência de pagamento foi gerada. Efectue o pagamento e aguarde a confirmação da secretaria.'}
                  </Text>
                  {cartaoRefGerada && (
                    <View style={styles.pagRefBox}>
                      <Text style={styles.pagRefBoxLabel}>Referência</Text>
                      <Text style={styles.pagRefBoxVal}>{cartaoRefGerada}</Text>
                    </View>
                  )}
                  <View style={styles.pagRefInfoBox}>
                    <Ionicons name="time-outline" size={16} color={Colors.warning} />
                    <Text style={styles.pagRefInfoText}>O pagamento ficará pendente até ser confirmado pelo departamento financeiro.</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.pagBtnTeal, { marginTop: 20, width: '100%' }]}
                    onPress={() => setShowPagarCartao(false)}
                  >
                    <Text style={styles.pagBtnTealText}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  function gerarHtmlMiniPautaAluno(trimestre: 1 | 2 | 3) {
    const nomeEscola = config?.nomeEscola || 'Escola';
    const logoUrl = config?.logoUrl || '';
    const anoLetivo = anoSelecionado?.ano || '—';
    const nomeAluno = aluno ? `${aluno.nome} ${aluno.apelido}` : '—';
    const numMatricula = aluno?.numeroMatricula || '—';
    const turmaNome = turmaAluno?.nome || '—';
    const classe = turmaAluno?.classe || '—';
    const nivel = turmaAluno?.nivel || '—';
    const notasTr = aluno ? notas.filter(n => n.alunoId === aluno.id && n.trimestre === trimestre && n.anoLetivo === anoLetivo) : [];
    const dataHoje = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });

    const linhas = notasTr.map((nota, i) => {
      const nfColor = nota.nf >= 10 ? '#155724' : nota.nf > 0 ? '#721c24' : '#555';
      const status = nota.nf >= 10 ? 'Aprovado' : nota.nf > 0 ? 'Reprovado' : '—';
      return `<tr style="background:${i%2===0?'#f9f9f0':'#fff'}">
        <td style="text-align:center">${String(i+1).padStart(2,'0')}</td>
        <td style="padding-left:6px">${nota.disciplina}</td>
        <td class="nc">${nota.mac1||nota.mac||0 ? (nota.mac1||nota.mac).toFixed(1) : '—'}</td>
        <td class="nc">${nota.pp1 > 0 ? nota.pp1.toFixed(1) : '—'}</td>
        <td class="nc">${nota.ppt > 0 ? nota.ppt.toFixed(1) : '—'}</td>
        <td class="nc" style="font-weight:bold">${nota.mt1 > 0 ? nota.mt1.toFixed(1) : '—'}</td>
        <td class="nc" style="font-weight:bold;color:${nfColor}">${nota.nf > 0 ? nota.nf.toFixed(1) : '—'}</td>
        <td style="text-align:center;font-size:10px;color:${nfColor}">${status}</td>
      </tr>`;
    });

    if (linhas.length === 0) {
      return null;
    }

    return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Mini-Pauta · ${nomeAluno} · ${trimestre}º Trimestre</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Times New Roman',serif;background:#fff;color:#000;padding:20px 24px;}
  .header{text-align:center;margin-bottom:12px;}
  .header img{width:70px;height:70px;object-fit:contain;margin-bottom:4px;}
  .header p{font-size:12px;line-height:1.6;}
  .header .title{font-size:17px;font-weight:bold;margin:6px 0 2px;}
  .header .escola{font-size:13px;font-weight:bold;text-transform:uppercase;}
  .aluno-box{border:1px solid #333;border-radius:4px;padding:10px 14px;margin:10px 0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;}
  .aluno-field{display:flex;flex-direction:column;}
  .aluno-label{font-size:10px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:0.5px;}
  .aluno-value{font-size:13px;font-weight:bold;color:#000;margin-top:1px;}
  .tri-badge{display:inline-block;background:#1a6b3c;color:#fff;font-size:13px;font-weight:bold;padding:3px 14px;border-radius:20px;margin-bottom:10px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th,td{border:1px solid #555;padding:3px 5px;}
  th{background:#1a6b3c;color:#fff;font-size:10px;font-weight:bold;text-align:center;}
  td.nc{text-align:center;}
  tfoot td{font-weight:bold;background:#f0f0e0;}
  .obs{margin-top:14px;font-size:11px;color:#444;font-style:italic;}
  .footer{margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;}
  .sig-line{border-top:1px solid #000;margin-top:36px;padding-top:4px;min-width:200px;text-align:center;}
  @media print{body{padding:8px 10px;}@page{size:A4 portrait;margin:10mm;}.no-print{display:none;}}
</style>
</head><body>
<div class="header">
  ${logoUrl ? `<img src="${logoUrl}" alt="Logo"/>` : ''}
  <p>REPÚBLICA DE ANGOLA</p>
  <p>MINISTÉRIO DA EDUCAÇÃO</p>
  <p class="escola">${nomeEscola}</p>
  <p class="title">MINI-PAUTA INDIVIDUAL</p>
</div>

<div style="text-align:center;margin-bottom:10px;">
  <span class="tri-badge">${trimestre}º TRIMESTRE · ${anoLetivo}</span>
</div>

<div class="aluno-box">
  <div class="aluno-field">
    <span class="aluno-label">Nome Completo</span>
    <span class="aluno-value">${nomeAluno}</span>
  </div>
  <div class="aluno-field">
    <span class="aluno-label">N.º Matrícula</span>
    <span class="aluno-value">${numMatricula}</span>
  </div>
  <div class="aluno-field">
    <span class="aluno-label">Turma / Classe</span>
    <span class="aluno-value">${turmaNome} · ${classe}ª (${nivel})</span>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:28px">Nº</th>
      <th style="text-align:left">DISCIPLINA</th>
      <th>MAC</th>
      <th>NPP</th>
      <th>NPT</th>
      <th>MT</th>
      <th>NF</th>
      <th>OBSERVAÇÃO</th>
    </tr>
  </thead>
  <tbody>
    ${linhas.join('\n')}
  </tbody>
</table>

<p class="obs">MAC = Média das Avaliações Contínuas &nbsp;|&nbsp; NPP = Nota da Prova Parcial &nbsp;|&nbsp; NPT = Nota da Prova Trimestral &nbsp;|&nbsp; MT = Média Trimestral &nbsp;|&nbsp; NF = Nota Final</p>

<div class="footer">
  <span>${nomeEscola}, ${dataHoje}.</span>
  <div class="sig-line">O DIRECTOR(A) DA ESCOLA</div>
</div>

<div class="no-print" style="text-align:center;margin-top:20px;">
  <button onclick="window.print()" style="padding:10px 32px;font-size:14px;background:#1a6b3c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:serif">
    Imprimir / Guardar PDF
  </button>
</div>
</body></html>`;
  }

  function verMiniPauta() {
    const notasTr = aluno ? notas.filter(n => n.alunoId === aluno.id && n.trimestre === trimestreNotas && n.anoLetivo === anoLetivo) : [];
    const pautasFechadas = notasTr.filter(nota => {
      const p = pautas.find(p => p.turmaId === nota.turmaId && p.disciplina === nota.disciplina && p.trimestre === nota.trimestre);
      return p?.status === 'fechada';
    });
    if (pautasFechadas.length === 0) {
      webAlert('Mini-Pauta Indisponível', 'A mini-pauta ainda não foi publicada pelo professor. Aguarde o fecho oficial da pauta.');
      return;
    }
    if (Platform.OS !== 'web') {
      webAlert('Indisponível', 'A visualização da mini-pauta está disponível na versão web do sistema.');
      return;
    }
    const html = gerarHtmlMiniPautaAluno(trimestreNotas);
    if (!html) {
      webAlert('Sem Notas', 'Não existem notas publicadas para este trimestre.');
      return;
    }
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  function renderNotas() {
    const notasTr = aluno ? notas.filter(n => n.alunoId === aluno.id && n.trimestre === trimestreNotas && n.anoLetivo === anoLetivo) : [];
    const temPautaFechada = notasTr.some(nota => {
      const p = pautas.find(p => p.turmaId === nota.turmaId && p.disciplina === nota.disciplina && p.trimestre === nota.trimestre);
      return p?.status === 'fechada';
    });

    const notasPublicadas = aluno?.publicarNotas ?? true;
    const notasVisiveisGlobal = config.notasVisiveis ?? false;
    const turmaAluno = aluno ? turmas.find(t => t.id === aluno.turmaId) : null;
    const isFinalista = turmaAluno?.classe === '13';

    if (!notasVisiveisGlobal && !isFinalista) {
      return (
        <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.emptyState, { paddingTop: 60 }]}>
            <Ionicons name="eye-off-outline" size={52} color={Colors.textMuted} />
            <Text style={[styles.emptyStateText, { fontFamily: 'Inter_700Bold', fontSize: 16 }]}>Notas não disponíveis</Text>
            <Text style={[styles.emptyStateText, { fontSize: 13, lineHeight: 19 }]}>
              A escola ainda não activou a visualização de notas no portal. Consulte a secretaria para mais informações.
            </Text>
          </View>
        </ScrollView>
      );
    }

    if (!notasPublicadas) {
      return (
        <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.emptyState, { paddingTop: 60 }]}>
            <Ionicons name="eye-off-outline" size={52} color={Colors.textMuted} />
            <Text style={[styles.emptyStateText, { fontFamily: 'Inter_700Bold', fontSize: 16 }]}>Notas não disponíveis</Text>
            <Text style={[styles.emptyStateText, { fontSize: 13, lineHeight: 19 }]}>
              O Director de Turma ainda não publicou as suas notas neste portal. Contacte a secretaria ou o seu director de turma para mais informações.
            </Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.trimestreSelector}>
          {([1, 2, 3] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.trimBtn, trimestreNotas === t && styles.trimBtnActive]}
              onPress={() => setTrimestreNotas(t)}
            >
              <Text style={[styles.trimBtnText, trimestreNotas === t && styles.trimBtnTextActive]}>
                {t}º Trimestre
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.miniPautaBtn, !temPautaFechada && styles.miniPautaBtnDisabled]}
          onPress={verMiniPauta}
        >
          <Ionicons name="print-outline" size={16} color={temPautaFechada ? '#fff' : Colors.textMuted} />
          <Text style={[styles.miniPautaBtnText, !temPautaFechada && { color: Colors.textMuted }]}>
            {temPautaFechada ? 'Ver / Imprimir Mini-Pauta' : 'Mini-Pauta (aguarda publicação)'}
          </Text>
          {temPautaFechada && <Ionicons name="chevron-forward" size={14} color="#fff" />}
        </TouchableOpacity>

        {aluno && (
          <TouchableOpacity
            style={styles.continuidadeBtn}
            onPress={() => setShowContinuidade(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="git-branch-outline" size={16} color={Colors.info} />
            <Text style={styles.continuidadeBtnText}>Ver Situação das Disciplinas de Continuidade</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.info} />
          </TouchableOpacity>
        )}

        {notasTrimestre.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem notas lançadas para o {trimestreNotas}º trimestre</Text>
          </View>
        ) : (
          notasTrimestre.map(nota => {
            const pauta = pautas.find(p => p.turmaId === nota.turmaId && p.disciplina === nota.disciplina && p.trimestre === nota.trimestre);
            const status = getStatusDisciplina(nota.nf, nota.trimestre);
            return (
              <View key={nota.id} style={styles.notaCard}>
                <View style={styles.notaHeader}>
                  <Text style={styles.notaDisc}>{nota.disciplina}</Text>
                  <Badge label={status.label} color={status.color} />
                </View>

                <View style={styles.notaGrid}>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>AV1</Text>
                    <NotaCell value={nota.aval1} />
                  </View>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>AV2</Text>
                    <NotaCell value={nota.aval2} />
                  </View>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>AV3</Text>
                    <NotaCell value={nota.aval3} />
                  </View>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>AV4</Text>
                    <NotaCell value={nota.aval4} />
                  </View>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>MAC</Text>
                    <NotaCell value={nota.mac1 || nota.mac} />
                  </View>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>PP</Text>
                    <NotaCell value={nota.pp1} />
                  </View>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>PT</Text>
                    <NotaCell value={nota.ppt} />
                  </View>
                  <View style={styles.notaItem}>
                    <Text style={styles.notaItemLabel}>MT</Text>
                    <NotaCell value={nota.mt1} />
                  </View>
                </View>

                <View style={[styles.nfRow, { borderTopColor: Colors.border }]}>
                  <Text style={styles.nfLabel}>Nota Final (NF)</Text>
                  <Text style={[styles.nfValue, { color: nota.nf >= 10 ? Colors.success : nota.nf > 0 ? Colors.danger : Colors.textMuted }]}>
                    {nota.nf > 0 ? nota.nf.toFixed(1) : '—'}
                  </Text>
                </View>

                <View style={styles.pautaRow}>
                  <Text style={styles.pautaLabel}>Pauta:</Text>
                  <Badge
                    label={pauta ? (pauta.status === 'fechada' ? 'Fechada' : pauta.status === 'aberta' ? 'Aberta' : 'Pendente') : 'Não disponível'}
                    color={pauta?.status === 'fechada' ? Colors.success : pauta?.status === 'aberta' ? Colors.info : Colors.textMuted}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }

  function renderMensagens() {
    const filtered = mensagensAluno.filter(m => msgFilter === 'todas' ? true : m.tipo === msgFilter);
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.readonlyBanner}>
          <Ionicons name="eye-outline" size={15} color={Colors.info} />
          <Text style={styles.readonlyText}>Apenas visualização — as mensagens são enviadas pelos professores ou pela escola.</Text>
        </View>
        <View style={styles.filterRow}>
          {(['todas', 'turma', 'privada'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, msgFilter === f && styles.filterBtnActive]}
              onPress={() => setMsgFilter(f)}
            >
              <Text style={[styles.filterBtnText, msgFilter === f && styles.filterBtnTextActive]}>
                {f === 'todas' ? 'Todas' : f === 'turma' ? 'Geral da Turma' : 'Privadas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem mensagens</Text>
          </View>
        ) : (
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(msg => {
            const lida = msg.lidaPor.includes(user?.id || '');
            return (
              <TouchableOpacity
                key={msg.id}
                style={[styles.msgCard, !lida && { borderLeftWidth: 3, borderLeftColor: Colors.info }]}
                onPress={() => {
                  setMsgAberta(msg);
                  if (!lida) marcarMensagemLida(msg.id, user?.id || '');
                }}
              >
                <View style={styles.msgTop}>
                  <View style={styles.msgLeft}>
                    <Ionicons
                      name={msg.tipo === 'turma' ? 'people' : 'person'}
                      size={16}
                      color={msg.tipo === 'turma' ? Colors.info : Colors.gold}
                    />
                    <Text style={styles.msgRemetente}>{msg.remetenteNome}</Text>
                    <Badge
                      label={msg.tipo === 'turma' ? 'Turma' : 'Privada'}
                      color={msg.tipo === 'turma' ? Colors.info : Colors.gold}
                    />
                  </View>
                  {!lida && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.msgAssunto}>{msg.assunto}</Text>
                <Text style={styles.msgCorpo} numberOfLines={2}>{msg.corpo}</Text>
                <Text style={styles.msgData}>{new Date(msg.createdAt).toLocaleDateString('pt-PT')}</Text>
              </TouchableOpacity>
            );
          })
        )}

        <Modal visible={!!msgAberta} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={2}>{msgAberta?.assunto}</Text>
                <TouchableOpacity onPress={() => setMsgAberta(null)}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.msgMeta}>
                <Text style={styles.msgMetaText}>De: {msgAberta?.remetenteNome}</Text>
                <Text style={styles.msgMetaText}>{msgAberta?.createdAt ? new Date(msgAberta.createdAt).toLocaleDateString('pt-PT') : ''}</Text>
              </View>
              <ScrollView style={styles.msgScrollBody}>
                <Text style={styles.msgFullCorpo}>{msgAberta?.corpo}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setMsgAberta(null)}>
                <Text style={styles.closeBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  function renderMateriais() {
    const TIPO_ICON: Record<string, string> = {
      pdf: 'document', link: 'link', resumo: 'book', video: 'videocam', imagem: 'image',
    };
    const TIPO_COLOR: Record<string, string> = {
      pdf: Colors.danger, link: Colors.info, resumo: Colors.gold, video: Colors.success, imagem: Colors.warning,
    };
    const sorted = [...materiaisAluno].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionTitle title="Materiais Disponíveis" icon="folder-open" />
        <Text style={styles.infoHint}>Ordenados por data de envio — clique para visualizar o conteúdo</Text>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem materiais disponíveis</Text>
          </View>
        ) : (
          sorted.map(mat => {
            const iconName = TIPO_ICON[mat.tipo] || 'document-text';
            const iconColor = TIPO_COLOR[mat.tipo] || Colors.info;
            return (
              <TouchableOpacity key={mat.id} style={styles.matCard} onPress={() => setMaterialAberto(mat)} activeOpacity={0.8}>
                <View style={[styles.matIcon, { backgroundColor: iconColor + '22' }]}>
                  <Ionicons name={iconName as any} size={22} color={iconColor} />
                </View>
                <View style={styles.matInfo}>
                  <Text style={styles.matTitulo}>{mat.titulo}</Text>
                  <Text style={styles.matDisc}>{mat.disciplina}</Text>
                  <Text style={styles.matData}>{new Date(mat.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                  {mat.descricao ? <Text style={styles.matDesc} numberOfLines={1}>{mat.descricao}</Text> : null}
                </View>
                <View style={styles.matActions}>
                  <Badge label={mat.tipo.charAt(0).toUpperCase() + mat.tipo.slice(1)} color={iconColor} />
                  <View style={styles.matActionBtn}>
                    <Ionicons name="eye-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.matActionText}>Ver</Text>
                  </View>
                  {(mat.tipo === 'pdf' || mat.tipo === 'link') && (
                    <View style={styles.matActionBtn}>
                      <Ionicons name="download-outline" size={14} color={Colors.info} />
                      <Text style={[styles.matActionText, { color: Colors.info }]}>Baixar</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <Modal visible={!!materialAberto} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{materialAberto?.titulo}</Text>
                  <Text style={styles.matModalDisc}>{materialAberto?.disciplina}</Text>
                </View>
                <TouchableOpacity onPress={() => setMaterialAberto(null)}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.matModalMeta}>
                <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.matMetaText}>{materialAberto?.createdAt ? new Date(materialAberto.createdAt).toLocaleDateString('pt-PT') : ''}</Text>
                <Badge label={materialAberto?.tipo || ''} color={TIPO_COLOR[materialAberto?.tipo] || Colors.info} />
              </View>
              {materialAberto?.descricao ? <Text style={styles.matModalDesc}>{materialAberto.descricao}</Text> : null}
              {materialAberto?.tipo === 'link' ? (
                <View style={styles.matLinkBox}>
                  <Ionicons name="link" size={16} color={Colors.info} />
                  <Text style={styles.matLinkText} numberOfLines={2}>{materialAberto?.conteudo}</Text>
                </View>
              ) : (
                <ScrollView style={styles.matModalScroll}>
                  <Text style={styles.matModalConteudo}>{materialAberto?.conteudo}</Text>
                </ScrollView>
              )}
              <View style={styles.matModalFooter}>
                {(materialAberto?.tipo === 'pdf' || materialAberto?.tipo === 'link') && (
                  <TouchableOpacity style={[styles.payBtn, { flex: 1, marginRight: 8 }]}>
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={styles.payBtnText}>Descarregar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.closeBtn, { flex: 1 }]} onPress={() => setMaterialAberto(null)}>
                  <Text style={styles.closeBtnText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  function renderHorario() {
    const aulasDia = horariosAluno.filter(h => h.diaSemana === diaHorario);
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diasScroll}>
          {DIAS.map((dia, idx) => (
            <TouchableOpacity
              key={dia}
              style={[styles.diaBtn, diaHorario === idx && styles.diaBtnActive]}
              onPress={() => setDiaHorario(idx)}
            >
              <Text style={[styles.diaBtnText, diaHorario === idx && styles.diaBtnTextActive]}>{dia}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.diaFull}>{DIAS_FULL[diaHorario]}</Text>

        {aulasDia.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem aulas programadas</Text>
          </View>
        ) : (
          PERIODOS.map(periodo => {
            const aula = aulasDia.find(h => h.periodo === periodo.numero);
            return (
              <View key={periodo.numero} style={styles.periodoRow}>
                <View style={styles.periodoHora}>
                  <Text style={styles.periodoNum}>P{periodo.numero}</Text>
                  <Text style={styles.periodoTime}>{periodo.inicio}</Text>
                </View>
                {aula ? (
                  <View style={styles.aulaCard}>
                    <Text style={styles.aulaDisciplina}>{aula.disciplina}</Text>
                    <Text style={styles.aulaProf}>{aula.professorNome}</Text>
                    <View style={styles.aulaMeta}>
                      <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.aulaMetaText}>Sala {aula.sala}</Text>
                      <Text style={styles.aulaMetaText}> · {aula.horaInicio}–{aula.horaFim}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.aulaCard, styles.aulaVazia]}>
                    <Text style={styles.aulaVaziaText}>— Sem aula —</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }

  function renderDiario() {
    const base = sumariosDirectos !== null ? sumariosDirectos : sumariosAluno.filter(s => s.status !== 'rejeitado');
    const sorted = [...base].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const disciplinas = [...new Set(sorted.map(s => s.disciplina))].sort();
    const filtrado = filtroDiscDiario === 'todas' ? sorted : sorted.filter(s => s.disciplina === filtroDiscDiario);

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionTitle title="Diário de Classe" icon="journal" />
        <Text style={styles.infoHint}>Conteúdos leccionados nas aulas da sua turma</Text>

        {disciplinas.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diasScroll}>
            <TouchableOpacity
              style={[styles.diaBtn, filtroDiscDiario === 'todas' && styles.diaBtnActive]}
              onPress={() => setFiltroDiscDiario('todas')}
            >
              <Text style={[styles.diaBtnText, filtroDiscDiario === 'todas' && styles.diaBtnTextActive]}>Todas</Text>
            </TouchableOpacity>
            {disciplinas.map(disc => (
              <TouchableOpacity
                key={disc}
                style={[styles.diaBtn, filtroDiscDiario === disc && styles.diaBtnActive]}
                onPress={() => setFiltroDiscDiario(disc)}
              >
                <Text style={[styles.diaBtnText, filtroDiscDiario === disc && styles.diaBtnTextActive]} numberOfLines={1}>{disc}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {filtrado.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="journal-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem registos de aulas</Text>
            <Text style={styles.infoHint}>O diário de classe aparecerá aqui quando os professores registarem as aulas</Text>
          </View>
        ) : (
          filtrado.map((s, idx) => {
            const dataFormatada = new Date(s.data).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
            const showDateSep = idx === 0 || filtrado[idx - 1].data !== s.data;
            return (
              <React.Fragment key={s.id}>
                {showDateSep && (
                  <View style={styles.diarioDateSep}>
                    <View style={styles.diarioDateLine} />
                    <Text style={styles.diarioDateLabel}>{dataFormatada}</Text>
                    <View style={styles.diarioDateLine} />
                  </View>
                )}
                <View style={styles.diarioCard}>
                  <View style={styles.diarioCardTop}>
                    <View style={styles.diarioDiscBadge}>
                      <Ionicons name="book-outline" size={13} color={Colors.gold} />
                      <Text style={styles.diarioDiscText} numberOfLines={1}>{s.disciplina}</Text>
                    </View>
                    <View style={styles.diarioAulaNumBadge}>
                      <Text style={styles.diarioAulaNumText}>Aula {s.numeroAula}</Text>
                    </View>
                  </View>
                  <Text style={styles.diarioConteudo}>{s.conteudo}</Text>
                  {!!s.observacaoAluno && (
                    <View style={styles.diarioObsBox}>
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color={Colors.gold} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.diarioObsLabel}>Observação do Professor</Text>
                        <Text style={styles.diarioObsText}>{s.observacaoAluno}</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.diarioMeta}>
                    <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.diarioMetaText}>{s.professorNome}</Text>
                    <Text style={styles.diarioMetaDot}>·</Text>
                    <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.diarioMetaText}>{s.horaInicio} — {s.horaFim}</Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })
        )}
      </ScrollView>
    );
  }

  function renderFinanceiro() {
    const totalPago = pagamentosAluno.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
    const totalPendente = pagamentosAluno.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
    const historicoOrdenado = [...pagamentosAluno].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const unreadFinMsg = msgsFinanceiro.filter(m => !m.lida).length;

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Bloqueio Banner */}
        {isBloqueado && (
          <View style={[styles.readonlyBanner, { backgroundColor: Colors.danger + '18', borderColor: Colors.danger + '44', borderWidth: 1 }]}>
            <Ionicons name="lock-closed" size={18} color={Colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.readonlyText, { color: Colors.danger, fontFamily: 'Inter_700Bold', fontSize: 13 }]}>Acesso Bloqueado</Text>
              <Text style={[styles.readonlyText, { color: Colors.danger }]}>O seu acesso foi temporariamente suspenso por falta de pagamento. Contacte o departamento financeiro para regularizar a situação.</Text>
            </View>
          </View>
        )}

        {/* Acesso Liberto Banner */}
        {aluno && acessoLiberado.includes(aluno.id) && mesesAtraso > 0 && (
          <View style={[styles.readonlyBanner, { backgroundColor: Colors.gold + '18', borderColor: Colors.gold + '44', borderWidth: 1 }]}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.readonlyText, { color: Colors.gold, fontFamily: 'Inter_700Bold', fontSize: 13 }]}>Acesso Especial Activo</Text>
              <Text style={[styles.readonlyText, { color: Colors.gold }]}>O departamento financeiro autorizou o seu acesso ao portal apesar das propinas em atraso. Por favor regularize a situação brevemente.</Text>
            </View>
          </View>
        )}

        {/* Atraso Banner */}
        {!isBloqueado && mesesAtraso > 0 && (
          <View style={[styles.readonlyBanner, { backgroundColor: Colors.warning + '18', borderColor: Colors.warning + '44', borderWidth: 1 }]}>
            <Ionicons name="time" size={18} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.readonlyText, { color: Colors.warning, fontFamily: 'Inter_700Bold', fontSize: 13 }]}>{mesesAtraso} mês(es) de propina em atraso</Text>
              {multaConfig.ativo && multaEstimada > 0 && (
                <Text style={[styles.readonlyText, { color: Colors.warning }]}>Multa por atraso estimada: {formatAOA(multaEstimada)} ({multaConfig.percentagem}% por mês)</Text>
              )}
            </View>
          </View>
        )}

        {/* Financial Messages */}
        {msgsFinanceiro.length > 0 && (
          <>
            <SectionTitle title={`Mensagens Financeiras${unreadFinMsg > 0 ? ` (${unreadFinMsg} nova${unreadFinMsg > 1 ? 's' : ''})` : ''}`} icon="chatbubble" />
            {msgsFinanceiro.slice(0, 3).map(msg => {
              const TIPO_COLOR_MAP: Record<string, string> = { aviso: Colors.warning, bloqueio: Colors.danger, rupe: Colors.gold, geral: Colors.info };
              const msgColor = TIPO_COLOR_MAP[msg.tipo] || Colors.info;
              return (
                <TouchableOpacity key={msg.id} style={[styles.msgCard, !msg.lida && { borderLeftWidth: 3, borderLeftColor: msgColor }]}
                  onPress={() => marcarMsgFinLida(msg.id)}>
                  <View style={styles.msgTop}>
                    <View style={styles.msgLeft}>
                      <Ionicons name="chatbubble" size={14} color={msgColor} />
                      <Text style={styles.msgRemetente}>{msg.remetente}</Text>
                      <View style={{ backgroundColor: msgColor + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, color: msgColor, fontFamily: 'Inter_600SemiBold' }}>
                          {msg.tipo === 'aviso' ? 'Aviso' : msg.tipo === 'bloqueio' ? 'Bloqueio' : msg.tipo === 'rupe' ? 'RUPE' : 'Geral'}
                        </Text>
                      </View>
                    </View>
                    {!msg.lida && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.msgCorpo}>{msg.texto}</Text>
                  <Text style={styles.msgData}>{new Date(msg.data).toLocaleDateString('pt-PT')}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={styles.statsRow}>
          <StatCard value={formatAOA(totalPago)} label="Total Pago" color={Colors.success} />
          <StatCard value={formatAOA(totalPendente)} label="Pendente" color={Colors.warning} />
          <StatCard value={String(pagamentosAluno.length)} label="Transacções" color={Colors.info} />
        </View>

        <SectionTitle title="Reconfirmação de Matrícula" icon="refresh" />
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado</Text>
            <Badge
              label={reconfirmacaoAtual ? 'Confirmado' : 'Pendente'}
              color={reconfirmacaoAtual ? Colors.success : Colors.warning}
            />
          </View>
          {reconfirmacaoAtual && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Data</Text>
              <Text style={styles.infoVal}>{new Date(reconfirmacaoAtual.data).toLocaleDateString('pt-PT')}</Text>
            </View>
          )}
          {!!(aluno as any)?.bloqueioRenovacao && !reconfirmacaoAtual && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.danger + '15', borderRadius: 12, borderWidth: 1, borderColor: Colors.danger + '40', padding: 12, marginBottom: 10 }}>
              <Ionicons name="lock-closed" size={16} color={Colors.danger} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.danger }}>Renovação Bloqueada</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.danger, marginTop: 2, lineHeight: 18 }}>
                  {(aluno as any)?.motivoBloqueioRenovacao
                    ? (aluno as any).motivoBloqueioRenovacao
                    : 'A renovação da sua matrícula foi bloqueada pela secretaria. Contacte a secretaria para mais informações.'}
                </Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={[styles.payBtn, reconfirmacaoAtual && { backgroundColor: Colors.success }, !!(aluno as any)?.bloqueioRenovacao && !reconfirmacaoAtual && { backgroundColor: Colors.textMuted }]}
            onPress={() => {
              if (!!(aluno as any)?.bloqueioRenovacao && !reconfirmacaoAtual) {
                webAlert('Renovação Bloqueada', 'A renovação da sua matrícula está temporariamente suspensa. Contacte a secretaria para regularizar a situação.');
                return;
              }
              reconfirmacaoAtual ? webAlert('Já confirmado', 'A matrícula já está reconfirmada.') : setShowReconfirmacaoModal(true);
            }}
          >
            <Ionicons name={reconfirmacaoAtual ? 'checkmark-circle' : !!(aluno as any)?.bloqueioRenovacao ? 'lock-closed' : 'refresh'} size={18} color="#fff" />
            <Text style={styles.payBtnText}>{reconfirmacaoAtual ? 'Matrícula Confirmada' : !!(aluno as any)?.bloqueioRenovacao ? 'Renovação Bloqueada' : 'Reconfirmar Matrícula'}</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle title="Rubricas Disponíveis" icon="pricetag" />
        <Text style={styles.infoHint}>Todas as rubricas activas para o ano lectivo {anoLetivo}. Clique em "Pagar" para gerar uma referência.</Text>

        {todasTaxasAluno.length === 0 ? (
          <View style={[styles.emptyState, { marginBottom: 16 }]}>
            <Ionicons name="pricetag-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem rubricas configuradas para este ano</Text>
          </View>
        ) : (
          todasTaxasAluno.map(taxa => {
            const jaTemPendente = pagamentosAluno.some(p => p.taxaId === taxa.id && p.status === 'pendente');
            const TIPO_ICON_MAP: Record<string, string> = { propina: 'school', matricula: 'document', material: 'book', exame: 'document-text', outro: 'cash' };
            const TIPO_COLOR_MAP: Record<string, string> = { propina: Colors.info, matricula: Colors.gold, material: Colors.success, exame: Colors.warning, outro: Colors.textMuted };
            const taxaIcon = TIPO_ICON_MAP[taxa.tipo] || 'cash';
            const taxaColor = TIPO_COLOR_MAP[taxa.tipo] || Colors.info;
            return (
              <View key={taxa.id} style={styles.taxaCard}>
                <View style={styles.taxaLeft}>
                  <View style={[styles.taxaIconBox, { backgroundColor: taxaColor + '22' }]}>
                    <Ionicons name={taxaIcon as any} size={20} color={taxaColor} />
                  </View>
                  <View style={styles.taxaInfo}>
                    <Text style={styles.taxaTitulo}>{taxa.descricao}</Text>
                    <Text style={styles.taxaMeta}>{taxa.frequencia} · {taxa.nivel || 'Todos os níveis'}</Text>
                    {jaTemPendente && <Badge label="Referência Gerada" color={Colors.warning} />}
                  </View>
                </View>
                <View style={styles.taxaRight}>
                  <Text style={[styles.taxaValor, { color: Colors.gold }]}>{formatAOA(taxa.valor)}</Text>
                  <TouchableOpacity
                    style={[styles.payBtnSmall, jaTemPendente && { backgroundColor: Colors.warning + '44' }]}
                    onPress={() => { setTaxaParaPagar(taxa); setMetodoPagarTaxa('rupe'); }}
                  >
                    <Text style={styles.payBtnSmallText}>{jaTemPendente ? 'Pagar novamente' : 'Pagar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* RUPEs Gerados */}
        {rupesAluno.length > 0 && (
          <>
            <SectionTitle title="Referências RUPE" icon="receipt" />
            {rupesAluno.map(r => {
              const t = taxas.find(x => x.id === r.taxaId);
              const expirado = new Date(r.dataValidade) < new Date();
              return (
                <View key={r.id} style={[styles.pagCard, { borderLeftWidth: 2, borderLeftColor: Colors.gold }]}>
                  <View style={styles.pagTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pagDesc}>{t?.descricao || 'Rubrica'}</Text>
                      <Text style={[styles.pagRef, { color: Colors.gold }]}>{r.referencia}</Text>
                      <Text style={styles.pagMetaText}>Válido até: {new Date(r.dataValidade).toLocaleDateString('pt-PT')}</Text>
                    </View>
                    <View style={{ backgroundColor: (expirado ? Colors.danger : Colors.gold) + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, color: expirado ? Colors.danger : Colors.gold, fontFamily: 'Inter_600SemiBold' }}>{expirado ? 'Expirado' : 'Activo'}</Text>
                    </View>
                  </View>
                  <View style={styles.pagBottom}>
                    <Text style={[styles.pagValor, { color: Colors.gold }]}>{formatAOA(r.valor)}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <SectionTitle title="Histórico Financeiro" icon="receipt" />
        {historicoOrdenado.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem transacções registadas</Text>
          </View>
        ) : (
          historicoOrdenado.map(pag => {
            const taxa = taxas.find(t => t.id === pag.taxaId);
            const statusColor = pag.status === 'pago' ? Colors.success : pag.status === 'pendente' ? Colors.warning : Colors.danger;
            const statusLabel = pag.status === 'pago' ? 'Pago' : pag.status === 'pendente' ? 'Pendente' : 'Cancelado';
            const comprProof = pag.observacao?.match(/Comprovativo:\s*(.+)/)?.[1];
            return (
              <View key={pag.id} style={styles.pagCard}>
                <View style={styles.pagTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pagDesc}>{taxa?.descricao || pag.observacao || 'Pagamento'}</Text>
                    <Text style={styles.pagMetaText}>{pag.data} {pag.mes ? `· Mês ${pag.mes}` : ''}</Text>
                    {comprProof && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Ionicons name="document-attach" size={11} color={Colors.success} />
                        <Text style={{ fontSize: 10, color: Colors.success, fontFamily: 'Inter_600SemiBold' }}>Comprovativo: {comprProof}</Text>
                      </View>
                    )}
                  </View>
                  <Badge label={statusLabel} color={statusColor} />
                </View>
                <View style={styles.pagBottom}>
                  <Text style={[styles.pagValor, { color: Colors.gold }]}>{formatAOA(pag.valor)}</Text>
                  {pag.referencia ? (
                    <View style={styles.pagRefRow}>
                      <Ionicons name="barcode-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.pagRef}>{pag.referencia}</Text>
                    </View>
                  ) : null}
                  {pag.metodoPagamento && (
                    <Badge
                      label={pag.metodoPagamento === 'multicaixa' ? 'Multicaixa' : 'RUPE/Transfer.'}
                      color={pag.metodoPagamento === 'multicaixa' ? Colors.success : Colors.info}
                    />
                  )}
                </View>
                {pag.status === 'pendente' && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 8, backgroundColor: Colors.info + '18', borderRadius: 8, borderWidth: 1, borderColor: Colors.info + '44' }}
                    onPress={() => { setComprPagId(pag.id); setComprPagText(comprProof || ''); setShowComprModal(true); }}
                  >
                    <Ionicons name="document-attach-outline" size={14} color={Colors.info} />
                    <Text style={{ color: Colors.info, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                      {comprProof ? 'Actualizar Comprovativo' : 'Submeter Comprovativo'}
                    </Text>
                  </TouchableOpacity>
                )}
                {pag.status === 'pago' && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 8, backgroundColor: Colors.success + '14', borderRadius: 8, borderWidth: 1, borderColor: Colors.success + '44' }}
                    onPress={() => imprimirComprovativo(pag)}
                  >
                    <Ionicons name="print-outline" size={14} color={Colors.success} />
                    <Text style={{ color: Colors.success, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                      Imprimir Comprovativo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* Modal Pagar Taxa */}
        <Modal visible={!!taxaParaPagar} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Gerar Referência de Pagamento</Text>
                <TouchableOpacity onPress={() => setTaxaParaPagar(null)}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {taxaParaPagar && (
                <>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Rubrica</Text><Text style={styles.infoVal}>{taxaParaPagar.descricao}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Valor</Text><Text style={[styles.infoVal, { color: Colors.gold }]}>{formatAOA(taxaParaPagar.valor)}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Frequência</Text><Text style={styles.infoVal}>{taxaParaPagar.frequencia}</Text></View>
                  </View>
                  <Text style={styles.formLabel}>Método de Pagamento</Text>
                  <View style={styles.metodoRow}>
                    <TouchableOpacity style={[styles.metodoBtn, metodoPagarTaxa === 'rupe' && styles.metodoBtnActive]} onPress={() => setMetodoPagarTaxa('rupe')}>
                      <Text style={[styles.metodoBtnText, metodoPagarTaxa === 'rupe' && styles.metodoBtnTextActive]}>RUPE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.metodoBtn, metodoPagarTaxa === 'multicaixa' && styles.metodoBtnActive]} onPress={() => setMetodoPagarTaxa('multicaixa')}>
                      <Text style={[styles.metodoBtnText, metodoPagarTaxa === 'multicaixa' && styles.metodoBtnTextActive]}>Multicaixa Express</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.formLabel}>Comprovativo (opcional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="N.º transferência, referência bancária, etc."
                    placeholderTextColor={Colors.textMuted}
                    value={comprovanteInput}
                    onChangeText={setComprovanteInput}
                  />
                  <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
                    Se já efectuou o pagamento, indique a referência para facilitar a validação.
                  </Text>
                  <TouchableOpacity style={styles.submitBtn} onPress={handlePagarTaxa}>
                    <Text style={styles.submitBtnText}>Gerar Referência</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal Submeter Comprovativo */}
        <Modal visible={showComprModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Submeter Comprovativo</Text>
                <TouchableOpacity onPress={() => setShowComprModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>
                Indique a referência bancária, número de transferência ou outra informação que comprove o seu pagamento. O departamento financeiro irá validar e confirmar o pagamento.
              </Text>
              <Text style={styles.formLabel}>Referência / Comprovativo</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: TRF-2026-123456 ou REF ATM 998877"
                placeholderTextColor={Colors.textMuted}
                value={comprPagText}
                onChangeText={setComprPagText}
              />
              <TouchableOpacity
                style={[styles.submitBtn, !comprPagText.trim() && { opacity: 0.5 }]}
                onPress={handleSubmitComprovativo}
                disabled={!comprPagText.trim()}
              >
                <Text style={styles.submitBtnText}>Enviar Comprovativo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal Reconfirmação */}
        <Modal visible={showReconfirmacaoModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reconfirmação de Matrícula</Text>
                <TouchableOpacity onPress={() => setShowReconfirmacaoModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.reconfText}>
                Confirma a sua matrícula para o ano lectivo <Text style={{ color: Colors.gold }}>{anoLetivo}</Text> na turma <Text style={{ color: Colors.gold }}>{turmaAluno?.nome || '—'}</Text>?
              </Text>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>N.º Matrícula</Text><Text style={styles.infoVal}>{aluno?.numeroMatricula}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Classe</Text><Text style={styles.infoVal}>{turmaAluno?.classe}ª Classe</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Nível</Text><Text style={styles.infoVal}>{turmaAluno?.nivel}</Text></View>
              <TouchableOpacity style={styles.submitBtn} onPress={handleReconfirmacao}>
                <Text style={styles.submitBtnText}>Confirmar Matrícula</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  function renderHistorico() {
    type LogItem = {
      id: string;
      data: string;
      tipo: 'nota' | 'pagamento' | 'presenca' | 'documento' | 'matricula';
      titulo: string;
      subtitulo: string;
      cor: string;
      icone: string;
    };

    const logItems: LogItem[] = [];

    notasAluno.forEach(n => {
      if (n.nf > 0) {
        const status = getStatusDisciplina(n.nf, n.trimestre);
        logItems.push({
          id: `nota-${n.id}`,
          data: n.data || `${anoLetivo}-01-01`,
          tipo: 'nota',
          titulo: `Nota lançada — ${n.disciplina}`,
          subtitulo: `${n.trimestre}º Trimestre · NF: ${n.nf.toFixed(1)} · ${status.label}`,
          cor: status.color,
          icone: status.icon,
        });
      }
    });

    pagamentosAluno.forEach(p => {
      const taxa = taxas.find(t => t.id === p.taxaId);
      const statusColor = p.status === 'pago' ? Colors.success : p.status === 'pendente' ? Colors.warning : Colors.danger;
      logItems.push({
        id: `pag-${p.id}`,
        data: p.createdAt || p.data,
        tipo: 'pagamento',
        titulo: `Pagamento — ${taxa?.descricao || p.observacao || 'Rubrica'}`,
        subtitulo: `${formatAOA(p.valor)} · ${p.status === 'pago' ? 'Pago' : p.status === 'pendente' ? 'Pendente' : 'Cancelado'}${p.referencia ? ` · Ref: ${p.referencia}` : ''}`,
        cor: statusColor,
        icone: p.status === 'pago' ? 'checkmark-circle' : p.status === 'pendente' ? 'time' : 'close-circle',
      });
    });

    presAluno.forEach(p => {
      const statusColor = p.status === 'P' ? Colors.success : p.status === 'J' ? Colors.warning : Colors.danger;
      const statusLabel = p.status === 'P' ? 'Presente' : p.status === 'J' ? 'Falta Justificada' : 'Falta';
      const icon = p.status === 'P' ? 'checkmark-circle' : p.status === 'J' ? 'shield-checkmark' : 'close-circle';
      logItems.push({
        id: `pres-${p.id}`,
        data: p.data,
        tipo: 'presenca',
        titulo: `${statusLabel} — ${p.disciplina}`,
        subtitulo: `Data: ${new Date(p.data).toLocaleDateString('pt-PT')}`,
        cor: statusColor,
        icone: icon,
      });
    });

    solicitacoesAluno.forEach(s => {
      const statusColor = s.status === 'pronto' ? Colors.success : s.status === 'em_processamento' ? Colors.info : Colors.warning;
      logItems.push({
        id: `sol-${s.id}`,
        data: s.createdAt,
        tipo: 'documento',
        titulo: `Documento solicitado — ${s.tipo}`,
        subtitulo: `Motivo: ${s.motivo} · ${s.status === 'pronto' ? 'Pronto' : s.status === 'em_processamento' ? 'Em Processamento' : 'Pendente'}`,
        cor: statusColor,
        icone: 'document-text',
      });
    });

    if (reconfirmacaoAtual) {
      logItems.push({
        id: `reconf-${reconfirmacaoAtual.id || 'rc'}`,
        data: reconfirmacaoAtual.data,
        tipo: 'matricula',
        titulo: 'Matrícula Reconfirmada',
        subtitulo: `Ano lectivo ${reconfirmacaoAtual.anoLetivo} — Confirmado em ${new Date(reconfirmacaoAtual.data).toLocaleDateString('pt-PT')}`,
        cor: Colors.success,
        icone: 'school',
      });
    }

    const sorted = logItems.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const TIPO_LABELS: Record<string, string> = {
      nota: 'Nota',
      pagamento: 'Financeiro',
      presenca: 'Presença',
      documento: 'Documento',
      matricula: 'Matrícula',
    };

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionTitle title="Resumo do Ano" icon="stats-chart" />
        <View style={styles.statsRow}>
          <StatCard value={aprovadas} label="Aprovadas" color={Colors.success} />
          <StatCard value={reprovadas} label="Reprovadas" color={Colors.danger} />
          <StatCard value={mediaGeral} label="Média" color={Colors.gold} />
          <StatCard value={`${pctPresenca}%`} label="Presenças" color={Colors.info} />
        </View>

        <SectionTitle title="Registo de Atividades" icon="time" />
        <Text style={styles.infoHint}>Histórico completo de tudo o que foi feito neste ano lectivo, ordenado por data.</Text>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>Sem atividades registadas</Text>
          </View>
        ) : (
          sorted.map(item => (
            <View key={item.id} style={[styles.logCard, { borderLeftColor: item.cor }]}>
              <View style={[styles.logIconBox, { backgroundColor: item.cor + '22' }]}>
                <Ionicons name={item.icone as any} size={18} color={item.cor} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.logTop}>
                  <Text style={styles.logTitulo} numberOfLines={1}>{item.titulo}</Text>
                  <Badge label={TIPO_LABELS[item.tipo]} color={item.cor} />
                </View>
                <Text style={styles.logSub} numberOfLines={2}>{item.subtitulo}</Text>
                <Text style={styles.logData}>
                  {new Date(item.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  function renderDocumentos() {
    const tiposJaEmitidos = [...new Set(documentosEmitidos.map(d => d.tipo))];
    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionTitle title="Pedir Declaração / Documento" icon="document-text" />
        <TouchableOpacity style={styles.payBtn} onPress={() => setShowSolicitacaoModal(true)}>
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={styles.payBtnText}>Nova Solicitação</Text>
        </TouchableOpacity>

        {tiposJaEmitidos.length > 0 && (
          <View style={styles.docBadgesSection}>
            <Text style={styles.docBadgesTitle}>Tipos de documentos já emitidos:</Text>
            <View style={styles.docBadgesRow}>
              {tiposJaEmitidos.map(tipo => (
                <View key={tipo} style={styles.docTypeBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                  <Text style={styles.docTypeBadgeText} numberOfLines={1}>{tipo}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: 20 }}>
          <SectionTitle title="Histórico de Documentos Emitidos" icon="time" />
          {loadingDocs ? (
            <ActivityIndicator color={Colors.gold} style={{ marginVertical: 20 }} />
          ) : documentosEmitidos.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyStateText}>Nenhum documento emitido ainda</Text>
            </View>
          ) : (
            documentosEmitidos.map(doc => (
              <View key={doc.id} style={styles.docHistCard}>
                <View style={styles.docHistTop}>
                  <View style={styles.docHistIconWrap}>
                    <Ionicons name="document-text" size={20} color={Colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docHistTipo}>{doc.tipo}</Text>
                    {doc.anoAcademico ? (
                      <Text style={styles.docHistMeta}>Ano lectivo: {doc.anoAcademico}</Text>
                    ) : null}
                    {doc.alunoTurma ? (
                      <Text style={styles.docHistMeta}>Turma: {doc.alunoTurma}</Text>
                    ) : null}
                    <Text style={styles.docHistData}>
                      Emitido em {new Date(doc.emitidoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.docReemitirBtn}
                  onPress={() => {
                    setSolForm({ tipo: doc.tipo, motivo: 'Renovação com dados actualizados', observacao: '' });
                    setShowSolicitacaoModal(true);
                  }}
                >
                  <Ionicons name="refresh" size={14} color={Colors.gold} />
                  <Text style={styles.docReemitirText}>Solicitar Novamente</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ marginTop: 20 }}>
          <SectionTitle title="Minhas Solicitações" icon="list" />
          {solicitacoesAluno.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyStateText}>Sem solicitações de documentos</Text>
            </View>
          ) : (
            solicitacoesAluno.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(sol => (
              <View key={sol.id} style={styles.solCard}>
                <View style={styles.solTop}>
                  <Text style={styles.solTipo}>{sol.tipo}</Text>
                  <Badge
                    label={sol.status === 'pendente' ? 'Pendente' : sol.status === 'em_processamento' ? 'Em Processamento' : sol.status === 'pronto' ? 'Pronto' : 'Pendente'}
                    color={sol.status === 'pronto' ? Colors.success : sol.status === 'em_processamento' ? Colors.info : Colors.warning}
                  />
                </View>
                <Text style={styles.solMotivo}>Motivo: {sol.motivo}</Text>
                {sol.observacao ? <Text style={styles.solObs}>{sol.observacao}</Text> : null}
                <Text style={styles.solData}>{new Date(sol.createdAt).toLocaleDateString('pt-PT')}</Text>
              </View>
            ))
          )}
        </View>

        <Modal visible={showSolicitacaoModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Solicitação</Text>
                <TouchableOpacity onPress={() => setShowSolicitacaoModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.formLabel}>Tipo de Documento</Text>
              <ScrollView style={{ maxHeight: 160, marginBottom: 12 }}>
                {TIPOS_DOC.map(tipo => (
                  <TouchableOpacity
                    key={tipo}
                    style={[styles.rubricaItem, solForm.tipo === tipo && styles.rubricaItemActive]}
                    onPress={() => setSolForm(f => ({ ...f, tipo }))}
                  >
                    <Text style={[styles.rubricaText, solForm.tipo === tipo && { color: Colors.gold }]}>{tipo}</Text>
                    {solForm.tipo === tipo && <Ionicons name="checkmark" size={16} color={Colors.gold} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.formLabel}>Motivo *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Indique o motivo da solicitação..."
                placeholderTextColor={Colors.textMuted}
                value={solForm.motivo}
                onChangeText={v => setSolForm(f => ({ ...f, motivo: v }))}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.formLabel}>Observação (opcional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Informação adicional..."
                placeholderTextColor={Colors.textMuted}
                value={solForm.observacao}
                onChangeText={v => setSolForm(f => ({ ...f, observacao: v }))}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleSolicitarDocumento}>
                <Text style={styles.submitBtnText}>Enviar Solicitação</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  function renderFaltas() {
    const apenasAusencias = presAluno
      .filter(p => p.status === 'F' || p.status === 'J')
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const todasDisciplinasComDados = Array.from(new Set([
      ...apenasAusencias.map(p => p.disciplina),
      ...registosFalta.map(r => r.disciplina),
    ])).filter(Boolean).sort();

    const disciplinasFiltro = ['todas', ...todasDisciplinasComDados];

    const listaFiltrada = faltaFiltroDisc === 'todas'
      ? apenasAusencias
      : apenasAusencias.filter(p => p.disciplina === faltaFiltroDisc);

    const totalFaltas = apenasAusencias.filter(p => p.status === 'F').length;
    const totalJustificadas = apenasAusencias.filter(p => p.status === 'J').length;
    const totalAulas = presAluno.length;

    const STATUS_COLOR: Record<string, string> = {
      normal: Colors.success,
      em_risco: Colors.warning,
      excluido: Colors.danger,
    };
    const STATUS_LABEL: Record<string, string> = {
      normal: 'Normal',
      em_risco: 'Em Risco',
      excluido: 'Excluído',
    };
    const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    const registosPorDisc = registosFalta.reduce<Record<string, any[]>>((acc, r) => {
      if (!acc[r.disciplina]) acc[r.disciplina] = [];
      acc[r.disciplina].push(r);
      return acc;
    }, {});

    const exclusoesActivas = exclusoesFalta.filter(e => e.status === 'ativa');

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* ── Estatísticas Gerais ── */}
        <SectionTitle title="Resumo de Presenças" icon="stats-chart" />
        <View style={styles.statsRow}>
          <StatCard value={`${pctPresenca}%`} label="Presenças" color={pctPresenca >= 75 ? Colors.success : Colors.danger} />
          <StatCard value={totalFaltas} label="Faltas" color={Colors.danger} />
          <StatCard value={totalJustificadas} label="Justificadas" color={Colors.warning} />
          <StatCard value={totalAulas} label="Total Aulas" color={Colors.info} />
        </View>

        {pctPresenca < 75 && (
          <View style={[styles.alertCard, { borderColor: Colors.danger + '55' }]}>
            <Ionicons name="warning" size={18} color={Colors.danger} />
            <Text style={[styles.alertText, { color: Colors.danger }]}>
              Atenção: frequência abaixo de 75%. Risco de exclusão por faltas.
            </Text>
          </View>
        )}

        {/* ── Exclusões activas ── */}
        {exclusoesActivas.length > 0 && (
          <>
            <SectionTitle title="Exclusões Activas" icon="alert-circle" />
            <View style={{ gap: 8, marginBottom: 4 }}>
              {exclusoesActivas.map(e => (
                <View key={e.id} style={[styles.faltaRow, { borderLeftColor: Colors.danger, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.faltaIconBox, { backgroundColor: Colors.danger + '18' }]}>
                      <Ionicons name="ban" size={20} color={Colors.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.faltaDisc}>{e.disciplina}</Text>
                      <Text style={styles.faltaData}>
                        {e.totalFaltasAcumuladas} falta(s) acumuladas · limite: {e.limiteFaltas}
                      </Text>
                      {e.motivo ? <Text style={styles.faltaObs} numberOfLines={2}>{e.motivo}</Text> : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: Colors.danger + '18', borderColor: Colors.danger + '55' }]}>
                      <Text style={[styles.badgeText, { color: Colors.danger }]}>Excluído</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setShowJustModal({ disciplina: e.disciplina }); setJustMotivo(''); }}
                    style={{ backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons name="document-text-outline" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Solicitar Justificação</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Resumo mensal por disciplina ── */}
        {registosFalta.length > 0 && (
          <>
            <SectionTitle title="Faltas por Disciplina (Mensal)" icon="grid" />
            <View style={{ gap: 10, marginBottom: 4 }}>
              {Object.entries(registosPorDisc).map(([disc, registos]) => {
                const piorStatus = registos.reduce((worst, r) => {
                  const order = ['normal', 'em_risco', 'excluido'];
                  return order.indexOf(r.status) > order.indexOf(worst) ? r.status : worst;
                }, 'normal');
                const totalDisc = registos.reduce((s, r) => s + (r.totalFaltas || 0), 0);
                const justDisc = registos.reduce((s, r) => s + (r.faltasJustificadas || 0), 0);
                const cor = STATUS_COLOR[piorStatus] || Colors.textSecondary;
                return (
                  <View key={disc} style={[styles.faltaRow, { borderLeftColor: cor, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.faltaIconBox, { backgroundColor: cor + '18' }]}>
                        <MaterialCommunityIcons name="book-open-variant" size={18} color={cor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.faltaDisc}>{disc}</Text>
                        <Text style={styles.faltaData}>
                          {totalDisc} falta(s) total · {justDisc} justificada(s)
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: cor + '18', borderColor: cor + '55' }]}>
                        <Text style={[styles.badgeText, { color: cor }]}>{STATUS_LABEL[piorStatus] || piorStatus}</Text>
                      </View>
                    </View>
                    {/* Detalhe mês a mês */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {registos.map(r => {
                          const c = STATUS_COLOR[r.status] || Colors.textSecondary;
                          return (
                            <View key={r.id} style={{ alignItems: 'center', backgroundColor: c + '14', borderRadius: 8, padding: 8, minWidth: 56, borderWidth: 1, borderColor: c + '40' }}>
                              <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 2 }}>{MESES_PT[(r.mes || 1) - 1]}</Text>
                              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: c }}>{r.totalFaltas}</Text>
                              <Text style={{ fontSize: 9, color: Colors.textMuted }}>faltas</Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                    {(piorStatus === 'em_risco' || piorStatus === 'excluido') && (
                      <TouchableOpacity
                        onPress={() => { setShowJustModal({ disciplina: disc }); setJustMotivo(''); }}
                        style={{ backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <Ionicons name="document-text-outline" size={13} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Justificar Faltas</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Registo diário de faltas ── */}
        <SectionTitle title="Filtrar por Disciplina" icon="filter" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
            {disciplinasFiltro.map(disc => (
              <TouchableOpacity
                key={disc}
                onPress={() => setFaltaFiltroDisc(disc)}
                style={[styles.filterChip, faltaFiltroDisc === disc && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, faltaFiltroDisc === disc && styles.filterChipTextActive]}>
                  {disc === 'todas' ? 'Todas' : disc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <SectionTitle title={`Registo de Faltas${faltaFiltroDisc !== 'todas' ? ` — ${faltaFiltroDisc}` : ''}`} icon="calendar" />

        {listaFiltrada.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.emptyStateTitle}>Sem faltas registadas</Text>
            <Text style={styles.emptyStateSubtitle}>
              {faltaFiltroDisc === 'todas'
                ? 'Não existem faltas ou ausências registadas.'
                : `Sem faltas registadas em ${faltaFiltroDisc}.`}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {listaFiltrada.map(p => {
              const isJustificada = p.status === 'J';
              const cor = isJustificada ? Colors.warning : Colors.danger;
              const label = isJustificada ? 'Justificada' : 'Falta';
              const icone = isJustificada ? 'shield-checkmark' : 'close-circle';
              const dataFormatada = (() => {
                try {
                  return new Date(p.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
                } catch { return p.data; }
              })();
              return (
                <View key={p.id} style={[styles.faltaRow, { borderLeftColor: cor }]}>
                  <View style={[styles.faltaIconBox, { backgroundColor: cor + '18' }]}>
                    <Ionicons name={icone as any} size={20} color={cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.faltaDisc} numberOfLines={1}>{p.disciplina}</Text>
                    <Text style={styles.faltaData}>{dataFormatada}</Text>
                    {p.observacao ? (
                      <Text style={styles.faltaObs} numberOfLines={2}>{p.observacao}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: cor + '18', borderColor: cor + '55' }]}>
                      <Text style={[styles.badgeText, { color: cor }]}>{label}</Text>
                    </View>
                    {!isJustificada && (
                      <TouchableOpacity
                        onPress={() => { setShowJustModal({ disciplina: p.disciplina }); setJustMotivo(''); }}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.primary + '80' }}
                      >
                        <Text style={{ color: Colors.primary, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>Justificar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'painel': return renderPainel();
      case 'cartao': return renderCartao();
      case 'notas': return renderNotas();
      case 'faltas': return renderFaltas();
      case 'diario': return renderDiario();
      case 'mensagens': return renderMensagens();
      case 'materiais': return renderMateriais();
      case 'horario': return renderHorario();
      case 'financeiro': return renderFinanceiro();
      case 'historico': return renderHistorico();
      case 'documentos': return renderDocumentos();
      default: return null;
    }
  }

  const foto = (user as any)?.avatar || aluno?.foto;
  const initials = user?.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'AL';

  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEnterToSave(handleSubmitJustificacao, !!showJustModal);

  return (
    <View style={styles.container}>
      <TopBar title="Portal do Estudante" subtitle={turmaAluno?.nome || 'Área do Aluno'} />

      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickPhoto} activeOpacity={0.8}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.cameraBtn}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.nome}</Text>
          <Text style={styles.profileMat}>{aluno?.numeroMatricula || 'Aluno'}</Text>
          {turmaAluno && (
            <View style={styles.profileBadgeRow}>
              <Badge label={turmaAluno.nome} color={Colors.info} />
              <Badge label={turmaAluno.nivel} color={Colors.gold} />
              <Badge label={turmaAluno.turno} color={Colors.success} />
            </View>
          )}
        </View>
      </View>

      {/* Section Navigator — grelha completa só no Painel, barra compacta nas restantes */}
      {activeTab === 'painel' ? (
        <View style={styles.sectionNavWrapper}>
          <View style={styles.sectionNavGrid}>
            {TABS.filter(t => t.key !== 'painel').map(tab => {
              const hasBadge = tab.key === 'mensagens' && unreadMsgs > 0;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.sectionNavItem}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionNavIconWrap}>
                    <Ionicons name={tab.icon as any} size={20} color={Colors.textSecondary} />
                    {hasBadge && (
                      <View style={styles.sectionNavBadge}>
                        <Text style={styles.sectionNavBadgeText}>{unreadMsgs}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sectionNavLabel} numberOfLines={1}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.sectionBarCompact}>
          <TouchableOpacity
            style={styles.sectionBarBack}
            onPress={() => setActiveTab('painel')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={18} color={Colors.gold} />
            <Text style={styles.sectionBarBackText}>Painel</Text>
          </TouchableOpacity>
          <View style={styles.sectionBarCurrent}>
            {(() => {
              const t = TABS.find(t => t.key === activeTab)!;
              return (
                <>
                  <Ionicons name={t.icon as any} size={15} color={Colors.gold} />
                  <Text style={styles.sectionBarCurrentText}>{t.label}</Text>
                </>
              );
            })()}
          </View>
          <View style={styles.sectionBarDots}>
            {TABS.filter(t => t.key !== 'painel').map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.sectionBarDot, activeTab === t.key && styles.sectionBarDotActive]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              />
            ))}
          </View>
        </View>
      )}

      {/* Content */}
      <View style={[styles.content, { paddingBottom: bottomInset }]}>
        {renderTabContent()}
      </View>

      {aluno && (
        <ContinuidadeStatusModal
          visible={showContinuidade}
          onClose={() => setShowContinuidade(false)}
          alunoId={aluno.id}
          alunoNome={`${aluno.nome} ${aluno.apelido}`}
        />
      )}

      <Modal visible={showPhotoChangedModal} transparent animationType="fade" onRequestClose={() => setShowPhotoChangedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 32 }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.success + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 8 }]}>Foto Actualizada</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, paddingHorizontal: 8 }}>
              A tua foto de perfil foi alterada com sucesso. Já aparece no canto superior direito e no teu cartão de estudante.
            </Text>
            {foto ? (
              <Image source={{ uri: foto }} style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: Colors.gold, marginBottom: 24 }} />
            ) : null}
            <TouchableOpacity
              style={{ backgroundColor: Colors.success, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 }}
              onPress={() => setShowPhotoChangedModal(false)}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Justificação de Faltas ── */}
      <Modal visible={!!showJustModal} transparent animationType="slide" onRequestClose={() => setShowJustModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Justificar Faltas</Text>
              <TouchableOpacity onPress={() => setShowJustModal(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {showJustModal && (
              <View style={{ backgroundColor: Colors.primary + '18', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.gold }}>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 2 }}>Disciplina</Text>
                <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text }}>{showJustModal.disciplina}</Text>
              </View>
            )}
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 6 }}>
              Motivo / Justificação *
            </Text>
            <TextInput
              style={[styles.readonlyField, { height: 90, textAlignVertical: 'top', paddingTop: 10 }]}
              value={justMotivo}
              onChangeText={setJustMotivo}
              placeholder="Descreva o motivo das suas faltas (doença, motivo familiar, etc.)..."
              placeholderTextColor={Colors.textMuted}
              multiline
              editable={!justSaving}
            />
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 16, marginTop: 4 }}>
              A sua justificação será analisada pela secretaria e poderá aprovar ou rejeitar o pedido.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowJustModal(null)}
                style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitJustificacao}
                disabled={justSaving}
                style={{ flex: 2, borderRadius: 10, backgroundColor: Colors.primary, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                {justSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons name="paper-plane" size={16} color="#fff" />
                      <Text style={{ fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 14 }}>Submeter Pedido</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  avatarText: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff' },
  cameraBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  profileMat: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 6 },
  profileBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  sectionNavWrapper: {
    backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionNavGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sectionNavItem: {
    width: '33.333%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 4,
    position: 'relative',
  },
  sectionNavItemActive: {
    backgroundColor: Colors.gold + '14',
  },
  sectionNavIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border + '66',
    position: 'relative',
  },
  sectionNavIconWrapActive: {
    backgroundColor: Colors.gold + '22',
  },
  sectionNavBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  sectionNavBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff' },
  sectionNavLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textAlign: 'center' },
  sectionNavLabelActive: { color: Colors.gold, fontFamily: 'Inter_700Bold' },
  sectionNavActiveLine: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: Colors.gold,
    borderRadius: 1,
  },

  sectionBarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  sectionBarBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.gold + '18',
    borderWidth: 1,
    borderColor: Colors.gold + '33',
  },
  sectionBarBackText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.gold,
  },
  sectionBarCurrent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  sectionBarCurrentText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  sectionBarDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionBarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  sectionBarDotActive: {
    width: 16,
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },

  content: { flex: 1 },
  tabContent: { padding: 16, paddingBottom: 32 },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  sectionTitleText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 1 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '22%', backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statValue: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 3, textAlign: 'center' },

  infoCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoVal: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text, flex: 1, textAlign: 'right' },
  infoHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 12 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.info + '18',
    borderWidth: 1,
    borderColor: Colors.info + '44',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.info },

  discRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  discLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  discNome: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text, flex: 1 },

  trimestreSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  trimBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.backgroundCard, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  trimBtnActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '88' },
  trimBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  trimBtnTextActive: { color: Colors.gold },
  miniPautaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1a6b3c', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 },
  miniPautaBtnDisabled: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  miniPautaBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff', flex: 1, textAlign: 'center' },
  continuidadeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.info + '14', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.info + '40' },
  continuidadeBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.info, flex: 1 },

  emptyState: { alignItems: 'center', padding: 32, gap: 12 },
  emptyStateText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  emptyStateTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },
  emptyStateSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.gold },

  faltaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3 },
  faltaIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  faltaDisc: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  faltaData: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  faltaObs: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 3, fontStyle: 'italic' },

  notaCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  notaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  notaDisc: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1 },
  notaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  notaItem: { alignItems: 'center', gap: 4 },
  notaItemLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  notaCell: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  notaValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  nfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1 },
  nfLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  nfValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  pautaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pautaLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.backgroundCard, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.info + '22', borderColor: Colors.info + '66' },
  filterBtnText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  filterBtnTextActive: { color: Colors.info },

  msgCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  msgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  msgLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  msgRemetente: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.info },
  msgAssunto: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  msgCorpo: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 6 },
  msgData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  msgMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  msgMetaText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  msgScrollBody: { maxHeight: 280, marginBottom: 12 },
  msgFullCorpo: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 22 },

  matCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  matIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.gold + '22', alignItems: 'center', justifyContent: 'center' },
  matInfo: { flex: 1 },
  matTitulo: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  matDisc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 2 },
  matData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  matModalDisc: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 8 },
  matModalDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 12 },
  matModalScroll: { maxHeight: 200, marginBottom: 12 },
  matModalConteudo: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, lineHeight: 20 },

  sumCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  sumHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sumDisc: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  sumData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  sumProf: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 6 },
  sumConteudo: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 6 },
  sumMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sumMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  diarioDateSep: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 },
  diarioDateLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  diarioDateLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  diarioCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.gold + '88' },
  diarioCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  diarioDiscBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  diarioDiscText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold, flex: 1 },
  diarioAulaNumBadge: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  diarioAulaNumText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.8)' },
  diarioConteudo: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  diarioObsBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.gold + '12', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.gold + '33', marginBottom: 10,
  },
  diarioObsLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  diarioObsText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, lineHeight: 18 },
  diarioMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  diarioMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  diarioMetaDot: { fontSize: 11, color: Colors.border },

  diasScroll: { marginBottom: 16 },
  diaBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.backgroundCard, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  diaBtnActive: { backgroundColor: Colors.info + '22', borderColor: Colors.info + '66' },
  diaBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  diaBtnTextActive: { color: Colors.info },
  diaFull: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.textSecondary, marginBottom: 12, textAlign: 'center' },
  periodoRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'stretch' },
  periodoHora: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 10, padding: 6, borderWidth: 1, borderColor: Colors.border },
  periodoNum: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.gold },
  periodoTime: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  aulaCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  aulaVazia: { justifyContent: 'center', alignItems: 'center', opacity: 0.4 },
  aulaVaziaText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  aulaDisciplina: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  aulaProf: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 4 },
  aulaMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  aulaMetaText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 12, padding: 13, marginTop: 14 },
  payBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  payBtnSmall: { backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  payBtnSmallText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  taxaCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taxaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  taxaIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  taxaInfo: { flex: 1 },
  taxaTitulo: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  taxaMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  taxaRight: { alignItems: 'flex-end', gap: 6 },
  taxaValor: { fontSize: 14, fontFamily: 'Inter_700Bold' },

  pagCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  pagTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pagBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 6 },
  pagDesc: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, flex: 1 },
  pagValor: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  pagMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  pagMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  pagRef: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  pagRefRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  metodoRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metodoBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.backgroundCard, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  metodoBtnActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '88' },
  metodoBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  metodoBtnTextActive: { color: Colors.gold },
  valorText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.gold, textAlign: 'center', marginBottom: 14 },

  rubricaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: Colors.surface, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  rubricaItemActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  rubricaText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, flex: 1 },
  rubricaValor: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.textMuted },

  reconfText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 16, lineHeight: 22 },

  historicoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  historicoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  historicoDisc: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text, flex: 1 },
  historicoRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historicoLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textTransform: 'uppercase' },
  historicoNF: { fontSize: 18, fontFamily: 'Inter_700Bold' },

  solCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  solTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  solTipo: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1 },
  solMotivo: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 4 },
  solObs: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 4 },
  solData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderRadius: 20, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1 },
  closeBtn: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 12 },
  closeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },

  formLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  submitBtn: { backgroundColor: Colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  readonlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.info + '18', borderWidth: 1, borderColor: Colors.info + '44', borderRadius: 12, padding: 12, marginBottom: 14 },
  readonlyText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 18 },

  timelineContainer: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  timelineLeft: { alignItems: 'center', width: 28 },
  timelineDot: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 2, marginBottom: -2 },
  timelineCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 10 },
  timelineCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  timelineTitulo: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 3 },
  timelineDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18 },
  timelineDateBox: { alignItems: 'flex-end', minWidth: 60 },
  timelineDateNum: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  timelineHora: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  timelineFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  logCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, padding: 14, marginBottom: 10 },
  logIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  logTitulo: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, flex: 1 },
  logSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  logData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  cartaoSectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' },
  cartaoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  cartaoCardValido: { borderColor: Colors.success + '88' },
  cartaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 12 },
  cartaoSchoolName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold, letterSpacing: 0.5 },
  cartaoAnoLetivo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  cartaoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cartaoStatusValido: { backgroundColor: Colors.success },
  cartaoStatusPendente: { backgroundColor: Colors.warning },
  cartaoStatusText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.6 },
  cartaoBody: { flexDirection: 'row', gap: 14, padding: 16 },
  cartaoFotoWrap: { position: 'relative' },
  cartaoFoto: { width: 72, height: 88, borderRadius: 12, borderWidth: 2, borderColor: Colors.gold },
  cartaoFotoPlaceholder: { width: 72, height: 88, borderRadius: 12, borderWidth: 2, borderColor: Colors.gold, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  cartaoFotoInitials: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.gold },
  cartaoFotoCheck: { position: 'absolute', bottom: -6, right: -6, backgroundColor: Colors.backgroundCard, borderRadius: 10 },
  cartaoInfo: { flex: 1, justifyContent: 'center' },
  cartaoNome: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 8 },
  cartaoInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  cartaoInfoVal: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1 },
  cartaoQrSection: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  cartaoQrWrap: { backgroundColor: '#fff', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: Colors.border },
  cartaoQrInfo: { flex: 1 },
  cartaoQrLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  cartaoQrSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 16 },
  cartaoRefRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  cartaoRefText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  cartaoFooter: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8 },
  cartaoFooterText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  cartaoInfoBox: { flexDirection: 'row', gap: 10, backgroundColor: Colors.info + '18', borderWidth: 1, borderColor: Colors.info + '44', borderRadius: 12, padding: 14, marginBottom: 16 },
  cartaoInfoBoxText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 18 },
  cartaoPagoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.success + '18', borderWidth: 1, borderColor: Colors.success + '44', borderRadius: 12, padding: 14 },
  cartaoPagoText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.success },
  cartaoPagarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.accent, borderRadius: 14, padding: 16 },
  cartaoPagarBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  docBadgesSection: { marginTop: 14, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  docBadgesTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  docBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  docTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success + '18', borderWidth: 1, borderColor: Colors.success + '44', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 200 },
  docTypeBadgeText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.success },

  docHistCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: Colors.gold },
  docHistTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
  docHistIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.gold + '18', alignItems: 'center', justifyContent: 'center' },
  docHistTipo: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 3 },
  docHistMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 2 },
  docHistData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  docReemitirBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.gold + '55', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', backgroundColor: Colors.gold + '10' },
  docReemitirText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold },

  docCountBadge: { backgroundColor: Colors.gold, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  docCountText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000' },

  // ── Payment modal styles ──
  pagHeaderBg: { backgroundColor: Colors.primary, paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center', borderRadius: 0 },
  pagHeaderLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.7)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  pagHeaderValor: { fontSize: 38, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: -1 },
  pagHeaderSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  pagPrazoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.backgroundCard, borderRadius: 10, padding: 10, marginBottom: 16 },
  pagPrazoText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  pagMetodoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pagMetodoLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  pagMetodoSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  pagRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  pagRadioActive: { borderColor: '#0bbfaa' },
  pagRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#0bbfaa' },
  pagBtnTeal: { backgroundColor: '#0bbfaa', borderRadius: 30, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  pagBtnTealText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  pagFormIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  pagFormTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  pagFormAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  pagFormAmountLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  pagFormAmount: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.primary },
  pagPhoneWrap: { width: '100%', marginBottom: 8 },
  pagPhoneLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  pagPhoneRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.backgroundCard, overflow: 'hidden' },
  pagPhonePrefix: { paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text, borderRightWidth: 1, borderRightColor: Colors.border },
  pagPhoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text },
  pagPhoneHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 8, lineHeight: 16 },
  pagRefInfoBox: { flexDirection: 'row', gap: 8, backgroundColor: Colors.info + '12', borderRadius: 10, padding: 12, marginTop: 12, width: '100%' },
  pagRefInfoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18 },
  pagRefBox: { backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16, marginTop: 16, width: '100%', alignItems: 'center' },
  pagRefBoxLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  pagRefBoxVal: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.primary, letterSpacing: 1 },
});
