import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Platform, Dimensions, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import TopBar from '@/components/TopBar';

const { width } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────
type DocType = 'declaracao' | 'declaracao_com_nota' | 'transferencia' | 'certificado' | 'boletim' | 'atestado' | 'historico';
type TipoDocEspecifico = 'declaracao_sem_nota' | 'certificado_habilitacoes' | 'declaracao_com_nota' | 'transferencia';
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
    declaracao: 'Declaração Sem Nota',
    declaracao_com_nota: 'Declaração com Nota',
    transferencia: 'Declaração de Transferência',
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
    declaracao_com_nota: Colors.success,
    transferencia: '#8B5CF6',
    certificado: Colors.gold,
    boletim: '#06B6D4',
    atestado: Colors.warning,
    historico: Colors.accent,
  };
  return map[tipo];
}

const DOC_ESPECIFICO_CONFIG: Record<TipoDocEspecifico, {
  label: string; icon: string; color: string; docType: DocType; temFinalidade: boolean;
}> = {
  declaracao_sem_nota: { label: 'Declaração Sem Nota', icon: 'document-text-outline', color: Colors.info, docType: 'declaracao', temFinalidade: true },
  certificado_habilitacoes: { label: 'Certificado de Habilitações', icon: 'ribbon-outline', color: Colors.gold, docType: 'certificado', temFinalidade: false },
  declaracao_com_nota: { label: 'Declaração com Nota', icon: 'document-attach-outline', color: Colors.success, docType: 'declaracao_com_nota', temFinalidade: true },
  transferencia: { label: 'Declaração de Transferência', icon: 'arrow-redo-outline', color: '#8B5CF6', docType: 'transferencia', temFinalidade: true },
};

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

// ─── INITIAL DATA ───────────────────────────────────────────────────────────
const INITIAL_DOCUMENTOS: Documento[] = [
  { id: 'd1', tipo: 'declaracao', alunoNome: 'Maria João Silva', alunoNum: 'ALN-2025-0042', emitidoEm: '20/03/2025', emitidoPor: 'Secretaria', finalidade: 'Pedido de bolsa' },
  { id: 'd2', tipo: 'certificado', alunoNome: 'António Ferreira', alunoNum: 'ALN-2024-0107', emitidoEm: '19/03/2025', emitidoPor: 'Secretaria', finalidade: 'Concurso Universitário' },
  { id: 'd3', tipo: 'boletim', alunoNome: 'Ana Paula Neto', alunoNum: 'ALN-2025-0031', emitidoEm: '18/03/2025', emitidoPor: 'Secretaria', finalidade: '' },
  { id: 'd4', tipo: 'atestado', alunoNome: 'Pedro Lopes', alunoNum: 'ALN-2025-0058', emitidoEm: '17/03/2025', emitidoPor: 'Secretaria', finalidade: 'Emprego' },
  { id: 'd5', tipo: 'historico', alunoNome: 'Isabel Rodrigues', alunoNum: 'ALN-2023-0019', emitidoEm: '15/03/2025', emitidoPor: 'Secretaria', finalidade: 'Transferência' },
];

const INITIAL_PROCESSOS: Processo[] = [
  { id: 'p1', tipo: 'Transferência', descricao: 'Transferência entrada — Escola Sec. 10 de Fevereiro', solicitante: 'Eduardo Camilo', dataAbertura: '18/03/2025', prazo: '25/03/2025', status: 'em_curso', prioridade: 'alta' },
  { id: 'p2', tipo: 'Re-matrícula', descricao: 'Re-matrícula fora do prazo — 12.ª Classe', solicitante: 'Filomena Costa', dataAbertura: '17/03/2025', prazo: '22/03/2025', status: 'pendente', prioridade: 'alta' },
  { id: 'p3', tipo: 'Reclamação', descricao: 'Revisão de pauta — Matemática 10.ª B', solicitante: 'Rogério Alves', dataAbertura: '15/03/2025', status: 'em_curso', prioridade: 'media' },
  { id: 'p4', tipo: 'Registo Civil', descricao: 'Actualização BI — Aluno Afonso Teixeira', solicitante: 'Encar. Educação', dataAbertura: '12/03/2025', status: 'pendente', prioridade: 'media' },
  { id: 'p5', tipo: 'Equivalência', descricao: 'Pedido de equivalência — aluno proveniente do estrangeiro', solicitante: 'Família Nkosi', dataAbertura: '10/03/2025', status: 'pendente', prioridade: 'baixa' },
  { id: 'p6', tipo: 'Dispensa', descricao: 'Dispensa de Educação Física — atestado médico', solicitante: 'Beatriz Moreira', dataAbertura: '08/03/2025', status: 'concluido', prioridade: 'baixa' },
];

