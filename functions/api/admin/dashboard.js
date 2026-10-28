import { json, requireAdmin } from '../../../lib/http.js';
import { listRequests } from '../../../lib/requests.js';

export async function onRequestGet(ctx) {
  const user = requireAdmin(ctx);
  const open = await listRequests(ctx.env, user, { open: true });
  const month = new Date().toISOString().slice(0, 7);
  const { results: doneThisMonth } = await ctx.env.DB.prepare(
    "SELECT logged_minutes, rate_pence FROM requests WHERE status = 'done' AND substr(completed_at, 1, 7) = ?"
  ).bind(month).all();
  const earned = doneThisMonth.reduce((sum, r) => sum + Math.round(((r.logged_minutes || 0) / 60) * r.rate_pence), 0);
  const minutes = doneThisMonth.reduce((sum, r) => sum + (r.logged_minutes || 0), 0);
  const { n: clients } = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM clients WHERE archived = 0').first();

  return json({
    needs_quote: open.filter((r) => r.status === 'new'),
    waiting_on_client: open.filter((r) => r.status === 'quoted'),
    to_do: open.filter((r) => r.status === 'approved' || r.status === 'in_progress'),
    month: { jobs: doneThisMonth.length, minutes, earned_pence: earned },
    client_count: clients
  });
}
