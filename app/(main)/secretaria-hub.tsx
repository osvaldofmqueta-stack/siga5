import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import EmissaoRapidaModal from '@/components/EmissaoRapidaModal';
import MapaAproveitamentoModal from '@/components/MapaAproveitamentoModal';
import PendingSolicitacoesModal, { Solicitacao } from '@/components/PendingSolicitacoesModal';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as XLSX from 'xlsx';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuth, getAuthToken } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useConfig } from '@/context/ConfigContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { alertSucesso, alertErro } from '@/utils/toast';
import TopBar from '@/components/TopBar';
import { webAlert } from '@/utils/webAlert';
import api from '@/lib/api';
import { apiRequest } from '@/lib/query-client';

const { width } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────
type DocType = 'declaracao' | 'certificado' | 'boletim' | 'atestado' | 'historico';
type ProcessoStatus = 'pendente' | 'em_curso' | 'concluido' | 'cancelado';

interface Documento {
  id: string;
  tipo: DocType;
  alunoNome: string;
  alunoNum: string;
  emitidoEm: string;
  emitidoPor: string;
  finalidade?: string;
}

interface Processo {
  id: string;
  tipo: string;
  descricao: string;
  solicitante: string;
  dataAbertura: string;
  prazo?: string;
  status: ProcessoStatus;
  prioridade: 'baixa' | 'media' | 'alta';
}

