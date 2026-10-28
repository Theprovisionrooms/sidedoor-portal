// Build this month's drafts now, rather than waiting for the 1st.
import { json, readBody, requireAdmin, HttpError } from '../../../../lib/http.js';
import { generateMonthly, currentPeriod } from '../../../../lib/billing.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const b = await readBody(ctx.request);
  const period = b.period || currentPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new HttpError(400, 'Period should look like 2026-11');
  const created = await generateMonthly(ctx.env, period);
  return json({ period, created });
}
