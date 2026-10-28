// Moves a request through its life:
//   client: approve | decline | cancel
//   admin:  quote | start | complete | cancel
// A quote of 0 minutes means "on the house" and skips straight to approved.
import { json, readBody, requireUser, text, uid, now, HttpError, chargePence } from '../../../../lib/http.js';
import { loadRequest, shape } from '../../../../lib/requests.js';
import { notifyLater } from '../../../../lib/notify.js';

const fmtTime = (m) => (m < 60 ? `${m} mins` : `${+(m / 60).toFixed(2)} hr`);
const fmtMoney = (p) => `£${(p / 100).toFixed(2)}`;

function minutesFrom(v) {
  const m = Math.round(Number(v));
  if (!Number.isFinite(m) || m < 0 || m > 60 * 200) throw new HttpError(400, 'Time needs to be a sensible number of minutes');
  return m;
}

export async function onRequestPost(ctx) {
  const user = requireUser(ctx);
  const { env, request, params } = ctx;
  const b = await readBody(request);
  const r = await loadRequest(env, user, params.id);
  const isAdmin = user.role === 'admin';
  const t = now();

  let update = {};
  let event = '';

  const need = (...states) => {
    if (!states.includes(r.status)) throw new HttpError(409, 'That request has moved on since you opened it. Refresh and try again.');
  };

  switch (b.action) {
    case 'quote': {
      if (!isAdmin) throw new HttpError(403, 'Not allowed');
      need('new', 'quoted');
      const minutes = minutesFrom(b.minutes);
      const note = text(b.note, { max: 1000, label: 'Note' }) || null;
      if (minutes === 0) {
        update = { status: 'approved', quoted_minutes: 0, quote_note: note, quoted_at: t, approved_at: t };
        event = 'Jordan is doing this one free of charge';
      } else {
        update = { status: 'quoted', quoted_minutes: minutes, quote_note: note, quoted_at: t };
        event = `Quoted ${fmtTime(minutes)} (${fmtMoney(chargePence(minutes, r.rate_pence))})`;
      }
      break;
    }
    case 'approve':
      if (isAdmin) throw new HttpError(403, 'The client approves quotes');
      need('quoted');
      update = { status: 'approved', approved_at: t };
      event = 'Quote approved';
      break;
    case 'decline':
      if (isAdmin) throw new HttpError(403, 'The client declines quotes');
      need('quoted');
      update = { status: 'declined' };
      event = 'Quote declined';
      break;
    case 'start':
      if (!isAdmin) throw new HttpError(403, 'Not allowed');
      need('approved');
      update = { status: 'in_progress' };
      event = 'Work started';
      break;
    case 'complete': {
      if (!isAdmin) throw new HttpError(403, 'Not allowed');
      need('approved', 'in_progress');
      const minutes = b.minutes == null || b.minutes === '' ? r.quoted_minutes : minutesFrom(b.minutes);
      // Never bill more than the client agreed to.
      const billed = r.quoted_minutes != null ? Math.min(minutes ?? 0, r.quoted_minutes) : minutes ?? 0;
      update = { status: 'done', logged_minutes: billed, completed_at: t };
      event = billed ? `Done. ${fmtTime(billed)} logged (${fmtMoney(chargePence(billed, r.rate_pence))})` : 'Done, no charge';
      break;
    }
    case 'cancel':
      if (isAdmin) need('new', 'quoted', 'approved', 'in_progress');
      else need('new', 'quoted');
      update = { status: 'cancelled' };
      event = isAdmin ? 'Cancelled by Jordan' : 'Cancelled';
      break;
    default:
      throw new HttpError(400, 'Unknown action');
  }

  update.updated_at = t;
  const cols = Object.keys(update);
  const stmts = [
    env.DB.prepare(`UPDATE requests SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .bind(...cols.map((c) => update[c]), r.id),
    env.DB.prepare("INSERT INTO request_messages (id, request_id, user_id, body, kind, created_at) VALUES (?, ?, ?, ?, 'event', ?)")
      .bind(uid(), r.id, user.id, event, t)
  ];
  const note = text(b.message, { max: 4000, label: 'Message' });
  if (note) {
    stmts.push(env.DB.prepare("INSERT INTO request_messages (id, request_id, user_id, body, kind, created_at) VALUES (?, ?, ?, ?, 'message', ?)")
      .bind(uid(), r.id, user.id, note, t));
  }
  await env.DB.batch(stmts);

  const url = `/#/requests/${r.id}`;
  const toClient = (title, body) => notifyLater(ctx, { clientId: r.client_id }, { title, body, url });
  const toJordan = (title, body) => notifyLater(ctx, { admins: true }, { title, body, url });
  if (b.action === 'quote') toClient(update.status === 'approved' ? 'On the house' : 'Your quote is ready', `${r.title}: ${event}`);
  else if (b.action === 'start') toClient('Work has started', r.title);
  else if (b.action === 'complete') toClient('Done and live', `${r.title}. ${event}`);
  else if (b.action === 'approve') toJordan(`${r.business_name} approved`, r.title);
  else if (b.action === 'decline') toJordan(`${r.business_name} declined`, r.title);
  else if (b.action === 'cancel') (isAdmin ? toClient : toJordan)('Request cancelled', r.title);

  return json({ request: shape(await loadRequest(env, user, r.id)) });
}
