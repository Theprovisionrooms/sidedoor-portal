import { json, readBody, requireUser, HttpError, now } from '../../../lib/http.js';
import { parseProfile, profileFor } from '../../../lib/network.js';
import { notifyLater } from '../../../lib/notify.js';

export async function onRequestPut(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const { env } = ctx;
  const p = parseProfile(await readBody(ctx.request));
  if (p.visible && !p.contact_phone && !p.contact_email) throw new HttpError(400, 'Add a phone or email for intros. It is only shared when Jordan introduces you.');
  const before = await env.DB.prepare('SELECT visible, joined_at FROM network_profiles WHERE client_id = ?').bind(user.client_id).first();
  const joined = p.visible && !before?.joined_at ? now() : before?.joined_at || null;
  await env.DB.prepare(
    `INSERT INTO network_profiles (client_id, visible, display_name, category, town, about, offer, looking_for, contact_name, contact_phone, contact_email, joined_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_id) DO UPDATE SET visible = excluded.visible, display_name = excluded.display_name, category = excluded.category,
       town = excluded.town, about = excluded.about, offer = excluded.offer, looking_for = excluded.looking_for,
       contact_name = excluded.contact_name, contact_phone = excluded.contact_phone, contact_email = excluded.contact_email,
       joined_at = excluded.joined_at, updated_at = excluded.updated_at`
  ).bind(user.client_id, p.visible, p.display_name, p.category, p.town, p.about, p.offer, p.looking_for, p.contact_name, p.contact_phone, p.contact_email, joined, now()).run();
  if (p.visible && !before?.visible) {
    notifyLater(ctx, { admins: true }, { title: `${p.display_name} joined the network`, body: p.offer ? `Member perk: ${p.offer}` : 'Profile is live.', url: '/#/intros' });
  }
  return json({ profile: await profileFor(env, user.client_id) });
}
