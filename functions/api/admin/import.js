// Bulk onboarding: create many clients in one all-or-nothing batch.
import { json, readBody, requireAdmin, HttpError } from '../../../lib/http.js';
import { parseClient, clientInserts, emailsTaken } from '../../../lib/clients.js';
import { nextNumber } from '../../../lib/billing.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const b = await readBody(request);
  const list = Array.isArray(b.clients) ? b.clients : [];
  if (!list.length) throw new HttpError(400, 'Nothing to import');
  if (list.length > 60) throw new HttpError(400, 'Import 60 or fewer at a time');

  const parsed = list.map(parseClient);
  const emails = parsed.flatMap((c) => c.users.map((u) => u.email));
  const dupes = emails.filter((e, i) => emails.indexOf(e) !== i);
  if (dupes.length) throw new HttpError(400, `Used twice in this list: ${[...new Set(dupes)].join(', ')}`);
  const taken = await emailsTaken(env, emails);
  if (taken.length) throw new HttpError(409, `Already has a login: ${taken.join(', ')}`);

  const numbering = { next: await nextNumber(env) };
  const all = [];
  const logins = [];
  for (const c of parsed) {
    const r = await clientInserts(env, c, numbering);
    all.push(...r.stmts);
    logins.push(...r.logins);
  }
  await env.DB.batch(all);
  return json({ created: parsed.length, logins }, 201);
}
