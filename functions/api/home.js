// Client home screen data.
import { json, requireUser, HttpError } from '../../lib/http.js';
import { listRequests } from '../../lib/requests.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { env } = ctx;

  const [client, sites, open] = await Promise.all([
    env.DB.prepare('SELECT id, business_name, contact_name, hourly_rate_pence FROM clients WHERE id = ?')
      .bind(user.client_id).first(),
    env.DB.prepare('SELECT id, name, url FROM sites WHERE client_id = ? ORDER BY created_at').bind(user.client_id).all(),
    listRequests(env, user, { open: true })
  ]);
  const { done } = await env.DB.prepare(
    "SELECT COUNT(*) AS done FROM requests WHERE client_id = ? AND status = 'done'"
  ).bind(user.client_id).first();

  // How quickly Jordan usually quotes, across everyone, last 90 days. Shown once there's enough to be fair.
  const { results: times } = await env.DB.prepare(
    `SELECT (julianday(quoted_at) - julianday(created_at)) * 1440 AS mins FROM requests
      WHERE quoted_at IS NOT NULL AND quoted_at > created_at AND created_at > ? ORDER BY mins`
  ).bind(new Date(Date.now() - 90 * 864e5).toISOString()).all();
  const reply_mins = times.length >= 3 ? Math.round(times[Math.floor(times.length / 2)].mins) : null;

  return json({ client, sites: sites.results, open_requests: open, done_count: done, reply_mins });
}
