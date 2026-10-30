// Little counts on the tabs: what's waiting for this person.
import { json, requireUser } from '../../lib/http.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const db = ctx.env.DB;
  if (user.role === 'admin') {
    const [r, m, l, n] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status IN ('new','approved')").first(),
      db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE status = 'sent' AND claimed_paid_at IS NOT NULL").first(),
      db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE status = 'new'").first(),
      db.prepare("SELECT COUNT(*) AS n FROM network_intros WHERE status = 'requested'").first()
    ]);
    return json({ '/': r.n + l.n + n.n, '/money': m.n });
  }
  const [q, i, n, u] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM requests WHERE client_id = ? AND status = 'quoted'").bind(user.client_id).first(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE client_id = ? AND status = 'sent' AND claimed_paid_at IS NULL").bind(user.client_id).first(),
    db.prepare(
      "SELECT COUNT(*) AS n FROM network_intros WHERE (from_client = ? AND seen_from = 0) OR (to_client = ? AND status = 'introduced' AND seen_to = 0)"
    ).bind(user.client_id, user.client_id).first(),
    db.prepare(
      `SELECT COUNT(*) AS n FROM updates u WHERE (u.client_id IS NULL OR u.client_id = ?)
         AND NOT EXISTS (SELECT 1 FROM update_reads r WHERE r.update_id = u.id AND r.user_id = ?)`
    ).bind(user.client_id, user.id).first()
  ]);
  // The network lives under More now, so its intros count there too.
  return json({ '/': u.n, '/requests': q.n, '/account': i.n + n.n, '/network': n.n });
}
