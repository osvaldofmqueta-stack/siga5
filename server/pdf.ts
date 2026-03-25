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

export function registerPDFRoutes(app: Express) {
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
}
