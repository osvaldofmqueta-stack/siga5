import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { apiRequest } from '@/lib/query-client';
import { alertSucesso, alertErro } from '@/utils/toast';

export interface Solicitacao {
  id: string;
  alunoId: string;
  tipo: string;
  motivo: string;
  observacao?: string;
  status: string;
  resposta?: string;
  createdAt: string;
  nomeAluno?: string;
  apelidoAluno?: string;
  alunoNumMatricula?: string;
  nomeTurma?: string;
  classeAluno?: string;
}

const TIPO_TO_ROUTE_KEY: Record<string, string> = {
  'Declaração de Matrícula': 'declaracao_matricula',
  'Certificado de Notas': 'boletim_notas',
  'Certificado de Frequência': 'atestado_frequencia',
  'Declaração de Conclusão de Curso': 'declaracao_conclusao',
  'Histórico Escolar': 'historico_escolar',
  'Diploma': 'certificado_habilitacoes',
  'Outros': 'declaracao_matricula',
};

const TIPO_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Declaração de Matrícula': 'document-text',
  'Certificado de Notas': 'bar-chart',
  'Certificado de Frequência': 'checkmark-circle',
  'Declaração de Conclusão de Curso': 'school',
  'Histórico Escolar': 'time',
  'Diploma': 'ribbon',
  'Outros': 'document',
};

const TIPO_COLORS: Record<string, string> = {
  'Declaração de Matrícula': Colors.info,
  'Certificado de Notas': Colors.success,
  'Certificado de Frequência': '#8B5CF6',
  'Declaração de Conclusão de Curso': Colors.gold,
  'Histórico Escolar': Colors.warning,
  'Diploma': Colors.gold,
  'Outros': Colors.textSecondary,
};

interface Props {
  visible: boolean;
  solicitacoes: Solicitacao[];
  onClose: () => void;
  onAdiar: () => void;
  onUpdate: (updated: Solicitacao) => void;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch { return iso; }
}

