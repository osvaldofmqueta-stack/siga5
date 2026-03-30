import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Platform,
  Linking,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useFinanceiro, formatAOA, Pagamento } from '@/context/FinanceiroContext';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useUsers } from '@/context/UsersContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { alertSucesso, alertErro } from '@/utils/toast';
import { webAlert } from '@/utils/webAlert';

const MESES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return iso; }
}

function fmtDateHour(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return iso; }
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

type TabKey = 'pendentes' | 'multicaixa' | 'referencias' | 'atrasos';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'pendentes', label: 'Pendentes', icon: 'time' },
  { key: 'multicaixa', label: 'Multicaixa', icon: 'phone-portrait' },
  { key: 'referencias', label: 'Referências', icon: 'barcode' },
  { key: 'atrasos', label: 'Em Atraso', icon: 'alert-circle' },
];

const STATUS_CFG = {
  pago:      { color: Colors.success, bg: Colors.success + '22', label: 'Pago', icon: 'checkmark-circle' as const },
  pendente:  { color: Colors.warning, bg: Colors.warning + '22', label: 'Pendente', icon: 'time' as const },
  cancelado: { color: Colors.textMuted, bg: Colors.border, label: 'Cancelado', icon: 'close-circle' as const },
};

const METODO_CFG: Record<string, { label: string; color: string; icon: string }> = {
  dinheiro:     { label: 'Dinheiro', color: Colors.success, icon: 'cash' },
  transferencia:{ label: 'RUPE / Transf.', color: Colors.info, icon: 'swap-horizontal' },
  multicaixa:   { label: 'Multicaixa', color: '#e11d48', icon: 'phone-portrait' },
};

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + '55' }}>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color }}>{label}</Text>
    </View>
  );
}