const CORRESPONDENCIAS: Correspondencia[] = [
  { id: 'c1', assunto: 'Convocatória — Reunião Conselho Pedagógico', destinatario: 'Corpo Docente', tipo: 'saida', data: '20/03/2025', urgente: true },
  { id: 'c2', assunto: 'Ofício n.º 142/DLEAE/2025 — Calendário de exames', destinatario: 'Direcção', tipo: 'entrada', data: '19/03/2025', urgente: true },
  { id: 'c3', assunto: 'Circular — Entrega de processos individuais', destinatario: 'Professores Directores de Turma', tipo: 'saida', data: '18/03/2025', urgente: false },
  { id: 'c4', assunto: 'Pedido de informação — DILEQ Luanda', destinatario: 'Secretaria', tipo: 'entrada', data: '17/03/2025', urgente: false },
  { id: 'c5', assunto: 'Aviso — Entrega de boletins de avaliação', destinatario: 'Encarregados de Educação', tipo: 'saida', data: '15/03/2025', urgente: false },
];

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
      Alert.alert('Campo obrigatório', 'Indique o nome do aluno.');
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
          />

          <Text style={styles.fieldLabel}>N.º de Matrícula</Text>
          <TextInput
            style={styles.input}
            value={alunoNum}
            onChangeText={setAlunoNum}
            placeholder="ALN-AAAA-XXXX"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Finalidade</Text>
          <TextInput
            style={styles.input}
            value={finalidade}
            onChangeText={setFinalidade}
            placeholder="Ex: Bolsa de estudo, emprego..."
            placeholderTextColor={Colors.textMuted}
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

