import { json, requireAdmin } from '../../../lib/http.js';
import { checkSchema } from '../../../lib/schema.js';
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
  // Anything about the sites that needs Jordan's eye.
  const { results: sites } = await ctx.env.DB.prepare(
    `SELECT s.id, s.name, s.url, s.client_id, s.down_since, s.health, s.gsc_property, s.analytics_error, c.business_name
       FROM sites s JOIN clients c ON c.id = s.client_id WHERE c.archived = 0`
  ).all();
  const soon = new Date(Date.now() + 30 * 864e5).toISOString();
  const watch = [];
  for (const s of sites) {
    let h = null; try { h = s.health ? JSON.parse(s.health) : null; } catch {}
    const base = { site: s.name, business_name: s.business_name, client_id: s.client_id };
    if (s.down_since) watch.push({ ...base, level: 'bad', text: `Down since ${new Date(s.down_since).toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}` });
    else if (h?.error) watch.push({ ...base, level: 'bad', text: "Couldn't reach it on the daily check" });
    if (h?.protections) {
      const missing = ['https', 'hsts', 'nosniff', 'framing', 'referrer', 'permissions'].filter((k) => !h.protections[k]);
      if (missing.length) watch.push({ ...base, level: 'warn', text: `${missing.length} security header${missing.length === 1 ? '' : 's'} missing` });
    }
    if (h && h.frames_in_app === false) watch.push({ ...base, level: 'warn', text: "Blocks the app's site preview" });
    if (h?.cert_expires && h.cert_expires < soon) watch.push({ ...base, level: 'warn', text: `Certificate ends ${h.cert_expires.slice(0, 10)}` });
    if (h?.domain_expires && h.domain_expires < soon) watch.push({ ...base, level: 'bad', text: `Domain expires ${h.domain_expires.slice(0, 10)}` });
    if (s.analytics_error) watch.push({ ...base, level: 'warn', text: `Analytics: ${s.analytics_error}` });
  }

  // One line per site, worst first.
  const bySite = new Map();
  for (const w of watch) {
    const k = `${w.client_id}|${w.site}`;
    const cur = bySite.get(k);
    if (!cur) bySite.set(k, { ...w });
    else { cur.text += ` · ${w.text}`; if (w.level === 'bad') cur.level = 'bad'; }
  }
  const grouped = [...bySite.values()].sort((a, b) => (a.level === b.level ? 0 : a.level === 'bad' ? -1 : 1));

  return json({
    needs_quote: open.filter((r) => r.status === 'new'),
    waiting_on_client: open.filter((r) => r.status === 'quoted'),
    to_do: open.filter((r) => r.status === 'approved' || r.status === 'in_progress'),
    month: { jobs: doneThisMonth.length, minutes, earned_pence: earned },
    client_count: clients,
    watch: grouped,
    system_ok: (await checkSchema(ctx.env, { repair: true })).ok && !!(ctx.env.VAPID_PUBLIC_KEY && ctx.env.VAPID_PRIVATE_KEY && ctx.env.CRON_SECRET),
    sites_count: sites.length
  });
}
