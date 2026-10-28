import { json, readBody, requireUser, text, uid, now } from '../../../../lib/http.js';
import { loadRequest, messagesFor } from '../../../../lib/requests.js';
import { notifyLater } from '../../../../lib/notify.js';

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  const { env, request, params } = ctx;
  const r = await loadRequest(env, user, params.id);
  const body = text((await readBody(request)).body, { required: true, max: 4000, label: 'Message' });
  const t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO request_messages (id, request_id, user_id, body, kind, created_at) VALUES (?, ?, ?, ?, 'message', ?)")
      .bind(uid(), r.id, user.id, body, t),
    env.DB.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').bind(t, r.id)
  ]);
  const preview = body.length > 120 ? body.slice(0, 117) + '...' : body;
  const msg = { title: user.role === 'admin' ? 'Message from Jordan' : `${r.business_name}: ${r.title}`, body: preview, url: `/#/requests/${r.id}` };
  notifyLater(ctx, user.role === 'admin' ? { clientId: r.client_id } : { admins: true }, msg);
  return json({ messages: await messagesFor(env, r.id) }, 201);
}
