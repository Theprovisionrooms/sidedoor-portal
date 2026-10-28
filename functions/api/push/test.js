// "Send me a test" button on the Account screen.
import { json, requireUser, HttpError } from '../../../lib/http.js';
import { notify } from '../../../lib/notify.js';
import { pushConfigured } from '../../../lib/push.js';

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  if (!pushConfigured(ctx.env)) throw new HttpError(503, 'Notifications are not set up on the server yet');
  await notify(ctx.env, { userIds: [user.id] }, { title: 'Sidedoor', body: "Notifications are working. You'll hear from me here.", url: '/#/' });
  return json({ ok: true });
}
