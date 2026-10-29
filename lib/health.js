// Site health. Quick up/down every 30 minutes, a deeper look once a day.
// Intellectual property of Sidedoor Digital.
import { now } from './http.js';
import { baseDomain } from './google.js';
import { notify } from './notify.js';

const UA = 'SidedoorMonitor/1.0 (+https://getsidedoor.co.uk)';

async function timed(url, opts = {}, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', ...opts, headers: { 'user-agent': UA, ...(opts.headers || {}) }, signal: ctrl.signal });
    return { res, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

// The protections clients see, in plain English. CSP script locking is extra, admin only.
export const PROTECTIONS = [
  { key: 'https', label: 'Padlock on', why: 'Everything between your site and your customers is encrypted.' },
  { key: 'hsts', label: 'Always uses the padlock', why: 'Browsers are told never to load your site without it.' },
  { key: 'nosniff', label: 'Blocks file-type tricks', why: 'Stops browsers being fooled into running a file as code.' },
  { key: 'framing', label: "Can't be hidden inside other sites", why: 'Stops copycat pages wrapping your site to steal clicks.' },
  { key: 'referrer', label: 'Keeps customer browsing private', why: 'Other sites only see where a visitor came from, not the exact page.' },
  { key: 'permissions', label: 'Camera, mic and location blocked', why: "Nothing on your site can ask for them unless it's meant to." }
];

export function readProtections(finalUrl, h) {
  const csp = (h.get('content-security-policy') || '').toLowerCase();
  return {
    https: finalUrl.startsWith('https://'),
    hsts: /max-age=\d+/i.test(h.get('strict-transport-security') || ''),
    nosniff: (h.get('x-content-type-options') || '').toLowerCase().includes('nosniff'),
    framing: csp.includes('frame-ancestors') || !!h.get('x-frame-options'),
    referrer: !!h.get('referrer-policy'),
    permissions: !!h.get('permissions-policy'),
    csp_scripts: /(^|;)\s*(default-src|script-src)\s/.test(csp)
  };
}

// Whether the Sidedoor app is allowed to show the site in its preview frame.
export function framesInApp(h, appOrigin) {
  const xfo = (h.get('x-frame-options') || '').toLowerCase();
  const csp = (h.get('content-security-policy') || '').toLowerCase();
  const fa = csp.match(/frame-ancestors([^;]*)/);
  if (fa) return fa[1].includes(appOrigin.toLowerCase()) || /\s\*(\s|$)/.test(fa[1]);
  return !xfo;
}

async function certExpiry(host) {
  // Certificate Transparency logs. Best effort: Cloudflare renews these automatically.
  try {
    const { res } = await timed(`https://crt.sh/?q=${encodeURIComponent(host)}&output=json&exclude=expired`, {}, 9000);
    if (!res.ok) return null;
    const rows = await res.json();
    const latest = rows.map((r) => r.not_after).filter(Boolean).sort().pop();
    return latest ? new Date(latest + 'Z').toISOString() : null;
  } catch { return null; }
}

async function domainExpiry(host) {
  if (/\.(pages|workers)\.dev$/.test(host)) return null;
  const domain = baseDomain(host);
  try {
    const { res } = await timed(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { accept: 'application/rdap+json' } }, 9000);
    if (!res.ok) return null;
    const d = await res.json();
    const ev = (d.events || []).find((e) => /expir/i.test(e.eventAction));
    return ev?.eventDate ? new Date(ev.eventDate).toISOString() : null;
  } catch { return null; }
}

// Daily deep check for one site.
export async function deepCheck(env, site, appOrigin) {
  const host = new URL(site.url).hostname;
  const result = { checked_at: now(), host };
  try {
    const { res, ms } = await timed(site.url);
    result.status = res.status;
    result.ms = ms;
    result.final_url = res.url;
    result.protections = readProtections(res.url || site.url, res.headers);
    result.frames_in_app = framesInApp(res.headers, appOrigin);
    result.server = res.headers.get('server') || null;
    await res.body?.cancel();
  } catch (e) {
    result.error = e.name === 'AbortError' ? 'Took longer than 10 seconds' : "Couldn't reach the site";
  }
  [result.cert_expires, result.domain_expires] = await Promise.all([certExpiry(host), domainExpiry(host)]);
  await env.DB.prepare('UPDATE sites SET health = ?, health_checked_at = ? WHERE id = ?').bind(JSON.stringify(result), result.checked_at, site.id).run();
  return result;
}

export async function deepCheckDue(env, appOrigin, limit = 8) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.url FROM sites s JOIN clients c ON c.id = s.client_id
      WHERE c.archived = 0 AND (s.health_checked_at IS NULL OR s.health_checked_at < ?)
      ORDER BY s.health_checked_at IS NOT NULL, s.health_checked_at LIMIT ?`
  ).bind(new Date(Date.now() - 20 * 3600e3).toISOString(), limit).all();
  await Promise.all(results.map((s) => deepCheck(env, s, appOrigin)));
  return { checked: results.length, more: results.length === limit };
}

// Every 30 minutes. Two misses in a row before anyone is told, so a blip doesn't wake you up.
// One fetch per site and one database write for the lot, to stay inside Cloudflare's limits.
export async function uptimeRun(env) {
  const { results: sites } = await env.DB.prepare(
    `SELECT s.id, s.url, s.name, s.fail_count, s.down_since, s.client_id, c.business_name FROM sites s
       JOIN clients c ON c.id = s.client_id WHERE c.archived = 0 LIMIT 30`
  ).all();
  const t = now();
  const checks = await Promise.all(sites.map(async (s) => {
    try {
      const r = await timed(s.url, {}, 12000);
      await r.res.body?.cancel();
      return { s, ok: r.res.status < 500, status: r.res.status, ms: r.ms, error: null };
    } catch (e) {
      return { s, ok: false, status: null, ms: null, error: e.name === 'AbortError' ? 'Timed out' : String(e.message || e).slice(0, 200) };
    }
  }));
  const stmts = [], alerts = [], out = { checked: checks.length, down: [], back: [] };
  for (const c of checks) {
    const { s } = c;
    const fails = c.ok ? 0 : (s.fail_count || 0) + 1;
    stmts.push(env.DB.prepare('INSERT INTO site_checks (site_id, checked_at, ok, status, ms, error) VALUES (?, ?, ?, ?, ?, ?)').bind(s.id, t, c.ok ? 1 : 0, c.status, c.ms, c.error));
    if (c.ok && s.down_since) {
      const mins = Math.max(1, Math.round((Date.parse(t) - Date.parse(s.down_since)) / 60000));
      stmts.push(env.DB.prepare('UPDATE sites SET fail_count = 0, down_since = NULL WHERE id = ?').bind(s.id));
      alerts.push({ title: `${s.name} is back up`, body: `Down for about ${mins} minutes.`, url: `/#/clients/${s.client_id}` });
      out.back.push(s.name);
    } else if (!c.ok && fails === 2) {
      stmts.push(env.DB.prepare('UPDATE sites SET fail_count = ?, down_since = ? WHERE id = ?').bind(fails, t, s.id));
      alerts.push({ title: `${s.name} looks down`, body: `${s.business_name}: ${c.error || `status ${c.status}`}. Checked twice, 30 minutes apart.`, url: `/#/clients/${s.client_id}`, urgent: true });
      out.down.push(s.name);
    } else if (fails !== (s.fail_count || 0)) {
      stmts.push(env.DB.prepare('UPDATE sites SET fail_count = ? WHERE id = ?').bind(fails, s.id));
    }
  }
  stmts.push(env.DB.prepare('DELETE FROM site_checks WHERE checked_at < ?').bind(new Date(Date.now() - 95 * 864e5).toISOString()));
  await env.DB.batch(stmts);
  for (const a of alerts) await notify(env, { admins: true }, a);
  return out;
}

