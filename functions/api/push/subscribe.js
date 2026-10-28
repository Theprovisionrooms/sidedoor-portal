// Phones register here once notifications are switched on.
import { json, readBody, requireUser, uid, HttpError } from '../../../lib/http.js';

function parse(b) {
  const endpoint = String(b.endpoint || '');
  let u;
  try { u = new URL(endpoint); } catch { throw new HttpError(400, 'Bad subscription'); }
  if (u.protocol !== 'https:' || endpoint.length > 1000) throw new HttpError(400, 'Bad subscription');
  const p256dh = String(b.keys?.p256dh || ''), auth = String(b.keys?.auth || '');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) throw new HttpError(400, 'Bad subscription keys');
  return { endpoint, p256dh, auth };
}

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  const s = parse(await readBody(ctx.request));
  // One row per phone; if the phone now belongs to someone else, it moves over.
  await ctx.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).bind(uid(), user.id, s.endpoint, s.p256dh, s.auth).run();
  return json({ ok: true }, 201);
}

export async function onRequestDelete(ctx) {
  const user = requireUser(ctx);
  const b = await readBody(ctx.request);
  await ctx.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(String(b.endpoint || ''), user.id).run();
  return json({ ok: true });
}
