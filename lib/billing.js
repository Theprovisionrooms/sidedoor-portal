// Invoices: monthly fee + finished change work, bundled on the 1st. Paid via Revolut link.
// Intellectual property of Sidedoor Digital.
import { HttpError, uid, now, chargePence, text } from './http.js';
import { notify } from './notify.js';

const fmtMoney = (p) => `£${(p / 100).toFixed(2)}`;
const fmtTime = (m) => (m < 60 ? `${m} mins` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} mins` : `${m / 60} hr`);

export function monthName(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function currentPeriod(date = new Date()) {
  // UK time, so the run on the 1st lands in the right month.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`;
}
export function ukDay(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric' }).format(date));
}
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

// Revolut links can carry the amount: put {amount} where it goes, e.g. https://revolut.me/you/{amount}
export function payUrl(link, totalPence) {
  if (!link) return null;
  return link.replace(/\{amount\}/g, (totalPence / 100).toFixed(2));
}

export async function settings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export async function linesFor(env, ids) {
  if (!ids.length) return {};
  const { results } = await env.DB.prepare(
    `SELECT id, invoice_id, description, amount_pence, request_id FROM invoice_lines
      WHERE invoice_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort`
  ).bind(...ids).all();
  const out = {};
  for (const l of results) (out[l.invoice_id] ||= []).push(l);
  return out;
}

export function shapeInvoice(inv, lines = []) {
  const total = lines.reduce((s, l) => s + l.amount_pence, 0);
  const overdue = inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10);
  return {
    id: inv.id,
    number: inv.number,
    ref: `SDD-${String(inv.number).padStart(4, '0')}`,
    client_id: inv.client_id,
    business_name: inv.business_name,
    kind: inv.kind,
    period: inv.period,
    title: inv.title,
    status: inv.status,
    overdue: !!overdue,
    note: inv.note,
    due_date: inv.due_date,
    sent_at: inv.sent_at,
    claimed_paid_at: inv.claimed_paid_at,
    paid_at: inv.paid_at,
    created_at: inv.created_at,
    total_pence: total,
    pay_url: inv.status === 'sent' ? payUrl(inv.pay_link, total) : null,
    pay_link: inv.pay_link,
    lines
  };
}

const SELECT = 'SELECT i.*, c.business_name FROM invoices i JOIN clients c ON c.id = i.client_id';

