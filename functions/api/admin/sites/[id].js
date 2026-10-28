import { json, readBody, requireAdmin, text, siteUrl, HttpError } from '../../../../lib/http.js';

async function load(env, id) {
  const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
  if (!site) throw new HttpError(404, "Couldn't find that site");
  return site;
}

export async function onRequestPatch(ctx) {
  requireAdmin(ctx);
  const { env, params, request } = ctx;
  const site = await load(env, params.id);
  const b = await readBody(request);
  const name = 'name' in b ? text(b.name, { required: true, max: 80, label: 'Site name' }) : site.name;
  const url = 'url' in b ? siteUrl(b.url) : site.url;
  const gsc = 'gsc_property' in b ? text(b.gsc_property, { max: 200 }) || null : site.gsc_property;
  await env.DB.prepare('UPDATE sites SET name = ?, url = ?, gsc_property = ? WHERE id = ?').bind(name, url, gsc, site.id).run();
  return json({ site: await load(env, site.id) });
}

export async function onRequestDelete(ctx) {
  requireAdmin(ctx);
  const site = await load(ctx.env, ctx.params.id);
  await ctx.env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(site.id).run();
  return json({ ok: true });
}
