import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Platform, Clipboard,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import {
  useLicense, TipoPlano, CodigoAtivacao,
  PLANO_LABEL, PLANO_DIAS,
} from '@/context/LicenseContext';

const PLANO_PRECO: Record<TipoPlano, string> = {
  demo: 'Grátis',
  mensal: '5.000 AOA',
  trimestral: '13.500 AOA',
  semestral: '25.000 AOA',
  anual: '45.000 AOA',
};

const PLANO_COLOR: Record<TipoPlano, string> = {
  demo: Colors.textMuted,
  mensal: Colors.info,
  trimestral: Colors.warning,
  semestral: Colors.success,
  anual: Colors.gold,
};

const PLANO_SALDO_DEFAULT: Record<TipoPlano, number> = {
  demo: 10,
  mensal: 100,
  trimestral: 300,
  semestral: 600,
  anual: 1200,
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
        <View style={[cS.planoPill, { backgroundColor: cor + '22', borderColor: cor + '55' }]}>
          <Text style={[cS.planoText, { color: cor }]}>{PLANO_LABEL[cod.plano]}</Text>
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
        <View style={cS.metaItem}>
          <Ionicons name="wallet-outline" size={12} color={Colors.textMuted} />
          <Text style={cS.metaText}>{cod.saldoCreditos} créditos</Text>
        </View>
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

export default function CeoScreen() {
  const { licenca, codigosGerados, isLicencaValida, diasRestantes, gerarCodigo, revogarCodigo, adicionarSaldo } = useLicense();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [section, setSection] = useState<Section>('dashboard');
  const [showGerar, setShowGerar] = useState(false);
  const [formPlano, setFormPlano] = useState<TipoPlano>('anual');
  const [formSaldo, setFormSaldo] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const [showSaldo, setShowSaldo] = useState(false);
  const [formAddSaldo, setFormAddSaldo] = useState('');
  const [codigoGerado, setCodigoGerado] = useState<CodigoAtivacao | null>(null);
  const [filterUsado, setFilterUsado] = useState<'todos' | 'disponivel' | 'usado'>('todos');

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

  async function handleGerar() {
    const saldo = parseInt(formSaldo) || PLANO_SALDO_DEFAULT[formPlano];
    if (saldo <= 0) {
      Alert.alert('Erro', 'Saldo deve ser maior que zero.');
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const cod = await gerarCodigo(formPlano, saldo, formNotas);
    setCodigoGerado(cod);
    setFormNotas('');
    setFormSaldo('');
  }

  function copiarCodigo(codigo: string) {
    Clipboard.setString(codigo);
    Alert.alert('Copiado!', `Código ${codigo} copiado para a área de transferência.`);
  }

  async function handleRevogar(cod: CodigoAtivacao) {
    Alert.alert('Revogar Código', `Revogar o código ${cod.codigo}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revogar', style: 'destructive', onPress: async () => {
        await revogarCodigo(cod.id);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }},
    ]);
  }

  async function handleAddSaldo() {
    const val = parseInt(formAddSaldo);
    if (!val || val <= 0) { Alert.alert('Erro', 'Valor inválido.'); return; }
    await adicionarSaldo(val);
    setShowSaldo(false);
    setFormAddSaldo('');
    Alert.alert('Sucesso', `${val} créditos adicionados ao saldo.`);
  }

  const sections = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { key: 'codigos', label: 'Códigos', icon: 'key' },
    { key: 'historico', label: 'Histórico', icon: 'time' },
  ] as const;

  return (
    <View style={styles.container}>
      <TopBar
        title="Painel CEO"
        subtitle="Gestão do Sistema SGAA"
        rightAction={{ icon: 'add-circle', onPress: () => setShowGerar(true) }}
      />

      {/* CEO Badge */}
      <View style={styles.ceoBadgeBar}>
        <MaterialCommunityIcons name="crown" size={16} color="#FFD700" />
        <Text style={styles.ceoBadgeText}>Acesso Total ao Sistema · Super Administrador</Text>
      </View>

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
                    <Text style={[styles.licencaCardPlano, { color: PLANO_COLOR[licenca?.plano || 'demo'] }]}>
                      Plano {PLANO_LABEL[licenca?.plano || 'demo']}
                    </Text>
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

            {/* Stats */}
            <View style={styles.statsGrid}>
              <StatCard label="Total Códigos" value={String(stats.total)} icon="key" color={Colors.info} />
              <StatCard label="Disponíveis" value={String(stats.disponiveis)} icon="checkmark-circle" color={Colors.success} />
              <StatCard label="Utilizados" value={String(stats.usados)} icon="people" color={Colors.gold} />
              <StatCard label="Expirados" value={String(stats.expirados)} icon="time" color={Colors.accent} />
            </View>

            {/* Planos */}
            <Text style={styles.sectionTitle}>Planos Disponíveis</Text>
            {(['mensal', 'trimestral', 'semestral', 'anual'] as TipoPlano[]).map(plano => (
              <View key={plano} style={styles.planoRow}>
                <View style={[styles.planoDot, { backgroundColor: PLANO_COLOR[plano] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.planoNome}>{PLANO_LABEL[plano]}</Text>
                  <Text style={styles.planoDias}>{PLANO_DIAS[plano]} dias · {PLANO_SALDO_DEFAULT[plano]} créditos base</Text>
                </View>
                <Text style={[styles.planoPreco, { color: PLANO_COLOR[plano] }]}>{PLANO_PRECO[plano]}</Text>
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
                <View style={[styles.histPlanoDot, { backgroundColor: PLANO_COLOR[cod.plano] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.histEscola}>{cod.usadoPor}</Text>
                  <Text style={styles.histMeta}>
                    Plano {PLANO_LABEL[cod.plano]} · {cod.saldoCreditos} créditos · {cod.diasValidade} dias
                  </Text>
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
                <Text style={mS.codigoMeta}>
                  Plano {PLANO_LABEL[codigoGerado.plano]} · {codigoGerado.diasValidade} dias · {codigoGerado.saldoCreditos} créditos
                </Text>
                <Text style={mS.codigoExp}>Código válido para usar até {codigoGerado.dataExpiracaoCodigo}</Text>
                <TouchableOpacity style={mS.novoBtn} onPress={() => setCodigoGerado(null)}>
                  <Text style={mS.novoBtnText}>Gerar Outro</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={mS.fieldLabel}>Plano de Subscrição</Text>
                <View style={mS.planosGrid}>
                  {(['demo', 'mensal', 'trimestral', 'semestral', 'anual'] as TipoPlano[]).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[mS.planoBtn, formPlano === p && { borderColor: PLANO_COLOR[p], backgroundColor: PLANO_COLOR[p] + '18' }]}
                      onPress={() => { setFormPlano(p); setFormSaldo(String(PLANO_SALDO_DEFAULT[p])); }}
                    >
                      <Text style={[mS.planoBtnLabel, formPlano === p && { color: PLANO_COLOR[p] }]}>
                        {PLANO_LABEL[p]}
                      </Text>
                      <Text style={[mS.planoBtnDias, formPlano === p && { color: PLANO_COLOR[p] }]}>
                        {PLANO_DIAS[p]}d
                      </Text>
                      <Text style={[mS.planoBtnPreco, { color: PLANO_COLOR[p] }]}>{PLANO_PRECO[p]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={mS.fieldLabel}>Créditos Incluídos</Text>
                <TextInput
                  style={mS.input}
                  value={formSaldo || String(PLANO_SALDO_DEFAULT[formPlano])}
                  onChangeText={setFormSaldo}
                  keyboardType="number-pad"
                  placeholder={String(PLANO_SALDO_DEFAULT[formPlano])}
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
                  <Text style={mS.resumoTitle}>Resumo</Text>
                  <View style={mS.resumoRow}>
                    <Text style={mS.resumoLabel}>Plano</Text>
                    <Text style={[mS.resumoVal, { color: PLANO_COLOR[formPlano] }]}>{PLANO_LABEL[formPlano]}</Text>
                  </View>
                  <View style={mS.resumoRow}>
                    <Text style={mS.resumoLabel}>Validade</Text>
                    <Text style={mS.resumoVal}>{PLANO_DIAS[formPlano]} dias após activação</Text>
                  </View>
                  <View style={mS.resumoRow}>
                    <Text style={mS.resumoLabel}>Créditos</Text>
                    <Text style={mS.resumoVal}>{formSaldo || PLANO_SALDO_DEFAULT[formPlano]}</Text>
                  </View>
                  <View style={mS.resumoRow}>
                    <Text style={mS.resumoLabel}>Preço Sugerido</Text>
                    <Text style={[mS.resumoVal, { color: Colors.gold }]}>{PLANO_PRECO[formPlano]}</Text>
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

      {/* Modal Adicionar Saldo */}
      <Modal visible={showSaldo} transparent animationType="slide" onRequestClose={() => setShowSaldo(false)}>
        <View style={mS.overlay}>
          <View style={[mS.sheet, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16, maxHeight: '50%' }]}>
            <View style={mS.header}>
              <Text style={mS.title}>Adicionar Créditos</Text>
              <TouchableOpacity onPress={() => setShowSaldo(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={mS.fieldLabel}>Quantidade de Créditos</Text>
            <View style={mS.saldoPresets}>
              {[50, 100, 200, 500].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[mS.preset, formAddSaldo === String(v) && mS.presetActive]}
                  onPress={() => setFormAddSaldo(String(v))}
                >
                  <Text style={[mS.presetText, formAddSaldo === String(v) && mS.presetTextActive]}>+{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={mS.input}
              value={formAddSaldo}
              onChangeText={setFormAddSaldo}
              keyboardType="number-pad"
              placeholder="Quantidade personalizada"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity style={mS.gerarBtn} onPress={handleAddSaldo}>
              <Ionicons name="wallet" size={20} color="#fff" />
              <Text style={mS.gerarBtnText}>Adicionar Créditos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  planoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', alignItems: 'center' },
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
  saldoPresets: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  preset: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center', backgroundColor: Colors.surface },
  presetActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  presetText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.textSecondary },
  presetTextActive: { color: Colors.gold },
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
  histPlanoDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  histEscola: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  histMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 },
  histData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  histStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  histStatusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 12 },
  emptyMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
});
