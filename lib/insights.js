// Analytics summaries, the behind-the-scenes feed and ideas. Intellectual property of Sidedoor Digital.
import { HttpError } from './http.js';
import { healthSummary } from './health.js';

export async function sitesFor(env, user, clientId) {
  const id = user.role === 'admin' ? clientId : user.client_id;
  if (!id) throw new HttpError(400, 'Which client?');
  const { results } = await env.DB.prepare('SELECT * FROM sites WHERE client_id = ? ORDER BY created_at').bind(id).all();
  return { clientId: id, sites: results };
}

export async function loadSiteFor(env, user, siteId) {
  const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
  if (!site || (user.role !== 'admin' && site.client_id !== user.client_id)) throw new HttpError(404, "Couldn't find that site");
  return site;
}

const day = (d) => d.toISOString().slice(0, 10);

export async function analyticsSummary(env, site) {
  const { results: rows } = await env.DB.prepare(
    'SELECT date, clicks, impressions, position FROM analytics_daily WHERE site_id = ? ORDER BY date DESC LIMIT 56'
  ).bind(site.id).all();
  if (!rows.length) {
    return { linked: !!site.gsc_property, synced_at: site.analytics_synced_at, error: site.analytics_error, has_data: false };
  }
  rows.reverse();
  const last = rows.slice(-28), prev = rows.slice(-56, -28);
  const sum = (a, k) => a.reduce((t, r) => t + (r[k] || 0), 0);
  const pos = (a) => {
    const w = a.filter((r) => r.position && r.impressions);
    const imp = sum(w, 'impressions');
    return imp ? Math.round((w.reduce((t, r) => t + r.position * r.impressions, 0) / imp) * 10) / 10 : null;
  };
  const totals = (a) => ({ clicks: sum(a, 'clicks'), impressions: sum(a, 'impressions'), position: pos(a) });
  return {
    linked: true,
    has_data: true,
    synced_at: site.analytics_synced_at,
    error: site.analytics_error,
    from: last[0].date,
    to: last[last.length - 1].date,
    now: totals(last),
    before: prev.length >= 14 ? totals(prev) : null,
    daily: last.map((r) => ({ date: r.date, clicks: r.clicks, impressions: r.impressions }))
  };
}

export async function analyticsDetail(env, site) {
  const summary = await analyticsSummary(env, site);
  const { results } = await env.DB.prepare(
    'SELECT kind, rank, key, clicks, impressions, position FROM analytics_top WHERE site_id = ? ORDER BY kind, rank'
  ).bind(site.id).all();
  return {
    ...summary,
    queries: results.filter((r) => r.kind === 'query'),
    pages: results.filter((r) => r.kind === 'page')
  };
}

// The feed that shows clients the work they don't otherwise see.
export async function behindTheScenes(env, clientId, sites) {
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [log, notes, done] = await Promise.all([
    env.DB.prepare(
      `SELECT w.id, w.kind, w.title, w.body, w.created_at, s.name AS site_name FROM work_log w
         LEFT JOIN sites s ON s.id = w.site_id
        WHERE w.client_id = ? OR w.client_id IS NULL ORDER BY w.created_at DESC LIMIT 25`
    ).bind(clientId).all(),
    env.DB.prepare(
      'SELECT id, title, body, verdict, created_at FROM security_notes WHERE client_id = ? OR client_id IS NULL ORDER BY created_at DESC LIMIT 10'
    ).bind(clientId).all(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM requests WHERE client_id = ? AND status = 'done' AND completed_at > ?"
    ).bind(clientId, since30).first()
  ]);
  const health = await Promise.all(sites.map((s) => healthSummary(env, s).then((h) => ({ ...h, name: s.name, url: s.url }))));
  return {
    health,
    checks_30d: health.reduce((t, h) => t + h.checks_30d, 0),
    jobs_30d: done.n,
    log: log.results,
    notes: notes.results
  };
}

/* ---------- ideas ---------- */

// Is today inside an MM-DD window (which can wrap over new year)?
export function inSeason(starts, ends, date = new Date()) {
  if (!starts || !ends) return true;
  const md = date.toISOString().slice(5, 10);
  return starts <= ends ? md >= starts && md <= ends : md >= starts || md <= ends;
}

export async function ideasFor(env, clientId, { all = false } = {}) {
  const [{ results: sites }, { results: ideas }, { results: actions }] = await Promise.all([
    env.DB.prepare('SELECT url FROM sites WHERE client_id = ?').bind(clientId).all(),
    env.DB.prepare('SELECT * FROM ideas WHERE active = 1 ORDER BY sort, created_at').all(),
    env.DB.prepare('SELECT idea_id, action, request_id, year FROM idea_actions WHERE client_id = ? AND year = ?').bind(clientId, new Date().getUTCFullYear()).all()
  ]);
  const hosts = sites.map((s) => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return ''; } });
  const acted = new Map(actions.map((a) => [a.idea_id, a]));
  return ideas
    .filter((i) => (i.client_id ? i.client_id === clientId : i.match_host ? hosts.includes(i.match_host.replace(/^www\./, '')) : true))
    .filter((i) => all || inSeason(i.starts, i.ends))
    .map((i) => ({ ...i, action: acted.get(i.id)?.action || null, request_id: acted.get(i.id)?.request_id || null, in_season: inSeason(i.starts, i.ends) }));
}
