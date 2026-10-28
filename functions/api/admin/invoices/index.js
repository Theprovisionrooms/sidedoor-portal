// One-off invoices: build deposit, build balance, anything else.
import { json, readBody, requireAdmin, text, HttpError } from '../../../../lib/http.js';
import { createInvoice, loadInvoice, sendInvoice, parseLines } from '../../../../lib/billing.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const b = await readBody(request);
  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ?').bind(String(b.client_id || '')).first();
  if (!client) throw new HttpError(404, "Couldn't find that client");
  const kind = b.kind === 'build' ? 'build' : 'other';
  const due = b.due_date ? String(b.due_date) : null;
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new HttpError(400, 'Due date should be a date');
  const id = await createInvoice(env, {
    clientId: client.id, kind,
    title: text(b.title, { required: true, max: 120, label: 'Title' }),
    lines: parseLines(b.lines),
    note: text(b.note, { max: 1000, label: 'Note' }),
    dueDate: due
  });
  const invoice = b.send ? await sendInvoice(env, id, { waitUntil: (p) => ctx.waitUntil(p) }) : await loadInvoice(env, id);
  return json({ invoice }, 201);
}
