import { getSessionUser } from '../../lib/auth.js';
import { json } from '../../lib/http.js';
import { ensureSchemaOnce } from '../../lib/schema.js';

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
    await ensureSchemaOnce(env);
    ctx.data.user = await getSessionUser(request, env);
    return await ctx.next();
  } catch (e) {
    if (e && e.status) return json({ error: e.message, code: e.code }, e.status);
    console.error(e);
    const msg = String(e?.message || e);
    // Jordan sees the real cause; clients get the friendly line.
    if (ctx.data.user?.role === 'admin') {
      const schema = /no such (table|column)/i.test(msg);
      return json({
        error: schema
          ? `The live database is missing an update. Run: npx.cmd wrangler d1 migrations apply sidedoor-portal --remote (${msg})`
          : `Server error: ${msg}`
      }, 500);
    }
    return json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500);
  }
}
