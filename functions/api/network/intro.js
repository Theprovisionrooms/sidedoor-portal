// Ask Jordan for an intro to another member.
import { json, readBody, requireUser, text, uid, HttpError } from '../../../lib/http.js';
import { notifyLater } from '../../../lib/notify.js';

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { env } = ctx;
  const b = await readBody(ctx.request);
  const to = String(b.to_client || '');
  if (to === user.client_id) throw new HttpError(400, "That's you");
  const [mine, theirs] = await Promise.all([
    env.DB.prepare('SELECT display_name, visible FROM network_profiles WHERE client_id = ?').bind(user.client_id).first(),
    env.DB.prepare('SELECT display_name, visible FROM network_profiles WHERE client_id = ?').bind(to).first()
  ]);
  if (!mine?.visible) throw new HttpError(403, 'Join the network first, so they can see who you are.');
  if (!theirs?.visible) throw new HttpError(404, "That business isn't in the network right now");
  const open = await env.DB.prepare("SELECT 1 FROM network_intros WHERE from_client = ? AND to_client = ? AND status = 'requested'").bind(user.client_id, to).first();
  if (open) throw new HttpError(409, "You've already asked. Jordan will be in touch.");
  const message = text(b.message, { required: true, max: 1000, label: 'A line on what you want to talk about' });
  const id = uid();
  await env.DB.prepare('INSERT INTO network_intros (id, from_client, to_client, message) VALUES (?, ?, ?, ?)').bind(id, user.client_id, to, message).run();
  notifyLater(ctx, { admins: true }, { title: `Intro request: ${mine.display_name} to ${theirs.display_name}`, body: message.slice(0, 120), url: '/#/intros' });
  return json({ ok: true, id }, 201);
}
