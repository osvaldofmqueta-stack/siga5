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
  MensagemFinanceira,
} from '@/context/FinanceiroContext';
import { useData } from '@/context/DataContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

const TIPO_LABEL: Record<TipoTaxa, string> = {
  propina: 'Propina', matricula: 'Matrícula', material: 'Material Didáctico', exame: 'Exame', multa: 'Multa', outro: 'Outro',
};
const TIPO_ICON: Record<TipoTaxa, string> = {
  propina: 'cash', matricula: 'document-text', material: 'book', exame: 'newspaper', multa: 'warning', outro: 'ellipsis-horizontal',
};
const TIPO_COLOR: Record<TipoTaxa, string> = {
  propina: Colors.info, matricula: Colors.gold, material: Colors.success, exame: Colors.warning, multa: Colors.danger, outro: Colors.textMuted,
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
const TIPOS: TipoTaxa[] = ['propina','matricula','material','exame','multa','outro'];
const FREQS: { k: FrequenciaTaxa; l: string }[] = [
  { k: 'mensal', l: 'Mensal' }, { k: 'trimestral', l: 'Trimestral' },
  { k: 'anual', l: 'Anual' }, { k: 'unica', l: 'Única' },
];
const TABS_MAIN = ['painel','resumo','em_atraso','mensagens','pagamentos','rubricas','por_aluno'] as const;
type TabKey = typeof TABS_MAIN[number];

const MESES_PAINEL = [
  { num: 9, nome: 'Set' }, { num: 10, nome: 'Out' }, { num: 11, nome: 'Nov' },
  { num: 12, nome: 'Dez' }, { num: 1, nome: 'Jan' }, { num: 2, nome: 'Fev' },
  { num: 3, nome: 'Mar' }, { num: 4, nome: 'Abr' }, { num: 5, nome: 'Mai' },
  { num: 6, nome: 'Jun' }, { num: 7, nome: 'Jul' },
];

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + '55' }}>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color }}>{label}</Text>
    </View>
  );
}

