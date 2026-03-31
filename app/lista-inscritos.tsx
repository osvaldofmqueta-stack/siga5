import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator,
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
  nomeEncarregado: string;
  telefoneEncarregado: string;
}

function hoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function anoAtual(): string { return String(new Date().getFullYear()); }

function calcAge(dataNasc: string): number {
  if (!dataNasc) return 0;
  const now = new Date();
  const birth = new Date(dataNasc);
  if (isNaN(birth.getTime())) return 0;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function buildTabelaGrupoInscritos(
  alunos: Registro[],
  titulo: string,
  startNum: number,
  masc: number,
  fem: number,
): string {
  const rows = alunos.map((a, idx) => {
    const age = calcAge(a.dataNascimento);
    const bg = idx % 2 === 0 ? '#fff' : '#f0faff';
    return `<tr style="background:${bg}">
      <td class="num">${startNum + idx}</td>
      <td class="nome">${a.nomeCompleto.toUpperCase()}</td>
      <td class="centro">${a.genero || '—'}</td>
      <td class="centro">${age > 0 ? age : '—'}</td>
      <td class="centro">${a.provincia || '—'}</td>
      <td class="centro">${a.telefone || '—'}</td>
      <td class="centro">${a.nomeEncarregado || '—'}</td>
    </tr>`;
  }).join('');

  const total = alunos.length;

  return `
    <div class="grupo-header">${titulo} — ${total} inscrito(s) · M: ${masc} · F: ${fem}</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;">Nº</th>
          <th>Nome do Estudante</th>
          <th style="width:40px;">Sexo</th>
          <th style="width:40px;">Idade</th>
          <th style="width:80px;">Província</th>
          <th style="width:90px;">Telefone</th>
          <th style="width:120px;">Encarregado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="stats-row">
      <div>Total: <span>${total}</span></div>
      <div>Masculino: <span>${masc}</span></div>
      <div>Feminino: <span>${fem}</span></div>
    </div>
  `;
}

function buildListaInscritosHTML(
  registros: Registro[],
  nomeEscola: string,
  filtroClasse: string,
  anoLectivo: string,
): string {
  const INSCRITOS_STATUS = ['inscrito', 'pendente', 'em_processamento', 'em processamento', 'aguardando_prova', 'aguardando prova'];
  const lista = registros
    .filter(r => INSCRITOS_STATUS.includes(r.status?.toLowerCase?.() ?? ''))
    .filter(r => filtroClasse === 'todas' || r.classe === filtroClasse)
    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));

  if (lista.length === 0) return '<p style="padding:20px;text-align:center;">Nenhum estudante inscrito encontrado com os critérios seleccionados.</p>';

  const byClasse: Record<string, Record<string, Registro[]>> = {};
  for (const r of lista) {
    if (!byClasse[r.classe]) byClasse[r.classe] = {};
    const cursoKey = r.cursoNome || 'Geral';
    if (!byClasse[r.classe][cursoKey]) byClasse[r.classe][cursoKey] = [];
    byClasse[r.classe][cursoKey].push(r);
  }

  const classesSorted = Object.keys(byClasse).sort((a, b) => a.localeCompare(b));

  const II_CICLO_NUMS = ['10', '11', '12', '13'];
  function isIICiclo(classe: string) {
    return II_CICLO_NUMS.some(n => classe.includes(`${n}ª`) || classe.includes(`${n}a`));
  }

  let tablesHtml = '';
  let globalOrder = 1;

  for (const classe of classesSorted) {
    const cursosObj = byClasse[classe];
    const cursoKeys = Object.keys(cursosObj).sort();
    const hasCourses = cursoKeys.length > 1 || (cursoKeys.length === 1 && cursoKeys[0] !== 'Geral');

    if (isIICiclo(classe) && hasCourses) {
      tablesHtml += `
        <div class="classe-header">${classe} — Distribuição por Curso / Área de Formação</div>
      `;
      for (const curso of cursoKeys) {
        const alunos = cursosObj[curso].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
        const masc = alunos.filter(a => a.genero === 'M').length;
        const fem = alunos.filter(a => a.genero === 'F').length;
        tablesHtml += buildTabelaGrupoInscritos(alunos, `${classe} — ${curso}`, globalOrder, masc, fem);
        globalOrder += alunos.length;
      }
    } else {
      const alunos = Object.values(cursosObj).flat().sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
      const masc = alunos.filter(a => a.genero === 'M').length;
      const fem = alunos.filter(a => a.genero === 'F').length;
      tablesHtml += buildTabelaGrupoInscritos(alunos, classe, globalOrder, masc, fem);
      globalOrder += alunos.length;
    }
  }

  const totalGeral = lista.length;
  const totalMasc = lista.filter(r => r.genero === 'M').length;
  const totalFem = lista.filter(r => r.genero === 'F').length;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Lista de Estudantes Inscritos — ${nomeEscola}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 15mm 18mm; }
  .doc-header { text-align: center; margin-bottom: 14px; }
  .doc-header p { font-size: 11px; line-height: 1.6; }
  .doc-header .escola { font-size: 12px; font-weight: bold; text-transform: uppercase; }
  .doc-title { font-size: 14px; font-weight: bold; text-transform: uppercase; text-decoration: underline; letter-spacing: 1px; margin: 10px 0 4px; }
  .doc-meta { font-size: 10px; color: #333; margin-bottom: 14px; }
  .aviso { background: #fff8e1; border: 1px solid #f59e0b; border-radius: 4px; padding: 6px 10px; font-size: 10px; color: #78350f; margin-bottom: 14px; text-align: center; font-style: italic; }
  .classe-header { background: #1A2B5F; color: #fff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 5px 8px; margin: 16px 0 4px; letter-spacing: 0.5px; }
  .grupo-header { background: #0369a1; color: #fff; font-weight: bold; font-size: 10px; padding: 4px 8px; margin: 10px 0 3px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 6px; font-size: 10px; }
  th { background: #00BCD4; color: #fff; font-weight: bold; border: 1px solid #000; padding: 4px 6px; text-align: center; }
  td { border: 1px solid #000; padding: 3px 5px; }
  tr:nth-child(even) { background: #f0faff; }
  .num { text-align: center; font-weight: bold; width: 30px; }
  .nome { text-align: left; padding-left: 6px; }
  .centro { text-align: center; }
  .stats-row { display: flex; gap: 16px; font-size: 10px; padding: 4px 0; border-top: 1px solid #ccc; margin-bottom: 12px; flex-wrap: wrap; }
  .stats-row span { font-weight: bold; }
  .total-box { background: #e8f5e9; border: 1px solid #ccc; border-radius: 4px; padding: 8px 12px; margin-top: 16px; display: flex; gap: 20px; font-size: 11px; flex-wrap: wrap; }
  .total-box b { font-size: 12px; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 28px; font-size: 10px; }
  .sig-block { text-align: center; }
  .sig-line { width: 160px; border-top: 1px solid #000; margin: 30px auto 4px; }
  .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 6px; display: flex; justify-content: space-between; font-size: 8px; color: #555; }
  .print-btn { position: fixed; bottom: 18px; right: 18px; background: #1A2B5F; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 999; }
  @media print { .print-btn { display: none !important; } @page { size: A4 portrait; margin: 12mm; } body { padding: 0; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir / PDF</button>
  <div class="doc-header">
    <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/angola-brasao.png" style="width:62px;height:auto;display:block;margin:0 auto 4px;" alt="Insígnia da República de Angola" onerror="this.style.display='none'" />
    <p>REPÚBLICA DE ANGOLA</p>
    <p>MINISTÉRIO DA EDUCAÇÃO</p>
    <p>ENSINO GERAL</p>
    <p class="escola">${nomeEscola}</p>
    <p class="doc-title">Lista de Estudantes Inscritos — Processo de Admissão ${anoLectivo}</p>
    <p class="doc-meta">Ano Lectivo: ${anoLectivo} &nbsp;|&nbsp; Emitido em: ${hoje()} &nbsp;|&nbsp; Total de Inscritos: ${totalGeral}</p>
  </div>

  <div class="aviso">Documento emitido antes do lançamento dos resultados — lista de candidatos inscritos ainda sem classificação final.</div>

  ${tablesHtml}

  <div class="total-box">
    <div>Total de Inscritos: <b>${totalGeral}</b></div>
    <div>Masculino: <b>${totalMasc}</b></div>
    <div>Feminino: <b>${totalFem}</b></div>
  </div>

  <div class="sig-row">
    <div class="sig-block"><div class="sig-line"></div><div>O Secretário(a)</div></div>
    <div class="sig-block"><div class="sig-line"></div><div>O Director(a)</div></div>
  </div>

  <div class="footer">
    <span>${nomeEscola} — Sistema SIGA v3</span>
    <span>Emitido em: ${hoje()}</span>
  </div>
</body>
</html>`;
}

export default function ListaInscritosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [nomeEscola, setNomeEscola] = useState('ESCOLA — SIGA');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [filtroClasse, setFiltroClasse] = useState('todas');

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;

  const anoLectivo = anoAtual();

  const INSCRITOS_STATUS = ['inscrito', 'pendente', 'em_processamento', 'em processamento', 'aguardando_prova', 'aguardando prova'];

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
      }
    } catch {}
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inscritos = registros.filter(r => INSCRITOS_STATUS.includes(r.status?.toLowerCase?.() ?? ''));

  const classes = Array.from(new Set(inscritos.map(r => r.classe))).sort((a, b) => a.localeCompare(b));

  const filtrados = inscritos.filter(r => filtroClasse === 'todas' || r.classe === filtroClasse);

  function handleGerar() {
    if (Platform.OS !== 'web') return;
    setIsGenerating(true);
    const html = buildListaInscritosHTML(registros, nomeEscola, filtroClasse, anoLectivo);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.print(); }, 600);
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
            <Text style={styles.headerTitle}>Lista de Estudantes Inscritos</Text>
            <Text style={styles.headerSub}>{filtrados.length} inscrito(s) · antes do lançamento das notas</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.gold} />
          <Text style={styles.infoText}>
            Esta lista inclui todos os candidatos inscritos no processo de admissão ainda sem resultado atribuído.
          </Text>
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.filtersTitle}>Filtros</Text>

          <Text style={styles.filterLabel}>Classe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, filtroClasse === 'todas' && styles.chipActive]}
                onPress={() => setFiltroClasse('todas')}
              >
                <Text style={[styles.chipText, filtroClasse === 'todas' && styles.chipTextActive]}>
                  Todas as Classes
                </Text>
              </TouchableOpacity>
              {classes.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.chip, filtroClasse === cls && styles.chipActive]}
                  onPress={() => setFiltroClasse(cls)}
                >
                  <Text style={[styles.chipText, filtroClasse === cls && styles.chipTextActive]}>
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{filtrados.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: Colors.info }]}>
                {filtrados.filter(r => r.genero === 'M').length}
              </Text>
              <Text style={styles.summaryLabel}>Masculino</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: '#ec4899' }]}>
                {filtrados.filter(r => r.genero === 'F').length}
              </Text>
              <Text style={styles.summaryLabel}>Feminino</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: Colors.warning }]}>
                {classes.length}
              </Text>
              <Text style={styles.summaryLabel}>Classes</Text>
            </View>
          </View>
        </View>

        {filtrados.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum estudante inscrito com estes filtros</Text>
            <Text style={styles.emptySubText}>Candidatos com resultado já atribuído não aparecem aqui</Text>
          </View>
        ) : (
          filtrados.slice(0, 20).map((r) => (
            <View key={r.id} style={styles.regRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.regNome}>{r.nomeCompleto}</Text>
                <Text style={styles.regSub}>
                  {r.classe}{r.cursoNome ? ` · ${r.cursoNome}` : ''} · {r.genero}
                  {r.provincia ? ` · ${r.provincia}` : ''}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>INSCRITO</Text>
              </View>
            </View>
          ))
        )}

        {filtrados.length > 20 && (
          <Text style={styles.moreText}>
            + {filtrados.length - 20} estudantes adicionais serão incluídos na impressão
          </Text>
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
                  Gerar Lista para Impressão ({filtrados.length} inscritos)
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
  loadingText: { color: Colors.textMuted, marginTop: 12, fontSize: 14 },
  scroll: { padding: 16, gap: 14 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.gold + '15', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.gold + '40' },
  infoText: { fontSize: 12, color: Colors.gold, flex: 1, lineHeight: 17 },
  filtersCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filtersTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  filterLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 6, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '60' },
  chipText: { fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  summaryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryNum: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text },
  summaryLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  regRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  regNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  regSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: Colors.info + '25' },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: Colors.info },
  moreText: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  emptyWrap: { alignItems: 'center', gap: 6, paddingVertical: 32 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  emptySubText: { color: Colors.textMuted, fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  gerarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A2B5F', borderRadius: 12, paddingVertical: 16, marginTop: 8 },
  gerarBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
