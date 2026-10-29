// Jordan posts updates: new things in the app, news, a heads-up. To everyone or one client.
import { json, readBody, requireAdmin, text, uid, HttpError } from '../../../lib/http.js';
import { notifyLater } from '../../../lib/notify.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { results } = await ctx.env.DB.prepare(
    `SELECT u.*, c.business_name, (SELECT COUNT(*) FROM update_reads r WHERE r.update_id = u.id) AS reads
       FROM updates u LEFT JOIN clients c ON c.id = u.client_id ORDER BY u.created_at DESC LIMIT 100`
  ).all();
  const { n } = await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'client'").first();
  return json({ updates: results, client_users: n });
}

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env } = ctx;
  const b = await readBody(ctx.request);
  const title = text(b.title, { required: true, max: 120, label: 'Title' });
  const body = text(b.body, { required: true, max: 3000, label: 'Message' });
  const label = text(b.link_label, { max: 40, label: 'Button text' }) || null;
  const url = text(b.link_url, { max: 300, label: 'Button link' }) || null;
  if (url && !/^(#\/|https:\/\/)/.test(url)) throw new HttpError(400, 'Link should start with #/ (in the app) or https://');
  const clientId = b.client_id || null;
  await env.DB.prepare('INSERT INTO updates (id, title, body, link_label, link_url, client_id) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(uid(), title, body, label && url ? label : null, label && url ? url : null, clientId).run();
  if (b.notify) {
    const to = clientId ? { clientId } : { userIds: (await env.DB.prepare("SELECT id FROM users WHERE role = 'client'").all()).results.map((r) => r.id) };
    notifyLater(ctx, to, { title: `From Jordan: ${title}`, body: body.slice(0, 120), url: '/#/updates' });
  }
  return json({ ok: true }, 201);
}

export async function onRequestDelete(ctx) {
  requireAdmin(ctx);
  await ctx.env.DB.prepare('DELETE FROM updates WHERE id = ?').bind(new URL(ctx.request.url).searchParams.get('id')).run();
  return json({ ok: true });
}
