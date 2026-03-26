// ─── Extrato de Propinas — HTML Print Builder ─────────────────────────────────
// Gera HTML A4 pronto para impressão com código QR e de barras.
// Usado por: extrato-propinas.tsx e editor-documentos.tsx

export interface ExtratoHtmlData {
  aluno: {
    nome: string;
    apelido: string;
    numeroMatricula: string;
    turmaNome?: string | null;
    cursoNome?: string | null;
    nomeEncarregado?: string;
  };
  pagamentos: Array<{
    id: string;
    data: string;
    valor: number;
    status: string;
    metodoPagamento: string;
    referencia?: string | null;
    observacao?: string | null;
    taxaDescricao?: string;
    taxaTipo?: string;
    mes?: number | null;
    ano?: string;
  }>;
  resumo: {
    totalPago: number;
    totalPendente: number;
    totalCancelado: number;
    total: number;
  };
  filtros: { dataInicio: string | null; dataFim: string | null };
}

export interface ExtratoHtmlConfig {
  nomeEscola?: string;
  directorGeral?: string;
  chefeSecretaria?: string;
  emitidoPor?: string;
}

function fmtAOA(v: number) {
  return `${v.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}

function fmtDate(d: string) {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

const MESES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONG  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const METODO_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', transferencia: 'Transferência', multicaixa: 'Multicaixa Express',
};

const TIPO_LABEL: Record<string, string> = {
  propina: 'Propina', matricula: 'Matrícula', material: 'Material', exame: 'Exame', multa: 'Multa', outro: 'Outro',
};

function mesLabel(mes?: number | null) {
  if (!mes) return '';
  return MESES_SHORT[(mes - 1) % 12] || '';
}

function docRef(matricula: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const m = (matricula || 'X').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
  return `EXTR-${m}-${ts}`;
}

export function buildExtratoProfinasHtml(data: ExtratoHtmlData, cfg: ExtratoHtmlConfig = {}): string {
  const { aluno, pagamentos, resumo, filtros } = data;
  const escola     = cfg.nomeEscola    || 'Escola Secundária';
  const director   = cfg.directorGeral || '___________________________';
  const chefeSec   = cfg.chefeSecretaria || '___________________________';
  const emitidoPor = cfg.emitidoPor    || 'Sistema';
  const docId      = docRef(aluno.numeroMatricula);
  const now        = new Date();
  const dataEmissao = now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora        = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  // ── QR code data ──
  const qrLines = [
    `DOC: ${docId}`,
    `ESCOLA: ${escola}`,
    `ALUNO: ${aluno.nome} ${aluno.apelido}`,
    `MATRICULA: ${aluno.numeroMatricula}`,
    `TOTAL PAGO: ${fmtAOA(resumo.totalPago)}`,
    `TRANSACCOES: ${resumo.total}`,
    `EMITIDO: ${dataEmissao}`,
    filtros.dataInicio ? `PERIODO: ${fmtDate(filtros.dataInicio)} a ${fmtDate(filtros.dataFim || 'Presente')}` : 'PERIODO: Todos',
  ].join('\n');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrLines)}&bgcolor=ffffff&color=000000&margin=6`;

  // ── Rows ──
  const rows = pagamentos.map((p, idx) => {
    const descricao = [
      p.taxaDescricao || TIPO_LABEL[p.taxaTipo || ''] || (p.taxaTipo || ''),
      p.mes ? mesLabel(p.mes) : '',
      p.ano || '',
    ].filter(Boolean).join(' · ');

    const statusStyle = p.status === 'pago'
      ? 'color:#1a6b2a;background:#d4edda;'
      : p.status === 'pendente'
        ? 'color:#856404;background:#fff3cd;'
        : 'color:#6c757d;background:#e2e3e5;';

    const valor = p.status === 'cancelado'
      ? `<span style="color:#aaa;text-decoration:line-through;">${fmtAOA(p.valor)}</span>`
      : `<strong style="color:${p.status === 'pago' ? '#1a6b2a' : '#856404'};">${fmtAOA(p.valor)}</strong>`;

    const bg = idx % 2 === 0 ? '#fff' : '#f9f9ff';
    const ref = [p.referencia ? `Ref: ${p.referencia}` : '', p.observacao || ''].filter(Boolean).join(' · ');

    return `
      <tr style="background:${bg};">
        <td style="padding:6px 8px;font-size:10px;color:#555;white-space:nowrap;">${fmtDate(p.data)}</td>
        <td style="padding:6px 8px;font-size:10px;">
          <span style="font-weight:600;color:#1a2540;">${descricao}</span>
          ${ref ? `<br><span style="font-size:9px;color:#888;">${ref}</span>` : ''}
        </td>
        <td style="padding:6px 8px;font-size:10px;color:#555;">${METODO_LABEL[p.metodoPagamento] || p.metodoPagamento}</td>
        <td style="padding:6px 8px;text-align:right;white-space:nowrap;">${valor}</td>
        <td style="padding:4px 8px;text-align:center;">
          <span style="font-size:9px;font-weight:bold;padding:2px 6px;border-radius:4px;${statusStyle}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
        </td>
      </tr>`;
  }).join('');

  // ── Period label ──
  const periodoLabel = filtros.dataInicio
    ? `${fmtDate(filtros.dataInicio)} a ${fmtDate(filtros.dataFim || 'Presente')}`
    : 'Todos os pagamentos registados';

  const mesAtual = MESES_LONG[now.getMonth()];
  const anoAtual = now.getFullYear();

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Extracto de Propinas — ${aluno.nome} ${aluno.apelido}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; background: #fff; }
    .page { max-width: 210mm; margin: 0 auto; padding: 18mm 18mm 14mm; min-height: 297mm; position: relative; }
    .print-btn { display: block; margin: 10px auto 16px; padding: 10px 40px; background: #1a2540; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold; }
    .print-btn:hover { background: #2d3f6e; }

    /* ── Header ── */
    .doc-header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1a2540; padding-bottom: 12px; margin-bottom: 14px; }
    .doc-header-logo { width: 56px; height: 56px; object-fit: contain; }
    .doc-header-text { flex: 1; }
    .doc-header-text .rep { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #555; font-weight: 600; }
    .doc-header-text .escola-nome { font-size: 14px; font-weight: 800; color: #1a2540; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-header-title { text-align: right; }
    .doc-header-title .titulo { font-size: 13px; font-weight: 800; color: #1a2540; text-transform: uppercase; letter-spacing: 1px; }
    .doc-header-title .docnum { font-size: 9.5px; color: #888; margin-top: 4px; font-family: monospace; }
    .doc-header-title .periodo-badge { display: inline-block; margin-top: 4px; background: #1a2540; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 9px; letter-spacing: 0.5px; }

    /* ── Aluno Info ── */
    .aluno-box { background: #f0f4ff; border: 1px solid #c5d0ee; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
    .aluno-box .aluno-name { font-size: 15px; font-weight: 800; color: #1a2540; }
    .aluno-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 14px; margin-top: 8px; }
    .aluno-grid .field label { font-size: 8.5px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px; display: block; }
    .aluno-grid .field span { font-size: 10.5px; font-weight: 600; color: #1a2540; }

    /* ── Resumo ── */
    .resumo-row { display: grid; grid-template-columns: repeat(3, 1fr) 1fr; gap: 8px; margin-bottom: 14px; }
    .resumo-card { border-radius: 8px; padding: 8px 10px; text-align: center; }
    .resumo-card .val { font-size: 13px; font-weight: 800; display: block; }
    .resumo-card .lbl { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-top: 2px; }
    .card-pago    { background: #d4edda; color: #155724; }
    .card-pend    { background: #fff3cd; color: #856404; }
    .card-canc    { background: #e2e3e5; color: #495057; }
    .card-total   { background: #1a2540; color: #fff; }

    /* ── Tabela ── */
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; color: #1a2540; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1.5px solid #1a2540; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #1a2540; color: #fff; padding: 7px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
    thead th:last-child { text-align: center; }
    thead th:nth-child(4) { text-align: right; }
    tbody tr:last-child td { border-bottom: 2px solid #1a2540; }

    /* ── QR + Barcode ── */
    .qr-bar-row { display: flex; gap: 24px; align-items: center; margin: 14px 0 10px; padding: 12px; border: 1px solid #dde0ef; border-radius: 8px; background: #f9faff; }
    .qr-box { text-align: center; }
    .qr-box img { width: 110px; height: 110px; border: 1px solid #dde; border-radius: 4px; }
    .qr-box .qr-lbl { font-size: 8px; text-transform: uppercase; color: #888; margin-top: 4px; letter-spacing: 0.5px; }
    .bar-box { flex: 1; text-align: center; }
    .bar-box svg { max-width: 100%; height: 60px; }
    .bar-box .bar-lbl { font-size: 8px; text-transform: uppercase; color: #888; margin-top: 2px; letter-spacing: 0.5px; }
    .doc-info { flex: 1.2; font-size: 9.5px; line-height: 1.7; color: #555; }
    .doc-info strong { color: #1a2540; }

    /* ── Footer ── */
    .footer-totals { display: flex; justify-content: flex-end; margin-top: 10px; }
    .totals-table { border: 1px solid #dde; border-radius: 8px; overflow: hidden; min-width: 280px; }
    .totals-table .tot-row { display: flex; justify-content: space-between; padding: 5px 12px; font-size: 10px; }
    .totals-table .tot-row:not(:last-child) { border-bottom: 1px solid #eee; }
    .totals-table .tot-grand { background: #1a2540; color: #fff; font-weight: 800; font-size: 11px; }

    .sig-section { display: flex; gap: 20px; margin-top: 20px; justify-content: space-between; }
    .sig-block { text-align: center; flex: 1; }
    .sig-block .sig-label { font-size: 9px; font-weight: 700; color: #333; text-transform: uppercase; margin-bottom: 24px; }
    .sig-block .sig-line { border-top: 1px solid #333; margin: 0 auto 4px; width: 150px; }
    .sig-block .sig-name { font-size: 9px; font-weight: 700; color: #1a2540; }

    .footer-note { margin-top: 18px; border-top: 1px dashed #ccc; padding-top: 8px; font-size: 8.5px; color: #aaa; text-align: center; line-height: 1.7; }

    @media print {
      @page { size: A4 portrait; margin: 12mm 14mm; }
      body { margin: 0; }
      .page { padding: 0; max-width: 100%; }
      .print-btn { display: none !important; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar como PDF</button>

  <div class="page">

    <!-- ── HEADER ── -->
    <div class="doc-header">
      <img class="doc-header-logo" src="/icons/icon-192.png" alt="Logo" onerror="this.style.display='none'" />
      <div class="doc-header-text">
        <div class="rep">República de Angola</div>
        <div class="escola-nome">${escola}</div>
        <div style="font-size:9px;color:#888;margin-top:2px;">Sistema Integrado de Gestão Académica</div>
      </div>
      <div class="doc-header-title">
        <div class="titulo">Extracto de Pagamentos</div>
        <div class="docnum">${docId}</div>
        <div class="periodo-badge">Período: ${periodoLabel}</div>
      </div>
    </div>

    <!-- ── DADOS DO ALUNO ── -->
    <div class="aluno-box">
      <div class="aluno-name">${aluno.nome} ${aluno.apelido}</div>
      <div class="aluno-grid">
        <div class="field"><label>Nº de Matrícula</label><span>${aluno.numeroMatricula}</span></div>
        ${aluno.turmaNome ? `<div class="field"><label>Turma</label><span>${aluno.turmaNome}</span></div>` : '<div></div>'}
        ${aluno.cursoNome ? `<div class="field"><label>Curso</label><span>${aluno.cursoNome}</span></div>` : '<div></div>'}
        ${aluno.nomeEncarregado ? `<div class="field"><label>Encarregado</label><span>${aluno.nomeEncarregado}</span></div>` : '<div></div>'}
        <div class="field"><label>Data de Emissão</label><span>${dataEmissao}</span></div>
        <div class="field"><label>Hora</label><span>${hora}</span></div>
      </div>
    </div>

    <!-- ── RESUMO ── -->
    <div class="resumo-row">
      <div class="resumo-card card-pago">
        <span class="val">${fmtAOA(resumo.totalPago)}</span>
        <span class="lbl">✓ Total Pago</span>
      </div>
      <div class="resumo-card card-pend">
        <span class="val">${fmtAOA(resumo.totalPendente)}</span>
        <span class="lbl">⏳ Pendente</span>
      </div>
      <div class="resumo-card card-canc">
        <span class="val">${fmtAOA(resumo.totalCancelado)}</span>
        <span class="lbl">✗ Cancelado</span>
      </div>
      <div class="resumo-card card-total">
        <span class="val">${resumo.total}</span>
        <span class="lbl">Transacções</span>
      </div>
    </div>

    <!-- ── MOVIMENTOS ── -->
    <div class="section-title">Movimentos no Período</div>
    ${pagamentos.length === 0
      ? `<div style="text-align:center;padding:30px;color:#aaa;font-size:12px;border:1px dashed #ddd;border-radius:8px;">
           Nenhum pagamento encontrado para o período seleccionado.
         </div>`
      : `<table>
          <thead>
            <tr>
              <th style="width:80px;">Data</th>
              <th>Descrição</th>
              <th style="width:100px;">Método</th>
              <th style="width:110px;text-align:right;">Valor</th>
              <th style="width:70px;text-align:center;">Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`
    }

    <!-- ── TOTAIS ── -->
    <div class="footer-totals">
      <div class="totals-table">
        ${resumo.totalPago > 0 ? `<div class="tot-row"><span>Total Pago</span><span style="color:#155724;font-weight:700;">${fmtAOA(resumo.totalPago)}</span></div>` : ''}
        ${resumo.totalPendente > 0 ? `<div class="tot-row"><span>Total Pendente</span><span style="color:#856404;font-weight:700;">${fmtAOA(resumo.totalPendente)}</span></div>` : ''}
        ${resumo.totalCancelado > 0 ? `<div class="tot-row"><span>Total Cancelado</span><span style="color:#aaa;">${fmtAOA(resumo.totalCancelado)}</span></div>` : ''}
        <div class="tot-row tot-grand">
          <span>TOTAL GERAL</span>
          <span>${fmtAOA(resumo.totalPago + resumo.totalPendente)}</span>
        </div>
      </div>
    </div>

    <!-- ── QR CODE + CÓDIGO DE BARRAS ── -->
    <div class="qr-bar-row">
      <div class="qr-box">
        <img src="${qrUrl}" alt="QR Code do Extracto" />
        <div class="qr-lbl">QR Verificação</div>
      </div>
      <div class="bar-box">
        <svg id="barcode"></svg>
        <div class="bar-lbl">Código de Barras — Nº Matrícula</div>
      </div>
      <div class="doc-info">
        <strong>Documento:</strong> ${docId}<br>
        <strong>Aluno:</strong> ${aluno.nome} ${aluno.apelido}<br>
        <strong>Matrícula:</strong> ${aluno.numeroMatricula}<br>
        <strong>Emitido por:</strong> ${emitidoPor}<br>
        <strong>Data:</strong> ${dataEmissao} às ${hora}<br>
        <strong>Total Pago:</strong> ${fmtAOA(resumo.totalPago)}<br>
        <strong>Transacções:</strong> ${resumo.total}
      </div>
    </div>

    <!-- ── ASSINATURAS ── -->
    <div class="sig-section">
      <div class="sig-block">
        <div class="sig-label">O Director Geral</div>
        <div class="sig-line"></div>
        <div class="sig-name">${director}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">O Chefe de Secretaria</div>
        <div class="sig-line"></div>
        <div class="sig-name">${chefeSec}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">O(A) Encarregado(a)</div>
        <div class="sig-line"></div>
        <div class="sig-name">____________________________</div>
      </div>
    </div>

    <!-- ── RODAPÉ ── -->
    <div class="footer-note">
      Documento emitido em ${dataEmissao} às ${hora} por ${emitidoPor} · ${escola}<br>
      Este extracto é meramente informativo e não substitui recibo oficial de pagamento.
      Os dados apresentados reflectem o estado dos registos no sistema à data de emissão.<br>
      Ref. ${docId}
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      try {
        JsBarcode('#barcode', '${aluno.numeroMatricula.replace(/'/g, "\\'")}', {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 11,
          margin: 4,
          background: 'transparent',
          lineColor: '#1a2540',
          fontOptions: 'bold',
        });
      } catch(e) {
        document.getElementById('barcode').style.display = 'none';
      }
    });
  </script>
</body>
</html>`;
}
