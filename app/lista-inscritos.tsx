import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface Registro {
  id: string;
  nomeCompleto: string;
  dataNascimento: string;
  genero: string;
  provincia: string;
  municipio: string;
  telefone: string;
  email: string;
  nivel: string;
  classe: string;
  cursoNome?: string;
  cursoId?: string;
  status: string;
  criadoEm: string;
  rupeInscricao?: string;
  nomeEncarregado: string;
  telefoneEncarregado: string;
}

interface DisciplinaExame {
  nome: string;
  diaSemana: string;
  data: string;
}

function hoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function anoAtual(): string { return String(new Date().getFullYear()); }

function extrairNumInscricao(r: Registro, globalIdx: number): string {
  if (r.rupeInscricao) {
    const partes = r.rupeInscricao.split('-');
    if (partes.length >= 4) return partes[3];
  }
  return String(10000 + globalIdx);
}

function buildDocumentoCursoHTML(
  curso: string,
  alunos: Registro[],
  startNum: number,
  config: {
    nomeEscola: string;
    anoExame: string;
    local: string;
    campus: string;
    sala: string;
    hora: string;
    disciplinas: DisciplinaExame[];
    logoUrl: string;
  },
  isFirst: boolean,
): string {
  const disciplinasTxt = config.disciplinas
    .filter(d => d.nome.trim())
    .map(d => {
      const parts = [d.nome.trim()];
      if (d.diaSemana.trim() || d.data.trim()) {
        parts.push(`(${[d.diaSemana.trim(), d.data.trim()].filter(Boolean).join(', ')}`);
        parts[parts.length - 1] += ')';
      }
      return parts.join(' ');
    })
    .join(' &nbsp;|&nbsp; ');

  const rows = alunos.map((a, idx) => {
    const numInscricao = extrairNumInscricao(a, startNum + idx);
    const bg = idx % 2 === 0 ? '#ffffff' : '#eef6ff';
    return `<tr style="background:${bg}">
      <td class="num">${startNum + idx}</td>
      <td class="nome">${a.nomeCompleto.toUpperCase()}</td>
      <td class="cand">${numInscricao}</td>
      <td class="curso-td">${curso !== 'Geral' ? curso : (a.cursoNome || '—')}</td>
    </tr>`;
  }).join('');

  const pageBreak = isFirst ? '' : '<div style="page-break-before:always;"></div>';

  return `
${pageBreak}
<div class="doc-page">
  <div class="doc-header">
    <div class="header-logo-col">
      <img src="${config.logoUrl}" class="logo-img" alt="Insígnia" onerror="this.style.display='none'" />
    </div>
    <div class="header-text-col">
      <div class="escola-nome">${config.nomeEscola.toUpperCase()}</div>
      <div class="doc-titulo">EXAMES DE ADMISSÃO — ${config.anoExame}</div>
      <div class="doc-subtitulo">LISTA DE CANDIDATOS POR SALAS DE EXAME</div>
      ${disciplinasTxt ? `<div class="disciplinas-line"><b>${disciplinasTxt}</b></div>` : ''}
    </div>
  </div>

  <div class="local-row">
    <div class="local-item"><span class="local-label">LOCAL:</span> <u><b>${config.local || '___________'}</b></u></div>
    <div class="local-sep"></div>
    <div class="local-item"><u><b>${config.campus || '___________'}</b></u> — SALA: <u><b>${config.sala || '___________'}</b></u></div>
    <div class="hora-box"><span class="local-label">Hora:</span> <b>${config.hora || '07:30:00'}</b></div>
  </div>

  <hr class="divider" />

  <div class="curso-bloco-titulo">
    CURSO: <b>${curso !== 'Geral' ? curso.toUpperCase() : 'TODOS OS CURSOS'}</b>
    &nbsp;&nbsp;·&nbsp;&nbsp; Total de Candidatos: <b>${alunos.length}</b>
  </div>

  <table>
    <thead>
      <tr>
        <th class="th-num"><u>Ord</u></th>
        <th class="th-nome"><u>Nome</u></th>
        <th class="th-cand"><u>NºCand</u></th>
        <th class="th-curso"><u>Curso</u></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="assinaturas">
    <div class="ass-col">
      <div class="ass-line"></div>
      <div>O Secretário(a)</div>
    </div>
    <div class="ass-col">
      <div class="ass-line"></div>
      <div>O Director(a)</div>
    </div>
  </div>

  <div class="rodape">
    <span>${config.nomeEscola} — Sistema SIGA v3</span>
    <span>Emitido em: ${hoje()}</span>
  </div>
</div>`;
}

