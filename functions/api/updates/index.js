// Updates from Jordan, newest first, with read state for this person.
import { json, requireUser, HttpError } from '../../../lib/http.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { results } = await ctx.env.DB.prepare(
    `SELECT u.id, u.title, u.body, u.link_label, u.link_url, u.created_at, r.read_at
       FROM updates u LEFT JOIN update_reads r ON r.update_id = u.id AND r.user_id = ?
      WHERE u.client_id IS NULL OR u.client_id = ? ORDER BY u.created_at DESC LIMIT 30`
  ).bind(user.id, user.client_id).all();
  return json({ updates: results.map((u) => ({ ...u, unread: !u.read_at })) });
}

// Mark one, or all, as read.
export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const b = await ctx.request.json().catch(() => ({}));
  if (b.all) {
    await ctx.env.DB.prepare(
      `INSERT OR IGNORE INTO update_reads (update_id, user_id)
       SELECT id, ? FROM updates WHERE client_id IS NULL OR client_id = ?`
    ).bind(user.id, user.client_id).run();
  } else {
    await ctx.env.DB.prepare('INSERT OR IGNORE INTO update_reads (update_id, user_id) VALUES (?, ?)').bind(String(b.id || ''), user.id).run();
  }
  return json({ ok: true });
}