interface Correspondencia {
  id: string;
  assunto: string;
  destinatario: string;
  tipo: 'entrada' | 'saida';
  data: string;
  urgente: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function docLabel(tipo: DocType) {
  const map: Record<DocType, string> = {
    declaracao: 'Declaração de Matrícula',
    certificado: 'Certificado de Habilitações',
    boletim: 'Boletim de Notas',
    atestado: 'Atestado de Frequência',
    historico: 'Histórico Escolar',
  };
  return map[tipo];
}

function docColor(tipo: DocType) {
  const map: Record<DocType, string> = {
    declaracao: Colors.info,
    certificado: Colors.gold,
    boletim: Colors.success,
    atestado: Colors.warning,
    historico: Colors.accent,
  };
  return map[tipo];
}

function statusColor(s: ProcessoStatus) {
  const map: Record<ProcessoStatus, string> = {
    pendente: Colors.warning,
    em_curso: Colors.info,
    concluido: Colors.success,
    cancelado: Colors.danger,
  };
  return map[s];
}

function statusLabel(s: ProcessoStatus) {
  const map: Record<ProcessoStatus, string> = {
    pendente: 'Pendente',
    em_curso: 'Em Curso',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  };
  return map[s];
}

function prioColor(p: 'baixa' | 'media' | 'alta') {
  return p === 'alta' ? Colors.danger : p === 'media' ? Colors.warning : Colors.success;
}

function today() { return new Date().toLocaleDateString('pt-PT'); }

function mapDocumentoFromApi(r: any): Documento {
  return {
    id: r.id,
    tipo: r.tipo as DocType,
    alunoNome: r.alunoNome ?? '',
    alunoNum: r.alunoNum ?? '',
    emitidoEm: r.emitidoEm
      ? new Date(r.emitidoEm).toLocaleDateString('pt-PT')
      : today(),
    emitidoPor: r.emitidoPor ?? 'Secretaria',
    finalidade: r.finalidade ?? '',
  };
}

function mapProcessoFromApi(r: any): Processo {
  return {
    id: r.id,
    tipo: r.tipo,
    descricao: r.descricao,
    solicitante: r.solicitante,
    dataAbertura: r.createdAt
      ? new Date(r.createdAt).toLocaleDateString('pt-PT')
      : today(),
    prazo: r.prazo ?? undefined,
    status: r.status as ProcessoStatus,
    prioridade: r.prioridade as 'baixa' | 'media' | 'alta',
  };
}

function mapCorrespondenciaFromApi(r: any): Correspondencia {
  return {
    id: r.id,
    assunto: r.assunto ?? '',
    destinatario: r.destinatario ?? '',
    tipo: r.tipo as 'entrada' | 'saida',
    data: r.data ?? new Date().toLocaleDateString('pt-PT'),
    urgente: Boolean(r.urgente),
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function SectionHeader({ title, icon, count, onAction, actionLabel }: {
  title: string; icon: string; count?: number; onAction?: () => void; actionLabel?: string;
}) {
  return (
    <View style={styles.secHeader}>
      <View style={styles.secHeaderLeft}>
        <Ionicons name={icon as any} size={16} color={Colors.gold} />
        <Text style={styles.secHeaderTitle}>{title}</Text>
        {count !== undefined && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      {onAction && (
        <TouchableOpacity onPress={onAction} style={styles.secAction}>
          <Text style={styles.secActionText}>{actionLabel ?? 'Ver todos'}</Text>
          <Ionicons name="chevron-forward" size={13} color={Colors.gold} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatCard({ value, label, color, icon }: { value: string | number; label: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon as any} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── EMIT DOCUMENT MODAL ────────────────────────────────────────────────────
function EmitirDocumentoModal({ visible, onClose, onEmit, alunos }: {
  visible: boolean; onClose: () => void;
  onEmit: (doc: Omit<Documento, 'id' | 'emitidoEm' | 'emitidoPor'>) => void;
  alunos: any[];
}) {
  const [tipo, setTipo] = useState<DocType>('declaracao');
  const [alunoNome, setAlunoNome] = useState('');
  const [alunoNum, setAlunoNum] = useState('');
  const [finalidade, setFinalidade] = useState('');

  const tipos: { key: DocType; label: string; icon: string }[] = [
    { key: 'declaracao', label: 'Declaração', icon: 'document-text' },
    { key: 'certificado', label: 'Certificado', icon: 'ribbon' },
    { key: 'boletim', label: 'Boletim', icon: 'bar-chart' },
    { key: 'atestado', label: 'Atestado', icon: 'checkmark-circle' },
    { key: 'historico', label: 'Histórico', icon: 'time' },
  ];

  function handleSubmit() {
    if (!alunoNome.trim()) {
      webAlert('Campo obrigatório', 'Indique o nome do aluno.');
      return;
    }
    onEmit({ tipo, alunoNome: alunoNome.trim(), alunoNum: alunoNum.trim() || `ALN-2025-${Math.floor(Math.random() * 900 + 100)}`, finalidade });
    setAlunoNome(''); setAlunoNum(''); setFinalidade(''); setTipo('declaracao');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Emitir Documento</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Tipo de Documento</Text>
          <View style={styles.tipoGrid}>
            {tipos.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tipoCard, tipo === t.key && { backgroundColor: docColor(t.key) + '33', borderColor: docColor(t.key) }]}
                onPress={() => setTipo(t.key)}
              >
                <Ionicons name={t.icon as any} size={18} color={tipo === t.key ? docColor(t.key) : Colors.textMuted} />
                <Text style={[styles.tipoLabel, tipo === t.key && { color: docColor(t.key) }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Nome do Aluno *</Text>
          <TextInput
            style={styles.input}
            value={alunoNome}
            onChangeText={setAlunoNome}
            placeholder="Nome completo do aluno"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Text style={styles.fieldLabel}>N.º de Matrícula</Text>
          <TextInput
            style={styles.input}
            value={alunoNum}
            onChangeText={setAlunoNum}
            placeholder="ALN-AAAA-XXXX"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Text style={styles.fieldLabel}>Finalidade</Text>
          <TextInput
            style={styles.input}
            value={finalidade}
            onChangeText={setFinalidade}
            placeholder="Ex: Bolsa de estudo, emprego..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Ionicons name="print" size={16} color="#fff" />
              <Text style={styles.submitBtnText}>Emitir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── NOVO PROCESSO MODAL ─────────────────────────────────────────────────────
function NovoProcessoModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void;
  onSave: (p: Omit<Processo, 'id' | 'dataAbertura' | 'status'>) => void;
}) {
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [prazo, setPrazo] = useState('');
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta'>('media');

  const tipos = ['Matrícula', 'Re-matrícula', 'Transferência', 'Equivalência', 'Reclamação', 'Registo Civil', 'Dispensa', 'Outro'];

  function handleSubmit() {
    if (!tipo || !descricao.trim() || !solicitante.trim()) {
      webAlert('Campos obrigatórios', 'Preencha tipo, descrição e solicitante.');
      return;
    }
    onSave({ tipo, descricao: descricao.trim(), solicitante: solicitante.trim(), prazo, prioridade });
    setTipo(''); setDescricao(''); setSolicitante(''); setPrazo(''); setPrioridade('media');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Abrir Processo</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tipo de Processo *</Text>
            <View style={styles.tipoGrid}>
              {tipos.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tipoCard, tipo === t && { backgroundColor: Colors.info + '33', borderColor: Colors.info }]}
                  onPress={() => setTipo(t)}
                >
                  <Text style={[styles.tipoLabel, tipo === t && { color: Colors.info }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Descrição *</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={descricao} onChangeText={setDescricao}
              placeholder="Descreva o processo..." placeholderTextColor={Colors.textMuted} multiline />

            <Text style={styles.fieldLabel}>Solicitante *</Text>
            <TextInput style={styles.input} value={solicitante} onChangeText={setSolicitante}
              placeholder="Nome do aluno ou encarregado" placeholderTextColor={Colors.textMuted} returnKeyType="done" onSubmitEditing={handleSubmit} />

            <Text style={styles.fieldLabel}>Prazo</Text>
            <TextInput style={styles.input} value={prazo} onChangeText={setPrazo}
              placeholder="DD/MM/AAAA" placeholderTextColor={Colors.textMuted} returnKeyType="done" onSubmitEditing={handleSubmit} />

            <Text style={styles.fieldLabel}>Prioridade</Text>
            <View style={styles.prioRow}>
              {(['baixa', 'media', 'alta'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.prioBtn, prioridade === p && { backgroundColor: prioColor(p) + '33', borderColor: prioColor(p) }]}
                  onPress={() => setPrioridade(p)}
                >
                  <Text style={[styles.prioBtnText, prioridade === p && { color: prioColor(p) }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Ionicons name="folder-open" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Abrir Processo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── CREDENTIALS MODAL ──────────────────────────────────────────────────────
function CredenciaisModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { config } = useConfig();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { maxWidth: 380 }]}>
          <LinearGradient colors={['#1A5276', '#0D1F35']} style={styles.credHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.credAvatar}>
              <Text style={styles.credAvatarText}>SA</Text>
            </View>
            <View style={styles.credBadge}>
              <Ionicons name="shield-checkmark" size={12} color={Colors.gold} />
              <Text style={styles.credBadgeText}>Credencial Oficial</Text>
            </View>
          </LinearGradient>

          <View style={styles.credBody}>
            <Text style={styles.credName}>Secretária Académica</Text>
            <Text style={styles.credSchool}>{config.nomeEscola}</Text>

            <View style={styles.credDivider} />

            {[
              { label: 'Email de Acesso', value: 'secretaria@sige.ao', icon: 'mail' },
              { label: 'Senha', value: 'Secretaria@2025', icon: 'lock-closed' },
              { label: 'Perfil', value: 'Secretária Académica', icon: 'person' },
              { label: 'Nível de Acesso', value: 'Módulo Académico Completo', icon: 'layers' },
              { label: 'Departamento', value: 'Secretaria Escolar', icon: 'business' },
            ].map(row => (
              <View key={row.label} style={styles.credRow}>
                <View style={styles.credRowIcon}>
                  <Ionicons name={row.icon as any} size={14} color={Colors.gold} />
                </View>
                <View style={styles.credRowContent}>
                  <Text style={styles.credRowLabel}>{row.label}</Text>
                  <Text style={styles.credRowValue}>{row.value}</Text>
                </View>
              </View>
            ))}

            <View style={styles.credDivider} />
            <Text style={styles.credNote}>
              Esta credencial é de uso exclusivo do funcionário designado. Não partilhe a sua senha.
            </Text>
          </View>

          <TouchableOpacity style={[styles.submitBtn, { margin: 16, marginTop: 0 }]} onPress={onClose}>
            <Text style={styles.submitBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function SecretariaHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { alunos, turmas, eventos, notas, professores } = useData();
  const { pautas } = useProfessor();
  const { config } = useConfig();
  const { anoSelecionado } = useAnoAcademico();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [pautaFiltroStatus, setPautaFiltroStatus] = useState<'todas' | 'fechada' | 'aberta'>('todas');
  const [pautaFiltroTrimestre, setPautaFiltroTrimestre] = useState<0 | 1 | 2 | 3>(0);
  const [pautaFiltroTurma, setPautaFiltroTurma] = useState<string>('');

  const pautasFiltradas = useMemo(() => {
    return pautas.filter(p => {
      if (pautaFiltroStatus !== 'todas' && p.status !== pautaFiltroStatus) return false;
      if (pautaFiltroTrimestre !== 0 && p.trimestre !== pautaFiltroTrimestre) return false;
      if (pautaFiltroTurma && p.turmaId !== pautaFiltroTurma) return false;
      return true;
    });
  }, [pautas, pautaFiltroStatus, pautaFiltroTrimestre, pautaFiltroTurma]);

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loadingProcessos, setLoadingProcessos] = useState(false);
  const [correspondencias, setCorrespondencias] = useState<Correspondencia[]>([]);
  const [loadingCorrespondencias, setLoadingCorrespondencias] = useState(false);
  const [showNovaCorresp, setShowNovaCorresp] = useState(false);
  const [novaCorrespAssunto, setNovaCorrespAssunto] = useState('');
  const [novaCorrespDestinatario, setNovaCorrespDestinatario] = useState('');
  const [novaCorrespTipo, setNovaCorrespTipo] = useState<'entrada' | 'saida'>('saida');
  const [novaCorrespUrgente, setNovaCorrespUrgente] = useState(false);
  const [showEmitirModal, setShowEmitirModal] = useState(false);
  const [showEmissaoRapida, setShowEmissaoRapida] = useState(false);
  const [showMapaAproveitamento, setShowMapaAproveitamento] = useState(false);
  const [showProcessoModal, setShowProcessoModal] = useState(false);
  const [showCredenciais, setShowCredenciais] = useState(false);
  const [activeTab, setActiveTab] = useState<'visao' | 'processos' | 'documentos' | 'correspondencia' | 'cursos' | 'pautas'>('visao');
  const [cursoExpandido, setCursoExpandido] = useState<string | null>(null);
  const [showRematricula, setShowRematricula] = useState(false);
  const [rematriculaAnoDestino, setRematriculaAnoDestino] = useState('');

  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState<Solicitacao[]>([]);
  const [showSolicitacoesModal, setShowSolicitacoesModal] = useState(false);
  const solicitacoesShownRef = useRef(false);
  const [rematriculaBloquearPendencia, setRematriculaBloquearPendencia] = useState(true);
  const [rematriculaBloquearReprovados, setRematriculaBloquearReprovados] = useState(true);
  const [rematriculaLoading, setRematriculaLoading] = useState(false);
  const [rematriculaResultado, setRematriculaResultado] = useState<{ processados: number; bloqueados: number; erros: number; total: number } | null>(null);

  const stats = useMemo(() => ({
    totalAlunos: alunos.filter(a => a.ativo).length,
    totalTurmas: turmas.filter(t => t.ativo).length,
    processosPendentes: processos.filter(p => p.status === 'pendente').length,
    docsEmitidos: documentos.length,
    processosEmCurso: processos.filter(p => p.status === 'em_curso').length,
  }), [alunos, turmas, processos, documentos]);

  const proximosEventos = useMemo(() =>
    eventos.filter(e => e.data >= new Date().toISOString().split('T')[0]).slice(0, 3),
    [eventos]
  );

  const fetchDocumentos = useCallback(async () => {
    setLoadingDocumentos(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/documentos-emitidos', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocumentos((data as any[]).map(mapDocumentoFromApi));
      }
    } catch (_) {
    } finally {
      setLoadingDocumentos(false);
    }
  }, []);

  const fetchProcessos = useCallback(async () => {
    setLoadingProcessos(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/processos-secretaria', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProcessos((data as any[]).map(mapProcessoFromApi));
      }
    } catch (_) {
    } finally {
      setLoadingProcessos(false);
    }
  }, []);

  const fetchCorrespondencias = useCallback(async () => {
    setLoadingCorrespondencias(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/correspondencias', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCorrespondencias((data as any[]).map(mapCorrespondenciaFromApi));
      }
    } catch (_) {
    } finally {
      setLoadingCorrespondencias(false);
    }
  }, []);

  async function handleNovaCorrespondencia() {
    if (!novaCorrespAssunto.trim()) return;
    try {
      const token = await getAuthToken();
      const hoje = new Date().toLocaleDateString('pt-PT');
      const res = await fetch('/api/correspondencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({
          assunto: novaCorrespAssunto.trim(),
          destinatario: novaCorrespDestinatario.trim(),
          tipo: novaCorrespTipo,
          data: hoje,
          urgente: novaCorrespUrgente,
        }),
      });
      if (res.ok) {
        const nova = mapCorrespondenciaFromApi(await res.json());
        setCorrespondencias(prev => [nova, ...prev]);
        setShowNovaCorresp(false);
        setNovaCorrespAssunto('');
        setNovaCorrespDestinatario('');
        setNovaCorrespTipo('saida');
        setNovaCorrespUrgente(false);
        alertSucesso('Registo criado', 'Correspondência registada com sucesso.');
      } else {
        alertErro('Erro', 'Não foi possível registar a correspondência.');
      }
    } catch (_) {
      alertErro('Erro', 'Falha de ligação ao servidor.');
    }
  }

  async function handleDeleteCorrespondencia(id: string) {
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/correspondencias/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) {
        setCorrespondencias(prev => prev.filter(c => c.id !== id));
      }
    } catch (_) {}
  }

  useEffect(() => {
    fetchDocumentos();
    fetchProcessos();
    fetchCorrespondencias();
  }, [fetchDocumentos, fetchProcessos, fetchCorrespondencias]);

  useEffect(() => {
    apiRequest('GET', '/api/solicitacoes-documentos?status=pendente')
      .then(r => r.json())
      .then((data: Solicitacao[]) => {
        const list = Array.isArray(data) ? data : [];
        setSolicitacoesPendentes(list);
        if (list.length > 0 && !solicitacoesShownRef.current) {
          solicitacoesShownRef.current = true;
          setTimeout(() => setShowSolicitacoesModal(true), 700);
        }
      })
      .catch(() => {});
  }, []);

  async function handleEmitir(doc: Omit<Documento, 'id' | 'emitidoEm' | 'emitidoPor'>) {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/documentos-emitidos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          alunoNome: doc.alunoNome,
          alunoNum: doc.alunoNum,
          tipo: doc.tipo,
          finalidade: doc.finalidade ?? '',
          emitidoPor: user?.nome ?? 'Secretaria',
        }),
      });
      if (res.ok) {
        const novo = mapDocumentoFromApi(await res.json());
        setDocumentos(prev => [novo, ...prev]);
        alertSucesso('Documento emitido', `"${doc.tipo}" foi emitido com sucesso para ${doc.alunoNome}.`);
      } else {
        alertErro('Erro', 'Não foi possível registar o documento.');
      }
    } catch (_) {
      alertErro('Erro', 'Falha de ligação ao servidor.');
    }
  }