export default function PendingSolicitacoesModal({ visible, solicitacoes, onClose, onAdiar, onUpdate }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  const pendentes = solicitacoes.filter(s => s.status === 'pendente' || s.status === 'em_processamento');
  const total = pendentes.length;
  const current = pendentes[currentIndex] ?? null;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setAllDone(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && pendentes.length === 0 && solicitacoes.length > 0) {
      setAllDone(true);
    }
  }, [pendentes.length, visible]);

  function advance() {
    if (currentIndex < pendentes.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setAllDone(true);
    }
  }

  async function marcarConcluido(sol: Solicitacao) {
    setLoadingAction('concluido');
    try {
      const res = await apiRequest('PUT', `/api/solicitacoes-documentos/${sol.id}`, { status: 'concluido' });
      if (res.ok) {
        const updated = await res.json();
        onUpdate({ ...sol, ...updated, status: 'concluido' });
        alertSucesso('Solicitação concluída');
        setTimeout(advance, 300);
      }
    } catch {
      alertErro('Erro ao actualizar estado');
    } finally {
      setLoadingAction(null);
    }
  }

  async function gerarDocumento(sol: Solicitacao) {
    setLoadingAction('gerar');
    try {
      const res = await apiRequest('PUT', `/api/solicitacoes-documentos/${sol.id}`, { status: 'em_processamento' });
      if (res.ok) {
        const updated = await res.json();
        onUpdate({ ...sol, ...updated, status: 'em_processamento' });
      }
    } catch {
    } finally {
      setLoadingAction(null);
    }
    onClose();
    const tipoKey = TIPO_TO_ROUTE_KEY[sol.tipo] || 'declaracao_matricula';
    router.push(`/(main)/gerar-documento?alunoId=${encodeURIComponent(sol.alunoId)}&tipo=${encodeURIComponent(tipoKey)}&solicitacaoId=${encodeURIComponent(sol.id)}` as any);
  }

  function saltarParaProximo() {
    if (currentIndex < pendentes.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  }

  const progress = total > 0 ? (currentIndex / total) : 0;
  const tipoColor = current ? (TIPO_COLORS[current.tipo] || Colors.gold) : Colors.gold;
  const tipoIcon = current ? (TIPO_ICONS[current.tipo] || 'document-text') : 'document-text';
  const nomeCompleto = current
    ? [current.nomeAluno, current.apelidoAluno].filter(Boolean).join(' ') || current.alunoId
    : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {}}
    >
      <View style={s.overlay}>
        <View style={s.container}>

          {allDone || total === 0 ? (
            /* ── TUDO RESOLVIDO ─────────────────────────────── */
            <View style={s.successWrap}>
              <View style={s.successIconWrap}>
                <MaterialCommunityIcons name="check-all" size={52} color={Colors.success} />
              </View>
              <Text style={s.successTitle}>Todas as Solicitações Tratadas!</Text>
              <Text style={s.successSub}>Não existem pedidos pendentes de documentos.</Text>
              <TouchableOpacity style={s.btnFecharSuccess} onPress={onClose} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.btnFecharSuccessText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── CABEÇALHO ──────────────────────────────────── */}
              <View style={s.header}>
                <View style={s.headerLeft}>
                  <View style={[s.iconBadge, { backgroundColor: tipoColor + '22' }]}>
                    <MaterialCommunityIcons name="file-document-multiple" size={20} color={tipoColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>Solicitações Pendentes</Text>
                    <Text style={s.subtitle}>
                      {currentIndex + 1} de {total} pedido{total !== 1 ? 's' : ''} por resolver
                    </Text>
                  </View>
                </View>
                <View style={[s.lockBadge]}>
                  <Ionicons name="lock-closed" size={13} color={Colors.warning} />
                  <Text style={s.lockText}>Obrigatório</Text>
                </View>
              </View>

              {/* ── BARRA DE PROGRESSO ─────────────────────────── */}
              <View style={s.progressWrap}>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: tipoColor }]} />
                </View>
                <Text style={s.progressText}>{currentIndex + 1}/{total}</Text>
              </View>

              {/* ── CARD DO ITEM ATUAL ─────────────────────────── */}
              {current && (
                <View style={s.card}>
                  {/* Tipo + Aluno */}
                  <View style={s.cardTop}>
                    <View style={[s.tipoIconWrap, { backgroundColor: tipoColor + '18' }]}>
                      <Ionicons name={tipoIcon} size={26} color={tipoColor} />
                    </View>
                    <View style={s.cardInfo}>
                      <Text style={[s.cardTipo, { color: tipoColor }]}>{current.tipo}</Text>
                      <Text style={s.cardAluno} numberOfLines={1}>
                        {nomeCompleto}
                        {current.nomeTurma ? ` · ${current.nomeTurma}` : ''}
                        {current.classeAluno ? ` (${current.classeAluno}ª Classe)` : ''}
                      </Text>
                      {current.alunoNumMatricula ? (
                        <Text style={s.cardMatricula}>Nº {current.alunoNumMatricula}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Status badge */}
                  <View style={[s.statusRow]}>
                    <View style={[s.statusBadge, {
                      backgroundColor: current.status === 'em_processamento' ? Colors.info + '20' : Colors.warning + '20',
                      borderColor: current.status === 'em_processamento' ? Colors.info + '50' : Colors.warning + '50',
                    }]}>
                      <Ionicons
                        name={current.status === 'em_processamento' ? 'cog' : 'time'}
                        size={11}
                        color={current.status === 'em_processamento' ? Colors.info : Colors.warning}
                      />
                      <Text style={[s.statusText, { color: current.status === 'em_processamento' ? Colors.info : Colors.warning }]}>
                        {current.status === 'em_processamento' ? 'Em Processamento' : 'Pendente'}
                      </Text>
                    </View>
                    <Text style={s.dateText}>{formatDate(current.createdAt)}</Text>
                  </View>

                  {/* Motivo */}
                  {current.motivo ? (
                    <View style={s.motivoWrap}>
                      <Ionicons name="chatbubble-outline" size={13} color={Colors.textMuted} />
                      <Text style={s.motivo} numberOfLines={3}>{current.motivo}</Text>
                    </View>
                  ) : null}

                  {/* Observação */}
                  {current.observacao ? (
                    <View style={[s.motivoWrap, { marginTop: 4 }]}>
                      <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
                      <Text style={s.motivo} numberOfLines={2}>{current.observacao}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* ── ACÇÕES PRINCIPAIS ──────────────────────────── */}
              {current && (
                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.btnGerar, { backgroundColor: tipoColor }]}
                    onPress={() => gerarDocumento(current)}
                    activeOpacity={0.85}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === 'gerar'
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <>
                          <Ionicons name="print" size={16} color="#fff" />
                          <Text style={s.btnGerarText}>Gerar & Imprimir</Text>
                        </>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.btnConcluido}
                    onPress={() => marcarConcluido(current)}
                    activeOpacity={0.85}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === 'concluido'
                      ? <ActivityIndicator size="small" color={Colors.success} />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                          <Text style={s.btnConcluidoText}>Marcar Concluído</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* ── RODAPÉ ─────────────────────────────────────── */}
              <View style={s.footer}>
                {pendentes.length > 1 && currentIndex < pendentes.length - 1 && (
                  <TouchableOpacity style={s.btnSaltar} onPress={saltarParaProximo} activeOpacity={0.8}>
                    <Text style={s.btnSaltarText}>Saltar para o próximo</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.btnAdiar} onPress={onAdiar} activeOpacity={0.8}>
                  <Ionicons name="time-outline" size={14} color={Colors.danger} />
                  <Text style={s.btnAdiarText}>Adiar — resolver mais tarde</Text>
                </TouchableOpacity>
              </View>

              {/* ── AVISO BLOQUEIO ─────────────────────────────── */}
              <View style={s.lockWarning}>
                <Ionicons name="alert-circle-outline" size={13} color={Colors.warning} />
                <Text style={s.lockWarningText}>
                  Existem {total - currentIndex} solicitaç{total - currentIndex !== 1 ? 'ões' : 'ão'} por resolver. Resolva todas ou adie para continuar.
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 3,
    borderTopColor: Colors.gold,
    maxHeight: '92%',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBadge: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontFamily: 'Inter_400Regular' },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warning + '18',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.warning + '40',
  },
  lockText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.warning },

  /* Progress */
  progressWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  progressTrack: {
    flex: 1, height: 5, borderRadius: 3,
    backgroundColor: Colors.border, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textSecondary, minWidth: 32, textAlign: 'right' },

  /* Card */
  card: {
    marginHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  tipoIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 3 },
  cardTipo: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  cardAluno: { fontSize: 13, color: Colors.textSecondary, fontFamily: 'Inter_500Medium' },
  cardMatricula: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  dateText: { fontSize: 10, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  motivoWrap: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  motivo: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17, fontFamily: 'Inter_400Regular' },

  /* Actions */
  actions: {
    flexDirection: 'row', gap: 10, flexWrap: 'wrap',
    paddingHorizontal: 16, marginTop: 14,
  },
  btnGerar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12, minWidth: 140,
  },
  btnGerarText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  btnConcluido: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.success, minWidth: 140,
  },
  btnConcluidoText: { color: Colors.success, fontSize: 14, fontFamily: 'Inter_700Bold' },

  /* Footer */
  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    gap: 8,
  },
  btnSaltar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  btnSaltarText: { fontSize: 13, color: Colors.textMuted, fontFamily: 'Inter_500Medium' },
  btnAdiar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.danger + '40',
    backgroundColor: Colors.danger + '08',
  },
  btnAdiarText: { fontSize: 13, color: Colors.danger, fontFamily: 'Inter_500Medium' },

  /* Lock warning */
  lockWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: Colors.warning + '10',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.warning + '30',
  },
  lockWarningText: {
    flex: 1, fontSize: 11, color: Colors.warning,
    fontFamily: 'Inter_400Regular', lineHeight: 15,
  },

  /* Success */
  successWrap: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 12,
  },
  successIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.success + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.success + '40',
  },
  successTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },
  successSub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  btnFecharSuccess: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.success, paddingHorizontal: 28,
    paddingVertical: 13, borderRadius: 12, marginTop: 8,
  },
  btnFecharSuccessText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
