// The directory, your own profile and your intros, in one call.
import { json, requireUser, HttpError, now } from '../../../lib/http.js';
import { directory, profileFor, introsFor, CATEGORIES } from '../../../lib/network.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { env } = ctx;
  const [members, profile, intros] = await Promise.all([
    directory(env, user.client_id), profileFor(env, user.client_id), introsFor(env, user.client_id)
  ]);
  // Opening the network counts as seeing any new intros.
  if (intros.some((i) => i.unseen)) {
    await env.DB.batch([
      env.DB.prepare("UPDATE network_intros SET seen_from = 1 WHERE from_client = ? AND seen_from = 0").bind(user.client_id),
      env.DB.prepare("UPDATE network_intros SET seen_to = 1 WHERE to_client = ? AND status = 'introduced' AND seen_to = 0").bind(user.client_id)
    ]);
  }
  return json({ members, profile, intros, categories: CATEGORIES, now: now() });
}
