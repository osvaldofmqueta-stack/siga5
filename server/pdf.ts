import { Request, Response, Express } from 'express';
import { query } from './db';
import { requireAuth } from './auth';

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const METODO_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência / RUPE',
  multicaixa: 'Multicaixa Express',
};

const TIPO_LABEL: Record<string, string> = {
  propina: 'Propina',
  matricula: 'Matrícula',
  material: 'Material Didáctico',
  exame: 'Exame',
  multa: 'Multa',
  outro: 'Outro',
};

function fmtDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return iso; }
}

function fmtMoney(n: number): string {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function buildReciboBody(p: any, aluno: any, turma: any, idx: number): string {
  const numRef = `REC-${(p.id || '').toString().replace(/-/g,'').substring(0,8).toUpperCase()}`;
  const mesTxt = p.mes ? `${MESES[p.mes] || ''} ` : '';
  const tipoLabel = TIPO_LABEL[p.tipoTaxa] || 'Pagamento';
  const descricao = `${tipoLabel}${mesTxt ? ' – ' + mesTxt : ''}${p.ano ? p.ano : ''}`;
  const statusOk = p.status === 'pago';
  const statusColor = statusOk ? '#16a34a' : p.status === 'pendente' ? '#d97706' : '#6b7280';
  const statusLabel = statusOk ? '✓ PAGO' : p.status === 'pendente' ? '⏳ PENDENTE' : 'CANCELADO';
  const dataPagto = p.data || p.dataPagamento || p.createdAt;

  return `<div class="recibo${idx > 0 ? ' page-break' : ''}">
  <div class="header">
    <div class="logo-box">
      <div class="logo-inner">
        <div style="font-size:18pt;font-weight:900;color:white;letter-spacing:-1px;">A</div>
      </div>
    </div>
    <div class="escola-info">
      <div class="escola-nome">ESCOLA</div>
      <div class="escola-sub">RECIBO DE PAGAMENTO</div>
    </div>
    <div class="ref-box">
      <div class="ref-label">Nº RECIBO</div>
      <div class="ref-value">${numRef}</div>
      <div class="ref-date">${fmtDate(p.createdAt || new Date().toISOString())}</div>
    </div>
  </div>
  <hr class="divider"/>
  <div class="section-title">DADOS DO ALUNO</div>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">Nome Completo</span><span class="info-value">${aluno?.nomeCompleto || aluno?.nome || '—'}</span></div>
    <div class="info-row"><span class="info-label">Nº de Matrícula</span><span class="info-value">${aluno?.numeroMatricula || (aluno?.id || '').substring(0,8).toUpperCase()}</span></div>
    <div class="info-row"><span class="info-label">Turma / Classe</span><span class="info-value">${turma?.nome || '—'}</span></div>
  </div>
  <hr class="divider"/>
  <div class="section-title">DETALHES DO PAGAMENTO</div>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">Descrição</span><span class="info-value">${descricao}</span></div>
    <div class="info-row highlight"><span class="info-label">Valor Pago</span><span class="info-value valor">${fmtMoney(p.valor)} AOA</span></div>
    <div class="info-row"><span class="info-label">Método</span><span class="info-value">${METODO_LABEL[p.metodoPagamento] || p.metodoPagamento || '—'}</span></div>
    ${p.referencia ? `<div class="info-row"><span class="info-label">Referência</span><span class="info-value mono">${p.referencia}</span></div>` : ''}
    <div class="info-row"><span class="info-label">Data</span><span class="info-value">${fmtDate(dataPagto)}</span></div>
    <div class="info-row"><span class="info-label">Estado</span><span class="info-value" style="color:${statusColor};font-weight:700;font-size:10pt">${statusLabel}</span></div>
    ${p.observacao ? `<div class="info-row"><span class="info-label">Observação</span><span class="info-value">${p.observacao}</span></div>` : ''}
  </div>
  <div class="footer">
    <div class="assinatura-block"><div class="assinatura-linha"></div><div class="assinatura-label">Responsável Financeiro</div></div>
    <div class="assinatura-block"><div class="assinatura-linha"></div><div class="assinatura-label">Encarregado de Educação</div></div>
  </div>
  <div class="emitido">Emitido em ${fmtDate(new Date().toISOString())} · Este recibo é válido como comprovativo de pagamento</div>
</div>`;
}

function buildPageHTML(reciboBodies: string[], escolaNome: string, autoprint: boolean): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>Recibos – ${escolaNome}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;color:#111}
.recibo{background:white;width:210mm;min-height:135mm;margin:8mm auto;padding:10mm 14mm;border:1px solid #ddd;border-radius:4px;position:relative}
@media print{
  body{background:white}
  .recibo{margin:0;border:none;width:100%;min-height:auto;padding:10mm 12mm}
  .page-break{page-break-before:always}
  .no-print{display:none!important}
}
.header{display:flex;align-items:center;gap:14px;margin-bottom:10px}
.logo-box{width:56px;height:56px;background:#1a2b5f;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-inner{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
.escola-info{flex:1}
.escola-nome{font-size:15pt;font-weight:700;color:#1a2b5f;line-height:1.1}
.escola-sub{font-size:7pt;letter-spacing:3px;color:#6b7280;margin-top:3px}
.ref-box{text-align:right;padding:8px 12px;background:#1a2b5f;border-radius:8px;color:white;min-width:120px}
.ref-label{font-size:6pt;letter-spacing:2px;opacity:.7;text-transform:uppercase}
.ref-value{font-size:11pt;font-weight:700;letter-spacing:2px;margin:2px 0;font-family:monospace}
.ref-date{font-size:8pt;opacity:.75}
.divider{border:none;border-top:2px solid #f3f4f6;margin:8px 0}
.section-title{font-size:6.5pt;font-weight:700;letter-spacing:2.5px;color:#9ca3af;margin-bottom:6px;text-transform:uppercase}
.info-grid{margin-bottom:8px}
.info-row{display:flex;padding:4px 6px;border-bottom:1px solid #f9fafb;align-items:baseline;gap:4px}
.info-row.highlight{background:#eff6ff;border-radius:4px;margin:4px 0}
.info-label{width:145px;font-size:8pt;color:#6b7280;flex-shrink:0}
.info-value{font-size:9pt;color:#111827;font-weight:500;flex:1}
.info-value.valor{font-size:14pt;font-weight:700;color:#1a2b5f}
.info-value.mono{font-family:monospace;font-size:9pt;letter-spacing:1px}
.footer{display:flex;justify-content:space-around;margin-top:18px;padding-top:8px;gap:20px}
.assinatura-block{text-align:center;flex:1}
.assinatura-linha{border-top:1px solid #374151;margin-bottom:4px;margin-left:10px;margin-right:10px}
.assinatura-label{font-size:7pt;color:#6b7280}
.emitido{text-align:center;font-size:6.5pt;color:#9ca3af;margin-top:8px;border-top:1px dashed #e5e7eb;padding-top:6px}
.print-btn{position:fixed;top:10px;right:10px;background:#1a2b5f;color:white;border:none;padding:10px 18px;border-radius:8px;font-size:12pt;cursor:pointer;z-index:999;font-family:Arial}
.print-btn:hover{background:#243c7a}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
${reciboBodies.join('\n')}
${autoprint ? `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>` : ''}
</body>
</html>`;
}

// ─────────────────────────────────────────────
// BOLETIM DE NOTAS
// ─────────────────────────────────────────────
function calcMedia(nota: any): number {
  const vals = [nota.aval1,nota.aval2,nota.aval3,nota.aval4].filter((v:number)=>v>0);
  if (!vals.length) return nota.nf || 0;
  return nota.nf || Math.round(vals.reduce((a:number,b:number)=>a+b,0)/vals.length);
}

function notaClass(n: number): string {
  if (n >= 14) return 'nota-bom';
  if (n >= 10) return 'nota-suf';
  return 'nota-neg';
}

function buildBoletimHTML(aluno: any, turma: any, notas: any[], config: any, trimestre: number | null, autoprint: boolean): string {
  const escolaNome = config?.nomeEscola || 'Escola';
  const dirGeral = config?.directorGeral || '';
  const anoLetivo = turma?.anoLetivo || new Date().getFullYear();

  const trimestres = trimestre ? [trimestre] : [1, 2, 3];
  const disciplinasSet = new Set<string>(notas.map((n: any) => n.disciplina));
  const disciplinas = Array.from(disciplinasSet).sort();

  const nomeCompleto = aluno ? `${aluno.nome || ''} ${aluno.apelido || ''}`.trim() : '—';

  let tabelasHTML = '';
  for (const tri of trimestres) {
    const notasTri = notas.filter((n: any) => n.trimestre === tri);
    if (!notasTri.length && trimestre === null) continue;

    const rows = disciplinas.map(disc => {
      const n = notasTri.find((x: any) => x.disciplina === disc);
      if (!n) return `<tr><td>${disc}</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="nota-cell nota-neutro">—</td></tr>`;
      const med = calcMedia(n);
      return `<tr>
        <td>${disc}</td>
        <td class="center">${n.aval1 || '—'}</td>
        <td class="center">${n.aval2 || '—'}</td>
        <td class="center">${n.aval3 || '—'}</td>
        <td class="center">${n.mac || n.mac1 || '—'}</td>
        <td class="nota-cell center ${notaClass(med)}">${med}</td>
      </tr>`;
    }).join('');

    const notasValidas = notasTri.filter((n: any) => n.nf > 0 || n.aval1 > 0);
    const mediaGeral = notasValidas.length
      ? Math.round(notasValidas.reduce((s: number, n: any) => s + calcMedia(n), 0) / notasValidas.length)
      : null;

    tabelasHTML += `
    <div class="trimestre-block">
      <div class="tri-header">${tri}º Trimestre</div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;width:38%">Disciplina</th>
            <th class="center">Av.1</th>
            <th class="center">Av.2</th>
            <th class="center">Av.3</th>
            <th class="center">MAC</th>
            <th class="center">Média</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${mediaGeral !== null ? `<div class="media-geral">Média Geral: <span class="${notaClass(mediaGeral)}">${mediaGeral}</span></div>` : ''}
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>Boletim – ${nomeCompleto}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;color:#111;font-size:9pt}
.doc{background:white;width:210mm;min-height:297mm;margin:8mm auto;padding:14mm 16mm;border:1px solid #ddd}
@media print{
  body{background:white}
  .doc{margin:0;border:none;width:100%;padding:12mm}
  .no-print{display:none!important}
}
.header{display:flex;align-items:center;gap:14px;margin-bottom:8px;border-bottom:3px solid #1a2b5f;padding-bottom:8px}
.logo-box{width:54px;height:54px;background:#1a2b5f;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:20pt;font-weight:900;flex-shrink:0}
.escola-info{flex:1}
.escola-nome{font-size:14pt;font-weight:700;color:#1a2b5f}
.escola-sub{font-size:7.5pt;color:#6b7280;margin-top:2px;letter-spacing:1px}
.titulo-doc{text-align:right;padding:8px 12px;background:#1a2b5f;color:white;border-radius:6px;min-width:110px}
.titulo-doc-label{font-size:6pt;letter-spacing:2px;opacity:.7}
.titulo-doc-val{font-size:10pt;font-weight:700}
.aluno-section{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0;background:#f8fafc;border-radius:6px;padding:8px 12px;border:1px solid #e2e8f0}
.aluno-field{display:flex;flex-direction:column;gap:1px}
.aluno-label{font-size:6.5pt;color:#9ca3af;text-transform:uppercase;letter-spacing:1px}
.aluno-value{font-size:9pt;font-weight:600;color:#1e293b}
.trimestre-block{margin:10px 0}
.tri-header{background:#1a2b5f;color:white;padding:5px 10px;border-radius:4px 4px 0 0;font-size:9pt;font-weight:700;letter-spacing:1px}
table{width:100%;border-collapse:collapse;margin-top:0}
th{background:#f1f5f9;font-size:7.5pt;font-weight:700;color:#475569;padding:5px 8px;border:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px}
td{font-size:8.5pt;padding:5px 8px;border:1px solid #e2e8f0;color:#1e293b}
tr:nth-child(even) td{background:#fafafa}
.center{text-align:center}
.nota-cell{font-weight:700;font-size:9.5pt}
.nota-bom{color:#16a34a}
.nota-suf{color:#d97706}
.nota-neg{color:#dc2626}
.nota-neutro{color:#9ca3af}
.media-geral{text-align:right;font-size:9pt;font-weight:700;color:#1a2b5f;padding:4px 8px;background:#f0f6ff;border:1px solid #dbeafe;border-top:none;border-radius:0 0 4px 4px}
.media-geral span{font-size:12pt;margin-left:6px}
.footer{display:flex;justify-content:space-around;margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;gap:20px}
.assinatura-block{text-align:center;flex:1}
.assinatura-linha{border-top:1px solid #374151;margin:20px 10px 4px}
.assinatura-label{font-size:7pt;color:#6b7280}
.rodape{text-align:center;font-size:6.5pt;color:#9ca3af;margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:6px}
.print-btn{position:fixed;top:10px;right:10px;background:#1a2b5f;color:white;border:none;padding:10px 18px;border-radius:8px;font-size:11pt;cursor:pointer;z-index:999}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
<div class="doc">
  <div class="header">
    <div class="logo-box">${escolaNome.charAt(0)}</div>
    <div class="escola-info">
      <div class="escola-nome">${escolaNome}</div>
      <div class="escola-sub">Ano Lectivo ${anoLetivo}</div>
    </div>
    <div class="titulo-doc">
      <div class="titulo-doc-label">DOCUMENTO</div>
      <div class="titulo-doc-val">BOLETIM DE NOTAS</div>
    </div>
  </div>

  <div class="aluno-section">
    <div class="aluno-field"><span class="aluno-label">Nome do Aluno</span><span class="aluno-value">${nomeCompleto}</span></div>
    <div class="aluno-field"><span class="aluno-label">Nº de Matrícula</span><span class="aluno-value">${aluno?.numeroMatricula || '—'}</span></div>
    <div class="aluno-field"><span class="aluno-label">Turma / Classe</span><span class="aluno-value">${turma?.nome || '—'} · ${turma?.classe || '—'}</span></div>
    <div class="aluno-field"><span class="aluno-label">Turno</span><span class="aluno-value">${turma?.turno || '—'}</span></div>
    <div class="aluno-field"><span class="aluno-label">Encarregado de Educação</span><span class="aluno-value">${aluno?.nomeEncarregado || '—'}</span></div>
    <div class="aluno-field"><span class="aluno-label">Data de Emissão</span><span class="aluno-value">${fmtDate(new Date().toISOString())}</span></div>
  </div>

  ${tabelasHTML || '<p style="color:#9ca3af;text-align:center;padding:20px">Sem notas registadas</p>'}

  <div class="footer">
    <div class="assinatura-block"><div class="assinatura-linha"></div><div class="assinatura-label">Director(a) Pedagógico(a)</div></div>
    <div class="assinatura-block"><div class="assinatura-linha"></div><div class="assinatura-label">Director(a) Geral${dirGeral ? ' – ' + dirGeral : ''}</div></div>
    <div class="assinatura-block"><div class="assinatura-linha"></div><div class="assinatura-label">Encarregado de Educação</div></div>
  </div>
  <div class="rodape">Emitido em ${fmtDate(new Date().toISOString())} · ${escolaNome} · Documento Oficial</div>
</div>
${autoprint ? `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>` : ''}
</body>
</html>`;
}

// ─────────────────────────────────────────────
// DECLARAÇÃO DE MATRÍCULA
// ─────────────────────────────────────────────
function buildDeclaracaoHTML(aluno: any, turma: any, config: any, tipo: string, autoprint: boolean): string {
  const escolaNome = config?.nomeEscola || 'Escola';
  const dirGeral = config?.directorGeral || '_________________________';
  const nif = config?.nifEscola || '';
  const codigo = config?.codigoMED || '';
  const anoLetivo = turma?.anoLetivo || new Date().getFullYear();
  const nomeCompleto = aluno ? `${aluno.nome || ''} ${aluno.apelido || ''}`.trim() : '—';
  const hoje = fmtDate(new Date().toISOString());

  const titulos: Record<string, string> = {
    matricula: 'DECLARAÇÃO DE MATRÍCULA',
    frequencia: 'DECLARAÇÃO DE FREQUÊNCIA',
    conclusao: 'DECLARAÇÃO DE CONCLUSÃO',
  };

  const textos: Record<string, string> = {
    matricula: `Declara-se, para os devidos efeitos legais, que <strong>${nomeCompleto}</strong>, portador(a) do Bilhete de Identidade / Documento de Identificação nº <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>, encontra-se regularmente matriculado(a) neste estabelecimento de ensino, na <strong>${turma?.classe || '—'}</strong>, turma <strong>${turma?.nome || '—'}</strong>, turno <strong>${turma?.turno || '—'}</strong>, no ano lectivo de <strong>${anoLetivo}</strong>.`,
    frequencia: `Declara-se, para os devidos efeitos legais, que <strong>${nomeCompleto}</strong>, portador(a) do Bilhete de Identidade / Documento de Identificação nº <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>, é aluno(a) devidamente matriculado(a) e a frequentar as aulas neste estabelecimento de ensino, na <strong>${turma?.classe || '—'}</strong>, turma <strong>${turma?.nome || '—'}</strong>, turno <strong>${turma?.turno || '—'}</strong>, no ano lectivo de <strong>${anoLetivo}</strong>.`,
    conclusao: `Declara-se, para os devidos efeitos legais, que <strong>${nomeCompleto}</strong>, portador(a) do Bilhete de Identidade / Documento de Identificação nº <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>, concluiu com aproveitamento o percurso escolar na <strong>${turma?.classe || '—'}</strong>, turma <strong>${turma?.nome || '—'}</strong>, no ano lectivo de <strong>${anoLetivo}</strong>, neste estabelecimento de ensino.`,
  };

  const titulo = titulos[tipo] || titulos.matricula;
  const texto = textos[tipo] || textos.matricula;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>${titulo} – ${nomeCompleto}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',Times,serif;background:#f0f0f0;color:#111;font-size:11pt}
.doc{background:white;width:210mm;min-height:297mm;margin:8mm auto;padding:20mm 22mm;border:1px solid #ddd;display:flex;flex-direction:column}
@media print{
  body{background:white}
  .doc{margin:0;border:none;width:100%;padding:18mm 20mm}
  .no-print{display:none!important}
}
.header{text-align:center;border-bottom:2px solid #1a2b5f;padding-bottom:12px;margin-bottom:20px}
.republica{font-size:8pt;letter-spacing:1px;color:#6b7280;margin-bottom:4px}
.escola-nome{font-size:15pt;font-weight:700;color:#1a2b5f;text-transform:uppercase}
.escola-meta{font-size:8pt;color:#6b7280;margin-top:4px}
.titulo{text-align:center;margin:24px 0 20px;font-size:14pt;font-weight:700;text-decoration:underline;text-transform:uppercase;color:#1a2b5f;letter-spacing:2px}
.corpo{line-height:2;text-align:justify;font-size:11pt;color:#1e293b;flex:1}
.corpo p{margin-bottom:12px}
.declaracao-texto{margin:20px 0;font-size:11pt;line-height:2.2;text-indent:40px}
.validade{margin-top:16px;font-size:9pt;color:#6b7280;font-style:italic;text-align:center}
.local-data{margin-top:40px;text-align:right;font-size:10pt}
.assinatura-section{margin-top:60px;display:flex;justify-content:center}
.assinatura-block{text-align:center;min-width:200px}
.assinatura-linha{border-top:1px solid #374151;margin-bottom:6px}
.assinatura-label{font-size:8.5pt;color:#374151}
.assinatura-nome{font-size:9pt;font-weight:700;margin-top:2px}
.rodape{text-align:center;font-size:7pt;color:#9ca3af;margin-top:30px;border-top:1px dashed #e5e7eb;padding-top:8px}
.print-btn{position:fixed;top:10px;right:10px;background:#1a2b5f;color:white;border:none;padding:10px 18px;border-radius:8px;font-size:11pt;cursor:pointer;z-index:999;font-family:Arial}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
<div class="doc">
  <div class="header">
    <div class="republica">REPÚBLICA DE ANGOLA · MINISTÉRIO DA EDUCAÇÃO</div>
    <div class="escola-nome">${escolaNome}</div>
    <div class="escola-meta">${codigo ? 'Cód. MED: ' + codigo + ' · ' : ''}${nif ? 'NIF: ' + nif : ''}</div>
  </div>

  <div class="titulo">${titulo}</div>

  <div class="corpo">
    <p class="declaracao-texto">${texto}</p>
    <p style="text-indent:40px">A presente declaração é passada a pedido do(a) interessado(a) e destina-se aos fins que o(a) mesmo(a) indicar.</p>
  </div>

  <p class="validade">Válida por 90 dias a partir da data de emissão</p>

  <div class="local-data">Luanda, ${hoje}</div>

  <div class="assinatura-section">
    <div class="assinatura-block">
      <div class="assinatura-linha"></div>
      <div class="assinatura-label">O / A Director(a) Geral</div>
      <div class="assinatura-nome">${dirGeral}</div>
    </div>
  </div>

  <div class="rodape">Documento emitido em ${hoje} pelo sistema SIGA · ${escolaNome}${nif ? ' · NIF: ' + nif : ''}</div>
</div>
${autoprint ? `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>` : ''}
</body>
</html>`;
}

// ─────────────────────────────────────────────
// RELATÓRIO DE TURMA
// ─────────────────────────────────────────────
function buildRelatorioTurmaHTML(turma: any, alunos: any[], notas: any[], config: any, trimestre: number, autoprint: boolean): string {
  const escolaNome = config?.nomeEscola || 'Escola';
  const anoLetivo = turma?.anoLetivo || new Date().getFullYear();

  const disciplinasSet = new Set<string>(notas.map((n: any) => n.disciplina));
  const disciplinas = Array.from(disciplinasSet).sort();

  const rows = alunos.map((aluno: any) => {
    const nomeCompleto = `${aluno.nome || ''} ${aluno.apelido || ''}`.trim();
    const notasAluno = notas.filter((n: any) => n.alunoId === aluno.id && n.trimestre === trimestre);
    const notas_vals = notasAluno.map((n: any) => calcMedia(n)).filter((v: number) => v > 0);
    const media = notas_vals.length ? Math.round(notas_vals.reduce((a: number, b: number) => a + b, 0) / notas_vals.length) : null;
    const aprovado = media !== null && media >= (config?.notaMinimaAprovacao || 10);

    const discCells = disciplinas.map(disc => {
      const n = notasAluno.find((x: any) => x.disciplina === disc);
      const med = n ? calcMedia(n) : null;
      return `<td class="center ${med !== null ? notaClass(med) : 'nota-neutro'}">${med !== null ? med : '—'}</td>`;
    }).join('');

    return `<tr>
      <td style="font-weight:600">${nomeCompleto}</td>
      <td class="center mono">${aluno.numeroMatricula || '—'}</td>
      ${discCells}
      <td class="center nota-cell ${media !== null ? notaClass(media) : 'nota-neutro'}">${media !== null ? media : '—'}</td>
      <td class="center" style="font-weight:700;color:${aprovado ? '#16a34a' : media === null ? '#9ca3af' : '#dc2626'}">${media === null ? '—' : aprovado ? 'APROV.' : 'REPROV.'}</td>
    </tr>`;
  }).join('');

  const aprovados = alunos.filter(a => {
    const notasA = notas.filter((n: any) => n.alunoId === a.id && n.trimestre === trimestre && calcMedia(n) > 0);
    if (!notasA.length) return false;
    const med = Math.round(notasA.reduce((s: number, n: any) => s + calcMedia(n), 0) / notasA.length);
    return med >= (config?.notaMinimaAprovacao || 10);
  }).length;

  const discHeaders = disciplinas.map(d => `<th class="center" style="white-space:nowrap;font-size:7pt">${d}</th>`).join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>Relatório ${turma?.nome} – ${trimestre}º Trimestre</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;color:#111;font-size:8.5pt}
.doc{background:white;margin:8mm auto;padding:12mm 14mm;border:1px solid #ddd;max-width:100%}
@media print{
  body{background:white}
  .doc{margin:0;border:none;padding:10mm}
  .no-print{display:none!important}
  table{font-size:7pt}
}
.header{display:flex;align-items:center;gap:14px;margin-bottom:8px;border-bottom:3px solid #1a2b5f;padding-bottom:8px}
.logo-box{width:50px;height:50px;background:#1a2b5f;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:18pt;font-weight:900;flex-shrink:0}
.escola-info{flex:1}
.escola-nome{font-size:13pt;font-weight:700;color:#1a2b5f}
.escola-sub{font-size:7pt;color:#6b7280;margin-top:2px}
.badge{text-align:right;padding:6px 10px;background:#1a2b5f;color:white;border-radius:6px}
.badge-label{font-size:6pt;letter-spacing:1.5px;opacity:.7;text-transform:uppercase}
.badge-val{font-size:9pt;font-weight:700}
.meta{display:flex;gap:12px;margin:8px 0;background:#f8fafc;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0;flex-wrap:wrap}
.meta-item{display:flex;flex-direction:column}
.meta-label{font-size:6pt;color:#9ca3af;text-transform:uppercase}
.meta-value{font-size:8.5pt;font-weight:600;color:#1e293b}
.stats{display:flex;gap:12px;margin:8px 0;flex-wrap:wrap}
.stat-card{flex:1;min-width:80px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:6px 10px;text-align:center}
.stat-val{font-size:14pt;font-weight:700;color:#0369a1}
.stat-label{font-size:6.5pt;color:#0369a1;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#1a2b5f;color:white;font-size:7.5pt;font-weight:600;padding:5px 6px;border:1px solid #233;text-align:left}
td{font-size:8pt;padding:4px 6px;border:1px solid #e2e8f0;color:#1e293b}
tr:nth-child(even) td{background:#f8fafc}
.center{text-align:center}
.mono{font-family:monospace;font-size:7.5pt}
.nota-cell{font-weight:700;font-size:9pt}
.nota-bom{color:#16a34a}
.nota-suf{color:#d97706}
.nota-neg{color:#dc2626}
.nota-neutro{color:#9ca3af}
.rodape{text-align:center;font-size:6.5pt;color:#9ca3af;margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:6px}
.print-btn{position:fixed;top:10px;right:10px;background:#1a2b5f;color:white;border:none;padding:10px 18px;border-radius:8px;font-size:11pt;cursor:pointer;z-index:999}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
<div class="doc">
  <div class="header">
    <div class="logo-box">${escolaNome.charAt(0)}</div>
    <div class="escola-info">
      <div class="escola-nome">${escolaNome}</div>
      <div class="escola-sub">Relatório de Aproveitamento Escolar · Ano Lectivo ${anoLetivo}</div>
    </div>
    <div class="badge">
      <div class="badge-label">Período</div>
      <div class="badge-val">${trimestre}º Trimestre</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><span class="meta-label">Turma</span><span class="meta-value">${turma?.nome || '—'}</span></div>
    <div class="meta-item"><span class="meta-label">Classe</span><span class="meta-value">${turma?.classe || '—'}</span></div>
    <div class="meta-item"><span class="meta-label">Turno</span><span class="meta-value">${turma?.turno || '—'}</span></div>
    <div class="meta-item"><span class="meta-label">Nº de Alunos</span><span class="meta-value">${alunos.length}</span></div>
    <div class="meta-item"><span class="meta-label">Emitido em</span><span class="meta-value">${fmtDate(new Date().toISOString())}</span></div>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="stat-val">${alunos.length}</div><div class="stat-label">Total Alunos</div></div>
    <div class="stat-card" style="background:#f0fdf4;border-color:#bbf7d0"><div class="stat-val" style="color:#16a34a">${aprovados}</div><div class="stat-label" style="color:#16a34a">Aprovados</div></div>
    <div class="stat-card" style="background:#fff1f2;border-color:#fecdd3"><div class="stat-val" style="color:#dc2626">${alunos.length - aprovados}</div><div class="stat-label" style="color:#dc2626">Reprovados</div></div>
    <div class="stat-card" style="background:#fefce8;border-color:#fef08a"><div class="stat-val" style="color:#ca8a04">${alunos.length > 0 ? Math.round((aprovados / alunos.length) * 100) : 0}%</div><div class="stat-label" style="color:#ca8a04">Taxa Aprovação</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Nome do Aluno</th>
        <th class="center">Nº Mat.</th>
        ${discHeaders}
        <th class="center">Média</th>
        <th class="center">Resultado</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="100" style="text-align:center;color:#9ca3af;padding:16px">Sem dados de notas</td></tr>'}</tbody>
  </table>

  <div class="rodape">Emitido em ${fmtDate(new Date().toISOString())} · ${escolaNome} · Relatório gerado automaticamente pelo SIGA</div>
</div>
${autoprint ? `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>` : ''}
</body>
</html>`;
}

// ─────────────────────────────────────────────
// REFERÊNCIA MULTICAIXA EXPRESS
// ─────────────────────────────────────────────
function gerarRefMulticaixa(alunoId: string, taxaId: string, seq: number): string {
  const seqStr = String(seq % 999999).padStart(6, '0');
  const hash = (alunoId + taxaId).split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const checkDigit = Math.abs(hash) % 10;
  return `${seqStr}${checkDigit}`;
}

function buildMulticaixaHTML(aluno: any, turma: any, taxa: any, config: any, referencia: string, valor: number, dataValidade: string, autoprint: boolean): string {
  const escolaNome = config?.nomeEscola || 'Escola';
  const entidade = config?.numeroEntidade || '11333';
  const telefone = config?.telefoneMulticaixaExpress || '';
  const nomeCompleto = aluno ? `${aluno.nome || ''} ${aluno.apelido || ''}`.trim() : '—';
  const hoje = fmtDate(new Date().toISOString());
  const validade = fmtDate(dataValidade);

  const qrData = `MULTICAIXA|${entidade}|${referencia}|${valor}|AOA`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}&ecc=M&color=1a2b5f`;

  const passosCash = `
    <li>Dirija-se a qualquer ATM Multicaixa ou Balcão Bancário</li>
    <li>Seleccione <strong>"Pagamento de Serviços"</strong></li>
    <li>Introduza a <strong>Entidade: ${entidade}</strong></li>
    <li>Introduza a <strong>Referência: ${referencia}</strong></li>
    <li>Confirme o valor de <strong>${fmtMoney(valor)} AOA</strong></li>
    <li>Guarde o comprovativo</li>`;

  const passosExpress = telefone ? `
    <li>Abra a app <strong>Multicaixa Express</strong></li>
    <li>Seleccione <strong>"Pagar"</strong> → <strong>"Serviços"</strong></li>
    <li>Entidade: <strong>${entidade}</strong> · Referência: <strong>${referencia}</strong></li>
    <li>Ou ligue <strong>*840#</strong> e siga as instruções</li>
    <li>Ou pague directamente ao número <strong>${telefone}</strong> com a descrição da referência</li>` : '';

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<title>Referência Multicaixa – ${nomeCompleto}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;color:#111;font-size:10pt}
.doc{background:white;width:210mm;margin:8mm auto;padding:14mm 16mm;border:1px solid #ddd;border-radius:4px}
@media print{
  body{background:white}
  .doc{margin:0;border:none;width:100%;padding:12mm}
  .no-print{display:none!important}
}
.header{display:flex;align-items:center;gap:14px;margin-bottom:12px;border-bottom:3px solid #00A651;padding-bottom:10px}
.logo-box{width:54px;height:54px;background:#00A651;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:20pt;font-weight:900;flex-shrink:0}
.escola-info{flex:1}
.escola-nome{font-size:13pt;font-weight:700;color:#1a2b5f}
.escola-sub{font-size:7.5pt;color:#6b7280;margin-top:2px}
.mcx-badge{background:#00A651;color:white;padding:6px 12px;border-radius:6px;text-align:center}
.mcx-badge-label{font-size:6pt;letter-spacing:1.5px;opacity:.8;text-transform:uppercase}
.mcx-badge-val{font-size:9pt;font-weight:700}
.ref-card{background:linear-gradient(135deg,#1a2b5f 0%,#243c7a 100%);color:white;border-radius:10px;padding:16px 20px;margin:12px 0;display:flex;align-items:center;gap:16px}
.ref-info{flex:1}
.ref-entidade-label{font-size:7pt;opacity:.7;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px}
.ref-entidade-val{font-size:22pt;font-weight:900;letter-spacing:4px;font-family:monospace}
.ref-num-label{font-size:7pt;opacity:.7;letter-spacing:1px;text-transform:uppercase;margin:8px 0 2px}
.ref-num-val{font-size:26pt;font-weight:900;letter-spacing:6px;font-family:monospace;color:#fbbf24}
.ref-valor{font-size:14pt;font-weight:700;color:#86efac;margin-top:8px}
.ref-validade{font-size:8pt;opacity:.7;margin-top:4px}
.qr-box{background:white;border-radius:8px;padding:8px;flex-shrink:0}
.qr-box img{display:block;width:140px;height:140px}
.aluno-section{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f8fafc;border-radius:6px;padding:8px 12px;border:1px solid #e2e8f0;margin-bottom:12px}
.aluno-field{display:flex;flex-direction:column}
.aluno-label{font-size:6.5pt;color:#9ca3af;text-transform:uppercase;letter-spacing:1px}
.aluno-value{font-size:9pt;font-weight:600;color:#1e293b}
.instrucoes{margin:12px 0}
.instr-titulo{font-size:9pt;font-weight:700;color:#1a2b5f;letter-spacing:.5px;border-left:3px solid #00A651;padding-left:8px;margin-bottom:8px}
.instr-lista{list-style:none;padding:0}
.instr-lista li{padding:5px 8px;font-size:9pt;border-bottom:1px solid #f3f4f6;display:flex;gap:8px;align-items:flex-start}
.instr-lista li::before{content:"→";color:#00A651;font-weight:700;flex-shrink:0}
.aviso{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;font-size:8pt;color:#92400e;margin:10px 0}
.rodape{text-align:center;font-size:6.5pt;color:#9ca3af;margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:6px}
.print-btn{position:fixed;top:10px;right:10px;background:#00A651;color:white;border:none;padding:10px 18px;border-radius:8px;font-size:11pt;cursor:pointer;z-index:999}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
<div class="doc">
  <div class="header">
    <div class="logo-box">M</div>
    <div class="escola-info">
      <div class="escola-nome">${escolaNome}</div>
      <div class="escola-sub">Referência de Pagamento Multicaixa</div>
    </div>
    <div class="mcx-badge">
      <div class="mcx-badge-label">Sistema</div>
      <div class="mcx-badge-val">Multicaixa</div>
    </div>
  </div>

  <div class="ref-card">
    <div class="ref-info">
      <div class="ref-entidade-label">Entidade</div>
      <div class="ref-entidade-val">${entidade}</div>
      <div class="ref-num-label">Referência</div>
      <div class="ref-num-val">${referencia}</div>
      <div class="ref-valor">${fmtMoney(valor)} AOA</div>
      <div class="ref-validade">Válida até ${validade}</div>
    </div>
    <div class="qr-box">
      <img src="${qrUrl}" alt="QR Code" onerror="this.style.display='none'"/>
    </div>
  </div>

  <div class="aluno-section">
    <div class="aluno-field"><span class="aluno-label">Nome do Aluno</span><span class="aluno-value">${nomeCompleto}</span></div>
    <div class="aluno-field"><span class="aluno-label">Nº de Matrícula</span><span class="aluno-value">${aluno?.numeroMatricula || '—'}</span></div>
    <div class="aluno-field"><span class="aluno-label">Turma / Classe</span><span class="aluno-value">${turma?.nome || '—'}</span></div>
    <div class="aluno-field"><span class="aluno-label">Descrição do Pagamento</span><span class="aluno-value">${taxa?.descricao || taxa?.nome || '—'}</span></div>
    <div class="aluno-field"><span class="aluno-label">Data de Emissão</span><span class="aluno-value">${hoje}</span></div>
    <div class="aluno-field"><span class="aluno-label">Validade da Referência</span><span class="aluno-value">${validade}</span></div>
  </div>

  <div class="instrucoes">
    <div class="instr-titulo">Como pagar na ATM / Balcão Bancário</div>
    <ol class="instr-lista">${passosCash}</ol>
  </div>

  ${telefone ? `<div class="instrucoes">
    <div class="instr-titulo">Como pagar via Multicaixa Express</div>
    <ol class="instr-lista">${passosExpress}</ol>
  </div>` : ''}

  <div class="aviso">
    ⚠ Após efectuar o pagamento, guarde o comprovativo e apresente-o na secretaria para confirmar o pagamento no sistema.
    Esta referência é válida até <strong>${validade}</strong>. Após essa data deverá solicitar uma nova referência.
  </div>

  <div class="rodape">Emitido em ${hoje} · ${escolaNome} · Referência gerada pelo sistema SIGA</div>
</div>
${autoprint ? `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>` : ''}
</body>
</html>`;
}

export function registerPDFRoutes(app: Express) {
  // ─── RECIBO INDIVIDUAL ───
  app.get('/api/pdf/recibo/:pagamentoId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { pagamentoId } = req.params;
      const autoprint = req.query.autoprint !== 'false';

      const rows = await query<any>(`SELECT * FROM public.pagamentos WHERE id=$1`, [pagamentoId]);
      if (!rows.length) return res.status(404).json({ error: 'Pagamento não encontrado' });
      const p = rows[0];

      const alunoRows = await query<any>(`SELECT * FROM public.alunos WHERE id=$1`, [p.alunoId]);
      const aluno = alunoRows[0] || null;

      const turmaRows = aluno?.turmaId
        ? await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [aluno.turmaId])
        : [];
      const turma = turmaRows[0] || null;

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};

      const body = buildReciboBody(p, aluno, turma, 0);
      const escolaNome = config.nomeEscola || 'Escola';

      if (config.nomeEscola) {
        const logoHtml = config.logoUrl
          ? `<img src="${config.logoUrl}" style="width:56px;height:56px;object-fit:contain;border-radius:8px"/>`
          : `<div class="logo-box"><div class="logo-inner"><div style="font-size:18pt;font-weight:900;color:white">${escolaNome.charAt(0)}</div></div></div>`;

        const updatedBody = body
          .replace('<div class="logo-box"><div class="logo-inner"><div style="font-size:18pt;font-weight:900;color:white;letter-spacing:-1px;">A</div></div></div>', logoHtml)
          .replace('<div class="escola-nome">ESCOLA</div>', `<div class="escola-nome">${escolaNome}</div>`);

        const html = buildPageHTML([updatedBody], escolaNome, autoprint);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      }

      const html = buildPageHTML([body], escolaNome, autoprint);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── RECIBOS POR ALUNO ───
  app.get('/api/pdf/recibos-aluno/:alunoId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      const { mes, ano, status, autoprint } = req.query as Record<string, string>;

      let sql = `SELECT * FROM public.pagamentos WHERE "alunoId"=$1`;
      const params: any[] = [alunoId];
      if (mes) { sql += ` AND mes=$${params.length+1}`; params.push(Number(mes)); }
      if (ano) { sql += ` AND ano=$${params.length+1}`; params.push(ano); }
      if (status) { sql += ` AND status=$${params.length+1}`; params.push(status); }
      sql += ` ORDER BY ano, mes`;

      const rows = await query<any>(sql, params);
      if (!rows.length) return res.status(404).send('<h3>Nenhum pagamento encontrado</h3>');

      const alunoRows = await query<any>(`SELECT * FROM public.alunos WHERE id=$1`, [alunoId]);
      const aluno = alunoRows[0] || null;

      const turmaRows = aluno?.turmaId
        ? await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [aluno.turmaId])
        : [];
      const turma = turmaRows[0] || null;

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};
      const escolaNome = config.nomeEscola || 'Escola';

      const bodies = rows.map((p: any, i: number) => buildReciboBody(p, aluno, turma, i));
      const html = buildPageHTML(bodies, escolaNome, autoprint !== 'false');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── RECIBOS POR TURMA ───
  app.get('/api/pdf/recibos-turma/:turmaId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId } = req.params;
      const { mes, ano, status } = req.query as Record<string, string>;

      const alunoRows = await query<any>(`SELECT * FROM public.alunos WHERE "turmaId"=$1 ORDER BY "nomeCompleto"`, [turmaId]);
      if (!alunoRows.length) return res.status(404).send('<h3>Nenhum aluno encontrado</h3>');

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};
      const escolaNome = config.nomeEscola || 'Escola';

      const turmaDbRows = await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [turmaId]);
      const turma = turmaDbRows[0] || null;

      const alunoIds = alunoRows.map((a: any) => a.id);
      let sql = `SELECT * FROM public.pagamentos WHERE "alunoId" = ANY($1::text[])`;
      const params: any[] = [alunoIds];
      if (mes) { sql += ` AND mes=$${params.length+1}`; params.push(Number(mes)); }
      if (ano) { sql += ` AND ano=$${params.length+1}`; params.push(ano); }
      if (status) { sql += ` AND status=$${params.length+1}`; params.push(status); }
      sql += ` ORDER BY "alunoId", ano, mes`;

      const pagRows = await query<any>(sql, params);
      if (!pagRows.length) return res.status(404).send('<h3>Nenhum pagamento encontrado para os filtros aplicados</h3>');

      const alunoMap = Object.fromEntries(alunoRows.map((a: any) => [a.id, a]));
      const grouped: Record<string, any[]> = {};
      for (const p of pagRows) {
        if (!grouped[p.alunoId]) grouped[p.alunoId] = [];
        grouped[p.alunoId].push(p);
      }

      const bodies: string[] = [];
      let globalIdx = 0;
      for (const [alunoId, pags] of Object.entries(grouped)) {
        const aluno = alunoMap[alunoId];
        for (const pag of pags) {
          bodies.push(buildReciboBody(pag, aluno, turma, globalIdx++));
        }
      }

      const html = buildPageHTML(bodies, escolaNome, false);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── RECIBOS PENDENTES ───
  app.get('/api/pdf/recibos-pendentes', requireAuth, async (req: Request, res: Response) => {
    try {
      const { metodo, ano } = req.query as Record<string, string>;

      let sql = `SELECT * FROM public.pagamentos WHERE status='pendente'`;
      const params: any[] = [];
      if (metodo) { sql += ` AND "metodoPagamento"=$${params.length+1}`; params.push(metodo); }
      if (ano) { sql += ` AND ano=$${params.length+1}`; params.push(ano); }
      sql += ` ORDER BY "createdAt" DESC`;

      const pagRows = await query<any>(sql, params);
      if (!pagRows.length) return res.status(404).send('<h3>Nenhum pagamento pendente</h3>');

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};
      const escolaNome = config.nomeEscola || 'Escola';

      const bodies: string[] = [];
      for (let i = 0; i < pagRows.length; i++) {
        const p = pagRows[i];
        const alunoRows = await query<any>(`SELECT * FROM public.alunos WHERE id=$1`, [p.alunoId]);
        const aluno = alunoRows[0] || null;
        const turmaRows = aluno?.turmaId
          ? await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [aluno.turmaId])
          : [];
        bodies.push(buildReciboBody(p, aluno, turmaRows[0] || null, i));
      }

      const html = buildPageHTML(bodies, escolaNome, false);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── BOLETIM DE NOTAS ───
  app.get('/api/pdf/boletim/:alunoId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      const { trimestre, autoprint } = req.query as Record<string, string>;

      const alunoRows = await query<any>(`SELECT * FROM public.alunos WHERE id=$1`, [alunoId]);
      if (!alunoRows.length) return res.status(404).json({ error: 'Aluno não encontrado' });
      const aluno = alunoRows[0];

      const turmaRows = aluno.turmaId
        ? await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [aluno.turmaId])
        : [];
      const turma = turmaRows[0] || null;

      let notasSql = `SELECT * FROM public.notas WHERE "alunoId"=$1`;
      const notasParams: any[] = [alunoId];
      if (trimestre) {
        notasSql += ` AND trimestre=$${notasParams.length+1}`;
        notasParams.push(Number(trimestre));
      }
      notasSql += ` ORDER BY disciplina, trimestre`;
      const notas = await query<any>(notasSql, notasParams);

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};

      const html = buildBoletimHTML(aluno, turma, notas, config, trimestre ? Number(trimestre) : null, autoprint !== 'false');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── DECLARAÇÃO ───
  app.get('/api/pdf/declaracao/:alunoId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      const tipo = (req.query.tipo as string) || 'matricula';
      const autoprint = req.query.autoprint !== 'false';

      const alunoRows = await query<any>(`SELECT * FROM public.alunos WHERE id=$1`, [alunoId]);
      if (!alunoRows.length) return res.status(404).json({ error: 'Aluno não encontrado' });
      const aluno = alunoRows[0];

      const turmaRows = aluno.turmaId
        ? await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [aluno.turmaId])
        : [];
      const turma = turmaRows[0] || null;

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};

      const html = buildDeclaracaoHTML(aluno, turma, config, tipo, autoprint);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── RELATÓRIO DE TURMA ───
  app.get('/api/pdf/relatorio-turma/:turmaId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId } = req.params;
      const trimestre = Number(req.query.trimestre) || 1;
      const autoprint = req.query.autoprint !== 'false';

      const turmaRows = await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [turmaId]);
      if (!turmaRows.length) return res.status(404).json({ error: 'Turma não encontrada' });
      const turma = turmaRows[0];

      const alunoRows = await query<any>(
        `SELECT * FROM public.alunos WHERE "turmaId"=$1 AND ativo=true ORDER BY nome, apelido`,
        [turmaId]
      );

      const alunoIds = alunoRows.map((a: any) => a.id);
      const notas = alunoIds.length
        ? await query<any>(
            `SELECT * FROM public.notas WHERE "alunoId" = ANY($1::text[]) AND trimestre=$2 ORDER BY disciplina`,
            [alunoIds, trimestre]
          )
        : [];

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};

      const html = buildRelatorioTurmaHTML(turma, alunoRows, notas, config, trimestre, autoprint);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── REFERÊNCIA MULTICAIXA ───
  app.get('/api/pdf/multicaixa/:rupeId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { rupeId } = req.params;
      const autoprint = req.query.autoprint !== 'false';

      const rupeRows = await query<any>(`SELECT * FROM public.rupes WHERE id=$1`, [rupeId]);
      if (!rupeRows.length) return res.status(404).json({ error: 'Referência não encontrada' });
      const rupe = rupeRows[0];

      const alunoRows = await query<any>(`SELECT * FROM public.alunos WHERE id=$1`, [rupe.alunoId]);
      const aluno = alunoRows[0] || null;

      const turmaRows = aluno?.turmaId
        ? await query<any>(`SELECT * FROM public.turmas WHERE id=$1`, [aluno.turmaId])
        : [];
      const turma = turmaRows[0] || null;

      const taxaRows = await query<any>(`SELECT * FROM public.taxas WHERE id=$1`, [rupe.taxaId]);
      const taxa = taxaRows[0] || null;

      const configRows = await query<any>(`SELECT * FROM public.config_geral LIMIT 1`, []);
      const config = configRows[0] || {};

      const html = buildMulticaixaHTML(aluno, turma, taxa, config, rupe.referencia, rupe.valor, rupe.dataValidade, autoprint);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── GERAR REFERÊNCIA MULTICAIXA (nova, sem rupe existente) ───
  app.post('/api/pdf/multicaixa/gerar', requireAuth, async (req: Request, res: Response) => {
    try {
      const { alunoId, taxaId, valor, mes, ano } = req.body;
      if (!alunoId || !taxaId || !valor) {
        return res.status(400).json({ error: 'alunoId, taxaId e valor são obrigatórios' });
      }

      const countRows = await query<any>(`SELECT COUNT(*) as cnt FROM public.rupes`, []);
      const seq = Number(countRows[0]?.cnt || 0) + 1;
      const referencia = gerarRefMulticaixa(alunoId, taxaId, seq);

      const dataGeracao = new Date().toISOString().split('T')[0];
      const dataValidade = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const rupeRows = await query<any>(
        `INSERT INTO public.rupes (id,"alunoId","taxaId","valor","referencia","dataGeracao","dataValidade","status")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,'ativo') RETURNING *`,
        [alunoId, taxaId, Number(valor), referencia, dataGeracao, dataValidade]
      );
      const rupe = rupeRows[0];

      res.json({ rupe, referencia, dataValidade });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