  async function handleNovoProcesso(p: Omit<Processo, 'id' | 'dataAbertura' | 'status'>) {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/processos-secretaria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify(p),
      });
      if (res.ok) {
        const novo = mapProcessoFromApi(await res.json());
        setProcessos(prev => [novo, ...prev]);
        alertSucesso('Processo aberto', `O processo de "${p.solicitante}" foi registado com sucesso.`);
      } else {
        alertErro('Erro', 'Não foi possível abrir o processo.');
      }
    } catch (_) {
      alertErro('Erro', 'Falha de ligação ao servidor.');
    }
  }

  async function handleUpdateProcesso(id: string, status: ProcessoStatus) {
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/processos-secretaria/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setProcessos(prev => prev.map(p => p.id === id ? { ...p, status } : p));
        const labels: Record<ProcessoStatus, string> = { pendente: 'pendente', em_curso: 'em curso', concluido: 'concluído', cancelado: 'cancelado' };
        alertSucesso('Processo actualizado', `O estado foi alterado para "${labels[status]}".`);
      } else {
        alertErro('Erro', 'Não foi possível actualizar o processo.');
      }
    } catch (_) {
      alertErro('Erro', 'Falha de ligação ao servidor.');
    }
  }

  const QUICK_ACTIONS = [
    { label: 'Emitir\nDocumentos', icon: 'documents', color: Colors.gold, action: () => setShowEmissaoRapida(true) },
    { label: 'Processo de\nAdmissão', icon: 'account-school', color: '#8B5CF6', action: () => router.push('/(main)/admissao' as any), isMCI: true },
    { label: 'Mapas de\nAproveitamento', icon: 'podium', color: '#1a6b3c', action: () => setShowMapaAproveitamento(true) },
    { label: 'Gerar\nDocumento PDF', icon: 'print', color: Colors.info, action: () => router.push('/(main)/gerar-documento' as any) },
    { label: 'Abrir\nProcesso', icon: 'folder-open', color: Colors.warning, action: () => setShowProcessoModal(true) },
    { label: 'Gestão\nde Alunos', icon: 'people', color: Colors.success, action: () => router.push('/(main)/alunos' as any) },
    { label: 'Registo\nde Presenças', icon: 'calendar-outline', color: Colors.gold, action: () => router.push('/(main)/presencas' as any) },
    { label: 'Notas &\nPautas', icon: 'ribbon', color: Colors.accent, action: () => router.push('/(main)/notas' as any) },
    { label: 'Disciplinas', icon: 'book-outline', color: '#EC4899', action: () => router.push('/(main)/disciplinas' as any) },
    { label: 'Desempenho\nAlunos', icon: 'stats-chart', color: '#8B5CF6', action: () => router.push('/(main)/desempenho' as any) },
    { label: 'Gestão\nde Cursos', icon: 'school', color: Colors.info, action: () => setActiveTab('cursos') },
    { label: 'Calendário\nEscolar', icon: 'calendar', color: '#06B6D4', action: () => router.push('/(main)/eventos' as any) },
    { label: 'Relatórios', icon: 'bar-chart', color: Colors.gold, action: () => router.push('/(main)/relatorios' as any) },
    { label: 'Credencial', icon: 'card', color: Colors.textSecondary, action: () => setShowCredenciais(true) },
  ];

  const TABS = [
    { key: 'visao', label: 'Visão Geral', icon: 'grid' },
    { key: 'pautas', label: 'Pautas', icon: 'ribbon' },
    { key: 'cursos', label: 'Cursos', icon: 'school' },
    { key: 'processos', label: 'Processos', icon: 'folder' },
    { key: 'documentos', label: 'Documentos', icon: 'document-text' },
    { key: 'correspondencia', label: 'Ofícios', icon: 'mail' },
  ] as const;

  return (
    <View style={styles.container}>
      <TopBar title="Secretaria Académica" subtitle="Painel de Gestão Documental" />

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabsContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key as any)}
          >
            <Ionicons name={t.icon as any} size={14} color={activeTab === t.key ? Colors.gold : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── VISÃO GERAL ──────────────────────────────────── */}
        {activeTab === 'visao' && (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <StatCard value={stats.totalAlunos} label="Alunos\nMatriculados" color={Colors.info} icon="people" />
              <StatCard value={stats.totalTurmas} label="Turmas\nActivas" color={Colors.success} icon="school" />
              <StatCard value={stats.processosPendentes} label="Processos\nPendentes" color={Colors.warning} icon="time" />
              <StatCard value={stats.docsEmitidos} label="Docs.\nEmitidos" color={Colors.gold} icon="document-text" />
            </View>

            {/* Alerts */}
            {stats.processosPendentes > 0 && (
              <TouchableOpacity style={styles.alertBanner} onPress={() => setActiveTab('processos')}>
                <Ionicons name="alert-circle" size={18} color={Colors.warning} />
                <Text style={styles.alertText}>
                  {stats.processosPendentes} processo{stats.processosPendentes > 1 ? 's' : ''} pendente{stats.processosPendentes > 1 ? 's' : ''} aguardam tratamento
                </Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.warning} />
              </TouchableOpacity>
            )}

            {/* Banner — solicitações de documentos pendentes */}
            {solicitacoesPendentes.length > 0 && (
              <TouchableOpacity
                style={[styles.alertBanner, { backgroundColor: Colors.gold + '18', borderColor: Colors.gold + '40' }]}
                onPress={() => setShowSolicitacoesModal(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="file-document-multiple" size={18} color={Colors.gold} />
                <Text style={[styles.alertText, { color: Colors.gold }]}>
                  {solicitacoesPendentes.length} solicitaç{solicitacoesPendentes.length !== 1 ? 'ões' : 'ão'} de documentos pendente{solicitacoesPendentes.length !== 1 ? 's' : ''} — toque para tratar
                </Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.gold} />
              </TouchableOpacity>
            )}

            {/* Quick Actions */}
            <View style={styles.card}>
              <SectionHeader title="Ações Rápidas" icon="flash" />
              <View style={styles.actionsGrid}>
                {QUICK_ACTIONS.map((a, i) => (
                  <TouchableOpacity key={i} style={styles.actionCard} onPress={a.action} activeOpacity={0.75}>
                    <View style={[styles.actionIconWrap, { backgroundColor: a.color + '22' }]}>
                      {(a as any).isMCI
                        ? <MaterialCommunityIcons name={a.icon as any} size={22} color={a.color} />
                        : <Ionicons name={a.icon as any} size={22} color={a.color} />
                      }
                    </View>
                    <Text style={styles.actionLabel}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Rematrícula em Lote */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12 }}
              onPress={() => { setRematriculaResultado(null); setRematriculaAnoDestino(''); setShowRematricula(true); }}
              activeOpacity={0.8}
            >
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: Colors.success + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="refresh-circle-outline" size={24} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text }}>Rematrícula em Lote</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 }}>Renovar matrículas de todos os alunos para o novo ano lectivo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Processos em destaque */}
            <View style={styles.card}>
              <SectionHeader
                title="Processos em Aberto"
                icon="folder-open"
                count={stats.processosPendentes + stats.processosEmCurso}
                onAction={() => setActiveTab('processos')}
              />
              {processos.filter(p => p.status !== 'concluido' && p.status !== 'cancelado').slice(0, 3).map(p => (
                <View key={p.id} style={styles.processoRow}>
                  <View style={[styles.prioIndicator, { backgroundColor: prioColor(p.prioridade) }]} />
                  <View style={styles.processoInfo}>
                    <View style={styles.processoTopRow}>
                      <Text style={styles.processoTipo}>{p.tipo}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) + '22' }]}>
                        <Text style={[styles.statusText, { color: statusColor(p.status) }]}>{statusLabel(p.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.processoDesc} numberOfLines={1}>{p.descricao}</Text>
                    <Text style={styles.processoMeta}>{p.solicitante} · Aberto em {p.dataAbertura}{p.prazo ? ` · Prazo: ${p.prazo}` : ''}</Text>
                  </View>
                </View>
              ))}
              {processos.filter(p => p.status !== 'concluido' && p.status !== 'cancelado').length === 0 && (
                <Text style={styles.emptyText}>Sem processos em aberto.</Text>
              )}
            </View>

            {/* Últimos documentos */}
            <View style={styles.card}>
              <SectionHeader title="Documentos Recentes" icon="document-text" count={documentos.length} onAction={() => setActiveTab('documentos')} />
              {loadingDocumentos ? (
                <Text style={styles.emptyText}>A carregar documentos...</Text>
              ) : documentos.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum documento emitido ainda.</Text>
              ) : (
                documentos.slice(0, 4).map(d => (
                  <View key={d.id} style={styles.docRow}>
                    <View style={[styles.docIconWrap, { backgroundColor: docColor(d.tipo) + '22' }]}>
                      <Ionicons name="document-text" size={16} color={docColor(d.tipo)} />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docNome}>{d.alunoNome}</Text>
                      <Text style={styles.docTipo}>{docLabel(d.tipo)}{d.finalidade ? ` — ${d.finalidade}` : ''}</Text>
                    </View>
                    <Text style={styles.docData}>{d.emitidoEm}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Próximos eventos */}
            {proximosEventos.length > 0 && (
              <View style={styles.card}>
                <SectionHeader title="Próximos Eventos" icon="calendar" onAction={() => router.push('/(main)/eventos' as any)} />
                {proximosEventos.map(e => (
                  <View key={e.id} style={styles.eventoRow}>
                    <View style={styles.eventoDateBox}>
                      <Text style={styles.eventoDay}>{e.data.split('-')[2]}</Text>
                      <Text style={styles.eventoMonth}>
                        {new Date(e.data).toLocaleDateString('pt-PT', { month: 'short' }).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.eventoInfo}>
                      <Text style={styles.eventoNome}>{e.nome}</Text>
                      <Text style={styles.eventoTipo}>{e.tipo}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── PROCESSOS ────────────────────────────────────── */}
        {activeTab === 'processos' && (
          <View style={styles.card}>
            <SectionHeader title="Gestão de Processos" icon="folder-open" count={processos.length} onAction={() => setShowProcessoModal(true)} actionLabel="+ Novo" />
            {loadingProcessos && (
              <Text style={[styles.emptyText, { marginVertical: 16 }]}>A carregar processos…</Text>
            )}
            {!loadingProcessos && processos.length === 0 && (
              <Text style={styles.emptyText}>Nenhum processo registado. Clique em "+ Novo" para abrir o primeiro.</Text>
            )}
            {processos.map(p => (
              <View key={p.id} style={styles.processoCard}>
                <View style={styles.processoCardTop}>
                  <View style={styles.processoCardLeft}>
                    <View style={[styles.prioIndicator, { backgroundColor: prioColor(p.prioridade) }]} />
                    <View>
                      <View style={styles.processoTopRow}>
                        <Text style={styles.processoTipo}>{p.tipo}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) + '22' }]}>
                          <Text style={[styles.statusText, { color: statusColor(p.status) }]}>{statusLabel(p.status)}</Text>
                        </View>
                      </View>
                      <Text style={styles.processoMeta}>Prioridade {p.prioridade} · {p.dataAbertura}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.processoDesc}>{p.descricao}</Text>
                <Text style={styles.processoSolicitante}>
                  <Text style={{ color: Colors.textMuted }}>Solicitante: </Text>{p.solicitante}
                  {p.prazo ? <Text style={{ color: Colors.warning }}> · Prazo: {p.prazo}</Text> : ''}
                </Text>
                {p.status !== 'concluido' && p.status !== 'cancelado' && (
                  <View style={styles.processoActions}>
                    {p.status === 'pendente' && (
                      <TouchableOpacity style={[styles.procBtn, { backgroundColor: Colors.info + '22', borderColor: Colors.info + '44' }]}
                        onPress={() => handleUpdateProcesso(p.id, 'em_curso')}>
                        <Text style={[styles.procBtnText, { color: Colors.info }]}>Tratar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.procBtn, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '44' }]}
                      onPress={() => handleUpdateProcesso(p.id, 'concluido')}>
                      <Text style={[styles.procBtnText, { color: Colors.success }]}>Concluir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.procBtn, { backgroundColor: Colors.danger + '22', borderColor: Colors.danger + '44' }]}
                      onPress={() => handleUpdateProcesso(p.id, 'cancelado')}>
                      <Text style={[styles.procBtnText, { color: Colors.danger }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── DOCUMENTOS ───────────────────────────────────── */}
        {activeTab === 'documentos' && (
          <View style={styles.card}>
            <SectionHeader title="Documentos Emitidos" icon="document-text" count={documentos.length} onAction={() => setShowEmitirModal(true)} actionLabel="+ Emitir" />
            {loadingDocumentos ? (
              <Text style={styles.emptyText}>A carregar documentos...</Text>
            ) : documentos.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum documento emitido ainda.</Text>
            ) : (
              documentos.map(d => (
                <View key={d.id} style={styles.docCard}>
                  <View style={[styles.docCardLeft, { borderLeftColor: docColor(d.tipo) }]}>
                    <View style={styles.docCardTopRow}>
                      <View style={[styles.docTypeBadge, { backgroundColor: docColor(d.tipo) + '22' }]}>
                        <Text style={[styles.docTypeText, { color: docColor(d.tipo) }]}>{docLabel(d.tipo)}</Text>
                      </View>
                      <Text style={styles.docData}>{d.emitidoEm}</Text>
                    </View>
                    <Text style={styles.docNome}>{d.alunoNome}</Text>
                    <Text style={styles.docTipo}>
                      N.º {d.alunoNum}
                      {d.finalidade ? ` · ${d.finalidade}` : ''}
                    </Text>
                    <Text style={styles.processoMeta}>Emitido por: {d.emitidoPor}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── GESTÃO DE CURSOS ─────────────────────────────── */}
        {activeTab === 'cursos' && (() => {
          const NIVEIS_CONFIG = [
            { nivel: 'Ensino Primário', ciclo: 'Ensino Primário', classes: ['1','2','3','4','5','6'], cor: Colors.success, icon: 'school' },
            { nivel: 'I Ciclo', ciclo: 'I Ciclo do Ensino Secundário', classes: ['7','8','9'], cor: Colors.info, icon: 'library' },
            { nivel: 'II Ciclo', ciclo: 'II Ciclo do Ensino Secundário', classes: ['10','11','12','13'], cor: '#8B5CF6', icon: 'ribbon' },
          ];
          const turmasAtivas = turmas.filter(t => t.ativo);
          const alunosAtivos = alunos.filter(a => a.ativo);

          const cursosReais = NIVEIS_CONFIG.map(cfg => {
            const turmasNivel = turmasAtivas.filter(t => t.nivel === cfg.nivel || t.nivel?.includes(cfg.ciclo.split(' ')[0]));
            const alunosNivel = alunosAtivos.filter(a => turmasNivel.some(t => t.id === a.turmaId));
            const disciplinas = [...new Set(
              turmasNivel.map(t => t.disciplinas || []).flat()
            )];
            const classesPorTurma = turmasNivel.reduce<Record<string, typeof turmasNivel>>((acc, t) => {
              const key = t.classe ? `${t.classe}ª Classe` : t.nome;
              if (!acc[key]) acc[key] = [];
              acc[key].push(t);
              return acc;
            }, {});
            return { ...cfg, turmasNivel, alunosNivel, disciplinas, classesPorTurma };
          });

          const totalAlunos = alunosAtivos.length;
          const totalTurmasCursos = turmasAtivas.length;
          const niveisComTurmas = cursosReais.filter(c => c.turmasNivel.length > 0).length;

          return (
            <>
              {/* Resumo de cursos */}
              <View style={styles.statsRow}>
                <StatCard value={niveisComTurmas} label="Níveis\nActivos" color={Colors.gold} icon="school" />
                <StatCard value={totalTurmasCursos} label="Turmas\nTotal" color={Colors.info} icon="people-circle" />
                <StatCard value={totalAlunos} label="Alunos\nInscritos" color={Colors.success} icon="person" />
                <StatCard value={cursosReais.reduce((s, c) => s + c.disciplinas.length, 0)} label="Disciplinas" color='#8B5CF6' icon="book" />
              </View>

              {cursosReais.map(curso => {
                const isOpen = cursoExpandido === curso.nivel;
                const temTurmas = curso.turmasNivel.length > 0;
                return (
                  <View key={curso.nivel} style={[styles.card, { marginBottom: 10 }]}>
                    {/* Cabeçalho do nível */}
                    <TouchableOpacity
                      style={styles.cursoHeader}
                      onPress={() => setCursoExpandido(isOpen ? null : curso.nivel)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.cursoIconWrap, { backgroundColor: curso.cor + '22' }]}>
                        <Ionicons name={curso.icon as any} size={20} color={curso.cor} />
                      </View>
                      <View style={styles.cursoHeaderInfo}>
                        <Text style={styles.cursoNivel}>{curso.ciclo}</Text>
                        <Text style={styles.cursoSub}>
                          {temTurmas
                            ? `${curso.turmasNivel.length} turma${curso.turmasNivel.length > 1 ? 's' : ''} · ${curso.alunosNivel.length} aluno${curso.alunosNivel.length !== 1 ? 's' : ''}`
                            : 'Sem turmas registadas'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {temTurmas && (
                          <View style={[styles.cursoBadge, { backgroundColor: curso.cor + '22' }]}>
                            <Text style={[styles.cursoBadgeText, { color: curso.cor }]}>{curso.alunosNivel.length}</Text>
                          </View>
                        )}
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                      </View>
                    </TouchableOpacity>

                    {/* Classes esperadas (quickview) */}
                    {!isOpen && (
                      <View style={styles.classesRow}>
                        {curso.classes.map(cl => {
                          const turmasCl = curso.turmasNivel.filter(t => t.classe === cl);
                          const total = turmasCl.reduce((s, t) => s + alunosAtivos.filter(a => a.turmaId === t.id).length, 0);
                          return (
                            <View key={cl} style={[styles.classeChip, turmasCl.length === 0 && styles.classeChipInactive]}>
                              <Text style={[styles.classeChipText, turmasCl.length === 0 && { color: Colors.textMuted }]}>
                                {cl}ª
                              </Text>
                              {turmasCl.length > 0 && (
                                <Text style={styles.classeChipCount}>{total}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Detalhe expandido */}
                    {isOpen && (
                      <View style={styles.cursoDetalhe}>
                        {!temTurmas ? (
                          <View style={{ padding: 16, alignItems: 'center', gap: 6 }}>
                            <Ionicons name="school-outline" size={36} color={Colors.textMuted} />
                            <Text style={styles.emptyText}>Sem turmas para este nível</Text>
                            <TouchableOpacity
                              style={[styles.procBtn, { backgroundColor: Colors.info + '22', borderColor: Colors.info + '44', paddingHorizontal: 14 }]}
                              onPress={() => router.push('/(main)/turmas' as any)}
                            >
                              <Text style={[styles.procBtnText, { color: Colors.info }]}>Criar Turma</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            {/* Turmas por classe */}
                            {Object.entries(curso.classesPorTurma).map(([classe, tsList]) => (
                              <View key={classe} style={styles.classeGrupo}>
                                <Text style={styles.classeGrupoTitle}>{classe}</Text>
                                {(tsList as typeof turmasAtivas).map(t => {
                                  const numAlunos = alunosAtivos.filter(a => a.turmaId === t.id).length;
                                  return (
                                    <TouchableOpacity
                                      key={t.id}
                                      style={styles.turmaDetalheRow}
                                      onPress={() => router.push('/(main)/turmas' as any)}
                                      activeOpacity={0.75}
                                    >
                                      <View style={styles.turmaDetalheLeft}>
                                        <View style={[styles.turmaDetalheDot, { backgroundColor: curso.cor }]} />
                                        <View>
                                          <Text style={styles.turmaDetalheNome}>{t.nome}</Text>
                                          <Text style={styles.turmaDetalheSub}>{t.turno} · {numAlunos} aluno{numAlunos !== 1 ? 's' : ''}</Text>
                                        </View>
                                      </View>
                                      <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            ))}

                            {/* Disciplinas */}
                            {curso.disciplinas.length > 0 && (
                              <View style={styles.discSection}>
                                <Text style={styles.discSectionTitle}>Disciplinas</Text>
                                <View style={styles.discChipsRow}>
                                  {curso.disciplinas.map(d => (
                                    <View key={d} style={[styles.discChip, { borderColor: curso.cor + '55' }]}>
                                      <Text style={[styles.discChipText, { color: curso.cor }]}>{d}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}

                            {/* Acções */}
                            <View style={styles.cursoActions}>
                              <TouchableOpacity
                                style={[styles.cursoActionBtn, { backgroundColor: Colors.info + '22', borderColor: Colors.info + '44' }]}
                                onPress={() => router.push('/(main)/alunos' as any)}
                              >
                                <Ionicons name="people" size={14} color={Colors.info} />
                                <Text style={[styles.cursoActionText, { color: Colors.info }]}>Ver Alunos</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.cursoActionBtn, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '44' }]}
                                onPress={() => router.push('/(main)/turmas' as any)}
                              >
                                <Ionicons name="school" size={14} color={Colors.success} />
                                <Text style={[styles.cursoActionText, { color: Colors.success }]}>Gerir Turmas</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.cursoActionBtn, { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '44' }]}
                                onPress={() => router.push('/(main)/notas' as any)}
                              >
                                <Ionicons name="ribbon" size={14} color={Colors.gold} />
                                <Text style={[styles.cursoActionText, { color: Colors.gold }]}>Pautas</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          );
        })()}

        {/* ── PAUTAS ────────────────────────────────────────── */}
        {activeTab === 'pautas' && (() => {
          const pautasFechadas = pautas.filter(p => p.status === 'fechada').length;
          const pautasAbertas = pautas.filter(p => p.status === 'aberta').length;
          const pautasPendentes = pautas.filter(p => p.status === 'pendente_abertura').length;

          function nomeProfessor(professorId: string) {
            const prof = professores.find(p => p.id === professorId);
            return prof ? `${prof.nome} ${prof.apelido}` : '—';
          }

          function nomeTurma(turmaId: string) {
            return turmas.find(t => t.id === turmaId)?.nome || '—';
          }

          function pautaStatusColor(status: string) {
            if (status === 'fechada') return Colors.success;
            if (status === 'aberta') return Colors.info;
            if (status === 'pendente_abertura') return Colors.warning;
            return Colors.textMuted;
          }

          function pautaStatusLabel(status: string) {
            if (status === 'fechada') return 'Fechada';
            if (status === 'aberta') return 'Aberta';
            if (status === 'pendente_abertura') return 'Aguarda Reabertura';
            return status;
          }

          function imprimirPauta(pautaItem: typeof pautas[0]) {
            if (Platform.OS !== 'web') {
              webAlert('Indisponível', 'A impressão está disponível na versão web do sistema.');
              return;
            }
            const turmaObj = turmas.find(t => t.id === pautaItem.turmaId);
            const profNome = nomeProfessor(pautaItem.professorId);
            const turmaNome = turmaObj?.nome || '—';
            const nivelClasse = turmaObj?.classe || '—';
            const nomeEscola = config?.nomeEscola || 'Escola';
            const logoUrl = config?.logoUrl || '';
            const anoLetivo = anoSelecionado?.ano || pautaItem.anoLetivo || '20__/20__';
            const { disciplina, trimestre } = pautaItem;
            const alunosDaTurma = alunos.filter(a => a.turmaId === pautaItem.turmaId && a.ativo);

            const rows = alunosDaTurma.map((aluno, idx) => {
              const get = (tr: number) => {
                const n = notas.find(n => n.alunoId === aluno.id && n.turmaId === pautaItem.turmaId && n.disciplina === disciplina && n.trimestre === tr);
                return n ? { mac: n.mac ?? n.mac1 ?? 0, npp: n.pp1 ?? 0, npt: n.ppt ?? 0, mt: n.mt1 ?? 0 } : null;
              };
              const t1 = get(1); const t2 = get(2); const t3 = get(3);
              const mts = [t1?.mt, t2?.mt, t3?.mt].filter((v): v is number => !!v && v > 0);
              const mfd = mts.length ? Math.round((mts.reduce((a, b) => a + b, 0) / mts.length) * 10) / 10 : null;
              const aprovado = mfd !== null ? (mfd >= (config?.notaMinimaAprovacao ?? 10) ? 'Aprovado' : 'Reprovado') : '';
              const fmt = (v: number | null | undefined) => v && v > 0 ? v.toFixed(1) : '';
              const bgEven = idx % 2 === 0 ? '#f9f9f0' : '#ffffff';
              return `<tr style="background:${bgEven}">
                <td style="text-align:center;font-size:11px;">${String(idx + 1).padStart(2, '0')}</td>
                <td style="font-size:11px;padding-left:4px;">${aluno.nome} ${aluno.apelido}</td>
                <td class="nc">${fmt(t1?.mac)}</td><td class="nc">${fmt(t1?.npp)}</td><td class="nc">${fmt(t1?.npt)}</td><td class="nc bold">${fmt(t1?.mt)}</td>
                <td class="nc">${fmt(t2?.mac)}</td><td class="nc">${fmt(t2?.npp)}</td><td class="nc">${fmt(t2?.npt)}</td><td class="nc bold">${fmt(t2?.mt)}</td>
                <td class="nc">${fmt(t3?.mac)}</td><td class="nc">${fmt(t3?.npp)}</td><td class="nc">${fmt(t3?.npt)}</td><td class="nc bold">${fmt(t3?.mt)}</td>
                <td class="nc bold" style="color:${mfd !== null && mfd >= (config?.notaMinimaAprovacao ?? 10) ? '#155724' : mfd !== null ? '#721c24' : '#000'};">${mfd !== null ? mfd.toFixed(1) : ''}</td>
                <td style="font-size:10px;text-align:center;">${aprovado}</td>
              </tr>`;
            });

            const emptyRows = Array.from({ length: Math.max(0, 45 - alunosDaTurma.length) }, (_, i) => {
              const bg = (alunosDaTurma.length + i) % 2 === 0 ? '#f9f9f0' : '#ffffff';
              return `<tr style="background:${bg};height:22px;"><td></td><td></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td><td class="nc"></td></tr>`;
            });

            const dataHoje = new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });
            const dataFecho = pautaItem.dataFecho ? new Date(pautaItem.dataFecho).toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

            const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Pauta · ${disciplina} · ${turmaNome}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Times New Roman',serif;background:#fff;color:#000;padding:16px 20px;font-size:12px;}
  .header{text-align:center;margin-bottom:10px;}
  .header img{width:70px;height:70px;object-fit:contain;margin-bottom:4px;}
  .header p{font-size:12px;line-height:1.5;}
  .header .title{font-size:16px;font-weight:bold;margin:4px 0;}
  .header .escola{font-size:13px;font-weight:bold;text-transform:uppercase;margin:2px 0;}
  .meta{display:flex;gap:16px;font-size:11px;font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin-bottom:0;}
  .secretaria-stamp{background:#e8f5e9;border:1px solid #4caf50;border-radius:6px;padding:6px 12px;font-size:10px;color:#1b5e20;margin-bottom:8px;display:flex;align-items:center;gap:8px;}
  table{width:100%;border-collapse:collapse;font-size:10px;}
  th,td{border:1px solid #333;padding:2px 3px;}
  th{background:#c6efce;font-size:9px;font-weight:bold;text-align:center;white-space:nowrap;}
  th.hdr-tri{background:#1a6b3c;color:#fff;font-size:10px;}
  td.nc{text-align:center;font-size:10px;}
  td.bold{font-weight:bold;}
  .footer{margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;}
  .sig{text-align:center;}
  .sig-line{border-top:1px solid #000;margin-top:40px;padding-top:4px;font-size:11px;min-width:200px;}
  @media print{
    body{padding:8px 12px;}
    @page{size:A4 landscape;margin:8mm;}
    .no-print{display:none;}
  }
</style>
</head><body>
<div class="header">
  ${logoUrl ? `<img src="${logoUrl}" alt="Logo"/>` : ''}
  <p>REPÚBLICA DE ANGOLA</p>
  <p>MINISTÉRIO DA EDUCAÇÃO</p>
  <p class="title">PAUTA DE AVALIAÇÃO</p>
  <p class="escola">${nomeEscola}</p>
</div>
<div class="secretaria-stamp">
  ✅ Pauta validada e emitida pela Secretaria Académica em ${dataHoje} | Data de fecho pelo professor: ${dataFecho}
</div>
<div class="meta">
  <span>DISCIPLINA: <u>${disciplina}</u></span>
  <span>${nivelClasse}ª CLASSE</span>
  <span>TURMA: <u>${turmaNome}</u></span>
  <span>TRIMESTRE: <u>${trimestre}º</u></span>
  <span>ANO LECTIVO: <u style="color:#c00;">${anoLetivo}</u></span>
  <span>PROFESSOR(A): <u>${profNome}</u></span>
</div>
<table>
  <thead>
    <tr>
      <th rowspan="2" style="width:28px;">Nº</th>
      <th rowspan="2" style="min-width:120px;text-align:left;">NOME COMPLETO</th>
      <th colspan="4" class="hdr-tri">1º TRIMESTRE</th>
      <th colspan="4" class="hdr-tri">2º TRIMESTRE</th>
      <th colspan="4" class="hdr-tri">3º TRIMESTRE</th>
      <th rowspan="2" style="width:32px;">MFD</th>
      <th rowspan="2" style="width:60px;">OBSERVAÇÃO</th>
    </tr>
    <tr>
      <th>MAC</th><th>NPP</th><th>NPT</th><th>MT1</th>
      <th>MAC</th><th>NPP</th><th>NPT</th><th>MT2</th>
      <th>MAC</th><th>NPP</th><th>NPT</th><th>MT3</th>
    </tr>
  </thead>
  <tbody>
    ${rows.join('\n')}
    ${emptyRows.join('\n')}
  </tbody>
</table>
<div class="footer">
  <div class="sig">
    <div class="sig-line">O PROFESSOR(A)<br/><strong>${profNome}</strong></div>
  </div>
  <div class="sig">
    <div class="sig-line">O(A) DIRECTOR(A) PEDAGÓGICO(A)<br/><strong>${config?.directorPedagogico || '____________________'}</strong></div>
  </div>
  <div class="sig">
    <div class="sig-line">SECRETARIA ACADÉMICA<br/><strong>${user?.nome || '____________________'}</strong></div>
  </div>
</div>
<div class="no-print" style="text-align:center;margin-top:16px;">
  <button onclick="window.print()" style="padding:10px 32px;font-size:14px;background:#1a6b3c;color:#fff;border:none;border-radius:6px;cursor:pointer;">Imprimir / Guardar PDF</button>
</div>
</body></html>`;

            const win = window.open('', '_blank');
            if (win) { win.document.write(html); win.document.close(); }
          }

          function exportarExcelPauta(pautaItem: typeof pautas[0]) {
            if (Platform.OS !== 'web') {
              webAlert('Indisponível', 'A exportação Excel está disponível na versão web.');
              return;
            }
            const turmaObj = turmas.find(t => t.id === pautaItem.turmaId);
            const turmaNome = turmaObj?.nome || '—';
            const nivelClasse = turmaObj?.classe || '—';
            const profNome = nomeProfessor(pautaItem.professorId);
            const anoLetivo = anoSelecionado?.ano || pautaItem.anoLetivo || '';
            const escola = config?.nomeEscola || 'Escola';
            const { disciplina, trimestre } = pautaItem;
            const alunosDaTurma = alunos.filter(a => a.turmaId === pautaItem.turmaId && a.ativo);

            const header1 = ['REPÚBLICA DE ANGOLA — MINISTÉRIO DA EDUCAÇÃO'];
            const header2 = [`PAUTA DE AVALIAÇÃO — ${disciplina} — ${nivelClasse}ª Classe — Turma ${turmaNome} — ${trimestre}º Trimestre`];
            const header3 = [`Escola: ${escola}   Ano Lectivo: ${anoLetivo}   Professor(a): ${profNome}   Data: ${new Date().toLocaleDateString('pt-AO')}`];
            const colHeader = ['Nº', 'Nome Completo', 'MAC T1', 'NPP T1', 'NPT T1', 'MT1', 'MAC T2', 'NPP T2', 'NPT T2', 'MT2', 'MAC T3', 'NPP T3', 'NPT T3', 'MT3', 'MFD', 'Observação'];

            const dataRows = alunosDaTurma.map((aluno, idx) => {
              const get = (tr: number) => {
                const n = notas.find(n => n.alunoId === aluno.id && n.turmaId === pautaItem.turmaId && n.disciplina === disciplina && n.trimestre === tr);
                return n ? { mac: n.mac ?? n.mac1 ?? 0, npp: n.pp1 ?? 0, npt: n.ppt ?? 0, mt: n.mt1 ?? 0 } : null;
              };
              const t1 = get(1); const t2 = get(2); const t3 = get(3);
              const mts = [t1?.mt, t2?.mt, t3?.mt].filter((v): v is number => !!v && v > 0);
              const mfd = mts.length ? Math.round((mts.reduce((a, b) => a + b, 0) / mts.length) * 10) / 10 : '';
              const fmt = (v: number | null | undefined) => v && v > 0 ? v : '';
              const aprovado = typeof mfd === 'number' ? (mfd >= (config?.notaMinimaAprovacao ?? 10) ? 'Aprovado' : 'Reprovado') : '';
              return [
                idx + 1, `${aluno.nome} ${aluno.apelido}`,
                fmt(t1?.mac), fmt(t1?.npp), fmt(t1?.npt), fmt(t1?.mt),
                fmt(t2?.mac), fmt(t2?.npp), fmt(t2?.npt), fmt(t2?.mt),
                fmt(t3?.mac), fmt(t3?.npp), fmt(t3?.npt), fmt(t3?.mt),
                mfd, aprovado,
              ];
            });

            const wb = XLSX.utils.book_new();
            const wsData = [header1, header2, header3, [], colHeader, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!merges'] = [
              { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
              { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } },
              { s: { r: 2, c: 0 }, e: { r: 2, c: 15 } },
            ];
            ws['!cols'] = [{ wch: 5 }, { wch: 30 }, ...Array(14).fill({ wch: 8 })];
            XLSX.utils.book_append_sheet(wb, ws, 'Pauta');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Pauta_${disciplina}_${turmaNome}_T${trimestre}_${anoLetivo}.xlsx`.replace(/\//g, '-');
            a.click();
            URL.revokeObjectURL(url);
          }

          return (
            <>
              {/* Stats */}
              <View style={styles.statsRow}>
                <StatCard value={pautas.length} label="Total\nde Pautas" color={Colors.info} icon="ribbon" />
                <StatCard value={pautasFechadas} label="Pautas\nFechadas" color={Colors.success} icon="checkmark-circle" />
                <StatCard value={pautasAbertas} label="Pautas\nAbertas" color={Colors.gold} icon="create" />
                <StatCard value={pautasPendentes} label="Aguardam\nRea." color={Colors.warning} icon="time" />
              </View>

              {/* Filtros */}
              <View style={styles.card}>
                <SectionHeader title="Filtros" icon="filter" />

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Estado da Pauta</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {([['todas', 'Todas'], ['fechada', 'Fechadas'], ['aberta', 'Abertas']] as const).map(([v, l]) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.procBtn, pautaFiltroStatus === v && { backgroundColor: Colors.gold + '22', borderColor: Colors.gold }]}
                      onPress={() => setPautaFiltroStatus(v)}
                    >
                      <Text style={[styles.procBtnText, pautaFiltroStatus === v && { color: Colors.gold }]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Trimestre</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {([[0, 'Todos'], [1, '1º Trim.'], [2, '2º Trim.'], [3, '3º Trim.']] as [0|1|2|3, string][]).map(([v, l]) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.procBtn, pautaFiltroTrimestre === v && { backgroundColor: Colors.info + '22', borderColor: Colors.info }]}
                      onPress={() => setPautaFiltroTrimestre(v)}
                    >
                      <Text style={[styles.procBtnText, pautaFiltroTrimestre === v && { color: Colors.info }]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Turma</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.procBtn, pautaFiltroTurma === '' && { backgroundColor: Colors.accent + '22', borderColor: Colors.accent }]}
                    onPress={() => setPautaFiltroTurma('')}
                  >
                    <Text style={[styles.procBtnText, pautaFiltroTurma === '' && { color: Colors.accent }]}>Todas</Text>
                  </TouchableOpacity>
                  {turmas.filter(t => t.ativo).map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.procBtn, pautaFiltroTurma === t.id && { backgroundColor: Colors.accent + '22', borderColor: Colors.accent }]}
                      onPress={() => setPautaFiltroTurma(t.id)}
                    >
                      <Text style={[styles.procBtnText, pautaFiltroTurma === t.id && { color: Colors.accent }]}>{t.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Lista de pautas */}
              <View style={styles.card}>
                <SectionHeader title={`Pautas (${pautasFiltradas.length})`} icon="ribbon" />

                {pautasFiltradas.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                    <Ionicons name="ribbon-outline" size={36} color={Colors.textMuted} />
                    <Text style={styles.emptyText}>Nenhuma pauta encontrada com os filtros seleccionados.</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: 'center' }}>
                      As pautas aparecem aqui quando os professores submetem as notas na área deles.
                    </Text>
                  </View>
                ) : (
                  pautasFiltradas.map(p => {
                    const turmaObj = turmas.find(t => t.id === p.turmaId);
                    const profNome = nomeProfessor(p.professorId);
                    const statusColor = pautaStatusColor(p.status);
                    const statusLbl = pautaStatusLabel(p.status);
                    const numAlunos = alunos.filter(a => a.turmaId === p.turmaId && a.ativo).length;
                    const dataFecho = p.dataFecho ? new Date(p.dataFecho).toLocaleDateString('pt-PT') : null;

                    return (
                      <View key={p.id} style={[styles.processoCard, { borderLeftWidth: 3, borderLeftColor: statusColor }]}>
                        <View style={styles.processoCardTop}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.processoTopRow}>
                              <Text style={[styles.processoTipo, { fontSize: 13 }]}>{p.disciplina}</Text>
                              <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                <Text style={[styles.statusText, { color: statusColor }]}>{statusLbl}</Text>
                              </View>
                            </View>
                            <Text style={styles.processoMeta}>
                              {turmaObj?.nome || '—'} · {p.trimestre}º Trimestre · {p.anoLetivo}
                            </Text>
                            <Text style={styles.processoMeta}>
                              Prof. {profNome} · {numAlunos} aluno{numAlunos !== 1 ? 's' : ''}
                              {dataFecho ? ` · Fechada em ${dataFecho}` : ''}
                            </Text>
                          </View>
                        </View>

                        {p.status === 'fechada' && (
                          <View style={styles.processoActions}>
                            <TouchableOpacity
                              style={[styles.procBtn, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '44', flex: 1 }]}
                              onPress={() => imprimirPauta(p)}
                            >
                              <Ionicons name="print" size={13} color={Colors.success} />
                              <Text style={[styles.procBtnText, { color: Colors.success }]}>Imprimir Pauta</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.procBtn, { backgroundColor: Colors.info + '22', borderColor: Colors.info + '44', flex: 1 }]}
                              onPress={() => exportarExcelPauta(p)}
                            >
                              <Ionicons name="download" size={13} color={Colors.info} />
                              <Text style={[styles.procBtnText, { color: Colors.info }]}>Exportar Excel</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {p.status === 'aberta' && (
                          <View style={{ flexDirection: 'row', gap: 6, backgroundColor: Colors.info + '11', padding: 8, borderRadius: 8, marginTop: 6, alignItems: 'center' }}>
                            <Ionicons name="time-outline" size={13} color={Colors.info} />
                            <Text style={{ fontSize: 10, color: Colors.info, fontFamily: 'Inter_400Regular', flex: 1 }}>
                              Pauta em lançamento — aguarda o fecho pelo professor para poder imprimir.
                            </Text>
                          </View>
                        )}

                        {p.status === 'pendente_abertura' && (
                          <View style={[{ flexDirection: 'row', gap: 6, backgroundColor: Colors.warning + '11', padding: 8, borderRadius: 8, marginTop: 6, alignItems: 'center' }]}>
                            <Ionicons name="alert-circle-outline" size={13} color={Colors.warning} />
                            <Text style={{ fontSize: 10, color: Colors.warning, fontFamily: 'Inter_400Regular', flex: 1 }}>
                              Professor solicitou reabertura da pauta — aguarda aprovação da direcção.
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </>
          );
        })()}

        {/* ── CORRESPONDÊNCIA ──────────────────────────────── */}
        {activeTab === 'correspondencia' && (
          <View style={styles.card}>
            <SectionHeader
              title="Correspondência / Ofícios"
              icon="mail"
              count={correspondencias.length}
              onAction={() => setShowNovaCorresp(true)}
              actionLabel="Novo"
            />
            {loadingCorrespondencias ? (
              <ActivityIndicator color={Colors.gold} style={{ marginVertical: 24 }} />
            ) : correspondencias.length === 0 ? (
              <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginVertical: 24, fontFamily: 'Inter_400Regular' }}>
                Nenhuma correspondência registada.
              </Text>
            ) : correspondencias.map(c => (
              <View key={c.id} style={styles.corrRow}>
                <View style={[styles.corrBadge, { backgroundColor: c.tipo === 'entrada' ? Colors.info + '22' : Colors.success + '22' }]}>
                  <Ionicons name={c.tipo === 'entrada' ? 'arrow-down' : 'arrow-up'} size={13} color={c.tipo === 'entrada' ? Colors.info : Colors.success} />
                  <Text style={[styles.corrBadgeText, { color: c.tipo === 'entrada' ? Colors.info : Colors.success }]}>
                    {c.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </Text>
                </View>
                <View style={[styles.corrInfo, { flex: 1 }]}>
                  <View style={styles.corrTopRow}>
                    <Text style={[styles.corrAssunto, { flex: 1 }]} numberOfLines={1}>{c.assunto}</Text>
                    {c.urgente && <View style={styles.urgenteTag}><Text style={styles.urgenteText}>Urgente</Text></View>}
                  </View>
                  <Text style={styles.corrMeta}>{c.destinatario} · {c.data}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteCorrespondencia(c.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── MODAL NOVA CORRESPONDÊNCIA ────────────────────── */}
        <Modal visible={showNovaCorresp} animationType="slide" transparent onRequestClose={() => setShowNovaCorresp(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 20, paddingBottom: 34 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text }}>Nova Correspondência</Text>
                <TouchableOpacity onPress={() => setShowNovaCorresp(false)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: Colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 }}>Assunto *</Text>
              <TextInput
                style={{ backgroundColor: Colors.backgroundInput, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, fontFamily: 'Inter_400Regular' }}
                placeholder="Ex: Convocatória — Reunião Pedagógica"
                placeholderTextColor={Colors.textSecondary}
                value={novaCorrespAssunto}
                onChangeText={setNovaCorrespAssunto}
              />
              <Text style={{ color: Colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 }}>Destinatário / Remetente</Text>
              <TextInput
                style={{ backgroundColor: Colors.backgroundInput, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, fontFamily: 'Inter_400Regular' }}
                placeholder="Ex: Corpo Docente"
                placeholderTextColor={Colors.textSecondary}
                value={novaCorrespDestinatario}
                onChangeText={setNovaCorrespDestinatario}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {(['saida', 'entrada'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setNovaCorrespTipo(t)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: novaCorrespTipo === t ? Colors.gold : Colors.backgroundInput, borderWidth: 1, borderColor: novaCorrespTipo === t ? Colors.gold : Colors.border }}
                  >
                    <Text style={{ color: novaCorrespTipo === t ? '#000' : Colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                      {t === 'saida' ? '↑ Saída' : '↓ Entrada'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => setNovaCorrespUrgente(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: novaCorrespUrgente ? Colors.danger : Colors.border, backgroundColor: novaCorrespUrgente ? Colors.danger : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {novaCorrespUrgente && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
                <Text style={{ color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 13 }}>Marcar como urgente</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNovaCorrespondencia}
                style={{ backgroundColor: Colors.gold, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#000', fontFamily: 'Inter_700Bold', fontSize: 15 }}>Registar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>


      <EmitirDocumentoModal
        visible={showEmitirModal}
        onClose={() => setShowEmitirModal(false)}
        onEmit={handleEmitir}
        alunos={alunos}
      />
      <EmissaoRapidaModal
        visible={showEmissaoRapida}
        onClose={() => setShowEmissaoRapida(false)}
        alunos={alunos}
        turmas={turmas}
        notas={notas}
        config={config}
        anoAtual={anoSelecionado?.ano || String(new Date().getFullYear())}
        user={user}
      />
      <MapaAproveitamentoModal
        visible={showMapaAproveitamento}
        onClose={() => setShowMapaAproveitamento(false)}
        alunos={alunos}
        turmas={turmas}
        notas={notas}
        config={config}
        anoAtual={anoSelecionado?.ano || String(new Date().getFullYear())}
        user={user}
      />
      <NovoProcessoModal
        visible={showProcessoModal}
        onClose={() => setShowProcessoModal(false)}
        onSave={handleNovoProcesso}
      />
      <CredenciaisModal visible={showCredenciais} onClose={() => setShowCredenciais(false)} />

      {/* Modal de Rematrícula em Lote */}
      <Modal visible={showRematricula} animationType="slide" transparent onRequestClose={() => setShowRematricula(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 20, paddingBottom: 34, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.success + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="refresh-circle-outline" size={22} color={Colors.success} />
                </View>
                <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text }}>Rematrícula em Lote</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRematricula(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {rematriculaResultado ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.success + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
                  </View>
                  <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text }}>Processo Concluído</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Ano Lectivo Destino: {rematriculaAnoDestino}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <View style={{ flex: 1, backgroundColor: Colors.success + '15', borderRadius: 12, borderWidth: 1, borderColor: Colors.success + '40', padding: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.success }}>{rematriculaResultado.processados}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.success, textAlign: 'center' }}>Rematriculados</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: Colors.warning + '15', borderRadius: 12, borderWidth: 1, borderColor: Colors.warning + '40', padding: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.warning }}>{rematriculaResultado.bloqueados}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.warning, textAlign: 'center' }}>Bloqueados</Text>
                  </View>
                  {rematriculaResultado.erros > 0 && (
                    <View style={{ flex: 1, backgroundColor: Colors.danger + '15', borderRadius: 12, borderWidth: 1, borderColor: Colors.danger + '40', padding: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.danger }}>{rematriculaResultado.erros}</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.danger, textAlign: 'center' }}>Erros</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => setShowRematricula(false)}
                  style={{ backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' }}>Concluir</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: Colors.info + '12', borderRadius: 12, borderWidth: 1, borderColor: Colors.info + '30', padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 18 }}>
                    Este processo renova as matrículas de todos os alunos activos para o novo ano lectivo, criando automaticamente registos de reconfirmação.
                  </Text>
                </View>

                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>Ano Lectivo de Destino *</Text>
                <TextInput
                  style={{ backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, marginBottom: 16 }}
                  value={rematriculaAnoDestino}
                  onChangeText={setRematriculaAnoDestino}
                  placeholder="Ex: 2025/2026"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>Regras de Bloqueio Automático</Text>
                <TouchableOpacity
                  onPress={() => setRematriculaBloquearPendencia(v => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: rematriculaBloquearPendencia ? Colors.warning + '60' : Colors.border, padding: 14, marginBottom: 8 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: rematriculaBloquearPendencia ? Colors.warning : Colors.surface, borderWidth: 1.5, borderColor: rematriculaBloquearPendencia ? Colors.warning : Colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {rematriculaBloquearPendencia && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>Bloquear alunos com pendência financeira</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Propinas ou taxas em atraso</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRematriculaBloquearReprovados(v => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: rematriculaBloquearReprovados ? Colors.danger + '60' : Colors.border, padding: 14, marginBottom: 20 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: rematriculaBloquearReprovados ? Colors.danger : Colors.surface, borderWidth: 1.5, borderColor: rematriculaBloquearReprovados ? Colors.danger : Colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {rematriculaBloquearReprovados && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>Bloquear alunos reprovados</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Média final inferior a 10 no 3º trimestre</Text>
                  </View>
                </TouchableOpacity>

                <View style={{ backgroundColor: Colors.warning + '12', borderRadius: 12, borderWidth: 1, borderColor: Colors.warning + '40', padding: 12, marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.warning, marginBottom: 4 }}>Importante</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.warning, lineHeight: 18 }}>
                    Os alunos bloqueados não serão rematriculados automaticamente. A secretaria poderá levantá-los manualmente após regularização.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    if (!rematriculaAnoDestino.trim()) {
                      alertErro('Campo obrigatório', 'Indique o ano lectivo de destino.');
                      return;
                    }
                    setRematriculaLoading(true);
                    try {
                      const resultado = await api.post<any>('/api/rematricula-lote', {
                        anoLetivoDestino: rematriculaAnoDestino.trim(),
                        bloquearComPendencia: rematriculaBloquearPendencia,
                        bloquearReprovados: rematriculaBloquearReprovados,
                      });
                      setRematriculaResultado(resultado);
                    } catch (e: any) {
                      alertErro('Erro', e?.message || 'Não foi possível processar a rematrícula.');
                    } finally {
                      setRematriculaLoading(false);
                    }
                  }}
                  disabled={rematriculaLoading || !rematriculaAnoDestino.trim()}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: !rematriculaAnoDestino.trim() ? Colors.surface : Colors.success, borderRadius: 14, paddingVertical: 15, opacity: !rematriculaAnoDestino.trim() ? 0.5 : 1 }}
                >
                  {rematriculaLoading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="refresh-circle-outline" size={20} color="#fff" />
                        <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' }}>Iniciar Rematrícula em Lote</Text>
                      </>
                  }
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal automático — solicitações de documentos pendentes */}
      <PendingSolicitacoesModal
        visible={showSolicitacoesModal}
        solicitacoes={solicitacoesPendentes}
        onClose={() => setShowSolicitacoesModal(false)}
        onUpdate={(updated) => {
          setSolicitacoesPendentes(prev =>
            prev.map(s => s.id === updated.id ? updated : s)
                .filter(s => s.status === 'pendente' || s.status === 'em_processamento')
          );
        }}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },

  tabsRow: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  tabActive: { backgroundColor: Colors.gold + '18', borderColor: Colors.gold + '40' },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, alignItems: 'center', borderTopWidth: 3 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center', lineHeight: 12 },

  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '18', marginHorizontal: 12, marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.warning + '40' },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.warning },

  card: { margin: 12, marginBottom: 0, backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 14 },

  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  secHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  secHeaderTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.8 },
  countBadge: { backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  countBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#000' },
  secAction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  secActionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: (width - 68) / 4, alignItems: 'center', gap: 7 },
  actionIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 9.5, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 12 },

  processoRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  processoCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 10 },
  processoCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  processoCardLeft: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', flex: 1 },
  prioIndicator: { width: 4, height: '100%', borderRadius: 2, minHeight: 36 },
  processoInfo: { flex: 1 },
  processoTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  processoTipo: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  processoDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 4, marginTop: 4 },
  processoMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  processoSolicitante: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  processoActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  procBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  procBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  docCard: { marginBottom: 10 },
  docCardLeft: { borderLeftWidth: 3, paddingLeft: 10 },
  docCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  docIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1 },
  docNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  docTipo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  docData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  docTypeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  docTypeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  eventoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  eventoDateBox: { width: 42, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, paddingVertical: 4 },
  eventoDay: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  eventoMonth: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  eventoInfo: { flex: 1 },
  eventoNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  eventoTipo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  corrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  corrBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, minWidth: 64, justifyContent: 'center' },
  corrBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  corrInfo: { flex: 1 },
  corrTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  corrAssunto: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  corrMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  urgenteTag: { backgroundColor: Colors.danger + '22', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  urgenteText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.danger },

  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },

  cursoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cursoIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cursoHeaderInfo: { flex: 1 },
  cursoNivel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  cursoSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  cursoBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  cursoBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  classesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 },
  classeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
  classeChipInactive: { opacity: 0.4 },
  classeChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  classeChipCount: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.gold },
  cursoDetalhe: { paddingTop: 4 },
  classeGrupo: { marginBottom: 12 },
  classeGrupoTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  turmaDetalheRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 10, padding: 10, marginBottom: 6 },
  turmaDetalheLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  turmaDetalheDot: { width: 8, height: 8, borderRadius: 4 },
  turmaDetalheNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  turmaDetalheSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  discSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  discSectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  discChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  discChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, backgroundColor: Colors.surface },
  discChipText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  cursoActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  cursoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  cursoActionText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },


  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalBox: { backgroundColor: Colors.backgroundCard, borderRadius: 20, width: '100%', maxWidth: 420, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginHorizontal: 16, marginTop: 14, marginBottom: 6 },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16 },
  tipoCard: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface },
  tipoLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  input: { marginHorizontal: 16, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  prioRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16 },
  prioBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  prioBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  modalActions: { flexDirection: 'row', gap: 10, margin: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.info, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  submitBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },

  // CREDENTIALS MODAL
  credHeader: { padding: 28, alignItems: 'center', gap: 10 },
  credAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.info + '55', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.gold },
  credAvatarText: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#fff' },
  credBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.gold + '22', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  credBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  credBody: { padding: 16 },
  credName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },
  credSchool: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  credDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  credRowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.gold + '18', alignItems: 'center', justifyContent: 'center' },
  credRowContent: { flex: 1 },
  credRowLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 1 },
  credRowValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  credNote: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
});
