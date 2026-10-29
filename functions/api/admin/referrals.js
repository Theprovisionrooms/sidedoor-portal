import { json, readBody, requireAdmin, HttpError } from '../../../lib/http.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { results } = await ctx.env.DB.prepare(
    'SELECT r.*, c.business_name AS from_business FROM referrals r LEFT JOIN clients c ON c.id = r.client_id ORDER BY r.created_at DESC LIMIT 200'
  ).all();
  return json({ referrals: results });
}

export async function onRequestPatch(ctx) {
  requireAdmin(ctx);
  const b = await readBody(ctx.request);
  if (!['new', 'contacted', 'won', 'not_now'].includes(b.status)) throw new HttpError(400, 'Unknown status');
  await ctx.env.DB.prepare('UPDATE referrals SET status = ? WHERE id = ?').bind(b.status, String(b.id || '')).run();
  return json({ ok: true });
}
