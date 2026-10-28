// Client's billing screen.
import { json, requireUser, HttpError } from '../../lib/http.js';
import { listInvoices } from '../../lib/billing.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { env } = ctx;
  const client = await env.DB.prepare('SELECT monthly_fee_pence, monthly_from, hourly_rate_pence FROM clients WHERE id = ?').bind(user.client_id).first();
  const invoices = await listInvoices(env, { clientId: user.client_id, includeDrafts: false });
  const live = invoices.filter((i) => i.status !== 'void');
  const build = live.filter((i) => i.kind === 'build');
  return json({
    monthly_fee_pence: client.monthly_fee_pence,
    monthly_from: client.monthly_from,
    hourly_rate_pence: client.hourly_rate_pence,
    outstanding_pence: live.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total_pence, 0),
    build: build.length ? {
      total_pence: build.reduce((s, i) => s + i.total_pence, 0),
      paid_pence: build.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total_pence, 0)
    } : null,
    invoices: live
  });
}
