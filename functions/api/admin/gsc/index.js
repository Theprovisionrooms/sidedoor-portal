// Search Console: see which properties the service account can read, and link them to sites.
import { json, readBody, requireAdmin } from '../../../../lib/http.js';
import { listProperties, matchProperty, requireGsc, gscConfigured, syncSite } from '../../../../lib/google.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { env } = ctx;
  const { results: sites } = await env.DB.prepare(
    `SELECT s.id, s.name, s.url, s.gsc_property, s.analytics_synced_at, s.analytics_error, c.business_name
       FROM sites s JOIN clients c ON c.id = s.client_id WHERE c.archived = 0 ORDER BY c.business_name, s.name`
  ).all();
  if (!gscConfigured(env)) return json({ configured: false, properties: [], sites, service_account: null });
  let properties = [], error = null;
  try { properties = await listProperties(env); } catch (e) { error = e.message; }
  return json({ configured: true, service_account: env.GSC_CLIENT_EMAIL, properties, sites, error });
}

// Link every unlinked site to its best matching property, then pull its numbers.
export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env } = ctx;
  requireGsc(env);
  const b = await readBody(ctx.request);
  const properties = await listProperties(env);
  const { results: sites } = await env.DB.prepare('SELECT s.* FROM sites s JOIN clients c ON c.id = s.client_id WHERE c.archived = 0').all();
  const linked = [], unmatched = [];
  for (const s of sites) {
    if (s.gsc_property && !b.relink) continue;
    const p = matchProperty(s.url, properties);
    if (p) { await env.DB.prepare('UPDATE sites SET gsc_property = ? WHERE id = ?').bind(p, s.id).run(); linked.push({ name: s.name, property: p }); s.gsc_property = p; }
    else unmatched.push(s.name);
  }
  const synced = [], failed = [];
  for (const s of sites.filter((x) => x.gsc_property).slice(0, 8)) {
    try { await syncSite(env, s); synced.push(s.name); } catch (e) { failed.push(`${s.name}: ${e.message}`); }
  }
  return json({ linked, unmatched, synced, failed });
}
