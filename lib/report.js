// The monthly report: everything that happened on a client's sites in one calendar month.
// Intellectual property of Sidedoor Digital.
import { HttpError } from './http.js';
import { PROTECTIONS } from './health.js';
import { monthTotals } from './insights.js';
import { monthName } from './billing.js';

export function lastFullMonth(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}
function bounds(period) {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const prevStart = new Date(Date.UTC(y, m - 2, 1));
  const day = (d) => d.toISOString().slice(0, 10);
  return {
    startIso: start.toISOString(), endIso: end.toISOString(),
    from: day(start), to: day(new Date(end - 864e5)),
    prevFrom: day(prevStart), prevTo: day(new Date(start - 864e5)),
    daysInMonth: Math.round((end - start) / 864e5)
  };
}

export const thisMonth = () => new Date().toISOString().slice(0, 7);

// This month so far, then each full month back to when they joined (up to a year).
export async function availablePeriods(env, clientId) {
  const c = await env.DB.prepare('SELECT created_at FROM clients WHERE id = ?').bind(clientId).first();
  if (!c) throw new HttpError(404, "Couldn't find that client");
  const first = c.created_at.slice(0, 7);
  const out = [{ period: thisMonth(), label: `${monthName(thisMonth()).split(' ')[0]} so far`, partial: true }];
  let p = lastFullMonth();
  while (p >= first && out.length < 13) {
    out.push({ period: p, label: monthName(p) });
    const [y, m] = p.split('-').map(Number);
    p = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  }
  return out;
}

// Last full month if they were with us for it, otherwise this month so far.
export function defaultPeriod(periods) {
  return (periods.find((p) => !p.partial) || periods[0]).period;
}

export async function buildReport(env, clientId, period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new HttpError(400, 'Month should look like 2026-10');
  const client = await env.DB.prepare('SELECT id, business_name, contact_name FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) throw new HttpError(404, "Couldn't find that client");
  const b = bounds(period);
  const { results: sites } = await env.DB.prepare('SELECT * FROM sites WHERE client_id = ? ORDER BY created_at').bind(clientId).all();

  const siteReports = await Promise.all(sites.map(async (s) => {
    const [checks, g, gPrev, top] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS n, SUM(ok) AS up, AVG(CASE WHEN ok = 1 THEN ms END) AS avg_ms FROM site_checks WHERE site_id = ? AND checked_at >= ? AND checked_at < ?')
        .bind(s.id, b.startIso, b.endIso).first(),
      monthTotals(env, s.id, b.from, b.to),
      monthTotals(env, s.id, b.prevFrom, b.prevTo),
      env.DB.prepare("SELECT key, clicks, impressions FROM analytics_top WHERE site_id = ? AND kind = 'query' ORDER BY rank LIMIT 5").bind(s.id).all()
    ]);
    let deep = null, speed = null;
    try { deep = s.health ? JSON.parse(s.health) : null; } catch {}
    try { speed = s.speed ? JSON.parse(s.speed) : null; } catch {}
    const failed = (checks.n || 0) - (checks.up || 0);
    return {
      site_id: s.id, name: s.name, url: s.url,
      checks: checks.n || 0,
      uptime: checks.n ? Math.round(((checks.up || 0) / checks.n) * 1000) / 10 : null,
      downtime_mins: failed * 30,
      avg_ms: checks.avg_ms ? Math.round(checks.avg_ms) : null,
      google: g.days ? {
        clicks: g.clicks || 0, impressions: g.impressions || 0, days: g.days, full: g.days >= b.daysInMonth - 3,
        prev: gPrev.days >= 20 ? { clicks: gPrev.clicks || 0, impressions: gPrev.impressions || 0 } : null
      } : null,
      top_searches: top.results,
      protections_ok: deep?.protections ? PROTECTIONS.filter((p) => deep.protections[p.key]).length : null,
      protections_total: PROTECTIONS.length,
      speed: speed && !speed.error ? { score: speed.score, lcp_ms: speed.lcp_ms } : null,
      domain_expires: deep?.domain_expires || null
    };
  }));

  const [jobs, log, notes] = await Promise.all([
    env.DB.prepare(
      "SELECT title, logged_minutes, completed_at FROM requests WHERE client_id = ? AND status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at"
    ).bind(clientId, b.startIso, b.endIso).all(),
    env.DB.prepare(
      'SELECT kind, title, body, created_at FROM work_log WHERE (client_id = ? OR client_id IS NULL) AND created_at >= ? AND created_at < ? ORDER BY created_at'
    ).bind(clientId, b.startIso, b.endIso).all(),
    env.DB.prepare(
      'SELECT title, verdict, created_at FROM security_notes WHERE (client_id = ? OR client_id IS NULL) AND created_at >= ? AND created_at < ? ORDER BY created_at'
    ).bind(clientId, b.startIso, b.endIso).all()
  ]);

  const checks = siteReports.reduce((t, s) => t + s.checks, 0);
  return {
    period, label: period === thisMonth() ? `${monthName(period).split(' ')[0]} so far` : monthName(period), partial: period === thisMonth(), business_name: client.business_name, contact_name: client.contact_name,
    totals: {
      checks,
      jobs: jobs.results.length,
      minutes: jobs.results.reduce((t, j) => t + (j.logged_minutes || 0), 0),
      clicks: siteReports.some((s) => s.google) ? siteReports.reduce((t, s) => t + (s.google?.clicks || 0), 0) : null,
      clicks_prev: siteReports.every((s) => !s.google || s.google.prev) && siteReports.some((s) => s.google?.prev)
        ? siteReports.reduce((t, s) => t + (s.google?.prev?.clicks || 0), 0) : null,
      log: log.results.length
    },
    sites: siteReports,
    jobs: jobs.results,
    log: log.results,
    notes: notes.results
  };
}
