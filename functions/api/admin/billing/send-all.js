import { json, requireAdmin } from '../../../../lib/http.js';
import { listInvoices, sendInvoice } from '../../../../lib/billing.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const drafts = await listInvoices(ctx.env, { statuses: ['draft'] });
  const sent = [], failed = [];
  for (const d of drafts) {
    try { await sendInvoice(ctx.env, d.id, { waitUntil: (p) => ctx.waitUntil(p) }); sent.push(d.ref); }
    catch (e) { failed.push(`${d.ref}: ${e.message}`); }
  }
  return json({ sent, failed });
}