export default function FinanceiroScreen() {
  const {
    taxas, pagamentos, multaConfig, mensagens, rupes, bloqueados, isLoading,
    addTaxa, updateTaxa, deleteTaxa,
    addPagamento, updatePagamento,
    getTotalRecebido, getTotalPendente,
    updateMultaConfig,
    bloquearAluno, desbloquearAluno, isAlunoBloqueado,
    enviarMensagem, getMensagensAluno, marcarMensagemLida,
    gerarRUPE, getRUPEsAluno,
    getMesesEmAtraso, calcularMulta,
  } = useFinanceiro();
  const { alunos, turmas } = useData();
  const { anoSelecionado } = useAnoAcademico();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 24 : insets.bottom;

  const anoAtual = anoSelecionado?.ano || new Date().getFullYear().toString();
  const nomeRemetente = user?.nome || 'Departamento Financeiro';

  const [tab, setTab]         = useState<TabKey>('painel');
  const [statusFilter, setStatusFilter] = useState<'todos' | StatusPagamento>('todos');
  const [tipoFilter, setTipoFilter]     = useState<'todos' | TipoTaxa>('todos');
  const [searchAluno, setSearchAluno]   = useState('');
  const [searchPagAluno, setSearchPagAluno] = useState('');
  const [alunoPerfilId, setAlunoPerfilId]   = useState<string | null>(null);
  const [msgAlunoId, setMsgAlunoId]         = useState<string | null>(null);
  const [showMsgModal, setShowMsgModal]     = useState(false);
  const [msgTexto, setMsgTexto]             = useState('');
  const [msgTipo, setMsgTipo]               = useState<MensagemFinanceira['tipo']>('aviso');
  const [showRUPEModal, setShowRUPEModal]   = useState(false);
  const [rupeAlunoId, setRupeAlunoId]       = useState<string | null>(null);
  const [rupeTaxaId, setRupeTaxaId]         = useState('');
  const [rupeValor, setRupeValor]           = useState('');
  const [rupeGerado, setRupeGerado]         = useState<any>(null);
  const [showMultaModal, setShowMultaModal] = useState(false);
  const [multaPct, setMultaPct]             = useState(multaConfig.percentagem.toString());
  const [multaDias, setMultaDias]           = useState(multaConfig.diasCarencia.toString());

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

  const alunosAtivos = useMemo(() => alunos.filter(a => a.ativo), [alunos]);

  const alunosEmAtraso = useMemo(() => {
    return alunosAtivos
      .map(a => {
        const meses = getMesesEmAtraso(a.id, anoAtual);
        const taxaPropina = taxasAtivas.find(t => t.tipo === 'propina');
        const valorPropina = taxaPropina?.valor || 0;
        const multa = calcularMulta(valorPropina, meses);
        const pagsAluno = pagamentosAno.filter(p => p.alunoId === a.id);
        const pendente = pagsAluno.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
        return { aluno: a, mesesAtraso: meses, multa, valorPropina, pendente };
      })
      .filter(x => x.mesesAtraso > 0 || x.pendente > 0)
      .sort((a, b) => b.mesesAtraso - a.mesesAtraso);
  }, [alunosAtivos, pagamentosAno, taxasAtivas, anoAtual, multaConfig]);

  const todasMensagens = useMemo(() => [...mensagens].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()), [mensagens]);

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
      Alert.alert('Actualizado', 'Rubrica actualizada com sucesso.');
    } else {
      await addTaxa(payload);
      Alert.alert('Criada', 'Nova rubrica criada e disponível automaticamente no perfil financeiro dos alunos.');
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

  async function handleEnviarMensagem() {
    if (!msgAlunoId || !msgTexto.trim()) {
      Alert.alert('Erro', 'Escreva a mensagem.'); return;
    }
    await enviarMensagem(msgAlunoId, msgTexto.trim(), nomeRemetente, msgTipo);
    setShowMsgModal(false);
    setMsgTexto('');
    setMsgTipo('aviso');
    Alert.alert('Enviada', 'Mensagem enviada ao estudante com sucesso.');
  }

  async function handleGerarRUPE() {
    if (!rupeAlunoId || !rupeTaxaId) {
      Alert.alert('Erro', 'Selecione o aluno e a rubrica.'); return;
    }
    const taxa = taxas.find(t => t.id === rupeTaxaId);
    const valor = parseFloat(rupeValor) || taxa?.valor || 0;
    const rupe = await gerarRUPE(rupeAlunoId, rupeTaxaId, valor);
    setRupeGerado(rupe);
    await enviarMensagem(
      rupeAlunoId,
      `Foi gerado o RUPE para pagamento de "${taxa?.descricao || 'Rubrica'}" no valor de ${formatAOA(valor)}.\nReferência: ${rupe.referencia}\nValidade: ${new Date(rupe.dataValidade).toLocaleDateString('pt-PT')}`,
      nomeRemetente,
      'rupe'
    );
  }

  async function handleBloquear(alunoId: string, bloqueado: boolean) {
    if (bloqueado) {
      Alert.alert('Desbloquear', `Pretende desbloquear o acesso deste estudante?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desbloquear', onPress: async () => {
          await desbloquearAluno(alunoId);
          await enviarMensagem(alunoId, 'O seu acesso ao sistema foi desbloqueado. Por favor, regularize os pagamentos em atraso.', nomeRemetente, 'bloqueio');
        }},
      ]);
    } else {
      Alert.alert('Bloquear Acesso', `O estudante ficará sem acesso ao sistema até regularizar os pagamentos. Deseja continuar?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: async () => {
          await bloquearAluno(alunoId);
          await enviarMensagem(alunoId, 'O seu acesso ao sistema foi bloqueado por falta de pagamento. Contacte o departamento financeiro para regularizar a situação.', nomeRemetente, 'bloqueio');
        }},
      ]);
    }
  }

  async function handleSalvarMulta() {
    const pct  = parseFloat(multaPct) || 0;
    const dias = parseInt(multaDias) || 0;
    if (pct < 0 || pct > 100) { Alert.alert('Erro', 'Percentagem inválida (0-100).'); return; }
    await updateMultaConfig({ percentagem: pct, diasCarencia: dias });
    setShowMultaModal(false);
    Alert.alert('Guardado', 'Configuração de multa actualizada.');
  }

  const maxMes = Math.max(...Object.values(resumoPorMes), 1);

  function renderPainel() {
    const totalAlunos = alunosAtivos.length;
    const alunosEmDia = totalAlunos - alunosEmAtraso.length;
    const taxaPropina = taxasAtivas.find(t => t.tipo === 'propina');
    const taxaTotal = taxaPropina ? taxaPropina.valor * totalAlunos * 11 : 0;
    const taxaCobranca = taxaTotal > 0 ? Math.min(100, Math.round((totalRecebido / taxaTotal) * 100)) : 0;
    const anoBase = parseInt(anoAtual.split('/')[0]) || new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 60 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <View style={[st.kpiCard, { flex: 1, borderTopWidth: 2, borderTopColor: Colors.success }]}>
            <Ionicons name="trending-up" size={16} color={Colors.success} />
            <Text style={[st.kpiVal, { color: Colors.success, fontSize: 13 }]}>{formatAOA(totalRecebido)}</Text>
            <Text style={st.kpiLbl}>Recebido</Text>
          </View>
          <View style={[st.kpiCard, { flex: 1, borderTopWidth: 2, borderTopColor: Colors.warning }]}>
            <Ionicons name="time" size={16} color={Colors.warning} />
            <Text style={[st.kpiVal, { color: Colors.warning, fontSize: 13 }]}>{formatAOA(totalPendente)}</Text>
            <Text style={st.kpiLbl}>Pendente</Text>
          </View>
          <View style={[st.kpiCard, { flex: 1, borderTopWidth: 2, borderTopColor: Colors.info }]}>
            <Ionicons name="receipt" size={16} color={Colors.info} />
            <Text style={[st.kpiVal, { color: Colors.info, fontSize: 20 }]}>{nTransacoes}</Text>
            <Text style={st.kpiLbl}>Transacções</Text>
          </View>
        </View>

        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={st.kpiLbl}>Taxa de Cobrança {anoAtual}</Text>
            <Text style={[st.kpiLbl, {
              color: taxaCobranca >= 80 ? Colors.success : taxaCobranca >= 50 ? Colors.warning : Colors.danger,
              fontFamily: 'Inter_700Bold',
            }]}>{taxaCobranca}%</Text>
          </View>
          <View style={{ height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{
              height: 8, borderRadius: 4,
              width: `${Math.min(taxaCobranca, 100)}%` as any,
              backgroundColor: taxaCobranca >= 80 ? Colors.success : taxaCobranca >= 50 ? Colors.warning : Colors.danger,
            }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 100, backgroundColor: Colors.danger + '18', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.danger + '44' }}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={[st.kpiVal, { color: Colors.danger, fontSize: 22 }]}>{alunosEmAtraso.length}</Text>
            <Text style={st.kpiLbl}>Alunos em Atraso</Text>
          </View>
          <View style={{ flex: 1, minWidth: 100, backgroundColor: Colors.warning + '18', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.warning + '44' }}>
            <Ionicons name="lock-closed" size={16} color={Colors.warning} />
            <Text style={[st.kpiVal, { color: Colors.warning, fontSize: 22 }]}>{bloqueados.length}</Text>
            <Text style={st.kpiLbl}>Bloqueados</Text>
          </View>
          <View style={{ flex: 1, minWidth: 100, backgroundColor: Colors.success + '18', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.success + '44' }}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={[st.kpiVal, { color: Colors.success, fontSize: 22 }]}>{alunosEmDia}</Text>
            <Text style={st.kpiLbl}>Em Dia</Text>
          </View>
        </View>

        <Text style={[st.secLabel, { marginBottom: 8 }]}>PAGAMENTOS POR MÊS — {anoAtual}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {MESES_PAINEL.map(m => {
            const anoMes = m.num >= 8 ? anoBase : anoBase + 1;
            const countPago = pagamentos.filter(p =>
              p.mes === m.num && p.ano === String(anoMes) && p.status === 'pago'
            ).length;
            const totalMes = pagamentos.filter(p =>
              p.mes === m.num && p.ano === String(anoMes)
            ).reduce((s, p) => s + (p.status === 'pago' ? p.valor : 0), 0);
            const isAtual = m.num === mesAtual;
            return (
              <View key={m.num} style={{
                flex: 1, minWidth: 64, borderRadius: 8, padding: 7,
                backgroundColor: countPago > 0 ? Colors.success + '18' : Colors.border,
                borderWidth: isAtual ? 2 : 1,
                borderColor: isAtual ? Colors.gold : countPago > 0 ? Colors.success + '55' : Colors.border,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: countPago > 0 ? Colors.success : Colors.textMuted }}>
                  {m.nome}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: countPago > 0 ? Colors.success : Colors.textMuted }}>
                  {countPago}
                </Text>
                {totalMes > 0 && (
                  <Text style={{ fontSize: 7, color: Colors.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
                    {formatAOA(totalMes)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  function renderResumo() {
    const recentes = [...pagamentosAno]
      .filter(p => p.status === 'pago')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 60 }}>
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
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={[st.kpiVal, { color: Colors.danger, fontSize: 20 }]}>{alunosEmAtraso.length}</Text>
            <Text style={st.kpiLbl}>Em Atraso</Text>
          </View>
          <View style={st.kpiCard}>
            <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
            <Text style={[st.kpiVal, { fontSize: 20 }]}>{bloqueados.length}</Text>
            <Text style={st.kpiLbl}>Bloqueados</Text>
          </View>
        </View>

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

        <View style={st.multaBanner}>
          <Ionicons name="warning" size={16} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={st.multaBannerTitle}>Configuração de Multa por Atraso</Text>
            <Text style={st.multaBannerSub}>{multaConfig.percentagem}% por mês · Carência: {multaConfig.diasCarencia} dias · {multaConfig.ativo ? 'Activa' : 'Inactiva'}</Text>
          </View>
          <TouchableOpacity style={st.multaEditBtn} onPress={() => { setMultaPct(multaConfig.percentagem.toString()); setMultaDias(multaConfig.diasCarencia.toString()); setShowMultaModal(true); }}>
            <Ionicons name="settings" size={14} color={Colors.gold} />
          </TouchableOpacity>
        </View>

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
                  {pendente > 0 && <Text style={st.tipoPendente}>+{formatAOA(pendente)} pendente</Text>}
                  <Text style={st.tipoCount}>{count} pagamento(s) confirmado(s)</Text>
                </View>
              </View>
            ))}
          </>
        )}

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

  function renderEmAtraso() {
    if (alunosEmAtraso.length === 0) {
      return (
        <View style={st.empty}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
          <Text style={st.emptyTitle}>Sem propinas em atraso</Text>
          <Text style={st.emptySub}>Todos os estudantes estão em dia com os seus pagamentos.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={alunosEmAtraso}
        keyExtractor={x => x.aluno.id}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={() => (
          <View style={st.atrasoHeader}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={st.atrasoHeaderTxt}>{alunosEmAtraso.length} estudante(s) com pagamentos em atraso</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const { aluno, mesesAtraso, multa, valorPropina, pendente } = item;
          const bloqueado = isAlunoBloqueado(aluno.id);
          const turmaA = turmas.find(t => t.id === aluno.turmaId);
          const unread = mensagens.filter(m => m.alunoId === aluno.id && !m.lida).length;
          return (
            <View style={[st.atrasoCard, bloqueado && { borderLeftColor: Colors.danger, borderLeftWidth: 3 }]}>
              <View style={st.atrasoAvatarRow}>
                <View style={st.atrasoAvatar}>
                  <Text style={st.atrasoAvatarTxt}>{aluno.nome[0]}{aluno.apelido[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.atrasoNome}>{aluno.nome} {aluno.apelido}</Text>
                  <Text style={st.atrasoMat}>{aluno.numeroMatricula} · {turmaA?.nome || '—'}</Text>
                </View>
                {bloqueado && <Badge label="Bloqueado" color={Colors.danger} />}
              </View>

              <View style={st.atrasoStats}>
                {mesesAtraso > 0 && (
                  <View style={st.atrasoStatItem}>
                    <Ionicons name="time" size={13} color={Colors.warning} />
                    <Text style={[st.atrasoStatTxt, { color: Colors.warning }]}>{mesesAtraso} {mesesAtraso === 1 ? 'mês' : 'meses'} em atraso</Text>
                  </View>
                )}
                {pendente > 0 && (
                  <View style={st.atrasoStatItem}>
                    <Ionicons name="cash" size={13} color={Colors.danger} />
                    <Text style={[st.atrasoStatTxt, { color: Colors.danger }]}>Pendente: {formatAOA(pendente)}</Text>
                  </View>
                )}
                {multa > 0 && multaConfig.ativo && (
                  <View style={st.atrasoStatItem}>
                    <Ionicons name="warning" size={13} color={Colors.danger} />
                    <Text style={[st.atrasoStatTxt, { color: Colors.danger }]}>Multa estimada: {formatAOA(multa)}</Text>
                  </View>
                )}
              </View>

              <View style={st.atrasoActions}>
                <TouchableOpacity style={[st.atrasoActionBtn, { backgroundColor: Colors.info + '22', borderColor: Colors.info + '55' }]}
                  onPress={() => { setMsgAlunoId(aluno.id); setMsgTexto(''); setShowMsgModal(true); }}>
                  <Ionicons name="chatbubble" size={13} color={Colors.info} />
                  <Text style={[st.atrasoActionTxt, { color: Colors.info }]}>Mensagem{unread > 0 ? ` (${unread})` : ''}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[st.atrasoActionBtn, { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '55' }]}
                  onPress={() => { setRupeAlunoId(aluno.id); setRupeTaxaId(''); setRupeValor(''); setRupeGerado(null); setShowRUPEModal(true); }}>
                  <Ionicons name="receipt" size={13} color={Colors.gold} />
                  <Text style={[st.atrasoActionTxt, { color: Colors.gold }]}>RUPE</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[st.atrasoActionBtn, { backgroundColor: (bloqueado ? Colors.success : Colors.danger) + '22', borderColor: (bloqueado ? Colors.success : Colors.danger) + '55' }]}
                  onPress={() => handleBloquear(aluno.id, bloqueado)}>
                  <Ionicons name={bloqueado ? 'lock-open' : 'lock-closed'} size={13} color={bloqueado ? Colors.success : Colors.danger} />
                  <Text style={[st.atrasoActionTxt, { color: bloqueado ? Colors.success : Colors.danger }]}>{bloqueado ? 'Desbloquear' : 'Bloquear'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    );
  }

  function renderMensagens() {
    const TIPO_MSG_CFG = {
      aviso:    { color: Colors.warning, icon: 'warning', label: 'Aviso' },
      bloqueio: { color: Colors.danger,  icon: 'lock-closed', label: 'Bloqueio' },
      rupe:     { color: Colors.gold,    icon: 'receipt', label: 'RUPE' },
      geral:    { color: Colors.info,    icon: 'chatbubble', label: 'Geral' },
    };

    return (
      <View style={{ flex: 1 }}>
        {todasMensagens.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
            <Text style={st.emptyTitle}>Sem mensagens enviadas</Text>
            <Text style={st.emptySub}>As mensagens enviadas aos estudantes aparecerão aqui.</Text>
          </View>
        ) : (
          <FlatList
            data={todasMensagens}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item: msg }) => {
              const cfg = TIPO_MSG_CFG[msg.tipo] || TIPO_MSG_CFG.geral;
              return (
                <View style={[st.msgCard, !msg.lida && { borderLeftColor: cfg.color, borderLeftWidth: 3 }]}>
                  <View style={[st.msgIconBox, { backgroundColor: cfg.color + '22' }]}>
                    <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={st.msgAluno}>{getNomeAluno(msg.alunoId)}</Text>
                      <Badge label={cfg.label} color={cfg.color} />
                    </View>
                    <Text style={st.msgTexto}>{msg.texto}</Text>
                    <Text style={st.msgData}>{new Date(msg.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
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
                    {pag.referencia && <Text style={st.pagRef}>Ref: {pag.referencia}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={st.pagValor}>{formatAOA(pag.valor)}</Text>
                    <Badge label={sc.label} color={sc.color} />
                    {pag.status === 'pendente' && (
                      <TouchableOpacity style={st.confirmarBtn} onPress={() => updatePagamento(pag.id, { status: 'pago' })}>
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

          <TouchableOpacity style={st.multaBanner} onPress={() => { setMultaPct(multaConfig.percentagem.toString()); setMultaDias(multaConfig.diasCarencia.toString()); setShowMultaModal(true); }}>
            <Ionicons name="warning" size={16} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={st.multaBannerTitle}>Multa por Atraso — {multaConfig.percentagem}% por mês</Text>
              <Text style={st.multaBannerSub}>Carência: {multaConfig.diasCarencia} dias · {multaConfig.ativo ? 'Activa' : 'Inactiva'} · Toque para configurar</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={Colors.gold} />
          </TouchableOpacity>

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
      const mesesAtras = getMesesEmAtraso(alunoPerfilId, anoAtual);
      const taxaPropina = taxasAtivas.find(t => t.tipo === 'propina');
      const multaTotal = calcularMulta(taxaPropina?.valor || 0, mesesAtras);
      const bloqueado = isAlunoBloqueado(alunoPerfilId);
      const rupesAluno = getRUPEsAluno(alunoPerfilId);
      const msgsAluno  = getMensagensAluno(alunoPerfilId);

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
              {bloqueado && <Badge label="Bloqueado" color={Colors.danger} />}
            </View>

            {bloqueado && (
              <View style={[st.alertaBanner, { backgroundColor: Colors.danger + '18', borderColor: Colors.danger + '44' }]}>
                <Ionicons name="lock-closed" size={16} color={Colors.danger} />
                <Text style={[st.alertaBannerTxt, { color: Colors.danger }]}>Acesso ao sistema bloqueado por falta de pagamento</Text>
              </View>
            )}

            {mesesAtras > 0 && (
              <View style={[st.alertaBanner, { backgroundColor: Colors.warning + '18', borderColor: Colors.warning + '44' }]}>
                <Ionicons name="time" size={16} color={Colors.warning} />
                <Text style={[st.alertaBannerTxt, { color: Colors.warning }]}>{mesesAtras} mês(es) de propina em atraso{multaConfig.ativo && multaTotal > 0 ? ` · Multa estimada: ${formatAOA(multaTotal)}` : ''}</Text>
              </View>
            )}

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

            <View style={st.perfilActionsRow}>
              <TouchableOpacity style={st.perfilActionBtn} onPress={() => { setMsgAlunoId(alunoPerfilId); setMsgTexto(''); setShowMsgModal(true); }}>
                <Ionicons name="chatbubble" size={15} color={Colors.info} />
                <Text style={[st.perfilActionTxt, { color: Colors.info }]}>Mensagem</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.perfilActionBtn} onPress={() => { setRupeAlunoId(alunoPerfilId); setRupeTaxaId(''); setRupeValor(''); setRupeGerado(null); setShowRUPEModal(true); }}>
                <Ionicons name="receipt" size={15} color={Colors.gold} />
                <Text style={[st.perfilActionTxt, { color: Colors.gold }]}>Gerar RUPE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.perfilActionBtn} onPress={() => handleBloquear(alunoPerfilId, bloqueado)}>
                <Ionicons name={bloqueado ? 'lock-open' : 'lock-closed'} size={15} color={bloqueado ? Colors.success : Colors.danger} />
                <Text style={[st.perfilActionTxt, { color: bloqueado ? Colors.success : Colors.danger }]}>{bloqueado ? 'Desbloquear' : 'Bloquear'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.perfilActionBtn} onPress={() => router.push('/boletim-propina' as any)}>
                <Ionicons name="document-text" size={15} color={Colors.success} />
                <Text style={[st.perfilActionTxt, { color: Colors.success }]}>Caderneta</Text>
              </TouchableOpacity>
            </View>

            {rupesAluno.length > 0 && (
              <>
                <Text style={st.secLabel}>RUPES GERADOS</Text>
                {rupesAluno.map(r => (
                  <View key={r.id} style={[st.pagCard, { borderLeftWidth: 2, borderLeftColor: Colors.gold }]}>
                    <View style={[st.pagIcon, { backgroundColor: Colors.gold + '22' }]}>
                      <Ionicons name="receipt" size={16} color={Colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pagTaxa}>{getNomeTaxa(r.taxaId)}</Text>
                      <Text style={[st.pagRef, { fontSize: 11 }]}>Ref: {r.referencia}</Text>
                      <Text style={st.pagMetaTxt}>Válido até: {new Date(r.dataValidade).toLocaleDateString('pt-PT')}</Text>
                    </View>
                    <Text style={[st.pagValor, { color: Colors.gold }]}>{formatAOA(r.valor)}</Text>
                  </View>
                ))}
              </>
            )}

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

            {msgsAluno.length > 0 && (
              <>
                <Text style={st.secLabel}>MENSAGENS ENVIADAS</Text>
                {msgsAluno.slice(0, 5).map(m => (
                  <View key={m.id} style={[st.msgCard, { marginBottom: 8 }]}>
                    <View style={[st.msgIconBox, { backgroundColor: Colors.info + '22' }]}>
                      <Ionicons name="chatbubble" size={14} color={Colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.msgTexto}>{m.texto}</Text>
                      <Text style={st.msgData}>{new Date(m.data).toLocaleDateString('pt-PT')}</Text>
                    </View>
                  </View>
                ))}
              </>
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
            const mAtras  = getMesesEmAtraso(a.id, anoAtual);
            const bloq    = isAlunoBloqueado(a.id);
            return (
              <TouchableOpacity style={[st.alunoCard, bloq && { borderLeftColor: Colors.danger, borderLeftWidth: 2 }]} onPress={() => setAlunoPerfilId(a.id)}>
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
                  {mAtras > 0 && <Text style={[st.alunoVal, { color: Colors.danger, fontSize: 9 }]}>{mAtras} mês(es) atraso</Text>}
                  {bloq && <Badge label="Bloq." color={Colors.danger} />}
                  {pago === 0 && pend === 0 && !mAtras && <Text style={st.alunoVal}>—</Text>}
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  const tabsConfig = [
    ['painel', 'pie-chart', 'Painel'],
    ['resumo', 'stats-chart', 'Resumo'],
    ['em_atraso', 'alert-circle', 'Em Atraso'],
    ['mensagens', 'chatbubbles', 'Mensagens'],
    ['pagamentos', 'receipt', 'Pagamentos'],
    ['rubricas', 'pricetag', 'Rubricas'],
    ['por_aluno', 'person', 'Por Aluno'],
  ] as const;

  return (
    <View style={st.container}>
      <TopBar title="Gestão Financeira" subtitle={`Ano Lectivo ${anoAtual}`} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabBarScroll} contentContainerStyle={st.tabBar}>
        {tabsConfig.map(([k, icon, label]) => (
          <TouchableOpacity key={k} style={[st.tabBtn, tab === k && st.tabBtnActive]} onPress={() => { setTab(k as TabKey); setAlunoPerfilId(null); }}>
            <Ionicons name={icon as any} size={15} color={tab === k ? Colors.gold : Colors.textMuted} />
            <Text style={[st.tabBtnTxt, tab === k && st.tabBtnTxtActive]}>{label}</Text>
            {k === 'em_atraso' && alunosEmAtraso.length > 0 && (
              <View style={st.tabBadge}>
                <Text style={st.tabBadgeTxt}>{alunosEmAtraso.length}</Text>
              </View>
            )}
            {k === 'mensagens' && mensagens.filter(m => !m.lida).length > 0 && (
              <View style={st.tabBadge}>
                <Text style={st.tabBadgeTxt}>{mensagens.filter(m => !m.lida).length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'painel'      && renderPainel()}
      {tab === 'resumo'      && renderResumo()}
      {tab === 'em_atraso'   && renderEmAtraso()}
      {tab === 'mensagens'   && renderMensagens()}
      {tab === 'pagamentos'  && renderPagamentos()}
      {tab === 'rubricas'    && renderRubricas()}
      {tab === 'por_aluno'   && renderPorAluno()}

      {/* Modal Mensagem */}
      <Modal visible={showMsgModal} transparent animationType="slide" onRequestClose={() => setShowMsgModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Enviar Mensagem Privada</Text>
              <TouchableOpacity onPress={() => setShowMsgModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={st.fieldLabel}>Destinatário</Text>
            <View style={[st.selector, { marginBottom: 12 }]}>
              <Ionicons name="person" size={14} color={Colors.gold} />
              <Text style={[st.selectorVal, { flex: 1, marginLeft: 8 }]}>{msgAlunoId ? getNomeAluno(msgAlunoId) : '—'}</Text>
            </View>
            <Text style={st.fieldLabel}>Tipo de Mensagem</Text>
            <View style={[st.metodosRow, { marginBottom: 12 }]}>
              {(['aviso', 'bloqueio', 'rupe', 'geral'] as MensagemFinanceira['tipo'][]).map(t => (
                <TouchableOpacity key={t} style={[st.metodoBtn, msgTipo === t && st.metodoBtnActive]} onPress={() => setMsgTipo(t)}>
                  <Text style={[st.metodoTxt, msgTipo === t && st.metodoTxtActive]}>
                    {t === 'aviso' ? 'Aviso' : t === 'bloqueio' ? 'Bloqueio' : t === 'rupe' ? 'RUPE' : 'Geral'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={st.fieldLabel}>Mensagem *</Text>
            <TextInput
              style={[st.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Escreva a mensagem para o estudante..."
              placeholderTextColor={Colors.textMuted}
              multiline
              value={msgTexto}
              onChangeText={setMsgTexto}
            />
            <TouchableOpacity style={st.saveBtn} onPress={handleEnviarMensagem}>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={st.saveBtnTxt}>Enviar Mensagem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal RUPE */}
      <Modal visible={showRUPEModal} transparent animationType="slide" onRequestClose={() => { setShowRUPEModal(false); setRupeGerado(null); }}>
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Gerar RUPE</Text>
              <TouchableOpacity onPress={() => { setShowRUPEModal(false); setRupeGerado(null); }}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            {rupeGerado ? (
              <View style={{ alignItems: 'center', gap: 12, padding: 8 }}>
                <View style={{ backgroundColor: Colors.success + '22', borderRadius: 40, width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                </View>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.text, textAlign: 'center' }}>RUPE Gerado com Sucesso</Text>
                <View style={{ backgroundColor: Colors.surface, borderRadius: 12, padding: 14, width: '100%', borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted, marginBottom: 4 }}>Referência</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: Colors.gold }}>{rupeGerado.referencia}</Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 8, marginBottom: 4 }}>Valor</Text>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: Colors.text }}>{formatAOA(rupeGerado.valor)}</Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 8, marginBottom: 4 }}>Válido até</Text>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text }}>{new Date(rupeGerado.dataValidade).toLocaleDateString('pt-PT')}</Text>
                </View>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted, textAlign: 'center' }}>O estudante foi notificado com a referência.</Text>
                <TouchableOpacity style={st.saveBtn} onPress={() => { setShowRUPEModal(false); setRupeGerado(null); }}>
                  <Text style={st.saveBtnTxt}>Fechar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={st.fieldLabel}>Estudante</Text>
                <View style={[st.selector, { marginBottom: 12 }]}>
                  <Ionicons name="person" size={14} color={Colors.gold} />
                  <Text style={[st.selectorVal, { flex: 1, marginLeft: 8 }]}>{rupeAlunoId ? getNomeAluno(rupeAlunoId) : '—'}</Text>
                </View>
                <Text style={st.fieldLabel}>Rubrica *</Text>
                <TouchableOpacity style={st.selector} onPress={() => setShowTaxaList(v => !v)}>
                  <Text style={rupeTaxaId ? st.selectorVal : st.selectorPh}>
                    {rupeTaxaId ? getNomeTaxa(rupeTaxaId) : 'Selecionar rubrica...'}
                  </Text>
                  <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
                </TouchableOpacity>
                {showTaxaList && (
                  <ScrollView style={st.dropList} nestedScrollEnabled>
                    {taxasAtivas.map(t => (
                      <TouchableOpacity key={t.id} style={[st.dropItem, rupeTaxaId === t.id && st.dropItemActive]}
                        onPress={() => { setRupeTaxaId(t.id); setRupeValor(t.valor.toString()); setShowTaxaList(false); }}>
                        <Text style={[st.dropItemTxt, rupeTaxaId === t.id && { color: Colors.gold }]}>{t.descricao}</Text>
                        <Text style={st.dropItemSub}>{formatAOA(t.valor)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <Text style={st.fieldLabel}>Valor (AOA)</Text>
                <TextInput style={st.input} placeholder="Preenchido automaticamente" placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric" value={rupeValor} onChangeText={setRupeValor} />
                <TouchableOpacity style={st.saveBtn} onPress={handleGerarRUPE}>
                  <Ionicons name="receipt" size={16} color="#fff" />
                  <Text style={st.saveBtnTxt}>Gerar RUPE</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Multa */}
      <Modal visible={showMultaModal} transparent animationType="slide" onRequestClose={() => setShowMultaModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Configurar Multa de Atraso</Text>
              <TouchableOpacity onPress={() => setShowMultaModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={st.rubricaInfoBanner}>
              <Ionicons name="information-circle" size={14} color={Colors.info} />
              <Text style={[st.rubricaInfoTxt, { fontSize: 11 }]}>
                A multa é calculada automaticamente com base nos meses de atraso e aparece no perfil financeiro do estudante.
              </Text>
            </View>
            <Text style={st.fieldLabel}>Percentagem por mês de atraso (%)</Text>
            <TextInput style={st.input} placeholder="Ex: 10" placeholderTextColor={Colors.textMuted}
              keyboardType="numeric" value={multaPct} onChangeText={setMultaPct} />
            <Text style={st.fieldLabel}>Dias de carência (sem multa)</Text>
            <TextInput style={st.input} placeholder="Ex: 5" placeholderTextColor={Colors.textMuted}
              keyboardType="numeric" value={multaDias} onChangeText={setMultaDias} />
            <Text style={st.fieldLabel}>Estado</Text>
            <View style={st.metodosRow}>
              <TouchableOpacity style={[st.metodoBtn, multaConfig.ativo && st.metodoBtnActive]} onPress={() => updateMultaConfig({ ativo: true })}>
                <Text style={[st.metodoTxt, multaConfig.ativo && st.metodoTxtActive]}>Activa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.metodoBtn, !multaConfig.ativo && st.metodoBtnActive]} onPress={() => updateMultaConfig({ ativo: false })}>
                <Text style={[st.metodoTxt, !multaConfig.ativo && st.metodoTxtActive]}>Inactiva</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[st.saveBtn, { marginTop: 16 }]} onPress={handleSalvarMulta}>
              <Ionicons name="save" size={16} color="#fff" />
              <Text style={st.saveBtnTxt}>Guardar Configuração</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  tabBarScroll: { backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 58, flexGrow: 0 },
  tabBar: { flexDirection: 'row', alignItems: 'center' },
  tabBtn: { alignItems: 'center', gap: 2, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', position: 'relative' },
  tabBtnActive: { borderBottomColor: Colors.gold },
  tabBtnTxt: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabBtnTxtActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  tabBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff' },
  secLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpiCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border },
  kpiVal: { fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'center', color: Colors.text },
  kpiLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  progressCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  progressPct: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, marginBottom: 6 },
  progressFill: { height: 8, borderRadius: 4 },
  progressSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  multaBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.warning + '15', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.warning + '44' },
  multaBannerTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  multaBannerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  multaEditBtn: { backgroundColor: Colors.gold + '22', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: Colors.gold + '44' },
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
  fab: { position: 'absolute', bottom: 20, right: 16, backgroundColor: Colors.accent, borderRadius: 28, paddingHorizontal: 20, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  rubricaInfoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.info + '15', borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: Colors.info + '33' },
  rubricaInfoTxt: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 },
  grupoIconBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  grupoTitle: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  grupoCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  rubricaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  rubricaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rubricaNome: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginRight: 8 },
  rubricaMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rubricaMetaTxt: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  rubricaActions: { flexDirection: 'row', gap: 4 },
  rubricaActionBtn: { padding: 6, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, paddingLeft: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  alunoPerfilCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  alunoAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alunoAvatarTxt: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  alunoNome: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoMat: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  alunoTurma: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  alertaBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1 },
  alertaBannerTxt: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  perfilActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  perfilActionBtn: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border },
  perfilActionTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  alunoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  alunoNumBox: { width: 28, alignItems: 'center' },
  alunoNum: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  alunoAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alunoAvatarSmallTxt: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  alunoVal: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%', width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  selectorVal: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  selectorPh: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  dropList: { maxHeight: 160, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropItemActive: { backgroundColor: Colors.accent + '22' },
  dropItemTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  dropItemSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  metodosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metodoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  metodoBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  metodoTxt: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  metodoTxtActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  mesBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  mesBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  mesTxt: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  mesTxtActive: { color: '#fff' },
  tipoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tipoChipTxt: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  saveBtnTxt: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  atrasoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger + '18', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.danger + '44' },
  atrasoHeaderTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.danger },
  atrasoCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  atrasoAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  atrasoAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.warning + '44', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  atrasoAvatarTxt: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.warning },
  atrasoNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  atrasoMat: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  atrasoStats: { gap: 4, marginBottom: 10 },
  atrasoStatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  atrasoStatTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  atrasoActions: { flexDirection: 'row', gap: 8 },
  atrasoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 8, borderWidth: 1 },
  atrasoActionTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  msgCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  msgIconBox: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAluno: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  msgTexto: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 4, lineHeight: 17 },
  msgData: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 4 },
});
