import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Platform,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import DateInput from '@/components/DateInput';
import TopBar from '@/components/TopBar';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { api } from '@/lib/api';
import { webAlert } from '@/utils/webAlert';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Planificacao {
  id: string;
  professorId: string;
  turmaId: string;
  disciplina: string;
  trimestre: number;
  semana: number;
  anoLetivo: string;
  tema: string;
  objectivos: string;
  conteudos: string;
  metodologia: string;
  recursos: string;
  avaliacao: string;
  observacoes: string;
  numAulas: number;
  cumprida: boolean;
  createdAt: string;
}

interface ConteudoProgramatico {
  id: string;
  disciplina: string;
  classe: string;
  trimestre: number;
  anoLetivo: string;
  titulo: string;
  descricao: string;
  ordem: number;
  cumprido: boolean;
  percentagem: number;
  createdAt: string;
}

interface Ocorrencia {
  id: string;
  alunoId: string;
  turmaId: string;
  professorId?: string;
  registadoPor: string;
  tipo: string;
  gravidade: string;
  descricao: string;
  medidaTomada: string;
  data: string;
  resolvida: boolean;
  observacoes: string;
  createdAt: string;
}

// ─── Plano de Aula types & HTML builder (shared with professor-plano-aula) ────
export interface FaseAula {
  tempo: string; fase: string; conteudo: string; metodos: string;
  actividades: string; estrategiaEnsino: string; meiosEnsino: string;
  avaliacao: string; obs: string;
}
export interface PlanoAula {
  id: string; professorId: string; professorNome: string;
  turmaId?: string; turmaNome: string; disciplina: string; unidade: string;
  sumario: string; classe: string; escola: string; perfilEntrada: string;
  perfilSaida: string; data: string; periodo: string; tempo: string;
  duracao: string; anoLetivo: string; objectivoGeral: string;
  objectivosEspecificos: string; fases: FaseAula[];
  status: 'rascunho' | 'submetido' | 'aprovado' | 'rejeitado';
  observacaoDirector?: string; aprovadoPor?: string; aprovadoEm?: string;
  createdAt: string; updatedAt: string;
}
const PLANO_STATUS_CFG = {
  rascunho:  { label: 'Rascunho',  color: '#888',              icon: 'file-document-outline' },
  submetido: { label: 'Submetido', color: '#f59e0b',           icon: 'clock-outline' },
  aprovado:  { label: 'Aprovado',  color: Colors.success,      icon: 'check-circle' },
  rejeitado: { label: 'Rejeitado', color: Colors.danger,       icon: 'close-circle' },
};
function buildPlanoHTML(plano: PlanoAula): string {
  const rows = (plano.fases || []).map(f => `
    <tr>
      <td style="font-size:10pt;text-align:center;font-weight:bold;">${f.tempo}</td>
      <td style="font-size:10pt;font-weight:bold;">${f.fase}</td>
      <td style="font-size:9pt;">${(f.conteudo||'').replace(/\n/g,'<br>')}</td>
      <td style="font-size:9pt;">${(f.metodos||'').replace(/\n/g,'<br>')}</td>
      <td style="font-size:9pt;">${(f.actividades||'').replace(/\n/g,'<br>')}</td>
      <td style="font-size:9pt;">${(f.estrategiaEnsino||'').replace(/\n/g,'<br>')}</td>
      <td style="font-size:9pt;">${(f.meiosEnsino||'').replace(/\n/g,'<br>')}</td>
      <td style="font-size:9pt;text-align:center;">${f.avaliacao||''}</td>
      <td style="font-size:9pt;">${f.obs||''}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',serif;font-size:11pt;color:#111;background:#fff}
  .page{width:297mm;min-height:210mm;margin:0 auto;padding:15mm 18mm}
  h1{text-align:center;font-size:14pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;text-decoration:underline}
  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #111;border-collapse:collapse;margin-bottom:10px}
  .info-cell{padding:4px 7px;border:1px solid #111;font-size:10pt;line-height:1.5}
  .info-cell .lbl{font-weight:bold}
  .obj-box{border:1px solid #111;padding:5px 8px;margin-bottom:10px;font-size:10pt;line-height:1.7}
  .obj-box .lbl{font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#ddd;font-size:10pt;padding:5px 4px;border:1px solid #111;text-align:center;font-weight:bold}
  td{border:1px solid #111;padding:4px;vertical-align:top}
  .print-btn{display:block;margin:16px auto;padding:10px 32px;background:#1a2540;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold}
  @media print{.print-btn{display:none}}</style></head>
  <body>
  <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
  <div class="page"><h1>Plano de Aula</h1>
  <div class="info-grid">
    <div class="info-cell"><span class="lbl">Nome:</span> ${plano.professorNome}</div>
    <div class="info-cell" style="grid-row:span 2;"><span class="lbl">Geral:</span> ${plano.objectivoGeral||''}</div>
    <div class="info-cell" style="grid-row:span 6;"><span class="lbl">Objectivos:</span><br><br><span class="lbl">Específicos:</span><br>${(plano.objectivosEspecificos||'').replace(/\n/g,'<br>')}</div>
    <div class="info-cell"><span class="lbl">Escola:</span> ${plano.escola}</div>
    <div class="info-cell"><span class="lbl">Data:</span> ${plano.data}</div>
    <div class="info-cell"></div>
    <div class="info-cell"><span class="lbl">Classe:</span> ${plano.classe} &nbsp;&nbsp; <span class="lbl">Turma:</span> ${plano.turmaNome}</div>
    <div class="info-cell"><span class="lbl">Período:</span> ${plano.periodo}</div>
    <div class="info-cell"><span class="lbl">Disciplina:</span> ${plano.disciplina}</div>
    <div class="info-cell"><span class="lbl">Tempo:</span> ${plano.tempo}</div>
    <div class="info-cell"><span class="lbl">Unidade:</span> ${plano.unidade}</div>
    <div class="info-cell"><span class="lbl">Duração:</span> ${plano.duracao}</div>
    <div class="info-cell"><span class="lbl">Sumário:</span> ${plano.sumario}</div>
    <div class="info-cell"><span class="lbl">Ano lectivo:</span> ${plano.anoLetivo}</div>
  </div>
  <div class="obj-box"><span class="lbl">Perfil de entrada:</span> ${plano.perfilEntrada||''}</div>
  <div class="obj-box"><span class="lbl">Perfil de saída:</span> ${plano.perfilSaida||''}</div>
  <table><thead><tr>
    <th style="width:55px">Tempo</th><th style="width:80px">Fases<br>didácticas</th>
    <th>Conteúdo</th><th style="width:80px">Métodos</th><th>Actividades</th>
    <th style="width:90px">Estratégia de<br>Ensino</th><th style="width:90px">Meios de<br>Ensino</th>
    <th style="width:70px">Avaliação</th><th style="width:50px">Obs</th>
  </tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TABS = ['planificacoes', 'programa', 'resultados', 'ocorrencias', 'planos_aula'] as const;
type TabKey = typeof TABS[number];

const TAB_LABELS: Record<TabKey, string> = {
  planificacoes: 'Planificações',
  programa: 'Programa',
  resultados: 'Resultados',
  ocorrencias: 'Ocorrências',
  planos_aula: 'Planos de Aula',
};
const TAB_ICONS: Record<TabKey, string> = {
  planificacoes: 'clipboard-list',
  programa: 'book-open-variant',
  resultados: 'chart-bar',
  ocorrencias: 'alert-circle',
  planos_aula: 'book-education',
};

const TIPOS_OCO = ['comportamento', 'falta_injustificada', 'violencia', 'fraude', 'outro'] as const;
const TIPO_OCO_LABEL: Record<string, string> = {
  comportamento: 'Comportamento', falta_injustificada: 'Falta Injustificada',
  violencia: 'Violência', fraude: 'Fraude/Desonestidade', outro: 'Outro',
};
const GRAVIDADE_CFG: Record<string, { color: string; label: string }> = {
  leve:     { color: Colors.warning,  label: 'Leve' },
  moderada: { color: Colors.gold,     label: 'Moderada' },
  grave:    { color: Colors.danger,   label: 'Grave' },
};

const TRIMESTRES = [1, 2, 3];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcNF(nota: any): number {
  const mac = nota.mac || 0;
  const pp  = nota.pp1 || 0;
  const pt  = nota.ppt || 0;
  if (mac > 0 && pt > 0) return Math.round((mac * 0.3 + pp * 0.3 + pt * 0.4));
  return nota.nf || 0;
}

function getResultado(nf: number): { label: string; color: string } {
  if (nf >= 10) return { label: 'Aprovado', color: Colors.success };
  if (nf >= 8)  return { label: 'Exame', color: Colors.warning };
  return { label: 'Reprovado', color: Colors.danger };
}

/**
 * Resultado para disciplinas terminais (10ª → 11ª classe).
 * Regras do sistema educativo angolano:
 *  - MFG = (NF_10 + NF_11) / 2
 *  - MFG >= 10 → Aprovado (a negativa anterior fica "fechada")
 *  - NF_10 < 10 E NF_11 < 10 → Reprovado directo (2 negativas consecutivas, sem direito a exame)
 *  - NF_10 < 10 E NF_11 >= 10 E MFG < 10 → Exame de Época Normal (para fechar a média)
 *  - Um ano negativo + MFG < 10 → Exame de Época Normal
 */
function getResultadoTerminal(
  nfAtual: number,
  nfAnterior?: number,
): { label: string; color: string; mfg?: number } {
  if (nfAnterior !== undefined && nfAnterior > 0) {
    const mfg = (nfAtual + nfAnterior) / 2;
    if (mfg >= 10) return { label: 'Aprovado', color: Colors.success, mfg };
    if (nfAnterior < 10 && nfAtual < 10)
      return { label: 'Reprovado', color: Colors.danger, mfg };
    return { label: 'Exame', color: Colors.warning, mfg };
  }
  return getResultado(nfAtual);
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PedagogicoScreen() {
  const { alunos, turmas, professores, notas } = useData();
  const { user } = useAuth();
  const { anoSelecionado } = useAnoAcademico();
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'web' ? 24 : insets.bottom;

  const anoAtual = anoSelecionado?.ano || new Date().getFullYear().toString();
  const isProf = user?.role === 'professor';

  const [tab, setTab] = useState<TabKey>('planificacoes');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [planificacoes, setPlanificacoes] = useState<Planificacao[]>([]);
  const [conteudos, setConteudos] = useState<ConteudoProgramatico[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);

  // Filters
  const [selTurma, setSelTurma] = useState<string>('todas');
  const [selDisciplina, setSelDisciplina] = useState<string>('todas');
  const [selTrimestre, setSelTrimestre] = useState<number | 'todos'>('todos');
  const [selClasse, setSelClasse] = useState<string>('todas');
  const [selGravidade, setSelGravidade] = useState<string>('todas');
  const [searchAluno, setSearchAluno] = useState('');
  const [showResolvidas, setShowResolvidas] = useState(false);

  // Planos de Aula
  const [planosAula, setPlanosAula] = useState<PlanoAula[]>([]);
  const [filtroPlanoStatus, setFiltroPlanoStatus] = useState<'todos' | 'submetido' | 'aprovado' | 'rejeitado'>('todos');
  const [previewPlano, setPreviewPlano] = useState<PlanoAula | null>(null);
  const [obsModalPlano, setObsModalPlano] = useState<PlanoAula | null>(null);
  const [obsText, setObsText] = useState('');
  const [planosLoading, setPlanosLoading] = useState(false);

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showProgModal, setShowProgModal] = useState(false);
  const [showOcoModal, setShowOcoModal]   = useState(false);
  const [editPlan, setEditPlan]   = useState<Planificacao | null>(null);
  const [editProg, setEditProg]   = useState<ConteudoProgramatico | null>(null);
  const [editOco,  setEditOco]    = useState<Ocorrencia | null>(null);

  // Forms
  const defaultPlan = { turmaId: '', disciplina: '', trimestre: 1, semana: 1, tema: '', objectivos: '', conteudos: '', metodologia: '', recursos: '', avaliacao: '', observacoes: '', numAulas: '1', cumprida: false };
  const defaultProg = { disciplina: '', classe: '', trimestre: 1, titulo: '', descricao: '', ordem: '0', cumprido: false, percentagem: '0' };
  const defaultOco  = { alunoId: '', turmaId: '', tipo: 'comportamento', gravidade: 'leve', descricao: '', medidaTomada: '', data: new Date().toISOString().split('T')[0], resolvida: false, observacoes: '' };

  const [formPlan, setFormPlan] = useState(defaultPlan);
  const [formProg, setFormProg] = useState(defaultProg);
  const [formOco,  setFormOco]  = useState(defaultOco);

  // My professor ID (if role is professor)
  const meuProfessor = useMemo(() => {
    if (!isProf) return null;
    return professores.find(p => p.email === user?.email) || null;
  }, [professores, user, isProf]);

  const turmasVisiveis = useMemo(() => {
    if (!isProf || !meuProfessor) return turmas;
    const ids = (meuProfessor.turmasIds as string[]) || [];
    return turmas.filter(t => ids.includes(t.id));
  }, [turmas, meuProfessor, isProf]);

  const disciplinasVisiveis = useMemo(() => {
    const set = new Set<string>();
    if (isProf && meuProfessor) {
      ((meuProfessor.disciplinas as string[]) || []).forEach(d => set.add(d));
    } else {
      turmas.forEach(t => {
        // Extract disciplines from notes
        notas.filter(n => n.turmaId === t.id).forEach(n => set.add(n.disciplina as string));
      });
    }
    return Array.from(set).sort();
  }, [notas, turmas, meuProfessor, isProf]);

  const classes = useMemo(() => [...new Set(turmas.map(t => t.classe))].sort(), [turmas]);

  useEffect(() => { loadAll(); }, [anoAtual]);

  async function loadAll() {
    setIsLoading(true);
    try {
      const [p, c, o] = await Promise.all([
        api.get<Planificacao[]>(`/api/planificacoes?anoLetivo=${encodeURIComponent(anoAtual)}`),
        api.get<ConteudoProgramatico[]>(`/api/conteudos-programaticos?anoLetivo=${encodeURIComponent(anoAtual)}`),
        api.get<Ocorrencia[]>('/api/ocorrencias'),
      ]);
      setPlanificacoes(p);
      setConteudos(c);
      setOcorrencias(o);
    } catch (e) {
      console.error('Pedagógico load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPlanosAula() {
    setPlanosLoading(true);
    try {
      let url = '/api/planos-aula';
      if (isProf && meuProfessor) url = `/api/planos-aula/professor/${meuProfessor.id}`;
      const data = await api.get<PlanoAula[]>(url);
      setPlanosAula(data || []);
    } catch (e) {
      console.error('Planos de aula load error', e);
    } finally {
      setPlanosLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'planos_aula') loadPlanosAula();
  }, [tab]);

  async function aprovarPlano(plano: PlanoAula, obs?: string) {
    try {
      const updated = await api.put<PlanoAula>(`/api/planos-aula/${plano.id}`, {
        status: 'aprovado',
        observacaoDirector: obs || '',
        aprovadoPor: user?.nome || user?.email || 'Direcção',
        aprovadoEm: new Date().toISOString().split('T')[0],
      });
      setPlanosAula(prev => prev.map(p => p.id === plano.id ? { ...p, ...updated } : p));
      setObsModalPlano(null); setObsText('');
    } catch { webAlert('Erro', 'Não foi possível aprovar o plano.'); }
  }

  async function rejeitarPlano(plano: PlanoAula, obs: string) {
    if (!obs.trim()) { webAlert('Aviso', 'Por favor, indique o motivo da rejeição.'); return; }
    try {
      const updated = await api.put<PlanoAula>(`/api/planos-aula/${plano.id}`, {
        status: 'rejeitado',
        observacaoDirector: obs,
        aprovadoPor: user?.nome || user?.email || 'Direcção',
        aprovadoEm: new Date().toISOString().split('T')[0],
      });
      setPlanosAula(prev => prev.map(p => p.id === plano.id ? { ...p, ...updated } : p));
      setObsModalPlano(null); setObsText('');
    } catch { webAlert('Erro', 'Não foi possível rejeitar o plano.'); }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadAll();
    setIsRefreshing(false);
  }

  // ── Planificações ────────────────────────────────────────────────────────
  const plansFiltradas = useMemo(() => {
    let list = planificacoes;
    if (selTurma !== 'todas') list = list.filter(p => p.turmaId === selTurma);
    if (selDisciplina !== 'todas') list = list.filter(p => p.disciplina === selDisciplina);
    if (selTrimestre !== 'todos') list = list.filter(p => p.trimestre === selTrimestre);
    if (isProf && meuProfessor) list = list.filter(p => p.professorId === meuProfessor.id);
    return list;
  }, [planificacoes, selTurma, selDisciplina, selTrimestre, isProf, meuProfessor]);

  async function savePlan() {
    if (!formPlan.turmaId || !formPlan.disciplina || !formPlan.tema.trim()) {
      webAlert('Erro', 'Preencha turma, disciplina e tema.'); return;
    }
    const professorId = meuProfessor?.id || (isProf ? '' : (professores[0]?.id || ''));
    const payload = { ...formPlan, numAulas: parseInt(formPlan.numAulas)||1, anoLetivo: anoAtual, professorId };
    if (editPlan) {
      const updated = await api.put<Planificacao>(`/api/planificacoes/${editPlan.id}`, payload);
      setPlanificacoes(prev => prev.map(x => x.id === editPlan.id ? updated : x));
      webAlert('Actualizado', 'Planificação actualizada.');
    } else {
      const novo = await api.post<Planificacao>('/api/planificacoes', payload);
      setPlanificacoes(prev => [novo, ...prev]);
      webAlert('Criada', 'Planificação de aula criada.');
    }
    setShowPlanModal(false); setEditPlan(null); setFormPlan(defaultPlan);
  }

  async function toggleCumprida(plan: Planificacao) {
    const updated = await api.put<Planificacao>(`/api/planificacoes/${plan.id}`, { ...plan, cumprida: !plan.cumprida });
    setPlanificacoes(prev => prev.map(x => x.id === plan.id ? updated : x));
  }

  async function deletePlan(id: string) {
    webAlert('Remover', 'Tem a certeza que quer remover esta planificação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await api.delete(`/api/planificacoes/${id}`);
        setPlanificacoes(prev => prev.filter(x => x.id !== id));
      }},
    ]);
  }

  // ── Conteúdos ────────────────────────────────────────────────────────────
  const contFiltrados = useMemo(() => {
    let list = conteudos;
    if (selDisciplina !== 'todas') list = list.filter(c => c.disciplina === selDisciplina);
    if (selClasse !== 'todas') list = list.filter(c => c.classe === selClasse);
    if (selTrimestre !== 'todos') list = list.filter(c => c.trimestre === selTrimestre);
    return list.sort((a, b) => a.trimestre - b.trimestre || a.ordem - b.ordem);
  }, [conteudos, selDisciplina, selClasse, selTrimestre]);

  const progPercent = useMemo(() => {
    if (!contFiltrados.length) return 0;
    const total = contFiltrados.reduce((s, c) => s + c.percentagem, 0);
    return Math.round(total / contFiltrados.length);
  }, [contFiltrados]);

  async function saveProg() {
    if (!formProg.disciplina || !formProg.classe || !formProg.titulo.trim()) {
      webAlert('Erro', 'Preencha disciplina, classe e título.'); return;
    }
    const payload = { ...formProg, ordem: parseInt(formProg.ordem)||0, percentagem: parseInt(formProg.percentagem)||0, anoLetivo: anoAtual };
    if (editProg) {
      const updated = await api.put<ConteudoProgramatico>(`/api/conteudos-programaticos/${editProg.id}`, payload);
      setConteudos(prev => prev.map(x => x.id === editProg.id ? updated : x));
    } else {
      const novo = await api.post<ConteudoProgramatico>('/api/conteudos-programaticos', payload);
      setConteudos(prev => [novo, ...prev]);
    }
    setShowProgModal(false); setEditProg(null); setFormProg(defaultProg);
  }

  async function toggleCumprido(c: ConteudoProgramatico) {
    const pct = c.cumprido ? 0 : 100;
    const updated = await api.put<ConteudoProgramatico>(`/api/conteudos-programaticos/${c.id}`, { ...c, cumprido: !c.cumprido, percentagem: pct });
    setConteudos(prev => prev.map(x => x.id === c.id ? updated : x));
  }

  async function deleteProg(id: string) {
    webAlert('Remover', 'Remover este conteúdo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await api.delete(`/api/conteudos-programaticos/${id}`);
        setConteudos(prev => prev.filter(x => x.id !== id));
      }},
    ]);
  }

  // ── Resultados ────────────────────────────────────────────────────────────
  const resultadosPorTurma = useMemo(() => {
    const notasAno = notas.filter((n: any) => n.anoLetivo === anoAtual);
    // Notes from the previous year – used for terminal subject (10ª → 11ª) cross-year MFG
    const anoAnteriorStr = String(parseInt(anoAtual) - 1);
    const notasAnoAnterior = notas.filter((n: any) => n.anoLetivo === anoAnteriorStr);

    return turmas.map(turma => {
      const alunosTurma = alunos.filter(a => a.turmaId === turma.id && a.ativo);
      // 11ª classe is the closing year of terminal subjects (10ª → 11ª)
      const isClasse11 = turma.classe === '11';

      const resultados = alunosTurma.map(aluno => {
        const notasAluno = notasAno.filter((n: any) => n.alunoId === aluno.id && n.turmaId === turma.id);

        // Group current-year notes by discipline to compute per-discipline NF
        const discMap: Record<string, any[]> = {};
        for (const n of notasAluno) {
          const d = n.disciplina as string;
          if (!discMap[d]) discMap[d] = [];
          discMap[d].push(n);
        }

        // Compute per-discipline results applying terminal rules when in 11ª
        const resultadosPorDisc = Object.entries(discMap).map(([disc, discNotas]) => {
          const nfsAtual = discNotas.map((n: any) => calcNF(n));
          const nfAtual = nfsAtual.length
            ? nfsAtual.reduce((s: number, v: number) => s + v, 0) / nfsAtual.length
            : 0;

          if (isClasse11 && notasAnoAnterior.length > 0) {
            // Look up same student + same discipline in the previous year (any turma)
            const notasDiscAnt = notasAnoAnterior.filter(
              (n: any) => n.alunoId === aluno.id && n.disciplina === disc,
            );
            if (notasDiscAnt.length > 0) {
              const nfsAnt = notasDiscAnt.map((n: any) => calcNF(n));
              const nfAnterior =
                nfsAnt.reduce((s: number, v: number) => s + v, 0) / nfsAnt.length;
              return { disc, ...getResultadoTerminal(nfAtual, nfAnterior) };
            }
          }
          return { disc, ...getResultadoTerminal(nfAtual) };
        });

        // Overall student result: most severe per-discipline result wins
        // Reprovado > Exame > Aprovado
        let resultado: { label: string; color: string };
        if (resultadosPorDisc.some(r => r.label === 'Reprovado')) {
          resultado = { label: 'Reprovado', color: Colors.danger };
        } else if (resultadosPorDisc.some(r => r.label === 'Exame')) {
          resultado = { label: 'Exame', color: Colors.warning };
        } else if (resultadosPorDisc.length > 0) {
          resultado = { label: 'Aprovado', color: Colors.success };
        } else {
          resultado = getResultado(0);
        }

        const nfs = notasAluno.map((n: any) => calcNF(n));
        const mediaFinal = nfs.length
          ? Math.round(nfs.reduce((s: number, v: number) => s + v, 0) / nfs.length)
          : 0;

        return { aluno, mediaFinal, resultado, disciplinas: notasAluno.length };
      });

      const aprovados  = resultados.filter(r => r.resultado.label === 'Aprovado').length;
      const exame      = resultados.filter(r => r.resultado.label === 'Exame').length;
      const reprovados = resultados.filter(r => r.resultado.label === 'Reprovado').length;
      return { turma, resultados, aprovados, exame, reprovados, total: resultados.length };
    }).filter(t => t.total > 0);
  }, [notas, alunos, turmas, anoAtual]);

  const turmaResultadoFiltrada = resultadosPorTurma.find(r => r.turma.id === selTurma);

  // ── Ocorrências ──────────────────────────────────────────────────────────
  const ocoFiltradas = useMemo(() => {
    let list = ocorrencias;
    if (selTurma !== 'todas') list = list.filter(o => o.turmaId === selTurma);
    if (selGravidade !== 'todas') list = list.filter(o => o.gravidade === selGravidade);
    if (!showResolvidas) list = list.filter(o => !o.resolvida);
    if (searchAluno.trim()) {
      const q = searchAluno.toLowerCase();
      list = list.filter(o => {
        const a = alunos.find(x => x.id === o.alunoId);
        return a ? `${a.nome} ${a.apelido}`.toLowerCase().includes(q) : false;
      });
    }
    return list;
  }, [ocorrencias, selTurma, selGravidade, showResolvidas, searchAluno, alunos]);

  async function saveOco() {
    if (!formOco.alunoId || !formOco.turmaId || !formOco.descricao.trim()) {
      webAlert('Erro', 'Preencha aluno, turma e descrição.'); return;
    }
    const payload = { ...formOco, registadoPor: user?.nome || 'Sistema', professorId: meuProfessor?.id || null };
    if (editOco) {
      const updated = await api.put<Ocorrencia>(`/api/ocorrencias/${editOco.id}`, payload);
      setOcorrencias(prev => prev.map(x => x.id === editOco.id ? updated : x));
    } else {
      const nova = await api.post<Ocorrencia>('/api/ocorrencias', payload);
      setOcorrencias(prev => [nova, ...prev]);
    }
    setShowOcoModal(false); setEditOco(null); setFormOco(defaultOco);
  }

  async function resolverOco(oco: Ocorrencia) {
    const updated = await api.put<Ocorrencia>(`/api/ocorrencias/${oco.id}`, { ...oco, resolvida: true });
    setOcorrencias(prev => prev.map(x => x.id === oco.id ? updated : x));
  }

  async function deleteOco(id: string) {
    webAlert('Remover', 'Remover esta ocorrência?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await api.delete(`/api/ocorrencias/${id}`);
        setOcorrencias(prev => prev.filter(x => x.id !== id));
      }},
    ]);
  }

  function getNomeAluno(id: string) {
    const a = alunos.find(x => x.id === id);
    return a ? `${a.nome} ${a.apelido}` : '—';
  }
  function getNomeTurma(id: string) { return turmas.find(x => x.id === id)?.nome || '—'; }

  // ── Render Tab Bar ────────────────────────────────────────────────────────
  function renderTabBar() {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border }}
        contentContainerStyle={{ paddingHorizontal: 8 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={{ paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 2,
              borderBottomColor: tab === t ? Colors.gold : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name={TAB_ICONS[t] as any} size={16}
              color={tab === t ? Colors.gold : Colors.textMuted} />
            <Text style={{ fontSize: 13, fontFamily: tab === t ? 'Inter_600SemiBold' : 'Inter_400Regular',
              color: tab === t ? Colors.gold : Colors.textMuted }}>{TAB_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  // ── Render Filters ────────────────────────────────────────────────────────
  function FilterChips({ label, value, options, onChange }: {
    label: string; value: string | number;
    options: { value: string | number; label: string }[];
    onChange: (v: any) => void;
  }) {
    return (
      <View style={{ marginBottom: 8 }}>
        <Text style={st.filterLabel}>{label}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 40 }}
          contentContainerStyle={{ gap: 6, paddingVertical: 2, alignItems: 'center' }}
        >
          {options.map(o => (
            <TouchableOpacity key={String(o.value)} onPress={() => onChange(o.value)}
              style={[st.chip, value === o.value && st.chipActive]}>
              <Text style={[st.chipText, value === o.value && st.chipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Render Planificações ──────────────────────────────────────────────────
  function renderPlanificacoes() {
    const plansT1 = plansFiltradas.filter(p => p.trimestre === 1);
    const plansT2 = plansFiltradas.filter(p => p.trimestre === 2);
    const plansT3 = plansFiltradas.filter(p => p.trimestre === 3);
    const cumpridas = plansFiltradas.filter(p => p.cumprida).length;
    const total = plansFiltradas.length;

    return (
      <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: 14, paddingBottom: bottom + 80 }}>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={[st.kpi, { flex: 1 }]}>
            <Text style={[st.kpiVal, { color: Colors.info }]}>{total}</Text>
            <Text style={st.kpiLbl}>Total</Text>
          </View>
          <View style={[st.kpi, { flex: 1 }]}>
            <Text style={[st.kpiVal, { color: Colors.success }]}>{cumpridas}</Text>
            <Text style={st.kpiLbl}>Cumpridas</Text>
          </View>
          <View style={[st.kpi, { flex: 1 }]}>
            <Text style={[st.kpiVal, { color: Colors.warning }]}>{total - cumpridas}</Text>
            <Text style={st.kpiLbl}>Por Cumprir</Text>
          </View>
        </View>

        <FilterChips label="Turma" value={selTurma}
          options={[{ value: 'todas', label: 'Todas' }, ...turmasVisiveis.map(t => ({ value: t.id, label: t.nome }))]}
          onChange={setSelTurma} />
        <FilterChips label="Disciplina" value={selDisciplina}
          options={[{ value: 'todas', label: 'Todas' }, ...disciplinasVisiveis.map(d => ({ value: d, label: d }))]}
          onChange={setSelDisciplina} />
        <FilterChips label="Trimestre" value={selTrimestre}
          options={[{ value: 'todos', label: 'Todos' }, ...TRIMESTRES.map(t => ({ value: t, label: `${t}º Trimestre` }))]}
          onChange={setSelTrimestre} />

        {[1, 2, 3].map(tri => {
          const lista = plansFiltradas.filter(p => p.trimestre === tri);
          if (lista.length === 0 && selTrimestre !== 'todos' && selTrimestre !== tri) return null;
          if (lista.length === 0) return null;
          return (
            <View key={tri} style={{ marginBottom: 16 }}>
              <Text style={st.secLabel}>{tri}º TRIMESTRE — {lista.length} planificaç{lista.length === 1 ? 'ão' : 'ões'}</Text>
              {lista.map(plan => (
                <View key={plan.id} style={[st.card, plan.cumprida && { borderLeftWidth: 3, borderLeftColor: Colors.success }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardTitle}>{plan.tema}</Text>
                      <Text style={st.cardSub}>{plan.disciplina} · Semana {plan.semana} · {plan.numAulas} aula{plan.numAulas > 1 ? 's' : ''}</Text>
                      <Text style={st.cardSub}>{getNomeTurma(plan.turmaId)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleCumprida(plan)}
                      style={[st.badge, { backgroundColor: plan.cumprida ? Colors.success + '22' : Colors.border }]}>
                      <Ionicons name={plan.cumprida ? 'checkmark-circle' : 'ellipse-outline'} size={14}
                        color={plan.cumprida ? Colors.success : Colors.textMuted} />
                      <Text style={{ fontSize: 10, color: plan.cumprida ? Colors.success : Colors.textMuted, fontFamily: 'Inter_600SemiBold' }}>
                        {plan.cumprida ? 'Cumprida' : 'Por cumprir'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {!!plan.objectivos && <Text style={st.detRow}><Text style={st.detLbl}>Objectivos: </Text>{plan.objectivos}</Text>}
                  {!!plan.conteudos && <Text style={st.detRow}><Text style={st.detLbl}>Conteúdos: </Text>{plan.conteudos}</Text>}
                  {!!plan.metodologia && <Text style={st.detRow}><Text style={st.detLbl}>Metodologia: </Text>{plan.metodologia}</Text>}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => { setEditPlan(plan); setFormPlan({ turmaId: plan.turmaId, disciplina: plan.disciplina, trimestre: plan.trimestre, semana: plan.semana, tema: plan.tema, objectivos: plan.objectivos, conteudos: plan.conteudos, metodologia: plan.metodologia, recursos: plan.recursos, avaliacao: plan.avaliacao, observacoes: plan.observacoes, numAulas: String(plan.numAulas), cumprida: plan.cumprida }); setShowPlanModal(true); }}
                      style={st.btnSec}>
                      <Ionicons name="pencil" size={13} color={Colors.info} />
                      <Text style={[st.btnSecTxt, { color: Colors.info }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deletePlan(plan.id)} style={st.btnSec}>
                      <Ionicons name="trash" size={13} color={Colors.danger} />
                      <Text style={[st.btnSecTxt, { color: Colors.danger }]}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        {plansFiltradas.length === 0 && (
          <View style={st.empty}>
            <MaterialCommunityIcons name="clipboard-list" size={40} color={Colors.textMuted} />
            <Text style={st.emptyTxt}>Nenhuma planificação encontrada.</Text>
            <Text style={st.emptySub}>Cria a primeira planificação de aula.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Render Programa ───────────────────────────────────────────────────────
  function renderPrograma() {
    return (
      <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: 14, paddingBottom: bottom + 80 }}>

        <FilterChips label="Disciplina" value={selDisciplina}
          options={[{ value: 'todas', label: 'Todas' }, ...disciplinasVisiveis.map(d => ({ value: d, label: d }))]}
          onChange={setSelDisciplina} />
        <FilterChips label="Classe" value={selClasse}
          options={[{ value: 'todas', label: 'Todas' }, ...classes.map(c => ({ value: c, label: `${c}ª Classe` }))]}
          onChange={setSelClasse} />
        <FilterChips label="Trimestre" value={selTrimestre}
          options={[{ value: 'todos', label: 'Todos' }, ...TRIMESTRES.map(t => ({ value: t, label: `${t}º Trim.` }))]}
          onChange={setSelTrimestre} />

        {contFiltrados.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={st.kpiLbl}>Cumprimento do Programa</Text>
              <Text style={[st.kpiLbl, { color: progPercent >= 80 ? Colors.success : progPercent >= 50 ? Colors.warning : Colors.danger, fontFamily: 'Inter_700Bold' }]}>{progPercent}%</Text>
            </View>
            <View style={{ height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: 8, borderRadius: 4, width: `${Math.min(progPercent, 100)}%` as any,
                backgroundColor: progPercent >= 80 ? Colors.success : progPercent >= 50 ? Colors.warning : Colors.danger }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={[st.kpi, { flex: 1 }]}>
                <Text style={[st.kpiVal, { color: Colors.success }]}>{contFiltrados.filter(c => c.cumprido).length}</Text>
                <Text style={st.kpiLbl}>Cumpridos</Text>
              </View>
              <View style={[st.kpi, { flex: 1 }]}>
                <Text style={[st.kpiVal, { color: Colors.warning }]}>{contFiltrados.filter(c => !c.cumprido).length}</Text>
                <Text style={st.kpiLbl}>Por Cumprir</Text>
              </View>
              <View style={[st.kpi, { flex: 1 }]}>
                <Text style={[st.kpiVal, { color: Colors.info }]}>{contFiltrados.length}</Text>
                <Text style={st.kpiLbl}>Total</Text>
              </View>
            </View>
          </View>
        )}

        {[1, 2, 3].map(tri => {
          const lista = contFiltrados.filter(c => c.trimestre === tri);
          if (!lista.length) return null;
          const cumpridos = lista.filter(c => c.cumprido).length;
          return (
            <View key={tri} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={st.secLabel}>{tri}º TRIMESTRE</Text>
                <Text style={{ fontSize: 11, color: Colors.textSecondary, fontFamily: 'Inter_500Medium' }}>{cumpridos}/{lista.length} cumpridos</Text>
              </View>
              {lista.map(c => (
                <View key={c.id} style={[st.card, c.cumprido && { borderLeftWidth: 3, borderLeftColor: Colors.success }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardTitle}>{c.titulo}</Text>
                      <Text style={st.cardSub}>{c.disciplina} · {c.classe}ª Classe</Text>
                      {!!c.descricao && <Text style={[st.cardSub, { marginTop: 4 }]}>{c.descricao}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <TouchableOpacity onPress={() => toggleCumprido(c)}
                        style={[st.badge, { backgroundColor: c.cumprido ? Colors.success + '22' : Colors.border }]}>
                        <Ionicons name={c.cumprido ? 'checkmark-circle' : 'ellipse-outline'} size={14}
                          color={c.cumprido ? Colors.success : Colors.textMuted} />
                        <Text style={{ fontSize: 10, color: c.cumprido ? Colors.success : Colors.textMuted, fontFamily: 'Inter_600SemiBold' }}>
                          {c.cumprido ? 'Cumprido' : 'Pendente'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 12, color: c.percentagem >= 80 ? Colors.success : c.percentagem >= 50 ? Colors.warning : Colors.danger, fontFamily: 'Inter_700Bold' }}>{c.percentagem}%</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => { setEditProg(c); setFormProg({ disciplina: c.disciplina, classe: c.classe, trimestre: c.trimestre, titulo: c.titulo, descricao: c.descricao, ordem: String(c.ordem), cumprido: c.cumprido, percentagem: String(c.percentagem) }); setShowProgModal(true); }}
                      style={st.btnSec}>
                      <Ionicons name="pencil" size={13} color={Colors.info} />
                      <Text style={[st.btnSecTxt, { color: Colors.info }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteProg(c.id)} style={st.btnSec}>
                      <Ionicons name="trash" size={13} color={Colors.danger} />
                      <Text style={[st.btnSecTxt, { color: Colors.danger }]}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        {contFiltrados.length === 0 && (
          <View style={st.empty}>
            <MaterialCommunityIcons name="book-open-variant" size={40} color={Colors.textMuted} />
            <Text style={st.emptyTxt}>Nenhum conteúdo programático definido.</Text>
            <Text style={st.emptySub}>Adiciona os conteúdos do programa para acompanhar o cumprimento.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Render Resultados ─────────────────────────────────────────────────────
  function renderResultados() {
    return (
      <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: 14, paddingBottom: bottom + 80 }}>

        <FilterChips label="Turma" value={selTurma}
          options={[{ value: 'todas', label: 'Todas Turmas' }, ...turmas.map(t => ({ value: t.id, label: t.nome }))]}
          onChange={setSelTurma} />

        {selTurma === 'todas' ? (
          <>
            {resultadosPorTurma.length === 0 && (
              <View style={st.empty}>
                <MaterialCommunityIcons name="chart-bar" size={40} color={Colors.textMuted} />
                <Text style={st.emptyTxt}>Sem dados de resultados para {anoAtual}.</Text>
                <Text style={st.emptySub}>Os resultados aparecem quando as notas forem lançadas.</Text>
              </View>
            )}
            {resultadosPorTurma.map(({ turma, aprovados, exame, reprovados, total }) => {
              const taxaAprov = total > 0 ? Math.round((aprovados / total) * 100) : 0;
              return (
                <TouchableOpacity key={turma.id} onPress={() => setSelTurma(turma.id)} style={st.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View>
                      <Text style={st.cardTitle}>{turma.nome}</Text>
                      <Text style={st.cardSub}>{turma.classe}ª Classe · {turma.turno} · {total} alunos</Text>
                    </View>
                    <View style={[st.badge, { backgroundColor: taxaAprov >= 70 ? Colors.success + '22' : Colors.warning + '22', borderColor: taxaAprov >= 70 ? Colors.success + '44' : Colors.warning + '44' }]}>
                      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: taxaAprov >= 70 ? Colors.success : Colors.warning }}>{taxaAprov}%</Text>
                      <Text style={{ fontSize: 10, color: Colors.textSecondary }}>Aprovação</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ flex: 1, backgroundColor: Colors.success + '18', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.success }}>{aprovados}</Text>
                      <Text style={{ fontSize: 10, color: Colors.textSecondary }}>Aprovados</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: Colors.warning + '18', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.warning }}>{exame}</Text>
                      <Text style={{ fontSize: 10, color: Colors.textSecondary }}>Exame</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: Colors.danger + '18', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.danger }}>{reprovados}</Text>
                      <Text style={{ fontSize: 10, color: Colors.textSecondary }}>Reprovados</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        ) : turmaResultadoFiltrada ? (
          <>
            <TouchableOpacity onPress={() => setSelTurma('todas')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="arrow-back" size={16} color={Colors.gold} />
              <Text style={{ color: Colors.gold, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Voltar a todas as turmas</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Aprovados', val: turmaResultadoFiltrada.aprovados, color: Colors.success },
                { label: 'Exame',     val: turmaResultadoFiltrada.exame,     color: Colors.warning },
                { label: 'Reprovados',val: turmaResultadoFiltrada.reprovados, color: Colors.danger },
              ].map(item => (
                <View key={item.label} style={[st.kpi, { flex: 1 }]}>
                  <Text style={[st.kpiVal, { color: item.color }]}>{item.val}</Text>
                  <Text style={st.kpiLbl}>{item.label}</Text>
                </View>
              ))}
            </View>
            {turmaResultadoFiltrada.resultados
              .sort((a, b) => b.mediaFinal - a.mediaFinal)
              .map(({ aluno, mediaFinal, resultado }) => (
                <View key={aluno.id} style={st.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardTitle}>{aluno.nome} {aluno.apelido}</Text>
                      <Text style={st.cardSub}>{aluno.numeroMatricula}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: resultado.color }}>{mediaFinal}</Text>
                      <View style={[st.badge, { backgroundColor: resultado.color + '22', borderColor: resultado.color + '44' }]}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: resultado.color }}>{resultado.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
          </>
        ) : null}
      </ScrollView>
    );
  }

  // ── Render Ocorrências ────────────────────────────────────────────────────
  function renderOcorrencias() {
    const totalAberto = ocorrencias.filter(o => !o.resolvida).length;
    const graveAberto = ocorrencias.filter(o => !o.resolvida && o.gravidade === 'grave').length;

    return (
      <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: 14, paddingBottom: bottom + 80 }}>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={[st.kpi, { flex: 1, borderTopWidth: 2, borderTopColor: Colors.danger }]}>
            <Text style={[st.kpiVal, { color: Colors.danger }]}>{totalAberto}</Text>
            <Text style={st.kpiLbl}>Em Aberto</Text>
          </View>
          <View style={[st.kpi, { flex: 1, borderTopWidth: 2, borderTopColor: Colors.warning }]}>
            <Text style={[st.kpiVal, { color: Colors.warning }]}>{graveAberto}</Text>
            <Text style={st.kpiLbl}>Graves</Text>
          </View>
          <View style={[st.kpi, { flex: 1, borderTopWidth: 2, borderTopColor: Colors.success }]}>
            <Text style={[st.kpiVal, { color: Colors.success }]}>{ocorrencias.filter(o => o.resolvida).length}</Text>
            <Text style={st.kpiLbl}>Resolvidas</Text>
          </View>
        </View>

        <TextInput
          style={st.searchInput}
          placeholder="Pesquisar aluno..."
          placeholderTextColor={Colors.textMuted}
          value={searchAluno}
          onChangeText={setSearchAluno}
        />

        <FilterChips label="Turma" value={selTurma}
          options={[{ value: 'todas', label: 'Todas' }, ...turmasVisiveis.map(t => ({ value: t.id, label: t.nome }))]}
          onChange={setSelTurma} />
        <FilterChips label="Gravidade" value={selGravidade}
          options={[{ value: 'todas', label: 'Todas' }, { value: 'leve', label: 'Leve' }, { value: 'moderada', label: 'Moderada' }, { value: 'grave', label: 'Grave' }]}
          onChange={setSelGravidade} />

        <TouchableOpacity onPress={() => setShowResolvidas(!showResolvidas)}
          style={[st.btnSec, { marginBottom: 12, alignSelf: 'flex-start' }]}>
          <Ionicons name={showResolvidas ? 'eye' : 'eye-off'} size={14} color={Colors.textSecondary} />
          <Text style={[st.btnSecTxt, { color: Colors.textSecondary }]}>{showResolvidas ? 'Ocultar resolvidas' : 'Mostrar resolvidas'}</Text>
        </TouchableOpacity>

        {ocoFiltradas.map(oco => {
          const grav = GRAVIDADE_CFG[oco.gravidade] || GRAVIDADE_CFG.leve;
          return (
            <View key={oco.id} style={[st.card, { borderLeftWidth: 3, borderLeftColor: grav.color }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.cardTitle}>{getNomeAluno(oco.alunoId)}</Text>
                  <Text style={st.cardSub}>{getNomeTurma(oco.turmaId)} · {oco.data}</Text>
                  <Text style={st.cardSub}>{TIPO_OCO_LABEL[oco.tipo] || oco.tipo} · Registado por {oco.registadoPor}</Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <View style={[st.badge, { backgroundColor: grav.color + '22', borderColor: grav.color + '44' }]}>
                    <Text style={{ fontSize: 10, color: grav.color, fontFamily: 'Inter_600SemiBold' }}>{grav.label}</Text>
                  </View>
                  {oco.resolvida && (
                    <View style={[st.badge, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '44' }]}>
                      <Text style={{ fontSize: 10, color: Colors.success, fontFamily: 'Inter_600SemiBold' }}>Resolvida</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[st.detRow, { marginBottom: 4 }]}><Text style={st.detLbl}>Descrição: </Text>{oco.descricao}</Text>
              {!!oco.medidaTomada && <Text style={st.detRow}><Text style={st.detLbl}>Medida: </Text>{oco.medidaTomada}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {!oco.resolvida && (
                  <TouchableOpacity onPress={() => resolverOco(oco)} style={st.btnSec}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                    <Text style={[st.btnSecTxt, { color: Colors.success }]}>Resolver</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setEditOco(oco); setFormOco({ alunoId: oco.alunoId, turmaId: oco.turmaId, tipo: oco.tipo, gravidade: oco.gravidade, descricao: oco.descricao, medidaTomada: oco.medidaTomada, data: oco.data, resolvida: oco.resolvida, observacoes: oco.observacoes }); setShowOcoModal(true); }} style={st.btnSec}>
                  <Ionicons name="pencil" size={13} color={Colors.info} />
                  <Text style={[st.btnSecTxt, { color: Colors.info }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteOco(oco.id)} style={st.btnSec}>
                  <Ionicons name="trash" size={13} color={Colors.danger} />
                  <Text style={[st.btnSecTxt, { color: Colors.danger }]}>Remover</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {ocoFiltradas.length === 0 && (
          <View style={st.empty}>
            <MaterialCommunityIcons name="alert-circle-outline" size={40} color={Colors.textMuted} />
            <Text style={st.emptyTxt}>Nenhuma ocorrência encontrada.</Text>
            <Text style={st.emptySub}>{showResolvidas ? 'Sem ocorrências com os filtros seleccionados.' : 'Todas as ocorrências estão resolvidas.'}</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Render Planos de Aula ─────────────────────────────────────────────────
  function renderPlanosAula() {
    const planosFiltrados = planosAula.filter(p =>
      filtroPlanoStatus === 'todos' ? true : p.status === filtroPlanoStatus
    ).filter(p => isProf ? true : p.status !== 'rascunho');

    const totalSubmetidos = planosAula.filter(p => p.status === 'submetido').length;
    const totalAprovados  = planosAula.filter(p => p.status === 'aprovado').length;
    const totalRejeitados = planosAula.filter(p => p.status === 'rejeitado').length;

    return (
      <ScrollView
        refreshControl={<RefreshControl refreshing={planosLoading} onRefresh={loadPlanosAula} />}
        contentContainerStyle={{ padding: 14, paddingBottom: bottom + 80 }}
      >
        {/* KPIs */}
        {!isProf && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Submetidos', val: totalSubmetidos, color: '#f59e0b' },
              { label: 'Aprovados',  val: totalAprovados,  color: Colors.success },
              { label: 'Rejeitados', val: totalRejeitados, color: Colors.danger },
            ].map(k => (
              <View key={k.label} style={[st.kpi, { flex: 1 }]}>
                <Text style={[st.kpiVal, { color: k.color }]}>{k.val}</Text>
                <Text style={st.kpiLbl}>{k.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Filtros */}
        <FilterChips
          label="Estado"
          value={filtroPlanoStatus}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'submetido', label: 'Submetidos' },
            { value: 'aprovado', label: 'Aprovados' },
            { value: 'rejeitado', label: 'Rejeitados' },
          ]}
          onChange={setFiltroPlanoStatus}
        />

        {planosLoading && (
          <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
        )}

        {!planosLoading && planosFiltrados.length === 0 && (
          <View style={st.empty}>
            <MaterialCommunityIcons name="book-education" size={40} color={Colors.textMuted} />
            <Text style={st.emptyTxt}>Nenhum plano de aula encontrado</Text>
            <Text style={st.emptySub}>
              {filtroPlanoStatus === 'todos'
                ? 'Os professores ainda não submeteram planos de aula.'
                : `Não há planos com estado "${PLANO_STATUS_CFG[filtroPlanoStatus]?.label}".`}
            </Text>
          </View>
        )}

        {planosFiltrados.map(plano => {
          const cfg = PLANO_STATUS_CFG[plano.status] || PLANO_STATUS_CFG.rascunho;
          return (
            <View key={plano.id} style={[st.card, { marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.cardTitle}>{plano.disciplina}</Text>
                  <Text style={st.cardSub} numberOfLines={1}>
                    {plano.sumario || plano.unidade || '—'}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                    {plano.professorNome} · {plano.turmaNome || '—'} · {plano.data || '—'}
                  </Text>
                </View>
                <View style={[st.badge, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
                  <MaterialCommunityIcons name={cfg.icon as any} size={13} color={cfg.color} />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: cfg.color }}>{cfg.label}</Text>
                </View>
              </View>

              {plano.observacaoDirector ? (
                <View style={{ backgroundColor: Colors.info + '12', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Obs: </Text>
                    {plano.observacaoDirector}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={[st.btnSec, { flex: 1 }]}
                  onPress={() => setPreviewPlano(plano)}
                >
                  <MaterialCommunityIcons name="eye-outline" size={14} color={Colors.info} />
                  <Text style={[st.btnSecTxt, { color: Colors.info }]}>Visualizar</Text>
                </TouchableOpacity>

                {!isProf && plano.status === 'submetido' && (
                  <>
                    <TouchableOpacity
                      style={[st.btnSec, { flex: 1, borderColor: Colors.success + '55', backgroundColor: Colors.success + '12' }]}
                      onPress={() => { setObsModalPlano(plano); setObsText(''); }}
                    >
                      <MaterialCommunityIcons name="check-circle-outline" size={14} color={Colors.success} />
                      <Text style={[st.btnSecTxt, { color: Colors.success }]}>Aprovar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.btnSec, { flex: 1, borderColor: Colors.danger + '55', backgroundColor: Colors.danger + '12' }]}
                      onPress={() => {
                        Alert.prompt
                          ? Alert.prompt('Motivo da rejeição', 'Indique o motivo:', txt => txt && rejeitarPlano(plano, txt))
                          : (() => { setObsModalPlano({ ...plano, status: 'rejeitado' }); setObsText(''); })();
                      }}
                    >
                      <MaterialCommunityIcons name="close-circle-outline" size={14} color={Colors.danger} />
                      <Text style={[st.btnSecTxt, { color: Colors.danger }]}>Rejeitar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {/* Preview modal */}
        {previewPlano && Platform.OS === 'web' && (
          <Modal visible animationType="slide" onRequestClose={() => setPreviewPlano(null)}>
            <View style={{ flex: 1, backgroundColor: Colors.background }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface }}>
                <TouchableOpacity onPress={() => setPreviewPlano(null)} style={{ padding: 4 }}>
                  <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text }}>Plano de Aula</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>{previewPlano.professorNome} · {previewPlano.disciplina}</Text>
                </View>
                {!isProf && previewPlano.status === 'submetido' && (
                  <TouchableOpacity
                    style={[st.btnSec, { borderColor: Colors.success + '55', backgroundColor: Colors.success + '12' }]}
                    onPress={() => { setPreviewPlano(null); setObsModalPlano(previewPlano); setObsText(''); }}
                  >
                    <MaterialCommunityIcons name="check" size={14} color={Colors.success} />
                    <Text style={[st.btnSecTxt, { color: Colors.success }]}>Aprovar</Text>
                  </TouchableOpacity>
                )}
              </View>
              <iframe
                srcDoc={buildPlanoHTML(previewPlano)}
                style={{ flex: 1, border: 'none', width: '100%', height: '100%', minHeight: 600 } as any}
                title="Plano de Aula"
              />
            </View>
          </Modal>
        )}

        {/* Approve/Reject modal */}
        {obsModalPlano && (
          <Modal visible animationType="slide" transparent onRequestClose={() => setObsModalPlano(null)}>
            <View style={{ flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: Colors.background, borderRadius: 20, padding: 20, width: '100%', maxWidth: 480 }}>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 }}>
                  {obsModalPlano.status === 'rejeitado' ? 'Rejeitar Plano' : 'Aprovar Plano'}
                </Text>
                <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 14 }}>
                  {obsModalPlano.disciplina} · {obsModalPlano.professorNome}
                </Text>
                <Text style={st.lbl}>{obsModalPlano.status === 'rejeitado' ? 'Motivo da rejeição *' : 'Observação (opcional)'}</Text>
                <TextInput
                  style={[st.input, { height: 100, textAlignVertical: 'top', marginBottom: 16 }]}
                  multiline
                  value={obsText}
                  onChangeText={setObsText}
                  placeholder={obsModalPlano.status === 'rejeitado' ? 'Indique o motivo...' : 'Notas adicionais...'}
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[st.btnSec, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => setObsModalPlano(null)}
                  >
                    <Text style={[st.btnSecTxt, { color: Colors.textSecondary }]}>Cancelar</Text>
                  </TouchableOpacity>
                  {obsModalPlano.status === 'rejeitado' ? (
                    <TouchableOpacity
                      style={[st.btnPrimary, { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: Colors.danger }]}
                      onPress={() => rejeitarPlano(obsModalPlano, obsText)}
                    >
                      <MaterialCommunityIcons name="close-circle" size={16} color="#fff" />
                      <Text style={st.btnPrimaryTxt}>Rejeitar</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[st.btnPrimary, { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: Colors.success }]}
                        onPress={() => aprovarPlano(obsModalPlano, obsText)}
                      >
                        <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
                        <Text style={st.btnPrimaryTxt}>Aprovar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                {obsModalPlano.status !== 'rejeitado' && (
                  <TouchableOpacity
                    style={[st.btnSec, { marginTop: 8, justifyContent: 'center', borderColor: Colors.danger + '55', backgroundColor: Colors.danger + '12' }]}
                    onPress={() => { setObsModalPlano({ ...obsModalPlano, status: 'rejeitado' }); }}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={14} color={Colors.danger} />
                    <Text style={[st.btnSecTxt, { color: Colors.danger }]}>Rejeitar em vez disso</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    );
  }

  function renderFAB() {
    if (tab === 'resultados' || tab === 'planos_aula') return null;
    const labels: Record<TabKey, string> = {
      planificacoes: 'Nova Planificação',
      programa:      'Novo Conteúdo',
      ocorrencias:   'Nova Ocorrência',
      resultados:    '',
      planos_aula:   '',
    };
    const handlers: Record<TabKey, () => void> = {
      planificacoes: () => { setEditPlan(null); setFormPlan(defaultPlan); setShowPlanModal(true); },
      programa:      () => { setEditProg(null); setFormProg(defaultProg); setShowProgModal(true); },
      ocorrencias:   () => { setEditOco(null);  setFormOco(defaultOco);  setShowOcoModal(true); },
      resultados:    () => {},
      planos_aula:   () => {},
    };
    return (
      <TouchableOpacity style={[st.fab, { bottom: bottom + 80 }]} onPress={handlers[tab]}>
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={st.fabLabel}>{labels[tab]}</Text>
      </TouchableOpacity>
    );
  }

  // ── Modal Planificação ────────────────────────────────────────────────────
  function renderPlanModal() {
    return (
      <Modal visible={showPlanModal} animationType="fade" transparent onRequestClose={() => setShowPlanModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalSheet}>
        <ScrollView style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={st.modalTitle}>{editPlan ? 'Editar Planificação' : 'Nova Planificação'}</Text>
            <TouchableOpacity onPress={() => setShowPlanModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={st.lbl}>Turma *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40, marginBottom: 14 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            {turmasVisiveis.map(t => (
              <TouchableOpacity key={t.id} onPress={() => setFormPlan(p => ({ ...p, turmaId: t.id }))}
                style={[st.chip, formPlan.turmaId === t.id && st.chipActive]}>
                <Text style={[st.chipText, formPlan.turmaId === t.id && st.chipTextActive]}>{t.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.lbl}>Disciplina *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40, marginBottom: 14 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            {disciplinasVisiveis.map(d => (
              <TouchableOpacity key={d} onPress={() => setFormPlan(p => ({ ...p, disciplina: d }))}
                style={[st.chip, formPlan.disciplina === d && st.chipActive]}>
                <Text style={[st.chipText, formPlan.disciplina === d && st.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.lbl}>Trimestre *</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {TRIMESTRES.map(t => (
                  <TouchableOpacity key={t} onPress={() => setFormPlan(p => ({ ...p, trimestre: t }))}
                    style={[st.chip, formPlan.trimestre === t && st.chipActive]}>
                    <Text style={[st.chipText, formPlan.trimestre === t && st.chipTextActive]}>{t}º</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.lbl}>Semana *</Text>
              <TextInput style={st.input} placeholderTextColor={Colors.textMuted} keyboardType="numeric" value={String(formPlan.semana)}
                onChangeText={v => setFormPlan(p => ({ ...p, semana: parseInt(v)||1 }))} returnKeyType="next" blurOnSubmit={false} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.lbl}>Nº Aulas</Text>
              <TextInput style={st.input} placeholderTextColor={Colors.textMuted} keyboardType="numeric" value={formPlan.numAulas}
                onChangeText={v => setFormPlan(p => ({ ...p, numAulas: v }))} returnKeyType="done" onSubmitEditing={savePlan} />
            </View>
          </View>

          {([['tema','Tema / Título *'],['objectivos','Objectivos'],['conteudos','Conteúdos'],['metodologia','Metodologia'],['recursos','Recursos Necessários'],['avaliacao','Avaliação'],['observacoes','Observações']] as [keyof typeof formPlan, string][]).map(([key, label]) => (
            <View key={key} style={{ marginBottom: 14 }}>
              <Text style={st.lbl}>{label}</Text>
              <TextInput style={[st.input, { height: key === 'tema' ? 44 : 80, textAlignVertical: 'top' }]} placeholderTextColor={Colors.textMuted}
                multiline={key !== 'tema'}
                value={String(formPlan[key])}
                onChangeText={v => setFormPlan(p => ({ ...p, [key]: v }))}
                placeholder={label}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          ))}

          <TouchableOpacity style={st.btnPrimary} onPress={savePlan}>
            <Text style={st.btnPrimaryTxt}>{editPlan ? 'Actualizar' : 'Criar Planificação'}</Text>
          </TouchableOpacity>
        </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Modal Conteúdo Programático ───────────────────────────────────────────
  function renderProgModal() {
    return (
      <Modal visible={showProgModal} animationType="fade" transparent onRequestClose={() => setShowProgModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalSheet}>
        <ScrollView style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={st.modalTitle}>{editProg ? 'Editar Conteúdo' : 'Novo Conteúdo'}</Text>
            <TouchableOpacity onPress={() => setShowProgModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={st.lbl}>Disciplina *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 14 }}>
            {disciplinasVisiveis.map(d => (
              <TouchableOpacity key={d} onPress={() => setFormProg(p => ({ ...p, disciplina: d }))}
                style={[st.chip, formProg.disciplina === d && st.chipActive]}>
                <Text style={[st.chipText, formProg.disciplina === d && st.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.lbl}>Classe *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 14 }}>
            {classes.map(c => (
              <TouchableOpacity key={c} onPress={() => setFormProg(p => ({ ...p, classe: c }))}
                style={[st.chip, formProg.classe === c && st.chipActive]}>
                <Text style={[st.chipText, formProg.classe === c && st.chipTextActive]}>{c}ª</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.lbl}>Trimestre *</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {TRIMESTRES.map(t => (
              <TouchableOpacity key={t} onPress={() => setFormProg(p => ({ ...p, trimestre: t }))}
                style={[st.chip, formProg.trimestre === t && st.chipActive]}>
                <Text style={[st.chipText, formProg.trimestre === t && st.chipTextActive]}>{t}º Trim.</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.lbl}>Título *</Text>
          <TextInput style={[st.input, { marginBottom: 14 }]} value={formProg.titulo}
            onChangeText={v => setFormProg(p => ({ ...p, titulo: v }))}
            placeholder="Ex: Funções e Gráficos" placeholderTextColor={Colors.textMuted} returnKeyType="next" blurOnSubmit={false} />

          <Text style={st.lbl}>Descrição</Text>
          <TextInput style={[st.input, { height: 80, textAlignVertical: 'top', marginBottom: 14 }]} placeholderTextColor={Colors.textMuted}
            multiline value={formProg.descricao}
            onChangeText={v => setFormProg(p => ({ ...p, descricao: v }))}
            placeholder="Descrição detalhada..." placeholderTextColor={Colors.textMuted} />

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.lbl}>% Cumprimento</Text>
              <TextInput style={st.input} placeholderTextColor={Colors.textMuted} keyboardType="numeric" value={formProg.percentagem}
                onChangeText={v => setFormProg(p => ({ ...p, percentagem: v }))} returnKeyType="next" blurOnSubmit={false} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.lbl}>Ordem</Text>
              <TextInput style={st.input} placeholderTextColor={Colors.textMuted} keyboardType="numeric" value={formProg.ordem}
                onChangeText={v => setFormProg(p => ({ ...p, ordem: v }))} returnKeyType="done" onSubmitEditing={saveProg} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => setFormProg(p => ({ ...p, cumprido: !p.cumprido }))}
              style={[st.badge, { backgroundColor: formProg.cumprido ? Colors.success + '22' : Colors.border }]}>
              <Ionicons name={formProg.cumprido ? 'checkmark-circle' : 'ellipse-outline'} size={20}
                color={formProg.cumprido ? Colors.success : Colors.textMuted} />
              <Text style={{ color: formProg.cumprido ? Colors.success : Colors.textMuted, fontFamily: 'Inter_500Medium' }}>
                {formProg.cumprido ? 'Cumprido' : 'Marcar como cumprido'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={st.btnPrimary} onPress={saveProg}>
            <Text style={st.btnPrimaryTxt}>{editProg ? 'Actualizar' : 'Adicionar Conteúdo'}</Text>
          </TouchableOpacity>
        </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Modal Ocorrência ──────────────────────────────────────────────────────
  function renderOcoModal() {
    const alunosTurma = formOco.turmaId ? alunos.filter(a => a.turmaId === formOco.turmaId && a.ativo) : [];
    return (
      <Modal visible={showOcoModal} animationType="fade" transparent onRequestClose={() => setShowOcoModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalSheet}>
        <ScrollView style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={st.modalTitle}>{editOco ? 'Editar Ocorrência' : 'Nova Ocorrência'}</Text>
            <TouchableOpacity onPress={() => setShowOcoModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={st.lbl}>Turma *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40, marginBottom: 14 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            {turmasVisiveis.map(t => (
              <TouchableOpacity key={t.id} onPress={() => setFormOco(p => ({ ...p, turmaId: t.id, alunoId: '' }))}
                style={[st.chip, formOco.turmaId === t.id && st.chipActive]}>
                <Text style={[st.chipText, formOco.turmaId === t.id && st.chipTextActive]}>{t.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {formOco.turmaId !== '' && (
            <>
              <Text style={st.lbl}>Aluno *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40, marginBottom: 14 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
                {alunosTurma.map(a => (
                  <TouchableOpacity key={a.id} onPress={() => setFormOco(p => ({ ...p, alunoId: a.id }))}
                    style={[st.chip, formOco.alunoId === a.id && st.chipActive]}>
                    <Text style={[st.chipText, formOco.alunoId === a.id && st.chipTextActive]}>{a.nome} {a.apelido}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={st.lbl}>Tipo de Ocorrência *</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {TIPOS_OCO.map(t => (
              <TouchableOpacity key={t} onPress={() => setFormOco(p => ({ ...p, tipo: t }))}
                style={[st.chip, formOco.tipo === t && st.chipActive]}>
                <Text style={[st.chipText, formOco.tipo === t && st.chipTextActive]}>{TIPO_OCO_LABEL[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.lbl}>Gravidade *</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {(['leve','moderada','grave'] as const).map(g => (
              <TouchableOpacity key={g} onPress={() => setFormOco(p => ({ ...p, gravidade: g }))}
                style={[st.chip, formOco.gravidade === g && { backgroundColor: GRAVIDADE_CFG[g].color + '33', borderColor: GRAVIDADE_CFG[g].color }]}>
                <Text style={[st.chipText, formOco.gravidade === g && { color: GRAVIDADE_CFG[g].color }]}>{GRAVIDADE_CFG[g].label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.lbl}>Data *</Text>
          <DateInput style={[st.input, { marginBottom: 14 }]} value={formOco.data} onChangeText={v => setFormOco(p => ({ ...p, data: v }))} />

          <Text style={st.lbl}>Descrição da Ocorrência *</Text>
          <TextInput style={[st.input, { height: 90, textAlignVertical: 'top', marginBottom: 14 }]} placeholderTextColor={Colors.textMuted}
            multiline value={formOco.descricao}
            onChangeText={v => setFormOco(p => ({ ...p, descricao: v }))}
            placeholder="Descreva o incidente..." placeholderTextColor={Colors.textMuted} />

          <Text style={st.lbl}>Medida Tomada</Text>
          <TextInput style={[st.input, { height: 70, textAlignVertical: 'top', marginBottom: 14 }]} placeholderTextColor={Colors.textMuted}
            multiline value={formOco.medidaTomada}
            onChangeText={v => setFormOco(p => ({ ...p, medidaTomada: v }))}
            placeholder="Acção disciplinar tomada..." placeholderTextColor={Colors.textMuted} />

          <Text style={st.lbl}>Observações</Text>
          <TextInput style={[st.input, { height: 60, textAlignVertical: 'top', marginBottom: 20 }]} placeholderTextColor={Colors.textMuted}
            multiline value={formOco.observacoes}
            onChangeText={v => setFormOco(p => ({ ...p, observacoes: v }))}
            placeholder="Notas adicionais..." placeholderTextColor={Colors.textMuted} />

          <TouchableOpacity style={st.btnPrimary} onPress={saveOco}>
            <Text style={st.btnPrimaryTxt}>{editOco ? 'Actualizar' : 'Registar Ocorrência'}</Text>
          </TouchableOpacity>
        </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Root ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <TopBar title="Área Pedagógica" />
      {renderTabBar()}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={{ color: Colors.textSecondary, marginTop: 12, fontFamily: 'Inter_400Regular' }}>A carregar dados...</Text>
        </View>
      ) : (
        <>
          {tab === 'planificacoes' && renderPlanificacoes()}
          {tab === 'programa'      && renderPrograma()}
          {tab === 'resultados'    && renderResultados()}
          {tab === 'ocorrencias'   && renderOcorrencias()}
          {tab === 'planos_aula'   && renderPlanosAula()}
        </>
      )}
      {renderFAB()}
      {renderPlanModal()}
      {renderProgModal()}
      {renderOcoModal()}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  kpi: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiVal: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  kpiLbl: { fontSize: 10, color: Colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 2, textAlign: 'center' },
  secLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted,
    letterSpacing: 1, marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  cardSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  detRow: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 2 },
  detLbl: { fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipText:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  chipTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  filterLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted, marginBottom: 2 },
  btnSec: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, backgroundColor: Colors.backgroundElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  btnSecTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  btnPrimary: {
    backgroundColor: Colors.gold, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  btnPrimaryTxt: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.primaryDark },
  fab: {
    position: 'absolute', right: 20,
    height: 44, borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: 'row', gap: 6,
    backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8,
  },
  fabLabel: {
    color: Colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 13,
  },
  searchInput: {
    backgroundColor: Colors.backgroundCard, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, color: Colors.text, fontFamily: 'Inter_400Regular',
    fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTxt: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  lbl: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.backgroundElevated, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, color: Colors.text, fontFamily: 'Inter_400Regular',
    fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