// Everything a client or Jordan needs to see about one site.
export async function healthSummary(env, site) {
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const [month, week, last] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n, SUM(ok) AS up, AVG(CASE WHEN ok = 1 THEN ms END) AS avg_ms FROM site_checks WHERE site_id = ? AND checked_at > ?').bind(site.id, since30).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM site_checks WHERE site_id = ? AND checked_at > ?').bind(site.id, since7).first(),
    env.DB.prepare('SELECT checked_at, ok, status, ms FROM site_checks WHERE site_id = ? ORDER BY checked_at DESC LIMIT 1').bind(site.id).first()
  ]);
  let deep = null, speed = null;
  try { deep = site.health ? JSON.parse(site.health) : null; } catch {}
  try { speed = site.speed ? JSON.parse(site.speed) : null; } catch {}
  const days = await uptimeDays(env, site.id);
  const prot = deep?.protections || null;
  return {
    site_id: site.id,
    up_now: last ? !!last.ok && !site.down_since : null,
    down_since: site.down_since || null,
    last_checked_at: last?.checked_at || null,
    checks_30d: month.n || 0,
    checks_7d: week.n || 0,
    // Only quote a percentage once there's a day of checks behind it.
    uptime_30d: month.n >= 48 ? Math.round(((month.up || 0) / month.n) * 1000) / 10 : null,
    avg_ms: month.avg_ms ? Math.round(month.avg_ms) : null,
    deep_checked_at: deep?.checked_at || null,
    protections: prot ? PROTECTIONS.map((p) => ({ ...p, ok: !!prot[p.key] })) : null,
    protections_ok: prot ? PROTECTIONS.filter((p) => prot[p.key]).length : null,
    protections_total: PROTECTIONS.length,
    csp_scripts: prot ? !!prot.csp_scripts : null,
    frames_in_app: deep ? deep.frames_in_app !== false : null,
    cert_expires: deep?.cert_expires || null,
    domain_expires: deep?.domain_expires || null,
    error: deep?.error || null,
    days,
    speed: speed && !speed.error ? speed : null
  };
}