// ─── EMITIR DOCUMENTO ESPECÍFICO MODAL ───────────────────────────────────────
function EmitirDocEspecificoModal({ visible, onClose, onEmit, tipo, alunos, turmas }: {
  visible: boolean; onClose: () => void;
  onEmit: (doc: Omit<Documento, 'id' | 'emitidoEm' | 'emitidoPor'>) => void;
  tipo: TipoDocEspecifico | null;
  alunos: any[]; turmas: any[];
}) {
  const config = tipo ? DOC_ESPECIFICO_CONFIG[tipo] : null;

  const [busca, setBusca] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState<any | null>(null);
  const [finalidade, setFinalidade] = useState('');
  const [erro, setErro] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const sugestoes = useMemo(() => {
    if (!busca.trim() || busca.trim().length < 2) return [];
    const q = busca.toLowerCase().trim();
    return alunos.filter(a => {
      const nomeCompleto = `${a.nome} ${a.apelido}`.toLowerCase();
      const matricula = (a.numeroMatricula || '').toLowerCase();
      const turma = turmas.find((t: any) => t.id === a.turmaId);
      const turmaNome = (turma?.nome || '').toLowerCase();
      const sala = (turma?.sala || '').toLowerCase();
      return nomeCompleto.includes(q) || matricula.includes(q) || turmaNome.includes(q) || sala.includes(q);
    }).slice(0, 6);
  }, [busca, alunos, turmas]);

  function handleSelectAluno(a: any) {
    setAlunoSelecionado(a);
    const turma = turmas.find((t: any) => t.id === a.turmaId);
    setBusca(`${a.nome} ${a.apelido}`);
    setMostrarSugestoes(false);
    setErro('');
  }

  function handleReset() {
    setBusca(''); setAlunoSelecionado(null); setFinalidade(''); setErro(''); setMostrarSugestoes(false);
  }

  function handleClose() { handleReset(); onClose(); }

  function handleSubmit() {
    if (!alunoSelecionado) { setErro('Seleccione um estudante da lista de sugestões.'); return; }
    if (config?.temFinalidade && !finalidade.trim()) { setErro('A finalidade é obrigatória para este documento.'); return; }
    setErro('');
    onEmit({
      tipo: config!.docType,
      alunoNome: `${alunoSelecionado.nome} ${alunoSelecionado.apelido}`,
      alunoNum: alunoSelecionado.numeroMatricula || `ALN-${Date.now()}`,
      finalidade: finalidade.trim(),
    });
    handleReset();
    onClose();
  }

  if (!config) return null;

  const turmaDoAluno = alunoSelecionado ? turmas.find((t: any) => t.id === alunoSelecionado.turmaId) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { maxHeight: '90%' }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.docEspIconWrap, { backgroundColor: config.color + '22' }]}>
                  <Ionicons name={config.icon as any} size={20} color={config.color} />
                </View>
                <Text style={[styles.modalTitle, { fontSize: 15 }]}>{config.label}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Pesquisa de Estudante */}
            <Text style={styles.fieldLabel}>Pesquisar Estudante *</Text>
            <Text style={styles.fieldHint}>Pesquise por nome, n.º matrícula, turma ou sala</Text>
            <View style={{ position: 'relative' }}>
              <View style={[styles.inputRow, { borderColor: mostrarSugestoes ? config.color : Colors.border }]}>
                <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, paddingHorizontal: 0 }]}
                  value={busca}
                  onChangeText={v => { setBusca(v); setAlunoSelecionado(null); setMostrarSugestoes(true); }}
                  placeholder="Ex: Maria João, ALN-2025-0042, 10.ª A..."
                  placeholderTextColor={Colors.textMuted}
                  onFocus={() => setMostrarSugestoes(true)}
                />
                {busca.length > 0 && (
                  <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Dropdown de sugestões */}
              {mostrarSugestoes && sugestoes.length > 0 && (
                <View style={styles.sugestoesBox}>
                  {sugestoes.map(a => {
                    const t = turmas.find((tr: any) => tr.id === a.turmaId);
                    return (
                      <TouchableOpacity key={a.id} style={styles.sugestaoRow} onPress={() => handleSelectAluno(a)} activeOpacity={0.7}>
                        <View style={styles.sugestaoAvatar}>
                          <Text style={styles.sugestaoAvatarText}>{a.nome[0]}{a.apelido[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sugestaoNome}>{a.nome} {a.apelido}</Text>
                          <Text style={styles.sugestaoMeta}>
                            {a.numeroMatricula}{t ? `  ·  ${t.nome}  ·  Sala ${t.sala}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {mostrarSugestoes && busca.trim().length >= 2 && sugestoes.length === 0 && (
                <View style={[styles.sugestoesBox, { padding: 14, alignItems: 'center' }]}>
                  <Ionicons name="person-outline" size={22} color={Colors.textMuted} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 6, fontFamily: 'Inter_400Regular' }}>Nenhum estudante encontrado</Text>
                </View>
              )}
            </View>

            {/* Cartão do aluno seleccionado */}
            {alunoSelecionado && (
              <View style={[styles.alunoCard, { borderColor: config.color + '44' }]}>
                <View style={[styles.alunoCardAvatar, { backgroundColor: config.color + '22' }]}>
                  <Text style={[styles.alunoCardAvatarText, { color: config.color }]}>
                    {alunoSelecionado.nome[0]}{alunoSelecionado.apelido[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alunoCardNome}>{alunoSelecionado.nome} {alunoSelecionado.apelido}</Text>
                  <Text style={styles.alunoCardMeta}>
                    {alunoSelecionado.numeroMatricula}
                    {turmaDoAluno ? `  ·  ${turmaDoAluno.nome}  ·  Sala ${turmaDoAluno.sala}` : ''}
                  </Text>
                </View>
                <View style={[styles.alunoCardCheck, { backgroundColor: config.color }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              </View>
            )}

            {/* Finalidade (apenas quando não é Certificado de Habilitações) */}
            {config.temFinalidade && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Finalidade *</Text>
                <Text style={styles.fieldHint}>Para que se destina este documento</Text>
                <TextInput
                  style={styles.input}
                  value={finalidade}
                  onChangeText={v => { setFinalidade(v); setErro(''); }}
                  placeholder="Ex: Pedido de bolsa de estudo, emprego, banco..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={2}
                />
              </>
            )}

            {/* Erro */}
            {erro.length > 0 && (
              <View style={styles.erroRow}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                <Text style={styles.erroText}>{erro}</Text>
              </View>
            )}

            {/* Acções */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: config.color }]} onPress={handleSubmit}>
                <Ionicons name="print-outline" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Emitir</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
      Alert.alert('Campos obrigatórios', 'Preencha tipo, descrição e solicitante.');
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
              placeholder="Nome do aluno ou encarregado" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Prazo</Text>
            <TextInput style={styles.input} value={prazo} onChangeText={setPrazo}
              placeholder="DD/MM/AAAA" placeholderTextColor={Colors.textMuted} />

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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { maxWidth: 380 }]}>
          <LinearGradient colors={['#1A5276', '#0D1B3E']} style={styles.credHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
            <Text style={styles.credSchool}>SIGE — Sistema Integral de Gestão Escolar</Text>

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
  const { alunos, turmas, eventos } = useData();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [documentos, setDocumentos] = useState<Documento[]>(INITIAL_DOCUMENTOS);
  const [processos, setProcessos] = useState<Processo[]>(INITIAL_PROCESSOS);
  const [showEmitirModal, setShowEmitirModal] = useState(false);
  const [showProcessoModal, setShowProcessoModal] = useState(false);
  const [showCredenciais, setShowCredenciais] = useState(false);
  const [emitirEspecificoTipo, setEmitirEspecificoTipo] = useState<TipoDocEspecifico | null>(null);

  function abrirDocEspecifico(t: TipoDocEspecifico) { setEmitirEspecificoTipo(t); }
  const [activeTab, setActiveTab] = useState<'visao' | 'processos' | 'documentos' | 'correspondencia'>('visao');

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

  function handleEmitir(doc: Omit<Documento, 'id' | 'emitidoEm' | 'emitidoPor'>) {
    const novo: Documento = { ...doc, id: `d${Date.now()}`, emitidoEm: today(), emitidoPor: user?.nome ?? 'Secretaria' };
    setDocumentos(prev => [novo, ...prev]);
  }

  function handleNovoProcesso(p: Omit<Processo, 'id' | 'dataAbertura' | 'status'>) {
    const novo: Processo = { ...p, id: `p${Date.now()}`, dataAbertura: today(), status: 'pendente' };
    setProcessos(prev => [novo, ...prev]);
  }

  function handleUpdateProcesso(id: string, status: ProcessoStatus) {
    setProcessos(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }

  const QUICK_ACTIONS = [
    { label: 'Declaração\nSem Nota', icon: 'document-text-outline', color: Colors.info, action: () => abrirDocEspecifico('declaracao_sem_nota') },
    { label: 'Certificado de\nHabilitações', icon: 'ribbon-outline', color: Colors.gold, action: () => abrirDocEspecifico('certificado_habilitacoes') },
    { label: 'Declaração\nCom Nota', icon: 'document-attach-outline', color: Colors.success, action: () => abrirDocEspecifico('declaracao_com_nota') },
    { label: 'Declaração de\nTransferência', icon: 'arrow-redo-outline', color: '#8B5CF6', action: () => abrirDocEspecifico('transferencia') },
    { label: 'Abrir\nProcesso', icon: 'folder-open', color: Colors.warning, action: () => setShowProcessoModal(true) },
    { label: 'Gestão\nde Alunos', icon: 'people', color: Colors.success, action: () => router.push('/(main)/alunos' as any) },
    { label: 'Registo\nde Presenças', icon: 'calendar-check', color: Colors.gold, action: () => router.push('/(main)/presencas' as any) },
    { label: 'Notas &\nPautas', icon: 'ribbon', color: Colors.accent, action: () => router.push('/(main)/notas' as any) },
    { label: 'Calendário\nEscolar', icon: 'calendar', color: '#8B5CF6', action: () => router.push('/(main)/eventos' as any) },
    { label: 'Relatórios', icon: 'bar-chart', color: '#06B6D4', action: () => router.push('/(main)/relatorios' as any) },
    { label: 'Credencial', icon: 'card', color: Colors.textSecondary, action: () => setShowCredenciais(true) },
    { label: 'Boletim de\nMatrícula', icon: 'newspaper', color: '#F59E0B', action: () => router.push('/(main)/boletim-matricula' as any) },
    { label: 'Caderneta\nde Propinas', icon: 'cash', color: '#10B981', action: () => router.push('/(main)/boletim-propina' as any) },
  ];

  const TABS = [
    { key: 'visao', label: 'Visão Geral', icon: 'grid' },
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
            {/* Gestão Académica Banner */}
            <TouchableOpacity
              style={styles.gestaoAcademicaBanner}
              onPress={() => router.push('/(main)/gestao-academica' as any)}
              activeOpacity={0.82}
            >
              <LinearGradient colors={['#1a2f6e', '#0D1B3E']} style={styles.gestaoAcademicaGrad}>
                <View style={styles.gestaoAcademicaLeft}>
                  <Ionicons name="school" size={28} color={Colors.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gestaoAcademicaTitle}>Gestão Académica</Text>
                    <Text style={styles.gestaoAcademicaSubtitle}>
                      Controlo completo: alunos, professores, turmas, presenças, notas, horário e histórico
                    </Text>
                  </View>
                </View>
                <View style={styles.gestaoAcademicaBtn}>
                  <Text style={styles.gestaoAcademicaBtnText}>Abrir</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.gold} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

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

            {/* Quick Actions */}
            <View style={styles.card}>
              <SectionHeader title="Ações Rápidas" icon="flash" />
              <View style={styles.actionsGrid}>
                {QUICK_ACTIONS.map((a, i) => (
                  <TouchableOpacity key={i} style={styles.actionCard} onPress={a.action} activeOpacity={0.75}>
                    <View style={[styles.actionIconWrap, { backgroundColor: a.color + '22' }]}>
                      <Ionicons name={a.icon as any} size={22} color={a.color} />
                    </View>
                    <Text style={styles.actionLabel}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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
              {documentos.slice(0, 4).map(d => (
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
              ))}
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
            {documentos.map(d => (
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
            ))}
          </View>
        )}

        {/* ── CORRESPONDÊNCIA ──────────────────────────────── */}
        {activeTab === 'correspondencia' && (
          <View style={styles.card}>
            <SectionHeader title="Correspondência / Ofícios" icon="mail" count={CORRESPONDENCIAS.length} />
            {CORRESPONDENCIAS.map(c => (
              <View key={c.id} style={styles.corrRow}>
                <View style={[styles.corrBadge, { backgroundColor: c.tipo === 'entrada' ? Colors.info + '22' : Colors.success + '22' }]}>
                  <Ionicons name={c.tipo === 'entrada' ? 'arrow-down' : 'arrow-up'} size={13} color={c.tipo === 'entrada' ? Colors.info : Colors.success} />
                  <Text style={[styles.corrBadgeText, { color: c.tipo === 'entrada' ? Colors.info : Colors.success }]}>
                    {c.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </Text>
                </View>
                <View style={styles.corrInfo}>
                  <View style={styles.corrTopRow}>
                    <Text style={styles.corrAssunto} numberOfLines={1}>{c.assunto}</Text>
                    {c.urgente && <View style={styles.urgenteTag}><Text style={styles.urgenteText}>Urgente</Text></View>}
                  </View>
                  <Text style={styles.corrMeta}>{c.destinatario} · {c.data}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => activeTab === 'processos' ? setShowProcessoModal(true) : setShowEmitirModal(true)}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[Colors.info, Colors.primary]} style={styles.fabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={26} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <EmitirDocumentoModal
        visible={showEmitirModal}
        onClose={() => setShowEmitirModal(false)}
        onEmit={handleEmitir}
        alunos={alunos}
      />
      <EmitirDocEspecificoModal
        visible={emitirEspecificoTipo !== null}
        onClose={() => setEmitirEspecificoTipo(null)}
        onEmit={handleEmitir}
        tipo={emitirEspecificoTipo}
        alunos={alunos}
        turmas={turmas}
      />
      <NovoProcessoModal
        visible={showProcessoModal}
        onClose={() => setShowProcessoModal(false)}
        onSave={handleNovoProcesso}
      />
      <CredenciaisModal visible={showCredenciais} onClose={() => setShowCredenciais(false)} />
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

  fab: { position: 'absolute', right: 18, bottom: 28, borderRadius: 30, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabGrad: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },

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

  gestaoAcademicaBanner: { marginHorizontal: 16, marginTop: 12, borderRadius: 18, overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10 },
  gestaoAcademicaGrad: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gestaoAcademicaLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gestaoAcademicaTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  gestaoAcademicaSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  gestaoAcademicaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.gold + '30', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.gold + '50' },
  gestaoAcademicaBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold },

  fieldHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 7, marginTop: -4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },

  sugestoesBox: { backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: 'hidden' },
  sugestaoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sugestaoAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.info + '22', alignItems: 'center', justifyContent: 'center' },
  sugestaoAvatarText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.info },
  sugestaoNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  sugestaoMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  alunoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, padding: 12, marginBottom: 4 },
  alunoCardAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  alunoCardAvatarText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  alunoCardNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoCardMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  alunoCardCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  docEspIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  erroRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.danger + '18', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.danger + '30' },
  erroText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.danger, flex: 1 },
});
