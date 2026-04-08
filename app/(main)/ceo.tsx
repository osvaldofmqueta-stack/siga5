import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Clipboard,
  Animated
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import {
  useLicense, TipoPlano, TipoNivel, CodigoAtivacao,
  PLANO_LABEL, PLANO_DIAS,
  NIVEL_LABEL, NIVEL_COLOR, NIVEL_EMOJI, NIVEL_DESC, NIVEL_FEATURES,
  PRECO_POR_ALUNO_DEFAULT,
} from '@/context/LicenseContext';
import { useData } from '@/context/DataContext';
import { api } from '@/lib/api';
import { webAlert } from '@/utils/webAlert';
import { useEnterToSave } from '@/hooks/useEnterToSave';

// ── Preço base por aluno por nível ──────────────────────────────────────────
export const PRECO_NIVEL: Record<TipoNivel, number> = {
  prata: 30,
  ouro: 50,
  rubi: 75,
};

// Multiplicador de desconto por duração (anual = 2 meses grátis ≈ 83%)
export const DESCONTO_PLANO: Record<TipoPlano, number> = {
  avaliacao: 0,
  mensal: 1.0,
  trimestral: 0.97,   // 3% desconto
  semestral: 0.92,    // 8% desconto
  anual: 0.83,        // ~17% desconto (2 meses grátis)
};

export const DESCONTO_LABEL: Record<TipoPlano, string> = {
  avaliacao: '',
  mensal: '',
  trimestral: '-3%',
  semestral: '-8%',
  anual: '2 meses grátis',
};

const PLANO_PRECO: Record<TipoPlano, string> = {
  avaliacao: 'Grátis',
  mensal: '× alunos × KZ/aluno',
  trimestral: '× alunos × KZ/aluno  (-3%)',
  semestral: '× alunos × KZ/aluno  (-8%)',
  anual: '× alunos × KZ/aluno  (2 meses grátis)',
};

const PLANO_COLOR: Record<TipoPlano, string> = {
  avaliacao: Colors.textMuted,
  mensal: Colors.info,
  trimestral: Colors.warning,
  semestral: Colors.success,
  anual: Colors.gold,
};

