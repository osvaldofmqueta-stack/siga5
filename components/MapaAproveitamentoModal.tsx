import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Curso { id: string; nome: string; codigo?: string; ativo: boolean }

interface Props {
  visible: boolean;
  onClose: () => void;
  alunos: any[];
  turmas: any[];
  notas: any[];
  config: any;
  anoAtual: string;
  user: any;
}

const CLASSES_II_CICLO = ['10', '11', '12', '13'];
const TURNOS = ['Todos', 'Manhã', 'Tarde', 'Noite'];
const TRIMESTRES = [1, 2, 3];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtDate(d: Date) {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const docNum = () => `MAP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

// ─── HTML Generator ───────────────────────────────────────────────────────────

function buildMapaHTML(params: {
  classes: string[];
  trimestre: number;
  turno: string;
  anoLetivo: string;
  cursosDisponiveis: Curso[];
  cursoId: string;
  alunos: any[];
  turmas: any[];
  notas: any[];
  config: any;
  subdirectorNome: string;
  secretariaNome: string;
}): string {
  const {
    classes, trimestre, turno, anoLetivo, cursosDisponiveis, cursoId,
    alunos, turmas, notas, config, subdirectorNome, secretariaNome,
  } = params;

  const nomeEscola = config?.nomeEscola || 'Escola';
  const logoUrl = config?.logoUrl || '';
  const nota_min = config?.notaMinimaAprovacao ?? 10;
  const hoje = fmtDate(new Date());
  const cursoNome = cursosDisponiveis.find(c => c.id === cursoId)?.nome || 'Todos os Cursos';
  const turnoLabel = turno === 'Todos' ? 'Todos os Regimes' : `Regime ${turno}`;
  const trLabel = `${trimestre}º Trimestre`;

  const BASE_CSS = `
  <meta charset="UTF-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Times New Roman',serif;background:#fff;color:#000;font-size:11px;}
    .print-btn{display:block;margin:16px auto;padding:10px 32px;font-size:13px;background:#1a6b3c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;}
    .print-btn:hover{background:#145a32;}
    .page{padding:12px 18px;page-break-after:always;}
    .page:last-child{page-break-after:auto;}
    .header{text-align:center;margin-bottom:8px;border-bottom:2px solid #000;padding-bottom:8px;}
    .header img{width:64px;height:64px;object-fit:contain;margin-bottom:3px;}
    .header .rep{font-size:11px;line-height:1.5;}
    .header .titulo{font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:4px 0;}
    .header .escola{font-size:13px;font-weight:bold;text-transform:uppercase;margin:2px 0;}
    .doc-num{text-align:right;font-size:9px;color:#555;margin-bottom:6px;}
    .meta{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:10.5px;font-weight:bold;border:1px solid #000;padding:5px 8px;margin-bottom:8px;background:#f5f5f5;}
    .meta span{white-space:nowrap;}
    .classe-title{font-size:13px;font-weight:bold;text-transform:uppercase;border-bottom:2px solid #1a6b3c;color:#1a3a1a;padding-bottom:3px;margin:12px 0 6px;letter-spacing:0.5px;}
    .turma-title{font-size:11px;font-weight:bold;color:#1a5276;margin:8px 0 4px;}
    table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:6px;}
    th,td{border:1px solid #555;padding:2px 3px;}
    th{background:#1a6b3c;color:#fff;font-weight:bold;text-align:center;white-space:nowrap;font-size:9px;}
    th.sub{background:#c6efce;color:#000;font-size:8.5px;}
    td.nc{text-align:center;}
    td.bold{font-weight:bold;}
    td.apto{color:#155724;font-weight:bold;}
    td.rep{color:#721c24;font-weight:bold;}
    .summary{font-size:10px;color:#333;margin:4px 0 10px;padding:3px 6px;background:#f0fff0;border-left:3px solid #1a6b3c;}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;gap:12px;}
    .sig{text-align:center;flex:1;}
    .sig-line{border-top:1px solid #000;margin-top:36px;padding-top:4px;font-size:10px;min-width:160px;}
    .sig-name{font-weight:bold;font-size:10.5px;}
    @media print{
      .no-print{display:none!important;}
      body{padding:0;}
      .page{padding:8px 12px;}
      @page{size:A4 landscape;margin:8mm;}
    }
  </style>`;

  const orderedClasses = CLASSES_II_CICLO.filter(c => classes.includes(c));

  const pagesHTML = orderedClasses.map(classe => {
    const turmasDaClasse = turmas.filter(t => {
      if (t.classe !== classe) return false;
      if (anoLetivo && t.anoLetivo !== anoLetivo) return false;
      if (turno !== 'Todos' && t.turno !== turno) return false;
      if (cursoId && t.cursoId !== cursoId) return false;
      return true;
    });

    if (turmasDaClasse.length === 0) {
      return `<div class="page">
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo"/>` : ''}
          <div class="rep">REPÚBLICA DE ANGOLA<br/>MINISTÉRIO DA EDUCAÇÃO</div>
          <div class="titulo">Mapa de Aproveitamento</div>
          <div class="escola">${nomeEscola}</div>
        </div>
        <div class="classe-title">${classe}ª Classe — ${cursoNome}</div>
        <p style="color:#666;font-style:italic;text-align:center;padding:20px;">Sem turmas correspondentes aos filtros seleccionados.</p>
      </div>`;
    }

    const turmasSections = turmasDaClasse.map(turma => {
      const alunosDaTurma = alunos
        .filter(a => a.turmaId === turma.id && a.ativo)
        .sort((a, b) => `${a.nome} ${a.apelido}`.localeCompare(`${b.nome} ${b.apelido}`));

      const disciplinas: string[] = [];
      for (const n of notas) {
        if (n.turmaId === turma.id && n.trimestre === trimestre && !disciplinas.includes(n.disciplina)) {
          disciplinas.push(n.disciplina);
        }
      }
      disciplinas.sort();

      if (alunosDaTurma.length === 0) {
        return `<div class="turma-title">Turma ${turma.nome} — ${turma.turno}</div>
          <p style="color:#666;font-style:italic;padding:6px;">Sem alunos registados nesta turma.</p>`;
      }

      let aprovados = 0;
      let reprovados = 0;
      let semNotas = 0;

      const headerDiscs = disciplinas.map(d => `<th class="sub">${d}</th>`).join('');
      const rows = alunosDaTurma.map((aluno, idx) => {
        const notasAluno = notas.filter(n =>
          n.alunoId === aluno.id && n.turmaId === turma.id && n.trimestre === trimestre
        );

        const notasPorDisc: Record<string, number | null> = {};
        for (const n of notasAluno) {
          const val = n.mt1 ?? n.nf ?? null;
          notasPorDisc[n.disciplina] = typeof val === 'number' && val > 0 ? val : null;
        }

        const vals = Object.values(notasPorDisc).filter((v): v is number => v !== null && v > 0);
        const media = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        const resultado = media !== null ? (media >= nota_min ? 'Aprovado' : 'Reprovado') : '';

        if (media !== null) {
          if (media >= nota_min) aprovados++; else reprovados++;
        } else {
          semNotas++;
        }

        const fmt = (v: number | null) => v !== null && v > 0 ? v.toFixed(1) : '—';
        const discCells = disciplinas.map(d => {
          const v = notasPorDisc[d] ?? null;
          const ok = v !== null && v >= nota_min;
          return `<td class="nc${v !== null ? (ok ? ' apto' : ' rep') : ''}">${fmt(v)}</td>`;
        }).join('');

        const mediaClass = media !== null ? (media >= nota_min ? 'apto' : 'rep') : '';
        const bg = idx % 2 === 0 ? '#f9fff9' : '#fff';

        return `<tr style="background:${bg}">
          <td class="nc" style="font-size:9px;">${String(idx + 1).padStart(2, '0')}</td>
          <td style="font-size:9.5px;padding-left:3px;">${aluno.nome} ${aluno.apelido}</td>
          ${discCells}
          <td class="nc bold ${mediaClass}">${fmt(media)}</td>
          <td class="nc" style="font-size:9px;">${resultado}</td>
        </tr>`;
      }).join('');

      const summaryText = `Alunos: ${alunosDaTurma.length} &nbsp;|&nbsp; Aprovados: <strong>${aprovados}</strong> &nbsp;|&nbsp; Reprovados: <strong>${reprovados}</strong>${semNotas > 0 ? ` &nbsp;|&nbsp; Sem notas: ${semNotas}` : ''} &nbsp;|&nbsp; Taxa de aprovação: <strong>${alunosDaTurma.length > 0 ? ((aprovados / alunosDaTurma.length) * 100).toFixed(1) : '0'}%</strong>`;

      return `
        <div class="turma-title">Turma ${turma.nome} &nbsp;·&nbsp; ${turma.turno} &nbsp;·&nbsp; ${cursoNome}</div>
        <table>
          <thead>
            <tr>
              <th rowspan="1" style="width:24px;">Nº</th>
              <th rowspan="1" style="min-width:120px;text-align:left;">Nome do Aluno</th>
              ${headerDiscs}
              <th style="width:36px;">Média</th>
              <th style="width:64px;">Resultado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary">${summaryText}</div>`;
    }).join('');

    return `<div class="page">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo"/>` : ''}
        <div class="rep">REPÚBLICA DE ANGOLA — MINISTÉRIO DA EDUCAÇÃO</div>
        <div class="titulo">Mapa de Aproveitamento Escolar</div>
        <div class="escola">${nomeEscola}</div>
      </div>
      <div class="doc-num">N.º Doc: ${docNum()}</div>
      <div class="meta">
        <span>CLASSE: <u>${classe}ª</u></span>
        <span>TRIMESTRE: <u>${trLabel}</u></span>
        <span>REGIME: <u>${turnoLabel}</u></span>
        <span>ANO LECTIVO: <u style="color:#c00;">${anoLetivo}</u></span>
        <span>CURSO: <u>${cursoNome}</u></span>
        <span>DATA: <u>${hoje}</u></span>
      </div>
      <div class="classe-title">${classe}ª Classe — ${trLabel}</div>
      ${turmasSections}
      <div class="footer">
        <div class="sig">
          <div class="sig-line">
            <div class="sig-name">${subdirectorNome || '___________________________'}</div>
            O(A) SUBDIRECTOR(A) PEDAGÓGICO(A)
          </div>
        </div>
        <div class="sig">
          <div class="sig-line">
            <div class="sig-name">${secretariaNome || '___________________________'}</div>
            SECRETARIA ACADÉMICA
          </div>
        </div>
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html><html lang="pt"><head>${BASE_CSS}</head><body>
    <button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
    ${pagesHTML}
    <button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
  </body></html>`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MapaAproveitamentoModal({
  visible, onClose, alunos, turmas, notas, config, anoAtual, user,
}: Props) {
  const isWeb = Platform.OS === 'web';

  const [step, setStep] = useState<'filtros' | 'preview'>('filtros');
  const [trimestre, setTrimestre] = useState<1 | 2 | 3>(1);
  const [turno, setTurno] = useState<string>('Todos');
  const [anoLetivo, setAnoLetivo] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [classesSelected, setClassesSelected] = useState<string[]>(['10', '11', '12', '13']);
  const [subdirectorNome, setSubdirectorNome] = useState('');
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState('');

  useEffect(() => {
    if (!visible) return;
    setStep('filtros');
    setTrimestre(1);
    setTurno('Todos');
    setAnoLetivo(anoAtual);
    setCursoId('');
    setClassesSelected(['10', '11', '12', '13']);
    setSubdirectorNome(config?.directorPedagogico || '');
    setGeneratedHTML('');
    setLoadingCursos(true);
    api.get('/api/cursos')
      .then((data: any) => {
        const list = Array.isArray(data) ? data : [];
        setCursos(list.filter((c: Curso) => c.ativo));
      })
      .catch(() => setCursos([]))
      .finally(() => setLoadingCursos(false));
  }, [visible]);

  function toggleClasse(c: string) {
    setClassesSelected(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  function handleGenerate() {
    if (classesSelected.length === 0) {
      Alert.alert('Classes obrigatórias', 'Seleccione pelo menos uma classe.');
      return;
    }
    if (!anoLetivo.trim()) {
      Alert.alert('Ano Académico obrigatório', 'Indique o ano académico.');
      return;
    }
    setGenerating(true);
    setTimeout(() => {
      try {
        const html = buildMapaHTML({
          classes: classesSelected,
          trimestre,
          turno,
          anoLetivo: anoLetivo.trim(),
          cursosDisponiveis: cursos,
          cursoId,
          alunos,
          turmas,
          notas,
          config,
          subdirectorNome: subdirectorNome.trim(),
          secretariaNome: user?.nome || '',
        });
        setGeneratedHTML(html);
        setStep('preview');
      } finally {
        setGenerating(false);
      }
    }, 80);
  }

  function handlePrint() {
    if (!isWeb) {
      Alert.alert('Impressão', 'A impressão está disponível na versão web.');
      return;
    }
    const iframe = document.getElementById('mapa-iframe') as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    } else {
      const w = window.open('', '_blank');
      if (w) { w.document.write(generatedHTML); w.document.close(); w.print(); }
    }
  }

  // ── Render: Filtros ─────────────────────────────────────────────────────────
  function renderFiltros() {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={st.stepTitle}>Mapa de Aproveitamento</Text>
        <Text style={st.stepSub}>Configure os filtros para gerar o mapa por classe</Text>

        {/* Trimestre */}
        <Text style={st.fieldLabel}>Trimestre</Text>
        <View style={st.chipRow}>
          {TRIMESTRES.map(t => (
            <TouchableOpacity
              key={t}
              style={[st.chip, trimestre === t && { backgroundColor: Colors.info + '20', borderColor: Colors.info }]}
              onPress={() => setTrimestre(t as 1 | 2 | 3)}
            >
              <Text style={[st.chipTxt, trimestre === t && { color: Colors.info, fontFamily: 'Inter_700Bold' }]}>
                {t}º Trimestre
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Regime/Turno */}
        <Text style={st.fieldLabel}>Regime / Turno</Text>
        <View style={st.chipRow}>
          {TURNOS.map(t => (
            <TouchableOpacity
              key={t}
              style={[st.chip, turno === t && { backgroundColor: Colors.gold + '20', borderColor: Colors.gold }]}
              onPress={() => setTurno(t)}
            >
              <Text style={[st.chipTxt, turno === t && { color: Colors.gold, fontFamily: 'Inter_700Bold' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ano Académico */}
        <Text style={st.fieldLabel}>Ano Académico</Text>
        <TextInput
          style={st.input}
          value={anoLetivo}
          onChangeText={setAnoLetivo}
          placeholder="Ex: 2024/2025"
          placeholderTextColor={Colors.textMuted}
        />

        {/* Curso */}
        <Text style={st.fieldLabel}>Curso</Text>
        {loadingCursos ? (
          <ActivityIndicator size="small" color={Colors.gold} style={{ marginBottom: 12 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[st.chip, cursoId === '' && { backgroundColor: Colors.success + '20', borderColor: Colors.success }]}
                onPress={() => setCursoId('')}
              >
                <Text style={[st.chipTxt, cursoId === '' && { color: Colors.success, fontFamily: 'Inter_700Bold' }]}>
                  Todos
                </Text>
              </TouchableOpacity>
              {cursos.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[st.chip, cursoId === c.id && { backgroundColor: Colors.success + '20', borderColor: Colors.success }]}
                  onPress={() => setCursoId(c.id)}
                >
                  <Text style={[st.chipTxt, cursoId === c.id && { color: Colors.success, fontFamily: 'Inter_700Bold' }]}>
                    {c.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Classes */}
        <Text style={st.fieldLabel}>Classes (II Ciclo)</Text>
        <View style={st.chipRow}>
          {CLASSES_II_CICLO.map(c => {
            const sel = classesSelected.includes(c);
            return (
              <TouchableOpacity
                key={c}
                style={[st.classeChip, sel && { backgroundColor: Colors.accent + '25', borderColor: Colors.accent }]}
                onPress={() => toggleClasse(c)}
              >
                {sel && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
                <Text style={[st.classeChipTxt, sel && { color: Colors.accent, fontFamily: 'Inter_700Bold' }]}>
                  {c}ª Classe
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={st.hintTxt}>
          {classesSelected.length === 0
            ? 'Seleccione pelo menos uma classe'
            : `${classesSelected.length} classe${classesSelected.length > 1 ? 's' : ''} seleccionada${classesSelected.length > 1 ? 's' : ''}: ${classesSelected.sort().map(c => c + 'ª').join(', ')}`}
        </Text>

        {/* Subdirector Pedagógico */}
        <View style={st.signSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ionicons name="create" size={14} color={Colors.gold} />
            <Text style={st.signTitle}>Assinante</Text>
          </View>
          <Text style={st.fieldLabel}>Nome do(a) Subdirector(a) Pedagógico(a)</Text>
          <TextInput
            style={st.input}
            value={subdirectorNome}
            onChangeText={setSubdirectorNome}
            placeholder="Nome completo do Subdirector(a) Pedagógico(a)"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={st.fieldLabel}>Secretaria Académica</Text>
          <View style={[st.input, { paddingVertical: 11, justifyContent: 'center' }]}>
            <Text style={{ color: Colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14 }}>
              {user?.nome || '— preenchido automaticamente —'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[st.generateBtn, (generating || classesSelected.length === 0) && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating || classesSelected.length === 0}
        >
          {generating
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="eye" size={18} color="#fff" />}
          <Text style={st.generateBtnTxt}>{generating ? 'A gerar...' : 'Visualizar Mapa'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Render: Preview ─────────────────────────────────────────────────────────
  function renderPreview() {
    return (
      <View style={{ flex: 1 }}>
        <View style={st.previewBar}>
          <View style={{ flex: 1 }}>
            <Text style={st.previewTitle}>Mapa de Aproveitamento</Text>
            <Text style={st.previewSub}>
              {trimestre}º Trimestre · {anoLetivo} · {classesSelected.sort().map(c => c + 'ª').join(', ')} Classe
            </Text>
          </View>
          <TouchableOpacity style={st.printBtn} onPress={handlePrint}>
            <Ionicons name="print" size={15} color="#fff" />
            <Text style={st.printBtnTxt}>Imprimir / PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.editBtn} onPress={() => setStep('filtros')}>
            <Ionicons name="arrow-back" size={15} color={Colors.gold} />
            <Text style={st.editBtnTxt}>Filtros</Text>
          </TouchableOpacity>
        </View>

        {isWeb ? (
          <iframe
            id="mapa-iframe"
            srcDoc={generatedHTML}
            style={{ flex: 1, border: 'none', width: '100%', height: '100%', minHeight: 500 } as any}
            title="Mapa de Aproveitamento"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' }}>
              Mapa gerado com sucesso!
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' }}>
              A pré-visualização e impressão estão disponíveis na versão web do sistema.
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={st.container}>
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} style={st.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Mapa de Aproveitamento</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Step indicator */}
        <View style={st.stepBar}>
          {(['filtros', 'preview'] as const).map((s, i) => {
            const labels = ['Filtros', 'Prévia'];
            const icons = ['options', 'eye'];
            const done = step === 'preview' && s === 'filtros';
            const active = step === s;
            const color = done ? Colors.success : active ? Colors.gold : Colors.textMuted;
            return (
              <React.Fragment key={s}>
                <TouchableOpacity
                  style={st.stepItem}
                  onPress={() => { if (done) setStep(s); }}
                  disabled={!done}
                >
                  <View style={[st.stepCircle, { borderColor: color, backgroundColor: done ? Colors.success + '20' : active ? Colors.gold + '20' : 'transparent' }]}>
                    {done
                      ? <Ionicons name="checkmark" size={14} color={Colors.success} />
                      : <Ionicons name={icons[i] as any} size={14} color={color} />}
                  </View>
                  <Text style={[st.stepLabel, { color }]}>{labels[i]}</Text>
                </TouchableOpacity>
                {i < 1 && <View style={[st.stepLine, { backgroundColor: done ? Colors.success : Colors.border }]} />}
              </React.Fragment>
            );
          })}
        </View>

        <View style={{ flex: 1 }}>
          {step === 'filtros' && renderFiltros()}
          {step === 'preview' && renderPreview()}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  closeBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },

  stepBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepItem:     { alignItems: 'center', gap: 4, minWidth: 60 },
  stepCircle:   { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  stepLabel:    { fontSize: 10, fontFamily: 'Inter_500Medium' },
  stepLine:     { flex: 1, height: 1.5, marginBottom: 12 },

  stepTitle:    { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  stepSub:      { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 16 },
  fieldLabel:   { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipTxt:      { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },

  classeChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surface },
  classeChipTxt:{ fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },

  hintTxt:      { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: -10, marginBottom: 16, fontStyle: 'italic' },

  input:        { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, marginBottom: 12, outlineStyle: 'none' as any },

  signSection:  { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  signTitle:    { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },

  generateBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, borderRadius: 12, padding: 16, marginTop: 4 },
  generateBtnTxt:{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  previewBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, padding: 12, paddingHorizontal: 16 },
  previewTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  previewSub:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  printBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.info, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  printBtnTxt:  { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  editBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.gold + '55' },
  editBtnTxt:   { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
});
