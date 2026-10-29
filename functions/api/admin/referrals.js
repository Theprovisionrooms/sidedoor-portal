import { json, readBody, requireAdmin, HttpError, now } from '../../../lib/http.js';
import { notifyLater } from '../../../lib/notify.js';

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
  const { env } = ctx;
  const r = await env.DB.prepare('SELECT * FROM referrals WHERE id = ?').bind(String(b.id || '')).first();
  if (!r) throw new HttpError(404, "Couldn't find that lead");
  await env.DB.prepare('UPDATE referrals SET status = ?, thanked_at = CASE WHEN ? = \'won\' THEN COALESCE(thanked_at, ?) ELSE thanked_at END WHERE id = ?')
    .bind(b.status, b.status, now(), r.id).run();
  // Keep the client who passed it on in the loop. That's what makes them do it again.
  if (r.client_id && b.status !== r.status) {
    const reward = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'referral_reward'").first())?.value;
    if (b.status === 'contacted') notifyLater(ctx, { clientId: r.client_id }, { title: `Jordan's been in touch with ${r.business}`, body: 'Thanks for passing them on.', url: '/#/refer' });
    if (b.status === 'won') notifyLater(ctx, { clientId: r.client_id }, { title: `${r.business} is now with Sidedoor`, body: reward ? `All thanks to you. ${reward[0].toUpperCase() + reward.slice(1)}, sorted.` : 'All thanks to you. Cheers.', url: '/#/refer' });
  }
  return json({ ok: true });
}
