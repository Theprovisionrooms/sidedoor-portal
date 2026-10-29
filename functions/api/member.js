// Membership card, milestones and the weekly tips. Jordan can pass ?client= to see a client's.
import { json, requireUser } from '../../lib/http.js';
import { memberFor } from '../../lib/member.js';
import { tipOfTheWeek, recentTips } from '../../lib/tips.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const url = new URL(ctx.request.url);
  const clientId = user.role === 'admin' ? url.searchParams.get('client') : user.client_id;
  const member = clientId ? await memberFor(ctx.env, clientId) : null;
  return json({ member, tip: tipOfTheWeek(), tips: url.searchParams.get('tips') ? recentTips(8) : undefined });
}
