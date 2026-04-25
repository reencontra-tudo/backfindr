export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ── CSV helpers ───────────────────────────────────────────────────────────────
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[], headers: { key: string; label: string }[]): string {
  const head = headers.map(h => escapeCsv(h.label)).join(',');
  const body = rows.map(row =>
    headers.map(h => escapeCsv(row[h.key])).join(',')
  );
  return [head, ...body].join('\r\n');
}

// ── HTML→PDF template ─────────────────────────────────────────────────────────
function toHtmlReport(
  title: string,
  subtitle: string,
  headers: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  summary: { label: string; value: string | number }[]
): string {
  const tableHead = headers.map(h => `<th>${h.label}</th>`).join('');
  const tableBody = rows.map(row =>
    `<tr>${headers.map(h => `<td>${escapeCsv(row[h.key])}</td>`).join('')}</tr>`
  ).join('');
  const summaryHtml = summary.map(s =>
    `<div class="stat"><span class="stat-label">${s.label}</span><span class="stat-value">${s.value}</span></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #0d9488; padding-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 700; color: #0d9488; letter-spacing: -0.5px; }
  .brand span { color: #111; }
  .title { font-size: 18px; font-weight: 600; color: #111; margin-top: 4px; }
  .subtitle { font-size: 12px; color: #666; margin-top: 2px; }
  .meta { text-align: right; font-size: 11px; color: #888; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .stat { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 12px 16px; min-width: 120px; }
  .stat-label { display: block; font-size: 10px; color: #0d9488; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
  .stat-value { display: block; font-size: 20px; font-weight: 700; color: #111; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead { background: #0d9488; color: #fff; }
  th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) td { background: #f9fafb; }
  tr:hover td { background: #f0fdfa; }
  .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">back<span>findr</span></div>
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
  </div>
  <div class="meta">
    Gerado em: ${new Date().toLocaleString('pt-BR')}<br>
    Painel Administrativo
  </div>
</div>
<div class="summary">${summaryHtml}</div>
<table>
  <thead><tr>${tableHead}</tr></thead>
  <tbody>${tableBody}</tbody>
</table>
<div class="footer">Backfindr — Relatório gerado automaticamente. Uso interno.</div>
<script class="no-print">window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

// ── Labels ────────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', pet: 'Pet',
  electronics: 'Eletrônicos', document: 'Documento', bike: 'Bicicleta',
  vehicle: 'Veículo', other: 'Outros',
};
const STATUS_LABELS: Record<string, string> = {
  lost: 'Perdido', found: 'Encontrado', stolen: 'Roubado',
  returned: 'Devolvido', protected: 'Protegido',
};
const PLAN_LABELS: Record<string, string> = {
  free: 'Free', pro: 'Pro', business: 'Business',
};

// ── GET /api/v1/admin/reports/export ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const type     = searchParams.get('type')      ?? 'objects';
  const format   = searchParams.get('format')    ?? 'csv';
  const category = searchParams.get('category')  ?? '';
  const status   = searchParams.get('status')    ?? '';
  const plan     = searchParams.get('plan')      ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo   = searchParams.get('date_to')   ?? '';

  let csvData  = '';
  let htmlData = '';
  let filename = '';

  try {
    // ── OBJECTS ────────────────────────────────────────────────────────────────
    if (type === 'objects') {
      const conditions: string[] = [];
      const params: unknown[]    = [];
      let idx = 1;

      if (category) { conditions.push(`o.category = $${idx}`); params.push(category); idx++; }
      if (status)   { conditions.push(`o.status = $${idx}`);   params.push(status);   idx++; }
      if (dateFrom) { conditions.push(`o.created_at >= $${idx}`); params.push(dateFrom); idx++; }
      if (dateTo)   { conditions.push(`o.created_at <= $${idx}`); params.push(dateTo + 'T23:59:59'); idx++; }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const res = await query(
        `SELECT o.id, o.title, o.category, o.status, o.is_boosted, o.is_public,
                o.created_at,
                u.name AS owner_username, u.email AS owner_email, u.plan AS owner_plan
         FROM objects o
         LEFT JOIN users u ON u.id = o.user_id
         ${where}
         ORDER BY o.created_at DESC
         LIMIT 5000`,
        params
      );

      const rows = res.rows.map((o: Record<string, unknown>) => ({
        id:          String(o.id ?? '').slice(0, 8),
        title:       o.title,
        category:    CATEGORY_LABELS[o.category as string] ?? o.category,
        status:      STATUS_LABELS[o.status as string]     ?? o.status,
        owner:       o.owner_username ?? '',
        owner_email: o.owner_email    ?? '',
        plan:        PLAN_LABELS[o.owner_plan as string]   ?? o.owner_plan ?? 'Free',
        boosted:     o.is_boosted ? 'Sim' : 'Não',
        public:      o.is_public  ? 'Sim' : 'Não',
        created_at:  o.created_at ? new Date(o.created_at as string).toLocaleString('pt-BR') : '',
      }));

      const headers = [
        { key: 'id',          label: 'ID' },
        { key: 'title',       label: 'Título' },
        { key: 'category',    label: 'Categoria' },
        { key: 'status',      label: 'Status' },
        { key: 'owner',       label: 'Dono' },
        { key: 'owner_email', label: 'E-mail' },
        { key: 'plan',        label: 'Plano' },
        { key: 'boosted',     label: 'Boost' },
        { key: 'public',      label: 'Público' },
        { key: 'created_at',  label: 'Cadastrado em' },
      ];

      const total       = rows.length;
      const boosted     = rows.filter(r => r.boosted === 'Sim').length;
      const byStatus: Record<string, number>   = {};
      const byCategory: Record<string, number> = {};
      rows.forEach(r => {
        byStatus[r.status as string]     = (byStatus[r.status as string]     ?? 0) + 1;
        byCategory[r.category as string] = (byCategory[r.category as string] ?? 0) + 1;
      });
      const topStatus   = Object.entries(byStatus).sort((a, b)   => b[1] - a[1])[0];
      const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

      const summary = [
        { label: 'Total',            value: total },
        { label: 'Com Boost',        value: boosted },
        { label: 'Status + comum',   value: topStatus   ? `${topStatus[0]} (${topStatus[1]})`     : '-' },
        { label: 'Categoria + comum',value: topCategory ? `${topCategory[0]} (${topCategory[1]})` : '-' },
      ];

      const subtitle = [
        category ? `Categoria: ${CATEGORY_LABELS[category] ?? category}` : '',
        status   ? `Status: ${STATUS_LABELS[status] ?? status}`           : '',
        dateFrom ? `De: ${dateFrom}`                                       : '',
        dateTo   ? `Até: ${dateTo}`                                        : '',
      ].filter(Boolean).join(' | ') || 'Todos os filtros';

      csvData  = toCsv(rows, headers);
      htmlData = toHtmlReport('Relatório de Objetos', subtitle, headers, rows, summary);
      filename = `objetos_${new Date().toISOString().slice(0, 10)}`;
    }

    // ── USERS ──────────────────────────────────────────────────────────────────
    else if (type === 'users') {
      const conditions: string[] = [];
      const params: unknown[]    = [];
      let idx = 1;

      if (plan === 'inactive') {
        conditions.push(`u.updated_at < NOW() - INTERVAL '90 days'`);
      } else if (plan) {
        conditions.push(`u.plan = $${idx}`); params.push(plan); idx++;
      }
      if (dateFrom) { conditions.push(`u.created_at >= $${idx}`); params.push(dateFrom); idx++; }
      if (dateTo)   { conditions.push(`u.created_at <= $${idx}`); params.push(dateTo + 'T23:59:59'); idx++; }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const res = await query(
        `SELECT u.id, u.name, u.email, u.plan, u.role, u.created_at
         FROM users u
         ${where}
         ORDER BY u.created_at DESC
         LIMIT 5000`,
        params
      );

      const rows = res.rows.map((u: Record<string, unknown>) => ({
        id:         String(u.id ?? '').slice(0, 8),
        username:   u.name,
        email:      u.email,
        plan:       PLAN_LABELS[u.plan as string] ?? u.plan ?? 'Free',
        role:       u.role,
        active:     'Sim', // campo informativo — sem coluna is_active na tabela
        created_at: u.created_at ? new Date(u.created_at as string).toLocaleString('pt-BR') : '',
      }));

      const headers = [
        { key: 'id',         label: 'ID' },
        { key: 'username',   label: 'Usuário' },
        { key: 'email',      label: 'E-mail' },
        { key: 'plan',       label: 'Plano' },
        { key: 'role',       label: 'Papel' },
        { key: 'active',     label: 'Ativo' },
        { key: 'created_at', label: 'Cadastrado em' },
      ];

      const total = rows.length;
      const byPlan: Record<string, number> = {};
      rows.forEach(r => { byPlan[r.plan as string] = (byPlan[r.plan as string] ?? 0) + 1; });

      const summary = [
        { label: 'Total',    value: total },
        { label: 'Free',     value: byPlan['Free']     ?? 0 },
        { label: 'Pro',      value: byPlan['Pro']      ?? 0 },
        { label: 'Business', value: byPlan['Business'] ?? 0 },
      ];

      const subtitle = [
        plan     ? `Plano: ${PLAN_LABELS[plan] ?? plan}` : '',
        dateFrom ? `De: ${dateFrom}`                      : '',
        dateTo   ? `Até: ${dateTo}`                       : '',
      ].filter(Boolean).join(' | ') || 'Todos os filtros';

      csvData  = toCsv(rows, headers);
      htmlData = toHtmlReport('Relatório de Usuários', subtitle, headers, rows, summary);
      filename = `usuarios_${new Date().toISOString().slice(0, 10)}`;
    }

    // ── PUBLICATIONS ───────────────────────────────────────────────────────────
    else if (type === 'publications') {
      const conditions: string[] = [];
      const params: unknown[]    = [];
      let idx = 1;

      if (status)   { conditions.push(`oc.status = $${idx}`);       params.push(status);   idx++; }
      if (dateFrom) { conditions.push(`oc.created_at >= $${idx}`);  params.push(dateFrom); idx++; }
      if (dateTo)   { conditions.push(`oc.created_at <= $${idx}`);  params.push(dateTo + 'T23:59:59'); idx++; }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const res = await query(
        `SELECT oc.id, oc.status, oc.location_text, oc.match_count, oc.created_at,
                o.title AS obj_title, o.category AS obj_category,
                u.name AS owner_username, u.email AS owner_email
         FROM occurrences oc
         LEFT JOIN objects o ON o.id = oc.object_id
         LEFT JOIN users u   ON u.id = oc.user_id
         ${where}
         ORDER BY oc.created_at DESC
         LIMIT 5000`,
        params
      );

      const rows = res.rows.map((p: Record<string, unknown>) => ({
        id:          String(p.id ?? '').slice(0, 8),
        title:       p.obj_title    ?? '',
        category:    CATEGORY_LABELS[p.obj_category as string] ?? p.obj_category ?? '',
        status:      STATUS_LABELS[p.status as string]         ?? p.status,
        location:    p.location_text ?? '',
        matches:     p.match_count   ?? 0,
        owner:       p.owner_username ?? '',
        owner_email: p.owner_email    ?? '',
        created_at:  p.created_at ? new Date(p.created_at as string).toLocaleString('pt-BR') : '',
      }));

      const headers = [
        { key: 'id',          label: 'ID' },
        { key: 'title',       label: 'Objeto' },
        { key: 'category',    label: 'Categoria' },
        { key: 'status',      label: 'Status' },
        { key: 'location',    label: 'Local' },
        { key: 'matches',     label: 'Matches' },
        { key: 'owner',       label: 'Usuário' },
        { key: 'owner_email', label: 'E-mail' },
        { key: 'created_at',  label: 'Data' },
      ];

      const total        = rows.length;
      const totalMatches = rows.reduce((acc: number, r) => acc + Number(r.matches ?? 0), 0);
      const byStatus: Record<string, number> = {};
      rows.forEach(r => { byStatus[r.status as string] = (byStatus[r.status as string] ?? 0) + 1; });

      const summary = [
        { label: 'Total',        value: total },
        { label: 'Total Matches',value: totalMatches },
        { label: 'Perdidos',     value: byStatus['Perdido']    ?? 0 },
        { label: 'Encontrados',  value: byStatus['Encontrado'] ?? 0 },
      ];

      const subtitle = [
        status   ? `Status: ${STATUS_LABELS[status] ?? status}` : '',
        dateFrom ? `De: ${dateFrom}`                             : '',
        dateTo   ? `Até: ${dateTo}`                              : '',
      ].filter(Boolean).join(' | ') || 'Todos os filtros';

      csvData  = toCsv(rows, headers);
      htmlData = toHtmlReport('Relatório de Publicações', subtitle, headers, rows, summary);
      filename = `publicacoes_${new Date().toISOString().slice(0, 10)}`;
    } else {
      return NextResponse.json({ error: 'Tipo inválido. Use: objects, users, publications' }, { status: 400 });
    }
  } catch (e) {
    console.error('[reports/export]', e);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }

  // ── Return CSV ───────────────────────────────────────────────────────────────
  if (format === 'csv') {
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // ── Return HTML (for PDF print) ───────────────────────────────────────────
  if (format === 'pdf') {
    return new NextResponse(htmlData, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({ error: 'Formato inválido. Use: csv ou pdf' }, { status: 400 });
}
