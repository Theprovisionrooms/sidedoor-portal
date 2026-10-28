import { verifyPassword, hashPassword, createSession } from '../../../lib/auth.js';
import { json, readBody, now, HttpError } from '../../../lib/http.js';

const WINDOW_MIN = 15;
const MAX_FAILS = 8;

export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!email || !password) throw new HttpError(400, 'Pop in your email and password');

  const since = new Date(Date.now() - WINDOW_MIN * 60e3).toISOString();
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND created_at > ?')
    .bind(email, since).first();
  if (n >= MAX_FAILS) throw new HttpError(429, 'Too many tries. Give it 15 minutes, or message Jordan to reset it.');

  const user = await env.DB.prepare(
    `SELECT u.id, u.password_hash, u.must_change_password, u.role, c.archived
       FROM users u LEFT JOIN clients c ON c.id = u.client_id WHERE u.email = ?`
  ).bind(email).first();

  let ok = false;
  if (user) ok = await verifyPassword(password, user.password_hash);
  else await hashPassword(password); // same work either way, so timing gives nothing away

  if (!ok || user.archived) {
    await env.DB.prepare('INSERT INTO login_attempts (email, created_at) VALUES (?, ?)').bind(email, now()).run();
    throw new HttpError(401, "That email and password don't match");
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email),
    env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now(), user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(user.id, now())
  ]);

  return json(
    { ok: true, role: user.role, must_change_password: !!user.must_change_password },
    200,
    { 'set-cookie': await createSession(env, user.id) }
  );
}
