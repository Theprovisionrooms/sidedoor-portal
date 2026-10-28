// "Go ahead": turns an idea into an approved request at the price shown. "Not now": hides it for this year.
import { json, readBody, requireUser, uid, now, HttpError, chargePence } from '../../../lib/http.js';
import { ideasFor } from '../../../lib/insights.js';
import { notifyLater } from '../../../lib/notify.js';

const fmtTime = (m) => (m < 60 ? `${m} mins` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} mins` : `${m / 60} hr`);

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { env, params } = ctx;
  const b = await readBody(ctx.request);
  const idea = (await ideasFor(env, user.client_id, { all: true })).find((i) => i.id === params.id);
  if (!idea) throw new HttpError(404, "That idea isn't available");
  if (idea.action === 'requested') return json({ ok: true, request_id: idea.request_id });
  const year = new Date().getUTCFullYear();

  if (b.action === 'dismiss') {
    await env.DB.prepare(
      "INSERT INTO idea_actions (idea_id, client_id, year, action) VALUES (?, ?, ?, 'dismissed') ON CONFLICT(idea_id, client_id, year) DO UPDATE SET action = 'dismissed'"
    ).bind(idea.id, user.client_id, year).run();
    return json({ ok: true });
  }
  if (b.action !== 'go') throw new HttpError(400, 'Unknown action');

  const client = await env.DB.prepare('SELECT hourly_rate_pence, business_name FROM clients WHERE id = ?').bind(user.client_id).first();
  const site = await env.DB.prepare('SELECT id FROM sites WHERE client_id = ? AND url LIKE ? LIMIT 1')
    .bind(user.client_id, idea.match_host ? `%${idea.match_host}%` : '%').first();
  const id = uid(), t = now();
  const price = chargePence(idea.minutes, client.hourly_rate_pence);
  const note = b.note ? String(b.note).trim().slice(0, 2000) : '';
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO requests (id, client_id, site_id, title, details, status, quoted_minutes, quote_note, rate_pence, created_by, created_at, updated_at, quoted_at, approved_at)
       VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.client_id, site?.id || null, idea.title, idea.pitch + (note ? `\n\nFrom ${client.business_name}: ${note}` : ''),
      idea.minutes, 'From your ideas list. Capped at this price.', client.hourly_rate_pence, user.id, t, t, t, t),
    env.DB.prepare("INSERT INTO request_messages (id, request_id, user_id, body, kind, created_at) VALUES (?, ?, ?, ?, 'event', ?)")
      .bind(uid(), id, user.id, `Picked from ideas. Approved at ${fmtTime(idea.minutes)} (£${(price / 100).toFixed(2)})`, t),
    env.DB.prepare(
      "INSERT INTO idea_actions (idea_id, client_id, year, action, request_id) VALUES (?, ?, ?, 'requested', ?) ON CONFLICT(idea_id, client_id, year) DO UPDATE SET action = 'requested', request_id = excluded.request_id"
    ).bind(idea.id, user.client_id, year, id)
  ]);
  notifyLater(ctx, { admins: true }, { title: `${client.business_name} said yes to an idea`, body: `${idea.title}, £${(price / 100).toFixed(2)}. Approved and ready to do.`, url: `/#/requests/${id}` });
  return json({ ok: true, request_id: id }, 201);
}
