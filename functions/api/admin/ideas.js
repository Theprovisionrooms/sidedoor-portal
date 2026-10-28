// Manage the ideas library.
import { json, readBody, requireAdmin, text, uid, HttpError } from '../../../lib/http.js';

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function parse(b, existing = {}) {
  const v = (k) => (k in b ? b[k] : existing[k]);
  const minutes = Math.round(Number(v('minutes')));
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 6000) throw new HttpError(400, 'Time needs to be minutes');
  const starts = v('starts') || null, ends = v('ends') || null;
  if ((starts && !MMDD.test(starts)) || (ends && !MMDD.test(ends))) throw new HttpError(400, 'Season dates look like 12-01');
  if (!!starts !== !!ends) throw new HttpError(400, 'Give both a start and an end, or neither');
  const kind = ['seasonal', 'growth', 'security'].includes(v('kind')) ? v('kind') : 'seasonal';
  return {
    title: text(v('title'), { required: true, max: 120, label: 'Title' }),
    pitch: text(v('pitch'), { required: true, max: 1200, label: 'Pitch' }),
    minutes, kind, starts, ends,
    match_host: (String(v('match_host') || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')) || null,
    client_id: v('client_id') || null,
    active: v('active') === false || v('active') === 0 ? 0 : 1
  };
}

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { results } = await ctx.env.DB.prepare(
    `SELECT i.*, c.business_name,
       (SELECT COUNT(*) FROM idea_actions a WHERE a.idea_id = i.id AND a.action = 'requested') AS taken,
       (SELECT COUNT(*) FROM idea_actions a WHERE a.idea_id = i.id AND a.action = 'dismissed') AS passed
       FROM ideas i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.active DESC, i.match_host, i.sort`
  ).all();
  return json({ ideas: results });
}

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const i = parse(await readBody(ctx.request));
  const id = uid();
  await ctx.env.DB.prepare(
    'INSERT INTO ideas (id, title, pitch, minutes, kind, starts, ends, match_host, client_id, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100)'
  ).bind(id, i.title, i.pitch, i.minutes, i.kind, i.starts, i.ends, i.match_host, i.client_id, i.active).run();
  return json({ ok: true, id }, 201);
}

export async function onRequestPatch(ctx) {
  requireAdmin(ctx);
  const b = await readBody(ctx.request);
  const existing = await ctx.env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(String(b.id || '')).first();
  if (!existing) throw new HttpError(404, "Couldn't find that idea");
  const i = parse(b, existing);
  await ctx.env.DB.prepare(
    'UPDATE ideas SET title = ?, pitch = ?, minutes = ?, kind = ?, starts = ?, ends = ?, match_host = ?, client_id = ?, active = ? WHERE id = ?'
  ).bind(i.title, i.pitch, i.minutes, i.kind, i.starts, i.ends, i.match_host, i.client_id, i.active, existing.id).run();
  return json({ ok: true });
}
