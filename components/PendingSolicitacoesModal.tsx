import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform,
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

// Map string tipo to gerar-documento route key
const TIPO_TO_ROUTE_KEY: Record<string, string> = {
  'Declaração de Matrícula': 'declaracao_matricula',
  'Certificado de Notas': 'boletim_notas',
  'Certificado de Frequência': 'atestado_frequencia',
  'Declaração de Conclusão de Curso': 'declaracao_conclusao',
  'Histórico Escolar': 'historico_escolar',
  'Diploma': 'certificado_habilitacoes',
  'Outros': 'declaracao_matricula',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: Colors.warning },
  em_processamento: { label: 'Em Processamento', color: Colors.info },
  concluido: { label: 'Concluído', color: Colors.success },
  cancelado: { label: 'Cancelado', color: Colors.danger },
};

const TIPO_ICONS: Record<string, string> = {
  'Declaração de Matrícula': 'document-text',
  'Certificado de Notas': 'bar-chart',
  'Certificado de Frequência': 'checkmark-circle',
  'Declaração de Conclusão de Curso': 'school',
  'Histórico Escolar': 'time',
  'Diploma': 'ribbon',
  'Outros': 'document',
};

interface Props {
  visible: boolean;
  solicitacoes: Solicitacao[];
  onClose: () => void;
  onUpdate: (updated: Solicitacao) => void;
}

