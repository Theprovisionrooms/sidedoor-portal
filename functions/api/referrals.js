// Clients pass on a business that could use Sidedoor. Jordan gets it on his phone straight away.
import { json, readBody, requireUser, text, uid, HttpError } from '../../lib/http.js';
import { notifyLater } from '../../lib/notify.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const [{ results }, reward] = await Promise.all([
    ctx.env.DB.prepare('SELECT business, status, created_at FROM referrals WHERE client_id = ? ORDER BY created_at DESC').bind(user.client_id).all(),
    ctx.env.DB.prepare("SELECT value FROM settings WHERE key = 'referral_reward'").first()
  ]);
  return json({
    referrals: results, reward: reward?.value || '',
    passed: results.length, won: results.filter((r) => r.status === 'won').length
  });
}

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { env, request } = ctx;
  const b = await readBody(request);
  const r = {
    name: text(b.name, { required: true, max: 80, label: 'Their name' }),
    business: text(b.business, { required: true, max: 120, label: 'Their business' }),
    phone: text(b.phone, { max: 40, label: 'Phone' }) || null,
    email: text(b.email, { max: 160, label: 'Email' }) || null,
    note: text(b.note, { max: 1000, label: 'Note' }) || null
  };
  if (!r.phone && !r.email) throw new HttpError(400, 'A phone number or email so Jordan can get in touch');
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM referrals WHERE client_id = ? AND created_at > ?")
    .bind(user.client_id, new Date(Date.now() - 864e5).toISOString()).first();
  if (recent.n >= 10) throw new HttpError(429, "That's a lot in one day. Message Jordan directly for the rest.");
  const client = await env.DB.prepare('SELECT business_name FROM clients WHERE id = ?').bind(user.client_id).first();
  await env.DB.prepare('INSERT INTO referrals (id, client_id, name, business, phone, email, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(uid(), user.client_id, r.name, r.business, r.phone, r.email, r.note).run();
  notifyLater(ctx, { admins: true }, { title: `New lead from ${client.business_name}`, body: `${r.business}, ${r.name}${r.phone ? `, ${r.phone}` : ''}`, url: '/#/leads' });
  return json({ ok: true }, 201);
}
