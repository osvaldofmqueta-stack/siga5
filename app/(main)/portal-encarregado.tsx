import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFinanceiro, formatAOA } from '@/context/FinanceiroContext';
import { useConfig } from '@/context/ConfigContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useUsers } from '@/context/UsersContext';
import TopBar from '@/components/TopBar';

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'painel', label: 'Painel', icon: 'grid' },
  { key: 'notas', label: 'Notas', icon: 'document-text' },
  { key: 'presencas', label: 'Presenças', icon: 'checkmark-circle' },
  { key: 'financeiro', label: 'Financeiro', icon: 'cash' },
  { key: 'mensagens', label: 'Mensagens', icon: 'chatbubbles' },
  { key: 'horario', label: 'Horário', icon: 'time' },
  { key: 'materiais', label: 'Materiais', icon: 'library' },
  { key: 'calendario', label: 'Calendário', icon: 'calendar' },
] as const;

type TabKey = typeof TABS[number]['key'];

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon as any} size={16} color={Colors.gold} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NotaCell({ value }: { value: number }) {
  const ok = value >= 10;
  const color = value === 0 ? Colors.textMuted : ok ? Colors.success : Colors.danger;
  return (
    <View style={[styles.notaCell, { borderColor: color + '44' }]}>
      <Text style={[styles.notaValue, { color }]}>{value === 0 ? '—' : value.toFixed(0)}</Text>
    </View>
  );
}

