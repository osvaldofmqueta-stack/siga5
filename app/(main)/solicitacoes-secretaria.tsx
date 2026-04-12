import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { apiRequest } from '@/lib/query-client';
import { alertSucesso, alertErro } from '@/utils/toast';

interface Solicitacao {
  id: string;
  alunoId: string;
  tipo: string;
  motivo: string;
  observacao?: string;
  status: string;
  resposta?: string;
  referenciaPagamento?: string;
  createdAt: string;
  updatedAt?: string;
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

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pendente: { label: 'Pendente', color: Colors.warning, icon: 'time-outline' },
  em_processamento: { label: 'Em Processamento', color: Colors.info, icon: 'cog-outline' },
  concluido: { label: 'Concluído', color: Colors.success, icon: 'checkmark-circle-outline' },
  cancelado: { label: 'Cancelado', color: Colors.danger, icon: 'close-circle-outline' },
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

const STATUS_FILTERS = ['todos', 'pendente', 'em_processamento', 'concluido', 'cancelado'];

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch { return iso; }
}

export default function SolicitacoesSecretariaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [search, setSearch] = useState('');

  const [detailModal, setDetailModal] = useState<Solicitacao | null>(null);
  const [resposta, setResposta] = useState('');
  const [refPagamento, setRefPagamento] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSolicitacoes = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/solicitacoes-documentos');
      const data = await res.json();
      setSolicitacoes(Array.isArray(data) ? data : []);
    } catch {
      setSolicitacoes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSolicitacoes();
  };

  const filtradas = solicitacoes.filter(s => {
    const matchStatus = filtroStatus === 'todos' || s.status === filtroStatus;
    const q = search.toLowerCase().trim();
    if (!matchStatus) return false;
    if (!q) return true;
    const nome = `${s.nomeAluno || ''} ${s.apelidoAluno || ''} ${s.tipo || ''} ${s.alunoNumMatricula || ''}`.toLowerCase();
    return nome.includes(q);
  });

  const pendentesCount = solicitacoes.filter(s => s.status === 'pendente').length;

  async function updateStatus(sol: Solicitacao, status: string, extra?: { resposta?: string; referenciaPagamento?: string }) {
    setSaving(true);
    try {
      const body: any = { status, ...extra };
      const res = await apiRequest('PUT', `/api/solicitacoes-documentos/${sol.id}`, body);
      if (res.ok) {
        const updated = await res.json();
        setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, ...updated } : s));
        alertSucesso('Estado actualizado com sucesso');
        setDetailModal(null);
      } else {
        alertErro('Erro ao actualizar');
      }
    } catch {
      alertErro('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }

  function gerarDocumento(sol: Solicitacao) {
    setDetailModal(null);
    const tipoKey = TIPO_TO_ROUTE_KEY[sol.tipo] || 'declaracao_matricula';
    router.push(`/(main)/gerar-documento?alunoId=${encodeURIComponent(sol.alunoId)}&tipo=${encodeURIComponent(tipoKey)}&solicitacaoId=${encodeURIComponent(sol.id)}` as any);
  }

  function openDetail(sol: Solicitacao) {
    setDetailModal(sol);
    setResposta(sol.resposta || '');
    setRefPagamento(sol.referenciaPagamento || '');
  }

  return (
    <View style={s.screen}>
      <TopBar title="Solicitações de Documentos" subtitle="Pedidos dos alunos" />

      {/* Resumo rápido */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { borderColor: Colors.warning + '44' }]}>
          <Text style={[s.summaryNum, { color: Colors.warning }]}>{pendentesCount}</Text>
          <Text style={s.summaryLbl}>Pendentes</Text>
        </View>
        <View style={[s.summaryCard, { borderColor: Colors.info + '44' }]}>
          <Text style={[s.summaryNum, { color: Colors.info }]}>{solicitacoes.filter(s => s.status === 'em_processamento').length}</Text>
          <Text style={s.summaryLbl}>Em Processo</Text>
        </View>
        <View style={[s.summaryCard, { borderColor: Colors.success + '44' }]}>
          <Text style={[s.summaryNum, { color: Colors.success }]}>{solicitacoes.filter(s => s.status === 'concluido').length}</Text>
          <Text style={s.summaryLbl}>Concluídos</Text>
        </View>
        <View style={[s.summaryCard, { borderColor: Colors.textMuted + '44' }]}>
          <Text style={[s.summaryNum, { color: Colors.textMuted }]}>{solicitacoes.length}</Text>
          <Text style={s.summaryLbl}>Total</Text>
        </View>
      </View>

      {/* Barra de pesquisa */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Pesquisar por aluno, tipo..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtros de estado */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersRow} contentContainerStyle={s.filtersContent}>
        {STATUS_FILTERS.map(f => {
          const meta = f === 'todos' ? { label: 'Todos', color: Colors.textSecondary } : { label: STATUS_META[f]?.label || f, color: STATUS_META[f]?.color || Colors.textMuted };
          const active = filtroStatus === f;
          return (
            <TouchableOpacity
              key={f}
              style={[s.filterChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
              onPress={() => setFiltroStatus(f)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterChipText, active && { color: '#fff' }]}>{meta.label}</Text>
              {f !== 'todos' && (
                <Text style={[s.filterBadge, active && { color: '#fff' }]}>
                  {solicitacoes.filter(s => s.status === f).length}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={s.loadingText}>A carregar solicitações...</Text>
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.gold]} tintColor={Colors.gold} />}
          showsVerticalScrollIndicator={false}
        >
          {filtradas.length === 0 ? (
            <View style={s.empty}>
              <MaterialCommunityIcons name="file-document-outline" size={48} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>Sem solicitações</Text>
              <Text style={s.emptyText}>
                {filtroStatus === 'todos' ? 'Nenhuma solicitação registada' : `Sem pedidos ${STATUS_META[filtroStatus]?.label?.toLowerCase() || ''}`}
              </Text>
            </View>
          ) : (
            filtradas.map(sol => {
              const meta = STATUS_META[sol.status] || STATUS_META.pendente;
              const icon = TIPO_ICONS[sol.tipo] || 'document-text';
              const nomeCompleto = [sol.nomeAluno, sol.apelidoAluno].filter(Boolean).join(' ') || sol.alunoId;
              return (
                <TouchableOpacity key={sol.id} style={s.card} onPress={() => openDetail(sol)} activeOpacity={0.8}>
                  <View style={s.cardTop}>
                    <View style={[s.cardIconWrap, { backgroundColor: Colors.gold + '18' }]}>
                      <Ionicons name={icon as any} size={18} color={Colors.gold} />
                    </View>
                    <View style={s.cardBody}>
                      <Text style={s.cardTipo} numberOfLines={1}>{sol.tipo}</Text>
                      <Text style={s.cardAluno} numberOfLines={1}>
                        {nomeCompleto}
                        {sol.nomeTurma ? ` · ${sol.nomeTurma}` : ''}
                        {sol.alunoNumMatricula ? ` · ${sol.alunoNumMatricula}` : ''}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
                      <Ionicons name={meta.icon as any} size={11} color={meta.color} />
                      <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                  {sol.motivo ? (
                    <Text style={s.cardMotivo} numberOfLines={2}>"{sol.motivo}"</Text>
                  ) : null}
                  <View style={s.cardFooter}>
                    <Text style={s.cardDate}>{formatDate(sol.createdAt)}</Text>
                    <View style={s.cardActions}>
                      {(sol.status === 'pendente' || sol.status === 'em_processamento') && (
                        <TouchableOpacity
                          style={s.btnGerar}
                          onPress={e => { e.stopPropagation?.(); gerarDocumento(sol); }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="print" size={12} color="#fff" />
                          <Text style={s.btnGerarText}>Gerar</Text>
                        </TouchableOpacity>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal de detalhe */}
      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            {detailModal && (() => {
              const meta = STATUS_META[detailModal.status] || STATUS_META.pendente;
              const nomeCompleto = [detailModal.nomeAluno, detailModal.apelidoAluno].filter(Boolean).join(' ') || detailModal.alunoId;
              return (
                <>
                  <View style={s.modalHeader}>
                    <View style={[s.modalIconWrap, { backgroundColor: Colors.gold + '18' }]}>
                      <MaterialCommunityIcons name="file-account" size={20} color={Colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalTitle} numberOfLines={1}>{detailModal.tipo}</Text>
                      <Text style={s.modalSub}>{nomeCompleto}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setDetailModal(null)} style={s.modalClose}>
                      <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Estado</Text>
                      <View style={[s.statusBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
                        <Ionicons name={meta.icon as any} size={11} color={meta.color} />
                        <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    {detailModal.nomeTurma && (
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Turma</Text>
                        <Text style={s.infoVal}>{detailModal.nomeTurma}{detailModal.classeAluno ? ` · ${detailModal.classeAluno}ª Classe` : ''}</Text>
                      </View>
                    )}
                    {detailModal.alunoNumMatricula && (
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Nº Matrícula</Text>
                        <Text style={s.infoVal}>{detailModal.alunoNumMatricula}</Text>
                      </View>
                    )}
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Data do Pedido</Text>
                      <Text style={s.infoVal}>{formatDate(detailModal.createdAt)}</Text>
                    </View>
                    {detailModal.motivo && (
                      <View style={s.infoBlock}>
                        <Text style={s.infoLabel}>Motivo</Text>
                        <Text style={s.infoBlockText}>{detailModal.motivo}</Text>
                      </View>
                    )}
                    {detailModal.observacao && (
                      <View style={s.infoBlock}>
                        <Text style={s.infoLabel}>Observação do Aluno</Text>
                        <Text style={s.infoBlockText}>{detailModal.observacao}</Text>
                      </View>
                    )}

                    <View style={s.divider} />
                    <Text style={s.fieldLabel}>Resposta / Nota Interna</Text>
                    <TextInput
                      style={s.textInput}
                      placeholder="Adicione uma nota de resposta ao aluno..."
                      placeholderTextColor={Colors.textMuted}
                      value={resposta}
                      onChangeText={setResposta}
                      multiline
                      numberOfLines={3}
                    />
                    <Text style={s.fieldLabel}>Referência de Pagamento (opcional)</Text>
                    <TextInput
                      style={s.textInput}
                      placeholder="Ex: ATM/REF/12345"
                      placeholderTextColor={Colors.textMuted}
                      value={refPagamento}
                      onChangeText={setRefPagamento}
                    />
                  </ScrollView>

                  {/* Acções */}
                  <View style={s.modalActions}>
                    {(detailModal.status === 'pendente' || detailModal.status === 'em_processamento') && (
                      <TouchableOpacity
                        style={s.btnGerarGrande}
                        onPress={() => gerarDocumento(detailModal)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="print" size={16} color="#fff" />
                        <Text style={s.btnGerarGrandeText}>Gerar & Imprimir Documento</Text>
                      </TouchableOpacity>
                    )}

                    <View style={s.actionsRow}>
                      {detailModal.status === 'pendente' && (
                        <TouchableOpacity
                          style={[s.actionBtn, { borderColor: Colors.info }]}
                          onPress={() => updateStatus(detailModal, 'em_processamento', { resposta, referenciaPagamento: refPagamento || undefined })}
                          disabled={saving}
                          activeOpacity={0.8}
                        >
                          {saving ? <ActivityIndicator size="small" color={Colors.info} /> : (
                            <Text style={[s.actionBtnText, { color: Colors.info }]}>Em Processamento</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {(detailModal.status === 'pendente' || detailModal.status === 'em_processamento') && (
                        <TouchableOpacity
                          style={[s.actionBtn, { borderColor: Colors.success, backgroundColor: Colors.success + '10' }]}
                          onPress={() => updateStatus(detailModal, 'concluido', { resposta, referenciaPagamento: refPagamento || undefined })}
                          disabled={saving}
                          activeOpacity={0.8}
                        >
                          {saving ? <ActivityIndicator size="small" color={Colors.success} /> : (
                            <Text style={[s.actionBtnText, { color: Colors.success }]}>Marcar Concluído</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {detailModal.status !== 'cancelado' && detailModal.status !== 'concluido' && (
                        <TouchableOpacity
                          style={[s.actionBtn, { borderColor: Colors.danger }]}
                          onPress={() => updateStatus(detailModal, 'cancelado', { resposta })}
                          disabled={saving}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.actionBtnText, { color: Colors.danger }]}>Cancelar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 2 },
  summaryNum: { fontSize: 22, fontWeight: '700' },
  summaryLbl: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  filtersRow: { marginTop: 10 },
  filtersContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surface,
  },
  filterChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  filterBadge: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  loadingText: { color: Colors.textMuted, fontSize: 14 },

  list: { flex: 1, marginTop: 10 },
  listContent: { paddingHorizontal: 16, gap: 8 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTipo: { fontSize: 13, fontWeight: '600', color: Colors.text },
  cardAluno: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  cardMotivo: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 17 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDate: { fontSize: 10, color: Colors.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnGerar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.gold, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  btnGerarText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', borderTopWidth: 3, borderTopColor: Colors.gold,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  modalSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingHorizontal: 20, paddingTop: 16, maxHeight: 420 },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  infoLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  infoVal: { fontSize: 13, color: Colors.text, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 8 },
  infoBlock: { marginBottom: 12 },
  infoBlockText: { fontSize: 13, color: Colors.text, marginTop: 4, lineHeight: 18, backgroundColor: Colors.background, borderRadius: 8, padding: 10 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  fieldLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  textInput: {
    backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    padding: 10, fontSize: 13, color: Colors.text, marginBottom: 14, minHeight: 44,
  },

  modalActions: { paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  btnGerarGrande: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 13,
  },
  btnGerarGrandeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 100, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
});
