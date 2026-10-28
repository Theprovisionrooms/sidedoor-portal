import { json, requireUser } from '../../../lib/http.js';
import { loadSiteFor, analyticsDetail } from '../../../lib/insights.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const site = await loadSiteFor(ctx.env, user, ctx.params.site);
  return json({ site: { id: site.id, name: site.name, url: site.url }, ...(await analyticsDetail(ctx.env, site)) });
}
