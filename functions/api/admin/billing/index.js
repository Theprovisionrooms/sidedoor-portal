// Jordan's Money screen: what to send, what's owed, what's in.
import { json, readBody, requireAdmin, HttpError } from '../../../../lib/http.js';
import { listInvoices, settings, currentPeriod } from '../../../../lib/billing.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { env } = ctx;
  const all = await listInvoices(env, { statuses: ['draft', 'sent', 'paid'] });
  const month = new Date().toISOString().slice(0, 7);
  const sent = all.filter((i) => i.status === 'sent');
  const { n: monthly } = await env.DB.prepare('SELECT COALESCE(SUM(monthly_fee_pence), 0) AS n FROM clients WHERE archived = 0').first();
  const s = await settings(env);
  return json({
    period: currentPeriod(),
    settings: { default_pay_link: s.default_pay_link || '', auto_send: s.auto_send === '1', referral_reward: s.referral_reward || '' },
    push_ready: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    monthly_recurring_pence: monthly,
    drafts: all.filter((i) => i.status === 'draft'),
    to_confirm: sent.filter((i) => i.claimed_paid_at),
    unpaid: sent.filter((i) => !i.claimed_paid_at),
    outstanding_pence: sent.reduce((t, i) => t + i.total_pence, 0),
    paid_this_month_pence: all.filter((i) => i.status === 'paid' && (i.paid_at || '').startsWith(month)).reduce((t, i) => t + i.total_pence, 0),
    recent_paid: all.filter((i) => i.status === 'paid').slice(0, 10)
  });
}

export async function onRequestPatch(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const b = await readBody(request);
  const stmts = [];
  if ('default_pay_link' in b) {
    const link = String(b.default_pay_link || '').trim();
    if (link && !/^https:\/\/\S+$/.test(link)) throw new HttpError(400, 'Pay link needs to start with https://');
    stmts.push(env.DB.prepare("INSERT INTO settings (key, value) VALUES ('default_pay_link', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(link));
  }
  if ('auto_send' in b) {
    stmts.push(env.DB.prepare("INSERT INTO settings (key, value) VALUES ('auto_send', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(b.auto_send ? '1' : '0'));
  }
  if ('referral_reward' in b) {
    const v = String(b.referral_reward || '').trim().slice(0, 120);
    stmts.push(env.DB.prepare("INSERT INTO settings (key, value) VALUES ('referral_reward', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(v));
  }
  if (!stmts.length) throw new HttpError(400, 'Nothing to change');
  await env.DB.batch(stmts);
  return json({ ok: true });
}
