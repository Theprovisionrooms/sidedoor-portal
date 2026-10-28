import { json, readBody, requireAdmin, text, siteUrl, uid } from '../../../../../lib/http.js';
import { clientDetail } from '../../../../../lib/clients.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request, params } = ctx;
  const { client } = await clientDetail(env, params.id);
  const b = await readBody(request);
  const url = siteUrl(b.url);
  const name = text(b.name, { max: 80 }) || client.business_name;
  await env.DB.prepare('INSERT INTO sites (id, client_id, name, url) VALUES (?, ?, ?, ?)').bind(uid(), params.id, name, url).run();
  return json(await clientDetail(env, params.id), 201);
}