function StatCard({ value, label, color, icon }: { value: string; label: string; color: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function PagamentosHubScreen() {
  const insets = useSafeAreaInsets();
  const { pagamentos, taxas, rupes, updatePagamento, isLoading, getMesesEmAtraso } = useFinanceiro();
  const { alunos, turmas } = useData();
  const { user } = useAuth();
  const { users } = useUsers();
  const { config } = useConfig();
  const { anoSelecionado } = useAnoAcademico();

  const [activeTab, setActiveTab] = useState<TabKey>('pendentes');
  const [filterMetodo, setFilterMetodo] = useState<string>('todos');
  const [filterTurma, setFilterTurma] = useState<string>('todas');
  const [filterMes, setFilterMes] = useState<number>(0);
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; nome: string } | null>(null);
  const [rejectObs, setRejectObs] = useState('');

  const anoLetivo = anoSelecionado?.ano || '';

  // ─── Derived data ────────────────────────────────────────────────────────────

  const alunoMap = useMemo(() => Object.fromEntries(alunos.map(a => [a.id, a])), [alunos]);
  const turmaMap = useMemo(() => Object.fromEntries(turmas.map(t => [t.id, t])), [turmas]);

  const enricPagamento = useCallback((p: Pagamento) => {
    const aluno = alunoMap[p.alunoId];
    const turma = aluno ? turmaMap[aluno.turmaId || ''] : null;
    const userEnc = users.find(u => u.alunoId === aluno?.id);
    const taxa = taxas.find(t => t.id === p.taxaId);
    return { ...p, aluno, turma, userEnc, taxa };
  }, [alunoMap, turmaMap, users, taxas]);

  const pendentes = useMemo(() =>
    pagamentos
      .filter(p => p.status === 'pendente')
      .map(enricPagamento)
      .filter(p => {
        if (filterMetodo !== 'todos' && p.metodoPagamento !== filterMetodo) return false;
        if (filterTurma !== 'todas' && p.turma?.id !== filterTurma) return false;
        if (filterMes > 0 && p.mes !== filterMes) return false;
        if (searchText) {
          const q = searchText.toLowerCase();
          return (p.aluno?.nomeCompleto || '').toLowerCase().includes(q) ||
            (p.referencia || '').toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [pagamentos, enricPagamento, filterMetodo, filterTurma, filterMes, searchText]
  );

  const multicaixaPendentes = useMemo(() =>
    pendentes.filter(p => p.metodoPagamento === 'multicaixa'),
    [pendentes]
  );

  const confirmadosHoje = useMemo(() =>
    pagamentos.filter(p => {
      if (p.status !== 'pago') return false;
      const d = new Date(p.data || p.createdAt);
      const today = new Date();
      return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    }).map(enricPagamento),
    [pagamentos, enricPagamento]
  );

  const totalPendente = useMemo(() =>
    pendentes.reduce((s, p) => s + (p.valor || 0), 0), [pendentes]);

  const alunosEmAtraso = useMemo(() => {
    const result = alunos.map(a => {
      const meses = getMesesEmAtraso(a.id, anoLetivo);
      const turma = a.turmaId ? turmaMap[a.turmaId] : null;
      const userEnc = users.find(u => u.alunoId === a.id);
      return { aluno: a, turma, userEnc, meses };
    }).filter(x => x.meses > 0);
    return result.sort((a, b) => b.meses - a.meses);
  }, [alunos, getMesesEmAtraso, anoLetivo, turmaMap, users]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function openPDFRecibo(pagamentoId: string) {
    if (Platform.OS !== 'web') return;
    window.open(`/api/pdf/recibo/${pagamentoId}`, '_blank');
  }

  async function confirmarPagamento(id: string, autoRecibo = true) {
    setConfirming(prev => new Set([...prev, id]));
    try {
      await updatePagamento(id, { status: 'pago', data: new Date().toISOString() });
      alertSucesso('Pagamento confirmado!');
      if (autoRecibo && Platform.OS === 'web') {
        setTimeout(() => openPDFRecibo(id), 400);
      }
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      alertErro('Erro ao confirmar pagamento');
    } finally {
      setConfirming(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function rejeitarPagamento(id: string, obs: string) {
    try {
      await updatePagamento(id, { status: 'cancelado', observacao: obs || undefined });
      alertSucesso('Pagamento cancelado');
      setRejectModal(null);
      setRejectObs('');
    } catch {
      alertErro('Erro ao cancelar pagamento');
    }
  }

  async function confirmarSelecionados() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    webAlert(
      'Confirmar Pagamentos',
      `Confirmar ${ids.length} pagamento(s) seleccionado(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Confirmar ${ids.length}`,
          onPress: async () => {
            for (const id of ids) {
              await confirmarPagamento(id, false);
            }
            setSelectedIds(new Set());
            alertSucesso(`${ids.length} pagamento(s) confirmado(s)`);
          },
        },
      ]
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function whatsappGuardian(telefone?: string, alunoNome?: string, valor?: number, mes?: number, ano?: string) {
    if (!telefone) { alertErro('Sem número de contacto para o encarregado'); return; }
    const mesTxt = mes ? MESES_FULL[mes] : '';
    const msg = `Olá! Informamos que recebemos o pagamento${mesTxt ? ` de ${mesTxt}` : ''}${ano ? ` ${ano}` : ''}${alunoNome ? ` do(a) aluno(a) ${alunoNome}` : ''}${valor ? ` no valor de ${formatAOA(valor)}` : ''}. Obrigado!`;
    const url = `https://wa.me/+244${telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url);
  }

  // ─── Renders ─────────────────────────────────────────────────────────────────

  function renderPagamentoRow({ item: p, inMulticaixa = false }: { item: any; inMulticaixa?: boolean }) {
    const isSelected = selectedIds.has(p.id);
    const isConfirming = confirming.has(p.id);
    const metCfg = METODO_CFG[p.metodoPagamento] || METODO_CFG.dinheiro;
    const mesTxt = p.mes ? MESES_FULL[p.mes] : '';

    return (
      <View style={[styles.pagRow, isSelected && styles.pagRowSelected]}>
        <TouchableOpacity style={styles.pagRowCheck} onPress={() => toggleSelect(p.id)}>
          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="white" />}
          </View>
        </TouchableOpacity>

        <View style={styles.pagRowContent}>
          <View style={styles.pagRowTop}>
            <Text style={styles.pagAlunoNome} numberOfLines={1}>
              {p.aluno?.nomeCompleto || '—'}
            </Text>
            <Text style={styles.pagValor}>{formatAOA(p.valor)}</Text>
          </View>

          <View style={styles.pagRowMid}>
            <Text style={styles.pagTurma}>{p.turma?.nome || '—'}</Text>
            {mesTxt ? <Text style={styles.pagMes}>{mesTxt} {p.ano || ''}</Text> : null}
            <Badge label={metCfg.label} color={metCfg.color} bg={metCfg.color + '22'} />
          </View>

          {p.referencia ? (
            <Text style={styles.pagRef} numberOfLines={1}>Ref: {p.referencia}</Text>
          ) : null}

          {inMulticaixa && p.userEnc?.telefone ? (
            <Text style={styles.pagTel}>📞 {p.userEnc.telefone}</Text>
          ) : null}

          <View style={styles.pagActions}>
            <Text style={styles.pagDate}>{fmtDateHour(p.createdAt)}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {inMulticaixa && p.userEnc?.telefone && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#25d36622' }]}
                  onPress={() => whatsappGuardian(p.userEnc?.telefone, p.aluno?.nomeCompleto, p.valor, p.mes, p.ano)}
                >
                  <FontAwesome5 name="whatsapp" size={14} color="#25d366" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.danger + '22' }]}
                onPress={() => setRejectModal({ id: p.id, nome: p.aluno?.nomeCompleto || '?' })}
              >
                <Ionicons name="close" size={14} color={Colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnConfirm]}
                onPress={() => confirmarPagamento(p.id)}
                disabled={isConfirming}
              >
                {isConfirming
                  ? <ActivityIndicator size="small" color="white" />
                  : <><Ionicons name="checkmark" size={14} color="white" /><Text style={styles.confirmarTxt}>Confirmar</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function renderReferencia({ item: r }: { item: any }) {
    const aluno = alunoMap[r.alunoId];
    const turma = aluno ? turmaMap[aluno.turmaId || ''] : null;
    const isActive = r.status === 'ativo';
    const isPago = r.status === 'pago';
    const color = isActive ? Colors.warning : isPago ? Colors.success : Colors.textMuted;

    return (
      <View style={styles.rupeRow}>
        <View style={[styles.rupeStatus, { backgroundColor: color + '22' }]}>
          <Ionicons name={isPago ? 'checkmark-circle' : isActive ? 'time' : 'close-circle'} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rupeNome}>{aluno?.nomeCompleto || '—'}</Text>
          <Text style={styles.rupeTurma}>{turma?.nome || '—'}</Text>
          <Text style={styles.rupeRef} numberOfLines={1}>{r.referencia}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
            <Text style={styles.rupeDate}>Gerado: {fmtDate(r.dataGeracao)}</Text>
            <Text style={styles.rupeDate}>Validade: {fmtDate(r.dataValidade)}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge
            label={isActive ? 'Activo' : isPago ? 'Pago' : 'Expirado'}
            color={color}
            bg={color + '22'}
          />
          <Text style={styles.rupeValor}>{formatAOA(r.valor)}</Text>
        </View>
      </View>
    );
  }

  function renderAtraso({ item }: { item: typeof alunosEmAtraso[0] }) {
    const { aluno, turma, userEnc, meses } = item;
    const urgente = meses >= 3;
    const color = urgente ? Colors.danger : Colors.warning;
    const pagEmAtraso = pagamentos.filter(p =>
      p.alunoId === aluno.id && p.status === 'pendente'
    );
    const totalDebt = pagEmAtraso.reduce((s, p) => s + (p.valor || 0), 0);

    return (
      <View style={[styles.atrasoRow, { borderLeftColor: color }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.atrasoNome}>{aluno.nomeCompleto}</Text>
            <Badge label={`${meses} mês${meses !== 1 ? 'es' : ''}`} color={color} bg={color + '22'} />
          </View>
          <Text style={styles.atrasoTurma}>{turma?.nome || '—'}</Text>
          {totalDebt > 0 && (
            <Text style={[styles.atrasoDebt, { color }]}>Em dívida: {formatAOA(totalDebt)}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {userEnc?.telefone && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#25d36622' }]}
              onPress={() => {
                const msg = `Estimado Encarregado, o(a) aluno(a) ${aluno.nomeCompleto} tem ${meses} propina(s) por pagar. Por favor regularize a situação. Obrigado.`;
                Linking.openURL(`https://wa.me/+244${userEnc.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`);
              }}
            >
              <FontAwesome5 name="whatsapp" size={14} color="#25d366" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.info + '22' }]}
            onPress={() => {
              if (Platform.OS === 'web') {
                window.open(`/api/pdf/recibos-aluno/${aluno.id}?status=pendente`, '_blank');
              }
            }}
          >
            <Ionicons name="document-text" size={14} color={Colors.info} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Tab content ─────────────────────────────────────────────────────────────

  function TabPendentes() {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(['todos','dinheiro','multicaixa','transferencia'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.filterChip, filterMetodo === m && styles.filterChipActive]}
                onPress={() => setFilterMetodo(m)}
              >
                <Text style={[styles.filterChipTxt, filterMetodo === m && styles.filterChipTxtActive]}>
                  {m === 'todos' ? 'Todos' : METODO_CFG[m]?.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.filterSep} />
            {([0,9,10,11,12,1,2,3,4,5,6,7] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.filterChip, filterMes === m && styles.filterChipActive]}
                onPress={() => setFilterMes(m)}
              >
                <Text style={[styles.filterChipTxt, filterMes === m && styles.filterChipTxtActive]}>
                  {m === 0 ? 'Todos meses' : MESES[m]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar aluno ou referência..."
              placeholderTextColor={Colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          {selectedIds.size > 0 && (
            <TouchableOpacity style={styles.bulkBtn} onPress={confirmarSelecionados}>
              <Ionicons name="checkmark-done" size={16} color="white" />
              <Text style={styles.bulkBtnTxt}>Confirmar ({selectedIds.size})</Text>
            </TouchableOpacity>
          )}
        </View>

        {pendentes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success + '88'} />
            <Text style={styles.emptyTitle}>Tudo em dia!</Text>
            <Text style={styles.emptyDesc}>Não há pagamentos pendentes.</Text>
          </View>
        ) : (
          <FlatList
            data={pendentes}
            keyExtractor={p => p.id}
            renderItem={({ item }) => renderPagamentoRow({ item })}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  function TabMulticaixa() {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.multicaixaHeader}>
          <View style={[styles.multicaixaInfoBox, { backgroundColor: '#e11d4822' }]}>
            <MaterialCommunityIcons name="cellphone" size={20} color="#e11d48" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.multicaixaInfoLabel}>Número Multicaixa Express da Escola</Text>
              <Text style={styles.multicaixaInfoVal}>
                {config?.telefoneMulticaixaExpress || 'Não configurado — vai a Configurações'}
              </Text>
            </View>
            {config?.telefoneMulticaixaExpress && (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web') {
                    navigator.clipboard?.writeText(config.telefoneMulticaixaExpress || '');
                    alertSucesso('Número copiado!');
                  }
                }}
              >
                <Ionicons name="copy" size={18} color="#e11d48" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.multicaixaHint}>
            Verifique cada pagamento no extrato Multicaixa Express e confirme abaixo.
          </Text>
        </View>

        {multicaixaPendentes.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cellphone-check" size={48} color={Colors.success + '88'} />
            <Text style={styles.emptyTitle}>Sem pendentes Multicaixa</Text>
            <Text style={styles.emptyDesc}>Nenhum pagamento Multicaixa por confirmar.</Text>
          </View>
        ) : (
          <FlatList
            data={multicaixaPendentes}
            keyExtractor={p => p.id}
            renderItem={({ item }) => renderPagamentoRow({ item, inMulticaixa: true })}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              multicaixaPendentes.length > 0 && selectedIds.size === 0 ? (
                <TouchableOpacity
                  style={[styles.bulkBtnFull, { marginBottom: 8 }]}
                  onPress={() => setSelectedIds(new Set(multicaixaPendentes.map(p => p.id)))}
                >
                  <Ionicons name="checkmark-done-circle" size={16} color="white" />
                  <Text style={styles.bulkBtnTxt}>Seleccionar todos ({multicaixaPendentes.length})</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}

        {selectedIds.size > 0 && (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkBarTxt}>{selectedIds.size} seleccionado(s)</Text>
            <TouchableOpacity style={styles.bulkBarBtn} onPress={confirmarSelecionados}>
              <Ionicons name="checkmark" size={16} color="white" />
              <Text style={styles.bulkBtnTxt}>Confirmar selecionados</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function TabReferencias() {
    const rupesEnric = useMemo(() =>
      rupes
        .filter(r => r.status === 'ativo' || r.status === 'pago')
        .sort((a, b) => new Date(b.dataGeracao).getTime() - new Date(a.dataGeracao).getTime()),
      [rupes]
    );

    const totalAtivo = rupes.filter(r => r.status === 'ativo').reduce((s, r) => s + (r.valor || 0), 0);
    const totalPago = rupes.filter(r => r.status === 'pago').reduce((s, r) => s + (r.valor || 0), 0);

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.refStats}>
          <View style={styles.refStat}>
            <Text style={[styles.refStatVal, { color: Colors.warning }]}>{rupes.filter(r => r.status === 'ativo').length}</Text>
            <Text style={styles.refStatLbl}>RUPEs Activos</Text>
            <Text style={[styles.refStatSub, { color: Colors.warning }]}>{formatAOA(totalAtivo)}</Text>
          </View>
          <View style={[styles.refSep]} />
          <View style={styles.refStat}>
            <Text style={[styles.refStatVal, { color: Colors.success }]}>{rupes.filter(r => r.status === 'pago').length}</Text>
            <Text style={styles.refStatLbl}>RUPEs Pagos</Text>
            <Text style={[styles.refStatSub, { color: Colors.success }]}>{formatAOA(totalPago)}</Text>
          </View>
          <View style={[styles.refSep]} />
          <View style={styles.refStat}>
            <Text style={[styles.refStatVal, { color: Colors.textMuted }]}>{rupes.filter(r => r.status === 'expirado').length}</Text>
            <Text style={styles.refStatLbl}>Expirados</Text>
          </View>
        </View>

        {rupesEnric.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barcode" size={48} color={Colors.textMuted + '88'} />
            <Text style={styles.emptyTitle}>Sem referências</Text>
            <Text style={styles.emptyDesc}>As referências RUPE geradas aparecerão aqui.</Text>
          </View>
        ) : (
          <FlatList
            data={rupesEnric}
            keyExtractor={r => r.id}
            renderItem={renderReferencia}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  function TabAtrasos() {
    return (
      <View style={{ flex: 1 }}>
        {alunosEmAtraso.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy" size={48} color={Colors.success + '88'} />
            <Text style={styles.emptyTitle}>Parabéns!</Text>
            <Text style={styles.emptyDesc}>Nenhum aluno com propinas em atraso.</Text>
          </View>
        ) : (
          <FlatList
            data={alunosEmAtraso}
            keyExtractor={x => x.aluno.id}
            renderItem={renderAtraso}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.atrasoHeader}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.atrasoHeaderTxt}>
                  {alunosEmAtraso.length} aluno(s) com propinas em atraso
                </Text>
                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => window.open('/api/pdf/recibos-pendentes', '_blank')}
                  >
                    <Ionicons name="download" size={14} color={Colors.info} />
                    <Text style={[styles.exportBtnTxt, { color: Colors.info }]}>Exportar pendentes</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TopBar title="Hub de Pagamentos" />

      {/* Stats header */}
      <LinearGradient colors={['#0f1729', '#1a2b5f']} style={styles.statsBar}>
        <StatCard
          value={String(pendentes.length)}
          label="Pendentes"
          color={Colors.warning}
          icon="time"
        />
        <View style={styles.statsDivider} />
        <StatCard
          value={formatAOA(totalPendente)}
          label="Valor pendente"
          color={Colors.danger}
          icon="cash"
        />
        <View style={styles.statsDivider} />
        <StatCard
          value={String(confirmadosHoje.length)}
          label="Confirmados hoje"
          color={Colors.success}
          icon="checkmark-circle"
        />
        <View style={styles.statsDivider} />
        <StatCard
          value={String(alunosEmAtraso.length)}
          label="Em atraso"
          color={Colors.textMuted}
          icon="alert-circle"
        />
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {TABS.map(t => {
            const isActive = activeTab === t.key;
            const badge =
              t.key === 'pendentes' ? pendentes.length :
              t.key === 'multicaixa' ? multicaixaPendentes.length :
              t.key === 'atrasos' ? alunosEmAtraso.length : 0;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => { setActiveTab(t.key); setSelectedIds(new Set()); }}
              >
                <Ionicons name={t.icon as any} size={16} color={isActive ? Colors.gold : Colors.textMuted} />
                <Text style={[styles.tabTxt, isActive && styles.tabTxtActive]}>{t.label}</Text>
                {badge > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: t.key === 'atrasos' ? Colors.danger : Colors.warning }]}>
                    <Text style={styles.tabBadgeTxt}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'pendentes' && <TabPendentes />}
        {activeTab === 'multicaixa' && <TabMulticaixa />}
        {activeTab === 'referencias' && <TabReferencias />}
        {activeTab === 'atrasos' && <TabAtrasos />}
      </View>

      {/* Reject modal */}
      <Modal visible={!!rejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cancelar Pagamento</Text>
            <Text style={styles.modalDesc}>
              Aluno: <Text style={{ color: Colors.text }}>{rejectModal?.nome}</Text>
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Motivo / observação (opcional)"
              placeholderTextColor={Colors.textMuted}
              value={rejectObs}
              onChangeText={setRejectObs}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, backgroundColor: Colors.card }]}
                onPress={() => { setRejectModal(null); setRejectObs(''); }}
              >
                <Text style={{ color: Colors.textMuted, fontFamily: 'Inter_600SemiBold' }}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, backgroundColor: Colors.danger }]}
                onPress={() => rejectModal && rejeitarPagamento(rejectModal.id, rejectObs)}
              >
                <Text style={{ color: 'white', fontFamily: 'Inter_600SemiBold' }}>Cancelar Pagamento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  statsBar: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 3 },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  statLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  statsDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },

  tabsRow: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { paddingHorizontal: 12, gap: 4, paddingVertical: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.card,
  },
  tabActive: { backgroundColor: Colors.primary + '22' },
  tabTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabTxtActive: { color: Colors.gold },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeTxt: { fontSize: 10, fontFamily: 'Inter_700Bold', color: 'white' },

  filterBar: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipTxt: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  filterChipTxtActive: { color: 'white' },
  filterSep: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, outlineWidth: 0 } as any,

  pagRow: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  pagRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '11' },
  pagRowCheck: {
    width: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pagRowContent: { flex: 1, padding: 10 },
  pagRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pagAlunoNome: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginRight: 8 },
  pagValor: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.gold },
  pagRowMid: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  pagTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  pagMes: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text },
  pagRef: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontStyle: 'italic', marginBottom: 2 },
  pagTel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 4 },
  pagActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  pagDate: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
  },
  actionBtnConfirm: { backgroundColor: Colors.success },
  confirmarTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: 'white' },

  bulkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  bulkBtnFull: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    backgroundColor: Colors.success, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  bulkBtnTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: 'white' },
  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  bulkBarTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  bulkBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },

  multicaixaHeader: { padding: 12, gap: 8 },
  multicaixaInfoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e11d4833',
  },
  multicaixaInfoLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  multicaixaInfoVal: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#e11d48' },
  multicaixaHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, lineHeight: 18 },

  rupeRow: {
    flexDirection: 'row', gap: 10, backgroundColor: Colors.card,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'flex-start',
  },
  rupeStatus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rupeNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  rupeTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  rupeRef: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontFamily: 'monospace' as any, marginTop: 2 },
  rupeDate: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  rupeValor: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold },

  refStats: {
    flexDirection: 'row', backgroundColor: Colors.card,
    margin: 12, borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  refStat: { flex: 1, alignItems: 'center', gap: 2 },
  refSep: { width: 1, height: 40, backgroundColor: Colors.border },
  refStatVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  refStatLbl: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  refStatSub: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },

  atrasoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3,
  },
  atrasoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap',
  },
  atrasoHeaderTxt: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.danger },
  atrasoNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  atrasoTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  atrasoDebt: { fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportBtnTxt: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 10 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.danger },
  modalDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 10, color: Colors.text, fontFamily: 'Inter_400Regular',
    fontSize: 13, minHeight: 70, backgroundColor: Colors.background,
  },
  modalBtn: {
    paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});
