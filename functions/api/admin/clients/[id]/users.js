// Add another person to a client account (e.g. a business partner).
import { json, readBody, requireAdmin, text, uid, HttpError } from '../../../../../lib/http.js';
import { clientDetail, cleanEmail, emailsTaken } from '../../../../../lib/clients.js';
import { hashPassword, tempPassword } from '../../../../../lib/auth.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, request, params } = ctx;
  const { client } = await clientDetail(env, params.id);
  const b = await readBody(request);
  const name = text(b.name, { required: true, label: 'Name', max: 80 });
  const email = cleanEmail(b.email);
  if ((await emailsTaken(env, [email])).length) throw new HttpError(409, 'Someone already logs in with that email');
  const password = tempPassword();
  await env.DB.prepare("INSERT INTO users (id, email, name, role, client_id, password_hash, must_change_password) VALUES (?, ?, ?, 'client', ?, ?, 1)")
    .bind(uid(), email, name, client.id, await hashPassword(password)).run();
  return json({ login: { name, email, temp_password: password, business_name: client.business_name, phone: client.phone } }, 201);
}
