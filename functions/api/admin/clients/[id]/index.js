import { json, readBody, requireAdmin, text, HttpError } from '../../../../../lib/http.js';
import { clientDetail } from '../../../../../lib/clients.js';
import { listRequests } from '../../../../../lib/requests.js';
import { listInvoices } from '../../../../../lib/billing.js';

export async function onRequestGet(ctx) {
  const user = requireAdmin(ctx);
  const detail = await clientDetail(ctx.env, ctx.params.id);
  const [requests, invoices] = await Promise.all([
    listRequests(ctx.env, user, { clientId: ctx.params.id }),
    listInvoices(ctx.env, { clientId: ctx.params.id })
  ]);
  return json({ ...detail, requests, invoices });
}

export async function onRequestPatch(ctx) {
  requireAdmin(ctx);
  const { env, request, params } = ctx;
  await clientDetail(env, params.id);
  const b = await readBody(request);

  const fields = {};
  if ('business_name' in b) fields.business_name = text(b.business_name, { required: true, label: 'Business name', max: 120 });
  if ('contact_name' in b) fields.contact_name = text(b.contact_name, { required: true, label: 'Contact name', max: 80 });
  if ('phone' in b) fields.phone = text(b.phone, { max: 40 }) || null;
  if ('notes' in b) fields.notes = text(b.notes, { max: 4000 }) || null;
  if ('hourly_rate_pence' in b) {
    const rate = Math.round(Number(b.hourly_rate_pence));
    if (!Number.isFinite(rate) || rate < 0) throw new HttpError(400, 'Hourly rate needs to be a number');
    fields.hourly_rate_pence = rate;
  }
  if ('monthly_fee_pence' in b) {
    const fee = Math.round(Number(b.monthly_fee_pence));
    if (!Number.isFinite(fee) || fee < 0) throw new HttpError(400, 'Monthly fee needs to be a number');
    fields.monthly_fee_pence = fee;
  }
  if ('pay_link' in b) {
    const link = String(b.pay_link || '').trim();
    if (link && !/^https:\/\/\S+$/.test(link)) throw new HttpError(400, 'Pay link needs to start with https://');
    fields.pay_link = link || null;
  }
  if ('monthly_from' in b) {
    const from = String(b.monthly_from || '').trim();
    if (from && !/^\d{4}-(0[1-9]|1[0-2])$/.test(from)) throw new HttpError(400, 'Plan start should be a month like 2026-12');
    fields.monthly_from = from || null;
  }
  if ('archived' in b) fields.archived = b.archived ? 1 : 0;

  const cols = Object.keys(fields);
  if (!cols.length) throw new HttpError(400, 'Nothing to change');
  const stmts = [
    env.DB.prepare(`UPDATE clients SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((c) => fields[c]), params.id)
  ];
  // Archiving signs the client out everywhere.
  if (fields.archived) {
    stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE client_id = ?)').bind(params.id));
  }
  await env.DB.batch(stmts);
  return json(await clientDetail(env, params.id));
}
