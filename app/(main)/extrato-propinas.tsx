import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, FlatList, Platform, Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import TopBar from '@/components/TopBar';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface AlunoInfo {
  id: string;
  nome: string;
  apelido: string;
  numeroMatricula: string;
  turmaNome: string | null;
  cursoNome: string | null;
  nomeEncarregado: string;
}

interface PagamentoExtrato {
  id: string;
  data: string;
  valor: number;
  status: 'pago' | 'pendente' | 'cancelado';
  metodoPagamento: string;
  referencia: string | null;
  observacao: string | null;
  taxaDescricao: string;
  taxaTipo: string;
  mes: number | null;
  trimestre: number | null;
  ano: string;
}

interface Resumo {
  totalPago: number;
  totalPendente: number;
  totalCancelado: number;
  total: number;
}

interface Extrato {
  aluno: AlunoInfo;
  pagamentos: PagamentoExtrato[];
  resumo: Resumo;
  filtros: { dataInicio: string | null; dataFim: string | null };
}

interface AlunoSimple {
  id: string;
  nome: string;
  apelido: string;
  numeroMatricula: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function req<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    credentials: 'include',
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || 'Erro de servidor');
    return data as T;
  });
}

function fmtAOA(v: number) {
  return `${v.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}

function fmtDate(d: string) {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function mesLabel(mes: number | null) {
  if (!mes) return '';
  return MESES[(mes - 1) % 12] || '';
}

const STATUS_CFG = {
  pago:      { color: '#66BB6A', bg: '#66BB6A22', label: 'Pago',      icon: 'checkmark-circle' },
  pendente:  { color: '#FFA726', bg: '#FFA72622', label: 'Pendente',  icon: 'time' },
  cancelado: { color: '#888',    bg: '#88888822', label: 'Cancelado', icon: 'close-circle' },
};

const TIPO_LABEL: Record<string, string> = {
  propina: 'Propina', matricula: 'Matrícula', material: 'Material', exame: 'Exame', multa: 'Multa', outro: 'Outro',
};

const METODO_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', transferencia: 'Transferência', multicaixa: 'Multicaixa',
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ExtratoPropinas() {
  const [alunoSearch, setAlunoSearch] = useState('');
  const [allAlunos, setAllAlunos] = useState<AlunoSimple[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [alunosFetched, setAlunosFetched] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<AlunoSimple | null>(null);
  const [showAlunoDropdown, setShowAlunoDropdown] = useState(false);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [loading, setLoading] = useState(false);
  const [extrato, setExtrato] = useState<Extrato | null>(null);

  const [showPreview, setShowPreview] = useState(false);

  const { addToast } = useToast();
  const { user } = useAuth();

  const fetchAlunos = async () => {
    if (alunosFetched) return;
    setLoadingAlunos(true);
    try {
      const rows = await req<AlunoSimple[]>('/api/alunos');
      setAllAlunos(rows);
      setAlunosFetched(true);
    } catch (e) {
      addToast({ type: 'error', message: (e as Error).message });
    } finally {
      setLoadingAlunos(false);
    }
  };

  const filteredAlunos = allAlunos.filter(a => {
    const q = alunoSearch.toLowerCase();
    return !q || `${a.nome} ${a.apelido}`.toLowerCase().includes(q) || a.numeroMatricula.toLowerCase().includes(q);
  }).slice(0, 20);

  const handleSelectAluno = (a: AlunoSimple) => {
    setSelectedAluno(a);
    setAlunoSearch(`${a.nome} ${a.apelido} — Nº ${a.numeroMatricula}`);
    setShowAlunoDropdown(false);
    setExtrato(null);
  };

  const gerarExtrato = async () => {
    if (!selectedAluno) {
      addToast({ type: 'error', message: 'Seleccione um aluno primeiro.' });
      return;
    }
    setLoading(true);
    setExtrato(null);
    try {
      const params = new URLSearchParams({ alunoId: selectedAluno.id });
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);
      const data = await req<Extrato>(`/api/extrato-propinas?${params}`);
      setExtrato(data);
      if (data.pagamentos.length === 0) {
        addToast({ type: 'info', message: 'Nenhum pagamento encontrado para o período seleccionado.' });
      }
    } catch (e) {
      addToast({ type: 'error', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setSelectedAluno(null);
    setAlunoSearch('');
    setDataInicio('');
    setDataFim('');
    setExtrato(null);
    setAlunosFetched(false);
    setAllAlunos([]);
  };

  return (
    <View style={styles.root}>
      <TopBar title="Extrato de Pagamentos" subtitle="Propinas e taxas por aluno" />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* ── Painel de Pesquisa ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="file-invoice-dollar" size={16} color="#5E6AD2" />
            <Text style={styles.cardTitle}>Gerar Extracto</Text>
          </View>

          {/* Aluno */}
          <Text style={styles.label}>Aluno / Estudante *</Text>
          <TouchableOpacity
            style={styles.alunoPickerBtn}
            onPress={() => {
              fetchAlunos();
              setShowAlunoDropdown(true);
            }}
          >
            <Ionicons name="person-outline" size={16} color="#888" />
            <Text style={[styles.alunoPickerText, selectedAluno && { color: '#fff' }]} numberOfLines={1}>
              {selectedAluno ? `${selectedAluno.nome} ${selectedAluno.apelido} — Nº ${selectedAluno.numeroMatricula}` : 'Seleccionar aluno…'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#888" />
          </TouchableOpacity>

          {/* Date range */}
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>Data Início</Text>
              <TextInput
                style={styles.dateInput}
                value={dataInicio}
                onChangeText={setDataInicio}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#555"
                maxLength={10}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.label}>Data Fim</Text>
              <TextInput
                style={styles.dateInput}
                value={dataFim}
                onChangeText={setDataFim}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#555"
                maxLength={10}
              />
            </View>
          </View>

          <Text style={styles.dateTip}>
            <Ionicons name="information-circle-outline" size={13} color="#555" /> Deixe as datas em branco para mostrar todos os pagamentos.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnClear} onPress={limpar}>
              <Ionicons name="refresh-outline" size={16} color="#aaa" />
              <Text style={styles.btnClearText}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGerar} onPress={gerarExtrato} disabled={loading || !selectedAluno}>
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="document-text-outline" size={16} color="#fff" />
                    <Text style={styles.btnGerarText}>Gerar Extracto</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Extrato ── */}
        {extrato && (
          <View style={styles.extratoContainer}>

            {/* Cabeçalho tipo extracto bancário */}
            <View style={styles.extratoHeader}>
              <View style={styles.extratoHeaderTop}>
                <View style={styles.logoBox}>
                  <MaterialCommunityIcons name="school" size={24} color="#5E6AD2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.extratoTitle}>EXTRACTO DE PAGAMENTOS</Text>
                  <Text style={styles.extratoSubtitle}>Sistema Integral de Gestão Escolar</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.alunoInfoGrid}>
                <InfoRow label="Nome Completo" value={`${extrato.aluno.nome} ${extrato.aluno.apelido}`} />
                <InfoRow label="Nº Matrícula" value={extrato.aluno.numeroMatricula} />
                {extrato.aluno.turmaNome && <InfoRow label="Turma" value={extrato.aluno.turmaNome} />}
                {extrato.aluno.cursoNome && <InfoRow label="Curso" value={extrato.aluno.cursoNome} />}
                <InfoRow label="Encarregado" value={extrato.aluno.nomeEncarregado} />
                {extrato.filtros.dataInicio && (
                  <InfoRow label="Período" value={`${fmtDate(extrato.filtros.dataInicio || '')} — ${fmtDate(extrato.filtros.dataFim || 'Presente')}`} />
                )}
                <InfoRow label="Data de Emissão" value={fmtDate(new Date().toISOString().slice(0, 10))} />
              </View>
            </View>

            {/* Resumo / Totais */}
            <View style={styles.resumoRow}>
              <ResumoCard label="Total Pago" value={extrato.resumo.totalPago} color="#66BB6A" icon="checkmark-circle" />
              <ResumoCard label="Pendente" value={extrato.resumo.totalPendente} color="#FFA726" icon="time" />
              <ResumoCard label="Cancelado" value={extrato.resumo.totalCancelado} color="#888" icon="close-circle" />
            </View>

            <View style={styles.totalGeralBox}>
              <Text style={styles.totalGeralLabel}>Total de Transacções: {extrato.resumo.total}</Text>
              <Text style={styles.totalGeralValue}>{fmtAOA(extrato.resumo.totalPago + extrato.resumo.totalPendente)}</Text>
            </View>

            {/* Tabela de movimentos */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, { flex: 1.4 }]}>Data</Text>
              <Text style={[styles.thCell, { flex: 2.5 }]}>Descrição</Text>
              <Text style={[styles.thCell, { flex: 1.2 }]}>Método</Text>
              <Text style={[styles.thCell, { flex: 1.4, textAlign: 'right' }]}>Valor</Text>
              <Text style={[styles.thCell, { flex: 1.1, textAlign: 'center' }]}>Estado</Text>
            </View>

            {extrato.pagamentos.length === 0 ? (
              <View style={styles.emptyExtrato}>
                <Ionicons name="document-outline" size={40} color="#444" />
                <Text style={styles.emptyExtratoText}>Nenhum pagamento no período seleccionado</Text>
              </View>
            ) : (
              extrato.pagamentos.map((p, idx) => {
                const cfg = STATUS_CFG[p.status] || STATUS_CFG.pendente;
                const descricao = [
                  p.taxaDescricao || TIPO_LABEL[p.taxaTipo] || p.taxaTipo,
                  p.mes ? mesLabel(p.mes) : '',
                  p.ano,
                ].filter(Boolean).join(' · ');

                return (
                  <View key={p.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                    <Text style={[styles.tdCell, { flex: 1.4, color: '#ccc' }]}>{fmtDate(p.data)}</Text>
                    <View style={{ flex: 2.5 }}>
                      <Text style={[styles.tdCell, { color: '#fff' }]} numberOfLines={1}>{descricao}</Text>
                      {p.referencia ? <Text style={styles.tdRef} numberOfLines={1}>Ref: {p.referencia}</Text> : null}
                      {p.observacao ? <Text style={styles.tdRef} numberOfLines={1}>{p.observacao}</Text> : null}
                    </View>
                    <Text style={[styles.tdCell, { flex: 1.2, color: '#aaa' }]} numberOfLines={1}>
                      {METODO_LABEL[p.metodoPagamento] || p.metodoPagamento}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 1.4, textAlign: 'right', color: p.status === 'pago' ? '#66BB6A' : p.status === 'pendente' ? '#FFA726' : '#888', fontFamily: 'Inter_600SemiBold' }]}>
                      {fmtAOA(p.valor)}
                    </Text>
                    <View style={{ flex: 1.1, alignItems: 'center' }}>
                      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {/* Rodapé */}
            <View style={styles.extratoFooter}>
              <View style={styles.divider} />
              <View style={styles.footerTotals}>
                <View style={styles.footerTotalRow}>
                  <Text style={styles.footerTotalLabel}>Total Pago</Text>
                  <Text style={[styles.footerTotalValue, { color: '#66BB6A' }]}>{fmtAOA(extrato.resumo.totalPago)}</Text>
                </View>
                {extrato.resumo.totalPendente > 0 && (
                  <View style={styles.footerTotalRow}>
                    <Text style={styles.footerTotalLabel}>Total Pendente</Text>
                    <Text style={[styles.footerTotalValue, { color: '#FFA726' }]}>{fmtAOA(extrato.resumo.totalPendente)}</Text>
                  </View>
                )}
                <View style={[styles.footerTotalRow, styles.footerGrandTotal]}>
                  <Text style={styles.footerGrandLabel}>TOTAL GERAL</Text>
                  <Text style={styles.footerGrandValue}>{fmtAOA(extrato.resumo.totalPago + extrato.resumo.totalPendente)}</Text>
                </View>
              </View>
              <Text style={styles.footerNote}>
                Documento gerado em {new Date().toLocaleString('pt-PT')} por {user?.nome || user?.email}{'\n'}
                Este extracto é meramente informativo e não substitui recibo oficial.
              </Text>
            </View>

            {/* Botão imprimir (web only) */}
            {Platform.OS === 'web' && (
              <TouchableOpacity style={styles.btnPrint} onPress={() => window.print()}>
                <Ionicons name="print-outline" size={18} color="#fff" />
                <Text style={styles.btnPrintText}>Imprimir Extracto</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      </ScrollView>

      {/* ── Modal de selecção de aluno ── */}
      <Modal visible={showAlunoDropdown} transparent animationType="fade" onRequestClose={() => setShowAlunoDropdown(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAlunoDropdown(false)}>
          <View style={styles.alunoModal} onStartShouldSetResponder={() => true}>
            <View style={styles.alunoModalHeader}>
              <Text style={styles.alunoModalTitle}>Seleccionar Aluno</Text>
              <TouchableOpacity onPress={() => setShowAlunoDropdown(false)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.alunoSearchBox}>
              <Ionicons name="search" size={16} color="#888" />
              <TextInput
                style={styles.alunoSearchInput}
                placeholder="Nome ou número de matrícula…"
                placeholderTextColor="#666"
                value={alunoSearch.includes('—') ? '' : alunoSearch}
                onChangeText={v => { setAlunoSearch(v); setSelectedAluno(null); }}
                autoFocus
              />
            </View>
            {loadingAlunos ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator color="#5E6AD2" />
              </View>
            ) : (
              <FlatList
                data={filteredAlunos}
                keyExtractor={i => i.id}
                style={{ maxHeight: 360 }}
                ListEmptyComponent={
                  <View style={styles.modalCenter}>
                    <Text style={{ color: '#888', fontSize: 14 }}>Nenhum aluno encontrado</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.alunoItem} onPress={() => handleSelectAluno(item)}>
                    <View style={styles.alunoItemIcon}>
                      <Ionicons name="person" size={18} color="#5E6AD2" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alunoItemName}>{item.nome} {item.apelido}</Text>
                      <Text style={styles.alunoItemNum}>Nº {item.numeroMatricula}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#555" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ResumoCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[styles.resumoCard, { borderColor: color + '44' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.resumoValue, { color }]}>{value.toLocaleString('pt-AO', { minimumFractionDigits: 0 })} Kz</Text>
      <Text style={styles.resumoLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1B3E' },
  container: { padding: 16, paddingBottom: 60, gap: 16 },

  card: { backgroundColor: '#111f3d', borderRadius: 14, borderWidth: 1, borderColor: '#1e3055', padding: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },

  label: { color: '#aaa', fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  alunoPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2a4a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, gap: 10, marginBottom: 14, borderWidth: 1, borderColor: '#253a5e' },
  alunoPickerText: { flex: 1, color: '#666', fontSize: 14, fontFamily: 'Inter_400Regular' },

  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dateField: { flex: 1 },
  dateInput: { backgroundColor: '#1a2a4a', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: '#253a5e' },
  dateTip: { color: '#555', fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 16 },

  btnRow: { flexDirection: 'row', gap: 10 },
  btnClear: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a2a4a', borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#253a5e' },
  btnClearText: { color: '#aaa', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  btnGerar: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5E6AD2', borderRadius: 10, paddingVertical: 12 },
  btnGerarText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Extrato
  extratoContainer: { gap: 0 },
  extratoHeader: { backgroundColor: '#0a1828', borderRadius: 14, borderWidth: 1, borderColor: '#1e3055', padding: 18, marginBottom: 12 },
  extratoHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  logoBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#5E6AD222', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5E6AD244' },
  extratoTitle: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  extratoSubtitle: { color: '#888', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#1e3055', marginVertical: 14 },
  alunoInfoGrid: { gap: 8 },
  infoRow: { flexDirection: 'row', gap: 8 },
  infoLabel: { color: '#666', fontSize: 13, fontFamily: 'Inter_500Medium', width: 120 },
  infoValue: { color: '#ddd', fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },

  resumoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  resumoCard: { flex: 1, backgroundColor: '#0a1828', borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  resumoValue: { fontSize: 13, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  resumoLabel: { color: '#888', fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  totalGeralBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a1828', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: '#1e3055' },
  totalGeralLabel: { color: '#888', fontSize: 13, fontFamily: 'Inter_500Medium' },
  totalGeralValue: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },

  tableHeader: { flexDirection: 'row', backgroundColor: '#0a1828', paddingHorizontal: 12, paddingVertical: 8, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1, borderColor: '#1e3055' },
  thCell: { color: '#666', fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f1e38', alignItems: 'center' },
  tableRowAlt: { backgroundColor: '#0a1525' },
  tdCell: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  tdRef: { color: '#555', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  emptyExtrato: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10, backgroundColor: '#0a1525', borderRadius: 10, borderWidth: 1, borderColor: '#1e3055' },
  emptyExtratoText: { color: '#666', fontSize: 14, fontFamily: 'Inter_400Regular' },

  extratoFooter: { backgroundColor: '#0a1828', borderRadius: 14, borderWidth: 1, borderColor: '#1e3055', padding: 18, marginTop: 8 },
  footerTotals: { gap: 8 },
  footerTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerTotalLabel: { color: '#888', fontSize: 13, fontFamily: 'Inter_400Regular' },
  footerTotalValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  footerGrandTotal: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1e3055', marginTop: 4 },
  footerGrandLabel: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  footerGrandValue: { color: '#5E6AD2', fontSize: 16, fontFamily: 'Inter_700Bold' },
  footerNote: { color: '#444', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 14, lineHeight: 16, textAlign: 'center' },

  btnPrint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#26A69A', borderRadius: 10, paddingVertical: 13, marginTop: 12 },
  btnPrintText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Aluno modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alunoModal: { backgroundColor: '#0e1e3d', borderRadius: 18, width: '100%', maxWidth: 480, overflow: 'hidden' },
  alunoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: '#0a1830' },
  alunoModalTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  alunoSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2a4a', marginHorizontal: 16, marginVertical: 12, borderRadius: 10, paddingHorizontal: 12, gap: 8, height: 42 },
  alunoSearchInput: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular' },
  alunoItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#1a2a4a', gap: 12 },
  alunoItemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#5E6AD222', alignItems: 'center', justifyContent: 'center' },
  alunoItemName: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  alunoItemNum: { color: '#888', fontSize: 12, fontFamily: 'Inter_400Regular' },
  modalCenter: { paddingVertical: 30, alignItems: 'center' },
});
