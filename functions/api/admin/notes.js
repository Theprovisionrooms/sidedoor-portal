// Security notes: a known scam or threat, explained, and what it means for them.
import { json, readBody, requireAdmin, text, uid } from '../../../lib/http.js';
import { notifyLater } from '../../../lib/notify.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { results } = await ctx.env.DB.prepare(
    'SELECT n.*, c.business_name FROM security_notes n LEFT JOIN clients c ON c.id = n.client_id ORDER BY n.created_at DESC LIMIT 100'
  ).all();
  return json({ notes: results });
}

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const b = await readBody(request);
  const verdict = ['not_affected', 'handled', 'action'].includes(b.verdict) ? b.verdict : 'not_affected';
  const title = text(b.title, { required: true, max: 140, label: 'Title' });
  const body = text(b.body, { required: true, max: 3000, label: 'What it is' });
  const clientId = b.client_id || null;
  await env.DB.prepare('INSERT INTO security_notes (id, title, body, verdict, client_id) VALUES (?, ?, ?, ?, ?)')
    .bind(uid(), title, body, verdict, clientId).run();
  if (b.notify) {
    const to = clientId ? { clientId } : { userIds: (await env.DB.prepare("SELECT id FROM users WHERE role = 'client'").all()).results.map((r) => r.id) };
    notifyLater(ctx, to, { title: verdict === 'action' ? 'Security: one thing to do' : 'Security heads-up', body: title, url: '/#/security' });
  }
  return json({ ok: true }, 201);
}

export async function onRequestDelete(ctx) {
  requireAdmin(ctx);
  await ctx.env.DB.prepare('DELETE FROM security_notes WHERE id = ?').bind(new URL(ctx.request.url).searchParams.get('id')).run();
  return json({ ok: true });
}
