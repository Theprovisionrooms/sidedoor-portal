import { getSessionUser } from '../../lib/auth.js';
import { json } from '../../lib/http.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;

  // Writes must come from this app, not another site riding the cookie.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) {
      return json({ error: 'Not allowed' }, 403);
    }
  }

  try {
    ctx.data.user = await getSessionUser(request, env);
    return await ctx.next();
  } catch (e) {
    if (e && e.status) return json({ error: e.message, code: e.code }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500);
  }
}
