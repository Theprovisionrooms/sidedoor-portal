// Behind-the-scenes log. Leave the client blank to show an entry to everyone.
import { json, readBody, requireAdmin, text, uid, HttpError } from '../../../lib/http.js';
import { notifyLater } from '../../../lib/notify.js';

const KINDS = ['security', 'update', 'backup', 'speed', 'other'];

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const b = await readBody(request);
  const clientId = b.client_id ? String(b.client_id) : null;
  if (clientId && !(await env.DB.prepare('SELECT 1 FROM clients WHERE id = ?').bind(clientId).first())) throw new HttpError(404, "Couldn't find that client");
  const kind = KINDS.includes(b.kind) ? b.kind : 'update';
  const title = text(b.title, { required: true, max: 140, label: 'What you did' });
  const body = text(b.body, { max: 2000, label: 'Details' }) || null;
  const id = uid();
  await env.DB.prepare('INSERT INTO work_log (id, client_id, site_id, kind, title, body) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, clientId, b.site_id || null, kind, title, body).run();
  if (b.notify && clientId) notifyLater(ctx, { clientId }, { title: 'Behind the scenes', body: title, url: '/#/site' });
  return json({ ok: true, id }, 201);
}

export async function onRequestDelete(ctx) {
  requireAdmin(ctx);
  const id = new URL(ctx.request.url).searchParams.get('id');
  await ctx.env.DB.prepare('DELETE FROM work_log WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