// ---------- Speed: Google PageSpeed, phone test, once a week ----------
// Optional PSI_API_KEY (free, from Google Cloud) gives a bigger daily allowance.
const psiBase = (env) => env.PSI_API_BASE || 'https://www.googleapis.com';

export async function speedCheck(env, site) {
  const u = new URL(`${psiBase(env)}/pagespeedonline/v5/runPagespeed`);
  u.searchParams.set('url', site.url);
  u.searchParams.set('strategy', 'mobile');
  u.searchParams.set('category', 'performance');
  if (env.PSI_API_KEY) u.searchParams.set('key', env.PSI_API_KEY);
  const out = { checked_at: now() };
  try {
    const { res } = await timed(u.toString(), {}, 60000);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error?.message || `PageSpeed said ${res.status}`);
    const a = d.lighthouseResult?.audits || {};
    const num = (k) => (a[k]?.numericValue != null ? a[k].numericValue : null);
    out.score = d.lighthouseResult?.categories?.performance?.score != null ? Math.round(d.lighthouseResult.categories.performance.score * 100) : null;
    out.lcp_ms = num('largest-contentful-paint');
    out.cls = num('cumulative-layout-shift');
    out.tbt_ms = num('total-blocking-time');
    out.fcp_ms = num('first-contentful-paint');
    out.weight_kb = num('total-byte-weight') != null ? Math.round(num('total-byte-weight') / 1024) : null;
    // Real visitor data from Chrome, when Google has enough of it.
    out.field = d.loadingExperience?.overall_category || null;
  } catch (e) {
    out.error = e.name === 'AbortError' ? 'PageSpeed took too long' : String(e.message).slice(0, 200);
  }
  await env.DB.prepare('UPDATE sites SET speed = ?, speed_checked_at = ? WHERE id = ?').bind(JSON.stringify(out), out.checked_at, site.id).run();
  return out;
}

export async function speedDue(env, limit = 2) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.url FROM sites s JOIN clients c ON c.id = s.client_id
      WHERE c.archived = 0 AND (s.speed_checked_at IS NULL OR s.speed_checked_at < ?)
      ORDER BY s.speed_checked_at IS NOT NULL, s.speed_checked_at LIMIT ?`
  ).bind(new Date(Date.now() - 6.5 * 864e5).toISOString(), limit).all();
  await Promise.all(results.map((s) => speedCheck(env, s)));
  return { checked: results.length, more: results.length === limit };
}

// ---------- Uptime by day, for the 30 day strip ----------
export async function uptimeDays(env, siteId, days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { results } = await env.DB.prepare(
    'SELECT substr(checked_at, 1, 10) AS day, COUNT(*) AS n, SUM(ok) AS up FROM site_checks WHERE site_id = ? AND checked_at > ? GROUP BY day'
  ).bind(siteId, since).all();
  const map = new Map(results.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10);
    const r = map.get(day);
    return { day, n: r?.n || 0, pct: r?.n ? Math.round((r.up / r.n) * 1000) / 10 : null };
  });
}
