import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/colors';
import { useData, Aluno, Turma } from '@/context/DataContext';
import { useFinanceiro, formatAOA, Pagamento } from '@/context/FinanceiroContext';
import { useConfig } from '@/context/ConfigContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import TopBar from '@/components/TopBar';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<number, string> = {
  1: 'JANEIRO', 2: 'FEVEREIRO', 3: 'MARÇO', 4: 'ABRIL',
  5: 'MAIO', 6: 'JUNHO', 7: 'JULHO', 8: 'AGOSTO',
  9: 'SETEMBRO', 10: 'OUTUBRO', 11: 'NOVEMBRO', 12: 'DEZEMBRO',
};

const DEFAULT_MESES_LETIVOS = [
  { num: 9,  nome: 'SETEMBRO' },
  { num: 10, nome: 'OUTUBRO' },
  { num: 11, nome: 'NOVEMBRO' },
  { num: 12, nome: 'DEZEMBRO' },
  { num: 1,  nome: 'JANEIRO' },
  { num: 2,  nome: 'FEVEREIRO' },
  { num: 3,  nome: 'MARÇO' },
  { num: 4,  nome: 'ABRIL' },
  { num: 5,  nome: 'MAIO' },
  { num: 6,  nome: 'JUNHO' },
  { num: 7,  nome: 'JULHO' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatDate(iso: string): string {
  if (!iso) return '__/__/____';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return iso; }
}

function getMesAtualPago(pagamentos: Pagamento[]): boolean {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = String(new Date().getFullYear());
  return pagamentos.some(p =>
    p.mes === mesAtual && p.ano === anoAtual && p.status === 'pago'
  );
}

function getStatusMes(mes: number, anoLetivo: string, pagamentos: Pagamento[]): 'pago' | 'pendente' | 'atraso' | 'futuro' {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  // Mapear o mês lectivo para o ano correcto
  // Set-Dez = primeiro ano do anoLetivo (ex: 2025 de "2025/26")
  // Jan-Jul = segundo ano (ex: 2026 de "2025/26")
  const anoBase = parseInt(anoLetivo.split('/')[0]) || anoAtual;
  const anoMes = mes >= 8 ? anoBase : anoBase + 1;
  const anoStr = String(anoMes);

  const pag = pagamentos.find(p => p.mes === mes && p.ano === anoStr && p.status !== 'cancelado');

  if (pag?.status === 'pago') return 'pago';
  if (pag?.status === 'pendente') return 'pendente';

  // Verificar se já passou
  const dataReferencia = new Date(anoMes, mes - 1, 1);
  const dataAtual = new Date(anoAtual, mesAtual - 1, 1);
  if (dataReferencia < dataAtual) return 'atraso';
  if (dataReferencia.getTime() === dataAtual.getTime()) return 'pendente';
  return 'futuro';
}

function getPagamento(mes: number, anoLetivo: string, pagamentos: Pagamento[]): Pagamento | undefined {
  const anoBase = parseInt(anoLetivo.split('/')[0]) || new Date().getFullYear();
  const anoMes = mes >= 8 ? anoBase : anoBase + 1;
  return pagamentos.find(p => p.mes === mes && p.ano === String(anoMes) && p.status !== 'cancelado');
}

// ─── QR Data ─────────────────────────────────────────────────────────────────

function buildQRData(aluno: Aluno, turma: Turma | undefined, nomeEscola: string, mesAtualPago: boolean): string {
  const mesAtual = new Date().getMonth() + 1;
  const mesesNomes = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return JSON.stringify({
    mat: aluno.numeroMatricula,
    nome: `${aluno.nome} ${aluno.apelido}`,
    turma: turma?.nome ?? '',
    classe: turma?.classe ?? '',
    anoLetivo: turma?.anoLetivo ?? '',
    escola: nomeEscola,
    mesAtual: mesesNomes[mesAtual],
    mesAtualPago,
    verificadoEm: today(),
  });
}

// ─── HTML Generator (Caderneta Completa) ─────────────────────────────────────

function generateCadernetaHTML(
  aluno: Aluno,
  turma: Turma | undefined,
  nomeEscola: string,
  pagamentos: Pagamento[],
  anoLetivo: string,
  qrDataUrl: string,
  numeroCaderneta: string,
  mesesLetivos: Array<{ num: number; nome: string }> = DEFAULT_MESES_LETIVOS,
): string {
  const nomeCompleto = `${aluno.nome} ${aluno.apelido}`;
  const classe = turma?.classe ?? '—';
  const turmaNome = turma?.nome ?? '—';
  const turno = turma?.turno ?? '—';
  const sala = turma?.sala ?? '—';

  function renderMesHTML(mes: { num: number; nome: string }): string {
    const pag = getPagamento(mes.num, anoLetivo, pagamentos);
    const status = getStatusMes(mes.num, anoLetivo, pagamentos);
    const bgColor = status === 'pago' ? '#e8f5e9' : status === 'atraso' ? '#fff3e0' : '#fff';
    const borderColor = status === 'pago' ? '#4CAF50' : status === 'atraso' ? '#FF9800' : '#999';
    const dataStr = pag?.data ? formatDate(pag.data) : '__/__/____';

    return `
      <div class="mes-cell" style="background:${bgColor};border:1.5px solid ${borderColor};">
        <div class="mes-nome">${mes.nome}${status === 'pago' ? ' ✓' : status === 'atraso' ? ' !' : ''}</div>
        <div class="mes-field">Pago aos: <span class="mes-val">${status === 'pago' ? dataStr : '___/___/______'}</span></div>
        <div class="mes-field">Valor: <span class="mes-val">${pag ? formatAOA(pag.valor) : '____________'}</span></div>
        <div class="mes-field">O responsável: <span class="mes-val">${status === 'pago' ? (pag?.metodoPagamento ?? '___') : '_____________'}</span></div>
      </div>`;
  }

  // Organizar em grupos de 4 colunas
  const rows: Array<typeof mesesLetivos> = [];
  for (let i = 0; i < mesesLetivos.length; i += 4) {
    rows.push(mesesLetivos.slice(i, i + 4));
  }

  const mesesHTML = rows.map(row => `
    <div class="mes-row">
      ${row.map(m => renderMesHTML(m)).join('')}
      ${row.length < 4 ? '<div class="mes-cell empty"></div>'.repeat(4 - row.length) : ''}
    </div>
  `).join('');

  const mesAtualPago = getMesAtualPago(pagamentos);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Caderneta de Propinas — ${nomeCompleto}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  @page { size: A5 landscape; margin: 8mm 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; background: #fff; }
  .page { width: 100%; }
  .header-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 4px; }
  .header-text { flex: 1; text-align: center; }
  .header-text p { font-size: 8.5pt; line-height: 1.45; }
  .escola-nome { font-size: 12pt; font-weight: bold; color: #C0392B; margin: 3px 0; }
  .caderneta-title { font-size: 10pt; font-weight: bold; margin: 3px 0; }
  .qr-box { width: 80px; height: 80px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .qr-box img { width: 100%; height: 100%; object-fit: contain; }
  .qr-status { font-size: 6pt; text-align: center; margin-top: 2px; padding: 2px; border-radius: 3px; }
  .qr-pago { background: #e8f5e9; color: #2e7d32; font-weight: bold; }
  .qr-atraso { background: #fff3e0; color: #e65100; font-weight: bold; }
  .info-line { display: flex; gap: 16px; margin: 4px 0; font-size: 9pt; flex-wrap: wrap; }
  .info-item { display: flex; align-items: baseline; gap: 4px; }
  .info-item .val { border-bottom: 1px solid #000; min-width: 80px; padding-bottom: 1px; }
  .separator { border-top: 1.5px solid #000; margin: 5px 0; }
  .mes-row { display: flex; gap: 4px; margin-bottom: 4px; }
  .mes-cell {
    flex: 1; padding: 4px 5px; border-radius: 3px;
    border: 1px solid #999; min-height: 60px;
  }
  .mes-cell.empty { border: none; background: transparent; }
  .mes-nome { font-weight: bold; font-size: 8.5pt; text-align: center; margin-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.15); padding-bottom: 2px; }
  .mes-field { font-size: 7.5pt; margin-top: 2px; }
  .mes-val { font-size: 7.5pt; border-bottom: 1px dotted #999; display: inline-block; min-width: 50px; }
  .footer-line { margin-top: 6px; font-size: 8.5pt; }
  .footer-line .field-line { display: flex; align-items: baseline; gap: 4px; margin-bottom: 3px; }
  .footer-line .val { border-bottom: 1px solid #000; flex: 1; min-width: 100px; }
  .obs { font-size: 8pt; line-height: 1.5; margin-top: 4px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header-row">
    <div style="width:40px;flex-shrink:0;"></div>
    <div class="header-text">
      <p>REPÚBLICA DE ANGOLA</p>
      <p>GOVERNO DA PROVÍNCIA · REPARTIÇÃO MUNICIPAL DE EDUCAÇÃO</p>
      <p class="escola-nome">${nomeEscola.toUpperCase()}</p>
      <p class="caderneta-title">CADERNETA DE PROPINAS N.º <span style="border-bottom:1px solid #000;padding:0 20px;">${numeroCaderneta}</span> / 20<span style="border-bottom:1px solid #000;padding:0 10px;"></span></p>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
      <div class="qr-box">
        <img src="${qrDataUrl}" alt="QR" />
      </div>
      <div class="qr-status ${mesAtualPago ? 'qr-pago' : 'qr-atraso'}">
        ${mesAtualPago ? '✓ MÊS ACTUAL PAGO' : '⚠ MÊS ACTUAL EM ATRASO'}
      </div>
    </div>
  </div>

  <div class="info-line">
    <div class="info-item"><span>Nome:</span><span class="val">${nomeCompleto}</span></div>
    <div class="info-item"><span>Nº Matrícula:</span><span class="val">${aluno.numeroMatricula}</span></div>
  </div>
  <div class="info-line">
    <div class="info-item"><span>Classe:</span><span class="val">${classe}ª</span></div>
    <div class="info-item"><span>Período/Turno:</span><span class="val">${turno}</span></div>
    <div class="info-item"><span>Turma:</span><span class="val">${turmaNome}</span></div>
    <div class="info-item"><span>Sala Nº:</span><span class="val">${sala}</span></div>
    <div class="info-item"><span>Ano Lectivo:</span><span class="val">${anoLetivo}</span></div>
  </div>

  <div class="separator"></div>

  ${mesesHTML}

  <div class="separator"></div>

  <div class="footer-line">
    <div class="field-line">
      <span>O encarregado de educação:</span>
      <span class="val">${aluno.nomeEncarregado}</span>
      <span>&nbsp;&nbsp;TLF.:</span>
      <span class="val">${aluno.telefoneEncarregado}</span>
    </div>
    <div class="obs">
      <b>OBS:</b> Conserve esta caderneta e apresente-a sempre no acto do pagamento.<br/>
      <b>N.B.</b> As propinas são pagas de 1 a 30 de cada mês, móvel: <span style="border-bottom:1px solid #000;display:inline-block;min-width:80px;"></span><br/>
      DT: <span style="border-bottom:1px solid #000;display:inline-block;min-width:30px;"></span>/<span style="border-bottom:1px solid #000;display:inline-block;min-width:30px;"></span>/<span style="border-bottom:1px solid #000;display:inline-block;min-width:40px;"></span>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pago:     { color: Colors.success, bg: Colors.success + '22', icon: 'checkmark-circle', label: 'Pago' },
  pendente: { color: Colors.warning, bg: Colors.warning + '22', icon: 'time',             label: 'Pendente' },
  atraso:   { color: Colors.danger,  bg: Colors.danger  + '22', icon: 'alert-circle',     label: 'Em Atraso' },
  futuro:   { color: Colors.textMuted, bg: Colors.border,       icon: 'ellipse-outline',  label: 'Futuro' },
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function BoletimPropinaScreen() {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;

  const { alunos, turmas } = useData();
  const { pagamentos, getPagamentosAluno } = useFinanceiro();
  const { config } = useConfig();
  const { anoSelecionado } = useAnoAcademico();

  const anoLetivo = anoSelecionado?.ano ?? String(new Date().getFullYear());

  const mesesLetivos = useMemo(() => {
    const nums = config.mesesAnoAcademico;
    if (nums && nums.length > 0) {
      return nums.map(n => ({ num: n, nome: MONTH_NAMES[n] || String(n) }));
    }
    return DEFAULT_MESES_LETIVOS;
  }, [config.mesesAnoAcademico]);

  const [search, setSearch] = useState('');
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [showSearch, setShowSearch] = useState(true);
  const [printing, setPrinting] = useState(false);

  const qrSvgRef = useRef<any>(null);

  const alunosFiltrados = useMemo(() => {
    if (!search.trim()) return alunos.filter(a => a.ativo).slice(0, 30);
    const s = search.toLowerCase();
    return alunos.filter(a =>
      a.ativo && (
        a.nome.toLowerCase().includes(s) ||
        a.apelido.toLowerCase().includes(s) ||
        a.numeroMatricula.toLowerCase().includes(s)
      )
    ).slice(0, 30);
  }, [alunos, search]);

  const turmaDoAluno = useMemo(() =>
    selectedAluno ? turmas.find(t => t.id === selectedAluno.turmaId) : undefined,
    [selectedAluno, turmas]
  );

  const pagamentosAluno = useMemo(() =>
    selectedAluno ? getPagamentosAluno(selectedAluno.id) : [],
    [selectedAluno, pagamentos]
  );

  const mesAtualPago = useMemo(() =>
    getMesAtualPago(pagamentosAluno),
    [pagamentosAluno]
  );

  const numeroCaderneta = selectedAluno
    ? `${selectedAluno.numeroMatricula.replace(/\D/g,'').slice(-4).padStart(4,'0')}`
    : '0000';

  const qrValue = selectedAluno
    ? buildQRData(selectedAluno, turmaDoAluno, config.nomeEscola, mesAtualPago)
    : 'SIGA-PROPINAS';

  // Stats
  const totalPago = pagamentosAluno.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
  const totalPendente = pagamentosAluno.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
  const mesesPagos = mesesLetivos.filter(m => getStatusMes(m.num, anoLetivo, pagamentosAluno) === 'pago').length;
  const mesesAtraso = mesesLetivos.filter(m => getStatusMes(m.num, anoLetivo, pagamentosAluno) === 'atraso').length;

  function handleSelectAluno(aluno: Aluno) {
    setSelectedAluno(aluno);
    setShowSearch(false);
    setSearch(`${aluno.nome} ${aluno.apelido}`);
  }

  function handlePrint() {
    if (!selectedAluno || Platform.OS !== 'web') return;
    setPrinting(true);

    const doGenerate = (dataUrl: string) => {
      const html = generateCadernetaHTML(
        selectedAluno, turmaDoAluno, config.nomeEscola,
        pagamentosAluno, anoLetivo, dataUrl, numeroCaderneta, mesesLetivos
      );
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 600);
      }
      setPrinting(false);
    };

    if (qrSvgRef.current?.toDataURL) {
      qrSvgRef.current.toDataURL((url: string) => doGenerate(url));
    } else {
      doGenerate('');
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <TopBar title="Caderneta de Propinas" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Pesquisa de Aluno ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="search" size={18} color={Colors.accent} />
            <Text style={styles.cardTitle}>Seleccionar Aluno</Text>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar por nome ou nº de matrícula..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={v => { setSearch(v); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
            />
            {selectedAluno && (
              <TouchableOpacity onPress={() => { setSelectedAluno(null); setSearch(''); setShowSearch(true); }}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {showSearch && search.length > 0 && (
            <View style={styles.dropdownContainer}>
              <FlatList
                data={alunosFiltrados}
                keyExtractor={a => a.id}
                style={styles.dropdown}
                renderItem={({ item }) => {
                  const t = turmas.find(t => t.id === item.turmaId);
                  return (
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectAluno(item)}>
                      <View style={styles.dropdownIcon}>
                        <Ionicons name="person" size={14} color={Colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dropdownName}>{item.nome} {item.apelido}</Text>
                        <Text style={styles.dropdownSub}>{item.numeroMatricula} · {t?.nome ?? '—'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={styles.emptyDropdown}>Nenhum aluno encontrado</Text>}
              />
            </View>
          )}
        </View>

        {selectedAluno ? (
          <>
            {/* ── Botão de impressão ── */}
            <TouchableOpacity
              style={[styles.printBtn, printing && styles.printBtnDisabled]}
              onPress={handlePrint}
              disabled={printing}
            >
              {printing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="print" size={18} color="#fff" />
              }
              <Text style={styles.printBtnText}>
                {printing ? 'A preparar...' : 'Imprimir Caderneta / Exportar PDF'}
              </Text>
            </TouchableOpacity>

            {/* ── Cabeçalho do Aluno + QR ── */}
            <View style={styles.card}>
              <View style={styles.alunoHeaderRow}>
                <View style={styles.alunoHeaderInfo}>
                  <Text style={styles.alunoNome}>{selectedAluno.nome} {selectedAluno.apelido}</Text>
                  <Text style={styles.alunoMeta}>Matrícula: {selectedAluno.numeroMatricula}</Text>
                  <Text style={styles.alunoMeta}>Turma: {turmaDoAluno?.nome ?? '—'} · {turmaDoAluno?.classe ?? '—'}ª Classe</Text>
                  <Text style={styles.alunoMeta}>Turno: {turmaDoAluno?.turno ?? '—'} · Sala: {turmaDoAluno?.sala ?? '—'}</Text>
                  <Text style={styles.alunoMeta}>Ano Lectivo: {anoLetivo}</Text>
                </View>
                {/* QR Code com status do mês actual */}
                <View style={styles.qrWrapper}>
                  <View style={[styles.qrBox, { borderColor: mesAtualPago ? Colors.success : Colors.danger }]}>
                    <QRCode
                      value={qrValue}
                      size={80}
                      getRef={(ref: any) => { qrSvgRef.current = ref; }}
                      backgroundColor="#fff"
                      color="#000"
                    />
                  </View>
                  <View style={[styles.qrBadge, { backgroundColor: mesAtualPago ? Colors.success + '22' : Colors.danger + '22', borderColor: mesAtualPago ? Colors.success : Colors.danger }]}>
                    <Ionicons name={mesAtualPago ? 'checkmark-circle' : 'alert-circle'} size={12} color={mesAtualPago ? Colors.success : Colors.danger} />
                    <Text style={[styles.qrBadgeText, { color: mesAtualPago ? Colors.success : Colors.danger }]}>
                      {mesAtualPago ? 'MÊS PAGO' : 'EM ATRASO'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Resumo ── */}
            <View style={styles.statsRow}>
              <StatCard value={`${mesesPagos}/11`} label="Meses Pagos" color={Colors.success} icon="checkmark-circle" />
              <StatCard value={String(mesesAtraso)} label="Em Atraso" color={Colors.danger} icon="alert-circle" />
              <StatCard value={formatAOA(totalPago)} label="Total Pago" color={Colors.info} icon="cash" />
              <StatCard value={formatAOA(totalPendente)} label="Pendente" color={Colors.warning} icon="time" />
            </View>

            {/* ── Caderneta — Grelha de Meses ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar" size={18} color={Colors.gold} />
                <Text style={styles.cardTitle}>Caderneta de Propinas — {anoLetivo}</Text>
              </View>

              <View style={styles.mesesGrid}>
                {mesesLetivos.map(mes => {
                  const status = getStatusMes(mes.num, anoLetivo, pagamentosAluno);
                  const pag = getPagamento(mes.num, anoLetivo, pagamentosAluno);
                  const cfg = STATUS_CFG[status];
                  const isMesAtual = new Date().getMonth() + 1 === mes.num;

                  return (
                    <View
                      key={mes.num}
                      style={[
                        styles.mesCard,
                        { borderColor: cfg.color, backgroundColor: cfg.bg },
                        isMesAtual && styles.mesCardAtual,
                      ]}
                    >
                      <View style={styles.mesHeader}>
                        <Text style={[styles.mesNome, { color: cfg.color }]}>{mes.nome}</Text>
                        <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                      </View>
                      {isMesAtual && (
                        <Text style={styles.mesActualBadge}>MÊS ACTUAL</Text>
                      )}
                      <Text style={[styles.mesStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      {pag ? (
                        <>
                          <Text style={styles.mesInfo}>{formatDate(pag.data)}</Text>
                          <Text style={styles.mesValor}>{formatAOA(pag.valor)}</Text>
                          <Text style={styles.mesMetodo}>{pag.metodoPagamento}</Text>
                        </>
                      ) : (
                        <Text style={styles.mesPendente}>
                          {status === 'futuro' ? 'Ainda não venceu' : 'Sem pagamento'}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Legenda */}
              <View style={styles.legenda}>
                {Object.entries(STATUS_CFG).map(([k, v]) => (
                  <View key={k} style={styles.legendaItem}>
                    <Ionicons name={v.icon as any} size={12} color={v.color} />
                    <Text style={[styles.legendaText, { color: v.color }]}>{v.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Tabela de Variáveis ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle" size={18} color={Colors.info} />
                <Text style={styles.cardTitle}>Dados preenchidos automaticamente</Text>
              </View>
              <View style={styles.varGrid}>
                {[
                  { label: 'Nº Matrícula', value: selectedAluno.numeroMatricula },
                  { label: 'Nome Completo', value: `${selectedAluno.nome} ${selectedAluno.apelido}` },
                  { label: 'Turma', value: turmaDoAluno?.nome ?? '—' },
                  { label: 'Classe', value: turmaDoAluno?.classe ? `${turmaDoAluno.classe}ª` : '—' },
                  { label: 'Turno / Período', value: turmaDoAluno?.turno ?? '—' },
                  { label: 'Sala', value: turmaDoAluno?.sala ?? '—' },
                  { label: 'Ano Lectivo', value: anoLetivo },
                  { label: 'Encarregado', value: selectedAluno.nomeEncarregado },
                  { label: 'Telefone Enc.', value: selectedAluno.telefoneEncarregado },
                  { label: 'Escola', value: config.nomeEscola },
                  { label: 'QR — Mês actual pago?', value: mesAtualPago ? 'SIM ✓' : 'NÃO ✗' },
                  { label: 'Meses pagos', value: `${mesesPagos} de 11` },
                  { label: 'Meses em atraso', value: String(mesesAtraso) },
                  { label: 'Total recebido', value: formatAOA(totalPago) },
                ].map(v => (
                  <View key={v.label} style={styles.varRow}>
                    <Text style={styles.varLabel}>{v.label}</Text>
                    <Text style={styles.varValue}>{v.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Encarregado */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="people" size={18} color={Colors.gold} />
                <Text style={styles.cardTitle}>Encarregado de Educação</Text>
              </View>
              <View style={styles.varRow}>
                <Text style={styles.varLabel}>Nome</Text>
                <Text style={styles.varValue}>{selectedAluno.nomeEncarregado}</Text>
              </View>
              <View style={styles.varRow}>
                <Text style={styles.varLabel}>Telefone</Text>
                <Text style={styles.varValue}>{selectedAluno.telefoneEncarregado}</Text>
              </View>
              <Text style={styles.obsText}>
                OBS: Conserve esta caderneta e apresente-a sempre no acto do pagamento.{'\n'}
                N.B. As propinas são pagas de 1 a 30 de cada mês.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum aluno seleccionado</Text>
            <Text style={styles.emptyText}>
              Pesquise e seleccione um aluno para gerar a Caderneta de Propinas.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ value, label, color, icon }: { value: string; label: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { color: Colors.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1, color: Colors.text, fontSize: 14,
    fontFamily: 'Inter_400Regular', paddingVertical: 10,
  },
  dropdownContainer: {
    marginTop: 4, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, overflow: 'hidden', maxHeight: 220,
    backgroundColor: Colors.backgroundElevated,
  },
  dropdown: { flex: 1 },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10,
  },
  dropdownIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.accent + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownName: { color: Colors.text, fontSize: 13, fontFamily: 'Inter_500Medium' },
  dropdownSub: { color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' },
  emptyDropdown: { color: Colors.textMuted, fontSize: 13, padding: 14, textAlign: 'center' },

  printBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.success, borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 20,
  },
  printBtnDisabled: { opacity: 0.6 },
  printBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  alunoHeaderRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  alunoHeaderInfo: { flex: 1 },
  alunoNome: { color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  alunoMeta: { color: Colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  qrWrapper: { alignItems: 'center', gap: 6 },
  qrBox: { borderWidth: 2, borderRadius: 6, padding: 3, backgroundColor: '#fff' },
  qrBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  qrBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold' },

  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 100, backgroundColor: Colors.surface,
    borderRadius: 10, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, gap: 4,
  },
  statValue: { fontSize: 13, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  mesesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mesCard: {
    width: '30%', flexGrow: 1, borderRadius: 8, borderWidth: 1.5,
    padding: 8, minWidth: 90,
  },
  mesCardAtual: {
    borderWidth: 2.5,
    shadowColor: Colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  mesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  mesNome: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  mesActualBadge: {
    fontSize: 8, fontFamily: 'Inter_600SemiBold',
    color: Colors.gold, marginBottom: 2,
  },
  mesStatus: { fontSize: 10, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  mesInfo: { color: Colors.textSecondary, fontSize: 10, fontFamily: 'Inter_400Regular' },
  mesValor: { color: Colors.text, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  mesMetodo: { color: Colors.textMuted, fontSize: 9, fontFamily: 'Inter_400Regular', textTransform: 'capitalize' },
  mesPendente: { color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },

  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, justifyContent: 'center' },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  varGrid: { gap: 4 },
  varRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8,
  },
  varLabel: { color: Colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', width: 140 },
  varValue: { color: Colors.text, fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 },

  obsText: {
    color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular',
    lineHeight: 18, marginTop: 10, fontStyle: 'italic',
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyText: {
    color: Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular',
    textAlign: 'center', maxWidth: 280, lineHeight: 20,
  },
});
