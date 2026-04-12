import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useFinanceiro } from '@/context/FinanceiroContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import TopBar from '@/components/TopBar';
import { BarChart, DonutChart } from '@/components/Charts';
import { apiRequest } from '@/lib/query-client';
import PendingSolicitacoesModal, { Solicitacao } from '@/components/PendingSolicitacoesModal';

const { width } = Dimensions.get('window');
const CHART_W = Math.min(width - 64, 360);

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 0 && h < 6) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function SectionTitle({ label, color, action, actionLabel }: { label: string; color: string; action?: () => void; actionLabel?: string }) {
  return (
    <View style={st.sectionHeader}>
      <View style={st.sectionTitleRow}>
        <View style={[st.sectionBar, { backgroundColor: color }]} />
        <Text style={st.sectionLabel}>{label}</Text>
      </View>
      {action && (
        <TouchableOpacity onPress={action}>
          <Text style={[st.seeAll, { color }]}>{actionLabel ?? 'Ver mais'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function KpiCard({ label, value, sub, color, icon, onPress }: {
  label: string; value: string | number; sub?: string; color: string; icon: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[st.kpiCard, { borderTopColor: color }]}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
    >
      <View style={[st.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[st.kpiValue, { color }]}>{value}</Text>
      <Text style={st.kpiLabel}>{label}</Text>
      {sub ? <Text style={st.kpiSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

function GenderBar({ masculino, feminino, total }: { masculino: number; feminino: number; total: number }) {
  if (total === 0) return null;
  const mPct = Math.round((masculino / total) * 100);
  const fPct = 100 - mPct;
  return (
    <View style={st.genderWrap}>
      <View style={st.genderBarRow}>
        <View style={[st.genderSegM, { flex: masculino || 0.001 }]} />
        <View style={[st.genderSegF, { flex: feminino || 0.001 }]} />
      </View>
      <View style={st.genderLegRow}>
        <View style={st.genderLegItem}>
          <View style={[st.genderDot, { backgroundColor: Colors.info }]} />
          <Text style={st.genderTxt}>Masculino {mPct}% ({masculino})</Text>
        </View>
        <View style={st.genderLegItem}>
          <View style={[st.genderDot, { backgroundColor: '#EC4899' }]} />
          <Text style={st.genderTxt}>Feminino {fPct}% ({feminino})</Text>
        </View>
      </View>
    </View>
  );
}

function QuickActions({ actions }: { actions: { label: string; icon: string; route: string; color: string }[] }) {
  const router = useRouter();
  return (
    <View style={st.qaGrid}>
      {actions.map(qa => (
        <TouchableOpacity
          key={qa.label}
          style={[st.qaBtn, { borderColor: qa.color + '33' }]}
          onPress={() => router.push(qa.route as any)}
          activeOpacity={0.7}
        >
          <View style={[st.qaIcon, { backgroundColor: qa.color + '1A' }]}>
            <Ionicons name={qa.icon as any} size={22} color={qa.color} />
          </View>
          <Text style={st.qaLabel}>{qa.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EventCard({ evento, onPress, eventoTypeColor }: { evento: any; onPress: () => void; eventoTypeColor: (t: string) => string }) {
  return (
    <TouchableOpacity style={st.eventCard} activeOpacity={0.7} onPress={onPress}>
      <View style={[st.eventBar, { backgroundColor: eventoTypeColor(evento.tipo) }]} />
      <View style={st.eventBody}>
        <Text style={st.eventTitle} numberOfLines={1}>{evento.titulo}</Text>
        <Text style={st.eventDate}>{evento.data} · {evento.hora} · {evento.local}</Text>
      </View>
      <View style={[st.eventBadge, { backgroundColor: eventoTypeColor(evento.tipo) + '22' }]}>
        <Text style={[st.eventBadgeText, { color: eventoTypeColor(evento.tipo) }]}>{evento.tipo}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface Registro { id: string; status: string; matriculaCompleta?: boolean; }
interface Funcionario { id: string; nome: string; apelido: string; departamento: string; cargo: string; ativo: boolean; tipoContrato: string; }

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { user } = useAuth();
  const { alunos, professores, turmas, notas, eventos, presencas, isLoading } = useData();
  const { getPagamentosAluno, getMesesEmAtraso, taxas, isAlunoBloqueado } = useFinanceiro();
  const { pautas, sumarios, materiais, mensagens } = useProfessor();
  const { anoSelecionado } = useAnoAcademico();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loadingReg, setLoadingReg] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState<Solicitacao[]>([]);
  const [showSolicitacoesModal, setShowSolicitacoesModal] = useState(false);
  const solicitacoesShownRef = useRef(false);

  const role = user?.role || '';
  const isAluno = role === 'aluno';
  const isProfessor = role === 'professor';
  const isEncarregado = role === 'encarregado';
  const isDirector = role === 'director';
  const isAdminRole = ['ceo', 'pca', 'admin', 'chefe_secretaria', 'secretaria', 'financeiro', 'rh'].includes(role);
  const isSecretariaRole = ['chefe_secretaria', 'secretaria'].includes(role);
  const isRhViewer = ['ceo', 'pca', 'admin', 'director'].includes(role);
  const isFinanceRole = ['pca', 'ceo', 'admin', 'financeiro'].includes(role);

  const anoLetivo = anoSelecionado?.ano || new Date().getFullYear().toString();

  useEffect(() => {
    if (!isAdminRole) return;
    setLoadingReg(true);
    apiRequest('GET', '/api/registros')
      .then(r => r.json())
      .then((data: Registro[]) => setRegistros(Array.isArray(data) ? data : []))
      .catch(() => setRegistros([]))
      .finally(() => setLoadingReg(false));
  }, [isAdminRole]);

  useEffect(() => {
    if (!isRhViewer) return;
    apiRequest('GET', '/api/funcionarios')
      .then(r => r.json())
      .then((data: Funcionario[]) => setFuncionarios(Array.isArray(data) ? data : []))
      .catch(() => setFuncionarios([]));
  }, [isRhViewer]);

  // Solicitações pendentes de documentos — modal automático ao entrar
  useEffect(() => {
    if (!isSecretariaRole) return;
    apiRequest('GET', '/api/solicitacoes-documentos?status=pendente')
      .then(r => r.json())
      .then((data: Solicitacao[]) => {
        const list = Array.isArray(data) ? data : [];
        setSolicitacoesPendentes(list);
        if (list.length > 0 && !solicitacoesShownRef.current) {
          solicitacoesShownRef.current = true;
          setTimeout(() => setShowSolicitacoesModal(true), 600);
        }
      })
      .catch(() => {});
  }, [isSecretariaRole]);

  const eventoTypeColor = (tipo: string) => ({
    'Académico': Colors.info, 'Cultural': Colors.gold, 'Desportivo': Colors.success,
    'Exame': Colors.danger, 'Feriado': Colors.warning, 'Reunião': Colors.textSecondary,
  }[tipo] || Colors.textMuted);

  // ── Dados específicos do ALUNO ──────────────────────────────────────
  const alunoData = useMemo(() => {
    if (!isAluno && !isEncarregado) return null;
    const aluno = alunos.find(a =>
      (user?.alunoId && a.id === user.alunoId) ||
      (a.utilizadorId && user?.id && a.utilizadorId === user.id)
    ) ?? alunos.find(a =>
      a.nome.toLowerCase().includes(user?.nome?.split(' ')[0]?.toLowerCase() || '')
    );
    if (!aluno) return null;
    const turmaAluno = turmas.find(t => t.id === aluno.turmaId);
    const notasAluno = notas.filter(n => n.alunoId === aluno.id && n.anoLetivo === anoLetivo && n.lancado === true);
    const presAluno = presencas.filter(p => p.alunoId === aluno.id);
    const pagamentosAluno = getPagamentosAluno(aluno.id);
    const mesesAtraso = getMesesEmAtraso(aluno.id, anoLetivo);
    const bloqueado = isAlunoBloqueado(aluno.id);
    const taxaPropina = taxas.find(t => t.tipo === 'propina' && t.ativo);
    const mediaGeral = notasAluno.length > 0
      ? (notasAluno.reduce((s, n) => s + (n.nf || n.mac || 0), 0) / notasAluno.length).toFixed(1)
      : '—';
    const pctPresenca = presAluno.length > 0
      ? Math.round((presAluno.filter(p => p.status === 'P').length / presAluno.length) * 100)
      : 100;
    const aprovadas = notasAluno.filter(n => n.nf >= 10).length;
    const reprovadas = notasAluno.filter(n => n.nf > 0 && n.nf < 10).length;
    const disciplinasComNota = [...new Set(notasAluno.map(n => n.disciplina))];
    const eventosAluno = turmaAluno
      ? eventos.filter(e => e.turmasIds?.includes(turmaAluno.id) || !e.turmasIds?.length)
          .filter(e => e.data >= new Date().toISOString().split('T')[0])
          .sort((a, b) => a.data.localeCompare(b.data))
          .slice(0, 3)
      : [];
    return {
      aluno, turmaAluno, notasAluno, presAluno, pagamentosAluno,
      mesesAtraso, bloqueado, taxaPropina,
      mediaGeral, pctPresenca, aprovadas, reprovadas,
      disciplinasComNota, eventosAluno,
    };
  }, [isAluno, isEncarregado, alunos, user, turmas, notas, presencas, eventos, anoLetivo, getPagamentosAluno, getMesesEmAtraso, isAlunoBloqueado, taxas]);

  // ── Dados específicos do PROFESSOR ─────────────────────────────────
  const professorData = useMemo(() => {
    if (!isProfessor) return null;
    const prof = professores.find(p => p.utilizadorId === user?.id)
      ?? professores.find(p =>
        p.nome.toLowerCase() === (user?.nome || '').split(' ')[0].toLowerCase()
      );
    if (!prof) return null;
    const minhasTurmas = turmas.filter(t =>
      prof.turmasIds?.includes(t.id) && t.ativo
    );
    const totalAlunos = minhasTurmas.reduce((s, t) => {
      return s + alunos.filter(a => a.turmaId === t.id && a.ativo).length;
    }, 0);
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    const sumariosDoMes = sumarios.filter(s => {
      if (s.professorId !== prof.id) return false;
      const d = new Date(s.data);
      return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
    });
    const pautasProf = pautas.filter(p => p.professorId === prof.id);
    const pautasAbertas = pautasProf.filter(p => p.status === 'aberta');
    const materiaisProf = materiais.filter(m => m.professorId === prof.id);
    const mensagensNaoLidas = mensagens.filter(m =>
      !m.lidaPor.includes(user?.id || '') &&
      minhasTurmas.some(t => t.id === m.turmaId)
    );
    const proximosEventos = eventos
      .filter(e => {
        const hoje = new Date().toISOString().split('T')[0];
        return e.data >= hoje && minhasTurmas.some(t => e.turmasIds?.includes(t.id));
      })
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 3);
    return {
      prof, minhasTurmas, totalAlunos,
      sumariosDoMes, pautasAbertas, materiaisProf,
      mensagensNaoLidas, proximosEventos,
    };
  }, [isProfessor, professores, user, turmas, alunos, sumarios, pautas, materiais, mensagens, eventos]);

  // ── Dados ADMIN / DIRECTOR ──────────────────────────────────────────
  const adminData = useMemo(() => {
    if (!isAdminRole && !isDirector) return null;
    const alunosAtivos = alunos.filter(a => a.ativo);
    const profsAtivos   = professores.filter(p => p.ativo);
    const turmasAtivas  = turmas.filter(t => t.ativo);
    const totalCap = turmasAtivas.reduce((s, t) => s + (t.capacidade || 0), 0);
    const taxaOcupacao = totalCap > 0 ? Math.round((alunosAtivos.length / totalCap) * 100) : 0;
    const taxaAprov = notas.length
      ? Math.round((notas.filter(n => (n.nf > 0 ? n.nf : n.mac) >= 10).length / notas.length) * 100)
      : 0;
    const mediaGeral = notas.length
      ? (notas.reduce((s, n) => s + (n.nf > 0 ? n.nf : n.mac), 0) / notas.length).toFixed(1)
      : '—';
    const masculino = alunosAtivos.filter(a => a.genero === 'M').length;
    const feminino  = alunosAtivos.filter(a => a.genero === 'F').length;
    const matriculasPorNivel: { label: string; value: number; color: string }[] = [];
    const nivelMapa: Record<string, number> = {};
    alunosAtivos.forEach(a => {
      const t = turmasAtivas.find(t => t.id === a.turmaId);
      const nivel = t?.nivel ?? 'Sem Turma';
      nivelMapa[nivel] = (nivelMapa[nivel] || 0) + 1;
    });
    const COLORS: Record<string, string> = {
      'Primário': Colors.success, 'I Ciclo': Colors.info, 'II Ciclo': '#8B5CF6', 'Sem Turma': Colors.textMuted,
    };
    Object.entries(nivelMapa).forEach(([label, value]) =>
      matriculasPorNivel.push({ label, value, color: COLORS[label] ?? Colors.gold })
    );
    const alunosPorTurno: { label: string; value: number; color: string }[] = [];
    const turnoMapa: Record<string, number> = { 'Manhã': 0, 'Tarde': 0, 'Noite': 0 };
    alunosAtivos.forEach(a => {
      const t = turmasAtivas.find(t => t.id === a.turmaId);
      const turno = t?.turno ?? 'Manhã';
      turnoMapa[turno] = (turnoMapa[turno] || 0) + 1;
    });
    const TURNO_COLORS: Record<string, string> = { 'Manhã': Colors.gold, 'Tarde': Colors.info, 'Noite': '#8B5CF6' };
    Object.entries(turnoMapa).filter(([, v]) => v > 0).forEach(([label, value]) =>
      alunosPorTurno.push({ label, value, color: TURNO_COLORS[label] ?? Colors.textMuted })
    );
    const ocupacaoPorTurma = turmasAtivas.map(t => {
      const count = alunosAtivos.filter(a => a.turmaId === t.id).length;
      const cap = t.capacidade || 30;
      return { nome: t.nome, count, cap, pct: Math.min(count / cap, 1) };
    }).sort((a, b) => b.count - a.count).slice(0, 8);
    const hoje = new Date(); const semAgo = new Date(hoje); semAgo.setDate(hoje.getDate() - 7);
    const recentes = presencas.filter(p => { const d = new Date(p.data); return d >= semAgo && d <= hoje; });
    const presentes = recentes.filter(p => p.status === 'P').length;
    const faltas = recentes.filter(p => p.status === 'F').length;
    const justif = recentes.filter(p => p.status === 'J').length;
    const taxaP = recentes.length > 0 ? Math.round((presentes / recentes.length) * 100) : 0;
    const estadosAdmissao: { label: string; value: number; color: string }[] = [];
    const admMapa: Record<string, number> = {};
    registros.forEach(r => { admMapa[r.status] = (admMapa[r.status] || 0) + 1; });
    const ADM_CONFIG: Record<string, { label: string; color: string }> = {
      pendente: { label: 'Pendente', color: Colors.warning },
      aprovado: { label: 'Aprovado', color: Colors.info },
      admitido: { label: 'Admitido', color: Colors.success },
      matriculado: { label: 'Matriculado', color: '#8B5CF6' },
      rejeitado: { label: 'Rejeitado', color: Colors.danger },
      reprovado_admissao: { label: 'Reprovado', color: Colors.textMuted },
    };
    Object.entries(admMapa).filter(([, v]) => v > 0).forEach(([status, value]) =>
      estadosAdmissao.push({ label: ADM_CONFIG[status]?.label ?? status, value, color: ADM_CONFIG[status]?.color ?? Colors.gold })
    );
    const desempenhoPorDisciplina = (() => {
      const discs = [...new Set(notas.map(n => n.disciplina))].slice(0, 6);
      const DISC_COLORS = [Colors.gold, Colors.accent, Colors.info, Colors.success, Colors.warning, '#8B5CF6'];
      return discs.map((d, i) => {
        const dn = notas.filter(n => n.disciplina === d);
        const media = dn.reduce((s, n) => s + (n.nf > 0 ? n.nf : n.mac), 0) / dn.length;
        return { label: d.length > 6 ? d.substring(0, 6) : d, value: parseFloat(media.toFixed(1)), color: DISC_COLORS[i % DISC_COLORS.length] };
      });
    })();
    const proximosEventos = eventos
      .filter(e => e.data >= new Date().toISOString().split('T')[0])
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 3);
    return {
      alunosAtivos, profsAtivos, turmasAtivas,
      totalCap, taxaOcupacao, taxaAprov, mediaGeral, masculino, feminino,
      matriculasPorNivel, alunosPorTurno, ocupacaoPorTurma,
      presentes, faltas, justif, taxaP, presencaTotal: recentes.length,
      estadosAdmissao, desempenhoPorDisciplina, proximosEventos,
    };
  }, [isAdminRole, isDirector, alunos, professores, turmas, notas, presencas, eventos, registros]);

  const refreshing = isLoading || loadingReg;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const primeiroNome = user?.nome?.split(' ')[0] ?? '';

  return (
    <View style={st.screen}>
      <TopBar
        title="Painel Principal"
        subtitle={`${getGreeting()}${primeiroNome ? `, ${primeiroNome}` : ''}`}
      />
      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} colors={[Colors.gold]} tintColor={Colors.gold} />}
      >

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAINEL DO ALUNO                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {isAluno && alunoData && (
          <>
            {/* Cartão de identidade resumido */}
            <View style={st.alunoIdentCard}>
              <View style={[st.alunoAvatar, { backgroundColor: Colors.primary }]}>
                <Text style={st.alunoAvatarText}>
                  {alunoData.aluno.nome.charAt(0)}{alunoData.aluno.apelido?.charAt(0) || ''}
                </Text>
              </View>
              <View style={st.alunoIdentInfo}>
                <Text style={st.alunoIdentNome}>{alunoData.aluno.nome} {alunoData.aluno.apelido}</Text>
                <Text style={st.alunoIdentMat}>{alunoData.aluno.numeroMatricula}</Text>
                {alunoData.turmaAluno && (
                  <View style={st.alunoIdentTurmaRow}>
                    <Ionicons name="school-outline" size={12} color={Colors.gold} />
                    <Text style={st.alunoIdentTurma}>
                      {alunoData.turmaAluno.nome} · {alunoData.turmaAluno.turno} · {alunoData.turmaAluno.anoLetivo}
                    </Text>
                  </View>
                )}
              </View>
              {alunoData.bloqueado && (
                <View style={st.bloqueadoBadge}>
                  <Ionicons name="lock-closed" size={12} color={Colors.danger} />
                  <Text style={st.bloqueadoText}>Bloqueado</Text>
                </View>
              )}
            </View>

            {/* KPIs pessoais */}
            <View style={st.section}>
              <SectionTitle label="Resumo Académico" color={Colors.gold} />
              <View style={st.kpiGrid}>
                <KpiCard
                  label="Média Geral"
                  value={alunoData.mediaGeral}
                  sub="escala 0–20"
                  color={alunoData.mediaGeral === '—' ? Colors.textMuted : Number(alunoData.mediaGeral) >= 10 ? Colors.success : Colors.danger}
                  icon="ribbon"
                  onPress={() => router.push('/(main)/portal-estudante')}
                />
                <KpiCard
                  label="Presenças"
                  value={`${alunoData.pctPresenca}%`}
                  sub={`${alunoData.presAluno.filter(p => p.status === 'P').length} presenças`}
                  color={alunoData.pctPresenca >= 75 ? Colors.success : Colors.danger}
                  icon="checkmark-circle"
                  onPress={() => router.push('/(main)/portal-estudante')}
                />
                <KpiCard
                  label="Aprovadas"
                  value={alunoData.aprovadas}
                  sub="disciplinas"
                  color={Colors.success}
                  icon="trophy"
                  onPress={() => router.push('/(main)/portal-estudante')}
                />
                <KpiCard
                  label="Reprovadas"
                  value={alunoData.reprovadas}
                  sub="disciplinas"
                  color={alunoData.reprovadas > 0 ? Colors.danger : Colors.textMuted}
                  icon="close-circle"
                  onPress={() => router.push('/(main)/portal-estudante')}
                />
              </View>
            </View>

            {/* Estado financeiro */}
            {alunoData.mesesAtraso > 0 && (
              <View style={st.section}>
                <SectionTitle label="Estado Financeiro" color={Colors.danger} action={() => router.push('/(main)/portal-estudante')} actionLabel="Ver pagamentos" />
                <View style={[st.alertCard, { borderColor: Colors.danger + '44', backgroundColor: Colors.danger + '10' }]}>
                  <Ionicons name="alert-circle" size={22} color={Colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.alertTitle, { color: Colors.danger }]}>Propinas em atraso</Text>
                    <Text style={st.alertSub}>{alunoData.mesesAtraso} {alunoData.mesesAtraso === 1 ? 'mês' : 'meses'} em falta · Acede ao portal para pagar</Text>
                  </View>
                </View>
              </View>
            )}
            {alunoData.mesesAtraso === 0 && (
              <View style={st.section}>
                <SectionTitle label="Estado Financeiro" color={Colors.success} action={() => router.push('/(main)/portal-estudante')} actionLabel="Ver detalhes" />
                <View style={[st.alertCard, { borderColor: Colors.success + '44', backgroundColor: Colors.success + '10' }]}>
                  <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.alertTitle, { color: Colors.success }]}>Propinas em dia</Text>
                    <Text style={st.alertSub}>Situação financeira regularizada para o ano lectivo {anoLetivo}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Próximos eventos da turma */}
            <View style={st.section}>
              <SectionTitle label="Próximos Eventos da Turma" color={Colors.accent} action={() => router.push('/(main)/portal-estudante')} actionLabel="Ver todos" />
              {alunoData.eventosAluno.length === 0 ? (
                <View style={[st.card, st.emptySmall]}>
                  <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
                  <Text style={st.emptySmallText}>Sem eventos programados para a sua turma</Text>
                </View>
              ) : (
                alunoData.eventosAluno.map(ev => (
                  <EventCard key={ev.id} evento={ev} onPress={() => router.push('/(main)/portal-estudante')} eventoTypeColor={eventoTypeColor} />
                ))
              )}
            </View>

            {/* Acções rápidas */}
            <View style={st.section}>
              <SectionTitle label="Acesso Rápido" color={Colors.primaryLight} />
              <QuickActions actions={[
                { label: 'Meu Portal', icon: 'grid', route: '/(main)/portal-estudante', color: Colors.gold },
                { label: 'Horário', icon: 'time', route: '/(main)/horario', color: Colors.info },
                { label: 'Mensagens', icon: 'chatbubbles', route: '/(main)/portal-estudante', color: Colors.accent },
                { label: 'Financeiro', icon: 'cash', route: '/(main)/portal-estudante', color: Colors.warning },
                { label: 'Histórico', icon: 'bar-chart', route: '/(main)/historico', color: Colors.success },
                { label: 'Documentos', icon: 'library', route: '/(main)/portal-estudante', color: '#8B5CF6' },
              ]} />
            </View>
          </>
        )}

        {isAluno && !alunoData && (
          <View style={[st.card, st.emptySmall]}>
            <Ionicons name="person-circle-outline" size={40} color={Colors.textMuted} />
            <Text style={st.emptySmallText}>Perfil de aluno não encontrado.{'\n'}Contacte a secretaria para associar a sua conta.</Text>
            <TouchableOpacity style={st.portalBtn} onPress={() => router.push('/(main)/portal-estudante')}>
              <Text style={st.portalBtnText}>Ir para o Portal do Estudante</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAINEL DO PROFESSOR                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {isProfessor && professorData && (
          <>
            {/* KPIs do professor */}
            <View style={st.section}>
              <SectionTitle label="O Meu Resumo" color={Colors.gold} />
              <View style={st.kpiGrid}>
                <KpiCard
                  label="Minhas Turmas"
                  value={professorData.minhasTurmas.length}
                  sub="activas"
                  color={Colors.info}
                  icon="layers"
                  onPress={() => router.push('/(main)/professor-hub')}
                />
                <KpiCard
                  label="Alunos"
                  value={professorData.totalAlunos}
                  sub="nas minhas turmas"
                  color={Colors.gold}
                  icon="people"
                  onPress={() => router.push('/(main)/professor-hub')}
                />
                <KpiCard
                  label="Pautas Abertas"
                  value={professorData.pautasAbertas.length}
                  sub="para lançar notas"
                  color={professorData.pautasAbertas.length > 0 ? Colors.warning : Colors.success}
                  icon="document-text"
                  onPress={() => router.push('/(main)/professor-pauta')}
                />
                <KpiCard
                  label="Sumários"
                  value={professorData.sumariosDoMes.length}
                  sub="este mês"
                  color={Colors.success}
                  icon="book"
                  onPress={() => router.push('/(main)/professor-sumario')}
                />
                <KpiCard
                  label="Materiais"
                  value={professorData.materiaisProf.length}
                  sub="partilhados"
                  color={Colors.accent}
                  icon="folder-open"
                  onPress={() => router.push('/(main)/professor-materiais')}
                />
                <KpiCard
                  label="Mensagens"
                  value={professorData.mensagensNaoLidas.length}
                  sub="não lidas"
                  color={professorData.mensagensNaoLidas.length > 0 ? Colors.danger : Colors.textMuted}
                  icon="chatbubbles"
                  onPress={() => router.push('/(main)/professor-mensagens')}
                />
              </View>
            </View>

            {/* Pautas abertas (destaque se houver) */}
            {professorData.pautasAbertas.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Pautas com Notas para Lançar" color={Colors.warning} action={() => router.push('/(main)/professor-pauta')} actionLabel="Abrir pautas" />
                {professorData.pautasAbertas.slice(0, 3).map(p => {
                  const turma = turmas.find(t => t.id === p.turmaId);
                  return (
                    <TouchableOpacity key={p.id} style={[st.alertCard, { borderColor: Colors.warning + '44', backgroundColor: Colors.warning + '10' }]} onPress={() => router.push('/(main)/professor-pauta')}>
                      <Ionicons name="document-text" size={18} color={Colors.warning} />
                      <View style={{ flex: 1 }}>
                        <Text style={[st.alertTitle, { color: Colors.warning }]}>{p.disciplina} — {turma?.nome ?? 'Turma'}</Text>
                        <Text style={st.alertSub}>{p.trimestre}º Trimestre · {p.anoLetivo}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Minhas turmas */}
            {professorData.minhasTurmas.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Minhas Turmas" color={Colors.info} action={() => router.push('/(main)/professor-hub')} actionLabel="Ver todas" />
                <View style={st.card}>
                  {professorData.minhasTurmas.map((t, idx) => {
                    const count = alunos.filter(a => a.turmaId === t.id && a.ativo).length;
                    const cap = t.capacidade || 30;
                    const pct = Math.min(count / cap, 1);
                    const cor = pct >= 0.9 ? Colors.danger : pct >= 0.7 ? Colors.warning : Colors.success;
                    return (
                      <View key={t.id} style={[st.turmaRow, idx > 0 && { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border }]}>
                        <View style={st.turmaRowHeader}>
                          <Text style={st.turmaNome}>{t.nome}</Text>
                          <View style={[st.turnoBadge, { backgroundColor: Colors.info + '22' }]}>
                            <Text style={[st.turnoText, { color: Colors.info }]}>{t.turno}</Text>
                          </View>
                        </View>
                        <Text style={st.turmaSub}>{t.nivel} · {t.anoLetivo}</Text>
                        <View style={st.turmaBarWrap}>
                          <View style={[st.turmaBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: cor }]} />
                        </View>
                        <Text style={[st.turmaCount, { color: cor }]}>{count} de {cap} alunos</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Próximos eventos */}
            {professorData.proximosEventos.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Próximos Eventos" color={Colors.accent} action={() => router.push('/(main)/eventos')} actionLabel="Ver todos" />
                {professorData.proximosEventos.map(ev => (
                  <EventCard key={ev.id} evento={ev} onPress={() => router.push('/(main)/eventos')} eventoTypeColor={eventoTypeColor} />
                ))}
              </View>
            )}

            {/* Acções rápidas */}
            <View style={st.section}>
              <SectionTitle label="Acesso Rápido" color={Colors.primaryLight} />
              <QuickActions actions={[
                { label: 'Meu Hub', icon: 'home', route: '/(main)/professor-hub', color: Colors.gold },
                { label: 'Lançar Notas', icon: 'document-text', route: '/(main)/professor-pauta', color: Colors.accent },
                { label: 'Presenças QR', icon: 'qr-code', route: '/(main)/presencas', color: Colors.success },
                { label: 'Mensagens', icon: 'chatbubbles', route: '/(main)/professor-mensagens', color: Colors.info },
                { label: 'Sumários', icon: 'book', route: '/(main)/professor-sumario', color: Colors.warning },
                { label: 'Materiais', icon: 'folder-open', route: '/(main)/professor-materiais', color: '#8B5CF6' },
              ]} />
            </View>
          </>
        )}

        {isProfessor && !professorData && (
          <View style={[st.card, st.emptySmall]}>
            <Ionicons name="school-outline" size={40} color={Colors.textMuted} />
            <Text style={st.emptySmallText}>Perfil de professor não encontrado.{'\n'}Contacte a administração para associar a sua conta.</Text>
            <TouchableOpacity style={st.portalBtn} onPress={() => router.push('/(main)/professor-hub')}>
              <Text style={st.portalBtnText}>Ir para o Hub do Professor</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAINEL DO ENCARREGADO                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {isEncarregado && (
          <View style={st.section}>
            <SectionTitle label="Portal do Encarregado" color={Colors.gold} />
            <TouchableOpacity style={st.portalBtn} onPress={() => router.push('/(main)/portal-encarregado' as any)}>
              <Ionicons name="people" size={18} color={Colors.background} />
              <Text style={st.portalBtnText}>Acompanhar o meu educando</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAINEL DO DIRECTOR                                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {isDirector && adminData && (
          <>
            {/* Cartão de papel */}
            <View style={[st.card, { borderColor: Colors.gold + '44', backgroundColor: Colors.gold + '08', flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
              <View style={[st.kpiIcon, { backgroundColor: Colors.gold + '22', width: 48, height: 48, borderRadius: 14 }]}>
                <Ionicons name="briefcase" size={24} color={Colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.gold }}>Direcção Escolar</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 }}>
                  Visão estratégica de todos os departamentos · {anoLetivo}
                </Text>
              </View>
            </View>

            {/* KPIs estratégicos */}
            <View style={st.section}>
              <SectionTitle label="Indicadores Globais" color={Colors.gold} />
              <View style={st.kpiGrid}>
                <KpiCard label="Alunos" value={adminData.alunosAtivos.length} sub="Matriculados" color={Colors.info} icon="people" onPress={() => router.push('/(main)/alunos')} />
                <KpiCard label="Professores" value={adminData.profsAtivos.length} sub="Activos" color={Colors.gold} icon="school" onPress={() => router.push('/(main)/professores')} />
                <KpiCard label="Turmas" value={adminData.turmasAtivas.length} sub="Activas" color={Colors.success} icon="layers" onPress={() => router.push('/(main)/turmas')} />
                <KpiCard label="Ocupação" value={`${adminData.taxaOcupacao}%`} sub={`${adminData.alunosAtivos.length}/${adminData.totalCap} vagas`} color={adminData.taxaOcupacao >= 90 ? Colors.danger : adminData.taxaOcupacao >= 70 ? Colors.warning : Colors.success} icon="business" />
                <KpiCard label="Aprovação" value={`${adminData.taxaAprov}%`} sub="Taxa global" color={adminData.taxaAprov >= 70 ? Colors.success : adminData.taxaAprov >= 50 ? Colors.warning : Colors.danger} icon="checkmark-circle" onPress={() => router.push('/(main)/desempenho')} />
                <KpiCard label="Média Geral" value={adminData.mediaGeral} sub="Escala 0–20" color={Colors.accent} icon="ribbon" onPress={() => router.push('/(main)/desempenho')} />
              </View>
            </View>

            {/* Distribuição de alunos */}
            {adminData.matriculasPorNivel.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Distribuição Académica" color={Colors.info} action={() => router.push('/(main)/alunos')} actionLabel="Ver alunos" />
                <View style={st.card}>
                  <View style={st.nivelChipsRow}>
                    {adminData.matriculasPorNivel.map(n => (
                      <View key={n.label} style={[st.nivelChip, { borderColor: n.color + '55', backgroundColor: n.color + '11' }]}>
                        <Text style={[st.nivelChipVal, { color: n.color }]}>{n.value}</Text>
                        <Text style={[st.nivelChipLabel, { color: n.color }]}>{n.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={st.cardDivider} />
                  <Text style={st.subCardTitle}>Distribuição por Género</Text>
                  <GenderBar masculino={adminData.masculino} feminino={adminData.feminino} total={adminData.alunosAtivos.length} />
                </View>
              </View>
            )}

            {/* Presenças resumidas */}
            <View style={st.section}>
              <SectionTitle label="Presenças (Últimos 7 dias)" color={Colors.success} action={() => router.push('/(main)/presencas')} actionLabel="Ver detalhes" />
              <View style={st.card}>
                {adminData.presencaTotal === 0 ? (
                  <View style={st.emptySmall}>
                    <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
                    <Text style={st.emptySmallText}>Sem registos de presença neste período</Text>
                  </View>
                ) : (
                  <View style={st.presencaResumo}>
                    <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.success }]}>{adminData.presentes}</Text><Text style={st.presencaLbl}>Presentes</Text></View>
                    <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.danger }]}>{adminData.faltas}</Text><Text style={st.presencaLbl}>Faltas</Text></View>
                    <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.warning }]}>{adminData.justif}</Text><Text style={st.presencaLbl}>Justif.</Text></View>
                    <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.gold }]}>{adminData.taxaP}%</Text><Text style={st.presencaLbl}>Assiduidade</Text></View>
                  </View>
                )}
              </View>
            </View>

            {/* RH resumo */}
            {funcionarios.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Recursos Humanos" color="#8B5CF6" action={() => router.push('/(main)/rh-hub' as any)} actionLabel="Ver RH" />
                <View style={st.card}>
                  <View style={st.matriculaResumo}>
                    <View style={st.matriculaResumoItem}>
                      <Text style={[st.matriculaBig, { color: '#8B5CF6' }]}>{funcionarios.length}</Text>
                      <Text style={st.matriculaSmall}>Total</Text>
                    </View>
                    <View style={st.matriculaDivider} />
                    <View style={st.matriculaResumoItem}>
                      <Text style={[st.matriculaBig, { color: Colors.success }]}>{funcionarios.filter(f => f.ativo).length}</Text>
                      <Text style={st.matriculaSmall}>Activos</Text>
                    </View>
                    <View style={st.matriculaDivider} />
                    <View style={st.matriculaResumoItem}>
                      <Text style={[st.matriculaBig, { color: Colors.textMuted }]}>{funcionarios.filter(f => !f.ativo).length}</Text>
                      <Text style={st.matriculaSmall}>Inactivos</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Próximos Eventos */}
            <View style={st.section}>
              <SectionTitle label="Próximos Eventos" color={Colors.accent} action={() => router.push('/(main)/eventos')} actionLabel="Ver todos" />
              {adminData.proximosEventos.length === 0 ? (
                <View style={[st.card, st.emptySmall]}>
                  <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
                  <Text style={st.emptySmallText}>Sem eventos programados</Text>
                </View>
              ) : (
                adminData.proximosEventos.map(ev => (
                  <EventCard key={ev.id} evento={ev} onPress={() => router.push('/(main)/eventos')} eventoTypeColor={eventoTypeColor} />
                ))
              )}
            </View>

            {/* Acesso a todos os departamentos */}
            <View style={st.section}>
              <SectionTitle label="Supervisão por Departamento" color={Colors.primaryLight} />
              <QuickActions actions={[
                { label: 'Académico', icon: 'school', route: '/(main)/alunos', color: Colors.info },
                { label: 'Financeiro', icon: 'cash', route: '/(main)/financeiro', color: Colors.success },
                { label: 'Pedagógico', icon: 'book', route: '/(main)/pedagogico', color: Colors.gold },
                { label: 'RH', icon: 'people', route: '/(main)/rh-hub', color: '#8B5CF6' },
                { label: 'Desempenho', icon: 'stats-chart', route: '/(main)/desempenho', color: Colors.accent },
                { label: 'Relatórios', icon: 'bar-chart', route: '/(main)/relatorios', color: Colors.warning },
                { label: 'Eventos', icon: 'calendar', route: '/(main)/eventos', color: Colors.danger },
                { label: 'Quadro Honra', icon: 'trophy', route: '/(main)/quadro-honra', color: Colors.gold },
              ]} />
            </View>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAINEL ADMINISTRATIVO / GESTÃO                             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {isAdminRole && adminData && (
          <>
            {/* KPIs principais */}
            <View style={st.kpiGrid}>
              <KpiCard label="Alunos" value={adminData.alunosAtivos.length} sub="Matriculados" color={Colors.info} icon="people" onPress={() => router.push('/(main)/alunos')} />
              <KpiCard label="Professores" value={adminData.profsAtivos.length} sub="Activos" color={Colors.gold} icon="school" onPress={() => router.push('/(main)/professores')} />
              <KpiCard label="Turmas" value={adminData.turmasAtivas.length} sub="Activas" color={Colors.success} icon="layers" onPress={() => router.push('/(main)/turmas')} />
              <KpiCard label="Ocupação" value={`${adminData.taxaOcupacao}%`} sub={`${adminData.alunosAtivos.length} / ${adminData.totalCap} vagas`} color={adminData.taxaOcupacao >= 90 ? Colors.danger : adminData.taxaOcupacao >= 70 ? Colors.warning : Colors.success} icon="business" />
              <KpiCard label="Aprovação" value={`${adminData.taxaAprov}%`} sub="Taxa global" color={adminData.taxaAprov >= 70 ? Colors.success : adminData.taxaAprov >= 50 ? Colors.warning : Colors.danger} icon="checkmark-circle" onPress={() => router.push('/(main)/desempenho')} />
              <KpiCard label="Média Geral" value={adminData.mediaGeral} sub="Escala 0–20" color={Colors.accent} icon="ribbon" onPress={() => router.push('/(main)/desempenho')} />
            </View>

            {/* Estado de Matrículas */}
            <View style={st.section}>
              <SectionTitle label="Estado de Matrículas" color={Colors.info} action={() => router.push('/(main)/alunos')} actionLabel="Ver alunos" />
              <View style={st.card}>
                <View style={st.matriculaResumo}>
                  <View style={st.matriculaResumoItem}>
                    <Text style={[st.matriculaBig, { color: Colors.success }]}>{adminData.alunosAtivos.length}</Text>
                    <Text style={st.matriculaSmall}>Matrículas Activas</Text>
                  </View>
                  <View style={st.matriculaDivider} />
                  <View style={st.matriculaResumoItem}>
                    <Text style={[st.matriculaBig, { color: Colors.textMuted }]}>{Math.max(0, adminData.totalCap - adminData.alunosAtivos.length)}</Text>
                    <Text style={st.matriculaSmall}>Vagas Disponíveis</Text>
                  </View>
                  <View style={st.matriculaDivider} />
                  <View style={st.matriculaResumoItem}>
                    <Text style={[st.matriculaBig, { color: Colors.gold }]}>{adminData.totalCap}</Text>
                    <Text style={st.matriculaSmall}>Capacidade Total</Text>
                  </View>
                </View>
                <View style={st.ocupacaoBarraWrap}>
                  <View style={[st.ocupacaoBarra, { flex: adminData.alunosAtivos.length || 0.001, backgroundColor: Colors.success }]} />
                  <View style={[st.ocupacaoBarra, { flex: Math.max(adminData.totalCap - adminData.alunosAtivos.length, 0.001), backgroundColor: Colors.border }]} />
                </View>
                <Text style={st.ocupacaoLegenda}>
                  {adminData.taxaOcupacao}% das vagas preenchidas
                </Text>
                <View style={st.cardDivider} />
                <Text style={st.subCardTitle}>Distribuição por Género</Text>
                <GenderBar masculino={adminData.masculino} feminino={adminData.feminino} total={adminData.alunosAtivos.length} />
                {adminData.matriculasPorNivel.length > 0 && (
                  <>
                    <View style={st.cardDivider} />
                    <Text style={st.subCardTitle}>Alunos por Nível de Ensino</Text>
                    <View style={st.nivelChipsRow}>
                      {adminData.matriculasPorNivel.map(n => (
                        <View key={n.label} style={[st.nivelChip, { borderColor: n.color + '55', backgroundColor: n.color + '11' }]}>
                          <Text style={[st.nivelChipVal, { color: n.color }]}>{n.value}</Text>
                          <Text style={[st.nivelChipLabel, { color: n.color }]}>{n.label}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Alunos por Turno */}
            {adminData.alunosPorTurno.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Alunos por Turno" color={Colors.gold} />
                <View style={[st.card, { alignItems: 'center' }]}>
                  <DonutChart data={adminData.alunosPorTurno} size={180} thickness={32} centerLabel={String(adminData.alunosAtivos.length)} centerSub="alunos" />
                </View>
              </View>
            )}

            {/* Processo de Admissão */}
            {adminData.estadosAdmissao.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Processo de Admissão" color='#8B5CF6' action={() => router.push('/(main)/admissao' as any)} actionLabel="Ver admissões" />
                <View style={st.card}>
                  <View style={st.admissaoSummary}>
                    {adminData.estadosAdmissao.map(e => (
                      <View key={e.label} style={[st.admissaoChip, { backgroundColor: e.color + '18', borderColor: e.color + '44' }]}>
                        <Text style={[st.admissaoVal, { color: e.color }]}>{e.value}</Text>
                        <Text style={[st.admissaoLbl, { color: e.color }]}>{e.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={st.cardDivider} />
                  <DonutChart data={adminData.estadosAdmissao} size={180} thickness={30} centerLabel={String(registros.length)} centerSub="pedidos" />
                </View>
              </View>
            )}

            {/* Taxa de Ocupação por Turma */}
            {adminData.ocupacaoPorTurma.length > 0 && (
              <View style={st.section}>
                <SectionTitle label="Taxa de Ocupação por Turma" color={Colors.warning} action={() => router.push('/(main)/turmas')} actionLabel="Ver turmas" />
                <View style={st.card}>
                  {adminData.ocupacaoPorTurma.map((t, idx) => {
                    const cor = t.pct >= 0.9 ? Colors.danger : t.pct >= 0.7 ? Colors.warning : Colors.success;
                    return (
                      <View key={t.nome} style={[st.ocupRow, idx > 0 && { marginTop: 10 }]}>
                        <Text style={st.ocupNome} numberOfLines={1}>{t.nome}</Text>
                        <View style={st.ocupBarWrap}>
                          <View style={[st.ocupBarFill, { width: `${Math.round(t.pct * 100)}%` as any, backgroundColor: cor }]} />
                        </View>
                        <Text style={[st.ocupPct, { color: cor }]}>{t.count}/{t.cap}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Presenças da Semana */}
            <View style={st.section}>
              <SectionTitle label="Presenças (Últimos 7 dias)" color={Colors.success} action={() => router.push('/(main)/presencas')} actionLabel="Ver detalhes" />
              <View style={st.card}>
                {adminData.presencaTotal === 0 ? (
                  <View style={st.emptySmall}>
                    <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
                    <Text style={st.emptySmallText}>Sem registos de presença neste período</Text>
                  </View>
                ) : (
                  <>
                    <View style={st.presencaResumo}>
                      <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.success }]}>{adminData.presentes}</Text><Text style={st.presencaLbl}>Presentes</Text></View>
                      <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.danger }]}>{adminData.faltas}</Text><Text style={st.presencaLbl}>Faltas</Text></View>
                      <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.warning }]}>{adminData.justif}</Text><Text style={st.presencaLbl}>Justif.</Text></View>
                      <View style={st.presencaItem}><Text style={[st.presencaVal, { color: Colors.gold }]}>{adminData.taxaP}%</Text><Text style={st.presencaLbl}>Assiduidade</Text></View>
                    </View>
                    <View style={st.presencaBarra}>
                      {adminData.presentes > 0 && <View style={[st.presencaBarSeg, { flex: adminData.presentes, backgroundColor: Colors.success }]} />}
                      {adminData.justif > 0 && <View style={[st.presencaBarSeg, { flex: adminData.justif, backgroundColor: Colors.warning }]} />}
                      {adminData.faltas > 0 && <View style={[st.presencaBarSeg, { flex: adminData.faltas, backgroundColor: Colors.danger }]} />}
                    </View>
                    <View style={st.cardDivider} />
                    <DonutChart
                      data={[
                        { label: 'Presentes', value: adminData.presentes, color: Colors.success },
                        { label: 'Justif.', value: adminData.justif, color: Colors.warning },
                        { label: 'Faltas', value: adminData.faltas, color: Colors.danger },
                      ].filter(d => d.value > 0)}
                      size={160} thickness={26} centerLabel={`${adminData.taxaP}%`} centerSub="assiduidade"
                    />
                  </>
                )}
              </View>
            </View>

            {/* Pessoal — só para CEO/PCA/Admin/Director */}
            {isRhViewer && (
              <View style={st.section}>
                <SectionTitle label="Recursos Humanos — Pessoal" color='#8B5CF6' action={() => router.push('/(main)/rh-controle' as any)} actionLabel="Gerir Pessoal" />
                <View style={st.card}>
                  <View style={st.matriculaResumo}>
                    <View style={st.matriculaResumoItem}>
                      <Text style={[st.matriculaBig, { color: '#8B5CF6' }]}>{funcionarios.length}</Text>
                      <Text style={st.matriculaSmall}>Total de{'\n'}Funcionários</Text>
                    </View>
                    <View style={st.matriculaDivider} />
                    <View style={st.matriculaResumoItem}>
                      <Text style={[st.matriculaBig, { color: Colors.success }]}>{funcionarios.filter(f => f.ativo).length}</Text>
                      <Text style={st.matriculaSmall}>Activos</Text>
                    </View>
                    <View style={st.matriculaDivider} />
                    <View style={st.matriculaResumoItem}>
                      <Text style={[st.matriculaBig, { color: Colors.textMuted }]}>{funcionarios.filter(f => !f.ativo).length}</Text>
                      <Text style={st.matriculaSmall}>Inactivos</Text>
                    </View>
                  </View>
                  <View style={st.cardDivider} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[st.rhActionBtn, { borderColor: '#8B5CF644', backgroundColor: '#8B5CF611' }]} onPress={() => router.push('/(main)/rh-controle' as any)}>
                      <Ionicons name="people" size={16} color="#8B5CF6" />
                      <Text style={[st.rhActionLabel, { color: '#8B5CF6' }]}>Gerir Pessoal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.rhActionBtn, { borderColor: Colors.gold + '44', backgroundColor: Colors.gold + '11' }]} onPress={() => router.push('/(main)/rh-payroll' as any)}>
                      <Ionicons name="cash" size={16} color={Colors.gold} />
                      <Text style={[st.rhActionLabel, { color: Colors.gold }]}>Vencimentos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.rhActionBtn, { borderColor: Colors.info + '44', backgroundColor: Colors.info + '11' }]} onPress={() => router.push('/(main)/rh-hub' as any)}>
                      <Ionicons name="briefcase" size={16} color={Colors.info} />
                      <Text style={[st.rhActionLabel, { color: Colors.info }]}>Hub RH</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Desempenho por Disciplina */}
            <View style={st.section}>
              <SectionTitle label="Médias por Disciplina" color={Colors.gold} action={() => router.push('/(main)/desempenho')} actionLabel="Ver desempenho" />
              <View style={[st.card, { alignItems: 'center' }]}>
                {adminData.desempenhoPorDisciplina.length > 0 ? (
                  <BarChart data={adminData.desempenhoPorDisciplina} maxValue={20} height={180} width={CHART_W} />
                ) : (
                  <View style={st.emptySmall}>
                    <Ionicons name="bar-chart-outline" size={32} color={Colors.textMuted} />
                    <Text style={st.emptySmallText}>Sem notas lançadas</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Próximos Eventos */}
            <View style={st.section}>
              <SectionTitle label="Próximos Eventos" color={Colors.accent} action={() => router.push('/(main)/eventos')} actionLabel="Ver todos" />
              {adminData.proximosEventos.length === 0 ? (
                <View style={[st.card, st.emptySmall]}>
                  <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
                  <Text style={st.emptySmallText}>Sem eventos programados</Text>
                </View>
              ) : (
                adminData.proximosEventos.map(ev => (
                  <EventCard key={ev.id} evento={ev} onPress={() => router.push('/(main)/eventos')} eventoTypeColor={eventoTypeColor} />
                ))
              )}
            </View>

            {/* Solicitações de Documentos — secretaria */}
            {isSecretariaRole && (
              <View style={st.section}>
                <SectionTitle
                  label="Solicitações de Documentos"
                  color={Colors.gold}
                  action={() => router.push('/(main)/solicitacoes-secretaria' as any)}
                  actionLabel="Ver todas"
                />
                <TouchableOpacity
                  style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}
                  onPress={() => setShowSolicitacoesModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.gold + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="file-document-multiple" size={22} color={Colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>
                      {solicitacoesPendentes.length > 0
                        ? `${solicitacoesPendentes.length} pedido${solicitacoesPendentes.length !== 1 ? 's' : ''} pendente${solicitacoesPendentes.length !== 1 ? 's' : ''}`
                        : 'Sem pendências'}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
                      {solicitacoesPendentes.length > 0
                        ? 'Toque para gerir e emitir documentos'
                        : 'Todas as solicitações foram tratadas'}
                    </Text>
                  </View>
                  {solicitacoesPendentes.length > 0 && (
                    <View style={{ backgroundColor: Colors.danger, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{solicitacoesPendentes.length}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Acções Rápidas */}
            <View style={st.section}>
              <SectionTitle label={isFinanceRole ? 'Acesso Financeiro Rápido' : 'Acções Rápidas'} color={isFinanceRole ? Colors.success : Colors.primaryLight} />
              <QuickActions actions={isFinanceRole ? [
                { label: 'Financeiro', icon: 'cash', route: '/(main)/financeiro', color: Colors.success },
                { label: 'Propinas', icon: 'wallet', route: '/(main)/financeiro', color: Colors.info },
                { label: 'Pagamentos', icon: 'receipt', route: '/(main)/financeiro', color: Colors.gold },
                { label: 'Em Atraso', icon: 'alert-circle', route: '/(main)/financeiro', color: Colors.danger },
                { label: 'Rubricas', icon: 'pricetag', route: '/(main)/financeiro', color: '#8B5CF6' },
                { label: 'Relatórios', icon: 'bar-chart', route: '/(main)/financeiro', color: Colors.warning },
              ] : [
                { label: 'Novo Aluno', icon: 'person-add', route: '/(main)/alunos', color: Colors.info },
                { label: 'Lançar Notas', icon: 'document-text', route: '/(main)/notas', color: Colors.gold },
                { label: 'Desempenho', icon: 'stats-chart', route: '/(main)/desempenho', color: '#8B5CF6' },
                { label: 'Presenças', icon: 'qr-code', route: '/(main)/presencas', color: Colors.success },
                { label: 'Eventos', icon: 'calendar', route: '/(main)/eventos', color: Colors.accent },
                { label: 'Relatórios', icon: 'bar-chart', route: '/(main)/relatorios', color: Colors.warning },
              ]} />
            </View>
          </>
        )}

      </ScrollView>

      {/* Modal solicitações de documentos — secretaria */}
      {isSecretariaRole && (
        <PendingSolicitacoesModal
          visible={showSolicitacoesModal}
          solicitacoes={solicitacoesPendentes}
          onClose={() => setShowSolicitacoesModal(false)}
          onUpdate={(updated) => {
            setSolicitacoesPendentes(prev =>
              prev.map(s => s.id === updated.id ? updated : s)
                  .filter(s => s.status === 'pendente')
            );
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBar: { width: 4, height: 18, borderRadius: 2 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  seeAll: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  card: { backgroundColor: Colors.backgroundCard, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  cardDivider: { height: 1, backgroundColor: Colors.border },
  subCardTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flex: 1, minWidth: (width - 52) / 3, backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, padding: 12, gap: 2, alignItems: 'center' },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kpiValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  kpiLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center' },
  kpiSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  matriculaResumo: { flexDirection: 'row', alignItems: 'center' },
  matriculaResumoItem: { flex: 1, alignItems: 'center', gap: 2 },
  matriculaDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  matriculaBig: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  matriculaSmall: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  ocupacaoBarraWrap: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  ocupacaoBarra: { borderRadius: 4 },
  ocupacaoLegenda: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  genderWrap: { gap: 8 },
  genderBarRow: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  genderSegM: { backgroundColor: Colors.info, borderRadius: 4 },
  genderSegF: { backgroundColor: '#EC4899', borderRadius: 4 },
  genderLegRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  genderLegItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  genderDot: { width: 8, height: 8, borderRadius: 4 },
  genderTxt: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  nivelChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nivelChip: { flex: 1, minWidth: 80, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  nivelChipVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  nivelChipLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  admissaoSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  admissaoChip: { flex: 1, minWidth: 80, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  admissaoVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  admissaoLbl: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  ocupRow: { gap: 4 },
  ocupNome: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  ocupBarWrap: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  ocupBarFill: { height: '100%', borderRadius: 4 },
  ocupPct: { fontSize: 11, fontFamily: 'Inter_700Bold', alignSelf: 'flex-end' },

  presencaResumo: { flexDirection: 'row' },
  presencaItem: { flex: 1, alignItems: 'center', gap: 2 },
  presencaVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  presencaLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  presencaBarra: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  presencaBarSeg: { borderRadius: 4 },

  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  eventBar: { width: 4, alignSelf: 'stretch' },
  eventBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 3 },
  eventTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  eventDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  eventBadge: { marginRight: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  eventBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaBtn: { flex: 1, minWidth: '30%', backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  qaIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },

  emptySmall: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptySmallText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  rhActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8 },
  rhActionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },

  // Aluno specific
  alunoIdentCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.backgroundCard, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  alunoAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  alunoAvatarText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold },
  alunoIdentInfo: { flex: 1, gap: 2 },
  alunoIdentNome: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoIdentMat: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  alunoIdentTurmaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  alunoIdentTurma: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.gold },
  bloqueadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.danger + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  bloqueadoText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.danger },

  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  alertTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  alertSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  portalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20 },
  portalBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.background },

  // Professor specific
  turmaRow: { gap: 6 },
  turmaRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  turmaNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  turmaSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  turmaBarWrap: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  turmaBarFill: { height: '100%', borderRadius: 4 },
  turmaCount: { fontSize: 11, fontFamily: 'Inter_600SemiBold', alignSelf: 'flex-end' },
  turnoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  turnoText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});
