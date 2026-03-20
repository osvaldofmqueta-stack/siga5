import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, FlatList, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useFinanceiro, formatAOA, Taxa, Pagamento, TipoTaxa, FrequenciaTaxa, MetodoPagamento, StatusPagamento } from '@/context/FinanceiroContext';
import { useData } from '@/context/DataContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';

const TIPO_TAXA_LABEL: Record<TipoTaxa, string> = {
  propina: 'Propina', matricula: 'Matrícula', material: 'Material Didáctico', exame: 'Exame', outro: 'Outro',
};
const TIPO_TAXA_ICON: Record<TipoTaxa, string> = {
  propina: 'cash', matricula: 'document-text', material: 'book', exame: 'newspaper', outro: 'ellipsis-horizontal',
};
const METODO_LABEL: Record<MetodoPagamento, string> = {
  dinheiro: 'Dinheiro', transferencia: 'Transferência', multicaixa: 'Multicaixa',
};
const STATUS_CONFIG = {
  pago: { color: Colors.success, bg: Colors.success + '22', label: 'Pago' },
  pendente: { color: Colors.warning, bg: Colors.warning + '22', label: 'Pendente' },
  cancelado: { color: Colors.textMuted, bg: Colors.border, label: 'Cancelado' },
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export default function FinanceiroScreen() {
  const { taxas, pagamentos, addPagamento, addTaxa, updatePagamento, getTotalRecebido, getTotalPendente } = useFinanceiro();
  const { alunos, turmas } = useData();
  const { anoSelecionado } = useAnoAcademico();
  const anoAtual = anoSelecionado?.ano || '2025';

  const [tab, setTab] = useState<'pagamentos' | 'taxas'>('pagamentos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusPagamento>('todos');
  const [showModalPag, setShowModalPag] = useState(false);
  const [showModalTaxa, setShowModalTaxa] = useState(false);
  const [showAlunoList, setShowAlunoList] = useState(false);
  const [showTaxaList, setShowTaxaList] = useState(false);

  const [formPag, setFormPag] = useState({
    alunoId: '', taxaId: '', valor: '', mes: '', metodoPagamento: 'multicaixa' as MetodoPagamento, referencia: '', observacao: '',
  });
  const [formTaxa, setFormTaxa] = useState({
    tipo: 'propina' as TipoTaxa, descricao: '', valor: '', frequencia: 'mensal' as FrequenciaTaxa, nivel: 'I Ciclo',
  });

  const pagamentosAno = pagamentos.filter(p => p.ano === anoAtual);
  const pagamentosFiltrados = pagamentosAno.filter(p => filtroStatus === 'todos' || p.status === filtroStatus);
  const taxasAno = taxas.filter(t => t.anoAcademico === anoAtual && t.ativo);

  const totalRecebido = getTotalRecebido(anoAtual);
  const totalPendente = getTotalPendente(anoAtual);
  const totalCobrado = totalRecebido + totalPendente;
  const percentPago = totalCobrado > 0 ? Math.round((totalRecebido / totalCobrado) * 100) : 0;

  function getNomeAluno(id: string) {
    const a = alunos.find(x => x.id === id);
    return a ? `${a.nome} ${a.apelido}` : '—';
  }
  function getTurmaAluno(id: string) {
    const a = alunos.find(x => x.id === id);
    if (!a) return '—';
    const t = turmas.find(x => x.id === a.turmaId);
    return t?.nome || '—';
  }
  function getNomeTaxa(id: string) {
    const t = taxas.find(x => x.id === id);
    return t?.descricao || '—';
  }
  function getTipoTaxa(id: string): TipoTaxa {
    return taxas.find(x => x.id === id)?.tipo || 'outro';
  }

  async function registarPagamento() {
    if (!formPag.alunoId || !formPag.taxaId) {
      Alert.alert('Erro', 'Selecione o aluno e a taxa.'); return;
    }
    const taxa = taxas.find(x => x.id === formPag.taxaId);
    await addPagamento({
      alunoId: formPag.alunoId,
      taxaId: formPag.taxaId,
      valor: parseFloat(formPag.valor) || (taxa?.valor ?? 0),
      data: new Date().toISOString().split('T')[0],
      mes: formPag.mes ? parseInt(formPag.mes) : undefined,
      ano: anoAtual,
      status: 'pago',
      metodoPagamento: formPag.metodoPagamento,
      referencia: formPag.referencia || undefined,
      observacao: formPag.observacao || undefined,
    });
    setShowModalPag(false);
    setFormPag({ alunoId: '', taxaId: '', valor: '', mes: '', metodoPagamento: 'multicaixa', referencia: '', observacao: '' });
  }

  async function adicionarTaxa() {
    if (!formTaxa.descricao || !formTaxa.valor) {
      Alert.alert('Erro', 'Preencha a descrição e o valor.'); return;
    }
    await addTaxa({
      tipo: formTaxa.tipo,
      descricao: formTaxa.descricao,
      valor: parseFloat(formTaxa.valor) || 0,
      frequencia: formTaxa.frequencia,
      nivel: formTaxa.nivel,
      anoAcademico: anoAtual,
      ativo: true,
    });
    setShowModalTaxa(false);
    setFormTaxa({ tipo: 'propina', descricao: '', valor: '', frequencia: 'mensal', nivel: 'I Ciclo' });
  }

  return (
    <View style={styles.container}>
      <TopBar title="Financeiro" subtitle={`Ano Lectivo ${anoAtual}`} />

      <View style={styles.tabs}>
        {(['pagamentos', 'taxas'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'pagamentos' ? 'Pagamentos' : 'Taxas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'pagamentos' && (
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Cobrado</Text>
                <Text style={[styles.statValue, { color: Colors.text }]}>{formatAOA(totalCobrado)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Recebido</Text>
                <Text style={[styles.statValue, { color: Colors.success }]}>{formatAOA(totalRecebido)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pendente</Text>
                <Text style={[styles.statValue, { color: Colors.warning }]}>{formatAOA(totalPendente)}</Text>
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Taxa de Pagamento</Text>
                <Text style={[styles.progressPct, { color: percentPago >= 70 ? Colors.success : Colors.warning }]}>{percentPago}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${percentPago}%` as any, backgroundColor: percentPago >= 70 ? Colors.success : Colors.warning }]} />
              </View>
              <Text style={styles.progressInfo}>{pagamentosAno.filter(p => p.status === 'pago').length} de {pagamentosAno.length} pagamentos efectuados</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtroScroll}>
              <View style={styles.filtroRow}>
                {([['todos', 'Todos'], ['pago', 'Pagos'], ['pendente', 'Pendentes']] as const).map(([k, l]) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.filtroBtn, filtroStatus === k && styles.filtroBtnActive]}
                    onPress={() => setFiltroStatus(k as any)}
                  >
                    <Text style={[styles.filtroText, filtroStatus === k && styles.filtroTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {pagamentosFiltrados.length === 0 ? (
              <View style={styles.empty}>
                <FontAwesome5 name="money-bill-wave" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Sem pagamentos</Text>
              </View>
            ) : (
              pagamentosFiltrados.map(pag => {
                const sc = STATUS_CONFIG[pag.status];
                const tipo = getTipoTaxa(pag.taxaId);
                return (
                  <View key={pag.id} style={styles.pagItem}>
                    <View style={[styles.pagTypeIcon, { backgroundColor: Colors.primaryLight }]}>
                      <Ionicons name={TIPO_TAXA_ICON[tipo] as any} size={18} color={Colors.gold} />
                    </View>
                    <View style={styles.pagInfo}>
                      <Text style={styles.pagNome}>{getNomeAluno(pag.alunoId)}</Text>
                      <Text style={styles.pagTaxa}>{getNomeTaxa(pag.taxaId)}</Text>
                      <View style={styles.pagMeta}>
                        <Text style={styles.pagData}>{pag.data}</Text>
                        <Text style={styles.pagMetodo}>{METODO_LABEL[pag.metodoPagamento]}</Text>
                        <Text style={styles.pagTurma}>{getTurmaAluno(pag.alunoId)}</Text>
                      </View>
                    </View>
                    <View style={styles.pagRight}>
                      <Text style={styles.pagValor}>{formatAOA(pag.valor)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                      {pag.status === 'pendente' && (
                        <TouchableOpacity
                          style={styles.confirmarBtn}
                          onPress={() => updatePagamento(pag.id, { status: 'pago' })}
                        >
                          <Ionicons name="checkmark" size={12} color="#fff" />
                          <Text style={styles.confirmarText}>Confirmar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>

          <TouchableOpacity style={styles.fab} onPress={() => setShowModalPag(true)}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.fabText}>Registar Pagamento</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'taxas' && (
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Taxas Activas — {anoAtual}</Text>
            {taxasAno.map(t => (
              <View key={t.id} style={styles.taxaItem}>
                <View style={[styles.taxaIcon, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name={TIPO_TAXA_ICON[t.tipo] as any} size={18} color={Colors.gold} />
                </View>
                <View style={styles.taxaInfo}>
                  <Text style={styles.taxaNome}>{t.descricao}</Text>
                  <Text style={styles.taxaNivel}>{t.nivel} — {t.frequencia}</Text>
                </View>
                <Text style={[styles.taxaValor, { color: Colors.gold }]}>{formatAOA(t.valor)}</Text>
              </View>
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>
          <TouchableOpacity style={styles.fab} onPress={() => setShowModalTaxa(true)}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.fabText}>Nova Taxa</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Pagamento */}
      <Modal visible={showModalPag} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registar Pagamento</Text>
              <TouchableOpacity onPress={() => setShowModalPag(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Aluno *</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setShowAlunoList(v => !v)}>
                <Text style={formPag.alunoId ? styles.selectorVal : styles.selectorPlaceholder}>
                  {formPag.alunoId ? getNomeAluno(formPag.alunoId) : 'Selecionar aluno...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showAlunoList && (
                <View style={styles.dropdownList}>
                  {alunos.filter(a => a.ativo).map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.dropdownItem, formPag.alunoId === a.id && styles.dropdownActive]}
                      onPress={() => { setFormPag(f => ({ ...f, alunoId: a.id })); setShowAlunoList(false); }}
                    >
                      <Text style={[styles.dropdownText, formPag.alunoId === a.id && styles.dropdownTextActive]}>{a.nome} {a.apelido}</Text>
                      <Text style={styles.dropdownSub}>{turmas.find(t => t.id === a.turmaId)?.nome || ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Taxa *</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setShowTaxaList(v => !v)}>
                <Text style={formPag.taxaId ? styles.selectorVal : styles.selectorPlaceholder}>
                  {formPag.taxaId ? getNomeTaxa(formPag.taxaId) : 'Selecionar taxa...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showTaxaList && (
                <View style={styles.dropdownList}>
                  {taxas.filter(t => t.ativo).map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.dropdownItem, formPag.taxaId === t.id && styles.dropdownActive]}
                      onPress={() => {
                        setFormPag(f => ({ ...f, taxaId: t.id, valor: t.valor.toString() }));
                        setShowTaxaList(false);
                      }}
                    >
                      <Text style={[styles.dropdownText, formPag.taxaId === t.id && styles.dropdownTextActive]}>{t.descricao}</Text>
                      <Text style={styles.dropdownSub}>{formatAOA(t.valor)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Valor (AOA)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 5000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={formPag.valor}
                onChangeText={v => setFormPag(f => ({ ...f, valor: v }))}
              />

              <Text style={styles.fieldLabel}>Método de Pagamento</Text>
              <View style={styles.metodosRow}>
                {(['dinheiro', 'transferencia', 'multicaixa'] as MetodoPagamento[]).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.metodoBtn, formPag.metodoPagamento === m && styles.metodoBtnActive]}
                    onPress={() => setFormPag(f => ({ ...f, metodoPagamento: m }))}
                  >
                    <Text style={[styles.metodoText, formPag.metodoPagamento === m && styles.metodoTextActive]}>{METODO_LABEL[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Mês de referência</Text>
              <View style={styles.mesesRow}>
                {MESES.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.mesBtn, formPag.mes === String(i + 1) && styles.mesBtnActive]}
                    onPress={() => setFormPag(f => ({ ...f, mes: String(i + 1) }))}
                  >
                    <Text style={[styles.mesText, formPag.mes === String(i + 1) && styles.mesTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Referência (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: MCX-001"
                placeholderTextColor={Colors.textMuted}
                value={formPag.referencia}
                onChangeText={v => setFormPag(f => ({ ...f, referencia: v }))}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={registarPagamento}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Registar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Taxa */}
      <Modal visible={showModalTaxa} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Taxa</Text>
              <TouchableOpacity onPress={() => setShowModalTaxa(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={styles.tiposRow}>
                {(Object.keys(TIPO_TAXA_LABEL) as TipoTaxa[]).map(tipo => (
                  <TouchableOpacity
                    key={tipo}
                    style={[styles.tipoBtn, formTaxa.tipo === tipo && styles.tipoBtnActive]}
                    onPress={() => setFormTaxa(f => ({ ...f, tipo }))}
                  >
                    <Text style={[styles.tipoText, formTaxa.tipo === tipo && styles.tipoTextActive]}>{TIPO_TAXA_LABEL[tipo]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Descrição *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Propina Mensal - I Ciclo"
                placeholderTextColor={Colors.textMuted}
                value={formTaxa.descricao}
                onChangeText={v => setFormTaxa(f => ({ ...f, descricao: v }))}
              />

              <Text style={styles.fieldLabel}>Valor (AOA) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 5000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={formTaxa.valor}
                onChangeText={v => setFormTaxa(f => ({ ...f, valor: v }))}
              />

              <Text style={styles.fieldLabel}>Frequência</Text>
              <View style={styles.metodosRow}>
                {(['mensal', 'anual', 'unica'] as FrequenciaTaxa[]).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.metodoBtn, formTaxa.frequencia === f && styles.metodoBtnActive]}
                    onPress={() => setFormTaxa(x => ({ ...x, frequencia: f }))}
                  >
                    <Text style={[styles.metodoText, formTaxa.frequencia === f && styles.metodoTextActive]}>
                      {f === 'mensal' ? 'Mensal' : f === 'anual' ? 'Anual' : 'Única'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={adicionarTaxa}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Adicionar Taxa</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabs: { flexDirection: 'row', backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.gold },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  tabTextActive: { color: Colors.gold },
  statsRow: { flexDirection: 'row', padding: 16, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, alignItems: 'center' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginBottom: 4 },
  statValue: { fontSize: 13, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  progressCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  progressPct: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, marginBottom: 6 },
  progressFill: { height: 8, borderRadius: 4 },
  progressInfo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  filtroScroll: { maxHeight: 48, marginBottom: 4 },
  filtroRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6, gap: 8, alignItems: 'center' },
  filtroBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  filtroBtnActive: { backgroundColor: Colors.accent },
  filtroText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filtroTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  pagItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.backgroundCard, borderRadius: 14, gap: 12 },
  pagTypeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pagInfo: { flex: 1 },
  pagNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  pagTaxa: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 4 },
  pagMeta: { flexDirection: 'row', gap: 8 },
  pagData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  pagMetodo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.info },
  pagTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  pagRight: { alignItems: 'flex-end', gap: 6 },
  pagValor: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.gold },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  confirmarBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  confirmarText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  taxaItem: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.backgroundCard, borderRadius: 14, gap: 12 },
  taxaIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  taxaInfo: { flex: 1 },
  taxaNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  taxaNivel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  taxaValor: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  fab: { position: 'absolute', bottom: 24, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  fabText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: Colors.textMuted, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  selector: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border },
  selectorVal: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  selectorPlaceholder: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  dropdownList: { backgroundColor: Colors.surface, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border, maxHeight: 180 },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownActive: { backgroundColor: 'rgba(240,165,0,0.1)' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  dropdownTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  dropdownSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  metodosRow: { flexDirection: 'row', gap: 8 },
  metodoBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  metodoBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  metodoText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  metodoTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  mesesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mesBtn: { width: '22%', paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  mesBtnActive: { backgroundColor: 'rgba(240,165,0,0.15)', borderColor: Colors.gold },
  mesText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  mesTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  tiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tipoBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tipoBtnActive: { backgroundColor: 'rgba(240,165,0,0.15)', borderColor: Colors.gold },
  tipoText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tipoTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 8 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
