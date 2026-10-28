import { endSession, clearCookie } from '../../../lib/auth.js';
import { json } from '../../../lib/http.js';

export async function onRequestPost({ request, env }) {
  await endSession(request, env);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie });
}
