// Little counts on the tabs: what's waiting for this person.
import { json, requireUser } from '../../lib/http.js';

export async function onRequestGet(ctx) {
  const user = requireUser(ctx);
  const db = ctx.env.DB;
  if (user.role === 'admin') {
    const [r, m, l] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status IN ('new','approved')").first(),
      db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE status = 'sent' AND claimed_paid_at IS NOT NULL").first(),
      db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE status = 'new'").first()
    ]);
    return json({ '/': r.n + l.n, '/money': m.n });
  }
  const [q, i] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM requests WHERE client_id = ? AND status = 'quoted'").bind(user.client_id).first(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE client_id = ? AND status = 'sent' AND claimed_paid_at IS NULL").bind(user.client_id).first()
  ]);
  return json({ '/requests': q.n, '/billing': i.n });
}
