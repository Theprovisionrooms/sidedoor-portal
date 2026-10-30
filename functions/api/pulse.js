// The live pulse on a client's Home: is the site up right now, when it was last checked,
// and everything that has happened lately, newest first. Light enough to call every minute.
// Intellectual property of Sidedoor Digital.
import { json, requireUser, HttpError } from '../../lib/http.js';

const CHECK_EVERY_MINS = 30;

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'client') throw new HttpError(404, 'Not found');
  const db = ctx.env.DB;
  const cid = user.client_id;
  const url = new URL(ctx.request.url);
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw).toISOString() : null;
  const today = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const back14 = new Date(Date.now() - 14 * 864e5).toISOString();

  const { results: sites } = await db.prepare('SELECT id, name, url, down_since FROM sites WHERE client_id = ? ORDER BY created_at').bind(cid).all();

  const siteRows = await Promise.all(sites.map(async (s) => {
    const [last, day, sinceN, google] = await Promise.all([
      db.prepare('SELECT checked_at, ok, ms FROM site_checks WHERE site_id = ? ORDER BY checked_at DESC LIMIT 1').bind(s.id).first(),
      db.prepare('SELECT COUNT(*) AS n, SUM(ok) AS up FROM site_checks WHERE site_id = ? AND checked_at >= ?').bind(s.id, today).first(),
      since ? db.prepare('SELECT COUNT(*) AS n, SUM(ok) AS up FROM site_checks WHERE site_id = ? AND checked_at > ?').bind(s.id, since).first() : null,
      db.prepare('SELECT date, clicks, impressions FROM analytics_daily WHERE site_id = ? ORDER BY date DESC LIMIT 1').bind(s.id).first()
    ]);
    const next = last ? new Date(Date.parse(last.checked_at) + CHECK_EVERY_MINS * 60000).toISOString() : null;
    return {
      site_id: s.id,
      name: s.name,
      url: s.url,
      up_now: last ? !!last.ok && !s.down_since : null,
      down_since: s.down_since || null,
      last_checked_at: last?.checked_at || null,
      next_check_at: next,
      ms: last?.ms ?? null,
      checks_today: day?.n || 0,
      misses_today: (day?.n || 0) - (day?.up || 0),
      checks_since: sinceN ? sinceN.n || 0 : null,
      google_day: google ? { date: google.date, clicks: google.clicks, impressions: google.impressions } : null
    };
  }));

  // Everything that's happened lately, in plain words.
  const [log, msgs, ups, bills, intros] = await Promise.all([
    db.prepare(
      `SELECT id, kind, title, body, created_at FROM work_log
        WHERE (client_id = ? OR client_id IS NULL) AND created_at > ? ORDER BY created_at DESC LIMIT 12`
    ).bind(cid, back14).all(),
    db.prepare(
      `SELECT m.id, m.body, m.kind, m.created_at, r.id AS request_id, r.title FROM request_messages m
         JOIN requests r ON r.id = m.request_id
         LEFT JOIN users u ON u.id = m.user_id
        WHERE r.client_id = ? AND m.created_at > ? AND (m.kind = 'event' OR u.role = 'admin')
        ORDER BY m.created_at DESC LIMIT 12`
    ).bind(cid, back14).all(),
    db.prepare(
      `SELECT id, title, created_at FROM updates WHERE (client_id IS NULL OR client_id = ?) AND created_at > ? ORDER BY created_at DESC LIMIT 5`
    ).bind(cid, back14).all(),
    db.prepare(
      `SELECT id, title, sent_at, paid_at FROM invoices WHERE client_id = ? AND status IN ('sent','paid')
         AND (sent_at > ? OR paid_at > ?) ORDER BY COALESCE(paid_at, sent_at) DESC LIMIT 4`
    ).bind(cid, back14, back14).all(),
    db.prepare(
      `SELECT i.id, i.decided_at, CASE WHEN i.from_client = ? THEN t.business_name ELSE f.business_name END AS other
         FROM network_intros i JOIN clients f ON f.id = i.from_client JOIN clients t ON t.id = i.to_client
        WHERE (i.from_client = ? OR i.to_client = ?) AND i.status = 'introduced' AND i.decided_at > ?`
    ).bind(cid, cid, cid, back14).all()
  ]);

  const KIND = { security: 'Security', update: 'Update', backup: 'Backup', speed: 'Speed', other: 'Work' };
  const feed = [
    ...log.results.map((l) => ({ kind: 'work', tag: KIND[l.kind] || 'Work', title: l.title, body: l.body || '', at: l.created_at, href: '#/security' })),
    ...msgs.results.map((m) => ({
      kind: 'request', tag: 'Your changes',
      title: m.kind === 'event' ? `${m.title}: ${m.body}` : `Jordan replied on "${m.title}"`,
      body: m.kind === 'event' ? '' : m.body.slice(0, 140),
      at: m.created_at, href: `#/requests/${m.request_id}`
    })),
    ...ups.results.map((u) => ({ kind: 'update', tag: 'From Jordan', title: u.title, body: '', at: u.created_at, href: '#/updates' })),
    ...bills.results.map((b) => ({
      kind: 'bill', tag: 'Billing', title: b.paid_at ? `${b.title} paid. Thank you.` : `${b.title} is ready`, body: '',
      at: b.paid_at || b.sent_at, href: `#/billing/${b.id}`
    })),
    ...intros.results.map((i) => ({ kind: 'network', tag: 'Network', title: `You've been introduced to ${i.other}`, body: '', at: i.decided_at, href: '#/network' }))
  ]
    .filter((f) => f.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 15)
    .map((f) => ({ ...f, fresh: !!since && f.at > since }));

  return json({ now: new Date().toISOString(), check_every_mins: CHECK_EVERY_MINS, sites: siteRows, feed });
}