export default function PortalEncarregadoScreen() {
  const { user } = useAuth();
  const { users } = useUsers();
  const { alunos, turmas, notas, presencas, eventos } = useData();
  const { taxas, pagamentos, getPagamentosAluno, getTaxasByNivel, getMesesEmAtraso, calcularMulta, gerarRUPE, getRUPEsAluno, addPagamento } = useFinanceiro();
  const { config } = useConfig();
  const { mensagens, sumarios, materiais, calendarioProvas } = useProfessor();
  const { anoSelecionado } = useAnoAcademico();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('painel');
  const [trimestreNotas, setTrimestreNotas] = useState<1 | 2 | 3>(1);
  const [diaHorario, setDiaHorario] = useState(0);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [paymentMonth, setPaymentMonth] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'multicaixa' | 'referencia' | null>(null);
  const [generatingRupe, setGeneratingRupe] = useState(false);
  const [activeRupe, setActiveRupe] = useState<any | null>(null);

  const anoLetivo = anoSelecionado?.ano || new Date().getFullYear().toString();

  const currentUser = users.find(u => u.id === user?.id);
  const alunoId = currentUser?.alunoId;
  const aluno = alunos.find(a => a.id === alunoId);
  const turmaAluno = aluno ? turmas.find(t => t.id === aluno.turmaId) : null;

  const notasAluno = aluno ? notas.filter(n => n.alunoId === aluno.id && n.anoLetivo === anoLetivo) : [];
  const presAluno = aluno ? presencas.filter(p => p.alunoId === aluno.id) : [];
  const pagamentosAluno = aluno ? getPagamentosAluno(aluno.id) : [];
  const mesesAtraso = aluno ? getMesesEmAtraso(aluno.id, anoLetivo) : 0;
  const taxaPropina = taxas.find(t => t.tipo === 'propina' && t.ativo);
  const multaEstimada = calcularMulta(taxaPropina?.valor || 0, mesesAtraso);
  const taxasNivel = turmaAluno ? getTaxasByNivel(turmaAluno.nivel, anoLetivo) : [];

  const mensagensAluno = turmaAluno
    ? mensagens.filter(m => m.tipo === 'turma' && m.turmaId === turmaAluno.id)
    : [];

  const notasTrimestre = notasAluno.filter(n => n.trimestre === trimestreNotas);
  const mediaGeral = notasAluno.length > 0
    ? (notasAluno.reduce((s, n) => s + (n.nf || n.mac || 0), 0) / notasAluno.length).toFixed(1)
    : '—';
  const pctPresenca = presAluno.length > 0
    ? Math.round((presAluno.filter(p => p.status === 'P').length / presAluno.length) * 100)
    : 100;
  const aprovadas = notasAluno.filter(n => n.nf >= 10).length;
  const reprovadas = notasAluno.filter(n => n.nf > 0 && n.nf < 10).length;

  const totalPago = pagamentosAluno.reduce((s, p) => s + (p.valor || 0), 0);
  const horariosAluno = turmaAluno ? horarios.filter(h => h.turmaId === turmaAluno.id) : [];
  const horariosHoje = horariosAluno.filter(h => h.dia === diaHorario);

  const eventosAluno = turmaAluno
    ? eventos.filter(e => e.turmasIds.includes(turmaAluno.id) || e.turmasIds.length === 0)
        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    : [];

  const materiaisAluno = turmaAluno
    ? materiais.filter(m => m.turmaId === turmaAluno.id)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    : [];

  const calendarioAluno = turmaAluno
    ? calendarioProvas
        .filter(c => c.publicado && (Array.isArray(c.turmasIds) ? c.turmasIds.includes(turmaAluno.id) || c.turmasIds.length === 0 : true))
        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    : [];

  if (!aluno) {
    return (
      <View style={styles.screen}>
        <TopBar title="Portal do Encarregado" />
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="account-child" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyStateTitle}>Nenhum educando associado</Text>
          <Text style={styles.emptyStateText}>
            A sua conta ainda não foi vinculada a nenhum aluno. Contacte a secretaria da escola.
          </Text>
        </View>
      </View>
    );
  }

  const calcIdade = (dob: string) => Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365));

  function renderPainel() {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.alunoHero}>
          <View style={styles.alunoAvatar}>
            <Text style={styles.alunoAvatarText}>{aluno.nome.charAt(0)}{aluno.apelido.charAt(0)}</Text>
          </View>
          <View style={styles.alunoHeroInfo}>
            <Text style={styles.alunoNome}>{aluno.nome} {aluno.apelido}</Text>
            <Text style={styles.alunoMeta}>{aluno.numeroMatricula} · {turmaAluno?.nome || '—'}</Text>
            <View style={[styles.badge, { backgroundColor: aluno.ativo ? `${Colors.success}22` : `${Colors.danger}22` }]}>
              <Text style={[styles.badgeText, { color: aluno.ativo ? Colors.success : Colors.danger }]}>
                {aluno.ativo ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard value={mediaGeral} label="Média Geral" color={Colors.gold} />
          <StatCard value={`${pctPresenca}%`} label="Presenças" color={Colors.success} />
          <StatCard value={aprovadas} label="Aprovadas" color={Colors.info} />
          <StatCard value={reprovadas} label="Reprovadas" color={Colors.danger} />
        </View>

        {mesesAtraso > 0 && (
          <View style={styles.alertBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{mesesAtraso} {mesesAtraso === 1 ? 'mês em atraso' : 'meses em atraso'}</Text>
              <Text style={styles.alertText}>Multa estimada: {formatAOA(multaEstimada)} · Por favor regularize o pagamento.</Text>
            </View>
          </View>
        )}

        <SectionTitle title="Informações do Aluno" icon="person" />
        <View style={styles.infoCard}>
          {[
            { label: 'Turma', value: turmaAluno?.nome || '—' },
            { label: 'Nível', value: turmaAluno?.nivel || '—' },
            { label: 'Turno', value: turmaAluno?.turno || '—' },
            { label: 'Data de Nascimento', value: aluno.dataNascimento },
            { label: 'Idade', value: `${calcIdade(aluno.dataNascimento)} anos` },
            { label: 'Género', value: aluno.genero === 'M' ? 'Masculino' : 'Feminino' },
            { label: 'Província', value: aluno.provincia },
          ].map(r => (
            <View key={r.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{r.label}</Text>
              <Text style={styles.infoValue}>{r.value}</Text>
            </View>
          ))}
        </View>

        {eventosAluno.length > 0 && (
          <>
            <SectionTitle title="Próximos Eventos" icon="calendar" />
            {eventosAluno.slice(0, 3).map(e => (
              <View key={e.id} style={styles.eventoCard}>
                <View style={styles.eventoData}>
                  <Text style={styles.eventoDia}>{new Date(e.data).getDate()}</Text>
                  <Text style={styles.eventoMes}>{new Date(e.data).toLocaleString('pt-PT', { month: 'short' })}</Text>
                </View>
                <View style={styles.eventoInfo}>
                  <Text style={styles.eventoNome}>{e.titulo}</Text>
                  {e.local && <Text style={styles.eventoLocal}>{e.local}</Text>}
                </View>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderNotas() {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.trimestreSelector}>
          {([1, 2, 3] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.trimestreBtn, trimestreNotas === t && styles.trimestreBtnActive]} onPress={() => setTrimestreNotas(t)}>
              <Text style={[styles.trimestreText, trimestreNotas === t && styles.trimestreTextActive]}>{t}º Trimestre</Text>
            </TouchableOpacity>
          ))}
        </View>

        {notasTrimestre.length === 0 ? (
          <View style={styles.emptyTab}>
            <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTabText}>Sem notas lançadas neste trimestre</Text>
          </View>
        ) : (
          notasTrimestre.map(n => {
            const ok = n.nf >= 10;
            const border = n.nf === 0 ? Colors.border : ok ? Colors.success : Colors.danger;
            return (
              <View key={n.id} style={[styles.notaCard, { borderLeftColor: border, borderLeftWidth: 3 }]}>
                <View style={styles.notaCardHeader}>
                  <Text style={styles.notaDisciplina}>{n.disciplina}</Text>
                  <NotaCell value={n.nf || 0} />
                </View>
                <View style={styles.notaCardDetails}>
                  <Text style={styles.notaDetail}>T1: {n.aval1 || 0}</Text>
                  <Text style={styles.notaDetail}>T2: {n.aval2 || 0}</Text>
                  <Text style={styles.notaDetail}>T3: {n.aval3 || 0}</Text>
                  {n.mac > 0 && <Text style={styles.notaDetail}>MAC: {n.mac}</Text>}
                </View>
                <View style={[styles.badge, { backgroundColor: n.nf >= 10 ? `${Colors.success}20` : n.nf > 0 ? `${Colors.danger}20` : `${Colors.textMuted}20`, alignSelf: 'flex-start' }]}>
                  <Text style={[styles.badgeText, { color: n.nf >= 10 ? Colors.success : n.nf > 0 ? Colors.danger : Colors.textMuted }]}>
                    {n.nf >= 10 ? 'Aprovado' : n.nf > 0 ? 'Reprovado' : 'Sem nota'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderPresencas() {
    const total = presAluno.length;
    const presentes = presAluno.filter(p => p.status === 'P').length;
    const faltas = presAluno.filter(p => p.status === 'F').length;
    const justificadas = presAluno.filter(p => p.status === 'J').length;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard value={`${pctPresenca}%`} label="Assiduidade" color={Colors.success} />
          <StatCard value={presentes} label="Presenças" color={Colors.info} />
          <StatCard value={faltas} label="Faltas" color={Colors.danger} />
          <StatCard value={justificadas} label="Justificadas" color={Colors.warning} />
        </View>

        {presAluno.slice(0, 30).map(p => (
          <View key={p.id} style={styles.presencaRow}>
            <View style={[styles.presencaBadge, {
              backgroundColor: p.status === 'P' ? `${Colors.success}20` : p.status === 'J' ? `${Colors.warning}20` : `${Colors.danger}20`,
            }]}>
              <Text style={[styles.presencaStatus, {
                color: p.status === 'P' ? Colors.success : p.status === 'J' ? Colors.warning : Colors.danger,
              }]}>{p.status === 'P' ? 'P' : p.status === 'J' ? 'J' : 'F'}</Text>
            </View>
            <View style={styles.presencaInfo}>
              <Text style={styles.presencaDisciplina}>{p.disciplina}</Text>
              <Text style={styles.presencaData}>{p.data}</Text>
            </View>
            {p.observacao && <Text style={styles.presencaObs}>{p.observacao}</Text>}
          </View>
        ))}
        {presAluno.length === 0 && (
          <View style={styles.emptyTab}>
            <Ionicons name="checkmark-circle-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTabText}>Sem registos de presenças</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderFinanceiro() {
    const MESES: Record<number, string> = {
      1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
      7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
    };
    const mesesLetivosAll = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const mesAtual = new Date().getMonth() + 1;
    const mesesPassados = mesesLetivosAll.filter(m => m <= mesAtual);
    const mesesPagosSet = new Set(pagamentosAluno.filter(p => p.status === 'pago').map(p => p.mes));
    const mesesPendentesSet = new Set(pagamentosAluno.filter(p => p.status === 'pendente').map(p => p.mes));
    const mesesEmAtraso = mesesPassados.filter(m => !mesesPagosSet.has(m) && !mesesPendentesSet.has(m));
    const rupesAluno = aluno ? getRUPEsAluno(aluno.id) : [];
    const valorPropina = taxaPropina?.valor || 0;
    const temMulticaixa = !!config.telefoneMulticaixaExpress;
    const temReferencia = !!(config.numeroEntidade || config.iban);
    const temPagamentoOnline = temMulticaixa || temReferencia;

    async function handleGerarRUPE(mes: number) {
      if (!aluno || !taxaPropina || generatingRupe) return;
      setGeneratingRupe(true);
      try {
        const rupe = await gerarRUPE(aluno.id, taxaPropina.id, valorPropina);
        await addPagamento({
          alunoId: aluno.id,
          taxaId: taxaPropina.id,
          valor: valorPropina,
          data: new Date().toISOString().slice(0, 10),
          mes,
          ano: anoLetivo,
          status: 'pendente',
          metodoPagamento: 'transferencia',
          referencia: rupe.referencia,
          observacao: `Referência bancária — Propina de ${MESES[mes]}`,
        });
        setActiveRupe(rupe);
        setPaymentMethod('referencia');
        setPaymentMonth(mes);
      } finally {
        setGeneratingRupe(false);
      }
    }

    async function handleSolicitarMulticaixa(mes: number) {
      if (!aluno || !taxaPropina) return;
      await addPagamento({
        alunoId: aluno.id,
        taxaId: taxaPropina.id,
        valor: valorPropina,
        data: new Date().toISOString().slice(0, 10),
        mes,
        ano: anoLetivo,
        status: 'pendente',
        metodoPagamento: 'multicaixa',
        observacao: `Multicaixa Express — Propina de ${MESES[mes]}`,
      });
      setPaymentMethod('multicaixa');
      setPaymentMonth(mes);
    }

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard value={formatAOA(totalPago)} label="Total Pago" color={Colors.success} />
          <StatCard value={mesesAtraso} label="Meses em Atraso" color={mesesAtraso > 0 ? Colors.danger : Colors.success} />
        </View>

        {mesesAtraso > 0 && (
          <View style={styles.alertBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{mesesAtraso} {mesesAtraso === 1 ? 'mês em atraso' : 'meses em atraso'}</Text>
              <Text style={styles.alertText}>Multa estimada: {formatAOA(multaEstimada)} · Regularize para evitar penalizações.</Text>
            </View>
          </View>
        )}

        {/* ── PAGAMENTOS ONLINE ── */}
        {temPagamentoOnline && mesesEmAtraso.length > 0 && (
          <>
            <SectionTitle title="Pagar Online" icon="card" />
            <Text style={{ fontSize: 12, color: Colors.textSecondary, fontFamily: 'Inter_400Regular', marginBottom: 12, lineHeight: 18 }}>
              Pague as propinas em atraso sem sair de casa. Escolha um mês e o método de pagamento.
            </Text>

            {mesesEmAtraso.map(mes => {
              const isSelected = paymentMonth === mes;
              return (
                <View key={mes} style={{ backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: isSelected ? Colors.gold : Colors.border, marginBottom: 10, overflow: 'hidden' }}>
                  {/* Cabeçalho do mês */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${Colors.danger}18`, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="calendar" size={20} color={Colors.danger} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{MESES[mes]}</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>{formatAOA(valorPropina)} · Propina</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        if (isSelected) { setPaymentMonth(null); setPaymentMethod(null); setActiveRupe(null); }
                        else { setPaymentMonth(mes); setPaymentMethod(null); setActiveRupe(null); }
                      }}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: isSelected ? `${Colors.gold}20` : `${Colors.danger}15`, borderWidth: 1, borderColor: isSelected ? Colors.gold : `${Colors.danger}40` }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: isSelected ? Colors.gold : Colors.danger }}>
                        {isSelected ? 'Fechar' : 'Pagar'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Seleção de método */}
                  {isSelected && paymentMethod === null && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginBottom: 4 }}>Escolha o método de pagamento:</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {temMulticaixa && (
                          <TouchableOpacity
                            onPress={() => handleSolicitarMulticaixa(mes)}
                            style={{ flex: 1, backgroundColor: `${Colors.success}12`, borderRadius: 12, borderWidth: 1, borderColor: `${Colors.success}40`, padding: 14, alignItems: 'center', gap: 8 }}
                          >
                            <MaterialCommunityIcons name="cellphone" size={28} color={Colors.success} />
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.success, textAlign: 'center' }}>Multicaixa{'\n'}Express</Text>
                          </TouchableOpacity>
                        )}
                        {temReferencia && (
                          <TouchableOpacity
                            onPress={() => handleGerarRUPE(mes)}
                            disabled={generatingRupe}
                            style={{ flex: 1, backgroundColor: `${Colors.info}12`, borderRadius: 12, borderWidth: 1, borderColor: `${Colors.info}40`, padding: 14, alignItems: 'center', gap: 8, opacity: generatingRupe ? 0.6 : 1 }}
                          >
                            <Ionicons name="document-text" size={28} color={Colors.info} />
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.info, textAlign: 'center' }}>Referência{'\n'}Bancária</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Instruções Multicaixa Express */}
                  {isSelected && paymentMethod === 'multicaixa' && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                      <View style={{ backgroundColor: `${Colors.success}10`, borderRadius: 14, borderWidth: 1, borderColor: `${Colors.success}30`, padding: 14, gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <MaterialCommunityIcons name="cellphone" size={20} color={Colors.success} />
                          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.success }}>Multicaixa Express</Text>
                        </View>

                        <View style={{ backgroundColor: Colors.background, borderRadius: 12, padding: 14, gap: 8 }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Número do Beneficiário</Text>
                          <Text style={{ fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.success, letterSpacing: 3 }}>{config.telefoneMulticaixaExpress}</Text>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary }}>{config.nomeBeneficiario || config.nomeEscola}</Text>
                          <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Valor a pagar</Text>
                            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text }}>{formatAOA(valorPropina)}</Text>
                          </View>
                        </View>

                        <View style={{ backgroundColor: Colors.background, borderRadius: 12, padding: 12, gap: 5 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 }}>Como pagar (passo a passo):</Text>
                          {[
                            '1. Abra a app Multicaixa Express ou marque *840#',
                            '2. Seleccione "Pagamento" → "Pagamento de Serviços"',
                            `3. Introduza o número: ${config.telefoneMulticaixaExpress}`,
                            `4. Introduza o valor: ${formatAOA(valorPropina)}`,
                            `5. Descrição: Propina ${MESES[mes]} — ${aluno.nome} ${aluno.apelido}`,
                            '6. Confirme com o seu PIN Multicaixa',
                            '7. Guarde o comprovativo e envie à secretaria',
                          ].map((step, i) => (
                            <Text key={i} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 }}>{step}</Text>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: `${Colors.warning}15`, borderRadius: 10, padding: 10, alignItems: 'flex-start' }}>
                          <Ionicons name="information-circle" size={16} color={Colors.warning} />
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.warning, flex: 1, lineHeight: 16 }}>
                            Após o pagamento, a secretaria irá confirmar e actualizar o seu estado em até 1 dia útil.
                          </Text>
                        </View>

                        <TouchableOpacity onPress={() => { setPaymentMethod(null); setPaymentMonth(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                          <Ionicons name="arrow-back" size={14} color={Colors.textMuted} />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Voltar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Referência Bancária gerada */}
                  {isSelected && paymentMethod === 'referencia' && activeRupe && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                      <View style={{ backgroundColor: `${Colors.info}10`, borderRadius: 14, borderWidth: 1, borderColor: `${Colors.info}30`, padding: 14, gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="document-text" size={20} color={Colors.info} />
                          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.info }}>Referência Bancária Gerada</Text>
                        </View>

                        <View style={{ backgroundColor: Colors.background, borderRadius: 12, padding: 14, gap: 10 }}>
                          {config.numeroEntidade && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Entidade</Text>
                              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: 1 }}>{config.numeroEntidade}</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Referência</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.info, letterSpacing: 1 }}>{activeRupe.referencia}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Valor</Text>
                            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.success }}>{formatAOA(activeRupe.valor)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Válida até</Text>
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{new Date(activeRupe.dataValidade).toLocaleDateString('pt-PT')}</Text>
                          </View>
                          {config.iban && (
                            <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, gap: 3 }}>
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>IBAN / NIB</Text>
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text, letterSpacing: 0.5 }}>{config.iban}</Text>
                            </View>
                          )}
                          {config.bancoTransferencia && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Banco</Text>
                              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{config.bancoTransferencia}</Text>
                            </View>
                          )}
                          {config.nomeBeneficiario && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Beneficiário</Text>
                              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{config.nomeBeneficiario}</Text>
                            </View>
                          )}
                        </View>

                        <View style={{ backgroundColor: Colors.background, borderRadius: 12, padding: 12, gap: 5 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 }}>Como pagar (passo a passo):</Text>
                          {[
                            '1. Dirija-se a qualquer caixa Multicaixa (ATM) ou balcão bancário',
                            '2. Seleccione "Pagamento de Serviços" ou "Referências"',
                            `3. Entidade: ${config.numeroEntidade || '(ver acima)'}`,
                            '4. Introduza a Referência acima exactamente como indicado',
                            `5. Confirme o valor: ${formatAOA(activeRupe.valor)}`,
                            '6. Guarde o talão/comprovativo do pagamento',
                            '7. Envie foto do comprovativo à secretaria',
                          ].map((step, i) => (
                            <Text key={i} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 }}>{step}</Text>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: `${Colors.warning}15`, borderRadius: 10, padding: 10, alignItems: 'flex-start' }}>
                          <Ionicons name="time" size={16} color={Colors.warning} />
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.warning, flex: 1, lineHeight: 16 }}>
                            Esta referência é válida por 15 dias. Após o prazo, será necessário gerar uma nova referência.
                          </Text>
                        </View>

                        <TouchableOpacity onPress={() => { setPaymentMethod(null); setActiveRupe(null); setPaymentMonth(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                          <Ionicons name="arrow-back" size={14} color={Colors.textMuted} />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Voltar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Pagamentos em processamento */}
        {mesesPendentesSet.size > 0 && (
          <>
            <SectionTitle title="Em Processamento" icon="hourglass" />
            {Array.from(mesesPendentesSet).map(mes => (
              <View key={mes} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: `${Colors.warning}40`, padding: 12, marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="hourglass-outline" size={18} color={Colors.warning} />
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{MESES[mes] || `Mês ${mes}`}</Text>
                </View>
                <View style={{ backgroundColor: `${Colors.warning}20`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.warning }}>A aguardar confirmação</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Referências Geradas */}
        {rupesAluno.length > 0 && (
          <>
            <SectionTitle title="Referências Geradas" icon="receipt" />
            {rupesAluno.slice(0, 5).map(r => (
              <View key={r.id} style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 6, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{r.referencia}</Text>
                  <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: r.status === 'pago' ? `${Colors.success}20` : r.status === 'expirado' ? `${Colors.danger}20` : `${Colors.info}20` }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: r.status === 'pago' ? Colors.success : r.status === 'expirado' ? Colors.danger : Colors.info }}>
                      {r.status === 'pago' ? 'Pago' : r.status === 'expirado' ? 'Expirado' : 'Activo'}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>{formatAOA(r.valor)}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Válido até {new Date(r.dataValidade).toLocaleDateString('pt-PT')}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {!temPagamentoOnline && mesesEmAtraso.length > 0 && (
          <View style={{ backgroundColor: `${Colors.info}10`, borderRadius: 12, borderWidth: 1, borderColor: `${Colors.info}30`, padding: 14, marginBottom: 16, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Ionicons name="information-circle" size={16} color={Colors.info} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.info }}>Pagamento Presencial</Text>
            </View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18 }}>
              Dirija-se ao balcão financeiro da escola para regularizar as propinas em atraso. Traga o cartão do aluno e o comprovativo do último pagamento.
            </Text>
          </View>
        )}

        <SectionTitle title="Taxas Aplicáveis" icon="pricetag" />
        {taxasNivel.length === 0 ? (
          <View style={[styles.emptyTab, { paddingTop: 20 }]}>
            <Text style={styles.emptyTabText}>Sem taxas configuradas para este nível</Text>
          </View>
        ) : (
          taxasNivel.map(t => (
            <View key={t.id} style={styles.taxaCard}>
              <View style={styles.taxaInfo}>
                <Text style={styles.taxaNome}>{t.descricao || t.tipo}</Text>
                <Text style={styles.taxaTipo}>{t.tipo} · {t.frequencia}</Text>
              </View>
              <Text style={styles.taxaValor}>{formatAOA(t.valor)}</Text>
            </View>
          ))
        )}

        <SectionTitle title="Histórico de Pagamentos" icon="receipt" />
        {pagamentosAluno.length === 0 ? (
          <View style={styles.emptyTab}>
            <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTabText}>Sem pagamentos registados</Text>
          </View>
        ) : (
          pagamentosAluno.slice(0, 20).map(p => (
            <View key={p.id} style={styles.pagCard}>
              <View style={styles.pagInfo}>
                <Text style={styles.pagDesc}>{p.observacao || (p.mes ? `Propina de ${MESES[p.mes]}` : 'Pagamento')}</Text>
                <Text style={styles.pagData}>{p.data || (p as any).createdAt?.slice(0, 10)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={styles.pagValor}>{formatAOA(p.valor)}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: p.status === 'pago' ? Colors.success : p.status === 'pendente' ? Colors.warning : Colors.textMuted }}>
                  {p.status === 'pago' ? 'Pago' : p.status === 'pendente' ? 'Pendente' : 'Cancelado'}
                </Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderMensagens() {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {mensagensAluno.length === 0 ? (
          <View style={styles.emptyTab}>
            <Ionicons name="chatbubbles-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTabText}>Sem mensagens da escola</Text>
          </View>
        ) : (
          mensagensAluno.slice(0, 20).map(m => (
            <View key={m.id} style={styles.msgCard}>
              <View style={styles.msgHeader}>
                <Text style={styles.msgTitle}>{m.titulo || m.assunto || 'Mensagem'}</Text>
                <Text style={styles.msgData}>{m.data || m.createdAt?.slice(0, 10)}</Text>
              </View>
              <Text style={styles.msgBody}>{m.corpo || m.mensagem || ''}</Text>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderHorario() {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diaSelector}>
          {DIAS.map((d, i) => (
            <TouchableOpacity key={d} style={[styles.diaBtn, diaHorario === i && styles.diaBtnActive]} onPress={() => setDiaHorario(i)}>
              <Text style={[styles.diaText, diaHorario === i && styles.diaTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {horariosHoje.length === 0 ? (
          <View style={styles.emptyTab}>
            <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTabText}>Sem aulas neste dia</Text>
          </View>
        ) : (
          horariosHoje.map((h: any) => (
            <View key={h.id} style={styles.horarioCard}>
              <View style={styles.horarioTime}>
                <Text style={styles.horarioHora}>{h.horaInicio}</Text>
                <Text style={styles.horarioFim}>{h.horaFim}</Text>
              </View>
              <View style={styles.horarioInfo}>
                <Text style={styles.horarioDisc}>{h.disciplina}</Text>
                {h.sala && <Text style={styles.horarioSala}>{h.sala}</Text>}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderMateriais() {
    const TIPO_ICON: Record<string, string> = {
      texto: 'document-text', link: 'link', resumo: 'book',
      pdf: 'document', docx: 'document', ppt: 'easel',
    };
    const TIPO_COLOR: Record<string, string> = {
      texto: Colors.info, link: Colors.success, resumo: Colors.gold,
      pdf: Colors.danger, docx: Colors.info, ppt: Colors.warning,
    };
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {materiaisAluno.length === 0 ? (
          <View style={styles.emptyTab}>
            <Ionicons name="library-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTabText}>Sem materiais didácticos disponíveis</Text>
          </View>
        ) : (
          materiaisAluno.map(m => (
            <View key={m.id} style={styles.materialCard}>
              <View style={[styles.materialIconBox, { backgroundColor: `${TIPO_COLOR[m.tipo] || Colors.info}15` }]}>
                <Ionicons name={(TIPO_ICON[m.tipo] || 'document') as any} size={22} color={TIPO_COLOR[m.tipo] || Colors.info} />
              </View>
              <View style={styles.materialInfo}>
                <Text style={styles.materialTitulo}>{m.titulo}</Text>
                <Text style={styles.materialDisc}>{m.disciplina} · {m.turmaNome}</Text>
                {m.descricao ? <Text style={styles.materialDesc} numberOfLines={2}>{m.descricao}</Text> : null}
              </View>
              {m.tipo === 'link' && m.conteudo ? (
                <TouchableOpacity onPress={() => Linking.openURL(m.conteudo).catch(() => {})}>
                  <Ionicons name="open-outline" size={20} color={Colors.info} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderCalendario() {
    const TIPO_BADGE: Record<string, { label: string; color: string }> = {
      teste: { label: 'Teste', color: Colors.warning },
      exame: { label: 'Exame', color: Colors.danger },
      trabalho: { label: 'Trabalho', color: Colors.info },
      prova_oral: { label: 'Prova Oral', color: Colors.accent },
    };
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {calendarioAluno.length === 0 ? (
          <View style={styles.emptyTab}>
            <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTabText}>Sem provas agendadas</Text>
          </View>
        ) : (
          calendarioAluno.map(c => {
            const badge = TIPO_BADGE[c.tipo] || { label: c.tipo, color: Colors.gold };
            const dataProva = new Date(c.data);
            const passado = dataProva < new Date();
            return (
              <View key={c.id} style={[styles.provaCard, passado && { opacity: 0.55 }]}>
                <View style={styles.provaData}>
                  <Text style={styles.provaDia}>{dataProva.getDate()}</Text>
                  <Text style={styles.provaMes}>{dataProva.toLocaleString('pt-PT', { month: 'short' })}</Text>
                </View>
                <View style={styles.provaInfo}>
                  <Text style={styles.provaTitulo}>{c.titulo}</Text>
                  <Text style={styles.provaDisc}>{c.disciplina} · {c.hora}</Text>
                  <View style={[styles.badge, { backgroundColor: `${badge.color}20`, marginTop: 4 }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                {passado && <Ionicons name="checkmark-circle" size={18} color={Colors.textMuted} />}
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  const tabContent = {
    painel: renderPainel(),
    notas: renderNotas(),
    presencas: renderPresencas(),
    financeiro: renderFinanceiro(),
    mensagens: renderMensagens(),
    horario: renderHorario(),
    materiais: renderMateriais(),
    calendario: renderCalendario(),
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Portal do Encarregado" subtitle={`${aluno.nome} ${aluno.apelido}`} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]} onPress={() => setActiveTab(tab.key)}>
            <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.key ? Colors.gold : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tabContent[activeTab]}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyStateTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },
  emptyStateText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  tabBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.gold },
  tabLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabLabelActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  tabContent: { flex: 1, padding: 16 },

  alunoHero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  alunoAvatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: `${Colors.gold}25`, alignItems: 'center', justifyContent: 'center' },
  alunoAvatarText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold },
  alunoHeroInfo: { flex: 1, gap: 4 },
  alunoNome: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  alertBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: `${Colors.danger}12`, borderRadius: 12, borderWidth: 1, borderColor: `${Colors.danger}30`, padding: 14, marginBottom: 16 },
  alertTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.danger, marginBottom: 2 },
  alertText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 8 },
  sectionTitleText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },

  infoCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  infoValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },

  eventoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  eventoData: { width: 44, alignItems: 'center', backgroundColor: `${Colors.gold}15`, borderRadius: 10, paddingVertical: 6 },
  eventoDia: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.gold },
  eventoMes: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  eventoInfo: { flex: 1, gap: 2 },
  eventoNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  eventoLocal: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  trimestreSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  trimestreBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  trimestreBtnActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  trimestreText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  trimestreTextActive: { color: Colors.gold, fontFamily: 'Inter_700Bold' },

  notaCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8, gap: 8 },
  notaCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notaDisciplina: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, flex: 1 },
  notaCell: { borderWidth: 1.5, borderRadius: 10, width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  notaValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  notaCardDetails: { flexDirection: 'row', gap: 12 },
  notaDetail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  presencaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 6 },
  presencaBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  presencaStatus: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  presencaInfo: { flex: 1 },
  presencaDisciplina: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  presencaData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  presencaObs: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, maxWidth: 120 },

  taxaCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundCard, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 6 },
  taxaInfo: { flex: 1, gap: 2 },
  taxaNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  taxaTipo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  taxaValor: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.gold },

  pagCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.backgroundCard, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 6 },
  pagInfo: { flex: 1, gap: 2 },
  pagDesc: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  pagData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  pagValor: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.success },

  msgCard: { backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8, gap: 8 },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  msgTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, flex: 1 },
  msgData: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  msgBody: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18 },

  diaSelector: { maxHeight: 48, marginBottom: 12 },
  diaBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  diaBtnActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  diaText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  diaTextActive: { color: Colors.gold, fontFamily: 'Inter_700Bold' },

  horarioCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8 },
  horarioTime: { alignItems: 'center', minWidth: 50 },
  horarioHora: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.gold },
  horarioFim: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  horarioInfo: { flex: 1, gap: 2 },
  horarioDisc: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  horarioSala: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  emptyTab: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyTabText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  materialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 8 },
  materialIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  materialInfo: { flex: 1, gap: 3 },
  materialTitulo: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  materialDisc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  materialDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, lineHeight: 16 },

  provaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  provaData: { width: 48, alignItems: 'center', backgroundColor: `${Colors.accent}15`, borderRadius: 10, paddingVertical: 8 },
  provaDia: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.accent },
  provaMes: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textTransform: 'uppercase' },
  provaInfo: { flex: 1, gap: 2 },
  provaTitulo: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  provaDisc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
});