export default function PendingSolicitacoesModal({ visible, solicitacoes, onClose, onUpdate }: Props) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendentes = solicitacoes.filter(s => s.status === 'pendente');

  async function marcarEmProcessamento(sol: Solicitacao) {
    setProcessingId(sol.id);
    try {
      const res = await apiRequest('PUT', `/api/solicitacoes-documentos/${sol.id}`, { status: 'em_processamento' });
      if (res.ok) {
        const updated = await res.json();
        onUpdate({ ...sol, ...updated, status: 'em_processamento' });
        alertSucesso('Marcado como Em Processamento');
      }
    } catch {
      alertErro('Erro ao actualizar estado');
    } finally {
      setProcessingId(null);
    }
  }

  async function marcarConcluido(sol: Solicitacao) {
    setProcessingId(sol.id + '_done');
    try {
      const res = await apiRequest('PUT', `/api/solicitacoes-documentos/${sol.id}`, { status: 'concluido' });
      if (res.ok) {
        const updated = await res.json();
        onUpdate({ ...sol, ...updated, status: 'concluido' });
        alertSucesso('Solicitação concluída');
      }
    } catch {
      alertErro('Erro ao actualizar estado');
    } finally {
      setProcessingId(null);
    }
  }

  function gerarDocumento(sol: Solicitacao) {
    onClose();
    const tipoKey = TIPO_TO_ROUTE_KEY[sol.tipo] || 'declaracao_matricula';
    router.push(`/(main)/gerar-documento?alunoId=${encodeURIComponent(sol.alunoId)}&tipo=${encodeURIComponent(tipoKey)}&solicitacaoId=${encodeURIComponent(sol.id)}` as any);
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return iso; }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.iconBadge}>
                <MaterialCommunityIcons name="file-document-multiple" size={20} color={Colors.gold} />
              </View>
              <View>
                <Text style={s.title}>Solicitações Pendentes</Text>
                <Text style={s.subtitle}>{pendentes.length} pedido{pendentes.length !== 1 ? 's' : ''} aguardam resposta</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {solicitacoes.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="check-all" size={48} color={Colors.success} />
                <Text style={s.emptyText}>Sem solicitações pendentes</Text>
              </View>
            ) : (
              solicitacoes.map(sol => {
                const st2 = STATUS_LABELS[sol.status] || STATUS_LABELS.pendente;
                const icon = TIPO_ICONS[sol.tipo] || 'document-text';
                const nomeCompleto = [sol.nomeAluno, sol.apelidoAluno].filter(Boolean).join(' ') || sol.alunoId;
                const isPending = sol.status === 'pendente';
                const isProcessing = sol.status === 'em_processamento';
                return (
                  <View key={sol.id} style={[s.card, !isPending && { opacity: 0.8 }]}>
                    {/* Card header */}
                    <View style={s.cardHeader}>
                      <View style={[s.cardIcon, { backgroundColor: Colors.gold + '18' }]}>
                        <Ionicons name={icon as any} size={18} color={Colors.gold} />
                      </View>
                      <View style={s.cardInfo}>
                        <Text style={s.cardTipo} numberOfLines={1}>{sol.tipo}</Text>
                        <Text style={s.cardAluno} numberOfLines={1}>
                          {nomeCompleto}
                          {sol.nomeTurma ? ` · ${sol.nomeTurma}` : ''}
                          {sol.classeAluno ? ` (${sol.classeAluno}ª)` : ''}
                        </Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: st2.color + '20', borderColor: st2.color + '40' }]}>
                        <Text style={[s.statusText, { color: st2.color }]}>{st2.label}</Text>
                      </View>
                    </View>

                    {/* Motivo */}
                    {sol.motivo ? (
                      <Text style={s.motivo} numberOfLines={2}>{sol.motivo}</Text>
                    ) : null}

                    {/* Date */}
                    <Text style={s.dateText}>{formatDate(sol.createdAt)}</Text>

                    {/* Actions */}
                    {(isPending || isProcessing) && (
                      <View style={s.actions}>
                        <TouchableOpacity
                          style={[s.btnGerar]}
                          onPress={() => gerarDocumento(sol)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="print" size={14} color="#fff" />
                          <Text style={s.btnGerarText}>Gerar & Imprimir</Text>
                        </TouchableOpacity>

                        {isPending && (
                          <TouchableOpacity
                            style={s.btnProcess}
                            onPress={() => marcarEmProcessamento(sol)}
                            activeOpacity={0.8}
                            disabled={processingId === sol.id}
                          >
                            {processingId === sol.id
                              ? <ActivityIndicator size="small" color={Colors.info} />
                              : <Text style={s.btnProcessText}>Em Processamento</Text>
                            }
                          </TouchableOpacity>
                        )}

                        {isProcessing && (
                          <TouchableOpacity
                            style={s.btnDone}
                            onPress={() => marcarConcluido(sol)}
                            activeOpacity={0.8}
                            disabled={processingId === sol.id + '_done'}
                          >
                            {processingId === sol.id + '_done'
                              ? <ActivityIndicator size="small" color={Colors.success} />
                              : <Text style={s.btnDoneText}>Concluído</Text>
                            }
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity
              style={s.btnVerTodas}
              onPress={() => { onClose(); router.push('/(main)/solicitacoes-secretaria' as any); }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={Colors.gold} />
              <Text style={s.btnVerTodasText}>Ver Todas as Solicitações</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnFechar} onPress={onClose} activeOpacity={0.8}>
              <Text style={s.btnFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 3,
    borderTopColor: Colors.gold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBadge: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.gold + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { paddingHorizontal: 16, paddingTop: 12, maxHeight: 480 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardIcon: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTipo: { fontSize: 13, fontWeight: '600', color: Colors.text },
  cardAluno: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '600' },
  motivo: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4, lineHeight: 17 },
  dateText: { fontSize: 10, color: Colors.textMuted, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnGerar: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.gold,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  btnGerarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnProcess: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.info,
    minWidth: 44, alignItems: 'center',
  },
  btnProcessText: { color: Colors.info, fontSize: 12, fontWeight: '600' },
  btnDone: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.success,
    minWidth: 44, alignItems: 'center',
  },
  btnDoneText: { color: Colors.success, fontSize: 12, fontWeight: '600' },
  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  btnVerTodas: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.gold, borderRadius: 10, paddingVertical: 10,
  },
  btnVerTodasText: { color: Colors.gold, fontSize: 13, fontWeight: '600' },
  btnFechar: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.border, borderRadius: 10, alignItems: 'center',
  },
  btnFecharText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
