// One-time creation of Jordan's admin login.
// Only works while SETUP_TOKEN is set and no admin exists yet. Remove the secret afterwards.
import { hashPassword, checkNewPassword, createSession } from '../../lib/auth.js';
import { json, readBody, text, uid, HttpError } from '../../lib/http.js';

export async function onRequestPost({ request, env }) {
  if (!env.SETUP_TOKEN) throw new HttpError(404, 'Not found');
  const b = await readBody(request);
  if (b.token !== env.SETUP_TOKEN) throw new HttpError(403, 'Wrong setup token');

  const existing = await env.DB.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").first();
  if (existing) throw new HttpError(409, 'Admin already set up');

  const name = text(b.name, { required: true, label: 'Name', max: 80 });
  const email = text(b.email, { required: true, label: 'Email', max: 160 }).toLowerCase();
  const problem = checkNewPassword(b.password);
  if (problem) throw new HttpError(400, problem);

  const id = uid();
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, role, password_hash, must_change_password) VALUES (?, ?, ?, 'admin', ?, 0)"
  ).bind(id, email, name, await hashPassword(b.password)).run();

  return json({ ok: true }, 201, { 'set-cookie': await createSession(env, id) });
}