function buildListaAdmissaoHTML(
  registros: Registro[],
  config: {
    nomeEscola: string;
    anoExame: string;
    local: string;
    campus: string;
    sala: string;
    hora: string;
    disciplinas: DisciplinaExame[];
    logoUrl: string;
    filtroClasse: string;
    filtroStatus: string[];
  },
): string {
  const lista = registros
    .filter(r => {
      const s = r.status?.toLowerCase() ?? '';
      return config.filtroStatus.some(fs => s.includes(fs));
    })
    .filter(r => config.filtroClasse === 'todas' || r.classe === config.filtroClasse)
    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt', { sensitivity: 'base' }));

  if (lista.length === 0) {
    return '<p style="padding:20px;text-align:center;font-family:Arial,sans-serif;">Nenhum candidato encontrado com os critérios seleccionados.</p>';
  }

  const byCurso: Record<string, Registro[]> = {};
  for (const r of lista) {
    const key = r.cursoNome?.trim() || 'Geral';
    if (!byCurso[key]) byCurso[key] = [];
    byCurso[key].push(r);
  }

  const cursosOrdenados = Object.keys(byCurso).sort((a, b) => a.localeCompare(b, 'pt'));

  let globalIdx = 1;
  const blocos = cursosOrdenados.map((curso, ci) => {
    const alunos = byCurso[curso].sort((a, b) =>
      a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt', { sensitivity: 'base' })
    );
    const html = buildDocumentoCursoHTML(curso, alunos, globalIdx, config, ci === 0);
    globalIdx += alunos.length;
    return html;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lista de Admissão — ${config.nomeEscola}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #f5f5f5; }
  .doc-page { background: #fff; max-width: 210mm; margin: 0 auto 20px; padding: 15mm 18mm 12mm; min-height: 297mm; }

  /* Header */
  .doc-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 10px; }
  .header-logo-col { flex-shrink: 0; }
  .logo-img { width: 72px; height: 72px; object-fit: contain; border: 1px solid #ccc; border-radius: 50%; }
  .header-text-col { flex: 1; text-align: center; }
  .escola-nome { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .doc-titulo { font-size: 12px; font-weight: bold; margin-bottom: 4px; }
  .doc-subtitulo { font-size: 11px; font-weight: bold; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .disciplinas-line { font-size: 10px; font-weight: bold; background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 3px; padding: 4px 8px; display: inline-block; }

  /* Local row */
  .local-row { display: flex; align-items: center; gap: 8px; margin: 8px 0 6px; font-size: 11px; flex-wrap: wrap; }
  .local-label { font-weight: bold; }
  .local-sep { flex: 1; }
  .hora-box { margin-left: auto; font-size: 14px; }

  .divider { border: none; border-top: 2px solid #000; margin: 8px 0; }

  /* Curso header */
  .curso-bloco-titulo { font-size: 11px; margin-bottom: 6px; padding: 4px 6px; background: #f8f8f8; border-left: 4px solid #1A2B5F; }

  /* Table */
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px; font-size: 10.5px; }
  th { background: #fff; color: #000; font-weight: bold; border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 5px 7px; text-align: left; }
  td { border-bottom: 1px solid #ddd; padding: 4px 7px; vertical-align: middle; }
  .th-num, .num { width: 36px; text-align: center; font-weight: bold; }
  .th-nome, .nome { min-width: 200px; }
  .th-cand, .cand { width: 80px; text-align: center; font-weight: bold; font-family: monospace; }
  .th-curso, .curso-td { min-width: 140px; }

  /* Signatures */
  .assinaturas { display: flex; justify-content: space-between; margin-top: 32px; font-size: 10px; }
  .ass-col { text-align: center; }
  .ass-line { width: 160px; border-top: 1px solid #000; margin: 0 auto 4px; margin-top: 26px; }

  /* Footer */
  .rodape { margin-top: 12px; border-top: 1px solid #ccc; padding-top: 5px; display: flex; justify-content: space-between; font-size: 8px; color: #555; }

  .print-btn { position: fixed; bottom: 18px; right: 18px; background: #1A2B5F; color: #fff; border: none; border-radius: 8px; padding: 12px 22px; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.25); z-index: 999; }

  @media print {
    .print-btn { display: none !important; }
    body { background: #fff; }
    .doc-page { margin: 0; padding: 10mm 14mm 8mm; box-shadow: none; min-height: auto; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Exportar PDF</button>
  ${blocos}
</body>
</html>`;
}

const STATUSES_INSCRITOS = ['pendente', 'pendente_pagamento', 'aguardando_prova', 'aguardando prova', 'em_processamento', 'inscrito'];

export default function ListaInscritosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [nomeEscola, setNomeEscola] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [filtroClasse, setFiltroClasse] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState<string[]>(STATUSES_INSCRITOS);

  const [anoExame, setAnoExame] = useState(anoAtual());
  const [local, setLocal] = useState('');
  const [campus, setCampus] = useState('');
  const [sala, setSala] = useState('');
  const [hora, setHora] = useState('07:30:00');
  const [disciplinas, setDisciplinas] = useState<DisciplinaExame[]>([
    { nome: 'Língua Portuguesa', diaSemana: '', data: '' },
    { nome: 'Matemática', diaSemana: '', data: '' },
    { nome: '', diaSemana: '', data: '' },
  ]);

  const [showConfig, setShowConfig] = useState(true);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [regRes, cfgRes] = await Promise.all([
        fetch('/api/registros'),
        fetch('/api/config'),
      ]);
      if (regRes.ok) {
        const data = await regRes.json();
        setRegistros(Array.isArray(data) ? data : []);
      }
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setNomeEscola(cfg.nomeEscola || 'ESCOLA — SIGA');
        if (cfg.localEscola) setLocal(cfg.localEscola);
      }
    } catch {}
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inscritos = registros.filter(r => {
    const s = r.status?.toLowerCase() ?? '';
    return filtroStatus.some(fs => s.includes(fs));
  });

  const classes = Array.from(new Set(inscritos.map(r => r.classe))).sort((a, b) => a.localeCompare(b));
  const filtrados = inscritos.filter(r => filtroClasse === 'todas' || r.classe === filtroClasse);

  const cursos = Array.from(new Set(filtrados.map(r => r.cursoNome?.trim() || 'Geral'))).sort();

  function updateDisciplina(idx: number, field: keyof DisciplinaExame, val: string) {
    setDisciplinas(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  }

  function addDisciplina() {
    setDisciplinas(prev => [...prev, { nome: '', diaSemana: '', data: '' }]);
  }

  function removeDisciplina(idx: number) {
    setDisciplinas(prev => prev.filter((_, i) => i !== idx));
  }

  function handleGerar() {
    if (Platform.OS !== 'web') return;
    if (filtrados.length === 0) return;
    setIsGenerating(true);
    const logoUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/escola-logo.png`;
    const html = buildListaAdmissaoHTML(filtrados, {
      nomeEscola,
      anoExame,
      local,
      campus,
      sala,
      hora,
      disciplinas,
      logoUrl,
      filtroClasse,
      filtroStatus,
    });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    setIsGenerating(false);
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={['#061029', '#0D1B3E']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.loadingText}>A carregar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#061029', '#0A1628', '#0D1B3E']} style={StyleSheet.absoluteFill} />

      <LinearGradient colors={['#061029', '#0A1628']} style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Lista de Admissão por Curso</Text>
            <Text style={styles.headerSub}>{filtrados.length} candidato(s) · {cursos.length} curso(s)</Text>
          </View>
          {Platform.OS === 'web' && filtrados.length > 0 && (
            <TouchableOpacity
              style={[styles.printBtn, isGenerating && { opacity: 0.6 }]}
              onPress={handleGerar}
              disabled={isGenerating}
            >
              {isGenerating
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                  <Ionicons name="print-outline" size={16} color="#fff" />
                  <Text style={styles.printBtnText}>Gerar & Imprimir</Text>
                </>
              }
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.sectionToggle}
          onPress={() => setShowConfig(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={15} color={Colors.gold} />
          <Text style={styles.sectionToggleText}>Configurações do Documento</Text>
          <Ionicons name={showConfig ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.textMuted} />
        </TouchableOpacity>

        {showConfig && (
          <View style={styles.configCard}>
            <View style={styles.configRow}>
              <View style={styles.configField}>
                <Text style={styles.configLabel}>Ano do Exame</Text>
                <TextInput style={styles.configInput} value={anoExame} onChangeText={setAnoExame} placeholderTextColor={Colors.textMuted} placeholder="2026" keyboardType="numeric" />
              </View>
              <View style={styles.configField}>
                <Text style={styles.configLabel}>Hora</Text>
                <TextInput style={styles.configInput} value={hora} onChangeText={setHora} placeholderTextColor={Colors.textMuted} placeholder="07:30:00" />
              </View>
            </View>

            <View style={styles.configRow}>
              <View style={styles.configField}>
                <Text style={styles.configLabel}>Local</Text>
                <TextInput style={styles.configInput} value={local} onChangeText={setLocal} placeholderTextColor={Colors.textMuted} placeholder="Ex: Luanda" />
              </View>
              <View style={styles.configField}>
                <Text style={styles.configLabel}>Campus / Instituto</Text>
                <TextInput style={styles.configInput} value={campus} onChangeText={setCampus} placeholderTextColor={Colors.textMuted} placeholder="Ex: Campus Principal" />
              </View>
            </View>

            <View style={[styles.configField, { marginTop: 4 }]}>
              <Text style={styles.configLabel}>Sala de Exame</Text>
              <TextInput style={styles.configInput} value={sala} onChangeText={setSala} placeholderTextColor={Colors.textMuted} placeholder="Ex: Sala A1 — Bloco 2" />
            </View>

            <View style={[styles.configField, { marginTop: 12 }]}>
              <Text style={[styles.configLabel, { marginBottom: 8 }]}>Disciplinas e Datas dos Exames</Text>
              {disciplinas.map((d, i) => (
                <View key={i} style={styles.disciplinaRow}>
                  <TextInput
                    style={[styles.configInput, { flex: 2 }]}
                    value={d.nome}
                    onChangeText={v => updateDisciplina(i, 'nome', v)}
                    placeholder={`Disciplina ${i + 1}`}
                    placeholderTextColor={Colors.textMuted}
                  />
                  <TextInput
                    style={[styles.configInput, { flex: 1 }]}
                    value={d.diaSemana}
                    onChangeText={v => updateDisciplina(i, 'diaSemana', v)}
                    placeholder="Dia"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <TextInput
                    style={[styles.configInput, { flex: 1.5 }]}
                    value={d.data}
                    onChangeText={v => updateDisciplina(i, 'data', v)}
                    placeholder="Ex: 07 Mar 2026"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <TouchableOpacity onPress={() => removeDisciplina(i)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addDisciplinaBtn} onPress={addDisciplina}>
                <Ionicons name="add-circle-outline" size={15} color={Colors.gold} />
                <Text style={styles.addDisciplinaTxt}>Adicionar Disciplina</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.filtersCard}>
          <Text style={styles.filtersTitle}>Filtros</Text>

          <Text style={styles.filterLabel}>Classe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, filtroClasse === 'todas' && styles.chipActive]}
                onPress={() => setFiltroClasse('todas')}
              >
                <Text style={[styles.chipText, filtroClasse === 'todas' && styles.chipTextActive]}>Todas</Text>
              </TouchableOpacity>
              {classes.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.chip, filtroClasse === cls && styles.chipActive]}
                  onPress={() => setFiltroClasse(cls)}
                >
                  <Text style={[styles.chipText, filtroClasse === cls && styles.chipTextActive]}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            {cursos.map(curso => {
              const ct = filtrados.filter(r => (r.cursoNome?.trim() || 'Geral') === curso).length;
              return (
                <View key={curso} style={styles.cursoSummary}>
                  <Text style={styles.cursoSummaryNum}>{ct}</Text>
                  <Text style={styles.cursoSummaryLabel} numberOfLines={2}>{curso}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {filtrados.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum candidato inscrito</Text>
          </View>
        ) : (
          cursos.map(curso => {
            const alunosCurso = filtrados
              .filter(r => (r.cursoNome?.trim() || 'Geral') === curso)
              .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt', { sensitivity: 'base' }));
            return (
              <View key={curso} style={styles.cursoGroup}>
                <View style={styles.cursoGroupHeader}>
                  <Ionicons name="book-outline" size={13} color={Colors.gold} />
                  <Text style={styles.cursoGroupTitle}>{curso}</Text>
                  <View style={styles.cursoGroupBadge}>
                    <Text style={styles.cursoGroupBadgeText}>{alunosCurso.length}</Text>
                  </View>
                </View>
                {alunosCurso.slice(0, 8).map((r, idx) => (
                  <View key={r.id} style={styles.regRow}>
                    <Text style={styles.regNum}>{idx + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.regNome}>{r.nomeCompleto}</Text>
                      <Text style={styles.regSub}>
                        {r.classe}{r.cursoNome ? ` · ${r.cursoNome}` : ''} · {r.genero || '—'}
                      </Text>
                    </View>
                    <Text style={styles.regCand}>
                      {r.rupeInscricao?.split('-')[3] || '—'}
                    </Text>
                  </View>
                ))}
                {alunosCurso.length > 8 && (
                  <Text style={styles.moreText}>
                    + {alunosCurso.length - 8} candidatos adicionais na impressão
                  </Text>
                )}
              </View>
            );
          })
        )}

        {Platform.OS === 'web' && filtrados.length > 0 && (
          <TouchableOpacity
            style={[styles.gerarBtn, isGenerating && { opacity: 0.6 }]}
            onPress={handleGerar}
            disabled={isGenerating}
            activeOpacity={0.85}
          >
            {isGenerating
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                <Ionicons name="print-outline" size={20} color="#fff" />
                <Text style={styles.gerarBtnText}>
                  Gerar Lista por Curso ({filtrados.length} candidatos · {cursos.length} cursos)
                </Text>
              </>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#061029' },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A2B5F', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  printBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  loadingText: { color: Colors.textMuted, marginTop: 12, fontSize: 14 },
  scroll: { padding: 16, gap: 12 },

  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sectionToggleText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },

  configCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
  configRow: { flexDirection: 'row', gap: 10 },
  configField: { flex: 1, gap: 4 },
  configLabel: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_500Medium' },
  configInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 8, color: Colors.text, fontSize: 12 },

  disciplinaRow: { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' },
  removeBtn: { padding: 4 },
  addDisciplinaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addDisciplinaTxt: { fontSize: 12, color: Colors.gold },

  filtersCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filtersTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  filterLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '60' },
  chipText: { fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  summaryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-around' },
  cursoSummary: { alignItems: 'center', minWidth: 70, padding: 6 },
  cursoSummaryNum: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.gold },
  cursoSummaryLabel: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 2, maxWidth: 80 },

  cursoGroup: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cursoGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(26,43,95,0.6)', paddingHorizontal: 12, paddingVertical: 10 },
  cursoGroupTitle: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  cursoGroupBadge: { backgroundColor: Colors.gold, borderRadius: 12, minWidth: 24, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center' },
  cursoGroupBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#000' },

  regRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  regNum: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted, width: 22, textAlign: 'center' },
  regNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  regSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  regCand: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.gold, minWidth: 44, textAlign: 'right' },

  moreText: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, fontStyle: 'italic', padding: 8 },
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },

  gerarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1A2B5F', borderRadius: 14, paddingVertical: 16, marginTop: 4 },
  gerarBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
