import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, FlatList, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import {
  useFinanceiro, formatAOA,
  Taxa, Pagamento, TipoTaxa, FrequenciaTaxa, MetodoPagamento, StatusPagamento,
} from '@/context/FinanceiroContext';
import { useData } from '@/context/DataContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';

const TIPO_LABEL: Record<TipoTaxa, string> = {
  propina: 'Propina', matricula: 'Matrícula', material: 'Material Didáctico', exame: 'Exame', outro: 'Outro',
};
const TIPO_ICON: Record<TipoTaxa, string> = {
  propina: 'cash', matricula: 'document-text', material: 'book', exame: 'newspaper', outro: 'ellipsis-horizontal',
};
const TIPO_COLOR: Record<TipoTaxa, string> = {
  propina: Colors.info, matricula: Colors.gold, material: Colors.success, exame: Colors.warning, outro: Colors.textMuted,
};
const METODO_LABEL: Record<MetodoPagamento, string> = {
  dinheiro: 'Dinheiro', transferencia: 'RUPE/Transfer.', multicaixa: 'Multicaixa',
};
const STATUS_CFG = {
  pago:     { color: Colors.success, bg: Colors.success + '22', label: 'Pago',      icon: 'checkmark-circle' },
  pendente: { color: Colors.warning, bg: Colors.warning + '22', label: 'Pendente',  icon: 'time' },
  cancelado:{ color: Colors.textMuted, bg: Colors.border,       label: 'Cancelado', icon: 'close-circle' },
};
const NIVEIS = ['Todos', 'Primário', 'I Ciclo', 'II Ciclo'];
const MESES  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TIPOS: TipoTaxa[] = ['propina','matricula','material','exame','outro'];
const FREQS: { k: FrequenciaTaxa; l: string }[] = [
  { k: 'mensal', l: 'Mensal' }, { k: 'trimestral', l: 'Trimestral' },
  { k: 'anual', l: 'Anual' }, { k: 'unica', l: 'Única' },
];
const TABS_MAIN = ['resumo','pagamentos','rubricas','por_aluno'] as const;
type TabKey = typeof TABS_MAIN[number];

function genId() { return Date.now().toString() + Math.random().toString(36).substr(2, 9); }

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + '55' }}>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color }}>{label}</Text>
    </View>
  );
}

