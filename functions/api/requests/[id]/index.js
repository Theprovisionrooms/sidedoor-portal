import { json, requireUser } from '../../../../lib/http.js';
import { loadRequest, messagesFor, shape } from '../../../../lib/requests.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const r = await loadRequest(ctx.env, user, ctx.params.id);
  return json({ request: shape(r), messages: await messagesFor(ctx.env, r.id) });
}
