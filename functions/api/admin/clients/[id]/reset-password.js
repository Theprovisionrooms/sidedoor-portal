import { json, readBody, requireAdmin, HttpError } from '../../../../../lib/http.js';
import { hashPassword, tempPassword, TEMP_ITERATIONS } from '../../../../../lib/auth.js';

export async function onRequestPost(ctx) {
  requireAdmin(ctx);
  const { env, params, request } = ctx;
  const b = await readBody(request);
  const user = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, c.business_name, c.phone FROM users u JOIN clients c ON c.id = u.client_id
      WHERE u.client_id = ? AND u.id = ?`
  ).bind(params.id, String(b.user_id || '')).first();
  if (!user) throw new HttpError(404, "Couldn't find that login");
  const password = tempPassword();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').bind(await hashPassword(password, undefined, TEMP_ITERATIONS), user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(user.email)
  ]);
  return json({ login: { name: user.name, email: user.email, temp_password: password, business_name: user.business_name, phone: user.phone } });
}
