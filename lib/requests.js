import { HttpError, chargePence } from './http.js';

const SELECT = `SELECT r.*, s.name AS site_name, s.url AS site_url, c.business_name
  FROM requests r
  LEFT JOIN sites s ON s.id = r.site_id
  JOIN clients c ON c.id = r.client_id`;

export function shape(r) {
  const billMinutes = r.status === 'done' ? (r.logged_minutes ?? r.quoted_minutes) : r.quoted_minutes;
  return {
    id: r.id,
    client_id: r.client_id,
    business_name: r.business_name,
    site: r.site_id ? { id: r.site_id, name: r.site_name, url: r.site_url } : null,
    title: r.title,
    details: r.details,
    urgent: !!r.urgent,
    status: r.status,
    quoted_minutes: r.quoted_minutes,
    quote_note: r.quote_note,
    logged_minutes: r.logged_minutes,
    rate_pence: r.rate_pence,
    quoted_pence: r.quoted_minutes == null ? null : chargePence(r.quoted_minutes, r.rate_pence),
    charge_pence: billMinutes == null ? null : chargePence(billMinutes, r.rate_pence),
    created_at: r.created_at,
    updated_at: r.updated_at,
    quoted_at: r.quoted_at,
    approved_at: r.approved_at,
    completed_at: r.completed_at
  };
}

export async function listRequests(env, user, { clientId, open } = {}) {
  const where = [];
  const args = [];
  if (user.role !== 'admin') { where.push('r.client_id = ?'); args.push(user.client_id); }
  else if (clientId) { where.push('r.client_id = ?'); args.push(clientId); }
  if (open) where.push("r.status IN ('new','quoted','approved','in_progress')");
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.updated_at DESC LIMIT 200`;
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return results.map(shape);
}

export async function loadRequest(env, user, id) {
  const r = await env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(id).first();
  if (!r || (user.role !== 'admin' && r.client_id !== user.client_id)) throw new HttpError(404, "Couldn't find that request");
  return r;
}

export async function messagesFor(env, requestId) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.body, m.kind, m.created_at, u.name AS author, u.role AS author_role
       FROM request_messages m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.request_id = ? ORDER BY m.created_at ASC`
  ).bind(requestId).all();
  return results;
}
