// Site health, analytics headline numbers and the behind-the-scenes feed.
import { json, requireUser } from '../../lib/http.js';
import { sitesFor, analyticsSummary, behindTheScenes } from '../../lib/insights.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const { clientId, sites } = await sitesFor(ctx.env, user, new URL(ctx.request.url).searchParams.get('client'));
  const [scenes, analytics] = await Promise.all([
    behindTheScenes(ctx.env, clientId, sites),
    Promise.all(sites.map((s) => analyticsSummary(ctx.env, s).then((a) => ({ site_id: s.id, name: s.name, url: s.url, ...a }))))
  ]);
  return json({ ...scenes, analytics });
}
