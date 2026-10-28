import { json, requireUser, HttpError } from '../../../../lib/http.js';
import { loadInvoice } from '../../../../lib/billing.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const inv = await loadInvoice(ctx.env, ctx.params.id);
  if (user.role !== 'admin' && (inv.client_id !== user.client_id || inv.status === 'draft')) {
    throw new HttpError(404, "Couldn't find that invoice");
  }
  return json({ invoice: inv });
}
