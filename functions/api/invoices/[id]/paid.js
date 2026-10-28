// Client taps "I've paid". Revolut doesn't tell us, so Jordan gets a ping to check and confirm.
import { json, requireUser, now, HttpError } from '../../../../lib/http.js';
import { loadInvoice } from '../../../../lib/billing.js';
import { notifyLater } from '../../../../lib/notify.js';

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  const { env, params } = ctx;
  const inv = await loadInvoice(env, params.id);
  if (user.role !== 'client' || inv.client_id !== user.client_id || inv.status === 'draft') throw new HttpError(404, "Couldn't find that invoice");
  if (inv.status !== 'sent') throw new HttpError(409, 'That one is already sorted');
  if (!inv.claimed_paid_at) {
    await env.DB.prepare('UPDATE invoices SET claimed_paid_at = ? WHERE id = ?').bind(now(), inv.id).run();
    notifyLater(ctx, { admins: true }, {
      title: `${inv.business_name} says they've paid`,
      body: `${inv.ref}, £${(inv.total_pence / 100).toFixed(2)}. Check Revolut and confirm.`,
      url: '/#/money'
    });
  }
  return json({ invoice: await loadInvoice(env, inv.id) });
}
