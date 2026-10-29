import { HttpError, text, siteUrl, uid } from './http.js';
import { hashPassword, tempPassword, TEMP_ITERATIONS } from './auth.js';
import { buildInvoiceStmts, nextNumber } from './billing.js';

export async function clientDetail(env, id) {
  const client = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
  if (!client) throw new HttpError(404, "Couldn't find that client");
  const [users, sites] = await Promise.all([
    env.DB.prepare('SELECT id, name, email, must_change_password, last_login_at, created_at FROM users WHERE client_id = ? ORDER BY created_at')
      .bind(id).all(),
    env.DB.prepare('SELECT id, name, url, gsc_property, health, health_checked_at, down_since, analytics_synced_at, analytics_error, created_at FROM sites WHERE client_id = ? ORDER BY created_at').bind(id).all()
  ]);
  return { client, users: users.results, sites: sites.results };
}

export function cleanEmail(value) {
  const email = text(value, { required: true, label: 'Login email', max: 160 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, `"${email}" doesn't look like an email`);
  // Automated addresses look valid but nobody reads them, so the login would never reach the client.
  if (/@(docs\.google\.com|forms\.gle|.*\.?noreply\.|noreply@|no-reply@)/i.test(email) || /^(noreply|no-reply)@/i.test(email)) {
    throw new HttpError(400, `"${email.length > 40 ? email.slice(0, 37) + '...' : email}" is an automated address, not a real inbox. Use the client's own email.`);
  }
  return email;
}

// Validates one client (business + people + sites) without touching the database.
export function parseClient(b) {
  const business_name = text(b.business_name, { required: true, label: 'Business name', max: 120 });
  let people = Array.isArray(b.users) ? b.users : [];
  if (!people.length && (b.contact_name || b.email)) people = [{ name: b.contact_name, email: b.email }];
  people = people.filter((p) => p && (p.name || p.email)).map((p) => ({
    name: text(p.name, { required: true, label: `Contact name for ${business_name}`, max: 80 }),
    email: cleanEmail(p.email)
  }));
  if (!people.length) throw new HttpError(400, `${business_name} needs at least one person to log in`);

  const rate = b.hourly_rate_pence == null || b.hourly_rate_pence === '' ? 1500 : Math.round(Number(b.hourly_rate_pence));
  if (!Number.isFinite(rate) || rate < 0) throw new HttpError(400, 'Hourly rate needs to be a number');

  const fee = b.monthly_fee_pence == null || b.monthly_fee_pence === '' ? 0 : Math.round(Number(b.monthly_fee_pence));
  if (!Number.isFinite(fee) || fee < 0) throw new HttpError(400, 'Monthly fee needs to be a number');

  const from = String(b.monthly_from || '').trim();
  if (from && !/^\d{4}-(0[1-9]|1[0-2])$/.test(from)) throw new HttpError(400, 'Plan start should be a month like 2026-12');
  const money = (v, label) => {
    if (v == null || v === '') return 0;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${label} needs to be a number`);
    return n;
  };

  const sites = (Array.isArray(b.sites) ? b.sites : []).filter((s) => s && (s.url || s.name)).map((s) => ({
    name: text(s.name, { max: 80, label: 'Site name' }) || business_name,
    url: siteUrl(s.url)
  }));

  return {
    business_name,
    contact_name: text(b.contact_name, { max: 80 }) || people[0].name,
    phone: text(b.phone, { max: 40, label: 'Phone' }) || null,
    notes: text(b.notes, { max: 4000, label: 'Notes' }) || null,
    hourly_rate_pence: rate,
    monthly_fee_pence: fee,
    monthly_from: from || null,
    build_fee_pence: money(b.build_fee_pence, 'Build fee'),
    build_paid_pence: money(b.build_paid_pence, 'Build paid'),
    users: people,
    sites
  };
}

// Builds the insert statements for a parsed client, and returns the one-time logins.
export async function clientInserts(env, c, numbering) {
  const clientId = uid();
  const stmts = [
    env.DB.prepare('INSERT INTO clients (id, business_name, contact_name, phone, notes, hourly_rate_pence, monthly_fee_pence, monthly_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(clientId, c.business_name, c.contact_name, c.phone, c.notes, c.hourly_rate_pence, c.monthly_fee_pence, c.monthly_from)
  ];
  const logins = [];
  for (const p of c.users) {
    const password = tempPassword();
    stmts.push(env.DB.prepare("INSERT INTO users (id, email, name, role, client_id, password_hash, must_change_password) VALUES (?, ?, ?, 'client', ?, ?, 1)")
      .bind(uid(), p.email, p.name, clientId, await hashPassword(password, undefined, TEMP_ITERATIONS)));
    logins.push({ name: p.name, email: p.email, temp_password: password, business_name: c.business_name, phone: c.phone });
  }
  if (c.build_fee_pence) {
    if (!numbering) numbering = { next: await nextNumber(env) };
    const b = buildInvoiceStmts(env, clientId, c, numbering.next);
    numbering.next += b.used;
    stmts.push(...b.stmts);
  }
  for (const s of c.sites) {
    stmts.push(env.DB.prepare('INSERT INTO sites (id, client_id, name, url) VALUES (?, ?, ?, ?)').bind(uid(), clientId, s.name, s.url));
  }
  return { clientId, stmts, logins };
}

export async function emailsTaken(env, emails) {
  if (!emails.length) return [];
  const { results } = await env.DB.prepare(`SELECT email FROM users WHERE email IN (${emails.map(() => '?').join(',')})`)
    .bind(...emails).all();
  return results.map((r) => r.email);
}