export async function listInvoices(env, { clientId, statuses, includeDrafts = true } = {}) {
  const where = [], args = [];
  if (clientId) { where.push('i.client_id = ?'); args.push(clientId); }
  if (statuses) { where.push(`i.status IN (${statuses.map(() => '?').join(',')})`); args.push(...statuses); }
  if (!includeDrafts) where.push("i.status != 'draft'");
  const { results } = await env.DB.prepare(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.number DESC LIMIT 300`
  ).bind(...args).all();
  const lines = await linesFor(env, results.map((r) => r.id));
  return results.map((r) => shapeInvoice(r, lines[r.id]));
}

export async function loadInvoice(env, id) {
  const inv = await env.DB.prepare(`${SELECT} WHERE i.id = ?`).bind(id).first();
  if (!inv) throw new HttpError(404, "Couldn't find that invoice");
  return shapeInvoice(inv, (await linesFor(env, [id]))[id]);
}

export async function nextNumber(env) {
  const { n } = await env.DB.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM invoices').first();
  return n;
}

// Creates draft invoices for one period. Safe to run twice: a client already invoiced for the period is skipped.
export async function generateMonthly(env, period = currentPeriod()) {
  const [y, m] = period.split('-').map(Number);
  const periodStart = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const { results: clients } = await env.DB.prepare(
    `SELECT c.id, c.business_name, c.monthly_fee_pence, c.monthly_from FROM clients c
      WHERE c.archived = 0 AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.client_id = c.id AND i.kind = 'monthly' AND i.period = ?)`
  ).bind(period).all();

  let number = await nextNumber(env);
  const created = [];
  for (const c of clients) {
    const { results: work } = await env.DB.prepare(
      `SELECT id, title, logged_minutes, rate_pence FROM requests
        WHERE client_id = ? AND status = 'done' AND invoice_id IS NULL AND logged_minutes > 0 AND completed_at < ?
        ORDER BY completed_at`
    ).bind(c.id, periodStart).all();

    const lines = [];
    const planLive = !c.monthly_from || period >= c.monthly_from;
    if (c.monthly_fee_pence > 0 && planLive) lines.push({ description: `Monthly care plan, ${monthName(period)}`, amount_pence: c.monthly_fee_pence });
    for (const r of work) {
      lines.push({ description: `${r.title} (${fmtTime(r.logged_minutes)})`, amount_pence: chargePence(r.logged_minutes, r.rate_pence), request_id: r.id });
    }
    if (!lines.length) continue;

    const id = uid();
    const stmts = [
      env.DB.prepare(
        `INSERT INTO invoices (id, number, client_id, kind, period, title, status, due_date)
         VALUES (?, ?, ?, 'monthly', ?, ?, 'draft', ?)`
      ).bind(id, number++, c.id, period, monthName(period), `${period}-07`),
      ...lines.map((l, i) => env.DB.prepare(
        'INSERT INTO invoice_lines (id, invoice_id, description, amount_pence, request_id, sort) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(uid(), id, l.description, l.amount_pence, l.request_id || null, i)),
      ...work.map((r) => env.DB.prepare('UPDATE requests SET invoice_id = ? WHERE id = ?').bind(id, r.id))
    ];
    await env.DB.batch(stmts);
    created.push({ id, business_name: c.business_name, total: lines.reduce((s, l) => s + l.amount_pence, 0) });
  }
  return created;
}

export async function createInvoice(env, { clientId, kind, title, lines, note, dueDate }) {
  const id = uid();
  const number = await nextNumber(env);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO invoices (id, number, client_id, kind, title, status, note, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, number, clientId, kind, title, 'draft', note || null, dueDate || null),
    ...lines.map((l, i) => env.DB.prepare('INSERT INTO invoice_lines (id, invoice_id, description, amount_pence, sort) VALUES (?, ?, ?, ?, ?)')
      .bind(uid(), id, l.description, l.amount_pence, i))
  ]);
  return id;
}

// Marks a draft as sent, locks in the pay link, and pings the client's phone.
export async function sendInvoice(env, id, { waitUntil } = {}) {
  const inv = await loadInvoice(env, id);
  if (inv.status !== 'draft') throw new HttpError(409, `${inv.ref} has already been ${inv.status}`);
  const s = await settings(env);
  const client = await env.DB.prepare('SELECT pay_link FROM clients WHERE id = ?').bind(inv.client_id).first();
  const link = inv.pay_link || client.pay_link || s.default_pay_link || null;
  if (!link) throw new HttpError(400, 'Add your Revolut link in Money > Settings first');
  // Always give at least a week from when it actually goes out.
  const weekOut = addDays(now(), 7);
  const due = inv.due_date && inv.due_date >= weekOut ? inv.due_date : weekOut;
  await env.DB.prepare("UPDATE invoices SET status = 'sent', sent_at = ?, pay_link = ?, due_date = ? WHERE id = ?")
    .bind(now(), link, due, id).run();
  const p = notify(env, { clientId: inv.client_id }, {
    title: inv.kind === 'monthly' ? `Your ${inv.title} bill is ready` : `${inv.title}: bill ready`,
    body: `${fmtMoney(inv.total_pence)}. Tap to pay with Revolut.`,
    url: `/#/billing/${inv.id}`
  });
  if (waitUntil) waitUntil(p); else await p;
  return loadInvoice(env, id);
}

export function parseLines(raw) {
  const lines = (Array.isArray(raw) ? raw : []).filter((l) => l && (l.description || l.amount_pence)).map((l) => {
    const amount = Math.round(Number(l.amount_pence));
    if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, 'Each amount needs to be a number');
    return { description: text(l.description, { required: true, max: 200, label: 'Line description' }), amount_pence: amount };
  });
  if (!lines.length) throw new HttpError(400, 'Add at least one line');
  return lines;
}

// Onboarding: record build money already paid, and draft what's still owed.
// Unpaid with nothing paid yet = half now (deposit), half on completion (added later as a one-off).
export function buildInvoiceStmts(env, clientId, c, number) {
  const stmts = [];
  const fee = c.build_fee_pence || 0, paid = Math.min(c.build_paid_pence || 0, fee);
  if (!fee) return { stmts, used: 0 };
  let used = 0;
  const add = (title, amount, status, note) => {
    const id = uid();
    stmts.push(env.DB.prepare(
      `INSERT INTO invoices (id, number, client_id, kind, title, status, note, paid_at) VALUES (?, ?, ?, 'build', ?, ?, ?, ?)`
    ).bind(id, number + used, clientId, title, status, note, status === 'paid' ? now() : null));
    stmts.push(env.DB.prepare('INSERT INTO invoice_lines (id, invoice_id, description, amount_pence, sort) VALUES (?, ?, ?, ?, 0)')
      .bind(uid(), id, title, amount));
    used++;
  };
  if (paid > 0) add(paid >= fee ? 'Website build' : 'Build deposit', paid, 'paid', null);
  const left = fee - paid;
  if (left > 0) {
    const half = paid === 0 ? Math.round(fee / 2) : left;
    add(paid === 0 ? 'Build deposit' : 'Build balance', half, 'draft',
      paid === 0 ? `Half of the £${(fee / 100).toFixed(2)} build to get started. The other half is due once everything is live.` : null);
  }
  return { stmts, used };
}
