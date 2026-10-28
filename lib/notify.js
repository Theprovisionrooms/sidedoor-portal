// Who gets told about what. Sends phone notifications; never blocks the request that triggered it.
import { sendPush, pushConfigured } from './push.js';

async function usersFor(env, to) {
  if (to.admins) {
    const { results } = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    return results.map((r) => r.id);
  }
  if (to.clientId) {
    const { results } = await env.DB.prepare('SELECT id FROM users WHERE client_id = ?').bind(to.clientId).all();
    return results.map((r) => r.id).filter((id) => id !== to.except);
  }
  return to.userIds || [];
}

export async function notify(env, to, message) {
  if (!pushConfigured(env)) return;
  const ids = await usersFor(env, to);
  if (!ids.length) return;
  const { results: subs } = await env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all();
  await Promise.all(subs.map(async (s) => {
    try {
      const status = await sendPush(env, s, message);
      // Gone or invalid: the phone unsubscribed or the app was removed.
      if (status === 404 || status === 410) await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run();
    } catch (e) {
      console.error('push failed', e);
    }
  }));
}

// Use inside a Pages Function so the response doesn't wait on push delivery.
export function notifyLater(ctx, to, message) {
  ctx.waitUntil(notify(ctx.env, to, message).catch((e) => console.error(e)));
}
