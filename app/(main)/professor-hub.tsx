import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Image, Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import api from '@/lib/api';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmt(v: number) {
  return v.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
}

function StatCard({ value, label, color, icon }: { value: string | number; label: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, route, badge, color }: { icon: string; label: string; route: string; badge?: number; color?: string; }) {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.quickAction} onPress={() => router.push(route as any)} activeOpacity={0.7}>
      <View style={[styles.quickActionIcon, { backgroundColor: (color || Colors.info) + '22' }]}>
        <Ionicons name={icon as any} size={24} color={color || Colors.info} />
        {badge !== undefined && badge > 0 && (
          <View style={styles.qaBadge}>
            <Text style={styles.qaBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Painel de Estimativa Salarial ────────────────────────────────────────────
interface ReciboEstimado {
  semPerfil?: boolean;
  nome?: string;
  cargo?: string;
  tipoContrato?: string;
  mes?: number;
  ano?: number;
  temposSemanais?: number;
  temposEsperados?: number;
  temposTrabalhados?: number;
  diasUteisCorridos?: number;
  totalDiasUteisNoMes?: number;
  isCurrentMonth?: boolean;
  faltasMes?: number;
  salarioBase?: number;
  valorPorTempoLectivo?: number;
  salColaborador?: number;
  descontoTempos?: number;
  descontoFaltas?: number;
  subsidioAlimentacao?: number;
  subsidioTransporte?: number;
  subsidioHabitacao?: number;
  salarioBruto?: number;
  inssEmpregado?: number;
  irt?: number;
  salarioLiquido?: number;
  semanasPorMes?: number;
  inssEmpPerc?: number;
}

const TIPO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', colaborador: 'Colaborador',
  contratado: 'Contratado', prestacao_servicos: 'Prestação de Serviços',
};

function EstimativaSalarialCard() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano] = useState(now.getFullYear());
  const [data, setData] = useState<ReciboEstimado | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: number, a: number) => {
    setLoading(true);
    try {
      const r = await api.get(`/api/meu-recibo-estimado?mes=${m}&ano=${a}`);
      setData(r);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(mes, ano); }, [mes, ano]);

  const mesAnterior = () => {
    if (mes === 1) return;
    setMes(m => m - 1);
  };
  const mesSeguinte = () => {
    if (mes === now.getMonth() + 1 && ano === now.getFullYear()) return;
    setMes(m => m + 1);
  };

  if (loading) {
    return (
      <View style={sal.card}>
        <ActivityIndicator color={Colors.gold} style={{ padding: 20 }} />
      </View>
    );
  }

  if (!data || data.semPerfil) return null;

  const isColaborador = ['colaborador', 'contratado', 'prestacao_servicos'].includes(data.tipoContrato ?? '');
  const temFalta = (data.faltasMes ?? 0) > 0;

  return (
    <View style={sal.card}>
      {/* Cabeçalho */}
      <View style={sal.header}>
        <View style={sal.headerLeft}>
          <MaterialCommunityIcons name="cash-multiple" size={18} color={Colors.gold} />
          <Text style={sal.title}>Estimativa de Vencimento</Text>
        </View>
        <View style={sal.mesNav}>
          <TouchableOpacity onPress={mesAnterior} disabled={mes === 1}>
            <Ionicons name="chevron-back" size={16} color={mes === 1 ? Colors.textMuted : Colors.gold} />
          </TouchableOpacity>
          <Text style={sal.mesLabel}>{MESES[mes - 1]}</Text>
          <TouchableOpacity onPress={mesSeguinte} disabled={mes === now.getMonth() + 1}>
            <Ionicons name="chevron-forward" size={16} color={mes === now.getMonth() + 1 ? Colors.textMuted : Colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tipo de contrato */}
      <View style={sal.tipoBadge}>
        <Text style={sal.tipoText}>{TIPO_LABEL[data.tipoContrato ?? ''] ?? data.tipoContrato}</Text>
      </View>

      {/* Tempos lectivos */}
      {(data.temposSemanais ?? 0) > 0 && (
        <View style={sal.temposBox}>
          <View style={sal.temposRow}>
            <Text style={sal.temposLabel}>Tempos esperados (mês completo)</Text>
            <Text style={sal.temposVal}>{data.temposEsperados} ({data.temposSemanais}/sem)</Text>
          </View>
          {isColaborador && data.isCurrentMonth && (
            <View style={sal.temposRow}>
              <Text style={sal.temposLabel}>Dias úteis decorridos</Text>
              <Text style={sal.temposVal}>{data.diasUteisCorridos} / {data.totalDiasUteisNoMes} dias úteis</Text>
            </View>
          )}
          <View style={sal.temposRow}>
            <Text style={sal.temposLabel}>{isColaborador && data.isCurrentMonth ? 'Tempos ganhos até hoje' : 'Tempos trabalhados'}</Text>
            <Text style={[sal.temposVal, { color: temFalta ? Colors.warning : Colors.success }]}>
              {data.temposTrabalhados}
            </Text>
          </View>
          {temFalta && (
            <View style={sal.temposRow}>
              <Text style={[sal.temposLabel, { color: Colors.danger }]}>Faltas / tempos em falta</Text>
              <Text style={[sal.temposVal, { color: Colors.danger }]}>{data.faltasMes}</Text>
            </View>
          )}
        </View>
      )}

      {/* Alerta de falta */}
      {temFalta && (
        <View style={sal.alertBox}>
          <Ionicons name="warning" size={14} color={Colors.warning} />
          <Text style={sal.alertText}>
            {data.faltasMes} falta(s) registada(s) este mês — impacto no salário aplicado abaixo.
          </Text>
        </View>
      )}

      {/* Discriminação */}
      <View style={sal.breakdown}>
        {/* Créditos */}
        {isColaborador && (data.salColaborador ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={sal.bLabel}>
              {`Tempos dados (${data.temposTrabalhados} × ${fmt(data.valorPorTempoLectivo ?? 0)})`}
            </Text>
            <Text style={[sal.bVal, { color: Colors.success }]}>{fmt(data.salColaborador ?? 0)}</Text>
          </View>
        )}
        {!isColaborador && (data.salarioBase ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={sal.bLabel}>Salário Base</Text>
            <Text style={[sal.bVal, { color: Colors.success }]}>{fmt(data.salarioBase ?? 0)}</Text>
          </View>
        )}
        {(data.subsidioAlimentacao ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={sal.bLabel}>Subsídio de Alimentação</Text>
            <Text style={[sal.bVal, { color: Colors.success }]}>{fmt(data.subsidioAlimentacao ?? 0)}</Text>
          </View>
        )}
        {(data.subsidioTransporte ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={sal.bLabel}>Subsídio de Transporte</Text>
            <Text style={[sal.bVal, { color: Colors.success }]}>{fmt(data.subsidioTransporte ?? 0)}</Text>
          </View>
        )}
        {(data.subsidioHabitacao ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={sal.bLabel}>Subsídio de Habitação</Text>
            <Text style={[sal.bVal, { color: Colors.success }]}>{fmt(data.subsidioHabitacao ?? 0)}</Text>
          </View>
        )}

        {/* Separador */}
        <View style={sal.divider} />

        {/* Descontos */}
        {(data.descontoTempos ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={[sal.bLabel, { color: Colors.danger }]}>
              {`Desconto tempos não dados (${data.faltasMes})`}
            </Text>
            <Text style={[sal.bVal, { color: Colors.danger }]}>- {fmt(data.descontoTempos ?? 0)}</Text>
          </View>
        )}
        {(data.descontoFaltas ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={[sal.bLabel, { color: Colors.danger }]}>Desconto por faltas</Text>
            <Text style={[sal.bVal, { color: Colors.danger }]}>- {fmt(data.descontoFaltas ?? 0)}</Text>
          </View>
        )}
        {(data.inssEmpregado ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={[sal.bLabel, { color: '#FF7141' }]}>{`INSS Empregado (${data.inssEmpPerc}%)`}</Text>
            <Text style={[sal.bVal, { color: '#FF7141' }]}>- {fmt(data.inssEmpregado ?? 0)}</Text>
          </View>
        )}
        {(data.irt ?? 0) > 0 && (
          <View style={sal.bRow}>
            <Text style={[sal.bLabel, { color: Colors.danger }]}>IRT</Text>
            <Text style={[sal.bVal, { color: Colors.danger }]}>- {fmt(data.irt ?? 0)}</Text>
          </View>
        )}

        {/* Líquido */}
        <View style={sal.liquidoRow}>
          <Text style={sal.liquidoLabel}>Salário Líquido Estimado</Text>
          <Text style={sal.liquidoVal}>{fmt(data.salarioLiquido ?? 0)}</Text>
        </View>
      </View>

      <Text style={sal.nota}>* Estimativa baseada nos dados registados até ao momento. Sujeita a ajustes finais pela equipa de RH.</Text>
    </View>
  );
}

