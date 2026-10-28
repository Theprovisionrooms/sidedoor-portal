// Google Search Console, read-only, via a service account. No libraries.
// Intellectual property of Sidedoor Digital.
//   GSC_CLIENT_EMAIL  the service account email (…@….iam.gserviceaccount.com)
//   GSC_PRIVATE_KEY   the private_key from its JSON key file
import { HttpError, now } from './http.js';
import { b64url } from './push.js';

const enc = new TextEncoder();
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const apiBase = (env) => env.GSC_API_BASE || 'https://www.googleapis.com';
const tokenUrl = (env) => env.GSC_TOKEN_URL || 'https://oauth2.googleapis.com/token';

export const gscConfigured = (env) => !!(env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY);

function pemToDer(pem) {
  // Cloudflare secrets sometimes keep the \n from the JSON file as two characters.
  const body = String(pem).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

export async function signedAssertion(env, nowSec = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(env.GSC_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: env.GSC_CLIENT_EMAIL, scope: SCOPE, aud: tokenUrl(env), iat: nowSec, exp: nowSec + 3600 })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claims}`));
  return `${head}.${claims}.${b64url(sig)}`;
}

async function accessToken(env) {
  const cached = await env.DB.prepare("SELECT value FROM settings WHERE key = 'gsc_token'").first();
  if (cached?.value) {
    try {
      const t = JSON.parse(cached.value);
      if (t.exp > Date.now() + 120e3) return t.token;
    } catch {}
  }
  const res = await fetch(tokenUrl(env), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signedAssertion(env) })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed: ${data.error_description || data.error || res.status}`);
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('gsc_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(JSON.stringify({ token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 })).run();
  return data.access_token;
}

async function gsc(env, path, body) {
  const res = await fetch(`${apiBase(env)}/webmasters/v3${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${await accessToken(env)}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || `Search Console said ${res.status}`;
    throw new Error(res.status === 403 ? `No access. Add the service account as a user on this property. (${msg})` : msg);
  }
  return data;
}

export async function listProperties(env) {
  const d = await gsc(env, '/sites');
  return (d.siteEntry || []).map((s) => ({ property: s.siteUrl, permission: s.permissionLevel }));
}

// The registrable domain: www.candymonium.co.uk -> candymonium.co.uk
export function baseDomain(host) {
  const parts = String(host).toLowerCase().replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2];
  const twoPart = ['co', 'org', 'me', 'ltd', 'plc', 'net', 'ac', 'gov', 'com'].includes(sld) && parts[parts.length - 1].length === 2;
  return parts.slice(twoPart ? -3 : -2).join('.');
}

// Picks the best property for a site: a domain property first, then a matching URL prefix.
export function matchProperty(siteUrl, properties) {
  let host;
  try { host = new URL(siteUrl).hostname.toLowerCase(); } catch { return null; }
  const base = baseDomain(host);
  const domainProp = properties.find((p) => p.property.toLowerCase() === `sc-domain:${base}`);
  if (domainProp) return domainProp.property;
  const prefix = properties.find((p) => {
    try { return new URL(p.property).hostname.toLowerCase() === host; } catch { return false; }
  }) || properties.find((p) => {
    try { return baseDomain(new URL(p.property).hostname) === base; } catch { return false; }
  });
  return prefix ? prefix.property : null;
}

const day = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5);

// Pulls the last 8 weeks of daily numbers and the top searches and pages for one site.
export async function syncSite(env, site) {
  if (!site.gsc_property) throw new Error('Not linked to a Search Console property yet');
  const end = day(daysAgo(2));          // Search Console runs about two days behind
  const start = day(daysAgo(2 + 55));
  const start28 = day(daysAgo(2 + 27));
  const path = `/sites/${encodeURIComponent(site.gsc_property)}/searchAnalytics/query`;

  const [daily, queries, pages] = await Promise.all([
    gsc(env, path, { startDate: start, endDate: end, dimensions: ['date'], rowLimit: 100 }),
    gsc(env, path, { startDate: start28, endDate: end, dimensions: ['query'], rowLimit: 10 }),
    gsc(env, path, { startDate: start28, endDate: end, dimensions: ['page'], rowLimit: 10 })
  ]);

  const stmts = [];
  for (const r of daily.rows || []) {
    stmts.push(env.DB.prepare(
      `INSERT INTO analytics_daily (site_id, date, clicks, impressions, position) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(site_id, date) DO UPDATE SET clicks = excluded.clicks, impressions = excluded.impressions, position = excluded.position`
    ).bind(site.id, r.keys[0], Math.round(r.clicks || 0), Math.round(r.impressions || 0), r.position ?? null));
  }
  stmts.push(env.DB.prepare('DELETE FROM analytics_top WHERE site_id = ?').bind(site.id));
  const top = (kind, rows) => (rows || []).forEach((r, i) => stmts.push(env.DB.prepare(
    'INSERT INTO analytics_top (site_id, kind, rank, key, clicks, impressions, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(site.id, kind, i + 1, r.keys[0], Math.round(r.clicks || 0), Math.round(r.impressions || 0), r.position ?? null)));
  top('query', queries.rows);
  top('page', pages.rows);
  stmts.push(env.DB.prepare('UPDATE sites SET analytics_synced_at = ?, analytics_error = NULL WHERE id = ?').bind(now(), site.id));
  stmts.push(env.DB.prepare('DELETE FROM analytics_daily WHERE site_id = ? AND date < ?').bind(site.id, day(daysAgo(400))));
  await env.DB.batch(stmts);
  return { days: (daily.rows || []).length };
}

// Daily job. Oldest first, a few per run so we stay inside Cloudflare's request limits.
export async function syncDue(env, limit = 8) {
  if (!gscConfigured(env)) return { skipped: 'Search Console not set up' };
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.gsc_property FROM sites s JOIN clients c ON c.id = s.client_id
      WHERE c.archived = 0 AND s.gsc_property IS NOT NULL
        AND (s.analytics_synced_at IS NULL OR s.analytics_synced_at < ?)
      ORDER BY s.analytics_synced_at IS NOT NULL, s.analytics_synced_at LIMIT ?`
  ).bind(new Date(Date.now() - 20 * 3600e3).toISOString(), limit).all();
  const out = { synced: 0, failed: [], more: results.length === limit };
  for (const s of results) {
    try { await syncSite(env, s); out.synced++; }
    catch (e) {
      out.failed.push(e.message);
      await env.DB.prepare('UPDATE sites SET analytics_error = ?, analytics_synced_at = ? WHERE id = ?').bind(e.message.slice(0, 300), now(), s.id).run();
    }
  }
  return out;
}

export function requireGsc(env) {
  if (!gscConfigured(env)) throw new HttpError(503, 'Search Console is not connected yet. Add GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY in Cloudflare.');
}