type Section = 'dashboard' | 'codigos' | 'gerar' | 'historico';

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: string;
}) {
  return (
    <View style={[sS.statCard, { borderColor: color + '40' }]}>
      <View style={[sS.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[sS.statValue, { color }]}>{value}</Text>
      <Text style={sS.statLabel}>{label}</Text>
      {sub && <Text style={sS.statSub}>{sub}</Text>}
    </View>
  );
}

function CodigoCard({ cod, onCopy, onRevogar }: {
  cod: CodigoAtivacao;
  onCopy: () => void;
  onRevogar: () => void;
}) {
  const cor = PLANO_COLOR[cod.plano];
  const expirado = new Date(cod.dataExpiracaoCodigo) < new Date();
  return (
    <View style={[cS.card, cod.usado && cS.cardUsado, expirado && !cod.usado && cS.cardExpirado]}>
      <View style={cS.cardTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[cS.planoPill, { backgroundColor: NIVEL_COLOR[cod.nivel || 'rubi'] + '22', borderColor: NIVEL_COLOR[cod.nivel || 'rubi'] + '55' }]}>
            <Text style={{ fontSize: 10 }}>{NIVEL_EMOJI[cod.nivel || 'rubi']}</Text>
            <Text style={[cS.planoText, { color: NIVEL_COLOR[cod.nivel || 'rubi'] }]}>{NIVEL_LABEL[cod.nivel || 'rubi']}</Text>
          </View>
          <View style={[cS.planoPill, { backgroundColor: cor + '22', borderColor: cor + '55' }]}>
            <Text style={[cS.planoText, { color: cor }]}>{PLANO_LABEL[cod.plano]}</Text>
          </View>
        </View>
        <View style={cS.actions}>
          {!cod.usado && !expirado && (
            <TouchableOpacity onPress={onCopy} style={cS.actionBtn}>
              <Ionicons name="copy-outline" size={16} color={Colors.gold} />
            </TouchableOpacity>
          )}
          {!cod.usado && (
            <TouchableOpacity onPress={onRevogar} style={[cS.actionBtn, { backgroundColor: Colors.danger + '22' }]}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={cS.codigo} selectable>{cod.codigo}</Text>

      <View style={cS.metaRow}>
        <View style={cS.metaItem}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={cS.metaText}>{cod.diasValidade} dias</Text>
        </View>
        {(cod.valorFinal != null && cod.valorFinal >= 0) ? (
          <View style={cS.metaItem}>
            <Ionicons name="cash-outline" size={12} color={Colors.gold} />
            <Text style={[cS.metaText, { color: Colors.gold }]}>
              {(cod.valorFinal).toLocaleString('pt-AO')} KZ
            </Text>
          </View>
        ) : null}
        {(cod.totalAlunos != null && cod.totalAlunos > 0) ? (
          <View style={cS.metaItem}>
            <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
            <Text style={cS.metaText}>{cod.totalAlunos} alunos</Text>
          </View>
        ) : null}
        <View style={cS.metaItem}>
          <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
          <Text style={cS.metaText}>Gerado: {cod.dataGeracao}</Text>
        </View>
      </View>

      {cod.notas ? <Text style={cS.notas}>{cod.notas}</Text> : null}

      <View style={cS.statusRow}>
        {cod.usado ? (
          <View style={cS.statusUsado}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={[cS.statusText, { color: Colors.success }]}>
              Usado por {cod.usadoPor} em {cod.usadoEm}
            </Text>
          </View>
        ) : expirado ? (
          <View style={cS.statusUsado}>
            <Ionicons name="close-circle" size={14} color={Colors.danger} />
            <Text style={[cS.statusText, { color: Colors.danger }]}>Código expirado</Text>
          </View>
        ) : (
          <View style={cS.statusUsado}>
            <Ionicons name="ellipse" size={10} color={Colors.success} />
            <Text style={[cS.statusText, { color: Colors.success }]}>
              Disponível — expira em {cod.dataExpiracaoCodigo}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────
   Painel de Recursos Humanos para CEO/PCA
───────────────────────────────────────────────────────── */
interface RHStats {
  totalFuncionarios: number;
  totalProfessores: number;
  totalAdmin: number;
  faltasThisMonth: number;
  ultimaFolha: { mes: string; total: number; estado: string } | null;
  totalSalariosUltimaFolha: number;
  deptBreakdown: { departamento: string; count: number }[];
}

function RHPanelCEO({ router }: { router: ReturnType<typeof useRouter> }) {
  const [stats, setStats] = useState<RHStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRHStats = useCallback(async () => {
    try {
      setLoading(true);
      const [funcsRes, faltasRes, folhasRes] = await Promise.all([
        api.get('/funcionarios'),
        api.get('/faltas-funcionarios'),
        api.get('/folhas-salarios'),
      ]);

      const funcs: any[] = funcsRes.data || [];
      const faltas: any[] = faltasRes.data || [];
      const folhas: any[] = folhasRes.data || [];

      const now = new Date();
      const mesAtual = now.getMonth() + 1;
      const anoAtual = now.getFullYear();

      const faltasMes = faltas.filter(f => {
        const d = new Date(f.data);
        return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
      }).length;

      const profs = funcs.filter(f =>
        (f.departamento || '').toLowerCase().includes('pedagog') ||
        (f.cargo || '').toLowerCase().includes('professor')
      );
      const admin = funcs.filter(f =>
        !(f.departamento || '').toLowerCase().includes('pedagog') &&
        !(f.cargo || '').toLowerCase().includes('professor')
      );

      const deptMap: Record<string, number> = {};
      funcs.forEach(f => {
        const dept = f.departamento || 'Sem Departamento';
        deptMap[dept] = (deptMap[dept] || 0) + 1;
      });
      const deptBreakdown = Object.entries(deptMap)
        .map(([departamento, count]) => ({ departamento, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      let ultimaFolha = null;
      let totalSalariosUltimaFolha = 0;
      if (folhas.length > 0) {
        const folha = folhas.sort((a: any, b: any) => b.id - a.id)[0];
        try {
          const itensRes = await api.get(`/folhas-salarios/${folha.id}/itens`);
          const itens: any[] = itensRes.data || [];
          totalSalariosUltimaFolha = itens.reduce((s: number, i: any) => s + (i.salarioLiquido || 0), 0);
        } catch (_) {}
        ultimaFolha = {
          mes: folha.mes,
          total: totalSalariosUltimaFolha,
          estado: folha.estado || 'rascunho',
        };
      }

      setStats({
        totalFuncionarios: funcs.length,
        totalProfessores: profs.length,
        totalAdmin: admin.length,
        faltasThisMonth: faltasMes,
        ultimaFolha,
        totalSalariosUltimaFolha,
        deptBreakdown,
      });
    } catch (e) {
      console.error('RHPanelCEO error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRHStats(); }, [fetchRHStats]);

  function formatAOA(v: number) {
    return v.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 });
  }

  const ESTADO_COLOR: Record<string, string> = {
    processada: Colors.success,
    paga: Colors.info,
    rascunho: Colors.textMuted,
    pendente: Colors.warning,
  };

  return (
    <>
      <View style={rhS.header}>
        <MaterialCommunityIcons name="account-group" size={20} color={Colors.gold} />
        <Text style={rhS.headerTitle}>Recursos Humanos</Text>
        <TouchableOpacity onPress={fetchRHStats} style={{ marginLeft: 'auto' }}>
          <Ionicons name="refresh-outline" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={rhS.loadingBox}>
          <Text style={{ color: Colors.textMuted, fontSize: 13 }}>A carregar dados RH...</Text>
        </View>
      ) : (
        <>
          {/* KPI Grid */}
          <View style={rhS.grid}>
            <View style={[rhS.kpi, { borderLeftColor: Colors.info }]}>
              <Text style={rhS.kpiValue}>{stats?.totalFuncionarios ?? 0}</Text>
              <Text style={rhS.kpiLabel}>Total Funcionários</Text>
            </View>
            <View style={[rhS.kpi, { borderLeftColor: Colors.success }]}>
              <Text style={rhS.kpiValue}>{stats?.totalProfessores ?? 0}</Text>
              <Text style={rhS.kpiLabel}>Docentes</Text>
            </View>
            <View style={[rhS.kpi, { borderLeftColor: Colors.warning }]}>
              <Text style={rhS.kpiValue}>{stats?.totalAdmin ?? 0}</Text>
              <Text style={rhS.kpiLabel}>Administrativos</Text>
            </View>
            <View style={[rhS.kpi, { borderLeftColor: Colors.danger }]}>
              <Text style={rhS.kpiValue}>{stats?.faltasThisMonth ?? 0}</Text>
              <Text style={rhS.kpiLabel}>Faltas este mês</Text>
            </View>
          </View>

          {/* Última Folha de Salários */}
          {stats?.ultimaFolha && (
            <View style={rhS.folhaCard}>
              <View style={rhS.folhaHeader}>
                <MaterialCommunityIcons name="file-document-outline" size={16} color={Colors.gold} />
                <Text style={rhS.folhaTitle}>Última Folha de Salários</Text>
                <View style={[rhS.folhaEstado, { backgroundColor: (ESTADO_COLOR[stats.ultimaFolha.estado] || Colors.textMuted) + '22' }]}>
                  <Text style={[rhS.folhaEstadoText, { color: ESTADO_COLOR[stats.ultimaFolha.estado] || Colors.textMuted }]}>
                    {stats.ultimaFolha.estado.charAt(0).toUpperCase() + stats.ultimaFolha.estado.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={rhS.folhaBody}>
                <View>
                  <Text style={rhS.folhaMes}>{stats.ultimaFolha.mes}</Text>
                  <Text style={rhS.folhaLabel}>Período</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[rhS.folhaMes, { color: Colors.success }]}>{formatAOA(stats.ultimaFolha.total)}</Text>
                  <Text style={rhS.folhaLabel}>Total Salários Líquidos</Text>
                </View>
              </View>
            </View>
          )}

          {/* Distribuição por Departamento */}
          {(stats?.deptBreakdown ?? []).length > 0 && (
            <View style={rhS.deptCard}>
              <Text style={rhS.deptTitle}>Pessoal por Departamento</Text>
              {stats!.deptBreakdown.map((d, i) => {
                const total = stats!.totalFuncionarios || 1;
                const pct = Math.round((d.count / total) * 100);
                const DEPT_COLORS = [Colors.info, Colors.success, Colors.warning, '#8b5cf6', Colors.gold];
                const cor = DEPT_COLORS[i % DEPT_COLORS.length];
                return (
                  <View key={d.departamento} style={rhS.deptRow}>
                    <View style={{ flex: 1 }}>
                      <View style={rhS.deptLabelRow}>
                        <Text style={rhS.deptName} numberOfLines={1}>{d.departamento}</Text>
                        <Text style={rhS.deptCount}>{d.count} ({pct}%)</Text>
                      </View>
                      <View style={rhS.deptBarBg}>
                        <View style={[rhS.deptBar, { width: `${pct}%` as any, backgroundColor: cor }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Atalhos RH */}
          <Text style={[styles.escolaSectionTitle, { marginTop: 16 }]}>Módulos de Recursos Humanos</Text>
          {[
            { label: 'Controlo de Pessoal', sub: 'Ficha e gestão de funcionários', route: '/(main)/rh-controle', icon: 'people', color: Colors.info },
            { label: 'Faltas & Tempos Lectivos', sub: 'Registo de faltas e tempos', route: '/(main)/rh-faltas-tempos', icon: 'time', color: Colors.warning },
            { label: 'Folhas de Salários', sub: 'Processamento e emissão de recibos', route: '/(main)/rh-payroll', icon: 'cash', color: Colors.success },
          ].map(item => (
            <TouchableOpacity
              key={item.route}
              style={styles.escolaShortcut}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.escolaShortcutIcon, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.escolaShortcutLabel}>{item.label}</Text>
                <Text style={styles.escolaShortcutSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </>
      )}
    </>
  );
}

const rhS = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  loadingBox: { alignItems: 'center', padding: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpi: {
    flex: 1, minWidth: '44%', backgroundColor: Colors.card, borderRadius: 10, padding: 12,
    borderLeftWidth: 3,
  },
  kpiValue: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  kpiLabel: { fontSize: 11, color: Colors.textMuted },
  folhaCard: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginBottom: 10 },
  folhaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  folhaTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, flex: 1 },
  folhaEstado: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  folhaEstadoText: { fontSize: 11, fontWeight: '700' },
  folhaBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  folhaMes: { fontSize: 15, fontWeight: '700', color: Colors.text },
  folhaLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  deptCard: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginBottom: 10 },
  deptTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  deptRow: { marginBottom: 8 },
  deptLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  deptName: { fontSize: 12, color: Colors.text, flex: 1 },
  deptCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  deptBarBg: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  deptBar: { height: 5, borderRadius: 3 },
});

export default function CeoScreen() {
  const { licenca, codigosGerados, isLicencaValida, diasRestantes, gerarCodigo, revogarCodigo, adicionarSaldo } = useLicense();
  const { alunos, turmas, professores, notas } = useData();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [mainTab, setMainTab] = useState<'ceo' | 'escola'>('ceo');
  const [section, setSection] = useState<Section>('dashboard');
  const [showGerar, setShowGerar] = useState(false);
  const [formPlano, setFormPlano] = useState<TipoPlano>('anual');
  const [formNivel, setFormNivel] = useState<TipoNivel>('rubi');
  const [formPrecoPorAluno, setFormPrecoPorAluno] = useState(String(PRECO_POR_ALUNO_DEFAULT));
  const [formCreditoAplicar, setFormCreditoAplicar] = useState('0');
  const [alunosMatriculados, setAlunosMatriculados] = useState(0);
  const [formNotas, setFormNotas] = useState('');
  const [showSaldo, setShowSaldo] = useState(false);
  const [formAddSaldo, setFormAddSaldo] = useState('');
  const [codigoGerado, setCodigoGerado] = useState<CodigoAtivacao | null>(null);
  const [filterUsado, setFilterUsado] = useState<'todos' | 'disponivel' | 'usado'>('todos');

  const fetchAlunosMatriculados = useCallback(async () => {
    try {
      const d = await api.get<{ total: number }>('/licenca/alunos-matriculados');
      if (d?.total !== undefined) setAlunosMatriculados(d.total);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { fetchAlunosMatriculados(); }, [fetchAlunosMatriculados]);

  useEffect(() => {
    if (!showGerar) return;
    fetchAlunosMatriculados();
    const saldoDisponivel = licenca?.saldoCreditoAcumulado || 0;
    if (saldoDisponivel > 0) {
      setFormCreditoAplicar(String(saldoDisponivel));
    } else {
      setFormCreditoAplicar('0');
    }
  }, [showGerar]);

  // Quando o nível muda, actualiza automaticamente o preço por aluno
  useEffect(() => {
    setFormPrecoPorAluno(String(PRECO_NIVEL[formNivel]));
  }, [formNivel]);

  const stats = useMemo(() => {
    const total = codigosGerados.length;
    const usados = codigosGerados.filter(c => c.usado).length;
    const disponiveis = codigosGerados.filter(c => !c.usado && new Date(c.dataExpiracaoCodigo) >= new Date()).length;
    const expirados = codigosGerados.filter(c => !c.usado && new Date(c.dataExpiracaoCodigo) < new Date()).length;
    return { total, usados, disponiveis, expirados };
  }, [codigosGerados]);

  const codigosFiltrados = useMemo(() => {
    return codigosGerados
      .filter(c => {
        if (filterUsado === 'disponivel') return !c.usado && new Date(c.dataExpiracaoCodigo) >= new Date();
        if (filterUsado === 'usado') return c.usado;
        return true;
      })
      .sort((a, b) => b.dataGeracao.localeCompare(a.dataGeracao));
  }, [codigosGerados, filterUsado]);

  const calcPreco = useMemo(() => {
    const precoPorAluno = parseInt(formPrecoPorAluno) || PRECO_NIVEL[formNivel];
    const total = alunosMatriculados;
    const desconto = DESCONTO_PLANO[formPlano];
    const valorBruto = precoPorAluno * total;
    // Aplica desconto por duração (ex: anual = 83% do valor mensal × 12)
    const meses = formPlano === 'mensal' ? 1 : formPlano === 'trimestral' ? 3 : formPlano === 'semestral' ? 6 : 12;
    const valorSemDesconto = valorBruto * meses;
    const valorComDesconto = Math.round(valorSemDesconto * desconto);
    const descontoKz = valorSemDesconto - valorComDesconto;
    const credito = Math.min(parseInt(formCreditoAplicar) || 0, valorComDesconto);
    const valorFinal = Math.max(0, valorComDesconto - credito);
    return { precoPorAluno, total, meses, valorBruto, valorSemDesconto, valorComDesconto, descontoKz, credito, valorFinal };
  }, [formPrecoPorAluno, formNivel, formPlano, alunosMatriculados, formCreditoAplicar]);

  async function handleGerar() {
    const { precoPorAluno, total, credito, valorFinal, valorComDesconto, descontoKz } = calcPreco;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const cod = await gerarCodigo(formPlano, formNivel, precoPorAluno, total, credito, formNotas);
    setCodigoGerado(cod);
    setFormNotas('');
    setFormCreditoAplicar('0');
  }

  function copiarCodigo(codigo: string) {
    Clipboard.setString(codigo);
    webAlert('Copiado!', `Código ${codigo} copiado para a área de transferência.`);
  }

  async function handleRevogar(cod: CodigoAtivacao) {
    webAlert('Revogar Código', `Revogar o código ${cod.codigo}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revogar', style: 'destructive', onPress: async () => {
        await revogarCodigo(cod.id);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }},
    ]);
  }

  async function handleAddSaldo() {
    const val = parseInt(formAddSaldo);
    if (!val || val <= 0) { webAlert('Erro', 'Valor inválido. Introduza um valor positivo em KZ.'); return; }
    await adicionarCreditoAcumulado(val);
    setShowSaldo(false);
    setFormAddSaldo('');
    webAlert('Crédito Adicionado', `${val.toLocaleString('pt-AO')} KZ de crédito acumulado. Este valor será automaticamente preenchido no campo "Crédito a Aplicar" na próxima geração de código.`);
  }

  const sections = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { key: 'codigos', label: 'Códigos', icon: 'key' },
    { key: 'historico', label: 'Histórico', icon: 'time' },
  ] as const;

  function irParaGestaoPLanos() {
    router.push('/(main)/gestao-planos' as any);
  }

  const alunosActivos = alunos.filter(a => a.activo !== false).length;
  const turmasActivas = turmas.length;
  const professoresActivos = professores.filter(p => p.activo !== false).length;
  const totalNotas = notas.length;

  // ── Pagamentos em Tempo Real ─────────────────────────────────────────────
  type Pagamento = {
    id: string; alunoId: string; taxaId: string; valor: number;
    data: string; status: string; metodoPagamento: string;
    referencia?: string; observacao?: string; createdAt: string;
  };
  type Taxa = { id: string; tipo: string; descricao: string };

  const [pagamentosAoVivo, setPagamentosAoVivo] = useState<Pagamento[]>([]);
  const [taxasMap, setTaxasMap] = useState<Record<string, Taxa>>({});
  const [ultimoUpdate, setUltimoUpdate] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const newItemAnim = useRef<Record<string, Animated.Value>>({});
  const previousIds = useRef<Set<string>>(new Set());

  const pulseLoop = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const fetchPagamentos = useCallback(async () => {
    try {
      const [pags, txs] = await Promise.all([
        api.get<Pagamento[]>('/api/pagamentos'),
        api.get<Taxa[]>('/api/taxas'),
      ]);
      const sorted = (pags || [])
        .filter(p => p.status === 'pago')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);
      const map: Record<string, Taxa> = {};
      (txs || []).forEach(t => { map[t.id] = t; });
      const newIds = new Set(sorted.map(p => p.id));
      const hasNew = sorted.some(p => !previousIds.current.has(p.id));
      if (hasNew && previousIds.current.size > 0) {
        sorted.forEach(p => {
          if (!previousIds.current.has(p.id)) {
            newItemAnim.current[p.id] = new Animated.Value(0);
            Animated.timing(newItemAnim.current[p.id], {
              toValue: 1, duration: 600, useNativeDriver: true,
            }).start();
          }
        });
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      previousIds.current = newIds;
      setPagamentosAoVivo(sorted);
      setTaxasMap(map);
      setUltimoUpdate(new Date());
      setIsLive(true);
    } catch { setIsLive(false); }
  }, []);

  useEffect(() => {
    fetchPagamentos();
    pulseLoop();
    const interval = setInterval(fetchPagamentos, 6000);
    return () => clearInterval(interval);
  }, [fetchPagamentos, pulseLoop]);

  function tempoRelativo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s atrás`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return new Date(dateStr).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' });
  }

  function formatAOA(valor: number): string {
    return valor.toLocaleString('pt-AO', { minimumFractionDigits: 0 }) + ' AOA';
  }

  const METODO_ICON: Record<string, string> = {
    dinheiro: 'cash-outline',
    transferencia: 'swap-horizontal-outline',
    multicaixa: 'card-outline',
  };

  const totalHoje = pagamentosAoVivo
    .filter(p => new Date(p.createdAt).toDateString() === new Date().toDateString())
    .reduce((acc, p) => acc + p.valor, 0);

  const alunosMap = useMemo(() => {
    const m: Record<string, string> = {};
    alunos.forEach(a => { m[a.id] = (a.nome || '') + (a.apelido ? ' ' + a.apelido : ''); });
    return m;
  }, [alunos]);

  function EscolaStatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
    return (
      <View style={[styles.escolaStatCard, { borderColor: color + '40' }]}>
        <View style={[styles.escolaStatIcon, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={[styles.escolaStatValue, { color }]}>{value}</Text>
        <Text style={styles.escolaStatLabel}>{label}</Text>
      </View>
    );
  }

  useEnterToSave(handleGerar, showGerar);
  useEnterToSave(handleAddSaldo, showSaldo);

  return (
    <View style={styles.container}>
      <TopBar
        title="Painel CEO"
        subtitle="Gestão do Sistema SIGA"
        rightAction={mainTab === 'ceo' ? { icon: 'add-circle', onPress: () => setShowGerar(true) } : undefined}
      />

      {/* CEO Badge */}
      <View style={styles.ceoBadgeBar}>
        <MaterialCommunityIcons name="crown" size={16} color="#FFD700" />
        <Text style={styles.ceoBadgeText}>Acesso Total ao Sistema · Super Administrador</Text>
      </View>

      {/* ── Abas de Topo: Dashboard CEO / Dashboard Escola ── */}
      <View style={styles.mainTabBar}>
        <TouchableOpacity
          style={[styles.mainTab, mainTab === 'ceo' && styles.mainTabActive]}
          onPress={() => setMainTab('ceo')}
        >
          <MaterialCommunityIcons name="crown" size={15} color={mainTab === 'ceo' ? Colors.gold : Colors.textSecondary} />
          <Text style={[styles.mainTabText, mainTab === 'ceo' && styles.mainTabTextActive]}>Dashboard CEO</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, mainTab === 'escola' && styles.mainTabActive]}
          onPress={() => setMainTab('escola')}
        >
          <Ionicons name="school" size={15} color={mainTab === 'escola' ? Colors.gold : Colors.textSecondary} />
          <Text style={[styles.mainTabText, mainTab === 'escola' && styles.mainTabTextActive]}>Dashboard Escola</Text>
        </TouchableOpacity>
      </View>

      {/* ── CONTEÚDO: Dashboard Escola ── */}
      {mainTab === 'escola' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.escolaHeader}>
            <Ionicons name="school-outline" size={22} color={Colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.escolaHeaderTitle}>Visão Geral da Escola</Text>
              <Text style={styles.escolaHeaderSub}>Dados do ano lectivo actual</Text>
            </View>
            <TouchableOpacity
              style={styles.escolaDashBtn}
              onPress={() => router.push('/(main)/dashboard' as any)}
            >
              <Text style={styles.escolaDashBtnText}>Ver Completo</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.gold} />
            </TouchableOpacity>
          </View>

          <View style={styles.escolaStatsGrid}>
            <EscolaStatCard label="Alunos" value={String(alunosActivos)} icon="people" color={Colors.info} />
            <EscolaStatCard label="Turmas" value={String(turmasActivas)} icon="grid" color={Colors.warning} />
            <EscolaStatCard label="Professores" value={String(professoresActivos)} icon="person" color={Colors.success} />
            <EscolaStatCard label="Lançamentos" value={String(totalNotas)} icon="document-text" color="#8b5cf6" />
          </View>

          {/* ── Pagamentos em Tempo Real ── */}
          <View style={styles.liveHeader}>
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveText}>AO VIVO</Text>
            </View>
            <Text style={styles.liveTitleText}>Pagamentos Recentes</Text>
            <TouchableOpacity onPress={fetchPagamentos} style={styles.liveRefreshBtn}>
              <Ionicons name="refresh-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Resumo do dia */}
          <View style={styles.liveSummaryRow}>
            <View style={styles.liveSummaryCard}>
              <Ionicons name="today-outline" size={16} color={Colors.success} />
              <View>
                <Text style={styles.liveSummaryLabel}>Total Hoje</Text>
                <Text style={[styles.liveSummaryValue, { color: Colors.success }]}>{formatAOA(totalHoje)}</Text>
              </View>
            </View>
            <View style={styles.liveSummaryCard}>
              <Ionicons name="receipt-outline" size={16} color={Colors.info} />
              <View>
                <Text style={styles.liveSummaryLabel}>Transacções</Text>
                <Text style={[styles.liveSummaryValue, { color: Colors.info }]}>
                  {pagamentosAoVivo.filter(p => new Date(p.createdAt).toDateString() === new Date().toDateString()).length}
                </Text>
              </View>
            </View>
            <View style={styles.liveSummaryCard}>
              <Animated.View style={{ opacity: pulseAnim }}>
                <Ionicons name="wifi-outline" size={16} color={isLive ? Colors.success : Colors.danger} />
              </Animated.View>
              <View>
                <Text style={styles.liveSummaryLabel}>Estado</Text>
                <Text style={[styles.liveSummaryValue, { color: isLive ? Colors.success : Colors.danger }]}>
                  {isLive ? 'Ligado' : 'Erro'}
                </Text>
              </View>
            </View>
          </View>

          {ultimoUpdate && (
            <Text style={styles.liveLastUpdate}>
              Actualizado: {ultimoUpdate.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          )}

          {pagamentosAoVivo.length === 0 ? (
            <View style={styles.liveEmpty}>
              <Ionicons name="wallet-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.liveEmptyText}>Sem pagamentos registados ainda</Text>
            </View>
          ) : (
            pagamentosAoVivo.map((p) => {
              const isNew = newItemAnim.current[p.id];
              const taxa = taxasMap[p.taxaId];
              const nomeAluno = alunosMap[p.alunoId] || 'Aluno';
              const metIcon = METODO_ICON[p.metodoPagamento] || 'cash-outline';
              const metColor: Record<string, string> = {
                dinheiro: Colors.success,
                transferencia: Colors.info,
                multicaixa: Colors.warning,
              };
              const cor = metColor[p.metodoPagamento] || Colors.textMuted;
              return (
                <Animated.View
                  key={p.id}
                  style={[
                    styles.liveItem,
                    isNew && {
                      opacity: isNew,
                      transform: [{ translateY: isNew.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
                    },
                  ]}
                >
                  <View style={[styles.liveItemIcon, { backgroundColor: cor + '20' }]}>
                    <Ionicons name={metIcon as any} size={18} color={cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveItemName} numberOfLines={1}>{nomeAluno}</Text>
                    <Text style={styles.liveItemTaxa} numberOfLines={1}>
                      {taxa ? taxa.descricao : p.taxaId}
                    </Text>
                  </View>
                  <View style={styles.liveItemRight}>
                    <Text style={[styles.liveItemValor, { color: Colors.success }]}>+{formatAOA(p.valor)}</Text>
                    <Text style={styles.liveItemTime}>{tempoRelativo(p.createdAt)}</Text>
                  </View>
                </Animated.View>
              );
            })
          )}

          <TouchableOpacity
            style={styles.liveVerTudoBtn}
            onPress={() => router.push('/(main)/financeiro' as any)}
          >
            <Text style={styles.liveVerTudoText}>Ver módulo financeiro completo</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.gold} />
          </TouchableOpacity>

          {/* Atalhos financeiros */}
          <Text style={styles.escolaSectionTitle}>Controlo Financeiro</Text>
          {[
            { label: 'Módulo Financeiro', sub: 'Painel central de finanças', route: '/(main)/financeiro', icon: 'cash', color: Colors.success },
            { label: 'Propinas', sub: 'Gestão de propinas por aluno', route: '/(main)/financeiro', icon: 'wallet', color: Colors.info },
            { label: 'Pagamentos', sub: 'Histórico de transacções', route: '/(main)/financeiro', icon: 'receipt', color: Colors.gold },
            { label: 'Em Atraso', sub: 'Alunos com dívidas pendentes', route: '/(main)/financeiro', icon: 'alert-circle', color: Colors.danger },
            { label: 'Rubricas', sub: 'Taxas e tipos de cobrança', route: '/(main)/financeiro', icon: 'pricetag', color: '#8b5cf6' },
            { label: 'Relatórios Fin.', sub: 'Análise e exportação', route: '/(main)/financeiro', icon: 'bar-chart', color: Colors.warning },
          ].map(item => (
            <TouchableOpacity
              key={item.route}
              style={styles.escolaShortcut}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.escolaShortcutIcon, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.escolaShortcutLabel}>{item.label}</Text>
                <Text style={styles.escolaShortcutSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}

          {/* ── Recursos Humanos ── */}
          <RHPanelCEO router={router} />
        </ScrollView>
      )}

      {/* ── CONTEÚDO: Dashboard CEO ── */}
      {mainTab === 'ceo' && (
      <>

      {/* Nav Tabs */}
      <View style={styles.tabBar}>
        {sections.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, section === s.key && styles.tabActive]}
            onPress={() => setSection(s.key as Section)}
          >
            <Ionicons name={s.icon as any} size={16} color={section === s.key ? Colors.gold : Colors.textSecondary} />
            <Text style={[styles.tabText, section === s.key && styles.tabTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPad + 24 }} showsVerticalScrollIndicator={false}>

        {/* ── DASHBOARD ── */}
        {section === 'dashboard' && (
          <View style={styles.section}>
            {/* Licença actual */}
            <View style={[styles.licencaCard, { borderColor: isLicencaValida ? Colors.success + '55' : Colors.danger + '55' }]}>
              <View style={styles.licencaCardHeader}>
                <View style={styles.licencaCardHeaderLeft}>
                  <MaterialCommunityIcons name="shield-check" size={22} color={isLicencaValida ? Colors.success : Colors.danger} />
                  <View>
                    <Text style={styles.licencaCardTitle}>Licença do Sistema</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <View style={[styles.nivelPill, { backgroundColor: NIVEL_COLOR[licenca?.nivel || 'rubi'] + '22', borderColor: NIVEL_COLOR[licenca?.nivel || 'rubi'] + '55' }]}>
                        <Text style={{ fontSize: 10 }}>{NIVEL_EMOJI[licenca?.nivel || 'rubi']}</Text>
                        <Text style={[styles.nivelPillText, { color: NIVEL_COLOR[licenca?.nivel || 'rubi'] }]}>
                          {NIVEL_LABEL[licenca?.nivel || 'rubi']}
                        </Text>
                      </View>
                      <Text style={[styles.licencaCardPlano, { color: PLANO_COLOR[licenca?.plano || 'avaliacao'] }]}>
                        {PLANO_LABEL[licenca?.plano || 'avaliacao']}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.licencaStatusBadge, { backgroundColor: isLicencaValida ? Colors.success + '22' : Colors.danger + '22' }]}>
                  <Ionicons name={isLicencaValida ? 'checkmark-circle' : 'close-circle'} size={14} color={isLicencaValida ? Colors.success : Colors.danger} />
                  <Text style={[styles.licencaStatusText, { color: isLicencaValida ? Colors.success : Colors.danger }]}>
                    {isLicencaValida ? 'Activa' : 'Expirada'}
                  </Text>
                </View>
              </View>
              <View style={styles.licencaInfoRow}>
                <View style={styles.licencaInfoItem}>
                  <Text style={styles.licencaInfoLabel}>Activação</Text>
                  <Text style={styles.licencaInfoValue}>{licenca?.dataAtivacao || '—'}</Text>
                </View>
                <View style={styles.licencaInfoItem}>
                  <Text style={styles.licencaInfoLabel}>Expiração</Text>
                  <Text style={[styles.licencaInfoValue, { color: diasRestantes <= 7 ? Colors.danger : Colors.text }]}>
                    {licenca?.dataExpiracao || '—'}
                  </Text>
                </View>
                <View style={styles.licencaInfoItem}>
                  <Text style={styles.licencaInfoLabel}>Restam</Text>
                  <Text style={[styles.licencaInfoValue, { color: diasRestantes <= 7 ? Colors.danger : Colors.success }]}>
                    {diasRestantes} dias
                  </Text>
                </View>
              </View>
            </View>

            {/* Saldo */}
            <View style={styles.saldoCard}>
              <View style={styles.saldoLeft}>
                <Ionicons name="wallet" size={24} color={Colors.gold} />
                <View>
                  <Text style={styles.saldoLabel}>Saldo de Créditos</Text>
                  <Text style={styles.saldoEscola}>{licenca?.escolaNome || 'Sistema'}</Text>
                </View>
              </View>
              <View style={styles.saldoRight}>
                <Text style={styles.saldoValor}>{licenca?.saldo ?? 0}</Text>
                <Text style={styles.saldoUnidade}>créditos</Text>
              </View>
              <TouchableOpacity style={styles.addSaldoBtn} onPress={() => setShowSaldo(true)}>
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Crédito Acumulado */}
            {(licenca?.saldoCreditoAcumulado ?? 0) > 0 && (
              <View style={[styles.saldoCard, { backgroundColor: Colors.success + '12', borderColor: Colors.success + '44', borderWidth: 1 }]}>
                <View style={styles.saldoLeft}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <View>
                    <Text style={[styles.saldoLabel, { color: Colors.success }]}>Crédito Acumulado</Text>
                    <Text style={styles.saldoEscola}>Será descontado na próxima subscrição</Text>
                  </View>
                </View>
                <View style={styles.saldoRight}>
                  <Text style={[styles.saldoValor, { color: Colors.success }]}>{licenca?.saldoCreditoAcumulado ?? 0}</Text>
                  <Text style={styles.saldoUnidade}>KZ</Text>
                </View>
              </View>
            )}

            {/* Botão para adicionar crédito acumulado a uma escola */}
            <TouchableOpacity
              style={[styles.planoRow, { backgroundColor: Colors.info + '10', borderColor: Colors.info + '33' }]}
              onPress={() => setShowSaldo(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.info} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.planoNome, { color: Colors.info }]}>Adicionar Crédito a Escola</Text>
                <Text style={styles.planoDias}>Escola sem saldo? Atribui crédito a descontar na próxima renovação</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Stats */}
            <View style={styles.statsGrid}>
              <StatCard label="Total Códigos" value={String(stats.total)} icon="key" color={Colors.info} />
              <StatCard label="Disponíveis" value={String(stats.disponiveis)} icon="checkmark-circle" color={Colors.success} />
              <StatCard label="Utilizados" value={String(stats.usados)} icon="people" color={Colors.gold} />
              <StatCard label="Expirados" value={String(stats.expirados)} icon="time" color={Colors.accent} />
            </View>

            {/* Níveis de Subscrição */}
            <Text style={styles.sectionTitle}>Níveis de Subscrição</Text>
            {(['prata', 'ouro', 'rubi'] as TipoNivel[]).map(n => (
              <View key={n} style={[styles.planoRow, { borderColor: NIVEL_COLOR[n] + '44' }]}>
                <Text style={{ fontSize: 18 }}>{NIVEL_EMOJI[n]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planoNome, { color: NIVEL_COLOR[n] }]}>{NIVEL_LABEL[n]}</Text>
                  <Text style={styles.planoDias}>{NIVEL_DESC[n]}</Text>
                  <Text style={[styles.planoDias, { color: Colors.textMuted }]}>
                    {NIVEL_FEATURES[n].length} funcionalidades incluídas
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.planoGerarBtn, { backgroundColor: NIVEL_COLOR[n] + 'dd' }]}
                  onPress={() => { setFormNivel(n); setShowGerar(true); }}
                >
                  <Text style={styles.planoGerarText}>Gerar</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.planoRow, { backgroundColor: Colors.gold + '10', borderColor: Colors.gold + '33' }]}
              onPress={irParaGestaoPLanos}
            >
              <MaterialCommunityIcons name="view-list" size={18} color={Colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.planoNome, { color: Colors.gold }]}>Ver Comparação de Planos</Text>
                <Text style={styles.planoDias}>Funcionalidades por nível • Prata, Ouro, Rubi</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.gold} />
            </TouchableOpacity>

            {/* Planos de Duração */}
            <Text style={styles.sectionTitle}>Duração dos Planos</Text>
            {(['mensal', 'trimestral', 'semestral', 'anual'] as TipoPlano[]).map(plano => (
              <View key={plano} style={styles.planoRow}>
                <View style={[styles.planoDot, { backgroundColor: PLANO_COLOR[plano] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.planoNome}>{PLANO_LABEL[plano]}</Text>
                  <Text style={styles.planoDias}>{PLANO_DIAS[plano]} dias de validade</Text>
                </View>
                <TouchableOpacity
                  style={styles.planoGerarBtn}
                  onPress={() => { setFormPlano(plano); setShowGerar(true); }}
                >
                  <Text style={styles.planoGerarText}>Gerar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── CÓDIGOS ACTIVOS ── */}
        {section === 'codigos' && (
          <View style={styles.section}>
            <View style={styles.filterRow}>
              {(['todos', 'disponivel', 'usado'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterBtn, filterUsado === f && styles.filterBtnActive]}
                  onPress={() => setFilterUsado(f)}
                >
                  <Text style={[styles.filterBtnText, filterUsado === f && styles.filterBtnTextActive]}>
                    {f === 'todos' ? 'Todos' : f === 'disponivel' ? 'Disponíveis' : 'Usados'}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.novoCodeBtn} onPress={() => setShowGerar(true)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.novoCodeText}>Novo</Text>
              </TouchableOpacity>
            </View>

            {codigosFiltrados.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="key-outline" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Sem códigos</Text>
                <Text style={styles.emptyMsg}>Gere um código de activação para uma escola.</Text>
              </View>
            )}

            {codigosFiltrados.map(cod => (
              <CodigoCard
                key={cod.id}
                cod={cod}
                onCopy={() => copiarCodigo(cod.codigo)}
                onRevogar={() => handleRevogar(cod)}
              />
            ))}
          </View>
        )}

        {/* ── HISTÓRICO ── */}
        {section === 'historico' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Escolas Activadas</Text>
            {codigosGerados.filter(c => c.usado).length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="business-outline" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Sem activações</Text>
                <Text style={styles.emptyMsg}>Nenhuma escola activou a licença ainda.</Text>
              </View>
            )}
            {codigosGerados.filter(c => c.usado).map(cod => (
              <View key={cod.id} style={styles.histCard}>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 18 }}>{NIVEL_EMOJI[cod.nivel || 'rubi']}</Text>
                  <View style={[styles.histPlanoDot, { backgroundColor: PLANO_COLOR[cod.plano] }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histEscola}>{cod.usadoPor}</Text>
                  <Text style={[styles.histMeta, { color: NIVEL_COLOR[cod.nivel || 'rubi'] }]}>
                    {NIVEL_LABEL[cod.nivel || 'rubi']} · {PLANO_LABEL[cod.plano]} · {cod.diasValidade} dias
                  </Text>
                  {(cod.valorFinal || cod.valorTotal) > 0 && (
                    <Text style={[styles.histMeta, { color: Colors.gold }]}>
                      {(cod.valorFinal || cod.valorTotal || 0).toLocaleString('pt-AO')} KZ
                      {(cod.creditoAplicado || 0) > 0 && ` (−${cod.creditoAplicado.toLocaleString('pt-AO')} KZ crédito)`}
                    </Text>
                  )}
                  <Text style={styles.histData}>Activado em {cod.usadoEm}</Text>
                </View>
                <View style={[styles.histStatusBadge, { backgroundColor: Colors.success + '22' }]}>
                  <Text style={[styles.histStatusText, { color: Colors.success }]}>Activo</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Gerar Código */}
      <Modal visible={showGerar} transparent animationType="slide" onRequestClose={() => { setShowGerar(false); setCodigoGerado(null); }}>
        <View style={mS.overlay}>
          <View style={[mS.sheet, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16 }]}>
            <View style={mS.header}>
              <Text style={mS.title}>Gerar Código de Activação</Text>
              <TouchableOpacity onPress={() => { setShowGerar(false); setCodigoGerado(null); }}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {codigoGerado ? (
              <View style={mS.codigoResult}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                <Text style={mS.codigoResultTitle}>Código Gerado!</Text>
                <TouchableOpacity
                  style={mS.codigoCopyBox}
                  onPress={() => copiarCodigo(codigoGerado.codigo)}
                  activeOpacity={0.7}
                >
                  <Text style={mS.codigoCopyText} selectable>{codigoGerado.codigo}</Text>
                  <Ionicons name="copy-outline" size={18} color={Colors.gold} />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 16 }}>{NIVEL_EMOJI[codigoGerado.nivel || 'rubi']}</Text>
                  <Text style={[mS.codigoMeta, { color: NIVEL_COLOR[codigoGerado.nivel || 'rubi'] }]}>
                    {NIVEL_LABEL[codigoGerado.nivel || 'rubi']}
                  </Text>
                  <Text style={mS.codigoMeta}>· {PLANO_LABEL[codigoGerado.plano]} · {codigoGerado.diasValidade} dias</Text>
                </View>
                <Text style={[mS.codigoMeta, { color: Colors.gold, fontFamily: 'Inter_700Bold' }]}>
                  Valor Final: {(codigoGerado.valorFinal || 0).toLocaleString('pt-AO')} KZ
                </Text>
                {(codigoGerado.creditoAplicado || 0) > 0 && (
                  <Text style={[mS.codigoMeta, { color: Colors.success }]}>
                    Crédito aplicado: −{codigoGerado.creditoAplicado.toLocaleString('pt-AO')} KZ
                  </Text>
                )}
                <Text style={mS.codigoExp}>
                  {codigoGerado.totalAlunos} alunos × {codigoGerado.precoPorAluno} KZ · expira em {codigoGerado.dataExpiracaoCodigo}
                </Text>
                <TouchableOpacity style={mS.novoBtn} onPress={() => setCodigoGerado(null)}>
                  <Text style={mS.novoBtnText}>Gerar Outro</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* ── NÍVEL ── */}
                <Text style={mS.fieldLabel}>Nível de Subscrição</Text>
                <View style={mS.planosGrid}>
                  {(['prata', 'ouro', 'rubi'] as TipoNivel[]).map(n => {
                    const active = formNivel === n;
                    const cor = NIVEL_COLOR[n];
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[mS.nivelBtn, active && { borderColor: cor, backgroundColor: cor + '18' }]}
                        onPress={() => setFormNivel(n)}
                      >
                        <Text style={{ fontSize: 20 }}>{NIVEL_EMOJI[n]}</Text>
                        <Text style={[mS.planoBtnLabel, { color: active ? cor : Colors.text, marginTop: 4 }]}>
                          {NIVEL_LABEL[n]}
                        </Text>
                        <View style={[mS.precoPill, { backgroundColor: active ? cor + '22' : Colors.surface, borderColor: active ? cor + '55' : Colors.border }]}>
                          <Text style={[mS.precoKz, { color: active ? cor : Colors.textMuted }]}>
                            {PRECO_NIVEL[n]} KZ
                          </Text>
                          <Text style={[mS.precoSub, { color: active ? cor + 'aa' : Colors.textMuted }]}>/aluno</Text>
                        </View>
                        <Text style={[mS.planoBtnDias, active && { color: cor }]}>
                          {NIVEL_FEATURES[n].length} func.
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── DURAÇÃO ── */}
                <Text style={mS.fieldLabel}>Duração do Plano</Text>
                <View style={mS.planosGrid}>
                  {(['mensal', 'trimestral', 'semestral', 'anual'] as TipoPlano[]).map(p => {
                    const active = formPlano === p;
                    const cor = PLANO_COLOR[p];
                    const label = DESCONTO_LABEL[p];
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[mS.planoBtn, active && { borderColor: cor, backgroundColor: cor + '18' }]}
                        onPress={() => setFormPlano(p)}
                      >
                        <Text style={[mS.planoBtnLabel, active && { color: cor }]}>{PLANO_LABEL[p]}</Text>
                        <Text style={[mS.planoBtnDias, active && { color: cor }]}>{PLANO_DIAS[p]}d</Text>
                        {label !== '' && (
                          <View style={[mS.descontoBadge, { backgroundColor: active ? cor + '22' : Colors.success + '14' }]}>
                            <Text style={[mS.descontoBadgeText, { color: active ? cor : Colors.success }]}>{label}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── CONTAGEM DE ALUNOS ── */}
                <View style={mS.alunosRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={mS.alunosLabel}>Alunos activos na escola</Text>
                    <Text style={mS.alunosVal}>{alunosMatriculados} alunos</Text>
                  </View>
                  <TouchableOpacity onPress={fetchAlunosMatriculados} style={mS.refreshBtn}>
                    <Ionicons name="refresh-outline" size={14} color={Colors.info} />
                    <Text style={mS.refreshText}>Actualizar</Text>
                  </TouchableOpacity>
                </View>

                {/* ── PREÇO POR ALUNO (editável) ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 8 }}>
                  <Text style={[mS.fieldLabel, { marginBottom: 0, marginTop: 0 }]}>
                    Preço por aluno (KZ)
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFormPrecoPorAluno(String(PRECO_NIVEL[formNivel]))}
                    style={{ backgroundColor: NIVEL_COLOR[formNivel] + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: NIVEL_COLOR[formNivel] }}>
                      Repor {PRECO_NIVEL[formNivel]} KZ ({NIVEL_LABEL[formNivel]})
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={mS.input}
                  value={formPrecoPorAluno}
                  onChangeText={setFormPrecoPorAluno}
                  keyboardType="number-pad"
                  placeholder={String(PRECO_NIVEL[formNivel])}
                  placeholderTextColor={Colors.textMuted}
                />

                {/* ── CRÉDITO ACUMULADO ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[mS.fieldLabel, { marginBottom: 0, marginTop: 0 }]}>Crédito a descontar (KZ)</Text>
                  {(licenca?.saldoCreditoAcumulado ?? 0) > 0 && (
                    <TouchableOpacity
                      onPress={() => setFormCreditoAplicar(String(licenca?.saldoCreditoAcumulado ?? 0))}
                      style={{ backgroundColor: Colors.success + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.success }}>
                        Usar {(licenca?.saldoCreditoAcumulado ?? 0).toLocaleString('pt-AO')} KZ acumulado
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={mS.input}
                  value={formCreditoAplicar}
                  onChangeText={setFormCreditoAplicar}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={mS.fieldLabel}>Notas (opcional)</Text>
                <TextInput
                  style={[mS.input, { height: 72, textAlignVertical: 'top' }]}
                  value={formNotas}
                  onChangeText={setFormNotas}
                  multiline
                  placeholder="Ex: Escola Secundária de Benguela — contrato anual"
                  placeholderTextColor={Colors.textMuted}
                />

                <View style={mS.resumo}>
                  <Text style={mS.resumoTitle}>Resumo de Cobrança</Text>

                  {/* Pacote */}
                  <View style={mS.resumoRow}>
                    <Text style={mS.resumoLabel}>Pacote</Text>
                    <Text style={[mS.resumoVal, { color: NIVEL_COLOR[formNivel] }]}>
                      {NIVEL_EMOJI[formNivel]} {NIVEL_LABEL[formNivel]} — {PRECO_NIVEL[formNivel]} KZ/aluno
                    </Text>
                  </View>

                  {/* Duração */}
                  <View style={mS.resumoRow}>
                    <Text style={mS.resumoLabel}>Duração</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[mS.resumoVal, { color: PLANO_COLOR[formPlano] }]}>
                        {PLANO_LABEL[formPlano]} ({calcPreco.meses} {calcPreco.meses === 1 ? 'mês' : 'meses'})
                      </Text>
                      {DESCONTO_LABEL[formPlano] !== '' && (
                        <View style={{ backgroundColor: Colors.success + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.success }}>
                            {DESCONTO_LABEL[formPlano]}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Cálculo base */}
                  <View style={mS.resumoRow}>
                    <Text style={mS.resumoLabel}>
                      {calcPreco.total} alunos × {calcPreco.precoPorAluno} KZ × {calcPreco.meses}m
                    </Text>
                    <Text style={mS.resumoVal}>{calcPreco.valorSemDesconto.toLocaleString('pt-AO')} KZ</Text>
                  </View>

                  {/* Desconto por duração */}
                  {calcPreco.descontoKz > 0 && (
                    <View style={mS.resumoRow}>
                      <Text style={[mS.resumoLabel, { color: Colors.success }]}>
                        Desconto {DESCONTO_LABEL[formPlano]}
                      </Text>
                      <Text style={[mS.resumoVal, { color: Colors.success }]}>
                        −{calcPreco.descontoKz.toLocaleString('pt-AO')} KZ
                      </Text>
                    </View>
                  )}

                  {/* Valor após desconto de duração */}
                  {calcPreco.descontoKz > 0 && (
                    <View style={mS.resumoRow}>
                      <Text style={mS.resumoLabel}>Valor com desconto</Text>
                      <Text style={[mS.resumoVal, { color: PLANO_COLOR[formPlano] }]}>
                        {calcPreco.valorComDesconto.toLocaleString('pt-AO')} KZ
                      </Text>
                    </View>
                  )}

                  {/* Crédito acumulado */}
                  {calcPreco.credito > 0 && (
                    <View style={mS.resumoRow}>
                      <Text style={[mS.resumoLabel, { color: Colors.success }]}>Crédito acumulado</Text>
                      <Text style={[mS.resumoVal, { color: Colors.success }]}>
                        −{calcPreco.credito.toLocaleString('pt-AO')} KZ
                      </Text>
                    </View>
                  )}

                  {/* Linha final */}
                  <View style={[mS.resumoRow, { borderBottomWidth: 0, paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.gold + '33' }]}>
                    <Text style={[mS.resumoLabel, { fontFamily: 'Inter_700Bold', color: Colors.text, fontSize: 14 }]}>
                      Total a Cobrar
                    </Text>
                    <Text style={[mS.resumoVal, { color: Colors.gold, fontSize: 17, fontFamily: 'Inter_700Bold' }]}>
                      {calcPreco.valorFinal.toLocaleString('pt-AO')} KZ
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={mS.gerarBtn} onPress={handleGerar}>
                  <MaterialCommunityIcons name="key-plus" size={20} color="#fff" />
                  <Text style={mS.gerarBtnText}>Gerar Código</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Adicionar Crédito Acumulado */}
      <Modal visible={showSaldo} transparent animationType="slide" onRequestClose={() => { setShowSaldo(false); setFormAddSaldo(''); }}>
        <View style={mS.overlay}>
          <View style={[mS.sheet, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16 }]}>
            <View style={mS.header}>
              <Text style={mS.title}>Crédito para Escola</Text>
              <TouchableOpacity onPress={() => { setShowSaldo(false); setFormAddSaldo(''); }}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Explicação do crédito */}
            <View style={mS.creditoInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
              <Text style={mS.creditoInfoText}>
                Use esta opção quando a escola não tem saldo para pagar a subscrição. O crédito será acumulado e descontado automaticamente na próxima geração de código de activação.
              </Text>
            </View>

            {/* Saldo atual acumulado */}
            {(licenca?.saldoCreditoAcumulado ?? 0) > 0 && (
              <View style={mS.creditoAtualBox}>
                <Text style={mS.creditoAtualLabel}>Crédito acumulado actual:</Text>
                <Text style={mS.creditoAtualVal}>{(licenca?.saldoCreditoAcumulado ?? 0).toLocaleString('pt-AO')} KZ</Text>
              </View>
            )}

            <Text style={mS.fieldLabel}>Valor a Adicionar (KZ)</Text>
            <View style={mS.saldoPresets}>
              {[1000, 2500, 5000, 10000].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[mS.preset, formAddSaldo === String(v) && mS.presetActive]}
                  onPress={() => setFormAddSaldo(String(v))}
                >
                  <Text style={[mS.presetText, formAddSaldo === String(v) && mS.presetTextActive]}>
                    {v.toLocaleString('pt-AO')} KZ
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={mS.input}
              value={formAddSaldo}
              onChangeText={setFormAddSaldo}
              keyboardType="number-pad"
              placeholder="Ex: 3500"
              placeholderTextColor={Colors.textMuted}
            />
            {formAddSaldo !== '' && parseInt(formAddSaldo) > 0 && (
              <View style={mS.creditoPreviewBox}>
                <Text style={mS.creditoPreviewLabel}>Total acumulado após adição:</Text>
                <Text style={mS.creditoPreviewVal}>
                  {((licenca?.saldoCreditoAcumulado ?? 0) + (parseInt(formAddSaldo) || 0)).toLocaleString('pt-AO')} KZ
                </Text>
              </View>
            )}
            <TouchableOpacity style={mS.gerarBtn} onPress={handleAddSaldo}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={mS.gerarBtnText}>Adicionar Crédito Acumulado</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </>
      )}
    </View>
  );
}

const sS = StyleSheet.create({
  statCard: {
    flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, minWidth: '45%',
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  statSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});

const cS = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  cardUsado: { opacity: 0.7, borderColor: Colors.success + '33' },
  cardExpirado: { opacity: 0.6, borderColor: Colors.danger + '33' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  planoPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  planoText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: Colors.gold + '22' },
  codigo: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: 1.5, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  notas: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 6, fontStyle: 'italic' },
  statusRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 },
  statusUsado: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});

const mS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '92%', width: '100%', maxWidth: 480,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 14, fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text, marginBottom: 12,
  },
  planosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  planoBtn: {
    flex: 1, minWidth: '28%', backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center',
  },
  planoBtnLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text },
  planoBtnDias: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  planoBtnPreco: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },

  nivelBtn: {
    flex: 1, minWidth: '28%', backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, padding: 10, alignItems: 'center', gap: 4,
  },
  precoPill: {
    flexDirection: 'row', alignItems: 'baseline', gap: 1,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, marginTop: 2,
  },
  precoKz: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  precoSub: { fontSize: 9, fontFamily: 'Inter_400Regular' },

  descontoBadge: {
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginTop: 3,
  },
  descontoBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  alunosRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.info + '12', borderRadius: 10, padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.info + '33',
  },
  alunosLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  alunosVal: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.info, marginTop: 2 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.info + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  refreshText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.info },

  resumo: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  resumoTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resumoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  resumoVal: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  gerarBtn: {
    backgroundColor: Colors.gold, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 16, marginBottom: 4,
  },
  gerarBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  codigoResult: { alignItems: 'center', paddingVertical: 20 },
  codigoResultTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 12, marginBottom: 16 },
  codigoCopyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.gold + '55', marginBottom: 10,
  },
  codigoCopyText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.gold, letterSpacing: 2, flex: 1, textAlign: 'center' },
  codigoMeta: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginBottom: 4 },
  codigoExp: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 20 },
  novoBtn: { borderWidth: 1, borderColor: Colors.gold, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  novoBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  saldoPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  preset: { flex: 1, minWidth: '44%', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center', backgroundColor: Colors.surface },
  presetActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  presetText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.textSecondary },
  presetTextActive: { color: Colors.gold },
  creditoInfoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.info + '14', borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.info + '33',
  },
  creditoInfoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  creditoAtualBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.success + '14', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.success + '33',
  },
  creditoAtualLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  creditoAtualVal: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.success },
  creditoPreviewBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.warning + '14', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.warning + '33',
  },
  creditoPreviewLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  creditoPreviewVal: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.warning },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  ceoBadgeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,215,0,0.2)',
  },
  ceoBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FFD700' },

  tabBar: { flexDirection: 'row', backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.gold },
  tabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  section: { padding: 16, gap: 12 },

  licencaCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 16, borderWidth: 1,
  },
  licencaCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  licencaCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  licencaCardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  licencaCardPlano: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  licencaStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  licencaStatusText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  licencaInfoRow: { flexDirection: 'row', gap: 8 },
  licencaInfoItem: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 10, alignItems: 'center' },
  licencaInfoLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 3 },
  licencaInfoValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },

  saldoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.gold + '33',
  },
  saldoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  saldoLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  saldoEscola: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  saldoRight: { alignItems: 'flex-end' },
  saldoValor: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.gold },
  saldoUnidade: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  addSaldoBtn: { backgroundColor: Colors.success, borderRadius: 10, padding: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

  planoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  planoDot: { width: 10, height: 10, borderRadius: 5 },
  planoNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  planoDias: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  planoPreco: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  planoGerarBtn: { backgroundColor: Colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  planoGerarText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.gold + '20', borderColor: Colors.gold },
  filterBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filterBtnTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  novoCodeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.accent, marginLeft: 'auto' },
  novoCodeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  histCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  nivelPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  nivelPillText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  histPlanoDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  histEscola: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  histMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 },
  histData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  histStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  histStatusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 12 },
  emptyMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginTop: 6 },

  mainTabBar: {
    flexDirection: 'row', backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  mainTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  mainTabActive: { borderBottomColor: Colors.gold },
  mainTabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  mainTabTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  escolaHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  escolaHeaderTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  escolaHeaderSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  escolaDashBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.gold + '18', borderRadius: 10,
  },
  escolaDashBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold },

  escolaStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  escolaStatCard: {
    width: '47%', flexGrow: 1,
    backgroundColor: Colors.backgroundCard, borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1,
  },
  escolaStatIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  escolaStatValue: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  escolaStatLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textAlign: 'center' },

  escolaSectionTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  escolaShortcut: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.backgroundCard, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  escolaShortcutIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  escolaShortcutLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  escolaShortcutSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  liveHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dc2626' + '20', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#dc2626' + '40',
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#dc2626',
  },
  liveText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#dc2626', letterSpacing: 1 },
  liveTitleText: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  liveRefreshBtn: {
    padding: 6, borderRadius: 8, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },

  liveSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  liveSummaryCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: Colors.border,
  },
  liveSummaryLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  liveSummaryValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },

  liveLastUpdate: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted,
    textAlign: 'right', marginBottom: 10,
  },

  liveEmpty: {
    alignItems: 'center', paddingVertical: 32,
    backgroundColor: Colors.backgroundCard, borderRadius: 14,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  liveEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 10 },

  liveItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  liveItemIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  liveItemName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  liveItemTaxa: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  liveItemRight: { alignItems: 'flex-end' },
  liveItemValor: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  liveItemTime: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  liveVerTudoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, marginBottom: 20,
    backgroundColor: Colors.gold + '12', borderRadius: 12,
    borderWidth: 1, borderColor: Colors.gold + '30',
  },
  liveVerTudoText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
});
