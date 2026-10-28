import { json, readBody, requireUser, text, uid, now, HttpError } from '../../../lib/http.js';
import { listRequests, loadRequest, shape } from '../../../lib/requests.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const url = new URL(ctx.request.url);
  const requests = await listRequests(ctx.env, user, {
    clientId: url.searchParams.get('client') || undefined,
    open: url.searchParams.get('open') === '1'
  });
  return json({ requests });
}

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  const { env, request } = ctx;
  const b = await readBody(request);

  // Clients raise their own; Jordan can log one on a client's behalf (e.g. from a phone call).
  const clientId = user.role === 'admin' ? text(b.client_id, { required: true, label: 'Client' }) : user.client_id;
  const client = await env.DB.prepare('SELECT id, hourly_rate_pence FROM clients WHERE id = ? AND archived = 0')
    .bind(clientId).first();
  if (!client) throw new HttpError(404, "Couldn't find that client");

  let siteId = null;
  if (b.site_id) {
    const site = await env.DB.prepare('SELECT id FROM sites WHERE id = ? AND client_id = ?').bind(b.site_id, clientId).first();
    if (!site) throw new HttpError(400, "That site isn't on this account");
    siteId = site.id;
  }

  const title = text(b.title, { required: true, label: 'A short title', max: 120 });
  const details = text(b.details, { required: true, label: 'A bit of detail', max: 4000 });
  const id = uid();
  const t = now();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO requests (id, client_id, site_id, title, details, urgent, rate_pence, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, clientId, siteId, title, details, b.urgent ? 1 : 0, client.hourly_rate_pence, user.id, t, t),
    env.DB.prepare("INSERT INTO request_messages (id, request_id, user_id, body, kind, created_at) VALUES (?, ?, ?, ?, 'event', ?)")
      .bind(uid(), id, user.id, 'Request sent', t)
  ]);

  return json({ request: shape(await loadRequest(env, user, id)) }, 201);
}
