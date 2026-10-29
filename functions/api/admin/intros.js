// Jordan's side of the network: intro requests and members.
import { json, readBody, requireAdmin, now, HttpError } from '../../../lib/http.js';
import { notifyLater } from '../../../lib/notify.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { env } = ctx;
  const [intros, members] = await Promise.all([
    env.DB.prepare(
      `SELECT i.*, pf.display_name AS from_name, pt.display_name AS to_name FROM network_intros i
         LEFT JOIN network_profiles pf ON pf.client_id = i.from_client
         LEFT JOIN network_profiles pt ON pt.client_id = i.to_client
        ORDER BY i.status = 'requested' DESC, i.created_at DESC LIMIT 100`
    ).all(),
    env.DB.prepare(
      `SELECT p.client_id, p.display_name, p.category, p.town, p.offer, p.looking_for, p.visible, p.joined_at
         FROM network_profiles p JOIN clients c ON c.id = p.client_id WHERE c.archived = 0 ORDER BY p.visible DESC, p.joined_at DESC`
    ).all()
  ]);
  return json({ intros: intros.results, members: members.results });
}

export async function onRequestPatch(ctx) {
  requireAdmin(ctx);
  const { env } = ctx;
  const b = await readBody(ctx.request);
  if (b.hide_client) {
    await env.DB.prepare('UPDATE network_profiles SET visible = 0 WHERE client_id = ?').bind(String(b.hide_client)).run();
    return json({ ok: true });
  }
  const i = await env.DB.prepare(
    `SELECT i.*, pf.display_name AS from_name, pt.display_name AS to_name FROM network_intros i
       LEFT JOIN network_profiles pf ON pf.client_id = i.from_client
       LEFT JOIN network_profiles pt ON pt.client_id = i.to_client WHERE i.id = ?`
  ).bind(String(b.id || '')).first();
  if (!i) throw new HttpError(404, "Couldn't find that intro");
  if (i.status !== 'requested') throw new HttpError(409, 'Already sorted');
  if (b.action === 'introduce') {
    await env.DB.prepare("UPDATE network_intros SET status = 'introduced', decided_at = ?, seen_from = 0, seen_to = 0 WHERE id = ?").bind(now(), i.id).run();
    notifyLater(ctx, { clientId: i.from_client }, { title: `You're introduced to ${i.to_name}`, body: 'Their details are in the Network tab. Go say hello.', url: '/#/network' });
    notifyLater(ctx, { clientId: i.to_client }, { title: `Jordan's introduced you to ${i.from_name}`, body: 'Another Sidedoor business wants a chat. Details in the Network tab.', url: '/#/network' });
  } else if (b.action === 'decline') {
    await env.DB.prepare("UPDATE network_intros SET status = 'declined', decided_at = ?, seen_from = 0 WHERE id = ?").bind(now(), i.id).run();
  } else throw new HttpError(400, 'Unknown action');
  return json({ ok: true });
}