// ─── Ecrã Principal ───────────────────────────────────────────────────────────
export default function ProfessorHubScreen() {
  const { user } = useAuth();
  const { professores, turmas, alunos, notas, presencas } = useData();
  const { sumarios, pautas, mensagens, solicitacoes, calendarioProvas } = useProfessor();
  const { notificacoes, unreadCount, marcarLida } = useNotificacoes();
  const { anoSelecionado } = useAnoAcademico();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [showReaberturaModal, setShowReaberturaModal] = useState(false);
  const reaberturaNotifs = useMemo(
    () => notificacoes.filter(n => n.tipo === 'reabertura_aprovada' && !n.lida),
    [notificacoes]
  );

  useEffect(() => {
    if (reaberturaNotifs.length > 0) {
      setShowReaberturaModal(true);
    }
  }, [reaberturaNotifs.length]);

  const prof = useMemo(() => professores.find(p => p.email === user?.email), [professores, user]);

  const minhasTurmas = useMemo(() =>
    prof ? turmas.filter(t => prof.turmasIds.includes(t.id) && t.ativo) : [],
    [prof, turmas]
  );

  const isDirector = useMemo(() =>
    prof ? turmas.some(t => t.professorId === prof.id && t.ativo) : false,
    [prof, turmas]
  );

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const meusSumarios = useMemo(() =>
    sumarios.filter(s => s.professorId === prof?.id),
    [sumarios, prof]
  );

  const sumariosMes = useMemo(() =>
    meusSumarios.filter(s => {
      const d = new Date(s.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }),
    [meusSumarios, mesAtual, anoAtual]
  );

  const aulasLecionadas = meusSumarios.filter(s => s.status !== 'rejeitado').length;
  const faltasMes = sumariosMes.filter(s => s.status === 'rejeitado').length;

  const minhasNotas = useMemo(() =>
    notas.filter(n => n.professorId === prof?.id),
    [notas, prof]
  );

  const avaliacoesDadas = minhasNotas.filter(n => n.aval1 > 0 || n.aval2 > 0 || n.aval3 > 0 || n.aval4 > 0).length;
  const provasDadas = minhasNotas.filter(n => n.pp1 > 0 || n.ppt > 0).length;

  const minhasMensagensNaoLidas = useMemo(() =>
    mensagens.filter(m =>
      (m.tipo === 'privada' && m.destinatarioId === prof?.id) ||
      (m.tipo === 'turma' && minhasTurmas.some(t => t.id === m.turmaId))
    ).filter(m => !m.lidaPor.includes(prof?.id || '')).length,
    [mensagens, prof, minhasTurmas]
  );

  const provasPublicadas = useMemo(() =>
    calendarioProvas.filter(p => p.publicado && p.turmasIds.some(tid => minhasTurmas.some(t => t.id === tid))),
    [calendarioProvas, minhasTurmas]
  );

  const solicitacoesPendentes = solicitacoes.filter(s => s.professorId === prof?.id && s.status === 'pendente').length;

  const proximasProvas = provasPublicadas
    .filter(p => new Date(p.data) >= hoje)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 4);

  const tipoProvaColor: Record<string, string> = {
    teste: Colors.info,
    exame: Colors.danger,
    trabalho: Colors.gold,
    prova_oral: Colors.success,
  };

  async function handleIrParaPauta() {
    for (const n of reaberturaNotifs) {
      await marcarLida(n.id);
    }
    setShowReaberturaModal(false);
    const link = reaberturaNotifs[0]?.link;
    router.push((link || '/(main)/professor-pauta') as any);
  }

  async function handleDismissReabertura() {
    for (const n of reaberturaNotifs) {
      await marcarLida(n.id);
    }
    setShowReaberturaModal(false);
  }

  return (
    <View style={styles.container}>
      {/* Modal de notificação de reabertura aprovada */}
      <Modal visible={showReaberturaModal} transparent animationType="fade" onRequestClose={() => setShowReaberturaModal(false)}>
        <View style={rab.overlay}>
          <View style={rab.card}>
            <View style={rab.iconRow}>
              <View style={rab.iconCircle}>
                <Ionicons name="lock-open" size={28} color={Colors.gold} />
              </View>
            </View>
            <Text style={rab.title}>Reabertura Aprovada</Text>
            <Text style={rab.subtitle}>
              {reaberturaNotifs.length === 1
                ? 'Tem um campo de pauta reaberto aguardando o seu lançamento.'
                : `Tem ${reaberturaNotifs.length} campos de pauta reabertos aguardando o seu lançamento.`}
            </Text>
            <ScrollView style={{ maxHeight: 180, width: '100%' }} showsVerticalScrollIndicator={false}>
              {reaberturaNotifs.map(n => (
                <View key={n.id} style={rab.notifRow}>
                  <Ionicons name="ellipse" size={7} color={Colors.gold} style={{ marginTop: 5 }} />
                  <Text style={rab.notifText}>{n.mensagem}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={rab.btnPrimary} onPress={handleIrParaPauta} activeOpacity={0.8}>
              <Ionicons name="document-text" size={18} color="#fff" />
              <Text style={rab.btnPrimaryText}>Ir para a Pauta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rab.btnSecondary} onPress={handleDismissReabertura} activeOpacity={0.7}>
              <Text style={rab.btnSecondaryText}>Mais tarde</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TopBar title="Meu Painel" subtitle={prof ? `Prof. ${prof.nome} ${prof.apelido}` : 'Professor'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>

        {/* Welcome Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerAvatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={{ width: 52, height: 52, borderRadius: 26 }} />
            ) : (
              <Text style={styles.bannerAvatarText}>
                {user?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || 'P'}
              </Text>
            )}
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerGreet}>Bem-vindo,</Text>
            <Text style={styles.bannerName} numberOfLines={1}>{user?.nome}</Text>
            <Text style={styles.bannerSub}>{prof?.disciplinas?.join(' · ') || 'Professor'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(main)/perfil' as any)} style={styles.bannerEdit}>
            <Ionicons name="settings-outline" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Este Mês</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard value={faltasMes} label="Faltas" color={Colors.danger} icon="close-circle" />
          <StatCard value={aulasLecionadas} label="Aulas Dadas" color={Colors.success} icon="school" />
          <StatCard value={provasDadas} label="Provas" color={Colors.gold} icon="document-text" />
          <StatCard value={avaliacoesDadas} label="Avaliações" color={Colors.info} icon="bar-chart" />
          <StatCard value={minhasTurmas.length} label="Turmas" color={Colors.accent} icon="people" />
        </ScrollView>

        {/* Estimativa Salarial */}
        <Text style={styles.sectionTitle}>Estimativa de Vencimento</Text>
        <EstimativaSalarialCard />

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Acesso Rápido</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon="document-text" label="Pautas & Notas" route="/(main)/professor-pauta" color={Colors.gold} />
          <QuickAction icon="people" label="Minhas Turmas" route="/(main)/professor-turmas" color={Colors.info} />
          {isDirector && (
            <QuickAction icon="shield-checkmark" label="Director de Turma" route="/(main)/director-turma" color={Colors.gold} />
          )}
          <QuickAction icon="stats-chart" label="Desempenho" route="/(main)/desempenho" color="#8B5CF6" />
          <QuickAction icon="chatbubbles" label="Mensagens" route="/(main)/professor-mensagens" badge={minhasMensagensNaoLidas} color={Colors.success} />
          <QuickAction icon="folder-open" label="Materiais" route="/(main)/professor-materiais" color={Colors.accent} />
          <QuickAction icon="document-text-outline" label="Plano de Aula" route="/(main)/professor-plano-aula" color={Colors.gold} />
          <QuickAction icon="clipboard" label="Sumário / Presença" route="/(main)/professor-sumario" badge={meusSumarios.filter(s => s.status === 'pendente').length} color={Colors.warning} />
          <QuickAction icon="book" label="Diário de Classe" route="/(main)/diario-classe" color={Colors.info} />
          <QuickAction icon="time" label="Horário" route="/(main)/horario" color={Colors.primaryLight} />
          <QuickAction icon="stats-chart-outline" label="Relatório de Faltas" route="/(main)/relatorio-faltas" color={Colors.danger} />
          <QuickAction icon="notifications" label="Notificações" route="/(main)/notificacoes" badge={unreadCount} color={Colors.accent} />
          <QuickAction icon="person" label="Meu Perfil" route="/(main)/perfil" color={Colors.textSecondary} />
        </View>

        {/* Upcoming Exams */}
        {proximasProvas.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Próximas Provas</Text>
            <View style={styles.provasCard}>
              {proximasProvas.map(prova => {
                const data = new Date(prova.data);
                const diffDays = Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
                const color = tipoProvaColor[prova.tipo] || Colors.info;
                return (
                  <View key={prova.id} style={styles.provaRow}>
                    <View style={[styles.provaColorBar, { backgroundColor: color }]} />
                    <View style={styles.provaInfo}>
                      <Text style={styles.provaTitulo}>{prova.titulo}</Text>
                      <Text style={styles.provaSub}>{prova.disciplina} · {prova.hora}</Text>
                    </View>
                    <View style={styles.provaDate}>
                      <Text style={[styles.provaDateNum, { color }]}>
                        {data.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                      </Text>
                      <Text style={styles.provaDateSub}>em {diffDays}d</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Pending Requests */}
        {solicitacoesPendentes > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/(main)/professor-pauta' as any)}
          >
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={styles.alertText}>
              {solicitacoesPendentes} solicitação(ões) de reabertura pendente(s)
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* Recent Sumarios */}
        {meusSumarios.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sumários Recentes</Text>
            <View style={styles.sumCard}>
              {meusSumarios.slice(-3).reverse().map(s => (
                <View key={s.id} style={styles.sumRow}>
                  <View style={[styles.sumStatus, {
                    backgroundColor: s.status === 'aceite' ? Colors.success + '22'
                      : s.status === 'rejeitado' ? Colors.danger + '22' : Colors.warning + '22'
                  }]}>
                    <Ionicons
                      name={s.status === 'aceite' ? 'checkmark-circle' : s.status === 'rejeitado' ? 'close-circle' : 'time'}
                      size={14}
                      color={s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning}
                    />
                    <Text style={[styles.sumStatusText, {
                      color: s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning
                    }]}>
                      {s.status === 'aceite' ? 'Aceite' : s.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sumDisciplina}>{s.disciplina}</Text>
                    <Text style={styles.sumTurma}>{s.turmaNome} · Aula {s.numeroAula}</Text>
                  </View>
                  <Text style={styles.sumData}>
                    {new Date(s.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 16, padding: 18,
    backgroundColor: Colors.backgroundCard, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  bannerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.gold,
  },
  bannerAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  bannerInfo: { flex: 1 },
  bannerGreet: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  bannerName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  bannerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 2 },
  bannerEdit: { padding: 8 },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginHorizontal: 16, marginTop: 16, marginBottom: 10,
  },
  statsRow: { paddingHorizontal: 16, gap: 10 },
  statCard: {
    width: 100, backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 14,
    borderLeftWidth: 3, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginHorizontal: 16,
  },
  quickAction: {
    width: '22%', minWidth: 72, alignItems: 'center', gap: 8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickActionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  qaBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.accent, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  qaBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  quickActionLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center' },
  provasCard: { marginHorizontal: 16, backgroundColor: Colors.backgroundCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  provaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  provaColorBar: { width: 4, height: 36, borderRadius: 2 },
  provaInfo: { flex: 1 },
  provaTitulo: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  provaSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  provaDate: { alignItems: 'flex-end' },
  provaDateNum: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  provaDateSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 14,
    backgroundColor: Colors.warning + '18', borderRadius: 14,
    borderWidth: 1, borderColor: Colors.warning + '44',
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.warning },
  sumCard: { marginHorizontal: 16, backgroundColor: Colors.backgroundCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sumStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sumStatusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  sumDisciplina: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  sumTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  sumData: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
});

const sal = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18, borderWidth: 1, borderColor: Colors.gold + '44',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  mesNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mesLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold, minWidth: 64, textAlign: 'center' },
  tipoBadge: {
    alignSelf: 'flex-start', marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.accent + '22', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  tipoText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.accent },
  temposBox: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.background, borderRadius: 12, padding: 12, gap: 6,
  },
  temposRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  temposLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  temposVal: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  alertBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.warning + '18', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.warning + '33',
  },
  alertText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.warning },
  breakdown: {
    marginHorizontal: 16, marginBottom: 14, gap: 6,
  },
  bRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1 },
  bVal: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  liquidoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.success + '14', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
    borderWidth: 1, borderColor: Colors.success + '33',
  },
  liquidoLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  liquidoVal: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.success },
  nota: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted,
    marginHorizontal: 16, marginBottom: 14, fontStyle: 'italic',
  },
});

const rab = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 420, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.gold + '44',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
  },
  iconRow: { marginBottom: 12 },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.gold + '22', borderWidth: 2, borderColor: Colors.gold + '55',
    justifyContent: 'center', alignItems: 'center',
  },
  title: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 16, lineHeight: 20,
  },
  notifRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
    width: '100%',
  },
  notifText: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular',
    color: Colors.text, lineHeight: 18,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 13,
    width: '100%', marginTop: 18,
  },
  btnPrimaryText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  btnSecondary: {
    paddingVertical: 10, alignItems: 'center', width: '100%', marginTop: 6,
  },
  btnSecondaryText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
});
