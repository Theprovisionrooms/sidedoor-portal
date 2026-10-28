// Ideas for the logged-in client: what's in season for their sites.
import { json, requireUser, HttpError } from '../../../lib/http.js';
import { ideasFor } from '../../../lib/insights.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const all = new URL(ctx.request.url).searchParams.get('all') === '1';
  const ideas = (await ideasFor(ctx.env, user.client_id, { all })).filter((i) => all || i.action !== 'dismissed');
  return json({ ideas });
}
