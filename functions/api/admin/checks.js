// Run the health check for one site now, instead of waiting for tomorrow.
import { json, readBody, requireAdmin, HttpError } from '../../../lib/http.js';
import { deepCheck, healthSummary } from '../../../lib/health.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const b = await readBody(request);
  const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(String(b.site_id || '')).first();
  if (!site) throw new HttpError(404, "Couldn't find that site");
  await deepCheck(env, site, env.APP_ORIGIN || new URL(request.url).origin);
  const fresh = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(site.id).first();
  return json({ health: await healthSummary(env, fresh) });
}
