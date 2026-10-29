// Membership: number, how long they've been with Sidedoor, and the milestones they've unlocked.
// Intellectual property of Sidedoor Digital.
import { HttpError } from './http.js';

export async function memberFor(env, clientId) {
  const c = await env.DB.prepare('SELECT id, business_name, created_at FROM clients WHERE id = ?').bind(clientId).first();
  if (!c) throw new HttpError(404, "Couldn't find that client");
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [num, sites, jobs, minutes, google, checks, profile, intros, refs, paid, overdue, sitesRows] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM clients WHERE created_at < ? OR (created_at = ? AND id <= ?)').bind(c.created_at, c.created_at, c.id).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM sites WHERE client_id = ?').bind(clientId).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE client_id = ? AND status = 'done'").bind(clientId).first(),
    env.DB.prepare("SELECT COALESCE(SUM(logged_minutes), 0) AS n FROM requests WHERE client_id = ? AND status = 'done'").bind(clientId).first(),
    env.DB.prepare('SELECT COALESCE(SUM(a.clicks), 0) AS n FROM analytics_daily a JOIN sites s ON s.id = a.site_id WHERE s.client_id = ?').bind(clientId).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM site_checks k JOIN sites s ON s.id = k.site_id WHERE s.client_id = ? AND k.checked_at > ?').bind(clientId, since30).first(),
    env.DB.prepare('SELECT visible FROM network_profiles WHERE client_id = ?').bind(clientId).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM network_intros WHERE (from_client = ? OR to_client = ?) AND status = 'introduced'").bind(clientId, clientId).first(),
    env.DB.prepare("SELECT COUNT(*) AS n, SUM(status = 'won') AS won FROM referrals WHERE client_id = ?").bind(clientId).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM invoices WHERE client_id = ? AND status = 'paid'").bind(clientId).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM invoices WHERE client_id = ? AND status = 'sent' AND due_date < ?").bind(clientId, new Date().toISOString().slice(0, 10)).first(),
    env.DB.prepare('SELECT health, speed FROM sites WHERE client_id = ?').bind(clientId).all()
  ]);

  const months = Math.floor((Date.now() - Date.parse(c.created_at)) / (30.44 * 864e5));
  const prot = sitesRows.results.map((s) => { try { return JSON.parse(s.health || 'null')?.protections; } catch { return null; } });
  const fullyProtected = prot.length > 0 && prot.every((p) => p && ['https', 'hsts', 'nosniff', 'framing', 'referrer', 'permissions'].every((k) => p[k]));
  const fastest = Math.max(0, ...sitesRows.results.map((s) => { try { return JSON.parse(s.speed || 'null')?.score || 0; } catch { return 0; } }));

  const m = (key, title, hint, got) => ({ key, title, hint, got: !!got });
  const milestones = [
    m('welcome', 'Through the side door', 'Joined Sidedoor', true),
    m('first-job', 'First change', 'Get your first change done', jobs.n >= 1),
    m('five-jobs', 'On a roll', 'Five changes done', jobs.n >= 5),
    m('on-the-map', 'On the map', 'First visits from Google', google.n >= 1),
    m('hundred', 'Ton up', '100 visits from Google', google.n >= 100),
    m('thousand', 'Crowd puller', '1,000 visits from Google', google.n >= 1000),
    m('protected', 'Locked up tight', 'Every protection on', fullyProtected),
    m('fast', 'Quick off the mark', 'Speed score 90 or more', fastest >= 90),
    m('network', 'In the network', 'Join the Sidedoor network', profile?.visible),
    m('connector', 'Connector', 'Get introduced to another member', intros.n >= 1),
    m('good-word', 'Good word', 'Pass on a business', refs.n >= 1),
    m('bringer', 'Bringer', 'A business you passed on joined', (refs.won || 0) >= 1),
    m('paid-up', 'Square deal', 'Pay a bill, nothing overdue', paid.n >= 1 && !overdue.n),
    m('three-months', 'Settled in', 'Three months with Sidedoor', months >= 3),
    m('one-year', 'One year in', 'A year with Sidedoor', months >= 12)
  ];

  return {
    number: num.n,
    number_label: String(num.n).padStart(3, '0'),
    business_name: c.business_name,
    since: c.created_at,
    months,
    stats: { sites: sites.n, jobs: jobs.n, minutes: minutes.n, google: google.n, checks_30d: checks.n, intros: intros.n, referrals: refs.n },
    milestones,
    unlocked: milestones.filter((x) => x.got).length
  };
}
