// A month's report. Clients get their own; Jordan passes ?client=.
import { json, requireUser } from '../../../lib/http.js';
import { buildReport, availablePeriods, defaultPeriod } from '../../../lib/report.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const url = new URL(ctx.request.url);
  const clientId = user.role === 'admin' ? url.searchParams.get('client') : user.client_id;
  const periods = await availablePeriods(ctx.env, clientId);
  const report = await buildReport(ctx.env, clientId, url.searchParams.get('period') || defaultPeriod(periods));
  return json({ report, periods });
}
