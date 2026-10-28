import { verifyPassword, hashPassword, checkNewPassword } from '../../../lib/auth.js';
import { json, readBody, requireUser, HttpError } from '../../../lib/http.js';

export async function onRequestPost(ctx) {
  const user = requireUser(ctx, { allowPending: true });
  const { env, request } = ctx;
  const b = await readBody(request);

  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
  if (!(await verifyPassword(String(b.current || ''), row.password_hash))) {
    throw new HttpError(400, "Your current password isn't right");
  }
  const problem = checkNewPassword(b.next);
  if (problem) throw new HttpError(400, problem);
  if (b.next === b.current) throw new HttpError(400, 'Pick something different from the old one');

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
      .bind(await hashPassword(b.next), user.id),
    // Sign out every other device; keep this one.
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(user.id, user.session_id)
  ]);
  return json({ ok: true });
}
