import { json, readBody, requireAdmin, HttpError } from '../../../../lib/http.js';
import { parseClient, clientInserts, emailsTaken } from '../../../../lib/clients.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { results } = await ctx.env.DB.prepare(
    `SELECT c.id, c.business_name, c.contact_name, c.archived, c.created_at,
            (SELECT COUNT(*) FROM sites s WHERE s.client_id = c.id) AS site_count,
            (SELECT COUNT(*) FROM requests r WHERE r.client_id = c.id AND r.status IN ('new','quoted','approved','in_progress')) AS open_count,
            (SELECT MAX(u.last_login_at) FROM users u WHERE u.client_id = c.id) AS last_login_at,
            (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id AND u.must_change_password = 1) AS pending_logins
       FROM clients c ORDER BY c.archived, c.business_name COLLATE NOCASE`
  ).all();
  return json({ clients: results });
}

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const c = parseClient(await readBody(request));
  const taken = await emailsTaken(env, c.users.map((u) => u.email));
  if (taken.length) throw new HttpError(409, `Already has a login: ${taken.join(', ')}`);
  const { clientId, stmts, logins } = await clientInserts(env, c);
  await env.DB.batch(stmts);
  // Temporary passwords are only ever returned here, once.
  return json({ client_id: clientId, logins }, 201);
}