export default function FinanceiroScreen() {
  const {
    taxas, pagamentos, isLoading,
    addTaxa, updateTaxa, deleteTaxa,
    addPagamento, updatePagamento,
    getTotalRecebido, getTotalPendente,
  } = useFinanceiro();
  const { alunos, turmas } = useData();
  const { anoSelecionado } = useAnoAcademico();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 24 : insets.bottom;

  const anoAtual = anoSelecionado?.ano || new Date().getFullYear().toString();

  const [tab, setTab]         = useState<TabKey>('resumo');
  const [statusFilter, setStatusFilter] = useState<'todos' | StatusPagamento>('todos');
  const [tipoFilter, setTipoFilter]     = useState<'todos' | TipoTaxa>('todos');
  const [searchAluno, setSearchAluno]   = useState('');
  const [searchPagAluno, setSearchPagAluno] = useState('');
  const [alunoPerfilId, setAlunoPerfilId]   = useState<string | null>(null);

  const [showModalPag,   setShowModalPag]   = useState(false);
  const [showModalTaxa,  setShowModalTaxa]  = useState(false);
  const [editTaxa,       setEditTaxa]       = useState<Taxa | null>(null);
  const [showAlunoList,  setShowAlunoList]  = useState(false);
  const [showTaxaList,   setShowTaxaList]   = useState(false);

  const defaultFormPag = { alunoId: '', taxaId: '', valor: '', mes: '', metodoPagamento: 'multicaixa' as MetodoPagamento, referencia: '', observacao: '' };
  const defaultFormTaxa = { tipo: 'propina' as TipoTaxa, descricao: '', valor: '', frequencia: 'mensal' as FrequenciaTaxa, nivel: 'Todos' };
  const [formPag,  setFormPag]  = useState(defaultFormPag);
  const [formTaxa, setFormTaxa] = useState(defaultFormTaxa);

  const pagamentosAno = useMemo(() => pagamentos.filter(p => p.ano === anoAtual), [pagamentos, anoAtual]);
  const taxasAno      = useMemo(() => taxas.filter(t => t.anoAcademico === anoAtual), [taxas, anoAtual]);
  const taxasAtivas   = useMemo(() => taxasAno.filter(t => t.ativo), [taxasAno]);

  const totalRecebido = getTotalRecebido(anoAtual);
  const totalPendente = getTotalPendente(anoAtual);
  const totalCobrado  = totalRecebido + totalPendente;
  const percentPago   = totalCobrado > 0 ? Math.round((totalRecebido / totalCobrado) * 100) : 0;
  const nTransacoes   = pagamentosAno.length;
  const nAlunos       = new Set(pagamentosAno.map(p => p.alunoId)).size;

  const pagamentosFiltrados = useMemo(() => {
    let list = pagamentosAno;
    if (statusFilter !== 'todos') list = list.filter(p => p.status === statusFilter);
    if (tipoFilter  !== 'todos') list = list.filter(p => {
      const t = taxas.find(x => x.id === p.taxaId);
      return t?.tipo === tipoFilter;
    });
    if (searchPagAluno.trim()) {
      const q = searchPagAluno.toLowerCase();
      list = list.filter(p => {
        const a = alunos.find(x => x.id === p.alunoId);
        return a ? `${a.nome} ${a.apelido} ${a.numeroMatricula}`.toLowerCase().includes(q) : false;
      });
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pagamentosAno, statusFilter, tipoFilter, searchPagAluno, taxas, alunos]);

  const alunosFiltrados = useMemo(() => {
    const q = searchAluno.toLowerCase();
    return alunos.filter(a => a.ativo && `${a.nome} ${a.apelido} ${a.numeroMatricula}`.toLowerCase().includes(q));
  }, [alunos, searchAluno]);

  const resumoPorTipo = useMemo(() => {
    return TIPOS.map(tipo => {
      const taxasTipo = taxasAtivas.filter(t => t.tipo === tipo);
      const taxaIds   = new Set(taxasTipo.map(t => t.id));
      const pags      = pagamentosAno.filter(p => taxaIds.has(p.taxaId));
      const recebido  = pags.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
      const pendente  = pags.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
      return { tipo, recebido, pendente, count: pags.filter(p => p.status === 'pago').length };
    }).filter(r => r.recebido > 0 || r.pendente > 0);
  }, [taxasAtivas, pagamentosAno]);

  const resumoPorMes = useMemo(() => {
    const mapa: Record<number, number> = {};
    pagamentosAno.filter(p => p.status === 'pago').forEach(p => {
      const m = new Date(p.data).getMonth();
      mapa[m] = (mapa[m] || 0) + p.valor;
    });
    return mapa;
  }, [pagamentosAno]);

  function getNomeAluno(id: string) {
    const a = alunos.find(x => x.id === id);
    return a ? `${a.nome} ${a.apelido}` : '—';
  }
  function getTurmaAluno(id: string) {
    const a = alunos.find(x => x.id === id);
    if (!a) return '—';
    return turmas.find(x => x.id === a.turmaId)?.nome || '—';
  }
  function getMatriculaAluno(id: string) {
    return alunos.find(x => x.id === id)?.numeroMatricula || '';
  }
  function getNomeTaxa(id: string) {
    if (id === 'cartao_estudante_anual') return 'Cartão de Estudante Virtual';
    return taxas.find(x => x.id === id)?.descricao || 'Rubrica';
  }
  function getTipoTaxa(id: string): TipoTaxa {
    return taxas.find(x => x.id === id)?.tipo || 'outro';
  }

  async function registarPagamento() {
    if (!formPag.alunoId || !formPag.taxaId) {
      Alert.alert('Erro', 'Selecione o aluno e a taxa.'); return;
    }
    const taxa = taxas.find(x => x.id === formPag.taxaId);
    const ref  = `REF-${anoAtual}-${Date.now().toString(36).toUpperCase()}`;
    await addPagamento({
      alunoId: formPag.alunoId,
      taxaId:  formPag.taxaId,
      valor:   parseFloat(formPag.valor) || (taxa?.valor ?? 0),
      data:    new Date().toISOString().split('T')[0],
      mes:     formPag.mes ? parseInt(formPag.mes) : undefined,
      ano:     anoAtual,
      status:  'pago',
      metodoPagamento: formPag.metodoPagamento,
      referencia: formPag.referencia || ref,
      observacao: formPag.observacao || undefined,
    });
    setShowModalPag(false);
    setFormPag(defaultFormPag);
    Alert.alert('Sucesso', 'Pagamento registado com sucesso!');
  }

  async function gravarTaxa() {
    if (!formTaxa.descricao.trim() || !formTaxa.valor) {
      Alert.alert('Erro', 'Preencha a descrição e o valor.'); return;
    }
    const payload = {
      tipo: formTaxa.tipo,
      descricao: formTaxa.descricao.trim(),
      valor: parseFloat(formTaxa.valor) || 0,
      frequencia: formTaxa.frequencia,
      nivel: formTaxa.nivel,
      anoAcademico: anoAtual,
      ativo: true,
    };
    if (editTaxa) {
      await updateTaxa(editTaxa.id, payload);
      Alert.alert('Actualizado', 'Rubrica actualizada com sucesso. Aparecerá automaticamente no perfil dos alunos correspondentes.');
    } else {
      await addTaxa(payload);
      Alert.alert('Criada', 'Nova rubrica criada e disponível automaticamente no perfil financeiro dos alunos correspondentes.');
    }
    setShowModalTaxa(false);
    setEditTaxa(null);
    setFormTaxa(defaultFormTaxa);
  }

  function openEditTaxa(taxa: Taxa) {
    setFormTaxa({ tipo: taxa.tipo, descricao: taxa.descricao, valor: taxa.valor.toString(), frequencia: taxa.frequencia, nivel: taxa.nivel });
    setEditTaxa(taxa);
    setShowModalTaxa(true);
  }

  async function toggleTaxa(taxa: Taxa) {
    await updateTaxa(taxa.id, { ativo: !taxa.ativo });
  }

  async function removerTaxa(taxa: Taxa) {
    Alert.alert('Remover Rubrica', `Tem a certeza que quer remover "${taxa.descricao}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deleteTaxa(taxa.id) },
    ]);
  }

  const maxMes = Math.max(...Object.values(resumoPorMes), 1);

  function renderResumo() {
    const recentes = [...pagamentosAno]
      .filter(p => p.status === 'pago')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 60 }}>
        {/* KPIs */}
        <Text style={st.secLabel}>VISÃO GERAL — {anoAtual}</Text>
        <View style={st.kpiRow}>
          <View style={[st.kpiCard, { flex: 1.2 }]}>
            <Ionicons name="trending-up" size={18} color={Colors.success} />
            <Text style={[st.kpiVal, { color: Colors.success }]}>{formatAOA(totalRecebido)}</Text>
            <Text style={st.kpiLbl}>Recebido</Text>
          </View>
          <View style={[st.kpiCard, { flex: 1.2 }]}>
            <Ionicons name="time" size={18} color={Colors.warning} />
            <Text style={[st.kpiVal, { color: Colors.warning }]}>{formatAOA(totalPendente)}</Text>
            <Text style={st.kpiLbl}>Pendente</Text>
          </View>
        </View>
        <View style={st.kpiRow}>
          <View style={st.kpiCard}>
            <Ionicons name="receipt" size={16} color={Colors.info} />
            <Text style={[st.kpiVal, { color: Colors.info, fontSize: 20 }]}>{nTransacoes}</Text>
            <Text style={st.kpiLbl}>Transacções</Text>
          </View>
          <View style={st.kpiCard}>
            <Ionicons name="people" size={16} color={Colors.gold} />
            <Text style={[st.kpiVal, { color: Colors.gold, fontSize: 20 }]}>{nAlunos}</Text>
            <Text style={st.kpiLbl}>Alunos</Text>
          </View>
          <View style={st.kpiCard}>
            <Ionicons name="pricetag" size={16} color={Colors.accent} />
            <Text style={[st.kpiVal, { color: Colors.accent, fontSize: 20 }]}>{taxasAtivas.length}</Text>
            <Text style={st.kpiLbl}>Rubricas</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={st.progressCard}>
          <View style={st.progressTop}>
            <Text style={st.progressLabel}>Taxa de Pagamento</Text>
            <Text style={[st.progressPct, { color: percentPago >= 70 ? Colors.success : Colors.warning }]}>{percentPago}%</Text>
          </View>
          <View style={st.progressBar}>
            <View style={[st.progressFill, {
              width: `${percentPago}%` as any,
              backgroundColor: percentPago >= 70 ? Colors.success : Colors.warning,
            }]} />
          </View>
          <Text style={st.progressSub}>
            {pagamentosAno.filter(p => p.status === 'pago').length} de {pagamentosAno.length} pagamentos efectuados no ano lectivo
          </Text>
        </View>

        {/* Por tipo */}
        {resumoPorTipo.length > 0 && (
          <>
            <Text style={st.secLabel}>ARRECADADO POR TIPO DE RUBRICA</Text>
            {resumoPorTipo.map(({ tipo, recebido, pendente, count }) => (
              <View key={tipo} style={st.tipoCard}>
                <View style={[st.tipoIcon, { backgroundColor: TIPO_COLOR[tipo] + '22' }]}>
                  <Ionicons name={TIPO_ICON[tipo] as any} size={18} color={TIPO_COLOR[tipo]} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={st.tipoTop}>
                    <Text style={st.tipoNome}>{TIPO_LABEL[tipo]}</Text>
                    <Text style={[st.tipoVal, { color: Colors.success }]}>{formatAOA(recebido)}</Text>
                  </View>
                  {pendente > 0 && (
                    <Text style={st.tipoPendente}>+{formatAOA(pendente)} pendente</Text>
                  )}
                  <Text style={st.tipoCount}>{count} pagamento(s) confirmado(s)</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Actividade mensal */}
        {Object.keys(resumoPorMes).length > 0 && (
          <>
            <Text style={st.secLabel}>ACTIVIDADE MENSAL (PAGOS)</Text>
            <View style={st.barChart}>
              {MESES.map((m, i) => {
                const v = resumoPorMes[i] || 0;
                const pct = maxMes > 0 ? v / maxMes : 0;
                return (
                  <View key={m} style={st.barCol}>
                    <View style={[st.barFill, { height: Math.max(4, pct * 80), backgroundColor: v > 0 ? Colors.success : Colors.border }]} />
                    <Text style={st.barLabel}>{m}</Text>
                    {v > 0 && <Text style={st.barVal}>{(v / 1000).toFixed(0)}k</Text>}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Recentes */}
        {recentes.length > 0 && (
          <>
            <Text style={st.secLabel}>ÚLTIMAS TRANSACÇÕES</Text>
            {recentes.map(p => {
              const tipo = getTipoTaxa(p.taxaId);
              return (
                <View key={p.id} style={st.recentRow}>
                  <View style={[st.recentIcon, { backgroundColor: TIPO_COLOR[tipo] + '22' }]}>
                    <Ionicons name={TIPO_ICON[tipo] as any} size={15} color={TIPO_COLOR[tipo]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.recentNome} numberOfLines={1}>{getNomeAluno(p.alunoId)}</Text>
                    <Text style={st.recentTaxa} numberOfLines={1}>{getNomeTaxa(p.taxaId)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[st.recentVal, { color: Colors.success }]}>{formatAOA(p.valor)}</Text>
                    <Text style={st.recentData}>{new Date(p.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {pagamentosAno.length === 0 && taxasAno.length === 0 && (
          <View style={st.empty}>
            <FontAwesome5 name="money-bill-wave" size={48} color={Colors.textMuted} />
            <Text style={st.emptyTitle}>Sem dados financeiros</Text>
            <Text style={st.emptySub}>Crie rubricas na aba "Rubricas" — elas aparecerão automaticamente no perfil financeiro dos alunos.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderPagamentos() {
    return (
      <View style={{ flex: 1 }}>
        <View style={st.filterBlock}>
          <View style={st.searchRow}>
            <Ionicons name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={st.searchInput}
              placeholder="Pesquisar aluno..."
              placeholderTextColor={Colors.textMuted}
              value={searchPagAluno}
              onChangeText={setSearchPagAluno}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={st.chipRow}>
              {(['todos','pago','pendente','cancelado'] as const).map(s => (
                <TouchableOpacity key={s} style={[st.chip, statusFilter === s && st.chipActive]} onPress={() => setStatusFilter(s)}>
                  <Text style={[st.chipText, statusFilter === s && st.chipTextActive]}>
                    {s === 'todos' ? 'Todos' : STATUS_CFG[s as StatusPagamento].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={st.chipRow}>
              {(['todos', ...TIPOS] as const).map(t => (
                <TouchableOpacity key={t} style={[st.chip, tipoFilter === t && st.chipActive]} onPress={() => setTipoFilter(t as any)}>
                  <Text style={[st.chipText, tipoFilter === t && st.chipTextActive]}>
                    {t === 'todos' ? 'Todos tipos' : TIPO_LABEL[t as TipoTaxa]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {pagamentosFiltrados.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={st.emptyTitle}>Sem pagamentos</Text>
            <Text style={st.emptySub}>Não existem pagamentos que correspondam aos filtros seleccionados.</Text>
          </View>
        ) : (
          <FlatList
            data={pagamentosFiltrados}
            keyExtractor={p => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 80 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item: pag }) => {
              const sc   = STATUS_CFG[pag.status];
              const tipo = getTipoTaxa(pag.taxaId);
              return (
                <View style={st.pagCard}>
                  <View style={[st.pagIcon, { backgroundColor: TIPO_COLOR[tipo] + '22' }]}>
                    <Ionicons name={TIPO_ICON[tipo] as any} size={18} color={TIPO_COLOR[tipo]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.pagNome}>{getNomeAluno(pag.alunoId)}</Text>
                    <Text style={st.pagTaxa}>{getNomeTaxa(pag.taxaId)}</Text>
                    <View style={st.pagMeta}>
                      <Ionicons name="calendar-outline" size={10} color={Colors.textMuted} />
                      <Text style={st.pagMetaTxt}>{new Date(pag.data).toLocaleDateString('pt-PT')}</Text>
                      <Text style={st.pagMetaTxt}>·</Text>
                      <Text style={st.pagMetaTxt}>{METODO_LABEL[pag.metodoPagamento]}</Text>
                      <Text style={st.pagMetaTxt}>·</Text>
                      <Text style={st.pagMetaTxt}>{getTurmaAluno(pag.alunoId)}</Text>
                    </View>
                    {pag.referencia && (
                      <Text style={st.pagRef}>Ref: {pag.referencia}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={st.pagValor}>{formatAOA(pag.valor)}</Text>
                    <Badge label={sc.label} color={sc.color} />
                    {pag.status === 'pendente' && (
                      <TouchableOpacity
                        style={st.confirmarBtn}
                        onPress={() => updatePagamento(pag.id, { status: 'pago' })}
                      >
                        <Ionicons name="checkmark" size={11} color="#fff" />
                        <Text style={st.confirmarTxt}>Confirmar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
        <TouchableOpacity style={st.fab} onPress={() => setShowModalPag(true)}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={st.fabTxt}>Registar Pagamento</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderRubricas() {
    const grupos = TIPOS.filter(t => taxasAno.some(x => x.tipo === t));
    return (
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 80 }}>
          <View style={st.rubricaInfoBanner}>
            <Ionicons name="information-circle" size={18} color={Colors.info} />
            <Text style={st.rubricaInfoTxt}>
              Todas as rubricas activas aparecem automaticamente no perfil financeiro de cada aluno de acordo com o nível e ano lectivo definidos.
            </Text>
          </View>

          {taxasAno.length === 0 ? (
            <View style={st.empty}>
              <Ionicons name="pricetag-outline" size={48} color={Colors.textMuted} />
              <Text style={st.emptyTitle}>Sem rubricas para {anoAtual}</Text>
              <Text style={st.emptySub}>Crie a primeira rubrica para que apareça no perfil dos alunos.</Text>
            </View>
          ) : (
            grupos.map(tipo => (
              <View key={tipo}>
                <View style={st.grupoHeader}>
                  <View style={[st.grupoIconBox, { backgroundColor: TIPO_COLOR[tipo] + '22' }]}>
                    <Ionicons name={TIPO_ICON[tipo] as any} size={14} color={TIPO_COLOR[tipo]} />
                  </View>
                  <Text style={[st.grupoTitle, { color: TIPO_COLOR[tipo] }]}>{TIPO_LABEL[tipo].toUpperCase()}</Text>
                  <Text style={st.grupoCount}>{taxasAno.filter(t => t.tipo === tipo).length}</Text>
                </View>
                {taxasAno.filter(t => t.tipo === tipo).map(t => (
                  <View key={t.id} style={[st.rubricaCard, !t.ativo && { opacity: 0.55 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={st.rubricaTop}>
                        <Text style={st.rubricaNome}>{t.descricao}</Text>
                        <Badge label={t.ativo ? 'Activa' : 'Inactiva'} color={t.ativo ? Colors.success : Colors.textMuted} />
                      </View>
                      <View style={st.rubricaMeta}>
                        <Text style={st.rubricaMetaTxt}>{FREQS.find(f => f.k === t.frequencia)?.l || t.frequencia}</Text>
                        <Text style={st.rubricaMetaTxt}>·</Text>
                        <Text style={st.rubricaMetaTxt}>{t.nivel || 'Todos'}</Text>
                        <Text style={st.rubricaMetaTxt}>·</Text>
                        <Text style={[st.rubricaMetaTxt, { color: Colors.gold, fontFamily: 'Inter_700Bold' }]}>{formatAOA(t.valor)}</Text>
                      </View>
                    </View>
                    <View style={st.rubricaActions}>
                      <TouchableOpacity style={st.rubricaActionBtn} onPress={() => openEditTaxa(t)}>
                        <Ionicons name="pencil" size={14} color={Colors.info} />
                      </TouchableOpacity>
                      <TouchableOpacity style={st.rubricaActionBtn} onPress={() => toggleTaxa(t)}>
                        <Ionicons name={t.ativo ? 'eye-off' : 'eye'} size={14} color={t.ativo ? Colors.warning : Colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity style={st.rubricaActionBtn} onPress={() => removerTaxa(t)}>
                        <Ionicons name="trash" size={14} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
        <TouchableOpacity style={st.fab} onPress={() => { setEditTaxa(null); setFormTaxa(defaultFormTaxa); setShowModalTaxa(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={st.fabTxt}>Nova Rubrica</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderPorAluno() {
    if (alunoPerfilId) {
      const alunoSel  = alunos.find(a => a.id === alunoPerfilId);
      const turmaSel  = alunoSel ? turmas.find(t => t.id === alunoSel.turmaId) : null;
      const pagsAluno = pagamentos.filter(p => p.alunoId === alunoPerfilId && p.ano === anoAtual)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const totPago   = pagsAluno.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
      const totPend   = pagsAluno.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);

      return (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={st.backBtn} onPress={() => setAlunoPerfilId(null)}>
            <Ionicons name="arrow-back" size={18} color={Colors.gold} />
            <Text style={st.backTxt}>Voltar à lista</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}>
            <View style={st.alunoPerfilCard}>
              <View style={st.alunoAvatar}>
                <Text style={st.alunoAvatarTxt}>{alunoSel?.nome[0]}{alunoSel?.apelido[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.alunoNome}>{alunoSel?.nome} {alunoSel?.apelido}</Text>
                <Text style={st.alunoMat}>{alunoSel?.numeroMatricula}</Text>
                <Text style={st.alunoTurma}>{turmaSel?.classe}ª Classe · {turmaSel?.nome}</Text>
              </View>
            </View>

            <View style={st.kpiRow}>
              <View style={st.kpiCard}>
                <Text style={[st.kpiVal, { color: Colors.success, fontSize: 16 }]}>{formatAOA(totPago)}</Text>
                <Text style={st.kpiLbl}>Pago</Text>
              </View>
              <View style={st.kpiCard}>
                <Text style={[st.kpiVal, { color: Colors.warning, fontSize: 16 }]}>{formatAOA(totPend)}</Text>
                <Text style={st.kpiLbl}>Pendente</Text>
              </View>
              <View style={st.kpiCard}>
                <Text style={[st.kpiVal, { color: Colors.info, fontSize: 16 }]}>{pagsAluno.length}</Text>
                <Text style={st.kpiLbl}>Transacções</Text>
              </View>
            </View>

            <Text style={st.secLabel}>HISTÓRICO FINANCEIRO {anoAtual}</Text>
            {pagsAluno.length === 0 ? (
              <View style={st.empty}>
                <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
                <Text style={st.emptyTitle}>Sem movimentos</Text>
              </View>
            ) : (
              pagsAluno.map(p => {
                const sc   = STATUS_CFG[p.status];
                const tipo = getTipoTaxa(p.taxaId);
                return (
                  <View key={p.id} style={[st.pagCard, { borderLeftWidth: 3, borderLeftColor: sc.color }]}>
                    <View style={[st.pagIcon, { backgroundColor: TIPO_COLOR[tipo] + '22' }]}>
                      <Ionicons name={TIPO_ICON[tipo] as any} size={16} color={TIPO_COLOR[tipo]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pagTaxa}>{getNomeTaxa(p.taxaId)}</Text>
                      <Text style={st.pagMetaTxt}>{new Date(p.data).toLocaleDateString('pt-PT')} · {METODO_LABEL[p.metodoPagamento]}</Text>
                      {p.referencia && <Text style={st.pagRef}>Ref: {p.referencia}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={st.pagValor}>{formatAOA(p.valor)}</Text>
                      <Badge label={sc.label} color={sc.color} />
                      {p.status === 'pendente' && (
                        <TouchableOpacity style={st.confirmarBtn} onPress={() => updatePagamento(p.id, { status: 'pago' })}>
                          <Ionicons name="checkmark" size={11} color="#fff" />
                          <Text style={st.confirmarTxt}>Confirmar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <View style={st.filterBlock}>
          <View style={st.searchRow}>
            <Ionicons name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={st.searchInput}
              placeholder="Pesquisar aluno..."
              placeholderTextColor={Colors.textMuted}
              value={searchAluno}
              onChangeText={setSearchAluno}
            />
          </View>
        </View>
        <FlatList
          data={alunosFiltrados}
          keyExtractor={a => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={st.emptyTitle}>Nenhum aluno encontrado</Text>
            </View>
          }
          renderItem={({ item: a, index }) => {
            const pagsA   = pagamentos.filter(p => p.alunoId === a.id && p.ano === anoAtual);
            const pago    = pagsA.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
            const pend    = pagsA.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
            const turmaA  = turmas.find(t => t.id === a.turmaId);
            return (
              <TouchableOpacity style={st.alunoCard} onPress={() => setAlunoPerfilId(a.id)}>
                <View style={st.alunoNumBox}>
                  <Text style={st.alunoNum}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={st.alunoAvatarSmall}>
                  <Text style={st.alunoAvatarSmallTxt}>{a.nome[0]}{a.apelido[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.alunoNome}>{a.nome} {a.apelido}</Text>
                  <Text style={st.alunoMat}>{a.numeroMatricula} · {turmaA?.nome || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  {pago > 0 && <Text style={[st.alunoVal, { color: Colors.success }]}>{formatAOA(pago)}</Text>}
                  {pend > 0 && <Text style={[st.alunoVal, { color: Colors.warning }]}>+{formatAOA(pend)} pend.</Text>}
                  {pago === 0 && pend === 0 && <Text style={st.alunoVal}>—</Text>}
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <TopBar title="Gestão Financeira" subtitle={`Ano Lectivo ${anoAtual}`} />

      <View style={st.tabBar}>
        {([['resumo','stats-chart','Resumo'], ['pagamentos','receipt','Pagamentos'], ['rubricas','pricetag','Rubricas'], ['por_aluno','person','Por Aluno']] as const).map(([k, icon, label]) => (
          <TouchableOpacity key={k} style={[st.tabBtn, tab === k && st.tabBtnActive]} onPress={() => { setTab(k); setAlunoPerfilId(null); }}>
            <Ionicons name={icon as any} size={15} color={tab === k ? Colors.gold : Colors.textMuted} />
            <Text style={[st.tabBtnTxt, tab === k && st.tabBtnTxtActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'resumo'      && renderResumo()}
      {tab === 'pagamentos'  && renderPagamentos()}
      {tab === 'rubricas'    && renderRubricas()}
      {tab === 'por_aluno'   && renderPorAluno()}

      {/* Modal Pagamento */}
      <Modal visible={showModalPag} transparent animationType="slide" onRequestClose={() => setShowModalPag(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Registar Pagamento</Text>
              <TouchableOpacity onPress={() => setShowModalPag(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={st.fieldLabel}>Aluno *</Text>
              <TouchableOpacity style={st.selector} onPress={() => setShowAlunoList(v => !v)}>
                <Text style={formPag.alunoId ? st.selectorVal : st.selectorPh}>
                  {formPag.alunoId ? getNomeAluno(formPag.alunoId) : 'Selecionar aluno...'}
                </Text>
                <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
              {showAlunoList && (
                <ScrollView style={st.dropList} nestedScrollEnabled>
                  {alunos.filter(a => a.ativo).map(a => (
                    <TouchableOpacity key={a.id} style={[st.dropItem, formPag.alunoId === a.id && st.dropItemActive]}
                      onPress={() => { setFormPag(f => ({ ...f, alunoId: a.id })); setShowAlunoList(false); }}>
                      <Text style={[st.dropItemTxt, formPag.alunoId === a.id && { color: Colors.gold }]}>{a.nome} {a.apelido}</Text>
                      <Text style={st.dropItemSub}>{turmas.find(t => t.id === a.turmaId)?.nome || ''}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={st.fieldLabel}>Rubrica *</Text>
              <TouchableOpacity style={st.selector} onPress={() => setShowTaxaList(v => !v)}>
                <Text style={formPag.taxaId ? st.selectorVal : st.selectorPh}>
                  {formPag.taxaId ? getNomeTaxa(formPag.taxaId) : 'Selecionar rubrica...'}
                </Text>
                <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
              {showTaxaList && (
                <ScrollView style={st.dropList} nestedScrollEnabled>
                  {taxasAtivas.map(t => (
                    <TouchableOpacity key={t.id} style={[st.dropItem, formPag.taxaId === t.id && st.dropItemActive]}
                      onPress={() => { setFormPag(f => ({ ...f, taxaId: t.id, valor: t.valor.toString() })); setShowTaxaList(false); }}>
                      <Text style={[st.dropItemTxt, formPag.taxaId === t.id && { color: Colors.gold }]}>{t.descricao}</Text>
                      <Text style={st.dropItemSub}>{formatAOA(t.valor)} · {t.nivel}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={st.fieldLabel}>Valor (AOA)</Text>
              <TextInput style={st.input} placeholder="Preenche automaticamente" placeholderTextColor={Colors.textMuted}
                keyboardType="numeric" value={formPag.valor} onChangeText={v => setFormPag(f => ({ ...f, valor: v }))} />

              <Text style={st.fieldLabel}>Método de Pagamento</Text>
              <View style={st.metodosRow}>
                {(['dinheiro','transferencia','multicaixa'] as MetodoPagamento[]).map(m => (
                  <TouchableOpacity key={m} style={[st.metodoBtn, formPag.metodoPagamento === m && st.metodoBtnActive]}
                    onPress={() => setFormPag(f => ({ ...f, metodoPagamento: m }))}>
                    <Text style={[st.metodoTxt, formPag.metodoPagamento === m && st.metodoTxtActive]}>{METODO_LABEL[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.fieldLabel}>Mês de Referência</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
                  {MESES.map((m, i) => (
                    <TouchableOpacity key={m} style={[st.mesBtn, formPag.mes === String(i + 1) && st.mesBtnActive]}
                      onPress={() => setFormPag(f => ({ ...f, mes: f.mes === String(i + 1) ? '' : String(i + 1) }))}>
                      <Text style={[st.mesTxt, formPag.mes === String(i + 1) && st.mesTxtActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={st.fieldLabel}>Referência (opcional)</Text>
              <TextInput style={st.input} placeholder="Gerada automaticamente se vazia" placeholderTextColor={Colors.textMuted}
                value={formPag.referencia} onChangeText={v => setFormPag(f => ({ ...f, referencia: v }))} />

              <Text style={st.fieldLabel}>Observação (opcional)</Text>
              <TextInput style={[st.input, { height: 60, textAlignVertical: 'top' }]} placeholder="Observações..." placeholderTextColor={Colors.textMuted}
                multiline value={formPag.observacao} onChangeText={v => setFormPag(f => ({ ...f, observacao: v }))} />

              <TouchableOpacity style={st.saveBtn} onPress={registarPagamento}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={st.saveBtnTxt}>Registar Pagamento</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Rubrica */}
      <Modal visible={showModalTaxa} transparent animationType="slide" onRequestClose={() => setShowModalTaxa(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{editTaxa ? 'Editar Rubrica' : 'Nova Rubrica'}</Text>
              <TouchableOpacity onPress={() => { setShowModalTaxa(false); setEditTaxa(null); }}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={st.rubricaInfoBanner}>
                <Ionicons name="flash" size={14} color={Colors.info} />
                <Text style={[st.rubricaInfoTxt, { fontSize: 11 }]}>
                  Esta rubrica aparecerá automaticamente no perfil financeiro dos alunos do nível e ano lectivo seleccionados.
                </Text>
              </View>

              <Text style={st.fieldLabel}>Tipo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {TIPOS.map(t => (
                    <TouchableOpacity key={t} style={[st.tipoChip, formTaxa.tipo === t && { backgroundColor: TIPO_COLOR[t], borderColor: TIPO_COLOR[t] }]}
                      onPress={() => setFormTaxa(f => ({ ...f, tipo: t }))}>
                      <Ionicons name={TIPO_ICON[t] as any} size={12} color={formTaxa.tipo === t ? '#fff' : TIPO_COLOR[t]} />
                      <Text style={[st.tipoChipTxt, formTaxa.tipo === t && { color: '#fff' }]}>{TIPO_LABEL[t]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={st.fieldLabel}>Descrição *</Text>
              <TextInput style={st.input} placeholder="Ex: Propina Mensal — I Ciclo" placeholderTextColor={Colors.textMuted}
                value={formTaxa.descricao} onChangeText={v => setFormTaxa(f => ({ ...f, descricao: v }))} />

              <Text style={st.fieldLabel}>Valor (AOA) *</Text>
              <TextInput style={st.input} placeholder="Ex: 5000" placeholderTextColor={Colors.textMuted}
                keyboardType="numeric" value={formTaxa.valor} onChangeText={v => setFormTaxa(f => ({ ...f, valor: v }))} />

              <Text style={st.fieldLabel}>Frequência</Text>
              <View style={st.metodosRow}>
                {FREQS.map(({ k, l }) => (
                  <TouchableOpacity key={k} style={[st.metodoBtn, formTaxa.frequencia === k && st.metodoBtnActive]}
                    onPress={() => setFormTaxa(f => ({ ...f, frequencia: k }))}>
                    <Text style={[st.metodoTxt, formTaxa.frequencia === k && st.metodoTxtActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.fieldLabel}>Nível Escolar</Text>
              <View style={st.metodosRow}>
                {NIVEIS.map(n => (
                  <TouchableOpacity key={n} style={[st.metodoBtn, formTaxa.nivel === n && st.metodoBtnActive]}
                    onPress={() => setFormTaxa(f => ({ ...f, nivel: n }))}>
                    <Text style={[st.metodoTxt, formTaxa.nivel === n && st.metodoTxtActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={st.saveBtn} onPress={gravarTaxa}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={st.saveBtnTxt}>{editTaxa ? 'Guardar Alterações' : 'Criar Rubrica'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.gold },
  tabBtnTxt: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabBtnTxtActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  secLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpiCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border },
  kpiVal: { fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  kpiLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  progressCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  progressPct: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, marginBottom: 6 },
  progressFill: { height: 8, borderRadius: 4 },
  progressSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  tipoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  tipoIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tipoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  tipoNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  tipoVal: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  tipoPendente: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.warning, marginBottom: 2 },
  tipoCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barFill: { width: '80%', borderRadius: 3, minHeight: 4 },
  barLabel: { fontSize: 7, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  barVal: { fontSize: 6, fontFamily: 'Inter_600SemiBold', color: Colors.success, position: 'absolute', top: -12 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  recentIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recentNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  recentTaxa: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  recentVal: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  recentData: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  filterBlock: { backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingTop: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text },
  chipRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  pagCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  pagIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pagNome: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  pagTaxa: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 4 },
  pagMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  pagMetaTxt: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  pagRef: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.gold, marginTop: 2 },
  pagValor: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.gold },
  confirmarBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  confirmarTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  fab: { position: 'absolute', bottom: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  fabTxt: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  rubricaInfoBanner: { flexDirection: 'row', gap: 8, backgroundColor: Colors.info + '18', borderWidth: 1, borderColor: Colors.info + '44', borderRadius: 12, padding: 12, marginBottom: 16 },
  rubricaInfoTxt: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 18 },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 },
  grupoIconBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  grupoTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, flex: 1 },
  grupoCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  rubricaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  rubricaTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  rubricaNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, flex: 1 },
  rubricaMeta: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  rubricaMetaTxt: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  rubricaActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  rubricaActionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.primaryDark },
  backTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  alunoPerfilCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  alunoAvatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  alunoAvatarTxt: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.gold },
  alunoNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoMat: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  alunoTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
  alunoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  alunoNumBox: { width: 26, alignItems: 'center' },
  alunoNum: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  alunoAvatarSmall: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  alunoAvatarSmallTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.gold },
  alunoVal: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  selectorVal: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  selectorPh: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  dropList: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, maxHeight: 180 },
  dropItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropItemActive: { backgroundColor: Colors.gold + '22' },
  dropItemTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  dropItemSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  metodosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metodoBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  metodoBtnActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  metodoTxt: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  metodoTxtActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  mesBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  mesBtnActive: { backgroundColor: Colors.info + '22', borderColor: Colors.info },
  mesTxt: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  mesTxtActive: { color: Colors.info },
  tipoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tipoChipTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 12, padding: 14, marginTop: 12 },
  saveBtnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
